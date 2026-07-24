from pencil_zoning import parse_zone


def test_full_overlay_stack(austin):
    base, suffixes = parse_zone("CS-MU-V-CO-ETOD-DBETOD-NP", austin["districts"])
    assert base == "CS"
    assert suffixes == ["MU", "V", "CO", "ETOD", "DBETOD", "NP"]
    assert len(suffixes) == 6


def test_hyphenated_base_district(austin):
    base, suffixes = parse_zone("SF-3-NCCD-NP", austin["districts"])
    assert base == "SF-3"
    assert suffixes == ["NCCD", "NP"]


def test_longest_prefix_wins(austin):
    # CS-1 is its own district; must not parse as CS with a "1" suffix
    assert parse_zone("CS-1-CO", austin["districts"]) == ("CS-1", ["CO"])
    assert parse_zone("CS-1", austin["districts"]) == ("CS-1", [])


def test_exact_match_no_suffixes(austin):
    assert parse_zone("CBD", austin["districts"]) == ("CBD", [])


def test_unknown_district(austin):
    base, suffixes = parse_zone("PUD", austin["districts"])
    assert base is None
    assert suffixes == []
