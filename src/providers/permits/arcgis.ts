/**
 * ArcGIS permit connector — many big counties (Miami-Dade first) publish
 * permits on ArcGIS FeatureServer/MapServer layers instead of Socrata.
 *
 * Schemas vary wildly across counties, so this normalizer is generic: it
 * scans attribute KEYS by pattern (type/desc/valuation/sqft/date/address/…)
 * instead of assuming exact names, handles ArcGIS epoch-millisecond dates,
 * and reads point geometry in WGS84. Each source lists candidate layer URLs
 * tried in order; failures surface in the Live chip diagnostics like every
 * other city, and the map falls back to demo data for that metro.
 */
import type { Development, ProductType, DevStatus } from "@/data/developments";
import type { CityResult } from "./socrata";

export interface ArcgisCitySource {
  city: string;
  state: string;
  /** Layer endpoints (…/FeatureServer/0 style), tried in order. */
  candidates: string[];
  metroPpsf: number;
  lat: number;
  lng: number;
  limit?: number;
}

export const ARCGIS_SOURCES: ArcgisCitySource[] = [
  {
    city: "Miami",
    state: "FL",
    candidates: [
      // City of Miami open-data hub (ArcGIS Online)
      "https://services1.arcgis.com/Ao3Vh6rEmDGmvCPT/arcgis/rest/services/Building_Permits/FeatureServer/0",
      "https://services1.arcgis.com/Ao3Vh6rEmDGmvCPT/arcgis/rest/services/BuildingPermits/FeatureServer/0",
      // Miami-Dade County GIS
      "https://gisweb.miamidade.gov/arcgis/rest/services/MD_PermitsPlus/MapServer/0",
    ],
    metroPpsf: 800,
    lat: 25.76,
    lng: -80.19,
    limit: 4000,
  },
];

type Attrs = Record<string, unknown>;

