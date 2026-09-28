#!/usr/bin/env python3
"""Sync Cosmic's UGS catalog from Ultimate-Guy/cosmicgames UGS-Files only.

Only HTML files directly inside UGS-Files/ are considered Cosmic games.
Nothing else in the cosmicgames repository is imported or copied.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_REPO = "Ultimate-Guy/cosmicgames"
DEFAULT_REF = "main"

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "pages" / "lessons" / "ugs-games.json"


def display_name(filename: str) -> str:
    stem = filename[:-5] if filename.lower().endswith(".html") else filename
    if stem.lower().startswith("cl") and len(stem) > 2:
        stem = stem[2:]
    return stem or "Untitled UGS Game"


def build_entry(filename: str, repo: str, ref: str) -> dict:
    source_path = f"UGS-Files/{filename}"
    encoded = urllib.parse.quote(filename, safe="")
    return {
        "name": display_name(filename),
        "path": (
            "https://cdn.jsdelivr.net/gh/"
            f"{repo}@{ref}/UGS-Files/{encoded}"
        ),
        "category": "Arcade",
        "tags": ["UGS"],
        "featured": False,
        "source": "UGS",
        "source_path": source_path,
    }


def fetch_tree(repo: str, ref: str) -> list[str]:
    url = (
        f"https://api.github.com/repos/{repo}/git/trees/"
        f"{urllib.parse.quote(ref, safe='')}?recursive=1"
    )
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "Cosmic-UGS-Catalog-Sync",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.load(response)
    except Exception as exc:
        raise RuntimeError(
            f"Could not read GitHub tree for {repo}@{ref}: {exc}"
        ) from exc

    if data.get("truncated"):
        raise RuntimeError(
            "GitHub returned a truncated repository tree; "
            "refusing to build a partial UGS catalog."
        )

    prefix = "UGS-Files/"
    files: list[str] = []
    for item in data.get("tree", []):
        path = str(item.get("path", ""))
        relative = path[len(prefix):] if path.startswith(prefix) else ""
        if (
            item.get("type") == "blob"
            and relative
            and "/" not in relative
            and relative.lower().endswith(".html")
        ):
            files.append(relative)
    return files


def scan_local(ugs_root: Path) -> list[str]:
    if not ugs_root.is_dir():
        raise RuntimeError(f"UGS-Files directory does not exist: {ugs_root}")
    return [
        path.name
        for path in ugs_root.iterdir()
        if path.is_file() and path.suffix.lower() == ".html"
    ]


def make_catalog(filenames: list[str], repo: str, ref: str) -> list[dict]:
    seen_names: set[str] = set()
    entries: list[dict] = []

    for filename in sorted(set(filenames), key=str.casefold):
        entry = build_entry(filename, repo, ref)
        base_name = entry["name"]
        candidate = base_name
        suffix = 1
        while candidate.casefold() in seen_names:
            candidate = (
                f"{base_name} (UGS)"
                if suffix == 1
                else f"{base_name} (UGS {suffix})"
            )
            suffix += 1
        entry["name"] = candidate
        seen_names.add(candidate.casefold())
        entries.append(entry)

    return entries


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build Cosmic UGS metadata from UGS-Files/*.html only."
    )
    parser.add_argument(
        "--ugs-root",
        type=Path,
        help=(
            "Local UGS-Files directory. When omitted, read "
            "Ultimate-Guy/cosmicgames from GitHub."
        ),
    )
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--ref", default=DEFAULT_REF)
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT,
        help="Output JSON file (defaults to pages/lessons/ugs-games.json).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail when the generated catalog differs from the existing file.",
    )
    args = parser.parse_args()

    filenames = (
        scan_local(args.ugs_root)
        if args.ugs_root
        else fetch_tree(args.repo, args.ref)
    )
    catalog = make_catalog(filenames, args.repo, args.ref)
    rendered = json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"

    output = args.output.resolve()
    existing = output.read_text(encoding="utf-8") if output.is_file() else None

    if args.check:
        if existing != rendered:
            print(f"UGS catalog is out of date: {output}", file=sys.stderr)
            return 1
        print(f"UGS catalog is current: {len(catalog)} games")
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8")
    print(
        f"Synced {len(catalog)} UGS games from {args.repo}@{args.ref} "
        f"(UGS-Files/*.html only) -> {output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
