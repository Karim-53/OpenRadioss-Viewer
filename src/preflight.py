"""What is installed, what is missing, and what each missing piece costs.

`python src/main.py --check` prints this and exits. The agent skill runs it
right after reading the decks and before touching anything else, so that
nothing is installed without the user saying yes: every missing piece comes
with the exact command that would install it, and the skill asks before
running any of them.

Three tiers, because not everything is needed for everything:

* **required** - Python and the pinned packages. Without them nothing runs.
* **solver** - OpenRadioss. Needed only to run a deck and to convert its
  animation frames; the report is built from the decks alone without it.
* **video** - the ffmpeg binary that `imageio-ffmpeg` bundles. Needed only
  for the MP4.
"""

from __future__ import annotations

import importlib
import importlib.metadata as md
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIN_PYTHON = (3, 12)          # numpy 2.5.0, as pinned, requires 3.12

# import name -> distribution name, where they differ
IMPORT_NAME = {"imageio-ffmpeg": "imageio_ffmpeg"}


def _requirements() -> list[tuple[str, str]]:
    out = []
    for line in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        m = re.match(r"([A-Za-z0-9_.-]+)\s*==\s*([^\s;]+)", line)
        if m:
            out.append((m.group(1), m.group(2)))
    return out


def check(openradioss: str | None = None) -> dict:
    """Everything, as data. `ok` is False only when a *required* piece is missing."""
    items = []
    py_ok = sys.version_info[:2] >= MIN_PYTHON
    items.append({
        "tier": "required", "what": "Python", "found": sys.version.split()[0],
        "want": ">= " + ".".join(map(str, MIN_PYTHON)), "ok": py_ok,
        "install": "https://www.python.org/downloads/ (3.12 is what this was tested on)",
    })
    for dist, pinned in _requirements():
        mod = IMPORT_NAME.get(dist, dist.lower())
        try:
            importlib.import_module(mod)
            found = md.version(dist)
            ok = True
        except Exception:
            found, ok = None, False
        items.append({
            # pytest runs the checks, not the pipeline: missing it blocks nothing
            "tier": "tests" if dist == "pytest" else "required",
            "what": dist, "found": found, "want": pinned, "ok": ok,
            "note": "" if not ok or found == pinned else "different version from the pin; usually fine",
            "install": f"python -m pip install {dist}=={pinned}",
        })

    from .solver import INSTALL_URL, RELEASES_URL, find_openradioss
    root = find_openradioss(openradioss)
    items.append({
        "tier": "solver", "what": "OpenRadioss", "found": str(root.name) if root else None,
        "want": "any recent release", "ok": root is not None,
        "install": (f"download the release zip for your platform from {RELEASES_URL}, unpack it, "
                    f"and set OPENRADIOSS_PATH to the unpacked folder (see {INSTALL_URL})"),
    })
    try:
        import imageio_ffmpeg
        ff = Path(imageio_ffmpeg.get_ffmpeg_exe()).name
        ff_ok = True
    except Exception:
        ff, ff_ok = None, False
    items.append({"tier": "video", "what": "ffmpeg (bundled by imageio-ffmpeg)", "found": ff,
                  "want": "present", "ok": ff_ok,
                  "install": "python -m pip install imageio-ffmpeg"})
    ok = all(i["ok"] for i in items if i["tier"] == "required")
    return {"ok": ok, "items": items,
            "solver_available": root is not None, "video_available": ff_ok,
            "openradioss_path": str(root) if root else None}


def report(result: dict) -> str:
    lines = ["What this needs, and what is here:", ""]
    for i in result["items"]:
        mark = "ok     " if i["ok"] else "MISSING"
        extra = f"  ({i['note']})" if i.get("note") else ""
        lines.append(f"  [{mark}] {i['tier']:<8} {i['what']:<36} found {i['found'] or '-'}"
                     f"  want {i['want']}{extra}")
    missing = [i for i in result["items"] if not i["ok"]]
    if missing:
        lines += ["", "To install what is missing (nothing is installed without asking):"]
        for i in missing:
            lines.append(f"  - {i['what']}: {i['install']}")
    if not result["solver_available"]:
        lines += ["", "Without OpenRadioss the report is still built from the decks; the Results "
                      "step, the video and v0.1's re-run need it."]
    return "\n".join(lines)


def main() -> int:
    result = check()
    if "--json" in sys.argv:
        print(json.dumps(result, indent=1))
    else:
        print(report(result))
    return 0 if result["ok"] else 1


__all__ = ["check", "report"]
