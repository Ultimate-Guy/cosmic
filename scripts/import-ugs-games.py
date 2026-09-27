#!/usr/bin/env python3
"""One-time import of the public UGS game HTML into Cosmic's native game layout."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "pages" / "lessons"
REGISTRY = LESSONS / "games.json"
MARKER = LESSONS / ".ugs-imported.json"
SOURCE_REPO = "https://github.com/Ultimate-Guy/cosmicgames.git"


def key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def main() -> int:
    if MARKER.is_file():
        print("UGS import already completed; leaving imported games unchanged.")
        return 0

    existing = set()
    if REGISTRY.is_file():
        try:
            data = json.loads(REGISTRY.read_text(encoding="utf-8"))
            if isinstance(data, list):
                existing = {key(str(item.get("name", ""))) for item in data}
        except Exception:
            pass

    with tempfile.TemporaryDirectory(prefix="cosmic-ugs-") as tmp_name:
        tmp = Path(tmp_name)
        subprocess.run(
            [
                "git", "clone",
                "--depth", "1",
                "--filter=blob:none",
                "--sparse",
                SOURCE_REPO,
                str(tmp),
            ],
            check=True,
        )
        subprocess.run(
            ["git", "-C", str(tmp), "sparse-checkout", "set", "assets/UGS"],
            check=True,
        )
        source_root = tmp / "assets" / "UGS"
        if not source_root.is_dir():
            raise SystemExit("UGS source directory assets/UGS is missing")

        source_commit = subprocess.check_output(
            ["git", "-C", str(tmp), "rev-parse", "HEAD"],
            text=True,
        ).strip()

        files = sorted(
            p for p in source_root.rglob("*")
            if p.is_file() and p.suffix.casefold() in {".html", ".htm"}
        )
        if not files:
            raise SystemExit("No UGS HTML game files were found")

        folders = []
        collisions = []
        total_bytes = 0

        for source_file in files:
            original_name = source_file.stem.strip() or "Untitled Game"
            target_name = original_name
            target_key = key(target_name)

            if target_key in existing:
                suffix = 1
                target_name = f"{original_name} (UGS)"
                target_key = key(target_name)
                while target_key in existing:
                    suffix += 1
                    target_name = f"{original_name} (UGS {suffix})"
                    target_key = key(target_name)
                collisions.append({"source": original_name, "imported": target_name})

            destination = LESSONS / target_name / "index.html"
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file, destination)
            total_bytes += destination.stat().st_size
            existing.add(target_key)
            folders.append(target_name)

        marker = {
            "source_repo": "Ultimate-Guy/cosmicgames",
            "source_path": "assets/UGS",
            "source_commit": source_commit,
            "game_count": len(files),
            "imported_bytes": total_bytes,
            "imported_folders": folders,
            "name_collisions": collisions,
        }
        MARKER.write_text(json.dumps(marker, indent=2) + "\n", encoding="utf-8")

    print("UGS IMPORT COMPLETE")
    print("===================")
    print(f"games imported: {len(files)}")
    print(f"bytes imported: {total_bytes}")
    print(f"name collisions renamed: {len(collisions)}")
    print(f"marker: {MARKER}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
