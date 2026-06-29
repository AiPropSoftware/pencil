import * as React from "react";
import mapboxgl, { Map as MbxMap, Marker } from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MAPBOX_TOKEN, DEFAULT_CENTER, DEFAULT_ZOOM, mapStyle } from "@/providers/maps/mapbox";
import { permitsProvider, type PermitRecord } from "@/providers/permits";
import { getSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney } from "@/lib/format";
import { MapPin, Layers, Pencil as PencilIcon, Search, Trash2, Save, Eye } from "lucide-react";

interface Developer {
  id: string;
  name: string;
  activeProjects: number;
  productType: string;
  contactUrl: string;
  lat: number;
  lng: number;
}

interface SavedPolygon {
  id: string;
  name: string;
  geojson: GeoJSON.Polygon;
  created_at: string;
}

export default function MapPage() {
  const { user } = useAuth();
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MbxMap | null>(null);
  const drawRef = React.useRef<MapboxDraw | null>(null);

  const [permits, setPermits] = React.useState<PermitRecord[]>([]);
  const [selectedDeveloper, setSelectedDeveloper] = React.useState<Developer | null>(null);
  const [filter, setFilter] = React.useState({ sfh: true, duplex: true, fourplex: true, smallMulti: true });
  const [search, setSearch] = React.useState("");

  const [savedPolygons, setSavedPolygons] = React.useState<SavedPolygon[]>([]);
  const [pendingPolygon, setPendingPolygon] = React.useState<GeoJSON.Polygon | null>(null);
  const [pendingName, setPendingName] = React.useState("");

  // Initialize the map + draw once.
  React.useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      styles: drawStyles,
    });
    map.addControl(draw, "top-left");

    // When a polygon is finished, capture and prompt for a name.
    const onCreate = (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0];
      if (feature?.geometry?.type === "Polygon") {
        setPendingPolygon(feature.geometry as GeoJSON.Polygon);
        setPendingName("");
      }
    };
    map.on("draw.create" as never, onCreate);

    mapRef.current = map;
    drawRef.current = draw;

    return () => {
      map.off("draw.create" as never, onCreate);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  // Load permits
  React.useEffect(() => {
    permitsProvider
      .search({ center: { lat: DEFAULT_CENTER[1], lng: DEFAULT_CENTER[0] }, monthsBack: 12, newConstructionOnly: true })
      .then(setPermits);
  }, []);

  // Load saved polygons for the signed-in user
  React.useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    sb.from("saved_polygons")
      .select("id,name,geojson,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.warn(error);
        else setSavedPolygons((data ?? []) as unknown as SavedPolygon[]);
      });
  }, [user]);

  // Drop permit markers
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || permits.length === 0) return;

    const markers: Marker[] = [];
    const drop = () => {
      permits.forEach((p) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width:12px;height:12px;border-radius:50%;
          background:hsl(38 48% 52%);border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer;
        `;
        el.title = `${p.contractor ?? "Permit"} · ${p.description}`;
        const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(map);
        markers.push(m);
      });
    };
    if (map.loaded()) drop();
    else map.once("load", drop);
    return () => markers.forEach((m) => m.remove());
  }, [permits]);

  const developers = React.useMemo<Developer[]>(() => {
    const byName = new Map<string, Developer>();
    for (const p of permits) {
      if (!p.contractor) continue;
      const ex = byName.get(p.contractor);
      if (ex) ex.activeProjects += 1;
      else byName.set(p.contractor, {
        id: p.contractor, name: p.contractor, activeProjects: 1,
        productType: p.description.includes("Fourplex") ? "Fourplex" : "SFH",
        contactUrl: "", lat: p.lat, lng: p.lng,
      });
    }
    return Array.from(byName.values()).sort((a, b) => b.activeProjects - a.activeProjects);
  }, [permits]);

  const filteredDevs = developers.filter(
    (d) =>
      (search === "" || d.name.toLowerCase().includes(search.toLowerCase())) &&
      ((filter.sfh && d.productType === "SFH") || (filter.fourplex && d.productType === "Fourplex") || d.productType === "Other"),
  );

  const savePolygon = async () => {
    if (!pendingPolygon) return;
    const sb = getSupabase();
    if (!sb || !user) {
      toast.error("Sign in to save areas.");
      return;
    }
    const name = pendingName.trim() || `Area ${new Date().toLocaleDateString()}`;
    const { data, error } = await sb
      .from("saved_polygons")
      .insert({ user_id: user.id, name, geojson: pendingPolygon as unknown as Record<string, unknown> })
      .select("id,name,geojson,created_at")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedPolygons((prev) => [data as unknown as SavedPolygon, ...prev]);
    setPendingPolygon(null);
    toast.success(`Saved "${name}".`);
  };

  const discardPolygon = () => {
    setPendingPolygon(null);
    drawRef.current?.deleteAll();
  };

  const loadPolygon = (p: SavedPolygon) => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;
    draw.deleteAll();
    draw.add({ type: "Feature", properties: { savedId: p.id }, geometry: p.geojson });
    const bbox = polygonBounds(p.geojson);
    if (bbox) map.fitBounds(bbox, { padding: 60, duration: 600 });
    toast.message(`Loaded "${p.name}".`);
  };

  const deletePolygon = async (p: SavedPolygon) => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.from("saved_polygons").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedPolygons((prev) => prev.filter((s) => s.id !== p.id));
    toast.success(`Deleted "${p.name}".`);
  };

  return (
    <div className="container py-10">
      <div className="mb-6">
        <div className="gold-rule" />
        <h1 className="mt-3 font-display text-4xl">Geo Developer Map</h1>
        <p className="mt-1 text-muted-foreground max-w-xl">
          Draw a polygon over a neighborhood. Pencil surfaces every active developer
          in that area from 12–24 months of permits, and remembers every area you save.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="overflow-hidden">
          <div className="relative h-[640px] w-full bg-secondary">
            {MAPBOX_TOKEN ? (
              <div ref={mapContainer} className="absolute inset-0" />
            ) : (
              <MapPlaceholder />
            )}
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              <Button size="sm" variant="outline" className="shadow-elevated bg-card">
                <Layers className="h-4 w-4" /> Layers
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-search">Search developers</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="dev-search" className="pl-9" placeholder="Lariat Homes…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      type="checkbox" className="accent-gold"
                      checked={filter[k as keyof typeof filter]}
                      onChange={(e) => setFilter((p) => ({ ...p, [k]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Saved areas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PencilIcon className="h-4 w-4 text-gold" /> Saved areas
              </CardTitle>
              <CardDescription>
                {savedPolygons.length === 0
                  ? "Draw a polygon on the map to save your first area."
                  : `${savedPolygons.length} saved`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[260px] overflow-y-auto">
              {savedPolygons.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2.5">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.created_at.slice(0, 10)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => loadPolygon(p)} title="Load on map">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deletePolygon(p)} title="Delete" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Developers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active developers</CardTitle>
              <CardDescription>{filteredDevs.length} in view · last 12 months</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
              {filteredDevs.map((d) => (
                <button
                  key={d.id} onClick={() => setSelectedDeveloper(d)}
                  className="w-full text-left rounded-md border border-border bg-card p-3 hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{d.name}</span>
                    <Badge variant="gold">{d.activeProjects}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.productType} specialist</div>
                </button>
              ))}
              {filteredDevs.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No developers match the current filters.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedDeveloper && (
        <DeveloperDrawer developer={selectedDeveloper} permits={permits} onClose={() => setSelectedDeveloper(null)} />
      )}

      <Dialog open={!!pendingPolygon} onOpenChange={(o) => { if (!o) discardPolygon(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save this area</DialogTitle>
            <DialogDescription>
              Saved areas appear in the sidebar and can be re-loaded onto the map anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="area-name">Name</Label>
            <Input
              id="area-name" autoFocus placeholder="South Lamar infill, East Austin lots…"
              value={pendingName} onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") savePolygon(); }}
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={discardPolygon}>Discard</Button>
            <Button variant="gold" onClick={savePolygon}>
              <Save className="h-4 w-4" /> Save area
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
      <div className="relative h-full w-full sm:w-[420px] bg-card border-l border-border shadow-elevated overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
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
                  <div className="text-xs text-muted-foreground mt-0.5">{p.description} · {p.issuedDate}</div>
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

function MapPlaceholder() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary/60 to-card">
      <div className="text-center max-w-md px-6">
        <MapPin className="h-10 w-10 mx-auto text-gold" />
        <h3 className="mt-3 font-display text-2xl">Map preview</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Set <code className="px-1.5 py-0.5 rounded bg-secondary">VITE_MAPBOX_TOKEN</code>{" "}
          to load the live Geo Developer Map with polygon drawing. The developer list
          still works without it using the local demo permit set.
        </p>
      </div>
    </div>
  );
}

function polygonBounds(poly: GeoJSON.Polygon): [[number, number], [number, number]] | null {
  const coords = poly.coordinates?.[0];
  if (!coords || coords.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}

/** Gold-tinted draw styles so the polygon matches the design system. */
const drawStyles: object[] = [
  // Polygon fill
  {
    id: "gl-draw-polygon-fill",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: { "fill-color": "hsl(38, 48%, 52%)", "fill-outline-color": "hsl(38, 48%, 42%)", "fill-opacity": 0.18 },
  },
  // Polygon outline (active + inactive)
  {
    id: "gl-draw-polygon-stroke",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "hsl(38, 48%, 42%)", "line-width": 2 },
  },
  // Vertices
  {
    id: "gl-draw-polygon-and-line-vertex-stroke-inactive",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "hsl(38, 48%, 42%)", "circle-stroke-width": 2 },
  },
  // Midpoints
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: { "circle-radius": 3, "circle-color": "hsl(38, 48%, 52%)" },
  },
];
