#!/usr/bin/env python3
"""Build a tiny manifest of game folders stored in private gfiles repositories.

This never copies game files into Cosmic. It only records the repository, pinned
commit, game folder, and entry file needed by the Cloudflare Worker proxy.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".build" / "gfiles-manifest.json"
TOKEN = os.environ.get("GFILES_READ_TOKEN", "").strip()

SOURCES = [
    ("gfiles", "Ultimate-Guy/gfiles"),
    ("gfiles2", "Ultimate-Guy/gfiles2"),
    ("gfiles3", "Ultimate-Guy/gfiles3"),
    ("gfiles4", "Ultimate-Guy/gfiles4"),
    ("gfiles5", "Ultimate-Guy/gfiles5"),
]
EXCLUDED = {
    ".git", ".github", "patch", "build", "frame",
    "warning", "warnings", "404", "408", "offline",
}


def gh_json(url: str) -> dict:
    if not TOKEN:
        raise SystemExit("GFILES_READ_TOKEN is not configured")
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {TOKEN}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Cosmic-Gfiles-Importer",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:500]
        raise SystemExit(f"GitHub API request failed ({exc.code}): {body}") from exc
    except Exception as exc:
        raise SystemExit(f"GitHub API request failed: {exc}") from exc


def display_name(folder: str) -> str:
    import re
    value = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder)
    value = re.sub(r"[_-]+", " ", value).strip()
    value = re.sub(r"\s+", " ", value)
    return value.title() or folder


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "sources": []}
    total = 0

    for source_id, repo in SOURCES:
        commit = gh_json(f"https://api.github.com/repos/{repo}/commits/main")
        commit_sha = str(commit.get("sha", "")).strip()
        if not commit_sha:
            raise SystemExit(f"{repo}: could not determine main commit")

        tree = gh_json(
            f"https://api.github.com/repos/{repo}/git/trees/{commit_sha}?recursive=1"
        )
        if tree.get("truncated"):
            raise SystemExit(
                f"{repo}: GitHub returned a truncated tree; refusing to build an incomplete game catalog"
            )

        games = {}
        for entry in tree.get("tree", []):
            path = str(entry.get("path", ""))
            if entry.get("type") != "blob" or not path.lower().endswith("/index.html"):
                continue

            parts = path.split("/")
            if len(parts) != 2:
                continue

            root = parts[0]
            if root.casefold() in EXCLUDED:
                continue

            games[root] = {
                "name": display_name(root),
                "root": root,
                "entry": "index.html",
            }

        items = sorted(games.values(), key=lambda x: x["name"].casefold())
        manifest["sources"].append(
            {
                "id": source_id,
                "repo": repo,
                "ref": commit_sha,
                "games": items,
            }
        )
        total += len(items)
        print(f"{source_id}: {len(items)} games @ {commit_sha}")

    manifest["totals"] = {"games": total, "sources": len(SOURCES)}
    OUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"TOTAL PRIVATE GFILES GAMES: {total}")
    print(f"MANIFEST: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
