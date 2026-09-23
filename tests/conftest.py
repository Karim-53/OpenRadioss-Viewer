"""The tests read the two public example decks; stop early, and say how to get them."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.fetch_models import MODELS  # noqa: E402


def pytest_sessionstart(session):
    missing = [f"{m}/{f}" for m, spec in MODELS.items() for f in spec["decks"]
               if not (ROOT / m / f).exists()]
    if missing:
        pytest.exit("the example decks are not downloaded yet "
                    f"({', '.join(missing)}): run  python src/fetch_models.py", returncode=4)
