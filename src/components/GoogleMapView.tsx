/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google-basemap renderer — the true Google Maps look, rendered with Google's
 * own engine (their license requires their renderer; tiles can't be used in
 * Leaflet). Reuses the exact same pin set as the Leaflet view: colors,
 * deal rings, selection, click-through to the property panels, clustering
 * (via @googlemaps/markerclusterer), place fitting and fly-to.
 */
import * as React from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { loadGoogleMaps, onGoogleAuthFailure } from "@/lib/googleMaps";

export interface GPin {
  id: string;
  lat: number;
  lng: number;
  color: string;
  deal: boolean;
  selected: boolean;
  label: string;
  onClick: () => void;
}

const US_CENTER = { lat: 39.5, lng: -98.35 };

const clusterRenderer = {
  render: ({ count, position }: { count: number; position: any }) =>
    new (window as any).google.maps.Marker({
      position,
      icon: {
        path: (window as any).google.maps.SymbolPath.CIRCLE,
        fillColor: "#c8a55c",
        fillOpacity: 0.92,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 14 + Math.min(10, Math.log2(count + 1) * 3),
      },
      label: { text: String(count), color: "#1a1612", fontSize: "12px", fontWeight: "600" },
      zIndex: 1000 + count,
    }),
};

export function GoogleMapView({
  apiKey, pins, fly, place, fitPoints, onFailed,
}: {
  apiKey: string;
  pins: GPin[];
  fly: { lat: number; lng: number } | null;
  place: string;
  fitPoints: { lat: number; lng: number }[];
  /** Called once if Google's engine can't run (script blocked or key rejected). */
  onFailed?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const clusterRef = React.useRef<MarkerClusterer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const onFailedRef = React.useRef(onFailed);
  onFailedRef.current = onFailed;

  // Init once.
  React.useEffect(() => {
    let cancelled = false;
    let reported = false;
    const fail = () => {
      if (cancelled || reported) return;
      reported = true;
      setFailed(true);
      onFailedRef.current?.();
    };
    const offAuth = onGoogleAuthFailure(fail);
    loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !ref.current || mapRef.current) return;
        mapRef.current = new g.maps.Map(ref.current, {
          center: US_CENTER,
          zoom: 4,
          mapTypeControl: true,
          mapTypeControlOptions: { position: g.maps.ControlPosition.LEFT_BOTTOM },
          streetViewControl: true,
          fullscreenControl: false,
          clickableIcons: false,
        });
        setReady(true);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[Pencil] Google view failed:", (e as Error)?.message ?? e);
        fail();
      });
    return () => { cancelled = true; offAuth(); };
  }, [apiKey]);

  // Rebuilding thousands of Marker objects on every interaction is what makes
  // the map feel slow — so the full set is built only when the pin DATA
  // changes (layer switch, filters, live refresh), keyed by a fingerprint.
  // Selection changes just restyle the two affected markers.
  const markersRef = React.useRef<Map<string, any>>(new Map());
  const pinByIdRef = React.useRef<Map<string, GPin>>(new Map());
  pinByIdRef.current = new Map(pins.map((p) => [p.id, p]));
  const geomKey = React.useMemo(() => pins.map((p) => p.id + (p.deal ? "!" : "")).join("|"), [pins]);
  const selectedId = React.useMemo(() => pins.find((p) => p.selected)?.id ?? null, [pins]);
  const prevSelectedRef = React.useRef<string | null>(null);

  const iconFor = (g: any, p: GPin, sel: boolean) => ({
    path: g.maps.SymbolPath.CIRCLE,
    fillColor: p.color,
    fillOpacity: sel ? 1 : 0.85,
    strokeColor: p.deal ? "#c8a55c" : "#ffffff",
    strokeWeight: p.deal ? 3 : 2,
    scale: sel ? 9 : 7,
  });

  React.useEffect(() => {
    const map = mapRef.current;
    const g = (window as any).google;
    if (!map || !g?.maps || !ready) return;
    clusterRef.current?.clearMarkers();
    markersRef.current.clear();
    const markers = pins.map((p) => {
      const m = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        title: p.label,
        icon: iconFor(g, p, false),
      });
      // Look the pin up at click time so handlers never go stale.
      m.addListener("click", () => pinByIdRef.current.get(p.id)?.onClick());
      markersRef.current.set(p.id, m);
      return m;
    });
    clusterRef.current = new MarkerClusterer({ map, markers, renderer: clusterRenderer as any });
    return () => { clusterRef.current?.clearMarkers(); markersRef.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey, ready]);

  React.useEffect(() => {
    const g = (window as any).google;
    if (!g?.maps || !ready) return;
    for (const id of [prevSelectedRef.current, selectedId]) {
      if (!id) continue;
      const m = markersRef.current.get(id);
      const p = pinByIdRef.current.get(id);
      if (m && p) {
        m.setIcon(iconFor(g, p, p.selected));
        m.setZIndex(p.selected ? 999 : undefined);
      }
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, ready, geomKey]);

  // Fly to a picked property.
  React.useEffect(() => {
    const map = mapRef.current;
    if (map && ready && fly) {
      map.panTo({ lat: fly.lat, lng: fly.lng });
      map.setZoom(14);
    }
  }, [fly, ready]);

  // Fit to the searched place (or reset to the US view).
  React.useEffect(() => {
    const map = mapRef.current;
    const g = (window as any).google;
    if (!map || !g?.maps || !ready) return;
    if (!place) { map.setCenter(US_CENTER); map.setZoom(4); return; }
    if (fitPoints.length === 0) return;
    if (fitPoints.length === 1) { map.setCenter(fitPoints[0]); map.setZoom(12); return; }
    const b = new g.maps.LatLngBounds();
    for (const p of fitPoints) b.extend(p);
    map.fitBounds(b, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, ready]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
        Google Maps couldn’t load — check the key’s billing + website restriction, or switch back to Map view.
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-secondary/30">
          <span className="animate-pulse rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-card">
            Loading Google Maps…
          </span>
        </div>
      )}
    </div>
  );
}
