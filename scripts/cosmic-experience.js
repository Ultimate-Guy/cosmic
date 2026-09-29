(() => {
  'use strict';
  if (window.__COSMIC_EXPERIENCE_V1__) return;
  window.__COSMIC_EXPERIENCE_V1__ = true;

  const BASE = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  const USER_KEY = 'cosmicCurrentUserV1';
  const CAPSULES_KEY = 'cosmicSaveCapsulesV1';
  const RECOVERY_KEY = 'cosmicRecoveryQueueV1';
  const MISSIONS_KEY = 'cosmicMissionChainsV1';
  const HEALTH_KEY = 'cosmicRegistryHealthV1';
  const REPLAY_KEY = 'cosmicDeveloperReplayV1';
  const HANDOFF_PARAM = 'cosmicHandoff';
  const UPDATE_SEEN_KEY = 'cosmicUpdatesSeenV2';
  const BUILD_KEY = 'cosmicLastSeenBuildV1';
  const BUILD_ID = 'experience-v1';
  const MAX_RECOVERY = 24;
  const MAX_REPLAY = 40;

  const getUser = () => { try { return localStorage.getItem(USER_KEY) || 'Guest'; } catch (_) { return 'Guest'; } };
  const isDev = () => getUser() === 'TheDevilAngel';
  const load = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  const text = value => String(value ?? '');
  const esc = value => text(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const now = () => Date.now();

  const pageKind = () => {
    const p = location.pathname || '';
    if (/pages\/lessons\/lessons\.html$/i.test(p)) return 'games';
    if (/apps\/apps\.html$/i.test(p)) return 'apps';
    if (/pages\/lessons\/game-shell\.html$/i.test(p)) return 'game';
    if (/settings\/settings\.html$/i.test(p)) return 'settings';
    if (/cosmic-doctor\.html$/i.test(p)) return 'doctor';
    if (/^(?:\/cosmic\/)?$/i.test(p) || /\/index\.html$/i.test(p)) return 'command';
    return 'other';
  };

  const styles = document.createElement('style');
  styles.id = 'cosmic-experience-style';
  styles.textContent = '.cosmic-experience-panel{margin:14px 0;padding:14px;border:1px solid rgba(45,204,255,.24);border-radius:15px;background:rgba(6,17,24,.94);color:#eaf8ff;box-shadow:0 10px 28px rgba(0,0,0,.16)}.cosmic-experience-panel h3{margin:0 0 7px;color:#7fe5ff;font-size:.82rem;letter-spacing:.05em}.cosmic-experience-panel p{margin:4px 0;color:#8ea8b4;font-size:.68rem;line-height:1.45}.cosmic-experience-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.cosmic-experience-button{border:1px solid rgba(45,204,255,.3);border-radius:10px;padding:9px 10px;background:#081923;color:#bdefff;font-weight:800;cursor:pointer;text-align:left}.cosmic-experience-button:hover{border-color:#2dccff;background:#0b2533}.cosmic-route-btn,.cosmic-capsule-btn{border:1px solid rgba(45,204,255,.28)!important}.cosmic-confidence-badge{display:inline-flex;align-items:center;gap:5px;margin:6px 5px 2px 0;padding:4px 8px;border-radius:999px;border:1px solid rgba(45,204,255,.3);background:rgba(45,204,255,.06);color:#8fe8ff;font:800 10px system-ui,sans-serif}.cosmic-confidence-badge.review{border-color:rgba(255,117,117,.45);color:#ff9d9d;background:rgba(255,90,90,.07)}.cosmic-recovery-item,.cosmic-capsule-item,.cosmic-mission-item{padding:9px;border:1px solid rgba(45,204,255,.18);border-radius:10px;background:#081923;margin-top:7px}.cosmic-recovery-item b,.cosmic-capsule-item b,.cosmic-mission-item b{display:block;color:#f3fbff;font-size:.73rem}.cosmic-recovery-item small,.cosmic-capsule-item small,.cosmic-mission-item small{display:block;margin-top:4px;color:#77929e;font-size:.6rem;line-height:1.4}.cosmic-progress{height:6px;margin-top:7px;border-radius:999px;overflow:hidden;background:#031019;border:1px solid rgba(45,204,255,.15)}.cosmic-progress span{display:block;height:100%;background:#2dccff}.cosmic-adaptive-games-heavy .cc-layout{grid-template-columns:minmax(0,1.2fr) minmax(240px,290px)}.cosmic-adaptive-games-heavy .cc-layout>div:nth-child(2){order:-1}.cosmic-adaptive-app-heavy .cc-layout{grid-template-columns:minmax(0,1fr) minmax(280px,360px)}.cosmic-route-strip{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cosmic-route-chip{padding:5px 8px;border-radius:999px;border:1px solid rgba(45,204,255,.22);color:#8adfff;background:rgba(45,204,255,.05);font:700 10px system-ui,sans-serif}.cosmic-route-chip.warn{border-color:rgba(255,170,70,.45);color:#ffc77e;background:rgba(255,170,70,.07)}.cosmic-handoff-qr{width:220px;height:220px;display:block;margin:12px auto;background:white;border-radius:10px;padding:8px}.cosmic-code-box{width:100%;min-height:100px;resize:vertical;box-sizing:border-box;background:#02080d;color:#dff8ff;border:1px solid rgba(45,204,255,.35);border-radius:9px;padding:9px;font:12px ui-monospace,SFMono-Regular,monospace}.cosmic-mini-list{display:grid;gap:7px}.cosmic-update-relevance{border-left:3px solid #2dccff}.cosmic-update-relevance b{display:block;color:#f4fbff;font-size:.74rem}.cosmic-update-relevance small{display:block;margin-top:3px;color:#7c9aa6;font-size:.59rem}.cosmic-route-card{padding:12px;border:1px solid rgba(45,204,255,.2);border-radius:12px;background:#081923}.cosmic-route-card h4{margin:0 0 4px;color:#f4fbff;font-size:.82rem}.cosmic-route-card p{margin:4px 0;color:#92abb7;font-size:.65rem;line-height:1.45}';
  document.head.appendChild(styles);

  let registryPromise = null;
  let collectionsPromise = null;

  async function getRegistry() {
    if (registryPromise) return registryPromise;
    registryPromise = Promise.all([
      fetch(BASE + 'pages/lessons/games.json?experience=' + now(), {cache:'no-store'}).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(BASE + 'apps/apps.json?experience=' + now(), {cache:'no-store'}).then(r => r.ok ? r.json() : []).catch(() => [])
    ]).then(([games, apps]) => [
      ...(Array.isArray(games) ? games.map(x => ({...x, kind:'game'})) : []),
      ...(Array.isArray(apps) ? apps.map(x => ({...x, kind:'app'})) : [])
    ]);
    return registryPromise;
  }

  async function getCollections() {
    if (collectionsPromise) return collectionsPromise;
    collectionsPromise = fetch(BASE + 'collections.json?experience=' + now(), {cache:'no-store'})
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);
    return collectionsPromise;
  }

  function itemId(item) {
    return ((item?.kind || 'game') + ':' + (item?.name || '')).toLowerCase();
  }

  function profileKey() {
    return 'cosmicProfile:' + getUser();
  }

  function profile() {
    return load(profileKey(), {favorites:[],recent:[],stats:{},session:{},localName:getUser()});
  }

  function settingsSnapshot() {
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (/^(cosmic-|savedCloak$|disableStudyCloak$)/i.test(key)) result[key] = localStorage.getItem(key);
      }
    } catch (_) {}
    return result;
  }

  function applySettingsSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    try {
      Object.entries(snapshot).forEach(([key, value]) => {
        if (/^(cosmic-|savedCloak$|disableStudyCloak$)/i.test(key)) localStorage.setItem(key, String(value));
      });
    } catch (_) {}
  }

  function rememberLaunch(item, mode) {
    const p = profile();
    const key = itemId(item);
    p.recent = [key, ...(Array.isArray(p.recent) ? p.recent.filter(x => x !== key) : [])].slice(0,16);
    p.stats = p.stats || {};
    p.stats[key] = p.stats[key] || {opens:0};
    p.stats[key].opens = Number(p.stats[key].opens || 0) + 1;
    p.stats[key].lastOpened = now();
    p.stats[key].lastMode = mode || 'play';
    p.session = {lastItem:key,lastOpened:now(),launchMode:mode || 'play',scrollY:window.scrollY || 0};
    save(profileKey(),p);
  }

  function getWeekKey() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().slice(0,10);
  }

  function recordMissionEvent(type, item) {
    const state = load(MISSIONS_KEY, {week:getWeekKey(),events:[],completed:[]});
    if (state.week !== getWeekKey()) {
      state.week = getWeekKey();
      state.events = [];
      state.completed = [];
    }
    state.events = Array.isArray(state.events) ? state.events.slice(-120) : [];
    state.events.push({type,at:now(),item:item ? {name:item.name,kind:item.kind,category:item.category,tags:item.tags||[]} : null});
    save(MISSIONS_KEY,state);
  }

  function replay(event) {
    if (!isDev()) return;
    const rows = load(REPLAY_KEY, []);
    rows.push({...event,at:event.at || now()});
    save(REPLAY_KEY,rows.slice(-MAX_REPLAY));
  }

  function addRecovery(entry) {
    const rows = load(RECOVERY_KEY, []);
    const normalized = {id:text(entry.id || (entry.name + '|' + entry.host + '|' + now())),name:text(entry.name || 'Unknown game'),host:text(entry.host || location.host),mode:text(entry.mode || 'play'),reason:text(entry.reason || 'Unknown load failure'),target:text(entry.target || ''),at:Number(entry.at || now())};
    save(RECOVERY_KEY,[normalized,...rows.filter(x => x.id !== normalized.id)].slice(0,MAX_RECOVERY));
    replay({type:'recovery-created',...normalized});
    return normalized;
  }

  function removeRecovery(id) {
    save(RECOVERY_KEY,load(RECOVERY_KEY,[]).filter(x => x.id !== id));
  }

  function getHealth(item) {
    return load(HEALTH_KEY,{})[itemId(item)] || null;
  }

  function routeInfo(item, mode) {
    const raw = text(item?.path);
    const external = /^https?:\/\//i.test(raw);
    const github = location.hostname.endsWith('.github.io');
    const ugs = item?.source === 'UGS' || /cdn\.jsdelivr\.net\/gh\/Ultimate-Guy\/cosmicgames@/i.test(raw);
    const chips = [];
    if (ugs) chips.push(['External iframe','']);
    else if (external) chips.push(['External dependency','']);
    else chips.push(['Local file','']);
    if (!external && github) chips.push(['Cloudflare mirror','']);
    chips.push([mode === 'blank' ? 'About:blank launch' : (item?.kind === 'game' ? 'Cosmic game shell' : 'App wrapper'),'']);
    chips.push(['Popout available','']);
    const health = getHealth(item);
    if (health?.status === 'fail') chips.push(['Needs review','warn']);
    else if (ugs || external) chips.push(['Known external dependency','warn']);
    return {external,github,ugs,chips,health};
  }

  async function healthCheck(item) {
    const existing = getHealth(item);
    if (existing && now() - existing.at < 86400000) return existing;
    const raw = text(item?.path);
    const url = /^https?:\/\//i.test(raw) ? raw : new URL(BASE + raw, location.href).href;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), 3200);
    let result = {status:'unknown',at:now(),url};
    try {
      const response = await fetch(url,{method:'HEAD',cache:'no-store',mode:'cors',signal:controller?.signal});
      result = {status:response.ok?'ok':'fail',http:response.status,at:now(),url};
    } catch (e) {
      result = {status:/abort/i.test(text(e?.name)+text(e?.message))?'unknown':'fail',error:text(e?.message || e),at:now(),url};
    } finally {
      clearTimeout(timer);
    }
    const all = load(HEALTH_KEY,{});
    all[itemId(item)] = result;
    save(HEALTH_KEY,all);
    return result;
  }

  function confidence(item) {
    const health=getHealth(item);
    const p=profile();
    const stat=p.stats?.[itemId(item)];
    const recoveries=load(RECOVERY_KEY,[]).filter(x=>x.name===item?.name && now()-x.at<604800000);
    if (recoveries.length || health?.status==='fail') return {label:'Needs review',className:'review'};
    if (stat?.lastSuccess && now()-stat.lastSuccess<604800000) return {label:'Verified',className:''};
    if (stat?.lastOpened && now()-stat.lastOpened<604800000) return {label:'Usually works',className:''};
    if (item?.source==='UGS' || /^https?:\/\//i.test(text(item?.path))) return {label:'External dependency',className:''};
    if (item?.experimental) return {label:'Experimental',className:'review'};
    return {label:'Needs review',className:'review'};
  }

  function showExperienceModal(title,html,after) {
    let root=document.getElementById('cosmic-experience-modal');
    if(!root){
      root=document.createElement('div');
      root.id='cosmic-experience-modal';
      root.style.cssText='position:fixed;inset:0;z-index:2147483646;display:none;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);font:14px system-ui,sans-serif;';
      root.innerHTML='<div style="width:min(720px,95vw);max-height:88vh;overflow:auto;padding:20px;border:1px solid #2dccff;border-radius:18px;background:#07131a;color:#eef8fb"><button id="ce-modal-close" class="cosmic-experience-button" style="float:right">×</button><div id="ce-modal-body"></div></div>';
      document.body.appendChild(root);
      root.querySelector('#ce-modal-close').onclick=()=>root.style.display='none';
    }
    root.querySelector('#ce-modal-body').innerHTML='<h2 style="color:#7fe5ff;margin-top:0">'+esc(title)+'</h2>'+html;
    root.style.display='grid';
    if(after) after(root);
    return root;
  }

  function routeModal(item, launchMode) {
    const info=routeInfo(item,launchMode);
    const c=confidence(item);
    const chips=info.chips.map(x=>'<span class="cosmic-route-chip '+x[1]+'">'+esc(x[0])+'</span>').join('');
    const html='<div class="cosmic-route-card"><h4>'+esc(item?.name||'Untitled')+'</h4><div class="cosmic-route-strip">'+chips+'</div><p><b>Confidence:</b> '+esc(c.label)+'</p><p><b>Target:</b> '+esc(item?.path||'')+'</p><p>'+esc(info.ugs ? 'UGS games use Cosmic’s document-write compatibility path.' : info.external ? 'This target depends on an external host.' : 'This item stays inside Cosmic’s local launch path.')+'</p></div><div style="margin-top:12px;display:flex;gap:7px;flex-wrap:wrap"><button class="cosmic-experience-button" id="ce-route-launch">Launch normally</button><button class="cosmic-experience-button" id="ce-route-blank">Open popout</button></div>';
    if (document.getElementById('cc-modal')) {
      const m=document.getElementById('cc-modal'),d=m.querySelector('.cc-dialog');
      d.innerHTML='<button id="cc-experience-close" class="cc-btn" style="float:right">×</button><h2 style="color:#7fe5ff">Launch Route Preview</h2>'+html;
      m.classList.add('show');
      d.querySelector('#cc-experience-close').onclick=()=>m.classList.remove('show');
      d.querySelector('#ce-route-launch').onclick=()=>{m.classList.remove('show');launchItem(item,'play');};
      d.querySelector('#ce-route-blank').onclick=()=>{m.classList.remove('show');launchItem(item,'blank');};
    } else {
      showExperienceModal('Launch Route Preview',html,m=>{
        m.querySelector('#ce-route-launch').onclick=()=>{m.style.display='none';launchItem(item,'play');};
        m.querySelector('#ce-route-blank').onclick=()=>{m.style.display='none';launchItem(item,'blank');};
      });
    }
    recordMissionEvent('route-preview',item);
  }

  function saveCapsule(item, mode) {
    const name=window.prompt('Capsule name',item?.name||'Cosmic Capsule');
    if (!name) return;
    const capsules=load(CAPSULES_KEY,[]);
    const capsule={id:'capsule-'+now(),name:name.trim().slice(0,60),item:{name:item?.name||'',kind:item?.kind||'game',path:item?.path||'',entry:item?.entry||'',category:item?.category||'',tags:Array.isArray(item?.tags)?item.tags.slice(0,20):[]},launchMode:mode||'play',settings:settingsSnapshot(),createdAt:now(),confidence:confidence(item).label};
    save(CAPSULES_KEY,[capsule,...capsules].slice(0,30));
    replay({type:'capsule-saved',name:capsule.name,item:capsule.item});
    recordMissionEvent('capsule',item);
    showExperienceModal('Cosmic Save Capsules','<p>Saved <b>'+esc(capsule.name)+'</b>. The capsule stores the launch target, mode, and locally safe Cosmic settings.</p><button id="ce-close" class="cosmic-experience-button">Done</button>',m=>m.querySelector('#ce-close').onclick=()=>m.style.display='none');
  }

  function capsuleModal() {
    const capsules=load(CAPSULES_KEY,[]);
    const html='<p>Capsules stay on this device unless you export them through a handoff.</p><div class="cosmic-mini-list">'+(capsules.length?capsules.map(c=>'<div class="cosmic-capsule-item"><b>'+esc(c.name)+'</b><small>'+esc(c.item.name)+' • '+esc(c.launchMode)+' • '+new Date(c.createdAt).toLocaleString()+'</small><div style="margin-top:7px"><button class="cosmic-experience-button" data-capsule-launch="'+esc(c.id)+'">Reopen</button><button class="cosmic-experience-button" data-capsule-delete="'+esc(c.id)+'">Delete</button></div></div>').join(''):'<div class="cosmic-capsule-item"><b>No capsules yet</b><small>Save one from a Command Center item or a game route preview.</small></div>')+'</div>';
    showExperienceModal('Cosmic Save Capsules',html,m=>{
      m.querySelectorAll('[data-capsule-launch]').forEach(b=>b.onclick=()=>{const c=load(CAPSULES_KEY,[]).find(x=>x.id===b.dataset.capsuleLaunch);if(c){applySettingsSnapshot(c.settings);launchItem(c.item,c.launchMode);}});
      m.querySelectorAll('[data-capsule-delete]').forEach(b=>b.onclick=()=>{save(CAPSULES_KEY,load(CAPSULES_KEY,[]).filter(x=>x.id!==b.dataset.capsuleDelete));capsuleModal();});
    });
  }

  function launchItem(item, mode) {
    if (!item) return;
    recordMissionEvent(item.kind==='app'?'app-open':'game-open',item);
    rememberLaunch(item,mode);
    replay({type:'launch',name:item.name,kind:item.kind,mode,host:location.host,target:item.path});
    try { sessionStorage.setItem('cosmicPendingGameName',item.name||''); } catch (_) {}
    const raw=text(item.path);
    if(item.kind==='game'){
      const target=new URL(BASE + raw + (item.entry||''),location.href).href;
      const shell=new URL(BASE+'pages/lessons/game-shell.html',location.href);
      shell.searchParams.set('game',/^(https?:)?\/\//i.test(raw)?raw:target);
      if(mode==='blank'){const w=window.open('about:blank','_blank');if(w)w.location.href=shell.href;else location.href=shell.href;} else location.href=shell.href;
    }else{
      const target=new URL((/^(https?:)?\/\//i.test(raw)?raw:BASE+raw)+(item.entry||''),location.href).href;
      const wrapper=new URL(BASE+'apps/app.html',location.href);
      wrapper.searchParams.set('url',target);wrapper.searchParams.set('name',item.name||'Cosmic App');
      if(mode==='blank'){const w=window.open('about:blank','_blank');if(w)w.location.href=wrapper.href;else location.href=wrapper.href;} else location.href=wrapper.href;
    }
  }

  function missionsModal() {
    const state=load(MISSIONS_KEY,{week:getWeekKey(),events:[],completed:[]});
    const events=Array.isArray(state.events)?state.events:[];
    const defs=[
      {id:'arcade',title:'Arcade Relay',text:'Play 3 games.',need:3,match:e=>e.type==='game-open'},
      {id:'portal',title:'Portal Explorer',text:'Open 1 app and play a game from a category you have not used this week.',need:2,match:e=>e.type==='app-open'||e.type==='game-open'},
      {id:'route',title:'Route Scout',text:'Use a popout launch and open a Launch Route Preview.',need:2,match:e=>e.type==='popout'||e.type==='route-preview'},
      {id:'systems',title:'Cosmic Systems Check',text:'Visit Cosmic Doctor or save a capsule.',need:2,match:e=>e.type==='doctor'||e.type==='capsule'},
      {id:'collection',title:'Curator',text:'Open a rules-based collection and launch one item from it.',need:1,match:e=>e.type==='collection-launch'}
    ];
    const html='<p>Weekly chains reset automatically. Progress is stored only on this device.</p><div class="cosmic-mini-list">'+defs.map(d=>{const count=events.filter(d.match).length;const pct=Math.min(100,Math.round(count/d.need*100));return '<div class="cosmic-mission-item"><b>'+esc(d.title)+(count>=d.need?' ✓':'')+'</b><small>'+esc(d.text)+' • '+count+'/'+d.need+'</small><div class="cosmic-progress"><span style="width:'+pct+'%"></span></div></div>';}).join('')+'</div>';
    showExperienceModal('Mission Chains',html);
  }

  function renderRecoveryQueue() {
    const rows=load(RECOVERY_KEY,[]);
    const html='<p>Recent launch failures are kept here temporarily with the host and retry options.</p><div class="cosmic-mini-list">'+(rows.length?rows.map(r=>'<div class="cosmic-recovery-item"><b>'+esc(r.name)+'</b><small>'+esc(r.reason)+' • '+esc(r.host)+' • '+new Date(r.at).toLocaleString()+'</small><div style="margin-top:7px"><button class="cosmic-experience-button" data-rec-retry="'+esc(r.id)+'">Retry normally</button><button class="cosmic-experience-button" data-rec-blank="'+esc(r.id)+'">Open popout</button><button class="cosmic-experience-button" data-rec-report="'+esc(r.id)+'">Report issue</button><button class="cosmic-experience-button" data-rec-delete="'+esc(r.id)+'">Remove</button></div></div>').join(''):'<div class="cosmic-recovery-item"><b>Recovery Queue is clear</b><small>Failed launches will appear here automatically.</small></div>')+'</div>';
    showExperienceModal('Cosmic Recovery Queue',html,m=>{
      const find=id=>load(RECOVERY_KEY,[]).find(x=>x.id===id);
      m.querySelectorAll('[data-rec-retry]').forEach(b=>b.onclick=()=>{const r=find(b.dataset.recRetry);if(r)launchItem({name:r.name,kind:'game',path:r.target||'',category:'',tags:[]},'play');});
      m.querySelectorAll('[data-rec-blank]').forEach(b=>b.onclick=()=>{const r=find(b.dataset.recBlank);if(r)launchItem({name:r.name,kind:'game',path:r.target||'',category:'',tags:[]},'blank');});
      m.querySelectorAll('[data-rec-report]').forEach(b=>b.onclick=()=>{const r=find(b.dataset.recReport);const u=new URL('https://docs.google.com/forms/d/e/1FAIpQLSfLFwfXdL_Fk8FGAAXPire3yIPX0qIoj3Ua1dAGQsw4pTb98Q/viewform');u.searchParams.set('usp','pp_url');u.searchParams.set('entry.1659521365',r?.name||'');window.open(u.href,'_blank','noopener');});
      m.querySelectorAll('[data-rec-delete]').forEach(b=>b.onclick=()=>{removeRecovery(b.dataset.recDelete);renderRecoveryQueue();});
    });
  }

  function matchesRules(item,rules) {
    const rule=rules||{};
    if(rule.kind && text(item.kind)!==text(rule.kind)) return false;
    if(rule.category && text(item.category).toLowerCase()!==text(rule.category).toLowerCase()) return false;
    const tags=(Array.isArray(item.tags)?item.tags:[]).map(x=>text(x).toLowerCase());
    if(Array.isArray(rule.tagsAny)&&rule.tagsAny.length&&!rule.tagsAny.some(t=>tags.includes(text(t).toLowerCase()))) return false;
    if(Array.isArray(rule.tagsAll)&&rule.tagsAll.some(t=>!tags.includes(text(t).toLowerCase()))) return false;
    if(rule.multiplayer===true && !/multiplayer|2 player|2-player|versus|vs\.?|battle|bros|soccer|basket/i.test(tags.join(' ')+' '+text(item.name))) return false;
    if(rule.keyboard===true && !tags.includes('keyboard')) return false;
    if(Number.isFinite(Number(rule.minutesMax)) && Number(item.durationMinutes||item.minutes||9999)>Number(rule.minutesMax)) return false;
    if(rule.confidence && confidence(item).label!==rule.confidence) return false;
    return true;
  }

  function collectionsModal() {
    getRegistry().then(items=>getCollections().then(collections=>{
      const rows=(Array.isArray(collections)?collections:[]).map(c=>({c,items:items.filter(x=>matchesRules(x,c.rules||c))}));
      const html='<p>Collections are generated from rules instead of fixed game lists. Rules support category, tags, kind, confidence, and optional metadata such as minutes/keyboard/multiplayer.</p><div class="cosmic-mini-list">'+rows.map(({c,items:found})=>'<div class="cosmic-mission-item"><b>'+esc(c.name)+'</b><small>'+found.length+' matching items</small><div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap">'+found.slice(0,6).map(x=>'<button class="cosmic-experience-button" data-collection-item="'+esc(itemId(x))+'">'+esc(x.name)+'</button>').join('')+'</div></div>').join('')+'</div>';
      showExperienceModal('Collection Builder',html,m=>{m.querySelectorAll('[data-collection-item]').forEach(b=>b.onclick=async()=>{const item=items.find(x=>itemId(x)===b.dataset.collectionItem);if(item){recordMissionEvent('collection-launch',item);launchItem(item,'play');}});});
    }));
  }

  function handoffModal(item) {
    const payload={version:1,item:{name:item?.name||'',kind:item?.kind||'game',path:item?.path||'',entry:item?.entry||'',category:item?.category||'',tags:item?.tags||[]},launchMode:'play',settings:settingsSnapshot()};
    const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const link=new URL(BASE,location.href);link.searchParams.set(HANDOFF_PARAM,encoded);
    const qr='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(link.href);
    const html='<p>Scan this on another device or copy the handoff link. The payload contains the selected Cosmic item and locally safe settings.</p><img class="cosmic-handoff-qr" alt="Cosmic handoff QR code" src="'+esc(qr)+'"><textarea class="cosmic-code-box" id="ce-handoff-link">'+esc(link.href)+'</textarea><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px"><button class="cosmic-experience-button" id="ce-copy-handoff">Copy link</button></div><p style="font-size:.6rem;color:#748d99">The QR image is generated by a third-party QR image service; the encoded payload itself does not include account credentials.</p>';
    showExperienceModal('Portal Handoff',html,m=>{m.querySelector('#ce-copy-handoff').onclick=async()=>{try{await navigator.clipboard.writeText(link.href);showToast('Handoff link copied.');}catch(_){showToast('Copy was blocked by the browser.');}};});
  }

  function showToast(message) {
    let node=document.getElementById('cosmic-experience-toast');
    if(!node){node=document.createElement('div');node.id='cosmic-experience-toast';node.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;padding:9px 13px;border:1px solid #2dccff;border-radius:999px;background:#041018;color:#a8ecff;font:700 12px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)';document.body.appendChild(node);}
    node.textContent=message;clearTimeout(node.__timer);node.__timer=setTimeout(()=>node.remove(),2400);
  }

  function relevantUpdates() {
    return fetch(BASE+'pages/lessons/updates.html?experience='+now(),{cache:'no-store'}).then(r=>r.ok?r.text():'').then(html=>{
      const doc=new DOMParser().parseFromString(html,'text/html');
      const updates=[...doc.querySelectorAll('.update')].map((el,index)=>({id:((el.querySelector('.update-date')?.textContent||'Latest').trim())+'|'+((el.querySelector('h2')?.textContent||'Update').trim())+'|'+((el.querySelector('p')?.textContent||'').trim()),index,date:(el.querySelector('.update-date')?.textContent||'Latest').trim(),title:(el.querySelector('h2')?.textContent||'Update').trim(),body:(el.querySelector('p')?.textContent||'').trim()}));
      const seen=load(UPDATE_SEEN_KEY,{build:'',ids:[]});
      const p=profile();
      const interests=Object.keys(p.stats||{}).slice(0,12).map(k=>k.split(':').slice(1).join(':').toLowerCase()).filter(Boolean);
      const items=updates.map(u=>{const blob=(u.title+' '+u.body).toLowerCase();let score=0;interests.forEach(n=>{if(n&&blob.includes(n))score+=6;});if(/settings|cloak|panic|performance/.test(blob))score+=2;if(/app|youtube|ai/.test(blob)&&p.recent?.some(k=>k.startsWith('app:')))score+=2;if(/game|fix|launch|registry|catalog/.test(blob)&&p.recent?.some(k=>k.startsWith('game:')))score+=2;return {...u,score,unseen:!seen.ids?.includes(u.id)};}).filter(u=>u.unseen).sort((a,b)=>b.score-a.score||b.index-a.index);
      return {items:items.slice(0,4),lastSeenBuild:load(BUILD_KEY,'')||seen.build||''};
    }).catch(()=>({items:[],lastSeenBuild:''}));
  }

  function markUpdateSeen(id) {
    const state=load(UPDATE_SEEN_KEY,{build:BUILD_ID,ids:[]});
    state.build=BUILD_ID;state.ids=Array.from(new Set([...(state.ids||[]),id])).slice(-80);save(UPDATE_SEEN_KEY,state);
  }

  function updateRelevancePanel(shell) {
    const old=document.getElementById('cosmic-update-relevance');if(old)old.remove();
    relevantUpdates().then(result=>{
      if(!result.items.length)return;
      const section=document.createElement('section');
      section.id='cosmic-update-relevance';section.className='cc-panel cosmic-update-relevance';
      section.innerHTML='<div class="cc-head">What Changed for You</div><div class="cc-body"><p>Since your last Cosmic update checkpoint'+(result.lastSeenBuild?' ('+esc(result.lastSeenBuild)+')':'')+', these changes match your recent activity.</p><div class="cc-news">'+result.items.map(u=>'<article><span>'+esc(u.date)+'</span><b>'+esc(u.title)+'</b><p>'+esc(u.body)+'</p><button class="cc-btn" data-mark-update="'+esc(u.id)+'">Mark seen</button></article>').join('')+'</div></div>';
      section.querySelectorAll('[data-mark-update]').forEach(b=>b.onclick=()=>{markUpdateSeen(b.dataset.markUpdate);updateRelevancePanel(shell);});
      shell.appendChild(section);
    });
  }

  function adaptiveLayout(root) {
    if(!root)return;
    const p=profile();let games=0,apps=0;
    Object.entries(p.stats||{}).forEach(([key,value])=>{if(Number(value?.opens||0)>0){if(key.startsWith('game:'))games+=Number(value.opens||0);else if(key.startsWith('app:'))apps+=Number(value.opens||0);}});
    const shell=root.querySelector('.cc-shell');if(!shell)return;
    shell.classList.remove('cosmic-adaptive-games-heavy','cosmic-adaptive-app-heavy');
    if(games>=apps+3)shell.classList.add('cosmic-adaptive-games-heavy');else if(apps>=games+3)shell.classList.add('cosmic-adaptive-app-heavy');
  }

  function saveCapsuleForCurrentPage() {
    getRegistry().then(items=>{
      const name=pageKind()==='game'?(sessionStorage.getItem('cosmicPendingGameName')||'Current Game'):'Current Cosmic Item';
      const item=items.find(x=>x.name.toLowerCase()===name.toLowerCase())||{name,kind:'game',path:new URLSearchParams(location.search).get('game')||location.pathname,category:'',tags:[]};
      saveCapsule(item,'play');
    });
  }

  function enhanceDetail(item) {
    const modal=document.getElementById('cc-modal');
    if(!modal||!modal.classList.contains('show'))return;
    const dialog=modal.querySelector('.cc-dialog');
    if(!dialog||dialog.dataset.experienceDetail==='1')return;
    dialog.dataset.experienceDetail='1';
    const badge=confidence(item);
    const launch=dialog.querySelector('#cc-detail-launch');
    const bar=document.createElement('div');
    bar.innerHTML='<span class="cosmic-confidence-badge '+badge.className+'">Confidence: '+esc(badge.label)+'</span>';
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:7px;flex-wrap:wrap;margin-top:8px';
    actions.innerHTML='<button class="cc-btn cosmic-route-btn" id="ce-route">Route Preview</button><button class="cc-btn cosmic-capsule-btn" id="ce-capsule">Save Capsule</button><button class="cc-btn" id="ce-capsules">Capsules</button><button class="cc-btn" id="ce-handoff">Send to another device</button>';
    dialog.insertBefore(bar,launch||dialog.firstChild);if(launch)launch.after(actions);else dialog.appendChild(actions);
    actions.querySelector('#ce-route').onclick=()=>routeModal(item,'play');
    actions.querySelector('#ce-capsule').onclick=()=>saveCapsule(item,'play');
    actions.querySelector('#ce-capsules').onclick=capsuleModal;
    actions.querySelector('#ce-handoff').onclick=()=>handoffModal(item);
    healthCheck(item).then(h=>{if(h.status==='fail'||h.status==='ok'){const next=confidence(item);bar.innerHTML='<span class="cosmic-confidence-badge '+next.className+'">Confidence: '+esc(next.label)+' • '+esc(h.status==='ok'?'HTTP check passed':'HTTP check failed')+'</span>';}}).catch(()=>{});
  }

  function injectCommandCenter(root) {
    if(!root)return;
    const shell=root.querySelector('.cc-shell');if(!shell)return;
    if(shell.querySelector('#cosmic-experience-system-panel')){adaptiveLayout(root);return;}
    adaptiveLayout(root);
    const panel=document.createElement('section');panel.className='cosmic-experience-panel';panel.id='cosmic-experience-system-panel';
    panel.innerHTML='<h3>Cosmic Systems</h3><p>Save state, preview launch routes, recover failed launches, and continue your portal across devices.</p><div class="cosmic-experience-grid"><button class="cosmic-experience-button" id="ce-capsules-open">Save Capsules</button><button class="cosmic-experience-button" id="ce-route-all">Route Preview</button><button class="cosmic-experience-button" id="ce-recovery-open">Recovery Queue ('+load(RECOVERY_KEY,[]).length+')</button><button class="cosmic-experience-button" id="ce-missions-open">Mission Chains</button><button class="cosmic-experience-button" id="ce-collections-open">Rule Collections</button><button class="cosmic-experience-button" id="ce-handoff-pick">Send to another device</button>'+(isDev()?'<button class="cosmic-experience-button" id="ce-replay-open">Developer Replay Logs</button>':'')+'</div>';
    shell.appendChild(panel);
    panel.querySelector('#ce-capsules-open').onclick=capsuleModal;
    panel.querySelector('#ce-recovery-open').onclick=renderRecoveryQueue;
    panel.querySelector('#ce-missions-open').onclick=missionsModal;
    panel.querySelector('#ce-collections-open').onclick=collectionsModal;
    panel.querySelector('#ce-route-all').onclick=async()=>{const items=await getRegistry();const item=items[Math.floor(Math.random()*Math.max(1,items.length))];if(item)routeModal(item,'play');};
    panel.querySelector('#ce-handoff-pick').onclick=async()=>{const items=await getRegistry();const p=profile();const item=items.find(x=>p.recent?.includes(itemId(x)))||items[0];if(item)handoffModal(item);};
    panel.querySelector('#ce-replay-open')?.addEventListener('click',developerReplayModal);
    updateRelevancePanel(shell);
  }

  function developerReplayModal() {
    if(!isDev())return;
    const rows=load(REPLAY_KEY,[]);
    const html='<p>Developer-only local replay data. This is never rendered for non-developer users.</p><div class="cosmic-mini-list">'+(rows.length?rows.slice().reverse().map(r=>'<div class="cosmic-recovery-item"><b>'+esc(r.type)+' • '+esc(r.name||'')+'</b><small>'+esc(r.host||'')+' • '+esc(r.mode||'')+' • '+new Date(r.at||0).toLocaleString()+(r.reason?' • '+esc(r.reason):'')+(r.error?' • '+esc(r.error):'')+'</small></div>').join(''):'<div class="cosmic-recovery-item"><b>No replay events yet</b></div>')+'</div><button class="cosmic-experience-button" id="ce-clear-replay">Clear replay logs</button>';
    showExperienceModal('Developer Replay Logs',html,m=>m.querySelector('#ce-clear-replay').onclick=()=>{save(REPLAY_KEY,[]);developerReplayModal();});
  }


  function injectAppRoutes() {
    document.querySelectorAll('.app-card').forEach(card=>{
      if(card.dataset.cosmicExperienceRoute==='1')return;
      const name=card.querySelector('.app-title')?.textContent?.trim()||'';card.dataset.cosmicExperienceRoute='1';
      getRegistry().then(items=>{
        const real=items.find(x=>x.kind==='app'&&x.name===name);const open=card.querySelector('.open-btn');if(!real||!open)return;
        const btn=document.createElement('button');btn.className='open-btn cosmic-route-btn';btn.type='button';btn.textContent='Route';
        btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();routeModal(real,'play');});
        open.after(btn);
      });
    });
  }

  function firstVisibleGame() {
    const cards=[...document.querySelectorAll('.game-card')];
    const card=cards.find(x=>getComputedStyle(x).display!=='none' && x.offsetParent!==null) || cards[0];
    if(!card)return null;
    const name=card.dataset.name||card.querySelector('.game-title')?.textContent?.trim()||'';
    return getRegistry().then(items=>items.find(x=>x.kind==='game'&&x.name.toLowerCase()===name.toLowerCase())||null);
  }

  function injectPageTools() {
    const kind=pageKind();
    if(kind!=='games' && kind!=='apps')return;
    if(document.getElementById('cosmic-page-tools'))return;
    const anchor=kind==='games' ? document.getElementById('gamesearchform') : document.getElementById('search');
    if(!anchor)return;
    const bar=document.createElement('section');
    bar.id='cosmic-page-tools';
    bar.className='cosmic-experience-panel';
    bar.style.cssText='margin:12px auto;max-width:1240px;padding:10px 12px';
    bar.innerHTML='<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center"><strong style="color:#7fe5ff;font-size:.72rem;letter-spacing:.06em">COSMIC TOOLS</strong><button class="cosmic-experience-button" id="ce-page-route">Route Preview</button><button class="cosmic-experience-button" id="ce-page-capsule">Save Capsule</button><button class="cosmic-experience-button" id="ce-page-recovery">Recovery Queue</button><button class="cosmic-experience-button" id="ce-page-missions">Mission Chains</button><button class="cosmic-experience-button" id="ce-page-collections">Rule Collections</button><button class="cosmic-experience-button" id="ce-page-handoff">Send to another device</button></div>';
    anchor.insertAdjacentElement('afterend',bar);
    bar.querySelector('#ce-page-route').onclick=()=>{
      if(kind==='games') firstVisibleGame().then(item=>item?routeModal(item,'play'):showToast('Search for a game first.'));
      else getRegistry().then(items=>{const item=items.find(x=>x.kind==='app');if(item)routeModal(item,'play');});
    };
    bar.querySelector('#ce-page-capsule').onclick=()=>{
      if(kind==='games') firstVisibleGame().then(item=>item?saveCapsule(item,'play'):showToast('Search for a game first.'));
      else getRegistry().then(items=>{const item=items.find(x=>x.kind==='app');if(item)saveCapsule(item,'play');});
    };
    bar.querySelector('#ce-page-recovery').onclick=renderRecoveryQueue;
    bar.querySelector('#ce-page-missions').onclick=missionsModal;
    bar.querySelector('#ce-page-collections').onclick=collectionsModal;
    bar.querySelector('#ce-page-handoff').onclick=async()=>{
      const items=await getRegistry();
      const p=profile();
      const item=items.find(x=>p.recent?.includes(itemId(x))) || (kind==='games' ? await firstVisibleGame() : items.find(x=>x.kind==='app'));
      if(item)handoffModal(item); else showToast('Open something first so Cosmic can hand it off.');
    };
  }

  function interceptLaunches() {
    document.addEventListener('click',e=>{
      const t=e.target?.closest?.('button');if(!t)return;
      if(t.matches('.game-card .play-btn')){
        const name=t.closest('.game-card')?.dataset.name||t.closest('.game-card')?.querySelector('.game-title')?.textContent?.trim();
        if(name)getRegistry().then(items=>{const item=items.find(x=>x.kind==='game'&&x.name.toLowerCase()===name.toLowerCase());if(item){rememberLaunch(item,'play');recordMissionEvent('game-open',item);replay({type:'launch-intent',name:item.name,kind:item.kind,mode:'play',host:location.host});}});
      } else if(t.matches('.game-card .blank-btn') && !t.classList.contains('cosmic-route-btn')){
        const name=t.closest('.game-card')?.dataset.name||t.closest('.game-card')?.querySelector('.game-title')?.textContent?.trim();
        if(name)getRegistry().then(items=>{const item=items.find(x=>x.kind==='game'&&x.name.toLowerCase()===name.toLowerCase());if(item){rememberLaunch(item,'blank');recordMissionEvent('popout',item);replay({type:'launch-intent',name:item.name,kind:item.kind,mode:'blank',host:location.host});}});
      } else if(t.matches('.app-card .open-btn') && !t.classList.contains('cosmic-route-btn')){
        const name=t.closest('.app-card')?.querySelector('.app-title')?.textContent?.trim();
        if(name)getRegistry().then(items=>{const item=items.find(x=>x.kind==='app'&&x.name===name);if(item){rememberLaunch(item,'play');recordMissionEvent('app-open',item);replay({type:'launch-intent',name:item.name,kind:item.kind,mode:'play',host:location.host});}});
      } else if(t.matches('[data-action="doctor"]')) {
        recordMissionEvent('doctor');
      } else if(t.id==='cc-blank'||t.id==='cc-blob') {
        recordMissionEvent('popout');
      }
    },true);
  }

  function shellRecoveryHooks() {
    if(pageKind()!=='game')return;
    const frame=document.getElementById('game');
    const name=(()=>{try{return sessionStorage.getItem('cosmicPendingGameName')||'Cosmic Game';}catch(_){return 'Cosmic Game';}})();
    const target=new URLSearchParams(location.search).get('game')||'';
    const host=(()=>{try{return new URL(target,location.href).hostname||location.host;}catch(_){return location.host;}})();
    let timer=null;
    replay({type:'game-shell-start',name,host,mode:'play',target});
    const loaded=()=>{if(timer)clearTimeout(timer);replay({type:'iframe-loaded',name,host,mode:'play',target});const p=profile();p.stats=p.stats||{};const key=itemId({name,kind:'game'});p.stats[key]=p.stats[key]||{opens:0};p.stats[key].lastSuccess=now();save(profileKey(),p);};
    frame?.addEventListener('load',loaded,{once:false});
    timer=setTimeout(()=>{addRecovery({name,host,mode:'play',reason:'Game did not report a frame load within 15 seconds.',target});const box=document.getElementById('cosmic-game-recovery');if(box)box.style.display='grid';},15000);
    window.CosmicExperience=window.CosmicExperience||{};
    window.CosmicExperience.recordRecovery=(reason,error)=>{if(timer)clearTimeout(timer);addRecovery({name,host,mode:'play',reason:reason||'Game launch failed.',target});replay({type:'launch-failed',name,host,mode:'play',target,error:text(error)});};
  }

  function handleHandoff() {
    const encoded=new URLSearchParams(location.search).get(HANDOFF_PARAM);if(!encoded)return;
    try{
      const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);
      const payload=JSON.parse(decodeURIComponent(escape(atob(padded))));
      if(payload?.version!==1||!payload.item?.name)return;
      setTimeout(()=>showExperienceModal('Incoming Cosmic Handoff','<p><b>'+esc(payload.item.name)+'</b> is ready to open.</p><p>Launch mode: '+esc(payload.launchMode||'play')+'. Accepting also applies locally safe settings from the handoff.</p><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="cosmic-experience-button" id="ce-accept-handoff">Accept & Launch</button><button class="cosmic-experience-button" id="ce-decline-handoff">Not now</button></div>',m=>{m.querySelector('#ce-decline-handoff').onclick=()=>m.style.display='none';m.querySelector('#ce-accept-handoff').onclick=()=>{applySettingsSnapshot(payload.settings);recordMissionEvent('handoff');launchItem(payload.item,payload.launchMode||'play');};}),450);
    }catch(_){}
  }

  function enhanceDetail(item) {
    const modal=document.getElementById('cc-modal');if(!modal||!modal.classList.contains('show'))return;
    const dialog=modal.querySelector('.cc-dialog');if(!dialog||dialog.dataset.experienceDetail==='1')return;
    dialog.dataset.experienceDetail='1';
    const badge=confidence(item);const launch=dialog.querySelector('#cc-detail-launch');
    const bar=document.createElement('div');bar.innerHTML='<span class="cosmic-confidence-badge '+badge.className+'">Confidence: '+esc(badge.label)+'</span>';
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:7px;flex-wrap:wrap;margin-top:8px';actions.innerHTML='<button class="cc-btn cosmic-route-btn" id="ce-route">Route Preview</button><button class="cc-btn cosmic-capsule-btn" id="ce-capsule">Save Capsule</button><button class="cc-btn" id="ce-capsules">Capsules</button><button class="cc-btn" id="ce-handoff">Send to another device</button>';
    dialog.insertBefore(bar,launch||dialog.firstChild);if(launch)launch.after(actions);else dialog.appendChild(actions);
    actions.querySelector('#ce-route').onclick=()=>routeModal(item,'play');
    actions.querySelector('#ce-capsule').onclick=()=>saveCapsule(item,'play');
    actions.querySelector('#ce-capsules').onclick=capsuleModal;
    actions.querySelector('#ce-handoff').onclick=()=>handoffModal(item);
    healthCheck(item).then(h=>{if(h.status==='fail'||h.status==='ok'){const next=confidence(item);bar.innerHTML='<span class="cosmic-confidence-badge '+next.className+'">Confidence: '+esc(next.label)+' • '+esc(h.status==='ok'?'HTTP check passed':'HTTP check failed')+'</span>';}}).catch(()=>{});
  }

  function injectCommandCenter(root) {
    if(!root)return;
    const shell=root.querySelector('.cc-shell');if(!shell)return;
    if(shell.querySelector('#cosmic-experience-system-panel')){adaptiveLayout(root);return;}
    adaptiveLayout(root);
    const panel=document.createElement('section');panel.className='cosmic-experience-panel';panel.id='cosmic-experience-system-panel';
    panel.innerHTML='<h3>Cosmic Systems</h3><p>Save state, preview launch routes, recover failed launches, and continue your portal across devices.</p><div class="cosmic-experience-grid"><button class="cosmic-experience-button" id="ce-capsules-open">Save Capsules</button><button class="cosmic-experience-button" id="ce-route-all">Route Preview</button><button class="cosmic-experience-button" id="ce-recovery-open">Recovery Queue ('+load(RECOVERY_KEY,[]).length+')</button><button class="cosmic-experience-button" id="ce-missions-open">Mission Chains</button><button class="cosmic-experience-button" id="ce-collections-open">Rule Collections</button><button class="cosmic-experience-button" id="ce-handoff-pick">Send to another device</button>'+(isDev()?'<button class="cosmic-experience-button" id="ce-replay-open">Developer Replay Logs</button>':'')+'</div>';
    shell.appendChild(panel);
    panel.querySelector('#ce-capsules-open').onclick=capsuleModal;
    panel.querySelector('#ce-recovery-open').onclick=renderRecoveryQueue;
    panel.querySelector('#ce-missions-open').onclick=missionsModal;
    panel.querySelector('#ce-collections-open').onclick=collectionsModal;
    panel.querySelector('#ce-route-all').onclick=async()=>{const items=await getRegistry();const item=items[Math.floor(Math.random()*Math.max(1,items.length))];if(item)routeModal(item,'play');};
    panel.querySelector('#ce-handoff-pick').onclick=async()=>{const items=await getRegistry();const p=profile();const item=items.find(x=>p.recent?.includes(itemId(x)))||items[0];if(item)handoffModal(item);};
    panel.querySelector('#ce-replay-open')?.addEventListener('click',developerReplayModal);
    updateRelevancePanel(shell);
  }

  function developerReplayModal() {
    if(!isDev())return;
    const rows=load(REPLAY_KEY,[]);
    const html='<p>Developer-only local replay data. This is never rendered for non-developer users.</p><div class="cosmic-mini-list">'+(rows.length?rows.slice().reverse().map(r=>'<div class="cosmic-recovery-item"><b>'+esc(r.type)+' • '+esc(r.name||'')+'</b><small>'+esc(r.host||'')+' • '+esc(r.mode||'')+' • '+new Date(r.at||0).toLocaleString()+(r.reason?' • '+esc(r.reason):'')+(r.error?' • '+esc(r.error):'')+'</small></div>').join(''):'<div class="cosmic-recovery-item"><b>No replay events yet</b></div>')+'</div><button class="cosmic-experience-button" id="ce-clear-replay">Clear replay logs</button>';
    showExperienceModal('Developer Replay Logs',html,m=>m.querySelector('#ce-clear-replay').onclick=()=>{save(REPLAY_KEY,[]);developerReplayModal();});
  }

  function injectLessonRoutes() {
    document.querySelectorAll('.game-card').forEach(card=>{
      if(card.dataset.cosmicExperienceRoute==='1')return;
      const actions=card.querySelector('.card-actions');if(!actions)return;
      card.dataset.cosmicExperienceRoute='1';
      const btn=document.createElement('button');btn.className='blank-btn cosmic-route-btn';btn.type='button';btn.textContent='Route';btn.dataset.cosmicRoute='1';actions.appendChild(btn);
    });
  }

  function injectAppRoutes() {
    document.querySelectorAll('.app-card').forEach(card=>{
      if(card.dataset.cosmicExperienceRoute==='1')return;
      const name=card.querySelector('.app-title')?.textContent?.trim()||'';card.dataset.cosmicExperienceRoute='1';
      getRegistry().then(items=>{
        const real=items.find(x=>x.kind==='app'&&x.name===name);const open=card.querySelector('.open-btn');if(!real||!open)return;
        const btn=document.createElement('button');btn.className='open-btn cosmic-route-btn';btn.type='button';btn.textContent='Route';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();routeModal(real,'play');});open.after(btn);
      });
    });
  }

  function interceptLaunches() {
    document.addEventListener('click',e=>{
      const t=e.target?.closest?.('button');if(!t)return;
      if(t.matches('.game-card .play-btn')){
        const name=t.closest('.game-card')?.dataset.name||t.closest('.game-card')?.querySelector('.game-title')?.textContent?.trim();
        if(name)getRegistry().then(items=>{const item=items.find(x=>x.kind==='game'&&x.name.toLowerCase()===name.toLowerCase());if(item){rememberLaunch(item,'play');recordMissionEvent('game-open',item);replay({type:'launch-intent',name:item.name,kind:item.kind,mode:'play',host:location.host});}});
      } else if(t.matches('.game-card .blank-btn')&&!t.classList.contains('cosmic-route-btn')){
        const name=t.closest('.game-card')?.dataset.name||t.closest('.game-card')?.querySelector('.game-title')?.textContent?.trim();
        if(name)getRegistry().then(items=>{const item=items.find(x=>x.kind==='game'&&x.name.toLowerCase()===name.toLowerCase());if(item){rememberLaunch(item,'blank');recordMissionEvent('popout',item);replay({type:'launch-intent',name:item.name,kind:item.kind,mode:'blank',host:location.host});}});
      } else if(t.matches('.app-card .open-btn')&&!t.classList.contains('cosmic-route-btn')){
        const name=t.closest('.app-card')?.querySelector('.app-title')?.textContent?.trim();
        if(name)getRegistry().then(items=>{const item=items.find(x=>x.kind==='app'&&x.name===name);if(item){rememberLaunch(item,'play');recordMissionEvent('app-open',item);replay({type:'launch-intent',name:item.name,kind:item.kind,mode:'play',host:location.host});}});
      } else if(t.matches('[data-action="doctor"]')) recordMissionEvent('doctor');
      else if(t.id==='cc-blank'||t.id==='cc-blob') recordMissionEvent('popout');
    },true);
  }

  function shellRecoveryHooks() {
    if(pageKind()!=='game')return;
    const frame=document.getElementById('game');
    const name=(()=>{try{return sessionStorage.getItem('cosmicPendingGameName')||'Cosmic Game';}catch(_){return 'Cosmic Game';}})();
    const target=new URLSearchParams(location.search).get('game')||'';
    const host=(()=>{try{return new URL(target,location.href).hostname||location.host;}catch(_){return location.host;}})();
    let timer=null;
    replay({type:'game-shell-start',name,host,mode:'play',target});
    const loaded=()=>{if(timer)clearTimeout(timer);replay({type:'iframe-loaded',name,host,mode:'play',target});const p=profile();p.stats=p.stats||{};const key=itemId({name,kind:'game'});p.stats[key]=p.stats[key]||{opens:0};p.stats[key].lastSuccess=now();save(profileKey(),p);};
    frame?.addEventListener('load',loaded,{once:false});
    timer=setTimeout(()=>{addRecovery({name,host,mode:'play',reason:'Game did not report a frame load within 15 seconds.',target});const box=document.getElementById('cosmic-game-recovery');if(box)box.style.display='grid';},15000);
    window.CosmicExperience=window.CosmicExperience||{};
    window.CosmicExperience.recordRecovery=(reason,error)=>{if(timer)clearTimeout(timer);addRecovery({name,host,mode:'play',reason:reason||'Game launch failed.',target});replay({type:'launch-failed',name,host,mode:'play',target,error:text(error)});};
  }

  function handleHandoff() {
    const encoded=new URLSearchParams(location.search).get(HANDOFF_PARAM);if(!encoded)return;
    try{
      const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);
      const payload=JSON.parse(decodeURIComponent(escape(atob(padded))));
      if(payload?.version!==1||!payload.item?.name)return;
      setTimeout(()=>showExperienceModal('Incoming Cosmic Handoff','<p><b>'+esc(payload.item.name)+'</b> is ready to open.</p><p>Launch mode: '+esc(payload.launchMode||'play')+'. Accepting also applies locally safe settings from the handoff.</p><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="cosmic-experience-button" id="ce-accept-handoff">Accept & Launch</button><button class="cosmic-experience-button" id="ce-decline-handoff">Not now</button></div>',m=>{m.querySelector('#ce-decline-handoff').onclick=()=>m.style.display='none';m.querySelector('#ce-accept-handoff').onclick=()=>{applySettingsSnapshot(payload.settings);recordMissionEvent('handoff');launchItem(payload.item,payload.launchMode||'play');};}),450);
    }catch(_){}
  }

  function boot() {
    interceptLaunches();
    if(pageKind()==='game')shellRecoveryHooks();
    handleHandoff();

    if(pageKind()==='command'){
      const ccRoot=document.getElementById('cc-root');
      if(ccRoot){
        const observer=new MutationObserver(()=>{
          injectCommandCenter(ccRoot);
          const modal=document.getElementById('cc-modal');
          if(modal?.classList.contains('show')){
            const title=modal.querySelector('.cc-dialog h2')?.textContent||'';
            if(/Item Details/i.test(title)){
              getRegistry().then(items=>{
                const heading=modal.querySelector('.cc-dialog h2')?.textContent?.trim()||'';
                const item=items.find(x=>x.name===heading);
                if(item)enhanceDetail(item);
              });
            }
          }
        });
        injectCommandCenter(ccRoot);
        observer.observe(ccRoot,{childList:true});
      }
    }
    if(pageKind()==='games'){
      injectPageTools();
    }
    if(pageKind()==='apps'){
      injectPageTools();
      injectAppRoutes();
    }
  }

  window.CosmicExperience={saveCapsule,addRecovery,removeRecovery,renderRecoveryQueue,routeModal,confidence,healthCheck,replay,recordMissionEvent,showToast,settingsSnapshot,saveCapsuleForCurrentPage};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();