#!/usr/bin/env python3
"""Generate Cosmic registries and normalize shared Cosmic Hub script loaders."""
import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS_DIR = ROOT / "pages" / "lessons"
OUTPUT = LESSONS_DIR / "games.json"
UGS_REGISTRY = LESSONS_DIR / "ugs-games.json"
LESSONS_PAGE = LESSONS_DIR / "lessons.html"
APPS_PAGE = ROOT / "apps" / "apps.html"

IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
EXCLUDED_FOLDERS = {"img", "apps"}

LESSONS_LOADERS = {
    "cosmic-dev-tools.js": "../../scripts/cosmic-dev-tools.js?build=dev-commands-v4",
    "cosmic-hub.js": "../../scripts/cosmic-hub.js?v=3",
    "cosmic-admin-guard.js": "../../scripts/cosmic-admin-guard.js?v=3",
    "cosmic-launch-fix.js": "../../scripts/cosmic-launch-fix.js?v=3",
    "cosmic-feedback.js": "../../scripts/cosmic-feedback.js?v=2",
    "cosmic-profile-widget.js": "../../scripts/cosmic-profile-widget.js?v=2",
}

APPS_LOADERS = {
    "cosmic-dev-tools.js": "../scripts/cosmic-dev-tools.js?build=dev-commands-v4",
    "cosmic-hub.js": "../scripts/cosmic-hub.js?v=3",
    "cosmic-admin-guard.js": "../scripts/cosmic-admin-guard.js?v=3",
    "cosmic-pwa.js": "../scripts/cosmic-pwa.js?v=3",
    "cosmic-feedback.js": "../scripts/cosmic-feedback.js?v=2",
    "cosmic-profile-widget.js": "../scripts/cosmic-profile-widget.js?v=2",
}


def display_name(folder_name):
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", folder_name)
    words = re.sub(r"[_-]+", " ", words).strip()
    words = re.sub(r"\s+", " ", words)
    return words.title() or "Untitled Game"


def dedupe_key(name):
    """Return the canonical key used for duplicate game-name detection.

    Copy suffixes such as "(1)", "(2)", "(UGS)", and "(UGS 2)" are treated as
    duplicate markers. Case, punctuation, and whitespace are intentionally
    ignored so equivalent names collapse to one entry.
    """
    value = str(name or "").strip().casefold()
    previous = None
    while value != previous:
        previous = value
        value = re.sub(r"\(ugs(?:\s+\d+)?\)$", "", value).strip()
        value = re.sub(r"\(\d+\)$", "", value).strip()
    # Keep Unicode letters/numbers so symbol or non-ASCII game names
    # (for example "ʘ") remain valid registry entries rather than collapsing
    # to an unusable empty key.
    return "".join(ch for ch in value if ch.isalnum())


