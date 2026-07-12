// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");

/**
 * Discover builders/GCs via Google Places (New) — Text Search API.
 * Combines with the Shovels permit signal upstream in the client.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query, center, radiusMeters } = await req.json();
    if (!GOOGLE_PLACES_API_KEY) {
      return json({ builders: [], warning: "GOOGLE_PLACES_API_KEY not configured" });
    }

    const body = {
      textQuery: query || "general contractor new construction",
      locationBias: center
        ? { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusMeters ?? 8000 } }
        : undefined,
    };

    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.id",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text();
      return json({ error: `Places ${r.status}: ${text}` }, { status: 502 });
    }
    const data: any = await r.json();
    const builders = (data?.places ?? []).map((p: any) => ({
      id: p?.id ?? crypto.randomUUID(),
      name: p?.displayName?.text ?? "",
      address: p?.formattedAddress ?? "",
      website: p?.websiteUri ?? null,
      phone: p?.nationalPhoneNumber ?? null,
      rating: p?.rating ?? null,
      reviews: p?.userRatingCount ?? null,
    }));
    return json({ builders });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
