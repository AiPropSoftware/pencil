/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google-basemap renderer — the true Google Maps look, rendered with Google's
 * own engine (their license requires their renderer; tiles can't be used in
 * Leaflet). Reuses the exact same pin set as the Leaflet view: colors,
 * deal rings, selection, click-through to the property panels, and the same
 * supercluster viewport strategy — only what's on screen ever becomes a
 * google.maps.Marker (a few dozen objects), never the full national set.
 */
import * as React from "react";
import Supercluster from "supercluster";
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
  const indexRef = React.useRef<Supercluster<{ pid: string }> | null>(null);
  const markersRef = React.useRef<Map<string, any>>(new Map());
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const onFailedRef = React.useRef(onFailed);
  onFailedRef.current = onFailed;

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

  // Materialize markers only for the clusters/points inside the current
  // viewport, diffing against what's already on the map.
  const renderViewport = React.useCallback(() => {
    const map = mapRef.current;
    const g = (window as any).google;
    const index = indexRef.current;
    if (!map || !g?.maps || !index) return;
    const b = map.getBounds();
    if (!b) return; // first idle after init will call us again
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const zoom = Math.round(map.getZoom() ?? 4);
    let clusters: any[] = [];
    try { clusters = index.getClusters([sw.lng(), sw.lat(), ne.lng(), ne.lat()], zoom); } catch { clusters = []; }

    const keep = new Set<string>();
    for (const c of clusters) {
      const [lng, lat] = c.geometry.coordinates;
      const props = c.properties as { cluster?: boolean; point_count?: number; pid?: string };
      if (props.cluster) {
        const key = `cl:${c.id}`;
        keep.add(key);
        if (!markersRef.current.has(key)) {
          const count = props.point_count ?? 0;
          const m = new g.maps.Marker({
            map,
            position: { lat, lng },
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              fillColor: "#c8a55c",
              fillOpacity: 0.92,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              scale: 14 + Math.min(10, Math.log2(count + 1) * 3),
            },
            label: { text: String(count), color: "#1a1612", fontSize: "12px", fontWeight: "600" },
            zIndex: 500,
          });
          m.addListener("click", () => {
            try {
              map.panTo({ lat, lng });
              map.setZoom(Math.min(index.getClusterExpansionZoom(c.id as number), 16));
            } catch { /* index swapped mid-click; next idle repaints */ }
          });
          markersRef.current.set(key, m);
        }
      } else {
        const pid = props.pid as string;
        const p = pinByIdRef.current.get(pid);
        if (!p) continue;
        const key = `pt:${pid}`;
        keep.add(key);
        if (!markersRef.current.has(key)) {
          const m = new g.maps.Marker({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: p.label,
            icon: iconFor(g, p, p.selected),
            zIndex: p.selected ? 999 : undefined,
          });
          m.addListener("click", () => pinByIdRef.current.get(pid)?.onClick());
          markersRef.current.set(key, m);
        }
      }
    }
    for (const [key, m] of markersRef.current) {
      if (!keep.has(key)) {
        m.setMap(null);
        markersRef.current.delete(key);
      }
    }
  }, []);

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
    let idleListener: any = null;
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
        idleListener = mapRef.current.addListener("idle", renderViewport);
        setReady(true);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn("[Pencil] Google view failed:", (e as Error)?.message ?? e);
        fail();
      });
    return () => {
      cancelled = true;
      offAuth();
      idleListener?.remove();
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Rebuild the cluster index only when the pin DATA changes (layer switch,
  // filters, live refresh) — never on selection or unrelated re-renders.
  React.useEffect(() => {
    if (!ready) return;
    const sc = new Supercluster<{ pid: string }>({ radius: 58, maxZoom: 15 });
    sc.load(pins.map((p) => ({
      type: "Feature" as const,
      properties: { pid: p.id },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })));
    indexRef.current = sc;
    // Cluster ids belong to the old index — start clean, then repaint.
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
    renderViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey, ready]);

  // Selection restyles just the affected markers (if currently on screen).
  React.useEffect(() => {
    const g = (window as any).google;
    if (!g?.maps || !ready) return;
    for (const id of [prevSelectedRef.current, selectedId]) {
      if (!id) continue;
      const m = markersRef.current.get(`pt:${id}`);
      const p = pinByIdRef.current.get(id);
      if (m && p) {
        m.setIcon(iconFor(g, p, p.selected));
        m.setZIndex(p.selected ? 999 : undefined);
      }
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, ready]);

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
