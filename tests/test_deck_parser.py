"""Tests for the deck parser, at the seam `parse_deck(path) -> Deck`.

The expected values are not computed the way the parser computes them: they are
read off the OpenRadioss Starter's own listing (`*_0000.out`), which is an
independent source of truth produced by the solver, not by us.
"""

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.radioss_deck import parse_deck  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

# NUMNOD / NUMELC / NUMELTG / NUMELR / NUMELS as printed by the Starter listing.
# Bumper: Bumper_Beam/v0/Bumper_Beam_AP_meshed_0000.out lines 66-77
# Phone:  Cell_Phone_Drop/v0/Cell_Phone_Drop_0000.out lines 81-92
STARTER_COUNTS = {
    "Bumper_Beam": {
        "deck": ROOT / "Bumper_Beam" / "Bumper_Beam_AP_meshed_0000.rad",
        "nodes": 13832,
        "parts": 20,
        "materials": 3,
        "properties": 10,
        "elements": {"SHELL": 13598, "SH3N": 28, "SPRING": 78},
    },
    "Cell_Phone_Drop": {
        "deck": ROOT / "Cell_Phone_Drop" / "Cell_Phone_Drop_0000.rad",
        "nodes": 257099,
        "parts": 17,
        "materials": 5,
        "properties": 17,
        # The Starter reports 130218 solids without splitting them by type.
        "elements": {"BRICK": None, "TETRA10": None},
        "solids_total": 130218,
    },
}


@pytest.fixture(scope="module", params=sorted(STARTER_COUNTS))
def case(request):
    spec = STARTER_COUNTS[request.param]
    if not spec["deck"].exists():
        pytest.skip(f"deck not present: {spec['deck']}")
    return request.param, spec, parse_deck(spec["deck"])


def test_parser_reproduces_starter_node_count(case):
    name, spec, deck = case
    assert len(deck.nodes) == spec["nodes"], f"{name}: node count disagrees with the Starter listing"


def test_parser_reproduces_starter_element_counts(case):
    name, spec, deck = case
    counts = deck.element_counts()
    if "solids_total" in spec:
        solids = counts.get("BRICK", 0) + counts.get("TETRA10", 0)
        assert solids == spec["solids_total"], f"{name}: solid element count disagrees with the Starter"
    for etype, expected in spec["elements"].items():
        if expected is not None:
            assert counts.get(etype, 0) == expected, f"{name}: {etype} count disagrees with the Starter"


def test_parser_reproduces_starter_entity_counts(case):
    name, spec, deck = case
    assert len(deck.parts) == spec["parts"], f"{name}: part count disagrees with the Starter"
    assert len(deck.materials) == spec["materials"], f"{name}: material count disagrees with the Starter"
    assert len(deck.properties) == spec["properties"], f"{name}: property count disagrees with the Starter"


def test_every_part_points_at_a_defined_property_and_material(case):
    """A part referencing an undefined id is a deck defect, not a parser bug.

    The assertion is that the parser can SAY which, not that none exist: both
    decks are expected to be clean here, and the orphans run the other way
    (defined-but-unused), which `analyze` reports.
    """
    name, spec, deck = case
    dangling = [
        (p.id, p.title, p.prop_id, p.mat_id)
        for p in deck.parts.values()
        if (p.prop_id and p.prop_id not in deck.properties)
        or (p.mat_id and p.mat_id not in deck.materials)
    ]
    assert dangling == [], f"{name}: parts reference undefined property/material ids: {dangling}"


def test_units_are_read_from_begin(case):
    name, spec, deck = case
    expected = {"Bumper_Beam": ("kg", "mm", "ms"), "Cell_Phone_Drop": ("Mg", "mm", "s")}[name]
    assert (deck.units.mass, deck.units.length, deck.units.time) == expected


def test_fixed_width_fields_follow_the_header_ruler(tmp_path):
    """Blank fields must stay blank instead of shifting the fields after them.

    `Chard` is the sixth field of the Johnson-Cook rate line. Splitting the data
    line on whitespace would put `.7` (the value of `Chard`) into `c`, which is
    the single most consequential misread possible in this deck family: `c` is
    the strain-rate coefficient.
    """
    deck_text = (
        "#RADIOSS STARTER\n"
        "/BEGIN\n"
        "synthetic\n"
        "      2022         0\n"
        "                  kg                  mm                  ms\n"
        "                  kg                  mm                  ms\n"
        "/MAT/PLAS_JOHNS/1\n"
        "Steel_test\n"
        "#              RHO_I\n"
        "             7.85E-6                   0\n"
        "#                  E                  Nu     Iflag\n"
        "                 210                  .3         0\n"
        "#                  c           EPS_DOT_0       ICC   Fsmooth               F_cut               Chard\n"
        "                                                 0         0                                      .7\n"
        "/END\n"
    )
    path = tmp_path / "synthetic_0000.rad"
    path.write_text(deck_text, encoding="utf-8")

    deck = parse_deck(path)
    mat = deck.materials[1]
    assert mat.fields["c"] is None, "a blank field must parse as empty, not take the next value"
    assert mat.fields["EPS_DOT_0"] is None
    assert mat.fields["ICC"] == 0
    assert mat.fields["Chard"] == pytest.approx(0.7)
    assert mat.fields["E"] == pytest.approx(210.0)


def test_original_decks_are_byte_identical_to_the_published_ones():
    """Rule 1: the original decks are never modified.

    SHA-256 of the four files as published on the OpenRadioss example-model
    pages (the same table `src/fetch_models.py` checks every download against).
    """
    import hashlib

    expected = {
        "Bumper_Beam/Bumper_Beam_AP_meshed_0000.rad": "abf14f97c84e6c709a1c3ea2e0259dc387baf02825022e7e7d49a31008d19e31",
        "Bumper_Beam/Bumper_Beam_AP_meshed_0001.rad": "5ab9fc6f2b89dbd61ef04eeed84b83c3956044adbc5304766150809a34dca7df",
        "Cell_Phone_Drop/Cell_Phone_Drop_0000.rad": "435499d744ad560a843d9a21210483bbe74c9fc6e2775da4a232ce609cf097e2",
        "Cell_Phone_Drop/Cell_Phone_Drop_0001.rad": "1a090204d2913c1759429c45a65d8b67852a1889ed8cac73d6e5eb38cb6d98ff",
    }
    for rel, want in expected.items():
        path = ROOT / rel
        if not path.exists():
            pytest.skip(f"deck not present: {path}")
        got = hashlib.sha256(path.read_bytes()).hexdigest()
        assert got == want, f"{rel} has been modified"
