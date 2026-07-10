/**
 * Zoning X-ray: address → district → what the bylaw actually allows.
 *
 * Three honesty tiers, clearly labeled in the UI:
 *  1. WIRED cities — the zone comes live from the city's own public records
 *     (address-matched open-data table first, GIS point query second), and the
 *     rules table is hand-verified against the published code (source per zone).
 *  2. RULES-ONLY cities — the user picks/confirms the zone; verified rules apply.
 *  3. EVERYWHERE ELSE — manual mode: the user types the numbers from their
 *     city's code (we link it) and Pencil computes the envelope. Accurate by
 *     construction.
 * Never a guessed regulation: anything not verified simply isn't shown.
 */

export interface ZoneRules {
  code: string;
  name: string;
  /** What housing the district allows. */
  uses: string;
  /** Max dwelling units per lot (post-reform where applicable). */
  maxUnits?: number;
  /** Minimum lot area per unit (sf) — units = floor(lot / this), capped by maxUnits. */
  minLotPerUnitSqft?: number;
  /** Floor-area ratio (total buildable = FAR × lot). */
  far?: number;
  /** Max impervious/building coverage as a fraction of the lot. */
  coverage?: number;
  /** Typical max stories used with coverage to bound buildable area. */
  stories?: number;
  heightFt?: number;
  setbacks?: { front: string; side: string; rear: string };
  /** Numeric setbacks (ft) — only where the code's values are plain numbers;
   * powers the buildable-footprint bound when lot width/depth are known. */
  setbackFt?: { front: number; side: number; rear: number };
  /** Where these numbers come from — shown in the UI. */
  source: string;
  notes?: string;
}

export interface CityZoning {
  state: string;
  /** Socrata "zoning by address" dataset — address-matched, most precise. */
  socrataZoning?: string;
  /** ArcGIS server root that hosts the zoning polygons (layer self-discovered). */
  gisServer?: string;
  /** Link to the official code for verification / manual mode. */
  codeUrl: string;
  codeName: string;
  /** Special case: the city has no zoning at all. */
  noZoning?: string;
  zones?: ZoneRules[];
}

