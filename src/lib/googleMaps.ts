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
const authListeners = new Set<() => void>();

/**
 * Subscribe to Google's key-rejection signal (billing off, API not enabled,
 * or the site missing from the key's website restriction). Returns an
 * unsubscribe function.
 */
export function onGoogleAuthFailure(cb: () => void): () => void {
  authListeners.add(cb);
  return () => { authListeners.delete(cb); };
}

export function loadGoogleMaps(key: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve(w.google);
  if (loader) return loader;
  // Google invokes this global when the key is rejected after the script loads.
  w.gm_authFailure = () => {
    // eslint-disable-next-line no-console
    console.warn("[Pencil] Google Maps key rejected — check billing + website restriction in Google Cloud → Credentials");
    authListeners.forEach((cb) => cb());
  };
  loader = new Promise((resolve, reject) => {
    // A stalled request (blocked network, extension, flaky proxy) fires neither
    // onload nor onerror — without a deadline the promise never settles and the
    // map pane sits blank forever.
    const deadline = setTimeout(() => {
      loader = null;
      reject(new Error("Google Maps JS timed out"));
    }, 10000);
    // With loading=async, script onload fires BEFORE the API finishes its own
    // async init — google.maps isn't usable yet. Google's contract for this
    // mode is the callback param: it's invoked when the namespace is ready.
    w.__pencilMapsReady = () => {
      delete w.__pencilMapsReady;
      clearTimeout(deadline);
      resolve(w.google);
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__pencilMapsReady`;
    s.async = true;
    s.onerror = () => { clearTimeout(deadline); loader = null; reject(new Error("Google Maps JS failed to load")); };
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
