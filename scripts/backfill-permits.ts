/**
 * Historical permit backfill — pages an ENTIRE ArcGIS permit layer, not just
 * its newest window, and banks every new-residential permit into the store.
 *
 * Why this exists: the daily ingest asks each portal for its newest ~2,000
 * records. Miami's layer holds permits since 2014 (~hundreds of thousands of
 * rows, ~99% trade permits), so the newest window yields only ~12 usable
 * new-residential permits — the other 12 years have never been fetched once.
 * This job walks the whole layer exactly once; the store is permanent and
 * id-deduplicated, so it never needs to run twice for the same history.
 *
 * Correctness rules (each one prevents a silent-data-loss mode):
 * - OID-cursor paging (where OID > last, order by OID asc): stable under
 *   concurrent edits, works even where resultOffset is ignored, and a page
 *   that repeats OIDs is detected as a hard error instead of looping.
 * - Server row count fetched up front (returnCountOnly) and compared at the
 *   end — a truncated sweep FAILS, it does not report success.
 * - The pinned layer only: no discovery ladder inside a paging loop.
 * - Same normalize() as the live app, but WITHOUT the 500-item cap.
 * - HTTP errors abort the run; they are never converted into empty pages.
 */
import { ARCGIS_SOURCES, normalize, type ArcgisResponse } from "../src/providers/permits/arcgis";

const realFetch = globalThis.fetch;
globalThis.fetch = ((url: any, init: any = {}) =>
  realFetch(url, {
    ...init,
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", ...(init.headers || {}) },
  })) as typeof fetch;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hhhpochstmzjglzyyvoj.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CITY = process.env.BACKFILL_CITY || "Miami";
const MAX_PAGES = Number(process.env.BACKFILL_MAX_PAGES || 400);
const THROTTLE_MS = 400;
const INGEST_RUN = `backfill-${process.env.GITHUB_RUN_ID ?? "local"}@${(process.env.GITHUB_SHA ?? "dev").slice(0, 7)}`;

if (!SERVICE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is not set.");
  process.exit(1);
}

const src = ARCGIS_SOURCES.find((s) => s.city.toLowerCase() === CITY.toLowerCase());
if (!src) {
  console.error(`FATAL: no ArcGIS source named "${CITY}". Available: ${ARCGIS_SOURCES.map((s) => s.city).join(", ")}`);
  process.exit(1);
}
const layer = src.candidates.find((c) => /(FeatureServer|MapServer)\/\d+\/?$/.test(c));
if (!layer) {
  console.error(`FATAL: ${src.city} has no pinned layer URL (discovery roots are not eligible for backfill).`);
  process.exit(1);
}

async function j(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} at ${url.slice(0, 140)}`);
  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS ${data.error.code}: ${data.error.message} at ${url.slice(0, 140)}`);
  return data;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- layer metadata: OID field, page-size ceiling ---------------------------
const meta = await j(`${layer}?f=json`);
const oidField: string =
  meta.objectIdField || meta.fields?.find((f: any) => f.type === "esriFieldTypeOID")?.name || "OBJECTID";
const useStandard =
  meta.advancedQueryCapabilities?.supportsQueryWithResultType === true &&
  Number(meta.standardMaxRecordCount) > Number(meta.maxRecordCount ?? 2000);
const pageSize = useStandard ? Math.min(Number(meta.standardMaxRecordCount), 32000) : Number(meta.maxRecordCount ?? 2000);
const serverTotal = (await j(`${layer}/query?where=1%3D1&returnCountOnly=true&f=json`)).count as number;
console.log(`${src.city} backfill: ${layer}`);
console.log(`OID field ${oidField}, page size ${pageSize}${useStandard ? " (resultType=standard)" : ""}, server holds ${serverTotal} rows.`);

