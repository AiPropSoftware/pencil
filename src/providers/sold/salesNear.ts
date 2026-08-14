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
  /**
   * ISO date at the precision the source publishes — "2026-06-11", or
   * "2025-02" where the roll records only year+month (FL). Null if absent.
   */
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
  /** Composes a date the layer splits across fields (e.g. FL year+month). */
  dateFrom?: (row: Record<string, unknown>) => string | null;
  sqftKey: string | null;
  addressKeys: string[];
  /** $RECENT_YEAR is replaced with (current year - 2) at query time. */
  where?: string;
  /**
   * Probe-verified query shape: Nashville's MapServer answers envelopes,
   * Florida's hosted layer 400s on envelopes but answers point+distance.
   */
  queryStyle?: "envelope" | "distance";
  /** Server-side newest-first; dropped automatically if the server rejects it. */
  orderBy?: string;
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

/**
 * Two-request join for counties that publish sales and parcel locations as
 * separate Socrata datasets (Cook County): bbox the parcel table for
 * PIN + coords + address, then pull recent sales for those PINs.
 */
interface SocrataJoinSaleSource {
  kind: "socrataJoin";
  name: string;
  homepage: string;
  parcelUrl: string;
  pinKey: string;
  latKey: string;
  lonKey: string;
  addressKey: string;
  salesUrl: string;
  salesPinKey: string;
  priceKey: string;
  dateKey: string;
  /** Join rows carry no building size; address is synthesized into __addr. */
  sqftKey: null;
  addressKeys: string[];
  bbox: BBox;
}

