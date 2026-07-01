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
  const lat = num(pick(row, ["latitude", "lat", "gis_latitude", "y_coordinate", "y"]));
  const lng = num(pick(row, ["longitude", "long", "lng", "gis_longitude", "x_coordinate", "x"]));
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) return { lat, lng };

  for (const key of ["location", "mapped_location", "location_1", "the_geom", "geocoded_column", "point", "geolocation"]) {
    const v = row[key] as Record<string, unknown> | undefined;
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
  limit?: number;       // rows to fetch (default 2500)
}

/**
 * Live city roster. Austin is confirmed working; the rest are known public
 * permit datasets — each self-verifies via the on-screen diagnostic and
 * falls back to demo data if the dataset id or fields need correcting.
 */
export const CITY_SOURCES: CitySource[] = [
  { city: "Austin", state: "TX", url: "https://data.austintexas.gov/resource/3syk-w9eu.json", metroPpsf: 470, lat: 30.27, lng: -97.74, limit: 8000 },
  { city: "Chicago", state: "IL", url: "https://data.cityofchicago.org/resource/ydr8-5enu.json", metroPpsf: 400, lat: 41.88, lng: -87.63, limit: 4000 },
  { city: "Seattle", state: "WA", url: "https://data.seattle.gov/resource/76t5-zqzr.json", metroPpsf: 720, lat: 47.61, lng: -122.33, limit: 4000 },
  { city: "San Francisco", state: "CA", url: "https://data.sfgov.org/resource/i98e-djp9.json", metroPpsf: 950, lat: 37.77, lng: -122.42, limit: 4000 },
  { city: "Nashville", state: "TN", url: "https://data.nashville.gov/resource/kqff-rxj8.json", metroPpsf: 420, lat: 36.16, lng: -86.78, limit: 4000 },
  { city: "New York", state: "NY", url: "https://data.cityofnewyork.us/resource/ipu4-2q9a.json", metroPpsf: 1100, lat: 40.71, lng: -74.01, limit: 4000 },
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
  const base = new URLSearchParams();
  base.set("$limit", String(limit));
  const token = import.meta.env.VITE_SOCRATA_APP_TOKEN as string | undefined;
  if (token) base.set("$$app_token", token);

  // Bias toward recent rows via the :id system field (safe on all datasets);
  // if a dataset rejects it, retry plain.
  const ordered = new URLSearchParams(base);
  ordered.set("$order", ":id DESC");
  let url = `${src.url}?${ordered.toString()}`;

  let rows: Record<string, unknown>[] = [];
  try {
    let res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 400) {
      url = `${src.url}?${base.toString()}`;
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

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const seen = new Set<string>();
  const out: Development[] = [];
  const ppsfSamples: number[] = [];

  for (const r of rows) {
    const coords = coordsFrom(r);
    if (!coords) continue;
    // Sanity: exact-pin accuracy means dropping bad geocodes, not mapping them.
    if (Math.abs(coords.lat - src.lat) > 1.2 || Math.abs(coords.lng - src.lng) > 1.2) continue;

    const typeDesc = String(pick(r, ["permit_type_desc", "permit_type", "permittype", "permit_type_definition", "permittypedesc", "permit_type_description"]) ?? "");
    const pclass = String(pick(r, ["permit_class", "permit_class_mapped", "permitclass", "permitclassmapped"]) ?? "");
    const work = String(pick(r, ["work_class", "work_type", "job_type", "worktype"]) ?? "");
    const desc = String(pick(r, ["description", "work_description", "purpose", "job_description", "proposed_use"]) ?? "");
    const blob = `${typeDesc} ${pclass} ${work} ${desc}`;
    const residentialFlag = String(pick(r, ["residential"]) ?? "").toLowerCase();

    const isBuilding = /building|construction/i.test(blob) || typeDesc === "";
    const isResidential =
      residentialFlag === "yes" ||
      /resid|family|duplex|town|apartment|condo|dwelling|sfr|r-?\s*1\d\d/i.test(blob);
    const isRemodel = /remodel|repair|addition|alteration|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|irrigation|revision/i.test(blob);
    const isNew = /\bnb\b|new/i.test(work) || /new construction|new building|new dwelling/i.test(blob) || work === "";
    const nycStyleNewBuilding = residentialFlag === "yes" && /\bnb\b/i.test(work);
    if (!nycStyleNewBuilding && !(isBuilding && isResidential && !isRemodel && isNew)) continue;

    const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = productTypeFrom(blob);
    const units = Math.max(1, Math.round(num(pick(r, ["housing_units", "housingunitsadded", "number_of_dwelling_units", "total_dwelling_units", "proposed_units", "dwelling_units"])) || UNITS_BY_TYPE[type]));
    const sqftRaw = num(pick(r, ["total_new_add_sqft", "building_sqft", "square_feet", "proposed_sqft"]));
    const hasRealSqft = Number.isFinite(sqftRaw) && sqftRaw > 200;
    const buildingSqft = Math.round(hasRealSqft ? sqftRaw : units * 1600);
    const valuation = Math.round(num(pick(r, ["total_job_valuation", "total_valuation", "building_valuation", "declared_valuation", "estimated_cost", "revised_cost", "reported_cost", "estprojectcost", "const_cost", "initial_cost", "job_cost"])) || 0);

    // Real build-cost sample: declared valuation ÷ real sqft, sanity-bounded.
    if (valuation > 0 && hasRealSqft) {
      const bp = valuation / sqftRaw;
      if (bp >= 60 && bp <= 1500) ppsfSamples.push(bp);
    }
    const issued = String(pick(r, ["issued_date", "issue_date", "issueddate", "date_issued", "issuance_date", "applied_date", "applieddate", "filing_date", "permit_issue_date"]) ?? "").slice(0, 10);

    let address = String(pick(r, ["original_address1", "address", "street_address", "permit_location", "project_name", "originaladdress1"]) ?? "").trim();
    if (!address) {
      const houseNo = String(pick(r, ["house__", "house_no", "house_number", "street_number"]) ?? "").trim();
      const street = String(pick(r, ["street_name", "street"]) ?? "").trim();
      if (street) address = `${houseNo} ${street}`.trim();
    }

    const contractor = String(pick(r, ["contractor_company_name", "contractorcompanyname", "contractor_name", "general_contractor", "applicant_organization", "contractor_full_name", "applicant_full_name", "contact_1_name"]) ?? "").trim();
    const status = statusFrom(String(pick(r, ["status_current", "statuscurrent", "permit_status", "status", "current_status", "status_description"]) ?? ""));
    const permitId = String(pick(r, ["permit_number", "permit_num", "permit_", "job__", "row_id", ":id"]) ?? key);

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
    });
  }

  out.sort((a, b) => (a.approvedDate > b.approvedDate ? -1 : 1));
  ppsfSamples.sort((a, b) => a - b);
  const medianBuildPpsf = ppsfSamples.length >= 5
    ? Math.round(ppsfSamples[Math.floor(ppsfSamples.length / 2)])
    : undefined;
  return {
    city: src.city, items: out.slice(0, 400), total: rows.length, columns, url,
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
  const settled = await Promise.allSettled(CITY_SOURCES.map((s) => fetchCityDevelopments(s)));
  const perCity: CityResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { city: CITY_SOURCES[i].city, items: [], total: 0, columns: [], url: CITY_SOURCES[i].url, buildPpsfSamples: 0, error: String(r.reason) },
  );
  const items = perCity.flatMap((c) => c.items);
  const liveBuildCosts: Record<string, { ppsf: number; samples: number }> = {};
  for (const c of perCity) {
    if (c.medianBuildPpsf) liveBuildCosts[c.city] = { ppsf: c.medianBuildPpsf, samples: c.buildPpsfSamples };
  }
  return { perCity, items, liveCityNames: perCity.filter((c) => c.items.length > 0).map((c) => c.city), liveBuildCosts };
}
