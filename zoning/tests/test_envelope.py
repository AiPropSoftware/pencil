from pencil_zoning import buildable_envelope


def test_cs_12000(austin):  # 1600 S 1st St scenario
    env = buildable_envelope(austin["districts"]["CS"], 12000, None, None)
    assert env["max_building_footprint_sqft"] == 11400  # 95% coverage
    assert env["max_impervious_sqft"] == 11400
    assert env["max_floor_area_sqft"] == 24000  # FAR 2.0
    assert env["lot_meets_minimum"] is True


def test_cs_8000(austin):  # 2400 E 6th St scenario
    env = buildable_envelope(austin["districts"]["CS"], 8000, None, None)
    assert env["max_building_footprint_sqft"] == 7600
    assert env["max_floor_area_sqft"] == 16000


def test_sf3_with_dims(austin):  # 4507 Avenue G scenario
    env = buildable_envelope(austin["districts"]["SF-3"], 6600, 50, 132)
    assert env["max_building_footprint_sqft"] == 2640  # 40% coverage
    assert env["max_impervious_sqft"] == 2970  # 45% impervious
    assert "max_floor_area_sqft" not in env  # FAR null: no limit, not zero
    assert env["setback_buildable_area_sqft"] == 3880  # (50-2*5) x (132-25-10)
    assert env["setback_buildable_dims_ft"] == "40 x 97"


def test_null_means_no_limit_not_zero(austin):
    # MH has null coverage/impervious/FAR: those keys must be absent entirely
    env = buildable_envelope(austin["districts"]["MH"], 10000, None, None)
    assert "max_building_footprint_sqft" not in env
    assert "max_impervious_sqft" not in env
    assert "max_floor_area_sqft" not in env
    assert env["lot_meets_minimum"] is True  # min_lot_size 5750 is a real number


def test_null_min_lot_size_omits_minimum_check(austin):
    env = buildable_envelope(austin["districts"]["CBD"], 10000, None, None)
    assert "lot_meets_minimum" not in env  # CBD has no minimum lot size
    assert env["max_floor_area_sqft"] == 80000  # FAR 8.0


def test_null_setbacks_contribute_zero_feet(austin):
    # LI has no front/rear/side setbacks (null): buildable rectangle = whole lot
    env = buildable_envelope(austin["districts"]["LI"], None, 100, 200)
    assert env["setback_buildable_area_sqft"] == 20000
    assert env["setback_buildable_dims_ft"] == "100 x 200"


def test_below_minimum_lot(austin):
    env = buildable_envelope(austin["districts"]["SF-3"], 4000, None, None)
    assert env["lot_meets_minimum"] is False
