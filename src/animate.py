"""Turn the solver's animation files into stills, a video, and field data.

OpenRadioss writes one binary `<Run>A001, A002, ...` file per saved frame, and
ships `anim_to_vtk` to convert each one to a legacy ASCII VTK. That conversion
is the only open route to the field results: the `.h3d` container the other
deck uses has no open-source reader at all.

The conversion is also expensive - about 16 s and 40 MB of text per frame for a
257 k-node model - so nothing is kept that is not needed. Each frame is
converted, reduced to the few arrays the report and the video actually use, and
the VTK is deleted before the next frame starts. A hundred frames therefore
cost a few tens of megabytes instead of four gigabytes.

What survives per frame:

* the deformed coordinates of the **surface** nodes only, because interior
  nodes of a solid mesh are never drawn;
* von Mises stress per surface node - from the nodal stress tensor when the
  deck asks for `/ANIM/GPS/TENS` (the phone), otherwise from the per-element
  value `/ANIM/ELEM/VONM` writes (the bumper's shells), taking at each node the
  worst element that touches it;
* plastic strain per surface node the same way, when `/ANIM/ELEM/EPSP` is
  saved.
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable

import numpy as np


def anim_to_vtk_exe(openradioss_path: str | Path | None = None) -> Path:
    """Locate the converter shipped with the solver (found the way `solver.py` finds it)."""
    from .solver import find_openradioss
    root = find_openradioss(openradioss_path) or Path(os.environ.get("OPENRADIOSS_PATH", ""))
    for name in ("anim_to_vtk_win64.exe", "anim_to_vtk_linux64_gf", "anim_to_vtk_linuxa64_gf"):
        candidate = root / "exec" / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "anim_to_vtk not found. Set OPENRADIOSS_PATH to the unpacked release."
    )


def convert_frame(anim_file: str | Path, exe: str | Path, out_vtk: str | Path) -> Path:
    """`anim_to_vtk <frame> > <frame>.vtk`.

    The converter writes to stdout, so the redirect happens here rather than in
    a shell: a PowerShell redirect prepends a UTF-8 byte-order mark, which
    makes every VTK reader reject the file with "illegal VTK header".
    """
    out_vtk = Path(out_vtk)
    with open(out_vtk, "wb") as sink:
        result = subprocess.run([str(exe), str(anim_file)], stdout=sink,
                                stderr=subprocess.PIPE)
    if result.returncode != 0 or out_vtk.stat().st_size == 0:
        raise RuntimeError(
            f"anim_to_vtk failed on {Path(anim_file).name}: "
            f"{result.stderr.decode('latin-1', 'replace')[:300]}"
        )
    return out_vtk


_SECTION = re.compile(
    r"^(POINTS|CELL_DATA|POINT_DATA|SCALARS|VECTORS|FIELD|CELLS|CELL_TYPES|"
    r"LOOKUP_TABLE|METADATA)\b[^\n]*$",
    re.M,
)


def read_vtk(path: str | Path, want: set[str] | None = None) -> dict:
    """Read the arrays this pipeline needs out of a legacy ASCII VTK.

    Deliberately not a general VTK reader. A legacy VTK file is a sequence of
    header lines each followed by a contiguous run of numbers, so the numbers
    for one array are exactly the text between its header and the next header.
    Slicing on the next marker and handing the slice to `np.fromstring` parses
    a 40 MB frame in under a second; walking it line by line to count values
    takes minutes, because every line search restarts from the same offset.

    `want` restricts which named arrays are parsed, which matters when only
    three of the fifteen arrays in the file are ever drawn.
    """
    text = Path(path).read_text(encoding="latin-1")
    marks = [(m.start(), m.end(), m.group(0)) for m in _SECTION.finditer(text)]
    out: dict = {}

    def numbers(header_end: int, next_start: int, dtype=np.float64) -> np.ndarray:
        return np.fromstring(text[header_end:next_start], sep=" ", dtype=dtype)

    for i, (pos, header_end, header) in enumerate(marks):
        parts = header.split()
        kind = parts[0]
        nxt = marks[i + 1][0] if i + 1 < len(marks) else len(text)

        if kind == "POINTS":
            n = int(parts[1])
            values = numbers(header_end, nxt)
            out["points"] = values[: n * 3].reshape(n, 3)
        elif kind == "CELLS":
            if want is not None and "CELLS" not in want:
                continue
            out["cells"] = numbers(header_end, nxt, dtype=np.int64)
        elif kind in ("POINT_DATA", "CELL_DATA"):
            out.setdefault("_counts", {})[kind] = int(parts[1])
        elif kind in ("SCALARS", "VECTORS"):
            name = parts[1]
            if want is not None and name not in want:
                continue
            # A SCALARS header is followed by LOOKUP_TABLE, which is itself a
            # marker, so the data starts after the marker AFTER this one.
            data_from, data_to = header_end, nxt
            if kind == "SCALARS" and i + 1 < len(marks) and marks[i + 1][2].startswith("LOOKUP_TABLE"):
                data_from = marks[i + 1][1]
                data_to = marks[i + 2][0] if i + 2 < len(marks) else len(text)
            values = numbers(data_from, data_to)
            out[name] = values.reshape(-1, 3) if kind == "VECTORS" else values
        elif kind == "FIELD":
            m = re.search(r"TIME\s+1\s+1\s+\w+\s*\n\s*([\d.eE+-]+)", text[pos:pos + 400])
            if m:
                out["time"] = float(m.group(1))
    out.pop("_counts", None)
    return out


def von_mises_from_nodal_tensor(v: dict) -> np.ndarray | None:
    """Von Mises from the six `GPS_SIG**` components, if the deck saved them.

    `/ANIM/GPS/TENS` writes the nodal stress tensor. Without it there is no
    stress to colour by, which is itself worth reporting rather than silently
    drawing a grey model.
    """
    need = ["GPS_SIGXX", "GPS_SIGYY", "GPS_SIGZZ", "GPS_SIGXY", "GPS_SIGZY", "GPS_SIGXZ"]
    if not all(k in v for k in need):
        return None
    xx, yy, zz, xy, zy, xz = (np.asarray(v[k], dtype=np.float64) for k in need)
    return np.sqrt(
        0.5 * ((xx - yy) ** 2 + (yy - zz) ** 2 + (zz - xx) ** 2)
        + 3.0 * (xy ** 2 + zy ** 2 + xz ** 2)
    )


CELL_VON_MISES = ("2DELEM_Von_Mises", "3DELEM_Von_Mises")
CELL_PLASTIC_STRAIN = ("2DELEM_Plastic_Strain", "3DELEM_Plastic_Strain")


def incidence(cells: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """`(cell index, point index)` pairs from a VTK CELLS list `[k, p1..pk, k, ...]`."""
    cell_idx, point_idx = [], []
    pos, c = 0, 0
    flat = cells.tolist()
    while pos < len(flat):
        k = flat[pos]
        cell_idx.extend([c] * k)
        point_idx.extend(flat[pos + 1:pos + 1 + k])
        pos += k + 1
        c += 1
    return np.asarray(cell_idx, np.int64), np.asarray(point_idx, np.int64)


def nodal_max_from_cells(v: dict, inc, names: tuple[str, ...], n_points: int) -> np.ndarray | None:
    """Per-node maximum of a per-element field: the worst element at each node.

    The maximum rather than the average, because the question a stress plot
    answers is "where is it highest", and averaging a loaded shell with its
    unloaded neighbour hides exactly that.
    """
    present = [np.asarray(v[n], dtype=np.float64) for n in names if n in v]
    if not present or inc is None:
        return None
    cell_value = np.max(np.stack(present), axis=0)
    out = np.zeros(n_points)
    np.maximum.at(out, inc[1], cell_value[inc[0]])
    return out


def frames_of(run_dir: str | Path, stem: str | None = None) -> list[Path]:
    """Every `<Run>Annn` animation file, in time order."""
    run_dir = Path(run_dir)
    pattern = f"{stem}A[0-9][0-9][0-9]" if stem else "*A[0-9][0-9][0-9]"
    return sorted(run_dir.glob(pattern), key=lambda p: p.name)


def extract(run_dir: str | Path, node_ids: Iterable[int], every: int = 1,
            limit: int | None = None, openradioss_path=None) -> dict:
    """Convert the frames and keep only what the report draws.

    `node_ids` are the surface nodes, in the order the report's vertex arrays
    use, so the result drops straight into the existing meshes.
    """
    exe = anim_to_vtk_exe(openradioss_path)
    files = frames_of(run_dir)[::every][:limit]
    if not files:
        raise FileNotFoundError(f"no animation files in {run_dir}")

    wanted = np.asarray(list(node_ids), dtype=np.int64)
    times, coords, stress, strain = [], [], [], []
    index = None
    inc = None          # element-to-node incidence, read once from the first frame

    with tempfile.TemporaryDirectory() as tmp:
        scratch = Path(tmp) / "frame.vtk"
        for path in files:
            convert_frame(path, exe, scratch)
            v = read_vtk(scratch, want={
                "NODE_ID", "GPS_SIGXX", "GPS_SIGYY", "GPS_SIGZZ",
                "GPS_SIGXY", "GPS_SIGZY", "GPS_SIGXZ",
                *CELL_VON_MISES, *CELL_PLASTIC_STRAIN,
                *(("CELLS",) if inc is None else ()),
            })
            scratch.unlink(missing_ok=True)  # 40 MB each; never keep two
            if "points" not in v:
                continue
            if index is None:
                ids = np.asarray(v.get("NODE_ID"), dtype=np.int64)
                lookup = {int(n): i for i, n in enumerate(ids)}
                index = np.array([lookup.get(int(n), 0) for n in wanted])
            if inc is None and "cells" in v:
                inc = incidence(v["cells"])
            n_points = len(v["points"])
            times.append(v.get("time", len(times)))
            coords.append(v["points"][index].astype(np.float32))
            vm = von_mises_from_nodal_tensor(v)
            if vm is None:
                vm = nodal_max_from_cells(v, inc, CELL_VON_MISES, n_points)
            stress.append(vm[index].astype(np.float32) if vm is not None else None)
            ep = nodal_max_from_cells(v, inc, CELL_PLASTIC_STRAIN, n_points)
            strain.append(ep[index].astype(np.float32) if ep is not None else None)

    return {
        "time": np.array(times, dtype=np.float64),
        "coords": np.stack(coords) if coords else np.empty((0, 0, 3), np.float32),
        "von_mises": (np.stack([s for s in stress]) if stress and stress[0] is not None
                      else None),
        "plastic_strain": (np.stack(strain) if strain and strain[0] is not None else None),
        "node_ids": wanted,
        "n_frames": len(coords),
        "source_files": [p.name for p in files],
    }


def save_extract(data: dict, path: str | Path) -> Path:
    """Cache an extraction. Converting frames costs ~23 s each; drawing them
    costs two. Separating the two means the look of a figure can be changed
    without paying the conversion again."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path, time=data["time"], coords=data["coords"], node_ids=data["node_ids"],
        von_mises=(data["von_mises"] if data.get("von_mises") is not None
                   else np.zeros(0, np.float32)),
        plastic_strain=(data["plastic_strain"] if data.get("plastic_strain") is not None
                        else np.zeros(0, np.float32)),
    )
    return path


