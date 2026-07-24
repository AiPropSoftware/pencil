from pencil_zoning import CAVEATS, build_report


def test_report_matches_captured_demo_output(austin, demo):
    """Replay the three captured pilot runs through the restructured package
    (skipping the live geocode/GIS steps) and require identical parsing,
    standards, overlays, and envelope numbers."""
    assert len(demo) == 3
    for rec in demo:
        geo = {
            "matched": rec["address"],
            "lat": rec["coordinates"]["lat"],
            "lon": rec["coordinates"]["lon"],
        }
        lot = rec["assumed_lot"]
        report = build_report(
            geo,
            rec["zoning_string"],
            austin,
            lot_sqft=lot["sqft"],
            lot_width=lot["width_ft"],
            lot_depth=lot["depth_ft"],
        )
        assert report["base_district"] == rec["base_district"]
        assert report["base_district_name"] == rec["base_district_name"]
        assert report["standards"] == rec["standards"]
        assert report["overlays"] == rec["overlays"]
        assert report["buildable_envelope"] == rec["buildable_envelope"]


def test_every_caveat_ships_with_every_report(austin):
    report = build_report({"matched": "X", "lat": 0, "lon": 0}, "SF-3-NP", austin)
    assert report["caveats"] == CAVEATS
    joined = " ".join(report["caveats"])
    assert "overlays" in joined  # combining-district / CO warning
    assert "HOME amendments" in joined
    assert "floodplain" in joined
    assert "Informational only" in joined
    assert report["source"] == austin["jurisdiction"]["code_citation"]


def test_unknown_suffix_flagged(austin):
    report = build_report({"matched": "X", "lat": 0, "lon": 0}, "CS-ZZZ", austin)
    assert report["overlays"]["ZZZ"] == "unknown suffix — check ordinance"
