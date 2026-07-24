"""Live end-to-end checks against the Census geocoder and Austin GIS.

Marked `network`: skipped unless PENCIL_LIVE_TESTS=1, so CI without egress
stays green. Zoning strings can legitimately drift if the city rezones — a
drift ONLY in the zoning string emits a warning instead of failing; the
base-district and envelope assertions still must hold.
"""
import warnings

import pytest

pytestmark = pytest.mark.network

CASES = [
    {
        "address": "1600 S 1st St, Austin, TX",
        "lot_sqft": 12000,
        "lot_width": None,
        "lot_depth": None,
        "zoning_string": "CS-MU-V-CO-ETOD-DBETOD-NP",
        "base": "CS",
        "max_height": 60,
        "envelope": {
            "max_building_footprint_sqft": 11400,
            "max_impervious_sqft": 11400,
            "max_floor_area_sqft": 24000,
            "lot_meets_minimum": True,
        },
    },
    {
        "address": "2400 E 6th St, Austin, TX",
        "lot_sqft": 8000,
        "lot_width": None,
        "lot_depth": None,
        "zoning_string": "CS-V-CO-NP",
        "base": "CS",
        "max_height": 60,
        "envelope": {
            "max_building_footprint_sqft": 7600,
            "max_floor_area_sqft": 16000,
        },
    },
    {
        "address": "4507 Avenue G, Austin, TX",
        "lot_sqft": 6600,
        "lot_width": 50,
        "lot_depth": 132,
        "zoning_string": "SF-3-NCCD-NP",
        "base": "SF-3",
        "max_height": 35,
        "envelope": {
            "max_building_footprint_sqft": 2640,
            "max_impervious_sqft": 2970,
            "setback_buildable_area_sqft": 3880,
            "setback_buildable_dims_ft": "40 x 97",
        },
    },
]


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["address"])
def test_live_address(case, austin):
    from pencil_zoning import build_report, geocode, query_zoning

    geo = geocode(case["address"])
    attrs = query_zoning(geo["lon"], geo["lat"])
    assert attrs is not None, "no zoning polygon within 120 ft tolerance"

    ztype = attrs.get("ZONING_ZTYPE", "")
    if ztype != case["zoning_string"]:
        warnings.warn(
            f"zoning string drift for {case['address']}: expected "
            f"{case['zoning_string']!r}, got {ztype!r} (city may have rezoned)"
        )

    report = build_report(
        geo,
        ztype,
        austin,
        lot_sqft=case["lot_sqft"],
        lot_width=case["lot_width"],
        lot_depth=case["lot_depth"],
    )
    assert report["base_district"] == case["base"]
    assert report["standards"]["max_height"] == case["max_height"]
    for key, expected in case["envelope"].items():
        assert report["buildable_envelope"][key] == expected
