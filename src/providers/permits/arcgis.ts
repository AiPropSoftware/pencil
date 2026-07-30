/**
 * ArcGIS permit connector — many big counties (Miami-Dade, Nashville…)
 * publish permits on Esri tech instead of Socrata.
 *
 * SELF-DISCOVERY: a candidate can be a direct layer URL (…/FeatureServer/0)
 * or a server root (…/arcgis). For roots, we fetch the server's own catalog
 * (rest/services?f=json), find services named like permit/building, list
 * their layers, and try those — so we never have to guess service names.
 * Every attempt is recorded and surfaced in the Live chip diagnostics.
 *
 * The attribute normalizer is generic (keys matched by pattern), handles
 * ArcGIS epoch-ms dates, point geometry, and polygon centroids (parcel
 * layers), with a city-center sanity check for exact-pin accuracy.
 */
import type { Development, ProductType, DevStatus } from "@/data/developments";
import type { CityResult } from "./socrata";

export interface ArcgisCitySource {
  city: string;
  state: string;
  /** Direct layer URLs (…/FeatureServer/0) or server roots (…/arcgis). */
  candidates: string[];
  metroPpsf: number;
  lat: number;
  lng: number;
  limit?: number;
  /**
   * The layer itself is scoped to new-residential permits (its service
   * definition says so), so rows without descriptive text fields must not be
   * dropped by the residential/new keyword filter — only obvious remodels.
   */
  residentialNewOnly?: boolean;
}

