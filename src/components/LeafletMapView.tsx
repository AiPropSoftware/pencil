/**
 * Leaflet-engine basemaps (CARTO streets + Esri satellite) — split out of the
 * main bundle so first paint doesn't pay for Leaflet: the default view is the
 * Google engine, and this chunk lazy-loads only when the user switches.
 */
import * as React from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import Supercluster from "supercluster";
import "leaflet/dist/leaflet.css";

export interface LPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  deal: boolean;
  selected: boolean;
  label: string;
  onClick: () => void;
}

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4.4;

function FitOnPlace({ place, points }: { place: string; points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const ref = React.useRef(points);
  ref.current = points;
  React.useEffect(() => {
    const pts = ref.current;
    if (!place) { map.flyTo(US_CENTER, US_ZOOM, { duration: 0.6 }); return; }
    if (pts.length === 0) return;
    if (pts.length === 1) { map.flyTo([pts[0].lat, pts[0].lng], 12, { duration: 0.8 }); return; }
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

function FlyToTarget({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 14, { duration: 0.8 });
  }, [target, map]);
  return null;
}

function Clusters({ pins }: { pins: LPin[] }) {
  const [view, setView] = React.useState<{ bbox: [number, number, number, number]; zoom: number } | null>(null);
  const map = useMapEvents({ moveend: () => sync(), zoomend: () => sync() });
  function sync() {
    const b = map.getBounds();
    setView({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() });
  }
  React.useEffect(() => { sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = React.useMemo(() => {
    const m = new Map<string, LPin>();
    pins.forEach((p) => m.set(p.id, p));
    return m;
  }, [pins]);

  const index = React.useMemo(() => {
    const sc = new Supercluster<{ pid: string }>({ radius: 58, maxZoom: 15 });
    sc.load(pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({
      type: "Feature" as const,
      properties: { pid: p.id },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })));
    return sc;
  }, [pins]);

  const clusters = React.useMemo(() => {
    if (!view) return [];
    try { return index.getClusters(view.bbox, Math.floor(view.zoom)); } catch { return []; }
  }, [index, view]);

  return (
    <>
      {clusters.map((c) => {
        const [lng, lat] = c.geometry.coordinates;
        const props = c.properties as { cluster?: boolean; point_count?: number; pid?: string };
        if (props.cluster) {
          const count = props.point_count ?? 0;
          const size = Math.round(32 + Math.min(30, Math.log2(count + 1) * 8));
          const icon = L.divIcon({
            className: "",
            iconSize: [size, size],
            html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:rgba(200,165,92,0.92);color:#1a1612;font-weight:600;font-size:12px;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.25)">${count}</div>`,
          });
          return (
            <Marker key={`c-${c.id}`} position={[lat, lng]} icon={icon} eventHandlers={{
              click: () => map.flyTo([lat, lng], Math.min(index.getClusterExpansionZoom(c.id as number), 16), { duration: 0.6 }),
            }} />
          );
        }
        const pin = byId.get(props.pid as string);
        if (!pin) return null;
        return (
          <CircleMarker
            key={pin.id}
            center={[lat, lng]}
            radius={pin.selected ? 11 : 7}
            pathOptions={{
              color: pin.deal ? "#c8a55c" : "#fff",
              weight: pin.deal ? 3 : 2,
              fillColor: pin.color,
              fillOpacity: pin.selected ? 1 : 0.85,
            }}
            eventHandlers={{ click: pin.onClick }}
          >
            <Tooltip direction="top" offset={[0, -6]}><span className="text-xs">{pin.label}</span></Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export default function LeafletMapView({
  basemap, pins, fly, place, fitPoints,
}: {
  basemap: "streets" | "satellite";
  pins: LPin[];
  fly: { lat: number; lng: number } | null;
  place: string;
  fitPoints: { lat: number; lng: number }[];
}) {
  return (
    <MapContainer center={US_CENTER} zoom={US_ZOOM} scrollWheelZoom className="h-full w-full" style={{ background: "#eae5db" }}>
      {basemap === "streets" ? (
        <TileLayer
          key="streets"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
      ) : (
        <TileLayer
          key="satellite"
          attribution="Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      )}
      <FitOnPlace place={place} points={fitPoints} />
      <FlyToTarget target={fly} />
      <Clusters pins={pins} />
    </MapContainer>
  );
}
