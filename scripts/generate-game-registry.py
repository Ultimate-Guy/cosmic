#!/usr/bin/env python3
"""Generate the lessons page registry from the folders under pages/lessons."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS_DIR = ROOT / "pages" / "lessons"
OUTPUT = LESSONS_DIR / "games.json"
IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
EXCLUDED_FOLDERS = {"img"}


def display_name(folder_name):
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder_name)
    words = re.sub(r"[_-]+", " ", words).strip()
    return words.title() or "Untitled Game"


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


def registry_path(path):
    return path.relative_to(ROOT).as_posix() + "/"


def main():
    games = []
    if LESSONS_DIR.is_dir():
        for folder in sorted(path for path in LESSONS_DIR.iterdir() if path.is_dir()):
            if folder.name.lower() in EXCLUDED_FOLDERS:
                continue
            metadata = read_metadata(folder)
            image = choose_image(folder, metadata)
            game = {
                "name": metadata.get("title", display_name(folder.name)),
                "path": registry_path(folder),
            }
            if image:
                game["image"] = registry_path(image).rstrip("/")
            games.append(game)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(games, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(games)} game entries in {OUTPUT}")


if __name__ == "__main__":
    main()
