/**
 * "Our own Shovels" — live permit ingestion from city open-data portals
 * (Socrata), fetched directly from the browser (these APIs send open CORS
 * headers and need no key). Each city has its own dataset + column names, so
 * the normalizer probes several candidate field names and is deliberately
 * lenient: a wrong guess yields zero rows and the map falls back to demo data
 * rather than breaking.
 *
 * NOTE: this can't be tested from the build sandbox (egress policy blocks city
 * portals there) — it runs on the deployed site. On first load it logs the raw
 * column names to the console so the field mapping can be tuned to reality.
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

function productTypeFrom(text: string): ProductType {
  const t = text.toLowerCase();
  if (/town\s?house|town\s?home/.test(t)) return "Townhomes";
  if (/single family|one family|sf|r-?\s*101/.test(t)) return "SFH";
  if (/two family|duplex|r-?\s*103/.test(t)) return "Duplex";
  if (/three|four family|r-?\s*104|fourplex/.test(t)) return "Fourplex";
  if (/five or more|multi|apartment|r-?\s*105/.test(t)) return "Small multi";
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
  metroPpsf: number;    // used only for build-cost estimate fallback
}

/** Austin — "Issued Construction Permits" (dataset 3syk-w9eu). */
export const AUSTIN: CitySource = {
  city: "Austin",
  state: "TX",
  url: "https://data.austintexas.gov/resource/3syk-w9eu.json",
  metroPpsf: 470,
};

export interface CityResult {
  items: Development[];
  total: number;      // raw rows fetched from the city
  columns: string[];  // the city's actual field names (for on-screen tuning)
  url: string;        // the exact request URL (for diagnostics)
  error?: string;
}

export async function fetchCityDevelopments(src: CitySource, limit = 400): Promise<CityResult> {
  // Minimal query — no assumed column names. Fetch rows, filter in code.
  const params = new URLSearchParams();
  params.set("$limit", String(limit));
  const token = import.meta.env.VITE_SOCRATA_APP_TOKEN as string | undefined;
  if (token) params.set("$$app_token", token);
  const url = `${src.url}?${params.toString()}`;

  let rows: Record<string, unknown>[] = [];
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { items: [], total: 0, columns: [], url, error: `HTTP ${res.status} · ${body.slice(0, 140)}` };
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return { items: [], total: 0, columns: [], url, error: `Unexpected response: ${JSON.stringify(data).slice(0, 140)}` };
    }
    rows = data as Record<string, unknown>[];
  } catch (e) {
    return { items: [], total: 0, columns: [], url, error: `${(e as Error).message} — likely CORS or network block` };
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  if (columns.length) {
    // eslint-disable-next-line no-console
    console.info(`[Pencil] ${src.city} permit columns:`, columns.join(", "));
  }

  const seen = new Set<string>();
  const out: Development[] = [];

  for (const r of rows) {
    const lat = num(r.latitude);
    const lng = num(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const typeDesc = String(pick(r, ["permit_type_desc", "permit_type", "permittype"]) ?? "");
    const pclass = String(pick(r, ["permit_class", "permit_class_mapped"]) ?? "");
    const work = String(pick(r, ["work_class", "work_type"]) ?? "");
    const blob = `${typeDesc} ${pclass} ${work}`;

    // Keep new residential building permits; drop trade/remodel/teardown noise.
    const isBuilding = /building/i.test(typeDesc) || typeDesc === "";
    const isResidential = /resid|family|duplex|town|r-?\s*1\d\d/i.test(pclass) || /resid|family|duplex|town/i.test(blob);
    const isRemodel = /remodel|repair|addition|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|irrigation/i.test(blob);
    const isNew = /new/i.test(work) || work === "";
    if (!isBuilding || !isResidential || isRemodel || !isNew) continue;

    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = productTypeFrom(`${pclass} ${typeDesc}`);
    const units = Math.max(1, Math.round(num(pick(r, ["housing_units", "number_of_dwelling_units", "total_dwelling_units"])) || UNITS_BY_TYPE[type]));
    const buildingSqft = Math.round(num(pick(r, ["total_new_add_sqft", "building_sqft", "total_existing_bldg_sqft"])) || units * 1600);
    const valuation = Math.round(num(pick(r, ["total_job_valuation", "total_valuation", "building_valuation", "declared_valuation"])) || 0);
    const issued = String(pick(r, ["issued_date", "issue_date", "applied_date", "applieddate"]) ?? "").slice(0, 10);
    const address = String(pick(r, ["original_address1", "permit_location", "project_name", "address"]) ?? "").trim();
    const contractor = String(pick(r, ["contractor_company_name", "applicant_organization", "contractor_full_name", "applicant_full_name"]) ?? "").trim();
    const status = statusFrom(String(pick(r, ["status_current", "status", "statuscurrent"]) ?? ""));
    const permitId = String(pick(r, ["permit_number", "permit_num", "row_id", ":id"]) ?? key);

    const estValue = valuation > 0 ? valuation : Math.round(buildingSqft * src.metroPpsf);
    const pricePerSqft = valuation > 0 && buildingSqft > 0 ? Math.round(valuation / buildingSqft) : Math.round(src.metroPpsf * 0.45);

    out.push({
      id: `live-${src.city.toLowerCase()}-${permitId}`,
      name: address || `${type} — ${src.city}`,
      developer: contractor || "Permit holder on file",
      city: src.city,
      state: src.state,
      lat,
      lng,
      productType: type,
      units,
      landSqft: Math.round(buildingSqft * 1.3),
      buildingSqft,
      stories: Math.max(1, Math.round(num(pick(r, ["number_of_floors", "stories"])) || (type === "SFH" || type === "Infill" ? 2 : 3))),
      status,
      approvedDate: issued || "—",
      estValue,
      pricePerSqft,
      description: `${type} new construction permit${valuation > 0 ? ` · declared valuation ${valuation.toLocaleString("en-US")}` : ""}.`,
    });
  }

  return { items: out.slice(0, 300), total: rows.length, columns, url };
}
