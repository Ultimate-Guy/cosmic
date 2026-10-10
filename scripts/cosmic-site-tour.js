(() => {
  'use strict';
  const VERSION='cosmicSiteTourV5';
  const STATE_KEY=VERSION+'State';
  const SESSION_KEY=VERSION+'Session';
  const MAX_OPENS=2;
  const WEEKLY_VERSION='2026-10-09-cosmic-platform-tour-v1';
  const WEEKLY_STATE_KEY='cosmicWeeklyTourState';
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
  // The tour needs to distinguish the normal Command Center from the cloaked shell.
  // Game pages are never treated as cloaked tour pages.
  const isCloakShell=isCommandCenter && document.documentElement?.dataset?.cosmicCloakShell === '1';

  const weeklyState=(()=>{try{return JSON.parse(localStorage.getItem(WEEKLY_STATE_KEY)||'null')}catch(_){return null}})();
  const weekKey=(()=>{const d=new Date();const day=d.getDay();const diff=(day+6)%7;d.setDate(d.getDate()-diff);return d.toISOString().slice(0,10)})();
  const weeklyAlreadyShown=weeklyState?.version===WEEKLY_VERSION&&weeklyState?.week===weekKey;
  const state=loadState()||{version:2,opens:0,active:false,step:0,awaitingEntry:false};
  if(isNewSession() && state.opens<MAX_OPENS){
    state.opens+=1;
    state.active=true;
    state.step=0;
    state.awaitingEntry=false;
    saveState(state);
    markSession();
  }

  const weeklySteps=[
    {page:'command',selector:'#cosmic-weekly-highlights',title:'What’s New in the Cosmic Platform',text:'This is the weekly tour launcher inside Cosmic itself. It stays visible on the Command Center, and earlier feature highlights are kept in the archive below.'},
    {page:'command',selector:'.cc-top',title:'Cosmic Spaces',text:'The Command Center is Cosmic’s shared starting point for Games, Apps, YouTube, Settings, and more. These platform areas are reachable from this top bar.'},
    {page:'command',selector:'#cc-continue',title:'Cosmic Cloud Profiles',text:'Cosmic remembers recent activity and pinned items here. Cloud Profiles extend account features across supported Cosmic surfaces.'},
    {page:'command',selector:'.cc-feature',title:'Cosmic Foundry',text:'Foundry is Cosmic’s developer import pipeline: inspect a source and its assets, prepare a wrapped entry, validate it, and preview before adding it.'},
    {page:'command',selector:'.cc-news',title:'Compatibility Engine',text:'Cosmic’s Updates panel keeps news and feature notes visible. Compatibility work helps older games deal with legacy paths, scripts, resizing, and launch differences.'},
    {page:'command',selector:'.cc-actions',title:'Deployment Shield',text:'The navigation area takes you to the major Cosmic surfaces. Deployment Shield checks the build and representative game launches before a release is published.'},
    {page:'command',selector:'.cc-quick',title:'Cosmic Arcade Network',text:'Quick Actions surface recurring activities such as Warp and Missions. The Arcade Network adds scheduled events, progress, leaderboards, featured games, and badges.'},
    {page:'command',selector:'.cc-layout .cc-panel',title:'Cosmic Game Rooms',text:'Explore the platform panels and tools from here. Game Rooms support shared queues, join codes, room status, announcements, and host controls.'},
    {page:'command',selector:'.cc-shell',title:'Cosmic Universal Runtime',text:'Cosmic’s runtime brings game launches, controls, permissions, fullscreen, recovery, and activity tracking under a common platform model.'}
  ];

  const steps=[
    {page:'command',selector:'.cc-news',title:'Updates are now here',text:'All the new Cosmic update messages live in this Updates panel on the Command Center. Check here to see what changed without waiting for a separate popup.'},
    {page:'command',selector:'.cc-actions [data-action="warp"]',title:'Warp Me Somewhere',text:'Warp picks a game for you and launches it quickly. It is a fast way to discover something without searching the whole library.'},
    {page:'command',selector:'.cc-actions [data-action="quick"]',title:'Quick Actions',text:'Quick Actions puts common Cosmic tools in one place, including Games, Apps, Warp, Missions, your local profile, Performance, and Settings.'},
    {page:'command',selector:'.cc-actions [data-action="settings"]',title:'Settings',text:'Cosmic now has a full Settings area. You can customize Auto Cloak, Tab Cloak, crosshairs, backgrounds, music, panic shortcuts, and other local preferences.'},
    {page:'settings',selector:'#cloakGrid',title:'Tab Cloak',text:'Tab Cloak lets you choose a Cosmic-made tab title/icon preset. Auto Cloak is also available above it when you want Cosmic to automatically use a cloak on future visits.'},
    {page:'settings',selector:'#crosshair-style-select',title:'Custom Crosshair',text:'Pick a different crosshair style for Cosmic pages and games. This setting is saved locally.'},
    {page:'settings',selector:'#panicKeyInput',title:'Panic Shortcut',text:'Set a keyboard key and destination for a quick navigation shortcut. Make sure you can remember the key and destination you choose.'},
    {page:'settings',selector:'#backButton',title:'Back to the rest of the tour',text:'Use Cosmic’s real Back button to return to the previous page. The tour will remember where you were and continue with the other new features.'},
    {page:'command',selector:'#cc-blank',title:'Open the Cosmic Cloak',text:'Click About:Blank Cloak to continue the tour in a cloaked Command Center. When the cloaked tab opens, the next tour step will point to the big Cosmic Dashboard button.'},
    {page:'cloak',selector:'#cc-dashboard',title:'Cosmic Dashboard',text:'Click Cosmic Dashboard. This takes you to the Cosmic entry screen in the same cloaked tab. The tour will reappear there and explain the password.'},
        {page:'games',selector:'#pass-field',title:'Cosmic Entry',text:'This is the Cosmic entry password. Make sure you can remember your password so you can get back into the games area when you need it.'},
    {page:'games',selector:'#cosmic-account',title:'Cosmic Accounts',text:'After entering Cosmic, this account button opens your local profile tools. You can create or log in to an account here. Make sure you can remember your account password.'},
    {page:'games',selector:'#cosmic-daily-quest',title:'Cosmic Daily Quest',text:'Daily Quest gives you a rotating reason to come back, such as trying a game you have not opened or improving a previous run.'},
    {page:'games',selector:'#cosmic-smart-pick',title:'Pick for Me',text:'Pick for Me uses local history, favorites, and your recent activity to recommend something to play so the library feels easier to explore.'},
    {page:'games',selector:'.play-btn',title:'Play a game',text:'Click Play on a game to launch it. Blank opens the game directly in a new tab, while Play uses Cosmic’s game shell with the extra in-game controls.'},
    {page:'game',selector:'#home',title:'Home button',text:'This Home button takes you back to the Cosmic Games page after a game session.'},
    {page:'game',selector:'#cosmic-wrapper-controls',title:'In-game controls',text:'The top-right control bar gives you Fullscreen, Reload, Pop out, and Report. The whole bar can be dragged so it stays out of your way.'},
    {page:'game',selector:'#cosmic-wrapper-controls button:last-child',title:'Report a game',text:'Use the warning button to report a broken or problematic game. Cosmic fills the report with the current game name when it can.'},
    {page:'games',selector:'.cosmic-preview-drawer,#cosmic-preview-drawer',title:'Game previews and favorites',text:'Game cards can expose more information before launch, and Cosmic can remember favorites and recent launches locally so you can pick up where you left off.'},
    {page:'games',selector:'#cosmic-portals',title:'Explore Cosmic',text:'Cosmic also has local discovery tools, category sections, achievements, backups, diagnostics, and more. This tour has shown the main new areas; the rest is there to explore.'}
  ];

  // New users always learn the latest feature set first; returning users use the separate weekly tour.
  const onboardingSteps=[...weeklySteps,...steps];
  const findStepForPage=step=>{
    if(step.page==='command' && isCommandCenter && !isCloakShell)return true;
    if(step.page==='cloak' && isCloakShell)return true;
    if(step.page==='settings' && isSettings)return true;
    if(step.page==='games' && isGames)return true;
    if(step.page==='game' && isGameShell)return true;
    return false;
  };

  function stepIndex(title){return steps.findIndex(s=>s.title===title);}
  function getCurrentStep(){
    const tourSteps=state.mode==='weekly'?weeklySteps:onboardingSteps;
    let i=Math.max(0,Math.min(tourSteps.length-1,Number(state.step)||0));
    for(let n=0;n<tourSteps.length;n++){
      if(findStepForPage(tourSteps[i]))return i;
      i=(i+1)%tourSteps.length;
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
    const tourSteps=state.mode==='weekly'?weeklySteps:onboardingSteps;
    const step=tourSteps[i];
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
    const tourSteps=state.mode==='weekly'?weeklySteps:onboardingSteps;
    state.step=Math.max(0,Math.min(tourSteps.length-1,next));
    state.active=true;
    state.awaitingEntry=false;
    saveState(state);
    removeTour();
    setTimeout(position,80);
  }

  function move(delta){
    const current=getCurrentStep();
    const tourSteps=state.mode==='weekly'?weeklySteps:onboardingSteps;
    if(current<0)return;
    let next=current+delta;
    if(next<0){next=0;}
    if(next>=tourSteps.length){
      state.active=false;state.awaitingEntry=false;state.mode=null;saveState(state);removeTour();
      if(tourSteps===weeklySteps){
        try{const stored=JSON.parse(localStorage.getItem(WEEKLY_STATE_KEY)||'{}');stored.active=false;stored.completedAt=Date.now();stored.version=WEEKLY_VERSION;stored.week=weekKey;stored.history=weeklyHistory();localStorage.setItem(WEEKLY_STATE_KEY,JSON.stringify(stored));}catch(_){}
      }
      return;
    }
    const targetPage=tourSteps[next].page;
    if((targetPage==='command'&&(!isCommandCenter||isCloakShell))||(targetPage==='cloak'&&!isCloakShell)||(targetPage==='settings'&&!isSettings)||(targetPage==='games'&&!isGames)||(targetPage==='game'&&!isGameShell)){
      state.step=next;state.active=true;saveState(state);
      if(targetPage==='cloak'){
        // Do not navigate directly into a cloak URL from the tour. The highlighted
        // About:Blank button is responsible for creating the real cloaked tab.
        return setTimeout(position,80);
      }
      const target=targetPage==='command'?base:targetPage==='settings'?base+'settings/settings.html':targetPage==='games'?base+'pages/lessons/lessons.html':base+'pages/lessons/game-shell.html';
      location.href=target;
      return;
    }
    setStep(next);
  }

  function bindSpecialClicks(){
    document.addEventListener('click',event=>{
      if(!state.active)return;
      const target=event.target.closest?.('#cc-dashboard,#cc-blank,[data-action="settings"],#backButton,.play-btn');
      if(!target)return;

      if(target.id==='cc-dashboard'){
        state.awaitingEntry=true;
        state.step=stepIndex('Cosmic Entry');
        state.active=true;
        saveState(state);
        removeTour();
        return;
      }

      if(target.id==='cc-blank'){
        state.step=stepIndex('Cosmic Dashboard');
        state.active=true;
        state.awaitingEntry=false;
        saveState(state);
        removeTour();
        return;
      }

      if(target.matches('[data-action="settings"]')){
        const settingsIndex=stepIndex('Tab Cloak');
        if(settingsIndex>=0){state.step=settingsIndex;state.active=true;saveState(state);}
        return;
      }

      if(target.id==='backButton' && isSettings){
        // Let Settings' own Back handler restore the exact page the user came from.
        // The tour state is set to the cloaked Dashboard step before navigation.
        state.step=stepIndex('Cosmic Dashboard');
        state.active=true;
        state.awaitingEntry=false;
        saveState(state);
        return;
      }

      if(target.classList.contains('play-btn') && isGames){
        const gameIndex=stepIndex('Home button');
        if(gameIndex>=0){state.step=gameIndex;state.active=true;saveState(state);}
      }
    },true);

    window.addEventListener('cosmic-entry-ready',()=>{
      if(state.awaitingEntry){
        state.awaitingEntry=false;
        state.step=stepIndex('Cosmic Accounts');
        state.active=true;
        saveState(state);
        setTimeout(position,200);
      }
    });
  }

  const weeklyHighlights=weeklySteps.map(step=>({title:step.title,text:step.text}));
  const previousWeeklyHighlights=[
    {title:'Cosmic Spaces',text:'The Command Center connects Cosmic Games, Apps, YouTube, Settings, and the other platform surfaces.'},
    {title:'Cosmic Cloud Profiles',text:'Supported profile data can include favorites, recent games, missions, playlists, statistics, settings, and dashboards.'},
    {title:'Cosmic Foundry',text:'Inspect, normalize, wrap, validate, and preview game sources before importing them.'},
    {title:'Compatibility Engine',text:'Runtime adapters help legacy games handle paths, scripts, resize, focus, and launch differences.'},
    {title:'Deployment Shield',text:'Pre-publish checks inspect core files, registries, mirrors, shell behavior, and representative launches.'},
    {title:'Cosmic Arcade Network',text:'Scheduled events, progress, leaderboards, featured games, announcements, and badges.'},
    {title:'Cosmic Game Rooms',text:'Rooms support join codes, shared queues, room status, announcements, and host controls.'},
    {title:'Cosmic Universal Runtime',text:'A shared launch model for controls, permissions, fullscreen, recovery, and activity tracking.'}
  ];

  function weeklyHistory(){
    try{
      const stored=JSON.parse(localStorage.getItem(WEEKLY_STATE_KEY)||'null')||{};
      let history=Array.isArray(stored.history)?stored.history:[];
      if(!history.some(entry=>entry.version==='2026-10-06-8-features')){
        history.unshift({version:'2026-10-06-8-features',week:'2026-10-06',title:'Previous weekly feature tour',highlights:previousWeeklyHighlights});
      }
      if(!history.some(entry=>entry.version===WEEKLY_VERSION)){
        history.unshift({version:WEEKLY_VERSION,week:weekKey,title:'Cosmic Platform Tour',highlights:weeklyHighlights});
      }
      history=history.slice(0,12);
      const updated={...stored,version:stored.version||WEEKLY_VERSION,week:stored.week||weekKey,history};
      localStorage.setItem(WEEKLY_STATE_KEY,JSON.stringify(updated));
      return history;
    }catch(_){return [{version:WEEKLY_VERSION,week:weekKey,title:'Cosmic Platform Tour',highlights:weeklyHighlights}]}
  }

  function mountWeeklyPanel(){
    if(!isCommandCenter||isCloakShell)return;
    const shell=document.querySelector('#cc-root .cc-shell');
    const main=shell?.querySelector('main.cc-layout');
    if(!shell||!main||document.getElementById('cosmic-weekly-highlights'))return false;
    weeklyHistory();
    const panel=document.createElement('section');
    panel.id='cosmic-weekly-highlights';
    panel.setAttribute('aria-labelledby','cosmic-weekly-title');
    panel.style.cssText='display:flex;flex-direction:column;gap:12px;margin:0 auto 14px;width:min(1400px,calc(100% - 24px));padding:clamp(16px,2.3vw,24px);border:2px solid rgba(45,204,255,.8);border-radius:18px;background:radial-gradient(ellipse at 0 0,rgba(45,204,255,.2),transparent 58%),linear-gradient(135deg,rgba(7,25,37,.99),rgba(9,18,33,.99));box-shadow:0 0 0 4px rgba(45,204,255,.12),0 18px 46px rgba(0,0,0,.32);position:relative;z-index:30;';
    panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap"><div style="min-width:220px;flex:1"><span style="font-size:11px;letter-spacing:.16em;font-weight:900;color:#2dccff">COSMIC PLATFORM · FEATURE GUIDE</span><h2 id="cosmic-weekly-title" style="margin:6px 0;font-size:clamp(20px,3vw,28px);color:#f3fcff">What’s new in Cosmic</h2><p style="margin:0;color:#b8d0db;line-height:1.5">Explore platform features with a guided tour. This panel stays here, and previous weekly highlights remain available below.</p></div><button id="cosmic-weekly-tour-open" type="button" style="border:0;border-radius:12px;padding:13px 18px;background:#2dccff;color:#031721;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 0 24px rgba(45,204,255,.22)">✦ Start platform tour</button></div><details id="cosmic-weekly-history" style="border-top:1px solid rgba(45,204,255,.25);padding-top:10px"><summary style="cursor:pointer;color:#8fe8ff;font-weight:800">Previous highlights · kept for later</summary><div id="cosmic-weekly-history-list" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;margin-top:12px"></div></details>';
    const history=weeklyHistory();
    const list=panel.querySelector('#cosmic-weekly-history-list');
    list.innerHTML=history.map(entry=>'<article style="padding:12px;border:1px solid rgba(45,204,255,.25);border-radius:12px;background:rgba(1,10,17,.45)"><b style="display:block;color:#eafaff;margin-bottom:8px">'+escapeHtml(entry.title||entry.version)+'</b><span style="display:block;color:#7196a7;font-size:11px;margin-bottom:8px">'+escapeHtml(entry.week||'Previous release')+'</span><ul style="margin:0;padding-left:18px;color:#bfd3dc;font-size:12px;line-height:1.55">'+(entry.highlights||[]).map(h=>'<li><b>'+escapeHtml(h.title)+'</b> — '+escapeHtml(h.text)+'</li>').join('')+'</ul></article>').join('');
    main.parentNode.insertBefore(panel,main);
    panel.querySelector('#cosmic-weekly-tour-open').addEventListener('click',()=>startWeeklyTour(true));
    return true;
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function addWeeklyLauncher(){
    if(!isCommandCenter||isCloakShell)return;
    if(mountWeeklyPanel())return;
    if(!window.__COSMIC_WEEKLY_PANEL_OBSERVER__){
      window.__COSMIC_WEEKLY_PANEL_OBSERVER__=true;
      const observer=new MutationObserver(()=>{
        if(mountWeeklyPanel())observer.disconnect();
      });
      observer.observe(document.getElementById('cc-root')||document.body,{childList:true,subtree:true});
    }
  }

  function startWeeklyTour(manual=false){
    if(weeklyAlreadyShown&&!manual)return;
    const history=weeklyHistory();
    const stored=(()=>{try{return JSON.parse(localStorage.getItem(WEEKLY_STATE_KEY)||'null')||{}}catch(_){return {}}})();
    stored.active=true;stored.step=0;stored.version=WEEKLY_VERSION;stored.currentVersion=WEEKLY_VERSION;stored.week=weekKey;stored.startedAt=Date.now();stored.history=history;
    try{localStorage.setItem(WEEKLY_STATE_KEY,JSON.stringify(stored))}catch(_){}
    state.active=true;state.mode='weekly';state.step=0;state.opens=Math.max(state.opens,MAX_OPENS);
    saveState(state);
    setTimeout(position,250);
    if(!window.__COSMIC_WEEKLY_TOUR_RESIZE_BOUND__){
      window.__COSMIC_WEEKLY_TOUR_RESIZE_BOUND__=true;
      window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(position,80)});
      window.addEventListener('scroll',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(position,80)},{passive:true});
    }
  }



  function start(){
    if(state.mode==='weekly')return;
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
    state.step=stepIndex('Cosmic Entry');
    state.active=true;
    saveState(state);
  }

  addWeeklyLauncher();
  if(!weeklyAlreadyShown && !state.active && state.opens>=MAX_OPENS){
    startWeeklyTour();
  }else{
    start();
  }
})();