def read_metadata(folder):
    path = next((item for item in folder.iterdir() if item.name.lower() == "game.json"), None)
    if path is None:
        return {}
    with path.open(encoding="utf-8") as handle:
        metadata = json.load(handle)
    if not isinstance(metadata, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return metadata


def choose_image(folder, metadata):
    configured = metadata.get("image")
    if configured:
        path = folder / configured
        if path.is_file():
            return path
        raise FileNotFoundError(f"Thumbnail does not exist: {path}")
    images = sorted(
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    return images[0] if images else None


def choose_entry(folder, metadata):
    configured = metadata.get("entry")
    if not configured:
        return None
    path = (folder / configured).resolve()
    if folder.resolve() not in path.parents or not path.is_file():
        raise FileNotFoundError(
            f"Entry file does not exist in {folder}: {configured}"
        )
    return urllib.parse.quote(configured.replace("\\", "/"), safe="/")


def infer_category(name, metadata):
    explicit = str(metadata.get("category", "")).strip()
    if explicit:
        return explicit

    text = f"{name} {' '.join(map(str, metadata.get('tags', [])))}".lower()
    if re.search(r"ai|chat|assistant|utility|tool|github|calculator|music|youtube", text):
        return "Utility"
    if re.search(r"puzz|2048|chess|word|sudoku|mahjong|memory|brain", text):
        return "Puzzle"
    if re.search(
        r"multiplayer|2 player|2-player|among us|basket|soccer|karts|battle|brawl|bros|versus|vs\.?",
        text,
    ):
        return "Multiplayer"
    return "Arcade"


def normalize_loaders(path, loaders):
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    original = text

    if path == LESSONS_PAGE:
        text = re.sub(
            r"""\s*<script[^>]*src=["'][^"']*game-guard\.js[^"']*["'][^>]*>\s*</script>\s*""",
            "\\n",
            text,
            flags=re.I,
        )

    for filename, src in loaders.items():
        pattern = rf'''<script\b[^>]*\bsrc=["'][^"']*{re.escape(filename)}(?:\?[^"']*)?["'][^>]*>\s*</script>'''
        text = re.sub(pattern, f'<script src="{src}"></script>', text, flags=re.I)

    missing = []
    for filename, src in loaders.items():
        if not re.search(
            rf'''<script\b[^>]*\bsrc=["'][^"']*{re.escape(filename)}(?:\?[^"']*)?["']''',
            text,
            flags=re.I,
        ):
            missing.append(f'<script src="{src}"></script>')

    if missing:
        insertion = "\n" + "\n".join(missing) + "\n"
        matches = list(re.finditer(r"</body>", text, re.I))
        if matches:
            pos = matches[-1].start()
            text = text[:pos] + insertion + text[pos:]
        else:
            text += insertion

    if path == LESSONS_PAGE and 'rel="manifest"' not in text:
        manifest = '<link rel="manifest" href="../../manifest.json">\n'
        if re.search(r"</head>", text, re.I):
            text = re.sub(r"</head>", manifest + "</head>", text, count=1, flags=re.I)
        else:
            text = manifest + text

    if text != original:
        path.write_text(text, encoding="utf-8")


def fix_updates_flow():
    if LESSONS_PAGE.is_file():
        text = LESSONS_PAGE.read_text(encoding="utf-8")
        old = """        if(sessionStorage.getItem(unlockKey)==='true'){
            showGames();
            loadRegistry();
            showUpdatesIfChanged();
        }"""
        new = """        if(sessionStorage.getItem(unlockKey)==='true'){
            showGames();
            loadRegistry();
        }"""
        if old in text:
            text = text.replace(old, new, 1)
        LESSONS_PAGE.write_text(text, encoding="utf-8")

    normalize_loaders(LESSONS_PAGE, LESSONS_LOADERS)
    normalize_loaders(APPS_PAGE, APPS_LOADERS)


def clean_game_page(folder):
    index = folder / "index.html"
    if not index.is_file():
        return

    text = index.read_text(encoding="utf-8")
    cleaned = re.sub(
        r'\s*<script id="cosmic-settings-engine(?:-loader)?"[^>]*>.*?</script>\s*',
        "\n",
        text,
        flags=re.DOTALL,
    )
    cleaned = re.sub(
        r'\s*<script id="cosmic-game-guard-loader"[^>]*>.*?</script>\s*',
        "\n",
        cleaned,
        flags=re.DOTALL,
    )
    cleaned = re.sub(
        r'\s*<script id="cosmic-game-guard(?:-reinject)?"[^>]*>.*?</script>\s*',
        "\n",
        cleaned,
        flags=re.DOTALL,
    )
    cleaned = re.sub(
        r'''\s*<script[^>]*src=["'][^"']*cosmic-dev-tools\.js[^"']*["'][^>]*>\s*</script>\s*''',
        "\n",
        cleaned,
        flags=re.DOTALL,
    )
    for loader in (
        "game-guard.js",
        "cosmic-dev-tools.js",
        "cosmic-wrapper-controls.js",
        "cosmic-global-state.js",
    ):
        cleaned = re.sub(
            r'''\s*<script[^>]*src=["'][^"']*'''
            + re.escape(loader)
            + r'''[^"']*["'][^>]*>\s*</script>\s*''',
            "\n",
            cleaned,
            flags=re.DOTALL,
        )
    cleaned = re.sub(
        r'''\s*<script[^>]*id=["']cosmic-game-runtime-loader["'][^>]*>.*?</script>\s*''',
        "\n",
        cleaned,
        flags=re.DOTALL,
    )

    insertion = """\n<script id="cosmic-game-runtime-loader">
(() => {
  const script = document.createElement('script');
  script.src = location.origin + '/scripts/game-guard.js?v=guard';
  script.async = false;
  (document.body || document.documentElement).appendChild(script);
})();
</script>
"""

    matches = list(re.finditer(r"</body>", cleaned, re.I))
    if matches:
        pos = matches[-1].start()
        cleaned = cleaned[:pos] + insertion + cleaned[pos:]
    else:
        cleaned += insertion

    # Cosmic owns the service worker. Prevent individual game packages from
    # registering another worker while keeping their promise-based code running.
    cleaned = cleaned.replace(
        "navigator.serviceWorker.register(",
        "Promise.resolve(",
    )

    if cleaned != text:
        index.write_text(cleaned, encoding="utf-8")


def registry_path(path):
    return urllib.parse.quote(
        path.relative_to(ROOT).as_posix() + "/index.html",
        safe="/",
    )


def build_game(folder, metadata):
    image = choose_image(folder, metadata)
    entry = choose_entry(folder, metadata)
    name = str(metadata.get("title", display_name(folder.name))).strip()
    tags = metadata.get("tags", [])
    if not isinstance(tags, list):
        tags = [tags]

    game = {
        "name": name or "Untitled Game",
        "path": registry_path(folder),
        "category": infer_category(name, metadata),
        "tags": [str(value) for value in tags],
        "featured": bool(metadata.get("featured", False)),
    }
    if entry:
        game["entry"] = entry
    if image:
        game["image"] = registry_path(image).rstrip("/")
    return game


def add_game(games, seen_names, seen_paths, game, *, source_label):
    name = str(game.get("name", "")).strip()
    if not name:
        raise ValueError(f"{source_label} game is missing a name")

    key = dedupe_key(name)
    if not key:
        raise ValueError(f"{source_label} game has an unusable name: {name!r}")

    raw_path = str(game.get("path", "")).strip()
    if not raw_path:
        raise ValueError(f"{source_label} game {name!r} is missing a path")

    if key in seen_names:
        print(f"Skipping duplicate {source_label} game: {name}")
        return False

    if raw_path in seen_paths:
        print(f"Skipping duplicate {source_label} path: {raw_path}")
        return False

    games.append(game)
    seen_names.add(key)
    seen_paths.add(raw_path)
    return True


def main():
    fix_updates_flow()

    games = []
    seen_names = set()
    seen_paths = set()
    local_added = 0

    if LESSONS_DIR.is_dir():
        for folder in sorted(
            path
            for path in LESSONS_DIR.iterdir()
            if path.is_dir()
        ):
            if folder.name.lower() in EXCLUDED_FOLDERS:
                continue

            metadata = read_metadata(folder)
            game = build_game(folder, metadata)
            if add_game(
                games,
                seen_names,
                seen_paths,
                game,
                source_label="local",
            ):
                local_added += 1
            clean_game_page(folder)

    ugs_added = 0
    ugs_skipped = 0

    if UGS_REGISTRY.is_file():
        data = json.loads(UGS_REGISTRY.read_text(encoding="utf-8"))
        if not isinstance(data, list):
            raise ValueError("ugs-games.json must contain an array")

        for item in data:
            if not isinstance(item, dict):
                continue

            source_path = str(item.get("source_path", "")).strip()
            filename = Path(source_path).name if source_path else ""
            filename = re.sub(r"\.html?$", "", filename, flags=re.I)
            if filename.lower().startswith("cl") and len(filename) > 2:
                filename = filename[2:]

            fallback_name = (
                re.sub(r"[_-]+", " ", filename).strip()
                or "Untitled UGS Game"
            )
            name = str(item.get("name", "")).strip() or fallback_name

            raw_path = str(item.get("path", "")).strip()
            if not re.match(r"^https?://", raw_path, re.I):
                raise ValueError(
                    f"UGS game path is not absolute: {raw_path}"
                )

            tags = item.get("tags", [])
            entry = {
                "name": name,
                "path": raw_path,
                "category": str(item.get("category", "Arcade")).strip() or "Arcade",
                "tags": (
                    [str(value) for value in tags]
                    if isinstance(tags, list)
                    else ["UGS"]
                ),
                "featured": bool(item.get("featured", False)),
                "source": "UGS",
            }
            if item.get("source_path"):
                entry["source_path"] = str(item["source_path"])

            if add_game(
                games,
                seen_names,
                seen_paths,
                entry,
                source_label="UGS",
            ):
                ugs_added += 1
            else:
                ugs_skipped += 1

    games.sort(
        key=lambda item: (
            str(item.get("name", "")).casefold(),
            str(item.get("path", "")).casefold(),
        )
    )

    # Fail closed if a future edit somehow bypasses add_game().
    name_keys = [dedupe_key(item.get("name")) for item in games]
    if len(name_keys) != len(set(name_keys)):
        raise AssertionError("Generated games.json contains duplicate canonical game names")

    paths = [str(item.get("path", "")).strip() for item in games]
    if len(paths) != len(set(paths)):
        raise AssertionError("Generated games.json contains duplicate paths")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(games, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Generated {len(games)} game entries "
        f"({local_added} local, {ugs_added} UGS, {ugs_skipped} UGS duplicates skipped) "
        "and normalized Cosmic Hub loaders"
    )


if __name__ == "__main__":
    main()
