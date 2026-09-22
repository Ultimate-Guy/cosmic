#!/usr/bin/env python3
"""Fast static validation for every Cosmic game file and its registry entry.

This validator deliberately does not execute game code. It discovers game
files directly from the filesystem, then checks that the registry agrees with
what is actually present. That makes it automatically cover newly added games
without changing this script again.
"""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "pages" / "lessons"
REGISTRY = LESSONS / "games.json"
EXCLUDED_DIRS = {"img", "apps"}
GAME_INDEX_RE = re.compile(r"^index\.html?$", re.I)

KNOWN_BAD_PATTERNS = {
    "window.tre()": "known startup exception",
    "elivr.net/gh/": "corrupted base/tag text artifact",
    "__COSMIC_ENTRY_PASSWORD_JSON__": "unbuilt entry placeholder leaked into game HTML",
    "cosmic-game-runtime-loader></script>": "malformed Cosmic runtime loader boundary",
}

IGNORED_SCHEMES = {"http", "https", "data", "blob", "javascript", "mailto", "tel"}

def fail(message: str, errors: list[str]) -> None:
    errors.append(message)

def discover_game_files() -> dict[str, Path]:
    games: dict[str, Path] = {}
    if not LESSONS.is_dir():
        return games
    for folder in sorted(p for p in LESSONS.iterdir() if p.is_dir()):
        if folder.name.lower() in EXCLUDED_DIRS:
            continue
        index = next((p for p in folder.iterdir() if GAME_INDEX_RE.match(p.name)), None)
        if index is not None:
            games[folder.name] = index
    return games

def normalized_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()

def normalize_registry_path(path: str) -> Path:
    raw = unquote(html.unescape(path.replace("\\", "/")))
    return (ROOT / Path(raw)).resolve()

def validate_relative_resource_refs(game_name: str, game_file: Path, text: str, errors: list[str]) -> None:
    # Only validate repository-local resources. With an external <base> tag,
    # relative resources intentionally resolve against the external game host.
    pattern = re.compile(r"\b(?:src|href)\s*=\s*([\"'])(.*?)\1", re.I | re.S)
    base_match = re.search(r"<base\b[^>]*\bhref\s*=\s*([\"'])(.*?)\1", text, re.I | re.S)
    base_href = base_match.group(2).strip() if base_match else ""
    external_base = base_href.startswith(("http://", "https://"))

    if external_base:
        return

    for _, value in pattern.findall(text):
        value = html.unescape(value.strip())
        if not value or value.startswith(("#", "//")):
            continue
        parsed = urlparse(value)
        if parsed.scheme.lower() in IGNORED_SCHEMES or parsed.netloc:
            continue
        if value.startswith("/"):
            candidate = (ROOT / value.lstrip("/")).resolve()
        else:
            candidate = (game_file.parent / value.split("?", 1)[0].split("#", 1)[0]).resolve()

        try:
            candidate.relative_to(ROOT.resolve())
        except ValueError:
            fail(f"{game_name}: resource reference escapes repository: {value}", errors)
            continue

        if candidate.suffix.lower() in {".html", ".htm", ".js", ".mjs", ".css", ".json",
                                        ".wasm", ".unityweb", ".data", ".bin", ".png",
                                        ".jpg", ".jpeg", ".gif", ".svg", ".webp"}:
            if not candidate.exists():
                fail(f"{game_name}: missing local resource: {value}", errors)

