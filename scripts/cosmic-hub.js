(()
  function enhanceCards(){
    document.querySelectorAll('.game-card,.app-card').forEach(card=>{
      if(card.dataset.cosmicEnhanced==='1')return;
      const title=card.querySelector('.game-title,.app-title')?.textContent?.trim();
      const item=allItems.find(x=>x.name.toLowerCase()===String(title||'').toLowerCase());
      if(!item)return;
      card.dataset.cosmicEnhanced='1';
      const meta=playMeta(item),info=document.createElement('small');
      info.className='cosmic-play-meta';info.style.cssText='display:block;text-align:center;opacity:.75;margin:4px 0';info.textContent=meta.time+' • '+meta.tags.join(' • ');
      card.querySelector('.game-title,.app-title')?.after(info);
      card.addEventListener('dblclick',()=>previewDrawer(item));
    });
  }
 => {
  'use strict';
  // This identifier is also checked after a Cloudflare deploy. Keep it in the
  // served script so a successful deploy cannot silently serve an older hub.
  const COSMIC_HUB_RELEASE = 'cosmic-hub-v9';
  if (window.__COSMIC_HUB_V1__) return;
  window.__COSMIC_HUB_V1__ = true;

  const STORE = 'cosmicHubV1';
  const ACCOUNTS = 'cosmicAccountsV1';
  const SESSION = 'cosmicCurrentUserV1';
  const ADMIN_NAME = 'TheDevilAngel';
  const root = document.documentElement;
  const path = location.pathname || '';
  const pathIsApps = /\/apps\/apps\.html$/i.test(path);
  const pathIsGames = /\/pages\/lessons\/lessons\.html$/i.test(path);
  let isApps = pathIsApps;
  let isGames = pathIsGames;
  let bootStarted = false;
  let bootRetry = null;
  const base = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  const apiBase = location.origin;
  const safe = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const load = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch (_) { return fallback; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const currentUser = () => { try { return localStorage.getItem(SESSION) || 'Guest'; } catch (_) { return 'Guest'; } };
  const profileKey = () => `cosmicProfile:${currentUser()}`;
  const profile = () => load(profileKey(), { favorites: [], recent: [], notes: {}, stats: {}, theme: 'nebula', motion: 1 });
  const writeProfile = p => save(profileKey(), p);

  function itemId(item) { return `${item.kind}:${item.name}`.toLowerCase(); }
  function kindFor(item) { return item.kind || (isApps ? 'app' : 'game'); }
  function inferCategory(item) {
    const s = `${item.name || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
    if (item.category) return item.category;
    if (/ai|chat|assistant|github|calculator|clock|tool|utility|music|youtube/.test(s)) return 'Utility';
    if (/puzz|2048|chess|word|sudoku|mahjong|memory|brain/.test(s)) return 'Puzzle';
    if (/multiplayer|2 player|2-player|among us|basket|soccer|karts|battle|brawl|bros|versus|vs\.?/.test(s)) return 'Multiplayer';
    if (/new|2026/.test(s)) return 'New';
    return 'Arcade';
  }
  function normalize(item) { return {...item, kind: kindFor(item), category: inferCategory(item), tags: Array.isArray(item.tags) ? item.tags : []}; }

  let games = [], apps = [], collections = [];
  async function getJson(url, fallback) { try { const r = await fetch(url, {cache:'no-store'}); if (!r.ok) throw new Error(r.status); return await r.json(); } catch (_) { return fallback; } }

  const css = `
    html.cosmic-focus-mode body>*:not(#cosmic-focus-exit){display:none!important}html.cosmic-focus-mode{background:#000!important}html.cosmic-focus-mode body{margin:0!important;background:#000!important}
    #cosmic-hub-tools{max-width:1400px;margin:0 auto;padding:0 40px 18px}
    .cosmic-section{margin:18px 0}.cosmic-section h3{margin:0 0 10px;color:var(--accent,#2dccff);font-size:1rem;letter-spacing:1px}.cosmic-row{display:flex;gap:10px;overflow:auto;padding:4px 2px 10px;scrollbar-width:thin}.cosmic-mini{min-width:170px;max-width:210px;padding:12px;border:1px solid var(--card-border,#2dccff);border-radius:14px;background:rgba(6,20,16,.7);color:inherit;cursor:pointer;text-align:left}.cosmic-mini:hover{transform:translateY(-2px);background:rgba(45,204,255,.12)}.cosmic-mini b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cosmic-mini small{opacity:.7}.cosmic-star{position:absolute;right:8px;top:8px;width:32px;height:32px;border:1px solid var(--card-border,#2dccff);border-radius:50%;background:rgba(0,0,0,.55);color:var(--accent,#2dccff);cursor:pointer;font-size:17px;z-index:3}.game-card,.app-card{position:relative}.cosmic-more{margin-top:8px;width:100%;height:30px;border-radius:9px;border:1px solid var(--card-border,#2dccff);background:transparent;color:var(--accent,#2dccff);cursor:pointer}.cosmic-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.cosmic-filter,.cosmic-tool{border:1px solid var(--card-border,#2dccff);border-radius:999px;padding:7px 12px;background:rgba(0,0,0,.22);color:var(--accent,#2dccff);cursor:pointer}.cosmic-filter.active{background:var(--accent,#2dccff);color:#031721}.cosmic-badge{position:fixed;right:14px;bottom:14px;z-index:2147483000;padding:7px 11px;border:1px solid var(--card-border,#2dccff);border-radius:999px;background:rgba(5,12,18,.92);color:var(--accent,#2dccff);font:700 12px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)}#cosmic-account{position:fixed;right:14px;top:14px;z-index:2147483001}.cosmic-modal{position:fixed;inset:0;z-index:2147483002;display:none;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.cosmic-panel{width:min(760px,95vw);max-height:88vh;overflow:auto;padding:24px;border:1px solid var(--card-border,#2dccff);border-radius:20px;background:#07131a;color:#f2f7fa;box-shadow:0 25px 80px rgba(0,0,0,.65)}.cosmic-panel h2{margin-top:0;color:var(--accent,#2dccff)}.cosmic-panel input,.cosmic-panel textarea,.cosmic-panel select{width:100%;box-sizing:border-box;margin:6px 0 12px;padding:10px;border-radius:9px;border:1px solid var(--card-border,#2dccff);background:#02070b;color:#fff}.cosmic-panel button{border:1px solid var(--card-border,#2dccff);border-radius:9px;padding:9px 13px;background:rgba(45,204,255,.1);color:var(--accent,#2dccff);cursor:pointer;margin:3px}.cosmic-primary{background:var(--accent,#2dccff)!important;color:#031721!important}.cosmic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.cosmic-dev-card{display:flex;flex-direction:column;gap:7px;text-align:left;padding:14px;border:1px solid var(--card-border,#2dccff);border-radius:14px;background:linear-gradient(145deg,rgba(45,204,255,.12),rgba(0,0,0,.22));color:inherit;cursor:pointer;min-height:82px}.cosmic-dev-card:hover{transform:translateY(-2px);background:rgba(45,204,255,.16)}.cosmic-dev-card small{opacity:.72;line-height:1.4}.cosmic-dev-card.static{cursor:default}.cosmic-dev-card.static:hover{transform:none}.cosmic-stat{padding:12px;border:1px solid rgba(45,204,255,.2);border-radius:12px;background:rgba(45,204,255,.06)}#cosmic-palette{align-items:start;padding-top:12vh}.cosmic-result{padding:11px;border-radius:10px;cursor:pointer}.cosmic-result:hover{background:rgba(45,204,255,.12)}.cosmic-help{line-height:1.7}.cosmic-offline{opacity:.75}@media(max-width:700px){#cosmic-hub-tools{padding:0 16px 14px}.cosmic-mini{min-width:145px}#cosmic-account{top:8px;right:8px}.cosmic-badge{right:8px;bottom:8px}}
    body[data-cosmic-theme="deep-space"]{--accent:#8db4ff!important;--card-border:rgba(141,180,255,.45)!important;--card-bg:rgba(7,14,28,.8)!important}body[data-cosmic-theme="solar-flare"]{--accent:#ffb35c!important;--card-border:rgba(255,179,92,.45)!important;--card-bg:rgba(30,16,7,.8)!important}body[data-cosmic-theme="synthwave"]{--accent:#ff63e6!important;--card-border:rgba(255,99,230,.45)!important;--card-bg:rgba(24,7,28,.8)!important}body[data-cosmic-theme="nebula"]{--accent:#2dccff!important;--card-border:rgba(45,204,255,.42)!important;--card-bg:rgba(6,20,16,.76)!important}
  `;
  const style = document.createElement('style'); style.id='cosmic-hub-style'; style.textContent=css; document.head.appendChild(style);

  function modal(id, title, body) { let m=document.getElementById(id); if(!m){m=document.createElement('div');m.id=id;m.className='cosmic-modal';m.innerHTML=`<div class="cosmic-panel"><button data-close style="float:right">×</button><h2>${title}</h2><div data-body>${body||''}</div></div>`;document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))m.style.display='none';});} return m; }
  function openModal(id,title,body){const m=modal(id,title,body);if(body!==undefined)m.querySelector('[data-body]').innerHTML=body;m.style.display='grid';return m;}
  function applyTheme() { const p=profile(); document.body.dataset.cosmicTheme=p.theme||'nebula'; document.body.dataset.cosmicMotion=String(p.motion??1); }

  function registerPwa() {
    if ('serviceWorker' in navigator) {
      const sw=base+'sw.js?v=9';
      navigator.serviceWorker.register(sw,{updateViaCache:'none'}).then(reg=>{reg.update().catch(()=>{});updateOffline();}).catch(()=>updateOffline());
    } else updateOffline();
    window.addEventListener('online',updateOffline); window.addEventListener('offline',updateOffline);
  }
  function updateOffline(){let b=document.getElementById('cosmic-network-badge');if(!b){b=document.createElement('div');b.id='cosmic-network-badge';b.className='cosmic-badge';document.body.appendChild(b)}const online=navigator.onLine;const controlled=!!navigator.serviceWorker?.controller;b.textContent=online?'● Online':(controlled?'● Offline • Cached':'● Offline');b.classList.toggle('cosmic-offline',!online);}
  function addAccountButton(){const b=document.createElement('button');b.id='cosmic-account';b.className='cosmic-tool';b.type='button';b.textContent=`👤 ${currentUser()}`;b.onclick=accountModal;document.body.appendChild(b);}
  function accountModal(){const logged=currentUser()!=='Guest';openModal('cosmic-account-modal','Cosmic Account',`<p>${logged?`Signed in as <b>${safe(currentUser())}</b>.`:'You are using Guest mode. Create an account to keep a separate Cosmic profile on this device.'}</p><div class="cosmic-grid"><button id="cosmic-login">${logged?'Switch account':'Log in'}</button><button id="cosmic-create">Create account</button>${logged?'<button id="cosmic-logout">Log out</button>':''}</div>${logged?`<div class="cosmic-stat"><b>Developer access</b><br/>${currentUser()===ADMIN_NAME?'Enabled':'Standard user'}</div>`:''}`);document.getElementById('cosmic-login').onclick=loginForm;document.getElementById('cosmic-create').onclick=createForm;document.getElementById('cosmic-logout')?.addEventListener('click',()=>{localStorage.removeItem(SESSION);location.reload();});}
  async function passwordHash(password,salt){if(!crypto?.subtle)return btoa(password);const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},material,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');}
  function loginForm(){const m=openModal('cosmic-account-modal','Log in',`<label>Username<input id="ca-user" autocomplete="username"></label><label>Password<input id="ca-pass" type="password" autocomplete="current-password"></label><p id="ca-msg"></p><button class="cosmic-primary" id="ca-go">Log in</button>`);m.querySelector('#ca-go').onclick=async()=>{const u=m.querySelector('#ca-user').value.trim(),p=m.querySelector('#ca-pass').value,accounts=load(ACCOUNTS,{}),msg=m.querySelector('#ca-msg');if(!/^[A-Za-z0-9_]{3,24}$/.test(u)){msg.textContent='Use 3–24 letters, numbers, or underscores.';return;}const a=accounts[u.toLowerCase()];if(!a){msg.textContent='Account not found.';return;}const h=await passwordHash(p,a.salt);if(h!==a.hash){msg.textContent='Incorrect password.';return;}localStorage.setItem(SESSION,a.username);location.reload();};}
  async function reserveUsername(username){try{const r=await fetch(apiBase+'/api/usernames/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});const data=await r.json().catch(()=>({}));return {ok:r.ok && data.ok,error:data.error||''};}catch(_){return {ok:false,error:'network'};}}
  function createForm(){const m=openModal('cosmic-account-modal','Create account',`<label>Username<input id="cc-user" autocomplete="username" maxlength="24"></label><label>Password<input id="cc-pass" type="password" autocomplete="new-password"></label><label>Confirm password<input id="cc-pass2" type="password" autocomplete="new-password"></label><p id="cc-msg">Usernames are unique across Cosmic.</p><button class="cosmic-primary" id="cc-go">Create account</button>`);m.querySelector('#cc-go').onclick=async()=>{const u=m.querySelector('#cc-user').value.trim(),p=m.querySelector('#cc-pass').value,p2=m.querySelector('#cc-pass2').value,msg=m.querySelector('#cc-msg'),go=m.querySelector('#cc-go');if(!/^[A-Za-z0-9_]{3,24}$/.test(u)){msg.textContent='Use 3–24 letters, numbers, or underscores.';return;}if(p.length<6){msg.textContent='Password must be at least 6 characters.';return;}if(p!==p2){msg.textContent='Passwords do not match.';return;}const accounts=load(ACCOUNTS,{}),key=u.toLowerCase();if(accounts[key]){msg.textContent='That username is already taken on this device.';return;}go.disabled=true;msg.textContent='Checking username…';const reserved=await reserveUsername(u);if(!reserved.ok){go.disabled=false;msg.textContent=reserved.error==='taken'?'That username is already taken.':'Could not check username availability. Please try again.';return;}const salt=crypto.getRandomValues(new Uint8Array(16));const saltText=Array.from(salt).map(x=>x.toString(16).padStart(2,'0')).join('');accounts[key]={username:u,salt:saltText,hash:await passwordHash(p,saltText),accountToken:reserved.account_token,createdAt:Date.now()};save(ACCOUNTS,accounts);localStorage.setItem(SESSION,u);location.reload();};}
  function decorateCard(card,item,launch){if(card.dataset.cosmicEnhanced)return;card.dataset.cosmicEnhanced='1';card.style.position='relative';const star=document.createElement('button');star.className='cosmic-star';star.type='button';star.title='Pin';star.setAttribute('aria-label','Pin');star.textContent='☆';const more=document.createElement('button');more.className='cosmic-more';more.type='button';more.textContent='Notes & stats';card.append(star,more);const id=itemId(item);const p=profile();const pinned=p.favorites.includes(id);star.textContent=pinned?'★':'☆';star.onclick=e=>{e.stopPropagation();const q=profile(),i=q.favorites.indexOf(id);if(i>=0)q.favorites.splice(i,1);else q.favorites.unshift(id);writeProfile(q);star.textContent=q.favorites.includes(id)?'★':'☆';renderHubSections();};more.onclick=e=>{e.stopPropagation();detailModal(item,launch);};card.addEventListener('click',e=>{if(e.target.closest('button'))return;recordOpen(item);},{capture:true});card.querySelectorAll('button').forEach(btn=>{if(!btn.dataset.cosmicTracked){btn.dataset.cosmicTracked='1';btn.addEventListener('click',()=>{if(btn!==star&&btn!==more)recordOpen(item);},{capture:true});}});}
  function recordOpen(item){const p=profile(),id=itemId(item);p.recent=[id,...p.recent.filter(x=>x!==id)].slice(0,12);p.stats[id]=p.stats[id]||{opens:0,lastScore:'',highScore:''};p.stats[id].opens++;p.stats[id].lastOpened=Date.now();writeProfile(p);const username=currentUser();const account=load(ACCOUNTS,{})[username.toLowerCase()];if(username!=='Guest'&&account?.accountToken&&item.kind==='game'){fetch(apiBase+'/api/accounts/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,account_token:account.accountToken,game_name:item.name})}).catch(()=>{});}setTimeout(renderHubSections,50);}
  function detailModal(item,launch){const p=profile(),id=itemId(item),s=p.stats[id]||{},note=p.notes[id]||'';const m=openModal('cosmic-detail','',`<div class="cosmic-stat"><b>${safe(item.name)}</b><br/><small>${safe(item.kind)} • ${safe(item.category||inferCategory(item))}</small></div><label>Personal note<textarea id="cd-note" rows="3" placeholder="e.g. use for math">${safe(note)}</textarea></label>${item.kind==='game'?`<label>Last score<input id="cd-score" value="${safe(s.lastScore||'')}" inputmode="numeric" placeholder="Optional"></label><label>High score<input id="cd-high" value="${safe(s.highScore||'')}" inputmode="numeric" placeholder="Optional"></label>`:''}<p>Opened ${s.opens||0} time(s).</p><button class="cosmic-primary" id="cd-save">Save</button><button id="cd-launch">Open</button>`);m.querySelector('#cd-save').onclick=()=>{const q=profile();q.notes[id]=m.querySelector('#cd-note').value.slice(0,500);q.stats[id]=q.stats[id]||{};if(item.kind==='game'){q.stats[id].lastScore=m.querySelector('#cd-score').value.slice(0,40);q.stats[id].highScore=m.querySelector('#cd-high').value.slice(0,40);}writeProfile(q);m.style.display='none';};m.querySelector('#cd-launch').onclick=()=>{recordOpen(item);location.href=launch;};}
  function buildItemData(){return [...games.map(x=>normalize({...x,kind:'game'})),...apps.map(x=>normalize({...x,kind:'app'}))];}
  let allItems=[];function itemById(id){return allItems.find(x=>itemId(x)===id);}function renderMini(item){const b=document.createElement('button');b.className='cosmic-mini';b.type='button';b.innerHTML=`<b>${safe(item.name)}</b><small>${safe(item.category)}</small>`;b.onclick=()=>previewDrawer(item);return b;}
  function gameTarget(item){return new URL(base+'pages/lessons/game-shell.html?game='+encodeURIComponent(new URL(item.path+(item.entry||''),location.href).href),location.origin).href;}
  function appTarget(item){const u=new URL(base+'apps/app.html',location.origin);u.searchParams.set('url',item.path+(item.entry||''));u.searchParams.set('name',item.name||'Cosmic App');return u.href;}
  function launchTarget(item){return item.kind==='game'?gameTarget(item):appTarget(item);}
  function renderHubSections(){const host=document.getElementById('cosmic-hub-tools');if(!host)return;const p=profile();host.querySelectorAll('.cosmic-dynamic').forEach(x=>x.remove());const pinned=p.favorites.map(itemById).filter(Boolean),recent=p.recent.map(itemById).filter(Boolean);const add=(title,list)=>{if(!list.length)return;const s=document.createElement('section');s.className='cosmic-section cosmic-dynamic';s.innerHTML=`<h3>${title}</h3>`;const r=document.createElement('div');r.className='cosmic-row';list.forEach(x=>r.appendChild(renderMini(x)));s.appendChild(r);host.appendChild(s);};add('★ Pinned',pinned);add('↻ Recently Played / Opened',recent);}
  function localKey(name){return 'cosmic_'+name+'_'+currentUser().toLowerCase();}
  function saveJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch(_){}}
  function loadJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback;}catch(_){return fallback;}}

  function playMeta(item){
    const s=(item.tags||[]).join(' ').toLowerCase()+' '+(item.description||'').toLowerCase()+' '+(item.name||'').toLowerCase();
    const tags=[];
    if(/touch|mobile/.test(s))tags.push('touch');
    else tags.push('keyboard');
    if(/multiplayer|2 player|2-player|versus|vs\.?|battle karts|baseball bros|basket random/.test(s)||item.category==='Multiplayer')tags.push('multiplayer');
    const mins=/quick|mini|2048|puzzle|sudoku|word|memory/.test(s)?'5 min':/story|adventure|rpg|simulator|racing/.test(s)?'15+ min':'10 min';
    return {time:mins,tags};
  }

  function smartPick(){
    if(!allItems.length)return null;
    const p=profile(), recent=new Set(p.recent||[]), fav=new Set(p.favorites||[]);
    const scored=allItems.map(item=>{
      const id=itemId(item),s=p.stats[id]||{};
      let score=Math.random()*4;
      if(recent.has(id))score-=7;
      if(fav.has(id))score+=5;
      score+=Math.min(Number(s.opens||0),5);
      if(item.kind==='game')score+=2;
      return {item,score};
    }).sort((a,b)=>b.score-a.score);
    return scored[0]?.item||allItems[0];
  }

  function launchItem(item){
    if(!item)return;
    recordOpen(item);
    location.href=launchTarget(item);
  }

  function previewDrawer(item){
    const meta=playMeta(item);
    let d=document.getElementById('cosmic-preview-drawer');
    if(!d){
      d=document.createElement('aside');d.id='cosmic-preview-drawer';
      d.style.cssText='position:fixed;right:0;top:0;bottom:0;width:min(430px,94vw);z-index:2147483003;transform:translateX(102%);transition:transform .22s ease;background:#07131a;color:#f2f7fa;border-left:1px solid var(--card-border,#2dccff);box-shadow:-25px 0 70px rgba(0,0,0,.55);padding:22px;box-sizing:border-box;overflow:auto;';
      document.body.appendChild(d);
    }
    const image=item.image?new URL(item.image,location.href).href:'';
    d.innerHTML='<button id="cp-close" style="float:right">×</button>'+(image?'<img src="'+safe(image)+'" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:14px">':'')+
      '<h2 style="color:var(--accent,#2dccff)">'+safe(item.name)+'</h2>'+
      '<p><b>'+safe(item.category||'Game')+'</b> • '+safe(meta.time)+'</p>'+
      '<p>'+safe((item.tags||[]).join(' • ')||'No tags yet')+'</p>'+
      '<p>Controls: '+safe(meta.tags.join(' • '))+'</p>'+
      '<p>'+safe(item.description||'Ready to launch from Cosmic.')+'</p>'+
      '<button class="cosmic-primary" id="cp-launch">Launch</button><button id="cp-focus">Focus Mode</button>';
    d.querySelector('#cp-close').onclick=()=>d.style.transform='translateX(102%)';
    d.querySelector('#cp-launch').onclick=()=>launchItem(item);
    d.querySelector('#cp-focus').onclick=()=>{d.style.transform='translateX(102%)';focusMode(true);launchItem(item);};
    requestAnimationFrame(()=>d.style.transform='translateX(0)');
  }

  function focusMode(on){
    document.documentElement.classList.toggle('cosmic-focus-mode',on);
    saveJson('cosmicFocusMode',!!on);
    let b=document.getElementById('cosmic-focus-exit');
    if(on&&!b){b=document.createElement('button');b.id='cosmic-focus-exit';b.textContent='Exit Focus';b.style.cssText='position:fixed;top:12px;left:12px;z-index:2147483646;border:1px solid #2dccff;border-radius:999px;padding:8px 12px;background:#07131a;color:#2dccff;cursor:pointer';b.onclick=()=>focusMode(false);document.body.appendChild(b);}
    if(!on)b?.remove();
  }

  function dailyQuest(){
    if(!allItems.length)return;
    const day=Math.floor(Date.now()/86400000);
    const item=allItems[day%allItems.length];
    const p=profile(),id=itemId(item),stat=p.stats[id]||{};
    const goal=Number(stat.opens||0)>0?'Beat your previous best on '+item.name+'.':'Try '+item.name+' today.';
    let host=document.getElementById('cosmic-daily-quest');
    if(!host){host=document.createElement('section');host.id='cosmic-daily-quest';host.className='cosmic-section';const tools=document.getElementById('cosmic-hub-tools');tools?.prepend(host);}
    host.innerHTML='<h3>✦ Cosmic Daily Quest</h3><div class="cosmic-stat"><b>'+safe(item.name)+'</b><br><small>'+safe(goal)+'</small><br><button class="cosmic-primary" id="cosmic-daily-go">Start Quest</button></div>';
    host.querySelector('#cosmic-daily-go').onclick=()=>launchItem(item);
  }

  function smartPickUI(){
    let host=document.getElementById('cosmic-smart-pick');
    if(!host){host=document.createElement('section');host.id='cosmic-smart-pick';host.className='cosmic-section';const tools=document.getElementById('cosmic-hub-tools');tools?.prepend(host);}
    const item=smartPick();if(!item)return;
    host.innerHTML='<h3>✦ Pick for Me</h3><div class="cosmic-stat"><b>'+safe(item.name)+'</b><br><small>'+safe(item.category)+' • '+safe(playMeta(item).time)+'</small><br><button class="cosmic-primary" id="cosmic-pick-go">Play</button> <button id="cosmic-pick-again">Pick Again</button></div>';
    host.querySelector('#cosmic-pick-go').onclick=()=>launchItem(item);
    host.querySelector('#cosmic-pick-again').onclick=smartPickUI;
  }

  function categoryCarousel(){
    const host=document.getElementById('cosmic-category-carousel')||(()=>{const x=document.createElement('section');x.id='cosmic-category-carousel';x.className='cosmic-section';const tools=document.getElementById('cosmic-hub-tools');tools?.appendChild(x);return x;})();
    const cats=['Arcade','Puzzle','Multiplayer','Utility','AI','New'];
    host.innerHTML='<h3>✦ Explore Categories</h3><div class="cosmic-row"></div>';
    const row=host.querySelector('.cosmic-row');
    cats.forEach(cat=>{const items=allItems.filter(x=>x.category===cat).slice(0,8);if(!items.length)return;const b=document.createElement('button');b.className='cosmic-mini';b.innerHTML='<b>'+cat+'</b><small>'+items.length+' picks</small>';b.onclick=()=>{const q=document.querySelector('#gamesearchinput,#search');if(q){q.value=cat;q.dispatchEvent(new Event('input',{bubbles:true}));}};row.appendChild(b);});
  }

  function achievements(){
    const p=profile(),stats=Object.values(p.stats||{}),opens=stats.reduce((n,x)=>n+Number(x.opens||0),0);
    const cats=new Set((p.recent||[]).map(id=>itemById(id)?.category).filter(Boolean));
    const days=loadJson(localKey('streak'),{last:0,count:0}),today=Math.floor(Date.now()/86400000);
    const streak=days.last===today?days.count:days.last===today-1?days.count+1:1;
    saveJson(localKey('streak'),{last:today,count:streak});
    const earned=[opens>=10?'Played 10 games':'',cats.size>=3?'Explored 3 categories':'',streak>=7?'7-day Cosmic streak':''].filter(Boolean);
    let host=document.getElementById('cosmic-achievements');
    if(!host){host=document.createElement('section');host.id='cosmic-achievements';host.className='cosmic-section';const tools=document.getElementById('cosmic-hub-tools');tools?.appendChild(host);}
    host.innerHTML='<h3>✦ Achievements & Milestones</h3><div class="cosmic-stat">'+(earned.length?earned.map(x=>'🏆 '+safe(x)).join('<br>'):'Play more to unlock local milestones.')+'</div>';
  }

  function exportImport(){
    let host=document.getElementById('cosmic-portability');
    if(!host){host=document.createElement('section');host.id='cosmic-portability';host.className='cosmic-section';const tools=document.getElementById('cosmic-hub-tools');tools?.appendChild(host);}
    host.innerHTML='<h3>✦ Favorites & Settings</h3><div class="cosmic-stat"><button id="cosmic-export">Export Backup</button> <button id="cosmic-import">Import Backup</button><input id="cosmic-import-file" type="file" accept="application/json" hidden></div>';
    host.querySelector('#cosmic-export').onclick=()=>{const payload={version:1,user:currentUser(),profile:profile(),settings:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('cosmic-')).map(k=>[k,localStorage.getItem(k)]))};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download='cosmic-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
    host.querySelector('#cosmic-import').onclick=()=>host.querySelector('#cosmic-import-file').click();
    host.querySelector('#cosmic-import-file').onchange=e=>{const f=e.target.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(d.profile)writeProfile(d.profile);if(d.settings&&typeof d.settings==='object')Object.entries(d.settings).forEach(([k,v])=>{if(String(k).startsWith('cosmic-'))localStorage.setItem(k,String(v));});alert('Cosmic backup imported. Reloading…');location.reload();}catch(_){alert('That backup file could not be imported.');}};rd.readAsText(f);};
  }

  function telemetry(){
    let host=document.getElementById('cosmic-telemetry');
    if(!host){host=document.createElement('section');host.id='cosmic-telemetry';host.className='cosmic-section';const tools=document.getElementById('cosmic-hub-tools');tools?.appendChild(host);}
    const nav=performance.getEntriesByType('navigation')[0],sw=navigator.serviceWorker?.controller;
    const lowPower=('getBattery' in navigator)?'Battery API available (browser may expose power state)':'Power state unavailable';
    host.innerHTML='<h3>✦ Local Diagnostics</h3><div class="cosmic-stat"><b>Load:</b> '+Math.round(nav?.loadEventEnd||performance.now())+' ms<br><b>Service worker:</b> '+(sw?'active':'not controlling this page')+'<br><b>Device:</b> '+safe(navigator.hardwareConcurrency||'unknown')+' CPU threads<br><b>Power:</b> '+lowPower+'<br><small>Diagnostics stay in this browser and are not uploaded.</small></div>';
  }

  function mission(){dailyQuest();smartPickUI();categoryCarousel();achievements();exportImport();telemetry();}

  function filters(){const form=isGames?document.getElementById('gamesearchform'):document.querySelector('.toolbar');if(!form)return;let box=document.getElementById('cosmic-filters');if(box)return;box=document.createElement('div');box.id='cosmic-filters';box.className='cosmic-filters';['All','Arcade','Multiplayer','Puzzle','Utility','AI','New'].forEach(c=>{const b=document.createElement('button');b.className='cosmic-filter'+(c==='All'?' active':'');b.textContent=c;b.onclick=()=>{box.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');filterCards(c);};box.appendChild(b);});form.insertAdjacentElement('afterend',box);}
  function filterCards(category){document.querySelectorAll(isGames?'.game-card':'.app-card').forEach(card=>{const name=card.querySelector('.game-title,.app-title')?.textContent||'';const item=allItems.find(x=>x.kind===(isGames?'game':'app')&&x.name.toLowerCase()===name.toLowerCase());card.style.display=!item||category==='All'||item.category===category?'':'none';});}
  function developerExtraCommands(){return window.CosmicDevTools?.isDeveloper?.() ? window.CosmicDevTools.getHubCommands() : [];}
  const isDeveloper = () => currentUser() === ADMIN_NAME;
  async function developerSession(){const password=window.prompt('Developer password:');if(!password)return null;try{const r=await fetch(apiBase+'/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok){alert('Developer authentication failed.');return null;}return d.token;}catch(_){alert('Could not reach the Cosmic developer service.');return null;}}
  async function developerAccounts(){if(!isDeveloper)return;const token=await developerSession();if(!token)return;const m=openModal('cosmic-developer','Cosmic Developer • Accounts','<p>Loading accounts…</p>');try{const r=await fetch(apiBase+'/api/admin/accounts',{headers:{Authorization:'Bearer '+token},cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Request failed');const cards=d.accounts.map(a=>`<button class="cosmic-dev-card" data-user="${safe(a.username)}"><b>👤 ${safe(a.username)}</b><small>${Number(a.total_opens)||0} game/app opens${a.last_opened?' • last active '+new Date(a.last_opened).toLocaleString():''}</small></button>`).join('');m.querySelector('[data-body]').innerHTML=`<div class="cosmic-stat"><b>${d.account_count}</b> account(s) registered globally</div><div class="cosmic-grid cosmic-dev-grid">${cards||'<p>No accounts yet.</p>'}</div>`;m.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>developerAccountDetail(token,b.dataset.user));}catch(e){m.querySelector('[data-body]').innerHTML=`<p>Developer data unavailable: ${safe(e.message||e)}</p>`;}}
  async function developerAccountDetail(token,username){const m=openModal('cosmic-developer-detail','Account • '+safe(username),'<p>Loading activity…</p>');try{const r=await fetch(apiBase+'/api/admin/account?username='+encodeURIComponent(username),{headers:{Authorization:'Bearer '+token},cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Request failed');const games=d.account.games||[];m.querySelector('[data-body]').innerHTML=`<div class="cosmic-stat"><b>👤 ${safe(d.account.username)}</b><br><small>Created ${new Date(d.account.created_at).toLocaleString()}</small></div><h3>Played / opened</h3>${games.length?'<div class="cosmic-grid">'+games.map(g=>`<div class="cosmic-dev-card static"><b>🎮 ${safe(g.game_name)}</b><small>${Number(g.opens)||0} open(s) • ${new Date(g.last_opened).toLocaleString()}</small></div>`).join('')+'</div>':'<p>No recorded game activity yet.</p>'}`;}catch(e){m.querySelector('[data-body]').innerHTML=`<p>Could not load this account: ${safe(e.message||e)}</p>`;}}
  async function developerStatus(){if(!isDeveloper)return;const m=openModal('cosmic-developer-status','Cosmic Developer • System Status','<p>Checking…</p>');try{const r=await fetch(apiBase+'/api/deployment-status?developer=1',{cache:'no-store'});const d=await r.json();m.querySelector('[data-body]').innerHTML=`<div class="cosmic-grid"><div class="cosmic-stat"><b>Worker</b><br>${safe(d.service||'Unknown')}</div><div class="cosmic-stat"><b>Hub</b><br>${safe(d.hub_release||'Unknown')}</div><div class="cosmic-stat"><b>Deployment</b><br><code>${safe(d.source_commit||'Unknown')}</code></div><div class="cosmic-stat"><b>Service Worker cache</b><br>${safe(d.service_worker_cache||'Unknown')}</div></div>`;}catch(e){m.querySelector('[data-body]').innerHTML='<p>Could not read deployment status.</p>';}}
  function developerCommands(){if(!isDeveloper)return [];return [['Developer • Accounts',developerAccounts],['Developer • System status',developerStatus],['Developer • Registry health',healthModal],['Developer • Reload Hub',()=>location.reload()],['Developer • Clear local Hub cache',()=>{try{localStorage.removeItem(STORE);sessionStorage.clear();}catch(_){}location.reload();}]];}
  function commandPalette(){const m=openModal('cosmic-palette','Command Palette',`<input id="cosmic-cmd-input" placeholder="Search commands, games, and apps..." autofocus><div id="cosmic-cmd-results"></div>`),input=m.querySelector('#cosmic-cmd-input'),out=m.querySelector('#cosmic-cmd-results'),commands=[['Open account',accountModal],['Choose theme',themeModal],['Keyboard/gamepad help',helpModal],['Collections',collectionsModal],['Registry health check',healthModal],['Report broken app',feedbackBroken],...developerCommands(),...developerExtraCommands()];function draw(){const q=input.value.toLowerCase();out.innerHTML='';const rows=[...commands.map(x=>({name:x[0],run:x[1]})),...allItems.filter(x=>x.name.toLowerCase().includes(q)).slice(0,12).map(x=>({name:`${x.kind==='game'?'🎮':'🧩'} ${x.name}`,run:()=>{recordOpen(x);location.href=launchTarget(x);}}))];rows.filter(x=>x.name.toLowerCase().includes(q)||!q).slice(0,18).forEach(x=>{const b=document.createElement('div');b.className='cosmic-result';b.textContent=x.name;b.onclick=()=>{m.style.display='none';x.run();};out.appendChild(b);});}input.addEventListener('input',draw);input.addEventListener('keydown',e=>{if(e.key==='Escape')m.style.display='none';if(e.key==='Enter')out.querySelector('.cosmic-result')?.click();});draw();setTimeout(()=>input.focus(),0);}
  function themeModal(){const p=profile();const m=openModal('cosmic-theme','Cosmic Themes',`<label>Theme<select id="ct-theme"><option value="nebula">Nebula</option><option value="deep-space">Deep Space</option><option value="solar-flare">Solar Flare</option><option value="synthwave">Synthwave</option></select></label><label>Animation intensity<select id="ct-motion"><option value="0">Off</option><option value="0.5">Low</option><option value="1">Normal</option></select></label><button class="cosmic-primary" id="ct-save">Apply</button>`);m.querySelector('#ct-theme').value=p.theme||'nebula';m.querySelector('#ct-motion').value=String(p.motion??1);m.querySelector('#ct-save').onclick=()=>{const q=profile();q.theme=m.querySelector('#ct-theme').value;q.motion=Number(m.querySelector('#ct-motion').value);writeProfile(q);applyTheme();m.style.display='none';};}
  function helpModal(){openModal('cosmic-help','Controls & Help',`<div class="cosmic-help"><b>Universal:</b><br><kbd>/</kbd> Focus search • <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> Command Palette • <kbd>?</kbd> Help<br><br><b>Gamepad:</b><br>${navigator.getGamepads?'Gamepad API is supported in this browser. Connect a controller and launch a game to use its native controls.':'Gamepad API is unavailable in this browser.'}<br><br>Game-specific controls are shown when a game exposes them; Cosmic never changes the game's own controls.</div>`);}
  function collectionsModal(){const defs=collections.length?collections:[{name:'5-minute games',category:'Arcade'},{name:'Best keyboard games',tags:['keyboard']},{name:'Chill apps',kind:'app'},{name:'Multiplayer night',category:'Multiplayer'}];const body=defs.map(c=>`<button class="cosmic-tool" data-collection="${safe(c.name)}">${safe(c.name)}</button>`).join('');const m=openModal('cosmic-collections','Cosmic Collections',body);m.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>{const c=defs.find(x=>x.name===b.dataset.collection);const list=allItems.filter(x=>(!c.kind||x.kind===c.kind)&&(!c.category||x.category===c.category)&&(!c.tags||c.tags.some(t=>(x.tags||[]).includes(t))));m.querySelector('[data-body]').innerHTML=`<p>${list.length} item(s)</p><div class="cosmic-grid">${list.slice(0,24).map(x=>`<button class="cosmic-tool">${safe(x.name)}</button>`).join('')}</div>`;m.querySelectorAll('.cosmic-grid button').forEach((q,i)=>q.onclick=()=>{const x=list.slice(0,24)[i];recordOpen(x);location.href=launchTarget(x);});});}
  async function healthModal(){const m=openModal('cosmic-health','Registry Health Check','<p>Checking registered paths…</p><div id="ch-results"></div>'),out=m.querySelector('#ch-results'),results=[];for(const x of allItems){let url='';try{url=x.kind==='game'?new URL(base+x.path.replace(/^.*?pages\/lessons\//,'pages/lessons/')+'index.html',location.origin).href:new URL(x.path+(x.entry||''),location.href).href;}catch(_){results.push([x,'Invalid URL']);continue;}try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});results.push([x,r.ok?`OK ${r.status}`:`Broken ${r.status}`]);}catch(_){results.push([x,x.kind==='app'&&/^https?:\/\//.test(x.path)?'External / browser-restricted':'Request failed']);}}const bad=results.filter(x=>!/^(OK|External)/.test(x[1]));out.innerHTML=`<p><b>${results.length}</b> checked • <b>${bad.length}</b> issue(s)</p>${results.map(([x,s])=>`<div class="cosmic-stat"><b>${safe(x.name)}</b> — ${safe(s)}</div>`).join('')}`;}
  const GAME_SUGGESTION_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSelUdV2ZsRrufoHV16KYsy1WpG6ecc4r5dugcrrTe1V7n6G9g/viewform?usp=publish-editor';
  function suggestGame(){window.open(GAME_SUGGESTION_FORM,'_blank','noopener,noreferrer');}
  const GAME_REPORT_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSfLFwfXdL_Fk8FGAAXPire3yIPX0qIoj3Ua1dAGQsw4pTb98Q/viewform';
  function feedbackBroken(){window.open(GAME_REPORT_FORM,'_blank','noopener,noreferrer');}
  function feedbackForm(title,placeholder,type){const m=openModal('cosmic-feedback',title,`<textarea id="cf-text" rows="6" placeholder="${placeholder}"></textarea><button class="cosmic-primary" id="cf-open">Open GitHub form</button>`);m.querySelector('#cf-open').onclick=()=>{const body=encodeURIComponent(`${m.querySelector('#cf-text').value}\n\nCosmic ${type} report from ${currentUser()}`),url=`https://github.com/Ultimate-Guy/cosmic/issues/new?title=${encodeURIComponent(type==='broken'?'Broken app/game report':'App/game suggestion')}&body=${body}`;window.open(url,'_blank','noopener');};}
  function addTools(){const main=document.querySelector('main');if(!main||document.getElementById('cosmic-hub-tools'))return;const host=document.createElement('div');host.id='cosmic-hub-tools';const tools=document.createElement('div');tools.className='cosmic-filters';tools.innerHTML='<button class="cosmic-tool" id="cosmic-cmd">⌘ Command</button><button class="cosmic-tool" id="cosmic-theme-btn">Themes</button><button class="cosmic-tool" id="cosmic-help-btn">?</button><button class="cosmic-tool" id="cosmic-collections-btn">Collections</button><button class="cosmic-tool" id="cosmic-suggest">💡 Suggest a Game</button><button class="cosmic-tool" id="cosmic-report">⚠️ Report broken</button>';host.appendChild(tools);main.insertBefore(host,main.firstChild);document.getElementById('cosmic-cmd').onclick=commandPalette;document.getElementById('cosmic-theme-btn').onclick=themeModal;document.getElementById('cosmic-help-btn').onclick=helpModal;document.getElementById('cosmic-collections-btn').onclick=collectionsModal;document.getElementById('cosmic-suggest').onclick=suggestGame;document.getElementById('cosmic-report').onclick=feedbackBroken;}
  function wireExistingCards(){const list=isGames?games.map(x=>normalize({...x,kind:'game'})):apps.map(x=>normalize({...x,kind:'app'}));const cards=document.querySelectorAll(isGames?'.game-card':'.app-card');cards.forEach(card=>{const name=card.querySelector('.game-title,.app-title')?.textContent?.trim();const item=list.find(x=>x.name===name)||list.find(x=>x.name.toLowerCase()===String(name).toLowerCase());if(item)decorateCard(card,item,launchTarget(item));});}
  function installShortcuts(){document.addEventListener('keydown',e=>{const tag=(e.target?.tagName||'').toLowerCase();if(e.key==='Escape'){document.querySelectorAll('.cosmic-modal').forEach(x=>x.style.display='none');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();commandPalette();return;}if(e.key==='/'&&!['input','textarea'].includes(tag)){e.preventDefault();const s=document.querySelector('#gamesearchinput,#search');if(s){s.focus();s.select();}else commandPalette();}if(e.key==='?'&&!['input','textarea'].includes(tag)){e.preventDefault();helpModal();}});}
  async function boot(){
    if (bootStarted) return;
    isApps = isApps || !!document.getElementById('appsgrid');
    isGames = isGames || !!document.getElementById('gamesgrid');
    if(!isGames&&!isApps){
      if (!bootRetry) bootRetry=setTimeout(()=>{bootRetry=null;boot();},800);
      return;
    }
    bootStarted=true;
    applyTheme();registerPwa();addAccountButton();addTools();filters();installShortcuts();const data=await Promise.all([getJson(base+'pages/lessons/games.json',[]),getJson(base+'apps/apps.json',[]),getJson(base+'collections.json',[])]);games=Array.isArray(data[0])?data[0]:[];apps=Array.isArray(data[1])?data[1]:[];collections=Array.isArray(data[2])?data[2]:[];allItems=buildItemData();mission();renderHubSections();const observer=new MutationObserver(()=>wireExistingCards());observer.observe(document.body,{childList:true,subtree:true});enhanceCards();wireExistingCards();enhanceCards();const search=document.querySelector('#gamesearchinput,#search');search?.addEventListener('input',()=>setTimeout(()=>wireExistingCards(),0));window.addEventListener('message',e=>{if(e.data?.type!=='cosmic-score')return;const name=e.data.name||document.title,id=`game:${name}`,p=profile();p.stats[id]=p.stats[id]||{};p.stats[id].lastScore=String(e.data.score??'').slice(0,40);const n=Number(e.data.score);if(Number.isFinite(n)&&(!Number.isFinite(Number(p.stats[id].highScore))||n>Number(p.stats[id].highScore)))p.stats[id].highScore=String(n);writeProfile(p);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
