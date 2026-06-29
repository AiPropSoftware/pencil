import * as React from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fmtMoney, fmtNumber } from "@/lib/format";
import {
  developments, summarize, PRODUCT_TYPES, STATUSES, TYPE_COLOR,
  type Development, type ProductType, type DevStatus,
} from "@/data/developments";
import { Search, X, ArrowRight, Building2, CalendarDays, Ruler, Layers3 } from "lucide-react";

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4.4;

/** Imperatively fly the map to a development when selected from the list. */
function FlyTo({ target }: { target: Development | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 12, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function MapPage() {
  const [types, setTypes] = React.useState<Set<ProductType>>(new Set(PRODUCT_TYPES));
  const [statuses, setStatuses] = React.useState<Set<DevStatus>>(new Set(STATUSES));
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Development | null>(null);
  const [flyTarget, setFlyTarget] = React.useState<Development | null>(null);

  const filtered = React.useMemo(
    () =>
      developments.filter(
        (d) =>
          types.has(d.productType) &&
          statuses.has(d.status) &&
          (search === "" ||
            `${d.name} ${d.developer} ${d.city} ${d.state}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [types, statuses, search],
  );

  const stats = summarize(filtered);

  const toggleType = (t: ProductType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const toggleStatus = (s: DevStatus) =>
    setStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const pick = (d: Development) => {
    setSelected(d);
    setFlyTarget(d);
  };

  return (
    <div className="flex flex-col">
      {/* Title + live stat strip */}
      <div className="container pt-8 pb-4">
        <div className="gold-rule" />
        <div className="mt-3 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Development Map</h1>
            <p className="mt-1 text-muted-foreground max-w-xl">
              A bird’s-eye and insider look at ground-up residential development
              across the US — what’s being built, how big, and when it was approved.
            </p>
          </div>
          <div className="flex gap-3">
            <StatChip label="Projects" value={fmtNumber(stats.count)} />
            <StatChip label="Units" value={fmtNumber(stats.totalUnits)} />
            <StatChip label="Pipeline value" value={fmtMoney(stats.totalValue)} accent />
          </div>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="container pb-10">
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          <Card className="overflow-hidden p-0">
            <div className="relative h-[640px] w-full">
              <MapContainer
                center={US_CENTER}
                zoom={US_ZOOM}
                scrollWheelZoom
                className="h-full w-full"
                style={{ background: "#eae5db" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                <FlyTo target={flyTarget} />
                {filtered.map((d) => {
                  const isSel = selected?.id === d.id;
                  return (
                    <CircleMarker
                      key={d.id}
                      center={[d.lat, d.lng]}
                      radius={isSel ? 11 : 7}
                      pathOptions={{
                        color: "#ffffff",
                        weight: 2,
                        fillColor: TYPE_COLOR[d.productType],
                        fillOpacity: isSel ? 1 : 0.85,
                      }}
                      eventHandlers={{ click: () => setSelected(d) }}
                    >
                      <Tooltip direction="top" offset={[0, -6]}>
                        <span className="text-xs">
                          <strong>{d.name}</strong> · {d.productType} · {d.units} {d.units === 1 ? "unit" : "units"}
                        </span>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>

              {/* Legend */}
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

          {/* Side panel: filters + project list */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search city, developer, project…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div>
                  <div className="stat-label mb-2">Product type</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRODUCT_TYPES.map((t) => (
                      <FilterPill key={t} active={types.has(t)} onClick={() => toggleType(t)} color={TYPE_COLOR[t]}>
                        {t}
                      </FilterPill>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="stat-label mb-2">Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <FilterPill key={s} active={statuses.has(s)} onClick={() => toggleStatus(s)}>
                        {s}
                      </FilterPill>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filtered.map((d) => (
                <button
                  key={d.id}
                  onClick={() => pick(d)}
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
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No developments match these filters.
                </p>
              )}
            </div>
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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-foreground/20 bg-secondary text-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: active ? color : "transparent", border: `1px solid ${color}` }} />}
      {children}
    </button>
  );
}

function DevelopmentDrawer({ dev, onClose }: { dev: Development; onClose: () => void }) {
  const analyzerHref = `/deal-analyzer?arv=${dev.estValue}&costPerSqft=${dev.pricePerSqft}&address=${encodeURIComponent(
    `${dev.name}, ${dev.city}, ${dev.state}`,
  )}`;

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div
        className="relative h-full w-full sm:w-[440px] bg-card border-l border-border shadow-elevated overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <Badge variant="gold" className="capitalize">{dev.status}</Badge>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="mt-3 font-display text-2xl">{dev.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dev.city}, {dev.state} · by {dev.developer}
          </p>

          <span
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white"
            style={{ background: TYPE_COLOR[dev.productType] }}
          >
            {dev.productType}
          </span>

          <p className="mt-4 text-sm text-foreground/90 leading-relaxed">{dev.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric icon={Building2} label="Units" value={fmtNumber(dev.units)} />
            <Metric icon={Layers3} label="Stories" value={fmtNumber(dev.stories)} />
            <Metric icon={Ruler} label="Land" value={`${fmtNumber(dev.landSqft)} sf`} />
            <Metric icon={Ruler} label="Building" value={`${fmtNumber(dev.buildingSqft)} sf`} />
            <Metric icon={CalendarDays} label="Approved" value={dev.approvedDate} />
            <Metric icon={Building2} label="Est. value" value={fmtMoney(dev.estValue)} accent />
          </div>

          <div className="mt-6 rounded-md border border-border bg-secondary/40 p-4">
            <div className="stat-label">Build cost assumption</div>
            <div className="font-display text-xl mt-1">{fmtMoney(dev.pricePerSqft)}/sf</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used to pre-fill the Deal Analyzer for this project.
            </p>
          </div>

          <div className="mt-6 flex gap-2">
            <Button variant="gold" className="flex-1" asChild>
              <Link to={analyzerHref}>
                Underwrite this deal <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 stat-label">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`font-display text-lg mt-1 ${accent ? "text-gold" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
