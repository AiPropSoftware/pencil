// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const SHOVELS_API_KEY = Deno.env.get("SHOVELS_API_KEY");
const SHOVELS_BASE = "https://api.shovels.ai/v2";

interface Query {
  center?: { lat: number; lng: number };
  radiusMi?: number;
  monthsBack?: number;
  newConstructionOnly?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query }: { provider: string; query: Query } = await req.json();
    if (!SHOVELS_API_KEY) return json({ permits: [], warning: "SHOVELS_API_KEY not configured" });
    if (!query.center) return json({ error: "query.center required" }, { status: 400 });

    const issuedAfter = new Date(Date.now() - (query.monthsBack ?? 12) * 30 * 86400_000)
      .toISOString()
      .slice(0, 10);

    const params = new URLSearchParams({
      latitude: String(query.center.lat),
      longitude: String(query.center.lng),
      radius_miles: String(query.radiusMi ?? 3),
      issued_after: issuedAfter,
      page_size: "100",
    });
    if (query.newConstructionOnly) params.set("permit_type", "new_construction");

    const r = await fetch(`${SHOVELS_BASE}/permits?${params.toString()}`, {
      headers: { "X-API-Key": SHOVELS_API_KEY, Accept: "application/json" },
    });
    if (!r.ok) {
      const text = await r.text();
      return json({ error: `Shovels ${r.status}: ${text}` }, { status: 502 });
    }
    const body: any = await r.json();
    const items = Array.isArray(body?.items) ? body.items : body?.data ?? [];

    const permits = items.map((p: any) => ({
      id: String(p?.id ?? p?.permit_id ?? crypto.randomUUID()),
      address: p?.address ?? p?.formatted_address ?? "",
      lat: Number(p?.latitude ?? p?.geo?.lat),
      lng: Number(p?.longitude ?? p?.geo?.lng),
      type: p?.permit_type ?? "new_construction",
      status: p?.status ?? "issued",
      valuation: p?.valuation != null ? Number(p.valuation) : null,
      contractor: p?.contractor_name ?? p?.contractor ?? null,
      issuedDate: (p?.issued_date ?? "").slice(0, 10),
      description: p?.description ?? "",
      jurisdiction: p?.jurisdiction ?? p?.county ?? "",
    }));

    return json({ permits });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
