/**
 * "Our own Shovels" — live permit ingestion from city open-data portals
 * (Socrata), fetched directly from the browser (open CORS, no key).
 *
 * Every city names its columns differently, so the normalizer probes many
 * candidate field names and multiple coordinate encodings. Each city returns
 * a CityResult with diagnostics (row count, real column names, exact URL,
 * error) surfaced in the UI — that's the tuning loop: ship → read the chip →
 * tighten the mapping. A city that fails simply falls back to demo data.
 *
 * Coordinates come from the record itself (exact permit location) and are
 * sanity-checked against the city center so bad geocodes get dropped.
 */
import type { Development, ProductType, DevStatus } from "@/data/developments";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
};

const pick = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
};

/** Extract coordinates from the many shapes Socrata datasets use. */
function coordsFrom(row: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = num(pick(row, ["latitude", "lat", "gis_latitude", "y_coordinate", "y", "y_latitude", "Y_COORD", "Latitude"]));
  const lng = num(pick(row, ["longitude", "long", "lng", "lon", "gis_longitude", "x_coordinate", "x", "x_longitude", "X_COORD", "Longitude"]));
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) return { lat, lng };

  for (const key of ["location", "mapped_location", "location_1", "the_geom", "geocoded_column", "point", "geolocation", "gx_location"]) {
    let v = row[key] as Record<string, unknown> | string | undefined;
    // Some portals ship the location as a string: WKT "POINT (lng lat)" or
    // serialized JSON (San Jose gx_location) — parse before the object path.
    if (typeof v === "string") {
      const m = v.match(/point\s*\(\s*(-?\d+\.?\d*)[ ,]+(-?\d+\.?\d*)\s*\)/i);
      if (m) {
        const lo = parseFloat(m[1]), la = parseFloat(m[2]);
        if (Number.isFinite(la) && Number.isFinite(lo)) return { lat: la, lng: lo };
      }
      // Bare "37.33, -121.89" pairs: magnitude decides which is latitude;
      // the city-center sanity check downstream drops any wrong guess.
      const pair = v.match(/(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
      if (pair) {
        const a = parseFloat(pair[1]), b = parseFloat(pair[2]);
        if (Math.abs(a) <= 90 && Math.abs(b) > 90 && Math.abs(b) <= 180) return { lat: a, lng: b };
        if (Math.abs(b) <= 90 && Math.abs(a) > 90 && Math.abs(a) <= 180) return { lat: b, lng: a };
      }
      try { v = JSON.parse(v) as Record<string, unknown>; } catch { continue; }
    }
    if (!v || typeof v !== "object") continue;
    const coords = (v as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const [lo, la] = coords as [number, number];
      if (Number.isFinite(la) && Number.isFinite(lo)) return { lat: Number(la), lng: Number(lo) };
    }
    const la2 = num((v as Record<string, unknown>).latitude);
    const lo2 = num((v as Record<string, unknown>).longitude);
    if (Number.isFinite(la2) && Number.isFinite(lo2)) return { lat: la2, lng: lo2 };
  }
  return null;
}

function productTypeFrom(text: string): ProductType {
  const t = text.toLowerCase();
  if (/town\s?house|town\s?home/.test(t)) return "Townhomes";
  if (/single family|one family|1 family|sfr|r-?\s*101/.test(t)) return "SFH";
  if (/two family|2 family|duplex|r-?\s*103/.test(t)) return "Duplex";
  if (/three|four family|fourplex|r-?\s*104/.test(t)) return "Fourplex";
  if (/five or more|multi|apartment|condo|r-?\s*105/.test(t)) return "Small multi";
  return "Infill";
}

const UNITS_BY_TYPE: Record<ProductType, number> = {
  SFH: 1, Infill: 1, Duplex: 2, Fourplex: 4, Townhomes: 4, "Small multi": 6,
};

function statusFrom(text: string): DevStatus {
  const t = text.toLowerCase();
  if (/final|closed|complete|co issued|cert/.test(t)) return "Completed";
  if (/active|issued|in progress|construction/.test(t)) return "Under construction";
  return "Permitted";
}

export interface CitySource {
  city: string;
  state: string;
  url: string;          // Socrata resource endpoint (.json)
  metroPpsf: number;    // sale $/sqft used for value estimates
  lat: number;          // city center, for coordinate sanity checks
  lng: number;
  limit?: number;
  /** Portal type — plain Socrata SODA by default; ckan = CKAN datastore_search
   * endpoint (Boston, Pittsburgh/WPRDC…), carto = Carto SQL API (Philadelphia). */
  kind?: "socrata" | "ckan" | "carto" | "ods";
  /** carto only: SQL with a {limit} placeholder. */
  cartoQuery?: string;
  /** carto only: broader SQL retried when cartoQuery returns no rows. */
  cartoQueryFallback?: string;
  /** ckan only: datastore sort (default "_id desc") — set to the dataset's
   * real date column when insertion order isn't chronological (Boston). */
  ckanSort?: string;
  where?: string;       // optional SoQL filter to boost new-construction yield
  /** socrata only: $order override (default ":id DESC") — the dataset's real
   * date column, for portals whose :id order isn't chronological. */
  order?: string;
}

/**
 * Live city roster. Austin is confirmed working; the rest are known public
 * permit datasets — each self-verifies via the on-screen diagnostic and
 * falls back to demo data if the dataset id or fields need correcting.
 */
export const CITY_SOURCES: CitySource[] = [
  // Probe-verified enum values ("work_class = 'New'" etc.) narrow each fetch
  // to new construction server-side; the retry ladder falls back to the plain
  // query if a portal ever renames the column.
  { city: "Austin", state: "TX", url: "https://data.austintexas.gov/resource/3syk-w9eu.json", metroPpsf: 390, lat: 30.27, lng: -97.74, limit: 8000, where: "work_class = 'New'", order: "issued_date DESC" },
  { city: "Chicago", state: "IL", url: "https://data.cityofchicago.org/resource/ydr8-5enu.json", metroPpsf: 360, lat: 41.88, lng: -87.63, limit: 6000, where: "permit_type='PERMIT - NEW CONSTRUCTION'" },
  { city: "Seattle", state: "WA", url: "https://data.seattle.gov/resource/76t5-zqzr.json", metroPpsf: 660, lat: 47.61, lng: -122.33, limit: 6000, where: "permittypedesc = 'New'" },
  { city: "San Francisco", state: "CA", url: "https://data.sfgov.org/resource/i98e-djp9.json", metroPpsf: 1150, lat: 37.77, lng: -122.42, limit: 6000, where: "lower(permit_type_definition) LIKE '%new construction%'" },
  { city: "New York", state: "NY", url: "https://data.cityofnewyork.us/resource/ipu4-2q9a.json", metroPpsf: 760, lat: 40.71, lng: -74.01, limit: 6000, where: "permit_type = 'NB'", order: "issuance_date DESC" },
  // LADBS retired yv23-pmwf ("…Old", login-walled 2026-07, caught by the data
  // canary); pi9x-tg5x is the current "Building Permits Issued from 2020 to
  // Present" dataset. "Bldg-New" is its verified new-building enum.
  { city: "Los Angeles", state: "CA", url: "https://data.lacity.org/resource/pi9x-tg5x.json", metroPpsf: 780, lat: 34.05, lng: -118.24, limit: 6000, where: "permit_type = 'Bldg-New'", order: "issue_date DESC" },
  { city: "Fort Worth", state: "TX", url: "https://data.fortworthtexas.gov/resource/quz7-xnsy.json", metroPpsf: 210, lat: 32.75, lng: -97.33, limit: 5000 },
  // Dallas "Building Permits" (e7gq-4sah) carries no coordinates — "Permit
  // Points" (6ik7-4gqj) is the geocoded sibling (the_geom).
  { city: "Dallas", state: "TX", url: "https://www.dallasopendata.com/resource/6ik7-4gqj.json", metroPpsf: 310, lat: 32.78, lng: -96.80, limit: 6000 },

  // ---- 2026 coverage expansion — every endpoint below was research-verified
  // ---- against indexed portal pages / working code, and is re-verified daily
  // ---- by the data canary. $/sf figures are metro median-sale (Redfin) —
  // ---- market anchors, not new-construction quotes.
  // New Orleans: the BLDS dataset (72f9-bi28) carries no coordinates —
  // "Building Permits (2018-present)" (nbcf-m6c2) is the geocoded feed.
  { city: "New Orleans", state: "LA", url: "https://data.nola.gov/resource/nbcf-m6c2.json", metroPpsf: 210, lat: 29.95, lng: -90.07, limit: 5000 },
  // Kansas City removed: ue52-x8g8 went login-walled (canary 2026-07-30,
  // HTTP 403) and the open catalog only carries per-decade historical
  // listings — no live public feed to wire.
  // Orlando "Permit Applications": geocoded_column is null on the newest
  // applications, so an unfiltered sample maps nothing — ask for rows that
  // are actually geocoded.
  { city: "Orlando", state: "FL", url: "https://data.cityoforlando.net/resource/ryhf-m453.json", metroPpsf: 250, lat: 28.54, lng: -81.38, limit: 6000, where: "geocoded_column IS NOT NULL" },
  // Boston "Approved Building Permits" — the datastore is bulk-reloaded, so
  // _id order isn't chronological; sort by the real issue date.
  { city: "Boston", state: "MA", kind: "ckan", url: "https://data.boston.gov/api/3/action/datastore_search?resource_id=6ddcd912-32a0-43df-9908-63574f8c7e77", metroPpsf: 695, lat: 42.36, lng: -71.06, limit: 5000, ckanSort: "issued_date desc" },
  // Pittsburgh (WPRDC CKAN). The recent window of this resource is fire-
  // suppression / storm-water permits — excluded by the normalizer so they
  // never masquerade as new construction.
  { city: "Pittsburgh", state: "PA", kind: "ckan", url: "https://data.wprdc.org/api/3/action/datastore_search?resource_id=f4d1177a-f597-4c32-8cbf-7885f56253f6", metroPpsf: 203, lat: 40.44, lng: -79.99, limit: 5000 },
  // San Jose "Active Building Permits" (CKAN) — location arrives as a
  // gx_location string (parsed by coordsFrom).
  { city: "San Jose", state: "CA", kind: "ckan", url: "https://data.sanjoseca.gov/api/3/action/datastore_search?resource_id=761b7ae8-3be1-4ad6-923d-c7af6404a904", metroPpsf: 889, lat: 37.34, lng: -121.89, limit: 5000 },
  // San Antonio "PERMITS ISSUED" (CKAN) — mixed-SRS coords are dropped by the
  // city-center sanity check, WGS84 rows pin correctly.
  { city: "San Antonio", state: "TX", kind: "ckan", url: "https://data.sanantonio.gov/api/3/action/datastore_search?resource_id=c21106f9-3ef5-4f3a-8604-f992b4db7512", metroPpsf: 157, lat: 29.42, lng: -98.49, limit: 5000 },
  // Milwaukee removed: the only public permit resource is a CSV with no
  // coordinates (probe-verified 2026-07-30) — nothing honest to map.
  // Memphis / Shelby County — Data Midsouth (OpenDataSoft, Innovate Memphis).
  // The ONLY open geocoded permit feed for the metro (research 2026-07-30):
  // county-wide (Memphis, Germantown, Collierville, Arlington, unincorp.),
  // lat/lon on every row, contractor + valuation. Monthly batch, ~40-day lag
  // — the honest ceiling for open Memphis data; the store keeps history.
  {
    city: "Memphis", state: "TN", kind: "ods",
    url: "https://www.datamidsouth.org/api/explore/v2.1/catalog/datasets/shelby-county-building-and-demolition-permits/records",
    where: 'record_type like "Residential New Construction"',
    order: "date_status desc",
    metroPpsf: 155, lat: 35.15, lng: -90.05, limit: 1000,
  },
  // Philadelphia L&I permits (Carto SQL API) — new-construction filter first
  // (typeofwork values probe-verified), full feed as fallback.
  {
    city: "Philadelphia", state: "PA", kind: "carto",
    url: "https://phl.carto.com/api/v2/sql",
    cartoQuery: "SELECT *, ST_Y(the_geom) AS latitude, ST_X(the_geom) AS longitude FROM permits WHERE permitissuedate IS NOT NULL AND typeofwork ILIKE '%new construction%' ORDER BY permitissuedate DESC LIMIT {limit}",
    cartoQueryFallback: "SELECT *, ST_Y(the_geom) AS latitude, ST_X(the_geom) AS longitude FROM permits WHERE permitissuedate IS NOT NULL ORDER BY permitissuedate DESC LIMIT {limit}",
    metroPpsf: 198, lat: 39.95, lng: -75.17, limit: 5000,
  },
];

export const AUSTIN = CITY_SOURCES[0];

export interface CityResult {
  city: string;
  items: Development[];
  total: number;      // raw rows fetched from the city
  columns: string[];  // the city's actual field names (for on-screen tuning)
  url: string;        // the exact request URL (for diagnostics)
  error?: string;
  /** Median declared build cost ($/sf) computed from real permits. */
  medianBuildPpsf?: number;
  buildPpsfSamples: number;
}

export async function fetchCityDevelopments(src: CitySource, limitOverride?: number): Promise<CityResult> {
  const limit = limitOverride ?? src.limit ?? 2500;

  // CKAN + Carto + OpenDataSoft portals: different envelopes, same row shape —
  // rows feed the exact same normalizer below.
  if (src.kind === "ckan" || src.kind === "carto" || src.kind === "ods") {
    let url = src.url;
    try {
      let rows: Record<string, unknown>[] = [];
      if (src.kind === "ods") {
        // OpenDataSoft Explore v2.1: {total_count, results:[...]}. Hard cap of
        // 100 rows per request — page by offset up to the source's limit.
        // Server-side where first (new-construction filter); plain fallback.
        const pageMax = Math.min(limit, 1000);
        const base = src.where
          ? `${src.url}?where=${encodeURIComponent(src.where)}&order_by=${encodeURIComponent(src.order ?? "date_status desc")}`
          : `${src.url}?order_by=${encodeURIComponent(src.order ?? "date_status desc")}`;
        for (let offset = 0; offset < pageMax; offset += 100) {
          url = `${base}&limit=100&offset=${offset}`;
          let res = await fetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok && offset === 0 && src.where) {
            // where rejected (column rename?) → unfiltered; the normalizer
            // still applies the new-residential gate client-side.
            url = `${src.url}?limit=100&offset=0`;
            res = await fetch(url, { headers: { Accept: "application/json" } });
          }
          if (!res.ok) {
            if (offset === 0) return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `HTTP ${res.status}` };
            break;
          }
          const data = await res.json();
          const batch = (data?.results ?? []) as Record<string, unknown>[];
          rows.push(...batch);
          if (batch.length < 100) break;
        }
      } else if (src.kind === "ckan") {
        // datastore_search: {result: {records: [...]}}. Newest-first via the
        // source's sort (default _id desc); fall back to the plain query.
        url = `${src.url}&limit=${limit}&sort=${src.ckanSort ?? "_id desc"}`;
        let res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) {
          url = `${src.url}&limit=${limit}`;
          res = await fetch(url, { headers: { Accept: "application/json" } });
        }
        if (!res.ok) return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `HTTP ${res.status}` };
        const data = await res.json();
        rows = (data?.result?.records ?? []) as Record<string, unknown>[];
      } else {
        const q = (src.cartoQuery ?? "").replace("{limit}", String(limit));
        url = `${src.url}?q=${encodeURIComponent(q)}`;
        let res = await fetch(url, { headers: { Accept: "application/json" } });
        let data = res.ok ? await res.json() : null;
        // Filtered query empty/rejected (column rename?) → broad fallback.
        if (src.cartoQueryFallback && !(data?.rows ?? []).length) {
          const fq = src.cartoQueryFallback.replace("{limit}", String(limit));
          url = `${src.url}?q=${encodeURIComponent(fq)}`;
          res = await fetch(url, { headers: { Accept: "application/json" } });
          data = res.ok ? await res.json() : data;
        }
        if (!res.ok && !(data?.rows ?? []).length) return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `HTTP ${res.status}` };
        rows = (data?.rows ?? []) as Record<string, unknown>[];
      }
      return normalizeRows(src, rows, url);
    } catch (e) {
      return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `${(e as Error).message} — likely CORS or network block` };
    }
  }

  const base = new URLSearchParams();
  base.set("$limit", String(limit));
  const token = import.meta.env.VITE_SOCRATA_APP_TOKEN as string | undefined;
  if (token) base.set("$$app_token", token);

  // Retry ladder: (where + order) -> (order) -> (plain). A wrong column in
  // where/order makes Socrata reject the whole query, so degrade gracefully.
  // Custom date-column orders get a :id fallback before dropping the where.
  const variants: URLSearchParams[] = [];
  const orders = src.order ? [src.order, ":id DESC"] : [":id DESC"];
  if (src.where) {
    for (const o of orders) {
      const v = new URLSearchParams(base);
      v.set("$where", src.where);
      v.set("$order", o);
      variants.push(v);
    }
  }
  for (const o of orders) {
    const v = new URLSearchParams(base);
    v.set("$order", o);
    variants.push(v);
  }
  variants.push(base);

  let url = `${src.url}?${variants[0].toString()}`;

  let rows: Record<string, unknown>[] = [];
  try {
    let res = await fetch(url, { headers: { Accept: "application/json" } });
    for (let i = 1; i < variants.length && res.status === 400; i++) {
      url = `${src.url}?${variants[i].toString()}`;
      res = await fetch(url, { headers: { Accept: "application/json" } });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `HTTP ${res.status} · ${body.slice(0, 140)}` };
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `Unexpected response: ${JSON.stringify(data).slice(0, 140)}` };
    }
    rows = data as Record<string, unknown>[];
  } catch (e) {
    return { city: src.city, items: [], total: 0, columns: [], url, buildPpsfSamples: 0, error: `${(e as Error).message} — likely CORS or network block` };
  }

  return normalizeRows(src, rows, url);
}

