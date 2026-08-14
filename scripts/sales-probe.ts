/**
 * Sales probe, round 3 — nationwide expansion sweep. Rounds 1-2 wired NYC,
 * Nashville, Philadelphia, and all-Florida. This round hunts every promising
 * DISCLOSURE-state source (non-disclosure states — TX, ID, KS, MS, MT, NM,
 * ND, UT, WY, LA, AK — legally publish no sale prices; skipped on purpose):
 * statewide parcel rolls, big-county assessor layers, ODS geofilter cities,
 * and the Cook County PIN-join pieces for Chicago.
 */

const realFetch = globalThis.fetch;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function get(url: string): Promise<{ status: number; json: unknown | null; text: string }> {
  try {
    const res = await realFetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
    const text = await res.text();
    try { return { status: res.status, json: JSON.parse(text), text: "" }; }
    catch { return { status: res.status, json: null, text: text.slice(0, 140) }; }
  } catch (e) {
    return { status: 0, json: null, text: (e as Error).message.slice(0, 140) };
  }
}

const SALEISH = /sale|sold|price|deed|transfer|considr|consider|amount|ls_price|last_sale/i;

interface Cand { label: string; layer: string; lat: number; lng: number }

async function probeLayer(c: Cand, style: "envelope" | "distance" = "envelope") {
  const out: Record<string, unknown> = { label: c.label, layer: c.layer };
  const meta = await get(`${c.layer}?f=json`);
  const m = meta.json as { fields?: { name: string }[]; name?: string; error?: unknown } | null;
  if (!m?.fields) { out.error = `no fields (HTTP ${meta.status}) ${JSON.stringify(m?.error ?? meta.text).slice(0, 100)}`; return out; }
  const saleFields = m.fields.filter((f) => SALEISH.test(f.name)).map((f) => f.name);
  out.saleFields = saleFields.join(",").slice(0, 180) || "NONE";
  if (!saleFields.length) return out;
  out.allFields = m.fields.map((f) => f.name).join(",").slice(0, 500);
  const d = 0.006;
  const geo = style === "distance"
    ? `geometry=${encodeURIComponent(JSON.stringify({ x: c.lng, y: c.lat, spatialReference: { wkid: 4326 } }))}&geometryType=esriGeometryPoint&distance=1200&units=esriSRUnit_Meter`
    : `geometry=${c.lng - d},${c.lat - d},${c.lng + d},${c.lat + d}&geometryType=esriGeometryEnvelope`;
  const q = `${c.layer}/query?f=json&where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=true&outSR=4326&inSR=4326&spatialRel=esriSpatialRelIntersects&${geo}`;
  const near = await get(q);
  const nr = near.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
  if (!nr?.features) {
    out[style] = `FAIL ${JSON.stringify(nr?.error ?? near.text).slice(0, 110)}`;
    if (style === "envelope") return probeLayerRetryDistance(c, out);
    return out;
  }
  out[style] = `${nr.features.length} rows`;
  const a = nr.features[0]?.attributes ?? {};
  out.sample = JSON.stringify(
    Object.fromEntries(Object.entries(a).filter(([k]) => SALEISH.test(k) || /date|addr|situs|street|location|sqft|area|liv|year/i.test(k))),
  ).slice(0, 380);
  return out;
}
async function probeLayerRetryDistance(c: Cand, out: Record<string, unknown>) {
  const q = `${c.layer}/query?f=json&where=1%3D1&outFields=*&resultRecordCount=2&returnGeometry=true&outSR=4326&inSR=4326&spatialRel=esriSpatialRelIntersects` +
    `&geometry=${encodeURIComponent(JSON.stringify({ x: c.lng, y: c.lat, spatialReference: { wkid: 4326 } }))}&geometryType=esriGeometryPoint&distance=1200&units=esriSRUnit_Meter`;
  const near = await get(q);
  const nr = near.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
  if (!nr?.features) { out.distance = `FAIL ${JSON.stringify(nr?.error ?? near.text).slice(0, 110)}`; return out; }
  out.distance = `${nr.features.length} rows`;
  const a = nr.features[0]?.attributes ?? {};
  out.sample = JSON.stringify(
    Object.fromEntries(Object.entries(a).filter(([k]) => SALEISH.test(k) || /date|addr|situs|street|location|sqft|area|liv|year/i.test(k))),
  ).slice(0, 380);
  return out;
}

