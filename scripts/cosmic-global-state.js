(() => {
  'use strict';
  if (window.__COSMIC_GLOBAL_STATE__) return;
  window.__COSMIC_GLOBAL_STATE__ = true;
  function installPanicKey(){
    if(window.__COSMIC_PANIC_GLOBAL__) return;
    window.__COSMIC_PANIC_GLOBAL__=true;
    window.addEventListener('keydown',e=>{
      let key='',url='';
      try{key=localStorage.getItem('cosmic-panic-key')||'';url=localStorage.getItem('cosmic-panic-url')||'';}catch(_){}
      if(!key||!url||e.key!==key)return;
      const t=e.target;
      if(t&&(t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName)))return;
      e.preventDefault();e.stopImmediatePropagation();
      try{window.top.location.assign(url);}catch(_){try{location.assign(url);}catch(__){}}
    },true);
  }
  installPanicKey();
  const API = location.hostname.endsWith('.github.io') ? 'https://cosmicv2.v75ultimate.workers.dev' : location.origin;
  const DISMISS_PREFIX = 'cosmicGlobalMessageDismissedV4';
  const ANNOUNCEMENT_SESSION_KEY = 'cosmicAnnouncementSessionV1';
  function sessionStart(){
    try{
      const existing=Number(sessionStorage.getItem(ANNOUNCEMENT_SESSION_KEY));
      if(Number.isFinite(existing)&&existing>0)return existing;
      const now=Date.now();
      sessionStorage.setItem(ANNOUNCEMENT_SESSION_KEY,String(now));
      return now;
    }catch(_){ return Date.now(); }
  }
  const SITE_SESSION_STARTED_AT=sessionStart();
  function dismissalKey(kind,id){return DISMISS_PREFIX+'::'+kind+'::'+id;}
  function renderMessages(data){
    const global=data?.global||{};
    const messages=[];
    const announcementCreated=Number(data?.announcement?.created_at||0);
    // /announcement is live-only: an open Cosmic session sees announcements
    // created after that session started. A later visit does not replay it.
    if(data?.announcement?.text && announcementCreated>=SITE_SESSION_STARTED_AT){
      messages.push({kind:'announcement',label:'Live Announcement',item:data.announcement});
    }
    if(global.site_banner?.text) messages.push({kind:'site_banner',label:'Site Banner',item:global.site_banner});
    if(global.global_notice?.text) messages.push({kind:'global_notice',label:'Global Notice',item:global.global_notice});
    if(global.global_message?.text) messages.push({kind:'global_message',label:'Global Message',item:global.global_message});
    if(global.broadcast?.text) messages.push({kind:'broadcast',label:'Broadcast',item:global.broadcast});
    let stack=document.getElementById('cosmic-global-message-stack');
    if(!messages.length){stack?.remove();return;}
    if(!stack){
      stack=document.createElement('div'); stack.id='cosmic-global-message-stack';
      stack.style.cssText='position:fixed;left:10px;right:10px;top:10px;z-index:2147483647;display:grid;gap:8px;pointer-events:none;font:700 13px system-ui,sans-serif;';
      document.body.appendChild(stack);
    }
    stack.innerHTML='';
    messages.forEach(({kind,label,item})=>{
      const id=String(item.created_at||item.text);
      let dismissed=''; try{dismissed=localStorage.getItem(dismissalKey(kind,id))||'';}catch(_){}
      if(dismissed===id)return;
      const card=document.createElement('div');
      card.style.cssText='position:relative;pointer-events:auto;padding:10px 48px 10px 14px;border:1px solid #2dccff;border-radius:12px;background:rgba(5,12,18,.97);color:#f2f7fa;box-shadow:0 10px 30px rgba(0,0,0,.35);box-sizing:border-box;max-width:1200px;margin:0 auto;width:100%;';
      const labelEl=document.createElement('small'); labelEl.textContent=label;
      labelEl.style.cssText='display:block;margin-bottom:2px;color:#2dccff;font-size:10px;letter-spacing:.08em;text-transform:uppercase;';
      const textEl=document.createElement('div'); textEl.textContent=item.text;
      const close=document.createElement('button'); close.type='button'; close.textContent='×'; close.setAttribute('aria-label','Dismiss '+label);
      close.style.cssText='position:absolute;right:8px;top:5px;width:32px;height:32px;border:1px solid rgba(45,204,255,.35);border-radius:8px;background:rgba(45,204,255,.07);color:#2dccff;font-size:20px;line-height:1;cursor:pointer;';
      close.onclick=()=>{try{localStorage.setItem(dismissalKey(kind,id),id);}catch(_){} card.remove(); if(!stack.children.length)stack.remove();};
      card.append(labelEl,textEl,close); stack.appendChild(card);
    });
    if(!stack.children.length)stack.remove();
  }
  function renderExtras(data){
    const global=data?.global||{};
    let badge=document.getElementById('cosmic-global-badge');
    if(global.global_badge?.text){badge=badge||document.createElement('div');badge.id='cosmic-global-badge';badge.textContent=global.global_badge.text;badge.style.cssText='position:fixed;right:14px;bottom:14px;z-index:2147483645;padding:7px 11px;border:1px solid #2dccff;border-radius:999px;background:rgba(5,12,18,.94);color:#2dccff;font:800 12px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4);';if(!badge.parentNode)document.body.appendChild(badge);}else badge?.remove();
    let countdown=document.getElementById('cosmic-global-countdown');
    if(global.countdown?.target&&Number(global.countdown.target)>Date.now()){countdown=countdown||document.createElement('div');countdown.id='cosmic-global-countdown';countdown.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483644;padding:8px 12px;border:1px solid #2dccff;border-radius:10px;background:rgba(5,12,18,.96);color:#f2f7fa;font:800 12px system-ui,sans-serif;';if(!countdown.parentNode)document.body.appendChild(countdown);clearInterval(countdown.__timer);countdown.__timer=setInterval(()=>{const ms=Math.max(0,Number(global.countdown.target)-Date.now());const s=Math.floor(ms/1000);countdown.textContent=(global.countdown.label||'Countdown')+' • '+Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0');if(ms<=0){clearInterval(countdown.__timer);countdown.remove();}},1000);}else countdown?.remove();
  }
  async function sync(){try{const response=await fetch(API+'/api/site-state?global='+Date.now(),{cache:'no-store'});if(!response.ok)return;const data=await response.json();renderMessages(data);renderExtras(data);}catch(_){}}
  function boot(){if(!document.body){document.addEventListener('DOMContentLoaded',boot,{once:true});return;}sync();window.setInterval(sync,5000);}
  boot();
})();