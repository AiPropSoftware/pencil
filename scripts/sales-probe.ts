/**
 * Sales probe, round 4 — close the remaining big-metro gaps by listing the
 * official government ArcGIS orgs/servers directly (round 3's keyword search
 * missed several official layers), retry MD iMAP (was 503 maintenance),
 * and test Pittsburgh's WPRDC CKAN SQL. Runner-only; not in the app bundle.
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

const SALEISH = /sale|sold|price|deed|transfer|considr|consider|ls_price|last_sale/i;

async function probeLayer(label: string, layer: string, lat: number, lng: number) {
  const out: Record<string, unknown> = { label, layer };
  const meta = await get(`${layer}?f=json`);
  const m = meta.json as { fields?: { name: string }[]; error?: unknown } | null;
  if (!m?.fields) { out.error = `no fields (HTTP ${meta.status}) ${JSON.stringify(m?.error ?? meta.text).slice(0, 90)}`; return out; }
  const saleFields = m.fields.filter((f) => SALEISH.test(f.name)).map((f) => f.name);
  out.saleFields = saleFields.join(",").slice(0, 160) || "NONE";
  if (!saleFields.length) return out;
  out.allFields = m.fields.map((f) => f.name).join(",").slice(0, 450);
  const d = 0.006;
  const q = `${layer}/query?f=json&where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=true&outSR=4326&inSR=4326&spatialRel=esriSpatialRelIntersects` +
    `&geometry=${lng - d},${lat - d},${lng + d},${lat + d}&geometryType=esriGeometryEnvelope`;
  const near = await get(q);
  const nr = near.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
  if (!nr?.features) { out.envelope = `FAIL ${JSON.stringify(nr?.error ?? near.text).slice(0, 100)}`; return out; }
  out.envelope = `${nr.features.length} rows`;
  const a = nr.features[0]?.attributes ?? {};
  out.sample = JSON.stringify(
    Object.fromEntries(Object.entries(a).filter(([k]) => SALEISH.test(k) || /date|addr|situs|street|location|area|liv|sqft|year/i.test(k))),
  ).slice(0, 340);
  return out;
}

/** List a hosted org's services (or a gov server root incl. folders), probe parcel-ish layers. */
async function sweepRoot(tag: string, root: string, lat: number, lng: number, max = 5) {
  const idx = await get(`${root}?f=json`);
  const data = idx.json as { services?: { name: string; type: string; url?: string }[]; folders?: string[] } | null;
  if (!data?.services && !data?.folders) { console.log(JSON.stringify({ tag, root, error: `HTTP ${idx.status} ${idx.text}` })); return; }
  const names: { name: string; type: string }[] = [...(data.services ?? [])];
  for (const f of (data.folders ?? []).filter((x) => /parcel|cadastr|propert|assess|tax|land/i.test(x)).slice(0, 3)) {
    const sub = await get(`${root}/${f}?f=json`);
    const sj = sub.json as { services?: { name: string; type: string }[] } | null;
    names.push(...(sj?.services ?? []));
  }
  const interesting = names.filter((s) => /parcel|cadastr|propert|assess|sale|tax|land_?rec/i.test(s.name));
  console.log(JSON.stringify({ tag, root, services: interesting.map((s) => s.name).slice(0, 14) }));
  for (const s of interesting.slice(0, max)) {
    const svcUrl = `${root}/${s.name}/${s.type}`;
    const svc = await get(`${svcUrl}?f=json`);
    const sj = svc.json as { layers?: { id: number; name: string }[] } | null;
    for (const l of (sj?.layers ?? []).slice(0, 4)) {
      console.log(JSON.stringify(await probeLayer(`${tag}: ${s.name}/${l.id} ${l.name}`, `${svcUrl}/${l.id}`, lat, lng), null, 1));
    }
  }
}

console.log("═══ MD iMAP RETRY ═══");
console.log(JSON.stringify(await probeLayer("MD SDAT (Baltimore pt)", "https://geodata.md.gov/imap/rest/services/PlanningCadastre/MD_PropertyData/MapServer/0", 39.2904, -76.6122), null, 1));

console.log("\n═══ OFFICIAL ORG/SERVER SWEEPS ═══");
await sweepRoot("Denver (city AGOL org)", "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services", 39.7392, -104.9903, 6);
await sweepRoot("Mecklenburg/Charlotte", "https://meckgis.mecklenburgcountync.gov/server/rest/services", 35.2271, -80.8431, 5);
await sweepRoot("Hennepin/Minneapolis", "https://gis.hennepin.us/arcgis/rest/services", 44.9778, -93.265, 5);
await sweepRoot("LOJIC/Louisville", "https://services1.arcgis.com/aNiHtvbmyLFnRzCw/arcgis/rest/services", 38.2527, -85.7585, 5);
await sweepRoot("Milwaukee (city)", "https://milwaukeemaps.milwaukee.gov/arcgis/rest/services", 43.0389, -87.9065, 5);
await sweepRoot("Indianapolis/Marion", "https://xmaps.indy.gov/arcgis/rest/services", 39.7684, -86.1581, 5);
await sweepRoot("Richmond VA", "https://services1.arcgis.com/k3vhq11XkBNeeOfM/arcgis/rest/services", 37.5407, -77.436, 5);

console.log("\n═══ PITTSBURGH WPRDC (CKAN SQL) ═══");
{
  // Allegheny County property assessments carry SALEPRICE/SALEDATE + lat/lng.
  const sql = encodeURIComponent(
    `SELECT "PROPERTYADDRESS","SALEPRICE","SALEDATE","FINISHEDLIVINGAREA" FROM "518b583f-7cc8-4f60-94d0-174cc98310dc" ` +
    `WHERE "SALEPRICE" > 40000 LIMIT 3`,
  );
  const r = await get(`https://data.wprdc.org/api/3/action/datastore_search_sql?sql=${sql}`);
  const j = r.json as { success?: boolean; result?: { records?: unknown[] }; error?: unknown } | null;
  console.log(JSON.stringify({
    result: j?.result?.records ? `${j.result.records.length} rows` : `FAIL HTTP ${r.status} ${JSON.stringify(j?.error ?? r.text).slice(0, 200)}`,
    sample: j?.result?.records?.[0] ? JSON.stringify(j.result.records[0]).slice(0, 250) : undefined,
  }, null, 1));
  // Fallback scout: find the assessments resource id if the guess is stale.
  const cat = await get("https://data.wprdc.org/api/3/action/package_search?q=property+assessments&rows=3");
  const c = cat.json as { result?: { results?: { name?: string; resources?: { id?: string; name?: string; datastore_active?: boolean }[] }[] } } | null;
  console.log("scout:", (c?.result?.results ?? []).map((p) => `${p.name}: ${(p.resources ?? []).filter((x) => x.datastore_active).map((x) => `${x.id} "${String(x.name).slice(0, 40)}"`).join("; ")}`).join(" | ").slice(0, 600));
}
console.log("\nPROBE DONE");
