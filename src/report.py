"""Build the interactive report.

One entry point, several files, all of it working from `file://` with no
server and no network:

    index.html                      the entry point, and the only HTML to open
    assets/plotly.min.js            embedded once, shared by both models
    assets/app.js, assets/app.css   the viewer and the stepper
    <Model>/report/data.js          that model's analysis, as a script tag

Why `data.js` and not `data.json`: a page opened from `file://` cannot `fetch`
a sibling file - the browser treats every local file as its own origin - but it
can always load a `<script src>`. So each model's data assigns itself onto a
global, and the page works when it is double-clicked out of a zip, and served
as a static site (GitHub Pages) without a change.

Geometry is emitted per part so the viewer can switch a part off without
re-uploading the rest, and coordinates are rounded to 0.001 mm, which is three
orders finer than the smallest element in either model and roughly halves the
file.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import plotly.offline as pyo

from .analyze import _jsonable
from .geometry import part_surface, to_mesh
from .radioss_deck import parse_deck

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def _part_geometry(model_dir: Path, max_triangles_per_part: int = 60000) -> dict[str, Any]:
    """Per-part drawable surfaces, decimated only where a part is enormous."""
    starter = next(iter(sorted(model_dir.glob("*_0000.rad"))))
    deck = parse_deck(starter)
    parts = []
    for pid, part in deck.parts.items():
        tris = part_surface(deck, pid)
        decimated = False
        if tris.shape[0] > max_triangles_per_part:
            step = int(np.ceil(tris.shape[0] / max_triangles_per_part))
            tris = tris[::step]
            decimated = True
        verts, faces = to_mesh(deck, tris)
        if verts.size == 0:
            continue
        parts.append({
            "id": pid,
            "title": part.title,
            # The node ids behind the vertex list, so an animation frame can
            # swap in new coordinates without re-deriving the connectivity.
            "node_ids": np.unique(tris).tolist(),
            "x": np.round(verts[:, 0], 3).tolist(),
            "y": np.round(verts[:, 1], 3).tolist(),
            "z": np.round(verts[:, 2], 3).tolist(),
            "i": faces[:, 0].tolist(),
            "j": faces[:, 1].tolist(),
            "k": faces[:, 2].tolist(),
            "decimated": decimated,
        })
    out: dict[str, Any] = {"parts": parts, "bbox": deck.bounding_box()}

    # The impactor is not part of the mesh - it is an analytical surface - so
    # it has to be drawn from its card or the reader sees a phone falling
    # toward nothing.
    wall = next((c for c in deck.cards if c.family == "RWALL"), None)
    if wall is not None:
        out["rigid_wall"] = _wall_geometry(wall, deck.bounding_box())
    return out


def _wall_geometry(card, bbox: dict) -> dict[str, Any]:
    """Draw the rigid wall: a finite patch of the plane, or the pole cylinder."""
    f = card.fields
    origin = np.array([f.get(k) or 0.0 for k in ("XM", "YM", "ZM")], dtype=float)
    second = np.array([f.get(k) or 0.0 for k in ("X_M1", "Y_M1", "Z_M1")], dtype=float)
    size = np.array(bbox.get("size", [100, 100, 100]), dtype=float)
    span = float(np.linalg.norm(size)) * 0.6

    if card.subtype == "PLANE":
        normal = second - origin
        n = np.linalg.norm(normal)
        if n == 0:
            return {}
        normal = normal / n
        helper = np.array([1.0, 0.0, 0.0])
        if abs(np.dot(helper, normal)) > 0.9:
            helper = np.array([0.0, 1.0, 0.0])
        u = np.cross(normal, helper)
        u /= np.linalg.norm(u)
        v = np.cross(normal, u)
        corners = np.array([
            origin + span * (a * u + b * v)
            for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))
        ])
        return {
            "kind": "plane",
            "x": corners[:, 0].round(3).tolist(),
            "y": corners[:, 1].round(3).tolist(),
            "z": corners[:, 2].round(3).tolist(),
            "i": [0, 0], "j": [1, 2], "k": [2, 3],
            "normal": normal.round(6).tolist(),
        }

    if card.subtype == "CYL":
        radius = (f.get("Diameter") or 0.0) / 2.0
        axis = second - origin
        n = np.linalg.norm(axis)
        if n == 0 or radius == 0:
            return {}
        axis = axis / n
        helper = np.array([0.0, 0.0, 1.0])
        if abs(np.dot(helper, axis)) > 0.9:
            helper = np.array([1.0, 0.0, 0.0])
        u = np.cross(axis, helper)
        u /= np.linalg.norm(u)
        v = np.cross(axis, u)
        half = span
        angles = np.linspace(0, 2 * np.pi, 48, endpoint=False)
        ring = np.array([radius * (np.cos(a) * u + np.sin(a) * v) for a in angles])
        lo = origin - half * axis + ring
        hi = origin + half * axis + ring
        verts = np.vstack([lo, hi])
        m = len(angles)
        faces = []
        for a in range(m):
            b = (a + 1) % m
            faces.append((a, b, m + a))
            faces.append((b, m + b, m + a))
        faces = np.array(faces)
        return {
            "kind": "cylinder",
            "x": verts[:, 0].round(3).tolist(),
            "y": verts[:, 1].round(3).tolist(),
            "z": verts[:, 2].round(3).tolist(),
            "i": faces[:, 0].tolist(),
            "j": faces[:, 1].tolist(),
            "k": faces[:, 2].tolist(),
            "radius": radius,
        }
    return {}


def _attach_field_results(model: dict, geometry: dict, model_dir: Path,
                          version: str = "v0") -> None:
    """Fold one run's field results into the per-part table and the media list.

    The full per-node history is tens of megabytes and the report would have to
    carry all of it to animate in the browser. A few numbers per part carry
    most of the meaning - the peak stress it ever sees and when, the peak
    plastic strain, how far it moved - so those go in the table and become
    colour-by modes, while the motion itself is the rendered video, which is a
    tenth of a megabyte.
    """
    media = model_dir / "media"
    caches = sorted(media.glob(f"frames_{version}_every*.npz"))
    video = media / f"{model_dir.name}_{version}.mp4"
    stills = sorted(media.glob(f"still_{version}_*.png"))
    model["media"] = {
        "video": f"{model_dir.name}/media/{video.name}" if video.exists() else None,
        "preview": f"{model_dir.name}/media/preview.png",
        "stills": [{"file": f"{model_dir.name}/media/{p.name}",
                    "label": p.stem.split(f"still_{version}_", 1)[-1].lstrip("0123456789_")
                                  .replace("_", " ")}
                   for p in stills],
    }
    if not caches:
        _reuse_field_results(model, model_dir, version)
        return
    try:
        from .animate import load_extract
        data = load_extract(caches[0])
    except Exception:
        return
    if not data or data.get("von_mises") is None:
        return

    vm = data["von_mises"]                      # (frames, surface nodes)
    ep = data.get("plastic_strain")
    coords = data["coords"]
    disp = np.linalg.norm(coords - coords[0], axis=2)   # frame 0 is t = 0
    order = {int(n): i for i, n in enumerate(data["node_ids"])}
    peak_all = vm.max(axis=0)
    by_part = {}
    for part in geometry.get("parts", []):
        rows = [order[int(n)] for n in part.get("node_ids", []) if int(n) in order]
        if not rows:
            continue
        frame = int(vm[:, rows].max(axis=1).argmax())
        entry = {
            "peak_von_mises": float(peak_all[rows].max()),
            "peak_time": float(data["time"][frame]),
            "peak_displacement": float(disp[:, rows].max()),
        }
        if ep is not None:
            entry["peak_plastic_strain"] = float(ep[:, rows].max())
        by_part[part["id"]] = entry
    for row in model.get("assembly", []):
        row.update(by_part.get(row["id"], {}))
    model["field_results"] = {
        "source": caches[0].name,
        "n_frames": int(data["n_frames"]),
        "t_first": float(data["time"][0]),
        "t_last": float(data["time"][-1]),
        "peak_von_mises": float(peak_all.max()),
        "peak_plastic_strain": float(ep.max()) if ep is not None else None,
        "peak_displacement": float(disp.max()),
        "unit": model["units"]["derived"]["stress"],
        "stress_source": ("nodal stress tensor (/ANIM/GPS/TENS)" if model["name"] and
                          "GPS" in " ".join(c["keyword"] for c in model["engine"]["card_list"])
                          else "element von Mises (/ANIM/ELEM/VONM), worst element at each node"),
    }


FIELD_KEYS = ("peak_von_mises", "peak_time", "peak_displacement", "peak_plastic_strain")


def _reuse_field_results(model: dict, model_dir: Path, version: str) -> None:
    """Without the frame cache, keep the numbers the last build derived from it.

    The caches are 5 to 26 MB of floats that barely compress, so a slim copy
    leaves them out. The per-part peaks they produced are already in the
    previous `model.json`; carrying them over keeps a rebuild lossless.
    """
    import json

    old = model_dir / "report" / ("model.json" if version == "v0" else f"model_{version}.json")
    if not old.exists():
        return
    try:
        prev = json.loads(old.read_text(encoding="utf-8"))
    except Exception:
        return
    if not prev.get("field_results"):
        return
    model["field_results"] = prev["field_results"]
    by_id = {r["id"]: r for r in prev.get("assembly", [])}
    for row in model.get("assembly", []):
        row.update({k: by_id[row["id"]][k] for k in FIELD_KEYS if k in by_id.get(row["id"], {})})


def model_geometry(model_dir: str | Path) -> dict[str, Any]:
    """The drawable surfaces of a model; computed once and shared by every version."""
    return _part_geometry(Path(model_dir))


def write_model_data(model: dict, model_dir: str | Path, geometry: dict | None = None,
                     version: str = "v0") -> Path:
    """Emit the data file the report loads for one model and one version.

    v0 carries the geometry (`report/data.js`); later versions carry only their
    analysis (`report/data_v0.1.js`), because patching a deck does not move a
    node and the mesh is the heavy part.
    """
    model_dir = Path(model_dir)
    out_dir = model_dir / "report"
    out_dir.mkdir(parents=True, exist_ok=True)
    geometry = geometry if geometry is not None else _part_geometry(model_dir)
    _attach_field_results(model, geometry, model_dir, version)
    name = json.dumps(model["name"])
    if version == "v0":
        # A still, so page one shows what the model is before plotly has loaded.
        try:
            from .preview import render_model
            render_model(geometry, model, model_dir / "media" / "preview.png")
            model = dict(model, preview=f"{model_dir.name}/media/preview.png")
        except Exception as exc:  # a missing backend must not cost us the report
            model = dict(model, preview=None, preview_error=f"{type(exc).__name__}: {exc}")
        payload = {"analysis": _jsonable(model), "geometry": geometry}
        js = ("window.RADIOSS = window.RADIOSS || {};\n"
              f"window.RADIOSS[{name}] = " + json.dumps(payload, separators=(",", ":")) + ";\n")
        path = out_dir / "data.js"
    else:
        model = dict(model, preview=f"{model_dir.name}/media/preview.png")
        js = ("window.RADIOSS_VERSIONS = window.RADIOSS_VERSIONS || {};\n"
              f"window.RADIOSS_VERSIONS[{name}] = window.RADIOSS_VERSIONS[{name}] || {{}};\n"
              f"window.RADIOSS_VERSIONS[{name}][{json.dumps(version)}] = "
              + json.dumps({"analysis": _jsonable(model)}, separators=(",", ":")) + ";\n")
        path = out_dir / f"data_{version}.js"
    path.write_text(js, encoding="utf-8")
    return path


def write_assets(root: str | Path) -> None:
    """Copy plotly and the app's own js/css next to the entry point."""
    assets = Path(root) / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "plotly.min.js").write_text(pyo.get_plotlyjs(), encoding="utf-8")
    for name in ("app.css", "app.js"):
        src = HERE / "web" / name
        if src.exists():
            shutil.copyfile(src, assets / name)


def write_index(root: str | Path, model_names: list[str], version: str = "v0") -> Path:
    """Write the single entry point that loads every model's data, every version."""
    root = Path(root)
    template = (HERE / "web" / "index.html").read_text(encoding="utf-8")
    files = []
    for name in model_names:
        files.append(f"{name}/report/data.js")
        files += [f"{name}/report/{p.name}"
                  for p in sorted((root / name / "report").glob("data_v*.js"))]
    scripts = "\n".join(f'<script src="{f}"></script>' for f in files)
    html = (
        template.replace("<!--MODEL_SCRIPTS-->", scripts)
        .replace("__MODEL_NAMES__", json.dumps(model_names))
        .replace("__VERSION__", json.dumps(version))
    )
    path = root / "index.html"
    path.write_text(html, encoding="utf-8")
    return path


__all__ = ["model_geometry", "write_assets", "write_index", "write_model_data"]
