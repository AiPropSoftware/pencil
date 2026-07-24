#!/usr/bin/env python3
"""
Pencil zoning pilot CLI — address -> zone -> buildable envelope (Austin, TX).

Thin entrypoint over the pencil_zoning package; behavior and output format
match the original single-file pilot exactly.

Usage:
  python pencil_pilot.py "1600 S 1st St, Austin, TX" --lot-sqft 8000
  python pencil_pilot.py "4507 Avenue G, Austin, TX" --lot-sqft 6600 --lot-width 50 --lot-depth 132

Requires: requests, pyproj   (pip install -r requirements.txt)
"""
import argparse
import json
import sys
from pathlib import Path

from pencil_zoning import (
    build_report,
    geocode,
    get_jurisdiction,
    query_zoning,
    standards_path,
)


def main() -> None:
    ap = argparse.ArgumentParser(description="Pencil zoning pilot (Austin, TX)")
    ap.add_argument("address")
    ap.add_argument("--lot-sqft", type=float, default=None)
    ap.add_argument("--lot-width", type=float, default=None)
    ap.add_argument("--lot-depth", type=float, default=None)
    ap.add_argument(
        "--jurisdiction",
        default="austin_tx",
        help="registry key in pencil_zoning/jurisdictions.json",
    )
    ap.add_argument(
        "--standards",
        default=None,
        help="override the jurisdiction's standards JSON file",
    )
    args = ap.parse_args()

    entry = get_jurisdiction(args.jurisdiction)
    std_file = Path(args.standards) if args.standards else standards_path(entry)
    data = json.loads(std_file.read_text())

    geo = geocode(args.address)
    attrs = query_zoning(geo["lon"], geo["lat"], jurisdiction=args.jurisdiction)
    if attrs is None:
        raise SystemExit(
            "No zoning polygon found near this point (outside Austin "
            "full-purpose jurisdiction, or unzoned)."
        )

    ztype = attrs.get(entry["zone_field"], "")
    report = build_report(
        geo,
        ztype,
        data,
        lot_sqft=args.lot_sqft,
        lot_width=args.lot_width,
        lot_depth=args.lot_depth,
    )
    json.dump(report, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
