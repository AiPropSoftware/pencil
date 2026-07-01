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

export interface MetroCenter {
  lat: number;
  lng: number;
  state: string;
  ppsf: number; // headline new-construction $/sqft for the metro
}

export const METRO_CENTERS: Record<string, MetroCenter> = {
  Austin: { lat: 30.27, lng: -97.74, state: "TX", ppsf: 470 },
  Dallas: { lat: 32.78, lng: -96.80, state: "TX", ppsf: 360 },
  Houston: { lat: 29.76, lng: -95.37, state: "TX", ppsf: 320 },
  Phoenix: { lat: 33.45, lng: -112.07, state: "AZ", ppsf: 360 },
  Denver: { lat: 39.74, lng: -104.99, state: "CO", ppsf: 520 },
  Nashville: { lat: 36.16, lng: -86.78, state: "TN", ppsf: 420 },
  Atlanta: { lat: 33.75, lng: -84.39, state: "GA", ppsf: 360 },
  Tampa: { lat: 27.95, lng: -82.46, state: "FL", ppsf: 360 },
  Miami: { lat: 25.76, lng: -80.19, state: "FL", ppsf: 800 },
  Charlotte: { lat: 35.23, lng: -80.84, state: "NC", ppsf: 360 },
  Raleigh: { lat: 35.78, lng: -78.64, state: "NC", ppsf: 360 },
  Seattle: { lat: 47.61, lng: -122.33, state: "WA", ppsf: 720 },
  Portland: { lat: 45.51, lng: -122.68, state: "OR", ppsf: 560 },
  Columbus: { lat: 39.96, lng: -82.99, state: "OH", ppsf: 300 },
  "Salt Lake City": { lat: 40.76, lng: -111.89, state: "UT", ppsf: 470 },
  Boise: { lat: 43.62, lng: -116.20, state: "ID", ppsf: 380 },
  "Las Vegas": { lat: 36.17, lng: -115.14, state: "NV", ppsf: 340 },

  // ── Nationwide coverage ──────────────────────────────────────────────────
  "San Francisco": { lat: 37.77, lng: -122.42, state: "CA", ppsf: 950 },
  "San Jose": { lat: 37.34, lng: -121.89, state: "CA", ppsf: 800 },
  Oakland: { lat: 37.80, lng: -122.27, state: "CA", ppsf: 720 },
  Sacramento: { lat: 38.58, lng: -121.49, state: "CA", ppsf: 480 },
  "Los Angeles": { lat: 34.05, lng: -118.24, state: "CA", ppsf: 720 },
  "San Diego": { lat: 32.72, lng: -117.16, state: "CA", ppsf: 700 },
  "Long Beach": { lat: 33.77, lng: -118.19, state: "CA", ppsf: 650 },
  Irvine: { lat: 33.68, lng: -117.83, state: "CA", ppsf: 700 },
  Riverside: { lat: 33.95, lng: -117.40, state: "CA", ppsf: 400 },
  Fresno: { lat: 36.74, lng: -119.79, state: "CA", ppsf: 340 },
  Bakersfield: { lat: 35.37, lng: -119.02, state: "CA", ppsf: 300 },
  Honolulu: { lat: 21.31, lng: -157.86, state: "HI", ppsf: 800 },
  Anchorage: { lat: 61.22, lng: -149.90, state: "AK", ppsf: 320 },
  Spokane: { lat: 47.66, lng: -117.43, state: "WA", ppsf: 320 },
  Tacoma: { lat: 47.25, lng: -122.44, state: "WA", ppsf: 380 },
  Salem: { lat: 44.94, lng: -123.04, state: "OR", ppsf: 360 },
  Eugene: { lat: 44.05, lng: -123.09, state: "OR", ppsf: 360 },
  Reno: { lat: 39.53, lng: -119.81, state: "NV", ppsf: 400 },
  "Colorado Springs": { lat: 38.83, lng: -104.82, state: "CO", ppsf: 340 },
  "Fort Collins": { lat: 40.59, lng: -105.08, state: "CO", ppsf: 380 },
  Boulder: { lat: 40.01, lng: -105.27, state: "CO", ppsf: 600 },
  Albuquerque: { lat: 35.08, lng: -106.65, state: "NM", ppsf: 280 },
  "Santa Fe": { lat: 35.69, lng: -105.94, state: "NM", ppsf: 420 },
  Tucson: { lat: 32.22, lng: -110.97, state: "AZ", ppsf: 290 },
  Mesa: { lat: 33.42, lng: -111.83, state: "AZ", ppsf: 320 },
  Scottsdale: { lat: 33.49, lng: -111.92, state: "AZ", ppsf: 500 },
  Provo: { lat: 40.23, lng: -111.66, state: "UT", ppsf: 320 },
  Bozeman: { lat: 45.68, lng: -111.04, state: "MT", ppsf: 480 },
  Billings: { lat: 45.78, lng: -108.50, state: "MT", ppsf: 300 },
  Cheyenne: { lat: 41.14, lng: -104.82, state: "WY", ppsf: 300 },
  "San Antonio": { lat: 29.42, lng: -98.49, state: "TX", ppsf: 260 },
  "Fort Worth": { lat: 32.75, lng: -97.33, state: "TX", ppsf: 300 },
  "El Paso": { lat: 31.76, lng: -106.49, state: "TX", ppsf: 220 },
  Plano: { lat: 33.02, lng: -96.70, state: "TX", ppsf: 350 },
  "Corpus Christi": { lat: 27.80, lng: -97.40, state: "TX", ppsf: 240 },
  "Oklahoma City": { lat: 35.47, lng: -97.52, state: "OK", ppsf: 230 },
  Tulsa: { lat: 36.15, lng: -95.99, state: "OK", ppsf: 230 },
  "Little Rock": { lat: 34.75, lng: -92.29, state: "AR", ppsf: 220 },
  "New Orleans": { lat: 29.95, lng: -90.07, state: "LA", ppsf: 300 },
  "Baton Rouge": { lat: 30.45, lng: -91.19, state: "LA", ppsf: 240 },
  Chicago: { lat: 41.88, lng: -87.63, state: "IL", ppsf: 400 },
  Indianapolis: { lat: 39.77, lng: -86.16, state: "IN", ppsf: 240 },
  Detroit: { lat: 42.33, lng: -83.05, state: "MI", ppsf: 260 },
  "Grand Rapids": { lat: 42.96, lng: -85.67, state: "MI", ppsf: 280 },
  Milwaukee: { lat: 43.04, lng: -87.91, state: "WI", ppsf: 300 },
  Madison: { lat: 43.07, lng: -89.40, state: "WI", ppsf: 340 },
  Minneapolis: { lat: 44.98, lng: -93.27, state: "MN", ppsf: 380 },
  "St. Paul": { lat: 44.95, lng: -93.09, state: "MN", ppsf: 340 },
  "Kansas City": { lat: 39.10, lng: -94.58, state: "MO", ppsf: 280 },
  "St. Louis": { lat: 38.63, lng: -90.20, state: "MO", ppsf: 260 },
  Omaha: { lat: 41.26, lng: -95.93, state: "NE", ppsf: 260 },
  "Des Moines": { lat: 41.59, lng: -93.62, state: "IA", ppsf: 250 },
  Wichita: { lat: 37.69, lng: -97.34, state: "KS", ppsf: 210 },
  Cleveland: { lat: 41.50, lng: -81.69, state: "OH", ppsf: 240 },
  Cincinnati: { lat: 39.10, lng: -84.51, state: "OH", ppsf: 260 },
  "Sioux Falls": { lat: 43.55, lng: -96.73, state: "SD", ppsf: 250 },
  Fargo: { lat: 46.88, lng: -96.79, state: "ND", ppsf: 250 },
  Orlando: { lat: 28.54, lng: -81.38, state: "FL", ppsf: 340 },
  Jacksonville: { lat: 30.33, lng: -81.66, state: "FL", ppsf: 300 },
  "Fort Lauderdale": { lat: 26.12, lng: -80.14, state: "FL", ppsf: 520 },
  "West Palm Beach": { lat: 26.71, lng: -80.05, state: "FL", ppsf: 480 },
  Naples: { lat: 26.14, lng: -81.79, state: "FL", ppsf: 700 },
  Sarasota: { lat: 27.34, lng: -82.53, state: "FL", ppsf: 450 },
  Savannah: { lat: 32.08, lng: -81.09, state: "GA", ppsf: 320 },
  Birmingham: { lat: 33.52, lng: -86.81, state: "AL", ppsf: 240 },
  Huntsville: { lat: 34.73, lng: -86.59, state: "AL", ppsf: 260 },
  Jackson: { lat: 32.30, lng: -90.18, state: "MS", ppsf: 210 },
  Memphis: { lat: 35.15, lng: -90.05, state: "TN", ppsf: 240 },
  Knoxville: { lat: 35.96, lng: -83.92, state: "TN", ppsf: 300 },
  Chattanooga: { lat: 35.05, lng: -85.31, state: "TN", ppsf: 280 },
  Louisville: { lat: 38.25, lng: -85.76, state: "KY", ppsf: 250 },
  Lexington: { lat: 38.04, lng: -84.50, state: "KY", ppsf: 260 },
  Columbia: { lat: 34.00, lng: -81.03, state: "SC", ppsf: 260 },
  Charleston: { lat: 32.78, lng: -79.93, state: "SC", ppsf: 420 },
  Greenville: { lat: 34.85, lng: -82.39, state: "SC", ppsf: 300 },
  Asheville: { lat: 35.60, lng: -82.55, state: "NC", ppsf: 400 },
  Greensboro: { lat: 36.07, lng: -79.79, state: "NC", ppsf: 260 },
  Durham: { lat: 35.99, lng: -78.90, state: "NC", ppsf: 320 },
  Richmond: { lat: 37.54, lng: -77.44, state: "VA", ppsf: 320 },
  "Virginia Beach": { lat: 36.85, lng: -75.98, state: "VA", ppsf: 320 },
  "New York": { lat: 40.71, lng: -74.01, state: "NY", ppsf: 900 },
  Buffalo: { lat: 42.89, lng: -78.88, state: "NY", ppsf: 240 },
  Rochester: { lat: 43.16, lng: -77.61, state: "NY", ppsf: 240 },
  Albany: { lat: 42.65, lng: -73.75, state: "NY", ppsf: 280 },
  Boston: { lat: 42.36, lng: -71.06, state: "MA", ppsf: 750 },
  Worcester: { lat: 42.26, lng: -71.80, state: "MA", ppsf: 380 },
  Providence: { lat: 41.82, lng: -71.41, state: "RI", ppsf: 400 },
  Hartford: { lat: 41.76, lng: -72.69, state: "CT", ppsf: 320 },
  Stamford: { lat: 41.05, lng: -73.54, state: "CT", ppsf: 600 },
  Newark: { lat: 40.74, lng: -74.17, state: "NJ", ppsf: 400 },
  "Jersey City": { lat: 40.72, lng: -74.05, state: "NJ", ppsf: 700 },
  Philadelphia: { lat: 39.95, lng: -75.17, state: "PA", ppsf: 300 },
  Pittsburgh: { lat: 40.44, lng: -79.99, state: "PA", ppsf: 240 },
  Baltimore: { lat: 39.29, lng: -76.61, state: "MD", ppsf: 300 },
  Washington: { lat: 38.90, lng: -77.04, state: "DC", ppsf: 720 },
  Wilmington: { lat: 39.74, lng: -75.55, state: "DE", ppsf: 300 },
  Manchester: { lat: 42.99, lng: -71.45, state: "NH", ppsf: 360 },
  Burlington: { lat: 44.48, lng: -73.21, state: "VT", ppsf: 420 },
};

