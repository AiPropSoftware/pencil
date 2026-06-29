import { getSupabase } from "@/integrations/supabase/client";

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
  type?: string;
}

/** A few popular metros so the UI still works with no Mapbox token. */
const FALLBACK_METROS: Record<string, GeocodeResult> = {
  austin:    { name: "Austin, TX",     lat: 30.2672,  lng: -97.7431 },
  dallas:    { name: "Dallas, TX",     lat: 32.7767,  lng: -96.7970 },
  houston:   { name: "Houston, TX",    lat: 29.7604,  lng: -95.3698 },
  denver:    { name: "Denver, CO",     lat: 39.7392,  lng: -104.9903 },
  phoenix:   { name: "Phoenix, AZ",    lat: 33.4484,  lng: -112.0740 },
  nashville: { name: "Nashville, TN",  lat: 36.1627,  lng: -86.7816 },
  atlanta:   { name: "Atlanta, GA",    lat: 33.7490,  lng: -84.3880 },
  tampa:     { name: "Tampa, FL",      lat: 27.9506,  lng: -82.4572 },
  charlotte: { name: "Charlotte, NC",  lat: 35.2271,  lng: -80.8431 },
  raleigh:   { name: "Raleigh, NC",    lat: 35.7796,  lng: -78.6382 },
};

const MEMO = new Map<string, GeocodeResult>();

function localMatch(query: string): GeocodeResult | null {
  const q = query.trim().toLowerCase();
  for (const [k, v] of Object.entries(FALLBACK_METROS)) {
    if (q.includes(k)) return v;
  }
  return null;
}

/**
 * Geocode an address or place via the Mapbox-backed geocode edge function.
 * Falls back to a small list of US metros so the UI never hits a dead-end.
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const key = query.trim();
  if (!key) return null;
  const cached = MEMO.get(key.toLowerCase());
  if (cached) return cached;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.functions.invoke("geocode", { body: { query: key } });
      if (!error) {
        const first = (data as { results?: GeocodeResult[] })?.results?.[0];
        if (first && Number.isFinite(first.lat) && Number.isFinite(first.lng)) {
          MEMO.set(key.toLowerCase(), first);
          return first;
        }
      }
    } catch {
      /* fall through to local match */
    }
  }

  const local = localMatch(key);
  if (local) {
    MEMO.set(key.toLowerCase(), local);
    return local;
  }
  return null;
}
