/**
 * Lazy Google Maps JS loader + geocoder cross-check.
 *
 * The Geocoding REST endpoint doesn't send CORS headers, so browser-side
 * geocoding must go through the Maps JS API's Geocoder. We load the script
 * once, on demand — it also becomes the base for the Google-basemap renderer.
 */

// deno-lint-ignore-file
/* eslint-disable @typescript-eslint/no-explicit-any */

let loader: Promise<any> | null = null;

export function loadGoogleMaps(key: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    s.async = true;
    s.onload = () => resolve(w.google);
    s.onerror = () => { loader = null; reject(new Error("Google Maps JS failed to load")); };
    document.head.appendChild(s);
  });
  return loader;
}

/** Geocode an address via Google and return its distance (m) from our pin. */
export async function geocodeVerify(
  key: string,
  query: string,
  lat: number,
  lng: number,
): Promise<{ distanceM: number } | null> {
  try {
    const g = await loadGoogleMaps(key);
    const geocoder = new g.maps.Geocoder();
    const res = await geocoder.geocode({ address: query });
    const loc = res.results?.[0]?.geometry?.location;
    if (!loc) return null;
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(loc.lat() - lat);
    const dLng = toRad(loc.lng() - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(loc.lat())) * Math.sin(dLng / 2) ** 2;
    return { distanceM: Math.round(2 * R * Math.asin(Math.sqrt(a))) };
  } catch (e) {
    // Billing off / quota / restriction issues degrade silently.
    // eslint-disable-next-line no-console
    console.warn("[Pencil] geocoder verify unavailable:", (e as Error).message);
    return null;
  }
}
