"""Turn two decks and an optional run into one explained model.

The parser says what is in the file. This says what it *means*: how fast the
thing is going in units a person uses, what it hits, what each part is made of
and how thick it is, which settings will shape the answer, and which of them
are wrong. Everything the report shows comes from the dict this produces, so
the report has no logic of its own and the same dict is what the agent skill
consumes.

The structure follows the order an engineer reads a deck in - geometry and assembly,
materials, mesh, boundary conditions, contacts, loading, initial conditions,
control cards, output requests - with two sections added because they are what
a mechanical engineer actually asks on a Tuesday: `engineering_review`
(critical dimensions, manufacturability, what tolerance is and is not in the
model) and `findings`.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np

from . import findings as findings_mod
from .decode import (
    BIQUAD_PRESETS,
    FAILURE_MODELS,
    MATERIAL_LAWS,
    decode_flag,
    describe_keyword,
    undecoded_fields,
)
from .geometry import part_metrics, part_volume_and_area, spotweld_pitch
from .radioss_deck import Card, Deck, parse_deck
from .solver_out import find_run

G_MM_S2 = 9810.0  # standard gravity in mm/s^2, the length unit both decks use

# What a part of this kind weighs in the real world. Used only to say when a
# model is far off, and always quoted with its basis so the reader can disagree.
REFERENCE_MASS = {
    "Cell_Phone_Drop": {
        "expected_g": 160.0,
        "what": "a real smartphone of these outside dimensions",
        "basis": "58 x 104 x 9 mm is a compact-format phone; shipping masses for "
                 "that envelope run about 140 to 175 g",
    },
}


def _num(x, default=None):
    return x if isinstance(x, (int, float)) else default


def _velocity_from_inivel(deck: Deck) -> dict[str, Any]:
    card = next((c for c in deck.cards if c.family == "INIVEL"), None)
    if card is None:
        return {}
    v = np.array([_num(card.fields.get(k), 0.0) for k in ("Vx", "Vy", "Vz")], dtype=float)
    speed = float(np.linalg.norm(v))
    if speed == 0:
        return {}
    # mm per (ms | s) -> m/s
    to_ms = 1.0 if deck.units.time == "s" else 1000.0
    speed_ms = speed / 1000.0 * to_ms
    return {
        "vector": v.tolist(),
        "unit": f"{deck.units.length}/{deck.units.time}",
        "speed_deck": speed,
        "speed_ms": speed_ms,
        "speed_kmh": speed_ms * 3.6,
        "direction": (v / speed).tolist(),
        "line": card.line,
    }


def _gravity(deck: Deck) -> dict[str, Any]:
    cards = [c for c in deck.cards if c.family == "GRAV"]
    if not cards:
        return {}
    # The acceleration a /GRAV card applies is Fscale_Y times its function's
    # value, along DIR - so both the sign and the function matter. The bumper
    # deck writes Fscale_Y = -1 on a function holding 0.00981 mm/ms^2: that is
    # standard gravity pointing down Z, which neither number shows on its own.
    funcs = {c.id: c.rows for c in deck.cards if c.family == "FUNCT" and c.rows}
    vector, dirs = np.zeros(3), []
    for c in cards:
        scale = _num(c.fields.get("Fscale_Y"))
        axis = str(c.fields.get("DIR") or "").strip().upper()
        if scale is None or axis not in ("X", "Y", "Z"):
            continue
        rows = funcs.get(_num(c.fields.get("funct_IDT")))
        f0 = _num(rows[0].get("Y"), 1.0) if rows else 1.0
        vector["XYZ".index(axis)] += float(scale) * float(f0)
        dirs.append(axis)
    if not dirs:
        return {}
    magnitude = float(np.linalg.norm(vector))
    return {
        "n_cards": len(cards),
        "axes": dirs,
        "vector": vector.tolist(),
        "direction": (vector / magnitude).tolist() if magnitude else None,
        "magnitude_deck": magnitude,
        "matches_standard_g": abs(magnitude - G_MM_S2) / G_MM_S2 < 0.02
        or abs(magnitude - 0.00981) / 0.00981 < 0.02,
        "line": cards[0].line,
    }


def _rigid_wall(deck: Deck, velocity: dict) -> dict[str, Any]:
    card = next((c for c in deck.cards if c.family == "RWALL"), None)
    if card is None:
        return {}
    f = card.fields
    wall: dict[str, Any] = {
        "type": card.subtype,
        "title": card.title,
        "line": card.line,
        "d_search": _num(f.get("D_search")),
        "friction": _num(f.get("fric")),
        "diameter": _num(f.get("Diameter")),
        "slide": _num(f.get("Slide")),
        "slide_meaning": decode_flag("/RWALL", "Slide", _num(f.get("Slide"))),
        "origin": [_num(f.get(k)) for k in ("XM", "YM", "ZM")],
        "second_point": [_num(f.get(k)) for k in ("X_M1", "Y_M1", "Z_M1")],
        "secondary_group": _num(f.get("grnod_ID1")),
    }
    origin = np.array([x for x in wall["origin"] if x is not None], dtype=float)
    second = np.array([x for x in wall["second_point"] if x is not None], dtype=float)
    if card.subtype == "PLANE" and origin.size == 3 and second.size == 3:
        normal = second - origin
        if np.linalg.norm(normal) > 0:
            normal = normal / np.linalg.norm(normal)
            d = (deck.node_xyz - origin) @ normal
            wall["normal"] = normal.tolist()
            wall["node_distance_min"] = float(d.min())
            wall["node_distance_max"] = float(d.max())
            wall["nodes_touching_at_t0"] = int((d <= 1e-6).sum())
            wall["nodes_inside_search"] = int((d <= (wall["d_search"] or 0)).sum())
            # Every node of a freely falling body reaches the plane eventually,
            # so the depth of the body along the normal is the reach the search
            # band has to cover.
            wall["required_reach"] = float(d.max())
            wall["reach_reason"] = (
                f"the model extends {d.max():.1f} mm away from the wall and all of it "
                f"is moving toward the wall"
            )
            if velocity.get("direction"):
                wall["velocity_dot_normal"] = float(np.dot(velocity["direction"], normal))
    if card.subtype == "CYL" and wall.get("diameter"):
        wall["radius"] = wall["diameter"] / 2.0
    return wall


def _materials(deck: Deck) -> list[dict[str, Any]]:
    out = []
    for mid, card in sorted(deck.materials.items()):
        law_key = card.subtype
        name, formula = MATERIAL_LAWS.get(law_key, (f"/MAT/{law_key}", ""))
        f = card.fields
        rate = None
        if law_key == "PLAS_JOHNS":
            rate = bool(_num(f.get("c"), 0)) and bool(_num(f.get("EPS_DOT_0"), 0))
        elif law_key == "PLAS_TAB":
            rate = _num(f.get("N_funct"), 0) > 1
        out.append({
            "id": mid,
            "title": card.title,
            "law_key": law_key,
            "law": name,
            "formula": formula,
            "line": card.line,
            "density": _num(f.get("RHO_I")),
            "youngs_modulus": _num(f.get("E")),
            "poisson": _num(f.get("Nu")),
            "yield_a": _num(f.get("a")),
            "hardening_b": _num(f.get("b")),
            "hardening_n": _num(f.get("n")),
            "rate_coefficient_c": _num(f.get("c")),
            "rate_reference": _num(f.get("EPS_DOT_0")),
            "icc": _num(f.get("ICC")),
            "rate_dependent": rate,
            "fields": f,
        })
    return out


def _failures(deck: Deck, materials: list[dict]) -> list[dict[str, Any]]:
    by_id = {m["id"]: m for m in materials}
    out = []
    for card in deck.cards_of("FAIL"):
        name, how = FAILURE_MODELS.get(card.subtype, (f"/FAIL/{card.subtype}", ""))
        mflag = _num(card.fields.get("M_Flag"))
        owner = by_id.get(card.id)
        out.append({
            "id": card.id,
            "model": name,
            "how": how,
            "line": card.line,
            "M_Flag": mflag,
            "preset_name": BIQUAD_PRESETS.get(mflag) if card.subtype == "BIQUAD" else None,
            "material_title": owner["title"] if owner else None,
            "material_id": card.id,
        })
    return out


def _interfaces(deck: Deck) -> list[dict[str, Any]]:
    out = []
    for card in deck.cards_of("INTER"):
        f = card.fields
        decoded = {
            k: decode_flag(f"/INTER/{card.subtype}", k, _num(f.get(k)))
            for k in ("Istf", "Igap", "Inacti", "Iform", "Idel", "Spotflag", "Ignore")
            if f.get(k) is not None
        }
        out.append({
            "id": card.id,
            "type": card.subtype,
            "title": card.title,
            "line": card.line,
            "tied": card.subtype in ("TYPE2",),
            "friction": _num(f.get("Fric")),
            "gapmin": _num(f.get("Gapmin")),
            "fields": f,
            "decoded": {k: v for k, v in decoded.items() if v},
        })
    return out


def _assembly(deck: Deck, materials: list[dict], run: dict) -> list[dict[str, Any]]:
    by_mat = {m["id"]: m for m in materials}
    starter_mass = (run.get("starter") or {}).get("part_mass", {})
    rows = []
    for pid, part in deck.parts.items():
        metrics = part_metrics(deck, pid)
        va = part_volume_and_area(deck, pid)
        mat = by_mat.get(part.mat_id)
        prop = deck.properties.get(part.prop_id)
        rho = mat["density"] if mat else None
        if metrics.get("is_shell"):
            thk = metrics.get("thickness_mm") or 0.0
            computed = va["area_mm2"] * thk * rho if rho else None
        else:
            computed = va["volume_mm3"] * rho if rho else None
        row = {
            "id": pid,
            "title": part.title,
            "line": part.line,
            "material_id": part.mat_id,
            "material_title": mat["title"] if mat else None,
            "material_law": mat["law"] if mat else None,
            "material_law_key": mat["law_key"] if mat else None,
            "property_id": part.prop_id,
            "property_type": prop.subtype if prop else None,
            "element_types": part.element_types,
            "n_elements": part.n_elements,
            "mass_computed": computed,
            "mass_starter": starter_mass.get(pid),
            **metrics,
            **va,
        }
        if prop is not None:
            row["formulation"] = _num(prop.fields.get("Ishell"))
            row["formulation_meaning"] = decode_flag(
                "/PROP/SHELL", "Ishell", row["formulation"]
            )
            row["integration_points"] = _num(prop.fields.get("N"))
        sw = spotweld_pitch(deck, pid)
        if sw:
            row["spotwelds"] = sw
        rows.append(row)
    return rows


def _orphans(deck: Deck) -> dict[str, list[int]]:
    used_mat = {p.mat_id for p in deck.parts.values() if p.mat_id}
    used_prop = {p.prop_id for p in deck.parts.values() if p.prop_id}
    used_funct: set[int] = set()
    for card in deck.cards:
        for name, value in (card.fields or {}).items():
            if ("fct" in name.lower() or "func" in name.lower()) and isinstance(value, int) and value:
                used_funct.add(value)
    return {
        "materials": sorted(set(deck.materials) - used_mat),
        "properties": sorted(set(deck.properties) - used_prop),
        "functions": sorted(set(deck.functions) - used_funct),
    }


def _node_to_parts(deck: Deck) -> dict[int, set[int]]:
    """Which parts each node belongs to."""
    owner: dict[int, set[int]] = {}
    for by_part in deck.elements.values():
        for pid, conn in by_part.items():
            if conn.size == 0:
                continue
            for nid in np.unique(conn[:, 1:]):
                if nid:
                    owner.setdefault(int(nid), set()).add(pid)
    return owner


def _group_nodes(deck: Deck) -> dict[tuple[str, int], set[int]]:
    """Resolve every group card to the set of nodes it covers.

    Groups nest: a `/GRNOD/GRNOD` lists other group ids, a `/GRNOD/PART` lists
    part ids, a `/SURF/SEG` lists segments whose first column is a segment id.
    Resolving them is what turns "interface 13 uses group 18" into "interface
    13 touches these fourteen parts".
    """
    part_nodes = {pid: set(p.node_ids) for pid, p in deck.parts.items()}
    raw: dict[tuple[str, int], "Card"] = {}
    for card in deck.cards:
        if card.family in ("GRNOD", "SURF", "GRSHEL", "GRBRIC") and card.id is not None:
            raw[(card.family, card.id)] = card

    resolved: dict[tuple[str, int], set[int]] = {}

    def resolve(key, seen=()):
        if key in resolved:
            return resolved[key]
        card = raw.get(key)
        if card is None or key in seen:
            return set()
        sub = card.subtype.split("/")[-1]
        nodes: set[int] = set()
        if sub == "NODE":
            nodes = {int(x) for x in card.members if x}
        elif sub == "PART":
            for pid in card.members:
                nodes |= part_nodes.get(int(pid), set())
        elif sub == "SEG":
            for row in card.member_rows:
                nodes |= {int(x) for x in row[1:] if x}
        elif sub in ("GRNOD", "SURF"):
            for gid in card.members:
                nodes |= resolve((card.family, int(gid)), seen + (key,))
                nodes |= resolve(("GRNOD", int(gid)), seen + (key,))
                nodes |= resolve(("SURF", int(gid)), seen + (key,))
        elif sub in ("SHEL", "BRIC", "SH3N"):
            wanted = {int(x) for x in card.members if x}
            for etype, by_part in deck.elements.items():
                for pid, conn in by_part.items():
                    if conn.size == 0:
                        continue
                    mask = np.isin(conn[:, 0], list(wanted))
                    if mask.any():
                        nodes |= {int(n) for n in np.unique(conn[mask][:, 1:]) if n}
        resolved[key] = nodes
        return nodes

    for key in raw:
        resolve(key)
    return resolved


def _attachment(deck: Deck, assembly: list[dict]) -> dict[str, Any]:
    """Which parts an interface actually touches, and which parts nothing touches.

    A part with no interface node is held by nothing and stopped by nothing: it
    is carried along by its initial velocity and passes through whatever is in
    its way. In a drop test that is the difference between a component that
    loads the board and one that is scenery.
    """
    groups = _group_nodes(deck)
    owner = _node_to_parts(deck)
    touched: set[int] = set()
    per_interface = []
    for card in deck.cards_of("INTER"):
        nodes: set[int] = set()
        # Node-group ids and surface ids live in SEPARATE namespaces, and both
        # start at 1. Looking an id up in both is how `/INTER/TYPE2/1`'s
        # Surf_id = 1 silently resolved to `/GRNOD/NODE/1`, the initial-velocity
        # group, and made every interface appear to touch all 17 parts.
        NAMESPACE = {
            "Slav_id": "GRNOD", "Secon_id": "GRNOD", "grnod_ID": "GRNOD",
            "grnod_ID1": "GRNOD", "grnod_ID2": "GRNOD",
            "Surf_id": "SURF", "Mast_id": "SURF",
        }
        for name, value in (card.fields or {}).items():
            if not isinstance(value, int) or not value:
                continue
            family = NAMESPACE.get(name)
            if family:
                nodes |= groups.get((family, value), set())
        parts = sorted({pid for n in nodes for pid in owner.get(n, ())})
        touched |= set(parts)
        per_interface.append({
            "id": card.id,
            "type": card.subtype,
            "title": card.title,
            "parts": parts,
            "n_nodes": len(nodes),
        })

    # The rigid wall holds nodes too, within its search band.
    total = sum(r["mass_computed"] or 0 for r in assembly)
    unattached = []
    for row in assembly:
        if row["id"] in touched or not row["n_elements"]:
            continue
        unattached.append({
            "id": row["id"],
            "title": row["title"],
            "mass": row["mass_computed"],
            "mass_fraction": (row["mass_computed"] or 0) / total if total else 0,
        })
    return {"per_interface": per_interface, "unattached": unattached}


TH_KINDS = {
    # /TH/<kind>: what a time-history request on that kind of object records
    "INTER": "the contact force of interface",
    "RWALL": "the force on rigid wall",
    "RBODY": "the force and motion of rigid body",
    "ACCEL": "the acceleration measured by accelerometer",
    "SECTIO": "the force passing through section",
    "PART": "the energies of part",
    "NODE": "the motion of node",
    "BRIC": "the stresses in solid element",
    "SHEL": "the stresses in shell element",
    "SPRING": "the force in spring",
}


def _constraints_and_outputs(deck: Deck, assembly: list[dict]) -> dict[str, Any]:
    """What holds the model, and what it measures over time.

    Both are easy to overlook: a `/BCS` on the reference point of a rigid body
    decides whether the whole vehicle can pitch, and the `/TH` cards decide
    whether a force can ever be plotted.
    """
    groups = _group_nodes(deck)
    owner = _node_to_parts(deck)
    titles = {r["id"]: r["title"] for r in assembly}
    rbody_masters = {int(c.fields.get("RBID") or 0): c for c in deck.cards_of("RBODY")}

    def parts_of(nodes):
        return sorted({pid for n in nodes for pid in owner.get(n, ())})

    constraints = []
    for c in deck.cards_of("RBODY"):
        f = c.fields
        nodes = groups.get(("GRNOD", int(f.get("Gnod_id") or 0)), set())
        parts = parts_of(nodes)
        constraints.append({
            "keyword": c.keyword, "title": c.title, "line": c.line, "kind": "rigid body",
            "n_nodes": len(nodes), "parts": parts,
            "mass": _num(f.get("MASS")), "reference_node": f.get("RBID"),
            "plain": (f"{len(nodes)} mesh points"
                      + (f" of {', '.join(dict.fromkeys(titles.get(p, str(p)) for p in parts))}"
                         if parts else "")
                      + " move together as one rigid block"
                      + (f", which carries {_num(f.get('MASS')):g} {deck.units.mass} of extra mass"
                         if _num(f.get('MASS')) else "")
                      + f" (reference point: node {f.get('RBID')})."),
        })
    for c in deck.cards_of("BCS"):
        f = c.fields
        code = str(f.get("Tra rot") or "").split()
        tra = (code[0] if code else "").rjust(3, "0")
        rot = (code[1] if len(code) > 1 else "").rjust(3, "0")
        fixed_t = [ax for ax, flag in zip("XYZ", tra) if flag == "1"]
        free_t = [ax for ax, flag in zip("XYZ", tra) if flag != "1"]
        fixed_r = [ax for ax, flag in zip("XYZ", rot) if flag == "1"]
        nodes = groups.get(("GRNOD", int(f.get("grnod_ID") or 0)), set())
        on_rbody = [rbody_masters[n] for n in nodes if n in rbody_masters]
        where = (f"the reference point of the rigid block '{on_rbody[0].title}'" if on_rbody
                 else f"{len(nodes)} mesh point(s)")
        if len(fixed_t) == 3 and len(fixed_r) == 3:
            what = "fully fixed"
        else:
            what = ("held in " + ", ".join(fixed_t) if fixed_t else "free to move") \
                   + (" and in all rotations" if len(fixed_r) == 3 else
                      (", rotations about " + ", ".join(fixed_r) + " held" if fixed_r else ", free to rotate"))
            if free_t and fixed_t:
                what += f": it can only move along {', '.join(free_t)}"
        constraints.append({
            "keyword": c.keyword, "title": c.title, "line": c.line, "kind": "fixed directions",
            "code": " ".join(code), "fixed_translations": fixed_t, "fixed_rotations": fixed_r,
            "n_nodes": len(nodes), "on_rigid_body": bool(on_rbody),
            "plain": f"{where[0].upper() + where[1:]} is {what}.",
        })

    interfaces = {c.id: c.title for c in deck.cards_of("INTER")}
    accels = {c.id: c for c in deck.cards_of("ACCEL")}
    sections = {c.id: c for c in deck.cards_of("SECT")}
    requests = []
    for c in deck.cards_of("TH"):
        kind = c.subtype.split("/")[0]
        objs = [v for k, v in sorted((c.fields or {}).items()) if k.startswith("Obj") and v]
        variables = [v for k, v in (c.fields or {}).items() if k.startswith("var") and v]
        names = []
        for o in objs:
            if kind == "INTER":
                names.append(f"{o} ({interfaces.get(o, '?')})")
            elif kind == "PART":
                names.append(titles.get(o, str(o)))
            elif kind == "ACCEL" and o in accels:
                names.append(f"{o} ({accels[o].title}, on node {accels[o].fields.get('node_ID')})")
            elif kind == "SECTIO" and o in sections:
                names.append(f"{o} ({sections[o].title})")
            else:
                names.append(str(o))
        requests.append({
            "keyword": c.keyword, "line": c.line, "kind": kind, "objects": objs,
            "variables": variables,
            "plain": f"{TH_KINDS.get(kind, 'the values of ' + kind.lower())} {', '.join(names)}"
                     + (" (the default set of values)" if variables == ["DEF"] else
                        f" ({', '.join(map(str, variables))})"),
        })
    return {"constraints": constraints, "time_history": requests,
            "accelerometers": [{"id": c.id, "title": c.title, "node": c.fields.get("node_ID"),
                                "filter_hz_or_scale": c.fields.get("Fcut")} for c in accels.values()],
            "sections": [{"id": c.id, "title": c.title, "line": c.line} for c in sections.values()]}


def _engineering_review(deck: Deck, assembly: list[dict], wall: dict) -> dict[str, Any]:
    """The questions a mechanical engineer asks before believing a model.

    Critical dimensions, because a simulation is only as good as the geometry
    it was built on; manufacturability, because a part that cannot be made is
    not a design; and tolerances, because the deck holds exactly one geometry
    and a real part is a distribution.
    """
    sheets = [r for r in assembly if r.get("is_shell") and r.get("thickness_mm")]
    solids = [r for r in assembly if not r.get("is_shell") and r.get("thickness_mm")]
    welds = [r for r in assembly if r.get("spotwelds")]

    critical = []
    for gauge in sorted({round(r["thickness_mm"], 3) for r in sheets}):
        users = [r["title"] for r in sheets if round(r["thickness_mm"], 3) == gauge]
        critical.append({
            "dimension": f"sheet gauge {gauge:g} mm",
            "value": gauge,
            "unit": "mm",
            "where": ", ".join(sorted(set(users))),
            "why": "decides how stiff the beam is and at what force it folds; also "
                   "the number that most drives the cost and weight of a pressed part",
        })
    thin = sorted(solids, key=lambda r: r["thickness_mm"])[:6]
    for r in thin:
        critical.append({
            "dimension": f"{r['title']} wall {r['thickness_mm']:.2f} mm",
            "value": r["thickness_mm"],
            "unit": "mm",
            "where": r["title"],
            "why": f"only {r.get('through_thickness')} element(s) across this wall; "
                   f"below one, the mesh cannot bend properly and a solver setting "
                   f"(hourglass control) stands in for the material",
        })
    if wall.get("diameter"):
        critical.append({
            "dimension": f"impactor diameter {wall['diameter']:g} mm",
            "value": wall["diameter"],
            "unit": "mm",
            "where": wall.get("title") or "rigid wall",
            "why": "decides how concentrated the blow is, and so how much the beam "
                   "bends locally; this is the value a pole-impact test standard fixes",
        })
    bbox = deck.bounding_box()
    if bbox:
        critical.append({
            "dimension": "overall envelope "
                         + " x ".join(f"{v:.1f}" for v in bbox["size"]) + " mm",
            "value": bbox["size"],
            "unit": "mm",
            "where": "whole model",
            "why": "the space the design has to fit inside",
        })

    manufacturability = []
    for r in welds:
        sw = r["spotwelds"]
        manufacturability.append({
            "topic": f"spot-weld pitch on {r['title']}",
            "measured": f"{sw['pitch_mean_mm']:.1f} mm mean "
                        f"({sw['pitch_min_mm']:.1f} to {sw['pitch_max_mm']:.1f}), "
                        f"{sw['n_welds']} welds",
            "comment": "the spacing between spot welds. Closer welds make the joint "
                       "stiffer but take longer to produce. Worth checking against the "
                       "plant's welding standard before treating it as a design value.",
        })
    for gauge in sorted({round(r["thickness_mm"], 3) for r in sheets}):
        users = [r for r in sheets if round(r["thickness_mm"], 3) == gauge]
        grades = ", ".join(sorted({u["material_title"] or "?" for u in users}))
        manufacturability.append({
            "topic": f"{gauge:g} mm in {grades}",
            "measured": f"{len(users)} parts",
            "comment": "these steels can be pressed at this thickness, but the "
                       "stronger the steel, the more it springs back after pressing. "
                       "The model starts from the ideal pressed shape: the thinning and "
                       "locked-in stress that pressing leaves behind are not included.",
        })
    ratios = [
        (r["title"], r["element_size_mean_mm"] / r["thickness_mm"])
        for r in sheets if r.get("element_size_mean_mm") and r["thickness_mm"]
    ]
    if ratios:
        lo = min(v for _, v in ratios)
        hi = max(v for _, v in ratios)
        manufacturability.append({
            "topic": "mesh size against sheet gauge",
            "measured": f"element / thickness between {lo:.1f} and {hi:.1f}",
            "comment": "a fold cannot be shorter than one mesh element, so the way "
                       "the beam crumples is only captured down to about the element "
                       "size.",
        })

    tolerances = [
        {
            "topic": "the deck holds one nominal geometry",
            "detail": "Every dimension is one exact number. There is no variation in "
                      "thickness, weld position, material strength or assembly gaps.",
            "consequence": "The result is the answer for the ideal part. Real tests "
                           "scatter around it, and the model cannot say by how much.",
        },
        {
            "topic": "no forming or assembly history",
            "detail": "What pressing and welding do to a real part - thinner walls in "
                      "places, harder metal where it was bent, stress locked in by the "
                      "welds - is not in the model.",
            "consequence": "The modelled part is stronger than the real one in some "
                           "places and weaker in others.",
        },
        {
            "topic": "how a tolerance study would be run from here",
            "detail": "The deck is a plain text file, so thickness, speed, wall "
                      "position or any coordinate can be changed by a script. A "
                      "tolerance study is simply N copies of the deck with slightly "
                      "different values, each run once.",
            "consequence": "The cost is computer time, not modelling work: the same "
                           "script that builds v0.1 builds the copies.",
        },
    ]
    return {
        "critical_dimensions": critical,
        "manufacturability": manufacturability,
        "tolerances": tolerances,
    }


def _scenario(deck: Deck, engine: Deck, velocity: dict, wall: dict, gravity: dict,
              assembly: list[dict], run: dict) -> dict[str, Any]:
    total_mass = (run.get("starter") or {}).get("total_mass") or sum(
        r["mass_computed"] or 0 for r in assembly
    )
    rbody = next((c for c in deck.cards_of("RBODY")), None)
    lumped = _num(rbody.fields.get("MASS")) if rbody else None
    speed_ms = velocity.get("speed_ms")
    sc: dict[str, Any] = {
        "impact_speed_ms": speed_ms,
        "impact_speed_kmh": velocity.get("speed_kmh"),
        "total_mass_deck": total_mass,
        "lumped_mass": lumped,
        "termination": (engine.run or {}).get("Tstop"),
        "termination_unit": deck.units.time,
    }
    if speed_ms and total_mass:
        # Kinetic energy in the deck's own energy unit.
        sc["kinetic_energy_deck"] = 0.5 * total_mass * velocity["speed_deck"] ** 2
        sc["kinetic_energy_J"] = 0.5 * (
            total_mass * (1000.0 if deck.units.mass == "Mg" else 1.0)
        ) * speed_ms ** 2
    # A drop height describes a fall, so only when the body moves along gravity:
    # a car hitting a pole at 5 m/s is not "a 1.27 m drop", although gravity
    # is present and standard in that deck too.
    g_dir, v_dir = gravity.get("direction"), velocity.get("direction")
    along = float(np.dot(g_dir, v_dir)) if g_dir and v_dir else 0.0
    if speed_ms and gravity.get("matches_standard_g") and along > 0.9:
        sc["equivalent_drop_height_mm"] = speed_ms ** 2 / (2 * 9.81) * 1000.0
    if wall.get("node_distance_min") is not None:
        sc["gap_to_wall_mm"] = wall["node_distance_min"]
        if speed_ms:
            sc["time_to_contact_ms"] = wall["node_distance_min"] / (speed_ms * 1000.0) * 1000.0
    return sc


def analyze_model(model_dir: str | Path, run_subdir: str = "v0") -> dict[str, Any]:
    """Everything known about one model, as one JSON-serialisable dict.

    `run_subdir` names the version. v0 reads the original decks, in the
    model folder; a later version (`v0.1`) reads the patched decks written
    into its own folder, so every number in its report describes the deck
    that was actually run.
    """
    model_dir = Path(model_dir)
    deck_dir = model_dir
    if run_subdir != "v0" and any((model_dir / run_subdir).glob("*_0000.rad")):
        deck_dir = model_dir / run_subdir
    starter_path = next(iter(sorted(deck_dir.glob("*_0000.rad"))), None)
    engine_path = next(iter(sorted(deck_dir.glob("*_0001.rad"))), None)
    if starter_path is None:
        raise FileNotFoundError(f"no *_0000.rad in {model_dir}")

    deck = parse_deck(starter_path)
    engine = parse_deck(engine_path) if engine_path else Deck(path=model_dir, kind="engine")
    run = find_run(model_dir, run_subdir)

    velocity = _velocity_from_inivel(deck)
    gravity = _gravity(deck)
    wall = _rigid_wall(deck, velocity)
    materials = _materials(deck)
    failures = _failures(deck, materials)
    interfaces = _interfaces(deck)
    assembly = _assembly(deck, materials, run)
    scenario = _scenario(deck, engine, velocity, wall, gravity, assembly, run)

    engine_cards = {}
    for card in engine.cards:
        key = card.family
        if key in ("TFILE", "STOP", "DT", "ANIM", "H3D", "RUN"):
            engine_cards.setdefault(key, {}).update(card.fields or {})
        if key == "PARITH":
            engine_cards["PARITH_mode"] = card.subtype

    model: dict[str, Any] = {
        "name": model_dir.name,
        "version": run_subdir,
        "title": deck.title,
        "units": {
            "work": [deck.units.mass, deck.units.length, deck.units.time],
            "input": [deck.units.input_mass, deck.units.input_length, deck.units.input_time],
            "consistent": deck.units.consistent_input,
            "derived": deck.units.derived,
            "label": str(deck.units),
        },
        "starter": {
            "file": starter_path.name,
            "lines": deck.n_lines,
            "census": deck.census,
            "counts": deck.to_dict()["counts"],
            "bounding_box": deck.bounding_box(),
            "interfaces": interfaces,
        },
        "engine": {
            "file": engine_path.name if engine_path else None,
            "lines": engine.n_lines,
            "census": engine.census,
            "run": engine.run,
            "cards": engine_cards,
            "card_list": [
                {
                    "keyword": c.keyword,
                    "line": c.line,
                    "fields": c.fields,
                    "category": describe_keyword(c.keyword)[0],
                    "role": describe_keyword(c.keyword)[1],
                }
                for c in engine.cards
            ],
        },
        "scenario": scenario,
        "velocity": velocity,
        "gravity": gravity,
        "rigid_wall": wall,
        "materials": materials,
        "failures": failures,
        "assembly": assembly,
        "orphans": _orphans(deck),
        "keyword_roles": [
            {"keyword": k, "count": v, "category": describe_keyword("/" + k)[0],
             "role": describe_keyword("/" + k)[1]}
            for k, v in sorted(deck.census.items(), key=lambda kv: -kv[1])
        ],
        "undecoded": undecoded_fields(deck.cards + engine.cards),
    }
    attachment = _attachment(deck, assembly)
    model["starter"]["unattached_parts"] = attachment["unattached"]
    model["starter"]["interface_parts"] = attachment["per_interface"]
    model["engineering_review"] = _engineering_review(deck, assembly, wall)
    model["setup"] = _constraints_and_outputs(deck, assembly)

    ref = REFERENCE_MASS.get(model_dir.name)
    if ref:
        actual_g = (scenario.get("total_mass_deck") or 0) * (
            1e6 if deck.units.mass == "Mg" else 1e3
        )
        model["reference_mass"] = {
            "actual": actual_g,
            "actual_label": f"{actual_g:.0f} g",
            "expected": ref["expected_g"],
            "what": ref["what"],
            "evidence": f"Starter TOTAL MASS = {scenario.get('total_mass_deck'):.6g} "
                        f"{deck.units.mass} = {actual_g:.1f} g. Basis for the "
                        f"comparison: {ref['basis']}.",
        }

    cycles = run.pop("cycles", None)
    if cycles is not None and not cycles.empty:
        run["history"] = {
            "time": cycles.time.tolist(),
            "internal_energy": cycles.internal_energy.tolist(),
            "kinetic_energy": (cycles.kinetic_energy_t + cycles.kinetic_energy_r).tolist(),
            "external_work": cycles.external_work.tolist(),
            "error_pct": cycles.error_pct.tolist(),
            "mass_error": cycles.mass_error.tolist(),
            "time_step": cycles.time_step.tolist(),
        }
    model["run"] = run
    model["findings"] = findings_mod.detect(model)
    return model


def _jsonable(obj):
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if math.isnan(v) else v
    if isinstance(obj, np.ndarray):
        return _jsonable(obj.tolist())
    if isinstance(obj, float) and math.isnan(obj):
        return None
    if isinstance(obj, Path):
        return str(obj)
    return obj


def write_model_json(model: dict, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_jsonable(model), indent=1), encoding="utf-8")
    return path


__all__ = ["analyze_model", "write_model_json"]
