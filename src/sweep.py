"""Move one design variable, run each point, collect one row per run.

This is `fixes.py`'s mechanism pointed at a different question. v0.1 changes
settings that were wrong; a sweep changes a design variable on purpose - the
sheet thickness of a crash beam, the impact speed - and records what the
structure does in response. The rows it writes (see `features.py`) are the
shape a surrogate model trains on, and the same shape a tolerance study reads.

Every point starts from a version's decks (v0.1 by default, so the sweep
inherits its fixes - readable results, a safety stop) and is written to
`<model>/sweep/<variable>=<value>/` with its own diff. The originals are never
opened for writing, and a point that has already run is not run again.

    python src/main.py --model Bumper_Beam --sweep thickness_scale=0.8,1.2 --run
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from . import patch_deck as pd
from .features import global_features
from .radioss_deck import parse_deck


def _scale_shell_thickness(starter: pd.Deck, engine: pd.Deck, factor: float) -> None:
    """Every `/PROP/SHELL` thickness times `factor`: the whole structure's gauge."""
    deck = parse_deck(starter.path)
    for card in deck.cards:
        if card.keyword.startswith("/PROP/SHELL/") and card.fields.get("Thick"):
            pd.set_shell_thickness(starter, card.id, round(float(card.fields["Thick"]) * factor, 4),
                                   reason=f"thickness x{factor:g}")


def _scale_speed(starter: pd.Deck, engine: pd.Deck, factor: float) -> None:
    """The `/INIVEL` vector times `factor`: same direction, different speed."""
    deck = parse_deck(starter.path)
    card = next(c for c in deck.cards if c.keyword.startswith("/INIVEL"))
    vector = [round(float(card.fields.get(k) or 0.0) * factor, 6) for k in ("Vx", "Vy", "Vz")]
    pd.set_initial_velocity(starter, vector, reason=f"speed x{factor:g}")


VARIABLES: dict[str, tuple[str, Callable]] = {
    "thickness_scale": ("every sheet thickness, as a multiple of the original", _scale_shell_thickness),
    "speed_scale": ("the impact speed, as a multiple of the original", _scale_speed),
}


def point_name(variable: str, value: float) -> str:
    return f"{variable}={value:g}"


def build_point(model_dir: str | Path, variable: str, value: float,
                base: str = "v0.1") -> Path:
    """Write one sweep point's decks and diff; return its folder."""
    model_dir = Path(model_dir)
    source = model_dir / base if any((model_dir / base).glob("*_0000.rad")) else model_dir
    starter = pd.Deck.read(next(source.glob("*_0000.rad")))
    engine = pd.Deck.read(next(source.glob("*_0001.rad")))
    VARIABLES[variable][1](starter, engine, value)
    out = model_dir / "sweep" / point_name(variable, value)
    out.mkdir(parents=True, exist_ok=True)
    starter.write(out / starter.path.name)
    engine.write(out / engine.path.name)
    (out / "deck.diff").write_text(
        "\n".join(d for d in (starter.diff(base, point_name(variable, value)),
                              engine.diff(base, point_name(variable, value))) if d) + "\n",
        encoding="utf-8")
    (out / "point.json").write_text(json.dumps(
        {"variable": variable, "value": value, "base": base,
         "meaning": VARIABLES[variable][0], "edits": [e.what for e in starter.edits + engine.edits]},
        indent=1), encoding="utf-8")
    return out


def _field_peaks(point_dir: Path, node_ids, stress_to_mpa: float) -> dict:
    """Peak stress, stretch and movement of one point, from its snapshots.

    No pictures: a sweep needs the numbers, and converting a dozen frames is
    enough to find the peaks of a smooth event. Cached next to the run.
    """
    import numpy as np
    from .animate import extract, frames_of, load_extract, save_extract

    cache = point_dir / "fields.npz"
    data = load_extract(cache)
    if data is None:
        if not frames_of(point_dir) or not node_ids:
            return {}
        n = len(frames_of(point_dir))
        data = extract(point_dir, node_ids, every=max(1, n // 12))
        save_extract(data, cache)
    out = {"peak_displacement_mm": float(np.linalg.norm(
        data["coords"] - data["coords"][0], axis=2).max())}
    if data.get("von_mises") is not None:
        out["peak_von_mises_MPa"] = float(data["von_mises"].max()) * stress_to_mpa
    if data.get("plastic_strain") is not None:
        out["peak_plastic_strain"] = float(data["plastic_strain"].max())
    return out


def collect(model_dir: str | Path, variable: str, values: list[float],
            base_model: dict | None = None, node_ids=None) -> dict:
    """Analyse every point that has run, plus the base as value 1, into one table."""
    from .analyze import analyze_model
    from .features import STRESS_TO_MPA

    model_dir = Path(model_dir)
    rows = []
    if base_model is not None:
        rows.append(dict(global_features(base_model), variable=variable, value=1.0,
                         point=base_model.get("version", "base")))
    for value in values:
        sub = f"sweep/{point_name(variable, value)}"
        if not any((model_dir / sub).glob("*_0001.out")):
            continue
        m = analyze_model(model_dir, run_subdir=sub)
        row = dict(global_features(m), variable=variable, value=value, point=sub)
        row.update(_field_peaks(model_dir / sub, node_ids,
                                STRESS_TO_MPA.get(m["units"]["derived"]["stress"], 1.0)))
        rows.append(row)
    rows.sort(key=lambda r: r["value"])
    table = {"variable": variable, "meaning": VARIABLES[variable][0], "rows": rows}
    out = model_dir / "sweep" / f"{variable}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(table, indent=1), encoding="utf-8")
    return table


def parse_spec(spec: str) -> tuple[str, list[float]]:
    """`thickness_scale=0.8,1.2` -> ('thickness_scale', [0.8, 1.2])."""
    name, _, values = spec.partition("=")
    name = name.strip()
    if name not in VARIABLES:
        raise ValueError(f"unknown sweep variable {name!r}; known: {', '.join(VARIABLES)}")
    return name, [float(v) for v in values.split(",") if v.strip()]


__all__ = ["VARIABLES", "build_point", "collect", "parse_spec", "point_name"]
