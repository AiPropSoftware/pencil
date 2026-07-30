/**
 * Permit store snapshot — exports the whole `permits` table to a plain,
 * deterministic CSV. Committed daily to the `data-snapshots` branch, this is
 * the OWNER-CONTROLLED copy of the data: even if Supabase vanished tomorrow,
 * every permit ever banked lives in the git history of your own repo.
 *
 * Reads with the public anon key (RLS: suppressed/quarantined rows are
 * excluded — a backup should not launder known-bad rows back in).
 * Deterministic: sorted by id, volatile last_seen_at reduced to a date, so
 * an unchanged store produces a byte-identical file and git stores nothing.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hhhpochstmzjglzyyvoj.supabase.co";
const ANON_KEY = "sb_publishable_IjXg9NzzGLbOyquTP-S21A_MCtBOmyP";

const COLS = [
  "id", "city", "state", "name", "developer", "lat", "lng", "product_type",
  "units", "land_sqft", "building_sqft", "stories", "status", "approved_date",
  "est_value", "price_per_sqft", "sqft_estimated", "source_url",
  "source_permit_no", "first_seen_at",
] as const;

const esc = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows: Record<string, unknown>[] = [];
for (let page = 0; page < 200; page++) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/permits?select=*&order=id&limit=1000&offset=${page * 1000}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  if (!res.ok) {
    console.error(`FATAL: HTTP ${res.status} reading the store: ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const batch = (await res.json()) as Record<string, unknown>[];
  rows.push(...batch);
  if (batch.length < 1000) break;
}
if (rows.length === 0) {
  console.error("FATAL: store returned zero rows — refusing to write an empty snapshot over a real one.");
  process.exit(1);
}

const lines = [COLS.join(",")];
for (const r of rows) {
  lines.push(COLS.map((c) => (c === "first_seen_at" ? esc(String(r[c] ?? "").slice(0, 10)) : esc(r[c]))).join(","));
}

const fs = await import("node:fs");
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/permits.csv", lines.join("\n") + "\n");

const perCity = new Map<string, number>();
for (const r of rows) perCity.set(String(r.city), (perCity.get(String(r.city)) ?? 0) + 1);
console.log(`Wrote data/permits.csv: ${rows.length} permits, ${perCity.size} cities.`);
console.log([...perCity.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}=${n}`).join(", "));
