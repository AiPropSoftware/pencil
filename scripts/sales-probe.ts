/**
 * Sales probe, round 5 — the two loose ends from round 4:
 *   1. Pittsburgh / Allegheny County via WPRDC CKAN SQL, now against the
 *      LIVE resource id the round-4 scout found (the guessed one was the
 *      deprecated copy). Also checks for lat/lng columns and a bbox query.
 *   2. Maryland iMAP SDAT retry (was 503 "Site Maintenance" twice).
 * Runner-only; not in the app bundle.
 */

const realFetch = globalThis.fetch;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function get(url: string): Promise<{ status: number; json: unknown | null; text: string }> {
  try {
    const res = await realFetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    const text = await res.text();
    try { return { status: res.status, json: JSON.parse(text), text: "" }; }
    catch { return { status: res.status, json: null, text: text.slice(0, 120) }; }
  } catch (e) {
    return { status: 0, json: null, text: (e as Error).message.slice(0, 120) };
  }
}

console.log("═══ PITTSBURGH WPRDC (live resource 65855e14…) ═══");
{
  const RES = "65855e14-549e-4992-b5be-d629afc676fa";
  // 1) column discovery
  const meta = await get(`https://data.wprdc.org/api/3/action/datastore_search?resource_id=${RES}&limit=1`);
  const mj = meta.json as { success?: boolean; result?: { fields?: { id: string }[]; records?: Record<string, unknown>[] } } | null;
  const cols = (mj?.result?.fields ?? []).map((f) => f.id);
  console.log("columns:", cols.join(",").slice(0, 800) || `HTTP ${meta.status} ${meta.text}`);
  // 2) SQL with sale filter at a Pittsburgh point, if lat/lng-ish columns exist
  const latCol = cols.find((c) => /^lat/i.test(c));
  const lngCol = cols.find((c) => /^(lon|lng)/i.test(c));
  const addrCol = cols.find((c) => /PROPERTYADDRESS|ADDRESS/i.test(c));
  console.log("coords:", latCol && lngCol ? `${latCol}/${lngCol}` : "NONE", "addr:", addrCol ?? "NONE");
  if (latCol && lngCol) {
    const sql =
      `SELECT "${addrCol}","SALEPRICE","SALEDATE","FINISHEDLIVINGAREA","${latCol}","${lngCol}" ` +
      `FROM "${RES}" WHERE "SALEPRICE" > 40000 ` +
      `AND "${latCol}"::float > 40.435 AND "${latCol}"::float < 40.447 ` +
      `AND "${lngCol}"::float > -80.008 AND "${lngCol}"::float < -79.985 ` +
      `ORDER BY "SALEDATE" DESC LIMIT 3`;
    const r = await get(`https://data.wprdc.org/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`);
    const j = r.json as { result?: { records?: unknown[] }; error?: unknown } | null;
    console.log(JSON.stringify({
      sql_bbox: j?.result?.records ? `${j.result.records.length} rows` : `FAIL HTTP ${r.status} ${JSON.stringify(j?.error ?? r.text).slice(0, 220)}`,
      sample: j?.result?.records?.[0] ? JSON.stringify(j.result.records[0]).slice(0, 300) : undefined,
    }, null, 1));
  } else {
    // Plain filtered search still proves price/date/addr freshness.
    const r = await get(`https://data.wprdc.org/api/3/action/datastore_search?resource_id=${RES}&limit=2&filters=${encodeURIComponent('{"PROPERTYCITY":"PITTSBURGH"}')}`);
    const j = r.json as { result?: { records?: Record<string, unknown>[] } } | null;
    console.log("plain search:", j?.result?.records ? JSON.stringify(j.result.records[0]).slice(0, 300) : `HTTP ${r.status}`);
  }
}

console.log("\n═══ MD iMAP RETRY #2 ═══");
{
  const L = "https://geodata.md.gov/imap/rest/services/PlanningCadastre/MD_PropertyData/MapServer/0";
  const meta = await get(`${L}?f=json`);
  const m = meta.json as { fields?: { name: string }[] } | null;
  if (!m?.fields) {
    console.log(`still down: HTTP ${meta.status} ${meta.text}`);
  } else {
    const names = m.fields.map((f) => f.name);
    console.log("fields:", names.filter((n) => /sale|consid|tradate|trans|addr|sqft|struct/i.test(n)).join(",").slice(0, 300));
    const q = `${L}/query?f=json&where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=true&outSR=4326&inSR=4326&spatialRel=esriSpatialRelIntersects` +
      `&geometry=-76.618,39.284,-76.606,39.296&geometryType=esriGeometryEnvelope`;
    const near = await get(q);
    const nr = near.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
    console.log(nr?.features
      ? `envelope: ${nr.features.length} rows — ${JSON.stringify(Object.fromEntries(Object.entries(nr.features[0]?.attributes ?? {}).filter(([k]) => /CONSIDR|TRADATE|ADDRESS|SQFT|STRTNAM/i.test(k)))).slice(0, 300)}`
      : `envelope FAIL ${JSON.stringify(nr?.error ?? near.text).slice(0, 140)}`);
  }
}
console.log("\nPROBE DONE");
