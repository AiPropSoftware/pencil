"""Pencil zoning tool — address -> zone -> buildable envelope.

Pipeline (validated live 2026-07-24):
  1. Geocode address        -> US Census Geocoder (free, no key)
  2. Project to layer SRS   -> EPSG:4326 -> layer wkid (Austin: 2277, TX Central, US ft)
  3. Point-in-polygon query -> jurisdiction's ArcGIS REST zoning layer
  4. Parse base district + overlay suffixes from the zoning string
  5. Look up dimensional standards -> standards/<jurisdiction>.json
  6. Compute buildable envelope from lot size
"""
from .envelope import buildable_envelope
from .geocode import geocode
from .jurisdictions import get_jurisdiction, load_registry, standards_path
from .report import CAVEATS, build_report
from .zone_lookup import SEARCH_TOLERANCE_FT, parse_zone, query_zoning

__all__ = [
    "CAVEATS",
    "SEARCH_TOLERANCE_FT",
    "buildable_envelope",
    "build_report",
    "geocode",
    "get_jurisdiction",
    "load_registry",
    "parse_zone",
    "query_zoning",
    "standards_path",
]
