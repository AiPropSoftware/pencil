/**
 * Coverage probe — runs the app's REAL permit pipeline (fetchAllCityDevelopments,
 * the exact code the browser executes) from a GitHub runner, where egress is
 * open. Reports per-city raw rows, usable permits after the normalizer, error
 * text, and the live schema when nothing survived.
 *
 * Run via the Coverage probe workflow (workflow_dispatch). Not in the bundle.
 */

// The app runs in a browser, which always sends a UA — several Socrata CDNs
// reject UA-less requests (probe artifact, not an app failure). Mimic it.
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: any, init: any = {}) =>
  realFetch(url, {
    ...init,
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", ...(init.headers || {}) },
  })) as typeof fetch;

const { fetchAllCityDevelopments } = await import("../src/providers/permits/socrata");

const r = await fetchAllCityDevelopments();
const report = r.perCity
  .map((c) => ({
    city: c.city,
    rows: c.total,
    usable: c.items.length,
    error: (c.error ?? "").slice(0, 200),
    columns: c.items.length === 0 ? c.columns.slice(0, 40).join(",") : "",
    sample: c.items[0]
      ? `${c.items[0].lat.toFixed(4)},${c.items[0].lng.toFixed(4)} · ${c.items[0].approvedDate} · ${c.items[0].name.slice(0, 40)}`
      : "",
  }))
  .sort((a, b) => a.usable - b.usable);

console.log(JSON.stringify(report, null, 2));
console.log(
  `\nTOTAL: ${r.items.length} usable permits across ${r.liveCityNames.length} live cities: ${r.liveCityNames.join(", ")}`,
);
const dead = report.filter((c) => c.usable === 0).map((c) => c.city);
if (dead.length) console.log(`ZERO-USABLE: ${dead.join(", ")}`);

// Pittsburgh's wired WPRDC resource turned out to be suppression/storm-water
// permits — scout the datastore for the real building-permit resource.
try {
  const d = await (await realFetch("https://data.wprdc.org/api/3/action/package_search?q=building+permits&rows=6", { headers: { accept: "application/json" } })).json();
  console.log(`\nSCOUT WPRDC: ${(d.result?.results || []).map((p: any) => `${p.name}: ${(p.resources || []).filter((x: any) => x.datastore_active).map((x: any) => `${x.id} "${String(x.name).slice(0, 50)}"`).join("; ")}`).join("\n  ")}`);
} catch (e) {
  console.log(`SCOUT WPRDC: ${(e as Error).message}`);
}
