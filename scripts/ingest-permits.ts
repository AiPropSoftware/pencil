/**
 * Daily permit ingest — runs the app's REAL pipeline (fetchAllCityDevelopments)
 * from a GitHub runner and upserts every normalized permit into the Supabase
 * `permits` table. Nothing is ever deleted: rows are keyed by their
 * deterministic permit id, `first_seen_at` is set once, `last_seen_at`
 * refreshes on every sighting. Day after day the table accumulates far beyond
 * any single portal's live window.
 *
 * Provenance travels with every row (source_key, source_url, ingest_run) so a
 * bad ingest is addressable with one predicate — never a guessing game.
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY (GitHub Actions secret). A missing key
 * is a HARD failure: a silently-skipping ingest is also a silently-pausing
 * Supabase project (no daily activity), which is how data goes dark.
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
const INGEST_RUN = `${process.env.GITHUB_RUN_ID ?? "local"}@${(process.env.GITHUB_SHA ?? "dev").slice(0, 7)}`;

if (!SERVICE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is not set. Add it as a GitHub Actions secret — without it nothing is being stored AND the Supabase project receives no daily activity (free-tier auto-pause risk).");
  process.exit(1);
}

const { fetchAllCityDevelopments } = await import("../src/providers/permits/socrata");

const r = await fetchAllCityDevelopments();
const now = new Date().toISOString();

// Build rows per CITY RESULT so each row carries the URL that produced it.
const allRows = r.perCity.flatMap((c) =>
  c.items.map((d) => ({
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
    // Real ISO dates or null — "—" placeholders poison date-ordered reads.
    approved_date: /^\d{4}-\d{2}-\d{2}/.test(d.approvedDate) ? d.approvedDate.slice(0, 10) : null,
    est_value: d.estValue,
    price_per_sqft: d.pricePerSqft,
    description: d.description,
    sqft_estimated: d.sqftEstimated,
    source_key: c.city,
    source_url: c.url.slice(0, 500),
    ingest_run: INGEST_RUN,
    last_seen_at: now, // first_seen_at is set once by the column default
  })),
);

// Postgres rejects a batch that touches the same primary key twice, and
// duplicate ids are legitimate in the source data (multiple records under one
// permit number; two sources covering one city). Newest-first: first wins.
const byId = new Map<string, (typeof allRows)[number]>();
for (const row of allRows) if (!byId.has(row.id)) byId.set(row.id, row);
const rows = [...byId.values()];

console.log(`Fetched ${allRows.length} permits from ${r.liveCityNames.length} cities: ${r.liveCityNames.join(", ")}`);
if (rows.length !== allRows.length) {
  console.log(`Deduped ${allRows.length - rows.length} rows sharing a permit id — upserting ${rows.length}.`);
}
const errored = r.perCity.filter((c) => c.error && c.items.length === 0);
if (errored.length) {
  console.log(`Sources with errors this run (their stored rows are untouched): ${errored.map((c) => `${c.city} [${String(c.error).slice(0, 80)}]`).join("; ")}`);
}
if (rows.length === 0) {
  console.error("FATAL: zero permits fetched across every source — refusing to call this a successful ingest.");
  process.exit(1);
}

/** Upsert one chunk; on an unknown-column error (provenance migration not yet
 * applied), retry without the provenance fields so data still banks. */
async function upsertChunk(chunk: Record<string, unknown>[]): Promise<void> {
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
      console.log("Provenance columns missing (run the 20260731 migration) — retrying without them.");
      const stripped = chunk.map(({ source_key: _a, source_url: _b, ingest_run: _c, ...rest }) => rest);
      res = await post(JSON.stringify(stripped));
      if (res.ok) return;
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
}

let upserted = 0;
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  try {
    await upsertChunk(chunk);
  } catch (e) {
    console.error(`Upsert failed at chunk ${i / 500}: ${(e as Error).message}`);
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
