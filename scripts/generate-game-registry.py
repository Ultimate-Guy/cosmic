#!/usr/bin/env python3
"""Generate the lessons page registry and add Cosmic navigation/settings to game pages."""
import json
import re
import urllib.parse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LESSONS_DIR=ROOT/'pages'/'lessons'
OUTPUT=LESSONS_DIR/'games.json'
IMAGE_EXTENSIONS={'.gif','.jpeg','.jpg','.png','.svg','.webp'}
EXCLUDED_FOLDERS={'img','apps'}

GAME_NAV='''
  <style id="cosmic-game-nav-style">
    #cosmic-home-button{position:fixed;top:12px;left:12px;z-index:2147483647;padding:6px 11px;border:1px solid rgba(45,204,255,.42);border-radius:9px;background:rgba(13,26,33,.92);color:#2dccff;font:700 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);backdrop-filter:blur(8px);pointer-events:auto}
    #cosmic-home-button:hover{background:rgba(45,204,255,.14)}
  </style>
  <button id="cosmic-home-button" type="button" aria-label="Return to Cosmic games">← Home</button>
  <script>
    (()=>{
      const button=document.getElementById('cosmic-home-button');
      if(!button)return;
      button.addEventListener('click',()=>{
        const target=new URL('../lessons.html',window.location.href);
        window.location.assign(target.href);
      });
    })();
  </script>
'''
# Resolve against the actual page URL so a game's <base> tag cannot redirect this script to a CDN.
SETTINGS_SCRIPT='''<script id="cosmic-settings-engine-loader">\n(()=>{const s=document.createElement('script');s.id='cosmic-settings-engine';s.src=new URL('../../../settings/settings-engine.js',window.location.href).href;document.head.appendChild(s);})();\n</script>\n'''

def display_name(folder_name):
    words=re.sub(r'([a-z])([A-Z])',r'\1 \2',folder_name)
    words=re.sub(r'[_-]+',' ',words).strip()
    words=re.sub(r'\s+',' ',words)
    return words.title() or 'Untitled Game'

def read_metadata(folder):
    metadata_path=next((path for path in folder.iterdir() if path.name.lower()=='game.json'),None)
    if metadata_path is None:return {}
    with metadata_path.open(encoding='utf-8') as metadata_file: metadata=json.load(metadata_file)
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
    relative=path.relative_to(ROOT).as_posix(); return urllib.parse.quote(relative,safe='/')+'/'

def add_game_navigation(folder):
    index=folder/'index.html'
    if not index.is_file():return
    text=index.read_text(encoding='utf-8')
    # Remove every previous generated engine tag/loader, including old src-based versions.
    text=re.sub(r'\s*<script id="cosmic-settings-engine(?:-loader)?"[^>]*>.*?</script>\s*', '\n', text, flags=re.DOTALL)
    if '</head>' in text:text=text.replace('</head>',SETTINGS_SCRIPT+'</head>',1)
    else:text=SETTINGS_SCRIPT+text
    # Always restore the generated Home control if a game page lost it.
    text=re.sub(r'\s*<style id="cosmic-game-nav-style">.*?</style>\s*<button id="cosmic-home-button".*?</button>\s*<script>.*?</script>\s*', '\n', text, count=1, flags=re.DOTALL)
    if '</body>' in text:text=text.replace('</body>',GAME_NAV+'\n</body>',1)
    else:text+=GAME_NAV
    index.write_text(text,encoding='utf-8')

def build_game(folder,metadata):
    image=choose_image(folder,metadata); entry=choose_entry(folder,metadata)
    game={'name':metadata.get('title',display_name(folder.name)),'path':registry_path(folder)}
    if entry:game['entry']=entry
    if image:game['image']=registry_path(image).rstrip('/')
    return game

def main():
    games=[]
    if LESSONS_DIR.is_dir():
        for folder in sorted(path for path in LESSONS_DIR.iterdir() if path.is_dir()):
            if folder.name.lower() in EXCLUDED_FOLDERS:continue
            metadata=read_metadata(folder); add_game_navigation(folder); games.append(build_game(folder,metadata))
    OUTPUT.parent.mkdir(parents=True,exist_ok=True); OUTPUT.write_text(json.dumps(games,indent=2)+'\n',encoding='utf-8'); print(f'Generated {len(games)} game entries in {OUTPUT}')
if __name__=='__main__':main()
