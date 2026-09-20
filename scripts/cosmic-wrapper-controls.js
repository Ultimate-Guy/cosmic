(() => {
  if(!window.__COSMIC_GLOBAL_STATE__&&!document.querySelector('script[data-cosmic-global-state]')){
    const s=document.createElement('script');
    s.dataset.cosmicGlobalState='1';
    s.src=(location.hostname.endsWith('.github.io')?'/cosmic/':'/')+'scripts/cosmic-global-state.js?v=global-state';
    (document.head||document.documentElement).appendChild(s);
  }
  'use strict';
  if(window.__COSMIC_WRAPPER_CONTROLS__)return;
  window.__COSMIC_WRAPPER_CONTROLS__=true;

  const frame=document.querySelector('#game,#appframe');
  if(!frame)return;

  const wrap=document.createElement('div');
  wrap.id='cosmic-wrapper-controls';
  wrap.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;display:flex;gap:5px;align-items:center;padding:5px;border:1px solid rgba(45,204,255,.24);border-radius:11px;background:rgba(5,14,21,.92);backdrop-filter:blur(8px);box-shadow:0 6px 22px rgba(0,0,0,.5);cursor:grab;user-select:none;touch-action:none';

  const style='width:34px;height:32px;border:1px solid #2dccff;border-radius:8px;background:#0d1a21;color:#2dccff;font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);touch-action:none';
  const warningStyle='width:34px;height:32px;border:1px solid #ffb454;border-radius:8px;background:#241b0e;color:#ffc66d;font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);touch-action:none';

  const add=(label,title,fn,buttonStyle)=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=label;
    b.title=title;
    b.style.cssText=buttonStyle||style;
    b.dataset.cosmicControl='1';
    b.addEventListener('click',e=>{
      if(b.dataset.dragged==='1'){
        b.dataset.dragged='0';
        return;
      }
      fn(e);
    });
    wrap.appendChild(b);
    return b;
  };

  add('⛶','Fullscreen',async()=>{
    try{
      if(frame.requestFullscreen)await frame.requestFullscreen();
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    }catch(_){}
  });

  add('↻','Reload',()=>{
    try{
      if(frame.src)frame.src=frame.src;
      else location.reload();
    }catch(_){location.reload();}
  });

  add('↗','Pop out',()=>{
    try{
      const source=frame.src||location.href;
      const escaped=source.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosmic</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe id="cosmic-popout" src="'+escaped+'" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe><button id="fs" style="position:fixed;right:12px;bottom:12px;padding:9px 12px;border:1px solid #2dccff;border-radius:9px;background:#081923;color:#8fe8ff;font:700 13px system-ui,sans-serif;cursor:pointer">Fullscreen</button><script>const f=document.getElementById("cosmic-popout"),b=document.getElementById("fs");b.onclick=()=>f.requestFullscreen?.().catch(()=>{});window.addEventListener("load",()=>{try{f.requestFullscreen?.()}catch(_){}});<\/script></body></html>';
      const win=window.open('about:blank','_blank');
      if(!win)return;
      win.document.open();
      win.document.write(html);
      win.document.close();
    }catch(_){}
  });

  async function resolveCurrentGameName(){
    const base=location.hostname.endsWith('.github.io')?'/cosmic/':'/';
    let targetPath=location.pathname||'';

    try{
      const raw=new URLSearchParams(location.search).get('game');
      if(raw){
        targetPath=new URL(raw,location.href).pathname||targetPath;
      }
    }catch(_){}

    const normalizePath=value=>{
      try{
        let path=decodeURIComponent(String(value||''));
        path=path.replace(/\\/g,'/').replace(/\/index\.html$/i,'').replace(/\/+$/,'');
        return path.toLowerCase();
      }catch(_){
        return String(value||'').toLowerCase().replace(/\/index\.html$/i,'').replace(/\/+$/,'');
      }
    };

    const current=normalizePath(targetPath);

    try{
      const response=await fetch(base+'pages/lessons/games.json?report='+Date.now(),{cache:'no-store'});
      if(response.ok){
        const games=await response.json();
        if(Array.isArray(games)){
          for(const game of games){
            if(!game||!game.path||!game.name)continue;
            const gamePath=new URL(base+game.path+(game.entry||''),location.origin).pathname;
            const normalizedGame=normalizePath(gamePath);
            if(current===normalizedGame||current.startsWith(normalizedGame+'/')){
              return String(game.name);
            }
          }
        }
      }
    }catch(_){}

    try{
      const parts=decodeURIComponent(targetPath).split('/').filter(Boolean);
      const lessonsIndex=parts.map(x=>x.toLowerCase()).lastIndexOf('lessons');
      if(lessonsIndex>=0&&parts[lessonsIndex+1]){
        return parts[lessonsIndex+1].replace(/[-_]+/g,' ');
      }
    }catch(_){}

    return 'Current game';
  }

  add('⚠','Report this game',async()=>{
    const form='https://docs.google.com/forms/d/e/1FAIpQLSfLFwfXdL_Fk8FGAAXPire3yIPX0qIoj3Ua1dAGQsw4pTb98Q/viewform';
    const gameField='entry.1659521365';

    // Open the actual report tab immediately from the click, then fill
    // the game name once the registry lookup finishes.
    const reportTab=window.open('about:blank','_blank');
    if(!reportTab)return;

    try{
      reportTab.document.title='Cosmic Report';
      const gameName=await resolveCurrentGameName();
      const url=new URL(form);
      url.searchParams.set('usp','pp_url');
      url.searchParams.set(gameField,gameName);
      reportTab.location.href=url.href;
    }catch(_){
      reportTab.location.href=form;
    }
  },warningStyle);

  document.body.appendChild(wrap);

  let dragging=false,moved=false,startX=0,startY=0,startLeft=0,startTop=0;
  wrap.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    if(e.target.closest('button'))return;
    const r=wrap.getBoundingClientRect();
    dragging=true;
    moved=false;
    startX=e.clientX;
    startY=e.clientY;
    startLeft=r.left;
    startTop=r.top;
    wrap.style.left=r.left+'px';
    wrap.style.top=r.top+'px';
    wrap.style.right='auto';
    wrap.style.bottom='auto';
    wrap.style.cursor='grabbing';
    wrap.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });

  wrap.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const dx=e.clientX-startX;
    const dy=e.clientY-startY;
    if(!moved&&(Math.abs(dx)>4||Math.abs(dy)>4))moved=true;
    if(moved){
      wrap.style.left=Math.max(0,Math.min(window.innerWidth-wrap.offsetWidth,startLeft+dx))+'px';
      wrap.style.top=Math.max(0,Math.min(window.innerHeight-wrap.offsetHeight,startTop+dy))+'px';
      e.preventDefault();
    }
  });

  const stopDrag=e=>{
    if(!dragging)return;
    dragging=false;
    wrap.style.cursor='grab';
    if(wrap.releasePointerCapture?.(e.pointerId)&&wrap.hasPointerCapture?.(e.pointerId))wrap.releasePointerCapture(e.pointerId);
  };
  wrap.addEventListener('pointerup',stopDrag);
  wrap.addEventListener('pointercancel',()=>{dragging=false;wrap.style.cursor='grab'});

  window.addEventListener('resize',()=>{
    const r=wrap.getBoundingClientRect();
    if(!wrap.style.left&&!wrap.style.top)return;
    wrap.style.left=Math.max(0,Math.min(window.innerWidth-wrap.offsetWidth,r.left))+'px';
    wrap.style.top=Math.max(0,Math.min(window.innerHeight-wrap.offsetHeight,r.top))+'px';
  });
})();