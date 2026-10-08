(() => {
  'use strict';
  if (window.CosmicRuntime) return;
  const KEY='cosmicRuntimeV1';
  const defaults=()=>({items:[],active:null});
  const read=()=>{try{const s=JSON.parse(localStorage.getItem(KEY));return s&&Array.isArray(s.items)?s:defaults()}catch(_){return defaults()}};
  const write=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}};
  const clampItem=item=>{
    const vw=Math.max(320,window.innerWidth||1280), vh=Math.max(260,window.innerHeight||720);
    const minW=Math.min(260,Math.max(220,vw-24)), minH=Math.min(180,Math.max(140,vh-90));
    item.w=Math.max(minW,Math.min(Number(item.w)||720,vw));
    item.h=Math.max(minH,Math.min(Number(item.h)||480,vh-46));
    item.x=Math.max(0,Math.min(Number(item.x)||60,Math.max(0,vw-item.w)));
    item.y=Math.max(46,Math.min(Number(item.y)||70,Math.max(46,vh-item.h-48)));
    return item;
  };
  function open(item){
    if(!item||!item.url)return null;
    const state=read(), id=item.id||('space-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
    const existing=state.items.find(x=>x.id===id);
    if(!existing){
      const offset=state.items.length*18;
      state.items.push(clampItem({
        id,name:item.name||'Cosmic Surface',type:item.type||'external',url:item.url,
        minimized:false,x:56+offset,y:70+offset,w:Math.min(900,Math.max(260,(innerWidth||1280)-40)),h:Math.min(620,Math.max(180,(innerHeight||720)-120))
      }));
    } else {
      existing.url=item.url||existing.url;
      existing.name=item.name||existing.name;
      existing.type=item.type||existing.type;
      existing.minimized=false;
      clampItem(existing);
    }
    state.active=id;write(state);return id;
  }
  function close(id){const s=read();s.items=s.items.filter(x=>x.id!==id);if(s.active===id)s.active=s.items.at(-1)?.id||null;write(s)}
  function minimize(id,v=true){const s=read(),x=s.items.find(x=>x.id===id);if(x)x.minimized=!!v;if(s.active===id&&v)s.active=s.items.find(q=>q.id!==id&&!q.minimized)?.id||s.items.find(q=>q.id!==id)?.id||null;write(s)}
  function activate(id){const s=read();const x=s.items.find(x=>x.id===id);if(x){clampItem(x);x.minimized=false;s.active=id;write(s)}}
  function update(id,patch={}){const s=read(),x=s.items.find(x=>x.id===id);if(!x)return false;Object.assign(x,patch);clampItem(x);write(s);return true}
  function save(){const s=read();s.items.forEach(clampItem);write(s);return s}
  window.addEventListener('resize',()=>{const s=read();let changed=false;s.items.forEach(x=>{const before=JSON.stringify(x);clampItem(x);changed=changed||before!==JSON.stringify(x)});if(changed)write(s)});
  window.CosmicRuntime={version:2,open,close,minimize,activate,update,save,load:read};
})();