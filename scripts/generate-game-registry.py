#!/usr/bin/env python3
"""Generate game and app registries from folders under pages/lessons."""

import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS_DIR = ROOT / "pages" / "lessons"
APPS_DIR = LESSONS_DIR / "apps"
GAMES_OUTPUT = LESSONS_DIR / "games.json"
APPS_OUTPUT = APPS_DIR / "apps.json"
IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
EXCLUDED_GAME_FOLDERS = {"img", "apps"}


def display_name(folder_name, fallback="Untitled"):
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder_name)
    words = re.sub(r"[_-]+", " ", words).strip()
    words = re.sub(r"\s+", " ", words)
    return words.title() or fallback


def read_metadata(folder):
    metadata_path = next(
        (path for path in folder.iterdir() if path.name.lower() == "game.json"),
        None,
    )
    if metadata_path is None:
        return {}
    with metadata_path.open(encoding="utf-8") as metadata_file:
        metadata = json.load(metadata_file)
    if not isinstance(metadata, dict):
        raise ValueError(f"{metadata_path} must contain a JSON object")
    return metadata


def choose_image(folder, metadata):
    configured_image = metadata.get("image")
    if configured_image:
        image_path = folder / configured_image
        if image_path.is_file():
            return image_path
        raise FileNotFoundError(f"Thumbnail does not exist: {image_path}")

    images = sorted(
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    return images[0] if images else None


def choose_entry(folder, metadata):
    configured_entry = metadata.get("entry")
    if not configured_entry:
        return None
    entry_path = (folder / configured_entry).resolve()
    if folder.resolve() not in entry_path.parents or not entry_path.is_file():
        raise FileNotFoundError(f"Entry file does not exist in {folder}: {configured_entry}")
    return urllib.parse.quote(configured_entry.replace("\\", "/"), safe="/")


def registry_path(path):
    relative = path.relative_to(ROOT).as_posix()
    return urllib.parse.quote(relative, safe="/") + "/"


def build_entry(folder, metadata, fallback):
    image = choose_image(folder, metadata)
    entry = choose_entry(folder, metadata)
    result = {
        "name": metadata.get("title", display_name(folder.name, fallback)),
        "path": registry_path(folder),
    }
    if entry:
        result["entry"] = entry
    if image:
        result["image"] = registry_path(image).rstrip("/")
    return result


def build_registry(directory, excluded, fallback):
    if not directory.is_dir():
        return []
    return [
        build_entry(folder, read_metadata(folder), fallback)
        for folder in sorted(path for path in directory.iterdir() if path.is_dir())
        if folder.name.lower() not in excluded
    ]


def write_registry(path, entries):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")


def main():
    games = build_registry(LESSONS_DIR, EXCLUDED_GAME_FOLDERS, "Untitled Game")
    apps = build_registry(APPS_DIR, set(), "Untitled App")
    write_registry(GAMES_OUTPUT, games)
    write_registry(APPS_OUTPUT, apps)
    print(f"Generated {len(games)} game entries in {GAMES_OUTPUT}")
    print(f"Generated {len(apps)} app entries in {APPS_OUTPUT}")


if __name__ == "__main__":
    main()
