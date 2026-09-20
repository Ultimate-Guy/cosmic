(() => {
  'use strict';

  const ADMIN_NAME = 'TheDevilAngel';
  const SESSION_KEY = 'cosmicCurrentUserV1';
  const TOKEN_KEY = 'cosmicDeveloperTokenV1';
  const ADMIN_GATE_KEY = 'cosmicSecretAdminPasswordV1';
  const ENTRY_KEY = 'cosmicGamesUnlocked';
  const API = location.origin;

  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function currentUser() {
    try { return localStorage.getItem(SESSION_KEY) || 'Guest'; } catch (_) { return 'Guest'; }
  }
  function hasAdminGateAuth() {
    try {
      return localStorage.getItem(ADMIN_GATE_KEY) === '1' &&
        sessionStorage.getItem(ENTRY_KEY) === '1';
    } catch (_) { return false; }
  }
  function isDeveloper() {
    // Account usernames are origin-scoped, so GitHub Pages and the Cloudflare
    // Worker cannot share cosmicCurrentUserV1. The existing admin gate is the
    // secure per-origin fallback after its admin password has been verified.
    return currentUser() === ADMIN_NAME || hasAdminGateAuth();
  }
  function isGameContext() {
    // Developer controls are intentionally global: the authenticated developer
    // menu should be available on the Hub, apps, settings, game shell, and games.
    return true;
  }
  function showToast(message) {
    let t = document.getElementById('cosmic-dev-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'cosmic-dev-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483646;max-width:min(560px,92vw);padding:10px 14px;border:1px solid #2dccff;border-radius:12px;background:rgba(5,12,18,.96);color:#f2f7fa;font:600 13px system-ui,sans-serif;box-shadow:0 14px 50px rgba(0,0,0,.55);opacity:0;transition:opacity .18s ease;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.style.opacity = '1';
    clearTimeout(t.__hide);
    t.__hide = setTimeout(() => { t.style.opacity = '0'; }, 2200);
  }

  async function adminToken() {
    if (!isDeveloper()) return null;
    try {
      const cached = sessionStorage.getItem(TOKEN_KEY);
      if (cached) return cached;
    } catch (_) {}
    const password = window.prompt('Developer password:');
    if (!password) return null;
    try {
      const response = await fetch(API + '/api/admin/session', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({password})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.token) {
        alert('Developer authentication failed.');
        return null;
      }
      try { sessionStorage.setItem(TOKEN_KEY, data.token); } catch (_) {}
      return data.token;
    } catch (_) {
      alert('Could not reach the Cosmic developer service.');
      return null;
    }
  }

  const COMMAND_GROUPS = [
    {title:'🌐 Global & Site-Wide',commands:[
      ['/home','Returns to the main Cosmic Games Hub so you can jump back into the site from anywhere.'],
      ['/reload','Instantly reloads the current page to test the latest local state and page startup behavior.'],
      ['/announcement [text]','Shows a temporary developer banner at the top of the current page for quick maintenance or status testing.'],
      ['/exportdata','Downloads a backup of your local Cosmic settings, favorites, notes, profile data, and layout preferences as a JSON file.'],
      ['/count','Displays the exact number of games and apps currently indexed by Cosmic.'],
      ['/random','Instantly launches a random visible Cosmic game or app for a quick surprise pick.'],
      ['/copyurl','Copies the current Cosmic page URL to the clipboard for quick debugging or sharing.'],
      ['/pageinfo','Shows the current path, host, online state, and viewport size.']
    ]},
    {title:'📊 Debugging & System Status',commands:[
      ['/sysinfo','Displays the active Cloudflare Worker environment status, current edge data center, build timestamp, deployment commit, and configuration state without revealing secret values.'],
      ['/toggledebug','Enables a floating diagnostic console that logs request timings, response statuses, JavaScript errors, and failed requests in real-time.'],
      ['/flushcache','Force-clears Cosmic browser caches and local site assets immediately so you can test from a clean client state.'],
      ['/benchmark','Runs a quick internal speed test against important Cosmic resources and reports the response time for each request.'],
      ['/stats','Shows DOM size, resource load timings, average response time, and JavaScript heap usage when the browser exposes it.']
    ]},
    {title:'🔌 Proxy & Cloaking Controls',commands:[
      ['/adblock','Toggles a local ad-like element blocker on the current page for cleaner-game testing.'],
      ['/aspect [ratio]','Instantly forces the active game area toward a specific ratio such as 16:9, 4:3, or square to test stretched-game layouts.'],
      ['/stretch','Toggles stretching accessible game canvases, videos, and frames to fill the available page space.'],
      ['/injectcss [css]','Allows you to apply raw CSS directly to the current page so you can test layout changes before pushing code.']
    ]},
    {title:'🎮 Ultimate Game Hacks & Tweaks',commands:[
      ['/aspect [ratio]','Instantly forces the active game canvas or frame toward dimensions such as 16:9, 4:3, or square to fix stretched retro-game layouts.'],
      ['/stretch','Toggles stretching a game area to fill available screen space while ignoring the original resolution ratio for testing.'],
      ['/injectcss [css]','Lets you type CSS directly into the current session to hide or restyle annoying elements while debugging.'],
      ['/mutegames','Instantly mutes accessible audio and video from the current game or page.'],
      ['/fullscreen','Forces the current game/page into browser fullscreen for immersive layout testing.'],
      ['/screenshot','Captures the selected Cosmic tab or window through the browser capture picker and saves it as an image.']
    ]},
    {title:'🎨 Personalization & Theme Controls',commands:[
      ['/theme [name]','Instantly swaps the Cosmic visual theme locally so you can preview alternate palettes without changing the deployed site.'],
      ['/hidedark','Toggles the dark-mode preview off or on for quick contrast testing.'],
      ['/custombg [url]','Overlays a custom background image locally so you can preview a new Cosmic backdrop without editing the repository.'],
      ['/font [name]','Swaps the global page typography between safe local choices such as monospace, sans-serif, serif, or Comic Sans.'],
      ['/zoom [percentage]','Forces the global page scaling to shrink or grow so you can test Cosmic on smaller or larger displays.'],
      ['/compact','Shrinks card padding and spacing so you can preview a denser homepage layout.'],
      ['/cleanui','Hides major navigation and decorative UI so you can preview a minimalist content-focused layout.']
    ]},
    {title:'🛡️ Moderation & User Control',commands:[
      ['/blacklist [url/game]','Instantly hides a game or blocks a URL site-wide through authenticated Cosmic curation controls.'],
      ['/feature [name]','Pins a specific game name into the authenticated server-side featured list.'],
      ['/maintenance','Instantly toggles Cosmic maintenance mode so normal visitors see the maintenance screen while your authenticated developer session can continue working.'],
      ['/import [json/url]','Directly imports validated game/app entries into Cosmic’s server-side curation list without rewriting GitHub files.'],
      ['/locksite','Locks the current site view behind your authenticated Cosmic admin session until you unlock it.']
    ]},
    {title:'🔒 Privacy, Security & Disguises',commands:[
      ['/destroytrail','Instantly wipes current-session trail data and recent-game history while leaving major saved account settings intact.'],
      ['/fakeloading','Triggers a local official-looking loading screen over the page so you can test a fake loading state.'],
      ['/disguise [preset]','Changes the current tab title and favicon to a selected generic preset for local interface testing.'],
      ['/killtab','Attempts to close the active browser tab when the browser allows scripted closing.'],
      ['/blanket','Wraps the current page in a giant interactive local fake-error screen that unlocks through the authenticated admin session.']
    ]},
    {title:'📈 Site Management & UI Adjustments',commands:[
      ['/grid [columns]','Changes the local game/app grid density so you can test a specific number of columns on the current display.'],
      ['/resetfx','Resets developer-only visual, layout, loading, lock, and injected-CSS effects back to normal Cosmic styling.']
    ]},
    {title:'🌀 Visual Overrides & Visual FX',commands:[
      ['/blur','Instantly blurs the current website by 10px as a quick local privacy-effect test.'],
      ['/matrix','Drops a falling digital-rain effect over the background for a Matrix-style visual test.'],
      ['/grayscale','Removes all page colors and previews Cosmic in black and white.'],
      ['/shake','Applies a short screen-shake animation to the active page for visual-effect testing.'],
      ['/tilt','Applies a subtle CSS 3D tilt effect to the entire page, making Cosmic look slightly askew.'],
      ['/invert','Inverts all page colors for a quick glitch/cyberpunk aesthetic.'],
      ['/retro','Applies a retro CRT monitor filter with glowing scanlines.']
    ]}
  ];

  const COMMAND_DESCRIPTIONS = Object.fromEntries(
    COMMAND_GROUPS.flatMap(group => group.commands)
  );
  const COMMANDS = COMMAND_GROUPS.flatMap(group => group.commands);

  function ensureStyle() {
    if (document.getElementById('cosmic-dev-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'cosmic-dev-tools-style';
    style.textContent = [
      '#cosmic-dev-fab{position:fixed;left:12px;top:60px;z-index:2147483647;padding:6px 9px;border:2px solid #2dccff;border-radius:10px;background:#0d1a21;color:#2dccff;font:700 11px system-ui,sans-serif;cursor:grab;user-select:none;touch-action:none;box-shadow:0 5px 18px rgba(0,0,0,.55)}',
      '#cosmic-dev-fab:hover{background:#16303b}#cosmic-dev-fab:active{cursor:grabbing}',
      '#cosmic-dev-panel{position:fixed;left:12px;top:60px;z-index:2147483647;width:min(390px,calc(100vw - 24px));max-height:min(76vh,640px);overflow:auto;display:none;padding:14px;border:2px solid #2dccff;border-radius:16px;background:rgba(5,12,18,.97);color:#f2f7fa;box-shadow:0 24px 70px rgba(0,0,0,.65);backdrop-filter:blur(14px)}',
      '#cosmic-dev-panel.open{display:block}#cosmic-dev-panel .dev-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
      '#cosmic-dev-panel .dev-head strong{margin-right:auto;color:#2dccff;letter-spacing:.4px}.dev-close{width:32px;height:32px;padding:0;border-radius:9px;border:1px solid rgba(45,204,255,.5);background:rgba(45,204,255,.08);color:#2dccff;font-size:20px;cursor:pointer}',
      '#cosmic-dev-panel .dev-command{display:block;width:100%;margin:7px 0;padding:10px 11px;border:1px solid rgba(45,204,255,.28);border-radius:11px;background:rgba(45,204,255,.05);color:#f2f7fa;text-align:left;cursor:pointer}',
      '#cosmic-dev-panel .dev-command:hover{background:rgba(45,204,255,.13)}#cosmic-dev-panel .dev-command b{display:block;color:#2dccff}#cosmic-dev-panel .dev-command small{display:block;margin-top:3px;color:#9fb1bc}',
      '#cosmic-dev-panel .dev-group-title{margin:14px 2px 6px;color:#2dccff;font:800 12px system-ui,sans-serif;letter-spacing:.6px;text-transform:none}.cosmic-dev-group:first-child .dev-group-title{margin-top:2px}',
      '#cosmic-dev-fake-loading{font-family:system-ui,sans-serif}.cosmic-dev-adblock [class*="ad"],.cosmic-dev-adblock [id*="ad"],.cosmic-dev-adblock [class*="advert"],.cosmic-dev-adblock [id*="advert"]{display:none!important}.cosmic-dev-cleanui header,.cosmic-dev-cleanui nav,.cosmic-dev-cleanui footer{display:none!important}.cosmic-dev-compact .game-card,.cosmic-dev-compact .app-card{padding:8px!important;min-height:110px!important}.cosmic-dev-blur body{filter:blur(10px)!important}.cosmic-dev-grayscale{filter:grayscale(1)!important}.cosmic-dev-stretch iframe,.cosmic-dev-stretch canvas,.cosmic-dev-stretch video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:fill!important}.cosmic-dev-shake{animation:cosmicDevShake .7s ease-in-out}@keyframes cosmicDevShake{0%,100%{transform:translate(0)}20%{transform:translate(-4px,2px)}40%{transform:translate(4px,-2px)}60%{transform:translate(-3px,-1px)}80%{transform:translate(3px,1px)}}',
      '#cosmic-dev-overlay{position:fixed;right:12px;bottom:12px;z-index:2147483646;width:min(520px,94vw);max-height:44vh;overflow:auto;padding:12px;border:1px solid #2dccff;border-radius:14px;background:rgba(2,7,11,.96);color:#eaf8ff;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 15px 60px rgba(0,0,0,.58)}',
      '#cosmic-dev-overlay .row{padding:5px 0;border-bottom:1px solid rgba(45,204,255,.12);white-space:pre-wrap;word-break:break-word}.cosmic-dev-tilt{transform:perspective(1200px) rotateX(.35deg) rotateY(-.35deg);transform-origin:center top}.cosmic-dev-invert{filter:invert(1) hue-rotate(180deg)}.cosmic-dev-retro{position:relative}.cosmic-dev-retro:after{content:"";position:fixed;inset:0;z-index:2147483643;pointer-events:none;background:repeating-linear-gradient(to bottom,rgba(0,0,0,.0) 0,rgba(0,0,0,.0) 2px,rgba(0,0,0,.10) 3px,rgba(0,0,0,.10) 4px);mix-blend-mode:multiply}.cosmic-dev-light-preview{background:#eef4f7!important;color:#102028!important}.cosmic-dev-light-preview a{color:#084f70!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function dragElement(el, handle=el) {
    if (!el || el.__cosmicDevDrag) return;
    el.__cosmicDevDrag = true;
    let dragging=false,moved=false,startX=0,startY=0,startLeft=0,startTop=0;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      const r=el.getBoundingClientRect();
      dragging=true;moved=false;startX=e.clientX;startY=e.clientY;startLeft=r.left;startTop=r.top;
      handle.style.cursor='grabbing';
      handle.setPointerCapture?.(e.pointerId);
    });
    handle.addEventListener('pointermove', e => {
      if(!dragging)return;
      const dx=e.clientX-startX,dy=e.clientY-startY;
      if(!moved&&(Math.abs(dx)>4||Math.abs(dy)>4))moved=true;
      if(moved){
        const maxLeft=Math.max(0,window.innerWidth-el.offsetWidth);
        const maxTop=Math.max(0,window.innerHeight-el.offsetHeight);
        el.style.left=Math.max(0,Math.min(maxLeft,startLeft+dx))+'px';
        el.style.top=Math.max(0,Math.min(maxTop,startTop+dy))+'px';
        e.preventDefault();
      }
    });
    handle.addEventListener('pointerup', e => {
      if(!dragging)return;
      dragging=false;handle.style.cursor='grab';
      if(handle.releasePointerCapture?.(e.pointerId)&&handle.hasPointerCapture?.(e.pointerId))handle.releasePointerCapture(e.pointerId);
      if(moved)handle.dataset.dragged='1';
    });
    handle.addEventListener('pointercancel',()=>{dragging=false;handle.style.cursor='grab';});
  }

  function openPanelFromFab() {
    const fab=document.getElementById('cosmic-dev-fab');
    const panel=document.getElementById('cosmic-dev-panel');
    if(!fab||!panel)return;
    fab.style.display='none';
    panel.classList.add('open');
    const r=fab.getBoundingClientRect();
    panel.style.left=r.left+'px';
    panel.style.top=r.top+'px';
    panel.style.maxHeight=Math.min(window.innerHeight-20,640)+'px';
  }
  function closePanel() {
    const panel=document.getElementById('cosmic-dev-panel');
    const fab=document.getElementById('cosmic-dev-fab');
    if(panel)panel.classList.remove('open');
    if(fab)fab.style.display='block';
  }

  function debugOverlay() {
    let box=document.getElementById('cosmic-dev-overlay');
    if(!box){box=document.createElement('div');box.id='cosmic-dev-overlay';document.body.appendChild(box);}
    return box;
  }
  function debugLine(message) {
    const box=debugOverlay();
    const row=document.createElement('div');
    row.className='row';
    row.textContent='['+new Date().toLocaleTimeString()+'] '+message;
    box.appendChild(row);
    while(box.children.length>120)box.removeChild(box.firstChild);
    box.scrollTop=box.scrollHeight;
  }
  function toggleDebug() {
    const key='__cosmicDevFetchPatched';
    if(window.__cosmicDevDebugEnabled){
      window.__cosmicDevDebugEnabled=false;
      document.getElementById('cosmic-dev-overlay')?.remove();
      showToast('Developer debug overlay disabled.');
      return;
    }
    window.__cosmicDevDebugEnabled=true;
    debugLine('Debug mode enabled. Request headers are intentionally not exposed.');
    if(!window[key] && window.fetch){
      window[key]=true;
      const nativeFetch=window.fetch.bind(window);
      window.fetch=async (...args)=>{
        const started=performance.now();
        const input=args[0];
        const url=typeof input==='string'?input:(input?.url||'');
        const method=(args[1]?.method||input?.method||'GET').toUpperCase();
        try{
          const response=await nativeFetch(...args);
          if(window.__cosmicDevDebugEnabled)debugLine(method+' '+url+' → '+response.status+' ('+Math.round(performance.now()-started)+'ms)');
          return response;
        }catch(error){
          if(window.__cosmicDevDebugEnabled)debugLine(method+' '+url+' → ERROR: '+(error?.message||error));
          throw error;
        }
      };
    }
    if(!window.__cosmicDevDebugListeners){
      window.__cosmicDevDebugListeners=true;
      window.addEventListener('error',e=>{if(window.__cosmicDevDebugEnabled)debugLine('JS error: '+(e.message||'unknown'));});
      window.addEventListener('unhandledrejection',e=>{if(window.__cosmicDevDebugEnabled)debugLine('Unhandled rejection: '+(e.reason?.message||e.reason||'unknown'));});
    }
    showToast('Developer debug overlay enabled.');
  }

  async function flushCache() {
    let deleted=0;
    try{
      const names=await caches.keys();
      for(const name of names){if(/^cosmic-/i.test(name)){if(await caches.delete(name))deleted++;}}
    }catch(_){}
    try{localStorage.removeItem('cosmicHubV1');}catch(_){}
    try{sessionStorage.removeItem(TOKEN_KEY);}catch(_){}
    showToast('Local Cosmic cache cleared ('+deleted+' cache(s)).');
    setTimeout(()=>location.reload(),250);
  }

  function applyTheme(name) {
    const allowed=['nebula','deep-space','solar-flare','synthwave'];
    const theme=allowed.includes(name)?name:'nebula';
    document.body.dataset.cosmicTheme=theme;
    try{localStorage.setItem('cosmicDevTheme',theme);}catch(_){}
    showToast('Theme preview: '+theme);
  }
  function themeCommand(args){applyTheme((args||'').trim()||'nebula');}
  function toggleDarkPreview(){document.body.classList.toggle('cosmic-dev-light-preview');showToast(document.body.classList.contains('cosmic-dev-light-preview')?'Light preview enabled.':'Dark preview restored.');}

  function customBackground(args) {
    const url=(args||'').trim();
    if(!url){showToast('Use /custombg https://...');return;}
    try{
      const parsed=new URL(url,location.href);
      if(!/^https?:$/.test(parsed.protocol))throw new Error('protocol');
      document.body.style.backgroundImage='url("'+parsed.href.replace(/["\\)]/g,'')+'")';
      document.body.style.backgroundSize='cover';document.body.style.backgroundAttachment='fixed';
      showToast('Custom background applied locally.');
    }catch(_){showToast('Invalid background URL.');}
  }

  function muteMedia(rootNode=document) {
    rootNode.querySelectorAll?.('audio,video').forEach(media=>{media.muted=true;media.volume=0;});
    rootNode.querySelectorAll?.('iframe').forEach(frame=>{try{if(frame.contentDocument)muteMedia(frame.contentDocument);}catch(_){}});
  }
  function muteGames(){muteMedia();window.postMessage({type:'cosmic-mute-all'},'*');showToast('Local page media muted.');}

  async function fullscreen() {
    try{
      if(document.fullscreenElement){await document.exitFullscreen();showToast('Fullscreen exited.');}
      else{await document.documentElement.requestFullscreen();showToast('Fullscreen enabled.');}
    }catch(_){showToast('Fullscreen is unavailable or requires browser permission.');}
  }

  function stats() {
    const entries=performance.getEntriesByType('resource');
    const loads=entries.map(e=>Number(e.duration)||0);
    const avg=loads.length?loads.reduce((a,b)=>a+b,0)/loads.length:0;
    const slow=[...entries].sort((a,b)=>b.duration-a.duration).slice(0,8);
    const memory=performance.memory?{used:Math.round(performance.memory.usedJSHeapSize/1048576),total:Math.round(performance.memory.totalJSHeapSize/1048576),limit:Math.round(performance.memory.jsHeapSizeLimit/1048576)}:null;
    const body='<div style="line-height:1.65"><b>DOM nodes:</b> '+document.querySelectorAll('*').length+'<br><b>Resources:</b> '+entries.length+'<br><b>Average resource time:</b> '+avg.toFixed(1)+' ms<br>'+
      (memory?'<b>JS heap:</b> '+memory.used+' MB / '+memory.total+' MB (limit '+memory.limit+' MB)<br>':'<b>JS heap:</b> unavailable in this browser<br>')+
      '<br><b>Slowest resources</b><br>'+slow.map(e=>safe((e.name||'').split('?')[0])+' — '+(Number(e.duration)||0).toFixed(1)+' ms').join('<br></div>');
    showModal('Performance Stats',body);
  }

  function showModal(title,body) {
    let m=document.getElementById('cosmic-dev-info-modal');
    if(!m){
      m=document.createElement('div');m.id='cosmic-dev-info-modal';
      m.style.cssText='position:fixed;inset:0;z-index:2147483645;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(7px)';
      m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-dev-close]'))m.remove();});
      document.body.appendChild(m);
    }
    m.innerHTML='<div style="width:min(720px,94vw);max-height:86vh;overflow:auto;padding:20px;border:1px solid #2dccff;border-radius:18px;background:#07131a;color:#f2f7fa;box-shadow:0 25px 80px rgba(0,0,0,.65)"><button data-dev-close style="float:right;border:1px solid #2dccff;border-radius:9px;background:rgba(45,204,255,.08);color:#2dccff;padding:6px 10px;cursor:pointer">×</button><h2 style="margin-top:0;color:#2dccff">'+safe(title)+'</h2>'+body+'</div>';
    m.style.display='grid';
  }

  async function sysinfo() {
    const token=await adminToken(); if(!token)return;
    try{
      const r=await fetch(API+'/api/developer/sysinfo',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ok)throw new Error(d.error||'Request failed');
      const flags=d.configured||{};
      showModal('Cosmic • /sysinfo','<div style="line-height:1.7">'+
        '<b>Worker:</b> '+safe(d.worker)+'<br><b>Edge:</b> '+safe(d.edge_region||'unknown')+'<br><b>Country hint:</b> '+safe(d.country||'unknown')+'<br>'+
        '<b>Build:</b> '+safe(d.build_timestamp||'unknown')+'<br><b>Commit:</b> <code>'+safe(d.source_commit||'unknown')+'</code><br>'+
        '<b>Runtime bindings</b><br>ASSETS: '+(flags.ASSETS?'configured':'missing')+'<br>'+
        'USERNAME_REGISTRY: '+(flags.USERNAME_REGISTRY?'configured':'missing')+'<br>'+
        'COSMIC_ADMIN_PASSWORD: '+(flags.COSMIC_ADMIN_PASSWORD?'configured':'missing')+'<br>'+
        'OPENROUTER_API_KEY: '+(flags.OPENROUTER_API_KEY?'configured':'missing')+'</div>');
    }catch(e){showToast('Sysinfo failed: '+(e.message||e));}
  }

  async function screenshot() {
    if(!navigator.mediaDevices?.getDisplayMedia){showToast('Screen capture is unavailable in this browser.');return;}
    try{
      showToast('Choose the Cosmic tab/window in the browser capture prompt.');
      const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      const track=stream.getVideoTracks()[0],settings=track.getSettings();
      const video=document.createElement('video');video.srcObject=stream;video.muted=true;
      await video.play();await new Promise(r=>setTimeout(r,120));
      const canvas=document.createElement('canvas');
      canvas.width=settings.width||Math.round(window.innerWidth*devicePixelRatio);
      canvas.height=settings.height||Math.round(window.innerHeight*devicePixelRatio);
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      stream.getTracks().forEach(t=>t.stop());
      const link=document.createElement('a');link.download='cosmic-dev-screenshot.png';link.href=canvas.toDataURL('image/png');link.click();
      showToast('Screenshot saved.');
    }catch(_){showToast('Screenshot cancelled or unavailable.');}
  }

  function localAnnouncement(args){
    const text=(args||'').trim();if(!text){showToast('Use /announcement your message');return;}
    const banner=document.createElement('div');banner.textContent=text;
    banner.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483644;padding:10px 44px 10px 16px;border-bottom:1px solid #2dccff;background:rgba(5,12,18,.96);color:#f2f7fa;font:700 13px system-ui,sans-serif;text-align:center';
    const close=document.createElement('button');close.textContent='×';close.style.cssText='position:absolute;right:10px;top:6px;border:0;background:none;color:#2dccff;font-size:22px;cursor:pointer';
    close.onclick=()=>banner.remove();banner.appendChild(close);document.body.appendChild(banner);
  }

  function commandDescription(command) {
    return COMMAND_DESCRIPTIONS[command] || 'Runs this developer command.';
  }

  function confirmCommand(command,args='') {
    return new Promise(resolve => {
      const old=document.getElementById('cosmic-dev-confirm');
      if(old) old.remove();
      const m=document.createElement('div');
      m.id='cosmic-dev-confirm';
      m.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)';
      const safeArgs=args ? '<div style="margin-top:10px;padding:9px 11px;border:1px solid rgba(45,204,255,.25);border-radius:10px;background:rgba(45,204,255,.05);word-break:break-word"><b>Input:</b> '+safe(args)+'</div>' : '';
      m.innerHTML='<div style="width:min(520px,94vw);padding:20px;border:2px solid #2dccff;border-radius:18px;background:#07131a;color:#f2f7fa;box-shadow:0 25px 80px rgba(0,0,0,.7)"><button data-cancel style="float:right;width:32px;height:32px;border:1px solid #2dccff;border-radius:9px;background:rgba(45,204,255,.08);color:#2dccff;font-size:20px;cursor:pointer">×</button><div style="color:#2dccff;font:800 12px system-ui,sans-serif;letter-spacing:.6px">DEVELOPER COMMAND</div><h2 style="margin:7px 0 10px">'+safe(command)+'</h2><p style="line-height:1.55;margin:0">'+safe(commandDescription(command))+'</p>'+safeArgs+'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button data-cancel style="padding:9px 14px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:transparent;color:#dce8ed;cursor:pointer">Cancel</button><button data-continue style="padding:9px 16px;border:1px solid #2dccff;border-radius:10px;background:#103441;color:#2dccff;font-weight:800;cursor:pointer">Continue</button></div></div>';
      document.body.appendChild(m);
      const finish=value=>{m.remove();resolve(value);};
      m.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>finish(false));
      m.querySelector('[data-continue]').onclick=()=>finish(true);
      m.addEventListener('click',e=>{if(e.target===m)finish(false);});
    });
  }

  async function confirmedRunCommand(command,args='') {
    if(!isDeveloper()) return;
    const ok=await confirmCommand(command,args);
    if(!ok) return;
    return runCommand(command,args);
  }


  function toggleDevClass(cls,onMessage,offMessage){
    const on=!document.documentElement.classList.contains(cls);
    document.documentElement.classList.toggle(cls,on);
    showToast(on?onMessage:offMessage);
  }

  function adblockCommand(){
    toggleDevClass('cosmic-dev-adblock','Local ad-like elements hidden.','Local adblock preview disabled.');
  }

  function aspectCommand(args){
    const value=(args||'').trim().toLowerCase();
    const ratios={'16:9':'16 / 9','4:3':'4 / 3','square':'1 / 1'};
    const chosen=ratios[value]||ratios['16:9'];
    const target=document.querySelector('iframe,canvas,video');
    if(!target){showToast('No game frame or canvas found.');return;}
    target.style.aspectRatio=chosen;
    target.style.width='100%';
    showToast('Game aspect preview set to '+(ratios[value]?value:'16:9')+'.');
  }

  function stretchCommand(){
    toggleDevClass('cosmic-dev-stretch','Game stretch enabled.','Game stretch disabled.');
  }

  function injectCssCommand(args){
    const css=(args||'').trim();
    if(!css){showToast('Enter CSS to inject.');return;}
    let style=document.getElementById('cosmic-dev-injected-css');
    if(!style){style=document.createElement('style');style.id='cosmic-dev-injected-css';document.head.appendChild(style);}
    style.textContent=css;
    showToast('Custom CSS applied locally.');
  }

  function destroyTrailCommand(){
    try{sessionStorage.clear();localStorage.removeItem('cosmicRecent');localStorage.removeItem('cosmicRecentV1');}catch(_){}
    showToast('Current-session trail and recent-gaming data cleared. Saved account data remains.');
  }

  function fakeLoadingCommand(){
    let overlay=document.getElementById('cosmic-dev-fake-loading');
    if(overlay){overlay.remove();showToast('Fake loading screen disabled.');return;}
    overlay=document.createElement('div');
    overlay.id='cosmic-dev-fake-loading';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#061017;color:#f2f7fa;font:600 16px system-ui,sans-serif;text-align:center';
    overlay.innerHTML='<div><div style="width:46px;height:46px;margin:0 auto 15px;border:4px solid rgba(45,204,255,.2);border-top-color:#2dccff;border-radius:50%;animation:cosmicDevSpin 1s linear infinite"></div><h2>Loading Cosmic…</h2><p style="color:#9fb1bc">Connecting to services…</p></div>';
    document.body.appendChild(overlay);
    showToast('Fake loading screen enabled.');
  }

  async function lockSiteCommand(){
    const token=await adminToken();
    if(!token)return;
    let overlay=document.getElementById('cosmic-dev-locksite');
    if(overlay){overlay.remove();showToast('Developer site lock disabled.');return;}
    overlay=document.createElement('div');
    overlay.id='cosmic-dev-locksite';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#061017;color:#f2f7fa;text-align:center;font:600 16px system-ui,sans-serif';
    overlay.innerHTML='<div><div style="font-size:52px">☄</div><h2>Cosmic Locked</h2><p>Unlocking requires your authenticated admin password.</p><button id="cosmic-dev-unlock-site">Unlock</button></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#cosmic-dev-unlock-site').onclick=async()=>{const t=await adminToken();if(t){overlay.remove();showToast('Developer site lock disabled.');}};
  }

  function cleanUiCommand(){
    toggleDevClass('cosmic-dev-cleanui','Minimal UI enabled.','Minimal UI disabled.');
  }

  async function getJsonSafe(path,fallback){
    try{
      const response=await fetch(new URL(path,location.href),{cache:'no-store'});
      if(!response.ok)throw new Error('request');
      const data=await response.json();
      return Array.isArray(data)?data:fallback;
    }catch(_){return fallback;}
  }

  async function countCommand(){
    const games=await getJsonSafe('games.json',[]);
    const apps=await getJsonSafe('/apps/apps.json',[]);
    showModal('Cosmic • Count','<div style="line-height:1.8"><b>Games:</b> '+games.length+'<br><b>Apps:</b> '+apps.length+'</div>');
  }

  function fontCommand(args){
    const allowed=['monospace','sans-serif','serif','system-ui','comic sans ms'];
    const requested=(args||'').trim().toLowerCase();
    const chosen=allowed.includes(requested)?requested:'monospace';
    document.body.style.fontFamily=chosen;
    showToast('Font preview set to '+chosen+'.');
  }

  function compactCommand(){
    toggleDevClass('cosmic-dev-compact','Compact layout enabled.','Compact layout disabled.');
  }

  function blurCommand(){
    toggleDevClass('cosmic-dev-blur','Blur enabled.','Blur disabled.');
  }

  function matrixCommand(){
    let canvas=document.getElementById('cosmic-dev-matrix');
    if(canvas){canvas.remove();showToast('Matrix effect disabled.');return;}
    canvas=document.createElement('canvas');
    canvas.id='cosmic-dev-matrix';
    canvas.style.cssText='position:fixed;inset:0;z-index:2147483643;pointer-events:none;opacity:.22';
    document.body.appendChild(canvas);
    const ctx=canvas.getContext('2d');
    const chars='01ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight;};
    const draw=()=>{
      ctx.fillStyle='rgba(0,0,0,.08)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#38ff88';
      ctx.font='14px monospace';
      for(let x=0;x<canvas.width;x+=14)ctx.fillText(chars[Math.floor(Math.random()*chars.length)],x,Math.random()*canvas.height);
      canvas.__raf=requestAnimationFrame(draw);
    };
    resize();draw();
    window.addEventListener('resize',resize);
    showToast('Matrix effect enabled.');
  }

  function grayscaleCommand(){
    toggleDevClass('cosmic-dev-grayscale','Grayscale enabled.','Grayscale disabled.');
  }

  function shakeCommand(){
    document.documentElement.classList.remove('cosmic-dev-shake');
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add('cosmic-dev-shake');
    setTimeout(()=>document.documentElement.classList.remove('cosmic-dev-shake'),700);
    showToast('Screen shake applied.');
  }

  function resetEffectsCommand(){
    document.documentElement.classList.remove('cosmic-dev-adblock','cosmic-dev-stretch','cosmic-dev-cleanui','cosmic-dev-compact','cosmic-dev-blur','cosmic-dev-grayscale');
    document.documentElement.style.removeProperty('--cosmic-dev-font');
    document.body.style.fontFamily='';
    document.getElementById('cosmic-dev-injected-css')?.remove();
    document.getElementById('cosmic-dev-matrix')?.remove();
    document.getElementById('cosmic-dev-fake-loading')?.remove();
    document.getElementById('cosmic-dev-locksite')?.remove();
    showToast('Developer local effects reset.');
  }

  async function runCommand(command,args='') {
    if(!isDeveloper())return;
    switch(command){
      case '/sysinfo': return sysinfo();
      case '/toggledebug': return toggleDebug();
      case '/flushcache': return flushCache();
      case '/theme': return themeCommand(args);
      case '/hidedark': return toggleDarkPreview();
      case '/custombg': return customBackground(args);
      case '/mutegames': return muteGames();
      case '/fullscreen': return fullscreen();
      case '/screenshot': return screenshot();
      case '/stats': return stats();
      case '/announcement': return localAnnouncement(args);
      case '/reload': return location.reload();
      case '/home': return location.href=location.origin+(location.hostname.endsWith('.github.io')?'/cosmic/pages/lessons/lessons.html':'/pages/lessons/lessons.html');
      case '/blacklist': return siteStateCommand('blacklist_toggle',{target:args});
      case '/feature': return siteStateCommand('feature_toggle',{name:args});
      case '/maintenance': return siteStateCommand('maintenance_toggle',{});
      case '/import': return importCommand(args);
      case '/disguise': return disguiseCommand(args);
      case '/killtab': return killTab();
      case '/blanket': return blanket();
      case '/benchmark': return benchmark();
      case '/exportdata': return exportData();
      case '/zoom': return zoomCommand(args);
      case '/tilt': return visualClass('cosmic-dev-tilt','Tilt effect enabled.');
      case '/invert': return visualClass('cosmic-dev-invert','Color inversion enabled.');
      case '/retro': return visualClass('cosmic-dev-retro','CRT filter enabled.');
      case '/adblock': return adblockCommand();
      case '/aspect': return aspectCommand(args);
      case '/stretch': return stretchCommand();
      case '/injectcss': return injectCssCommand(args);
      case '/destroytrail': return destroyTrailCommand();
      case '/fakeloading': return fakeLoadingCommand();
      case '/locksite': return lockSiteCommand();
      case '/cleanui': return cleanUiCommand();
      case '/count': return countCommand();
      case '/font': return fontCommand(args);
      case '/compact': return compactCommand();
      case '/blur': return blurCommand();
      case '/matrix': return matrixCommand();
      case '/grayscale': return grayscaleCommand();
      case '/shake': return shakeCommand();
      case '/resetfx': return resetEffectsCommand();
      default: return showToast('Unknown developer command: '+command);
    }
  }


  async function siteStateCommand(action,payload){
    const token=await adminToken(); if(!token)return;
    if(!payload.target && !payload.name && action!=='maintenance_toggle'){showToast('An argument is required.');return;}
    try{
      const r=await fetch(API+'/api/admin/site-state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...payload}),cache:'no-store'});
      const d=await r.json().catch(()=>({})); if(!r.ok||!d.ok)throw new Error(d.error||'Request failed');
      showModal('Cosmic • '+action.replace('_',' '),'<pre style="white-space:pre-wrap">'+safe(JSON.stringify(d,null,2))+'</pre>');
    }catch(e){showToast('Command failed: '+(e.message||e));}
  }

  async function importCommand(args){
    const input=(args||'').trim(); if(!input){showToast('Use /import with JSON or a JSON URL.');return;}
    const token=await adminToken(); if(!token)return;
    try{
      let data;
      if(/^https?:\/\//i.test(input)){const r=await fetch(input,{cache:'no-store'});if(!r.ok)throw new Error('Could not fetch JSON URL.');data=await r.json();}
      else data=JSON.parse(input);
      const items=Array.isArray(data)?data:(Array.isArray(data.items)?data.items:null);
      if(!items?.length)throw new Error('Expected an array of items or {\"items\":[...]}');
      const r=await fetch(API+'/api/admin/site-state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'import',items}),cache:'no-store'});
      const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Import failed');
      showModal('Cosmic • Import Complete','<p>Imported/updated <b>'+items.length+'</b> curation item(s).</p><p>These are stored as server-side curation data; they do not rewrite GitHub files.</p>');
    }catch(e){showToast('Import failed: '+(e.message||e));}
  }

  function disguiseCommand(args){
    const preset=(args||'').trim().toLowerCase();
    const presets={plain:['Cosmic','data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%2307131a"/><text x="32" y="42" text-anchor="middle" font-size="36">☄</text></svg>'],blank:['Untitled','data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="white"/></svg>']};
    const p=presets[preset]||presets.plain;
    document.title=p[0];
    let icon=document.querySelector('link[data-cosmic-dev-icon]');if(!icon){icon=document.createElement('link');icon.rel='icon';icon.dataset.cosmicDevIcon='1';document.head.appendChild(icon);}icon.href=p[1];
    showToast('Local tab disguise applied: '+(preset||'plain'));
  }

  async function killTab(){try{window.open('','_self');window.close();}catch(_){showToast('The browser refused to close this tab.');}}

  async function blanket(){
    const token=await adminToken();if(!token)return;
    const code=window.prompt('Enter the developer/admin password to unlock the test screen later:');if(code===null)return;
    const r=await fetch(API+'/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:code})});
    if(!r.ok){showToast('Password check failed.');return;}
    const old=document.getElementById('cosmic-dev-blanket');if(old)old.remove();
    const el=document.createElement('div');el.id='cosmic-dev-blanket';el.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#f5f5f5;color:#222;display:grid;place-items:center;font:16px system-ui,sans-serif';
    el.innerHTML='<div style="text-align:center;padding:30px"><div style="font-size:54px">⚠</div><h1>Something went wrong</h1><p>This is a local developer test screen.</p><button id="cosmic-blanket-unlock">Unlock</button></div>';
    document.body.appendChild(el);
    el.querySelector('#cosmic-blanket-unlock').onclick=async()=>{const attempt=prompt('Admin password to unlock:');if(!attempt)return;const rr=await fetch(API+'/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:attempt})});if(rr.ok)el.remove();else alert('Incorrect password.');};
  }

  async function benchmark(){
    const urls=[location.origin+'/',location.origin+'/pages/lessons/games.json',location.origin+'/scripts/cosmic-hub.js'];
    const rows=[];for(const url of urls){const t=performance.now();try{const r=await fetch(url,{cache:'no-store'});rows.push({url,status:r.status,ms:Math.round(performance.now()-t)});}catch(e){rows.push({url,error:String(e),ms:Math.round(performance.now()-t)});}}
    showModal('Cosmic • Benchmark','<pre style="white-space:pre-wrap">'+safe(JSON.stringify(rows,null,2))+'</pre>');
  }

  function exportData(){
    let data={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^cosmic/i.test(k))data[k]=localStorage.getItem(k);}}catch(_){}
    const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),local:data},null,2)],{type:'application/json'});
    const a=document.createElement('a');a.download='cosmic-settings-backup.json';a.href=URL.createObjectURL(blob);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    showToast('Cosmic settings backup downloaded.');
  }

  function zoomCommand(args){
    const value=(args||'').trim();const n=parseFloat(value);if(!Number.isFinite(n)||n<50||n>200){showToast('Use a zoom between 50% and 200%.');return;}
    document.documentElement.style.zoom=(n/100);showToast('Local page zoom: '+n+'%');
  }
  function visualClass(cls,message){
    document.body.classList.toggle(cls);showToast(document.body.classList.contains(cls)?message:message.replace('enabled','disabled'));
  }

  function getHubCommands(){
    return COMMANDS.map(([name,desc])=>[name,()=>{
      const command=name.split(' ')[0],args=name.includes('[')?window.prompt(name+' argument:','')||'':'';
      return confirmedRunCommand(command,args);
    }]);
  }

  function createMenu(){
    if(!isDeveloper()||!isGameContext())return;
    if(!document.body){document.addEventListener('DOMContentLoaded',createMenu,{once:true});return;}
    ensureStyle();
    if(document.getElementById('cosmic-dev-fab'))return;

    const fab=document.createElement('button');
    fab.id='cosmic-dev-fab';
    fab.type='button';
    fab.textContent='☄ Dev Commands';
    fab.setAttribute('aria-label','Open Cosmic developer commands');

    const panel=document.createElement('div');
    panel.id='cosmic-dev-panel';
    panel.innerHTML='<div class="dev-head"><strong>☄ Cosmic Developer</strong><button class="dev-close" type="button" aria-label="Close developer commands">×</button></div>';

    COMMAND_GROUPS.forEach(group=>{
      const section=document.createElement('section');
      section.className='cosmic-dev-group';
      const heading=document.createElement('div');
      heading.className='dev-group-title';
      heading.textContent=group.title;
      section.appendChild(heading);

      group.commands.forEach(([name,desc])=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='dev-command';
        b.innerHTML='<b>'+safe(name)+'</b><small>'+safe(desc)+'</small>';
        b.onclick=()=>{
          const command=name.split(' ')[0];
          const args=name.includes('[')?window.prompt(name+' argument:','')||'':'';
          confirmedRunCommand(command,args);
        };
        section.appendChild(b);
      });
      panel.appendChild(section);
    });

    document.body.append(fab,panel);
    dragElement(fab);
    const header=panel.querySelector('.dev-head');
    if(header)dragElement(panel,header);

    fab.addEventListener('click',e=>{
      if(fab.dataset.dragged==='1'){fab.dataset.dragged='0';return;}
      openPanelFromFab();
    });
    panel.querySelector('.dev-close').addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });
  }

  function entryGateReady(){
    const gate=document.getElementById('password-gate');
    const content=document.getElementById('site-content');
    if(!gate || !content) return true;
    const gateHidden=getComputedStyle(gate).display==='none';
    const contentShown=getComputedStyle(content).display!=='none';
    return gateHidden && contentShown;
  }

  ensureStyle();
  const bootDevMenu=()=>{
    if(!isDeveloper() || !entryGateReady()) return false;
    createMenu();
    return !!document.getElementById('cosmic-dev-fab');
  };
  setTimeout(bootDevMenu,250);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootDevMenu,{once:true});
  else bootDevMenu();

  // The games Hub has a real entry gate that reveals the game list later.
  // Re-check when that gate changes instead of trying to race it.
  window.addEventListener('cosmic-entry-ready',bootDevMenu);
  window.addEventListener('storage',bootDevMenu);
  let devMenuObserver;
  try {
    devMenuObserver=new MutationObserver(()=>{
      if(isDeveloper() && !document.getElementById('cosmic-dev-fab')) bootDevMenu();
    });
    devMenuObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  } catch (_) {}

  window.CosmicDevTools={isDeveloper,commands:COMMANDS,runCommand,getHubCommands,adminToken,showToast};
})();