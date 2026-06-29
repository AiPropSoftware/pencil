import * as React from "react";
import mapboxgl, { Map as MbxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, mapStyle } from "@/providers/maps/mapbox";
import { permitsProvider, type PermitRecord } from "@/providers/permits";
import { fmtMoney } from "@/lib/format";
import { MapPin, Layers, Pencil, Search } from "lucide-react";

interface Developer {
  id: string;
  name: string;
  activeProjects: number;
  productType: string;
  contactUrl: string;
  lat: number;
  lng: number;
}

export default function MapPage() {
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MbxMap | null>(null);
  const [permits, setPermits] = React.useState<PermitRecord[]>([]);
  const [selectedDeveloper, setSelectedDeveloper] = React.useState<Developer | null>(null);
  const [filter, setFilter] = React.useState({ sfh: true, duplex: true, fourplex: true, smallMulti: true });
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load permits on mount
  React.useEffect(() => {
    permitsProvider
      .search({ center: { lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] }, monthsBack: 12, newConstructionOnly: true })
      .then(setPermits);
  }, []);

  // Drop markers when permits load and map is ready
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || permits.length === 0) return;

    const markers: Marker[] = [];
    const onReady = () => {
      permits.forEach((p) => {
        const el = document.createElement("div");
        el.className = "permit-marker";
        el.style.cssText = `
          width: 12px; height: 12px; border-radius: 50%;
          background: hsl(38 48% 52%); border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer;
        `;
        el.title = `${p.contractor ?? "Permit"} · ${p.description}`;
        const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(map);
        markers.push(m);
      });
    };
    if (map.loaded()) onReady();
    else map.once("load", onReady);

    return () => markers.forEach((m) => m.remove());
  }, [permits]);

  // Derive a developer list by aggregating permits by contractor
  const developers = React.useMemo<Developer[]>(() => {
    const byName = new Map<string, Developer>();
    for (const p of permits) {
      if (!p.contractor) continue;
      const ex = byName.get(p.contractor);
      if (ex) {
        ex.activeProjects += 1;
      } else {
        byName.set(p.contractor, {
          id: p.contractor,
          name: p.contractor,
          activeProjects: 1,
          productType: p.description.includes("Fourplex") ? "Fourplex" : "SFH",
          contactUrl: "",
          lat: p.lat,
          lng: p.lng,
        });
      }
    }
    return Array.from(byName.values()).sort((a, b) => b.activeProjects - a.activeProjects);
  }, [permits]);

  const filtered = developers.filter(
    (d) =>
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase())) &&
      ((filter.sfh && d.productType === "SFH") || (filter.fourplex && d.productType === "Fourplex") || d.productType === "Other"),
  );

  return (
    <div className="container py-10">
      <div className="mb-6">
        <div className="gold-rule" />
        <h1 className="mt-3 font-display text-4xl">Geo Developer Map</h1>
        <p className="mt-1 text-muted-foreground max-w-xl">
          Drop a pin, draw a polygon, or search a metro. Pencil surfaces every
          active developer in that radius from the last 24 months of permits.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="overflow-hidden">
          <div className="relative h-[600px] w-full bg-secondary">
            {MAPBOX_TOKEN ? (
              <div ref={mapContainer} className="absolute inset-0" />
            ) : (
              <MapPlaceholder onSearch={(q) => toast.message(`Search: ${q}`)} />
            )}

            {/* Toolbar overlay */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Button size="sm" variant="default" className="shadow-elevated">
                <MapPin className="h-4 w-4" /> Drop pin
              </Button>
              <Button size="sm" variant="outline" className="shadow-elevated bg-card">
                <Pencil className="h-4 w-4" /> Polygon
              </Button>
              <Button size="sm" variant="outline" className="shadow-elevated bg-card">
                <Layers className="h-4 w-4" /> Layers
              </Button>
            </div>
          </div>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-search">Search developers</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dev-search"
                    className="pl-9"
                    placeholder="Lariat Homes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                {[
                  ["sfh", "SFH"],
                  ["duplex", "Duplex"],
                  ["fourplex", "Fourplex"],
                  ["smallMulti", "Small multi"],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-gold"
                      checked={filter[k as keyof typeof filter]}
                      onChange={(e) => setFilter((p) => ({ ...p, [k]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active developers</CardTitle>
              <CardDescription>{filtered.length} in view · last 12 months</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
              {filtered.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeveloper(d)}
                  className="w-full text-left rounded-md border border-border bg-card p-3 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{d.name}</span>
                    <Badge variant="gold">{d.activeProjects}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.productType} specialist</div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No developers match the current filters.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Profile drawer */}
      {selectedDeveloper && (
        <DeveloperDrawer developer={selectedDeveloper} permits={permits} onClose={() => setSelectedDeveloper(null)} />
      )}
    </div>
  );
}

function DeveloperDrawer({
  developer, permits, onClose,
}: { developer: Developer; permits: PermitRecord[]; onClose: () => void }) {
  const theirs = permits.filter((p) => p.contractor === developer.name);
  const totalValue = theirs.reduce((s, p) => s + (p.valuation ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div
        className="relative h-full w-full sm:w-[420px] bg-card border-l border-border shadow-elevated overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <Badge variant="gold">{developer.activeProjects} active projects</Badge>
          <h2 className="mt-3 font-display text-2xl">{developer.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{developer.productType} specialist · Austin metro</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="stat-label">Total valuation</div>
              <div className="font-display text-xl mt-1">{fmtMoney(totalValue)}</div>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-3">
              <div className="stat-label">Avg per permit</div>
              <div className="font-display text-xl mt-1">{fmtMoney(theirs.length ? totalValue / theirs.length : 0)}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="stat-label mb-3">Recent permits</div>
            <ul className="space-y-2">
              {theirs.map((p) => (
                <li key={p.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium">{p.address}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.description} · {p.issuedDate}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex gap-2">
            <Button variant="gold" className="flex-1">Send outreach email</Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MapPlaceholder({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary/60 to-card">
      <div className="text-center max-w-md px-6">
        <MapPin className="h-10 w-10 mx-auto text-gold" />
        <h3 className="mt-3 font-display text-2xl">Map preview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Set <code className="px-1.5 py-0.5 rounded bg-secondary">VITE_MAPBOX_TOKEN</code>{" "}
          to load the live Geo Developer Map. The developer list and filter sidebar
          work without it using the local demo permit set.
        </p>
        <div className="mt-5 flex gap-2">
          <Input placeholder="Search by city or address" className="bg-background" id="map-search"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch((e.target as HTMLInputElement).value);
            }}
          />
        </div>
      </div>
    </div>
  );
}
