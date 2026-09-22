#!/usr/bin/env python3
"""Generate Cosmic registries and normalize shared Cosmic Hub script loaders."""
import json
import re
import urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LESSONS_DIR=ROOT/'pages'/'lessons'; OUTPUT=LESSONS_DIR/'games.json'; EXTERNAL_GAMES_FILE=LESSONS_DIR/'cosmicgames.json'; LESSONS_PAGE=LESSONS_DIR/'lessons.html'; APPS_PAGE=ROOT/'apps'/'apps.html'
IMAGE_EXTENSIONS={'.gif','.jpeg','.jpg','.png','.svg','.webp'}; EXCLUDED_FOLDERS={'img','apps'}
LESSONS_LOADERS={'cosmic-dev-tools.js':'../../scripts/cosmic-dev-tools.js?build=dev-commands-v4','cosmic-hub.js':'../../scripts/cosmic-hub.js?v=3','cosmic-admin-guard.js':'../../scripts/cosmic-admin-guard.js?v=3','cosmic-launch-fix.js':'../../scripts/cosmic-launch-fix.js?v=3','cosmic-feedback.js':'../../scripts/cosmic-feedback.js?v=2','cosmic-profile-widget.js':'../../scripts/cosmic-profile-widget.js?v=2'}
APPS_LOADERS={'cosmic-dev-tools.js':'../scripts/cosmic-dev-tools.js?build=dev-commands-v4','cosmic-hub.js':'../scripts/cosmic-hub.js?v=3','cosmic-admin-guard.js':'../scripts/cosmic-admin-guard.js?v=3','cosmic-pwa.js':'../scripts/cosmic-pwa.js?v=3','cosmic-feedback.js':'../scripts/cosmic-feedback.js?v=2','cosmic-profile-widget.js':'../scripts/cosmic-profile-widget.js?v=2'}
def display_name(folder_name):
    words=re.sub(r'([a-z])([A-Z])',r'\1 \2',folder_name); words=re.sub(r'[_-]+',' ',words).strip(); words=re.sub(r'\s+',' ',words); return words.title() or 'Untitled Game'
def read_metadata(folder):
    p=next((x for x in folder.iterdir() if x.name.lower()=='game.json'),None)
    if p is None:return {}
    with p.open(encoding='utf-8') as f:m=json.load(f)
    if not isinstance(m,dict):raise ValueError(f'{p} must contain a JSON object')
    return m
def choose_image(folder,metadata):
    configured=metadata.get('image')
    if configured:
        p=folder/configured
        if p.is_file():return p
        raise FileNotFoundError(f'Thumbnail does not exist: {p}')
    images=sorted(p for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS); return images[0] if images else None
def choose_entry(folder,metadata):
    configured=metadata.get('entry')
    if not configured:return None
    p=(folder/configured).resolve()
    if folder.resolve() not in p.parents or not p.is_file():raise FileNotFoundError(f'Entry file does not exist in {folder}: {configured}')
    return urllib.parse.quote(configured.replace('\\','/'),safe='/')
def infer_category(name,metadata):
    explicit=str(metadata.get('category','')).strip()
    if explicit:return explicit
    text=f"{name} {' '.join(map(str,metadata.get('tags',[])))}".lower()
    if re.search(r'ai|chat|assistant|utility|tool|github|calculator|music|youtube',text):return 'Utility'
    if re.search(r'puzz|2048|chess|word|sudoku|mahjong|memory|brain',text):return 'Puzzle'
    if re.search(r'multiplayer|2 player|2-player|among us|basket|soccer|karts|battle|brawl|bros|versus|vs\\.?',text):return 'Multiplayer'
    return 'Arcade'
def normalize_loaders(path,loaders):
    if not path.is_file():return
    text=path.read_text(encoding='utf-8'); original=text
    if path==LESSONS_PAGE:
        text=re.sub(r"\s*<script[^>]*src=[\"'][^\"']*game-guard\.js[^\"']*[\"'][^>]*>\s*</script>\s*",'\\n',text,flags=re.I)
    for filename,src in loaders.items():
        pattern=rf'<script\b[^>]*\bsrc=["\'][^"\']*{re.escape(filename)}(?:\?[^"\']*)?["\'][^>]*>\s*</script>'
        text=re.sub(pattern,f'<script src="{src}"></script>',text,flags=re.I)
    missing=[]
    for filename,src in loaders.items():
        if not re.search(rf'<script\b[^>]*\bsrc=["\'][^"\']*{re.escape(filename)}(?:\?[^"\']*)?["\']',text,flags=re.I):missing.append(f'<script src="{src}"></script>')
    if missing:
        insertion='\n'+'\n'.join(missing)+'\n'
        matches=list(re.finditer(r'</body>',text,re.I))
        if matches:
            pos=matches[-1].start()
            text=text[:pos]+insertion+text[pos:]
        else:
            text=text+insertion
    if path==LESSONS_PAGE and 'rel="manifest"' not in text:
        manifest='<link rel="manifest" href="../../manifest.json">\n'; text=re.sub(r'</head>',manifest+'</head>',text,count=1,flags=re.I) if re.search(r'</head>',text,re.I) else manifest+text
    if text!=original:path.write_text(text,encoding='utf-8')
