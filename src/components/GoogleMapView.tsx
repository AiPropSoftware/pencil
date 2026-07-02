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
import { loadGoogleMaps } from "@/lib/googleMaps";

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
  apiKey, pins, fly, place, fitPoints,
}: {
  apiKey: string;
  pins: GPin[];
  fly: { lat: number; lng: number } | null;
  place: string;
  fitPoints: { lat: number; lng: number }[];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const clusterRef = React.useRef<MarkerClusterer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Init once.
  React.useEffect(() => {
    let cancelled = false;
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
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [apiKey]);

  // Markers + clustering follow the pin set.
  React.useEffect(() => {
    const map = mapRef.current;
    const g = (window as any).google;
    if (!map || !g?.maps || !ready) return;
    clusterRef.current?.clearMarkers();
    const markers = pins.map((p) => {
      const m = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        title: p.label,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          fillColor: p.color,
          fillOpacity: p.selected ? 1 : 0.85,
          strokeColor: p.deal ? "#c8a55c" : "#ffffff",
          strokeWeight: p.deal ? 3 : 2,
          scale: p.selected ? 9 : 7,
        },
        zIndex: p.selected ? 999 : undefined,
      });
      m.addListener("click", p.onClick);
      return m;
    });
    clusterRef.current = new MarkerClusterer({ map, markers, renderer: clusterRenderer as any });
    return () => { clusterRef.current?.clearMarkers(); };
  }, [pins, ready]);

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
  return <div ref={ref} className="h-full w-full" />;
}
