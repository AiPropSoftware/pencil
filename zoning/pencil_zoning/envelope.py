"""Buildable-envelope math from a district's dimensional standards.

null (None) in standards means "no limit / not applicable" — never zero.
A null limit produces no envelope entry at all (absence, not 0), and null
setbacks contribute 0 ft to the setback rectangle (no setback required).
"""


def buildable_envelope(std: dict, lot_sqft: float | None,
                       lot_width: float | None, lot_depth: float | None) -> dict:
    env: dict = {}
    if lot_sqft:
        if std.get("max_building_coverage") is not None:
            env["max_building_footprint_sqft"] = round(
                lot_sqft * std["max_building_coverage"] / 100
            )
        if std.get("max_impervious") is not None:
            env["max_impervious_sqft"] = round(lot_sqft * std["max_impervious"] / 100)
        if std.get("max_far") is not None:
            env["max_floor_area_sqft"] = round(lot_sqft * std["max_far"])
        if std.get("min_lot_size") is not None:
            env["lot_meets_minimum"] = lot_sqft >= std["min_lot_size"]
    if lot_width and lot_depth:
        f = std.get("setback_front") or 0
        r = std.get("setback_rear") or 0
        s = std.get("setback_interior_side") or 0
        bw = max(0, lot_width - 2 * s)
        bd = max(0, lot_depth - f - r)
        env["setback_buildable_area_sqft"] = round(bw * bd)
        env["setback_buildable_dims_ft"] = f"{bw:g} x {bd:g}"
    return env
