"""Address geocoding via the free US Census Geocoder (no key required).

Note learned in live testing (2026-07-24): the Census geocoder returns points
interpolated onto the street centerline; zoning polygons exclude right-of-way,
so a bare point query often returns nothing. zone_lookup compensates with a
search tolerance (distance=120 ft).
"""
import requests

CENSUS_GEOCODER = (
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
)


def geocode(address: str) -> dict:
    r = requests.get(
        CENSUS_GEOCODER,
        params={
            "address": address,
            "benchmark": "Public_AR_Current",
            "format": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    matches = r.json()["result"]["addressMatches"]
    if not matches:
        raise SystemExit(f"No geocode match for: {address}")
    m = matches[0]
    return {
        "matched": m["matchedAddress"],
        "lon": m["coordinates"]["x"],
        "lat": m["coordinates"]["y"],
    }