export type SaleSource = SocrataSaleSource | ArcgisSaleSource | CartoSaleSource | SocrataJoinSaleSource;

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
  {
    // Verified 2026-08-14: envelope query works on the Metro MapServer;
    // SalePrice/PropAddr/FinishArea/OwnDate confirmed in the live schema.
    // OwnDate = when the current owner took title, i.e. the sale date.
    kind: "arcgis",
    name: "Metro Nashville / Davidson Co. Assessor parcels",
    homepage: "https://maps.nashville.gov/ParcelViewer/",
    layer: "https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0",
    bbox: { latMin: 35.96, latMax: 36.42, lngMin: -87.06, lngMax: -86.51 },
    priceKey: "SalePrice",
    dateKey: "OwnDate",
    sqftKey: "FinishArea",
    addressKeys: ["PropAddr"],
    // Canary 2026-08-14: this MapServer 400s on ANY where clause against
    // SalePrice — query bare, filter client-side (finish() does it anyway).
    queryStyle: "envelope",
  },
  {
    // Verified 2026-08-14: PostGIS radius query returns live rows
    // (sale_price/sale_date/total_livable_area/location + lat/lng).
    kind: "carto",
    name: "Philadelphia OPA property records",
    homepage: "https://opendataphilly.org/datasets/opa-property-assessments/",
    sqlBase: "https://phl.carto.com/api/v2/sql",
    sqlTemplate:
      "SELECT location, sale_price, sale_date, total_livable_area, ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng " +
      "FROM opa_properties_public WHERE the_geom IS NOT NULL AND sale_price > 40000 " +
      "AND ST_DWithin(the_geom::geography, ST_SetSRID(ST_MakePoint($LNG, $LAT), 4326)::geography, $RADIUS) " +
      "ORDER BY sale_date DESC LIMIT 250",
    bbox: { latMin: 39.86, latMax: 40.14, lngMin: -75.29, lngMax: -74.95 },
    priceKey: "sale_price",
    dateKey: "sale_date",
    sqftKey: "total_livable_area",
    addressKeys: ["location"],
  },
  {
    // Verified 2026-08-14: the state's own parcel roll, every FL county.
    // Envelope queries 400 on this hosted layer; point+distance works.
    // The roll publishes sale year+month only, so dates show as "2025-02".
    kind: "arcgis",
    name: "Florida DOR statewide parcel roll",
    homepage: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0",
    layer: "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0",
    bbox: { latMin: 24.4, latMax: 31.05, lngMin: -87.65, lngMax: -79.9 },
    priceKey: "SALE_PRC1",
    dateKey: null,
    dateFrom: (r) => {
      const y = Number(r.SALE_YR1);
      const m = Number(r.SALE_MO1);
      if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
      return Number.isFinite(m) && m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, "0")}` : String(y);
    },
    sqftKey: "TOT_LVG_AR",
    addressKeys: ["PHY_ADDR1"],
    where: "SALE_PRC1 > 40000 AND SALE_YR1 >= $RECENT_YEAR",
    queryStyle: "distance",
    orderBy: "SALE_YR1 DESC",
  },
  {
    // Verified 2026-08-14 (round 3): MassGIS L3 statewide parcels —
    // LS_PRICE/LS_DATE(yyyymmdd)/SITE_ADDR/RES_AREA, envelope works.
    kind: "arcgis",
    name: "MassGIS statewide tax parcels",
    homepage: "https://www.mass.gov/info-details/massgis-data-property-tax-parcels",
    layer: "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0",
    bbox: { latMin: 41.2, latMax: 42.9, lngMin: -73.6, lngMax: -69.9 },
    priceKey: "LS_PRICE",
    dateKey: "LS_DATE",
    sqftKey: "RES_AREA",
    addressKeys: ["SITE_ADDR"],
  },
  {
    // Verified 2026-08-14 (round 3): Franklin County Auditor's own sales
    // points — SALEDATE(epoch)/SalePrice/SITEADDRESS/RESFLRAREA.
    kind: "arcgis",
    name: "Franklin County Auditor sales (Columbus)",
    homepage: "https://www.franklincountyauditor.com",
    layer: "https://services1.arcgis.com/7r2Wl09a1Apy459r/arcgis/rest/services/FCAO_Sales_Dashboard_Sales_Points/FeatureServer/0",
    bbox: { latMin: 39.81, latMax: 40.16, lngMin: -83.26, lngMax: -82.77 },
    priceKey: "SalePrice",
    dateKey: "SALEDATE",
    sqftKey: "RESFLRAREA",
    addressKeys: ["SITEADDRESS"],
  },
  {
    // Verified 2026-08-14 (round 3): Cuyahoga County sales 2021-present —
    // SALE_AMOUNT/SALE_DATE(epoch)/PCL_ADDR_FULL/TOTAL_RES_LIV_AREA.
    kind: "arcgis",
    name: "Cuyahoga County parcel sales (Cleveland)",
    homepage: "https://cuyahogacounty.gov/fiscal-officer",
    layer: "https://services7.arcgis.com/GXM8JipKyc0m6HBi/arcgis/rest/services/CuyahogaSalesData/FeatureServer/0",
    bbox: { latMin: 41.28, latMax: 41.63, lngMin: -81.97, lngMax: -81.39 },
    priceKey: "SALE_AMOUNT",
    dateKey: "SALE_DATE",
    sqftKey: "TOTAL_RES_LIV_AREA",
    addressKeys: ["PCL_ADDR_FULL"],
  },
  {
    // Verified 2026-08-14 (round 3): King County GIS "Parcel Sales Last 3
    // Years" — SalePrice/SaleDate(epoch)/address. No building-size field.
    kind: "arcgis",
    name: "King County parcel sales (Seattle)",
    homepage: "https://kingcounty.gov/en/dept/assessor",
    layer: "https://services.arcgis.com/Ej0PsM5Aw677QF1W/arcgis/rest/services/PARCEL_SALES3YR_AREA_287/FeatureServer/0",
    bbox: { latMin: 47.08, latMax: 47.79, lngMin: -122.55, lngMax: -121.0 },
    priceKey: "SalePrice",
    dateKey: "SaleDate",
    sqftKey: null,
    addressKeys: ["address"],
  },
  {
    // Verified 2026-08-14 (round 3): Wake County parcels — TOTSALPRICE/
    // SALE_DATE(epoch)/SITE_ADDRESS/HEATEDAREA, envelope works.
    kind: "arcgis",
    name: "Wake County parcels (Raleigh)",
    homepage: "https://www.wake.gov/departments-government/tax-administration",
    layer: "https://maps.wake.gov/arcgis/rest/services/Property/Parcels/MapServer/0",
    bbox: { latMin: 35.52, latMax: 36.08, lngMin: -78.99, lngMax: -78.25 },
    priceKey: "TOTSALPRICE",
    dateKey: "SALE_DATE",
    sqftKey: "HEATEDAREA",
    addressKeys: ["SITE_ADDRESS"],
  },
  {
    // Verified 2026-08-14 (round 3): Detroit's authoritative parcel layer —
    // sale_price/sale_date/address/total_floor_area.
    kind: "arcgis",
    name: "City of Detroit parcels",
    homepage: "https://data.detroitmi.gov",
    layer: "https://services2.arcgis.com/PpbvckyUgaYqseNQ/arcgis/rest/services/Detroit_MP_Parcel_Authoritative/FeatureServer/0",
    bbox: { latMin: 42.25, latMax: 42.46, lngMin: -83.29, lngMax: -82.91 },
    priceKey: "sale_price",
    dateKey: "sale_date",
    sqftKey: "total_floor_area",
    addressKeys: ["address"],
  },
  {
    // Verified 2026-08-14 (round 3): NJ MOD-IV statewide composite —
    // SALE_PRICE/DEED_DATE(epoch)/PROP_LOC. Listed AFTER NYC/Philly so
    // border points hit the city feeds first.
    kind: "arcgis",
    name: "NJ statewide parcels (MOD-IV)",
    homepage: "https://njgin.nj.gov",
    layer: "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0",
    bbox: { latMin: 38.9, latMax: 41.36, lngMin: -75.6, lngMax: -73.89 },
    priceKey: "SALE_PRICE",
    dateKey: "DEED_DATE",
    sqftKey: null,
    addressKeys: ["PROP_LOC", "ST_ADDRESS"],
  },
  {
    // Verified 2026-08-14 (round 3): Cook County publishes sales and parcel
    // locations separately — a two-request PIN join covers Chicago.
    kind: "socrataJoin",
    name: "Cook County Assessor sales (Chicago)",
    homepage: "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
    parcelUrl: "https://datacatalog.cookcountyil.gov/resource/tx2p-k2g9.json",
    pinKey: "pin",
    latKey: "lat",
    lonKey: "lon",
    addressKey: "prop_address_full",
    salesUrl: "https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json",
    salesPinKey: "pin",
    priceKey: "sale_price",
    dateKey: "sale_date",
    sqftKey: null,
    addressKeys: ["__addr"],
    bbox: { latMin: 41.46, latMax: 42.16, lngMin: -88.27, lngMax: -87.52 },
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
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/); // MassGIS "20130624"
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
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
    const date =
      src.kind === "arcgis" && src.dateFrom ? src.dateFrom(row)
      : src.dateKey ? toIsoDate(row[src.dateKey])
      : null;
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
  // Degradation ladder: order → extra where (the bbox clause always stays —
  // finish() re-filters price/sort client-side, so nothing is lost but speed).
  let res = await fetch(`${src.url}?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (res.status === 400 && src.dateKey) {
    params.delete("$order");
    res = await fetch(`${src.url}?${params.toString()}`, { headers: { Accept: "application/json" } });
  }
  if (res.status === 400 && src.where) {
    params.set("$where", clauses[0]);
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
  const params = new URLSearchParams({
    f: "json",
    where: (src.where ?? "1=1").replace("$RECENT_YEAR", String(new Date().getFullYear() - 2)),
    outFields: "*",
    resultRecordCount: "250",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
  });
  if (src.queryStyle === "distance") {
    params.set("geometryType", "esriGeometryPoint");
    params.set("geometry", JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
    params.set("distance", String(RADIUS_M));
    params.set("units", "esriSRUnit_Meter");
  } else {
    const dLat = RADIUS_M / 111_000;
    const dLng = RADIUS_M / (111_000 * Math.cos((lat * Math.PI) / 180));
    params.set("geometryType", "esriGeometryEnvelope");
    params.set("geometry", `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`);
  }
  if (src.orderBy) params.set("orderByFields", src.orderBy);

  type ArcResp = {
    features?: { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number; rings?: number[][][] } }[];
    error?: { message?: string };
  };
  const run = async (): Promise<ArcResp> => {
    const res = await fetch(`${src.layer}/query?${params.toString()}`);
    if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
    return (await res.json()) as ArcResp;
  };
  // Degradation ladder (same philosophy as the permit connectors): the where/
  // orderBy are server-side optimizations only — finish() re-filters and
  // re-sorts client-side, so dropping them changes nothing but efficiency.
  let data = await run();
  if (!data.features && src.orderBy) {
    params.delete("orderByFields");
    data = await run();
  }
  if (!data.features && params.get("where") !== "1=1") {
    params.set("where", "1=1");
    data = await run();
  }
  if (!data.features && src.queryStyle === "distance") {
    // FL's hosted layer intermittently rejects the JSON point ("SRID is not
    // valid") — the bare "lng,lat" form + inSR is the last resort.
    params.set("geometry", `${lng},${lat}`);
    data = await run();
  }
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

async function fetchSocrataJoinNear(src: SocrataJoinSaleSource, lat: number, lng: number): Promise<SaleRecord[]> {
  const dLat = RADIUS_M / 111_000;
  const dLng = RADIUS_M / (111_000 * Math.cos((lat * Math.PI) / 180));
  const w = `${src.latKey} > ${lat - dLat} AND ${src.latKey} < ${lat + dLat} AND ${src.lonKey} > ${lng - dLng} AND ${src.lonKey} < ${lng + dLng}`;
  const pParams = new URLSearchParams({
    $where: w,
    $select: `${src.pinKey},${src.latKey},${src.lonKey},${src.addressKey}`,
    $limit: "400",
  });
  const pRes = await fetch(`${src.parcelUrl}?${pParams.toString()}`, { headers: { Accept: "application/json" } });
  if (!pRes.ok) throw new Error(`${src.name}: parcels HTTP ${pRes.status}`);
  const parcels = (await pRes.json()) as Record<string, unknown>[];
  const byPin = new Map<string, { lat: number; lng: number; address: string }>();
  for (const p of parcels) {
    const pin = String(p[src.pinKey] ?? "");
    const pLat = num(p[src.latKey]);
    const pLng = num(p[src.lonKey]);
    if (!pin || !Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
    if (!byPin.has(pin)) byPin.set(pin, { lat: pLat, lng: pLng, address: String(p[src.addressKey] ?? "").trim() });
  }
  if (byPin.size === 0) return [];
  // One IN() lookup per 150 PINs keeps URLs under the server's length cap.
  const pins = [...byPin.keys()];
  const raw: { row: Record<string, unknown>; lat: number; lng: number }[] = [];
  for (let i = 0; i < pins.length && i < 300; i += 150) {
    const list = pins.slice(i, i + 150).map((p) => `'${p}'`).join(",");
    const sParams = new URLSearchParams({
      $where: `${src.salesPinKey} in(${list}) AND ${src.priceKey} > 40000`,
      $order: `${src.dateKey} DESC`,
      $limit: "150",
    });
    const sRes = await fetch(`${src.salesUrl}?${sParams.toString()}`, { headers: { Accept: "application/json" } });
    if (!sRes.ok) continue; // partial coverage beats a dead panel
    const rows = (await sRes.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const loc = byPin.get(String(row[src.salesPinKey] ?? ""));
      if (!loc) continue;
      raw.push({ row: { ...row, __addr: loc.address }, lat: loc.lat, lng: loc.lng });
    }
  }
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
      : src.kind === "socrataJoin" ? await fetchSocrataJoinNear(src, lat, lng)
      : await fetchArcgisNear(src, lat, lng);
    return { records, sourceName: src.name, sourceUrl: src.homepage };
  } catch (e) {
    return { records: [], sourceName: src.name, sourceUrl: src.homepage, error: (e as Error).message };
  }
}
