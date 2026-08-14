/**
 * Sales probe, round 2 — round 1 verified NYC rolling sales (lat/lng + bbox
 * $where works) and found two near-misses to close:
 *   1. Florida FDOR statewide parcel centroids: SALE_PRC1/SALE_YR1 exist but
 *      the envelope query 400'd — try query variants + print the full schema.
 *   2. maps.nashville.gov has a Cadastral/ folder round 1 didn't descend into.
 * Plus: Philadelphia's Carto OPA table (sale_price/sale_date + PostGIS radius).
 * Runs from a GitHub runner (open egress); not in the app bundle.
 */

const realFetch = globalThis.fetch;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function get(url: string): Promise<{ status: number; json: unknown | null; text: string }> {
  try {
    const res = await realFetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    const text = await res.text();
    try { return { status: res.status, json: JSON.parse(text), text: "" }; }
    catch { return { status: res.status, json: null, text: text.slice(0, 160) }; }
  } catch (e) {
    return { status: 0, json: null, text: (e as Error).message.slice(0, 160) };
  }
}

const SALEISH = /sale|sold|price|deed|transfer|consider|amount/i;

// ── 1. Florida FDOR centroids: why did the envelope 400? ────────────────────
const FL = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0";
const MIA = { lat: 25.7907, lng: -80.2036 }; // residential Miami (Little Havana-ish)

console.log("═══ FLORIDA FDOR CENTROIDS ═══");
{
  const meta = await get(`${FL}?f=json`);
  const m = meta.json as { fields?: { name: string }[]; maxRecordCount?: number; capabilities?: string; supportedQueryFormats?: string } | null;
  console.log(JSON.stringify({
    capabilities: m?.capabilities,
    maxRecordCount: m?.maxRecordCount,
    formats: m?.supportedQueryFormats,
    allFields: (m?.fields ?? []).map((f) => f.name).join(","),
  }, null, 1));

  const d = 0.006;
  const variants: { name: string; qs: string }[] = [
    {
      name: "A: envelope JSON + spatialReference",
      qs: `where=1%3D1&outFields=*&resultRecordCount=3&returnGeometry=true&outSR=4326&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&geometry=${encodeURIComponent(JSON.stringify({ xmin: MIA.lng - d, ymin: MIA.lat - d, xmax: MIA.lng + d, ymax: MIA.lat + d, spatialReference: { wkid: 4326 } }))}`,
    },
    {
      name: "B: simple comma envelope",
      qs: `where=1%3D1&outFields=*&resultRecordCount=3&returnGeometry=true&outSR=4326&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&geometry=${MIA.lng - d},${MIA.lat - d},${MIA.lng + d},${MIA.lat + d}`,
    },
    {
      name: "C: point + distance 1200m",
      qs: `where=1%3D1&outFields=*&resultRecordCount=3&returnGeometry=true&outSR=4326&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=1200&units=esriSRUnit_Meter&geometry=${encodeURIComponent(JSON.stringify({ x: MIA.lng, y: MIA.lat, spatialReference: { wkid: 4326 } }))}`,
    },
    {
      name: "D: envelope, no resultRecordCount, outFields=OBJECTID",
      qs: `where=1%3D1&outFields=OBJECTID&returnGeometry=false&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&geometry=${MIA.lng - d},${MIA.lat - d},${MIA.lng + d},${MIA.lat + d}`,
    },
    {
      name: "E: attribute-only sanity (no geometry)",
      qs: `where=${encodeURIComponent("SALE_YR1 > 2023 AND SALE_PRC1 > 100000")}&outFields=SALE_PRC1,SALE_YR1,SALE_MO1&resultRecordCount=2&returnGeometry=false`,
    },
  ];
  for (const v of variants) {
    const r = await get(`${FL}/query?f=json&${v.qs}`);
    const j = r.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
    console.log(JSON.stringify({
      variant: v.name,
      result: j?.features ? `${j.features.length} rows` : `FAIL ${JSON.stringify(j?.error ?? r.text).slice(0, 140)}`,
      sample: j?.features?.[0] ? JSON.stringify(j.features[0].attributes).slice(0, 420) : undefined,
    }, null, 1));
  }
}

