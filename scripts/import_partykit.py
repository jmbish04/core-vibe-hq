#!/usr/bin/env python3
"""Import selected packages from the PartyServer monorepo into this project.

The script copies the requested packages from the source PartyKit repository into
`third_party/partykit/` within this repo, replacing any existing copies.

Adjust `PARTYKIT_ROOT`, `TARGET_ROOT`, or `PACKAGES_TO_COPY` as needed before running.
"""

from __future__ import annotations

import shutil
from pathlib import Path

PARTYKIT_ROOT = Path("/Volumes/Projects/workers/core-task-manager-api/partykit").resolve()
TARGET_ROOT = Path(__file__).resolve().parents[1] / "third_party" / "partykit"
PACKAGES_TO_COPY = [
    "packages/partyserver",
    "packages/partysocket",
    "packages/hono-party",
    # Add additional packages (partysub, partysync, partywhen, etc.) here if needed
]
EXTRA_FILES = ["LICENSE", "README.md"]


def copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Source path does not exist: {src}")

    if dst.exists():
        shutil.rmtree(dst)

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)


def copy_file(src: Path, dst: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Source file does not exist: {src}")

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def main() -> None:
    print(f"PartyKit source: {PARTYKIT_ROOT}")
    print(f"Target directory: {TARGET_ROOT}")

    if not PARTYKIT_ROOT.exists():
        raise FileNotFoundError(
            "PartyKit repository not found. Update PARTYKIT_ROOT in scripts/import_partykit.py."
        )

    for rel_path in PACKAGES_TO_COPY:
        src = PARTYKIT_ROOT / rel_path
        dst = TARGET_ROOT / rel_path
        print(f"Copying {src} -> {dst}")
        copy_tree(src, dst)

    for filename in EXTRA_FILES:
        src = PARTYKIT_ROOT / filename
        dst = TARGET_ROOT / filename
        if src.exists():
            print(f"Copying {src} -> {dst}")
            copy_file(src, dst)

    print("PartyKit packages imported successfully.")


if __name__ == "__main__":
    main()
