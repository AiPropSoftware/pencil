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

async function fetchJson(url, tries = 3) {
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

/** Diagnostic: what a portal's catalog offers for a query — used when a known
 * dataset dies so the failure message names likely successors. Tries the
 * Socrata catalog (domain-scoped) first, then the ArcGIS Hub API (some cities
 * migrated portals wholesale, e.g. Fort Worth). */
async function catalogCandidates(host, q) {
  try {
    const cat = await fetchJson(
      `https://${host}/api/catalog/v1?q=${encodeURIComponent(q)}&only=datasets&limit=6&search_context=${host}`,
    );
    const hits = (cat.results || []).map((r) => `${r.resource?.id} "${r.resource?.name}"`).join("; ");
    if (hits) return `socrata: ${hits.slice(0, 380)}`;
  } catch {}
  try {
    const hub = await fetchJson(`https://${host}/api/v3/datasets?q=${encodeURIComponent(q)}&page[size]=6`);
    const hits = (hub.data || []).map((d) => `${d.id} "${d.attributes?.name}"`).join("; ");
    if (hits) return `arcgis-hub: ${hits.slice(0, 380)}`;
  } catch {}
  return "no catalog reachable on this host (portal migrated?)";
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
    name: "Chicago zoning polygons point query (dj47-wfun)",
    expectZone: "RT-4",
    async run() {
      // 7cve-jgbp turned out to be the MAP visualization asset (no queryable
      // rows); dj47-wfun is the underlying tabular resource the app queries.
      const url =
        "https://data.cityofchicago.org/resource/dj47-wfun.json?$select=zone_class&$where=" +
        encodeURIComponent("intersects(the_geom, 'POINT(-87.6776 41.9075)')");
      const rows = await fetchJson(url, 3);
      if (!Array.isArray(rows) || !rows.length || !rows[0].zone_class)
        throw new Error(`no zone_class for known point (${JSON.stringify(rows).slice(0, 140)})`);
      const z = rows[0].zone_class;
      if (z !== this.expectZone) return { warn: `zone drift at test point: expected ${this.expectZone}, got ${z} — rezoning? re-verify` };
      return `zone_class ${z} at test point (dj47-wfun)`;
    },
  },
  {
    // The city retired ZoningProfile (404, caught by canary run #2). This is
    // the pilot-verified base zoning layer, queried exactly the way the app
    // would (inSR=4326 + 120 ft tolerance) — green here means the app can
    // safely point at it without client-side reprojection.
    name: "Austin base zoning layer (Shared/Zoning_1, app-style query)",
    expectZone: "CS-MU-V-CO-ETOD-DBETOD-NP",
    async run() {
      const url =
        "https://maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0/query" +
        `?geometry=${encodeURIComponent("-97.755249,30.249343")}&geometryType=esriGeometryPoint&inSR=4326` +
        "&spatialRel=esriSpatialRelIntersects&distance=120&units=esriSRUnit_Foot&outFields=*&returnGeometry=false&f=json";
      const data = await fetchJson(url);
      const attrs = data.features?.[0]?.attributes;
      if (!attrs)
        throw new Error(`no features at 1600 S 1st (${JSON.stringify(data.error || data).slice(0, 140)}) — inSR=4326 may be unsupported here; do NOT wire the app to this layer without reprojection`);
      const z = attrs.ZONING_ZTYPE;
      if (!z) throw new Error(`ZONING_ZTYPE missing — fields: ${Object.keys(attrs).join(",").slice(0, 140)}`);
      if (z !== this.expectZone) return { warn: `zone drift at 1600 S 1st: expected ${this.expectZone}, got ${z}` };
      return `ZONING_ZTYPE ${z} via inSR=4326 + 120 ft tolerance`;
    },
  },
  {
    name: "Dallas zoning GIS service (egis host)",
    async run() {
      const svc = await fetchJson("https://egis.dallascityhall.com/arcgis/rest/services/Sdc_public/Zoning/MapServer?f=json");
      if (!(svc.layers || []).length)
        throw new Error(`service returned no layers — keys: ${Object.keys(svc).join(",")}; error: ${JSON.stringify(svc.error || null)}`);
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
    ["Los Angeles", "https://data.lacity.org/resource/pi9x-tg5x.json"],
    ["Dallas", "https://www.dallasopendata.com/resource/e7gq-4sah.json"],
  ].map(([city, url]) => ({
    name: `${city} permit feed`,
    async run() {
      // Newest rows first where the portal allows it (":id DESC" ≈ insertion
      // order); fall back to an unordered sample rather than failing.
      let rows;
      try {
        rows = await fetchJson(`${url}?$limit=25&$order=:id DESC`.replace(" ", "%20"), 1);
      } catch {
        rows = null;
      }
      if (!Array.isArray(rows)) {
        try {
          rows = await fetchJson(`${url}?$limit=25`);
        } catch (e) {
          // Portal-level failure: self-diagnose with the catalog API so the
          // report names likely successor datasets.
          const host = new URL(url).host;
          const candidates = await catalogCandidates(host, "building permits");
          throw new Error(`${String(e.message).slice(0, 140)} — catalog candidates on ${host}: ${candidates}`);
        }
      }
      if (!Array.isArray(rows) || rows.length < 5) throw new Error(`only ${Array.isArray(rows) ? rows.length : 0} rows`);
      const newest = newestDate(rows);
      if (newest && Date.now() - newest > 120 * DAY_MS)
        return { warn: `newest date in sample is ${new Date(newest).toISOString().slice(0, 10)} — feed may be stale (or sample unordered)` };
      return `${rows.length} rows, newest ${newest ? new Date(newest).toISOString().slice(0, 10) : "n/a"}`;
    },
  })),
  {
    name: "Miami permit feed (City of Miami Building_Permits_Since_2014)",
    async run() {
      // The old services6/ONZht79c8QWuX759 URL was a false positive (Peel
      // Region, Ontario — housing-unit aggregates). This is the real City of
      // Miami org's per-record permits layer.
      const url =
        "https://services1.arcgis.com/CvuPhqcTQpZPT9qY/arcgis/rest/services/Building_Permits_Since_2014/FeatureServer/0/query" +
        "?where=1%3D1&outFields=PermitNumber,CompanyName,IssuedDate,TotalSQFT&resultRecordCount=10&orderByFields=IssuedDate%20DESC&returnGeometry=false&f=json";
      const data = await fetchJson(url);
      const feats = data.features || [];
      if (!feats.length) throw new Error(`no features (${JSON.stringify(data.error || data).slice(0, 160)})`);
      const a = feats[0].attributes || {};
      if (!("PermitNumber" in a) || !("CompanyName" in a)) throw new Error(`expected fields missing: ${Object.keys(a).join(",").slice(0, 160)}`);
      const newest = newestDate(feats.map((f) => f.attributes));
      if (newest && Date.now() - newest > 120 * DAY_MS)
        return { warn: `newest IssuedDate ${new Date(newest).toISOString().slice(0, 10)} — stale?` };
      return `${feats.length} permits, newest ${newest ? new Date(newest).toISOString().slice(0, 10) : "n/a"}`;
    },
  },
  {
    name: "Fort Worth permit feed",
    async run() {
      // The Socrata portal is gone — data.fortworthtexas.gov is now an
      // ArcGIS Hub. Find the permits dataset via the site-scoped DCAT feed
      // and test its GeoService distribution.
      const dcat = await fetchJson("https://data.fortworthtexas.gov/api/feed/dcat-us/1.1.json");
      const sets = (dcat.dataset || []).filter((d) => /permit/i.test(d.title || ""));
      if (!sets.length) throw new Error(`no permit datasets in the DCAT feed (${(dcat.dataset || []).length} total)`);
      const notes = [];
      for (const d of sets.slice(0, 6)) {
        const dist = (d.distribution || []).find(
          (x) => /geoservice|esri rest/i.test(`${x.title || ""} ${x.format || ""}`) || /(Feature|Map)Server/.test(x.accessURL || ""),
        );
        const url = dist?.accessURL;
        if (!url) { notes.push(`"${d.title}": no geoservice link`); continue; }
        const layerUrl = /Server\/\d+/.test(url) ? url : `${url.replace(/\/$/, "")}/0`;
        const q = await fetchJson(`${layerUrl}/query?where=1%3D1&outFields=*&resultRecordCount=3&returnGeometry=false&f=json`).catch((e) => ({ err: String(e.message).slice(0, 60) }));
        if ((q.features || []).length) {
          const fields = Object.keys(q.features[0].attributes || {});
          // Also report the BLDS Socrata mirror's health — a drop-in for the
          // app's existing Socrata pipeline if it's fresh.
          let mirror = "";
          try {
            const rows = await fetchJson("https://permits.partner.socrata.com/resource/qy5k-jz7m.json?$limit=10", 1);
            const newest = newestDate(rows || []);
            mirror = `; BLDS mirror qy5k-jz7m: ${Array.isArray(rows) ? rows.length : 0} rows, newest ${newest ? new Date(newest).toISOString().slice(0, 10) : "n/a"}`;
          } catch (e) {
            mirror = `; BLDS mirror unreachable (${String(e.message).slice(0, 50)})`;
          }
          return `dataset "${d.title}" → ${layerUrl} (fields: ${fields.slice(0, 10).join(",")}) — adopt as the FW source${mirror}`;
        }
        notes.push(`"${d.title}": ${q.err || JSON.stringify(q.error || {}).slice(0, 60)}`);
      }
      throw new Error(`no queryable permit layer — ${notes.join("; ").slice(0, 350)}`);
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
      // stratmap25 went token-walled (2026-07); the public "most_recent"
      // alias disables query but answers identify — which is exactly how the
      // app now reads it (op: "identify" in PARCEL_SOURCES).
      const mr = "https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer";
      const [lng, lat, d] = [-96.9561, 32.5885, 0.002];
      const idUrl =
        `${mr}/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2` +
        `&mapExtent=${lng - d},${lat - d},${lng + d},${lat + d}&imageDisplay=400,400,96&returnGeometry=false&f=json`;
      const idData = await fetchJson(idUrl);
      const attrs = idData.results?.[0]?.attributes;
      if (!attrs) throw new Error(`identify: no parcel at Cedar Hill test point (${JSON.stringify(idData.error || {}).slice(0, 120)})`);
      // Field PRESENCE is the health signal (the city-centroid test point can
      // land on a ROW/megaparcel with odd area values) — report the values.
      const areaKeys = Object.keys(attrs).filter((k) => /acre|gis_area|lgl_area|legal_area/i.test(k));
      if (!areaKeys.length) throw new Error(`identify hit but no area field at all: ${Object.keys(attrs).join(",").slice(0, 160)}`);
      const vals = areaKeys.map((k) => `${k}=${attrs[k]}`).join(", ");
      const anySane = areaKeys.some((k) => { const n = Number(String(attrs[k]).replace(/,/g, "")); return n > 0.005 && n < 5000; });
      if (!anySane) return { warn: `identify works, area fields present but values odd at the test point (${vals}) — likely a ROW/megaparcel hit; spot-check a real address` };
      return `parcel hit via identify — ${vals} (app uses op:"identify" on this service)`;
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
      // The L3_TAXPAR_POLY_ASSESS_gdb service vanished ("Invalid URL",
      // run #2) — scan the MassGIS AGOL org for the renamed successor.
      const org = "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services";
      // Canonical successor (announced by MassGIS ~2026-04) first, then the
      // org scan for future renames.
      const roots = ["https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer"];
      const list = await fetchJson(`${org}?f=json`).catch(() => null);
      roots.push(
        ...(list?.services || [])
          .filter((s) => /taxpar|parcel|assess/i.test(s.name))
          .slice(0, 8)
          .map((s) => `${org}/${s.name}/${s.type}`),
      );
      const seen = [];
      for (const root of [...new Set(roots)]) {
        const svc = await fetchJson(`${root}?f=json`).catch(() => null);
        for (const l of [...(svc?.layers || []), ...(svc?.tables || [])].slice(0, 5)) {
          const meta = await fetchJson(`${root}/${l.id}?f=json`).catch(() => null);
          const names = (meta?.fields || []).map((f) => f.name.toUpperCase());
          if (names.includes("LOT_SIZE") && names.includes("LOT_UNITS")) {
            const q = await fetchJson(`${root}/${l.id}/query?where=1%3D1&outFields=LOT_SIZE,LOT_UNITS&resultRecordCount=1&returnGeometry=false&f=json`).catch(() => null);
            const s = q?.features?.[0]?.attributes;
            return `fields present: ${root}/${l.id} ("${l.name}")${s ? ` — sample LOT_SIZE=${s.LOT_SIZE} LOT_UNITS="${s.LOT_UNITS}"` : ""}`;
          }
          seen.push(`${root.split("/services/")[1]}/${l.id}`);
        }
      }
      throw new Error(`LOT_SIZE/LOT_UNITS not found — scanned ${seen.join("; ").slice(0, 300) || "(org list unavailable)"}`);
    },
  },
  {
    name: "NJ statewide parcels (CALC_ACRE field)",
    async run() {
      // Layer 0 of Basemap/Parcels_NJ_WM lost its MOD-IV attributes — try
      // the FeatureServer sibling, then scan maps.nj.gov for a parcel
      // service that still carries CALC_ACRE.
      const roots = [
        // Official replacement per NJGIN's Retired Services page (the
        // maps.nj.gov composite was stripped/retired 2026-03).
        "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer",
        "https://maps.nj.gov/arcgis/rest/services/Basemap/Parcels_NJ_WM/FeatureServer",
        "https://maps.nj.gov/arcgis/rest/services/Basemap/Parcels_NJ_WM/MapServer",
      ];
      const top = await fetchJson("https://maps.nj.gov/arcgis/rest/services?f=json").catch(() => null);
      const folders = (top?.folders || []).filter((f) => /base|feat|cadastr|parcel|tax/i.test(f)).slice(0, 4);
      for (const f of folders) {
        const sub = await fetchJson(`https://maps.nj.gov/arcgis/rest/services/${f}?f=json`).catch(() => null);
        roots.push(
          ...(sub?.services || [])
            .filter((s) => /parcel|modiv|mod_iv|cadastr/i.test(s.name))
            .slice(0, 4)
            .map((s) => `https://maps.nj.gov/arcgis/rest/services/${s.name}/${s.type}`),
        );
      }
      const seen = [];
      for (const root of [...new Set(roots)].slice(0, 10)) {
        const svc = await fetchJson(`${root}?f=json`).catch(() => null);
        for (const l of [...(svc?.layers || []), ...(svc?.tables || [])].slice(0, 6)) {
          const meta = await fetchJson(`${root}/${l.id}?f=json`).catch(() => null);
          const names = (meta?.fields || []).map((f) => f.name);
          if (names.some((n) => /^calc_acre$/i.test(n)))
            return `CALC_ACRE present: ${root}/${l.id} ("${l.name}") — adopt this URL if it differs from the app's`;
          seen.push(`${root.split("/services/")[1]}/${l.id}:${l.name}`);
        }
      }
      throw new Error(`CALC_ACRE not found — scanned ${seen.join("; ").slice(0, 350)}`);
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
