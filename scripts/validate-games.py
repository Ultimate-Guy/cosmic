#!/usr/bin/env python3
"""Fast, future-proof static validation for Cosmic game pages."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "pages" / "lessons"
REGISTRY = LESSONS / "games.json"
EXCLUDED_DIRS = {"img", "apps"}
GAME_FILE_NAMES = {"index.html", "index.htm"}
LOCAL_RESOURCE_EXTENSIONS = {
    ".html", ".htm", ".js", ".mjs", ".css", ".json", ".map",
    ".wasm", ".unityweb", ".data", ".bin", ".mem", ".png", ".jpg",
    ".jpeg", ".gif", ".svg", ".webp", ".ico", ".mp3", ".ogg", ".wav",
    ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf",
}
IGNORED_SCHEMES = {
    "http", "https", "data", "blob", "javascript", "mailto", "tel",
    "about", "file", "chrome", "chrome-extension",
}
DYNAMIC_MARKERS = (
    r"\${", "{{", "}}", " + ", "+'", "'+", '+"', '"+', "[lang]",
    "'+lang+'", '"+lang+"',
)

class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.script_depth = 0
        self.script_starts = 0
        self.script_ends = 0
        self.unmatched_script_ends = 0
        self.html_starts = 0
        self.base_tags: list[dict[str, str]] = []
        self.resource_refs: list[tuple[str, str, str]] = []
        self.cosmic_loader_count = 0

    @staticmethod
    def attrs_dict(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {str(k).lower(): (v or "") for k, v in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        a = self.attrs_dict(attrs)
        if t == "script":
            self.script_starts += 1
            self.script_depth += 1
            if a.get("id", "").lower() == "cosmic-game-runtime-loader":
                self.cosmic_loader_count += 1
        elif t == "html":
            self.html_starts += 1
        elif t == "base":
            self.base_tags.append(a)

        if t in {"script", "link", "img", "iframe", "audio", "video", "source"}:
            attr = "src" if t != "link" else "href"
            if attr in a:
                self.resource_refs.append((t, attr, a[attr]))
        elif t == "object" and "data" in a:
            self.resource_refs.append((t, "data", a["data"]))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() == "script":
            self.handle_endtag("script")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script":
            self.script_ends += 1
            if self.script_depth <= 0:
                self.unmatched_script_ends += 1
            else:
                self.script_depth -= 1

    def error(self, message: str) -> None:
        pass

def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()

def discover_games() -> dict[str, Path]:
    discovered: dict[str, Path] = {}
    if not LESSONS.is_dir():
        return discovered
    for folder in sorted(p for p in LESSONS.iterdir() if p.is_dir()):
        if folder.name.lower() in EXCLUDED_DIRS:
            continue
        candidates = [p for p in folder.iterdir() if p.name.lower() in GAME_FILE_NAMES]
        if candidates:
            discovered[folder.name] = sorted(candidates)[0]
    return discovered

def registry_target(raw_path: str) -> Path:
    clean = unquote(html.unescape(raw_path.replace("\\", "/")))
    return (ROOT / clean).resolve()

def dynamic_reference(value: str) -> bool:
    value = value.strip()
    return any(marker in value for marker in DYNAMIC_MARKERS) or (
        value.count("'") > 2 or value.count('"') > 2
    )

def add_issue(issues: list[dict], level: str, game: str, message: str) -> None:
    issues.append({"level": level, "game": game, "message": message})

def check_parser_quality(game: str, parser: PageParser, issues: list[dict]) -> None:
    if parser.script_starts != parser.script_ends or parser.unmatched_script_ends:
        add_issue(
            issues,
            "warning",
            game,
            f"legacy script structure: {parser.script_starts} start / "
            f"{parser.script_ends} end / {parser.unmatched_script_ends} unmatched close",
        )

    if parser.html_starts > 1:
        add_issue(issues, "warning", game, "multiple <html> roots in legacy export")


def check_local_resources(
    game: str,
    game_file: Path,
    parser: PageParser,
    external_base: bool,
    issues: list[dict],
) -> None:
    if external_base:
        return

    for _tag, _attr, raw_value in parser.resource_refs:
        value = html.unescape(raw_value or "").strip()
        if not value or value.startswith(("#", "//")) or dynamic_reference(value):
            continue

        parsed = urlparse(value)
        if parsed.scheme.lower() in IGNORED_SCHEMES or parsed.netloc:
            continue

        path_part = parsed.path
        if not path_part:
            continue

        if path_part.startswith("/"):
            candidate = (ROOT / path_part.lstrip("/")).resolve()
        else:
            candidate = (game_file.parent / path_part).resolve()

        try:
            candidate.relative_to(ROOT.resolve())
        except ValueError:
            add_issue(issues, "error", game, f"resource escapes repository: {value}")
            continue

        if candidate.suffix.lower() in LOCAL_RESOURCE_EXTENSIONS and not candidate.is_file():
            # Missing executable resources are likely to prevent a game from
            # starting. Missing images/fonts/media are warnings because those
            # often are optional presentation assets.
            executable_ref = _tag == "script"
            executable_ext = candidate.suffix.lower() in {
                ".js", ".mjs", ".wasm", ".unityweb", ".data", ".bin", ".mem"
            }
            add_issue(
                issues,
                "error" if executable_ref and executable_ext else "warning",
                game,
                f"missing local resource: {value}",
            )

def validate_game(game: str, game_file: Path, issues: list[dict]) -> None:
    try:
        text = game_file.read_text(encoding="utf-8", errors="strict")
    except UnicodeDecodeError:
        text = game_file.read_text(encoding="utf-8", errors="replace")
        add_issue(issues, "error", game, "game HTML is not valid UTF-8")
    except Exception as exc:
        add_issue(issues, "error", game, f"could not read game file: {exc}")
        return

    if "\x00" in text:
        add_issue(issues, "error", game, "game HTML contains NUL bytes")
    if "\ufffd" in text:
        add_issue(issues, "warning", game, "game HTML contains replacement characters")

    documents = [text]
    documents.extend(
        match.group(1)
        for match in re.finditer(r"<!\[CDATA\[(.*?)\]\]>", text, re.I | re.S)
    )

    any_executable = False
    for document in documents:
        parser = PageParser()
        try:
            parser.feed(document)
            parser.close()
        except Exception as exc:
            add_issue(issues, "error", game, f"HTML parser failed: {exc}")
            continue

        check_parser_quality(game, parser, issues)

        if re.search(r"<script\b|onload\s*=|onclick\s*=|javascript:", document, re.I):
            any_executable = True

        for base in parser.base_tags:
            href = html.unescape(base.get("href", "")).strip()
            if not href:
                add_issue(issues, "warning", game, "<base> tag has no href")
            elif href.startswith(("http://", "https://")):
                pass
            elif not href.startswith("/"):
                add_issue(issues, "warning", game, f"unusual <base> href: {href}")

        external_base = any(
            html.unescape(base.get("href", "")).strip().startswith(("http://", "https://"))
            for base in parser.base_tags
        )
        check_local_resources(game, game_file, parser, external_base, issues)

    lower = text.casefold()

    if "window.tre()" in lower:
        add_issue(issues, "error", game, "known startup exception: window.tre()")
    if re.search(r"(?<!jsd)elivr\.net/gh/", lower):
        add_issue(issues, "error", game, "malformed elivr.net asset host")
    if "__cosmic_entry_password_json__" in lower:
        add_issue(issues, "error", game, "unbuilt Cosmic entry-password placeholder leaked into game")

    if "window.parent.maeexportapis_();" in lower:
        add_issue(issues, "info", game, "legacy parent-frame shim")
    if "navigator.serviceworker.register(" in lower:
        add_issue(issues, "info", game, "game contains its own service-worker registration")
    if "document.write(" in lower:
        add_issue(issues, "info", game, "game uses document.write()")

    if not any_executable:
        add_issue(issues, "error", game, "no executable game code detected")

def load_registry(issues: list[dict]) -> list[dict]:
    if not REGISTRY.is_file():
        add_issue(issues, "error", "<registry>", "pages/lessons/games.json is missing")
        return []
    try:
        data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    except Exception as exc:
        add_issue(issues, "error", "<registry>", f"games.json is invalid JSON: {exc}")
        return []
    if not isinstance(data, list):
        add_issue(issues, "error", "<registry>", "games.json must contain an array")
        return []
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            add_issue(issues, "error", "<registry>", f"entry {index} is not an object")
    return [item for item in data if isinstance(item, dict)]

def validate_registry(registry: list[dict], discovered: dict[str, Path], issues: list[dict]) -> None:
    seen_names: set[str] = set()
    seen_paths: set[Path] = set()
    discovered_paths = {p.resolve() for p in discovered.values()}

    for item in registry:
        name = str(item.get("name", "")).strip() or "<unnamed>"
        key = normalize_name(name)

        if key in seen_names:
            add_issue(issues, "error", name, "duplicate game name in games.json")
        seen_names.add(key)

        raw_path = str(item.get("path", "")).strip()
        if not raw_path:
            add_issue(issues, "error", name, "registry entry has no path")
            continue

        if not raw_path.lower().endswith((".html", ".htm")):
            add_issue(issues, "error", name, f"registry path is not an HTML entry: {raw_path}")
            continue

        if not raw_path.startswith("pages/lessons/"):
            add_issue(issues, "error", name, f"registry path is outside pages/lessons: {raw_path}")

        target = registry_target(raw_path)
        if not target.is_file():
            add_issue(issues, "error", name, f"registry target does not exist: {raw_path}")
            continue

        resolved = target.resolve()
        if resolved in seen_paths:
            add_issue(issues, "error", name, f"duplicate registry target: {raw_path}")
        seen_paths.add(resolved)

        if resolved not in discovered_paths:
            add_issue(issues, "error", name, f"registry target is outside the discovered game set: {raw_path}")

        category = str(item.get("category", "")).strip()
        if not category:
            add_issue(issues, "warning", name, "registry entry has no category")

        tags = item.get("tags")
        if not isinstance(tags, list):
            add_issue(issues, "warning", name, "registry tags should be an array")

        if "externalUrl" in item or "sourcePath" in item:
            add_issue(issues, "error", name, "retired external-game registry fields are present")

    registry_paths = {
        registry_target(str(item.get("path", ""))).resolve()
        for item in registry
        if str(item.get("path", "")).strip()
    }

    for folder, path in sorted(discovered.items()):
        if path.resolve() not in registry_paths:
            add_issue(issues, "warning", folder, "game file exists but is not in games.json")

def main() -> int:
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--strict-warnings", action="store_true", help="fail when warnings exist too")
    arg_parser.add_argument("--json-report", help="write a JSON diagnostics report")
    args = arg_parser.parse_args()

    issues: list[dict] = []
    discovered = discover_games()
    registry = load_registry(issues)

    if not discovered:
        add_issue(issues, "error", "<catalog>", "no game entry files were discovered")

    for folder, path in sorted(discovered.items()):
        validate_game(folder, path, issues)

    validate_registry(registry, discovered, issues)

    errors = [x for x in issues if x["level"] == "error"]
    warnings = [x for x in issues if x["level"] == "warning"]
    infos = [x for x in issues if x["level"] == "info"]

    for issue in warnings:
        print(f"WARNING: {issue['game']}: {issue['message']}")
    for issue in errors:
        print(f"ERROR: {issue['game']}: {issue['message']}")

    print()
    print(f"DISCOVERED GAME FILES: {len(discovered)}")
    print(f"REGISTRY ENTRIES: {len(registry)}")
    print(f"ERRORS: {len(errors)}")
    print(f"WARNINGS: {len(warnings)}")
    print(f"INFO: {len(infos)}")

    if args.json_report:
        Path(args.json_report).write_text(
            json.dumps({
                "discovered_games": len(discovered),
                "registry_entries": len(registry),
                "errors": errors,
                "warnings": warnings,
                "info": infos,
            }, indent=2) + "\n",
            encoding="utf-8",
        )

    if errors:
        print("GAME FILE VALIDATION FAILED")
        return 1
    if args.strict_warnings and warnings:
        print("GAME FILE VALIDATION FAILED (strict warnings enabled)")
        return 1

    print("GAME FILE VALIDATION PASSED")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
