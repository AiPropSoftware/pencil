import * as React from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fmtMoney, fmtNumber } from "@/lib/format";
import {
  developments, summarize, metroTrend, ppsfSummary, listingInfo, permitTimeline, architectFor,
  PRODUCT_TYPES, STATUSES, TYPE_COLOR,
  type Development, type ProductType, type DevStatus,
} from "@/data/developments";
import {
  Search, X, ArrowRight, Building2, CalendarDays, Ruler, Layers3,
  TrendingUp, ExternalLink, HardHat, PencilRuler, Plus,
} from "lucide-react";

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4.4;
const PAGE = 12; // initial pins; "Show 20 more" grows this

/** Fit the map to the searched area; fly to a single result. */
function FitOnPlace({ place, points }: { place: string; points: Development[] }) {
  const map = useMap();
  const ref = React.useRef(points);
  ref.current = points;
  React.useEffect(() => {
    const pts = ref.current;
    if (!place || pts.length === 0) {
      if (!place) map.flyTo(US_CENTER, US_ZOOM, { duration: 0.6 });
      return;
    }
    if (pts.length === 1) {
      map.flyTo([pts[0].lat, pts[0].lng], 12, { duration: 0.8 });
      return;
    }
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    for (const p of pts) {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    }
    map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [60, 60], maxZoom: 13, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);
  return null;
}

export default function MapPage() {
  const [types, setTypes] = React.useState<Set<ProductType>>(new Set(PRODUCT_TYPES));
  const [statuses, setStatuses] = React.useState<Set<DevStatus>>(new Set(STATUSES));
  const [place, setPlace] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(PAGE);
  const [selected, setSelected] = React.useState<Development | null>(null);

  // Reset pagination whenever the search/filters change.
  React.useEffect(() => { setVisibleCount(PAGE); }, [place, types, statuses]);

  const matches = React.useMemo(
    () =>
      developments.filter(
        (d) =>
          types.has(d.productType) &&
          statuses.has(d.status) &&
          (place.trim() === "" ||
            `${d.name} ${d.developer} ${d.city} ${d.state}`.toLowerCase().includes(place.trim().toLowerCase())),
      ),
    [types, statuses, place],
  );

  const visible = matches.slice(0, visibleCount);
  const stats = summarize(matches);
  const hasMore = visibleCount < matches.length;

  const toggleType = (t: ProductType) =>
    setTypes((p) => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const toggleStatus = (s: DevStatus) =>
    setStatuses((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="flex flex-col">
      <div className="container pt-8 pb-4">
        <div className="gold-rule" />
        <div className="mt-3 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Development Map</h1>
            <p className="mt-1 text-muted-foreground max-w-xl">
              A bird’s-eye and insider look at ground-up residential development
              across the US. Search a city or state to focus, then drill into any
              project for listing, sale, builder, and permit detail.
            </p>
          </div>
          <div className="flex gap-3">
            <StatChip label="Projects" value={fmtNumber(stats.count)} />
            <StatChip label="Units" value={fmtNumber(stats.totalUnits)} />
            <StatChip label="Pipeline value" value={fmtMoney(stats.totalValue)} accent />
          </div>
        </div>
      </div>

      <div className="container pb-10">
        <div className="grid lg:grid-cols-[1fr_390px] gap-4">
          <Card className="overflow-hidden p-0">
            <div className="relative h-[640px] w-full">
              <MapContainer center={US_CENTER} zoom={US_ZOOM} scrollWheelZoom className="h-full w-full" style={{ background: "#eae5db" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                <FitOnPlace place={place} points={matches} />
                {visible.map((d) => {
                  const isSel = selected?.id === d.id;
                  return (
                    <CircleMarker
                      key={d.id}
                      center={[d.lat, d.lng]}
                      radius={isSel ? 11 : 7}
                      pathOptions={{ color: "#fff", weight: 2, fillColor: TYPE_COLOR[d.productType], fillOpacity: isSel ? 1 : 0.85 }}
                      eventHandlers={{ click: () => setSelected(d) }}
                    >
                      <Tooltip direction="top" offset={[0, -6]}>
                        <span className="text-xs"><strong>{d.name}</strong> · {d.productType} · {d.units} {d.units === 1 ? "unit" : "units"}</span>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-card">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {PRODUCT_TYPES.map((t) => (
                    <div key={t} className="flex items-center gap-1.5 text-[11px]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                      <span className="text-foreground/80">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search a city or state (e.g. Miami, FL)"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                  />
                  {place && (
                    <button onClick={() => setPlace("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <div className="stat-label mb-2">Product type</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRODUCT_TYPES.map((t) => (
                      <FilterPill key={t} active={types.has(t)} onClick={() => toggleType(t)} color={TYPE_COLOR[t]}>{t}</FilterPill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-2">Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <FilterPill key={s} active={statuses.has(s)} onClick={() => toggleStatus(s)}>{s}</FilterPill>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Showing {visible.length} of {matches.length}{place ? ` in “${place}”` : " nationwide"}</span>
              {!place && <span className="text-gold">Search a city to focus</span>}
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {visible.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className={`w-full text-left rounded-md border bg-card p-3 transition-colors hover:bg-secondary/60 ${
                    selected?.id === d.id ? "border-gold ring-1 ring-gold/40" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{d.name}</span>
                    <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ background: TYPE_COLOR[d.productType] }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.city}, {d.state} · {d.units} {d.units === 1 ? "unit" : "units"} · {fmtMoney(d.estValue)}
                  </div>
                </button>
              ))}
              {matches.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">No developments match. Try a different city or widen the filters.</p>
              )}
            </div>

            {hasMore && (
              <Button variant="outline" className="w-full" onClick={() => setVisibleCount((c) => c + 20)}>
                <Plus className="h-4 w-4" /> Show 20 more ({matches.length - visibleCount} left)
              </Button>
            )}
          </div>
        </div>
      </div>

      {selected && <DevelopmentDrawer dev={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-2 shadow-card">
      <div className="stat-label">{label}</div>
      <div className={`font-display text-xl ${accent ? "text-gold" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function FilterPill({
  active, onClick, children, color,
}: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active ? "border-foreground/20 bg-secondary text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: active ? color : "transparent", border: `1px solid ${color}` }} />}
      {children}
    </button>
  );
}

function DevelopmentDrawer({ dev, onClose }: { dev: Development; onClose: () => void }) {
  const listing = listingInfo(dev);
  const permits = permitTimeline(dev);
  const architect = architectFor(dev);
  const ppsf = ppsfSummary(dev.city);
  const trend = metroTrend(dev.city);
  const analyzerHref = `/deal-analyzer?arv=${dev.estValue}&costPerSqft=${dev.pricePerSqft}&address=${encodeURIComponent(
    `${dev.name}, ${dev.city}, ${dev.state}`,
  )}`;

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div className="relative h-full w-full sm:w-[460px] bg-card border-l border-border shadow-elevated overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <Badge variant="gold">{dev.status}</Badge>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          <h2 className="mt-3 font-display text-2xl">{dev.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{dev.city}, {dev.state}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white" style={{ background: TYPE_COLOR[dev.productType] }}>{dev.productType}</span>
          <p className="mt-4 text-sm text-foreground/90 leading-relaxed">{dev.description}</p>

          {/* Key metrics */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric icon={Building2} label="Units" value={fmtNumber(dev.units)} />
            <Metric icon={Layers3} label="Stories" value={fmtNumber(dev.stories)} />
            <Metric icon={Ruler} label="Land" value={`${fmtNumber(dev.landSqft)} sf`} />
            <Metric icon={Ruler} label="Building" value={`${fmtNumber(dev.buildingSqft)} sf`} />
          </div>

          {/* Market $/sqft confidence */}
          <Section title="Area $/sqft trend" tag="modeled from sold comps">
            <div className="flex items-end justify-between mb-1">
              <div>
                <div className="font-display text-2xl text-gold">${ppsf.current}/sf</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> ${ppsf.low}–${ppsf.high} range since {ppsf.since}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={trend} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ppsf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(38 48% 52%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(38 48% 52%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 88%)" vertical={false} />
                <XAxis dataKey="quarter" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} width={46} tickFormatter={(v) => `$${v}`} />
                <RTooltip formatter={(v: number) => [`$${v}/sf`, ""]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(30 15% 86%)" }} />
                <Area type="monotone" dataKey="high" stroke="none" fill="url(#ppsf)" />
                <Line type="monotone" dataKey="high" stroke="hsl(25 10% 65%)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="low" stroke="hsl(25 10% 65%)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                <Line type="monotone" dataKey="ppsf" stroke="hsl(38 48% 42%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>

          {/* Listing & sale */}
          <Section title="Listing & sale" tag="MLS / public record">
            <Row label="Status" value={listing.status} />
            {listing.status === "Listed for sale" && (
              <>
                <Row label="List price" value={fmtMoney(listing.listPrice)} />
                <Row label="Days on market" value={`${listing.daysOnMarket} days`} />
                {listing.zillowUrl && (
                  <a href={listing.zillowUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-gold hover:underline">
                    View comparable listings <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            )}
            {listing.status === "Recently sold" && (
              <>
                <Row label="Sold price" value={fmtMoney(listing.soldPrice)} />
                <Row label="Sold date" value={listing.soldDate ?? "—"} />
              </>
            )}
            {(listing.status === "Under construction" || listing.status === "Pre-construction") && (
              <p className="text-xs text-muted-foreground">Not yet on market — projected value {fmtMoney(dev.estValue)}.</p>
            )}
          </Section>

          {/* Project team */}
          <Section title="Project team" tag="permit record">
            <Row label={<span className="inline-flex items-center gap-1.5"><HardHat className="h-3.5 w-3.5" /> Developer / GC</span>} value={dev.developer} />
            <Row label={<span className="inline-flex items-center gap-1.5"><PencilRuler className="h-3.5 w-3.5" /> Architect</span>} value={architect} />
          </Section>

          {/* Permit timeline */}
          <Section title="Permit timeline" tag="public record">
            <Timeline
              steps={[
                { label: "Filed", date: permits.filed, done: true },
                { label: "Approved", date: permits.approved, done: true },
                { label: "Permit issued", date: permits.issued, done: !!permits.issued },
                { label: "Target completion", date: permits.targetCompletion, done: dev.status === "Completed" },
              ]}
            />
          </Section>

          {/* Build cost + underwrite */}
          <div className="mt-6 rounded-md border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between">
              <div className="stat-label">Build cost assumption</div>
              <Badge variant="secondary">estimated</Badge>
            </div>
            <div className="font-display text-xl mt-1">{fmtMoney(dev.pricePerSqft)}/sf</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Regional $/sf estimate (permit declared valuation used where available). Pre-fills the Deal Analyzer.
            </p>
          </div>

          <div className="mt-4 flex gap-2 pb-2">
            <Button variant="gold" className="flex-1" asChild>
              <Link to={analyzerHref}>Underwrite this deal <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>

          <p className="text-[11px] text-muted-foreground/80">
            Demo data — modeled from realistic assumptions. Live ATTOM, Shovels, and MLS feeds replace these values without changing this view.
          </p>
        </div>
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

function Metric({
  icon: Icon, label, value, accent,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 stat-label"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`font-display text-lg mt-1 ${accent ? "text-gold" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Timeline({ steps }: { steps: { label: string; date: string | null; done: boolean }[] }) {
  return (
    <ol className="relative ml-1.5 border-l border-border">
      {steps.map((s) => (
        <li key={s.label} className="mb-3 ml-4 last:mb-0">
          <span className={`absolute -left-[5px] h-2.5 w-2.5 rounded-full ${s.done ? "bg-gold" : "bg-border"}`} />
          <div className="flex items-center justify-between">
            <span className={`text-sm ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{s.date ?? "pending"}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
