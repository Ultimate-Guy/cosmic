#!/usr/bin/env python3
"""Build a lightweight gfiles catalog from the five private source repos."""

from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

REGISTRY = Path("pages/lessons/games.json")
SOURCES = [
    ("gfiles", "Ultimate-Guy/gfiles"),
    ("gfiles2", "Ultimate-Guy/gfiles2"),
    ("gfiles3", "Ultimate-Guy/gfiles3"),
    ("gfiles4", "Ultimate-Guy/gfiles4"),
    ("gfiles5", "Ultimate-Guy/gfiles5"),
]
EXCLUDED = {
    ".git", ".github", "patch", "build", "frame", "warning",
    "warnings", "404", "408", "offline",
}
WORKER_BASE = "https://cosmicv2.v75ultimate.workers.dev/gfiles"


def display_name(folder: str) -> str:
    value = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder)
    value = re.sub(r"[_-]+", " ", value).strip()
    value = re.sub(r"\s+", " ", value)
    return value.title() or folder


def fetch_tree(repo: str, token: str) -> list[dict]:
    url = f"https://api.github.com/repos/{repo}/git/trees/main?recursive=1"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "Cosmic-gfiles-sync",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = json.load(response)
    if payload.get("truncated"):
        raise SystemExit(f"{repo}: GitHub returned a truncated tree")
    return payload.get("tree", [])


def main() -> int:
    token = os.environ.get("GFILES_READ_TOKEN", "").strip()
    if not token:
        raise SystemExit("GFILES_READ_TOKEN is not configured")

    if not REGISTRY.is_file():
        raise SystemExit(f"Missing {REGISTRY}")

    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit("games.json must contain an array")

    source_ids = {source_id for source_id, _ in SOURCES}
    data = [
        item for item in data
        if str(item.get("source", "")).casefold() not in source_ids
        and not str(item.get("path", "")).startswith("https://cosmicv2.v75ultimate.workers.dev/gfiles/")
        and not str(item.get("path", "")).startswith("gfiles/")
    ]

    added = 0
    counts: dict[str, int] = {}

    for source_id, repo in SOURCES:
        folders: set[str] = set()
        count = 0
        for entry in fetch_tree(repo, token):
            parts = str(entry.get("path", "")).split("/")
            if entry.get("type") != "blob" or len(parts) != 2:
                continue
            if parts[1].casefold() != "index.html":
                continue

            folder = parts[0]
            if folder.casefold() in EXCLUDED or folder in folders:
                continue
            folders.add(folder)

            encoded_folder = urllib.parse.quote(folder, safe="")
            data.append({
                "name": display_name(folder),
                "path": f"{WORKER_BASE}/{source_id}/{encoded_folder}/index.html",
                "category": "Arcade",
                "tags": ["gfiles", source_id],
                "featured": False,
                "source": source_id,
                "source_path": f"{folder}/index.html",
            })
            added += 1
            count += 1
        counts[source_id] = count

    data.sort(key=lambda item: (
        1 if str(item.get("source", "")).casefold() in source_ids else 0,
        str(item.get("name", "")).casefold(),
        str(item.get("path", "")),
    ))
    REGISTRY.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    print("PRIVATE GFILES CATALOG SYNC")
    print("===========================")
    for source_id, count in counts.items():
        print(f"{source_id}: +{count}")
    print(f"added: {added}")
    print(f"final registry entries: {len(data)}")
    print("game source files copied into Cosmic: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
