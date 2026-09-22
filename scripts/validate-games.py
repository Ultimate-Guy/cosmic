#!/usr/bin/env python3
"""Fast static validator for Cosmic's original game catalog.

This intentionally does not launch browsers or execute game code. It checks the
entire local game catalog for the repository-level conditions that commonly
break the launcher: missing files, bad registry paths, malformed HTML/script
boundaries, invalid base tags, duplicate names, and known corruption patterns.
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "pages" / "lessons"
REGISTRY = LESSONS / "games.json"

KNOWN_BAD_PATTERNS = {
    "window.tre()": "known startup exception",
    'elivr.net/gh/': "corrupted base/tag text artifact",
    '<base href="https://cdn.jsd': "truncated <base> tag artifact",
    "__COSMIC_ENTRY_PASSWORD_JSON__": "unbuilt entry placeholder leaked into game HTML",
}

RESOURCE_EXTENSIONS = {
    ".html", ".htm", ".js", ".mjs", ".css", ".json", ".wasm", ".unityweb",
    ".data", ".bin", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
}

def fail(message: str, errors: list[str]) -> None:
    errors.append(message)

def validate_game(item: dict, errors: list[str]) -> None:
    name = str(item.get("name", "")).strip()
    path = str(item.get("path", "")).strip()

    if not name:
        fail("registry entry has no name", errors)
        return
    if not path:
        fail(f"{name}: missing registry path", errors)
        return

    # The registry should point at an explicit local entry file.
    if not path.lower().endswith(".html"):
        fail(f"{name}: registry path is not an HTML file: {path}", errors)
        return

    rel = html.unescape(path.replace("%20", " "))
    file_path = ROOT / Path(rel)
    if not file_path.is_file():
        fail(f"{name}: registry target missing: {rel}", errors)
        return

    if file_path.parent.name.lower() in {"img", "apps"}:
        fail(f"{name}: registry target is inside an excluded folder", errors)

    text = file_path.read_text(encoding="utf-8", errors="replace")

    # Basic document/script integrity.
    script_open = len(re.findall(r"<script\b", text, flags=re.I))
    script_close = len(re.findall(r"</script\s*>", text, flags=re.I))
    if script_open != script_close:
        fail(f"{name}: script tags are unbalanced ({script_open} open / {script_close} close)", errors)

    html_open = len(re.findall(r"<html\b", text, flags=re.I))
    html_close = len(re.findall(r"</html\s*>", text, flags=re.I))
    if html_open and html_close != html_open:
        fail(f"{name}: html tags are unbalanced", errors)

    # Broken artifacts and known runtime exceptions.
    lower = text.lower()
    for pattern, reason in KNOWN_BAD_PATTERNS.items():
        if pattern.lower() in lower:
            fail(f"{name}: {reason}: {pattern}", errors)

    # Base tags must be syntactically complete if present.
    bases = re.findall(r"<base\b[^>]*\bhref\s*=\s*([\"'])(.*?)\1[^>]*>", text, flags=re.I | re.S)
    malformed_base_line = re.search(r"<base\b[^>]*\bhref\s*=\s*[\"'][^>]*$", text, flags=re.I | re.M)
    if malformed_base_line:
        fail(f"{name}: malformed <base> tag", errors)
    for _, href in bases:
        href = html.unescape(href).strip()
        if not (href.startswith(("http://", "https://", "/"))):
            fail(f"{name}: suspicious <base> href: {href}", errors)

    # Cosmic runtime loader should be present exactly once for local game pages.
    runtime_count = text.count('id="cosmic-game-runtime-loader"')
    if runtime_count != 1:
        fail(f"{name}: expected exactly one Cosmic runtime loader, found {runtime_count}", errors)

    # A game should contain something that looks like an actual launch/runtime.
    runtime_markers = [
        "UnityLoader", "createUnityInstance", "gameInstance", "canvas",
        "<iframe", "phaser", "pixi", "construct", "requestAnimationFrame"
    ]
    if not any(marker.lower() in lower for marker in runtime_markers):
        fail(f"{name}: no recognized game runtime marker found", errors)

def main() -> int:
    if not REGISTRY.is_file():
        print(f"ERROR: missing registry: {REGISTRY}", file=sys.stderr)
        return 1

    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("ERROR: games.json must contain an array", file=sys.stderr)
        return 1

    errors: list[str] = []
    names: list[str] = []
    local_count = 0

    for item in data:
        if not isinstance(item, dict):
            fail("registry contains a non-object item", errors)
            continue
        name = str(item.get("name", "")).strip()
        names.append(name.lower())
        validate_game(item, errors)
        local_count += 1

    if len(names) != len(set(names)):
        fail("games.json contains duplicate game names", errors)

    if local_count == 0:
        fail("games.json contains no games", errors)

    if errors:
        print(f"GAME VALIDATION FAILED: {len(errors)} issue(s)")
        for error in errors:
            print(f" - {error}")
        return 1

    print(f"GAME VALIDATION PASSED: {local_count} game entries checked")
    print("Checked: registry paths, files, script/html structure, base tags,")
    print("known corruption/startup patterns, runtime markers, and duplicate names.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
