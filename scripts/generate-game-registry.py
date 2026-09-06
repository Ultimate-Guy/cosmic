#!/usr/bin/env python3
"""Generate the lessons game registry and inject shared game navigation/settings."""
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

GAME_NAV='''
  <style id="cosmic-game-nav-style">
    #cosmic-home-button{position:fixed;top:12px;left:12px;z-index:2147483647;padding:6px 11px;border:1px solid rgba(45,204,255,.42);border-radius:9px;background:rgba(13,26,33,.92);color:#2dccff;font:700 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);backdrop-filter:blur(8px);pointer-events:auto}
    #cosmic-home-button:hover{background:rgba(45,204,255,.14)}
    #cosmic-home-button.cosmic-fullscreen-home{position:absolute;top:12px;left:12px}
  </style>
  <button id="cosmic-home-button" type="button" aria-label="Return to Cosmic games">← Home</button>
  <script>
    (()=>{
      function install(){
        if(window.__cosmicFullscreenGuardInstalled)return;
        window.__cosmicFullscreenGuardInstalled=true;

        const addHome=()=>{
          let button=document.getElementById('cosmic-home-button');
          if(!button&&document.body){
            button=document.createElement('button');
            button.id='cosmic-home-button';
            button.type='button';
            button.setAttribute('aria-label','Return to Cosmic games');
            button.textContent='← Home';
            document.body.appendChild(button);
            button.addEventListener('click',()=>{
              const target=new URL('../lessons.html',window.location.href);
              try{window.top.location.assign(target.href);}catch{window.location.assign(target.href);}
            });
          }
          return button;
        };

        const addStyle=()=>{
          if(document.getElementById('cosmic-game-nav-style'))return;
          const style=document.createElement('style');
          style.id='cosmic-game-nav-style';
          style.textContent='#cosmic-home-button{position:fixed;top:12px;left:12px;z-index:2147483647;padding:6px 11px;border:1px solid rgba(45,204,255,.42);border-radius:9px;background:rgba(13,26,33,.92);color:#2dccff;font:700 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);backdrop-filter:blur(8px);pointer-events:auto}#cosmic-home-button:hover{background:rgba(45,204,255,.14)}#cosmic-home-button.cosmic-fullscreen-home{position:absolute;top:12px;left:12px}';
          (document.head||document.documentElement).appendChild(style);
        };

        const ensureShell=()=>{
          let shell=document.getElementById('cosmic-fullscreen-shell');
          if(shell&&shell.isConnected)return shell;
          if(!document.body)return null;
          shell=document.createElement('div');
          shell.id='cosmic-fullscreen-shell';
          shell.style.cssText='width:100%;height:100%;position:relative;overflow:hidden;';
          while(document.body.firstChild) shell.appendChild(document.body.firstChild);
          document.body.appendChild(shell);
          return shell;
        };

        const exitCleanup=()=>{
          const shell=document.getElementById('cosmic-fullscreen-shell');
          if(!shell||document.fullscreenElement)return;
          while(shell.firstChild)document.body.appendChild(shell.firstChild);
          shell.remove();
          const button=document.getElementById('cosmic-home-button');
          if(button)button.classList.remove('cosmic-fullscreen-home');
        };

        const patchFullscreen=()=>{
          ['requestFullscreen','webkitRequestFullscreen','webkitRequestFullScreen','mozRequestFullScreen','msRequestFullscreen'].forEach(name=>{
            const proto=Element.prototype;
            const native=proto[name];
            const marker='__cosmicPatched_'+name;
            if(typeof native!=='function'||proto[marker])return;
            proto[marker]=true;
            proto[name]=function(options){
              if(this.id==='cosmic-fullscreen-shell')return native.call(this,options);
              const shell=ensureShell();
              if(!shell)return native.call(this,options);
              const button=addHome();
              if(button&&button.parentNode!==shell)shell.appendChild(button);
              button&&button.classList.add('cosmic-fullscreen-home');
              return native.call(shell,options);
            };
          });
        };

        addStyle();
        if(document.body)addHome();else document.addEventListener('DOMContentLoaded',addHome,{once:true});
        patchFullscreen();
        document.addEventListener('fullscreenchange',()=>{
          const button=document.getElementById('cosmic-home-button');
          const fs=document.fullscreenElement;
          if(fs){
            if(button&&fs.id==='cosmic-fullscreen-shell'){
              fs.appendChild(button);
              button.classList.add('cosmic-fullscreen-home');
            }
          }else exitCleanup();
        });
      }

      install();
      const originalWrite=Document.prototype.write;
      if(!Document.prototype.__cosmicWritePatched){
        Document.prototype.__cosmicWritePatched=true;
        const persistent='('+install.toString()+')();';
        Document.prototype.write=function(...args){
          let html=args.join('');
          if(/<html[\\s>]/i.test(html)){
            const script='<script id="cosmic-fullscreen-guard">'+persistent.replace(/<\\/script/gi,'<\\\\/script')+'<\\/script>';
            if(/<head[\\s>]/i.test(html))html=html.replace(/<head[\\s>]/i,m=>m+script);
            else html=script+html;
          }
          return originalWrite.call(this,html);
        };
      }
    })();
  </script>
'''
SETTINGS_SCRIPT='''<script id="cosmic-settings-engine-loader">\n(()=>{const s=document.createElement('script');s.id='cosmic-settings-engine';s.src=new URL('../../../settings/settings-engine.js',window.location.href).href;document.head.appendChild(s);})();\n</script>\n'''

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

def add_game_navigation(folder):
    index=folder/'index.html'
    if not index.is_file():return
    text=index.read_text(encoding='utf-8')
    text=re.sub(r'\s*<script id="cosmic-settings-engine(?:-loader)?"[^>]*>.*?</script>\s*','\n',text,flags=re.DOTALL)
    if '</head>' in text:text=text.replace('</head>',SETTINGS_SCRIPT+'</head>',1)
    else:text=SETTINGS_SCRIPT+text
    text=re.sub(r'\s*<style id="cosmic-game-nav-style">.*?</style>\s*<button id="cosmic-home-button".*?</button>\s*<script>.*?</script>\s*','\n',text,count=1,flags=re.DOTALL)
    if '</body>' in text:text=text.replace('</body>',GAME_NAV+'\n</body>',1)
    else:text+=GAME_NAV
    index.write_text(text,encoding='utf-8')

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
            add_game_navigation(folder)
            games.append(build_game(folder,metadata))
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(games,indent=2)+'\n',encoding='utf-8')
    print(f'Generated {len(games)} game entries and injected navigation/settings')

if __name__=='__main__':main()
