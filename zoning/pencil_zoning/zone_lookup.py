"""Zone lookup: reproject a WGS84 point into the jurisdiction's spatial
reference and run a point-in-polygon query against its ArcGIS REST zoning
layer, then parse the base district + overlay suffixes from the zoning string.

Hard-won details from live testing (2026-07-24) — do not simplify:
  * Reproject client-side (EPSG:4326 -> layer wkid, e.g. 2277 for Austin);
    the server's inSR handling proved unreliable.
  * Query with distance=120 & units=esriSRUnit_Foot tolerance — Census
    geocodes sit on street centerlines and zoning polygons exclude
    right-of-way, so without tolerance valid addresses return zero features.
    If multiple polygons match, prefer the nearest non-ROW feature.
  * Parse the base district from the full zoning string (Austin:
    ZONING_ZTYPE) by longest-prefix match against known district codes;
    the layer's ZONING_BASE field is truncated ("SF" not "SF-3").
"""
from functools import lru_cache

import requests
from pyproj import Transformer

from .jurisdictions import get_jurisdiction

SEARCH_TOLERANCE_FT = 120  # snap past street ROW to the fronting lot


@lru_cache(maxsize=None)
def _transformer(wkid: int) -> Transformer:
    return Transformer.from_crs(4326, wkid, always_xy=True)


def query_zoning(lon: float, lat: float, jurisdiction: str = "austin_tx") -> dict | None:
    entry = get_jurisdiction(jurisdiction)
    x, y = _transformer(entry["wkid"]).transform(lon, lat)
    r = requests.get(
        entry["endpoint"],
        params={
            "geometry": f"{x:.2f},{y:.2f}",
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "distance": SEARCH_TOLERANCE_FT,
            "units": "esriSRUnit_Foot",
            "outFields": "*",
            "returnGeometry": "false",
            "f": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:
        return None
    return feats[0]["attributes"]


def parse_zone(ztype: str, districts: dict) -> tuple[str | None, list[str]]:
    """Longest-prefix match of the base district, remainder = overlay suffixes."""
    codes = sorted(districts, key=len, reverse=True)
    base = next((c for c in codes if ztype == c or ztype.startswith(c + "-")), None)
    suffixes = []
    if base and len(ztype) > len(base):
        suffixes = [s for s in ztype[len(base) + 1 :].split("-") if s]
    return base, suffixes