// ── 2. Nashville Cadastral folder descent ───────────────────────────────────
console.log("\n═══ NASHVILLE CADASTRAL ═══");
{
  const NSH = { lat: 36.1447, lng: -86.8021 }; // residential Sylvan Park-ish
  const folder = await get("https://maps.nashville.gov/arcgis/rest/services/Cadastral?f=json");
  const f = folder.json as { services?: { name: string; type: string }[] } | null;
  console.log(JSON.stringify({ services: (f?.services ?? []).map((s) => `${s.name}(${s.type})`) }));
  for (const s of (f?.services ?? []).slice(0, 5)) {
    const svcUrl = `https://maps.nashville.gov/arcgis/rest/services/${s.name}/${s.type}`;
    const svc = await get(`${svcUrl}?f=json`);
    const sj = svc.json as { layers?: { id: number; name: string }[] } | null;
    console.log(JSON.stringify({ service: s.name, layers: (sj?.layers ?? []).map((l) => `${l.id}:${l.name}`).slice(0, 20) }));
    for (const l of (sj?.layers ?? []).slice(0, 6)) {
      const meta = await get(`${svcUrl}/${l.id}?f=json`);
      const m = meta.json as { fields?: { name: string }[] } | null;
      const saleFields = (m?.fields ?? []).filter((x) => SALEISH.test(x.name)).map((x) => x.name);
      if (!saleFields.length) { console.log(JSON.stringify({ layer: `${s.name}/${l.id} ${l.name}`, saleFields: "NONE" })); continue; }
      const d = 0.005;
      const q = `${svcUrl}/${l.id}/query?f=json&where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=true&outSR=4326` +
        `&geometry=${NSH.lng - d},${NSH.lat - d},${NSH.lng + d},${NSH.lat + d}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
      const near = await get(q);
      const nr = near.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
      console.log(JSON.stringify({
        layer: `${s.name}/${l.id} ${l.name}`,
        saleFields: saleFields.join(","),
        allFields: (m?.fields ?? []).map((x) => x.name).join(",").slice(0, 600),
        envelope: nr?.features ? `${nr.features.length} rows` : `FAIL ${JSON.stringify(nr?.error ?? near.text).slice(0, 140)}`,
        sample: nr?.features?.[0] ? JSON.stringify(nr.features[0].attributes).slice(0, 500) : undefined,
      }, null, 1));
    }
  }
}

// ── 3. Philadelphia Carto OPA (sale_price + PostGIS radius) ─────────────────
console.log("\n═══ PHILADELPHIA CARTO OPA ═══");
{
  const sql = encodeURIComponent(
    "SELECT location, sale_price, sale_date, total_livable_area, ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng " +
    "FROM opa_properties_public " +
    "WHERE the_geom IS NOT NULL AND sale_price > 40000 " +
    "AND ST_DWithin(the_geom::geography, ST_SetSRID(ST_MakePoint(-75.1652, 39.9526), 4326)::geography, 1200) " +
    "ORDER BY sale_date DESC LIMIT 3",
  );
  const r = await get(`https://phl.carto.com/api/v2/sql?q=${sql}`);
  const j = r.json as { rows?: Record<string, unknown>[]; error?: unknown } | null;
  console.log(JSON.stringify({
    result: j?.rows ? `${j.rows.length} rows` : `FAIL ${JSON.stringify(j?.error ?? r.text).slice(0, 200)}`,
    sample: j?.rows?.[0] ? JSON.stringify(j.rows[0]) : undefined,
  }, null, 1));
}

// ── 4. NYC: confirm ordered bbox query (the exact app query) ────────────────
console.log("\n═══ NYC ORDERED BBOX ═══");
{
  const B = { lat: 40.6782, lng: -73.9442 };
  const w = `latitude > ${B.lat - 0.011} AND latitude < ${B.lat + 0.011} AND longitude > ${B.lng - 0.014} AND longitude < ${B.lng + 0.014} AND sale_price > 40000`;
  const url = `https://data.cityofnewyork.us/resource/w2pb-icbu.json?$where=${encodeURIComponent(w)}&$order=sale_date DESC&$limit=4`;
  const r = await get(url);
  console.log(Array.isArray(r.json)
    ? JSON.stringify((r.json as Record<string, unknown>[]).map((x) => ({ a: x.address, p: x.sale_price, dte: x.sale_date, sf: x.gross_square_feet, lat: x.latitude, lng: x.longitude })), null, 1)
    : `FAIL HTTP ${r.status} ${r.text}`);
}
console.log("\nPROBE DONE");
