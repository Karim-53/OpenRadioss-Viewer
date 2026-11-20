"""Write src/data/narration.json from the clips in public/media/narration/<version>/.

    python narration/build_manifest.py      (run from talk/)

Each version folder holds one `<h>-<v>.mp3` per slide it narrates (reveal.js column-slide,
two digits each). VERSIONS sets the order (the first is the default) and the menu labels;
a version whose folder is empty or missing is left out.
"""
import json, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
MEDIA = HERE / "public" / "media" / "narration"
VERSIONS = [
    ("short-clone", "Short version"),
    ("full", "Long version"),
]

def duration(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True)
    return round(float(out.stdout), 2)

versions = []
for vid, label in VERSIONS:
    clips = sorted((MEDIA / vid).glob("*.mp3"))
    if not clips:
        continue
    slides = []
    for c in clips:
        h, v = map(int, c.stem.split("-"))
        slides.append({"h": h, "v": v, "file": f"media/narration/{vid}/{c.name}", "dur": duration(c)})
    versions.append({"id": vid, "label": label, "slides": slides})
    print(f"{vid}: {len(slides)} clips, {sum(s['dur'] for s in slides) / 60:.1f} min")
(HERE / "src" / "data" / "narration.json").write_text(json.dumps({"versions": versions}, indent=1), encoding="utf-8")