// ---- upsert helper (provenance-aware, with column fallback) -----------------
async function upsert(rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const post = (body: string) =>
      realFetch(`${SUPABASE_URL}/rest/v1/permits?on_conflict=id`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body,
      });
    let res = await post(JSON.stringify(chunk));
    if (!res.ok) {
      const text = await res.text();
      if (/column|schema/i.test(text)) {
        const stripped = chunk.map(({ source_key: _a, source_url: _b, source_permit_no: _c, ingest_run: _d, ...rest }) => rest);
        res = await post(JSON.stringify(stripped));
        if (res.ok) continue;
        throw new Error(`upsert HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      throw new Error(`upsert HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
  }
}

// ---- the sweep --------------------------------------------------------------
const idPrefix = `live-${src.city.toLowerCase().replace(/\s+/g, "")}-`;
const coordKey = /^-?\d+\.\d{5},-?\d+\.\d{5}$/; // synthesized id = unaddressable row
const seenIds = new Set<string>();
let lastOid = -1;
let fetched = 0, kept = 0, skippedCoordKey = 0, pages = 0;
const now = new Date().toISOString();

while (pages < MAX_PAGES) {
  const params = new URLSearchParams({
    where: `${oidField} > ${lastOid}`,
    outFields: "*",
    outSR: "4326",
    f: "json",
    resultRecordCount: String(pageSize),
    orderByFields: `${oidField} ASC`,
  });
  if (useStandard) params.set("resultType", "standard");
  const data = (await j(`${layer}/query?${params.toString()}`)) as ArcgisResponse;
  const feats = data.features ?? [];
  if (feats.length === 0) break; // exhausted
  pages += 1;
  fetched += feats.length;

  const maxOid = Math.max(...feats.map((f) => Number(f.attributes?.[oidField] ?? -1)));
  if (!Number.isFinite(maxOid) || maxOid <= lastOid) {
    console.error(`FATAL: page ${pages} did not advance the OID cursor (last=${lastOid}, max=${maxOid}) — server is ignoring the query. Aborting rather than looping.`);
    process.exit(1);
  }
  lastOid = maxOid;

  const norm = normalize(src, data); // full app filtering, NO 500 cap
  const rows: Record<string, unknown>[] = [];
  for (const d of norm.items) {
    if (seenIds.has(d.id)) continue;
    seenIds.add(d.id);
    const permitNo = d.id.startsWith(idPrefix) ? d.id.slice(idPrefix.length) : d.id;
    if (coordKey.test(permitNo)) { skippedCoordKey += 1; continue; } // unaddressable — never bank
    rows.push({
      id: d.id,
      city: d.city, state: d.state, name: d.name, developer: d.developer,
      lat: d.lat, lng: d.lng, product_type: d.productType, units: d.units,
      land_sqft: d.landSqft, building_sqft: d.buildingSqft, stories: d.stories,
      status: d.status,
      approved_date: /^\d{4}-\d{2}-\d{2}/.test(d.approvedDate) ? d.approvedDate.slice(0, 10) : null,
      est_value: d.estValue, price_per_sqft: d.pricePerSqft,
      description: d.description, sqft_estimated: d.sqftEstimated,
      source_key: src.city, source_url: layer, source_permit_no: permitNo,
      ingest_run: INGEST_RUN, last_seen_at: now,
    });
  }
  if (rows.length) await upsert(rows);
  kept += rows.length;
  console.log(`page ${pages}: ${feats.length} rows (OID ≤ ${lastOid}) → ${rows.length} new-residential banked (running: ${fetched} fetched, ${kept} kept)`);
  await sleep(THROTTLE_MS);
}

// ---- verification -----------------------------------------------------------
if (pages >= MAX_PAGES) {
  console.error(`FATAL: hit the ${MAX_PAGES}-page bound before exhausting the layer (${fetched}/${serverTotal} rows seen). Raise BACKFILL_MAX_PAGES and re-run — the cursor design makes re-runs resume-safe.`);
  process.exit(1);
}
if (fetched < serverTotal * 0.98) {
  console.error(`FATAL: sweep saw ${fetched} rows but the server reported ${serverTotal} — a truncated sweep is not a success.`);
  process.exit(1);
}
const head = await realFetch(`${SUPABASE_URL}/rest/v1/permits?select=id&city=eq.${encodeURIComponent(src.city)}`, {
  method: "HEAD",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", Range: "0-0" },
});
const cityTotal = head.headers.get("content-range")?.split("/")[1] ?? "?";
console.log(`\nDONE: swept ${fetched}/${serverTotal} rows in ${pages} pages · kept ${kept} new-residential permits (${skippedCoordKey} skipped for having no real permit number) · ${src.city} now holds ${cityTotal} permits in the store.`);
