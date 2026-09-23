"""Turn a parsed deck into drawable surfaces and into measurable dimensions.

Two jobs, one module, because both need the same thing: the *outside* of each
part.

1.  **Drawing.** A solid mesh cannot be drawn as solids. Only the boundary
    faces — the ones belonging to exactly one element — are visible, and for
    the phone that is 130 218 solids reduced to roughly a tenth as many
    triangles. :func:`part_surface` is that reduction, done by hashing sorted
    face node-id tuples with numpy rather than a Python dict, because the naive
    version takes minutes on a 257 k-node model.

2.  **Measuring.** Once you have the outside of a part you can measure it, and
    the measurements are the ones a mechanical engineer asks for first:
    how thick is this wall, how big is the element that has to resolve it, how
    many elements sit through the thickness, how far apart are the spot welds.
    :func:`part_metrics` and :func:`spotweld_pitch` do that.

Element node orderings follow the Radioss manual: a BRICK's six quad faces from
its eight corner nodes, a TETRA10's four triangular faces from its first four
(corner) nodes — the six mid-side nodes are carried for the solver's shape
functions and are not vertices of the surface.
"""

from __future__ import annotations

import numpy as np

from .radioss_deck import Deck

# Faces of each solid element type, as indices into the element's node list.
SOLID_FACES = {
    # 8-node hexahedron, Radioss node order n1..n8.
    "BRICK": [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ],
    # 10-node tetrahedron: corner nodes only.
    "TETRA10": [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)],
    "TETRA4": [(0, 1, 2), (0, 1, 3), (0, 2, 3), (1, 2, 3)],
}
SHELL_FACES = {"SHELL": [(0, 1, 2, 3)], "SH3N": [(0, 1, 2)], "QUAD": [(0, 1, 2, 3)]}

# Real edges of each element type. Rolling the node list instead would include
# two face diagonals per hexahedron and inflate the characteristic size by
# about 15 %, which matters because element size is compared against wall
# thickness to decide whether a part can bend.
ELEMENT_EDGES = {
    "SHELL": [(0, 1), (1, 2), (2, 3), (3, 0)],
    "QUAD": [(0, 1), (1, 2), (2, 3), (3, 0)],
    "SH3N": [(0, 1), (1, 2), (2, 0)],
    "BRICK": [
        (0, 1), (1, 2), (2, 3), (3, 0),
        (4, 5), (5, 6), (6, 7), (7, 4),
        (0, 4), (1, 5), (2, 6), (3, 7),
    ],
    "TETRA10": [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)],
    "TETRA4": [(0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)],
}

# A part is a sheet if its elements are shells: then its thickness is a
# PROPERTY, not a dimension you can measure off the mesh. Its geometry is a
# mid-surface and its smallest bounding-box extent means nothing.
SHELL_TYPES = set(SHELL_FACES)


def _degenerate_quads(conn: np.ndarray) -> np.ndarray:
    """Quads whose last node repeats an earlier one: a collapsed element.

    Radioss accepts a hexahedron with coincident nodes and quietly treats it as
    a pentahedron. It is legal and it is also worth reporting, because a
    collapsed element is usually an artefact of the mesher rather than a
    decision, and it is often the element controlling the time step.
    """
    if conn.size == 0:
        return np.zeros(0, dtype=bool)
    nodes = conn[:, 1:]
    return np.array([len(set(row.tolist())) < nodes.shape[1] for row in nodes])


def _faces_of(conn: np.ndarray, etype: str) -> tuple[np.ndarray, np.ndarray]:
    """All faces of every element, as `(faces, owner_element_row)`.

    Quad faces are emitted as 4-node rows and triangles padded with -1 so the
    array stays rectangular; :func:`_boundary` sorts and de-duplicates on the
    padded form, which is what makes a triangle and a collapsed quad hash alike.
    """
    table = SOLID_FACES.get(etype) or SHELL_FACES.get(etype)
    if table is None or conn.size == 0:
        return np.zeros((0, 4), dtype=np.int64), np.zeros(0, dtype=np.int64)
    nodes = conn[:, 1:]
    out, owner = [], []
    for face in table:
        block = nodes[:, list(face)]
        if block.shape[1] == 3:
            block = np.hstack([block, np.full((block.shape[0], 1), -1, dtype=np.int64)])
        out.append(block)
        owner.append(np.arange(nodes.shape[0]))
    return np.vstack(out), np.concatenate(owner)


def _boundary(faces: np.ndarray) -> np.ndarray:
    """Keep the faces that appear exactly once: the outside of the part."""
    if faces.size == 0:
        return faces
    key = np.sort(faces, axis=1)
    view = np.ascontiguousarray(key).view(
        np.dtype((np.void, key.dtype.itemsize * key.shape[1]))
    ).ravel()
    _, index, counts = np.unique(view, return_index=True, return_counts=True)
    return faces[index[counts == 1]]


