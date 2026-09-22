#!/usr/bin/env python3
"""Build a lightweight catalog of safe external games from Ultimate-Guy/cosmicgames.

Only the catalog is copied into Cosmic. Game HTML/assets remain in the public
source repository/CDN and are opened by Cosmic's existing game shell.
"""
import base64
import concurrent.futures
import html
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "pages" / "lessons"
GAMES_JSON = LESSONS / "games.json"
EXTERNAL_JSON = LESSONS / "cosmicgames.json"

REPO = "Ultimate-Guy/cosmicgames"
BRANCH = "main"
API_ROOT = f"https://api.github.com/repos/{REPO}"
CDN_ROOT = f"https://cdn.jsdelivr.net/gh/{REPO}@{BRANCH}/"

def request(url, token=None, timeout=20):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Cosmic-External-Catalog/1.0",
            "Accept": "application/vnd.github+json",
        },
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()

def title_from_html(text):
    for pattern in (
        r"<title[^>]*>([\s\S]*?)</title>",
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
        r"<h1[^>]*>([\s\S]*?)</h1>",
    ):
        match = re.search(pattern, text, re.I)
        if match:
            value = re.sub(r"<[^>]+>", " ", match.group(1))
            value = html.unescape(re.sub(r"\s+", " ", value)).strip()
            if value:
                return value
    return ""

def category_for(title, text):
    value = f"{title} {text[:20000]}".lower()
    if re.search(r"chess|sudoku|puzzle|word|crossword|mahjong|2048|memory", value):
        return "Puzzle"
    if re.search(r"rhythm|music|osu|dance", value):
        return "Rhythm"
    if re.search(r"racing|racer|driving|drift|kart", value):
        return "Racing"
    if re.search(r"sports|basket|soccer|football|golf|tennis|bowling|pool", value):
        return "Sports"
    return "Arcade"

def fetch_entry(item):
    path = item["path"]
    try:
        raw = request(
            f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/"
            + urllib.parse.quote(path, safe="/"),
            timeout=20,
        )
        text = raw.decode("utf-8", errors="ignore")
        title = title_from_html(text)
        if not title:
            title = Path(path).stem.replace("-", " ").replace("_", " ").strip() or "Cosmic Game"
        return {
            "name": title,
            "path": "",
            "category": category_for(title, text),
            "tags": ["cosmicgames", "external"],
            "featured": False,
            "externalUrl": CDN_ROOT + urllib.parse.quote(path, safe="/"),
            "sourcePath": path,
        }
    except Exception as exc:
        # A metadata fetch failure must not drop the game from the catalog.
        return {
            "name": Path(path).stem.replace("-", " ").replace("_", " ").strip() or "Cosmic Game",
            "path": "",
            "category": "Arcade",
            "tags": ["cosmicgames", "external"],
            "featured": False,
            "externalUrl": CDN_ROOT + urllib.parse.quote(path, safe="/"),
            "sourcePath": path,
        }

def normalize_name(value):
    return re.sub(r"\\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold())).strip()

def normalize_name(value):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").casefold())).strip()

def main():
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    payload = json.loads(request(f"{API_ROOT}/git/trees/{BRANCH}?recursive=1", token=token))
    files = [
        item for item in payload.get("tree", [])
        if item.get("type") == "blob" and item.get("path", "").lower().endswith(".html")
    ]
    print(f"Found {len(files)} HTML source files in {REPO}.")

    games = json.loads(GAMES_JSON.read_text(encoding="utf-8")) if GAMES_JSON.exists() else []
    if not isinstance(games, list):
        raise ValueError(f"{GAMES_JSON} must contain a JSON array")

    seen_names = {normalize_name(game.get("name", "")) for game in games if game.get("name")}
    new_entries = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for entry in pool.map(fetch_entry, files):
            if not entry:
                continue
            key = normalize_name(entry["name"])
            if not key or key in seen_names:
                continue
            new_entries.append(entry)
            seen_names.add(key)

    new_entries.sort(key=lambda x: str(x["sourcePath"]).casefold())
    games.extend(new_entries)
    GAMES_JSON.write_text(json.dumps(games, indent=2) + "\n", encoding="utf-8")

    print(f"Found {len(files)} source HTML files; added {len(new_entries)} new games; registry now contains {len(games)} games.")

if __name__ == "__main__":
    main()
