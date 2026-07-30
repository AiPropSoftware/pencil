#!/usr/bin/env node
/**
 * Pencil data canary — daily health check of every load-bearing live data
 * source, run from GitHub Actions (runners have open egress; the dev sandbox
 * does not).
 *
 * Philosophy: Pencil never scrapes-and-stores — permits, parcels, and zone
 * lookups hit the city/county APIs live at query time. So "accuracy" fails in
 * two ways, and this canary watches both:
 *   1. BREAKAGE (fail): endpoint down, dataset retired, schema/field renamed —
 *      the app degrades honestly to manual mode, but we want to know first.
 *   2. DRIFT (warn): a value changed at the source (rezoning, new code
 *      supplement). Legitimate — but a human should re-verify the encoded
 *      tables. Warns file an issue without failing the run.
 *
 * Adding coverage = adding an entry to CHECKS. Keep expectations structural
 * (fields exist, values in sane ranges) — exact-value asserts only for facts
 * that should not change (and then only as drift warnings).
 */

const REPORT_PATH = new URL("../canary-report.json", import.meta.url).pathname;
const DAY_MS = 86_400_000;
const results = [];

function record(status, name, detail) {
  results.push({ status, name, detail });
  const icon = status === "ok" ? "✓" : status === "warn" ? "⚠" : "✗";
  console.log(`${icon} [${status.toUpperCase()}] ${name} — ${detail}`);
}

