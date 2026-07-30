/**
 * Coverage probe v2 — diagnoses WHY cities yield few/zero bubbles, from a
 * GitHub runner (open egress). For every source it fetches rows the way the
 * app does, then replays the app's normalizer gates step by step and reports
 * where rows die: no coordinates, out of bounding box, coarse grid, or which
 * text-filter condition failed — plus the actual field values involved, so
 * filter fixes are grounded in real data instead of guesses.
 *
 * Also scouts open-data catalogs for geocoded replacement datasets for the
 * cities whose wired dataset carries no coordinates at all.
 *
 * Run via the Coverage probe workflow (workflow_dispatch). Not in the bundle.
 */
import { CITY_SOURCES, type CitySource } from "../src/providers/permits/socrata";
import { ARCGIS_SOURCES, type ArcgisCitySource } from "../src/providers/permits/arcgis";

// The app runs in a browser, which always sends a UA — several Socrata CDNs
// reject UA-less requests (probe artifact, not an app failure). Mimic it.
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: any, init: any = {}) =>
  realFetch(url, {
    ...init,
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", accept: "application/json", ...(init.headers || {}) },
  })) as typeof fetch;

const N = 2000;
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
const top = (m: Map<string, number>, n = 6) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k}×${c}`);

async function j(url: string): Promise<any> {
  const res = await realFetch(url, { headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- fetch rows the way the app does --------------------------------------
async function socrataRows(src: CitySource): Promise<Record<string, unknown>[]> {
  if (src.kind === "ckan") {
    let d = await j(`${src.url}&limit=${N}&sort=${encodeURIComponent("_id desc")}`).catch(() => null);
    if (!d?.result?.records?.length) d = await j(`${src.url}&limit=${N}`).catch(() => null);
    return d?.result?.records ?? [];
  }
  if (src.kind === "carto") {
    const q = (src.cartoQuery ?? "").replace("{limit}", String(N));
    const d = await j(`${src.url}?q=${encodeURIComponent(q)}`).catch(() => null);
    return d?.rows ?? [];
  }
  let d = await j(`${src.url}?$limit=${N}&$order=${encodeURIComponent(":id DESC")}`).catch(() => null);
  if (!Array.isArray(d)) d = await j(`${src.url}?$limit=${N}`).catch(() => null);
  return Array.isArray(d) ? d : [];
}

async function arcgisRows(src: ArcgisCitySource): Promise<Record<string, unknown>[]> {
  for (const c of src.candidates) {
    if (!/(FeatureServer|MapServer)\/\d+\/?$/.test(c)) continue;
    const base = `${c}/query?where=1%3D1&outFields=*&outSR=4326&f=json&resultRecordCount=${N}`;
    let d = await j(`${base}&orderByFields=OBJECTID%20DESC`).catch(() => null);
    if (!d || d.error || !d.features?.length) d = await j(base).catch(() => null);
    const feats = d?.features ?? [];
    if (!feats.length) continue;
    return feats.map((f: any) => {
      const g = f.geometry ?? {};
      let lat: number | undefined, lng: number | undefined;
      if (Number.isFinite(g.x) && Number.isFinite(g.y)) { lat = g.y; lng = g.x; }
      else if (g.rings?.[0]?.length > 2) {
        let sx = 0, sy = 0;
        for (const [x, y] of g.rings[0]) { sx += x; sy += y; }
        lat = sy / g.rings[0].length; lng = sx / g.rings[0].length;
      }
      return { ...(f.attributes ?? {}), __lat: lat, __lng: lng };
    });
  }
  return [];
}

// ---- replay the app's gates, counting where rows die -----------------------
function coordsFrom(row: Record<string, unknown>): { lat: number; lng: number } | null {
  if (Number.isFinite(row.__lat as number) && Number.isFinite(row.__lng as number))
    return { lat: row.__lat as number, lng: row.__lng as number };
  const lat = num(pick(row, ["latitude", "lat", "gis_latitude", "y_coordinate", "y", "y_latitude", "Y_COORD", "Latitude"]));
  const lng = num(pick(row, ["longitude", "long", "lng", "gis_longitude", "x_coordinate", "x", "x_longitude", "X_COORD", "Longitude"]));
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) return { lat, lng };
  for (const key of ["location", "mapped_location", "location_1", "the_geom", "geocoded_column", "point", "geolocation"]) {
    const v = row[key] as Record<string, unknown> | undefined;
    if (!v || typeof v !== "object") continue;
    const coords = (v as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) return { lat: Number(coords[1]), lng: Number(coords[0]) };
    const la2 = num(v.latitude), lo2 = num(v.longitude);
    if (Number.isFinite(la2) && Number.isFinite(lo2)) return { lat: la2, lng: lo2 };
  }
  return null;
}
const tooCoarse = (n: number) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-9;

interface Diag {
  city: string; pipeline: string; rows: number;
  noCoords: number; outOfBox: number; coarse: number;
  notBuilding: number; notResidential: number; remodel: number; notNew: number; pass: number;
  workTop: string[]; typeTop: string[]; failBlobs: string[]; rowKeys: string;
}

function diagSocrata(src: CitySource, rows: Record<string, unknown>[]): Diag {
  const d: Diag = { city: src.city, pipeline: src.kind ?? "socrata", rows: rows.length, noCoords: 0, outOfBox: 0, coarse: 0, notBuilding: 0, notResidential: 0, remodel: 0, notNew: 0, pass: 0, workTop: [], typeTop: [], failBlobs: [], rowKeys: "" };
  const workCounts = new Map<string, number>(), typeCounts = new Map<string, number>();
  for (const r of rows) {
    const coords = coordsFrom(r);
    if (!coords) { d.noCoords++; continue; }
    if (Math.abs(coords.lat - src.lat) > 1.2 || Math.abs(coords.lng - src.lng) > 1.2) { d.outOfBox++; continue; }
    if (tooCoarse(coords.lat) && tooCoarse(coords.lng)) { d.coarse++; continue; }
    const typeDesc = String(pick(r, ["permit_type_desc", "permit_type", "permittype", "permit_type_definition", "permittypedesc", "permit_type_description"]) ?? "");
    const pclass = String(pick(r, ["permit_class", "permit_class_mapped", "permitclass", "permitclassmapped"]) ?? "");
    const work = String(pick(r, ["work_class", "work_type", "job_type", "worktype", "typeofwork", "WORK TYPE", "Permit Type"]) ?? "");
    const desc = String(pick(r, ["description", "work_description", "purpose", "job_description", "proposed_use", "permitdescription", "approvedscopeofwork", "WORKDESCRIPTION", "PROJECT NAME"]) ?? "");
    const blob = `${typeDesc} ${pclass} ${work} ${desc}`;
    workCounts.set(work.slice(0, 30) || "∅", (workCounts.get(work.slice(0, 30) || "∅") ?? 0) + 1);
    typeCounts.set(typeDesc.slice(0, 30) || "∅", (typeCounts.get(typeDesc.slice(0, 30) || "∅") ?? 0) + 1);
    const residentialFlag = String(pick(r, ["residential"]) ?? "").toLowerCase();
    const isBuilding = /building|construction/i.test(blob) || typeDesc === "";
    const isResidential = residentialFlag === "yes" || /resid|family|duplex|town|apartment|condo|dwelling|sfr|r-?\s*1\d\d/i.test(blob);
    const isRemodel = /remodel|repair|addition|alteration|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|irrigation|revision/i.test(blob);
    const isNew = /\bnb\b|new/i.test(work) || /new construction|new building|new dwelling/i.test(blob) || work === "";
    const nyc = residentialFlag === "yes" && /\bnb\b/i.test(work);
    if (nyc || (isBuilding && isResidential && !isRemodel && isNew)) { d.pass++; continue; }
    if (!isBuilding) d.notBuilding++;
    else if (isRemodel) d.remodel++;
    else if (!isResidential) d.notResidential++;
    else d.notNew++;
    if (d.failBlobs.length < 4) d.failBlobs.push(blob.slice(0, 110));
  }
  if (d.noCoords === d.rows && rows.length) d.rowKeys = Object.keys(rows[0]).join(",").slice(0, 260);
  d.workTop = top(workCounts); d.typeTop = top(typeCounts);
  return d;
}

function diagArcgis(src: ArcgisCitySource, rows: Record<string, unknown>[]): Diag {
  const d: Diag = { city: src.city, pipeline: "arcgis", rows: rows.length, noCoords: 0, outOfBox: 0, coarse: 0, notBuilding: 0, notResidential: 0, remodel: 0, notNew: 0, pass: 0, workTop: [], typeTop: [], failBlobs: [], rowKeys: "" };
  const blobCounts = new Map<string, number>();
  for (const r of rows) {
    const coords = coordsFrom(r);
    if (!coords) { d.noCoords++; continue; }
    if (Math.abs(coords.lat - src.lat) > 1.2 || Math.abs(coords.lng - src.lng) > 1.2) { d.outOfBox++; continue; }
    if (tooCoarse(coords.lat) && tooCoarse(coords.lng)) { d.coarse++; continue; }
    const blob = Object.entries(r)
      .filter(([k, v]) => /type|class|desc|work|use|scope|category|status/i.test(k) && typeof v === "string" && (v as string).length < 300)
      .map(([, v]) => v).join(" ");
    blobCounts.set(blob.slice(0, 40) || "∅", (blobCounts.get(blob.slice(0, 40) || "∅") ?? 0) + 1);
    const isResidential = /resid|family|duplex|town|apartment|condo|dwelling|sfr/i.test(blob);
    const isNew = /new construction|new building|new dwelling|\bnew\b/i.test(blob);
    const isRemodel = /remodel|repair|addition|alteration|demo|interior|reroof|roof|mechanic|electric|plumb|hvac|pool|fence|sign|solar|shutter|awning|revision/i.test(blob);
    if (isRemodel) { d.remodel++; if (d.failBlobs.length < 4) d.failBlobs.push(blob.slice(0, 110)); continue; }
    if (!src.residentialNewOnly && (!isResidential || !isNew)) {
      if (!isResidential) d.notResidential++; else d.notNew++;
      if (d.failBlobs.length < 4) d.failBlobs.push(blob.slice(0, 110));
      continue;
    }
    d.pass++;
  }
  if (d.noCoords === d.rows && rows.length) d.rowKeys = Object.keys(rows[0]).join(",").slice(0, 260);
  d.workTop = top(blobCounts); d.typeTop = [];
  return d;
}

// ---- catalog scout for datasets with real coordinates ----------------------
async function scout(host: string, label: string) {
  try {
    const cat = await j(`https://${host}/api/catalog/v1?q=permit&only=datasets&limit=9&search_context=${host}`);
    const hits = (cat.results || []).map((r: any) => `${r.resource?.id} "${String(r.resource?.name).slice(0, 60)}" cols:${(r.resource?.columns_field_name || []).filter((c: string) => /lat|lon|location|geo|point/i.test(c)).join("/") || "—"}`);
    console.log(`SCOUT ${label} (${host}):\n  ${hits.join("\n  ")}`);
  } catch (e) {
    console.log(`SCOUT ${label} (${host}): ${(e as Error).message}`);
  }
}

