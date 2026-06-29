/**
 * Demo dataset of ground-up US developments shown on the Geo Developer Map.
 * Stands in for the live ATTOM + Shovels feed until those keys are wired —
 * but is realistic enough to explore the full experience today.
 */
export type ProductType =
  | "SFH"
  | "Duplex"
  | "Fourplex"
  | "Townhomes"
  | "Small multi"
  | "Infill";

export type DevStatus = "Approved" | "Permitted" | "Under construction" | "Completed";

export interface Development {
  id: string;
  name: string;
  developer: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  productType: ProductType;
  units: number;
  landSqft: number;
  buildingSqft: number;
  stories: number;
  status: DevStatus;
  approvedDate: string; // ISO
  estValue: number; // projected completed value (ARV)
  pricePerSqft: number; // build cost $/sqft assumption
  description: string;
}

export const PRODUCT_TYPES: ProductType[] = [
  "SFH", "Duplex", "Fourplex", "Townhomes", "Small multi", "Infill",
];

export const STATUSES: DevStatus[] = [
  "Approved", "Permitted", "Under construction", "Completed",
];

/** Gold-forward palette, kept within the design system. */
export const TYPE_COLOR: Record<ProductType, string> = {
  SFH: "#c8a55c",          // gold
  Duplex: "#7d8a6a",       // sage
  Fourplex: "#b5762f",     // amber
  Townhomes: "#9c6b4a",    // terracotta
  "Small multi": "#3f3a34", // charcoal
  Infill: "#5b6b73",       // slate
};