const CURATED: Development[] = [
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

/** Curated projects plus generated density around each metro (for clustering). */
export const developments: Development[] = [...CURATED, ...generateExtra()];

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

// ───────────────────────────────────────────────────────────────────────────
// Enrichment — modeled from the base record until live ATTOM/Shovels/MLS feeds
// are wired. Every derived field is deterministic (no randomness) so the demo
// is stable, and clearly labeled "modeled" in the UI.
// ───────────────────────────────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export type ListingStatus = "Listed for sale" | "Recently sold" | "Under construction" | "Pre-construction";

export interface ListingInfo {
  status: ListingStatus;
  listPrice?: number;
  daysOnMarket?: number;
  soldDate?: string;
  soldPrice?: number;
  zillowUrl?: string;
}

/** Derive listing / sale state from build status. */
export function listingInfo(d: Development): ListingInfo {
  const h = hashId(d.id);
  if (d.status === "Completed") {
    if (h % 2 === 0) {
      return {
        status: "Listed for sale",
        listPrice: Math.round((d.estValue * 1.02) / 1000) * 1000,
        daysOnMarket: 8 + (h % 80),
        zillowUrl: `https://www.zillow.com/homes/${encodeURIComponent(`${d.city} ${d.state}`)}_rb/`,
      };
    }
    return { status: "Recently sold", soldDate: addMonths(d.approvedDate, 9), soldPrice: d.estValue };
  }
  if (d.status === "Under construction") return { status: "Under construction" };
  return { status: "Pre-construction" };
}

export interface PermitTimeline {
  filed: string;
  approved: string;
  issued: string | null;
  targetCompletion: string;
}

export function permitTimeline(d: Development): PermitTimeline {
  const issued =
    d.status === "Permitted" || d.status === "Under construction" || d.status === "Completed"
      ? addDays(d.approvedDate, 28)
      : null;
  return {
    filed: addDays(d.approvedDate, -55),
    approved: d.approvedDate,
    issued,
    targetCompletion: addMonths(d.approvedDate, 10),
  };
}

const ARCHITECTS = [
  "Studio Vela", "Form & Field Architecture", "Northwood Design Studio",
  "Atelier Bram", "Cardinal Architecture", "Lume Studio",
  "Verge Architects", "Meridian Design Co.",
];

/** Architect of record (public on the permit application). */
export function architectFor(d: Development): string {
  return ARCHITECTS[hashId(d.id) % ARCHITECTS.length];
}

// ── Metro $/sqft trend (confidence series) ──────────────────────────────────
export const QUARTERS = [
  "Q3 '24", "Q4 '24", "Q1 '25", "Q2 '25", "Q3 '25", "Q4 '25", "Q1 '26", "Q2 '26",
];

export interface PpsfPoint {
  quarter: string;
  ppsf: number;
  low: number;
  high: number;
}

/** Rolling new-construction $/sqft by quarter with a confidence band. */
export function metroTrend(city: string): PpsfPoint[] {
  const base = METRO_CENTERS[city]?.ppsf ?? 350;
  return QUARTERS.map((quarter, i) => {
    const ppsf = Math.round(base * (0.8 + i * 0.029));
    return { quarter, ppsf, low: Math.round(ppsf * 0.87), high: Math.round(ppsf * 1.13) };
  });
}

export interface PpsfSummary {
  current: number;
  low: number;
  high: number;
  since: string;
}

export function ppsfSummary(city: string): PpsfSummary {
  const t = metroTrend(city);
  const cur = t[t.length - 1];
  const thresh = cur.ppsf * 0.92;
  const idx = t.findIndex((p) => p.ppsf >= thresh);
  return { current: cur.ppsf, low: cur.low, high: cur.high, since: QUARTERS[idx < 0 ? 0 : idx] };
}

// ── Renderings / photos ─────────────────────────────────────────────────────
// Representative architecture photos by product type (stable Unsplash CDN URLs).
// Live listing/render photos replace these from the MLS/Zillow feed once wired.
const IMAGE_POOL: Record<ProductType, string[]> = {
  SFH: [
    "1568605114967-8130f3a36994", "1564013799919-ab600027ffc6", "1570129477492-45c003edd2be",
  ],
  Infill: [
    "1512917774080-9991f1c4c750", "1605276374104-dee2a0ed3cd6", "1600585154340-be6161a56a0c",
  ],
  Duplex: [
    "1576941089067-2de3c901e126", "1580587771525-78b9dba3b914", "1600566753086-00f18fb6b3ea",
  ],
  Fourplex: [
    "1600596542815-ffad4c1539a9", "1600607687939-ce8a6c25118c", "1600047509807-ba8f99d2cdde",
  ],
  Townhomes: [
    "1580216643062-cf460548a66a", "1600585152220-90363fe7e115", "1605146769289-440113cc3d00",
  ],
  "Small multi": [
    "1545324418-cc1a3fa10c00", "1486406146926-c627a92ad1ab", "1493809842364-78817add7ffb",
  ],
};

/** Deterministic representative image URL for a development. */
export function imageFor(d: Development): string {
  const pool = IMAGE_POOL[d.productType];
  const id = pool[hashId(d.id) % pool.length];
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;
}

/** Guaranteed-load fallback if a photo 404s. */
export function imageFallback(d: Development): string {
  return `https://picsum.photos/seed/${encodeURIComponent(d.id)}/900/500`;
}

// ── Generated density around each metro (so clustering has volume) ───────────
function generateExtra(): Development[] {
  const STREETS = [
    "Magnolia", "Oakwood", "Cedar", "Birch", "Harborview", "Sunset", "Maple",
    "Ridgeline", "Lincoln", "Pearl", "Vista", "Juniper", "Highland", "Lakeshore", "Cypress",
    "Aspen", "Bluebird", "Chestnut", "Dogwood", "Elm", "Fairview", "Garnet", "Hawthorn",
    "Ironwood", "Jasmine", "Kingsley", "Larkspur", "Mulberry", "Nolan", "Orchard", "Poplar",
    "Quincy", "Redbud", "Sycamore", "Tamarack", "Union", "Verbena", "Wren", "Yarrow",
  ];
  const DEVS = [
    "Summit Build Group", "Anchor Residential", "Northstar Homes", "Keystone Developments",
    "Vanguard Build Co.", "Outpost Homes", "Trailhead Build", "Beacon Residential",
    "Ironclad Builders", "Harborline Homes", "Copper Ridge Dev", "Granite Peak Build",
    "Silverline Residential", "Maplewood Build Co.", "Redstone Homes", "Cornerstone Vertical",
  ];
  const UNITS_BY_TYPE: Record<ProductType, number> = {
    SFH: 1, Infill: 1, Duplex: 2, Fourplex: 4, Townhomes: 6, "Small multi": 6,
  };
  const SQFT_PER_UNIT: Record<ProductType, number> = {
    SFH: 2600, Infill: 2500, Duplex: 1500, Fourplex: 1250, Townhomes: 1450, "Small multi": 1300,
  };

  const out: Development[] = [];
  const cities = Object.keys(METRO_CENTERS);
  cities.forEach((city, ci) => {
    const m = METRO_CENTERS[city];
    const tierMult = m.ppsf >= 600 ? 1.5 : m.ppsf >= 450 ? 1.25 : 1.0;
    const buildPpsf = Math.round(180 + (m.ppsf >= 600 ? 60 : m.ppsf >= 450 ? 30 : 0));
    for (let i = 0; i < 16; i++) {
      const type = PRODUCT_TYPES[(ci * 3 + i) % PRODUCT_TYPES.length];
      const status = STATUSES[(i + ci) % STATUSES.length];
      const units = UNITS_BY_TYPE[type] + (type === "Townhomes" || type === "Small multi" ? i % 4 : 0);
      const buildingSqft = units * SQFT_PER_UNIT[type];
      const landSqft = Math.round(buildingSqft * 1.3);
      const estValue = Math.round((units * 260_000 * tierMult * (0.85 + ((i * 7) % 11) * 0.03)) / 1000) * 1000;
      const angle = ci * 2.4 + i * 0.77;
      const ring = 0.006 + ((i * 3) % 9) * 0.006;          // ~0.4–2.9 mi, tight
      const inland = m.lng < -98 ? 1 : -1;                 // push toward US interior
      const rawLng = Math.cos(angle) * ring;
      const lat = +(m.lat + Math.sin(angle) * ring).toFixed(4);
      const lng = +(m.lng + (Math.sign(rawLng) === inland ? rawLng : rawLng * -0.4)).toFixed(4);
      out.push({
        id: `gen-${ci}-${i}`,
        name: `${STREETS[(ci + i) % STREETS.length]} ${type}`,
        developer: DEVS[(ci + i) % DEVS.length],
        city,
        state: m.state,
        lat,
        lng,
        productType: type,
        units,
        landSqft,
        buildingSqft,
        stories: type === "SFH" || type === "Infill" ? 2 : 3,
        status,
        approvedDate: addMonths("2026-05-01", -((i + ci) % 16)),
        estValue,
        pricePerSqft: buildPpsf,
        description: `${type} ${status.toLowerCase()} project in ${city}.`,
      });
    }
  });
  return out;
}
