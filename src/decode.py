"""What the flags mean, in English.

A deck dump is not an explanation. `Inacti=6` is a number; *"initial
penetrations are absorbed by shrinking each penetrated pair's gap to
`P0 + 5 %(Gap - P0)` instead of moving nodes or dropping stiffness"* is an
explanation, and it is the difference between a report an engineer skims and
one they trust.

Every entry below was checked against the Altair Radioss Reference Guide, the
OpenRadioss `hm_cfg_files` keyword definitions (shipped with the solver, under
`hm_cfg_files/config/CFG/<version>/`), or the solver source. Entries that could
not be pinned to a primary source are absent rather than guessed.

**This table is meant to grow.** It is keyed by `(keyword, field)` and falls
back cleanly: an unknown keyword still renders with its raw fields, marked as
undecoded, so running the skill on a third deck degrades to a keyword census
instead of failing. `undecoded_fields()` reports exactly what a new deck used
that this table does not yet cover, which is the to-do list for extending it.
"""

from __future__ import annotations

from typing import Any

# --------------------------------------------------------------------- flags
# {keyword-prefix: {field: {value: meaning}}}. `None` keys a description of the
# field itself, used when the value is not in the table.
FLAG_MEANINGS: dict[str, dict[str, dict[Any, str]]] = {
    "/INTER/TYPE7": {
        "Istf": {
            None: "how the contact stiffness is computed",
            0: "stiffness from the main side only",
            1: "average of main and secondary stiffness",
            2: "maximum of the two",
            3: "minimum of the two",
            4: "minimum of the two, recomputed from both sides",
            5: "stiffness from both sides in series",
        },
        "Igap": {
            None: "how the contact gap is built",
            0: "constant gap, from Gapmin only",
            1: "variable gap from element thickness",
            2: "variable gap, also limited by the mesh size",
            3: "variable gap including the gap of the main segment",
        },
        "Inacti": {
            None: "what happens to nodes already penetrating at t = 0",
            0: "nothing: the penetration generates a force spike at cycle 1",
            1: "the penetrated node's stiffness is switched off",
            2: "the penetrated element's stiffness is switched off",
            3: "the node is moved onto the surface",
            5: "the gap is reduced to the initial penetration P0",
            6: "the gap is reduced to P0 + 5 % of (Gap - P0), the recommended form, "
               "because it avoids the high-frequency response that the bare P0 of "
               "Inacti = 5 excites",
        },
        "Iform": {
            None: "friction formulation",
            1: "static (viscous) friction",
            2: "incremental (stiffness) friction",
        },
        "Idel": {
            None: "what happens to the contact surface when an element dies",
            0: "the segment stays in the contact definition",
            1: "the segment is removed when its element is deleted, and free "
               "edges are removed too",
            2: "the segment is removed when its element is deleted",
        },
    },
    "/INTER/TYPE2": {
        "Spotflag": {
            None: "how the secondary node is attached to the main segment",
            0: "kinematic tie, mass and inertia transferred to the main nodes",
            1: "kinematic tie without inertia transfer, for spot welds",
            25: "penalty tie, formulation 25",
            27: "penalty tie whose stiffness is the mean of the two sides, with "
                "5 % damping; the solver falls back to it automatically when a "
                "kinematic tie would conflict with another constraint",
            28: "penalty tie, stiffness from the main side",
        },
        "Ignore": {
            None: "what happens to secondary nodes that do not project onto the surface",
            0: "all secondary nodes are tied; an unprojected node is an error",
            1: "unprojected nodes are dropped, search distance = mean segment size",
            2: "unprojected nodes are dropped, search distance from the Dsearch field",
            3: "unprojected nodes are dropped, search distance = "
               "max(0.6 x (t_node + t_segment), 0.05 x segment diagonal)",
        },
    },
    "/RWALL": {
        "Slide": {
            None: "how nodes behave on the wall surface",
            0: "sliding with no friction",
            1: "nodes stick to the wall on contact",
            2: "sliding with the friction given on the next line",
        },
    },
    "/PROP/SHELL": {
        "Ishell": {
            None: "shell element formulation",
            0: "default from the control cards",
            1: "Belytschko-Tsay, one integration point, cheapest",
            12: "QBAT, fully integrated",
            24: "QEPH, one integration point with physical hourglass control - "
                "the standard crash choice: no hourglass energy to explain away, "
                "at about the cost of the under-integrated element",
        },
        "Ithick": {
            None: "thickness change under strain",
            0: "thickness held constant",
            1: "thickness updated as the element thins, which is what lets a "
               "stamped sheet neck",
        },
        "Iplas": {
            None: "plane-stress plasticity treatment",
            0: "default from the control cards",
            1: "iterative projection, the accurate form",
            2: "radial return",
        },
    },
    "/MAT/PLAS_JOHNS": {
        "ICC": {
            None: "whether the strain-rate term is allowed to raise the failure stress",
            0: "no rate effect on the maximum stress",
            1: "the maximum stress scales with the rate term",
        },
    },
    "/DT/NODA/CST": {
        "Tsca": {None: "safety factor applied to the computed stable time step"},
        "Tmin": {None: "the time step the solver will add nodal mass to protect"},
        "initial_mass_ratio": {
            None: "the added-mass budget the solver spends at cycle 0 to pick Tmin"
        },
    },
    "/STOP": {
        "Emax": {
            None: "abort if the relative energy error exceeds this. The printed "
                  "error is clamped to +/-99.9 %, so a threshold of 0.99 can only "
                  "fire on a total divergence"
        },
        "Mmax": {None: "abort if added mass exceeds this fraction of the initial mass"},
        "Nmax": {None: "abort on this many nodes failing the nodal criterion; 0 disables it"},
    },
}

