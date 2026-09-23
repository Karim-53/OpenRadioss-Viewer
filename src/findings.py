"""The defect rules: what to look for in a deck, and what to offer instead.

Each rule is a function that takes the analysis dict and returns zero or one
:class:`Finding`. Adding a check means adding a function and listing it in
:data:`RULES` - nothing else in the pipeline changes, which is the point: the
same list is what makes this useful on a deck nobody here has seen.

The text is written for someone opening a Radioss model for the first time.
Every finding carries four things:

* **evidence** ("where we saw it") - a file and card, or a solver-listing
  line, so the reader can check it. This part may stay technical.
* **mechanism** ("why it happens") - in plain words; a solver term is
  explained the first time it is used.
* **consequence** ("what it means for the results") - what someone reading
  the results would wrongly conclude.
* **choices** - concrete alternatives, each with its reason and its cost. The
  report renders them as buttons; the answer is written to `interaction.txt`
  and `fixes.py` turns it into the next deck version. The labels are parsed
  there (a duration in ms, a number of points, a percentage), so keep the
  numbers in them.

Severity is about what the result is worth, not about how unusual the setting
is: `error` means a number taken from this run would be wrong or missing;
`warning` means it would be misleading; `info` means it is worth knowing.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Callable


@dataclass
class Choice:
    label: str
    rationale: str
    deck_edit: str = ""
    cost: str = ""


@dataclass
class Finding:
    id: str
    severity: str  # error | warning | info
    title: str  # the one-line message shown in the report
    evidence: str
    mechanism: str
    consequence: str
    category: str = "setup"  # setup | material | mesh | contact | output | physics
    # Where in the report this finding surfaces as a badge. `anchors` are UI
    # keys; `anchor_ids` narrows a table anchor to the rows that actually
    # triggered it, so only the offending parts are marked, not the whole column.
    anchors: list[str] = field(default_factory=list)
    anchor_ids: list[int] = field(default_factory=list)
    choices: list[Choice] = field(default_factory=list)
    recommended: str = ""
    fix_in_v01: bool = False
    # The rule that raised it. IDs are renumbered per model by severity, so
    # anything that acts on a finding later (the v0.1 builder) keys on this.
    rule: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["choices"] = [asdict(c) for c in self.choices] + [
            {"label": "other (type your own)", "rationale": "", "deck_edit": "", "cost": ""}
        ]
        return d


def duration(value: float, unit: str) -> str:
    """A time a person can read: `1e-4 s` -> `0.1 ms`, `100 ms` -> `100 ms`."""
    seconds = value * {"s": 1.0, "ms": 1e-3, "us": 1e-6}.get(unit, 1.0)
    if seconds == 0:
        return "0 ms"
    if seconds >= 1:
        return f"{seconds:.3g} s"
    if seconds >= 1e-5:          # milliseconds read best down to 0.01 ms
        return f"{seconds * 1e3:.3g} ms"
    return f"{seconds * 1e6:.3g} µs"


def _model_noun(m) -> str:
    return m["name"].replace("_", " ").lower()


# ----------------------------------------------------------------- the rules


def run_ends_before_the_physics(m) -> Finding | None:
    """The single most consequential setting in an explicit run: how long it is.

    The test is not "is Tstop small" - it is "is the impact over". It is over
    when the object has stopped (almost all its motion energy taken out) or
    has started to bounce back (the motion energy passed a minimum and rises
    again, which elastic parts do). Deformation energy alone is the wrong
    measure: a rigid wall stops the points that hit it outright, and in the
    phone drop that takes out more energy than the phone absorbs.
    """
    run = m.get("run") or {}
    removed = run.get("ke_removed_fraction")
    if removed is None or run.get("impact_over"):
        return None
    tstop = m["engine"]["run"]["Tstop"]
    unit = m["units"]["work"][2]
    split = run.get("energy_split_end") or {}
    wall = "floor" if (m.get("rigid_wall") or {}).get("type") == "PLANE" else "wall"
    t_min = run.get("t_ke_min") or 0.0
    # Two different situations. Still slowing down at the last cycle: the
    # first hit is unfinished. Slowest moment well before the end, then no
    # bounce: the first hit is over and the object is moving on - a phone
    # landing on a corner pivots towards a second hit on its far edge.
    between_hits = t_min < 0.9 * (run.get("t_end") or tstop)
    left = (split.get("motion") or 0) * 100
    if between_hits:
        title = (f"The {_model_noun(m)} simulation stops after {duration(tstop, unit)}, between "
                 f"the first hit and the next: the object is still moving with {left:.0f} % of "
                 f"its energy")
        mechanism = (
            f"The first hit ended at {duration(t_min, unit)}, having taken out "
            f"{removed * 100:.0f} % of the motion energy. Since then the object has kept moving - "
            "it has neither stopped nor bounced clear. For an object landing on a corner that "
            "usually means it is pivoting towards a second hit on its far edge.")
        consequence = (
            "The second hit is not in the run, and it can be the harder one - for a phone, the "
            "slap-down onto the screen side. Peak values from this run describe the first hit only.")
    else:
        title = (f"The {_model_noun(m)} simulation is too short: it stops after "
                 f"{duration(tstop, unit)}, while the impact is still going on")
        mechanism = (
            "An impact is over when the moving object has stopped, or has started to bounce back. "
            f"Here, when the run ends, the object still carries {(1 - removed) * 100:.0f} % of its "
            "starting motion energy and is still slowing down, so the forces are still building up.")
        consequence = (
            "The largest force, the largest deceleration and the largest stress all happen after "
            "the simulation has stopped. Every peak value read from this run is too low, and the "
            "final shape is not the damaged shape.")
    return Finding(
        id="F-01",
        severity="error",
        anchors=['scenario.termination', 'results.converted'],
        category="setup",
        title=title,
        evidence=(
            f"{m['engine']['file']}, card /RUN: end time = {tstop:g} {unit}. "
            f"{run.get('engine_out_file', 'The Engine listing')}: the impact has taken out "
            f"{removed * 100:.0f} % of the motion energy, at its slowest moment "
            f"({duration(t_min, unit)}); at the end {(split.get('deformation') or 0) * 100:.0f} % is "
            f"in deformation, {(split.get('walls_and_contact') or 0) * 100:.0f} % went into the "
            f"{wall} and contacts, {left:.0f} % is still motion; no bounce."
        ),
        mechanism=mechanism,
        consequence=consequence,
        choices=[
            Choice("lengthen to 0.5 ms",
                   "long enough to see the peak deceleration and the peak stress",
                   "/RUN/Cell_Phone_Drop/1/\n               5e-4",
                   "about 5x the v0 run: roughly 30-45 min on 8 threads"),
            Choice("lengthen to 2.0 ms",
                   "also covers the moment cracks would start and grow",
                   "/RUN/Cell_Phone_Drop/1/\n               2e-3",
                   "about 20x the v0 run: roughly 2-3 h on 8 threads"),
            Choice("lengthen to 5.0 ms",
                   "also covers the bounce back and any second impact",
                   "/RUN/Cell_Phone_Drop/1/\n               5e-3",
                   "about 50x the v0 run: roughly 5-7 h on 8 threads"),
        ],
        # Between hits, the next choice up covers the second one.
        recommended="lengthen to 5.0 ms" if between_hits else "lengthen to 2.0 ms",
        fix_in_v01=True,
    )


def time_history_never_sampled(m) -> Finding | None:
    """A sampling interval longer than the run writes one row and no curve."""
    tf = m["engine"].get("cards", {}).get("TFILE")
    tstop = (m["engine"].get("run") or {}).get("Tstop")
    if not tf or tstop is None:
        return None
    dt = tf.get("dT_HIS")
    if dt is None or dt <= tstop / 10:
        return None
    unit = m["units"]["work"][2]
    n = max(1, int(tstop / dt) + 1)
    return Finding(
        id="F-02",
        severity="error",
        anchors=['engine.TFILE'],
        category="output",
        title=f"The curves over time are recorded every {duration(dt, unit)}, but the run "
              f"only lasts {duration(tstop, unit)}: {n} data point(s), so no curve at all",
        evidence=f"{m['engine']['file']}: /TFILE interval dT_HIS = {dt:g} {unit}; "
                 f"/RUN end time = {tstop:g} {unit}",
        mechanism=(
            "The solver saves one row of its time-history file (the T01 file: energies "
            "and forces over time) each time the clock passes another multiple of this "
            "interval. The interval is longer than the whole run, so it is never passed."
        ),
        consequence=(
            "There is no energy curve, no force curve and no deceleration pulse to plot, "
            "and nothing in the solver output warns about it."
        ),
        choices=[
            Choice("sample 200 points over the run",
                   "enough to draw a clean pulse; the file stays small",
                   "/TFILE/4\n#            dT_HIS\n           {:.3g}".format(
                       (tstop or 1) / 200),
                   "negligible"),
            Choice("sample 1000 points over the run",
                   "also shows fast vibrations in the contact force",
                   "/TFILE/4\n#            dT_HIS\n           {:.3g}".format(
                       (tstop or 1) / 1000),
                   "a few MB"),
        ],
        recommended="sample 200 points over the run",
        fix_in_v01=True,
    )


def no_time_history_requests(m) -> Finding | None:
    """Globals only: nothing is instrumented, so nothing can be measured."""
    if m["starter"]["census"].get("TH", 0) > 0:
        return None
    return Finding(
        id="F-03",
        severity="error",
        anchors=['engine.TH', 'outputs.th'],
        category="output",
        title="Nothing in the model is measured over time: no force sensor on the floor, "
              "no energy per part",
        evidence=f"{m['starter']['file']}: no /TH, /ACCEL or /SECT card "
                 f"in {m['starter']['lines']:,} lines",
        mechanism=(
            "A Radioss model only records a quantity over time if a /TH card (\"time "
            "history\") asks for it - like placing a sensor in a physical test. Without "
            "any, only the totals for the whole model are recorded."
        ),
        consequence=(
            "The two questions a drop test asks - how hard does the floor hit back, and "
            "which component absorbs the blow - cannot be answered from this run's "
            "output, however long it runs."
        ),
        choices=[
            Choice("instrument the floor and every part",
                   "gives the floor force pulse and the energy taken by each component",
                   "/TH/RWALL/1\nfloor reaction\nDEF\n         1\n"
                   "/TH/PART/2\nper-part energies\nDEF\n<all part ids>",
                   "negligible"),
            Choice("instrument the floor only",
                   "the minimum needed for a deceleration pulse",
                   "/TH/RWALL/1\nfloor reaction\nDEF\n         1",
                   "negligible"),
        ],
        recommended="instrument the floor and every part",
        fix_in_v01=True,
    )


def forces_are_really_impulses(m) -> Finding | None:
    """T01 stores impulses; only /TH/TITLE lets the converter name and differentiate them."""
    if m["starter"]["census"].get("TH", 0) == 0:
        return None  # covered by no_time_history_requests
    if any(c.get("keyword", "").startswith("/TH/TITLE") for c in m["engine"].get("card_list", [])):
        return None
    return Finding(
        id="F-04",
        severity="error",
        anchors=['engine.TH_TITLE', 'outputs.th'],
        category="output",
        title="The recorded wall, contact and section \"forces\" are really impulses (force "
              "added up over time), in columns named only \"var N\"",
        evidence=f"{m['starter']['file']}: {m['starter']['census'].get('TH', 0)} /TH cards; "
                 f"{m['engine']['file']}: no /TH/TITLE card",
        mechanism=(
            "Radioss stores force channels as impulse, i.e. force accumulated over time. "
            "Its converter (th_to_csv) turns them back into forces and names their columns "
            "only if a titles file exists, and that file is only written when the "
            "/TH/TITLE card is in the Engine deck. (The global energies and the energies "
            "per part are named either way.)"
        ),
        consequence=(
            "A plot labelled \"force over time\" would really show impulse, which only "
            "ever rises and has no peak. A peak force read from it would be wrong."
        ),
        choices=[
            Choice("add /TH/TITLE and re-run",
                   "the converter then writes named force columns directly",
                   "/TH/TITLE", "one re-run of the Engine"),
            Choice("differentiate the impulse in post-processing",
                   "no re-run, but the result is noisier",
                   "(no deck change)", "none"),
        ],
        recommended="add /TH/TITLE and re-run",
        fix_in_v01=True,
    )


def results_unreadable_without_commercial_software(m) -> Finding | None:
    cards = m["engine"].get("census", {})
    if cards.get("ANIM", 0) > 0 or cards.get("H3D", 0) == 0:
        return None
    return Finding(
        id="F-05",
        severity="error",
        anchors=['engine.ANIM'],
        category="output",
        title="The 3D results (deformed shape, stresses) are saved only in Altair's own "
              ".h3d format, which no free tool can open",
        evidence=f"{m['engine']['file']}: {cards.get('H3D')} /H3D cards, no /ANIM card",
        mechanism=(
            "Radioss can save its 3D results in two ways: /ANIM files, which the free "
            "converter shipped with OpenRadioss turns into standard VTK files, and /H3D, "
            "a commercial Altair format whose layout is not published."
        ),
        consequence=(
            "The stresses and the deformed shape were computed and saved, but without an "
            "Altair licence nobody can look at them. The run has to be repeated to get a "
            "picture or a stress map out of it."
        ),
        choices=[
            Choice("add the matching /ANIM cards",
                   "saves the same results in the open format as well",
                   "/ANIM/DT\n#   TSTART     TFREQ\n0.000000 2\n"
                   "/ANIM/ELEM/VONM\n/ANIM/ELEM/EPSP\n/ANIM/VECT/DISP\n/ANIM/VECT/VEL",
                   "one re-run of the Engine, about 8-10 minutes"),
            Choice("keep /H3D and view in HyperView Player",
                   "no re-run; the free Altair player animates but shows no stress colours",
                   "(no deck change)", "none"),
        ],
        recommended="add the matching /ANIM cards",
        fix_in_v01=True,
    )


def no_abort_guard(m) -> Finding | None:
    stop = m["engine"].get("cards", {}).get("STOP")
    if stop is None:
        return Finding(
            id="F-06",
            severity="warning",
            category="setup",
            anchors=["engine.STOP"],
            title="Nothing stops the run if it goes wrong: there is no safety limit on the "
                  "energy error or on the mass the solver adds",
            evidence=f"{m['engine']['file']}: no /STOP card (the limits then default to 1e30, "
                     f"i.e. none)",
            mechanism=(
                "The /STOP card tells the solver to stop by itself when its own energy "
                "bookkeeping stops adding up, or when it has had to add too much artificial "
                "mass to keep its time step. Without it a run that goes wrong carries on "
                "and still ends with \"NORMAL TERMINATION\"."
            ),
            consequence=(
                "\"The run finished normally\" says nothing about whether the answer can be "
                "trusted; someone has to check it by hand afterwards."
            ),
            choices=[
                Choice("add /STOP with 10 % energy and 5 % mass",
                       "wide enough for a crash with lots of contact, tight enough to catch "
                       "a run that is going wrong",
                       "/STOP\n# Emax Mmax Nmax NTH NANIM NERR_POSIT\n0.10 0.05 0 1 1 1",
                       "none"),
                Choice("add /STOP with 5 % energy and 2 % mass",
                       "stricter, once the model is trusted",
                       "/STOP\n# Emax Mmax Nmax NTH NANIM NERR_POSIT\n0.05 0.02 0 1 1 1",
                       "may stop runs that would have been acceptable"),
            ],
            recommended="add /STOP with 10 % energy and 5 % mass",
            fix_in_v01=True,
        )
    emax = stop.get("Emax")
    if emax is not None and emax >= 0.9:
        return Finding(
            id="F-06",
            severity="warning",
            category="setup",
            anchors=["engine.STOP"],
            title=f"The safety stop on the energy error is set to {emax:g} "
                  f"({emax * 100:.0f} %), so it can never trigger",
            evidence=f"{m['engine']['file']}, card /STOP: Emax = {emax:g}, "
                     f"Mmax = {stop.get('Mmax')}",
            mechanism=(
                "The solver checks its energy bookkeeping every cycle; the \"energy "
                "error\" is how far the books are out, and it is capped at 99.9 %. A limit "
                "of 99 % sits at the very top of that range, so in practice it is never "
                "reached."
            ),
            consequence=(
                "Only the mass half of the safety stop works. A run whose energy "
                "balance drifted by 40 % would still finish \"normally\"."
            ),
            choices=[
                Choice("tighten Emax to 0.10",
                       "the usual acceptance limit for impact runs with contact",
                       "/STOP\n# Emax Mmax Nmax NTH NANIM NERR_POSIT\n"
                       f"0.10 {stop.get('Mmax', 0.05):g} 0 1 1 1", "none"),
                Choice("tighten Emax to 0.05",
                       "stricter; for a model that has already been validated",
                       "/STOP\n# Emax Mmax Nmax NTH NANIM NERR_POSIT\n"
                       f"0.05 {stop.get('Mmax', 0.05):g} 0 1 1 1", "none"),
            ],
            recommended="tighten Emax to 0.10",
            fix_in_v01=True,
        )
    return None


def results_depend_on_thread_count(m) -> Finding | None:
    if m["engine"].get("census", {}).get("PARITH", 0) == 0:
        return None
    card = m["engine"].get("cards", {}).get("PARITH_mode")
    if card != "OFF":
        return None
    return Finding(
        id="F-07",
        severity="warning",
        anchors=['engine.PARITH'],
        category="setup",
        title="The result changes slightly with the number of CPU cores used (/PARITH/OFF)",
        evidence=f"{m['engine']['file']}: /PARITH/OFF",
        mechanism=(
            "A computer adding the same numbers in a different order can get a very "
            "slightly different total. With /PARITH/OFF the cores add up the forces in "
            "whatever order they finish, so 4 cores and 8 cores give different answers."
        ),
        consequence=(
            "Two runs of the same deck on different machines cannot be compared exactly, "
            "and a design study picks up noise that has nothing to do with the design."
        ),
        choices=[
            Choice("switch to /PARITH/ON",
                   "the order is fixed, so the same deck always gives the same answer",
                   "/PARITH/ON", "roughly 5 to 10 % slower"),
            Choice("keep OFF and pin the thread count",
                   "cheaper, but only reproducible while nobody changes the core count",
                   "(no deck change; document -nt)", "none"),
        ],
        recommended="switch to /PARITH/ON",
        fix_in_v01=True,
    )


def no_contact_only_ties(m) -> Finding | None:
    """Tied interfaces glue parts together; they do not stop them touching."""
    inter = m["starter"].get("interfaces", [])
    if not inter:
        return None
    kinds = {i["type"] for i in inter}
    if kinds - {"TYPE2"}:
        return None
    unattached = m["starter"].get("unattached_parts", [])
    extra = ""
    if unattached:
        names = ", ".join(u["title"] for u in unattached)
        frac = sum(u["mass_fraction"] for u in unattached) * 100
        extra = (f" {len(unattached)} part(s) ({names}) are not even glued to anything: "
                 f"{frac:.1f} % of the model's mass.")
    return Finding(
        id="F-08",
        severity="error",
        anchors=['contacts.kinds', 'contacts.unattached'],
        category="contact",
        title="Parts can pass through each other: every connection in the model is glue, "
              "none is contact",
        evidence=(f"{m['starter']['file']}: {len(inter)} interfaces, all /INTER/TYPE2 "
                  f"(\"tied\", i.e. glued); no contact interface." + extra),
        mechanism=(
            "A tied interface glues surfaces that already touch at the start. It does not "
            "notice two parts coming together later. Stopping that needs a contact "
            "interface, and this model has none."
        ),
        consequence=(
            "Inside the phone, components can move through the circuit board and through "
            "each other. Anything the model says about how the load travels between "
            "internal parts cannot be trusted."
        ),
        choices=[
            Choice("add one self-contact over all parts",
                   "one general contact (/INTER/TYPE24) on the outer faces of every part; "
                   "the existing glue keeps priority where parts are already joined",
                   "/SURF/PART/EXT over every part\n/INTER/TYPE24 on that surface, "
                   "Irem_i2 = 1",
                   "roughly 20 to 40 % more run time"),
            Choice("add contact only around the impact corner",
                   "cheaper; covers only the region that actually deforms",
                   "/INTER/TYPE24 over the parts near the corner",
                   "roughly 10 % more run time"),
        ],
        recommended="add one self-contact over all parts",
        fix_in_v01=True,
    )


def no_failure_model(m) -> Finding | None:
    if m["starter"]["census"].get("FAIL", 0) > 0:
        return None
    # keyed on the law, not its display name, so rewording the name cannot switch this off
    brittle = [p for p in m["assembly"] if p.get("material_law_key") == "ELAST"]
    if not brittle:
        return None
    names = ", ".join(sorted({p["title"] for p in brittle})[:4])
    return Finding(
        id="F-09",
        severity="error",
        anchors=['materials.failure'],
        category="material",
        title="Nothing in the model can break: no part has a failure limit",
        evidence=(f"{m['starter']['file']}: no /FAIL card; "
                  f"{len(brittle)} of {len(m['assembly'])} parts use a purely elastic "
                  f"material ({names}, ...)"),
        mechanism=(
            "A purely elastic material behaves like a perfect spring: the harder you push, "
            "the more it resists, with no limit. It never bends permanently, never cracks "
            "and is never removed from the model."
        ),
        consequence=(
            "The model cannot say whether the screen cracks or the board breaks - which is "
            "what a drop test is for. It can only say how much stress those parts would "
            "carry if they were unbreakable."
        ),
        choices=[
            Choice("add a brittle failure strain to the glass",
                   "screen cracking becomes something the model predicts",
                   "/FAIL/BRITTLE or /MAT/LAW27 on the lcd_screen material",
                   "small; needs a failure strain from a datasheet"),
            Choice("report the stress margin instead",
                   "no new data needed: compare the peak stress with the material's "
                   "strength, quoted separately",
                   "(no deck change)", "none"),
        ],
        recommended="report the stress margin instead",
        fix_in_v01=False,
    )


def under_resolved_through_thickness(m) -> Finding | None:
    bad = [
        p for p in m["assembly"]
        if not p.get("is_shell")
        and p.get("through_thickness") is not None
        and p["through_thickness"] < 1.0
    ]
    if not bad:
        return None
    worst = sorted(bad, key=lambda p: p["through_thickness"])[:5]
    names = ", ".join(f"{p['title']} ({p['through_thickness']:.2f})" for p in worst)
    return Finding(
        id="F-10",
        severity="error",
        anchors=['assembly.through_thickness'],
        category="mesh",
        title=f"{len(bad)} thin parts are less than one element thick, so they cannot bend "
              f"properly",
        evidence=f"part thickness / mean element size, worst first: {names}",
        anchor_ids=[p["id"] for p in bad],
        mechanism=(
            "To bend, a plate has to stretch on one face and squeeze on the other. With "
            "less than one brick element across the thickness, the mesh cannot represent "
            "that difference. The only stiffness left against bending comes from a "
            "numerical stabiliser (\"hourglass control\"), not from the material."
        ),
        consequence=(
            "How stiff these boards and screens are depends on a solver setting rather than "
            "on their geometry, so their bending - the way a phone usually breaks - is not "
            "modelled."
        ),
        choices=[
            Choice("three elements through each plate",
                   "the usual minimum for a solid part that bends",
                   "re-mesh the listed parts with 3 elements across the thickness",
                   "roughly 3x the element count in those parts"),
            Choice("model the plates as shells",
                   "shell elements are made for thin plates and bend correctly at a "
                   "fraction of the cost",
                   "convert the PCB and screen parts to /PROP/SHELL with N = 5",
                   "cheaper than the current mesh"),
        ],
        recommended="model the plates as shells",
        fix_in_v01=False,
    )


def collapsed_elements(m) -> Finding | None:
    total = sum(p.get("collapsed_elements", 0) for p in m["assembly"])
    if total == 0:
        return None
    parts = [p for p in m["assembly"] if p.get("collapsed_elements", 0)]
    detail = ", ".join(f"{p['title']}: {p['collapsed_elements']}" for p in parts)
    return Finding(
        id="F-11",
        severity="warning",
        anchors=['assembly.collapsed'],
        category="mesh",
        title=f"{total} mesh elements are squashed into a wedge shape",
        evidence=f"brick elements with a corner node used twice - {detail}",
        anchor_ids=[p["id"] for p in parts],
        mechanism=(
            "A brick with two corners on the same point is still accepted, as a wedge. "
            "Being smaller than its neighbours, it forces the solver to take smaller time "
            "steps, and the solver then adds artificial mass there to keep going."
        ),
        consequence=(
            "The artificial mass ends up where the mesh is worst rather than where the "
            "physics needs it, and a small stiff wedge sits inside an otherwise regular "
            "board."
        ),
        choices=[
            Choice("re-mesh the affected parts", "removes the problem at the source",
                   "(mesh change, not a deck edit)", "a meshing session"),
            Choice("accept and report", "they are legal elements; note them as a known limitation",
                   "(no change)", "none"),
        ],
        recommended="accept and report",
        fix_in_v01=False,
    )


def no_strain_rate_dependence(m) -> Finding | None:
    flat = [
        mat for mat in m["materials"]
        if mat.get("law_key") == "PLAS_JOHNS" and not mat.get("rate_dependent")
    ]
    if not flat:
        return None
    v = (m.get("scenario") or {}).get("impact_speed_ms")
    names = ", ".join(mat["title"] for mat in flat)
    return Finding(
        id="F-12",
        severity="warning",
        anchors=['materials.rate'],
        category="material",
        title=(f"The steels behave as if loaded slowly, although this is a {v:.1f} m/s impact"
               if v else "The steels behave as if loaded slowly"),
        evidence=f"{names}: c = 0 on every /MAT/PLAS_JOHNS card (no strain-rate effect)",
        mechanism=(
            "Steel gets stronger when it is deformed fast: dual-phase steels resist "
            "roughly 10 to 20 % more in a crash than in a slow test. The Johnson-Cook law "
            "models this with the factor c; with c = 0 the effect is switched off."
        ),
        consequence=(
            "The crush force and the energy the beam absorbs are under-predicted, "
            "systematically, and the beam folds at a lower load than the real part would."
        ),
        choices=[
            Choice("add Cowper-Symonds style rate terms",
                   "restores the speed effect; needs c and a reference rate from a datasheet",
                   "#                  c           EPS_DOT_0       ICC\n"
                   "               0.015                 0.001         1",
                   "no extra run time; needs material data"),
            Choice("keep rate-independent and state it",
                   "acceptable for a demonstration model; the forces become a lower bound",
                   "(no deck change)", "none"),
        ],
        recommended="keep rate-independent and state it",
        fix_in_v01=False,
    )


def failure_preset_mismatch(m) -> Finding | None:
    wrong = [
        f for f in m.get("failures", [])
        if f.get("preset_name") and f.get("material_title")
        and "DP600" in f["preset_name"].upper() and "DP1000" in f["material_title"].upper()
    ]
    if not wrong:
        return None
    owner = wrong[0]["material_title"]
    cards = ", ".join(f"/FAIL/BIQUAD/{f['id']}" for f in wrong)
    return Finding(
        id="F-13",
        severity="error",
        category="material",
        anchors=["materials.failure_preset"],
        anchor_ids=[f["id"] for f in wrong],
        title=f"The {owner} parts break like a softer steel: their failure rule is the one "
              f"calibrated for DP600",
        evidence=(f"{cards}: M_Flag = {wrong[0]['M_Flag']} (\"{wrong[0]['preset_name']}\"), "
                  f"attached to material(s) named {owner}"),
        mechanism=(
            "The failure rule (/FAIL/BIQUAD) decides how much a steel can stretch before it "
            "tears. It comes with ready-made settings per family of steel (M_Flag). The "
            "stronger DP1000 steel stretches less before tearing than DP600, but these "
            "cards use the DP600 setting."
        ),
        consequence=(
            "The beam tears later than the real part would, so the model over-estimates "
            "how much energy it can absorb before breaking."
        ),
        choices=[
            Choice("switch to the UHSS preset",
                   "M_Flag = 3, the setting for ultra-high-strength steel such as DP1000",
                   "#       P_thick_fail    M_Flag    S_Flag\n"
                   "                   0         3         0", "none"),
            Choice("supply measured c1..c5",
                   "exact, if the steel's failure has been measured",
                   "#                 C1                  C2 ...", "needs test data"),
        ],
        recommended="switch to the UHSS preset",
        fix_in_v01=True,
    )


def initial_penetrations(m) -> Finding | None:
    pen = (m.get("run") or {}).get("initial_penetrations")
    if not pen:
        return None
    return Finding(
        id="F-14",
        severity="warning",
        anchors=['contacts.penetrations'],
        category="contact",
        title=f"Some surfaces overlap before the impact starts: {pen['count']} overlaps on "
              f"{pen['nodes']} mesh points",
        evidence=f"{pen['source']}: WARNING ID 343, interface {pen['interface']}",
        mechanism=(
            "Two meshed surfaces already sit slightly inside each other at the start. The "
            "solver setting Inacti = 6 handles this by accepting the overlap and softening "
            "the contact there, instead of pushing the points apart."
        ),
        consequence=(
            "Contact in those places starts a little later and softer than elsewhere. It "
            "is an accepted compromise, not an error, but it sits on the flanges that carry "
            "the crush load."
        ),
        choices=[
            Choice("keep Inacti = 6 and report it", "the recommended treatment; no change",
                   "(no change)", "none"),
            Choice("clean the penetrations in the mesh",
                   "removes the compromise instead of absorbing it",
                   "(mesh change)", "a meshing session"),
        ],
        recommended="keep Inacti = 6 and report it",
        fix_in_v01=False,
    )


def orphan_definitions(m) -> Finding | None:
    orphans = m.get("orphans") or {}
    items = [f"{k}: {', '.join(str(x) for x in v)}" for k, v in orphans.items() if v]
    if not items:
        return None
    return Finding(
        id="F-15",
        severity="info",
        anchors=['orphans'],
        category="setup",
        title="The model file defines materials or properties that no part uses",
        evidence="; ".join(items),
        mechanism=(
            "Radioss reads every definition, used or not. An unused one has no effect on "
            "the result."
        ),
        consequence=(
            "It usually means the deck was cut down from a bigger model. Someone editing "
            "an unused card would see no effect and not know why."
        ),
        choices=[
            Choice("delete the orphans", "every card left in the deck is then used",
                   "(remove the listed cards)", "none"),
            Choice("keep and annotate", "keeps a trace of where the model came from",
                   "(no change)", "none"),
        ],
        recommended="keep and annotate",
        fix_in_v01=False,
    )


def model_mass_is_not_the_real_thing(m) -> Finding | None:
    ref = m.get("reference_mass")
    if not ref:
        return None
    actual, expected, what = ref["actual"], ref["expected"], ref["what"]
    if 0.6 <= actual / expected <= 1.6:
        return None
    return Finding(
        id="F-16",
        severity="warning",
        anchors=['scenario.mass'],
        category="physics",
        title=f"The model weighs {ref['actual_label']}, only about {actual / expected:.0%} "
              f"of {what}",
        evidence=ref["evidence"],
        mechanism=(
            "The energy of an impact is ½ × mass × speed². At the same speed, a model that "
            "is lighter than the real object arrives with proportionally less energy to "
            "absorb."
        ),
        consequence=(
            f"Absorbed energy, peak force and deceleration are all about "
            f"{actual / expected:.2f} times what the real object would see. Comparing them "
            "with a physical test would mislead unless the mass is matched first."
        ),
        choices=[
            Choice("add the missing mass as non-structural mass",
                   "restores the energy without changing the geometry",
                   "/ADMAS on the relevant node groups", "none"),
            Choice("treat the result as normalised",
                   "compare energies per gram rather than absolute values",
                   "(no change)", "none"),
        ],
        recommended="add the missing mass as non-structural mass",
        fix_in_v01=False,
    )


def rigid_wall_search_band_too_small(m) -> Finding | None:
    w = m.get("rigid_wall")
    if not w or not w.get("d_search") or not w.get("required_reach"):
        return None
    if w["d_search"] >= w["required_reach"]:
        return None
    return Finding(
        id="F-17",
        severity="warning",
        anchors=['contacts.wall_dsearch'],
        category="contact",
        title=f"The floor only \"sees\" the part of the model that starts within "
              f"{w['d_search']:.3g} mm of it, but the model is {w['required_reach']:.3g} mm "
              f"deep",
        evidence=f"{m['starter']['file']}, card /RWALL: search distance D_search = "
                 f"{w['d_search']:.4g} mm; {w['reach_reason']}",
        mechanism=(
            "At the start, the solver lists every mesh point within the search distance "
            "of the floor, and only those points can ever touch it. The list is not "
            "updated during the run."
        ),
        consequence=(
            "In a short run this changes nothing, because only the corner reaches the "
            "floor. In a longer one the object tips over after the first hit, and points "
            "that started further away can pass straight through the floor."
        ),
        choices=[
            Choice("widen D_search past the expected travel",
                   "every point that could reach the floor is watched from the start",
                   f"#           D_search                fric\n"
                   f"        {w['required_reach'] * 1.2:.6g}                  "
                   f"{w.get('friction', 0.3):g}",
                   "a slightly larger search at every cycle"),
            Choice("keep and verify no node crosses",
                   "cheap; needs a check on the final shape",
                   "(no change)", "none"),
        ],
        recommended="widen D_search past the expected travel",
        fix_in_v01=True,
    )


def energy_books_out(m) -> Finding | None:
    """A run whose energy balance drifts past 5 % is telling you something.

    Found on the phone's v0.1: after the new self-contact was added the error
    grew steadily, to -6.8 % over 2 ms, while the v0 run (no contact) stayed at
    0. The T01 file's global channels say where it went - friction and
    hourglass energy, which the listing's ERROR column does not count - and
    when counting them closes the balance, the drift is explained, not a fault.
    """
    run = m.get("run") or {}
    err = run.get("energy_error_max_pct")
    if err is None or err < 5.0:
        return None
    es = run.get("energy_sources") or {}
    fr = es.get("fractions_end") or {}
    closed = es.get("balance_closed_pct")
    explained = closed is not None and abs(closed) < 1.0
    stop = (m["engine"].get("cards") or {}).get("STOP") or {}
    limit = stop.get("Emax")
    shares = (f"friction {fr.get('friction', 0) * 100:.1f} %, hourglass "
              f"{fr.get('hourglass', 0) * 100:.1f} %, contact damping "
              f"{fr.get('contact_damping', 0) * 100:.1f} % of the impact energy")
    return Finding(
        id="F-18",
        severity="info" if explained else "warning",
        anchors=["results.energy_error"],
        category="physics",
        title=(f"The solver's energy books drift by up to {err:.1f} %, and all of it is accounted "
               f"for by friction and the hourglass stabiliser" if explained
               else f"The solver's energy books are out by up to {err:.1f} %, and the cause is not "
                    f"identified"),
        evidence=(f"{run.get('engine_out_file', 'Engine listing')}: ERROR column reaches {err:.1f} %"
                  + (f"; the safety stop (/STOP) is set at {limit * 100:.0f} %" if limit else "")
                  + (f". {es['file']}: {shares}; counting them, the balance closes to "
                     f"{closed:+.2f} %" if closed is not None else "")),
        mechanism=(
            "Every cycle the solver checks that motion energy + deformation energy equals the "
            "starting energy plus the work done on the model. Energy lost to friction in contacts, "
            "and the work of the hourglass stabiliser, are real but are not in that sum - so they "
            "show up as a negative error, growing for as long as parts slide on each other."
        ),
        consequence=(
            ("The run is sound in energy terms. But the safety stop reads the same ERROR column, "
             "so a longer run can be stopped for a drift that is fully explained - set its limit "
             "knowing this.") if explained else
            ("Energies and forces read from the run carry an uncertainty of about this size, and "
             "a longer run may reach the safety stop and end early.")
        ),
        choices=[
            Choice("accept it and state what it is", "the balance closes once friction and "
                   "hourglass energy are counted", "(no change)", "none"),
            Choice("lower the contact friction",
                   "if friction is the sink, the drift shrinks; changes the physics",
                   "/INTER/TYPE24 Fric 0.1 -> 0.05", "a re-run"),
            Choice("name the time-history channels and read them",
                   "/TH/TITLE makes every channel of the T01 file named, per part and per interface",
                   "/TH/TITLE", "none; read on the next run"),
        ],
        recommended=("accept it and state what it is" if explained
                     else "name the time-history channels and read them"),
        fix_in_v01=False,
    )


def hourglass_energy_high(m) -> Finding | None:
    """Hourglass energy above ~10 % of the deformation energy: the usual limit.

    Solid bricks with one integration point can deform in zig-zag patterns
    that cost no energy; the solver adds an artificial stiffness against them
    and books its work as hourglass energy. When that share is large, part of
    the answer comes from the stabiliser rather than from the material.
    """
    es = (m.get("run") or {}).get("energy_sources") or {}
    ratio = es.get("hourglass_to_internal_max")
    if not ratio or ratio <= 0.10:
        return None
    thin = [p for p in m.get("assembly", []) if not p.get("is_shell")
            and p.get("through_thickness") is not None and p["through_thickness"] < 1.0]
    return Finding(
        id="F-19",
        severity="warning",
        anchors=["results.hourglass", "assembly.through_thickness"],
        anchor_ids=[p["id"] for p in thin],
        category="mesh",
        title=f"The numerical stabiliser holds {ratio * 100:.0f} % of the deformation energy "
              f"(the usual limit is 10 %)",
        evidence=(f"{es.get('file', 'T01')}: HOURGLASS ENERGY / INTERNAL ENERGY peaks at "
                  f"{ratio * 100:.1f} % (at the end {(es.get('hourglass_to_internal_end') or 0) * 100:.1f} %)"
                  + (f"; {len(thin)} parts have less than one element through their thickness"
                     if thin else "")),
        mechanism=(
            "A brick element with a single integration point can deform in a zig-zag "
            "(\"hourglass\") pattern that its one point does not see, so it costs no energy. The "
            "solver adds an artificial stiffness against it and books that work as hourglass "
            "energy. Thin parts meshed with less than one element across their thickness bend "
            "almost entirely through such patterns."
        ),
        consequence=(
            "Part of the deformation, and of the stresses, in the thin parts comes from the "
            "stabiliser's setting rather than from the material. The bending of the boards and "
            "the screen - the way a phone breaks - is the least trustworthy number in the run."
        ),
        choices=[
            Choice("model the plates as shells",
                   "shell elements are made for thin plates and bend without hourglass modes",
                   "convert the PCB and screen parts to /PROP/SHELL", "a re-mesh; cheaper to run"),
            Choice("use a fully integrated solid formulation",
                   "no hourglass modes by construction; slower per element",
                   "/PROP/SOLID Isolid for the thin parts", "roughly 2-4x the solid cost"),
            Choice("accept and state it", "report the share next to every stress value",
                   "(no change)", "none"),
        ],
        recommended="model the plates as shells",
        fix_in_v01=False,
    )


RULES: list[Callable] = [
    run_ends_before_the_physics,
    time_history_never_sampled,
    no_time_history_requests,
    forces_are_really_impulses,
    results_unreadable_without_commercial_software,
    no_abort_guard,
    results_depend_on_thread_count,
    no_contact_only_ties,
    no_failure_model,
    under_resolved_through_thickness,
    collapsed_elements,
    no_strain_rate_dependence,
    failure_preset_mismatch,
    initial_penetrations,
    orphan_definitions,
    model_mass_is_not_the_real_thing,
    rigid_wall_search_band_too_small,
    energy_books_out,
    hourglass_energy_high,
]

SEVERITY_ORDER = {"error": 0, "warning": 1, "info": 2}


def detect(model: dict) -> list[dict]:
    """Run every rule against one analysed model, most severe first.

    A rule that raises is reported as a rule failure rather than being allowed
    to take the whole report down: on an unfamiliar deck the most likely
    outcome is a missing key, and a partial register beats no report.
    """
    found, broken = [], []
    for rule in RULES:
        try:
            result = rule(model)
        except Exception as exc:  # noqa: BLE001 - see docstring
            broken.append(f"{rule.__name__}: {type(exc).__name__}: {exc}")
            continue
        if result is not None:
            result.rule = rule.__name__
            found.append(result)
    found.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, 9), f.id))
    for i, f in enumerate(found, 1):
        f.id = f"F-{i:02d}"
    out = [f.to_dict() for f in found]
    if broken:
        out.append(
            Finding(
                id="F-00",
                severity="info",
                category="setup",
                title=f"{len(broken)} check(s) could not run on this deck",
                evidence="; ".join(broken),
                mechanism="A check expected a value this deck does not provide.",
                consequence="Those checks are missing from this list, not passed.",
                rule="detect",
            ).to_dict()
        )
    return out


__all__ = ["Choice", "Finding", "RULES", "detect", "duration"]
