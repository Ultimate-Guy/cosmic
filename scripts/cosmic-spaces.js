(() => {
'use strict';
if(window.__COSMIC_SPACES__)return;window.__COSMIC_SPACES__=true;
const css=document.createElement('style');css.textContent=`
#cosmic-spaces{position:fixed;inset:0;z-index:2147483000;background:rgba(2,7,12,.96);display:none;color:#eefaff;font:14px system-ui,sans-serif;overflow:hidden}
#cosmic-spaces.show{display:block}.cs-top{height:46px;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid #163545;background:#06131c;position:relative;z-index:20}
.cs-title{font-weight:900;color:#62dcff;margin-right:auto}.cs-btn{border:1px solid #22566b;background:#091e2a;color:#bceeff;border-radius:8px;padding:6px 9px;cursor:pointer}.cs-btn:hover{background:#0d2a39;color:#fff}.cs-dock{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;gap:6px;padding:6px 9px;background:#06131c;border-top:1px solid #163545;overflow:auto;z-index:20}.cs-win{position:absolute;border:1px solid #2dccff;border-radius:10px;background:#02090f;box-shadow:0 18px 50px #000;overflow:hidden;resize:both;min-width:220px;min-height:140px}.cs-win.active{box-shadow:0 20px 70px rgba(45,204,255,.25),0 18px 50px #000}.cs-head{height:34px;display:flex;align-items:center;padding:0 7px;background:#081b25;cursor:move;touch-action:none;user-select:none}.cs-name{font-weight:800;font-size:12px;margin-right:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-frame{width:100%;height:calc(100% - 34px);border:0;background:#000}.cs-hint{font-size:11px;color:#76909a;margin-right:8px}
@media(max-width:600px){#cosmic-spaces .cs-win{min-width:220px}.cs-hint{display:none}}
`;document.head.appendChild(css);

function boot(){let root=document.getElementById('cosmic-spaces');if(!root){root=document.createElement('div');root.id='cosmic-spaces';document.body.appendChild(root)}render()}
function persistBounds(id,w){CosmicRuntime.update(id,{x:parseInt(w.style.left)||0,y:parseInt(w.style.top)||46,w:w.offsetWidth,h:w.offsetHeight})}
function render(){
 const root=document.getElementById('cosmic-spaces'),s=CosmicRuntime.save();
 root.innerHTML='<div class="cs-top"><span class="cs-title">Cosmic Spaces</span><span class="cs-hint">Drag, resize, minimize, or switch surfaces</span><button class="cs-btn" id="cs-close">Close</button></div>';
 s.items.filter(x=>!x.minimized).forEach(x=>{
  const w=document.createElement('section');w.className='cs-win'+(s.active===x.id?' active':'');w.dataset.id=x.id;
  w.style.left=x.x+'px';w.style.top=x.y+'px';w.style.width=x.w+'px';w.style.height=x.h+'px';
  w.innerHTML='<div class="cs-head"><span class="cs-name"></span><button class="cs-btn" data-min aria-label="Minimize">—</button><button class="cs-btn" data-close aria-label="Close">×</button></div><iframe class="cs-frame" allow="fullscreen"></iframe>';
  w.querySelector('.cs-name').textContent=x.name;
  w.querySelector('.cs-frame').src=x.url;
  const focus=()=>{CosmicRuntime.activate(x.id);root.querySelectorAll('.cs-win').forEach(el=>el.classList.remove('active'));w.classList.add('active')};
  w.addEventListener('pointerdown',focus,{passive:true});
  w.querySelector('[data-close]').onclick=()=>{CosmicRuntime.close(x.id);render()};
  w.querySelector('[data-min]').onclick=e=>{e.stopPropagation();CosmicRuntime.minimize(x.id,true);render()};
  let dragging=false,sx=0,sy=0,ox=0,oy=0;
  const head=w.querySelector('.cs-head');
  head.onpointerdown=e=>{
    if(e.target.closest('button'))return;
    focus();dragging=true;sx=e.clientX;sy=e.clientY;ox=parseInt(w.style.left)||0;oy=parseInt(w.style.top)||46;
    try{head.setPointerCapture(e.pointerId)}catch(_){}
  };
  head.onpointermove=e=>{
    if(!dragging)return;
    const maxX=Math.max(0,(innerWidth||1280)-w.offsetWidth);
    const maxY=Math.max(46,(innerHeight||720)-w.offsetHeight-48);
    w.style.left=Math.max(0,Math.min(maxX,ox+e.clientX-sx))+'px';
    w.style.top=Math.max(46,Math.min(maxY,oy+e.clientY-sy))+'px';
  };
  const finishDrag=()=>{if(!dragging)return;dragging=false;persistBounds(x.id,w)};
  head.onpointerup=finishDrag;head.onpointercancel=finishDrag;
  if(window.ResizeObserver){const ro=new ResizeObserver(()=>{if(document.body.contains(w))persistBounds(x.id,w)});ro.observe(w);w._cosmicResizeObserver=ro}
  w.querySelector('.cs-frame').addEventListener('load',focus,{once:true});
  root.appendChild(w);
 });
 const dock=document.createElement('div');dock.className='cs-dock';
 s.items.forEach(x=>{const b=document.createElement('button');b.className='cs-btn';b.textContent=(x.minimized?'↗ ':'')+x.name;b.title=x.minimized?'Restore '+x.name:'Focus '+x.name;b.onclick=()=>{CosmicRuntime.activate(x.id);render()};dock.appendChild(b)});
 root.appendChild(dock);
 root.querySelector('#cs-close').onclick=()=>root.classList.remove('show');
}
window.CosmicSpaces={open:x=>{CosmicRuntime.open(x);document.getElementById('cosmic-spaces')?.classList.add('show');render()},show:()=>{document.getElementById('cosmic-spaces')?.classList.add('show');render()},hide:()=>document.getElementById('cosmic-spaces')?.classList.remove('show')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();