// ---- run -------------------------------------------------------------------
const out: Diag[] = [];
await Promise.all([
  ...CITY_SOURCES.map(async (s) => out.push(diagSocrata(s, await socrataRows(s).catch(() => [])))),
  ...ARCGIS_SOURCES.map(async (s) => out.push(diagArcgis(s, await arcgisRows(s).catch(() => [])))),
]);
out.sort((a, b) => a.pass - b.pass);
for (const d of out) {
  console.log(`\n=== ${d.city} [${d.pipeline}] rows=${d.rows} pass=${d.pass} | noCoords=${d.noCoords} outOfBox=${d.outOfBox} coarse=${d.coarse} notBldg=${d.notBuilding} notRes=${d.notResidential} remodel=${d.remodel} notNew=${d.notNew}`);
  if (d.rowKeys) console.log(`  ALL-NO-COORDS, columns: ${d.rowKeys}`);
  if (d.typeTop.length) console.log(`  type values: ${d.typeTop.join(" | ")}`);
  if (d.workTop.length) console.log(`  work/blob values: ${d.workTop.join(" | ")}`);
  if (d.failBlobs.length) console.log(`  failed blobs: ${d.failBlobs.map((b) => JSON.stringify(b)).join("  ")}`);
}
console.log("");
await scout("data.cityoforlando.net", "Orlando");
await scout("data.nola.gov", "New Orleans");
await scout("www.dallasopendata.com", "Dallas");
// Milwaukee is CKAN — package_search instead of Socrata catalog.
try {
  const mke = await j("https://data.milwaukee.gov/api/3/action/package_search?q=permit&rows=6");
  console.log(`SCOUT Milwaukee: ${(mke.result?.results || []).map((p: any) => `${p.name}: ${(p.resources || []).map((r: any) => `${r.id?.slice(0, 8)} ${String(r.name).slice(0, 40)}`).join("; ")}`).join("\n  ")}`);
} catch (e) {
  console.log(`SCOUT Milwaukee: ${(e as Error).message}`);
}
