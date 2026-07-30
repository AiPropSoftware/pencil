/**
 * Permanent permit store — reads the Supabase `permits` table that the daily
 * ingest workflow keeps topped up. This is what makes the map's data FIRM:
 * live city APIs stay the freshness layer, but everything ever ingested
 * stays on the map even when a portal trims its window, reorders, or breaks.
 *
 * Reads are public-RLS (these are public records); writes happen only from
 * the ingest job with the service role.
 */
import { getSupabase } from "@/integrations/supabase/client";
import type { Development, ProductType, DevStatus } from "@/data/developments";

const PAGE = 1000;      // Supabase API default max-rows per request
const MAX_PAGES = 15;   // 15k permits is plenty for the map today

export async function fetchStoredPermits(): Promise<Development[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const out: Development[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await sb
      .from("permits")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error || !data) break;
    for (const r of data) {
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
      out.push({
        id: r.id,
        name: r.name || `${r.product_type} — ${r.city}`,
        developer: r.developer || "Permit holder on file",
        city: r.city,
        state: r.state,
        lat: r.lat,
        lng: r.lng,
        productType: (r.product_type as ProductType) || "Infill",
        units: r.units ?? 1,
        landSqft: r.land_sqft ?? 0,
        buildingSqft: r.building_sqft ?? 0,
        stories: r.stories ?? 2,
        status: (r.status as DevStatus) || "Permitted",
        approvedDate: r.approved_date ?? "—",
        estValue: r.est_value ?? 0,
        pricePerSqft: r.price_per_sqft ?? 0,
        description: r.description || "New-construction permit — real public record (stored copy).",
        sqftEstimated: r.sqft_estimated,
      });
    }
    if (data.length < PAGE) break;
  }
  return out;
}
