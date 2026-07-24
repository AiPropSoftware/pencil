# Pencil zoning tool (pilot: Austin, TX)

Standalone Python CLI + library: drop in an address, get back the parcel's
zoning district, the district's dimensional standards, and the buildable
envelope for a given lot.

```
address → US Census geocoder → reproject EPSG:4326 → layer SRS (Austin: 2277)
        → point-in-polygon on the city's ArcGIS zoning layer
        → parse base district + overlay suffixes
        → dimensional standards (standards/<jurisdiction>.json)
        → buildable envelope (footprint / impervious / floor area / setback box)
```

This is intentionally Python and intentionally standalone — it's a data/CLI
tool, not part of the Vite app build. The app's TypeScript zoning engine
(`src/lib/zoning/zoning.ts`) is a separate implementation; this tool is the
reference pipeline for the per-jurisdiction standards vault that future
phases scale out.

## Run it

```bash
cd zoning
pip install -r requirements.txt          # requests, pyproj

python pencil_pilot.py "1600 S 1st St, Austin, TX" --lot-sqft 12000
python pencil_pilot.py "4507 Avenue G, Austin, TX" --lot-sqft 6600 --lot-width 50 --lot-depth 132
```

Output is a JSON report: matched address, coordinates, full zoning string,
base district, standards, decoded overlay suffixes, buildable envelope,
caveats, and source citation. `demo_output.json` is a captured known-good
run of the three verification addresses (2026-07-24).

## Layout

| Path | What |
|---|---|
| `pencil_pilot.py` | thin CLI entrypoint |
| `pencil_zoning/geocode.py` | US Census geocoder (free, no key) |
| `pencil_zoning/zone_lookup.py` | reprojection + ArcGIS point-in-polygon + zone-string parsing |
| `pencil_zoning/envelope.py` | buildable-envelope math |
| `pencil_zoning/report.py` | report assembly + product-required caveat strings |
| `pencil_zoning/jurisdictions.json` | registry: jurisdiction → GIS endpoint, wkid, zone field, standards file |
| `standards/austin_tx.json` | 31 Austin districts encoded from LDC § 25-2-492, plus overlay-suffix dictionary and provenance |
| `tests/` | pytest suite (unit + network-marked live integration) |

Adding a city is additive: one entry in `pencil_zoning/jurisdictions.json`
plus one `standards/<city>.json` following the same schema.

## Data provenance

- **Standards:** official City of Austin Zoning Guide and Austin Land
  Development Code § 25-2-492 (Site Development Regulations), Municode
  product 15303 (client 1113). **Retrieved 2026-07-24.**
- **Zoning map:** City of Austin ArcGIS REST layer
  `https://maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0`
  (EPSG:2277, zone field `ZONING_ZTYPE`); overlays at `Shared/Zoning_2`.
- **Geocoding:** US Census Geocoder
  (`geocoding.geo.census.gov/geocoder/locations/onelineaddress`).

## Implementation notes (hard-won — do not "clean up")

- **Reproject client-side** to the layer SRS (EPSG:2277 for Austin) before
  querying; the server's `inSR` handling proved unreliable in live testing.
- **Query with `distance=120&units=esriSRUnit_Foot` tolerance.** Census
  geocodes sit on street centerlines and zoning polygons exclude
  right-of-way — without the tolerance, valid addresses return zero features.
- **Parse the base district from `ZONING_ZTYPE` by longest-prefix match**
  against known district codes; the layer's `ZONING_BASE` field is
  truncated (e.g. `SF` for `SF-3`).
- **`null` in standards means "no limit / not applicable" — never zero.**
  CBD has no height limit; LI has no front setback. The envelope omits the
  corresponding output key rather than emitting 0.
- **Every caveat string ships with every report** (overlay/CO warning, HOME
  amendments warning, floodplain/compatibility warning, informational-only
  disclaimer). These are product requirements, not noise.

## Caveats (shipped in every report)

1. Base-district table values; combining districts/overlays (CO, NCCD, NP,
   V, ETOD…) can override every number shown.
2. HOME amendments (2023–24) relaxed SF-1/SF-2/SF-3 standards; the encoded
   table predates them — treat SF results as conservative.
3. Compatibility standards, floodplain, heritage trees, and impervious-cover
   watershed rules may further restrict development.
4. Informational only — verify with the City of Austin before design.

## Known gaps (deliberate, next phases)

- **HOME amendments not yet encoded** — SF district numbers are the
  stricter pre-HOME base table.
- **Lot area/dimensions are user-supplied** — parcel-centroid + lot
  geometry from Travis CAD is the planned next step.
- **`-CO` conditional overlays** carry site-specific ordinance limits the
  table can't capture; the report flags them but can't resolve them.
- **Single jurisdiction (Austin)** — the registry structure is in place so
  the next cities are additive.

## Tests

```bash
cd zoning
pip install -r requirements-dev.txt
python -m pytest                       # unit + demo-output replay (offline)
PENCIL_LIVE_TESTS=1 python -m pytest   # also run the live network cases
```

Live tests hit the Census geocoder and Austin GIS for the three verified
addresses (1600 S 1st St, 2400 E 6th St, 4507 Avenue G). Zoning strings can
legitimately drift if the city rezones; a drift only in the zoning string
warns instead of failing.
