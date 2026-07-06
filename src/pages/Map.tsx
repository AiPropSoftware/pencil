import * as React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumericField } from "@/components/MoneyInput";
import { fmtMoney, fmtNumber, fmtPct } from "@/lib/format";
import {
  metroTrend, ppsfSummary,
  PRODUCT_TYPES, TYPE_COLOR,
  type Development, type ProductType,
} from "@/data/developments";
import { LISTING_KINDS, LISTING_COLOR, type Listing, type ListingKind } from "@/data/listings";
import { fetchAllCityDevelopments, type LivePermits } from "@/providers/permits/socrata";
import { fetchSoldRates } from "@/providers/sold/socrataSales";
import { setLiveSaleRates } from "@/lib/underwrite/liveSaleRates";
import { fetchMlsListings } from "@/providers/listings/mls";
import { discoverCityPermits } from "@/providers/permits/discovery";
import { geocodeVerify } from "@/lib/googleMaps";
import { GoogleMapView } from "@/components/GoogleMapView";

// Heavy libraries load on demand, never on first paint: Leaflet only when the
// user switches off the Google basemap, Recharts only when a panel opens.
const LeafletMapView = React.lazy(() => import("@/components/LeafletMapView"));
const PpsfChart = React.lazy(() => import("@/components/DealCharts").then((m) => ({ default: m.PpsfChart })));
const PriceHistoryChart = React.lazy(() => import("@/components/DealCharts").then((m) => ({ default: m.PriceHistoryChart })));
import { scoreOpportunity, buildPpsf, PLAUSIBLE_MARGIN_CAP, HARD_MONEY_RATE } from "@/lib/underwrite/opportunity";
import { setLiveBuildCosts, getLiveBuildCost } from "@/lib/underwrite/liveCosts";
import { useWatchlist } from "@/hooks/useWatchlist";
import { toast } from "sonner";
import { govLinksFor } from "@/data/govLinks";
import { lendersFor, lenderSearchUrl } from "@/data/lenders";
import {
  Search, X, ArrowRight, Building2, CalendarDays, Ruler, Layers3, TrendingUp,
  ExternalLink, HardHat, Plus, Sparkles, Globe, Home, Hammer,
  Heart, Link2, Landmark, ScrollText,
} from "lucide-react";

const PAGE = 14;
// Domain-restricted public client key (env var overrides). Unlocks the
// embedded Street View panorama + Google geocoder pin cross-checks.
const GOOGLE_MAPS_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ||
  "AIzaSyAiF6_fZGh2obSzRVLLgIiuIBltxIVv9Wk";

// Real imagery of the actual permitted address — never a stock photo.
const streetViewImg = (lat: number, lng: number, w = 800, h = 400) =>
  `https://maps.googleapis.com/maps/api/streetview?size=${w}x${h}&location=${lat},${lng}&fov=80&key=${GOOGLE_MAPS_KEY}`;

type Layer = "construction" | "listings";
type Selection =
  | { kind: "dev"; data: Development }
  | { kind: "listing"; data: Listing }
  | null;

interface Pin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  deal: boolean;
  selected: boolean;
  label: string;
  onClick: () => void;
}



// ── X-ray computation shared by cards + panels ──────────────────────────────
function devOpportunity(d: Development) {
  return scoreOpportunity({ city: d.city, type: d.productType, buildableSqft: d.buildingSqft, areaPpsf: ppsfSummary(d.city).current });
}
function listingOpportunity(l: Listing) {
  return scoreOpportunity({
    city: l.city, type: l.productTypeIfBuilt, buildableSqft: l.buildableSqft,
    areaPpsf: ppsfSummary(l.city).current, landPrice: l.listPrice,
  });
}

