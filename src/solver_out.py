"""Read what the solver said about the model, and about the run.

Two listings, two very different jobs:

* ``<Run>_0000.out`` is the **Starter**'s verdict on the *model*: counts, per
  part mass and inertia, the time-step tables, the warning summary. It is
  produced without solving anything, so it is available for a deck that has
  never been run, and it is an independent check on everything the parser
  claims.
* ``<Run>_0001.out`` is the **Engine**'s record of the *run*: one line per
  hundred cycles carrying the energy balance and the added mass. This is where
  a run's quality actually lives; `NORMAL TERMINATION` says nothing about it.

Both are parsed leniently. A missing section returns an empty result rather
than raising, because a deck that has only been Started still has half of this
and the report should show that half.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pandas as pd

CYCLE_HEADER = re.compile(
    r"^\s*CYCLE\s+TIME\s+TIME-STEP\s+ELEMENT\s+ERROR\s+I-ENERGY", re.M
)
CYCLE_ROW = re.compile(
    r"^\s*(\d+)\s+([\d.E+-]+)\s+([\d.E+-]+)\s+(\S+)\s+(\d+)\s+(-?[\d.]+)%\s+"
    r"([\d.E+-]+)\s+([\d.E+-]+)\s+([\d.E+-]+)\s+(-?[\d.E+-]+)\s+(-?[\d.E+-]+)\s+"
    r"([\d.E+-]+)\s+([\d.E+-]+)\s*$"
)
COLUMNS = [
    "cycle", "time", "time_step", "controlling_kind", "controlling_id", "error_pct",
    "internal_energy", "kinetic_energy_t", "kinetic_energy_r", "external_work",
    "mass_error", "total_mass", "mass_added",
]


def parse_starter_out(path: str | Path) -> dict[str, Any]:
    """Counts, masses, time steps and the warning summary from the Starter."""
    path = Path(path)
    if not path.exists():
        return {}
    text = path.read_text(encoding="latin-1", errors="replace")
    out: dict[str, Any] = {"file": path.name}

    counts = {}
    for label, key in [
        ("NUMNOD", "nodes"), ("NPART", "parts"), ("NUMMAT", "materials"),
        ("NUMGEO", "properties"), ("NUMELC", "shells_4n"), ("NUMELTG", "shells_3n"),
        ("NUMELS", "solids"), ("NUMELR", "springs"), ("NINTER", "interfaces"),
        ("NRWALL", "rigid_walls"), ("NRBODY", "rigid_bodies"),
    ]:
        # The listing pads its labels with dot-space leaders:
        #     NUMNOD: NUMBER OF NODAL POINTS. . . . . . . . .     13832
        m = re.search(rf"^\s*{label}\s*:[^\n]*?[.\s]{{4,}}(-?\d+)\s*$", text, re.M)
        if m:
            counts[key] = int(m.group(1))
    out["counts"] = counts

    m = re.search(
        r"TOTAL MASS AND MASS CENTER\s*\n\s*-+\s*\n[^\n]*\n\s*\n?"
        r"\s*([\d.E+-]+)\s+([\d.E+-]+)\s+([\d.E+-]+)\s+([\d.E+-]+)", text
    )
    if m:
        out["total_mass"] = float(m.group(1))
        out["mass_center"] = [float(m.group(i)) for i in (2, 3, 4)]

    masses = {}
    for blk in re.finditer(r"PART :\s+(\d+),\s*(\S[^\n]*?)\s*\n[^\n]*\n\s*([\d.E+-]+)\s", text):
        masses[int(blk.group(1))] = float(blk.group(3))
    out["part_mass"] = masses

    warnings = []
    for w in re.finditer(r"WARNING ID :\s*(\d+)\s*\n(\*\*[^\n]*)", text):
        warnings.append({"id": int(w.group(1)), "text": w.group(2).strip()})
    seen, uniq = set(), []
    for w in warnings:
        if w["id"] not in seen:
            seen.add(w["id"])
            uniq.append(w)
    out["warnings"] = uniq
    # The per-section boxes print their own "n WARNING(S)" counts before the
    # final tally, so take the LAST occurrence, which is the run total.
    errs = re.findall(r"(\d+)\s+ERROR\(S\)", text)
    out["n_errors"] = int(errs[-1]) if errs else None
    warns = re.findall(r"(\d+)\s+WARNING\(S\)", text)
    out["n_warnings"] = int(warns[-1]) if warns else None

    m = re.search(
        r"THERE ARE (\d+) INITIAL PENETRATIONS\s*\n\s*\(\s*CONCERNING\s+(\d+) NODES", text
    )
    if m:
        iface = re.search(r"-- INTERFACE ID:\s*(\d+)", text)
        out["initial_penetrations"] = {
            "count": int(m.group(1)),
            "nodes": int(m.group(2)),
            "interface": int(iface.group(1)) if iface else None,
            "source": path.name,
        }

    m = re.search(r"(\d+) NODES HAVE BEEN REMOVED FROM RWALL", text)
    if m:
        out["rwall_nodes_removed"] = int(m.group(1))

    for label, key in [
        ("SHELL ELEMENTS TIME STEP", "shell_dt"),
        ("SOLID ELEMENTS TIME STEP", "solid_dt"),
        ("NODAL TIME STEP \\(estimation\\)", "nodal_dt"),
    ]:
        m = re.search(rf"{label}\s*\n\s*-+\s*\n\s*\n?\s*TIME STEP[^\n]*\n\s*([\d.E+-]+)", text)
        if m:
            out[key] = float(m.group(1))
    return out


def parse_engine_out(path: str | Path) -> dict[str, Any]:
    """The cycle table and the run's verdict."""
    path = Path(path)
    if not path.exists():
        return {}
    text = path.read_text(encoding="latin-1", errors="replace")
    rows = []
    for line in text.splitlines():
        m = CYCLE_ROW.match(line)
        if m:
            g = m.groups()
            rows.append([
                int(g[0]), float(g[1]), float(g[2]), g[3], int(g[4]), float(g[5]),
                float(g[6]), float(g[7]), float(g[8]), float(g[9]), float(g[10]),
                float(g[11]), float(g[12]),
            ])
    df = pd.DataFrame(rows, columns=COLUMNS) if rows else pd.DataFrame(columns=COLUMNS)
    out: dict[str, Any] = {"file": path.name, "cycles": df}
    out["normal_termination"] = "NORMAL TERMINATION" in text
    m = re.search(r"ELAPSED TIME\s*=\s*([\d.]+)\s*s", text)
    out["elapsed_s"] = float(m.group(1)) if m else None
    out["n_animation_files"] = len(re.findall(r"ANIMATION FILE:.*WRITTEN", text))

    if not df.empty:
        first, last = df.iloc[0], df.iloc[-1]
        ke = df.kinetic_energy_t + df.kinetic_energy_r
        ke0 = float(ke.iloc[0])
        ke1 = float(ke.iloc[-1])
        i_min = int(ke.values.argmin())
        ke_min = float(ke.iloc[i_min])
        t_end = float(last.time)
        t_min = float(df.time.iloc[i_min])
        out.update({
            "t_end": t_end,
            "n_cycles": int(last.cycle),
            "ke_first": ke0,
            "ke_last": ke1,
            "ie_last": float(last.internal_energy),
            "ie_max": float(df.internal_energy.max()),
            "external_work_last": float(last.external_work),
            # How much of the arriving energy has been turned into deformation.
            "ke_converted_fraction": (float(last.internal_energy) / ke0) if ke0 else None,
            # How much motion energy the impact took out, at the slowest moment.
            # Deformation is only part of it: a rigid wall stops the points
            # that hit it outright, and the solver books that as external
            # work - in the phone drop, more than the phone itself absorbs.
            "ke_min": ke_min,
            "t_ke_min": t_min,
            "ke_removed_fraction": (1.0 - ke_min / ke0) if ke0 else None,
            # With elastic parts the energy comes back: the object bounces.
            # A minimum of kinetic energy well before the end, followed by a
            # rise, means the impact itself is over.
            "rebound": bool(ke1 > ke_min * 1.05 and t_min < 0.9 * t_end),
            # Stopped: at most 2 % of the motion energy left, i.e. under ~14 %
            # of the starting speed. 90 % is not enough - the thin-bumper sweep
            # point had 92 % taken out and was still doing 1.4 m/s at the end.
            "stopped": bool(ke0 and ke_min / ke0 <= 0.02),
            "impact_over": bool((ke1 > ke_min * 1.05 and t_min < 0.9 * t_end)
                                or (ke0 and ke_min / ke0 <= 0.02)),
            "energy_split_end": {
                "motion": ke1 / ke0 if ke0 else None,
                "deformation": float(last.internal_energy) / ke0 if ke0 else None,
                "walls_and_contact": -float(last.external_work) / ke0 if ke0 else None,
            },
            "energy_error_max_pct": float(df.error_pct.abs().max()),
            "mass_error_final": float(last.mass_error),
            "mass_added_final": float(last.mass_added),
            "total_mass_final": float(last.total_mass),
            "time_step": float(last.time_step),
        })
    return out