async function agol(q: string, n = 4): Promise<{ title: string; url: string }[]> {
  const res = await get(`https://www.arcgis.com/sharing/rest/search?f=json&num=${n}&q=${encodeURIComponent(q + ' type:"Feature Service"')}`);
  const data = res.json as { results?: { url?: string; title?: string }[] } | null;
  return (data?.results ?? []).filter((r) => r.url && /FeatureServer/i.test(r.url)).map((r) => ({ title: r.title ?? "", url: r.url!.replace(/\/$/, "") }));
}

// ── A. Direct high-confidence candidates ────────────────────────────────────
console.log("═══ DIRECT CANDIDATES ═══");
const DIRECT: Cand[] = [
  // Maryland SDAT: CONSIDR1 = consideration (sale price), TRADATE = transfer date
  { label: "MD iMAP property (Baltimore pt)", layer: "https://geodata.md.gov/imap/rest/services/PlanningCadastre/MD_PropertyData/MapServer/0", lat: 39.2904, lng: -76.6122 },
  // NJ MOD-IV composite (canary-known service root)
  { label: "NJ parcels composite (Newark pt)", layer: "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0", lat: 40.7357, lng: -74.1724 },
  // Wake County NC
  { label: "Wake Co NC parcels (Raleigh pt)", layer: "https://maps.wake.gov/arcgis/rest/services/Property/Parcels/MapServer/0", lat: 35.7796, lng: -78.6382 },
  // Hennepin County MN
  { label: "Hennepin MN parcels (Mpls pt)", layer: "https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/0", lat: 44.9778, lng: -93.265 },
  // Mecklenburg NC POLARIS
  { label: "Mecklenburg NC (Charlotte pt)", layer: "https://meckgis.mecklenburgcountync.gov/server/rest/services/POLARIS/MapServer/0", lat: 35.2271, lng: -80.8431 },
];
for (const c of DIRECT) console.log(JSON.stringify(await probeLayer(c), null, 1));

// ── B. AGOL discovery hunts (disclosure states) ─────────────────────────────
console.log("\n═══ AGOL HUNTS ═══");
const HUNTS: { q: string; lat: number; lng: number; tag: string }[] = [
  { q: "MassGIS L3 parcels assess", lat: 42.3601, lng: -71.0589, tag: "MA" },
  { q: "Massachusetts statewide tax parcels", lat: 42.3601, lng: -71.0589, tag: "MA" },
  { q: "Wisconsin statewide parcels LTSB", lat: 43.0389, lng: -87.9065, tag: "WI" },
  { q: "NC OneMap statewide parcels", lat: 35.7796, lng: -78.6382, tag: "NC" },
  { q: "Detroit property sales", lat: 42.3314, lng: -83.0458, tag: "MI" },
  { q: "Wayne County Michigan parcels sales", lat: 42.3314, lng: -83.0458, tag: "MI" },
  { q: "Franklin County Ohio parcels sales", lat: 39.9612, lng: -82.9988, tag: "OH-Columbus" },
  { q: "Cuyahoga County parcels sales", lat: 41.4993, lng: -81.6944, tag: "OH-Cleveland" },
  { q: "Fulton County GA parcels tax", lat: 33.749, lng: -84.388, tag: "GA-Atlanta" },
  { q: "King County WA parcels sales", lat: 47.6062, lng: -122.3321, tag: "WA-Seattle" },
  { q: "Clark County Nevada parcels assessor", lat: 36.1699, lng: -115.1398, tag: "NV-LasVegas" },
  { q: "Maricopa County assessor parcels sales", lat: 33.4484, lng: -112.074, tag: "AZ-Phoenix" },
  { q: "Jefferson County KY PVA parcels", lat: 38.2527, lng: -85.7585, tag: "KY-Louisville" },
  { q: "Denver parcels sales", lat: 39.7392, lng: -104.9903, tag: "CO-Denver" },
  { q: "Allegheny County parcels assessment", lat: 40.4406, lng: -79.9959, tag: "PA-Pittsburgh" },
  { q: "Virginia Beach parcels sales", lat: 36.8529, lng: -75.978, tag: "VA" },
  { q: "Greenville County SC parcels", lat: 34.8526, lng: -82.394, tag: "SC" },
  { q: "DeKalb County GA parcels", lat: 33.7748, lng: -84.2963, tag: "GA" },
];
const seen = new Set<string>();
for (const h of HUNTS) {
  const results = await agol(h.q, 4);
  console.log(`\n-- "${h.q}" → ${results.length}`);
  for (const r of results.slice(0, 3)) {
    const layer = `${r.url}/0`;
    if (seen.has(layer)) continue;
    seen.add(layer);
    console.log(JSON.stringify(await probeLayer({ label: `${h.tag}: ${r.title.slice(0, 48)}`, layer, lat: h.lat, lng: h.lng }), null, 1));
  }
}

