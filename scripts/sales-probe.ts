/**
 * Sales probe — hunts for RECORDED-SALE data (real deed-transfer prices) that
 * can be queried NEAR A POINT, to power "drop an address → what's selling
 * nearby". Runs from a GitHub runner (open egress); not in the app bundle.
 *
 * A source qualifies only if it has, per record: price + date + address (or
 * parcel geometry) + coordinates, AND supports a spatial near-point query
 * (Socrata within_circle, or an ArcGIS envelope/point-distance query).
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
const DATEISH = /date|_dt\b|_dat\b|year|_yr\b/i;

// ── Socrata: direct candidates ──────────────────────────────────────────────
interface SocrataCandidate { label: string; url: string; lat: number; lng: number }
const SOCRATA_DIRECT: SocrataCandidate[] = [
  { label: "NYC rolling sales (w2pb-icbu)", url: "https://data.cityofnewyork.us/resource/w2pb-icbu.json", lat: 40.6782, lng: -73.9442 },
  { label: "Cook County parcel sales (wvhk-k5uv)", url: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json", lat: 41.8781, lng: -87.6298 },
];

function findPointCol(row: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && "latitude" in (v as object)) return k;
    if (v && typeof v === "object" && (v as { type?: string }).type === "Point") return k;
  }
  return null;
}

async function probeSocrataDirect(c: SocrataCandidate) {
  const out: Record<string, unknown> = { label: c.label };
  const sample = await get(`${c.url}?$limit=2&$order=:id DESC`);
  if (!Array.isArray(sample.json)) { out.error = `HTTP ${sample.status} ${sample.text}`; return out; }
  const rows = sample.json as Record<string, unknown>[];
  if (!rows.length) { out.error = "no rows"; return out; }
  out.columns = Object.keys(rows[0]).join(",");
  out.sample = JSON.stringify(rows[0]).slice(0, 500);
  // Try latitude/longitude pair columns, then a point-typed column.
  const keys = Object.keys(rows[0]);
  const latKey = keys.find((k) => /^lat(itude)?$/i.test(k));
  const lngKey = keys.find((k) => /^(lng|lon|long|longitude)$/i.test(k));
  const ptCol = findPointCol(rows[0]);
  out.coords = latKey && lngKey ? `${latKey}/${lngKey}` : ptCol ? `point:${ptCol}` : "NONE";
  const circleCol = ptCol ?? (latKey && lngKey ? null : null);
  if (circleCol) {
    const q = `${c.url}?$where=${encodeURIComponent(`within_circle(${circleCol}, ${c.lat}, ${c.lng}, 1500)`)}&$limit=3`;
    const near = await get(q);
    out.within_circle = Array.isArray(near.json) ? `${(near.json as unknown[]).length} rows` : `HTTP ${near.status} ${near.text}`;
  } else if (latKey && lngKey) {
    // Numeric lat/lng columns still allow a bounding-box $where.
    const w = `${latKey} > ${c.lat - 0.01} AND ${latKey} < ${c.lat + 0.01} AND ${lngKey} > ${c.lng - 0.013} AND ${lngKey} < ${c.lng + 0.013}`;
    const near = await get(`${c.url}?$where=${encodeURIComponent(w)}&$limit=3`);
    out.bbox_where = Array.isArray(near.json) ? `${(near.json as unknown[]).length} rows` : `HTTP ${near.status} ${near.text}`;
  }
  return out;
}

// ── Socrata: catalog discovery for sales datasets in covered metros ─────────
const SOCRATA_DOMAINS = [
  "data.nashville.gov",
  "data.cityofnewyork.us",
  "datacatalog.cookcountyil.gov",
  "data.kingcounty.gov",
  "dallasopendata.com",
  "data.memphistn.gov",
  "data.austintexas.gov",
];

async function probeSocrataCatalog(domain: string) {
  const hits: string[] = [];
  for (const q of ["property sales", "real estate transfers"]) {
    const res = await get(`https://api.us.socrata.com/api/catalog/v1?domains=${domain}&only=datasets&limit=8&q=${encodeURIComponent(q)}`);
    const cat = res.json as { results?: { resource?: { id?: string; name?: string }; metadata?: { domain?: string } }[] } | null;
    for (const r of cat?.results ?? []) {
      const name = r.resource?.name ?? "";
      if (!/sale|transfer|deed|assess/i.test(name)) continue;
      const h = `${r.resource?.id} "${name.slice(0, 60)}"`;
      if (!hits.includes(h)) hits.push(h);
    }
  }
  return { domain, hits: hits.slice(0, 8) };
}

// ── ArcGIS: candidate layers (direct + AGOL search) ─────────────────────────
interface ArcCandidate { label: string; layer: string; lat: number; lng: number }

async function agolSearch(q: string, max = 5): Promise<{ title: string; url: string }[]> {
  const res = await get(`https://www.arcgis.com/sharing/rest/search?f=json&num=${max}&q=${encodeURIComponent(q + ' type:"Feature Service"')}`);
  const data = res.json as { results?: { url?: string; title?: string }[] } | null;
  return (data?.results ?? [])
    .filter((r) => r.url && /FeatureServer/i.test(r.url))
    .map((r) => ({ title: r.title ?? "", url: r.url!.replace(/\/$/, "") }));
}

async function probeArcLayer(c: ArcCandidate) {
  const out: Record<string, unknown> = { label: c.label, layer: c.layer };
  const meta = await get(`${c.layer}?f=json`);
  const m = meta.json as { fields?: { name: string; type: string }[]; name?: string; error?: unknown } | null;
  if (!m?.fields) { out.error = `no fields (HTTP ${meta.status}) ${JSON.stringify(m?.error ?? meta.text).slice(0, 120)}`; return out; }
  out.name = m.name;
  const saleFields = m.fields.filter((f) => SALEISH.test(f.name)).map((f) => f.name);
  const dateFields = m.fields.filter((f) => DATEISH.test(f.name)).map((f) => f.name);
  out.saleFields = saleFields.join(",").slice(0, 200) || "NONE";
  out.dateFields = dateFields.join(",").slice(0, 160) || "NONE";
  if (!saleFields.length) return out;
  // Envelope query near the metro point — the exact query the app would run.
  const d = 0.006;
  const env = JSON.stringify({ xmin: c.lng - d, ymin: c.lat - d, xmax: c.lng + d, ymax: c.lat + d });
  const q = `${c.layer}/query?f=json&where=1%3D1&outFields=*&resultRecordCount=3&returnGeometry=true&outSR=4326` +
    `&geometry=${encodeURIComponent(env)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`;
  const near = await get(q);
  const nr = near.json as { features?: { attributes?: Record<string, unknown> }[]; error?: unknown } | null;
  if (!nr?.features) { out.envelope = `FAIL ${JSON.stringify(nr?.error ?? near.text).slice(0, 140)}`; return out; }
  out.envelope = `${nr.features.length} rows`;
  const a = nr.features[0]?.attributes ?? {};
  out.saleSample = JSON.stringify(
    Object.fromEntries(Object.entries(a).filter(([k]) => SALEISH.test(k) || DATEISH.test(k) || /addr|street|situs|owner/i.test(k))),
  ).slice(0, 400);
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log("═══ SOCRATA DIRECT ═══");
for (const c of SOCRATA_DIRECT) console.log(JSON.stringify(await probeSocrataDirect(c), null, 1));

console.log("\n═══ SOCRATA CATALOG (sales datasets per domain) ═══");
for (const d of SOCRATA_DOMAINS) console.log(JSON.stringify(await probeSocrataCatalog(d)));

console.log("\n═══ ARCGIS: metro parcel/sales layer hunt ═══");
const HUNTS: { q: string; lat: number; lng: number; tag: string }[] = [
  { q: "Davidson County Nashville parcels", lat: 36.1627, lng: -86.7816, tag: "Nashville" },
  { q: "Nashville property sales", lat: 36.1627, lng: -86.7816, tag: "Nashville" },
  { q: "Knox County TN parcels", lat: 35.9606, lng: -83.9207, tag: "Knoxville" },
  { q: "Hamilton County TN parcels", lat: 35.0456, lng: -85.3097, tag: "Chattanooga" },
  { q: "Shelby County TN parcels assessor", lat: 35.1495, lng: -90.049, tag: "Memphis" },
  { q: "Florida statewide parcels", lat: 25.7617, lng: -80.1918, tag: "Miami/FL" },
  { q: "Miami-Dade parcels sales", lat: 25.7617, lng: -80.1918, tag: "Miami" },
  { q: "Travis County parcels", lat: 30.2672, lng: -97.7431, tag: "Austin" },
  { q: "Mecklenburg County parcels sales", lat: 35.2271, lng: -80.8431, tag: "Charlotte" },
  { q: "Maricopa County parcels", lat: 33.4484, lng: -112.074, tag: "Phoenix" },
];
const seen = new Set<string>();
for (const h of HUNTS) {
  const results = await agolSearch(h.q, 4);
  console.log(`\n-- AGOL "${h.q}" → ${results.length} services`);
  for (const r of results.slice(0, 3)) {
    const layer = `${r.url}/0`;
    if (seen.has(layer)) continue;
    seen.add(layer);
    console.log(JSON.stringify(await probeArcLayer({ label: `${h.tag}: ${r.title.slice(0, 50)}`, layer, lat: h.lat, lng: h.lng }), null, 1));
  }
}

// Known government servers worth a direct look (roots listed, parcel-ish
// services probed). These are servers we already trust from the permit work.
console.log("\n═══ ARCGIS: direct government servers ═══");
const ROOTS: { root: string; lat: number; lng: number; tag: string }[] = [
  { root: "https://maps.nashville.gov/arcgis/rest/services", lat: 36.1627, lng: -86.7816, tag: "Nashville" },
  { root: "https://gis.shelbycountytn.gov/arcgis/rest/services", lat: 35.1495, lng: -90.049, tag: "Memphis" },
  { root: "https://www.kgis.org/arcgis/rest/services", lat: 35.9606, lng: -83.9207, tag: "Knoxville" },
];
for (const r of ROOTS) {
  const idx = await get(`${r.root}?f=json`);
  const data = idx.json as { services?: { name: string; type: string }[]; folders?: string[] } | null;
  if (!data?.services && !data?.folders) { console.log(JSON.stringify({ root: r.root, error: `HTTP ${idx.status} ${idx.text}` })); continue; }
  const names = [
    ...(data.services ?? []).map((s) => `${s.name}(${s.type})`),
    ...(data.folders ?? []).map((f) => `${f}/`),
  ];
  const interesting = names.filter((n) => /parcel|cadast|propert|assess|sale|tax/i.test(n));
  console.log(JSON.stringify({ root: r.root, interesting: interesting.slice(0, 12), all: interesting.length ? undefined : names.slice(0, 20) }));
  // Probe layer 0 of up to 2 interesting MapServer/FeatureServer services.
  for (const n of interesting.slice(0, 2)) {
    const mMatch = n.match(/^(.+)\((MapServer|FeatureServer)\)$/);
    if (!mMatch) continue;
    const layer = `${r.root}/${mMatch[1]}/${mMatch[2]}/0`;
    console.log(JSON.stringify(await probeArcLayer({ label: `${r.tag} direct`, layer, lat: r.lat, lng: r.lng }), null, 1));
  }
}
console.log("\nPROBE DONE");