# ------------------------------------------------------------------ keywords
KEYWORD_ROLE = {
    # Written for someone opening a Radioss file for the first time: what the
    # card is for, in plain words, with the solver term only where it helps.
    "/BEGIN": ("Control", "Declares the units (mass, length, time) every other number in the file is written in."),
    "/TITLE": ("Control", "The model's name."),
    "/DEFAULT": ("Control", "Default settings for every card of one type, unless the card says otherwise."),
    "/DEF_SOLID": ("Control", "Default settings for the solid (brick) elements."),
    "/NODE": ("Mesh", "The mesh points: an id and x, y, z coordinates for each."),
    "/SHELL": ("Mesh", "Four-corner plate elements (sheet metal, thin walls)."),
    "/SH3N": ("Mesh", "Three-corner plate elements, used where quads do not fit."),
    "/BRICK": ("Mesh", "Eight-corner solid elements."),
    "/TETRA10": ("Mesh", "Ten-node tetrahedra (curved-edge solid elements)."),
    "/SPRING": ("Mesh", "Two-point spring elements; here they model the spot welds."),
    "/PART": ("Assembly", "A part: a set of elements with one material and one property (e.g. thickness)."),
    "/SUBSET": ("Assembly", "Groups parts together so results can be read per group."),
    "/MAT": ("Material", "A material: how it stretches, yields and hardens, with its constants."),
    "/FAIL": ("Material", "A failure rule: when the material breaks and the element is removed."),
    "/PROP": ("Property", "Element settings: thickness for plates, and how each element is calculated."),
    "/FUNCT": ("Data", "A curve (x, y) used by a material, a property or a load, e.g. stress against strain."),
    "/INTER": ("Contact", "An interface between parts: glue (tie) or contact."),
    "/RWALL": ("Contact", "A rigid wall: an ideal surface (floor, pole) that mesh points cannot cross."),
    "/RBODY": ("Constraint", "A rigid body: points that move together as one solid block, often with extra mass."),
    "/BCS": ("Constraint", "Points held fixed, or allowed to move only in some directions."),
    "/INIVEL": ("Load", "The starting speed given to the model at time zero."),
    "/GRAV": ("Load", "Gravity (or any acceleration applied to the whole model)."),
    "/SECT": ("Output", "A cut through the model where the force passing through is recorded."),
    "/ACCEL": ("Output", "A virtual accelerometer on one mesh point."),
    "/TH": ("Output", "A measurement request: which quantities to record over time (the T01 file)."),
    "/GRNOD": ("Group", "A named list of mesh points."),
    "/SURF": ("Group", "A named surface, e.g. the faces an interface acts on."),
    "/GRSHEL": ("Group", "A named list of plate elements."),
    "/END": ("Control", "End of the file."),
    # Engine (the run file)
    "/RUN": ("Run", "The run's name and number, and how long to simulate."),
    "/VERS": ("Run", "Which version of the file format this is."),
    "/DT": ("Run", "Time-step control: how big each step is, and whether the solver may add mass to keep it."),
    "/DT1TET10": ("Run", "A more accurate (larger) time step for ten-node tetrahedra."),
    "/STOP": ("Run", "Safety stop: end the run if the energy error or the added mass gets too large."),
    "/PARITH": ("Run", "ON: the same answer whatever the number of CPU cores. OFF: faster, but not repeatable."),
    "/NEGVOL": ("Run", "What to do if a solid element turns inside out."),
    "/PRINT": ("Output", "How often a progress line is written to the log."),
    "/TFILE": ("Output", "How often the curves over time (T01 file) are recorded."),
    "/ANIM": ("Output", "3D snapshots (deformed shape, stresses), in a format free tools can read."),
    "/H3D": ("Output", "3D snapshots in Altair's own .h3d format; no free tool can open it."),
}