def fix_updates_flow():
    if LESSONS_PAGE.is_file():
        text=LESSONS_PAGE.read_text(encoding='utf-8')
        old="""        if(sessionStorage.getItem(unlockKey)==='true'){
            showGames();
            loadRegistry();
            showUpdatesIfChanged();
        }"""; new="""        if(sessionStorage.getItem(unlockKey)==='true'){
            showGames();
            loadRegistry();
        }"""
        if old in text:text=text.replace(old,new,1)
        LESSONS_PAGE.write_text(text,encoding='utf-8')
    normalize_loaders(LESSONS_PAGE,LESSONS_LOADERS); normalize_loaders(APPS_PAGE,APPS_LOADERS)

def clean_game_page(folder):
    index=folder/'index.html'
    if not index.is_file():return
    text=index.read_text(encoding='utf-8')
    text=normalize_base_relative_assets(text)
    cleaned=re.sub(r'\s*<script id="cosmic-settings-engine(?:-loader)?"[^>]*>.*?</script>\s*','\n',text,flags=re.DOTALL)
    cleaned=re.sub(r'\s*<script id="cosmic-game-guard-loader"[^>]*>.*?</script>\s*','\n',cleaned,flags=re.DOTALL)
    cleaned=re.sub(r'\s*<script id="cosmic-game-guard(?:-reinject)?"[^>]*>.*?</script>\s*','\n',cleaned,flags=re.DOTALL)
    cleaned=re.sub(r'\s*<script[^>]*src=["\'][^"\']*cosmic-dev-tools\.js[^"\']*["\'][^>]*>\s*</script>\s*','\n',cleaned,flags=re.DOTALL)
    for loader in ('game-guard.js','cosmic-dev-loader.js','cosmic-dev-tools.js','cosmic-wrapper-controls.js','cosmic-global-state.js'):
        cleaned=re.sub(r'\s*<script[^>]*src=["\'][^"\']*'+re.escape(loader)+r'[^"\']*["\'][^>]*>\s*</script>\s*','\n',cleaned,flags=re.DOTALL)
    cleaned=re.sub(r'\s*<script[^>]*id=["\']cosmic-game-runtime-loader["\'][^>]*>.*?</script>\s*','\n',cleaned,flags=re.DOTALL)
    insertion='''\n<script id="cosmic-game-runtime-loader">
(() => {
  const root = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  const files = [
    'scripts/game-guard.js?v=guard',
    'scripts/cosmic-wrapper-controls.js?v=wrapper-v5',
    'scripts/cosmic-global-state.js?v=global-state-v5',
    'scripts/cosmic-dev-tools.js?build=dev-commands-v5'
  ];
  for (const file of files) {
    const script = document.createElement('script');
    script.src = root + file;
    script.async = false;
    (document.body || document.documentElement).appendChild(script);
  }
})();
</script>\n'''
    matches=list(re.finditer(r'</body>',cleaned,re.I))
    if matches:
        pos=matches[-1].start()
        cleaned=cleaned[:pos]+insertion+cleaned[pos:]
    else:
        cleaned=cleaned+insertion
    # Game packages sometimes ship their own service-worker registration. Cosmic
    # owns the only service worker now; replace those calls with resolved promises
    # so the game code continues without registering another worker.
    cleaned=normalize_unity_bootstrap(cleaned)
    cleaned=cleaned.replace('navigator.serviceWorker.register(', 'Promise.resolve(')
    if cleaned!=text:index.write_text(cleaned,encoding='utf-8')
def registry_path(path):return urllib.parse.quote(path.relative_to(ROOT).as_posix(),safe='/')+'/'
def build_game(folder,metadata):
    image=choose_image(folder,metadata); entry=choose_entry(folder,metadata); name=str(metadata.get('title',display_name(folder.name))); tags=metadata.get('tags',[])
    if not isinstance(tags,list):tags=[tags]
    game={'name':name,'path':registry_path(folder),'category':infer_category(name,metadata),'tags':[str(x) for x in tags],'featured':bool(metadata.get('featured',False))}
    if entry:game['entry']=entry
    if image:game['image']=registry_path(image).rstrip('/')
    return game
def read_external_games():
    if not EXTERNAL_GAMES_FILE.is_file():
        return []
    with EXTERNAL_GAMES_FILE.open(encoding='utf-8') as f:
        data=json.load(f)
    if not isinstance(data,list):
        raise ValueError(f'{EXTERNAL_GAMES_FILE} must contain a JSON array')
    cleaned=[]
    for game in data:
        if not isinstance(game,dict):
            continue
        name=str(game.get('name','')).strip()
        external_url=str(game.get('externalUrl','')).strip()
        if not name or not external_url:
            continue
        item=dict(game)
        item['name']=name
        item['externalUrl']=external_url
        item.setdefault('path','')
        item.setdefault('category','Arcade')
        item.setdefault('tags',[])
        item.setdefault('featured',False)
        cleaned.append(item)
    return cleaned

def main():
    fix_updates_flow(); games=[]
    if LESSONS_DIR.is_dir():
        for folder in sorted(p for p in LESSONS_DIR.iterdir() if p.is_dir()):
            if folder.name.lower() in EXCLUDED_FOLDERS:continue
            metadata=read_metadata(folder); clean_game_page(folder); games.append(build_game(folder,metadata))
    existing_names={str(game.get('name','')).strip().lower() for game in games}
    games.extend(game for game in read_external_games() if game['name'].lower() not in existing_names)
    OUTPUT.parent.mkdir(parents=True,exist_ok=True); OUTPUT.write_text(json.dumps(games,indent=2)+'\n',encoding='utf-8'); print(f'Generated {len(games)} game entries and normalized Cosmic Hub loaders')
if __name__=='__main__':main()