/** Shared row normalizer — Socrata, CKAN, and Carto rows all land here. */
function normalizeRows(src: CitySource, rows: Record<string, unknown>[], url: string): CityResult {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const seen = new Set<string>();
  const out: Development[] = [];
  const ppsfSamples: number[] = [];

  for (const r of rows) {
    const coords = coordsFrom(r);
    if (!coords) continue;
    // Sanity: exact-pin accuracy means dropping bad geocodes, not mapping them.
    if (Math.abs(coords.lat - src.lat) > 1.2 || Math.abs(coords.lng - src.lng) > 1.2) continue;
    // Accuracy tier: ≤3-decimal grid (~111 m) = block/zip centroid, not the
    // parcel — drop rather than pin the wrong spot.
    const tooCoarse = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-9;
    if (tooCoarse(coords.lat) && tooCoarse(coords.lng)) continue;

    const typeDesc = String(pick(r, ["permit_type_desc", "permit_type", "permittype", "permit_type_definition", "permittypedesc", "permit_type_description", "application_type"]) ?? "");
    const pclass = String(pick(r, ["permit_class", "permit_class_mapped", "permitclass", "permitclassmapped", "permit_sub_type", "occupancytype", "landuse", "lu", "topcat"]) ?? "");
    const work = String(pick(r, ["work_class", "work_type", "job_type", "worktype", "typeofwork", "WORK TYPE", "Permit Type"]) ?? "");
    const desc = String(pick(r, ["description", "descr", "work_description", "work_desc", "activity", "purpose", "job_description", "proposed_use", "use_desc", "permitdescription", "approvedscopeofwork", "WORKDESCRIPTION", "PROJECT NAME", "project_name", "record_type", "propclassdesc"]) ?? "");
    const blob = `${typeDesc} ${pclass} ${work} ${desc}`;
    const residentialFlag = String(pick(r, ["residential"]) ?? "").toLowerCase();

    // Non-building permit records that pattern-match residential words
    // (fire suppression at a house, driveway cuts, storm water) are never
    // developments — hard-exclude before anything else.
    if (/suppression|sprinkler|storm ?water|driveway|sidewalk|curb cut/i.test(blob)) continue;

    // "Bldg-New" (LA) and bare "New" / SF's numeric 1/2 type codes are
    // building permits even though the word "building" never appears.
    const isBuilding = /building|construction|\bbldg\b|bldg-/i.test(blob) || typeDesc === "" || /^new$/i.test(typeDesc.trim()) || /^[12]$/.test(typeDesc.trim());
    const isResidential =
      residentialFlag === "yes" ||
      /resid|famil|\bfam\b|\dfam|duplex|town|apartment|condo|dwelling|sfr|\dunit|r-?\s*1\d\d/i.test(blob);
    const isRemodel = /remodel|repair|addition|alteration|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|irrigation|revision/i.test(blob);
    // A definite new-construction phrase outranks incidental remodel words —
    // long descriptions of new builds routinely mention the roof, plumbing,
    // or the structure they replaced ("demolished due to storm damage").
    const strongNew = /new construction|construct(ion of)? (a )?new|new single family|new sfr|new residence|new home|new dwelling|new building|\berect\b|\bnewcon\b/i.test(blob);
    const isNew = strongNew || /\bnb\b|new/i.test(work) || work === "";
    const nycStyleNewBuilding = residentialFlag === "yes" && /\bnb\b/i.test(work);
    if (!nycStyleNewBuilding && !(isBuilding && isResidential && isNew && (strongNew || !isRemodel))) continue;

    const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = productTypeFrom(blob);
    const units = Math.max(1, Math.round(num(pick(r, ["housing_units", "housingunitsadded", "number_of_dwelling_units", "total_dwelling_units", "proposed_units", "dwelling_units"])) || UNITS_BY_TYPE[type]));
    const sqftRaw = num(pick(r, ["total_new_add_sqft", "building_sqft", "square_feet", "proposed_sqft", "sq_feet", "totalsqft", "AREA (SF)"]));
    const hasRealSqft = Number.isFinite(sqftRaw) && sqftRaw > 200;
    const buildingSqft = Math.round(hasRealSqft ? sqftRaw : units * 1600);
    const valuation = Math.round(num(pick(r, ["total_job_valuation", "total_valuation", "building_valuation", "declared_valuation", "estimated_cost", "estimate_cost", "revised_cost", "reported_cost", "estprojectcost", "const_cost", "initial_cost", "job_cost", "total_project_value", "PERMITVALUATION", "DECLARED VALUATION", "Construction Total Cost"])) || 0);

    // Real build-cost sample: declared valuation ÷ real sqft, sanity-bounded.
    if (valuation > 0 && hasRealSqft) {
      const bp = valuation / sqftRaw;
      if (bp >= 60 && bp <= 1500) ppsfSamples.push(bp);
    }
    const issued = String(pick(r, ["issued_date", "issue_date", "issueddate", "date_issued", "issuance_date", "applied_date", "applieddate", "filing_date", "permit_issue_date", "permitissuedate", "processed_date", "date_status", "ISSUEDATE", "DATE ISSUED", "Date Issued"]) ?? "").slice(0, 10);

    let address = String(pick(r, ["original_address1", "address", "street_address", "permit_location", "project_name", "originaladdress1", "permit_address", "site_address", "ADDRESS", "Address", "gx_location"]) ?? "").trim();
    if (!address) {
      const houseNo = String(pick(r, ["house__", "house_no", "house_number", "street_number"]) ?? "").trim();
      const street = String(pick(r, ["street_name", "street"]) ?? "").trim();
      if (street) address = `${houseNo} ${street}`.trim();
    }

    const contractor = String(pick(r, ["contractor_company_name", "contractorcompanyname", "contractor_name", "contractorname", "general_contractor", "applicant_organization", "contractor_full_name", "applicant_full_name", "contact_1_name", "business_name_prof", "CONTRACTOR", "PRIMARY CONTACT", "applicant"]) ?? "")
      .trim()
      // Shelby County appends the license code: "D.R. HORTON, INC (B000)".
      .replace(/\s*\(B[0-9A-Z]+\).*$/, "");
    const status = statusFrom(String(pick(r, ["status_current", "statuscurrent", "permit_status", "status", "current_status", "status_description", "application_status", "Status", "APPROVAL_STATUS"]) ?? ""));
    const permitId = String(pick(r, ["permit_number", "permit_num", "permit_", "permitnumber", "permit_id", "record_id", "job__", "FOLDERNUMBER", "PERMIT #", "Record ID", "row_id", ":id"]) ?? key);

    const estValue = valuation > 0 ? Math.max(valuation, Math.round(buildingSqft * src.metroPpsf * 0.5)) : Math.round(buildingSqft * src.metroPpsf);
    const pricePerSqft = valuation > 0 && buildingSqft > 0
      ? Math.min(900, Math.max(120, Math.round(valuation / buildingSqft)))
      : Math.round(src.metroPpsf * 0.45);

    out.push({
      id: `live-${src.city.toLowerCase().replace(/\s+/g, "")}-${permitId}`,
      name: address || `${type} — ${src.city}`,
      developer: contractor || "Permit holder on file",
      city: src.city,
      state: src.state,
      lat: coords.lat,
      lng: coords.lng,
      productType: type,
      units,
      landSqft: Math.round(buildingSqft * 1.3),
      buildingSqft,
      stories: Math.max(1, Math.round(num(pick(r, ["number_of_floors", "numberoffloors", "stories", "proposed_stories"])) || (type === "SFH" || type === "Infill" ? 2 : 3))),
      status,
      approvedDate: issued || "—",
      estValue,
      pricePerSqft,
      description: `${type} new-construction permit — real public record${valuation > 0 ? ` · declared valuation $${valuation.toLocaleString("en-US")}` : ""}.`,
      sqftEstimated: !hasRealSqft,
    });
  }

  out.sort((a, b) => (a.approvedDate > b.approvedDate ? -1 : 1));
  ppsfSamples.sort((a, b) => a - b);
  const medianBuildPpsf = ppsfSamples.length >= 5
    ? Math.round(ppsfSamples[Math.floor(ppsfSamples.length / 2)])
    : undefined;
  return {
    city: src.city, items: out.slice(0, 500), total: rows.length, columns, url,
    medianBuildPpsf, buildPpsfSamples: ppsfSamples.length,
  };
}