MATERIAL_LAWS = {
    "PLAS_JOHNS": (
        "Metal that bends permanently (Johnson-Cook, LAW2)",
        "Behaves like a spring up to its yield stress a, then deforms permanently and gets "
        "harder as it does (b, n). The factor c makes it stronger when loaded fast; "
        "c = 0 switches that off. Formula: stress = (a + b x plastic_strain^n) x "
        "(1 + c x ln(rate / rate_0)).",
    ),
    "PLAS_TAB": (
        "Material that bends permanently, from a measured curve (LAW36)",
        "Behaves like a spring up to its yield stress, then follows a measured curve of "
        "stress against permanent stretch. One curve per loading speed is possible; a "
        "single curve means the speed makes no difference.",
    ),
    "ELAST": (
        "Perfectly elastic (LAW1)",
        "A perfect spring: it springs back from any load, never deforms permanently and "
        "never breaks, however high the stress.",
    ),
}
FAILURE_MODELS = {
    "BIQUAD": (
        "Stretch-to-failure rule (/FAIL/BIQUAD)",
        "The element is removed (the metal tears) once its permanent stretch reaches a "
        "limit that depends on how it is loaded - pulled, sheared or squashed. The "
        "limits come either from five measured values or from a built-in setting per "
        "family of material (M_Flag).",
    ),
}
# /FAIL/BIQUAD M_Flag presets. The preset names a steel class; attaching one to a
# different grade silently substitutes that grade's ductility.
BIQUAD_PRESETS = {
    # hm_cfg_files/config/CFG/radioss2018/FAIL/fail_biquad.cfg, RADIO(M_Flag)
    0: "user coefficients c1..c5",
    1: "mild steel preset",
    2: "HSS preset (high-strength steel, DP600 class)",
    3: "UHSS preset (ultra-high-strength steel, DP1000 class)",
    4: "aluminium AA5182 preset",
    5: "aluminium AA6082-T6 preset",
    6: "plastic PA6GF30 preset",
    7: "plastic PP T40 preset",
    99: "user-defined failure strain ratios",
}


def decode_flag(keyword: str, field: str, value: Any) -> str | None:
    """English for one field of one card, or ``None`` if not in the table."""
    for prefix, fields in FLAG_MEANINGS.items():
        if not keyword.startswith(prefix):
            continue
        table = fields.get(field)
        if table is None:
            continue
        if value in table:
            return table[value]
        return table.get(None)
    return None


def describe_keyword(keyword: str) -> tuple[str, str]:
    """``(category, one-line role)`` for a keyword, longest prefix wins."""
    parts = [p for p in keyword.strip().split("/") if p]
    for cut in range(len(parts), 0, -1):
        candidate = "/" + "/".join(parts[:cut])
        if candidate in KEYWORD_ROLE:
            return KEYWORD_ROLE[candidate]
    return ("Other", "Not yet described by this tool; the raw fields are shown.")


def undecoded_fields(cards) -> list[str]:
    """Which `(keyword, field)` pairs this deck uses that the table misses.

    This is the extension to-do list. Running the skill on an unfamiliar deck
    prints it, so the tool says what it does not yet know instead of pretending.
    """
    missing = []
    for card in cards:
        known = describe_keyword(card.keyword)[0] != "Other"
        if not known:
            missing.append(f"{card.keyword} (whole keyword undescribed)")
            continue
        for name, value in (card.fields or {}).items():
            if value in (None, 0, "") or "#" in name:
                continue
            if decode_flag(card.keyword, name, value) is None:
                missing.append(f"{card.keyword}:{name}")
    return sorted(set(missing))


__all__ = [
    "BIQUAD_PRESETS",
    "FAILURE_MODELS",
    "FLAG_MEANINGS",
    "KEYWORD_ROLE",
    "MATERIAL_LAWS",
    "decode_flag",
    "describe_keyword",
    "undecoded_fields",
]