def _triangulate(faces: np.ndarray) -> np.ndarray:
    """Split quads into two triangles; pass triangles through."""
    if faces.size == 0:
        return np.zeros((0, 3), dtype=np.int64)
    tri_mask = faces[:, 3] < 0
    tris = [faces[tri_mask][:, :3]]
    quads = faces[~tri_mask]
    if quads.size:
        tris.append(quads[:, [0, 1, 2]])
        tris.append(quads[:, [0, 2, 3]])
    return np.vstack(tris)


def part_surface(deck: Deck, part_id: int) -> np.ndarray:
    """Drawable triangles of one part, as node ids (not indices)."""
    tris = []
    for etype, by_part in deck.elements.items():
        conn = by_part.get(part_id)
        if conn is None or conn.size == 0:
            continue
        if etype in SHELL_FACES:
            faces, _ = _faces_of(conn, etype)
            tris.append(_triangulate(faces))
        elif etype in SOLID_FACES:
            faces, _ = _faces_of(conn, etype)
            tris.append(_triangulate(_boundary(faces)))
    if not tris:
        return np.zeros((0, 3), dtype=np.int64)
    return np.vstack(tris)


def to_mesh(deck: Deck, tris: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Node ids -> `(vertices, faces)` with the vertex list compacted.

    Only the nodes a part actually uses are emitted, so a 17-part model does
    not ship 257 099 coordinates seventeen times.
    """
    if tris.size == 0:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64)
    index = deck.node_index()
    used = np.unique(tris)
    remap = {int(nid): i for i, nid in enumerate(used)}
    verts = np.array([deck.node_xyz[index[int(n)]] for n in used])
    faces = np.vectorize(remap.get)(tris)
    return verts, faces


def _element_sizes(deck: Deck, part_id: int) -> np.ndarray:
    """Characteristic size of every element of a part: its mean edge length."""
    index = deck.node_index()
    sizes = []
    for etype, by_part in deck.elements.items():
        conn = by_part.get(part_id)
        if conn is None or conn.size == 0:
            continue
        edges = ELEMENT_EDGES.get(etype)
        if edges is None:
            continue
        ncorner = max(max(e) for e in edges) + 1
        nodes = conn[:, 1 : 1 + ncorner]
        rows = np.array([[index.get(int(n), 0) for n in row] for row in nodes])
        pts = deck.node_xyz[rows]  # (n_elem, ncorner, 3)
        lengths = np.stack(
            [np.linalg.norm(pts[:, a, :] - pts[:, b, :], axis=1) for a, b in edges], axis=1
        )
        sizes.append(lengths.mean(axis=1))
    return np.concatenate(sizes) if sizes else np.zeros(0)


def _shell_thickness(deck: Deck, part_id: int) -> tuple[float | None, int | None]:
    """`(thickness, integration points)` from the part's `/PROP/SHELL` card."""
    part = deck.parts.get(part_id)
    if part is None or part.prop_id is None:
        return None, None
    prop = deck.properties.get(part.prop_id)
    if prop is None:
        return None, None
    thick = prop.fields.get("Thick")
    npt = prop.fields.get("N")
    return (float(thick) if isinstance(thick, (int, float)) else None,
            int(npt) if isinstance(npt, (int, float)) else None)


def part_metrics(deck: Deck, part_id: int) -> dict:
    """Geometry a mechanical engineer would measure off the part.

    `thickness_mm` is the smallest bounding-box dimension, which for a sheet,
    a board or a screen is the wall thickness; `elements_through_thickness`
    then says whether the mesh can carry bending across it. One element through
    a bending member is the classic under-resolved case: an under-integrated
    hexahedron has no bending stiffness at all except through hourglass control.
    """
    part = deck.parts.get(part_id)
    if part is None or not part.node_ids:
        return {}
    index = deck.node_index()
    rows = [index[n] for n in part.node_ids if n in index]
    pts = deck.node_xyz[rows]
    lo, hi = pts.min(0), pts.max(0)
    extent = hi - lo
    sizes = _element_sizes(deck, part_id)
    mean_size = float(sizes.mean()) if sizes.size else None

    is_shell = any(
        etype in SHELL_TYPES and part_id in by_part and by_part[part_id].size
        for etype, by_part in deck.elements.items()
    )
    if is_shell:
        thickness, npt = _shell_thickness(deck, part_id)
        source = "property card"
        through = npt  # a shell resolves bending by integration points, not elements
        through_kind = "integration points"
    else:
        thickness = float(extent.min())
        source = "smallest bounding-box extent"
        through = round(thickness / mean_size, 2) if mean_size else None
        through_kind = "elements"

    collapsed = 0
    for etype, by_part in deck.elements.items():
        conn = by_part.get(part_id)
        if conn is not None and conn.size and etype in ("BRICK", "SHELL"):
            collapsed += int(_degenerate_quads(conn).sum())
    return {
        "bbox_min": lo.tolist(),
        "bbox_max": hi.tolist(),
        "extent_mm": extent.tolist(),
        "footprint_mm": sorted(extent.tolist(), reverse=True)[:2],
        "is_shell": is_shell,
        "thickness_mm": thickness,
        "thickness_source": source,
        "element_size_mean_mm": mean_size,
        "element_size_min_mm": float(sizes.min()) if sizes.size else None,
        "element_size_max_mm": float(sizes.max()) if sizes.size else None,
        "through_thickness": through,
        "through_thickness_kind": through_kind,
        "collapsed_elements": collapsed,
        "n_nodes": len(part.node_ids),
    }


def _tet_volume(p0, p1, p2, p3) -> np.ndarray:
    return np.abs(np.einsum("ij,ij->i", np.cross(p1 - p0, p2 - p0), p3 - p0)) / 6.0


# A hexahedron split into five tetrahedra. Valid for any non-inverted hex and
# exact for a parallelepiped; for a warped hex it is the same approximation the
# solver's own one-point integration makes.
HEX_TETS = [(0, 1, 3, 4), (1, 2, 3, 6), (1, 3, 4, 6), (1, 4, 5, 6), (3, 4, 6, 7)]


def part_volume_and_area(deck: Deck, part_id: int) -> dict:
    """Mid-surface area (shells) or enclosed volume (solids) of one part.

    This is what makes an independent mass check possible: area x thickness x
    density for a sheet, volume x density for a solid, compared against the
    mass the Starter itself computed. Agreement means the parser read the
    geometry, the property and the density correctly, all three at once.
    """
    index = deck.node_index()
    area = 0.0
    volume = 0.0
    for etype, by_part in deck.elements.items():
        conn = by_part.get(part_id)
        if conn is None or conn.size == 0:
            continue
        if etype in ("SHELL", "QUAD", "SH3N"):
            n = 3 if etype == "SH3N" else 4
            rows = np.array([[index.get(int(v), 0) for v in row] for row in conn[:, 1 : 1 + n]])
            pts = deck.node_xyz[rows]
            tri = [(0, 1, 2)] if n == 3 else [(0, 1, 2), (0, 2, 3)]
            for a, b, c in tri:
                area += float(
                    np.linalg.norm(
                        np.cross(pts[:, b] - pts[:, a], pts[:, c] - pts[:, a]), axis=1
                    ).sum()
                    / 2.0
                )
        elif etype == "BRICK":
            rows = np.array([[index.get(int(v), 0) for v in row] for row in conn[:, 1:9]])
            pts = deck.node_xyz[rows]
            for a, b, c, d in HEX_TETS:
                volume += float(_tet_volume(pts[:, a], pts[:, b], pts[:, c], pts[:, d]).sum())
        elif etype in ("TETRA10", "TETRA4"):
            rows = np.array([[index.get(int(v), 0) for v in row] for row in conn[:, 1:5]])
            pts = deck.node_xyz[rows]
            volume += float(_tet_volume(pts[:, 0], pts[:, 1], pts[:, 2], pts[:, 3]).sum())
    return {"area_mm2": area, "volume_mm3": volume}


def spotweld_pitch(deck: Deck, part_id: int) -> dict:
    """Nearest-neighbour spacing of the spring elements of a spot-weld part.

    Weld pitch is a manufacturing decision, not a modelling one: it sets the
    flange stiffness and it is what a body engineer negotiates with the weld
    shop. Automotive practice is roughly 25 to 40 mm; a model whose pitch sits
    far outside that is either a placeholder or a change nobody costed.
    """
    conn = deck.elements.get("SPRING", {}).get(part_id)
    if conn is None or conn.size < 2:
        return {}
    index = deck.node_index()
    first = np.array([deck.node_xyz[index[int(n)]] for n in conn[:, 1] if int(n) in index])
    if first.shape[0] < 2:
        return {}
    d = np.linalg.norm(first[:, None, :] - first[None, :, :], axis=2)
    np.fill_diagonal(d, np.inf)
    nearest = d.min(axis=1)
    return {
        "n_welds": int(conn.shape[0]),
        "pitch_min_mm": float(nearest.min()),
        "pitch_mean_mm": float(nearest.mean()),
        "pitch_max_mm": float(nearest.max()),
    }


def signed_distance_to_plane(deck: Deck, point, normal) -> np.ndarray:
    """Signed distance of every node to a plane — how the rigid wall is placed."""
    point = np.asarray(point, dtype=float)
    normal = np.asarray(normal, dtype=float)
    normal = normal / np.linalg.norm(normal)
    return (deck.node_xyz - point) @ normal


__all__ = [
    "part_volume_and_area",
    "part_surface",
    "part_metrics",
    "spotweld_pitch",
    "signed_distance_to_plane",
    "to_mesh",
]
