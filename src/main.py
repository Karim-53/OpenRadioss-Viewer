"""The one command. Everything else in src/ is a module this calls.

    python src/main.py                 read every model's decks, build index.html
    python src/main.py --check         what is installed and what is missing; changes nothing
    python src/main.py --run           also run the solver on the original decks (v0)
    python src/main.py --media         also render stills and a video from the saved frames
    python src/main.py --v01           also write v0.1: the decks with the findings fixed
    python src/main.py --v01 --run     ... and run v0.1 as well
    python src/main.py --all           all of the above, in order
    python src/main.py --model Cell_Phone_Drop     one model only (repeatable)

    python src/main.py --model Cell_Phone_Drop --build v0.2 --run \
        --answer "run_ends_before_the_physics=lengthen to 5.0 ms"
                                       another version: v0.1's fixes with one answer changed
    python src/main.py --model Bumper_Beam --sweep thickness_scale=0.8,1.2 --run
                                       a design study from v0.1: one run per value

A "model" is any folder next to src/ that holds a `*_0000.rad`. Each gets
`report/`, `media/` and one folder per version (`v0/`, `v0.1/`) for solver
output. The original decks are never modified.

v0.1 takes its fixes from `interaction.txt` (the answers saved from the
report's Findings step) when that file exists next to src/, and from each
finding's recommended choice otherwise.

Opening `index.html` afterwards needs nothing: no server, no network.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if __package__ in (None, ""):          # run as `python src/main.py`
    sys.path.insert(0, str(ROOT))

from src import preflight  # noqa: E402


def discover(root: Path) -> list[Path]:
    """Every folder holding a Starter deck is a model."""
    return sorted(
        d for d in root.iterdir()
        if d.is_dir() and not d.name.startswith((".", "_"))
        and any(d.glob("*_0000.rad"))
    )


def versions_of(model_dir: Path) -> list[str]:
    """v0 always; any `v*/` folder that holds its own patched decks after it."""
    extra = sorted(d.name for d in model_dir.iterdir()
                   if d.is_dir() and d.name.startswith("v") and d.name != "v0"
                   and any(d.glob("*_0000.rad")))
    return ["v0"] + extra


def _has_run(model_dir: Path, version: str) -> bool:
    return any((model_dir / version).glob("*_0001.out"))


def _count(findings: list[dict]) -> str:
    sev = {}
    for f in findings:
        sev[f["severity"]] = sev.get(f["severity"], 0) + 1
    return f"{sev.get('error', 0)} error, {sev.get('warning', 0)} warning, {sev.get('info', 0)} info"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report what is installed, then stop")
    ap.add_argument("--model", action="append", help="model folder name; repeatable")
    ap.add_argument("--root", default=str(ROOT), help="folder holding the model folders")
    ap.add_argument("--run", action="store_true", help="run the solver (needs OpenRadioss)")
    ap.add_argument("--rerun", action="store_true", help="run again even if output exists")
    ap.add_argument("--media", action="store_true", help="stills and video from animation frames")
    ap.add_argument("--v01", action="store_true", help="write the fixed decks into <model>/v0.1/")
    ap.add_argument("--build", metavar="VERSION",
                    help="write another fixed version the same way, e.g. v0.2 (with --answer)")
    ap.add_argument("--answer", action="append", default=[], metavar="RULE=ANSWER",
                    help="override one answer for --build, e.g. "
                         "'run_ends_before_the_physics=lengthen to 5.0 ms'")
    ap.add_argument("--sweep", action="append", default=[], metavar="VARIABLE=V1,V2",
                    help="design study from v0.1, e.g. thickness_scale=0.8,1.2 (with --run)")
    ap.add_argument("--all", action="store_true", help="--run --media --v01")
    ap.add_argument("--interaction", default=None,
                    help="answers file for --v01 (default: interaction.txt next to src/)")
    ap.add_argument("--threads", type=int, default=8, help="solver threads")
    ap.add_argument("--openradioss", default=None, help="the unpacked OpenRadioss folder")
    ap.add_argument("--no-geometry", action="store_true",
                    help="skip surface extraction; the 3D view will be empty")
    args = ap.parse_args(argv)
    if args.all:
        args.run = args.media = args.v01 = True

    env = preflight.check(args.openradioss)
    if args.check:
        print(preflight.report(env))
        return 0 if env["ok"] else 1
    if not env["ok"]:
        print(preflight.report(env), file=sys.stderr)
        return 2
    if (args.run or args.media) and not env["solver_available"]:
        print("OpenRadioss is needed for --run and --media and was not found.\n"
              + preflight.report(env), file=sys.stderr)
        return 3

    # Imported after the check so a missing package gives the message above,
    # not a traceback.
    from src.analyze import analyze_model, write_model_json
    from src.fixes import build_v01
    from src.features import write_global_features
    from src.report import model_geometry, write_assets, write_index, write_model_data

    root = Path(args.root)
    models = [root / m for m in args.model] if args.model else discover(root)
    if not models:
        print(f"no model folders with a *_0000.rad under {root}", file=sys.stderr)
        return 1
    interaction = Path(args.interaction) if args.interaction else root / "interaction.txt"

    names = []
    for d in models:
        t0 = time.time()
        print(f"\n{d.name}")
        if args.run and (args.rerun or not _has_run(d, "v0")):
            from src.solver import run_model
            print("  running v0 (the original decks) ...")
            run_model(d, "v0", threads=args.threads, openradioss=args.openradioss)

        v0 = analyze_model(d, run_subdir="v0")
        answers_file = interaction if interaction.exists() else None
        # A version that has been run keeps the decks it ran with: rebuilding
        # them with a newer builder would pair new decks with old results.
        v01_ran = _has_run(d, "v0.1")
        if args.v01 and v01_ran and not args.rerun:
            print("  v0.1 has already been run; its decks are kept as they ran "
                  "(add --rerun to rebuild and run it again)")
        if args.v01 and (args.rerun or not v01_ran):
            record = build_v01(d, v0, answers_file)
            print(f"  v0.1 written: {len(record['applied'])} fix(es) applied, "
                  f"{len(record['not_applied'])} left as they are "
                  f"({'from interaction.txt' if answers_file else 'recommended answers'})")
        if args.build:
            overrides = dict(a.split("=", 1) for a in args.answer)
            record = build_v01(d, v0, answers_file, out_subdir=args.build, overrides=overrides)
            print(f"  {args.build} written: {len(record['applied'])} fix(es) applied")
        # A copy shipped without the patched decks (the phone's is 42 MB) gets
        # them back from deck.diff, the exact record of what ran - replayed
        # onto the pristine decks and checked to reproduce the diff.
        for folder in sorted(p for p in d.glob("v*") if p.is_dir() and p.name != "v0"):
            if (folder / "deck.diff").exists() and not any(folder.glob("*_0000.rad")):
                from src.patch_deck import restore_version
                restore_version(d, folder.name)
                print(f"  {folder.name}: decks restored from deck.diff")
        # Every later version whose decks exist and whose run does not.
        for version in versions_of(d)[1:]:
            if args.run and (args.rerun or not _has_run(d, version)):
                from src.solver import run_model
                print(f"  running {version} ...")
                run_model(d, version, threads=args.threads, openradioss=args.openradioss,
                          deck_dir=d / version)

        geometry = {"parts": []} if args.no_geometry else model_geometry(d)
        node_ids = sorted({n for p in geometry["parts"] for n in p.get("node_ids", [])})
        for spec in args.sweep:
            from src import sweep
            variable, values = sweep.parse_spec(spec)
            for value in values:
                point = sweep.build_point(d, variable, value)
                if args.run and (args.rerun or not any(point.glob("*_0001.out"))):
                    from src.solver import run_model
                    print(f"  running sweep point {point.name} ...")
                    run_model(d, f"sweep/{point.name}", threads=args.threads,
                              openradioss=args.openradioss, deck_dir=point)
            base = analyze_model(d, run_subdir="v0.1") if "v0.1" in versions_of(d) else v0
            from src.report import _attach_field_results
            _attach_field_results(base, geometry, d, base.get("version", "v0"))
            table = sweep.collect(d, variable, values, base_model=base, node_ids=node_ids)
            print(f"  sweep {variable}: {len(table['rows'])} run(s) collected")
        sweeps = [json.loads(p.read_text(encoding="utf-8"))
                  for p in sorted((d / "sweep").glob("*.json"))] if (d / "sweep").exists() else []
        by_version = {}
        for version in versions_of(d):
            model = v0 if version == "v0" else analyze_model(d, run_subdir=version)
            if version != "v0":
                edits = d / version / "edits.json"
                diff = d / version / "deck.diff"
                model["changes"] = {
                    **(json.loads(edits.read_text(encoding="utf-8")) if edits.exists() else {}),
                    "diff": diff.read_text(encoding="utf-8") if diff.exists() else "",
                }
            finished = (model.get("run") or {}).get("normal_termination")
            if args.media and geometry["parts"] and not finished:
                print(f"  {version} media skipped: the run has not finished")
            if args.media and geometry["parts"] and finished:
                from src.animate import make_media
                media = make_media(d, version, geometry, model, openradioss_path=args.openradioss)
                if media:
                    print(f"  {version} media: {media['n_frames']} frames -> {media['video']}")
            model["sweeps"] = sweeps
            suffix = "" if version == "v0" else f"_{version}"
            # Data first: it attaches the run's field results (peak stress, media)
            # to `model`, and model.json must carry them too.
            write_model_data(model, d, geometry, version)
            write_model_json(model, d / "report" / f"model{suffix}.json")
            by_version[version] = model
            run = model.get("run") or {}
            print(f"  {version}: {len(model['assembly'])} parts, "
                  f"{sum(model['starter']['counts']['elements'].values()):,} elements, "
                  f"{len(model['findings'])} findings ({_count(model['findings'])})"
                  + (f", run: impact took out {run['ke_removed_fraction'] * 100:.0f}% of the motion "
                     f"energy ({'over' if run.get('impact_over') else 'not over'})"
                     if run.get("ke_removed_fraction") is not None else ""))
        write_global_features(d, by_version)
        names.append(d.name)
        print(f"  [{time.time() - t0:.0f} s]")

    write_assets(root)
    # The entry point lists every model that has a report, not only the ones
    # rebuilt this time: `--model X` must not drop the others from index.html.
    listed = [d.name for d in discover(root) if (d / "report" / "data.js").exists()]
    index = write_index(root, listed)
    print(f"\nreport:     {index}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
