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

# Keep the safety filter scoped to the actual game identity, not arbitrary
# JavaScript/CSS source. This avoids false positives such as "method" matching
# "meth" or "console.warn" matching "war".
BLOCKED = re.compile(
    r"\b(casino|poker|blackjack|roulette|slots?|betting|gambling|"
    r"porn|hentai|nude|nudity|xxx|adult|"
    r"gun|guns|rifle|pistol|sniper|weapon|weapons|knife|knives|sword|"
    r"shoot(?:er|ing)?|war|murder|kill|blood|gore|"
    r"self[- ]?harm|suicide|drug|cocaine|meth|heroin)\b",
    re.I,
)

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
            # Some source files omit a <title>. Use the source filename so the
            # game can still be cataloged without depending on arbitrary code.
            title = Path(path).stem.replace("-", " ").replace("_", " ").strip()
        if BLOCKED.search(f"{path} {title}"):
            return None
        url = CDN_ROOT + urllib.parse.quote(path, safe="/")
        return {
            "name": title,
            "path": "",
            "category": category_for(title, text),
            "tags": ["cosmicgames", "external"],
            "featured": False,
            "externalUrl": url,
            "sourcePath": path,
        }
    except Exception as exc:
        print(f"Skipping {path}: {exc}")
        return None

def main():
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    payload = json.loads(request(f"{API_ROOT}/git/trees/{BRANCH}?recursive=1", token=token))
    files = [
        item for item in payload.get("tree", [])
        if item.get("type") == "blob" and item.get("path", "").lower().endswith(".html")
    ]
    print(f"Found {len(files)} HTML source files in {REPO}.")

    entries = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for entry in pool.map(fetch_entry, files):
            if entry:
                entries.append(entry)

    # Stable ordering and duplicate-name removal.
    entries.sort(key=lambda x: (x["name"].casefold(), x["sourcePath"].casefold()))
    seen = set()
    unique = []
    for entry in entries:
        key = entry["name"].casefold()
        if key not in seen:
            seen.add(key)
            unique.append(entry)

    EXTERNAL_JSON.write_text(json.dumps(unique, indent=2) + "\n", encoding="utf-8")

    games = json.loads(GAMES_JSON.read_text(encoding="utf-8"))
    games = [
        game for game in games
        if "cosmicgames" not in [str(tag).casefold() for tag in game.get("tags", [])]
    ]
    existing = {str(game.get("name", "")).casefold() for game in games}
    games.extend(entry for entry in unique if entry["name"].casefold() not in existing)
    GAMES_JSON.write_text(json.dumps(games, indent=2) + "\n", encoding="utf-8")

    print(f"Generated {len(unique)} Cosmic Games entries; registry now contains {len(games)} games.")

if __name__ == "__main__":
    main()