async function fetchJson(url, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 25_000);
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: { accept: "application/json", "user-agent": "pencil-data-canary/1.0" },
      });
      clearTimeout(t);
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 140)}`);
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`non-JSON response: ${text.slice(0, 140)}`);
      }
    } catch (e) {
      lastErr = e;
      if (i + 1 < tries) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

/** Newest date found anywhere in a set of records (ISO strings or epoch ms). */
function newestDate(rows) {
  let max = 0;
  const scan = (v) => {
    if (typeof v === "string") {
      const m = v.match(/\d{4}-\d{2}-\d{2}/);
      if (m) max = Math.max(max, Date.parse(m[0]) || 0);
    } else if (typeof v === "number" && v > 1_000_000_000_000 && v < 4_000_000_000_000) {
      max = Math.max(max, v); // ArcGIS epoch-ms date
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(scan);
    }
  };
  rows.forEach(scan);
  return max;
}

const CHECKS = [
  // ---- Zone lookups -------------------------------------------------------
  {
    name: "Austin zoning-by-address (Socrata nbzi-qabm)",
    async run() {
      const rows = await fetchJson("https://data.austintexas.gov/resource/nbzi-qabm.json?$limit=3");
      if (!Array.isArray(rows) || !rows.length) throw new Error("no rows returned");
      if (!("zoning_ztype" in rows[0]))
        throw new Error(`zoning_ztype field missing — schema changed? fields: ${Object.keys(rows[0]).join(",").slice(0, 120)}`);
      return `ok — sample zone "${rows[0].zoning_ztype}"`;
    },
  },
  {
    name: "Chicago zoning polygons point query (7cve-jgbp)",
    expectZone: "RT-4",
    async run() {
      const url =
        "https://data.cityofchicago.org/resource/7cve-jgbp.json?$select=zone_class&$where=" +
        encodeURIComponent("intersects(the_geom, 'POINT(-87.6776 41.9075)')");
      const rows = await fetchJson(url);
      if (!Array.isArray(rows) || !rows.length || !rows[0].zone_class)
        throw new Error("no zone_class for known point (2114 W Charleston)");
      const z = rows[0].zone_class;
      if (z !== this.expectZone) return { warn: `zone drift at test point: expected ${this.expectZone}, got ${z} — rezoning? re-verify` };
      return `zone_class ${z} at test point`;
    },
  },
  {
    name: "Austin ZoningProfile GIS service",
    async run() {
      const svc = await fetchJson("https://maps.austintexas.gov/arcgis/rest/services/ZoningProfile/ZoningProfile/MapServer?f=json");
      const layers = svc.layers || [];
      if (!layers.some((l) => /zoning/i.test(l.name || ""))) throw new Error(`no zoning layer found (layers: ${layers.map((l) => l.name).join(", ").slice(0, 120)})`);
      return `${layers.length} layers, zoning layer present`;
    },
  },
  {
    name: "Dallas zoning GIS service",
    async run() {
      const svc = await fetchJson("https://gis.dallascityhall.com/wwwgis/rest/services/Sdc_public/Zoning/MapServer?f=json");
      if (!(svc.layers || []).length) throw new Error("service returned no layers");
      return `${svc.layers.length} layers`;
    },
  },

  // ---- Permit feeds (recency is warn-only: ordering differs per portal) ---
  ...[
    ["Austin", "https://data.austintexas.gov/resource/3syk-w9eu.json"],
    ["Chicago", "https://data.cityofchicago.org/resource/ydr8-5enu.json"],
    ["Seattle", "https://data.seattle.gov/resource/76t5-zqzr.json"],
    ["San Francisco", "https://data.sfgov.org/resource/i98e-djp9.json"],
    ["New York", "https://data.cityofnewyork.us/resource/ipu4-2q9a.json"],
    ["Los Angeles", "https://data.lacity.org/resource/yv23-pmwf.json"],
    ["Fort Worth", "https://data.fortworthtexas.gov/resource/quz7-xnsy.json"],
    ["Dallas", "https://www.dallasopendata.com/resource/e7gq-4sah.json"],
  ].map(([city, url]) => ({
    name: `${city} permit feed`,
    async run() {
      const rows = await fetchJson(`${url}?$limit=25`);
      if (!Array.isArray(rows) || rows.length < 5) throw new Error(`only ${Array.isArray(rows) ? rows.length : 0} rows`);
      const newest = newestDate(rows);
      if (newest && Date.now() - newest > 120 * DAY_MS)
        return { warn: `newest date in sample is ${new Date(newest).toISOString().slice(0, 10)} — feed may be stale (or sample unordered)` };
      return `${rows.length} rows, newest ${newest ? new Date(newest).toISOString().slice(0, 10) : "n/a"}`;
    },
  })),
  {
    name: "Miami permit feed (city ArcGIS Building_Permits)",
    async run() {
      const url =
        "https://services6.arcgis.com/ONZht79c8QWuX759/arcgis/rest/services/Building_Permits/FeatureServer/0/query" +
        "?where=1%3D1&outFields=PermitNumber,IssuedDate,CompanyName&resultRecordCount=10&orderByFields=IssuedDate%20DESC&returnGeometry=false&f=json";
      const data = await fetchJson(url);
      const feats = data.features || [];
      if (!feats.length) throw new Error(`no features (${JSON.stringify(data).slice(0, 120)})`);
      const a = feats[0].attributes || {};
      if (!("PermitNumber" in a) || !("CompanyName" in a)) throw new Error(`expected fields missing: ${Object.keys(a).join(",").slice(0, 120)}`);
      const newest = newestDate(feats.map((f) => f.attributes));
      if (newest && Date.now() - newest > 120 * DAY_MS)
        return { warn: `newest IssuedDate ${new Date(newest).toISOString().slice(0, 10)} — stale?` };
      return `${feats.length} permits, newest ${newest ? new Date(newest).toISOString().slice(0, 10) : "n/a"}`;
    },
  },

  // ---- Parcel / lot-size sources ------------------------------------------
  {
    name: "NYC PLUTO parcel table (64uk-42ks)",
    async run() {
      const rows = await fetchJson("https://data.cityofnewyork.us/resource/64uk-42ks.json?$select=address,lotarea,zonedist1,lotfront,lotdepth&$limit=3");
      if (!Array.isArray(rows) || !rows.length) throw new Error("no rows");
      for (const f of ["address", "lotarea", "zonedist1"]) if (!(f in rows[0])) throw new Error(`field ${f} missing — schema changed?`);
      return "schema intact (address, lotarea, zonedist1)";
    },
  },
  {
    name: "Texas StratMap statewide parcels (point hit)",
    async run() {
      const root = "https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap25_land_parcels_48/MapServer";
      const svc = await fetchJson(`${root}?f=json`);
      const layer = (svc.layers || [])[0];
      if (!layer) throw new Error("service returned no layers");
      const q =
        `${root}/${layer.id}/query?geometry=${encodeURIComponent("-96.9561,32.5885")}` +
        "&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json";
      const data = await fetchJson(q);
      const attrs = data.features?.[0]?.attributes;
      if (!attrs) throw new Error("no parcel at Cedar Hill test point");
      const acreEntry = Object.entries(attrs).find(([k, v]) => /acre|gis_area|lgl_area/i.test(k) && typeof v === "number" && v > 0.005 && v < 5000);
      if (!acreEntry) throw new Error(`no sane acreage field: ${Object.keys(attrs).join(",").slice(0, 140)}`);
      return `parcel hit; ${acreEntry[0]}=${acreEntry[1]}`;
    },
  },
  {
    name: "Florida statewide cadastral (LND_SQFOOT field)",
    async run() {
      const root = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer";
      const svc = await fetchJson(`${root}?f=json`);
      const layers = svc.layers || [];
      if (!layers.length) throw new Error("no layers");
      for (const l of layers.slice(0, 3)) {
        const meta = await fetchJson(`${root}/${l.id}?f=json`);
        if ((meta.fields || []).some((f) => /^lnd_sqfoot$/i.test(f.name))) return `LND_SQFOOT present on layer ${l.id} (${l.name})`;
      }
      throw new Error("LND_SQFOOT field not found on first layers — schema changed?");
    },
  },
  {
    name: "Miami-Dade county parcels (PaParcel layer)",
    async run() {
      const svc = await fetchJson("https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer?f=json");
      const hit = (svc.layers || []).find((l) => /paparcel/i.test(l.name || ""));
      if (!hit) throw new Error(`PaParcel layer missing (layers: ${(svc.layers || []).map((l) => l.name).join(", ").slice(0, 140)})`);
      return `layer ${hit.id} "${hit.name}"`;
    },
  },
  {
    name: "MassGIS parcels (LOT_SIZE + LOT_UNITS fields)",
    async run() {
      const root = "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/L3_TAXPAR_POLY_ASSESS_gdb/FeatureServer";
      const svc = await fetchJson(`${root}?f=json`);
      for (const l of (svc.layers || []).slice(0, 4)) {
        const meta = await fetchJson(`${root}/${l.id}?f=json`);
        const names = (meta.fields || []).map((f) => f.name.toUpperCase());
        if (names.includes("LOT_SIZE") && names.includes("LOT_UNITS")) return `fields present on layer ${l.id}`;
      }
      throw new Error("LOT_SIZE/LOT_UNITS not found — schema changed?");
    },
  },
  {
    name: "NJ statewide parcels (CALC_ACRE field)",
    async run() {
      const root = "https://maps.nj.gov/arcgis/rest/services/Basemap/Parcels_NJ_WM/MapServer";
      const svc = await fetchJson(`${root}?f=json`);
      for (const l of (svc.layers || []).slice(0, 4)) {
        const meta = await fetchJson(`${root}/${l.id}?f=json`);
        if ((meta.fields || []).some((f) => /^calc_acre$/i.test(f.name))) return `CALC_ACRE present on layer ${l.id}`;
      }
      throw new Error("CALC_ACRE not found — schema changed?");
    },
  },

  // ---- Pipeline dependencies ----------------------------------------------
  {
    name: "US Census geocoder",
    async run() {
      const data = await fetchJson(
        "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=" +
          encodeURIComponent("1600 S 1st St, Austin, TX") +
          "&benchmark=Public_AR_Current&format=json",
      );
      const m = data.result?.addressMatches;
      if (!m?.length) throw new Error("no geocode match for known-good address");
      return `matched "${m[0].matchedAddress}"`;
    },
  },
  {
    name: "Austin LDC supplement watch (Municode)",
    warnOnly: true,
    // Baseline captured 2026-07-24 alongside zoning/standards/austin_tx.json.
    baseline: { jobId: 488379 },
    async run() {
      const job = await fetchJson("https://api.municode.com/Jobs/latest/15303");
      const id = job.Id ?? job.id ?? job.JobId ?? job.jobId;
      if (id == null) return { warn: `unexpected Municode response shape: ${JSON.stringify(job).slice(0, 140)}` };
      if (Number(id) !== this.baseline.jobId)
        return {
          warn:
            `Austin LDC has a NEW supplement (job ${id}, baseline ${this.baseline.jobId}) — ` +
            "re-verify zoning/standards/austin_tx.json and the Austin table in src/lib/zoning/zoning.ts, then update the baseline here.",
        };
      return `supplement unchanged (job ${id})`;
    },
  },
];

// ---- Runner ----------------------------------------------------------------
const pool = 4;
let i = 0;
async function worker() {
  while (i < CHECKS.length) {
    const check = CHECKS[i++];
    try {
      const out = await check.run();
      if (out && typeof out === "object" && out.warn) record("warn", check.name, out.warn);
      else record("ok", check.name, out);
    } catch (e) {
      record(check.warnOnly ? "warn" : "fail", check.name, String(e.message || e).slice(0, 300));
    }
  }
}
await Promise.all(Array.from({ length: pool }, worker));

const fails = results.filter((r) => r.status === "fail");
const warns = results.filter((r) => r.status === "warn");
const summary = `${results.length} checks: ${results.length - fails.length - warns.length} ok, ${warns.length} drift warnings, ${fails.length} failures`;
console.log(`\n${summary}`);

const fs = await import("node:fs");
fs.writeFileSync(REPORT_PATH, JSON.stringify({ date: new Date().toISOString(), summary, results }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `## Data canary — ${summary}`,
    "",
    "| Status | Source | Detail |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.status === "ok" ? "✅" : r.status === "warn" ? "⚠️" : "❌"} | ${r.name} | ${r.detail.replace(/\|/g, "\\|")} |`),
  ].join("\n");
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
}
process.exit(fails.length ? 1 : 0);
