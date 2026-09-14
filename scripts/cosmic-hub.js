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
    .cosmic-section{margin:18px 0}.cosmic-section h3{margin:0 0 10px;color:var(--accent,#2dccff);font-size:1rem;letter-spacing:1px}.cosmic-row{display:flex;gap:10px;overflow:auto;padding:4px 2px 10px;scrollbar-width:thin}.cosmic-mini{min-width:170px;max-width:210px;padding:12px;border:1px solid var(--card-border,#2dccff);border-radius:14px;background:rgba(6,20,16,.7);color:inherit;cursor:pointer;text-align:left}.cosmic-mini:hover{transform:translateY(-2px);background:rgba(45,204,255,.12)}.cosmic-mini b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cosmic-star{position:absolute;right:8px;top:8px;width:32px;height:32px;border:1px solid var(--card-border,#2dccff);border-radius:50%;background:rgba(0,0,0,.55);color:var(--accent,#2dccff);cursor:pointer;font-size:17px;z-index:3}.game-card,.app-card{position:relative}.cosmic-more{margin-top:8px;width:100%;height:30px;border-radius:9px;border:1px solid var(--card-border,#2dccff);background:transparent;color:var(--accent,#2dccff);cursor:pointer}.cosmic-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.cosmic-filter,.cosmic-tool{border:1px solid var(--card-border,#2dccff);border-radius:999px;padding:7px 12px;background:rgba(0,0,0,.22);color:var(--accent,#2dccff);cursor:pointer}.cosmic-filter.active{background:var(--accent,#2dccff);color:#031721}.cosmic-badge{position:fixed;right:14px;bottom:14px;z-index:2147483000;padding:7px 11px;border:1px solid var(--card-border,#2dccff);border-radius:999px;background:rgba(5,12,18,.92);color:var(--accent,#2dccff);font:700 12px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)}#cosmic-account{position:fixed;right:14px;top:14px;z-index:2147483001}.cosmic-modal{position:fixed;inset:0;z-index:2147483002;display:none;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)}.cosmic-panel{width:min(760px,95vw);max-height:88vh;overflow:auto;padding:24px;border:1px solid var(--card-border,#2dccff);border-radius:20px;background:#07131a;color:#f2f7fa;box-shadow:0 25px 80px rgba(0,0,0,.65)}.cosmic-panel h2{margin-top:0;color:var(--accent,#2dccff)}.cosmic-panel input,.cosmic-panel textarea,.cosmic-panel select{width:100%;box-sizing:border-box;margin:6px 0 12px;padding:10px;border-radius:9px;border:1px solid var(--card-border,#2dccff);background:#02070b;color:#fff}.cosmic-panel button{border:1px solid var(--card-border,#2dccff);border-radius:9px;padding:9px 13px;background:rgba(45,204,255,.1);color:var(--accent,#2dccff);cursor:pointer;margin:3px}.cosmic-primary{background:var(--accent,#2dccff)!important;color:#031721!important}.cosmic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.cosmic-stat{padding:12px;border:1px solid rgba(45,204,255,.2);border-radius:12px;background:rgba(45,204,255,.06)}#cosmic-palette{align-items:start;padding-top:12vh}.cosmic-result{padding:11px;border-radius:10px;cursor:pointer}.cosmic-result:hover{background:rgba(45,204,255,.12)}.cosmic-help{line-height:1.7}.cosmic-offline{opacity:.75}@media(max-width:700px){#cosmic-hub-tools{padding:0 16px 14px}.cosmic-mini{min-width:145px}#cosmic-account{top:8px;right:8px}.cosmic-badge{right:8px;bottom:8px}}
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
    const m=openModal('cosmic-account-modal','Create account',`<label>Username<input id="cc-user" autocomplete="username"></label><label>Password<input id="cc-pass" type="password" autocomplete="new-password"></label><label>Confirm password<input id="cc-pass2" type="password" autocomplete="new-password"></label><p id="cc-msg"></p><button class="cosmic-primary" id="cc-go">Create</button>`);
    m.querySelector('#cc-go').onclick=async()=>{const u=m.querySelector('#cc-user').value.trim(),p=m.querySelector('#cc-pass').value,p2=m.querySelector('#cc-pass2').value,msg=m.querySelector('#cc-msg');if(!/^[A-Za-z0-9_]{3,24}$/.test(u)){msg.textContent='Use 3–24 letters, numbers, or underscores.';return;}if(p.length<6){msg.textContent='Use at least 6 characters.';return;}if(p!==p2){msg.textContent='Passwords do not match.';return;}const accounts=load(ACCOUNTS,{});if(accounts[u.toLowerCase()]){msg.textContent='Username already exists.';return;}const salt=crypto.randomUUID(),hash=await passwordHash(p,salt);accounts[u.toLowerCase()]={username:u,salt,hash,created:Date.now()};save(ACCOUNTS,accounts);localStorage.setItem(SESSION,u);location.reload();};
  }

  function renderGames(list){
    const grid=document.querySelector('.games-grid'); if(!grid)return; grid.innerHTML='';
    list.forEach(item=>{const n=normalize(item),card=document.createElement('div');card.className='game-card';card.innerHTML=`<button class="cosmic-star" title="Favorite">☆</button><h3>${safe(n.name)}</h3><small>${safe(n.category)}</small>`;card.onclick=e=>{if(e.target.closest('.cosmic-star'))return;location.href=n.path};card.querySelector('.cosmic-star').onclick=e=>{e.stopPropagation();toggleFavorite(n)};grid.appendChild(card);});
  }
  function renderApps(list){
    const grid=document.querySelector('.apps-grid'); if(!grid)return; grid.innerHTML='';
    list.forEach(item=>{const n=normalize(item),card=document.createElement('div');card.className='app-card';card.innerHTML=`<button class="cosmic-star" title="Favorite">☆</button><h3>${safe(n.name)}</h3><small>${safe(n.category)}</small>`;card.onclick=e=>{if(e.target.closest('.cosmic-star'))return;location.href=n.path};card.querySelector('.cosmic-star').onclick=e=>{e.stopPropagation();toggleFavorite(n)};grid.appendChild(card);});
  }
  function toggleFavorite(item){const p=profile(),id=itemId(item);p.favorites=p.favorites.includes(id)?p.favorites.filter(x=>x!==id):[...p.favorites,id];writeProfile(p);}
  function addRecent(item){const p=profile(),id=itemId(item);p.recent=[id,...p.recent.filter(x=>x!==id)].slice(0,12);writeProfile(p);}
  function renderTools(){
    const host=document.querySelector('#cosmic-hub-tools')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'cosmic-hub-tools'}));
    host.innerHTML=`<div class="cosmic-section"><div class="cosmic-filters"><button class="cosmic-filter active" data-filter="All">All</button><button class="cosmic-filter" data-filter="Arcade">Arcade</button><button class="cosmic-filter" data-filter="Puzzle">Puzzle</button><button class="cosmic-filter" data-filter="Multiplayer">Multiplayer</button><button class="cosmic-filter" data-filter="Utility">Utility</button></div></div>`;
    host.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{host.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');const f=b.dataset.filter;const source=isApps?apps:games;(isApps?renderApps:renderGames)(f==='All'?source:source.filter(x=>normalize(x).category===f));});
  }
  async function init(){
    applyTheme(); registerPwa(); addAccountButton(); renderTools();
    if(isGames){games=await getJson(base+'pages/lessons/games.json',[]);renderGames(games);}
    if(isApps){apps=await getJson(base+'apps/apps.json',[]);renderApps(apps);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
