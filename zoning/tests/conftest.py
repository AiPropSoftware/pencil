import json
import os
import sys
from pathlib import Path

import pytest

TOOL_ROOT = Path(__file__).parent.parent
# make the zoning/ tool root importable regardless of pytest invocation dir
sys.path.insert(0, str(TOOL_ROOT))


def pytest_collection_modifyitems(config, items):
    if os.environ.get("PENCIL_LIVE_TESTS") == "1":
        return
    skip = pytest.mark.skip(
        reason="live network test — set PENCIL_LIVE_TESTS=1 to run"
    )
    for item in items:
        if "network" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def austin():
    return json.loads((TOOL_ROOT / "standards" / "austin_tx.json").read_text())


@pytest.fixture(scope="session")
def demo():
    return json.loads((TOOL_ROOT / "demo_output.json").read_text())