export const ARCGIS_SOURCES: ArcgisCitySource[] = [
  {
    city: "Miami",
    state: "FL",
    candidates: [
      // City of Miami "Building Permits Since 2014" — carries the contractor
      // (CompanyName), PermitNumber, IssuedDate, TotalSQFT straight from the
      // city's permitting system. County roots stay as fallback discovery.
      // NOTE: the previous services6/ONZht79c8QWuX759 URL was a FALSE POSITIVE
      // (Peel Region, Ontario — serves housing-unit aggregates, a known trap
      // in ArcGIS search; caught by the data canary). CvuPhqcTQpZPT9qY is the
      // real City of Miami org.
      "https://services1.arcgis.com/CvuPhqcTQpZPT9qY/arcgis/rest/services/Building_Permits_Since_2014/FeatureServer/0",
      "https://gisweb.miamidade.gov/arcgis", // confirmed reachable — discover its permit services
      "https://gis.miamidade.gov/arcgis",
    ],
    metroPpsf: 800,
    lat: 25.76,
    lng: -80.19,
    limit: 3000,
  },
  {
    city: "Nashville",
    state: "TN",
    candidates: [
      // Metro Nashville's hosted "Building Permits Issued" layer (AGOL org
      // HdTo6HJqh92wn4D8): Permit__, Date_Issued, Contact, Const_Cost, Lat/Lon.
      // maps.nashville.gov root is dead — do not re-add it.
      "https://services2.arcgis.com/HdTo6HJqh92wn4D8/arcgis/rest/services/Building_Permits_Issued_2/FeatureServer/0",
    ],
    metroPpsf: 276,
    lat: 36.16,
    lng: -86.78,
    limit: 3000,
  },
  {
    city: "Dallas",
    state: "TX",
    candidates: [
      "https://gis.dallascityhall.com/wwwgis",
      "https://gis.dallascityhall.com/arcgis",
    ],
    metroPpsf: 360,
    lat: 32.78,
    lng: -96.80,
    limit: 3000,
  },
  {
    city: "Denver",
    state: "CO",
    candidates: [
      // Open Data Catalog residential-construction-permit layer: PERMIT_NUM,
      // DATE_ISSUED, CONTRACTOR_NAME, VALUATION, UNITS; location is
      // geometry-only (outSR=4326 handles the reprojection).
      "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_DEV_RESIDENTIALCONSTPERMIT_P/FeatureServer/316",
    ],
    metroPpsf: 354,
    lat: 39.74,
    lng: -104.99,
    limit: 3000,
    residentialNewOnly: true,
  },
  {
    city: "Houston",
    state: "TX",
    candidates: [
      // City of Houston publishes no confirmed open permit feed; the COH layer
      // is a best-effort guess and Harris County covers unincorporated areas
      // (PERMITNUMBER, ISSUEDDATE, APPLICANTNAME). mycity.houstontx.gov is dead.
      "https://services.arcgis.com/su8ic9KbA7PYVxPS/arcgis/rest/services/COH_BUILDING_PERMITS/FeatureServer/0",
      "https://www.gis.hctx.net/arcgishcpid/rest/services/Permits/IssuedPermits/FeatureServer/0",
    ],
    metroPpsf: 179,
    lat: 29.76,
    lng: -95.37,
    limit: 3000,
  },
  {
    city: "Portland",
    state: "OR",
    candidates: [
      // BDS permit layer (APPLICATION, ISSUED epoch-ms, FINALVALUATION).
      // Server 403s non-browser user agents — fine in-app, expect it in CI.
      "https://www.portlandmaps.com/arcgis/rest/services/Public/BDS_Permit/FeatureServer/22",
    ],
    metroPpsf: 321,
    lat: 45.51,
    lng: -122.68,
    limit: 3000,
  },
  {
    city: "Washington",
    state: "DC",
    candidates: [
      // DCRA feeds: /18 = permits issued 2026 (current-year layer), /4 =
      // rolling 30 days. Source is wkid 26985 (MD state plane) — outSR=4326.
      "https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/18",
      "https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/DCRA/FeatureServer/4",
    ],
    metroPpsf: 480,
    lat: 38.90,
    lng: -77.03,
    limit: 3000,
  },
  {
    city: "Baltimore",
    state: "MD",
    candidates: [
      // DHCD Open Baltimore layer 3 = building permits (CaseNumber,
      // IssuedDate; no contractor/valuation fields published).
      "https://egisdata.baltimorecity.gov/egis/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer/3",
      "https://baltegis.baltimorecity.gov/egis/rest/services/Housing/DHCD_Open_Baltimore_Datasets/FeatureServer/3",
    ],
    metroPpsf: 156,
    lat: 39.29,
    lng: -76.61,
    limit: 3000,
  },
  {
    city: "Sacramento",
    state: "CA",
    candidates: [
      // City current-year issued permits (Application, Contractor, Valuation);
      // county layer as fallback coverage.
      "https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/BldgPermitIssued_CurrentYear/FeatureServer/0",
      "https://services1.arcgis.com/5NARefyPVtAeuJPU/arcgis/rest/services/Permits/FeatureServer/0",
    ],
    metroPpsf: 330,
    lat: 38.58,
    lng: -121.49,
    limit: 3000,
  },
  {
    city: "Boise",
    state: "ID",
    candidates: [
      // Housing_OpenData is new-residential-only by definition (IssuedDate).
      "https://services1.arcgis.com/WHM6qC35aMtyAAlN/arcgis/rest/services/Housing_OpenData/FeatureServer/0",
    ],
    metroPpsf: 335,
    lat: 43.62,
    lng: -116.20,
    limit: 3000,
    residentialNewOnly: true,
  },
  {
    city: "Minneapolis",
    state: "MN",
    candidates: [
      // CCS_Permits: permitNumber, issueDate, applicantName, value, Lat/Lon.
      "https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/CCS_Permits/FeatureServer/0",
    ],
    metroPpsf: 246,
    lat: 44.98,
    lng: -93.27,
    limit: 3000,
  },
  {
    city: "Detroit",
    state: "MI",
    candidates: [
      // BSEED building permits: record_id, issued_date,
      // amt_estimated_contractor_cost.
      "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0",
    ],
    metroPpsf: 77,
    lat: 42.33,
    lng: -83.05,
    limit: 3000,
  },
  {
    city: "Columbus",
    state: "OH",
    candidates: [
      // Accela extract: B1_ALT_ID, ISSUED_DT, APPLICANT_BUS_NAME, G3_VALUE_TTL.
      "https://services1.arcgis.com/9yy6msODkIBzkUXU/arcgis/rest/services/Building_Permits/FeatureServer/0",
    ],
    metroPpsf: 183,
    lat: 39.96,
    lng: -83.00,
    limit: 3000,
  },
  {
    city: "Atlanta",
    state: "GA",
    candidates: [
      // AMS building permits layer 66: RECORD_ID, DATE_OPENED, JOB_VALUE,
      // Latitude/Longitude; "latest" layer as fallback.
      "https://services5.arcgis.com/5RxyIIJ9boPdptdo/arcgis/rest/services/AMS_BuildingPermits/FeatureServer/66",
      "https://services5.arcgis.com/5RxyIIJ9boPdptdo/arcgis/rest/services/Building_Permit_latest/FeatureServer/0",
    ],
    metroPpsf: 242,
    lat: 33.75,
    lng: -84.39,
    limit: 3000,
  },
  {
    city: "Charlotte",
    state: "NC",
    candidates: [
      // Mecklenburg County (covers Charlotte): permitnum, issuedate, bldgcost,
      // totalsqft; location is geometry-only.
      "https://meckgis.mecklenburgcountync.gov/server/rest/services/BuildingPermits/FeatureServer/0",
    ],
    metroPpsf: 228,
    lat: 35.23,
    lng: -80.84,
    limit: 3000,
  },
  {
    city: "Raleigh",
    state: "NC",
    candidates: [
      // Full history layer: permitnum, issueddate, contractorcompanyname,
      // estprojectcost, totalsqft; rolling windows as fallbacks.
      "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Building_Permits/FeatureServer/0",
      "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Building_Permits_Issued_Past_180_Days/FeatureServer/0",
    ],
    metroPpsf: 233,
    lat: 35.78,
    lng: -78.64,
    limit: 3000,
  },
  {
    city: "Tampa",
    state: "FL",
    candidates: [
      // Planning/PermitsAll (CREATEDDATE; low volume, no contractor field).
      "https://arcgis.tampagov.net/arcgis/rest/services/Planning/PermitsAll/MapServer/0",
    ],
    metroPpsf: 300,
    lat: 27.95,
    lng: -82.46,
    limit: 3000,
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

interface ArcgisGeometry { x?: number; y?: number; rings?: number[][][] }
interface ArcgisResponse {
  error?: { code?: number; message?: string };
  fields?: { name: string }[];
  features?: { attributes?: Attrs; geometry?: ArcgisGeometry }[];
}

/** True when a coordinate sits exactly on a 3-decimal grid (≈111 m). */
const tooCoarse = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-9;

function geomToLatLng(g: ArcgisGeometry | undefined): { lat: number; lng: number } | null {
  if (!g) return null;
  if (Number.isFinite(g.x) && Number.isFinite(g.y)) return { lat: g.y as number, lng: g.x as number };
  // Polygon (parcel) layers: centroid of the first ring.
  const ring = g.rings?.[0];
  if (ring && ring.length > 2) {
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    const lat = sy / ring.length, lng = sx / ring.length;
    // Rings can arrive in Web Mercator meters or with holes — only trust
    // finite results that are actually plausible degrees.
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const isLayerUrl = (u: string) => /(FeatureServer|MapServer)\/\d+\/?$/.test(u);

const SERVICE_RE = /permit|bldg|building|construct|develop|epermit|bnzap|inspection|planning/i;

/** Crawl an ArcGIS server catalog (ALL folders) for permit-like layers. */
async function discoverPermitLayers(root: string, notes: string[]): Promise<string[]> {
  const out: string[] = [];
  try {
    const cat = (await getJson(`${root}/rest/services?f=json`)) as { services?: { name: string; type: string }[]; folders?: string[] };
    const entries = [...(cat.services ?? [])];
    const folders = (cat.folders ?? []).slice(0, 25); // crawl everything, bounded
    const subs = await Promise.all(
      folders.map((f) => getJson(`${root}/rest/services/${f}?f=json`).catch(() => null)),
    );
    for (const sub of subs) {
      const s = sub as { services?: { name: string; type: string }[] } | null;
      if (s?.services) entries.push(...s.services);
    }
    const matches = entries
      .filter((s) => (s.type === "MapServer" || s.type === "FeatureServer") && SERVICE_RE.test(s.name))
      .slice(0, 5);
    if (matches.length === 0) {
      // Self-documenting: report what the catalog ACTUALLY contains so the
      // next diagnostic screenshot names the real services to target.
      const names = entries.map((e) => e.name).slice(0, 25).join(", ");
      notes.push(`${root}: no permit-named services. Catalog: ${names}`.slice(0, 500));
    }
    for (const s of matches) {
      const svcUrl = `${root}/rest/services/${s.name}/${s.type}`;
      try {
        const svc = (await getJson(`${svcUrl}?f=json`)) as { layers?: { id: number; name: string }[] };
        for (const l of (svc.layers ?? []).slice(0, 6)) out.push(`${svcUrl}/${l.id}`);
      } catch (e) {
        notes.push(`${svcUrl}: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    notes.push(`${root}: catalog ${(e as Error).message}`);
  }
  return out.slice(0, 10);
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
  let data = (await getJson(url)) as ArcgisResponse;
  if (data.error) {
    // Hosted layers whose OID field isn't literally OBJECTID (FID, ESRI_OID…)
    // reject the orderBy — retry unordered rather than losing the whole city.
    params.delete("orderByFields");
    const retryUrl = `${layerUrl}/query?${params.toString()}`;
    data = (await getJson(retryUrl)) as ArcgisResponse;
    if (data.error) throw new Error(`ArcGIS ${data.error.code ?? ""}: ${data.error.message ?? "error"}`);
    return { data, url: retryUrl };
  }
  return { data, url };
}

function normalize(src: ArcgisCitySource, data: ArcgisResponse): { items: Development[]; ppsfSamples: number[]; columns: string[] } {
  const features = data.features ?? [];
  const columns = data.fields?.map((f) => f.name) ?? Object.keys(features[0]?.attributes ?? {});
  const seen = new Set<string>();
  const items: Development[] = [];
  const ppsfSamples: number[] = [];

  for (const f of features) {
    const attrs = f.attributes ?? {};
    const coords = geomToLatLng(f.geometry);
    if (!coords) continue;
    if (Math.abs(coords.lat - src.lat) > 1.2 || Math.abs(coords.lng - src.lng) > 1.2) continue;
    // Accuracy tier: coordinates on a ≤3-decimal grid (~111 m) mean the city
    // geocoded to a block/zip centroid, not the parcel — drop, don't mislead.
    if (tooCoarse(coords.lat) && tooCoarse(coords.lng)) continue;

    const blob = textBlob(attrs, /type|class|desc|work|use|scope|category|status/i);
    const isResidential = /resid|family|duplex|town|apartment|condo|dwelling|sfr/i.test(blob);
    const isNew = /new construction|new building|new dwelling|\bnew\b/i.test(blob);
    const isRemodel = /remodel|repair|addition|alteration|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|shutter|awning|revision/i.test(blob);
    if (isRemodel) continue;
    // Layers scoped to new-residential by definition keep rows even when the
    // record carries no descriptive text for the keyword filter to see.
    if (!src.residentialNewOnly && (!isResidential || !isNew)) continue;

    const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
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

    items.push({
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
      stories: type === "SFH" || type === "Infill" ? 2 : 3,
      status: statusFrom(blob),
      approvedDate: issued || "—",
      estValue,
      pricePerSqft,
      description: `${type} new-construction permit — real public record${valuation > 0 ? ` · declared valuation $${valuation.toLocaleString("en-US")}` : ""}.`,
      sqftEstimated: sqftRaw == null,
    });
  }

  return { items, ppsfSamples, columns };
}

export async function fetchArcgisCity(src: ArcgisCitySource): Promise<CityResult> {
  const limit = src.limit ?? 2000;
  const notes: string[] = [];

  // Expand server roots into concrete layer URLs via catalog discovery.
  const layerUrls: string[] = [];
  for (const c of src.candidates) {
    if (isLayerUrl(c)) layerUrls.push(c);
    else layerUrls.push(...(await discoverPermitLayers(c, notes)));
  }
  if (layerUrls.length === 0) {
    return {
      city: src.city, items: [], total: 0, columns: [], url: src.candidates[0],
      buildPpsfSamples: 0, error: (notes.join(" · ") || "no layers discovered").slice(0, 400),
    };
  }

  let lastColumns: string[] = [];
  let lastUrl = layerUrls[0];
  let lastTotal = 0;

  for (const layer of layerUrls) {
    try {
      const { data, url } = await queryLayer(layer, limit);
      lastUrl = url;
      lastTotal = data.features?.length ?? 0;
      const norm = normalize(src, data);
      lastColumns = norm.columns;
      if (norm.items.length > 0) {
        norm.items.sort((a, b) => (a.approvedDate > b.approvedDate ? -1 : 1));
        norm.ppsfSamples.sort((a, b) => a - b);
        const medianBuildPpsf = norm.ppsfSamples.length >= 5
          ? Math.round(norm.ppsfSamples[Math.floor(norm.ppsfSamples.length / 2)])
          : undefined;
        return {
          city: src.city, items: norm.items.slice(0, 500), total: lastTotal, columns: norm.columns, url,
          medianBuildPpsf, buildPpsfSamples: norm.ppsfSamples.length,
          error: notes.length ? `notes: ${notes.join(" · ").slice(0, 200)}` : undefined,
        };
      }
      notes.push(`${layer} → ${lastTotal} rows, 0 matched`);
    } catch (e) {
      notes.push(`${layer} → ${(e as Error).message}`);
    }
  }

  return {
    city: src.city, items: [], total: lastTotal, columns: lastColumns, url: lastUrl,
    buildPpsfSamples: 0, error: notes.join(" · ").slice(0, 400),
  };
}
