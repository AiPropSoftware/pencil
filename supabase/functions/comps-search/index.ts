// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

const ATTOM_API_KEY = Deno.env.get("ATTOM_API_KEY");
const ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

interface Query {
  center?: { lat: number; lng: number };
  radiusMi?: number;
  monthsBack?: number;
  newConstructionOnly?: boolean;
  minSqft?: number;
  maxSqft?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { query }: { provider: string; query: Query } = await req.json();
    if (!ATTOM_API_KEY) {
      return json({ comps: [], warning: "ATTOM_API_KEY not configured" });
    }
    if (!query.center) {
      return json({ error: "query.center required" }, { status: 400 });
    }

    const params = new URLSearchParams({
      latitude: String(query.center.lat),
      longitude: String(query.center.lng),
      radius: String(query.radiusMi ?? 3),
      pagesize: "50",
      orderby: "saleTransDate desc",
    });

    const url = `${ATTOM_BASE}/sale/snapshot?${params.toString()}`;
    const r = await fetch(url, {
      headers: { Accept: "application/json", apikey: ATTOM_API_KEY },
    });
    if (!r.ok) {
      const text = await r.text();
      return json({ error: `ATTOM ${r.status}: ${text}` }, { status: 502 });
    }
    const body: any = await r.json();
    const props = Array.isArray(body?.property) ? body.property : [];

    const cutoff = query.monthsBack
      ? new Date(Date.now() - query.monthsBack * 30 * 86400_000)
      : null;

    const comps = props
      .map((p: any) => normalize(p))
      .filter((c: any) => c != null)
      .filter((c: any) => !cutoff || new Date(c.soldDate) >= cutoff)
      .filter((c: any) =>
        !query.newConstructionOnly ||
        (c.yearBuilt && c.yearBuilt >= new Date(c.soldDate).getFullYear() - 1)
      )
      .filter((c: any) => !query.minSqft || (c.sqft ?? 0) >= query.minSqft)
      .filter((c: any) => !query.maxSqft || (c.sqft ?? Infinity) <= query.maxSqft);

    return json({ comps });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});

function normalize(p: any) {
  const soldPrice = p?.sale?.amount?.saleAmt ?? p?.sale?.saleAmt;
  if (!soldPrice) return null;
  const sqft = p?.building?.size?.universalsize ?? p?.building?.size?.livingsize ?? null;
  return {
    id: String(p?.identifier?.attomId ?? crypto.randomUUID()),
    address: [p?.address?.line1, p?.address?.line2].filter(Boolean).join(", "),
    lat: Number(p?.location?.latitude),
    lng: Number(p?.location?.longitude),
    beds: p?.building?.rooms?.beds ?? null,
    baths: p?.building?.rooms?.bathstotal ?? null,
    sqft,
    lotSqft: p?.lot?.lotsize2 ?? null,
    yearBuilt: p?.summary?.yearbuilt ?? null,
    soldPrice: Number(soldPrice),
    soldDate: (p?.sale?.salesearchdate ?? p?.sale?.amount?.saleRecDate ?? "").slice(0, 10),
    listPrice: null,
    daysOnMarket: null,
    pricePerSqft: sqft ? Math.round(Number(soldPrice) / sqft) : null,
    source: "attom",
  };
}
