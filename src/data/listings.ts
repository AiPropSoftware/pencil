/**
 * Active listings layer — for competitive market analysis. These are the
 * properties a developer scouts: vacant land, teardowns, dated resales, and
 * small multifamily. Each carries a list price + price history so the X-ray
 * can auto-score it (list price vs Max Allowable Offer = deal / no-deal).
 *
 * Demo data for now; swaps for MLS/ATTOM listings without UI changes.
 */
import { METRO_CENTERS, type ProductType } from "./developments";
import { scoreOpportunity } from "@/lib/underwrite/opportunity";

export type ListingKind = "Vacant land" | "Teardown" | "SFH resale" | "Multifamily";

export const LISTING_KINDS: ListingKind[] = ["Vacant land", "Teardown", "SFH resale", "Multifamily"];

export const LISTING_COLOR: Record<ListingKind, string> = {
  "Vacant land": "#7d8a6a",   // sage
  Teardown: "#b5762f",        // amber
  "SFH resale": "#c8a55c",    // gold
  Multifamily: "#3f3a34",     // charcoal
};

export interface PricePoint {
  date: string;
  price: number;
  event: "Bought" | "Listed" | "Price cut" | "Sold";
}

export interface Listing {
  id: string;
  kind: ListingKind;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  listPrice: number;
  lotSqft: number;
  buildingSqft: number;        // existing structure (0 for land)
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  daysOnMarket: number;
  productTypeIfBuilt: ProductType; // what a developer would build here
  buildableSqft: number;           // sellable sqft of the new build
  priceHistory: PricePoint[];
  /** Real listing photo (MLS feed) — demo listings have none. */
  photo?: string;
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
function isoMinusMonths(months: number): string {
  const d = new Date("2026-06-15T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

const STREETS = [
  "Palmetto", "Ashwood", "Grand", "Sunset", "Bayshore", "Meridian", "Laurel",
  "Ivy", "Douglas", "Coral", "Crescent", "Monarch", "Willow", "Ember", "Sage",
  "Alder", "Brook", "Canyon", "Dover", "Everly", "Foster", "Gable", "Holloway",
  "Inglewood", "Juno", "Kestrel", "Linden", "Marlow", "Newbury", "Oakmont",
  "Preston", "Quarry", "Rosewood", "Stanton", "Thornbury", "Underwood", "Vernon",
  "Whitfield", "Yale", "Zephyr", "Amherst", "Beckett", "Colby", "Denton",
];

export function buildableFor(kind: ListingKind, lotSqft: number): { type: ProductType; sqft: number } {
  switch (kind) {
    case "Multifamily": return { type: "Small multi", sqft: Math.round(lotSqft * 1.1) };
    case "Vacant land": return { type: "SFH", sqft: Math.min(3400, Math.round(lotSqft * 0.5)) };
    case "Teardown": return { type: "SFH", sqft: Math.min(3200, Math.round(lotSqft * 0.55)) };
    case "SFH resale": return { type: "SFH", sqft: Math.min(3000, Math.round(lotSqft * 0.5)) };
  }
}

export const listings: Listing[] = (() => {
  const out: Listing[] = [];
  const cities = Object.keys(METRO_CENTERS);
  cities.forEach((city, ci) => {
    const m = METRO_CENTERS[city];
    for (let i = 0; i < 14; i++) {
      const kind = LISTING_KINDS[(ci * 2 + i) % LISTING_KINDS.length];
      const h = hash(`${city}-${i}`);
      const lotSqft = 4000 + (h % 14) * 850;
      const built = buildableFor(kind, lotSqft);
      // Price the parcel around what the underwrite says the land can support,
      // so demo margins land in a realistic -10%..+35% band instead of nonsense.
      const opp = scoreOpportunity({ city, type: built.type, buildableSqft: built.sqft, areaPpsf: m.ppsf });
      const mult = 0.82 + (h % 12) * 0.05; // 0.82 .. 1.37 × max supportable land value
      const existingPremium = kind === "SFH resale" ? 1.15 : kind === "Multifamily" ? 1.1 : 1; // standing income/structure value
      const listPrice = Math.max(60_000, Math.round((opp.maxLandPrice * mult * existingPremium) / 1000) * 1000);
      const angle = ci * 1.9 + i * 0.61;
      const ring = 0.006 + ((i * 3) % 9) * 0.005;          // ~0.4–2.5 mi, tight
      const inland = m.lng < -98 ? 1 : -1;                 // push toward US interior
      const rawLng = Math.cos(angle) * ring;
      const lat = +(m.lat + Math.sin(angle) * ring).toFixed(4);
      const lng = +(m.lng + (Math.sign(rawLng) === inland ? rawLng : rawLng * -0.4)).toFixed(4);
      const dom = 5 + (h % 120);
      const existing = kind === "Vacant land" ? 0 : 900 + (h % 20) * 90;

      // Price history: bought a while back, listed, maybe a cut.
      const history: PricePoint[] = [];
      history.push({ date: isoMinusMonths(24 + (h % 40)), price: Math.round(listPrice * 0.62), event: "Bought" });
      history.push({ date: isoMinusMonths(2 + (h % 4)), price: Math.round(listPrice * 1.06), event: "Listed" });
      if (h % 2 === 0) history.push({ date: isoMinusMonths(1), price: listPrice, event: "Price cut" });

      out.push({
        id: `lst-${ci}-${i}`,
        kind,
        address: `${100 + (h % 900)} ${STREETS[(ci + i) % STREETS.length]} ${kind === "Vacant land" ? "Lot" : "St"}`,
        city,
        state: m.state,
        lat,
        lng,
        listPrice,
        lotSqft,
        buildingSqft: existing,
        beds: kind === "Vacant land" ? null : 2 + (h % 3),
        baths: kind === "Vacant land" ? null : 1 + (h % 3),
        yearBuilt: kind === "Vacant land" ? null : 1948 + (h % 60),
        daysOnMarket: dom,
        productTypeIfBuilt: built.type,
        buildableSqft: built.sqft,
        priceHistory: history,
      });
    }
  });
  return out;
})();
