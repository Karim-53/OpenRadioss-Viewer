"""The pieces added around the parser: editing decks, building v0.1, finding
the tools, and the camera and drop-height rules.

Each test names the mistake it guards against. Several of them were real
mistakes first.
"""

import hashlib
import json
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import patch_deck as pd  # noqa: E402
from src.analyze import _gravity, _scenario, _velocity_from_inivel  # noqa: E402
from src.findings import duration  # noqa: E402
from src.radioss_deck import parse_deck  # noqa: E402

BUMPER = ROOT / "Bumper_Beam" / "Bumper_Beam_AP_meshed_0000.rad"
BUMPER_ENGINE = ROOT / "Bumper_Beam" / "Bumper_Beam_AP_meshed_0001.rad"
PHONE_ENGINE = ROOT / "Cell_Phone_Drop" / "Cell_Phone_Drop_0001.rad"


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ------------------------------------------------------------ patch_deck


@pytest.mark.parametrize("deck", [BUMPER, BUMPER_ENGINE, PHONE_ENGINE])
def test_reading_and_writing_a_deck_changes_no_byte(deck, tmp_path):
    """The bumper deck is CRLF; a copy written with LF is a different file."""
    out = pd.Deck.read(deck).write(tmp_path / deck.name)
    assert _sha(out) == _sha(deck)


def test_a_field_is_found_by_its_header_name_not_by_position():
    """M_Flag sits after the 20-wide P_thick_fail: columns 20-30, not 10-20.

    The first version of set_failure_preset wrote into columns 10-20, i.e.
    into P_thick_fail, and read back a '0' that was not M_Flag at all.
    """
    deck = pd.Deck.read(BUMPER)
    line, start, end = pd.locate_field(deck.lines, "/FAIL/BIQUAD/3", "M_Flag")
    assert (start, end) == (20, 30)
    assert deck.lines[line][start:end].strip() == "2"


def test_an_edit_changes_only_its_own_field():
    deck = pd.Deck.read(BUMPER)
    pd.set_failure_preset(deck, 3, 3)
    before, after = deck.lines, deck.apply_all().lines
    changed = [i for i, (a, b) in enumerate(zip(before, after)) if a != b]
    assert len(changed) == 1
    i = changed[0]
    assert after[i][:20] == before[i][:20]          # P_thick_fail untouched
    assert after[i][20:30].strip() == "3"
    assert after[i][30:] == before[i][30:]


def test_an_edit_refuses_to_apply_when_the_field_changed_underneath():
    """An edit that does not match must fail, not produce a deck that looks patched."""
    deck = pd.Deck.read(BUMPER)
    pd.set_failure_preset(deck, 3, 3)
    stale = pd.Deck(path=deck.path, lines=list(deck.lines), edits=list(deck.edits))
    i, s, e = pd.locate_field(stale.lines, "/FAIL/BIQUAD/3", "M_Flag")
    stale.lines[i] = stale.lines[i][:s] + "5".rjust(e - s) + stale.lines[i][e:]
    with pytest.raises(ValueError):
        stale.apply_all()


def test_the_pristine_decks_are_never_modified_by_an_edit(tmp_path):
    before = _sha(BUMPER)
    deck = pd.Deck.read(BUMPER)
    pd.set_rigid_wall_diameter(deck, 300.0)
    deck.write(tmp_path / "patched.rad")
    assert _sha(BUMPER) == before


# ------------------------------------------------------------ v0.1


def _model(name: str) -> dict:
    path = ROOT / name / "report" / "model.json"
    if not path.exists():
        pytest.skip(f"{name}/report/model.json not built yet; run python src/main.py")
    return json.loads(path.read_text(encoding="utf-8"))