def load_extract(path: str | Path) -> dict | None:
    path = Path(path)
    if not path.exists():
        return None
    z = np.load(path)
    vm = z["von_mises"]
    ep = z["plastic_strain"] if "plastic_strain" in z.files else np.zeros(0)
    return {
        "time": z["time"], "coords": z["coords"], "node_ids": z["node_ids"],
        "von_mises": vm if vm.size else None,
        "plastic_strain": ep if ep.size else None,
        "n_frames": int(z["coords"].shape[0]),
    }


__all__ = [
    "anim_to_vtk_exe", "convert_frame", "extract", "frames_of", "incidence", "load_extract",
    "make_media", "nodal_max_from_cells",
    "read_vtk", "render_frames", "save_extract", "von_mises_from_nodal_tensor",
    "write_video",
]


# ------------------------------------------------------------------- output


def render_frames(model_dir: str | Path, extracted: dict, geometry: dict,
                  analysis: dict, out_dir: str | Path,
                  field: str = "von_mises") -> list[Path]:
    """One PNG per frame: the deformed surface, coloured by the field.

    The connectivity never changes during a run - only the coordinates do - so
    the triangles come from the static geometry and only the vertex positions
    are swapped per frame. That is also why the extraction keeps surface nodes
    only: everything else is invisible.
    """
    from .findings import duration
    from .preview import BG, camera_angles

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import cm, colors
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    coords = extracted["coords"]
    values = extracted.get(field)
    order = {int(n): i for i, n in enumerate(extracted["node_ids"])}
    bbox = geometry.get("bbox") or {}
    lo = np.array(bbox.get("min", [0, 0, 0]), float)
    hi = np.array(bbox.get("max", [1, 1, 1]), float)
    centre, reach = (lo + hi) / 2, float(np.max(hi - lo)) / 2 * 1.2

    # One scale for the whole sequence, or the colours mean something different
    # in every frame. The 99.5th percentile rather than the maximum keeps a
    # single hot node from flattening everything else to black.
    vmax = float(np.percentile(values, 99.5)) if values is not None else 1.0
    norm = colors.Normalize(0.0, max(vmax, 1e-9))
    # `turbo` starts at a visible blue rather than black, which matters on a
    # dark background: with `inferno` an unstressed part is indistinguishable
    # from the page.
    cmap = matplotlib.colormaps["turbo"]

    elev, azim = camera_angles(analysis)

    wall = geometry.get("rigid_wall") or {}
    written = []
    for f in range(extracted["n_frames"]):
        # 960 x 608: both sides divisible by 16, so the MP4 encoder does not resize.
        fig = plt.figure(figsize=(9.6, 6.08), facecolor=BG)
        ax = fig.add_axes([0.0, 0.0, 0.88, 1.0], projection="3d", facecolor=BG)
        for part in geometry.get("parts", []):
            ids = part.get("node_ids")
            if not ids:
                continue
            rows = np.array([order.get(int(n), 0) for n in ids])
            pts = coords[f][rows]
            tris = np.stack([part["i"], part["j"], part["k"]], axis=1)
            verts = pts[tris]
            if values is not None:
                face = cmap(norm(values[f][rows][tris].mean(axis=1)))
            else:
                face = "#4c9aff"
            ax.add_collection3d(Poly3DCollection(verts, facecolor=face, edgecolor="none",
                                                 zsort="average"))
        if wall.get("x"):
            wx, wy, wz = np.array(wall["x"]), np.array(wall["y"]), np.array(wall["z"])
            wt = np.stack([wall["i"], wall["j"], wall["k"]], axis=1)
            ax.add_collection3d(Poly3DCollection(
                np.stack([wx[wt], wy[wt], wz[wt]], axis=-1),
                facecolor="#8892a0", edgecolor="none", alpha=0.22, zsort="min"))
        ax.set_xlim(centre[0] - reach, centre[0] + reach)
        ax.set_ylim(centre[1] - reach, centre[1] + reach)
        ax.set_zlim(centre[2] - reach, centre[2] + reach)
        try:
            ax.set_box_aspect((1, 1, 1))
        except Exception:
            pass
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        if values is not None:
            cax = fig.add_axes([0.90, 0.16, 0.018, 0.66])
            bar = fig.colorbar(cm.ScalarMappable(norm=norm, cmap=cmap), cax=cax)
            unit_s = (analysis.get("units", {}).get("derived", {}) or {}).get("stress", "")
            bar.set_label(f"von Mises [{unit_s}]", color="#9aa4b2", fontsize=9)
            bar.ax.tick_params(colors="#9aa4b2", labelsize=8)
            bar.outline.set_edgecolor("#2b323c")
        ax.set_title(f"{analysis.get('title', '')}    t = "
                     f"{duration(float(extracted['time'][f]), analysis['units']['work'][2])}",
                     color="#e6e9ee", fontsize=11, y=0.96)
        path = out_dir / f"frame_{f:03d}.png"
        # No bbox_inches="tight": it crops to the drawn content, so the frame
        # size changes as the model deforms and the video jitters.
        fig.savefig(path, dpi=100, facecolor=BG)
        plt.close(fig)
        written.append(path)
    return written


