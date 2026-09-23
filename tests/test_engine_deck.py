"""Tests for Engine-deck parsing, at the seam `parse_deck(path) -> Deck`.

An Engine deck (`*_0001.rad`) is NOT laid out like a Starter deck. Starter cards
are fixed width on a ten-character ruler; Engine cards are whitespace
delimited, and several carry no `#` header at all. Reading an Engine deck with
the Starter's rules silently produces values like `TSTART = "0.000000 1"`.

Expected values are read directly off the two Engine decks, which are 19 and 29
lines long (open them next to this file to check); their meanings follow the
Altair Radioss Engine reference and the OpenRadioss source.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.radioss_deck import parse_deck  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
BUMPER = ROOT / "Bumper_Beam" / "Bumper_Beam_AP_meshed_0001.rad"
PHONE = ROOT / "Cell_Phone_Drop" / "Cell_Phone_Drop_0001.rad"


def _card(deck, keyword):
    for c in deck.cards:
        if c.keyword == keyword:
            return c
    raise AssertionError(f"{keyword} not found; deck has {[c.keyword for c in deck.cards]}")


@pytest.fixture(scope="module")
def bumper():
    if not BUMPER.exists():
        pytest.skip("deck not present")
    return parse_deck(BUMPER)


@pytest.fixture(scope="module")
def phone():
    if not PHONE.exists():
        pytest.skip("deck not present")
    return parse_deck(PHONE)


def test_engine_deck_is_recognised_as_engine(bumper, phone):
    assert bumper.kind == "engine"
    assert phone.kind == "engine"


def test_termination_time_is_read_from_run(bumper, phone):
    """`/RUN/<name>/<n>/` carries the termination time on its next line.

    This is the single most important number in an Engine deck and it sits on a
    line with no header comment above it.
    """
    assert bumper.run["Tstop"] == pytest.approx(100.0)  # ms
    assert bumper.run["run_number"] == 0
    assert bumper.run["name"] == "Bumper_Beam_AP_meshed"
    assert phone.run["Tstop"] == pytest.approx(1e-4)  # s
    assert phone.run["run_number"] == 1


def test_mass_scaling_card_is_read_including_its_third_field(bumper, phone):
    """`/DT/NODA/CST` has no header line and a variable field count.

    The bumper gives two values (Tsca, Tmin); the phone gives three, where the
    third is the initial added-mass ratio the solver uses to pick Tmin at cycle
    zero. Reading only two fields hides the fact that the phone IS mass scaled.
    """
    b = _card(bumper, "/DT/NODA/CST/0")
    assert b.fields["Tsca"] == pytest.approx(0.9)
    assert b.fields["Tmin"] == pytest.approx(0.001)  # ms
    assert b.fields.get("initial_mass_ratio") is None

    p = _card(phone, "/DT/NODA/CST/0")
    assert p.fields["Tsca"] == pytest.approx(0.9)
    assert p.fields["Tmin"] == pytest.approx(0.0)
    assert p.fields["initial_mass_ratio"] == pytest.approx(1e-2)


def test_stop_card_fields_are_separated(phone):
    """`/STOP` is six whitespace-separated numbers under a six-name header."""
    s = _card(phone, "/STOP")
    assert s.fields["Emax"] == pytest.approx(0.99)
    assert s.fields["Mmax"] == pytest.approx(0.05)
    assert s.fields["Nmax"] == 0
    assert s.fields["NTH"] == 1
    assert s.fields["NANIM"] == 1
    assert s.fields["NERR_POSIT"] == 1


def test_bumper_has_no_stop_card(bumper):
    """The absence is the finding: with no `/STOP`, both abort guards default
    to 1e30, i.e. off."""
    assert [c for c in bumper.cards if c.family == "STOP"] == []


def test_output_cadences_are_read(bumper, phone):
    assert _card(bumper, "/H3D/DT").fields["TFREQ"] == pytest.approx(1.0)  # ms
    assert _card(bumper, "/TFILE/0").fields["dT_HIS"] == pytest.approx(0.1)  # ms
    assert _card(phone, "/ANIM/DT").fields["TFREQ"] == pytest.approx(1e-6)  # s
    assert _card(phone, "/TFILE/4").fields["dT_HIS"] == pytest.approx(1e-3)  # s


def test_time_history_cadence_can_exceed_the_run_length(phone):
    """The phone writes time history every 1 ms in a run that lasts 0.1 ms.

    This is a deck defect, and the parser must expose both numbers in the same
    units for `analyze` to be able to say so.
    """
    dt_his = _card(phone, "/TFILE/4").fields["dT_HIS"]
    assert dt_his > phone.run["Tstop"] * 5


def test_animation_frame_count_is_derivable(phone):
    frames = phone.run["Tstop"] / _card(phone, "/ANIM/DT").fields["TFREQ"]
    assert frames == pytest.approx(100.0)


def test_starter_deck_is_still_fixed_width(tmp_path):
    """Regression guard: making the Engine free-format must not make the
    Starter free-format, or blank fields shift again."""
    deck_text = (
        "/BEGIN\nsynthetic\n      2022         0\n"
        "                  kg                  mm                  ms\n"
        "                  kg                  mm                  ms\n"
        "/MAT/PLAS_JOHNS/1\nSteel_test\n"
        "#                  c           EPS_DOT_0       ICC   Fsmooth               F_cut               Chard\n"
        "                                                 0         0                                      .7\n"
        "/END\n"
    )
    path = tmp_path / "synthetic_0000.rad"
    path.write_text(deck_text, encoding="utf-8")
    deck = parse_deck(path)
    assert deck.kind == "starter"
    assert deck.materials[1].fields["c"] is None
    assert deck.materials[1].fields["Chard"] == pytest.approx(0.7)
