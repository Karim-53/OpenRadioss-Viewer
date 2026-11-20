"""Copy the built report into `docs/`, the folder GitHub Pages serves.

    python src/main.py          build index.html and every model's report/
    python src/build_site.py    copy what the page loads into docs/

The report already works from `file://` with no server, so a static host needs
no change: only the files the page actually loads are copied - `index.html`
(published as `report.html`), `assets/`, each model's `report/data*.js`, and the
pictures and videos those data files name. Decks, solver output and frame caches
stay behind.

The site's home page is `src/web/landing.html` (published as `index.html`, with its
pictures in `landing/`): it sends visitors to the talk first, then to the report.
`docs/talk/` is built separately (see talk/README.md) and is kept across rebuilds.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = Path(__file__).resolve().parent / "web"
KEEP = {"talk"}   # built by the talk's own build, not by this script
MEDIA = re.compile(r"""[A-Za-z0-9_.-]+/media/[A-Za-z0-9_.=-]+\.(?:png|mp4)""")


def build(src: Path, out: Path) -> list[Path]:
    index = src / "index.html"
    if not index.exists():
        raise SystemExit(f"{index} not found; run python src/main.py first")
    out.mkdir(parents=True, exist_ok=True)
    for old in out.iterdir():
        if old.name in KEEP:
            continue
        shutil.rmtree(old) if old.is_dir() else old.unlink()
    wanted = {Path("index.html")}
    wanted |= {p.relative_to(src) for p in (src / "assets").glob("*") if p.is_file()}
    data = sorted(src.glob("*/report/data*.js"))
    wanted |= {p.relative_to(src) for p in data}
    for p in data:
        wanted |= {Path(m) for m in MEDIA.findall(p.read_text(encoding="utf-8"))}
    copied = []
    for rel in sorted(wanted):
        if not (src / rel).exists():
            print(f"  missing, skipped: {rel.as_posix()}", file=sys.stderr)
            continue
        dest = out / ("report.html" if rel == Path("index.html") else rel)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src / rel, dest)
        copied.append(dest)
    shutil.copyfile(WEB / "landing.html", out / "index.html")
    copied.append(out / "index.html")
    for pic in sorted((WEB / "landing").glob("*")):
        (out / "landing").mkdir(exist_ok=True)
        shutil.copyfile(pic, out / "landing" / pic.name)
        copied.append(out / "landing" / pic.name)
    (out / ".nojekyll").write_text("", encoding="utf-8")   # serve files as they are
    return copied


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=str(ROOT), help="folder holding the built index.html")
    ap.add_argument("--out", default=str(ROOT / "docs"), help="the site folder")
    args = ap.parse_args(argv)
    copied = build(Path(args.src), Path(args.out))
    size = sum(p.stat().st_size for p in copied) / 1e6
    print(f"{len(copied)} files, {size:.1f} MB -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
