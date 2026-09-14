(() => {
  'use strict';
  if (window.__COSMIC_HUB_V1__) return;
  window.__COSMIC_HUB_V1__ = true;

  const STORE = 'cosmicHubV1';
  const ACCOUNTS = 'cosmicAccountsV1';
  const SESSION = 'cosmicCurrentUserV1';
  const ADMIN_NAME = 'TheDevilAngel';
  const root = document.documentElement;
  const path = location.pathname || '';
  const isApps = /\/apps\/apps\.html$/i.test(path);
  const isGames = /\/pages\/lessons\/lessons\.html$/i.test(path);
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
    #cosmic-hub-tools{max-width:1400px;margin:0 auto;padding:0 40px 18px}
    .cosmic-section{margin:18px 0}.cosmic-section h3{margin:0 0 10px;color:var(--accent,#2dccff);font-size:1rem;letter-spacing:1px}.cosmic-row{display:flex;gap:10px;overflow:auto;padding:4px 2px 10px;scrollbar-width:thin}.cosmic-mini{min-width:170px;max-width:210px;padding:12px;border:1px solid var(--card-border,#2dccff);border-radius:14px;background:rgba(6,20,16,.7);color:inherit;cursor:pointer;text-align:left}.cosmic-mini:hover{transform:translateY(-2px);background:rgba(45,204,255,.12)}.cosmic-mini b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cosmic-mini small{opacity:.7}.cosmic-star{position:absolute;right:8px;top:8px;width:32px;height:32px;border:1px solid var(--card-border,#2dccff);border-radius:50%;background:rgba(0,0,0,.55);color:var(--accent,#2dccff);cursor:pointer;font-size:17px;z-index:3}.game-card,.app-card{position:relative}.cosmic-more{margin-top:8px;width:100%;height:30px;border-radius:9px;border:1px solid var(--card-border,#2dccff);background:transparent;color:var(--accent,#2dccff);cursor:pointer}.cosmic-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.cosmic-filter,.cosmic-tool{border:1px solid var(--card-border,#2dccff);border-radius:999px;padding:7px 12px;background:rgba(0,0,0,.22);color:var(--accent,#2dccff);cursor:pointer}.cosmic-filter.active{background:var(--accent,#2dccff);color:#031721}.cosmic-badge{position:fixed;right:14px;bottom:14px;z-index:2147483000;padding:7px 11px;border:1px solid var(--card-border,#2dccff);border-radius:999px;background:rgba(5,12,18,.92);color:var(--accent,#2dccff);font:700 12px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)}#cosmic-account{position:fixed;right:14px;top:14px;z-index:2147483001}.cosmic-modal{position:fixed;inset:0;z-index:2147483002;display:none;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.cosmic-panel{width:min(760px,95vw);max-height:88vh;overflow:auto;padding:24px;border:1px solid var(--card-border,#2dccff);border-radius:20px;background:#07131a;color:#f2f7fa;box-shadow:0 25px 80px rgba(0,0,0,.65)}.cosmic-panel h2{margin-top:0;color:var(--accent,#2dccff)}.cosmic-panel input,.cosmic-panel textarea,.cosmic-panel select{width:100%;box-sizing:border-box;margin:6px 0 12px;padding:10px;border-radius:9px;border:1px solid var(--card-border,#2dccff);background:#02070b;color:#fff}.cosmic-panel button{border:1px solid var(--card-border,#2dccff);border-radius:9px;padding:9px 13px;background:rgba(45,204,255,.1);color:var(--accent,#2dccff);cursor:pointer;margin:3px}.cosmic-primary{background:var(--accent,#2dccff)!important;color:#031721!important}.cosmic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.cosmic-stat{padding:12px;border:1px solid rgba(45,204,255,.2);border-radius:12px;background:rgba(45,204,255,.06)}#cosmic-palette{align-items:start;padding-top:12vh}.cosmic-result{padding:11px;border-radius:10px;cursor:pointer}.cosmic-result:hover{background:rgba(45,204,255,.12)}.cosmic-help{line-height:1.7}.cosmic-offline{opacity:.75}@media(max-width:700px){#cosmic-hub-tools{padding:0 16px 14px}.cosmic-mini{min-width:145px}#cosmic-account{top:8px;right:8px}.cosmic-badge{right:8px;bottom:8px}}
    body[data-cosmic-theme="deep-space"]{--accent:#8db4ff!important;--card-border:rgba(141,180,255,.45)!important;--card-bg:rgba(7,14,28,.8)!important}body[data-cosmic-theme="solar-flare"]{--accent:#ffb35c!important;--card-border:rgba(255,179,92,.45)!important;--card-bg:rgba(30,16,7,.8)!important}body[data-cosmic-theme="synthwave"]{--accent:#ff63e6!important;--card-border:rgba(255,99,230,.45)!important;--card-bg:rgba(24,7,28,.8)!important}body[data-cosmic-theme="nebula"]{--accent:#2dccff!important;--card-border:rgba(45,204,255,.42)!important;--card-bg:rgba(6,20,16,.76)!important}
  `;
  const style = document.createElement('style'); style.id='cosmic-hub-style'; style.textContent=css; document.head.appendChild(style);

  function modal(id, title, body) { let m=document.getElementById(id); if(!m){m=document.createElement('div');m.id=id;m.className='cosmic-modal';m.innerHTML=`<div class="cosmic-panel"><button data-close style="float:right">×</button><h2>${title}</h2><div data-body>${body||''}</div></div>`;document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))m.style.display='none';});} return m; }
  function openModal(id,title,body){const m=modal(id,title,body);if(body!==undefined)m.querySelector('[data-body]').innerHTML=body;m.style.display='grid';return m;}

  function applyTheme() { const p=profile(); document.body.dataset.cosmicTheme=p.theme||'nebula'; document.body.dataset.cosmicMotion=String(p.motion??1); }

  function registerPwa() {
    if ('serviceWorker' in navigator) {
      const sw=base+'sw.js?v=7';
      navigator.serviceWorker.register(sw).then(()=>updateOffline()).catch(()=>updateOffline());
    } else updateOffline();
    window.addEventListener('online',updateOffline); window.addEventListener('offline',updateOffline);
  }
  function updateOffline(){
    let b=document.getElementById('cosmic-network-badge'); if(!b){b=document.createElement('div');b.id='cosmic-network-badge';b.className='cosmic-badge';document.body.appendChild(b)}
    const online=navigator.onLine; const controlled=!!navigator.serviceWorker?.controller; b.textContent=online?'● Online':(controlled?'● Offline • Cached':'● Offline'); b.classList.toggle('cosmic-offline',!online);
  }

  function addAccountButton(){
    const b=document.createElement('button'); b.id='cosmic-account'; b.className='cosmic-tool'; b.type='button'; b.textContent=`👤 ${currentUser()}`; b.onclick=accountModal; document.body.appendChild(b);
  }
  function accountModal(){
    const logged=currentUser()!=='Guest';
    openModal('cosmic-account-modal','Cosmic Account',`<p>${logged?`Signed in as <b>${safe(currentUser())}</b>.`:'You are using Guest mode. Create an account to keep a separate Cosmic profile on this device.'}</p><div class="cosmic-grid"><button id="cosmic-login">${logged?'Switch account':'Log in'}</button><button id="cosmic-create">Create account</button>${logged?'<button id="cosmic-logout">Log out</button>':''}</div>${logged?`<div class="cosmic-stat"><b>Developer access</b><br/>${currentUser()===ADMIN_NAME?'Enabled':'Standard user'}</div>`:''}`);
    document.getElementById('cosmic-login').onclick=loginForm; document.getElementById('cosmic-create').onclick=createForm; document.getElementById('cosmic-logout')?.addEventListener('click',()=>{localStorage.removeItem(SESSION);location.reload();});
  }
  async function passwordHash(password,salt){
    if(!crypto?.subtle)return btoa(password);
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},material,256);
    return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function loginForm(){
    const m=openModal('cosmic-account-modal','Log in',`<label>Username<input id="ca-user" autocomplete="username"></label><label>Password<input id="ca-pass" type="password" autocomplete="current-password"></label><p id="ca-msg"></p><button class="cosmic-primary" id="ca-go">Log in</button>`);
    m.querySelector('#ca-go').onclick=async()=>{const u=m.querySelector('#ca-user').value.trim(),p=m.querySelector('#ca-pass').value,accounts=load(ACCOUNTS,{}),msg=m.querySelector('#ca-msg');if(!/^[A-Za-z0-9_]{3,24}$/.test(u)){msg.textContent='Use 3–24 letters, numbers, or underscores.';return;}const a=accounts[u.toLowerCase()];if(!a){msg.textContent='Account not found.';return;}const h=await passwordHash(p,a.salt);if(h!==a.hash){msg.textContent='Incorrect password.';return;}localStorage.setItem(SESSION,a.username);location.reload();};
  }
  function createForm(){
    const m=openModal('cosmic-account-modal','Create account',`<label>Username<input id="cc-user" autocomplete="username" maxlength="24"></label><label>Password<input id="cc-pass" type="password" autocomplete="new-password"></label><label>Confirm password<input id="cc-pass2" type="password" autocomplete="new-password"></label><p id="cc-msg">Accounts are stored locally on this device.</p><button class="cosmic-primary" id="cc-go">Create account</button>`);
    m.querySelector('#cc-go').onclick=async()=>{const u=m.querySelector('#cc-user').value.trim(),p=m.querySelector('#cc-pass').value,p2=m.querySelector('#cc-pass2').value,msg=m.querySelector('#cc-msg');if(!/^[A-Za-z0-9_]{3,24}$/.test(u)){msg.textContent='Use 3–24 letters, numbers, or underscores.';return;}if(p.length<6){msg.textContent='Password must be at least 6 characters.';return;}if(p!==p2){msg.textContent='Passwords do not match.';return;}const accounts=load(ACCOUNTS,{}),key=u.toLowerCase();if(accounts[key]){msg.textContent='That username is already taken on this device.';return;}const salt=crypto.getRandomValues(new Uint8Array(16));const saltText=Array.from(salt).map(x=>x.toString(16).padStart(2,'0')).join('');accounts[key]={username:u,salt:saltText,hash:await passwordHash(p,saltText),createdAt:Date.now()};save(ACCOUNTS,accounts);localStorage.setItem(SESSION,u);location.reload();};
  }

  function decorateCard(card,item,launch){
    if(card.dataset.cosmicEnhanced)return; card.dataset.cosmicEnhanced='1';
    card.style.position='relative';
    const star=document.createElement('button');star.className='cosmic-star';star.type='button';star.title='Pin';star.setAttribute('aria-label','Pin');star.textContent='☆';
    const more=document.createElement('button');more.className='cosmic-more';more.type='button';more.textContent='Notes & stats';
    card.append(star,more);
    const id=itemId(item); const p=profile(); const pinned=p.favorites.includes(id); star.textContent=pinned?'★':'☆';
    star.onclick=e=>{e.stopPropagation();const q=profile(),i=q.favorites.indexOf(id);if(i>=0)q.favorites.splice(i,1);else q.favorites.unshift(id);writeProfile(q);star.textContent=q.favorites.includes(id)?'★':'☆';renderHubSections();};
    more.onclick=e=>{e.stopPropagation();detailModal(item,launch);};
    card.addEventListener('click',e=>{if(e.target.closest('button'))return;recordOpen(item);},{capture:true});
    card.querySelectorAll('button').forEach(btn=>{if(!btn.dataset.cosmicTracked){btn.dataset.cosmicTracked='1';btn.addEventListener('click',()=>{if(btn!==star&&btn!==more)recordOpen(item);},{capture:true});}});
  }
  function recordOpen(item){const p=profile(),id=itemId(item);p.recent=[id,...p.recent.filter(x=>x!==id)].slice(0,12);p.stats[id]=p.stats[id]||{opens:0,lastScore:'',highScore:''};p.stats[id].opens++;p.stats[id].lastOpened=Date.now();writeProfile(p);setTimeout(renderHubSections,50);}
  function detailModal(item,launch){const p=profile(),id=itemId(item),s=p.stats[id]||{};const note=p.notes[id]||'';const m=openModal('cosmic-detail','',`<div class="cosmic-stat"><b>${safe(item.name)}</b><br/><small>${safe(item.kind)} • ${safe(item.category||inferCategory(item))}</small></div><label>Personal note<textarea id="cd-note" rows="3" placeholder="e.g. use for math">${safe(note)}</textarea></label>${item.kind==='game'?`<label>Last score<input id="cd-score" value="${safe(s.lastScore||'')}" inputmode="numeric" placeholder="Optional"></label><label>High score<input id="cd-high" value="${safe(s.highScore||'')}" inputmode="numeric" placeholder="Optional"></label>`:''}<p>Opened ${s.opens||0} time(s).</p><button class="cosmic-primary" id="cd-save">Save</button><button id="cd-launch">Open</button>`);m.querySelector('#cd-save').onclick=()=>{const q=profile();q.notes[id]=m.querySelector('#cd-note').value.slice(0,500);q.stats[id]=q.stats[id]||{};if(item.kind==='game'){q.stats[id].lastScore=m.querySelector('#cd-score').value.slice(0,40);q.stats[id].highScore=m.querySelector('#cd-high').value.slice(0,40);}writeProfile(q);m.style.display='none';};m.querySelector('#cd-launch').onclick=()=>{recordOpen(item);location.href=launch;};}

  function buildItemData(){
    const gameItems=games.map(x=>normalize({...x,kind:'game'}));
    const appItems=apps.map(x=>normalize({...x,kind:'app'}));
    return [...gameItems,...appItems];
  }
  let allItems=[];
  function itemById(id){return allItems.find(x=>itemId(x)===id);}
  function renderMini(item){
    const b=document.createElement('button');b.className='cosmic-mini';b.type='button';b.innerHTML=`<b>${safe(item.name)}</b><small>${safe(item.category)}</small>`;b.onclick=()=>{recordOpen(item);if(item.kind==='game'){const target=gameTarget(item);location.href=target;}else location.href=appTarget(item);};return b;
  }
  function gameTarget(item){const target=new URL(base+'pages/lessons/game-shell.html',location.origin);const raw=new URL('../'.repeat(0)+'pages/lessons/'+(item.path||'').split('/').slice(-2,-1)[0]+'/',location.origin);return raw.href;}
  function appTarget(item){const u=new URL(base+'apps/app.html',location.origin);u.searchParams.set('url',item.path+(item.entry||''));u.searchParams.set('name',item.name||'Cosmic App');return u.href;}
  function launchTarget(item){return item.kind==='game'?gameTarget(item):appTarget(item);}
  function renderHubSections(){
    const host=document.getElementById('cosmic-hub-tools'); if(!host)return; const p=profile();host.querySelectorAll('.cosmic-dynamic').forEach(x=>x.remove());
    const pinned=p.favorites.map(itemById).filter(Boolean);const recent=p.recent.map(itemById).filter(Boolean);
    const add=(title,list)=>{if(!list.length)return;const s=document.createElement('section');s.className='cosmic-section cosmic-dynamic';s.innerHTML=`<h3>${title}</h3>`;const r=document.createElement('div');r.className='cosmic-row';list.forEach(x=>r.appendChild(renderMini(x)));s.appendChild(r);host.appendChild(s);};
    add('★ Pinned',pinned);add('↻ Recently Played / Opened',recent);
  }
  function mission(){
    if(!allItems.length)return;const day=Math.floor(Date.now()/86400000),item=allItems[day%allItems.length];let host=document.getElementById('cosmic-mission');if(!host){host=document.createElement('section');host.id='cosmic-mission';host.className='cosmic-section';host.innerHTML='<h3>✦ Mission of the Day</h3><div class="cosmic-stat"></div>';const tools=document.getElementById('cosmic-hub-tools');tools?.prepend(host);}const reason={Arcade:'a quick burst of action',Multiplayer:'a good pick for a multiplayer session',Puzzle:'a brain-teasing change of pace',Utility:'a useful tool worth trying',AI:'something smart and different',New:'something fresh in the library'}[item.category]||'something worth discovering';host.querySelector('.cosmic-stat').innerHTML=`<b>${safe(item.name)}</b><br><small>Try it today because it is ${reason}.</small><br><button class="cosmic-primary" id="cosmic-mission-go">Launch</button>`;host.querySelector('#cosmic-mission-go').onclick=()=>{recordOpen(item);location.href=launchTarget(item);};}
  function filters(){
    const form=isGames?document.getElementById('gamesearchform'):document.querySelector('.toolbar'); if(!form)return;let box=document.getElementById('cosmic-filters');if(box)return;box=document.createElement('div');box.id='cosmic-filters';box.className='cosmic-filters';['All','Arcade','Multiplayer','Puzzle','Utility','AI','New'].forEach(c=>{const b=document.createElement('button');b.className='cosmic-filter'+(c==='All'?' active':'');b.textContent=c;b.onclick=()=>{box.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');filterCards(c);};box.appendChild(b);});form.insertAdjacentElement('afterend',box);
  }
  function filterCards(category){document.querySelectorAll(isGames?'.game-card':'.app-card').forEach(card=>{const name=card.querySelector('.game-title,.app-title')?.textContent||'';const item=allItems.find(x=>x.kind===(isGames?'game':'app')&&x.name.toLowerCase()===name.toLowerCase());card.style.display=!item||category==='All'||item.category===category?'':'none';});}
  function commandPalette(){
    const m=openModal('cosmic-palette','Command Palette',`<input id="cosmic-cmd-input" placeholder="Search commands, games, and apps..." autofocus><div id="cosmic-cmd-results"></div>`);const input=m.querySelector('#cosmic-cmd-input'),out=m.querySelector('#cosmic-cmd-results');const commands=[['Open account',accountModal],['Choose theme',themeModal],['Keyboard/gamepad help',helpModal],['Collections',collectionsModal],['Registry health check',healthModal],['Report broken app',feedbackBroken]];function draw(){const q=input.value.toLowerCase();out.innerHTML='';const rows=[...commands.map(x=>({name:x[0],run:x[1]})),...allItems.filter(x=>x.name.toLowerCase().includes(q)).slice(0,12).map(x=>({name:`${x.kind==='game'?'🎮':'🧩'} ${x.name}`,run:()=>{recordOpen(x);location.href=launchTarget(x);}}))];rows.filter(x=>x.name.toLowerCase().includes(q)||!q).slice(0,18).forEach(x=>{const b=document.createElement('div');b.className='cosmic-result';b.textContent=x.name;b.onclick=()=>{m.style.display='none';x.run();};out.appendChild(b);});}input.addEventListener('input',draw);input.addEventListener('keydown',e=>{if(e.key==='Escape')m.style.display='none';if(e.key==='Enter'){out.querySelector('.cosmic-result')?.click();}});draw();setTimeout(()=>input.focus(),0);
  }
  function themeModal(){const p=profile();const m=openModal('cosmic-theme','Cosmic Themes',`<label>Theme<select id="ct-theme"><option value="nebula">Nebula</option><option value="deep-space">Deep Space</option><option value="solar-flare">Solar Flare</option><option value="synthwave">Synthwave</option></select></label><label>Animation intensity<select id="ct-motion"><option value="0">Off</option><option value="0.5">Low</option><option value="1">Normal</option></select></label><button class="cosmic-primary" id="ct-save">Apply</button>`);m.querySelector('#ct-theme').value=p.theme||'nebula';m.querySelector('#ct-motion').value=String(p.motion??1);m.querySelector('#ct-save').onclick=()=>{const q=profile();q.theme=m.querySelector('#ct-theme').value;q.motion=Number(m.querySelector('#ct-motion').value);writeProfile(q);applyTheme();m.style.display='none';};}
  function helpModal(){openModal('cosmic-help','Controls & Help',`<div class="cosmic-help"><b>Universal:</b><br><kbd>/</kbd> Focus search • <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> Command Palette • <kbd>?</kbd> Help<br><br><b>Gamepad:</b><br>${navigator.getGamepads?'Gamepad API is supported in this browser. Connect a controller and launch a game to use its native controls.':'Gamepad API is unavailable in this browser.'}<br><br>Game-specific controls are shown when a game exposes them; Cosmic never changes the game's own controls.</div>`);}
  function collectionsModal(){const defs=collections.length?collections:[{name:'5-minute games',category:'Arcade'},{name:'Best keyboard games',tags:['keyboard']},{name:'Chill apps',kind:'app'},{name:'Multiplayer night',category:'Multiplayer'}];const body=defs.map(c=>`<button class="cosmic-tool" data-collection="${safe(c.name)}">${safe(c.name)}</button>`).join('');const m=openModal('cosmic-collections','Cosmic Collections',body);m.querySelectorAll('[data-collection]').forEach(b=>b.onclick=()=>{const c=defs.find(x=>x.name===b.dataset.collection);const list=allItems.filter(x=>(!c.kind||x.kind===c.kind)&&(!c.category||x.category===c.category)&&(!c.tags||c.tags.some(t=>(x.tags||[]).includes(t))));m.querySelector('[data-body]').innerHTML=`<p>${list.length} item(s)</p><div class="cosmic-grid">${list.slice(0,24).map(x=>`<button class="cosmic-tool">${safe(x.name)}</button>`).join('')}</div>`;m.querySelectorAll('.cosmic-grid button').forEach((q,i)=>q.onclick=()=>{const x=list.slice(0,24)[i];recordOpen(x);location.href=launchTarget(x);});});}
  async function healthModal(){const m=openModal('cosmic-health','Registry Health Check','<p>Checking registered paths…</p><div id="ch-results"></div>');const out=m.querySelector('#ch-results');const results=[];for(const x of allItems){let url='';try{url=x.kind==='game'?new URL(base+x.path.replace(/^.*?pages\/lessons\//,'pages/lessons/')+'index.html',location.origin).href:new URL(x.path+(x.entry||''),location.href).href;}catch(_){results.push([x,'Invalid URL']);continue;}try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});results.push([x,r.ok?`OK ${r.status}`:`Broken ${r.status}`]);}catch(_){results.push([x,x.kind==='app'&&/^https?:\/\//.test(x.path)?'External / browser-restricted':'Request failed']);}}
    const bad=results.filter(x=>!/^(OK|External)/.test(x[1]));out.innerHTML=`<p><b>${results.length}</b> checked • <b>${bad.length}</b> issue(s)</p>${results.map(([x,s])=>`<div class="cosmic-stat"><b>${safe(x.name)}</b> — ${safe(s)}</div>`).join('')}`;
  }
  function feedbackBroken(){feedbackForm('Report a broken app/game','Tell us what is broken and what you expected.','broken');}
  function feedbackForm(title,placeholder,type){const m=openModal('cosmic-feedback',title,`<textarea id="cf-text" rows="6" placeholder="${placeholder}"></textarea><button class="cosmic-primary" id="cf-open">Open GitHub form</button>`);m.querySelector('#cf-open').onclick=()=>{const body=encodeURIComponent(`${m.querySelector('#cf-text').value}\n\nCosmic ${type} report from ${currentUser()}`);const url=`https://github.com/Ultimate-Guy/cosmic/issues/new?title=${encodeURIComponent(type==='broken'?'Broken app/game report':'App/game suggestion')}&body=${body}`;window.open(url,'_blank','noopener');};}

  function addTools(){
    const main=document.querySelector('main');if(!main||document.getElementById('cosmic-hub-tools'))return;const host=document.createElement('div');host.id='cosmic-hub-tools';const tools=document.createElement('div');tools.className='cosmic-filters';tools.innerHTML='<button class="cosmic-tool" id="cosmic-cmd">⌘ Command</button><button class="cosmic-tool" id="cosmic-theme-btn">Themes</button><button class="cosmic-tool" id="cosmic-help-btn">?</button><button class="cosmic-tool" id="cosmic-collections-btn">Collections</button><button class="cosmic-tool" id="cosmic-report">Report broken</button>';host.appendChild(tools);main.insertBefore(host,main.firstChild);document.getElementById('cosmic-cmd').onclick=commandPalette;document.getElementById('cosmic-theme-btn').onclick=themeModal;document.getElementById('cosmic-help-btn').onclick=helpModal;document.getElementById('cosmic-collections-btn').onclick=collectionsModal;document.getElementById('cosmic-report').onclick=feedbackBroken;
  }
  function wireExistingCards(){
    const list=isGames?games.map(x=>normalize({...x,kind:'game'})):apps.map(x=>normalize({...x,kind:'app'}));const cards=document.querySelectorAll(isGames?'.game-card':'.app-card');cards.forEach(card=>{const name=card.querySelector('.game-title,.app-title')?.textContent?.trim();const item=list.find(x=>x.name===name)||list.find(x=>x.name.toLowerCase()===String(name).toLowerCase());if(item)decorateCard(card,item,launchTarget(item));});
  }
  function installShortcuts(){document.addEventListener('keydown',e=>{const tag=(e.target?.tagName||'').toLowerCase();if(e.key==='Escape'){document.querySelectorAll('.cosmic-modal').forEach(x=>x.style.display='none');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();commandPalette();return;}if(e.key==='/'&&!['input','textarea'].includes(tag)){e.preventDefault();const s=document.querySelector('#gamesearchinput,#search');if(s){s.focus();s.select();}else commandPalette();}if(e.key==='?'&&!['input','textarea'].includes(tag)){e.preventDefault();helpModal();}});}

  async function boot(){
    if(!isGames&&!isApps)return;applyTheme();registerPwa();addAccountButton();addTools();filters();installShortcuts();
    const data=await Promise.all([getJson(base+'pages/lessons/games.json',[]),getJson(base+'apps/apps.json',[]),getJson(base+'collections.json',[])]);games=Array.isArray(data[0])?data[0]:[];apps=Array.isArray(data[1])?data[1]:[];collections=Array.isArray(data[2])?data[2]:[];allItems=buildItemData();
    mission();renderHubSections();
    const observer=new MutationObserver(()=>wireExistingCards());observer.observe(document.body,{childList:true,subtree:true});wireExistingCards();
    const search=document.querySelector('#gamesearchinput,#search');search?.addEventListener('input',()=>setTimeout(()=>wireExistingCards(),0));
    window.addEventListener('message',e=>{if(e.data?.type!=='cosmic-score')return;const name=e.data.name||document.title;const id=`game:${name}`;const p=profile();p.stats[id]=p.stats[id]||{};p.stats[id].lastScore=String(e.data.score??'').slice(0,40);const n=Number(e.data.score);if(Number.isFinite(n)&&(!Number.isFinite(Number(p.stats[id].highScore))||n>Number(p.stats[id].highScore)))p.stats[id].highScore=String(n);writeProfile(p);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