function firstString(attrs: Attrs, keyRe: RegExp): string {
  for (const [k, v] of Object.entries(attrs)) {
    if (keyRe.test(k) && typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

function textBlob(attrs: Attrs, keyRe: RegExp): string {
  return Object.entries(attrs)
    .filter(([k, v]) => keyRe.test(k) && typeof v === "string" && (v as string).length < 300)
    .map(([, v]) => v)
    .join(" ");
}

function firstNumber(attrs: Attrs, keyRe: RegExp, min = 0): number | null {
  for (const [k, v] of Object.entries(attrs)) {
    if (!keyRe.test(k)) continue;
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    if (Number.isFinite(n) && n > min) return n;
  }
  return null;
}

/** ArcGIS serves dates as epoch milliseconds; strings show up too. */
function isoFromMaybe(v: unknown): string {
  if (typeof v === "number" && v > 1e11) return new Date(v).toISOString().slice(0, 10);
  const s = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : "";
}

function firstDate(attrs: Attrs, keyRe: RegExp): string {
  for (const [k, v] of Object.entries(attrs)) {
    if (!keyRe.test(k)) continue;
    const iso = isoFromMaybe(v);
    if (iso) return iso;
  }
  return "";
}

function productTypeFrom(text: string): ProductType {
  const t = text.toLowerCase();
  if (/town\s?house|town\s?home/.test(t)) return "Townhomes";
  if (/single family|one family|1 family|sfr/.test(t)) return "SFH";
  if (/two family|2 family|duplex/.test(t)) return "Duplex";
  if (/three|four family|fourplex/.test(t)) return "Fourplex";
  if (/five or more|multi|apartment|condo/.test(t)) return "Small multi";
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

interface ArcgisResponse {
  error?: { code?: number; message?: string };
  fields?: { name: string }[];
  features?: { attributes?: Attrs; geometry?: { x?: number; y?: number } }[];
}

async function queryLayer(layerUrl: string, limit: number): Promise<{ data: ArcgisResponse; url: string }> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "json",
    resultRecordCount: String(limit),
    orderByFields: "OBJECTID DESC",
  });
  const url = `${layerUrl}/query?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as ArcgisResponse;
  if (data.error) throw new Error(`ArcGIS ${data.error.code ?? ""}: ${data.error.message ?? "error"}`);
  return { data, url };
}

export async function fetchArcgisCity(src: ArcgisCitySource): Promise<CityResult> {
  const limit = src.limit ?? 2000;
  const attempts: string[] = [];
  let data: ArcgisResponse | null = null;
  let usedUrl = src.candidates[0];

  for (const candidate of src.candidates) {
    try {
      const r = await queryLayer(candidate, limit);
      if (r.data.features && r.data.features.length > 0) {
        data = r.data;
        usedUrl = r.url;
        break;
      }
      attempts.push(`${candidate} → 0 features`);
    } catch (e) {
      attempts.push(`${candidate} → ${(e as Error).message}`);
    }
  }

  if (!data) {
    return {
      city: src.city, items: [], total: 0, columns: [], url: src.candidates[0],
      buildPpsfSamples: 0, error: attempts.join(" · ").slice(0, 400),
    };
  }

  const features = data.features ?? [];
  const columns = data.fields?.map((f) => f.name) ?? Object.keys(features[0]?.attributes ?? {});
  const seen = new Set<string>();
  const out: Development[] = [];
  const ppsfSamples: number[] = [];

  for (const f of features) {
    const attrs = f.attributes ?? {};
    const lat = f.geometry?.y;
    const lng = f.geometry?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs((lat as number) - src.lat) > 1.2 || Math.abs((lng as number) - src.lng) > 1.2) continue;

    const blob = textBlob(attrs, /type|class|desc|work|use|scope|category|name|status/i);
    const isResidential = /resid|family|duplex|town|apartment|condo|dwelling|sfr/i.test(blob);
    const isNew = /new construction|new building|new dwelling|\bnew\b/i.test(blob);
    const isRemodel = /remodel|repair|addition|alteration|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|shutter|awning|revision/i.test(blob);
    if (!isResidential || !isNew || isRemodel) continue;

    const key = `${(lat as number).toFixed(5)},${(lng as number).toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = productTypeFrom(blob);
    const units = Math.max(1, Math.round(firstNumber(attrs, /units|dwell/i, 0) ?? UNITS_BY_TYPE[type]));
    const sqftRaw = firstNumber(attrs, /sq_?ft|sqft|square|bldg_?area|building_?area/i, 200);
    const buildingSqft = Math.round(sqftRaw ?? units * 1600);
    const valuation = Math.round(firstNumber(attrs, /valuation|est.*value|value|cost/i, 1000) ?? 0);
    if (valuation > 0 && sqftRaw) {
      const bp = valuation / sqftRaw;
      if (bp >= 60 && bp <= 1500) ppsfSamples.push(bp);
    }
    const issued = firstDate(attrs, /issue|approv|final|date/i);
    const address = firstString(attrs, /address|location|site/i);
    const contractor = firstString(attrs, /contractor|applicant|company|builder/i);
    const permitId = firstString(attrs, /permit.*(no|num|id)|process.*num|^objectid$/i) || key;

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
      lat: lat as number,
      lng: lng as number,
      productType: type,
      units,
      landSqft: Math.round(buildingSqft * 1.3),
      buildingSqft,
      stories: type === "SFH" || type === "Infill" ? 2 : 3,
      status: statusFrom(blob),
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
    city: src.city,
    items: out.slice(0, 400),
    total: features.length,
    columns,
    url: usedUrl,
    medianBuildPpsf,
    buildPpsfSamples: ppsfSamples.length,
    // Surface earlier failed candidates even on success, for transparency.
    error: out.length === 0 ? `matched 0 of ${features.length} rows — see columns` : (attempts.length ? `also tried: ${attempts.join(" · ").slice(0, 200)}` : undefined),
  };
}