def test_v01_for_the_phone_applies_every_recommended_fix(tmp_path):
    from src.fixes import build_v01

    model = _model("Cell_Phone_Drop")
    work = tmp_path / "Cell_Phone_Drop"
    work.mkdir()
    for f in (ROOT / "Cell_Phone_Drop").glob("*.rad"):
        shutil.copyfile(f, work / f.name)
    record = build_v01(work, model)
    rules = {a["rule"] for a in record["applied"]}
    assert {"run_ends_before_the_physics", "time_history_never_sampled",
            "no_time_history_requests", "no_abort_guard",
            "results_depend_on_thread_count", "no_contact_only_ties",
            "rigid_wall_search_band_too_small"} <= rules

    engine = parse_deck(work / "v0.1" / "Cell_Phone_Drop_0001.rad")
    assert engine.run["Tstop"] == pytest.approx(2e-3)
    starter = (work / "v0.1" / "Cell_Phone_Drop_0000.rad").read_text(encoding="latin-1")
    # ERROR 1104 taught this one: solids need the EXT form of /SURF/PART.
    assert "/SURF/PART/EXT/" in starter
    assert "/INTER/TYPE24/" in starter and "/TH/PART/" in starter
    diff = (work / "v0.1" / "deck.diff").read_text(encoding="utf-8")
    assert "+/PARITH/ON" in diff and "-/PARITH/OFF" in diff


def test_v01_takes_the_readers_answer_over_the_recommendation(tmp_path):
    from src.fixes import build_v01

    model = _model("Cell_Phone_Drop")
    work = tmp_path / "Cell_Phone_Drop"
    work.mkdir()
    for f in (ROOT / "Cell_Phone_Drop").glob("*.rad"):
        shutil.copyfile(f, work / f.name)
    answers = tmp_path / "interaction.txt"
    answers.write_text(
        "model: Cell_Phone_Drop\nfinding: F-99\nrule: run_ends_before_the_physics\n"
        "severity: error\nwarning: too short\nanswer: lengthen to 0.5 ms\n\n"
        "model: Cell_Phone_Drop\nfinding: F-98\nrule: results_depend_on_thread_count\n"
        "severity: warning\nwarning: parith\nanswer: dismissed - reviewed, no change wanted\n",
        encoding="utf-8")
    record = build_v01(work, model, answers)
    engine = parse_deck(work / "v0.1" / "Cell_Phone_Drop_0001.rad")
    assert engine.run["Tstop"] == pytest.approx(5e-4)
    assert "results_depend_on_thread_count" in {a["rule"] for a in record["not_applied"]}


def test_v01_for_the_bumper_fixes_both_dp1000_failure_cards(tmp_path):
    from src.fixes import build_v01

    model = _model("Bumper_Beam")
    work = tmp_path / "Bumper_Beam"
    work.mkdir()
    for f in (ROOT / "Bumper_Beam").glob("*.rad"):
        shutil.copyfile(f, work / f.name)
    build_v01(work, model)
    deck = pd.Deck.read(work / "v0.1" / "Bumper_Beam_AP_meshed_0000.rad")
    for fail_id in (2, 3):
        i, s, e = pd.locate_field(deck.lines, f"/FAIL/BIQUAD/{fail_id}", "M_Flag")
        assert deck.lines[i][s:e].strip() == "3"
    engine = (work / "v0.1" / "Bumper_Beam_AP_meshed_0001.rad").read_text(encoding="latin-1")
    assert "/ANIM/DT" in engine and "/TH/TITLE" in engine and "/STOP" in engine


# ------------------------------------------------------------ physics rules


def test_gravity_is_a_signed_vector_including_its_function():
    """Fscale_Y = -1 times a function of 0.00981 mm/ms^2 is standard g down Z."""
    g = _gravity(parse_deck(BUMPER))
    assert g["direction"] == pytest.approx([0.0, 0.0, -1.0])
    assert g["matches_standard_g"]


def test_a_drop_height_is_only_claimed_for_motion_along_gravity():
    """A car at 5 m/s into a pole is not 'a 1.27 m drop'."""
    deck = parse_deck(BUMPER)
    engine = parse_deck(BUMPER_ENGINE)
    sc = _scenario(deck, engine, _velocity_from_inivel(deck), {}, _gravity(deck), [], {})
    assert "equivalent_drop_height_mm" not in sc


