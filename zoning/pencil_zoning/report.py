"""Assemble the analysis report. Output format matches the original
single-file pilot exactly, including every caveat string — the overlay/CO
warning, the HOME-amendments warning, the floodplain/compatibility warning,
and the informational-only disclaimer are product requirements, not noise.
"""
from .envelope import buildable_envelope
from .zone_lookup import parse_zone

CAVEATS = [
    "Base-district table values; combining districts/overlays (CO, NCCD, "
    "NP, V, ETOD...) can override every number shown.",
    "HOME amendments (2023-24) relaxed SF-1/SF-2/SF-3 standards; encoded "
    "table predates them — treat SF results as conservative.",
    "Compatibility standards, floodplain, heritage trees, and impervious "
    "cover watershed rules may further restrict development.",
    "Informational only — verify with the City of Austin before design.",
]


def build_report(geo: dict, ztype: str, data: dict,
                 lot_sqft: float | None = None,
                 lot_width: float | None = None,
                 lot_depth: float | None = None) -> dict:
    districts = data["districts"]
    base, suffixes = parse_zone(ztype, districts)
    std = districts.get(base, {})
    known = data.get("overlay_flags", {}).get("known_suffixes", {})
    return {
        "address": geo["matched"],
        "coordinates": {"lat": geo["lat"], "lon": geo["lon"]},
        "zoning_string": ztype,
        "base_district": base,
        "base_district_name": std.get("name"),
        "standards": {k: v for k, v in std.items() if k not in ("name", "category")},
        "overlays": {s: known.get(s, "unknown suffix — check ordinance") for s in suffixes},
        "buildable_envelope": buildable_envelope(std, lot_sqft, lot_width, lot_depth),
        "caveats": list(CAVEATS),
        "source": data["jurisdiction"]["code_citation"],
    }
