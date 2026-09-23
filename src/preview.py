"""Render a still of the model, for the report's first page.

The interactive view is better in every way except one: it is not there until
the page has loaded four megabytes of plotly and a few megabytes of mesh. A
reader should see what the model *is* in the first second, so page one carries
a picture.

Rendered offscreen with matplotlib rather than a headless browser, because that
keeps the dependency list to things already in `requirements.txt` and works the
same on a machine with no GPU and no Chrome.

The camera is not arbitrary: it looks at the model from a direction that puts
the impact between the viewer and the target, with **gravity pointing down the
screen**, so the picture reads as the physical test it represents.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # no display, no Qt, no browser

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from mpl_toolkits.mplot3d.art3d import Poly3DCollection  # noqa: E402

PALETTE = ["#4c9aff", "#ffb454", "#5bc8af", "#ff6b6b", "#b18aff", "#8fd14f",
           "#ff9ecd", "#4ecdc4", "#f4a261", "#7aa2f7", "#e0af68", "#9ece6a",
           "#bb9af7", "#f7768e", "#73daca", "#ff9e64", "#7dcfff", "#c0caf5"]
BG = "#171b21"


def _camera_from_gravity(gravity_dir: np.ndarray | None) -> tuple[float, float]:
    """`(elevation, azimuth)` that puts an oblique gravity down the screen.

    matplotlib's 3D axes always draw +Z up, so the best available answer is to
    pick a viewing azimuth roughly perpendicular to the horizontal part of the
    gravity vector and a modest elevation. When gravity is oblique, as in the
    phone drop, this keeps the falling direction reading downward rather than
    across.
    """
    if gravity_dir is None or not np.any(gravity_dir):
        return 22.0, -60.0
    g = np.asarray(gravity_dir, dtype=float)
    g = g / np.linalg.norm(g)
    azim = np.degrees(np.arctan2(g[1], g[0])) + 90.0
    elev = float(np.clip(20.0 + 30.0 * (-g[2]), 8.0, 55.0))
    return elev, float(azim)


def camera_angles(analysis: dict) -> tuple[float, float]:
    """Where to look from: gravity down the screen, the viewer behind the mover.

    Gravity decides "down" when the deck has it; the direction of travel does
    otherwise. When gravity is along -Z (a car on a road), matplotlib's own up
    is already right, so the viewer stands behind the moving object, a little
    to one side and above it - which is how a pole impact is normally shown,
    with the beam wrapping round the pole across the picture. When gravity is
    oblique (a phone dropped on its corner), the view is turned so the fall
    still reads downward.
    """
    g = (analysis.get("gravity") or {}).get("direction")
    v = (analysis.get("velocity") or {}).get("direction")
    down = np.asarray(g if g else v, dtype=float) if (g or v) else None
    if down is None or not np.any(down):
        return 22.0, -60.0
    down = down / np.linalg.norm(down)
    if down[2] < -0.9:
        azim = -60.0
        if v is not None:
            behind = -np.asarray(v, dtype=float)[:2]
            if np.linalg.norm(behind) > 0.2:
                azim = float(np.degrees(np.arctan2(behind[1], behind[0]))) + 25.0
        return 38.0, azim
    return _camera_from_gravity(down)


def render_model(geometry: dict, analysis: dict, out_path: str | Path,
                 max_triangles: int = 400000, dpi: int = 130) -> Path:
    """Write a PNG of the assembly plus its rigid wall."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    parts = geometry.get("parts", [])
    fig = plt.figure(figsize=(7.2, 4.6), facecolor=BG)
    ax = fig.add_subplot(111, projection="3d", facecolor=BG)

    total = sum(len(p["i"]) for p in parts) or 1
    # Thinning a triangle list by striding does not thin the surface, it
    # shreds it: every other triangle is removed and the part renders as
    # confetti with the parts behind it showing through. So decimation is a
    # last resort for a model far larger than these, and the rule is to drop
    # whole small parts rather than to sample within a part.
    budget = 1 if total <= max_triangles else max(1, int(np.ceil(total / max_triangles)))

    elev, azim = camera_angles(analysis)

    # matplotlib depth-sorts within one collection but not between them, so a
    # screen sitting on a cover can draw through it. Ordering the parts
    # back to front along the view direction fixes the common case.
    view = np.array([
        np.cos(np.radians(elev)) * np.cos(np.radians(azim)),
        np.cos(np.radians(elev)) * np.sin(np.radians(azim)),
        np.sin(np.radians(elev)),
    ])
    def depth(part):
        c = np.array([np.mean(part["x"]), np.mean(part["y"]), np.mean(part["z"])])
        return float(np.dot(c, view))
    ordered = sorted(parts, key=depth)

    for n, part in enumerate(ordered):
        x, y, z = np.array(part["x"]), np.array(part["y"]), np.array(part["z"])
        tris = np.stack([part["i"], part["j"], part["k"]], axis=1)
        if budget > 1:
            tris = tris[::budget]
        if tris.size == 0:
            continue
        verts = np.stack([x[tris], y[tris], z[tris]], axis=-1)
        collection = Poly3DCollection(
            verts, facecolor=PALETTE[parts.index(part) % len(PALETTE)],
            edgecolor="none", linewidths=0, alpha=1.0, zsort="average",
        )
        collection.set_zorder(n + 1)
        ax.add_collection3d(collection)

    wall = geometry.get("rigid_wall") or {}
    if wall.get("x"):
        x, y, z = np.array(wall["x"]), np.array(wall["y"]), np.array(wall["z"])
        tris = np.stack([wall["i"], wall["j"], wall["k"]], axis=1)
        verts = np.stack([x[tris], y[tris], z[tris]], axis=-1)
        ax.add_collection3d(Poly3DCollection(
            verts, facecolor="#8892a0", edgecolor="none", alpha=0.30))

    bbox = geometry.get("bbox") or {}
    if bbox:
        lo = np.array(bbox["min"], dtype=float)
        hi = np.array(bbox["max"], dtype=float)
        centre = (lo + hi) / 2
        reach = float(np.max(hi - lo)) / 2 * 1.15
        ax.set_xlim(centre[0] - reach, centre[0] + reach)
        ax.set_ylim(centre[1] - reach, centre[1] + reach)
        ax.set_zlim(centre[2] - reach, centre[2] + reach)
    try:
        ax.set_box_aspect((1, 1, 1))
    except Exception:  # matplotlib < 3.3
        pass

    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    fig.tight_layout(pad=0.1)
    fig.savefig(out_path, dpi=dpi, facecolor=BG, bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)
    return out_path


__all__ = ["camera_angles", "render_model"]