def write_video(frames: list[Path], out_path: str | Path, fps: int = 12) -> Path:
    """Assemble the stills into an MP4 with the ffmpeg imageio bundles."""
    import imageio.v2 as imageio

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with imageio.get_writer(out_path, fps=fps, codec="libx264", quality=8) as writer:
        for frame in frames:
            writer.append_data(imageio.imread(frame))
    return out_path


# ------------------------------------------------------------ one call per run


def make_media(model_dir: str | Path, version: str, geometry: dict, analysis: dict,
               every: int | None = None, fps: int = 8, refresh: bool = False,
               openradioss_path=None) -> dict | None:
    """Stills, a video and the per-node field history for one run, or `None`.

    `None` means the run wrote no animation frames an open tool can read -
    typically an Engine deck with `/H3D` only - which the report states as a
    finding rather than showing an empty player.

    About 25 frames are converted by default (`every` picks every Nth); the
    conversion is the slow part (~20 s a frame for 257 k nodes) and is cached,
    so changing the look of the pictures never pays for it twice.
    """
    import shutil

    model_dir = Path(model_dir)
    run_dir = model_dir / version
    available = frames_of(run_dir)
    if not available:
        return None
    media = model_dir / "media"
    cached = sorted(media.glob(f"frames_{version}_every*.npz"))
    if every is None and cached and not refresh:
        cache = cached[0]
    else:
        every = every or max(1, len(available) // 25)
        cache = media / f"frames_{version}_every{every}.npz"
    data = None if refresh else load_extract(cache)
    if data is None:
        node_ids = sorted({n for p in geometry["parts"] for n in p.get("node_ids", [])})
        data = extract(run_dir, node_ids, every=every or 1, openradioss_path=openradioss_path)
        save_extract(data, cache)

    out_dir = media / f"frames_{version}"
    if out_dir.exists():
        shutil.rmtree(out_dir)      # a shorter run must not inherit stale frames
    frames = render_frames(model_dir, data, geometry, analysis, out_dir)
    video = write_video(frames, media / f"{model_dir.name}_{version}.mp4", fps=fps)

    # The four moments a reader wants without scrubbing the video.
    stills = {}
    vm = data.get("von_mises")
    if vm is not None and len(frames) > 1:
        peak = vm.max(axis=1)
        top = float(peak.max()) or 1.0
        contact = next((i for i in range(1, len(peak)) if peak[i] > 0.05 * top), 1)
        moments = [("start", 0), ("first_contact", contact),
                   ("peak_stress", int(peak.argmax())), ("end", len(frames) - 1)]
    else:
        moments = [("start", 0), ("end", len(frames) - 1)]
    for label, index in moments:
        target = media / f"still_{version}_{label}.png"
        shutil.copyfile(frames[index], target)
        stills[label] = {"file": target.name, "time": float(data["time"][index])}
    return {"cache": cache.name, "video": video.name, "n_frames": len(frames),
            "available_frames": len(available), "stills": stills}
