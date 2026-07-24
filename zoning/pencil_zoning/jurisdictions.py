"""Jurisdiction registry: maps a jurisdiction key to its GIS endpoint,
spatial reference wkid, zone field, and dimensional-standards file.

Adding a city is additive: one entry in jurisdictions.json plus one
standards/<city>.json file following the same schema as austin_tx.json.
"""
import json
from functools import lru_cache
from pathlib import Path

_REGISTRY_PATH = Path(__file__).parent / "jurisdictions.json"
# standards_file entries are relative to the zoning/ tool root (this package's parent)
_TOOL_ROOT = Path(__file__).parent.parent


@lru_cache(maxsize=1)
def load_registry() -> dict:
    return json.loads(_REGISTRY_PATH.read_text())


def get_jurisdiction(key: str) -> dict:
    registry = load_registry()
    if key not in registry:
        raise KeyError(
            f"Unknown jurisdiction: {key!r} (known: {', '.join(sorted(registry))})"
        )
    return registry[key]


def standards_path(entry: dict) -> Path:
    return _TOOL_ROOT / entry["standards_file"]
