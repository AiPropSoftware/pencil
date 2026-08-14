/**
 * Recorded sales near a point — the real answer to "what are properties
 * around this address actually selling for?". Every record is a deed
 * transfer from a county/city's own public records: real price, real date,
 * real location. No listings are invented, no prices modeled; where no
 * county publishes machine-readable sales, we say so instead.
 *
 * Every SOURCE below is verified by scripts/sales-probe.ts from an
 * open-egress runner before being wired: columns confirmed, near-point
 * query confirmed live.
 */

export interface SaleRecord {
  id: string;
  /** Street address as recorded by the county (may be terse, e.g. "123 MAIN ST"). */
  address: string;
  price: number;
  /** ISO yyyy-mm-dd when the source publishes it, else null. */
  date: string | null;
  /** Building sqft when the source publishes it, else null. */
  sqft: number | null;
  ppsf: number | null;
  lat: number;
  lng: number;
  distanceM: number;
  sourceName: string;
}

export interface SalesNearResult {
  records: SaleRecord[];
  /** Which public source covered this point; null = no coverage here yet. */
  sourceName: string | null;
  sourceUrl: string | null;
  error?: string;
}

interface BBox { latMin: number; latMax: number; lngMin: number; lngMax: number }

interface SocrataSaleSource {
  kind: "socrata";
  name: string;
  homepage: string;
  url: string;
  bbox: BBox;
  /** Point column for within_circle, or [latCol, lngCol] numeric pair. */
  point: string | [string, string];
  priceKey: string;
  dateKey: string | null;
  sqftKey: string | null;
  addressKeys: string[];
  /** Extra SoQL filter (arm's-length etc.), ANDed into $where. */
  where?: string;
}

interface ArcgisSaleSource {
  kind: "arcgis";
  name: string;
  homepage: string;
  layer: string;
  bbox: BBox;
  priceKey: string;
  /** Field name; ArcGIS dates arrive as epoch ms or strings — both handled. */
  dateKey: string | null;
  sqftKey: string | null;
  addressKeys: string[];
  where?: string;
}

interface CartoSaleSource {
  kind: "carto";
  name: string;
  homepage: string;
  /** Carto SQL API base, e.g. https://phl.carto.com/api/v2/sql */
  sqlBase: string;
  /** SQL with $LAT/$LNG/$RADIUS placeholders; must select lat/lng aliases. */
  sqlTemplate: string;
  bbox: BBox;
  priceKey: string;
  dateKey: string | null;
  sqftKey: string | null;
  addressKeys: string[];
}

export type SaleSource = SocrataSaleSource | ArcgisSaleSource | CartoSaleSource;

/** Filled ONLY with probe-verified sources — see scripts/sales-probe.ts. */
export const SALE_SOURCES: SaleSource[] = [
  {
    // Verified 2026-08-14: latitude/longitude numeric, bbox $where returns
    // rows, sale_price/sale_date/gross_square_feet/address all present.
    kind: "socrata",
    name: "NYC Dept. of Finance rolling sales",
    homepage: "https://data.cityofnewyork.us/d/w2pb-icbu",
    url: "https://data.cityofnewyork.us/resource/w2pb-icbu.json",
    bbox: { latMin: 40.49, latMax: 40.92, lngMin: -74.27, lngMax: -73.68 },
    point: ["latitude", "longitude"],
    priceKey: "sale_price",
    dateKey: "sale_date",
    sqftKey: "gross_square_feet",
    addressKeys: ["address"],
    // Tax class 1-2 = residential / primarily residential; price floor
    // drops the $0 and $10 family/quitclaim transfers.
    where: "sale_price > 40000 AND tax_class_at_time_of_sale in ('1','2')",
  },
];

