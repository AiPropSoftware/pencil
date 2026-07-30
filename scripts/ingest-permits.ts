/**
 * Daily permit ingest — runs the app's REAL pipeline (fetchAllCityDevelopments)
 * from a GitHub runner and upserts every normalized permit into the Supabase
 * `permits` table. Nothing is ever deleted: rows are keyed by their
 * deterministic permit id, `first_seen_at` is set once, `last_seen_at`
 * refreshes on every sighting. Day after day the table accumulates far beyond
 * any single portal's live window — that accumulation is what makes the map's
 * data permanent instead of whatever a city API happens to return today.
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY (GitHub Actions secret). Exits 0 with a
 * notice when it's absent so the scheduled run is a no-op until configured.
 */

// Browsers always send a UA; several Socrata CDNs reject UA-less requests.
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: any, init: any = {}) =>
  realFetch(url, {
    ...init,
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", ...(init.headers || {}) },
  })) as typeof fetch;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hhhpochstmzjglzyyvoj.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SERVICE_KEY) {
  console.log("SUPABASE_SERVICE_ROLE_KEY not set — ingest skipped (add it as a GitHub Actions secret to enable permanent storage).");
  process.exit(0);
}

const { fetchAllCityDevelopments } = await import("../src/providers/permits/socrata");

const r = await fetchAllCityDevelopments();
const now = new Date().toISOString();
const rows = r.items.map((d) => ({
  id: d.id,
  city: d.city,
  state: d.state,
  name: d.name,
  developer: d.developer,
  lat: d.lat,
  lng: d.lng,
  product_type: d.productType,
  units: d.units,
  land_sqft: d.landSqft,
  building_sqft: d.buildingSqft,
  stories: d.stories,
  status: d.status,
  approved_date: d.approvedDate,
  est_value: d.estValue,
  price_per_sqft: d.pricePerSqft,
  description: d.description,
  sqft_estimated: d.sqftEstimated,
  last_seen_at: now, // first_seen_at is set once by the column default
}));

console.log(`Fetched ${rows.length} permits from ${r.liveCityNames.length} cities: ${r.liveCityNames.join(", ")}`);

let upserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const res = await realFetch(`${SUPABASE_URL}/rest/v1/permits?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Upsert failed at chunk ${i / 500}: HTTP ${res.status} ${body.slice(0, 300)}`);
    process.exit(1);
  }
  upserted += chunk.length;
}

// Total rows now stored — the number that only ever grows.
const head = await realFetch(`${SUPABASE_URL}/rest/v1/permits?select=id`, {
  method: "HEAD",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", Range: "0-0" },
});
const total = head.headers.get("content-range")?.split("/")[1] ?? "?";
console.log(`Upserted ${upserted} permits. Table now holds ${total} permits total (never pruned).`);