def test_durations_read_like_a_person_writes_them():
    assert duration(1e-4, "s") == "0.1 ms"
    assert duration(72, "ms") == "72 ms"
    assert duration(2e-3, "s") == "2 ms"


def test_the_camera_puts_gravity_down_and_stands_behind_the_mover():
    from src.preview import camera_angles

    elev, azim = camera_angles({"gravity": {"direction": [0, 0, -1]},
                                "velocity": {"direction": [-1, 0, 0]}})
    assert elev > 20                    # looking down on the road
    assert -60 < azim < 60              # from the +X side: behind a car moving along -X


# ------------------------------------------------------------ tools and outputs


def test_preflight_reports_every_requirement_and_marks_the_solver_optional():
    from src.preflight import check

    result = check()
    tiers = {i["what"]: i["tier"] for i in result["items"]}
    assert tiers["OpenRadioss"] == "solver"
    assert tiers["numpy"] == "required"
    assert all("install" in i for i in result["items"])


def test_main_finds_both_models_and_their_versions():
    from src.main import discover, versions_of

    names = [d.name for d in discover(ROOT)]
    assert names == ["Bumper_Beam", "Cell_Phone_Drop"]
    for d in discover(ROOT):
        assert versions_of(d)[0] == "v0"


def test_constraints_are_read_as_what_they_do():
    """The bumper's /BCS sits on the reference point of its 500 kg rigid block
    and leaves it only X: the 'car' cannot yaw or pitch. That sentence, not the
    code '011 111', is what the report has to say."""
    from src.analyze import _constraints_and_outputs

    deck = parse_deck(BUMPER)
    setup = _constraints_and_outputs(deck, [])
    bcs = next(c for c in setup["constraints"] if c["keyword"].startswith("/BCS"))
    assert bcs["fixed_translations"] == ["Y", "Z"]
    assert bcs["on_rigid_body"] and "only move along X" in bcs["plain"]
    kinds = {t["kind"] for t in setup["time_history"]}
    assert {"INTER", "RWALL", "RBODY", "ACCEL", "SECTIO"} <= kinds


def test_adding_sensors_also_adds_their_titles(tmp_path):
    """The first phone v0.1 added /TH cards without /TH/TITLE, and its own
    findings then reported impulses in unnamed columns - a fix that created a
    finding. The builder now adds both."""
    from src.fixes import build_v01

    model = _model("Cell_Phone_Drop")
    work = tmp_path / "Cell_Phone_Drop"
    work.mkdir()
    for f in (ROOT / "Cell_Phone_Drop").glob("*.rad"):
        shutil.copyfile(f, work / f.name)
    build_v01(work, model)
    engine = (work / "v0.1" / "Cell_Phone_Drop_0001.rad").read_text(encoding="latin-1")
    assert "/TH/TITLE" in engine


@pytest.mark.parametrize("run, over", [
    ("Bumper_Beam/v0", True),                              # stopped, then a small bounce
    ("Bumper_Beam/sweep/thickness_scale=0.8", False),      # 92 % taken out, still moving
    ("Cell_Phone_Drop/v0", False),                         # 0.1 ms: barely touched the floor
])
def test_is_the_impact_over(run, over):
    """'Over' means stopped (<= 2 % motion energy left) or bounced back.

    90 % was the first threshold; the thin-bumper sweep point had 92 % taken
    out and was still doing 1.4 m/s when its run ended.
    """
    from src.solver_out import parse_engine_out

    listing = next((ROOT / run).glob("*_0001.out"), None)
    if listing is None:
        pytest.skip(f"{run} has not been run")
    assert parse_engine_out(listing)["impact_over"] is over


