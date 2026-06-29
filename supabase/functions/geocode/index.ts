// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query }: { query: string } = await req.json();
    if (!MAPBOX_TOKEN) return json({ error: "MAPBOX_TOKEN not configured" }, { status: 400 });
    if (!query) return json({ error: "query required" }, { status: 400 });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=5&access_token=${MAPBOX_TOKEN}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return json({ error: `Mapbox ${r.status}: ${text}` }, { status: 502 });
    }
    const body: any = await r.json();
    const results = (body?.features ?? []).map((f: any) => ({
      name: f.place_name,
      lat: f.center?.[1],
      lng: f.center?.[0],
      type: f.place_type?.[0],
    }));
    return json({ results });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
