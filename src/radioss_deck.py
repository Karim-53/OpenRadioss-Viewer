"""Read an OpenRadioss / Altair Radioss input deck without a CAE licence.

A deck is a flat text file of keyword blocks. A block starts at a line whose
first character is ``/`` and runs until the next such line::

    /MAT/PLAS_JOHNS/1
    Steel_DP600
    #              RHO_I
                 7.85E-6                   0
    #                  E                  Nu     Iflag
                     210                  .3         0

Two facts make this parseable generically, and both are used here:

1.  **The cards are fixed width on a ten-character ruler**, not whitespace
    separated. Blank fields are common, so ``line.split()`` silently shifts
    every value after a gap. The single worst case in these decks is the
    Johnson-Cook rate line, where a whitespace split moves ``Chard`` into
    ``c`` — turning a rate-independent steel into a rate-hardening one.

2.  **Altair writes a ``#`` comment above every card naming its fields**, right
    aligned to the same ruler. So the field layout does not have to be
    hard coded per keyword: the names and the column boundaries are both read
    off the header line. :func:`field_layout` is that rule, and it is the only
    place in this module that knows anything about the file format's geometry.

Everything else — materials, parts, contacts — is the same two functions with
different keywords, which is why adding a keyword costs nothing here.

**The Engine deck plays by different rules.** A Starter deck (``*_0000.rad``)
is fixed width; an Engine deck (``*_0001.rad``) is whitespace delimited, and
several of its cards carry no ``#`` header at all — including ``/RUN``, whose
unlabelled second line is the termination time, and ``/DT/NODA/CST``, whose
third field decides whether the model is mass scaled. Applying the Starter's
ruler to an Engine deck does not fail loudly; it yields ``TSTART = "0.000000
1"``. :func:`parse_deck` therefore detects which kind of deck it has (from the
presence of ``/BEGIN``) and switches rules, and ``Deck.kind`` says which.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from math import ceil
from pathlib import Path
from typing import Any, Iterator

import numpy as np

RULER = 10

# Element blocks: keyword -> (nodes per element, lines per element).
# TETRA10 writes the element id on its own line and the ten node ids on the next.
ELEMENT_BLOCKS = {
    "SHELL": (4, 1),
    "SH3N": (3, 1),
    "BRICK": (8, 1),
    "SPRING": (2, 1),
    "TRUSS": (2, 1),
    "BEAM": (2, 1),
    "TETRA4": (4, 1),
    "TETRA10": (10, 2),
    "QUAD": (4, 1),
}

_NUMERIC = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eEdD][+-]?\d+)?$")

# Engine cards that carry no `#` header line, so their field names cannot be
# read off the file. Values are positional; a name list shorter than the data
# line is fine (trailing values are kept as `extra`). The names follow the
# Radioss Engine reference for each card; `/RUN`'s second line is Tstop, and the
# third value of `/DT/NODA/CST` is the initial added-mass ratio.
ENGINE_HEADERLESS = {
    "/DT/NODA/CST": ["Tsca", "Tmin", "initial_mass_ratio"],
    "/DT/NODA": ["Tsca", "Tmin", "initial_mass_ratio"],
    "/DT/AMS": ["Tsca", "Tmin"],
    "/DT/BRICK/CST": ["Tsca", "Tmin"],
    "/DT/SHELL/CST": ["Tsca", "Tmin"],
    "/DT": ["Tsca", "Tmin"],
    "/RUN": ["Tstop"],
    "/TFILE": ["dT_HIS"],
    "/STOP": ["Emax", "Mmax", "Nmax", "NTH", "NANIM", "NERR_POSIT"],
    "/ADYREL": ["Tstart", "Tstop"],
    "/RFILE": ["n"],
}


def field_layout(header: str) -> list[tuple[str, int, int]]:
    """Turn a ``#`` field-name line into ``(name, start_col, end_col)`` slices.

    Every field ends on a multiple of ten, so a name's end column rounded up to
    the next multiple of ten *is* its field boundary. Names that round to the
    same boundary belong to one field and are joined — that is how ``Tra rot``
    in ``/BCS`` stays a single ten-character field instead of becoming two.

    >>> field_layout("#                  E                  Nu     Iflag")
    [('E', 0, 20), ('Nu', 20, 40), ('Iflag', 40, 50)]
    """
    boundaries: list[tuple[int, list[str]]] = []
    for match in re.finditer(r"\S+", header[1:]):
        end = ceil((match.end() + 1) / RULER) * RULER
        if boundaries and boundaries[-1][0] == end:
            boundaries[-1][1].append(match.group())
        else:
            boundaries.append((end, [match.group()]))
    layout, start = [], 0
    for end, names in boundaries:
        layout.append((" ".join(names), start, end))
        start = end
    return layout


def read_field(line: str, start: int, end: int) -> Any:
    """Slice one fixed-width field and coerce it. Blank stays ``None``."""
    raw = line[start:end].strip() if start < len(line) else ""
    if not raw:
        return None
    if _NUMERIC.match(raw):
        text = raw.replace("D", "E").replace("d", "e")
        if any(c in text for c in ".eE"):
            return float(text)
        return int(text)
    return raw


@dataclass
class Units:
    """The ``/BEGIN`` unit system. Radioss has no built-in units: this card is
    the only thing that gives every other number in the deck a meaning."""

    mass: str = ""
    length: str = ""
    time: str = ""
    input_mass: str = ""
    input_length: str = ""
    input_time: str = ""

    # (force, stress, energy) implied by the declared mass-length-time triple.
    _DERIVED = {
        ("kg", "mm", "ms"): ("kN", "GPa", "J"),
        ("Mg", "mm", "s"): ("N", "MPa", "mJ"),
        ("kg", "m", "s"): ("N", "Pa", "J"),
        ("g", "mm", "ms"): ("N", "MPa", "mJ"),
        ("t", "mm", "s"): ("N", "MPa", "mJ"),
    }

    @property
    def derived(self) -> dict[str, str]:
        force, stress, energy = self._DERIVED.get(
            (self.mass, self.length, self.time), ("?", "?", "?")
        )
        return {
            "force": force,
            "stress": stress,
            "energy": energy,
            "density": f"{self.mass}/{self.length}^3",
            "velocity": f"{self.length}/{self.time}",
        }

    @property
    def consistent_input(self) -> bool:
        """True when the input and work unit systems agree, so no conversion
        happens on read and the numbers in the file are the numbers used."""
        return (self.input_mass, self.input_length, self.input_time) == (
            self.mass,
            self.length,
            self.time,
        )

    def __str__(self) -> str:
        d = self.derived
        return (
            f"{self.mass}-{self.length}-{self.time} "
            f"(force {d['force']}, stress {d['stress']}, energy {d['energy']})"
        )


@dataclass
class Card:
    """One keyword block, parsed as far as its header comments allow."""

    keyword: str  # "/MAT/PLAS_JOHNS/1"
    family: str  # "MAT"
    subtype: str  # "PLAS_JOHNS"
    id: int | None
    title: str | None
    line: int  # 1-based line in the deck, for citing evidence
    fields: dict[str, Any] = field(default_factory=dict)
    rows: list[dict[str, Any]] = field(default_factory=list)  # tabulated cards
    # Group cards (/GRNOD, /SURF, /GRSHEL, /SUBSET) carry a plain list of ids
    # under their title with no `#` header to name anything. They are how every
    # interface, load and constraint in the deck says what it applies to, so
    # without them the model is a pile of parts with no connectivity.
    members: list[int] = field(default_factory=list)
    member_rows: list[list[int]] = field(default_factory=list)

    @property
    def path(self) -> str:
        return "/".join(x for x in (self.family, self.subtype) if x)


@dataclass
class Part:
    id: int
    title: str
    prop_id: int | None
    mat_id: int | None
    subset_id: int | None
    line: int
    element_types: dict[str, int] = field(default_factory=dict)
    node_ids: set[int] = field(default_factory=set)

    @property
    def n_elements(self) -> int:
        return sum(self.element_types.values())


@dataclass
class Deck:
    """A parsed Starter or Engine deck."""

    path: Path
    kind: str = "starter"  # "starter" (fixed width) | "engine" (free format)
    title: str = ""
    run: dict[str, Any] = field(default_factory=dict)  # engine only: name, run_number, Tstop
    units: Units = field(default_factory=Units)
    manual_version: int | None = None
    cards: list[Card] = field(default_factory=list)
    parts: dict[int, Part] = field(default_factory=dict)
    materials: dict[int, Card] = field(default_factory=dict)
    properties: dict[int, Card] = field(default_factory=dict)
    functions: dict[int, Card] = field(default_factory=dict)
    node_ids: np.ndarray = field(default_factory=lambda: np.empty(0, dtype=np.int64))
    node_xyz: np.ndarray = field(default_factory=lambda: np.empty((0, 3)))
    elements: dict[str, dict[int, np.ndarray]] = field(default_factory=dict)
    census: dict[str, int] = field(default_factory=dict)
    n_lines: int = 0

    # ---------------------------------------------------------------- queries

    @property
    def nodes(self) -> np.ndarray:
        return self.node_ids

    def element_counts(self) -> dict[str, int]:
        return {
            etype: int(sum(a.shape[0] for a in by_part.values()))
            for etype, by_part in self.elements.items()
        }

    def cards_of(self, family: str, subtype: str | None = None) -> list[Card]:
        return [
            c
            for c in self.cards
            if c.family == family and (subtype is None or c.subtype == subtype)
        ]

    def node_index(self) -> dict[int, int]:
        return {int(nid): i for i, nid in enumerate(self.node_ids)}

    def bounding_box(self) -> dict[str, list[float]]:
        if self.node_xyz.size == 0:
            return {}
        lo, hi = self.node_xyz.min(0), self.node_xyz.max(0)
        return {"min": lo.tolist(), "max": hi.tolist(), "size": (hi - lo).tolist()}

    def to_dict(self) -> dict[str, Any]:
        return {
            "file": self.path.name,
            "kind": self.kind,
            "title": self.title,
            "run": self.run,
            "lines": self.n_lines,
            "units": {
                "work": [self.units.mass, self.units.length, self.units.time],
                "input": [
                    self.units.input_mass,
                    self.units.input_length,
                    self.units.input_time,
                ],
                "consistent": self.units.consistent_input,
                "derived": self.units.derived,
                "label": str(self.units),
            },
            "manual_version": self.manual_version,
            "census": self.census,
            "counts": {
                "nodes": int(len(self.node_ids)),
                "parts": len(self.parts),
                "materials": len(self.materials),
                "properties": len(self.properties),
                "functions": len(self.functions),
                "elements": self.element_counts(),
            },
            "bounding_box": self.bounding_box(),
            "parts": [
                {
                    "id": p.id,
                    "title": p.title,
                    "prop_id": p.prop_id,
                    "mat_id": p.mat_id,
                    "subset_id": p.subset_id,
                    "line": p.line,
                    "elements": p.element_types,
                    "n_elements": p.n_elements,
                    "n_nodes": len(p.node_ids),
                }
                for p in self.parts.values()
            ],
            "cards": [
                {
                    "keyword": c.keyword,
                    "family": c.family,
                    "subtype": c.subtype,
                    "id": c.id,
                    "title": c.title,
                    "line": c.line,
                    "fields": c.fields,
                    "rows": c.rows,
                }
                for c in self.cards
            ],
        }


# --------------------------------------------------------------------- parsing


def _split_keyword(line: str) -> tuple[str, str, int | None]:
    """``/MAT/PLAS_JOHNS/1`` -> ``("MAT", "PLAS_JOHNS", 1)``."""
    parts = line.strip().split("/")[1:]
    if not parts:
        return "", "", None
    family = parts[0]
    ident = None
    subtype_parts = parts[1:]
    if subtype_parts and subtype_parts[-1].isdigit():
        ident = int(subtype_parts[-1])
        subtype_parts = subtype_parts[:-1]
    return family, "/".join(subtype_parts), ident


def iter_blocks(lines: list[str]) -> Iterator[tuple[int, str, list[str]]]:
    """Yield ``(1-based line number, keyword line, body lines)`` per block."""
    start = None
    for i, line in enumerate(lines):
        if line.startswith("/"):
            if start is not None:
                yield start + 1, lines[start], lines[start + 1 : i]
            start = i
    if start is not None:
        yield start + 1, lines[start], lines[start + 1 :]


def parse_card_body(body: list[str], want_rows: bool = False) -> tuple[dict, list[dict]]:
    """Read a card body as header/data pairs.

    A ``#`` line names the fields; the lines under it carry the values. With
    ``want_rows`` (tabulated cards such as ``/FUNCT``) every data line becomes
    its own row instead of being merged into one field dict.
    """
    fields: dict[str, Any] = {}
    rows: list[dict[str, Any]] = []
    layout: list[tuple[str, int, int]] = []
    seen: dict[str, int] = {}
    for raw in body:
        line = raw.rstrip("\n")
        if line.startswith("#"):
            layout = field_layout(line)
            continue
        if not line.strip() or not layout:
            continue
        values = {name: read_field(line, a, b) for name, a, b in layout}
        if want_rows:
            rows.append(values)
            continue
        for name, value in values.items():
            if name in fields:
                # Cards that repeat a block (springs repeat KTens/CTens per
                # direction) get suffixed names rather than losing the repeats.
                seen[name] = seen.get(name, 1) + 1
                fields[f"{name}#{seen[name]}"] = value
            else:
                fields[name] = value
    return fields, rows


def parse_engine_card_body(body: list[str], names: list[str] | None) -> dict[str, Any]:
    """Read an Engine card body, which is whitespace delimited, not fixed width.

    Field names come from the card's ``#`` header when it has one, and from
    :data:`ENGINE_HEADERLESS` when it does not. Values beyond the known names
    are kept under ``extra`` rather than dropped, so an unrecognised dialect
    still shows up in the report instead of vanishing.
    """
    fields: dict[str, Any] = {}
    header_names: list[str] | None = None
    values: list[Any] = []
    for raw in body:
        line = raw.rstrip("\n")
        if line.startswith("#"):
            # Free format: the header's names are whitespace separated too, so
            # the ten-character ruler must NOT be applied here. `/STOP`'s
            # header "# Emax Mmax Nmax NTH NANIM NERR_POSIT" packs six names
            # into 36 columns; the Starter rule would merge them into three.
            header_names = line[1:].split()
            continue
        if not line.strip():
            continue
        values.extend(read_field(tok, 0, len(tok)) for tok in line.split())

    if not values:
        return fields
    use = header_names or names or []
    for i, value in enumerate(values):
        if i < len(use):
            fields[use[i]] = value
        else:
            fields.setdefault("extra", []).append(value)
    return fields


def _parse_node_block(body: list[str]) -> tuple[np.ndarray, np.ndarray]:
    ids = np.empty(len(body), dtype=np.int64)
    xyz = np.empty((len(body), 3), dtype=np.float64)
    n = 0
    for raw in body:
        if not raw.strip() or raw.startswith("#"):
            continue
        try:
            ids[n] = int(raw[0:10])
            xyz[n, 0] = float(raw[10:30])
            xyz[n, 1] = float(raw[30:50])
            xyz[n, 2] = float(raw[50:70])
        except ValueError:
            continue
        n += 1
    return ids[:n], xyz[:n]


def _parse_element_block(body: list[str], nnodes: int, nlines: int) -> np.ndarray:
    """Return an ``(n_elements, 1 + nnodes)`` array of ``[elem_id, *node_ids]``."""
    data = [r for r in body if r.strip() and not r.startswith("#")]
    out = np.zeros((len(data), 1 + nnodes), dtype=np.int64)
    n = 0
    step = nlines
    for i in range(0, len(data), step):
        chunk = data[i : i + step]
        if len(chunk) < step:
            break
        if step == 1:
            row = chunk[0]
            try:
                out[n, 0] = int(row[0:10])
                for k in range(nnodes):
                    cell = row[10 * (k + 1) : 10 * (k + 2)].strip()
                    out[n, 1 + k] = int(cell) if cell else 0
            except ValueError:
                continue
        else:  # element id on its own line, connectivity on the next
            try:
                out[n, 0] = int(chunk[0][0:10])
                for k in range(nnodes):
                    cell = chunk[1][10 * k : 10 * (k + 1)].strip()
                    out[n, 1 + k] = int(cell) if cell else 0
            except ValueError:
                continue
        n += 1
    return out[:n]


TABULATED = {"FUNCT", "TABLE"}
# Families whose body is a bare list of ids on the ten-character ruler.
GROUP_FAMILIES = {
    "GRNOD", "SURF", "GRSHEL", "GRBRIC", "GRPART", "GRBEAM", "GRSPRI",
    "GRTRIA", "GRQUAD", "SUBSET", "LINE", "GRSH3N",
}


def parse_group_members(body: list[str]) -> tuple[list[int], list[list[int]]]:
    """Read a group card's id list as `(flat ids, rows)`.

    Both forms are needed. `/GRNOD/NODE` fills its rows edge to edge with node
    ids, so the flat list is the answer. `/SURF/SEG` writes one segment per
    row as `segment_id n1 n2 n3 [n4]`, so only columns 2 onward are nodes, and
    flattening it would mix element ids into a set of node ids.
    """
    flat: list[int] = []
    rows: list[list[int]] = []
    for raw in body:
        line = raw.rstrip("\n")
        if line.startswith("#") or not line.strip():
            continue
        row = []
        for start in range(0, len(line.rstrip()), RULER):
            cell = line[start : start + RULER].strip()
            if not cell:
                continue
            try:
                row.append(int(cell))
            except ValueError:
                row = []
                break
        if row:
            rows.append(row)
            flat.extend(row)
    return flat, rows
TITLED = {
    "MAT",
    "PROP",
    "PART",
    "INTER",
    "RWALL",
    "RBODY",
    "BCS",
    "INIVEL",
    "GRAV",
    "ACCEL",
    "SECT",
    "FUNCT",
    "SUBSET",
    "TH",
    "GRNOD",
    "SURF",
    "GRSHEL",
    "GRBRIC",
    "SENSOR",
    "IMPVEL",
    "IMPDISP",
    "CLOAD",
    "MONVOL",
    "SPHBCS",
    "FAIL",
}


def _engine_keyword_root(keyword: str) -> str:
    """Longest prefix of the keyword that names a headerless Engine card.

    ``/DT/NODA/CST/0`` -> ``/DT/NODA/CST``; ``/RUN/Cell_Phone_Drop/1/`` -> ``/RUN``.
    """
    parts = [p for p in keyword.strip().split("/") if p]
    for cut in range(len(parts), 0, -1):
        candidate = "/" + "/".join(parts[:cut])
        if candidate in ENGINE_HEADERLESS:
            return candidate
    return ""


def _parse_engine_deck(deck: Deck, lines: list[str]) -> Deck:
    """An Engine deck: a short list of free-format run-control cards."""
    deck.kind = "engine"
    for lineno, kwline, body in iter_blocks(lines):
        family, subtype, ident = _split_keyword(kwline)
        keyword = kwline.strip()
        deck.census[family] = deck.census.get(family, 0) + 1

        root = _engine_keyword_root(keyword)
        fields = parse_engine_card_body(body, ENGINE_HEADERLESS.get(root))

        if family == "RUN":
            # /RUN/<job name>/<run number>/ — the name can itself contain no
            # slash, so the trailing token is the run number.
            tokens = [t for t in keyword.split("/") if t]
            deck.run = {
                "name": tokens[1] if len(tokens) > 1 else "",
                "run_number": int(tokens[2]) if len(tokens) > 2 and tokens[2].isdigit() else None,
                "Tstop": fields.get("Tstop"),
            }
        deck.cards.append(
            Card(
                keyword=keyword,
                family=family,
                subtype=subtype,
                id=ident,
                title=None,
                line=lineno,
                fields=fields,
            )
        )
    return deck


def parse_deck(path: str | Path) -> Deck:
    """Parse a Starter (``*_0000.rad``) or Engine (``*_0001.rad``) deck.

    Which one it is decides the field-reading rules, so it is detected from the
    content — a Starter deck opens with ``/BEGIN`` — rather than from the file
    name, which a user is free to change.
    """
    path = Path(path)
    text = path.read_text(encoding="latin-1")
    lines = text.split("\n")
    deck = Deck(path=path, n_lines=len(lines))

    if not any(line.startswith("/BEGIN") for line in lines):
        return _parse_engine_deck(deck, lines)

    current_part: Part | None = None

    for lineno, kwline, body in iter_blocks(lines):
        family, subtype, ident = _split_keyword(kwline)
        keyword = kwline.strip()
        deck.census[family] = deck.census.get(family, 0) + 1

        if family == "BEGIN":
            data = [b for b in body if not b.startswith("#")]
            if data:
                deck.title = data[0].strip()
            if len(data) > 1:
                deck.manual_version = read_field(data[1], 0, 10)
            if len(data) > 2:
                deck.units.input_mass = data[2][0:20].strip()
                deck.units.input_length = data[2][20:40].strip()
                deck.units.input_time = data[2][40:60].strip()
            if len(data) > 3:
                deck.units.mass = data[3][0:20].strip()
                deck.units.length = data[3][20:40].strip()
                deck.units.time = data[3][40:60].strip()
            # Older decks write the work system first and omit the second line.
            if not deck.units.mass:
                deck.units.mass = deck.units.input_mass
                deck.units.length = deck.units.input_length
                deck.units.time = deck.units.input_time
            continue

        if family == "NODE":
            ids, xyz = _parse_node_block(body)
            deck.node_ids = ids
            deck.node_xyz = xyz
            continue

        if family in ELEMENT_BLOCKS:
            nnodes, nlines = ELEMENT_BLOCKS[family]
            conn = _parse_element_block(body, nnodes, nlines)
            deck.elements.setdefault(family, {})[ident or 0] = conn
            if current_part is not None and current_part.id == ident:
                current_part.element_types[family] = int(conn.shape[0])
                if conn.size:
                    current_part.node_ids.update(int(x) for x in conn[:, 1:].ravel() if x)
            continue

        if family == "PART":
            data = [b for b in body if not b.startswith("#") and b.strip()]
            title = data[0].strip() if data else ""
            ref = data[1] if len(data) > 1 else ""
            part = Part(
                id=ident or 0,
                title=title,
                prop_id=read_field(ref, 0, 10),
                mat_id=read_field(ref, 10, 20),
                subset_id=read_field(ref, 20, 30),
                line=lineno,
            )
            deck.parts[part.id] = part
            current_part = part
            continue

        # Every other keyword: a titled card whose fields come from its headers.
        data = [b for b in body if not b.startswith("#")]
        title = None
        if family in TITLED and data and data[0].strip() and not _looks_numeric(data[0]):
            title = data[0].strip()
            body = body[1:] if body and body[0] is data[0] else _drop_first_data(body)
        if family in GROUP_FAMILIES:
            fields, rows = {}, []
            members, member_rows = parse_group_members(body)
        else:
            fields, rows = parse_card_body(body, want_rows=family in TABULATED)
            members, member_rows = [], []
        card = Card(
            keyword=keyword,
            family=family,
            subtype=subtype,
            id=ident,
            title=title,
            line=lineno,
            fields=fields,
            rows=rows,
            members=members,
            member_rows=member_rows,
        )
        deck.cards.append(card)
        if family == "MAT" and ident is not None:
            deck.materials[ident] = card
        elif family == "PROP" and ident is not None:
            deck.properties[ident] = card
        elif family == "FUNCT" and ident is not None:
            deck.functions[ident] = card

    return deck


def _looks_numeric(line: str) -> bool:
    """A card's first body line is its title unless it is already data."""
    stripped = line.strip()
    if not stripped:
        return False
    return all(_NUMERIC.match(tok) for tok in stripped.split())


def _drop_first_data(body: list[str]) -> list[str]:
    for i, line in enumerate(body):
        if not line.startswith("#"):
            return body[:i] + body[i + 1 :]
    return body


__all__ = [
    "Card",
    "Deck",
    "Part",
    "Units",
    "field_layout",
    "parse_deck",
    "read_field",
]
