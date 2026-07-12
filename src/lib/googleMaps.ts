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

export interface AddressSuggestion {
  description: string;
  placeId: string;
}

// Which Places generation this key supports — probed once, then cached so a
// key without Places enabled doesn't throw on every keystroke.
let placesMode: "new" | "legacy" | "none" | null = null;

/**
 * Address typeahead via Google Places Autocomplete. Tries the current
 * AutocompleteSuggestion API first, falls back to the legacy
 * AutocompleteService, and degrades to no suggestions (never an error) when
 * Places isn't enabled on the key.
 */
export async function suggestAddresses(key: string, input: string): Promise<AddressSuggestion[]> {
  const text = input.trim();
  if (text.length < 5 || placesMode === "none") return [];
  try {
    const g = await loadGoogleMaps(key);
    if (!g.maps.importLibrary) { placesMode = "none"; return []; }
    const places: any = await g.maps.importLibrary("places");
    if (placesMode !== "legacy" && places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          includedRegionCodes: ["us"],
        });
        placesMode = "new";
        return (suggestions ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({ description: p.text?.text ?? String(p.text ?? ""), placeId: String(p.placeId ?? "") }))
          .filter((p: AddressSuggestion) => p.description);
      } catch {
        placesMode = null; // fall through to legacy below
      }
    }
    if (places.AutocompleteService) {
      const svc = new places.AutocompleteService();
      const preds: any[] = await new Promise((resolve) => {
        svc.getPlacePredictions(
          { input: text, componentRestrictions: { country: "us" }, types: ["address"] },
          (p: any[] | null) => resolve(p ?? []),
        );
      });
      if (preds.length) placesMode = "legacy";
      return preds.map((p: any) => ({ description: p.description, placeId: p.place_id }));
    }
    placesMode = "none";
    return [];
  } catch (e) {
    placesMode = "none";
    // eslint-disable-next-line no-console
    console.warn("[Pencil] address suggestions unavailable:", (e as Error).message);
    return [];
  }
}

/** Full geocode: address → coordinates + city/state (from address components). */
export async function geocodeAddress(
  key: string,
  address: string,
): Promise<{ lat: number; lng: number; city: string; state: string; formatted: string } | null> {
  try {
    const g = await loadGoogleMaps(key);
    const geocoder = new g.maps.Geocoder();
    const res = await geocoder.geocode({ address });
    const first = res.results?.[0];
    const loc = first?.geometry?.location;
    if (!loc) return null;
    const comps: { types: string[]; long_name: string; short_name: string }[] = first.address_components ?? [];
    const find = (t: string, short = false) => {
      const c = comps.find((x) => x.types.includes(t));
      return c ? (short ? c.short_name : c.long_name) : "";
    };
    return {
      lat: loc.lat(),
      lng: loc.lng(),
      city: find("locality") || find("sublocality") || find("administrative_area_level_2"),
      state: find("administrative_area_level_1", true),
      formatted: first.formatted_address ?? address,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Pencil] geocode unavailable:", (e as Error).message);
    return null;
  }
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
