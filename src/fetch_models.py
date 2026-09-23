"""Download the two example models from the OpenRadioss project and check them.

    python src/fetch_models.py          fetch whatever is missing, verify all four decks

Both models are Altair's public OpenRadioss examples (CC BY-NC 4.0, see the
header of each deck). They are not stored in this repository: this script
fetches them from the example-model pages of the OpenRadioss wiki into
`Bumper_Beam/` and `Cell_Phone_Drop/` next to `src/`, which is where
`src/main.py` looks for models.

Every deck is checked against the SHA-256 recorded below. The whole analysis
and the published report were built from exactly these bytes; a mismatch means
upstream changed the file, and the numbers in the report no longer describe it.
"""

from __future__ import annotations

import hashlib
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = "https://openradioss.atlassian.net/wiki"

MODELS = {
    "Bumper_Beam": {
        "page": f"{WIKI}/spaces/OPENRADIOSS/pages/11075585/Bumper+Beam",
        "zip": f"{WIKI}/rest/api/content/11075585/child/attachment/att11042837/download",
        "decks": {
            "Bumper_Beam_AP_meshed_0000.rad": "abf14f97c84e6c709a1c3ea2e0259dc387baf02825022e7e7d49a31008d19e31",
            "Bumper_Beam_AP_meshed_0001.rad": "5ab9fc6f2b89dbd61ef04eeed84b83c3956044adbc5304766150809a34dca7df",
        },
    },
    "Cell_Phone_Drop": {
        "page": f"{WIKI}/spaces/OPENRADIOSS/pages/11141156/Cell+Phone+Drop+Test",
        "zip": f"{WIKI}/rest/api/content/11141156/child/attachment/att11403265/download",
        "decks": {
            "Cell_Phone_Drop_0000.rad": "435499d744ad560a843d9a21210483bbe74c9fc6e2775da4a232ce609cf097e2",
            "Cell_Phone_Drop_0001.rad": "1a090204d2913c1759429c45a65d8b67852a1889ed8cac73d6e5eb38cb6d98ff",
        },
    },
}


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(name: str, root: Path = ROOT) -> list[Path]:
    spec = MODELS[name]
    folder = root / name
    missing = [f for f in spec["decks"] if not (folder / f).exists()]
    if missing:
        print(f"{name}: downloading {spec['zip']}")
        with urllib.request.urlopen(spec["zip"], timeout=120) as r:
            archive = zipfile.ZipFile(io.BytesIO(r.read()))
        folder.mkdir(parents=True, exist_ok=True)
        by_name = {Path(i.filename).name: i for i in archive.infolist() if not i.is_dir()}
        for f in missing:
            if f not in by_name:
                raise SystemExit(f"{name}: {f} is not in the downloaded archive; see {spec['page']}")
            (folder / f).write_bytes(archive.read(by_name[f]))
    out = []
    for f, want in spec["decks"].items():
        got = _sha((folder / f).read_bytes())
        if got != want:
            raise SystemExit(f"{name}/{f}: SHA-256 {got} is not the published {want}")
        out.append(folder / f)
    print(f"{name}: {len(out)} decks present and verified")
    return out


def main() -> int:
    for name in MODELS:
        fetch(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