# Global channels of the T01 file, named by th_to_csv whether or not the run
# wrote /TH/TITLE. The ones the listing's ERROR column does not count are the
# ones that explain a drifting energy balance.
GLOBAL_ENERGIES = {
    "INTERNAL ENERGY": "internal", "KINETIC ENERGY": "kinetic", "EXTERNAL WORK": "external_work",
    "CONTACT ENERGY": "contact", "HOURGLASS ENERGY": "hourglass",
    "FRICTIONAL CONTACT ENERGY": "friction", "DAMPING CONTACT ENERGY": "contact_damping",
    "ELASTIC CONTACT ENERGY": "contact_elastic", "PLASTIC WORK": "plastic_work",
    "SPRING ENERGY": "spring",
}


def time_history_csv(run_dir: str | Path) -> Path | None:
    """`<Run>T01.csv`, converted with the solver's own th_to_csv and cached.

    The CSV is kept next to the run, so a report built later on a machine
    without OpenRadioss still reads it.
    """
    run_dir = Path(run_dir)
    t01 = next((p for p in sorted(run_dir.glob("*T01")) if p.is_file()), None)
    if t01 is None:
        return None
    csv = t01.with_name(t01.name + ".csv")
    if csv.exists() and csv.stat().st_mtime >= t01.stat().st_mtime:
        return csv
    try:
        import subprocess
        from .solver import executable, find_openradioss
        root = find_openradioss()
        if root is None:
            return csv if csv.exists() else None
        subprocess.run([str(executable(root, "th_to_csv")), t01.name], cwd=run_dir,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
    except Exception:
        pass
    return csv if csv.exists() else None


def read_energy_sources(run_dir: str | Path) -> dict[str, Any] | None:
    """Where the energy went, from the T01 global channels, plus per-part energy.

    Answers two questions the listing cannot: does the energy balance close
    once friction, contact damping and hourglass energy are counted, and which
    component absorbs the blow (when the deck asks for /TH/PART).
    """
    csv = time_history_csv(run_dir)
    if csv is None:
        return None
    df = pd.read_csv(csv, encoding="latin-1")      # th_to_csv pads titles with 0xA0
    df.columns = [str(c).strip() for c in df.columns]
    if len(df) < 3 or "KINETIC ENERGY" not in df:
        return None
    series = {key: df[name] for name, key in GLOBAL_ENERGIES.items() if name in df}
    ke0 = float(series["kinetic"].iloc[0])
    if not ke0:
        return None
    end = {k: float(v.iloc[-1]) for k, v in series.items()}
    raw = end["internal"] + end["kinetic"] - ke0 - end.get("external_work", 0.0)
    uncounted = end.get("contact", 0.0) + end.get("hourglass", 0.0)
    ie = series["internal"]
    # Hourglass energy against deformation energy, where there is enough of
    # the latter to divide by. The usual acceptance limit is 10 %.
    mask = ie > 0.05 * ke0
    hg_ratio = (float((series["hourglass"][mask] / ie[mask]).max())
                if "hourglass" in series and mask.any() else None)
    out: dict[str, Any] = {
        "file": csv.name,
        "fractions_end": {k: end[k] / ke0 for k in
                          ("friction", "hourglass", "contact_damping", "contact_elastic", "plastic_work")
                          if k in end},
        "balance_raw_pct": 100 * raw / ke0,
        "balance_closed_pct": 100 * (raw + uncounted) / ke0,
        "hourglass_to_internal_max": hg_ratio,
        "hourglass_to_internal_end": (end["hourglass"] / end["internal"]
                                      if end.get("internal") and "hourglass" in end else None),
        "history": {"time": df["time"].tolist(),
                    **{k: series[k].tolist() for k in ("friction", "hourglass", "contact", "plastic_work")
                       if k in series}},
    }
    # Per-part energies: columns named "<part title>  IE" when /TH/PART is present.
    parts = {}
    for col in df.columns:
        if col.endswith(" IE") and col not in GLOBAL_ENERGIES:
            parts[col[:-3].strip()] = {"ie_max": float(df[col].max()), "ie_end": float(df[col].iloc[-1])}
    if parts:
        total = sum(p["ie_max"] for p in parts.values()) or 1.0
        for p in parts.values():
            p["share_of_peaks"] = p["ie_max"] / total
        out["parts"] = dict(sorted(parts.items(), key=lambda kv: -kv[1]["ie_max"]))
    return out


def find_run(model_dir: str | Path, subdir: str = "v0") -> dict[str, Any]:
    """Locate and read whatever solver output exists for a model."""
    base = Path(model_dir) / subdir
    if not base.exists():
        return {}
    starter = next(iter(sorted(base.glob("*_0000.out"))), None)
    engine = next(iter(sorted(base.glob("*_0001.out"))), None)
    # Deliberately relative: only the project folder ships, so an absolute
    # path here would name directories the reader does not have and cannot use.
    run: dict[str, Any] = {"dir": f"{Path(model_dir).name}/{subdir}"}
    if starter:
        run["starter"] = parse_starter_out(starter)
        run["initial_penetrations"] = run["starter"].get("initial_penetrations")
    if engine:
        eng = parse_engine_out(engine)
        run["engine_out_file"] = eng.get("file")
        for k in ("normal_termination", "elapsed_s", "n_cycles", "t_end", "ke_first",
                  "ke_last", "ie_last", "ie_max", "external_work_last",
                  "ke_converted_fraction", "ke_min", "t_ke_min", "ke_removed_fraction",
                  "rebound", "stopped", "impact_over", "energy_split_end", "energy_error_max_pct",
                  "mass_error_final", "mass_added_final", "total_mass_final",
                  "n_animation_files"):
            run[k] = eng.get(k)
        run["cycles"] = eng.get("cycles")
    # Counted from the Engine listing ("ANIMATION FILE: ... WRITTEN"), which
    # ships, rather than from the frame files, which a slim copy leaves out.
    on_disk = len(list(base.glob("*A[0-9][0-9][0-9]")))
    run["animation_files"] = max(run.get("n_animation_files") or 0, on_disk)
    if engine and run.get("normal_termination") is not None:
        try:
            run["energy_sources"] = read_energy_sources(base)
        except Exception as exc:  # a curve file we cannot read must not cost the report
            run["energy_sources_error"] = f"{type(exc).__name__}: {exc}"
    return run


__all__ = ["find_run", "parse_engine_out", "parse_starter_out", "read_energy_sources",
           "time_history_csv"]