// ── C. ODS geofilter (Denver + any OpenDataSoft city) ───────────────────────
console.log("\n═══ ODS GEOFILTER ═══");
for (const [city, base, q] of [
  ["Denver", "https://opendata-geospatialdenver.hub.arcgis.com", ""], // placeholder — real Denver check below
] as const) void city, void base, void q;
{
  // Denver moved portals over the years; ask its ODS + ArcGIS hub both.
  const r = await get("https://www.arcgis.com/sharing/rest/search?f=json&num=5&q=" + encodeURIComponent('Denver real property sales type:"Feature Service"'));
  const data = r.json as { results?: { url?: string; title?: string }[] } | null;
  for (const x of (data?.results ?? []).slice(0, 3)) {
    if (!x.url || !/FeatureServer/i.test(x.url)) continue;
    console.log(JSON.stringify(await probeLayer({ label: `CO-Denver: ${x.title?.slice(0, 48)}`, layer: `${x.url.replace(/\/$/, "")}/0`, lat: 39.7392, lng: -104.9903 }), null, 1));
  }
}

// ── D. Chicago: Cook County PIN-join pieces ─────────────────────────────────
console.log("\n═══ COOK COUNTY (CHICAGO) PIN JOIN ═══");
{
  // 1) find the parcel-locations dataset (Parcel Universe: PIN + lat/lon)
  const cat = await get("https://api.us.socrata.com/api/catalog/v1?domains=datacatalog.cookcountyil.gov&only=datasets&limit=10&q=" + encodeURIComponent("parcel universe"));
  const c = cat.json as { results?: { resource?: { id?: string; name?: string } }[] } | null;
  console.log("catalog:", (c?.results ?? []).map((r) => `${r.resource?.id} "${r.resource?.name?.slice(0, 50)}"`).join(" | ").slice(0, 500));
  for (const r of (c?.results ?? []).slice(0, 3)) {
    const id = r.resource?.id;
    if (!id) continue;
    const sample = await get(`https://datacatalog.cookcountyil.gov/resource/${id}.json?$limit=1`);
    if (Array.isArray(sample.json) && sample.json[0]) {
      const cols = Object.keys(sample.json[0] as object);
      console.log(JSON.stringify({ id, name: r.resource?.name?.slice(0, 50), columns: cols.join(",").slice(0, 400) }));
      // If it has lat/lon or a point col, test a bbox/within_circle
      const latK = cols.find((k) => /^lat/i.test(k));
      const lonK = cols.find((k) => /^(lon|lng)/i.test(k));
      const ptK = cols.find((k) => /location|centroid|point|geom/i.test(k));
      if (latK && lonK) {
        const w = `${latK} > 41.87 AND ${latK} < 41.90 AND ${lonK} > -87.66 AND ${lonK} < -87.62`;
        const t = await get(`https://datacatalog.cookcountyil.gov/resource/${id}.json?$where=${encodeURIComponent(w)}&$limit=3&$select=pin,${latK},${lonK}`);
        console.log(`  bbox(${latK}/${lonK}):`, Array.isArray(t.json) ? `${(t.json as unknown[]).length} rows ${JSON.stringify((t.json as unknown[])[0]).slice(0, 160)}` : `HTTP ${t.status} ${t.text}`);
      } else if (ptK) {
        const t = await get(`https://datacatalog.cookcountyil.gov/resource/${id}.json?$where=${encodeURIComponent(`within_circle(${ptK}, 41.885, -87.64, 1200)`)}&$limit=3`);
        console.log(`  within_circle(${ptK}):`, Array.isArray(t.json) ? `${(t.json as unknown[]).length} rows` : `HTTP ${t.status} ${t.text}`);
      }
    } else {
      console.log(JSON.stringify({ id, error: `HTTP ${sample.status} ${sample.text}` }));
    }
  }
  // 2) sales lookup by PIN set (the join's second leg)
  const s = await get("https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json?$limit=3&$where=" + encodeURIComponent("sale_price > 40000") + "&$order=sale_date DESC");
  console.log("sales-by-recency:", Array.isArray(s.json) ? `${(s.json as unknown[]).length} rows ok` : `HTTP ${s.status}`);
}
console.log("\nPROBE DONE");