export const developments: Development[] = [
  // ── Austin, TX ──────────────────────────────────────────────
  { id: "atx-1", name: "East 5th Rowhomes", developer: "Lariat Homes", city: "Austin", state: "TX", lat: 30.2585, lng: -97.7185, productType: "Fourplex", units: 4, landSqft: 6500, buildingSqft: 5200, stories: 3, status: "Under construction", approvedDate: "2025-11-12", estValue: 1_340_000, pricePerSqft: 220, description: "Four-unit infill build replacing a tear-down on a corner lot." },
  { id: "atx-2", name: "South Lamar Triplex", developer: "Cedar & Pine LLC", city: "Austin", state: "TX", lat: 30.2461, lng: -97.7892, productType: "Small multi", units: 3, landSqft: 7100, buildingSqft: 4800, stories: 2, status: "Permitted", approvedDate: "2026-02-03", estValue: 1_180_000, pricePerSqft: 235, description: "Three detached units around a shared courtyard." },
  { id: "atx-3", name: "Mueller Townhome Row", developer: "Brick Stone Build", city: "Austin", state: "TX", lat: 30.2998, lng: -97.7035, productType: "Townhomes", units: 6, landSqft: 9800, buildingSqft: 9100, stories: 3, status: "Approved", approvedDate: "2026-04-18", estValue: 2_640_000, pricePerSqft: 215, description: "Six for-sale townhomes near the Mueller district." },
  { id: "atx-4", name: "Govalle Infill Duplex", developer: "Halo Construction", city: "Austin", state: "TX", lat: 30.2622, lng: -97.6896, productType: "Duplex", units: 2, landSqft: 5400, buildingSqft: 3100, stories: 2, status: "Completed", approvedDate: "2025-06-22", estValue: 845_000, pricePerSqft: 210, description: "Two-unit build, both sides leased on completion." },

  // ── Dallas, TX ──────────────────────────────────────────────
  { id: "dal-1", name: "Live Oak Quads", developer: "Halo Construction", city: "Dallas", state: "TX", lat: 32.7975, lng: -96.7741, productType: "Fourplex", units: 4, landSqft: 7000, buildingSqft: 5400, stories: 2, status: "Under construction", approvedDate: "2025-12-01", estValue: 1_290_000, pricePerSqft: 195, description: "Fourplex in a rapidly densifying East Dallas corridor." },
  { id: "dal-2", name: "Bishop Arts Infill", developer: "Trinity Vertical", city: "Dallas", state: "TX", lat: 32.7488, lng: -96.8295, productType: "Infill", units: 1, landSqft: 4200, buildingSqft: 2600, stories: 2, status: "Permitted", approvedDate: "2026-01-19", estValue: 720_000, pricePerSqft: 205, description: "Single high-end infill home in Bishop Arts." },
  { id: "dal-3", name: "Oak Cliff Townhomes", developer: "Trinity Vertical", city: "Dallas", state: "TX", lat: 32.7409, lng: -96.8512, productType: "Townhomes", units: 5, landSqft: 8600, buildingSqft: 7800, stories: 3, status: "Approved", approvedDate: "2026-03-27", estValue: 2_150_000, pricePerSqft: 200, description: "Five-unit townhome project on a former single lot." },

  // ── Houston, TX ─────────────────────────────────────────────
  { id: "hou-1", name: "Heights Eight", developer: "Bayou Build Co.", city: "Houston", state: "TX", lat: 29.7905, lng: -95.3988, productType: "Townhomes", units: 8, landSqft: 12000, buildingSqft: 13600, stories: 3, status: "Under construction", approvedDate: "2025-10-08", estValue: 3_760_000, pricePerSqft: 185, description: "Eight three-story townhomes in The Heights." },
  { id: "hou-2", name: "Montrose Fourplex", developer: "Bayou Build Co.", city: "Houston", state: "TX", lat: 29.7424, lng: -95.3905, productType: "Fourplex", units: 4, landSqft: 6600, buildingSqft: 5000, stories: 3, status: "Permitted", approvedDate: "2026-02-14", estValue: 1_220_000, pricePerSqft: 190, description: "Four-unit build steps from Montrose dining." },
  { id: "hou-3", name: "EaDo Duplex Pair", developer: "Lone Star Infill", city: "Houston", state: "TX", lat: 29.7487, lng: -95.3399, productType: "Duplex", units: 2, landSqft: 5000, buildingSqft: 3000, stories: 2, status: "Approved", approvedDate: "2026-04-02", estValue: 760_000, pricePerSqft: 195, description: "Duplex in the East Downtown growth zone." },

  // ── Phoenix, AZ ─────────────────────────────────────────────
  { id: "phx-1", name: "Roosevelt Row Infill", developer: "Sonoran Build", city: "Phoenix", state: "AZ", lat: 33.4585, lng: -112.0712, productType: "Infill", units: 1, landSqft: 4800, buildingSqft: 2400, stories: 2, status: "Completed", approvedDate: "2025-05-30", estValue: 690_000, pricePerSqft: 200, description: "Modern infill home in the arts district." },
  { id: "phx-2", name: "Arcadia Fourplex", developer: "Sonoran Build", city: "Phoenix", state: "AZ", lat: 33.4942, lng: -111.9620, productType: "Fourplex", units: 4, landSqft: 8000, buildingSqft: 5600, stories: 2, status: "Under construction", approvedDate: "2025-11-25", estValue: 1_540_000, pricePerSqft: 215, description: "Fourplex on an oversized Arcadia lot." },
  { id: "phx-3", name: "Tempe Small Multi", developer: "Desert Vertical", city: "Phoenix", state: "AZ", lat: 33.4255, lng: -111.9400, productType: "Small multi", units: 6, landSqft: 11000, buildingSqft: 8200, stories: 3, status: "Permitted", approvedDate: "2026-01-30", estValue: 2_280_000, pricePerSqft: 205, description: "Six-unit build near ASU rental demand." },

  // ── Denver, CO ──────────────────────────────────────────────
  { id: "den-1", name: "Baker District Duplex", developer: "Front Range Homes", city: "Denver", state: "CO", lat: 39.7099, lng: -104.9889, productType: "Duplex", units: 2, landSqft: 4690, buildingSqft: 3400, stories: 2, status: "Under construction", approvedDate: "2025-12-18", estValue: 1_050_000, pricePerSqft: 255, description: "Half-duplex pair in a historic Baker lot split." },
  { id: "den-2", name: "RiNo Townhomes", developer: "Mile High Build", city: "Denver", state: "CO", lat: 39.7691, lng: -104.9805, productType: "Townhomes", units: 7, landSqft: 10500, buildingSqft: 11200, stories: 3, status: "Approved", approvedDate: "2026-03-11", estValue: 3_640_000, pricePerSqft: 245, description: "Seven-unit project in the River North art district." },
  { id: "den-3", name: "Sloan's Lake Fourplex", developer: "Mile High Build", city: "Denver", state: "CO", lat: 39.7480, lng: -105.0440, productType: "Fourplex", units: 4, landSqft: 6250, buildingSqft: 5300, stories: 3, status: "Permitted", approvedDate: "2026-02-22", estValue: 1_720_000, pricePerSqft: 250, description: "Fourplex with lake-view rooftop decks." },

  // ── Nashville, TN ───────────────────────────────────────────
  { id: "bna-1", name: "East Nashville Tall Skinnies", developer: "Foundry Custom Homes", city: "Nashville", state: "TN", lat: 36.1782, lng: -86.7320, productType: "Duplex", units: 2, landSqft: 5200, buildingSqft: 4400, stories: 3, status: "Under construction", approvedDate: "2025-11-05", estValue: 1_120_000, pricePerSqft: 225, description: "Classic Nashville HPR duplex on a split lot." },
  { id: "bna-2", name: "Wedgewood-Houston Infill", developer: "Cumberland Build", city: "Nashville", state: "TN", lat: 36.1335, lng: -86.7665, productType: "Infill", units: 1, landSqft: 4000, buildingSqft: 2700, stories: 2, status: "Approved", approvedDate: "2026-04-09", estValue: 760_000, pricePerSqft: 220, description: "Single infill home near the WeHo gallery scene." },
  { id: "bna-3", name: "Germantown Fourplex", developer: "Cumberland Build", city: "Nashville", state: "TN", lat: 36.1812, lng: -86.7894, productType: "Fourplex", units: 4, landSqft: 6800, buildingSqft: 5100, stories: 3, status: "Permitted", approvedDate: "2026-01-15", estValue: 1_480_000, pricePerSqft: 230, description: "Fourplex steps from Germantown restaurants." },

  // ── Atlanta, GA ─────────────────────────────────────────────
  { id: "atl-1", name: "Old Fourth Ward Sixplex", developer: "Peachtree Vertical", city: "Atlanta", state: "GA", lat: 33.7660, lng: -84.3702, productType: "Small multi", units: 6, landSqft: 10800, buildingSqft: 8600, stories: 3, status: "Under construction", approvedDate: "2025-10-22", estValue: 2_460_000, pricePerSqft: 200, description: "Six-unit build along the Atlanta BeltLine." },
  { id: "atl-2", name: "West End Townhomes", developer: "Peachtree Vertical", city: "Atlanta", state: "GA", lat: 33.7361, lng: -84.4178, productType: "Townhomes", units: 5, landSqft: 8200, buildingSqft: 7600, stories: 3, status: "Approved", approvedDate: "2026-03-30", estValue: 1_980_000, pricePerSqft: 195, description: "Five for-sale townhomes near the West End MARTA." },
  { id: "atl-3", name: "Kirkwood Duplex", developer: "Decatur Build Group", city: "Atlanta", state: "GA", lat: 33.7510, lng: -84.3300, productType: "Duplex", units: 2, landSqft: 5600, buildingSqft: 3300, stories: 2, status: "Permitted", approvedDate: "2026-02-08", estValue: 820_000, pricePerSqft: 198, description: "Duplex on a deep Kirkwood lot." },

  // ── Tampa, FL ───────────────────────────────────────────────
  { id: "tpa-1", name: "Seminole Heights Fourplex", developer: "Gulf Coast Build", city: "Tampa", state: "FL", lat: 27.9942, lng: -82.4571, productType: "Fourplex", units: 4, landSqft: 7400, buildingSqft: 5200, stories: 2, status: "Under construction", approvedDate: "2025-12-09", estValue: 1_180_000, pricePerSqft: 190, description: "Fourplex in a hot Tampa rental submarket." },
  { id: "tpa-2", name: "Ybor Infill Pair", developer: "Gulf Coast Build", city: "Tampa", state: "FL", lat: 27.9605, lng: -82.4360, productType: "Duplex", units: 2, landSqft: 4800, buildingSqft: 2900, stories: 2, status: "Approved", approvedDate: "2026-04-21", estValue: 690_000, pricePerSqft: 185, description: "Duplex within Ybor City's historic grid." },

  // ── Miami, FL ───────────────────────────────────────────────
  { id: "mia-1", name: "Little Haiti Townhomes", developer: "Biscayne Build", city: "Miami", state: "FL", lat: 25.8370, lng: -80.1918, productType: "Townhomes", units: 6, landSqft: 9400, buildingSqft: 9000, stories: 3, status: "Permitted", approvedDate: "2026-01-26", estValue: 3_240_000, pricePerSqft: 230, description: "Six-unit townhome row in an appreciating corridor." },
  { id: "mia-2", name: "Allapattah Small Multi", developer: "Biscayne Build", city: "Miami", state: "FL", lat: 25.8150, lng: -80.2270, productType: "Small multi", units: 8, landSqft: 12500, buildingSqft: 9800, stories: 3, status: "Approved", approvedDate: "2026-03-15", estValue: 3_520_000, pricePerSqft: 225, description: "Eight-unit infill near the Health District." },

  // ── Charlotte, NC ───────────────────────────────────────────
  { id: "clt-1", name: "NoDa Fourplex", developer: "Queen City Homes", city: "Charlotte", state: "NC", lat: 35.2487, lng: -80.8127, productType: "Fourplex", units: 4, landSqft: 6900, buildingSqft: 5000, stories: 3, status: "Under construction", approvedDate: "2025-11-19", estValue: 1_360_000, pricePerSqft: 205, description: "Fourplex in the North Davidson arts district." },
  { id: "clt-2", name: "Plaza Midwood Duplex", developer: "Queen City Homes", city: "Charlotte", state: "NC", lat: 35.2196, lng: -80.8050, productType: "Duplex", units: 2, landSqft: 5300, buildingSqft: 3200, stories: 2, status: "Permitted", approvedDate: "2026-02-27", estValue: 840_000, pricePerSqft: 200, description: "Duplex on a sought-after Plaza Midwood street." },

  // ── Raleigh, NC ─────────────────────────────────────────────
  { id: "rdu-1", name: "Five Points Infill", developer: "Triangle Build Co.", city: "Raleigh", state: "NC", lat: 35.8030, lng: -78.6390, productType: "Infill", units: 1, landSqft: 4300, buildingSqft: 2800, stories: 2, status: "Completed", approvedDate: "2025-07-14", estValue: 720_000, pricePerSqft: 205, description: "Single infill home in the Five Points area." },
  { id: "rdu-2", name: "Downtown Raleigh Quads", developer: "Triangle Build Co.", city: "Raleigh", state: "NC", lat: 35.7740, lng: -78.6420, productType: "Fourplex", units: 4, landSqft: 6700, buildingSqft: 5100, stories: 3, status: "Approved", approvedDate: "2026-04-05", estValue: 1_300_000, pricePerSqft: 210, description: "Fourplex within walking distance of downtown." },

  // ── Seattle, WA ─────────────────────────────────────────────
  { id: "sea-1", name: "Ballard Townhomes", developer: "Cascade Vertical", city: "Seattle", state: "WA", lat: 47.6685, lng: -122.3830, productType: "Townhomes", units: 6, landSqft: 8800, buildingSqft: 9400, stories: 3, status: "Under construction", approvedDate: "2025-10-30", estValue: 4_320_000, pricePerSqft: 275, description: "Six skinny townhomes in Ballard." },
  { id: "sea-2", name: "Beacon Hill DADU Pair", developer: "Emerald Infill", city: "Seattle", state: "WA", lat: 47.5790, lng: -122.3110, productType: "Duplex", units: 2, landSqft: 5200, buildingSqft: 3600, stories: 2, status: "Permitted", approvedDate: "2026-01-22", estValue: 1_280_000, pricePerSqft: 280, description: "House plus DADU on a Beacon Hill lot." },

  // ── Portland, OR ────────────────────────────────────────────
  { id: "pdx-1", name: "Alberta Fourplex", developer: "Rose City Build", city: "Portland", state: "OR", lat: 45.5590, lng: -122.6480, productType: "Fourplex", units: 4, landSqft: 6400, buildingSqft: 4900, stories: 3, status: "Approved", approvedDate: "2026-03-19", estValue: 1_560_000, pricePerSqft: 255, description: "Fourplex under Portland's middle-housing rules." },
  { id: "pdx-2", name: "Division St Cottage Cluster", developer: "Rose City Build", city: "Portland", state: "OR", lat: 45.5048, lng: -122.6310, productType: "Small multi", units: 5, landSqft: 9200, buildingSqft: 5800, stories: 2, status: "Permitted", approvedDate: "2026-02-11", estValue: 2_100_000, pricePerSqft: 250, description: "Five detached cottages around a shared green." },

  // ── Columbus, OH ────────────────────────────────────────────
  { id: "cmh-1", name: "Italian Village Duplex", developer: "Buckeye Build", city: "Columbus", state: "OH", lat: 39.9810, lng: -82.9970, productType: "Duplex", units: 2, landSqft: 5000, buildingSqft: 3100, stories: 2, status: "Under construction", approvedDate: "2025-12-14", estValue: 690_000, pricePerSqft: 175, description: "Duplex in the Italian Village historic district." },
  { id: "cmh-2", name: "Franklinton Fourplex", developer: "Buckeye Build", city: "Columbus", state: "OH", lat: 39.9580, lng: -83.0290, productType: "Fourplex", units: 4, landSqft: 7200, buildingSqft: 5000, stories: 2, status: "Approved", approvedDate: "2026-04-12", estValue: 980_000, pricePerSqft: 170, description: "Fourplex in the fast-changing Franklinton arts area." },

  // ── Salt Lake City, UT ──────────────────────────────────────
  { id: "slc-1", name: "Sugar House Townhomes", developer: "Wasatch Homes", city: "Salt Lake City", state: "UT", lat: 40.7240, lng: -111.8580, productType: "Townhomes", units: 5, landSqft: 8000, buildingSqft: 7400, stories: 3, status: "Permitted", approvedDate: "2026-01-08", estValue: 2_350_000, pricePerSqft: 220, description: "Five townhomes in the Sugar House district." },
  { id: "slc-2", name: "Central 9th Infill", developer: "Wasatch Homes", city: "Salt Lake City", state: "UT", lat: 40.7470, lng: -111.8930, productType: "Infill", units: 1, landSqft: 4100, buildingSqft: 2600, stories: 2, status: "Approved", approvedDate: "2026-03-23", estValue: 690_000, pricePerSqft: 215, description: "Single infill home in the Central 9th node." },

  // ── Boise, ID ───────────────────────────────────────────────
  { id: "boi-1", name: "North End Duplex", developer: "Treasure Valley Build", city: "Boise", state: "ID", lat: 43.6280, lng: -116.2050, productType: "Duplex", units: 2, landSqft: 5400, buildingSqft: 3200, stories: 2, status: "Under construction", approvedDate: "2025-11-28", estValue: 740_000, pricePerSqft: 195, description: "Duplex in Boise's desirable North End." },
  { id: "boi-2", name: "Lusk District Fourplex", developer: "Treasure Valley Build", city: "Boise", state: "ID", lat: 43.6010, lng: -116.2080, productType: "Fourplex", units: 4, landSqft: 6600, buildingSqft: 4800, stories: 3, status: "Approved", approvedDate: "2026-04-15", estValue: 1_240_000, pricePerSqft: 200, description: "Student-adjacent fourplex near BSU." },

  // ── Las Vegas, NV ───────────────────────────────────────────
  { id: "las-1", name: "Arts District Small Multi", developer: "Mojave Vertical", city: "Las Vegas", state: "NV", lat: 36.1560, lng: -115.1530, productType: "Small multi", units: 6, landSqft: 10200, buildingSqft: 7800, stories: 3, status: "Permitted", approvedDate: "2026-02-05", estValue: 2_040_000, pricePerSqft: 185, description: "Six-unit build in the 18b Arts District." },
  { id: "las-2", name: "Huntridge Duplex", developer: "Mojave Vertical", city: "Las Vegas", state: "NV", lat: 36.1480, lng: -115.1340, productType: "Duplex", units: 2, landSqft: 5100, buildingSqft: 3000, stories: 2, status: "Approved", approvedDate: "2026-03-28", estValue: 650_000, pricePerSqft: 180, description: "Duplex in the historic Huntridge neighborhood." },
];

export interface DevStats {
  count: number;
  totalUnits: number;
  totalValue: number;
}

export function summarize(items: Development[]): DevStats {
  return items.reduce<DevStats>(
    (acc, d) => ({
      count: acc.count + 1,
      totalUnits: acc.totalUnits + d.units,
      totalValue: acc.totalValue + d.estValue,
    }),
    { count: 0, totalUnits: 0, totalValue: 0 },
  );
}
