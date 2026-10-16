"""Keep public/shots/ down to the screenshots the deck actually uses.

    python tools/prune_shots.py          # move unused PNGs out, bring used ones back
    python tools/prune_shots.py --dry    # only report

A screenshot counts as used when its file name appears in any file under src/.
Unused PNGs move to shots_unused/ (git-ignored, outside the build); a PNG that a
slide starts using again is moved back. shots.json stays complete: every entry
keeps its caption and gets a "location" field. The script also writes
src/data/shotDims.json ({file: [width, height]}) for the used screenshots,
which the <Shot> component needs to crop and place highlight boxes exactly.
"""
from __future__ import annotations

import json
import re
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "public" / "shots"
UNUSED = ROOT / "shots_unused"
SRC = ROOT / "src"
DIMS = SRC / "data" / "shotDims.json"


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as fh:
        head = fh.read(24)
    return struct.unpack(">II", head[16:24])


def used_names(manifest_files: set[str]) -> set[str]:
    text = "\n".join(p.read_text(encoding="utf-8") for p in SRC.rglob("*") if p.suffix in {".js", ".jsx"})
    found = set(re.findall(r"[A-Za-z0-9_.\-]+\.png", text))
    return found & manifest_files


def main() -> None:
    dry = "--dry" in sys.argv
    manifest_path = SHOTS / "shots.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    files = {s["file"] for s in manifest["shots"]}
    used = used_names(files)
    UNUSED.mkdir(exist_ok=True)

    moved_out = moved_back = 0
    for name in sorted(files):
        here, there = SHOTS / name, UNUSED / name
        if name in used and not here.exists() and there.exists():
            moved_back += 1
            if not dry:
                shutil.move(str(there), str(here))
        elif name not in used and here.exists():
            moved_out += 1
            if not dry:
                shutil.move(str(here), str(there))

    missing = sorted(n for n in used if not (SHOTS / n).exists() and not (UNUSED / n).exists())
    if missing:
        print("referenced but not found:", ", ".join(missing))

    if not dry:
        for shot in manifest["shots"]:
            shot["location"] = "public/shots" if shot["file"] in used else "shots_unused"
        text = json.dumps(manifest, indent=1, ensure_ascii=False) + "\n"
        manifest_path.write_text(text, encoding="utf-8")
        (UNUSED / "shots.json").write_text(text, encoding="utf-8")
        dims = {n: list(png_size(SHOTS / n)) for n in sorted(used) if (SHOTS / n).exists()}
        DIMS.parent.mkdir(parents=True, exist_ok=True)
        DIMS.write_text(json.dumps(dims, indent=1) + "\n", encoding="utf-8")

    print(f"{len(used)} used, {moved_out} moved to shots_unused/, {moved_back} moved back"
          + (" (dry run)" if dry else ""))


if __name__ == "__main__":
    main()
