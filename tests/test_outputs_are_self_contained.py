"""The generated report must not name anything outside the project folder.

The report is published as a static site. A path from the machine it was built
on is worse than useless to the reader: it names directories they do not have,
and it leaks the local layout into a document that is supposed to be about two
decks.

This is a guard, not a style preference. It runs over the generated artefacts,
so it fails when a future change starts writing absolute paths again.
"""

import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

# Anything that looks like a path anchored outside the project folder.
ABSOLUTE = re.compile(
    r"""(
        (?<![\w])[A-Za-z]:[\\/]  |   # C:\ or C:/ - but not the S:\ of "NODES:\n" in escaped text
        \\\\[A-Za-z0-9_.-]+\\    |   # \\server\share
        (?<![\w.])/(?:home|Users|mnt|opt|var|tmp)/
    )""",
    re.VERBOSE,
)

GENERATED = [
    "index.html",
    *[f"{m}/report/{f}" for m in ("Bumper_Beam", "Cell_Phone_Drop")
      for f in ("model.json", "data.js",
                "model_v0.1.json", "data_v0.1.js")],
    *[f"{m}/v0.1/{f}" for m in ("Bumper_Beam", "Cell_Phone_Drop")
      for f in ("edits.json", "deck.diff", "run_metadata.json")],
]


def _existing(rel: str) -> Path:
    path = ROOT / rel
    if not path.exists():
        pytest.skip(f"{rel} not built yet; run python src/main.py")
    return path


@pytest.mark.parametrize("rel", GENERATED)
def test_generated_artefact_has_no_absolute_paths(rel):
    text = _existing(rel).read_text(encoding="utf-8", errors="replace")
    hits = sorted({m.group(0) for m in ABSOLUTE.finditer(text)})
    assert not hits, f"{rel} contains absolute path fragments: {hits}"


def _parent_folder_patterns():
    """A parent folder's name used *as a path component*, next to / or \\.

    Bare substring matching is wrong: unzipped under a folder called `work`
    or `data`, the report's own prose ("not modelling work") would fail the
    test. A leak is a path, so the name must sit against a separator. Names
    that are also folders inside the project (`report`, `media`, ...) are
    skipped: `Bumper_Beam/report/` is the project talking about itself.
    """
    inside = {part for p in ROOT.rglob("*") for part in p.relative_to(ROOT).parts}
    names = [p.name for p in ROOT.parents[:4] if p.name and p.name not in inside]
    return {name: re.compile(rf"(?<![\w.-]){re.escape(name)}[\\/]|[\\/]{re.escape(name)}(?![\w.-])")
            for name in names}


@pytest.mark.parametrize("rel", GENERATED)
def test_generated_artefact_never_names_a_parent_folder(rel):
    """The folder this one lives in, and the ones above it, must not appear in a path."""
    text = _existing(rel).read_text(encoding="utf-8", errors="replace")
    found = [name for name, pat in _parent_folder_patterns().items() if pat.search(text)]
    assert not found, f"{rel} names parent folders: {found}"


def test_the_parent_folder_check_catches_a_path_and_ignores_prose():
    """The guard must still fire on a real leak, and not on an ordinary word."""
    pat = re.compile(r"(?<![\w.-])work[\\/]|[\\/]work(?![\w.-])")
    assert pat.search(r"C:\Users\x\work\project\report")      # a leaked path
    assert pat.search("see work/project/index.html")
    assert not pat.search("the cost is compute, not modelling work.")
    assert not pat.search("network/solver")                          # not the word itself


def test_model_json_paths_are_relative_to_the_project():
    """Every path-shaped string must resolve inside the project folder."""
    for rel in [g for g in GENERATED if g.endswith(".json")]:
        model = json.loads(_existing(rel).read_text(encoding="utf-8"))

        def walk(node, trail="$"):
            if isinstance(node, dict):
                for k, v in node.items():
                    walk(v, f"{trail}.{k}")
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    walk(v, f"{trail}[{i}]")
            elif isinstance(node, str) and ("/" in node or "\\" in node):
                if node.startswith(("http://", "https://")):
                    return
                assert not ABSOLUTE.search(node), f"{rel} {trail} = {node!r}"

        walk(model)


def test_readme_documents_the_entry_point():
    readme = _existing("README.md").read_text(encoding="utf-8")
    assert "index.html" in readme
    assert "requirements.txt" in readme
    assert (ROOT / "requirements.txt").exists()


def test_every_import_in_src_resolves():
    """Rule: no unused, unexplained or hallucinated import.

    Import every module in `src/` and let a missing package fail loudly here
    rather than in front of a reader.
    """
    sys.path.insert(0, str(ROOT))
    import importlib

    for path in sorted((ROOT / "src").glob("*.py")):
        if path.stem == "__init__":
            continue
        importlib.import_module(f"src.{path.stem}")
