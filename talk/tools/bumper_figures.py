"""Figures for the Bumper Beam slides, computed from the solver output of `src/main.py --run --media` ([MY]).

Writes
  public/media/bumper_overview.png  the undeformed bumper and the pole, seen from behind the car
                                    (driver's left = picture's left), for the Overview slide
  public/media/bumper_overview_box.png  the left crash box magnified, for the inset with its 39 welds
  src/data/bumper.json              everything the Bumper charts draw:
    overview   image size + the projected points the labels point at (pole, beam, crash boxes,
               the 78 spot welds, the rear ends held by the 500 kg block)
    curves     v0 and v0.1, one point per ms: pole force (kN) and car travel (mm), plus the four marked
               moments (first contact, peak, minimum, rebound at v = 0)
    top        top view of v0.1 at 0 and 100 ms: beam walls, crash-box outlines, the 65 tears
    crush      left / right crash-box shortening every 4 ms (v0.1)
    f06        where the self-contact's 942 initial overlaps sit, by pair of parts

Sources (paths relative to the repository root):
  Bumper_Beam/Bumper_Beam_AP_meshed_0000.rad          the mesh (parsed with the project's own parser)
  Bumper_Beam/v0/…T01.csv, Bumper_Beam/v0.1/…T01.csv   X-MOMENTUM and MASS channels, every 0.1 ms
  Bumper_Beam/media/frames_v0.1_every2.npz            node coordinates every 4 ms (from the /ANIM files)
  Bumper_Beam/v0.1/engine_stdout.txt                  'RUPTURE (BIQUAD) OF SHELL ELEMENT … AT TIME …'

Run from talk/:  python tools/bumper_figures.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.collections import PolyCollection  # noqa: E402
from scipy.spatial import ConvexHull, cKDTree  # noqa: E402

HERE = Path(__file__).resolve().parent.parent  # talk/
DELIV = HERE.parent  # the repository root: src/ and the model folders
BB = DELIV / "Bumper_Beam"
sys.path.insert(0, str(DELIV))
from src.radioss_deck import parse_deck  # noqa: E402  (the project's parser, read-only)

OUT_PNG = HERE / "public" / "media" / "bumper_overview.png"
OUT_INSET = HERE / "public" / "media" / "bumper_overview_box.png"
OUT_JSON = HERE / "src" / "data" / "bumper.json"

THICK = {1: 2.2, 6: 2.2, 2: 1.8, 7: 1.8}  # /PROP/SHELL thickness, mm (crash boxes 1/6, beam 2/7)
LEFT_BOX, RIGHT_BOX = (4, 5), (15, 16)  # y < 0 is the driver's left (car drives towards -X, Z up)


def load_th(path: Path) -> np.ndarray:
    with open(path, newline="", encoding="latin-1") as fh:
        rows = csv.reader(fh)
        next(rows)
        return np.array([[float(v) for v in r] for r in rows if r])


def r1(a, nd=1):
    return np.round(np.asarray(a, dtype=float), nd).tolist()


# ------------------------------------------------------------------ the mesh
deck = parse_deck(BB / "Bumper_Beam_AP_meshed_0000.rad")
IDX = deck.node_index()
X0 = deck.node_xyz

faces, kinds, face_part, face_t = [], [], [], []
for etype in ("SHELL", "SH3N"):
    for pid, arr in deck.elements[etype].items():
        prop = deck.parts[pid].prop_id
        for row in arr:
            faces.append([IDX[int(n)] for n in row[1:]])
            # the two pressed halves of a crash box in two shades, so the welded seam between them shows
            kinds.append(("boxTop" if pid in (5, 16) else "boxBottom") if prop in (1, 6) else "beam")
            face_part.append(pid)
            face_t.append(THICK[prop])

welds = []  # (part id, midpoint)
for pid, arr in deck.elements["SPRING"].items():
    for row in arr:
        a, b = X0[IDX[int(row[1])]], X0[IDX[int(row[2])]]
        welds.append((pid, (a + b) / 2))
assert len(welds) == 78

# ------------------------------------------------------------------ overview render
AZ, EL = np.radians(20.0), np.radians(35.0)  # camera behind the car (+X), a little to its right, above
CAM = np.array([np.cos(EL) * np.cos(AZ), np.cos(EL) * np.sin(AZ), np.sin(EL)])  # scene -> camera
RIGHT = np.cross([0.0, 0.0, 1.0], CAM)
RIGHT /= np.linalg.norm(RIGHT)
UP = np.cross(CAM, RIGHT)
POLE_C, POLE_R, POLE_Z = (-170.0, 0.0), 127.0, 230.0  # /RWALL/CYL: axis x = -170, y = 0; diameter 254 mm
LIGHT = np.array([0.25, 0.45, 0.86])
LIGHT /= np.linalg.norm(LIGHT)
BASE = {
    "beam": np.array([0x5B, 0x84, 0xB1]) / 255,  # steel blue: the DP1000 beam
    "boxTop": np.array([0x0D, 0x94, 0x88]) / 255,  # teal (--series-1): the DP600 crash boxes, top half
    "boxBottom": np.array([0x5F, 0xBF, 0xB4]) / 255,  # lighter teal: bottom half
    "pole": np.array([0xC9, 0xD1, 0xD9]) / 255,
    "cap": np.array([0xE4, 0xE9, 0xEE]) / 255,
}


def uv(p):
    p = np.asarray(p, dtype=float)
    return np.stack([p @ RIGHT, p @ UP], -1)


pole_facets = []
th = np.linspace(0, 2 * np.pi, 97)
zs = np.linspace(-POLE_Z, POLE_Z, 25)
for i in range(96):
    for j in range(24):
        c = lambda t, z: [POLE_C[0] + POLE_R * np.cos(t), POLE_C[1] + POLE_R * np.sin(t), z]  # noqa: E731
        pole_facets.append(np.array([c(th[i], zs[j]), c(th[i + 1], zs[j]), c(th[i + 1], zs[j + 1]), c(th[i], zs[j + 1])]))
cap = np.array([[POLE_C[0] + POLE_R * np.cos(t), POLE_C[1] + POLE_R * np.sin(t), POLE_Z] for t in th[:-1]])


def render(polys, pkind, path, display_w, bounds=None, pad=6.0):
    """Orthographic, painter's algorithm, Lambert shading. Returns (height, to_px) in slide pixels;
    the PNG is drawn at 2x for a sharp picture when reveal scales the 640 x 720 canvas up."""
    depth = np.array([p.mean(0) @ CAM for p in polys])
    fcs, pps = [], []
    for i in np.argsort(depth):  # far first
        p = polys[i]
        n = np.cross(p[1] - p[0], p[2] - p[0])
        n = n / (np.linalg.norm(n) or 1.0)
        if n @ CAM < 0:
            n = -n
        shade = 0.62 + 0.38 * abs(n @ LIGHT)
        fcs.append(np.clip(BASE[pkind[i]] * shade + (1 - shade) * 0.08, 0, 1))
        pps.append(uv(p))
    if bounds is None:
        allxy = np.concatenate(pps)
        bounds = (allxy.min(0), allxy.max(0))
    lo_, hi_ = bounds[0] - pad, bounds[1] + pad
    scale = display_w / (hi_[0] - lo_[0])  # slide px per mm
    height = (hi_[1] - lo_[1]) * scale

    def to_px(p):
        """3D point(s) -> slide pixels in this picture (origin top-left)."""
        q = uv(p)
        return np.stack([(q[..., 0] - lo_[0]) * scale, (hi_[1] - q[..., 1]) * scale], -1)

    fig = plt.figure(figsize=(display_w * 2 / 100, height * 2 / 100), dpi=100)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(lo_[0], hi_[0])
    ax.set_ylim(lo_[1], hi_[1])
    ax.set_aspect("equal")
    ax.axis("off")
    ax.add_collection(PolyCollection(pps, facecolors=fcs, edgecolors=fcs, linewidths=0.35, antialiased=True))
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, transparent=True)
    plt.close(fig)
    return height, to_px


DISPLAY_W = 600.0  # slide pixels the main picture is drawn at
DISPLAY_H, to_px = render([X0[f] for f in faces] + pole_facets + [cap], kinds + ["pole"] * len(pole_facets) + ["cap"],
                          OUT_PNG, DISPLAY_W)

# Inset: the left crash box magnified, with the end of the beam it is welded to.
near = [i for i, f in enumerate(faces) if X0[f].mean(0)[1] < -655 and X0[f].mean(0)[0] > 30]
box_pts = X0[np.array(sorted({n for i, f in enumerate(faces) if face_part[i] in LEFT_BOX for n in f}))]
box_uv = uv(box_pts)
INSET_W = 190.0
INSET_H, to_inset = render([X0[faces[i]] for i in near], [kinds[i] for i in near], OUT_INSET, INSET_W,
                           bounds=(box_uv.min(0), box_uv.max(0)), pad=22.0)

box_nodes = {s: np.array(sorted(IDX[n] for pid in pids for n in deck.parts[pid].node_ids)) for s, pids in (("L", LEFT_BOX), ("R", RIGHT_BOX))}
overview = {
    "width": DISPLAY_W,
    "height": round(DISPLAY_H, 1),
    "image": "media/bumper_overview.png",
    "camera": {"azimuth_deg": 20, "elevation_deg": 35, "note": "orthographic, from behind the car; picture left = driver's left (y < 0)"},
    "points": {
        "poleTop": r1(to_px([POLE_C[0], 0, POLE_Z])),
        "poleSide": r1(to_px([POLE_C[0], POLE_R, 150])),
        "beamTopL": r1(to_px([100, -560, 75])),
        "beamTopR": r1(to_px([100, 560, 75])),
        "beamCentre": r1(to_px([40, 0, 75])),
        "boxL": r1(to_px(X0[box_nodes["L"]].mean(0))),
        "boxR": r1(to_px(X0[box_nodes["R"]].mean(0))),
        "rearL": r1(to_px([317.5, -784, 0])),
        "rearR": r1(to_px([317.5, 784, 0])),
        "rearMid": r1(to_px([317.5, 0, 0])),
        "towardsPole": r1(to_px([217.5, 0, 0])),  # 100 mm from rearMid in the direction of travel (-X)
    },
    "welds": [{"part": int(pid), "xy": r1(to_px(m))} for pid, m in welds],
    "inset": {
        "width": INSET_W,
        "height": round(INSET_H, 1),
        "image": "media/bumper_overview_box.png",
        "box": r1(to_px(box_pts).min(0).tolist() + to_px(box_pts).max(0).tolist()),  # where it sits in the main picture
        "welds": [{"part": int(pid), "xy": r1(to_inset(m))} for pid, m in welds if pid in (11, 12, 13)],
    },
}

# ------------------------------------------------------------------ curves: pole force and car travel
curves = {}
for run, sub in (("v0", "v0"), ("v0.1", "v0.1")):
    a = load_th(BB / sub / "Bumper_Beam_AP_meshedT01.csv")
    t, px, mass = a[:, 0], a[:, 3], a[:, 6]  # time (ms), X-MOMENTUM (kg*m/s), MASS (kg, incl. added mass)
    v = px / mass  # m/s = mm/ms, centre of mass of the whole model
    travel = -np.concatenate([[0.0], np.cumsum(0.5 * (v[1:] + v[:-1]) * np.diff(t))])  # mm towards the pole
    # Force = rate of change of momentum over a centred 1 ms window (the window of the F-01 chart). The only
    # X force on the model is the pole's push, normal + friction, so the area under force vs travel up to
    # the furthest point must give back the impact energy: checked below.
    tk = np.arange(0.0, np.floor(t[-1] - 0.5) + 1e-9, 1.0)  # whole ms
    force = np.interp(tk + 0.5, t, px) - np.interp(np.maximum(tk - 0.5, 0.0), t, px)
    force[0] = 0.0  # t = 0: the 3 mm gap is still open
    trav_k = np.interp(tk, t, travel)
    ke = a[:, 2]
    i_stop = int(np.argmin(ke))
    i_far = int(np.argmax(trav_k))
    area = float(np.trapezoid(force[: i_far + 1], trav_k[: i_far + 1]))  # kN * mm = J
    assert abs(area - ke[0]) < 0.01 * ke[0], (run, area, ke[0])
    # The four moments the chart marks on each curve. First contact: the pole's normal-force channel (var 35, a
    # running total) leaves zero; the 3 mm gap closes then. Minimum: the lowest force between the peak and the
    # furthest point (the buckled beam). Rebound: the furthest point, where the car's speed is zero.
    imp_n = -a[:, 35]
    i_c = int(np.argmax(imp_n > 1e-6))
    i_pk = int(np.argmax(force))
    i_min = i_pk + int(np.argmin(force[i_pk:i_far + 1]))
    events = {
        "contact": {"t": round(float(t[i_c]), 2), "travel": round(float(travel[i_c]), 1), "force": 0.0},
        "peak": {"i": i_pk},
        "min": {"i": i_min},
        "rebound": {"i": i_far, "t": round(float(t[i_stop]), 1), "travel": round(float(travel[i_stop]), 1)},
    }
    curves[run] = {
        "t": r1(tk, 0),
        "force": r1(force, 1),
        "travel": r1(trav_k, 1),
        "peak": {"force": round(float(force.max()), 1), "t": float(tk[np.argmax(force)])},
        "stop": {"t": round(float(t[i_stop]), 1), "travel": round(float(travel[i_stop]), 1)},
        "end": {"t": round(float(t[-1]), 1), "travel": round(float(travel[-1]), 1), "v": round(float(v[-1]), 2)},
        "ke0": round(float(ke[0]), 1),
        "area_to_furthest_J": round(area, 0),
        "events": events,
    }

# ------------------------------------------------------------------ top view (v0.1 frames) and crush
fr = np.load(BB / "media" / "frames_v0.1_every2.npz")
ft, FC, fid = fr["time"], fr["coords"], fr["node_ids"]
POS = {int(n): i for i, n in enumerate(fid)}
c0 = FC[0]
pn = {pid: np.array(sorted(POS[n] for n in p.node_ids if n in POS)) for pid, p in deck.parts.items()}


def wall_line(pids, z=0.0):
    ii = np.concatenate([pn[p] for p in pids])
    ii = ii[np.abs(c0[ii, 2] - z) < 1.0]
    return ii[np.argsort(c0[ii, 1])]


front, rear = wall_line((9, 20)), wall_line((10, 21))
k_end = len(ft) - 1


def yx(ii, k):  # top view: picture x = y (driver's left on the left), picture y = x (pole at the top)
    return [[round(float(FC[k, i, 1]), 1), round(float(FC[k, i, 0]), 1)] for i in ii]


def hull(pids, k):
    ii = np.concatenate([pn[p] for p in pids])
    pts = FC[k][ii][:, [1, 0]]
    h = ConvexHull(pts)
    return r1(pts[h.vertices], 1)


els = {}
for etype in ("SHELL", "SH3N"):
    for pid, arr in deck.elements[etype].items():
        for row in arr:
            els[int(row[0])] = (pid, [POS[int(n)] for n in row[1:]])
log = (BB / "v0.1" / "engine_stdout.txt").read_text(encoding="latin-1")
tears = []
for e, tt in re.findall(r"RUPTURE \(BIQUAD\) OF SHELL ELEMENT :\s+(\d+) AT TIME :\s+([\d.]+)", log):
    pid, nodes = els[int(e)]
    p_end = FC[k_end][nodes].mean(0)
    side = "L" if c0[nodes].mean(0)[1] < 0 else "R"
    tears.append({"t": float(tt), "part": deck.parts[pid].title, "side": side, "yx": [round(float(p_end[1]), 1), round(float(p_end[0]), 1)]})
assert len(tears) == 65

top = {
    "pole": {"y": POLE_C[1], "x": POLE_C[0], "r": POLE_R},
    "t0": {"front": yx(front, 0), "rear": yx(rear, 0), "boxL": hull(LEFT_BOX, 0), "boxR": hull(RIGHT_BOX, 0)},
    "t100": {"front": yx(front, k_end), "rear": yx(rear, k_end), "boxL": hull(LEFT_BOX, k_end), "boxR": hull(RIGHT_BOX, k_end)},
    "tears": tears,
}

rear_nodes = np.where(c0[:, 0] > 317.0)[0]
crush = {"t": r1(ft, 0)}
for s, pids in (("L", LEFT_BOX), ("R", RIGHT_BOX)):
    ii = np.concatenate([pn[p] for p in pids])
    fnt, rr = ii[c0[ii, 0] < 104.0], ii[c0[ii, 0] > 317.0]
    length = FC[:, rr, 0].mean(1) - FC[:, fnt, 0].mean(1)
    crush[s] = r1(length[0] - length, 1)

# ------------------------------------------------------------------ F-06: where the initial overlaps sit
# TYPE7 self-contact, Igap = 2: a node closer to a sheet than max(Gapmin 1 mm, t_node/2 + t_sheet/2) is an
# initial overlap. Faces holding the node itself do not count.
node_t, node_parts = {}, {}
for f, pid, tt in zip(faces, face_part, face_t):
    for n in f:
        node_t[n] = max(node_t.get(n, 0.0), tt)
        node_parts.setdefault(n, set()).add(pid)
cent = np.array([X0[f].mean(0) for f in faces])
rad = np.array([np.linalg.norm(X0[f] - X0[f].mean(0), axis=1).max() for f in faces])
tree = cKDTree(cent)


def pt_tri(p, a, b, c):  # closest distance point -> triangle (Ericson, Real-Time Collision Detection 5.1.5)
    ab, ac, ap = b - a, c - a, p - a
    d1, d2 = ab @ ap, ac @ ap
    if d1 <= 0 and d2 <= 0:
        return np.linalg.norm(ap)
    bp = p - b
    d3, d4 = ab @ bp, ac @ bp
    if d3 >= 0 and d4 <= d3:
        return np.linalg.norm(bp)
    vc = d1 * d4 - d3 * d2
    if vc <= 0 and d1 >= 0 and d3 <= 0:
        return np.linalg.norm(p - (a + d1 / (d1 - d3) * ab))
    cp = p - c
    d5, d6 = ab @ cp, ac @ cp
    if d6 >= 0 and d5 <= d6:
        return np.linalg.norm(cp)
    vb = d5 * d2 - d1 * d6
    if vb <= 0 and d2 >= 0 and d6 <= 0:
        return np.linalg.norm(p - (a + d2 / (d2 - d6) * ac))
    va = d3 * d6 - d5 * d4
    if va <= 0 and (d4 - d3) >= 0 and (d5 - d6) >= 0:
        return np.linalg.norm(p - (b + (d4 - d3) / ((d4 - d3) + (d5 - d6)) * (c - b)))
    den = 1.0 / (va + vb + vc)
    return np.linalg.norm(p - (a + ab * vb * den + ac * vc * den))


def edge_of(pa: int, pb: int) -> str:
    box = {4: "L", 5: "L", 15: "R", 16: "R"}
    if pa in box and pb in box:
        return "box halves" if pa != pb else "same half"
    if (pa in box) != (pb in box):
        return "box to beam"
    return "beam"


pairs: dict[str, int] = {}
over_nodes = set()
reach = rad.max() + 2.5
for n, tn in node_t.items():
    p = X0[n]
    for fi in tree.query_ball_point(p, reach):
        f = faces[fi]
        if n in f:
            continue
        gap = max(1.0, tn / 2 + face_t[fi] / 2)
        if np.linalg.norm(p - cent[fi]) > rad[fi] + gap:
            continue
        if len(f) == 4:
            dist = min(pt_tri(p, *X0[[f[0], f[1], f[2]]]), pt_tri(p, *X0[[f[0], f[2], f[3]]]))
        else:
            dist = pt_tri(p, *X0[f])
        if dist < gap:
            own = min(node_parts[n])  # a node shared by two beam parts counts with either: both are beam
            key = edge_of(own, face_part[fi])
            pairs[key] = pairs.get(key, 0) + 1
            over_nodes.add(n)
f06 = {"overlaps": sum(pairs.values()), "nodes": len(over_nodes), "by_pair": pairs,
       "solver": {"overlaps": 942, "nodes": 464, "source": "v0/Bumper_Beam_AP_meshed_0000.out WARNING ID 343"}}

OUT_JSON.write_text(json.dumps({
    "_source": "tools/bumper_figures.py, computed after delivery from the shipped Bumper_Beam files",
    "overview": overview, "curves": curves, "top": top, "crush": crush, "f06": f06,
}, indent=1), encoding="utf-8")
print("wrote", OUT_PNG.relative_to(HERE), f"({DISPLAY_W:.0f} x {DISPLAY_H:.0f} slide px)")
print("wrote", OUT_JSON.relative_to(HERE))
for run, c in curves.items():
    print(f"  {run}: peak {c['peak']['force']} kN at {c['peak']['t']} ms; furthest {c['stop']['travel']} mm at "
          f"{c['stop']['t']} ms; at the end {c['end']['travel']} mm, {c['end']['v']} m/s")
print("  crush at 100 ms: left", crush["L"][-1], "mm, right", crush["R"][-1], "mm")
print("  tears: left", sum(t["side"] == "L" for t in tears), "right", sum(t["side"] == "R" for t in tears))
print("  F-06:", f06["overlaps"], "overlaps on", f06["nodes"], "points:", pairs)
