#!/usr/bin/env python3
"""Non-destructive audit of the five gfiles repositories."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [ROOT / ".gfiles" / f"gfiles{x}" for x in ("", "2", "3", "4", "5")]

EXCLUDED = {
    ".git", ".github", "patch", "build", "frame",
    "warning", "warnings", "404", "408", "offline",
}

MAX_TOTAL_BYTES = 500 * 1024 * 1024


def stats(folder: Path) -> tuple[int, int]:
    files = 0
    total = 0
    for path in folder.rglob("*"):
        if path.is_file():
            files += 1
            total += path.stat().st_size
    return files, total


def main() -> int:
    report = {"mode": "audit-only", "sources": [], "cosmic_catalog_modified": False}

    total_games = 0
    total_files = 0
    total_bytes = 0

    for source in SOURCES:
        item = {
            "source": source.name,
            "present": source.is_dir(),
            "candidate_games": 0,
            "files": 0,
            "bytes": 0,
        }

        if source.is_dir():
            for folder in sorted(source.iterdir(), key=lambda p: p.name.casefold()):
                if not folder.is_dir() or folder.name.casefold() in EXCLUDED:
                    continue
                if not (folder / "index.html").is_file():
                    continue

                files, size = stats(folder)
                item["candidate_games"] += 1
                item["files"] += files
                item["bytes"] += size

        total_games += item["candidate_games"]
        total_files += item["files"]
        total_bytes += item["bytes"]
        report["sources"].append(item)

    report["totals"] = {
        "candidate_games": total_games,
        "files": total_files,
        "bytes": total_bytes,
        "within_safety_limit": total_bytes <= MAX_TOTAL_BYTES,
    }

    output = ROOT / "gfiles-audit-report.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print("GFILES AUDIT")
    print("============")
    for item in report["sources"]:
        print(
            f"{item['source']}: {item['candidate_games']} candidate games, "
            f"{item['files']} files, {item['bytes']} bytes"
        )
    print(f"TOTAL: {total_games} games, {total_files} files, {total_bytes} bytes")
    print("COSMIC CATALOG MODIFIED: NO")
    print(f"REPORT: {output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
