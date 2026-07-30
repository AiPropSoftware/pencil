/**
 * Verify permit store — independent, read-only check of what's ACTUALLY
 * sitting in the Supabase `permits` table, run on a GitHub Actions runner
 * (open egress) so it hits the real database the same way a user's browser
 * does. This deliberately does NOT trust the ingest job's own "upserted N
 * rows" claim — it queries the table directly and reports ground truth.
 *
 * No secrets required: `permits` is public-read via RLS, so this uses the
 * same publishable/anon key the browser already uses.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hhhpochstmzjglzyyvoj.supabase.co";
const ANON_KEY = "sb_publishable_IjXg9NzzGLbOyquTP-S21A_MCtBOmyP";

const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

async function countRows(filter = ""): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/permits?select=id${filter}`, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} counting rows (filter="${filter}")`);
  const range = res.headers.get("content-range"); // "0-0/123"
  return range ? Number(range.split("/")[1] || 0) : -1;
}

async function fetchRows(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/permits?${query}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const total = await countRows();
console.log(`TOTAL PERMITS IN STORE: ${total}`);
if (total <= 0) {
  console.log("STORE IS EMPTY — table missing, RLS blocking reads, or ingest hasn't written yet.");
  process.exit(0);
}

// Per-city tally: PostgREST has no bare GROUP BY without an RPC, and the
// store is small enough (thousands, not millions) to page through and
// count client-side.
const cityCounts = new Map<string, number>();
for (let page = 0; page < 30; page++) {
  const rows = await fetchRows(`select=city&order=id&limit=1000&offset=${page * 1000}`);
  if (!rows.length) break;
  for (const r of rows) {
    const c = String(r.city);
    cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
  }
  if (rows.length < 1000) break;
}
const byCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`CITIES IN STORE (${byCity.length}): ${byCity.map(([c, n]) => `${c}=${n}`).join(", ")}`);

const miamiCount = await countRows("&city=eq.Miami");
console.log(`\nMIAMI PERMITS IN STORE: ${miamiCount}`);
if (miamiCount > 0) {
  const sample = await fetchRows(
    "city=eq.Miami&select=id,name,developer,approved_date,est_value,first_seen_at,last_seen_at&order=last_seen_at.desc&limit=10",
  );
  console.log("Sample Miami permits (most recently seen first):");
  for (const r of sample) {
    console.log(
      `  ${r.id} · ${r.name} · ${r.developer} · approved ${r.approved_date} · $${r.est_value ?? 0} · first seen ${r.first_seen_at} · last seen ${r.last_seen_at}`,
    );
  }
} else {
  console.log("No Miami rows found — Miami's live feed may have returned 0 matching permits on this ingest run.");
}
