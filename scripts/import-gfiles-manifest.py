#!/usr/bin/env python3
"""Add lightweight private-gfiles entries to Cosmic's games registry.

The private repositories stay outside Cosmic. Only catalog metadata is written
to games.json; no game source/assets are copied into Cosmic.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "pages" / "lessons" / "games.json"
SOURCES = [
    ("gfiles", ROOT / ".gfiles" / "gfiles", "Ultimate-Guy/gfiles"),
    ("gfiles2", ROOT / ".gfiles" / "gfiles2", "Ultimate-Guy/gfiles2"),
    ("gfiles3", ROOT / ".gfiles" / "gfiles3", "Ultimate-Guy/gfiles3"),
    ("gfiles4", ROOT / ".gfiles" / "gfiles4", "Ultimate-Guy/gfiles4"),
    ("gfiles5", ROOT / ".gfiles" / "gfiles5", "Ultimate-Guy/gfiles5"),
]
EXCLUDED = {".git", ".github", "patch", "build", "frame", "warning", "warnings", "404", "408", "offline"}


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def display_name(folder: str) -> str:
    value = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder)
    value = re.sub(r"[_-]+", " ", value).strip()
    value = re.sub(r"\s+", " ", value)
    return value.title() or folder


def discover(source: Path) -> list[str]:
    if not source.is_dir():
        raise SystemExit(f"Missing checked-out source: {source}")
    return sorted(
        p.name
        for p in source.iterdir()
        if p.is_dir()
        and p.name.casefold() not in EXCLUDED
        and (p / "index.html").is_file()
    )


def main() -> int:
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("games.json must contain an array")

    # Existing Cosmic games always win when a gfiles name collides.
    seen_names = {normalize(str(item.get("name", ""))) for item in data}
    seen_source_paths = set()
    added = 0
    duplicates = 0
    per_source = {}

    for source_id, source, repo in SOURCES:
        source_added = 0
        for folder in discover(source):
            name = display_name(folder)
            key = normalize(name)
            source_key = f"{source_id}:{folder}".casefold()
            if not key or key in seen_names or source_key in seen_source_paths:
                duplicates += 1
                continue

            data.append({
                "name": name,
                "path": f"gfiles/{source_id}/{quote(folder, safe='')}/index.html",
                "category": "Arcade",
                "tags": ["gfiles"],
                "featured": False,
                "source": source_id,
                "source_repo": repo,
                "source_path": f"{folder}/index.html",
            })
            seen_names.add(key)
            seen_source_paths.add(source_key)
            source_added += 1
            added += 1

        per_source[source_id] = source_added

    local = [x for x in data if not str(x.get("source", "")).startswith("gfiles")]
    remote = [x for x in data if str(x.get("source", "")).startswith("gfiles")]
    remote.sort(key=lambda x: (normalize(str(x.get("name", ""))), str(x.get("source", ""))))
    REGISTRY.write_text(json.dumps(local + remote, indent=2) + "\n", encoding="utf-8")

    print("PRIVATE GFILES CATALOG")
    for source_id, count in per_source.items():
        print(f"{source_id}: +{count}")
    print(f"Added: {added}")
    print(f"Deduplicated: {duplicates}")
    print(f"Final catalog: {len(local) + len(remote)}")
    print("Game source/assets copied into Cosmic: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
