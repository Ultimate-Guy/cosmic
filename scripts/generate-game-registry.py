#!/usr/bin/env python3
"""Generate the lessons game registry and clean legacy injected game scripts."""
import json
import re
import urllib.parse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LESSONS_DIR=ROOT/'pages'/'lessons'
OUTPUT=LESSONS_DIR/'games.json'
LESSONS_PAGE=LESSONS_DIR/'lessons.html'
IMAGE_EXTENSIONS={'.gif','.jpeg','.jpg','.png','.svg','.webp'}
EXCLUDED_FOLDERS={'img','apps'}

def display_name(folder_name):
    words=re.sub(r'([a-z])([A-Z])',r'\1 \2',folder_name)
    words=re.sub(r'[_-]+',' ',words).strip()
    words=re.sub(r'\s+',' ',words)
    return words.title() or 'Untitled Game'

def read_metadata(folder):
    metadata_path=next((path for path in folder.iterdir() if path.name.lower()=='game.json'),None)
    if metadata_path is None:return {}
    with metadata_path.open(encoding='utf-8') as metadata_file:metadata=json.load(metadata_file)
    if not isinstance(metadata,dict):raise ValueError(f'{metadata_path} must contain a JSON object')
    return metadata

def choose_image(folder,metadata):
    configured_image=metadata.get('image')
    if configured_image:
        image_path=folder/configured_image
        if image_path.is_file():return image_path
        raise FileNotFoundError(f'Thumbnail does not exist: {image_path}')
    images=sorted(path for path in folder.rglob('*') if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS)
    return images[0] if images else None

def choose_entry(folder,metadata):
    configured_entry=metadata.get('entry')
    if not configured_entry:return None
    entry_path=(folder/configured_entry).resolve()
    if folder.resolve() not in entry_path.parents or not entry_path.is_file():raise FileNotFoundError(f'Entry file does not exist in {folder}: {configured_entry}')
    return urllib.parse.quote(configured_entry.replace('\\','/'),safe='/')

def registry_path(path):
    relative=path.relative_to(ROOT).as_posix()
    return urllib.parse.quote(relative,safe='/')+'/'

def fix_updates_flow():
    if not LESSONS_PAGE.is_file():return
    text=LESSONS_PAGE.read_text(encoding='utf-8')
    old="""        if(sessionStorage.getItem(unlockKey)==='true'){
            showGames();
            loadRegistry();
            showUpdatesIfChanged();
        }"""
    new="""        if(sessionStorage.getItem(unlockKey)==='true'){
            showGames();
            loadRegistry();
        }"""
    if old in text:
        text=text.replace(old,new,1)
        LESSONS_PAGE.write_text(text,encoding='utf-8')

def clean_game_page(folder):
    """Remove legacy guard/settings injections that can break game runtimes."""
    index=folder/'index.html'
    if not index.is_file():return
    text=index.read_text(encoding='utf-8')
    cleaned=re.sub(r'\s*<script id="cosmic-settings-engine(?:-loader)?"[^>]*>.*?</script>\s*','\n',text,flags=re.DOTALL)
    cleaned=re.sub(r'\s*<script id="cosmic-game-guard-loader"[^>]*>.*?</script>\s*','\n',cleaned,flags=re.DOTALL)
    cleaned=re.sub(r'\s*<script id="cosmic-game-guard(?:-reinject)?"[^>]*>.*?</script>\s*','\n',cleaned,flags=re.DOTALL)
    if cleaned!=text:index.write_text(cleaned,encoding='utf-8')

def build_game(folder,metadata):
    image=choose_image(folder,metadata);entry=choose_entry(folder,metadata)
    game={'name':metadata.get('title',display_name(folder.name)),'path':registry_path(folder)}
    if entry:game['entry']=entry
    if image:game['image']=registry_path(image).rstrip('/')
    return game

def main():
    fix_updates_flow()
    games=[]
    if LESSONS_DIR.is_dir():
        for folder in sorted(path for path in LESSONS_DIR.iterdir() if path.is_dir()):
            if folder.name.lower() in EXCLUDED_FOLDERS:continue
            metadata=read_metadata(folder)
            clean_game_page(folder)
            games.append(build_game(folder,metadata))
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(games,indent=2)+'\n',encoding='utf-8')
    print(f'Generated {len(games)} game entries and removed legacy injected scripts')

if __name__=='__main__':main()
