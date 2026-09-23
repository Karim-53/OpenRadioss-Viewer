"""One row of numbers per run: what a surrogate model would learn from.

A crash surrogate maps design variables (thickness, speed, geometry) to
outcomes (energy absorbed, peak stress, how far it crushed). This module writes
both sides, per run, in SI-friendly units, so any number of runs - v0, v0.1,
every point of a sweep - stack into one table.

Two models are not a dataset. The bumper and the phone share no design
variable, no material and no failure mode, so nothing learned on one says
anything about the other. What makes a dataset is many runs of the *same*
model with its variables moved - which is what `sweep.py` produces, and why
these rows carry the variables and the outcomes side by side.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

MASS_TO_KG = {"Mg": 1e3, "kg": 1.0, "g": 1e-3, "t": 1e3}
TIME_TO_S = {"s": 1.0, "ms": 1e-3, "us": 1e-6}
STRESS_TO_MPA = {"MPa": 1.0, "GPa": 1e3, "kPa": 1e-3, "Pa": 1e-6}


def global_features(model: dict) -> dict[str, Any]:
    """Design variables and outcomes of one analysed run, as flat scalars."""
    units = model["units"]
    mass_k = MASS_TO_KG.get(units["work"][0], 1.0)
    time_k = TIME_TO_S.get(units["work"][2], 1.0)
    stress_k = STRESS_TO_MPA.get(units["derived"]["stress"], 1.0)
    s = model.get("scenario") or {}
    r = model.get("run") or {}
    fr = model.get("field_results") or {}
    split = r.get("energy_split_end") or {}
    shells = [p["thickness_mm"] for p in model.get("assembly", [])
              if p.get("is_shell") and p.get("thickness_mm")]
    row: dict[str, Any] = {
        "model": model["name"],
        "version": model.get("version", "v0"),
        # --- inputs: what a design study would vary
        "mass_kg": (s.get("total_mass_deck") or 0) * mass_k,
        "impact_speed_m_s": s.get("impact_speed_ms"),
        "impact_energy_J": s.get("kinetic_energy_J"),
        "shell_thickness_mean_mm": sum(shells) / len(shells) if shells else None,
        "impactor_diameter_mm": (model.get("rigid_wall") or {}).get("diameter") or None,
        "simulated_time_s": (s.get("termination") or 0) * time_k,
        "n_elements": sum(model["starter"]["counts"]["elements"].values()),
        "n_parts": len(model.get("assembly", [])),
        # --- outcomes: what a surrogate would predict
        "energy_taken_out_fraction": r.get("ke_removed_fraction"),
        "impact_over": r.get("impact_over"),
        "deformation_energy_fraction_end": split.get("deformation"),
        "wall_energy_fraction_end": split.get("walls_and_contact"),
        "time_of_slowest_moment_s": (r["t_ke_min"] * time_k) if r.get("t_ke_min") is not None else None,
        "peak_von_mises_MPa": (fr["peak_von_mises"] * stress_k) if fr.get("peak_von_mises") else None,
        "peak_plastic_strain": fr.get("peak_plastic_strain"),
        "peak_displacement_mm": fr.get("peak_displacement"),
        "friction_energy_fraction": ((r.get("energy_sources") or {}).get("fractions_end") or {}).get("friction"),
        "hourglass_to_internal_max": (r.get("energy_sources") or {}).get("hourglass_to_internal_max"),
        # --- run quality: rows to drop before training
        "energy_error_max_pct": r.get("energy_error_max_pct"),
        "added_mass_pct": (r["mass_error_final"] * 100) if r.get("mass_error_final") is not None else None,
        "normal_termination": r.get("normal_termination"),
        "cycles": r.get("n_cycles"),
        "compute_s": r.get("elapsed_s"),
    }
    return row


def write_global_features(model_dir: str | Path, by_version: dict[str, dict]) -> Path:
    """`<model>/report/global_features.json`: one row per version."""
    out = Path(model_dir) / "report" / "global_features.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    rows = {v: global_features(m) for v, m in by_version.items()}
    out.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    return out


__all__ = ["global_features", "write_global_features"]
