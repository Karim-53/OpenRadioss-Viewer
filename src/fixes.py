"""Build v0.1: the original decks with the chosen fixes applied.

For every finding marked `fix_in_v01`, the answer comes from `interaction.txt`
when the reader has given one in the report, and from the finding's
recommended choice otherwise. Each answer is turned into named edits by
`patch_deck`, applied to the pristine decks, and written with a unified diff
into `<Model>/v0.1/`. The originals are never opened for writing.

What cannot be automated is said, not skipped silently: a free-form answer
this module cannot interpret, and a dismissed finding, are both listed in
`edits.json` under `not_applied`, with the reason.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import patch_deck as pd


@dataclass
class Context:
    model: dict
    starter: pd.Deck
    engine: pd.Deck
    time_unit: str
    tstop: float
    applied: list[dict] = field(default_factory=list)
    not_applied: list[dict] = field(default_factory=list)


def _ms_to_model_time(ms: float, unit: str) -> float:
    return {"s": ms * 1e-3, "ms": ms, "us": ms * 1e3}.get(unit, ms * 1e-3)


def _next_id(deck: pd.Deck, prefix: str, start: int = 9000) -> int:
    """An id not yet used by any card with this prefix."""
    used = set()
    for line in deck.lines:
        if line.startswith(prefix):
            m = re.search(r"/(\d+)\s*$", line.strip())
            if m:
                used.add(int(m.group(1)))
    i = start
    while i in used:
        i += 1
    return i


def _id_rows(ids: list[int]) -> list[str]:
    return [pd.fixed_row(ids[i:i + 10]) for i in range(0, len(ids), 10)]


# ------------------------------------------------------------ one per rule
# Each takes the context and the chosen answer, and records edits on the decks.

def fix_run_length(c: Context, answer: str, reason: str) -> None:
    m = re.search(r"(\d+(?:\.\d+)?)\s*ms", answer)
    if not m:
        raise ValueError("no duration in milliseconds found in the answer")
    new = _ms_to_model_time(float(m.group(1)), c.time_unit)
    pd.set_termination_time(c.engine, new, reason)
    # Keep the picture density: about fifty snapshots whatever the length.
    pd.set_animation_interval(c.engine, new / 50, reason)
    c.tstop = new


def fix_sampling(c: Context, answer: str, reason: str) -> None:
    m = re.search(r"(\d+)\s*points", answer)
    n = int(m.group(1)) if m else 200
    pd.set_time_history_interval(c.engine, c.tstop / n, reason)


def fix_instrumentation(c: Context, answer: str, reason: str) -> None:
    header = "#     var1      var2      var3      var4      var5      var6      var7      var8      var9     var10"
    objects = "#     Obj1      Obj2      Obj3      Obj4      Obj5      Obj6      Obj7      Obj8      Obj9     Obj10"
    block: list[str] = []
    if "every part" in answer or "part" in answer:
        part_ids = [p["id"] for p in c.model.get("assembly", [])]
        tid = _next_id(c.starter, "/TH/")
        block += [f"/TH/PART/{tid}", "TH PART every part", header, "DEF", objects] + _id_rows(part_ids)
    if (c.model.get("rigid_wall") or {}).get("type"):
        tid = _next_id(c.starter, "/TH/", 9001 if block else 9000)
        block += [f"/TH/RWALL/{tid}", "TH RWALL the floor", header, "DEF", objects, pd.fixed_row([1])]
    pd.insert_before(c.starter, block, "/END",
                     what="add /TH/PART (energies per part) and /TH/RWALL (the wall force)",
                     reason=reason)
    # Sensors without /TH/TITLE record impulses in unnamed columns - the first
    # phone v0.1 added the sensors alone, and its own findings flagged the
    # regression. The titles card belongs to the same fix.
    if not any(l.startswith("/TH/TITLE") for l in c.engine.lines):
        fix_th_title(c, answer, reason)


def fix_th_title(c: Context, answer: str, reason: str) -> None:
    pd.add_card(c.engine, "/TH/TITLE", [], after="/RUN", reason=reason)


def fix_open_animation(c: Context, answer: str, reason: str) -> None:
    body_dt = [f"0.000000 {pd._fmt(c.tstop / 50)}"]
    pd.add_card(c.engine, "/ANIM/DT", ["#   TSTART     TFREQ"] + body_dt, after="/RUN", reason=reason)
    for card in ("/ANIM/ELEM/VONM", "/ANIM/ELEM/EPSP", "/ANIM/VECT/DISP", "/ANIM/VECT/VEL"):
        pd.add_card(c.engine, card, [], after="/ANIM/DT", reason=reason)


def fix_abort_guard(c: Context, answer: str, reason: str) -> None:
    # Read each limit only from the phrase that names it: "10 % energy",
    # "5 % mass", "Emax to 0.30". A bare percentage elsewhere in a free-form
    # answer (a justification quoting "2.2 %") must not become a limit.
    energy = re.search(r"(\d+(?:\.\d+)?)\s*%\s*energy", answer)
    mass = re.search(r"(\d+(?:\.\d+)?)\s*%\s*mass", answer)
    named = re.search(r"Emax to (\d*\.\d+)", answer)
    emax = (float(named.group(1)) if named
            else float(energy.group(1)) / 100 if energy else 0.10)
    mmax = float(mass.group(1)) / 100 if mass else 0.05
    body = ["# Emax Mmax Nmax NTH NANIM NERR_POSIT", f"{emax:g} {mmax:g} 0 1 1 1"]
    if any(l.startswith("/STOP") for l in c.engine.lines):
        def apply(lines, body=body):
            i = pd.find_card(lines, "/STOP")
            end = i + 1
            while end < len(lines) and not lines[end].startswith("/"):
                end += 1
            return lines[:i + 1] + body + lines[end:]
        c.engine.edits.append(pd.Edit(what=f"/STOP Emax -> {emax:g}, Mmax -> {mmax:g}",
                                      expect="", apply=apply, reason=reason))
    else:
        pd.add_card(c.engine, "/STOP", body, after="/RUN", reason=reason)


def fix_parith(c: Context, answer: str, reason: str) -> None:
    pd.replace_card_keyword(c.engine, "/PARITH/OFF", "/PARITH/ON", reason)


def fix_self_contact(c: Context, answer: str, reason: str) -> None:
    """One /INTER/TYPE24 over the outer surface of every part.

    TYPE24 is the general-purpose contact and, with Irem_i2 = 1, it leaves
    alone the node pairs the existing TYPE2 ties already hold - so adding it
    to a tied assembly does not fight the ties.
    """
    part_ids = [p["id"] for p in c.model.get("assembly", [])]
    sid = _next_id(c.starter, "/SURF/")
    iid = _next_id(c.starter, "/INTER/")
    # /SURF/PART alone is refused for solid parts (Starter ERROR 1104); EXT
    # builds the outer faces of the listed solids, which is what contact needs.
    block = [f"/SURF/PART/EXT/{sid}", "every part, for the self-contact",
             "#  part_ID1  part_ID2  part_ID3  part_ID4  part_ID5  part_ID6  part_ID7  part_ID8  part_ID9 part_ID10"]
    block += _id_rows(part_ids)
    block += [
        f"/INTER/TYPE24/{iid}", "self-contact over every part",
        "# surf_ID1  surf_ID2      Istf                       Irem_i2                Idel",
        pd.fixed_row([sid, 0, 0]) + " " * 20 + pd.fixed_row([1]),
        "# grnd_IDs                         Iedge          Edge_angle           Gap_max_s           Gap_max_m",
        "",
        "#              Stmin               Stmax     Igap0     Ipen0           Ipen_max",
        "",
        "#              Stfac                Fric                                  Tstart               Tstop",
        f"{'1':>20}{'0.1':>20}",
        "#      IBC                        Inacti                VISs                     Tpressfit",
        "",
        "#    Ifric    Ifiltr               Xfreq             sens_ID                                 fric_ID",
        "",
    ]
    pd.insert_before(c.starter, block, "/END",
                     what=f"add /INTER/TYPE24/{iid}: self-contact over all {len(part_ids)} parts",
                     reason=reason)


def fix_failure_preset(c: Context, answer: str, reason: str) -> None:
    for fail in c.model.get("failures", []):
        preset = (fail.get("preset_name") or "").upper()
        owner = (fail.get("material_title") or "").upper()
        if "DP600" in preset and "DP1000" in owner:
            pd.set_failure_preset(c.starter, fail["id"], 3, reason)


def fix_wall_search(c: Context, answer: str, reason: str) -> None:
    reach = (c.model.get("rigid_wall") or {}).get("required_reach")
    if not reach:
        raise ValueError("the wall reach was not computed")
    pd.set_rigid_wall_search(c.starter, round(reach * 1.2, 1), reason)


FIXES: dict[str, Callable[[Context, str, str], None]] = {
    "run_ends_before_the_physics": fix_run_length,
    "time_history_never_sampled": fix_sampling,
    "no_time_history_requests": fix_instrumentation,
    "forces_are_really_impulses": fix_th_title,
    "results_unreadable_without_commercial_software": fix_open_animation,
    "no_abort_guard": fix_abort_guard,
    "results_depend_on_thread_count": fix_parith,
    "no_contact_only_ties": fix_self_contact,
    "failure_preset_mismatch": fix_failure_preset,
    "rigid_wall_search_band_too_small": fix_wall_search,
}
# Order matters where one fix reads another's result: the run length decides
# the sampling interval and the animation cadence.
ORDER = list(FIXES)


def answers_for(model_name: str, interaction: str | Path | None,
                version: str = "v0") -> dict[str, str]:
    """`{finding id: answer}` for one model and version, from an `interaction.txt`.

    A block without a `version:` line answers a v0 finding, which is what
    v0.1 is built from.
    """
    if not interaction or not Path(interaction).exists():
        return {}
    out = {}
    for block in pd.read_interaction(interaction):
        if (block.get("model") == model_name and block.get("finding")
                and block.get("version", "v0") == version):
            out[block["finding"]] = block.get("answer", "")
            if block.get("rule"):
                # IDs are renumbered whenever the list changes; the rule is stable.
                out["rule:" + block["rule"]] = block.get("answer", "")
    return out


def build_v01(model_dir: str | Path, model: dict, interaction: str | Path | None = None,
              skip: set[str] | None = None, out_subdir: str = "v0.1",
              overrides: dict[str, str] | None = None) -> dict:
    """Write `<model>/v0.1/` with the patched decks, `deck.diff` and `edits.json`.

    `out_subdir` and `overrides` ({rule: answer}, taking precedence over
    everything) build further versions the same way: v0.2 is v0.1's answers
    with the run length set to 5 ms.
    """
    model_dir = Path(model_dir)
    starter_path = next(iter(sorted(model_dir.glob("*_0000.rad"))))
    engine_path = next(iter(sorted(model_dir.glob("*_0001.rad"))))
    ctx = Context(model=model, starter=pd.Deck.read(starter_path), engine=pd.Deck.read(engine_path),
                  time_unit=model["units"]["work"][2],
                  tstop=float(model["engine"]["run"]["Tstop"]))
    given = answers_for(model["name"], interaction)
    for rule, answer in (overrides or {}).items():
        given["rule:" + rule] = answer
    skip = skip or set()
    findings = sorted(
        (f for f in model.get("findings", []) if f.get("rule") in FIXES),
        key=lambda f: ORDER.index(f["rule"]))
    for f in findings:
        mine = given.get("rule:" + f["rule"]) or given.get(f["id"])
        answer = mine or (f["recommended"] if f.get("fix_in_v01") else "")
        source = ("--answer" if f["rule"] in (overrides or {})
                  else "interaction.txt" if mine else "recommended")
        entry = {"finding": f["id"], "rule": f["rule"], "title": f["title"],
                 "answer": answer, "source": source}
        if not answer:
            continue
        if answer.startswith("dismissed") or f["rule"] in skip:
            ctx.not_applied.append(dict(entry, why="dismissed" if answer.startswith("dismissed")
                                        else "skipped for this build"))
            continue
        if answer in ("(no change)",) or answer.startswith(("keep", "accept", "report")):
            ctx.not_applied.append(dict(entry, why="the chosen answer keeps the deck as it is"))
            continue
        ns, ne = len(ctx.starter.edits), len(ctx.engine.edits)
        try:
            FIXES[f["rule"]](ctx, answer, f["id"])
        except Exception as exc:  # a free-form answer the rule cannot read
            ctx.not_applied.append(dict(entry, why=f"could not apply automatically: {exc}"))
            continue
        edits = ctx.starter.edits[ns:] + ctx.engine.edits[ne:]
        ctx.applied.append(dict(entry, edits=[e.what for e in edits]))

    out = model_dir / out_subdir
    out.mkdir(parents=True, exist_ok=True)
    ctx.starter.write(out / starter_path.name)
    ctx.engine.write(out / engine_path.name)
    diff = "\n".join(d for d in (ctx.starter.diff(after=out_subdir),
                                 ctx.engine.diff(after=out_subdir)) if d)
    (out / "deck.diff").write_text(diff + "\n", encoding="utf-8")
    record = {"model": model["name"], "from": "the original decks",
              "applied": ctx.applied, "not_applied": ctx.not_applied,
              "termination_time": ctx.tstop, "time_unit": ctx.time_unit}
    (out / "edits.json").write_text(json.dumps(record, indent=1), encoding="utf-8")
    return record


__all__ = ["FIXES", "answers_for", "build_v01"]
