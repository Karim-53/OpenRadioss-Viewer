"""Rewrite a deck without opening it by hand.

This is the mechanism behind three different things that look unrelated:

* **v0.1** - the deck with the findings fixed, built from `interaction.txt`.
* **A tolerance study** - the same deck with a thickness sampled from a
  distribution, N times.
* **A surrogate training set** - the same deck with a design variable swept,
  N times, which is exactly what NVIDIA's public OpenRadioss recipe does to
  these two decks.

They are the same operation: locate a field, replace it, write a new file. The
only difference is where the new value comes from.

Two rules make it safe:

1. **The pristine deck is never opened for writing.** Every edit reads the
   original and writes a new file somewhere else. The originals' SHA-256 is
   asserted by the test suite.
2. **An edit that does not match refuses to run.** Every edit names what it
   expects to find, and a mismatch raises rather than silently producing a
   deck that looks patched and is not - the failure mode that makes a sweep of
   200 runs quietly meaningless.

Addressing a field
------------------

A Starter card is fixed width, so a field is `(keyword, occurrence, line
offset, column slice)`. That is verbose to write by hand, so the helpers below
name the fields worth changing:

    set_shell_thickness(deck, prop_id=1, value=2.4)
    set_initial_velocity(deck, (-5.5, 0, 0))
    set_rigid_wall_diameter(deck, 300.0)

An Engine card is free format, so it is addressed by keyword and token index:

    set_termination_time(deck, 2e-3)
    set_time_history_interval(deck, 1e-5)
    add_card(deck, "/STOP", ["0.10 0.05 0 1 1 1"], after="/RUN")
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .radioss_deck import field_layout

RULER = 10


@dataclass
class Edit:
    """One change, with enough context to prove it landed where it meant to."""

    what: str                      # human description, used in the diff header
    expect: str                    # what the field holds now; "" means unchecked
    apply: Callable[[list[str]], list[str]]
    reason: str = ""               # which finding asked for it


@dataclass
class Deck:
    """A deck held in memory, so several edits compose before anything is written."""

    path: Path
    lines: list[str]
    edits: list[Edit] = field(default_factory=list)
    newline: str = "\n"            # written back as found: one of these decks is CRLF

    @classmethod
    def read(cls, path: str | Path) -> "Deck":
        path = Path(path)
        raw = path.read_bytes().decode("latin-1")
        newline = "\r\n" if "\r\n" in raw[:4096] else "\n"
        return cls(path=path, lines=raw.replace("\r\n", "\n").split("\n"), newline=newline)

    def apply_all(self) -> "Deck":
        lines = list(self.lines)
        for edit in self.edits:
            lines = edit.apply(lines)
        return Deck(path=self.path, lines=lines, newline=self.newline)

    def write(self, out_path: str | Path) -> Path:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="latin-1", newline="") as fh:
            fh.write(self.newline.join(self.apply_all().lines))
        return out_path

    def diff(self, before: str = "original", after: str = "v0.1") -> str:
        return "\n".join(difflib.unified_diff(
            self.lines, self.apply_all().lines,
            fromfile=f"{self.path.name} ({before})",
            tofile=f"{self.path.name} ({after})", lineterm="", n=2,
        ))

    def summary(self) -> str:
        return "\n".join(
            f"  {i + 1}. {e.what}" + (f"   [{e.reason}]" if e.reason else "")
            for i, e in enumerate(self.edits)
        )


# ------------------------------------------------------------------ locating


def find_card(lines: list[str], keyword: str, occurrence: int = 0) -> int:
    """Line index of a card, matching the whole keyword or its prefix."""
    hits = [
        i for i, line in enumerate(lines)
        if line.startswith(keyword) and (
            len(line.strip()) == len(keyword) or line[len(keyword):len(keyword) + 1] in ("/", "", " ")
        )
    ]
    if len(hits) <= occurrence:
        raise LookupError(f"{keyword} occurrence {occurrence} not found in {len(lines)} lines")
    return hits[occurrence]


def _data_lines_after(lines: list[str], start: int) -> list[int]:
    """Indices of the value lines of a card, skipping its `#` headers."""
    out = []
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("/"):
            break
        if lines[i].startswith("#") or not lines[i].strip():
            continue
        out.append(i)
    return out


def _set_fixed_field(line: str, index: int, value, width: int = RULER) -> str:
    """Replace one right-aligned fixed-width field, keeping the ruler intact."""
    start = index * width
    text = value if isinstance(value, str) else _fmt(value)
    if len(text) > width:
        raise ValueError(f"{text!r} does not fit in a {width}-character field")
    padded = line.ljust(start + width)
    return padded[:start] + text.rjust(width) + padded[start + width:]


def _fmt(value) -> str:
    if isinstance(value, int):
        return str(value)
    text = f"{value:g}"
    return text


# -------------------------------------------------------- the named mutations
# These are the fields worth changing in an impact deck. Each is a design
# variable for a sweep and a fix for a finding, depending on where the value
# comes from.


def set_termination_time(deck: Deck, value: float, reason: str = "") -> Deck:
    """`/RUN` - how long the run lasts. The Engine deck is free format."""
    def apply(lines):
        i = find_card(lines, "/RUN")
        data = _data_lines_after(lines, i)
        if not data:
            raise LookupError("/RUN has no value line")
        lines = list(lines)
        lines[data[0]] = f"{_fmt(value):>20}"
        return lines
    i = find_card(deck.lines, "/RUN")
    now = deck.lines[_data_lines_after(deck.lines, i)[0]].strip()
    deck.edits.append(Edit(
        what=f"termination time {now} -> {_fmt(value)}",
        expect=now, apply=apply, reason=reason))
    return deck


def set_time_history_interval(deck: Deck, value: float, reason: str = "") -> Deck:
    """`/TFILE` - how often a time-history record is written."""
    def apply(lines):
        i = find_card(lines, "/TFILE")
        data = _data_lines_after(lines, i)
        lines = list(lines)
        lines[data[0]] = f"{_fmt(value):>20}"
        return lines
    i = find_card(deck.lines, "/TFILE")
    now = deck.lines[_data_lines_after(deck.lines, i)[0]].strip()
    deck.edits.append(Edit(
        what=f"time-history interval {now} -> {_fmt(value)}",
        expect=now, apply=apply, reason=reason))
    return deck


def set_animation_interval(deck: Deck, value: float, reason: str = "") -> Deck:
    """`/ANIM/DT` or `/H3D/DT` - how often a full field snapshot is written."""
    keyword = "/ANIM/DT" if any(l.startswith("/ANIM/DT") for l in deck.lines) else "/H3D/DT"
    def apply(lines):
        i = find_card(lines, keyword)
        data = _data_lines_after(lines, i)
        lines = list(lines)
        tstart = lines[data[0]].split()[0] if lines[data[0]].split() else "0.000000"
        lines[data[0]] = f"{tstart} {_fmt(value)}"
        return lines
    deck.edits.append(Edit(
        what=f"{keyword} interval -> {_fmt(value)}", expect="", apply=apply, reason=reason))
    return deck


def add_card(deck: Deck, keyword: str, body: list[str], after: str,
             reason: str = "") -> Deck:
    """Insert a card that the deck does not have, after an existing one."""
    def apply(lines):
        i = find_card(lines, after)
        end = i + 1
        while end < len(lines) and not lines[end].startswith("/"):
            end += 1
        return lines[:end] + [keyword] + list(body) + lines[end:]
    deck.edits.append(Edit(
        what=f"add {keyword} after {after}", expect="", apply=apply, reason=reason))
    return deck


def replace_card_keyword(deck: Deck, old: str, new: str, reason: str = "") -> Deck:
    """Swap one keyword line for another, e.g. `/PARITH/OFF` -> `/PARITH/ON`."""
    def apply(lines):
        i = find_card(lines, old)
        lines = list(lines)
        lines[i] = new
        return lines
    deck.edits.append(Edit(what=f"{old} -> {new}", expect=old, apply=apply, reason=reason))
    return deck


def _header_above(lines: list[str], index: int) -> str | None:
    """The `#` field-name line that labels the value line at `index`.

    Rulers (`#---1----|`) and blank comments are skipped; the first `#` line
    with letters in it, walking upward without crossing a card, is the header.
    """
    j = index - 1
    while j >= 0 and not lines[j].startswith("/"):
        line = lines[j]
        if line.startswith("#") and re.search(r"[A-Za-z]", line) and "----|" not in line:
            return line
        j -= 1
    return None


def locate_field(lines: list[str], keyword: str, name: str,
                 occurrence: int = 0) -> tuple[int, int, int]:
    """`(line index, start column, end column)` of a named Starter field.

    This is the same rule the parser reads with: the `#` header above each
    value line names its fields, and a name's end column rounded up to the
    next multiple of ten is the field boundary. Addressing a field by name
    instead of by hard-coded offset is what keeps an edit from landing in the
    neighbouring field when a card has a 20-wide field before it.
    """
    card = find_card(lines, keyword, occurrence)
    for i in _data_lines_after(lines, card):
        header = _header_above(lines, i)
        if header is None:
            continue
        for field_name, start, end in field_layout(header):
            if name in field_name.split():
                return i, start, end
    raise LookupError(f"{keyword} has no field named {name!r}")


def set_field(deck: Deck, keyword: str, name: str, value, reason: str = "",
              unit: str = "", occurrence: int = 0) -> Deck:
    """Set one named field of a fixed-width Starter card.

    The value found now is recorded, and the edit refuses to apply if the
    field holds something else by the time it runs.
    """
    i, start, end = locate_field(deck.lines, keyword, name, occurrence)
    now = deck.lines[i][start:end].strip()
    text = value if isinstance(value, str) else _fmt(value)
    if len(text) > end - start:
        raise ValueError(f"{text!r} does not fit in {keyword} {name} ({end - start} characters)")

    def apply(lines):
        i2, s2, e2 = locate_field(lines, keyword, name, occurrence)
        current = lines[i2][s2:e2].strip()
        if current != now:
            raise ValueError(f"{keyword} {name}: expected {now!r}, found {current!r}")
        lines = list(lines)
        padded = lines[i2].ljust(e2)
        lines[i2] = padded[:s2] + text.rjust(e2 - s2) + padded[e2:]
        return lines

    deck.edits.append(Edit(
        what=f"{keyword} {name} {now or '(blank)'} -> {text}{(' ' + unit) if unit else ''}",
        expect=now, apply=apply, reason=reason))
    return deck


def set_shell_thickness(deck: Deck, prop_id: int, value: float, reason: str = "") -> Deck:
    """`/PROP/SHELL` sheet gauge - the classic design variable of a crash
    structure: it sets the fold load, the mass and most of the cost at once."""
    return set_field(deck, f"/PROP/SHELL/{prop_id}", "Thick", value, reason, unit="mm")


def set_initial_velocity(deck: Deck, vector, reason: str = "") -> Deck:
    """`/INIVEL/TRA` - impact speed and direction, the other classic variable."""
    for axis, v in zip(("Vx", "Vy", "Vz"), vector):
        set_field(deck, "/INIVEL", axis, v, reason)
    return deck


def set_rigid_wall_diameter(deck: Deck, value: float, reason: str = "") -> Deck:
    """`/RWALL/CYL` pole diameter."""
    return set_field(deck, "/RWALL", "Diameter", value, reason, unit="mm")


def set_rigid_wall_search(deck: Deck, value: float, reason: str = "") -> Deck:
    """`/RWALL` D_search: which nodes the wall watches, fixed at t = 0."""
    return set_field(deck, "/RWALL", "D_search", value, reason, unit="mm")


def set_failure_preset(deck: Deck, fail_id: int, m_flag: int, reason: str = "") -> Deck:
    """`/FAIL/BIQUAD` M_Flag, the calibrated failure curve per material class.

    It sits after the 20-wide `P_thick_fail`, i.e. in columns 21-30 - which
    is exactly the kind of place a hard-coded "field 2 of 10" lands wrong.
    """
    return set_field(deck, f"/FAIL/BIQUAD/{fail_id}", "M_Flag", int(m_flag), reason)


def insert_before(deck: Deck, block: list[str], before: str = "/END",
                  what: str = "", reason: str = "") -> Deck:
    """Insert whole cards (e.g. `/TH/PART`, a new interface) ahead of a card."""
    def apply(lines):
        i = find_card(lines, before)
        return lines[:i] + list(block) + lines[i:]
    deck.edits.append(Edit(
        what=what or f"add {block[0].strip()} before {before}", expect="",
        apply=apply, reason=reason))
    return deck


def fixed_row(values, width: int = RULER) -> str:
    """One value line on the ten-character ruler, right-aligned per field."""
    return "".join(f"{_fmt(v) if not isinstance(v, str) else v:>{width}}" for v in values)


# ------------------------------------------------------------- deck.diff


def split_diff(text: str) -> dict[str, list[str]]:
    """`{deck file name: its hunk lines}` from a deck.diff holding one or more files."""
    lines = text.split("\n")
    out: dict[str, list[str]] = {}
    current = None
    for i, line in enumerate(lines):
        if line.startswith("--- ") and i + 1 < len(lines) and lines[i + 1].startswith("+++ "):
            current = line[4:].split(" (", 1)[0]
            out[current] = []
            continue
        if current is not None and not line.startswith("+++ "):
            out[current].append(line)
    return out


def apply_unified_diff(lines: list[str], hunks: list[str]) -> list[str]:
    """Replay one file's hunks onto its original lines, checking every context line.

    A version folder can then ship without its patched decks (the phone's is
    42 MB): the diff is the exact record of what ran, and replaying it onto the
    pristine deck gives that deck back byte for byte. A context or removed line
    that does not match raises instead of producing a plausible wrong deck.
    """
    hunks = list(hunks)
    while hunks and hunks[-1] == "":        # the file's final newline, not a context line
        hunks.pop()
    out: list[str] = []
    src = 0
    i = 0
    while i < len(hunks):
        m = re.match(r"@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@", hunks[i])
        if not m:
            i += 1
            continue
        count = int(m.group(2)) if m.group(2) is not None else 1
        start = int(m.group(1)) - 1 if count else int(m.group(1))
        out.extend(lines[src:start])
        src = start
        i += 1
        while i < len(hunks) and not hunks[i].startswith("@@"):
            line = hunks[i]
            tag, body = (line[:1], line[1:]) if line else (" ", "")
            if tag in (" ", "-"):
                if src >= len(lines) or lines[src] != body:
                    raise ValueError(f"diff does not match the deck at line {src + 1}")
                if tag == " ":
                    out.append(body)
                src += 1
            elif tag == "+":
                out.append(body)
            i += 1
    out.extend(lines[src:])
    return out


def restore_version(model_dir: str | Path, version: str) -> list[Path]:
    """Recreate `<model>/<version>/*.rad` from the pristine decks and `deck.diff`."""
    model_dir = Path(model_dir)
    folder = model_dir / version
    sections = split_diff((folder / "deck.diff").read_text(encoding="utf-8"))
    written = []
    for name, hunks in sections.items():
        original = Deck.read(model_dir / name)
        restored = Deck(path=original.path, lines=apply_unified_diff(original.lines, hunks),
                        newline=original.newline)
        # The restored deck must diff back to exactly the recorded hunks.
        regenerated = list(difflib.unified_diff(original.lines, restored.lines,
                                                lineterm="", n=2))[2:]
        recorded = list(hunks)
        while recorded and recorded[-1] == "":
            recorded.pop()
        if regenerated != recorded:
            raise ValueError(f"{version}/{name}: the restored deck does not reproduce deck.diff")
        written.append(restored.write(folder / name))
    return written


# ------------------------------------------------------------- interaction.txt


def read_interaction(path: str | Path) -> list[dict]:
    """Parse the answers the report downloaded into blocks."""
    text = Path(path).read_text(encoding="utf-8")
    blocks, current, key = [], {}, None
    for raw in text.split("\n"):
        if raw.startswith("#"):
            continue
        if not raw.strip():
            if current:
                blocks.append(current)
            current, key = {}, None
            continue
        if raw.startswith("  ") and key:
            current[key] = (current.get(key, "") + "\n" + raw[2:]).strip("\n")
            continue
        if ":" in raw:
            key, _, value = raw.partition(":")
            key = key.strip()
            current[key] = value.strip()
    if current:
        blocks.append(current)
    return blocks


__all__ = [
    "Deck", "Edit", "add_card", "find_card", "fixed_row", "insert_before",
    "locate_field", "read_interaction", "set_field",
    "replace_card_keyword", "set_animation_interval", "set_failure_preset",
    "set_initial_velocity", "set_rigid_wall_diameter", "set_rigid_wall_search",
    "set_shell_thickness", "set_termination_time", "set_time_history_interval",
]
