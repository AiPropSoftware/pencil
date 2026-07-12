// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

/**
 * MLS listings via Bridge Data Output (RESO Web API) — the legitimate,
 * non-scraping source Zillow/Redfin themselves license. Requires an MLS/
 * brokerage-sponsored Bridge token in Supabase secrets:
 *   BRIDGE_TOKEN   — Bridge Data Output access token
 *   BRIDGE_DATASET — the MLS dataset slug (e.g. "actris" for Austin)
 *
 * Swap to Trestle (CoreLogic) by changing the base URL + auth header; the
 * RESO field names are the same, so the normalizer below is unchanged.
 */
const BRIDGE_TOKEN = Deno.env.get("BRIDGE_TOKEN");
const BRIDGE_DATASET = Deno.env.get("BRIDGE_DATASET");
const BASE = "https://api.bridgedataoutput.com/api/v2/OData";

function kindFrom(subType: string, yearBuilt: number | null): string {
  const t = (subType || "").toLowerCase();
  if (/land|lot|acre/.test(t)) return "Vacant land";
  if (/duplex|triplex|quadruplex|multi|apartment/.test(t)) return "Multifamily";
  if (yearBuilt && yearBuilt < 1975) return "Teardown"; // old structure → likely scrape/rebuild
  return "SFH resale";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!BRIDGE_TOKEN || !BRIDGE_DATASET) {
      return json({ listings: [], configured: false, note: "Set BRIDGE_TOKEN and BRIDGE_DATASET to enable live MLS." });
    }
    const { city, top = 200 } = await req.json().catch(() => ({}));

    const filters = ["StandardStatus eq 'Active'"];
    if (city) filters.push(`City eq '${String(city).replace(/'/g, "''")}'`);
    const url =
      `${BASE}/${BRIDGE_DATASET}/Property` +
      `?access_token=${BRIDGE_TOKEN}` +
      `&$top=${Math.min(Number(top) || 200, 500)}` +
      `&$filter=${encodeURIComponent(filters.join(" and "))}` +
      `&$orderby=ModificationTimestamp desc`;

    const r = await fetch(url);
    if (!r.ok) return json({ error: `Bridge ${r.status}: ${(await r.text()).slice(0, 200)}` }, { status: 502 });
    const body: any = await r.json();
    const rows: any[] = body?.value ?? [];

    const listings = rows
      .filter((p) => Number.isFinite(p.Latitude) && Number.isFinite(p.Longitude))
      .map((p) => ({
        id: `mls-${p.ListingKey}`,
        kind: kindFrom(p.PropertySubType, p.YearBuilt ?? null),
        address: p.UnparsedAddress ?? [p.StreetNumber, p.StreetName].filter(Boolean).join(" "),
        city: p.City ?? city ?? "",
        state: p.StateOrProvince ?? "",
        lat: p.Latitude,
        lng: p.Longitude,
        listPrice: p.ListPrice ?? 0,
        lotSqft: Math.round(p.LotSizeSquareFeet ?? (p.LotSizeAcres ? p.LotSizeAcres * 43560 : 0)),
        buildingSqft: Math.round(p.LivingArea ?? 0),
        beds: p.BedroomsTotal ?? null,
        baths: p.BathroomsTotalInteger ?? null,
        yearBuilt: p.YearBuilt ?? null,
        daysOnMarket: p.DaysOnMarket ?? 0,
        photo: p.Media?.[0]?.MediaURL ?? null, // REAL listing photo — the building
        source: "mls",
      }));

    return json({ listings, configured: true, count: listings.length });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
});
