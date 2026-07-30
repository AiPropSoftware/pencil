/**
 * Coverage probe — runs the app's REAL permit pipeline (fetchAllCityDevelopments,
 * the exact code the browser executes) from a GitHub runner, where egress is
 * open. Answers "why does city X show zero bubbles?" with the app's own
 * diagnostics: raw rows fetched, rows surviving the normalizer, the error if
 * any, and the city's actual column names when nothing survived.
 *
 * Run via the Coverage probe workflow (workflow_dispatch). Not part of the
 * app bundle.
 */
import { fetchAllCityDevelopments } from "../src/providers/permits/socrata";

const r = await fetchAllCityDevelopments();
const report = r.perCity
  .map((c) => ({
    city: c.city,
    rows: c.total,
    usable: c.items.length,
    error: c.error ?? "",
    // Only when nothing survived: the real schema, for filter tuning.
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
