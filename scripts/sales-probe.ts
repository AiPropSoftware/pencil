/**
 * Sales probe, round 6 — Pittsburgh completion: the assessments resource has
 * price/date/address but no coordinates (round 5), so hunt WPRDC for the
 * parcel-centroids dataset and verify a Cook-style two-leg join:
 *   leg 1: centroids bbox → PARIDs + lat/lng
 *   leg 2: assessments by PARID IN(...) with a sale filter
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

const ASSESS = "65855e14-549e-4992-b5be-d629afc676fa";

console.log("═══ SCOUT: WPRDC parcel centroids ═══");
const candidates: { id: string; name: string }[] = [];
for (const q of ["parcel centroids", "parcel boundaries centroid", "addressing points"]) {
  const cat = await get(`https://data.wprdc.org/api/3/action/package_search?q=${encodeURIComponent(q)}&rows=4`);
  const c = cat.json as { result?: { results?: { name?: string; resources?: { id?: string; name?: string; datastore_active?: boolean }[] }[] } } | null;
  for (const p of c?.result?.results ?? []) {
    for (const r of (p.resources ?? []).filter((x) => x.datastore_active && x.id)) {
      if (!candidates.some((x) => x.id === r.id)) candidates.push({ id: r.id!, name: `${p.name}: ${r.name}`.slice(0, 70) });
    }
  }
}
console.log(candidates.map((c) => `${c.id} "${c.name}"`).join("\n").slice(0, 1500));

console.log("\n═══ TEST CANDIDATES (columns + bbox SQL) ═══");
let joinParcelRes: { id: string; latCol: string; lngCol: string; pinCol: string } | null = null;
for (const c of candidates.slice(0, 6)) {
  const meta = await get(`https://data.wprdc.org/api/3/action/datastore_search?resource_id=${c.id}&limit=1`);
  const mj = meta.json as { result?: { fields?: { id: string }[] } } | null;
  const cols = (mj?.result?.fields ?? []).map((f) => f.id);
  const latCol = cols.find((x) => /^(lat|y|intptlat)/i.test(x) && !/long/i.test(x));
  const lngCol = cols.find((x) => /^(lon|lng|x|intptlon)/i.test(x));
  const pinCol = cols.find((x) => /^(PIN|PARID|parcel)/i.test(x));
  console.log(JSON.stringify({ id: c.id, name: c.name, coords: latCol && lngCol ? `${latCol}/${lngCol}` : "NONE", pin: pinCol ?? "NONE", cols: cols.join(",").slice(0, 200) }));
  if (!latCol || !lngCol || !pinCol) continue;
  const sql =
    `SELECT "${pinCol}","${latCol}","${lngCol}" FROM "${c.id}" ` +
    `WHERE "${latCol}"::float > 40.435 AND "${latCol}"::float < 40.447 ` +
    `AND "${lngCol}"::float > -80.008 AND "${lngCol}"::float < -79.985 LIMIT 5`;
  const r = await get(`https://data.wprdc.org/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql)}`);
  const j = r.json as { result?: { records?: Record<string, unknown>[] }; error?: unknown } | null;
  const rows = j?.result?.records ?? [];
  console.log(`  bbox SQL: ${rows.length ? `${rows.length} rows, e.g. ${JSON.stringify(rows[0]).slice(0, 140)}` : `FAIL ${JSON.stringify(j?.error ?? r.text).slice(0, 160)}`}`);
  if (rows.length && !joinParcelRes) {
    joinParcelRes = { id: c.id, latCol, lngCol, pinCol };
    // leg 2: assessments by those PARIDs
    const pins = rows.map((x) => `'${String(x[pinCol]).replace(/'/g, "")}'`).join(",");
    const sql2 =
      `SELECT "PROPERTYHOUSENUM","PROPERTYADDRESS","SALEPRICE","SALEDATE","FINISHEDLIVINGAREA","PARID" ` +
      `FROM "${ASSESS}" WHERE "PARID" IN (${pins}) LIMIT 10`;
    const r2 = await get(`https://data.wprdc.org/api/3/action/datastore_search_sql?sql=${encodeURIComponent(sql2)}`);
    const j2 = r2.json as { result?: { records?: unknown[] }; error?: unknown } | null;
    console.log(`  join leg 2: ${j2?.result?.records?.length ? `${j2.result.records.length} rows, e.g. ${JSON.stringify(j2.result.records[0]).slice(0, 240)}` : `FAIL ${JSON.stringify(j2?.error ?? r2.text).slice(0, 200)}`}`);
  }
}
console.log(joinParcelRes ? `\nJOIN VIABLE via ${JSON.stringify(joinParcelRes)}` : "\nNO VIABLE CENTROID RESOURCE");
console.log("\nPROBE DONE");
