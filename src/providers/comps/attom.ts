import { getSupabase } from "@/integrations/supabase/client";
import type { CompRecord, CompsProvider, CompsQuery } from "./types";

/**
 * ATTOM comps via a Supabase Edge Function. The function holds the ATTOM API
 * key server-side and translates our generic CompsQuery to ATTOM's params.
 */
export const attomProvider: CompsProvider = {
  name: "attom",
  async search(q: CompsQuery): Promise<CompRecord[]> {
    const sb = getSupabase();
    if (!sb) return demoComps(q);
    const { data, error } = await sb.functions.invoke("comps-search", {
      body: { provider: "attom", query: q },
    });
    if (error) {
      console.warn("attom edge function unavailable, returning demo comps", error);
      return demoComps(q);
    }
    return ((data as { comps?: CompRecord[] })?.comps ?? []).map(normalize);
  },
};

function normalize(c: CompRecord): CompRecord {
  return {
    ...c,
    pricePerSqft:
      c.pricePerSqft ?? (c.sqft && c.sqft > 0 ? Math.round(c.soldPrice / c.sqft) : null),
  };
}

/** Deterministic demo set so the UI works before the edge function is live. */
export function demoComps(q: CompsQuery): CompRecord[] {
  const center = q.center ?? { lat: 30.2672, lng: -97.7431 }; // Austin default
  const seeds = [
    { addr: "2421 E 5th St",   beds: 4, baths: 4.5, sqft: 3120, sold: 1_340_000, dom: 18 },
    { addr: "3814 S Lamar",    beds: 4, baths: 4,   sqft: 2960, sold: 1_265_000, dom: 22 },
    { addr: "5402 N Burnet",   beds: 4, baths: 3.5, sqft: 3280, sold: 1_415_000, dom: 35 },
    { addr: "1217 Walnut Ave", beds: 3, baths: 3,   sqft: 2480, sold: 1_080_000, dom: 14 },
    { addr: "8901 E Riverside",beds: 4, baths: 4,   sqft: 3340, sold: 1_460_000, dom: 27 },
    { addr: "6022 Manor Rd",   beds: 4, baths: 4.5, sqft: 3060, sold: 1_295_000, dom: 19 },
    { addr: "740 Cesar Chavez",beds: 3, baths: 3.5, sqft: 2780, sold: 1_175_000, dom: 41 },
    { addr: "115 W Mary",      beds: 4, baths: 4,   sqft: 3180, sold: 1_380_000, dom: 12 },
  ];
  return seeds.map((s, i) => ({
    id: `demo-${i}`,
    address: s.addr,
    lat: center.lat + (Math.sin(i * 1.31) * 0.018),
    lng: center.lng + (Math.cos(i * 1.31) * 0.024),
    beds: s.beds,
    baths: s.baths,
    sqft: s.sqft,
    lotSqft: 5200 + i * 80,
    yearBuilt: 2024,
    soldPrice: s.sold,
    soldDate: new Date(2026, 5 - i, 18).toISOString().slice(0, 10),
    listPrice: Math.round(s.sold * 1.04),
    daysOnMarket: s.dom,
    pricePerSqft: Math.round(s.sold / s.sqft),
    source: "demo",
  }));
}