const RADIUS_M = 1200; // ~3/4 mile — "the area" around a dropped address
const MAX_RECORDS = 12;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function toIsoDate(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && v > 10_000_000_000) {
    const d = new Date(v); // ArcGIS epoch ms
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // mm/dd/yyyy
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`; // year-only sources
  return null;
}

function firstText(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

/** Real-transaction sanity: drops $0/$10 quitclaims and data errors. */
function plausible(price: number): boolean {
  return Number.isFinite(price) && price >= 40_000 && price <= 100_000_000;
}

function finish(
  raw: { row: Record<string, unknown>; lat: number; lng: number }[],
  src: SaleSource,
  lat: number,
  lng: number,
): SaleRecord[] {
  const out: SaleRecord[] = [];
  for (const { row, lat: rLat, lng: rLng } of raw) {
    const price = num(row[src.priceKey]);
    if (!plausible(price)) continue;
    const dist = haversineM(lat, lng, rLat, rLng);
    if (dist > RADIUS_M * 1.4) continue; // envelope corners overshoot the circle
    const sqftRaw = src.sqftKey ? num(row[src.sqftKey]) : NaN;
    const sqft = Number.isFinite(sqftRaw) && sqftRaw >= 200 ? Math.round(sqftRaw) : null;
    const date = src.dateKey ? toIsoDate(row[src.dateKey]) : null;
    const address = firstText(row, src.addressKeys);
    if (!address) continue; // a price with no address helps no one
    out.push({
      id: `${src.name}-${out.length}-${rLat.toFixed(5)},${rLng.toFixed(5)}`,
      address,
      price: Math.round(price),
      date,
      sqft,
      ppsf: sqft ? Math.round(price / sqft) : null,
      lat: rLat,
      lng: rLng,
      distanceM: Math.round(dist),
      sourceName: src.name,
    });
  }
  // Newest first, then nearest; cap so the panel stays readable.
  out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.distanceM - b.distanceM);
  return out.slice(0, MAX_RECORDS);
}

async function fetchSocrataNear(src: SocrataSaleSource, lat: number, lng: number): Promise<SaleRecord[]> {
  const clauses: string[] = [];
  if (typeof src.point === "string") {
    clauses.push(`within_circle(${src.point}, ${lat}, ${lng}, ${RADIUS_M})`);
  } else {
    const dLat = RADIUS_M / 111_000;
    const dLng = RADIUS_M / (111_000 * Math.cos((lat * Math.PI) / 180));
    const [la, lo] = src.point;
    clauses.push(`${la} > ${lat - dLat} AND ${la} < ${lat + dLat} AND ${lo} > ${lng - dLng} AND ${lo} < ${lng + dLng}`);
  }
  if (src.where) clauses.push(`(${src.where})`);
  const params = new URLSearchParams({ $where: clauses.join(" AND "), $limit: "250" });
  if (src.dateKey) params.set("$order", `${src.dateKey} DESC`);
  let res = await fetch(`${src.url}?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (res.status === 400 && src.dateKey) {
    params.delete("$order");
    res = await fetch(`${src.url}?${params.toString()}`, { headers: { Accept: "application/json" } });
  }
  if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) throw new Error(`${src.name}: unexpected response`);
  const raw = rows
    .map((row) => {
      let rLat = NaN, rLng = NaN;
      if (typeof src.point === "string") {
        const p = row[src.point] as { latitude?: string; longitude?: string; coordinates?: number[] } | undefined;
        if (p?.coordinates?.length === 2) { rLng = p.coordinates[0]; rLat = p.coordinates[1]; }
        else { rLat = num(p?.latitude); rLng = num(p?.longitude); }
      } else {
        rLat = num(row[src.point[0]]);
        rLng = num(row[src.point[1]]);
      }
      return { row, lat: rLat, lng: rLng };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  return finish(raw, src, lat, lng);
}

async function fetchArcgisNear(src: ArcgisSaleSource, lat: number, lng: number): Promise<SaleRecord[]> {
  const dLat = RADIUS_M / 111_000;
  const dLng = RADIUS_M / (111_000 * Math.cos((lat * Math.PI) / 180));
  const env = JSON.stringify({ xmin: lng - dLng, ymin: lat - dLat, xmax: lng + dLng, ymax: lat + dLat });
  const params = new URLSearchParams({
    f: "json",
    where: src.where ?? "1=1",
    outFields: "*",
    resultRecordCount: "250",
    returnGeometry: "true",
    outSR: "4326",
    geometry: env,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
  });
  const res = await fetch(`${src.layer}/query?${params.toString()}`);
  if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
  const data = (await res.json()) as {
    features?: { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number; rings?: number[][][] } }[];
    error?: { message?: string };
  };
  if (!data.features) throw new Error(`${src.name}: ${data.error?.message ?? "no features"}`);
  const raw = data.features
    .map((f) => {
      const g = f.geometry;
      let rLat = NaN, rLng = NaN;
      if (g && Number.isFinite(g.y) && Number.isFinite(g.x)) { rLat = g.y!; rLng = g.x!; }
      else if (g?.rings?.[0]?.length) {
        // Parcel polygons: use the ring's centroid-ish average.
        const ring = g.rings[0];
        rLng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
        rLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      }
      return { row: f.attributes ?? {}, lat: rLat, lng: rLng };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  return finish(raw, src, lat, lng);
}

async function fetchCartoNear(src: CartoSaleSource, lat: number, lng: number): Promise<SaleRecord[]> {
  const sql = src.sqlTemplate
    .replaceAll("$LAT", String(lat))
    .replaceAll("$LNG", String(lng))
    .replaceAll("$RADIUS", String(RADIUS_M));
  const res = await fetch(`${src.sqlBase}?q=${encodeURIComponent(sql)}`);
  if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
  const data = (await res.json()) as { rows?: Record<string, unknown>[]; error?: unknown };
  if (!data.rows) throw new Error(`${src.name}: ${JSON.stringify(data.error ?? "no rows key")}`);
  const raw = data.rows
    .map((row) => ({ row, lat: num(row.lat), lng: num(row.lng) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  return finish(raw, src, lat, lng);
}

function covers(src: SaleSource, lat: number, lng: number): boolean {
  const b = src.bbox;
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

export async function fetchSalesNear(lat: number, lng: number): Promise<SalesNearResult> {
  const src = SALE_SOURCES.find((s) => covers(s, lat, lng));
  if (!src) return { records: [], sourceName: null, sourceUrl: null };
  try {
    const records =
      src.kind === "socrata" ? await fetchSocrataNear(src, lat, lng)
      : src.kind === "carto" ? await fetchCartoNear(src, lat, lng)
      : await fetchArcgisNear(src, lat, lng);
    return { records, sourceName: src.name, sourceUrl: src.homepage };
  } catch (e) {
    return { records: [], sourceName: src.name, sourceUrl: src.homepage, error: (e as Error).message };
  }
}
