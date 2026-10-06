(() => {
  'use strict';
  const base = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  let cache = null;
  async function data(){
    if(cache)return cache;
    const get=async u=>{try{const r=await fetch(base+u,{cache:'no-store'});return r.ok?await r.json():[];}catch(_){return [];}};
    const [games,apps]=await Promise.all([get('pages/lessons/games.json'),get('apps/apps.json')]);
    cache=[...(Array.isArray(games)?games:[]).map(x=>({...x,kind:'game'})),...(Array.isArray(apps)?apps:[]).map(x=>({...x,kind:'app'}))];return cache;
  }
  function target(item){
    if(item.kind==='app'){
      const wrapper=new URL(base+'apps/app.html',location.origin);wrapper.searchParams.set('url',new URL(item.path+(item.entry||''),location.href).href);wrapper.searchParams.set('name',item.name||'Cosmic App');return wrapper.href;
    }
    const shell=new URL(base+'pages/lessons/game-shell.html',location.origin);const game=new URL(base+item.path+(item.entry||'index.html'),location.origin);shell.searchParams.set('game',game.href);return shell.href;
  }
  document.addEventListener('click',async e=>{
    const button=e.target.closest?.('.cosmic-mini,#cosmic-mission-go,.cosmic-grid button');
    if(!button)return;
    const name=button.querySelector('b')?.textContent?.trim()||button.textContent?.trim();if(!name)return;
    const list=await data();const item=list.find(x=>String(x.name).toLowerCase()===name.toLowerCase());if(!item)return;
    e.preventDefault();e.stopImmediatePropagation();try{location.href=target(item);}catch(_){ }
  },true);
})();