// ── Main single-surface app ─────────────────────────────────────────────────
export default function MapPage() {
  // Resume where the user left off (layer + search persist across visits).
  const [layer, setLayer] = React.useState<Layer>(
    () => (localStorage.getItem("pencil:layer") as Layer) || "construction",
  );
  const [place, setPlace] = React.useState(() => localStorage.getItem("pencil:place") ?? "");
  React.useEffect(() => { localStorage.setItem("pencil:layer", layer); }, [layer]);
  React.useEffect(() => { localStorage.setItem("pencil:place", place); }, [place]);

  const [typeFilter, setTypeFilter] = React.useState<Set<ProductType>>(new Set(PRODUCT_TYPES));
  const [kindFilter, setKindFilter] = React.useState<Set<ListingKind>>(new Set(LISTING_KINDS));
  const [visibleCount, setVisibleCount] = React.useState(PAGE);
  const [selected, setSelected] = React.useState<Selection>(null);
  const [dealsOnly, setDealsOnly] = React.useState(false);
  const [fly, setFly] = React.useState<{ lat: number; lng: number } | null>(null);
  const [basemap, setBasemap] = React.useState<"streets" | "satellite" | "google">("google");

  // Watchlist — hearts persist across visits.
  const { ids: watched, toggle: toggleWatch } = useWatchlist();
  const [watchOnly, setWatchOnly] = React.useState(false);

  // Live multi-city permit feeds.
  const [live, setLive] = React.useState<LivePermits | null>(null);

  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null);
  const [mlsListings, setMlsListings] = React.useState<Listing[]>([]);

  // Genuinely self-updating: refetch every 5 minutes so the LIVE dot is honest.
  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      // Recorded-sales medians land in the store BEFORE permits render, so the
      // X-ray's sell-side uses real deeds where cities publish them.
      const sold = fetchSoldRates()
        .then((rates) => {
          if (cancelled) return;
          setLiveSaleRates(rates.filter((r) => r.ppsf != null).map((r) => ({ city: r.city, ppsf: r.ppsf as number, samples: r.samples })));
          // eslint-disable-next-line no-console
          console.info("[Pencil] recorded-sales rates:", rates);
        })
        .catch(() => {});
      Promise.allSettled([sold]).then(() => fetchAllCityDevelopments()
        .then((r) => {
          if (cancelled) return;
          setLiveBuildCosts(r.liveBuildCosts); // real permit-derived build $/sf feeds the X-ray
          setLive(r);
          setLastUpdated(Date.now());
          // Diagnostics live in the console now (the chip is a pure status light).
          // eslint-disable-next-line no-console
          console.info("[Pencil] live permit feeds:", r.perCity.map((c) => ({
            city: c.city, rows: c.total, usable: c.items.length,
            buildPpsf: c.medianBuildPpsf ?? null, error: c.error ?? null, url: c.url,
            columns: c.items.length === 0 ? c.columns.join(",") : undefined,
          })));
        })
        .catch(() => { if (!cancelled) setLive((prev) => prev ?? { perCity: [], items: [], liveCityNames: [], liveBuildCosts: {} }); }));
    };
    // First paint wins: let the map + demo pins render before we start
    // streaming megabytes of permit JSON on the same thread.
    const kickoff = setTimeout(load, 1500);
    const timer = setInterval(load, 5 * 60_000);

    // MLS listings (activates the moment Bridge credentials exist server-side).
    fetchMlsListings().then(({ listings: mls, status }) => {
      if (cancelled) return;
      // eslint-disable-next-line no-console
      console.info("[Pencil] MLS feed:", status);
      if (mls.length > 0) setMlsListings(mls);
    }).catch(() => {});

    return () => { cancelled = true; clearTimeout(kickoff); clearInterval(timer); };
  }, []);

  // National self-discovery: permits found on demand for searched places.
  const [discovered, setDiscovered] = React.useState<Record<string, Development[]>>({});
  const [discovering, setDiscovering] = React.useState(false);
  const discoveryRan = React.useRef<Set<string>>(new Set());

  // Real inventory only: listings come exclusively from the licensed MLS
  // feed (Bridge). No feed configured → an honest empty layer, never fakes.
  const allListings = React.useMemo(() => mlsListings, [mlsListings]);

  React.useEffect(() => { setVisibleCount(PAGE); }, [place, layer, typeFilter, kindFilter, dealsOnly, watchOnly]);

  const allDevs = React.useMemo(() => {
    // Real public records only: live city feeds + on-demand discovery.
    const base = live?.items ?? [];
    const extra = Object.values(discovered).flat();
    if (extra.length === 0) return base;
    const ids = new Set(base.map((d) => d.id));
    return [...base, ...extra.filter((d) => !ids.has(d.id))];
  }, [live, discovered]);

  // "What's new since your last visit" — the comeback hook.
  const [newCount, setNewCount] = React.useState(0);
  React.useEffect(() => {
    if (!live || live.items.length === 0) return;
    const KEY = "pencil:lastSeenPermitDate";
    const last = localStorage.getItem(KEY);
    const maxDate = live.items.reduce((m, d) => (d.approvedDate > m ? d.approvedDate : m), "");
    if (last) setNewCount(live.items.filter((d) => d.approvedDate > last).length);
    if (maxDate) localStorage.setItem(KEY, maxDate);
  }, [live]);

  // Selection with shareable deep-links (?pin=<id>).
  const select = React.useCallback((sel: Selection) => {
    setSelected(sel);
    if (sel) window.history.replaceState(null, "", `?pin=${encodeURIComponent(sel.data.id)}`);
    else window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const deepLinkDone = React.useRef(false);
  React.useEffect(() => {
    if (deepLinkDone.current) return;
    const pin = new URLSearchParams(window.location.search).get("pin");
    if (!pin) { deepLinkDone.current = true; return; }
    const d = allDevs.find((x) => x.id === pin);
    if (d) {
      setSelected({ kind: "dev", data: d });
      setFly({ lat: d.lat, lng: d.lng });
      deepLinkDone.current = true;
      return;
    }
    const l = allListings.find((x) => x.id === pin);
    if (l) {
      setSelected({ kind: "listing", data: l });
      setFly({ lat: l.lat, lng: l.lng });
      deepLinkDone.current = true;
    }
    // If not found yet, retry when live data lands (effect re-runs on data).
  }, [allDevs, allListings]);

  const matchesPlace = (s: string) => place.trim() === "" || s.toLowerCase().includes(place.trim().toLowerCase());

  const devMatches = React.useMemo(
    () => allDevs.filter((d) =>
      typeFilter.has(d.productType) &&
      matchesPlace(`${d.name} ${d.developer} ${d.city} ${d.state}`) &&
      (!watchOnly || watched.has(d.id))),
    [allDevs, typeFilter, place, watchOnly, watched],
  );
  const listingMatches = React.useMemo(
    () => allListings.filter((l) =>
      kindFilter.has(l.kind) &&
      matchesPlace(`${l.address} ${l.city} ${l.state} ${l.kind}`) &&
      (!dealsOnly || listingOpportunity(l).atPrice?.isDeal) &&
      (!watchOnly || watched.has(l.id))),
    [allListings, kindFilter, place, dealsOnly, watchOnly, watched],
  );

  // On-demand discovery: user searches a place we have little/no data for →
  // hunt its permit datasets across the national Socrata/ArcGIS catalogs.
  React.useEffect(() => {
    const key = place.trim().toLowerCase();
    if (key.length < 4 || layer !== "construction") return;
    if (discoveryRan.current.has(key)) return;
    const timer = setTimeout(() => {
      if (discoveryRan.current.has(key)) return;
      if (devMatches.length >= 8) { discoveryRan.current.add(key); return; } // already covered
      discoveryRan.current.add(key);
      setDiscovering(true);
      discoverCityPermits(place)
        .then((r) => {
          // eslint-disable-next-line no-console
          console.info("[Pencil] discovery:", place, { found: r.items.length, sources: r.sources, notes: r.notes });
          if (r.items.length > 0) setDiscovered((prev) => ({ ...prev, [key]: r.items }));
        })
        .catch(() => {})
        .finally(() => setDiscovering(false));
    }, 900); // debounce typing
    return () => clearTimeout(timer);
  }, [place, layer, devMatches.length]);

  // Auto-finder: score every listing and float the best deals to the top.
  const scoredListings = React.useMemo(
    () => listingMatches
      .map((l) => ({ l, opp: listingOpportunity(l) }))
      .sort((a, b) => (b.opp.atPrice?.margin ?? 0) - (a.opp.atPrice?.margin ?? 0)),
    [listingMatches],
  );
  const dealCount = scoredListings.filter((s) => s.opp.atPrice?.isDeal).length;
  const bestMargin = scoredListings[0]?.opp.atPrice?.margin ?? 0;

  const activeList = layer === "construction" ? devMatches : scoredListings.map((s) => s.l);
  const visible = activeList.slice(0, visibleCount);
  const hasMore = visibleCount < activeList.length;

  const pins: Pin[] = React.useMemo(() => {
    // A single bad coordinate from a live feed must never crash a map render.
    const finite = (p: { lat: number; lng: number }) => Number.isFinite(p.lat) && Number.isFinite(p.lng);
    if (layer === "construction") {
      return devMatches.filter(finite).map((d) => ({
        id: d.id, lat: d.lat, lng: d.lng, color: TYPE_COLOR[d.productType], deal: false,
        selected: selected?.kind === "dev" && selected.data.id === d.id,
        label: `${d.name} · ${d.productType}`,
        onClick: () => select({ kind: "dev", data: d }),
      }));
    }
    return listingMatches.filter(finite).map((l) => ({
      id: l.id, lat: l.lat, lng: l.lng, color: LISTING_COLOR[l.kind],
      deal: !!listingOpportunity(l).atPrice?.isDeal,
      selected: selected?.kind === "listing" && selected.data.id === l.id,
      label: `${l.kind} · ${fmtMoney(l.listPrice)}`,
      onClick: () => select({ kind: "listing", data: l }),
    }));
  }, [layer, devMatches, listingMatches, selected, select]);

  return (
    <div className="flex flex-col">
      {/* Control bar — z-index above Leaflet's panes (≤1000) so popovers never clip */}
      <div className="relative z-[1200] border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-1">
            <ToggleBtn active={layer === "construction"} onClick={() => setLayer("construction")} icon={Hammer}>Construction</ToggleBtn>
            <ToggleBtn active={layer === "listings"} onClick={() => setLayer("listings")} icon={Home}>Listings</ToggleBtn>
          </div>
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search a city or state (e.g. Miami, FL)" value={place} onChange={(e) => setPlace(e.target.value)} />
            {place && <button onClick={() => setPlace("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
          {layer === "listings" && (
            <button
              onClick={() => setDealsOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${dealsOnly ? "border-gold bg-gold-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              <Sparkles className="h-4 w-4 text-gold" /> Deals only
            </button>
          )}
          <button
            onClick={() => setWatchOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${watchOnly ? "border-gold bg-gold-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
            title="Show only properties you're watching"
          >
            <Heart className={`h-4 w-4 ${watchOnly ? "text-gold fill-current" : ""}`} /> Watchlist{watched.size > 0 ? ` (${watched.size})` : ""}
          </button>
          <LiveStatusChip live={live} lastUpdated={lastUpdated} />
        </div>
        {/* Filter chips */}
        <div className="container pb-3 flex flex-wrap gap-1.5">
          {layer === "construction"
            ? PRODUCT_TYPES.map((t) => (
                <FilterPill key={t} active={typeFilter.has(t)} color={TYPE_COLOR[t]} onClick={() => toggleSet(setTypeFilter, t)}>{t}</FilterPill>
              ))
            : LISTING_KINDS.map((k) => (
                <FilterPill key={k} active={kindFilter.has(k)} color={LISTING_COLOR[k]} onClick={() => toggleSet(setKindFilter, k)}>{k}</FilterPill>
              ))}
        </div>
      </div>

      {/* Rail + map */}
      <div className="grid lg:grid-cols-[380px_1fr]">
        {/* Listing rail */}
        <div className="order-2 lg:order-1 border-r border-border/60 max-h-[calc(100vh-9rem)] overflow-y-auto">
          {layer === "listings" && dealCount > 0 && (
            <div className="mx-3 mt-3 rounded-md border border-gold/40 bg-gold-muted/40 p-2.5 text-xs">
              <span className="font-medium text-foreground">🔥 {dealCount} deal{dealCount > 1 ? "s" : ""}</span>
              <span className="text-muted-foreground"> in {place || "view"} · best margin {fmtPct(bestMargin)} · ranked below</span>
            </div>
          )}
          {layer === "construction" && newCount > 0 && (
            <div className="mx-3 mt-3 rounded-md border border-gold/40 bg-gold-muted/40 p-2.5 text-xs">
              <span className="font-medium text-foreground">● {newCount} new permit{newCount > 1 ? "s" : ""} filed</span>
              <span className="text-muted-foreground"> since your last visit — real public records</span>
            </div>
          )}
          <div className="p-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>{activeList.length} {layer === "construction" ? "real permits" : "MLS listings"}{place ? ` in “${place}”` : ""}</span>
            {!place && <span className="text-gold">Search a city to focus</span>}
          </div>
          {discovering && (
            <div className="mx-3 mb-2 rounded-md border border-gold/40 bg-gold-muted/40 p-2.5 text-xs text-foreground/80 animate-pulse">
              🔍 Searching national public-record catalogs for “{place}”…
            </div>
          )}
          <div className="px-3 pb-3 space-y-2">
            {visible.map((item) =>
              layer === "construction"
                ? <DevCard
                    key={(item as Development).id}
                    d={item as Development}
                    selected={selected?.kind === "dev" && selected.data.id === (item as Development).id}
                    watched={watched.has((item as Development).id)}
                    onWatch={() => toggleWatch((item as Development).id)}
                    onClick={() => { const d = item as Development; select({ kind: "dev", data: d }); setFly({ lat: d.lat, lng: d.lng }); }}
                  />
                : <ListingCard
                    key={(item as Listing).id}
                    l={item as Listing}
                    selected={selected?.kind === "listing" && selected.data.id === (item as Listing).id}
                    watched={watched.has((item as Listing).id)}
                    onWatch={() => toggleWatch((item as Listing).id)}
                    onClick={() => { const l = item as Listing; select({ kind: "listing", data: l }); setFly({ lat: l.lat, lng: l.lng }); }}
                  />,
            )}
            {activeList.length === 0 && layer === "construction" && !live && (
              <p className="text-sm text-muted-foreground py-8 text-center animate-pulse">
                Connecting to live city permit records…
              </p>
            )}
            {activeList.length === 0 && layer === "construction" && live && (
              <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Every pin on Pencil is a real permit from public records.</p>
                <p className="mt-1.5 leading-relaxed">
                  No records match this view yet. Search a city — Pencil hunts its official
                  permit datasets on demand across the national open-data catalogs.
                </p>
              </div>
            )}
            {activeList.length === 0 && layer === "listings" && (
              <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Listings on Pencil are real MLS records only.</p>
                <p className="mt-1.5 leading-relaxed">
                  The licensed MLS feed (Bridge) isn’t connected yet — no fake inventory, ever.
                  Meanwhile the Construction layer is 100% live public records.
                </p>
              </div>
            )}
            {hasMore && (
              <Button variant="outline" className="w-full" onClick={() => setVisibleCount((c) => c + 20)}>
                <Plus className="h-4 w-4" /> Show 20 more ({activeList.length - visibleCount} left)
              </Button>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="order-1 lg:order-2 relative h-[52vh] lg:h-[calc(100vh-9rem)]">
          {basemap === "google" ? (
            <GoogleMapView
              apiKey={GOOGLE_MAPS_KEY}
              pins={pins}
              fly={fly}
              place={place}
              fitPoints={activeList.map((p) => ({ lat: p.lat, lng: p.lng }))}
              onFailed={() => {
                setBasemap("streets");
                toast.error("Google view couldn't load (network block or key restriction) — switched to Map view. Tap Google to retry.");
              }}
            />
          ) : (
            <React.Suspense fallback={<div className="grid h-full w-full place-items-center text-sm text-muted-foreground animate-pulse">Loading map…</div>}>
              <LeafletMapView
                basemap={basemap === "satellite" ? "satellite" : "streets"}
                pins={pins}
                fly={fly}
                place={place}
                fitPoints={activeList.map((p) => ({ lat: p.lat, lng: p.lng }))}
              />
            </React.Suspense>
          )}
          {(live?.liveCityNames.length ?? 0) > 0 && (
            <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 shadow-card backdrop-blur">
              <PulsingDot /> LIVE · self-updating
            </div>
          )}
          {/* Basemap toggle — flip to real aerial imagery to verify any pin. */}
          <div className="absolute top-3 right-3 z-[1000] flex overflow-hidden rounded-md border border-border bg-card/95 shadow-card backdrop-blur text-[11px] font-medium">
            <button
              onClick={() => setBasemap("google")}
              className={`px-2.5 py-1.5 ${basemap === "google" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Google
            </button>
            <button
              onClick={() => setBasemap("streets")}
              className={`px-2.5 py-1.5 ${basemap === "streets" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Map
            </button>
            <button
              onClick={() => setBasemap("satellite")}
              className={`px-2.5 py-1.5 ${basemap === "satellite" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Satellite
            </button>
          </div>
          <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-card">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(layer === "construction" ? PRODUCT_TYPES : LISTING_KINDS).map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: layer === "construction" ? TYPE_COLOR[t as ProductType] : LISTING_COLOR[t as keyof typeof LISTING_COLOR] }} />
                  <span className="text-foreground/80">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected?.kind === "dev" && (
        <DevelopmentPanel
          dev={selected.data}
          watched={watched.has(selected.data.id)}
          onWatch={() => toggleWatch(selected.data.id)}
          onClose={() => select(null)}
        />
      )}
      {selected?.kind === "listing" && (
        <ListingPanel
          listing={selected.data}
          watched={watched.has(selected.data.id)}
          onWatch={() => toggleWatch(selected.data.id)}
          onClose={() => select(null)}
        />
      )}

    </div>
  );
}

function toggleSet<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) {
  setter((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
}

/** Slow-pulsing live indicator — backed by a real 5-minute refresh cycle. */
function PulsingDot({ tone = "bg-gold" }: { tone?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 [animation-duration:2.4s] ${tone}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${tone}`} />
    </span>
  );
}


/** Pure status light — details go to the developer console, not the UI. */
function LiveStatusChip({ live, lastUpdated }: { live: LivePermits | null; lastUpdated: number | null }) {
  const total = live?.items.length ?? 0;
  const cities = live?.liveCityNames ?? [];
  const label = !live
    ? "Connecting to city records…"
    : total > 0
      ? `Live · ${cities.length} ${cities.length === 1 ? "city" : "cities"} · ${total.toLocaleString("en-US")} real permits`
      : "Live feeds offline";
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground"
      title={lastUpdated ? `Refreshed ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · auto every 5 min` : undefined}
    >
      {total > 0 ? <PulsingDot /> : <span className={`h-2 w-2 rounded-full ${!live ? "bg-muted-foreground/50" : "bg-destructive/60"}`} />}
      {label}
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function FilterPill({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${active ? "border-foreground/20 bg-secondary text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: active ? color : "transparent", border: `1px solid ${color}` }} />}
      {children}
    </button>
  );
}

// ── Rail cards ──────────────────────────────────────────────────────────────
function WatchHeart({ watched, onWatch }: { watched: boolean; onWatch: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onWatch(); }}
      className={`grid h-6 w-6 flex-none place-items-center rounded-full transition-colors ${watched ? "text-gold" : "text-muted-foreground/50 hover:text-gold"}`}
      title={watched ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Heart className={`h-4 w-4 ${watched ? "fill-current" : ""}`} />
    </button>
  );
}

function DevCard({ d, selected, watched, onWatch, onClick }: { d: Development; selected: boolean; watched: boolean; onWatch: () => void; onClick: () => void }) {
  const isLive = d.id.startsWith("live-");
  return (
    <div onClick={onClick} className={`w-full cursor-pointer text-left rounded-md border bg-card overflow-hidden transition-colors hover:bg-secondary/40 ${selected ? "border-gold ring-1 ring-gold/40" : "border-border"}`}>
      <div className="flex gap-3 p-2.5">
        <img src={streetViewImg(d.lat, d.lng, 200, 160)} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} alt="" className="h-16 w-20 rounded object-cover flex-none bg-secondary" loading="lazy" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="font-medium truncate text-sm">{d.name}</span>
            <span className="flex items-center gap-1">
              {isLive && <span className="rounded-full bg-gold/15 px-1.5 text-[10px] font-medium text-gold">LIVE</span>}
              <WatchHeart watched={watched} onWatch={onWatch} />
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{d.city}, {d.state} · {d.units}u · {d.status}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {fmtNumber(d.buildingSqft)} sf building · {fmtNumber(d.landSqft)} sf lot
          </div>
        </div>
      </div>
    </div>
  );
}

/** Margin badge with built-in skepticism: implausibly high margins say "verify", not "deal". */
function MarginBadge({ margin, deal }: { margin: number; deal: boolean }) {
  if (margin > PLAUSIBLE_MARGIN_CAP) {
    return (
      <Badge variant="outline" title="Margin above the plausible range — the area $/sf assumption likely doesn't fit this parcel. Open it and edit the inputs.">
        Verify · {fmtPct(margin)}
      </Badge>
    );
  }
  return deal
    ? <Badge variant="gold">Deal · {fmtPct(margin)}</Badge>
    : <Badge variant="secondary">{fmtPct(margin)}</Badge>;
}

function ListingCard({ l, selected, watched, onWatch, onClick }: { l: Listing; selected: boolean; watched: boolean; onWatch: () => void; onClick: () => void }) {
  const opp = listingOpportunity(l);
  const deal = opp.atPrice?.isDeal;
  return (
    <div onClick={onClick} className={`w-full cursor-pointer text-left rounded-md border bg-card overflow-hidden transition-colors hover:bg-secondary/40 ${selected ? "border-gold ring-1 ring-gold/40" : "border-border"}`}>
      <div className="flex gap-3 p-2.5">
        {l.photo && <img src={l.photo} alt="" className="h-16 w-20 rounded object-cover flex-none bg-secondary" loading="lazy" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-lg">{fmtMoney(l.listPrice)}</span>
            <span className="flex items-center gap-1">
              {l.id.startsWith("mls-") && <span className="rounded-full bg-gold/15 px-1.5 text-[10px] font-medium text-gold">LIVE</span>}
              <MarginBadge margin={opp.atPrice?.margin ?? 0} deal={!!deal} />
              <WatchHeart watched={watched} onWatch={onWatch} />
            </span>
          </div>
          <div className="text-sm truncate">{l.address}</div>
          <div className="text-xs text-muted-foreground">
            {l.city}, {l.state} · {l.kind}{l.beds != null ? ` · ${l.beds}bd/${l.baths}ba` : ""} · {fmtNumber(l.lotSqft)} sf lot
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared panel bits ───────────────────────────────────────────────────────
function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div className="relative h-full w-full sm:w-[460px] bg-card border-l border-border shadow-elevated overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Section({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="stat-label">{title}</div>
        {tag && <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 stat-label"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`font-display text-lg mt-1 ${accent ? "text-gold" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function StreetWalk({ lat, lng }: { lat: number; lng: number }) {
  // Official Google Maps URL API — reliably opens the Street View panorama.
  const panoUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="stat-label">Street view</div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">walk the block</span>
      </div>
      {GOOGLE_MAPS_KEY ? (
        <>
          <iframe title="Street View" className="w-full h-56 rounded-md border border-border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen
            src={`https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&location=${lat},${lng}&heading=210&pitch=10&fov=80`} />
          <a href={panoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline">Open full Street View <ExternalLink className="h-3 w-3" /></a>
        </>
      ) : (
        <a href={panoUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
          Walk this street in Google Maps <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

/** Editable inline underwrite — the user supplies the numbers; no presets. */
function InlineUnderwrite({
  city, type, buildableSqft, initialLand, address,
}: { city: string; type: ProductType; buildableSqft: number; initialLand?: number; address: string }) {
  const [land, setLand] = React.useState(initialLand ?? 0);
  const [bppsf, setBppsf] = React.useState(buildPpsf(city, type));
  const [sale, setSale] = React.useState(0);
  // Blank (0) = use the modeled costs; any entry replaces the model.
  const [finCost, setFinCost] = React.useState(0);
  const [closingCost, setClosingCost] = React.useState(0);
  const opp = scoreOpportunity({
    city, type, buildableSqft, areaPpsf: sale, landPrice: land, buildPpsfOverride: bppsf,
    finCostOverride: finCost > 0 ? finCost : undefined,
    closingCostOverride: closingCost > 0 ? closingCost : undefined,
  });
  const ready = land > 0 && sale > 0;
  const href = `/deal-analyzer?arv=${opp.arv}&costPerSqft=${bppsf}&totalSqft=${buildableSqft}&landCost=${land}&productType=${encodeURIComponent(type)}&address=${encodeURIComponent(address)}`;

  return (
    <div className="mt-6 rounded-md border border-gold/40 bg-gold-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="stat-label flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-gold" /> Underwrite it</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumericField label="Land" value={land} onChange={setLand} prefix="$" />
        <NumericField label="Build $/sf" value={bppsf} onChange={setBppsf} prefix="$" />
        <NumericField label="Sell $/sf" value={sale} onChange={setSale} prefix="$" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <NumericField label="Construction financing" value={finCost} onChange={setFinCost} prefix="$" />
        <NumericField label="Closing costs" value={closingCost} onChange={setClosingCost} prefix="$" />
      </div>
      {!ready && (
        <p className="mt-3 text-xs text-muted-foreground">Enter your land price and sell $/sf to underwrite this deal.</p>
      )}
      {ready && (
      <div className="mt-3 space-y-1">
        <Row label="Sells for (ARV)" value={fmtMoney(opp.arv)} />
        <Row label={`Selling costs (${(opp.sellingPct * 100).toFixed(1)}% realtor + closing)`} value={fmtMoney(opp.sellingCosts)} />
        <Row
          label={finCost > 0
            ? "Construction financing (your quote)"
            : `Construction financing (85% LTC @ ${(HARD_MONEY_RATE * 100).toFixed(1)}% · ${opp.finMonths} mo + 2 pts)`}
          value={fmtMoney(opp.financing)}
        />
        <Row label="All-in cost" value={fmtMoney(opp.atPrice?.allIn ?? 0)} />
        <div className="flex items-center justify-between text-sm py-1">
          <span className="text-muted-foreground">Profit</span>
          <span className={`font-semibold tabular-nums ${(opp.atPrice?.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmtMoney(opp.atPrice?.profit ?? 0)}
          </span>
        </div>
      </div>
      )}
      <Button variant="gold" className="w-full mt-3" asChild>
        <Link to={href}>Open full underwriting <ArrowRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  );
}

/** Funding the deal — hard-money lenders that actually cover this state. */
function FundingSection({ city, state }: { city: string; state: string }) {
  const lenders = lendersFor(state).slice(0, 6);

  return (
    <Section title="Fund it" tag={`hard money · ${state}`}>
      <div className="space-y-1.5">
        {lenders.map((ln) => (
          <a
            key={ln.name}
            href={ln.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Landmark className="h-3.5 w-3.5 text-gold flex-none" /> {ln.name}
                <ExternalLink className="h-3 w-3 text-muted-foreground flex-none" />
              </span>
              <span className="block truncate text-xs text-muted-foreground">{ln.focus} · {ln.loans}</span>
            </span>
            <Badge variant={ln.states === "nationwide" ? "secondary" : "gold"}>
              {ln.states === "nationwide" ? "Nationwide" : `Lends in ${state}`}
            </Badge>
          </a>
        ))}
      </div>
      <a href={lenderSearchUrl(city, state)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-gold hover:underline">
        Find local lenders in {city} <ExternalLink className="h-3 w-3" />
      </a>
      <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
        Typical published hard-money ranges (2026): 9–15% interest-only with ground-up at the
        higher end, 1–4 points, 12–18-month terms, draws against the build. Not offers — verify
        current coverage and terms with each lender. Pencil isn’t a broker.
      </p>
    </Section>
  );
}


// ── Construction panel ──────────────────────────────────────────────────────
/** One-click city/county resources: permit portal, zoning code, parcel GIS. */
function CityResources({ city, state }: { city: string; state: string }) {
  const g = govLinksFor(city, state);
  const Btn = ({ href, icon: Icon, children }: { href: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
    >
      <Icon className="h-3.5 w-3.5 text-gold" /> {children}
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </a>
  );
  return (
    <Section title={`${city} resources`} tag={g.official ? "official portals" : "web search"}>
      <div className="flex flex-wrap gap-1.5">
        <Btn href={g.permits} icon={Landmark}>Apply for permits</Btn>
        <Btn href={g.zoning} icon={ScrollText}>Zoning code</Btn>
        {g.gis && <Btn href={g.gis} icon={Globe}>Parcel / GIS map</Btn>}
      </div>
    </Section>
  );
}

/** Second-source accuracy: Google's geocoder locates the permit's address
 * independently; we report how far it lands from the city's own pin. */
function GeocoderCheck({ dev }: { dev: Development }) {
  const [dist, setDist] = React.useState<number | null>(null);
  React.useEffect(() => {
    // Only cross-check real street addresses (must contain a street number) —
    // generic names like "SFH — Miami" geocode to the city center and mislead.
    if (!GOOGLE_MAPS_KEY || !dev.id.startsWith("live-") || !dev.name || dev.name.length < 8 || !/\d/.test(dev.name)) return;
    let cancelled = false;
    geocodeVerify(GOOGLE_MAPS_KEY, `${dev.name}, ${dev.city}, ${dev.state}`, dev.lat, dev.lng)
      .then((r) => { if (!cancelled && r) setDist(r.distanceM); });
    return () => { cancelled = true; };
  }, [dev]);
  if (dist === null) return null;
  return dist <= 150 ? (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-gold">
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      Cross-checked: Google’s geocoder agrees (±{dist} m)
    </p>
  ) : (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-destructive/60" />
      Google’s geocoder places this address ~{dist.toLocaleString("en-US")} m away — verify on Satellite
    </p>
  );
}

function ShareWatchRow({ id, watched, onWatch }: { id: string; watched: boolean; onWatch: () => void }) {
  return (
    <div className="mt-4 flex gap-2">
      <Button variant={watched ? "gold" : "outline"} size="sm" className="flex-1" onClick={onWatch}>
        <Heart className={`h-4 w-4 ${watched ? "fill-current" : ""}`} /> {watched ? "Watching" : "Watch"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={() => {
          navigator.clipboard.writeText(`${window.location.origin}/?pin=${encodeURIComponent(id)}`);
          toast.success("Link copied — opens this exact property.");
        }}
      >
        <Link2 className="h-4 w-4" /> Share
      </Button>
    </div>
  );
}

function DevelopmentPanel({ dev, watched, onWatch, onClose }: { dev: Development; watched: boolean; onWatch: () => void; onClose: () => void }) {
  const ppsf = ppsfSummary(dev.city);
  const hasContractor = dev.developer && dev.developer !== "Permit holder on file";
  const builderHref = hasContractor
    ? `https://www.google.com/search?q=${encodeURIComponent(`${dev.developer} ${dev.city} ${dev.state} home builder`)}`
    : govLinksFor(dev.city, dev.state).permits;

  return (
    <Drawer onClose={onClose}>
      <div className="relative h-48 w-full bg-secondary">
        <img src={streetViewImg(dev.lat, dev.lng, 1200, 480)} alt="" className="h-full w-full object-cover" loading="lazy"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        <span className="absolute bottom-2 right-3 text-[10px] text-white/85 drop-shadow">street-level photo of the permitted address · Google</span>
        <button onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-foreground shadow-card hover:bg-card"><X className="h-4 w-4" /></button>
        <span className="absolute left-3 top-3"><Badge variant="gold">{dev.status}</Badge></span>
      </div>
      <div className="p-6">
        <h2 className="font-display text-2xl">{dev.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{dev.city}, {dev.state}</p>
        {dev.id.startsWith("live-") && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Verified public record — address &amp; pin from the city’s own GIS
          </p>
        )}
        <GeocoderCheck dev={dev} />
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white" style={{ background: TYPE_COLOR[dev.productType] }}>{dev.productType}</span>
        <p className="mt-4 text-sm text-foreground/90 leading-relaxed">{dev.description}</p>

        <ShareWatchRow id={dev.id} watched={watched} onWatch={onWatch} />

        <StreetWalk lat={dev.lat} lng={dev.lng} />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Metric icon={Building2} label="Units" value={fmtNumber(dev.units)} />
          <Metric icon={Layers3} label="Stories" value={fmtNumber(dev.stories)} />
          <Metric icon={Ruler} label="Land" value={`${fmtNumber(dev.landSqft)} sf`} />
          <Metric icon={Ruler} label="Building" value={`${fmtNumber(dev.buildingSqft)} sf`} />
        </div>

        <InlineUnderwrite city={dev.city} type={dev.productType} buildableSqft={dev.buildingSqft} address={`${dev.name}, ${dev.city}, ${dev.state}`} />

        <FundingSection city={dev.city} state={dev.state} />

        <Section title="Area $/sqft trend" tag={
          ppsf.source === "recorded" ? `median of ${(ppsf.liveSamples ?? 0).toLocaleString("en-US")} recorded sales`
          : ppsf.source === "calibrated" ? "Redfin-anchored · May 2026"
          : "modeled — verify with comps"
        }>
          <div className="font-display text-2xl text-gold">${ppsf.current}/sf</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><TrendingUp className="h-3 w-3" /> ${ppsf.low}–${ppsf.high} range since {ppsf.since}</div>
          <React.Suspense fallback={<div className="h-[150px]" />}>
            <PpsfChart city={dev.city} />
          </React.Suspense>
        </Section>

        <Section title="Project team" tag="permit record">
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-muted-foreground inline-flex items-center gap-1.5"><HardHat className="h-3.5 w-3.5" /> Developer / GC</span>
            <a href={builderHref} target="_blank" rel="noreferrer" className="font-medium text-gold hover:underline inline-flex items-center gap-1">
              {hasContractor ? dev.developer : "Look up on the city permit portal"} <Globe className="h-3 w-3" />
            </a>
          </div>
        </Section>

        <Section title="Permit record" tag="public record">
          <Row label="Status" value={dev.status} />
          <Row label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Issued</span>} value={dev.approvedDate} />
        </Section>

        <CityResources city={dev.city} state={dev.state} />
      </div>
    </Drawer>
  );
}

// ── Listing panel ───────────────────────────────────────────────────────────
function ListingPanel({ listing: l, watched, onWatch, onClose }: { listing: Listing; watched: boolean; onWatch: () => void; onClose: () => void }) {
  const opp = listingOpportunity(l);
  const deal = opp.atPrice?.isDeal;
  const priceData = l.priceHistory.map((p) => ({ label: p.date.slice(0, 7), price: p.price, event: p.event }));

  return (
    <Drawer onClose={onClose}>
      {l.photo && (
        <div className="relative h-48 w-full bg-secondary">
          <img src={l.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute bottom-2 right-3 text-[10px] text-white/85">real listing photo · MLS</span>
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white" style={{ background: LISTING_COLOR[l.kind] }}>{l.kind}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <h2 className="font-display text-3xl">{fmtMoney(l.listPrice)}</h2>
          <MarginBadge margin={opp.atPrice?.margin ?? 0} deal={!!deal} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{l.address} · {l.city}, {l.state}</p>

        <ShareWatchRow id={l.id} watched={watched} onWatch={onWatch} />

        <StreetWalk lat={l.lat} lng={l.lng} />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Metric icon={Ruler} label="Lot size" value={`${fmtNumber(l.lotSqft)} sf`} />
          <Metric icon={CalendarDays} label="Days on market" value={`${l.daysOnMarket}`} />
          {l.beds != null && <Metric icon={Home} label="Beds / baths" value={`${l.beds} / ${l.baths}`} />}
          {l.yearBuilt != null && <Metric icon={Building2} label="Year built" value={`${l.yearBuilt}`} />}
        </div>

        <Section title="Price history" tag="public record">
          <React.Suspense fallback={<div className="h-[130px]" />}>
            <PriceHistoryChart data={priceData} />
          </React.Suspense>
          <div className="space-y-1 mt-1">
            {l.priceHistory.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.event} · {p.date}</span>
                <span className="tabular-nums">{fmtMoney(p.price)}</span>
              </div>
            ))}
          </div>
        </Section>

        <CityResources city={l.city} state={l.state} />

        <InlineUnderwrite city={l.city} type={l.productTypeIfBuilt} buildableSqft={l.buildableSqft} initialLand={l.listPrice} address={`${l.address}, ${l.city}, ${l.state}`} />

        <FundingSection city={l.city} state={l.state} />

        <p className="mt-4 text-[11px] text-muted-foreground/80">
          Buildable ≈ {fmtNumber(l.buildableSqft)} sf {l.productTypeIfBuilt}. Demo listing — swaps for live MLS/ATTOM data.
        </p>
      </div>
    </Drawer>
  );
}

