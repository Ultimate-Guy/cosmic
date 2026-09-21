(() => {
  'use strict';
  const VERSION='cosmicSiteTourV2';
  const STATE_KEY=VERSION+'State';
  const SESSION_KEY=VERSION+'Session';
  const MAX_OPENS=2;
  const base=location.hostname.endsWith('.github.io')?'/cosmic/':'/';

  const loadState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch(_){return null}};
  const saveState=s=>{try{localStorage.setItem(STATE_KEY,JSON.stringify(s))}catch(_){}};
  const isNewSession=()=>{try{return !sessionStorage.getItem(SESSION_KEY)}catch(_){return true}};
  const markSession=()=>{try{sessionStorage.setItem(SESSION_KEY,'1')}catch(_){}};
  const path=location.pathname||'';
  const isCommandCenter=/\/(?:cosmic\/)?$/.test(path)||path.endsWith('/index.html');
  const isGames=/\/pages\/lessons\/lessons\.html$/i.test(path);
  const isSettings=/\/settings\/settings\.html$/i.test(path);
  const isGameShell=/\/pages\/lessons\/game-shell\.html$/i.test(path);

  const state=loadState()||{version:2,opens:0,active:false,step:0,awaitingEntry:false};
  if(isNewSession() && state.opens<MAX_OPENS){
    state.opens+=1;
    state.active=true;
    state.step=0;
    state.awaitingEntry=false;
    saveState(state);
    markSession();
  }

  const steps=[
    {page:'command',selector:'.cc-news',title:'Updates are now here',text:'All the new Cosmic update messages live in this Updates panel on the Command Center. Check here to see what changed without waiting for a separate popup.'},
    {page:'command',selector:'.cc-actions [data-action="warp"]',title:'Warp Me Somewhere',text:'Warp picks a game for you and launches it quickly. It is a fast way to discover something without searching the whole library.'},
    {page:'command',selector:'.cc-actions [data-action="quick"]',title:'Quick Actions',text:'Quick Actions puts common Cosmic tools in one place, including Games, Apps, Warp, Missions, your local profile, Performance, and Settings.'},
    {page:'command',selector:'.cc-actions [data-action="settings"]',title:'Settings',text:'Cosmic now has a full Settings area. Click Settings to see the new Auto Cloak, Tab Cloak, crosshair, background, music, panic shortcut, and data controls.'},
    {page:'settings',selector:'#autoCloakGrid',title:'Auto Cloak',text:'Choose whether Cosmic automatically opens with an About:Blank or Blob cloak. You can also turn Auto Cloak off whenever you want.'},
    {page:'settings',selector:'#cloakGrid',title:'Tab Cloak',text:'Tab Cloak lets you choose a Cosmic-made tab title/icon preset. Your choice stays local to this browser.'},
    {page:'settings',selector:'#crosshair-style-select',title:'Custom Crosshair',text:'Pick a different crosshair style for Cosmic pages and games. This setting is saved locally.'},
    {page:'settings',selector:'#panicKeyInput',title:'Panic Shortcut',text:'Set a keyboard key and destination for a quick navigation shortcut. Make sure you can remember the key and destination you choose.'},
    {page:'settings',selector:'#backButton',title:'Back to the rest of the tour',text:'Use Cosmic’s real Back button to return to the previous page. The tour will remember where you were and continue with the other new features.'},
    {page:'games',selector:'#cosmic-account',title:'Cosmic Accounts',text:'This button opens your local Cosmic profile/account tools. You can keep a separate profile on this browser without needing to use an online account for local features.'},
    {page:'games',selector:'#cosmic-daily-quest',title:'Cosmic Daily Quest',text:'Daily Quest gives you a rotating reason to come back, such as trying a game you have not opened or improving a previous run.'},
    {page:'games',selector:'#cosmic-smart-pick',title:'Pick for Me',text:'Pick for Me uses local history, favorites, and your recent activity to recommend something to play so the library feels easier to explore.'},
    {page:'games',selector:'.play-btn',title:'Play a game',text:'Click Play on a game to launch it. Blank opens the game directly in a new tab, while Play uses Cosmic’s game shell with the extra in-game controls.'},
    {page:'game',selector:'#home',title:'Home button',text:'This Home button takes you back to the Cosmic Games page after a game session.'},
    {page:'game',selector:'#cosmic-wrapper-controls',title:'In-game controls',text:'The top-right control bar gives you Fullscreen, Reload, Pop out, and Report. The whole bar can be dragged so it stays out of your way.'},
    {page:'game',selector:'#cosmic-wrapper-controls button:last-child',title:'Report a game',text:'Use the warning button to report a broken or problematic game. Cosmic fills the report with the current game name when it can.'},
    {page:'games',selector:'.cosmic-preview-drawer,#cosmic-preview-drawer',title:'Game previews and favorites',text:'Game cards can expose more information before launch, and Cosmic can remember favorites and recent launches locally so you can pick up where you left off.'},
    {page:'games',selector:'#cosmic-portals',title:'Explore Cosmic',text:'Cosmic also has local discovery tools, category sections, achievements, backups, diagnostics, and more. This tour has shown the main new areas; the rest is there to explore.'}
  ];

  const findStepForPage=step=>{
    if(step.page==='command' && isCommandCenter)return true;
    if(step.page==='settings' && isSettings)return true;
    if(step.page==='games' && isGames)return true;
    if(step.page==='game' && isGameShell)return true;
    return false;
  };

  function getCurrentStep(){
    let i=Math.max(0,Math.min(steps.length-1,Number(state.step)||0));
    for(let n=0;n<steps.length;n++){
      if(findStepForPage(steps[i]))return i;
      i=(i+1)%steps.length;
    }
    return -1;
  }

  function resolveTarget(step){
    const selectors=String(step.selector||'').split(',');
    for(const selector of selectors){
      try{
        const el=document.querySelector(selector.trim());
        if(el && el.offsetParent!==null)return el;
      }catch(_){}
    }
    return null;
  }

  let overlay=null,box=null,arrow=null,resizeTimer=null;

  function removeTour(){
    overlay?.remove();overlay=null;box=null;arrow=null;
  }

  function build(){
    if(overlay)return;
    overlay=document.createElement('div');
    overlay.id='cosmic-site-tour-overlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
    box=document.createElement('div');
    box.id='cosmic-site-tour-box';
    box.style.cssText='position:fixed;width:min(360px,calc(100vw - 28px));padding:16px;border:1px solid #2dccff;border-radius:15px;background:rgba(5,12,18,.98);color:#f2f7fa;box-shadow:0 22px 70px rgba(0,0,0,.65);pointer-events:auto;font:14px system-ui,sans-serif;';
    box.innerHTML='<div style="font-size:10px;font-weight:900;letter-spacing:.12em;color:#2dccff;text-transform:uppercase">COSMIC TOUR</div><h2 id="cst-title" style="margin:6px 0 8px;font-size:18px;color:#f5fcff"></h2><p id="cst-text" style="margin:0;color:#b9cbd5;font-size:13px;line-height:1.5"></p><div id="cst-actions" style="display:flex;justify-content:space-between;gap:8px;margin-top:14px"><button id="cst-back" type="button" style="border:1px solid rgba(45,204,255,.35);border-radius:9px;padding:8px 12px;background:transparent;color:#9feaff;cursor:pointer">Back</button><button id="cst-next" type="button" style="border:1px solid #2dccff;border-radius:9px;padding:8px 14px;background:#2dccff;color:#031721;font-weight:800;cursor:pointer">Next</button></div>';
    arrow=document.createElement('div');
    arrow.id='cst-arrow';
    arrow.style.cssText='position:fixed;width:15px;height:15px;background:#07131a;border-left:1px solid #2dccff;border-top:1px solid #2dccff;transform:rotate(45deg);pointer-events:none;';
    overlay.append(box,arrow);
    document.body.appendChild(overlay);

    box.querySelector('#cst-back').onclick=()=>move(-1);
    box.querySelector('#cst-next').onclick=()=>move(1);
  }

  function position(){
    const i=getCurrentStep();
    if(i<0){removeTour();return;}
    const step=steps[i];
    const target=resolveTarget(step);
    if(!target){
      setTimeout(position,350);
      return;
    }
    build();
    box.querySelector('#cst-title').textContent=step.title;
    box.querySelector('#cst-text').textContent=step.text;
    const rect=target.getBoundingClientRect();
    const bw=box.offsetWidth,bh=box.offsetHeight;
    const margin=14;
    let left=rect.right+margin,top=rect.top;
    let side='right';
    if(left+bw>innerWidth-10){left=rect.left-bw-margin;side='left';}
    if(left<10){left=Math.max(10,(innerWidth-bw)/2);top=rect.bottom+margin;side='bottom';}
    if(top+bh>innerHeight-10)top=Math.max(10,rect.top-bh-margin);
    box.style.left=Math.max(10,Math.min(innerWidth-bw-10,left))+'px';
    box.style.top=Math.max(10,Math.min(innerHeight-bh-10,top))+'px';

    let ax=rect.left+rect.width/2-7.5,ay=rect.top+rect.height/2-7.5;
    if(side==='right'){ax=left-7.5;ay=Math.max(16,Math.min(innerHeight-30,rect.top+rect.height/2-7.5));arrow.style.transform='rotate(45deg)';}
    else if(side==='left'){ax=left+bw-7.5;ay=Math.max(16,Math.min(innerHeight-30,rect.top+rect.height/2-7.5));arrow.style.transform='rotate(225deg)';}
    else {ax=Math.max(16,Math.min(innerWidth-30,rect.left+rect.width/2-7.5));ay=top-7.5;arrow.style.transform='rotate(45deg)';}
    arrow.style.left=ax+'px';arrow.style.top=ay+'px';
  }

  function setStep(next){
    state.step=Math.max(0,Math.min(steps.length-1,next));
    state.active=true;
    state.awaitingEntry=false;
    saveState(state);
    removeTour();
    setTimeout(position,80);
  }

  function move(delta){
    const current=getCurrentStep();
    if(current<0)return;
    let next=current+delta;
    if(next<0){next=0;}
    if(next>=steps.length){
      state.active=false;state.awaitingEntry=false;saveState(state);removeTour();return;
    }
    const targetPage=steps[next].page;
    if((targetPage==='command'&&!isCommandCenter)||(targetPage==='settings'&&!isSettings)||(targetPage==='games'&&!isGames)||(targetPage==='game'&&!isGameShell)){
      state.step=next;state.active=true;saveState(state);
      const target=targetPage==='command'?base:targetPage==='settings'?base+'settings/settings.html':targetPage==='games'?base+'pages/lessons/lessons.html':base+'pages/lessons/game-shell.html';
      location.href=target;
      return;
    }
    setStep(next);
  }

  function bindSpecialClicks(){
    document.addEventListener('click',event=>{
      if(!state.active)return;
      const target=event.target.closest?.('#cc-dashboard,[data-action="settings"],#backButton,.play-btn');
      if(!target)return;
      const current=getCurrentStep();
      if(current<0)return;

      if(target.id==='cc-dashboard'){
        state.awaitingEntry=true;
        state.step=9;
        saveState(state);
        removeTour();
        return;
      }

      if(target.matches('[data-action="settings"]')){
        const settingsIndex=steps.findIndex(s=>s.page==='settings');
        if(settingsIndex>=0){state.step=settingsIndex;state.active=true;saveState(state);}
        return;
      }

      if(target.id==='backButton' && isSettings){
        state.step=1;
        state.active=true;
        saveState(state);
        return;
      }

      if(target.classList.contains('play-btn') && isGames){
        const gameIndex=steps.findIndex(s=>s.page==='game' && s.title==='Home button');
        if(gameIndex>=0){state.step=gameIndex;state.active=true;saveState(state);}
      }
    },true);

    window.addEventListener('cosmic-entry-ready',()=>{
      if(!state.active && !state.awaitingEntry)return;
      if(state.awaitingEntry){
        state.awaitingEntry=false;
        state.step=9;
        state.active=true;
        saveState(state);
        setTimeout(position,200);
      }
    });
  }

  function start(){
    if(state.opens>=MAX_OPENS && !state.active)return;
    if(!state.active && !state.awaitingEntry)return;
    bindSpecialClicks();

    if(isGames && state.active && state.step===9 && document.body.dataset.cosmicTourBound!=='1'){
      document.body.dataset.cosmicTourBound='1';
    }

    setTimeout(position,250);
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(position,80)});
    window.addEventListener('scroll',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(position,80)},{passive:true});
  }

  // If the user has not yet entered Cosmic, show the password step while the gate is visible.
  if(isGames && state.awaitingEntry){
    state.step=9-1;
    state.active=true;
    saveState(state);
  }

  start();
})();