def validate_game_file(game_name: str, path: Path, errors: list[str]) -> None:
    if not path.is_file():
        fail(f"{game_name}: index.html is missing", errors)
        return

    text = path.read_text(encoding="utf-8", errors="replace")
    lower = text.casefold()

    # Basic HTML/script integrity.
    script_open = len(re.findall(r"<script\b", text, flags=re.I))
    script_close = len(re.findall(r"</script\s*>", text, flags=re.I))
    if script_open != script_close:
        fail(f"{game_name}: script tags are unbalanced ({script_open} open / {script_close} close)", errors)

    html_open = len(re.findall(r"<html\b", text, flags=re.I))
    html_close = len(re.findall(r"</html\s*>", text, flags=re.I))
    if html_open and html_close != html_open:
        fail(f"{game_name}: html tags are unbalanced", errors)

    # Known corruption/startup failures.
    if re.search(r"(?<!jsd)elivr\.net/gh/", lower):
        fail(f"{game_name}: corrupted base/tag text artifact: elivr.net/gh/", errors)
    if "window.tre()" in lower:
        fail(f"{game_name}: known startup exception: window.tre()", errors)
    if "__cosmic_entry_password_json__" in lower:
        fail(f"{game_name}: unbuilt entry placeholder leaked into game HTML", errors)
    if "cosmic-game-runtime-loader></script>" in lower:
        fail(f"{game_name}: malformed Cosmic runtime loader boundary", errors)

    # Base tag integrity.
    complete_bases = re.findall(r"<base\b[^>]*\bhref\s*=\s*([\"'])(.*?)\1[^>]*>", text, flags=re.I | re.S)
    malformed_base = re.search(r"<base\b[^>]*\bhref\s*=\s*[\"'][^>]*$", text, flags=re.I | re.M)
    if malformed_base and not complete_bases:
        fail(f"{game_name}: malformed <base> tag", errors)
    for _, href in complete_bases:
        href = html.unescape(href).strip()
        if not href or not href.startswith(("http://", "https://", "/")):
            fail(f"{game_name}: suspicious <base> href: {href}", errors)

    # If the file has the Cosmic runtime loader, it must be structurally intact.
    if "cosmic-game-runtime-loader" in lower:
        runtime_count = len(re.findall(r'id=[\"\']cosmic-game-runtime-loader[\"\']', text, re.I))
        if runtime_count != 1:
            fail(f"{game_name}: expected exactly one Cosmic runtime loader, found {runtime_count}", errors)

    # A legitimate game should contain some executable/runtime surface.
    # Engines differ widely, so only require executable HTML content.
    executable_markers = ("<script", "javascript:", "onclick=", "onload=")
    if not any(marker.casefold() in lower for marker in executable_markers):
        fail(f"{game_name}: no executable game code marker found", errors)

    validate_relative_resource_refs(game_name, path, text, errors)

def load_registry(errors: list[str]) -> list[dict]:
    if not REGISTRY.is_file():
        fail(f"missing registry: {REGISTRY}", errors)
        return []
    try:
        data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"could not parse games.json: {exc}", errors)
        return []
    if not isinstance(data, list):
        fail("games.json must contain an array", errors)
        return []
    return [x for x in data if isinstance(x, dict)]

def main() -> int:
    errors: list[str] = []
    discovered = discover_game_files()
    registry = load_registry(errors)

    if not discovered:
        fail("no game index.html files were discovered under pages/lessons", errors)

    registry_by_name: dict[str, dict] = {}
    for item in registry:
        name = str(item.get("name", "")).strip()
        key = normalized_name(name)
        if not name:
            fail("registry entry has no name", errors)
        elif key in registry_by_name:
            fail(f"duplicate registry game name: {name}", errors)
        else:
            registry_by_name[key] = item

        path = str(item.get("path", "")).strip()
        if not path:
            fail(f"{name or '<unnamed>'}: missing registry path", errors)
            continue
        if not path.lower().endswith((".html", ".htm")):
            fail(f"{name}: registry path is not an HTML file: {path}", errors)
            continue
        target = normalize_registry_path(path)
        if not target.is_file():
            fail(f"{name}: registry target missing: {path}", errors)

    # Validate every actual game file on disk, independent of games.json.
    for folder_name, game_file in discovered.items():
        validate_game_file(folder_name, game_file, errors)

        if normalized_name(folder_name) not in registry_by_name:
            fail(f"{folder_name}: game file exists but has no games.json entry", errors)

    # Validate that registry local targets correspond to one of the discovered
    # game folders. This catches stale/mis-pointed entries.
    discovered_paths = {p.resolve() for p in discovered.values()}
    for item in registry:
        name = str(item.get("name", "")).strip() or "<unnamed>"
        path = str(item.get("path", "")).strip()
        if path.lower().endswith((".html", ".htm")):
            target = normalize_registry_path(path)
            if target.exists() and target.resolve() not in discovered_paths:
                fail(f"{name}: registry points to a file that is not a discovered game entry: {path}", errors)

    if errors:
        print(f"GAME FILE VALIDATION FAILED: {len(errors)} issue(s)")
        for error in errors:
            print(f" - {error}")
        return 1

    print(f"GAME FILE VALIDATION PASSED: {len(discovered)} actual game files checked")
    print(f"REGISTRY VALIDATION PASSED: {len(registry)} registry entries checked")
    print("Future game files are automatically included because the validator")
    print("discovers pages/lessons/*/index.html directly from the filesystem.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
