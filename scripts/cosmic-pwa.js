(() => {
  'use strict';
  const base = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  let deferredPrompt = null;
  const makeButton = () => {
    if (document.getElementById('cosmic-install')) return;
    const b=document.createElement('button');b.id='cosmic-install';b.type='button';b.textContent='Install Cosmic';b.className='cosmic-tool';b.style.cssText='position:fixed;right:14px;bottom:52px;z-index:2147483001;border:1px solid var(--card-border,#2dccff);border-radius:999px;padding:8px 12px;background:rgba(5,12,18,.94);color:var(--accent,#2dccff);font-weight:800;cursor:pointer';b.onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();try{await deferredPrompt.userChoice;}catch(_){}deferredPrompt=null;b.remove();};document.body.appendChild(b);
  };
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;makeButton();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.getElementById('cosmic-install')?.remove();});
  if('serviceWorker' in navigator)navigator.serviceWorker.register(base+'sw.js').catch(()=>{});
})();