export interface LivePermits {
  perCity: CityResult[];
  items: Development[];
  liveCityNames: string[];
  /** Per-city median declared build $/sf computed from real permits. */
  liveBuildCosts: Record<string, { ppsf: number; samples: number }>;
}

/** Fetch every city in parallel; failures degrade to per-city diagnostics. */
export async function fetchAllCityDevelopments(): Promise<LivePermits> {
  const { ARCGIS_SOURCES, fetchArcgisCity } = await import("./arcgis"); // avoid import cycle
  const socrata = Promise.allSettled(CITY_SOURCES.map((s) => fetchCityDevelopments(s)));
  const arcgis = Promise.allSettled(ARCGIS_SOURCES.map((s) => fetchArcgisCity(s)));
  const [sSettled, aSettled] = await Promise.all([socrata, arcgis]);

  const perCity: CityResult[] = [
    ...sSettled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { city: CITY_SOURCES[i].city, items: [], total: 0, columns: [], url: CITY_SOURCES[i].url, buildPpsfSamples: 0, error: String(r.reason) },
    ),
    ...aSettled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { city: ARCGIS_SOURCES[i].city, items: [], total: 0, columns: [], url: ARCGIS_SOURCES[i].candidates[0], buildPpsfSamples: 0, error: String(r.reason) },
    ),
  ];
  const items = perCity.flatMap((c) => c.items);
  const liveBuildCosts: Record<string, { ppsf: number; samples: number }> = {};
  for (const c of perCity) {
    if (c.medianBuildPpsf) liveBuildCosts[c.city] = { ppsf: c.medianBuildPpsf, samples: c.buildPpsfSamples };
  }
  return { perCity, items, liveCityNames: perCity.filter((c) => c.items.length > 0).map((c) => c.city), liveBuildCosts };
}
