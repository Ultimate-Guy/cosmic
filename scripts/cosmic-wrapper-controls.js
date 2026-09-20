(() => {
  'use strict';
  if(window.__COSMIC_WRAPPER_CONTROLS__)return;
  window.__COSMIC_WRAPPER_CONTROLS__=true;
  const frame=document.querySelector('#game,#appframe'); if(!frame)return;
  const wrap=document.createElement('div');wrap.id='cosmic-wrapper-controls';wrap.style.cssText='position:fixed;top:12px;right:12px;z-index:2147483647;display:flex;gap:5px';
  const style='width:34px;height:32px;border:1px solid #2dccff;border-radius:8px;background:#0d1a21;color:#2dccff;font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45)';
  const add=(label,title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.style.cssText=style;b.onclick=fn;wrap.appendChild(b)};
  add('⛶','Fullscreen',async()=>{try{if(frame.requestFullscreen)await frame.requestFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch(_){}});
  add('↻','Reload',()=>{try{if(frame.src)frame.src=frame.src}catch(_){location.reload()}});
  add('↗','Pop out',()=>{try{window.open(frame.src||location.href,'_blank','noopener,noreferrer')}catch(_){}});
  document.body.appendChild(wrap);
})();