@pytest.mark.parametrize("answer, emax, mmax", [
    ("add /STOP with 10 % energy and 5 % mass", 0.10, 0.05),
    ("tighten Emax to 0.05", 0.05, 0.05),
    # a justification quoting other percentages must not become a limit
    ("set Emax to 0.30 (friction 3.4 % + hourglass 2.2 % of the impact energy)", 0.30, 0.05),
])
def test_the_safety_stop_limits_are_read_from_the_phrase_that_names_them(answer, emax, mmax):
    from src.fixes import Context, fix_abort_guard

    engine = pd.Deck.read(BUMPER_ENGINE)                  # no /STOP yet
    ctx = Context(model={}, starter=pd.Deck.read(BUMPER_ENGINE), engine=engine,
                  time_unit="ms", tstop=100.0)
    fix_abort_guard(ctx, answer, "test")
    line = next(l for l in engine.apply_all().lines if l.startswith(("0.", "1 ", "0 ")) and len(l.split()) == 6)
    got = [float(x) for x in line.split()[:2]]
    assert got == pytest.approx([emax, mmax])


def _energy(run):
    from src.solver_out import read_energy_sources

    if not next((ROOT / run).glob("*T01.csv"), None):
        pytest.skip(f"{run}: no converted curves file")
    return read_energy_sources(ROOT / run)


def test_the_phone_energy_drift_is_friction_and_hourglass():
    """v0.1's listing says -6.8 %; counting friction and hourglass energy from
    the curves file, the books close to within 1 %. That is what turned an
    alarming number into an explained one."""
    es = _energy("Cell_Phone_Drop/v0.1")
    assert es["balance_raw_pct"] < -4
    assert abs(es["balance_closed_pct"]) < 1
    assert es["hourglass_to_internal_max"] > 0.10          # above the usual limit
    top = next(iter(es["parts"]))
    assert top == "cover_rear"                             # which part absorbs the blow


def test_the_bumper_energy_drift_is_friction():
    """The answer to 'why does the bumper's energy error go down': contact
    friction, and the balance closes once it is counted."""
    es = _energy("Bumper_Beam/v0")
    assert es["fractions_end"]["friction"] > 0
    assert abs(es["balance_closed_pct"]) < 0.5


@pytest.mark.parametrize("model", ["Bumper_Beam", "Cell_Phone_Drop"])
def test_a_version_is_restored_byte_for_byte_from_its_diff(model, tmp_path):
    """v0.1's decks can be left out of a slim copy: deck.diff replayed onto
    the pristine decks gives back exactly the files that ran."""
    ran = ROOT / model / "v0.1"
    if not (ran / "deck.diff").exists() or not any(ran.glob("*_0000.rad")):
        pytest.skip("v0.1 not built here")
    (tmp_path / "v0.1").mkdir()
    for f in (ROOT / model).glob("*.rad"):
        shutil.copyfile(f, tmp_path / f.name)
    shutil.copyfile(ran / "deck.diff", tmp_path / "v0.1" / "deck.diff")
    for out in pd.restore_version(tmp_path, "v0.1"):
        assert _sha(out) == _sha(ran / out.name)


def test_a_diff_that_does_not_match_the_deck_is_refused():
    deck = pd.Deck.read(BUMPER_ENGINE)
    hunks = ["@@ -5,2 +5,2 @@", " /RUN/Something_else/0/", "-                 100", "+                 200"]
    with pytest.raises(ValueError):
        pd.apply_unified_diff(deck.lines, hunks)


def test_the_snapshot_count_survives_a_copy_without_the_frames(tmp_path):
    """A slim copy leaves the 5 GB of frame files out; the report must still
    say how many snapshots the run saved, read from the Engine listing."""
    from src.solver_out import find_run

    ran = ROOT / "Cell_Phone_Drop" / "v0.1"
    if not any(ran.glob("*_0001.out")):
        pytest.skip("phone v0.1 not run here")
    copy = tmp_path / "Cell_Phone_Drop" / "v0.1"
    copy.mkdir(parents=True)
    for f in ran.glob("*.out"):
        shutil.copyfile(f, copy / f.name)
    assert find_run(tmp_path / "Cell_Phone_Drop", "v0.1")["animation_files"] == 51