export const CITY_ZONING: Record<string, CityZoning> = {
  Austin: {
    state: "TX",
    // City of Austin "Zoning by Address" open dataset (same portal as our live
    // Austin permits feed) — address-matched zoning straight from the city.
    socrataZoning: "https://data.austintexas.gov/resource/nbzi-qabm.json",
    // District polygons live in ZoningProfile (layer "Zoning") — NOT Shared/Zoning_2,
    // which holds overlay layers only.
    gisServer: "https://maps.austintexas.gov/arcgis/rest/services/ZoningProfile/ZoningProfile/MapServer",
    codeUrl: "https://library.municode.com/tx/austin/codes/land_development_code?nodeId=TIT25LADE_CH25-2ZO_SUBCHAPTER_CUSDERE_ART2PRUSDERE_DIV1RETA_S25-2-492SIDERE",
    codeName: "Austin LDC § 25-2-492 + HOME amendments (2023–24)",
    zones: [
      {
        code: "SF-1", name: "Single-Family (Large Lot)", uses: "Single-family; up to 3 units under HOME",
        maxUnits: 3, minLotPerUnitSqft: 1800, coverage: 0.4, stories: 2, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492; HOME Phase 1–2",
        notes: "HOME Phase 2 (2024) allows lots as small as ~1,800 sf per unit — verify current status with the city.",
      },
      {
        code: "SF-2", name: "Single-Family (Standard Lot)", uses: "Single-family; up to 3 units under HOME",
        maxUnits: 3, minLotPerUnitSqft: 1800, coverage: 0.4, stories: 2, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492; HOME Phase 1–2",
      },
      {
        code: "SF-3", name: "Family Residence", uses: "Single-family, duplex; up to 3 units under HOME",
        maxUnits: 3, minLotPerUnitSqft: 1800, coverage: 0.45, stories: 2, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492; HOME Phase 1–2",
      },
      {
        code: "SF-6", name: "Townhouse & Condominium", uses: "Townhomes, condos, small multifamily",
        minLotPerUnitSqft: 1600, coverage: 0.4, stories: 3, heightFt: 35,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492",
      },
      {
        code: "MF-3", name: "Multifamily (Medium Density)", uses: "Apartments / condos",
        minLotPerUnitSqft: 1000, coverage: 0.55, stories: 3, heightFt: 40,
        setbacks: { front: "25 ft", side: "5 ft", rear: "10 ft" },
        setbackFt: { front: 25, side: 5, rear: 10 },
        source: "LDC § 25-2-492",
      },
    ],
  },
  Chicago: {
    state: "IL",
    codeUrl: "https://secondcityzoning.org/zoning_rules/",
    codeName: "Chicago Zoning Ordinance § 17-2 (residential district tables)",
    zones: [
      { code: "RS-1", name: "Residential Single-Unit", uses: "Single-family", maxUnits: 1, minLotPerUnitSqft: 6250, far: 0.5, heightFt: 30, setbacks: { front: "20 ft (or block average)", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RS-2", name: "Residential Single-Unit", uses: "Single-family", maxUnits: 1, minLotPerUnitSqft: 5000, far: 0.65, heightFt: 30, setbacks: { front: "20 ft (or block average)", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RS-3", name: "Residential Single-Unit (2-flat eligible)", uses: "Single-family; 2-flat on qualifying lots", minLotPerUnitSqft: 2500, far: 0.9, heightFt: 30, setbacks: { front: "20 ft (or block average)", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RT-3.5", name: "Residential Two-Flat/Townhouse", uses: "2-flats, townhouses", minLotPerUnitSqft: 1250, far: 1.05, heightFt: 35, setbacks: { front: "block average", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RT-4", name: "Residential Two-Flat/Townhouse/Multi", uses: "2-flats, townhouses, small multifamily", minLotPerUnitSqft: 1000, far: 1.2, heightFt: 38, setbacks: { front: "block average", side: "combined ≥ 20% of lot width", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RM-4.5", name: "Residential Multi-Unit", uses: "Multifamily", minLotPerUnitSqft: 700, far: 1.7, heightFt: 45, setbacks: { front: "block average", side: "per code", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
      { code: "RM-5", name: "Residential Multi-Unit", uses: "Multifamily", minLotPerUnitSqft: 400, far: 2.0, heightFt: 45, setbacks: { front: "block average", side: "per code", rear: "28% of lot depth" }, source: "§ 17-2-0300 tables" },
    ],
  },
  Houston: {
    state: "TX",
    codeUrl: "https://www.houstontx.gov/planning/DevelopRegs/",
    codeName: "Houston Ch. 42 development regulations",
    noZoning:
      "Houston has NO zoning code — use is governed by private deed restrictions plus Chapter 42 development rules (typical minimum lot: 3,500 sf inside Loop 610 / 5,000 sf outside; setbacks depend on street class). Check the deed restrictions for the specific lot.",
  },
};

/** ArcGIS layer self-discovery + point query, reusing the permits pattern. */
async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function zoneAtPoint(gisServer: string, lat: number, lng: number): Promise<string | null> {
  try {
    const meta = (await getJson(`${gisServer}?f=json`)) as { layers?: { id: number; name: string }[] };
    // Exact "Zoning" layer first, then a conservative name match. Never fall
    // back to an arbitrary layer — a wrong layer means a wrong answer.
    const layer =
      meta.layers?.find((l) => l.name.trim().toLowerCase() === "zoning") ??
      meta.layers?.find((l) => /zoning(?!.*(case|pending|overlay|historic|profile))/i.test(l.name));
    if (!layer) return null;
    const q = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "*",
      returnGeometry: "false",
      f: "json",
    });
    const data = (await getJson(`${gisServer}/${layer.id}/query?${q}`)) as {
      features?: { attributes?: Record<string, unknown> }[];
    };
    const attrs = data.features?.[0]?.attributes;
    if (!attrs) return null;
    return pickZoneValue(attrs);
  } catch {
    return null;
  }
}

/**
 * Find the zone code in a record without hardcoding a schema: a zoning-named
 * key (excluding case numbers, ordinances, dates, ids) whose value looks like
 * a district code. Returns null rather than guess.
 */
function pickZoneValue(rec: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(rec)) {
    if (!/^(zoning|zone|ztype|base_?zone|zone_?class|district)/i.test(k)) continue;
    if (/case|ordinance|date|_id$|url|link|desc/i.test(k)) continue;
    if (typeof v === "string" && v.trim() && v.trim().length <= 20 && !/\d{4}/.test(v)) return v.trim();
  }
  return null;
}

/**
 * Address-matched zone from a city's own "zoning by address" open dataset
 * (Socrata full-text search — schema-agnostic, so a portal-side rename
 * degrades to null instead of a wrong answer).
 */
/** House number + street name, suffix dropped ("Ln" vs "LANE") and ordinals
 * bared ("5th" → "5", matching how assessor tables store numbered streets). */
function streetQuery(streetAddress: string): string {
  const m = streetAddress.trim().match(
    /^(\d+[A-Za-z]?)\s+([A-Za-z0-9'. -]+?)(?:\s+(?:st|street|ave|avenue|blvd|boulevard|dr|drive|ln|lane|rd|road|ct|court|cir|circle|way|pl|place|trl|trail|pkwy|parkway|cv|cove|loop|bnd|bend|pass|path|run|holw|hollow|ter|terrace|hwy|highway|expy|expressway))?\.?\s*$/i,
  );
  const q = m ? `${m[1]} ${m[2]}` : streetAddress.trim();
  return q.replace(/(\d+)(?:st|nd|rd|th)\b/gi, "$1");
}

export async function zoneAtAddress(datasetUrl: string, streetAddress: string): Promise<string | null> {
  try {
    const q = streetQuery(streetAddress);
    const res = await fetch(`${datasetUrl}?$q=${encodeURIComponent(q)}&$limit=8`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
      const zone = pickZoneValue(row);
      if (zone) return zone;
    }
    return null;
  } catch {
    return null;
  }
}

/** Match a raw GIS zone string ("SF-3-NP") to a rules entry by prefix. */
export function matchZoneRules(city: CityZoning, rawZone: string): ZoneRules | null {
  const z = rawZone.toUpperCase();
  return city.zones?.find((r) => z === r.code || z.startsWith(`${r.code}-`)) ?? null;
}

export interface ParcelInfo {
  /** Deeded/recorded lot area straight from the city or county parcel table. */
  lotSqft?: number;
  /** Zoning district recorded on the parcel (e.g. NYC PLUTO ZoneDist1). */
  zone?: string;
  /** Max residential FAR recorded on the parcel (NYC PLUTO ResidFAR). */
  residFar?: number;
  /** Recorded lot frontage / depth in feet (NYC PLUTO LotFront/LotDepth). */
  lotFront?: number;
  lotDepth?: number;
  /** Where the numbers come from — shown in the UI. */
  source: string;
}

interface ParcelSource {
  match: (city: string, state: string) => boolean;
  /** Socrata resource URL. */
  url: string;
  source: string;
  /** Known-schema field names; omitted → strict schema-agnostic probing. */
  fields?: { lot: string; zone?: string; residFar?: string; front?: string; depth?: string; address: string };
}

const PARCEL_SOURCES: ParcelSource[] = [
  {
    // NYC PLUTO — the Dept. of City Planning's canonical tax-lot table.
    // Fields per the published PLUTO data dictionary.
    match: (c, s) => s === "NY" && /^(new york|manhattan|brooklyn|the bronx|bronx|queens|staten island)$/i.test(c),
    url: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
    source: "NYC PLUTO (Dept. of City Planning)",
    fields: { lot: "lotarea", zone: "zonedist1", residFar: "residfar", front: "lotfront", depth: "lotdepth", address: "address" },
  },
  {
    // Cook County Assessor parcel universe — schema probed, never guessed.
    match: (c, s) => s === "IL" && /^chicago$/i.test(c),
    url: "https://datacatalog.cookcountyil.gov/resource/nj4t-kc8j.json",
    source: "Cook County Assessor parcel records",
  },
];

const num = (x: unknown): number | undefined => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Sane recorded-lot-area range: rejects flags, codes, and valuation fields. */
const saneLot = (n: number | undefined): number | undefined =>
  n != null && n >= 200 && n <= 2_000_000 ? Math.round(n) : undefined;

/** Sane lot frontage/depth in feet. */
const saneDim = (n: number | undefined): number | undefined =>
  n != null && n >= 10 && n <= 2_000 ? Math.round(n) : undefined;

/**
 * Look the address up in the city/county's own parcel table: recorded lot
 * area, and where the table carries them, the zoning district and max
 * residential FAR. Requires a house-number match — no match, no guess.
 */
export async function parcelAtAddress(city: string, state: string, streetAddress: string): Promise<ParcelInfo | null> {
  const src = PARCEL_SOURCES.find((s) => s.match(city, state));
  if (!src) return null;
  try {
    const q = streetQuery(streetAddress);
    const res = await fetch(`${src.url}?$q=${encodeURIComponent(q)}&$limit=10`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || !rows.length) return null;
    const houseNo = q.split(/\s+/)[0].toUpperCase();
    const addressKeyOf = (row: Record<string, unknown>) =>
      src.fields?.address ?? Object.keys(row).find((k) => /address/i.test(k) && typeof row[k] === "string");
    const pick = rows.find((r) => {
      const ak = addressKeyOf(r);
      return ak && typeof r[ak] === "string" && (r[ak] as string).trim().toUpperCase().startsWith(houseNo + " ");
    });
    if (!pick) return null;
    let lotSqft: number | undefined;
    let zone: string | undefined;
    let residFar: number | undefined;
    let lotFront: number | undefined;
    let lotDepth: number | undefined;
    if (src.fields) {
      lotSqft = saneLot(num(pick[src.fields.lot]));
      if (src.fields.zone) {
        const z = pick[src.fields.zone];
        if (typeof z === "string" && z.trim()) zone = z.trim();
      }
      if (src.fields.residFar) residFar = num(pick[src.fields.residFar]);
      if (src.fields.front) lotFront = saneDim(num(pick[src.fields.front]));
      if (src.fields.depth) lotDepth = saneDim(num(pick[src.fields.depth]));
    } else {
      for (const [k, v] of Object.entries(pick)) {
        if (/(^|_)(land|lot)_?(sq_?ft|sf|size|area)/i.test(k) && !/val|price|tax|assess|code|flag/i.test(k)) {
          const n = saneLot(num(v));
          if (n) { lotSqft = n; break; }
        }
      }
      zone = pickZoneValue(pick) ?? undefined;
    }
    if (lotSqft == null && !zone && residFar == null) return null;
    return { lotSqft, zone, residFar, lotFront, lotDepth, source: src.source };
  } catch {
    return null;
  }
}

export interface Envelope {
  units: number | null;
  buildableSqft: number | null;
  binding: string;
  /** Ground-floor footprint after setbacks (sf) — when width/depth are known. */
  footprintSqft: number | null;
}

/** What the numbers allow on a given lot — every assumption named. */
export function envelope(
  lotSqft: number,
  r: {
    far?: number; coverage?: number; stories?: number; maxUnits?: number; minLotPerUnitSqft?: number;
    setbackFt?: { front: number; side: number; rear: number };
  },
  dims?: { widthFt?: number; depthFt?: number },
): Envelope {
  if (!lotSqft || lotSqft <= 0) return { units: null, buildableSqft: null, binding: "", footprintSqft: null };
  const byFar = r.far ? r.far * lotSqft : Infinity;
  const byCoverage = r.coverage && r.stories ? r.coverage * lotSqft * r.stories : Infinity;
  // Setback footprint: what's left of the lot rectangle after the required
  // front/side/rear yards, times the allowed stories.
  let footprint: number | null = null;
  let byFootprint = Infinity;
  if (r.setbackFt && dims?.widthFt && dims?.depthFt && dims.widthFt > 0 && dims.depthFt > 0) {
    const w = Math.max(0, dims.widthFt - 2 * r.setbackFt.side);
    const d = Math.max(0, dims.depthFt - r.setbackFt.front - r.setbackFt.rear);
    footprint = Math.round(w * d);
    if (r.stories) byFootprint = footprint * r.stories;
  }
  const buildable = Math.min(byFar, byCoverage, byFootprint);
  const binding =
    buildable === Infinity ? ""
    : buildable === byFootprint ? "setback footprint × stories"
    : byFar <= byCoverage ? "FAR"
    : "coverage × stories";
  let units: number | null = null;
  if (r.minLotPerUnitSqft) units = Math.max(1, Math.floor(lotSqft / r.minLotPerUnitSqft));
  if (r.maxUnits != null) units = units == null ? r.maxUnits : Math.min(units, r.maxUnits);
  return {
    units,
    buildableSqft: buildable === Infinity ? null : Math.round(buildable),
    binding,
    footprintSqft: footprint,
  };
}
