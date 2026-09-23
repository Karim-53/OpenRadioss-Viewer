"""Run the OpenRadioss Starter and Engine on a model, from Python.

The report never needs this: every step except Results is built from the
decks alone. It is here because a Starter listing is the one independent
check on the parser (node counts, per-part masses), and the Engine listing is
where the quality of a run actually lives.

Finding the solver, in this order:

1. the `--openradioss` argument,
2. the `OPENRADIOSS_PATH` environment variable,
3. a `starter_*` executable already on `PATH`,
4. a handful of usual unpack locations.

The environment it sets is the one the official `INSTALL.md` prescribes:
`RAD_CFG_PATH` (without it the Starter fails *inside the reader*, with an
error that looks like a deck problem), `RAD_H3D_PATH`, a 400 MB OpenMP stack,
and the bundled runtime libraries on the search path.

Every run leaves a `run_metadata.json` next to its output: which executables,
how many threads, how long, and the SHA-256 of the decks that went in - so a
number in the report can always be traced to the exact input that made it.
"""

from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path

EXECUTABLES = {
    "win32": {"starter": "starter_win64.exe", "engine": "engine_win64.exe",
              "anim_to_vtk": "anim_to_vtk_win64.exe", "th_to_csv": "th_to_csv_win64.exe"},
    "linux": {"starter": "starter_linux64_gf", "engine": "engine_linux64_gf",
              "anim_to_vtk": "anim_to_vtk_linux64_gf", "th_to_csv": "th_to_csv_linux64_gf"},
}
PLATFORM = "win32" if sys.platform.startswith("win") else "linux"

# Where people usually unpack the release. Checked only after the explicit
# options, and only for the presence of the Starter executable.
USUAL_PLACES = [
    Path.home() / "OpenRadioss",
    Path.home() / "OpenRadioss" / "OpenRadioss",
    Path("C:/OpenRadioss"), Path("C:/OpenRadioss/OpenRadioss"),
    Path("/opt/OpenRadioss"),
]

RELEASES_URL = "https://github.com/OpenRadioss/OpenRadioss/releases"
INSTALL_URL = "https://github.com/OpenRadioss/OpenRadioss/blob/main/INSTALL.md"


def _has_starter(root: Path) -> bool:
    return (root / "exec" / EXECUTABLES[PLATFORM]["starter"]).is_file()


def find_openradioss(explicit: str | Path | None = None) -> Path | None:
    """The unpacked release folder (the one holding `exec/` and `hm_cfg_files/`)."""
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    if os.environ.get("OPENRADIOSS_PATH"):
        candidates.append(Path(os.environ["OPENRADIOSS_PATH"]))
    on_path = shutil.which(EXECUTABLES[PLATFORM]["starter"])
    if on_path:
        candidates.append(Path(on_path).resolve().parent.parent)
    candidates.extend(USUAL_PLACES)
    for root in candidates:
        if _has_starter(root):
            return root.resolve()
    return None


def executable(root: Path, which: str) -> Path:
    return root / "exec" / EXECUTABLES[PLATFORM][which]


def solver_env(root: Path) -> dict[str, str]:
    """The environment `INSTALL.md` asks for, on top of the current one."""
    env = dict(os.environ)
    env["OPENRADIOSS_PATH"] = str(root)
    env["RAD_CFG_PATH"] = str(root / "hm_cfg_files")
    if PLATFORM == "win32":
        env["RAD_H3D_PATH"] = str(root / "extlib" / "h3d" / "lib" / "win64")
        env["KMP_STACKSIZE"] = "400m"
        extra = [root / "extlib" / "hm_reader" / "win64",
                 root / "extlib" / "intelOneAPI_runtime" / "win64"]
        env["PATH"] = os.pathsep.join([str(p) for p in extra] + [env.get("PATH", "")])
    else:
        env["RAD_H3D_PATH"] = str(root / "extlib" / "h3d" / "lib" / "linux64")
        env["OMP_STACKSIZE"] = "400m"
        extra = [root / "extlib" / "hm_reader" / "linux64", root / "extlib" / "h3d" / "lib" / "linux64"]
        env["LD_LIBRARY_PATH"] = os.pathsep.join(
            [str(p) for p in extra] + [env.get("LD_LIBRARY_PATH", "")])
    return env


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def _run(cmd: list[str], cwd: Path, env: dict, log: Path) -> dict:
    t0 = time.time()
    with open(log, "w", encoding="utf-8", errors="replace") as out:
        proc = subprocess.run(cmd, cwd=cwd, env=env, stdout=out, stderr=subprocess.STDOUT)
    return {"exit": proc.returncode, "seconds": round(time.time() - t0, 1),
            "command": " ".join([Path(cmd[0]).name] + cmd[1:]), "log": log.name}


def run_model(model_dir: str | Path, version: str = "v0", threads: int = 8,
              openradioss: str | Path | None = None, deck_dir: str | Path | None = None,
              engine: bool = True) -> dict:
    """Run one model's Starter and (optionally) Engine into `<model>/<version>/`.

    `deck_dir` is where the decks to run live: the model folder itself for v0
    (the original decks, copied - never run in place, so solver output
    never lands beside the originals), or `<model>/v0.1/` for a patched pair.
    """
    model_dir = Path(model_dir)
    root = find_openradioss(openradioss)
    if root is None:
        raise FileNotFoundError(
            "OpenRadioss not found. Set OPENRADIOSS_PATH to the unpacked release "
            f"(the folder holding exec/ and hm_cfg_files/). Download: {RELEASES_URL}")
    work = model_dir / version
    work.mkdir(parents=True, exist_ok=True)
    source = Path(deck_dir) if deck_dir else model_dir
    starter_deck = next(iter(sorted(source.glob("*_0000.rad"))))
    engine_deck = next(iter(sorted(source.glob("*_0001.rad"))), None)
    for deck in (starter_deck, engine_deck):
        if deck is not None and deck.parent.resolve() != work.resolve():
            shutil.copyfile(deck, work / deck.name)

    env = solver_env(root)
    meta = {
        "model": model_dir.name,
        "version": version,
        "solver": {"release_folder": root.name, "platform": platform.system(),
                   "starter": EXECUTABLES[PLATFORM]["starter"],
                   "engine": EXECUTABLES[PLATFORM]["engine"]},
        "threads": threads,
        "decks": {p.name: sha256(work / p.name) for p in (starter_deck, engine_deck) if p},
    }
    meta["starter"] = _run([str(executable(root, "starter")), "-i", starter_deck.name,
                            "-nt", str(threads), "-np", "1"],
                           work, env, work / "starter_stdout.txt")
    if engine and engine_deck is not None and meta["starter"]["exit"] == 0:
        meta["engine"] = _run([str(executable(root, "engine")), "-i", engine_deck.name,
                               "-nt", str(threads)], work, env, work / "engine_stdout.txt")
    (work / "run_metadata.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return meta


__all__ = ["EXECUTABLES", "INSTALL_URL", "RELEASES_URL", "executable", "find_openradioss",
           "run_model", "sha256", "solver_env"]
