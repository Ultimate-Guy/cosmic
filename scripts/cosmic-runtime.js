(() => {
  'use strict';
  if (window.CosmicRuntime) return;
  const KEY='cosmicRuntimeV1';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{items:[],active:null}}catch(_){return {items:[],active:null}}};
  const write=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}};
  function open(item){
    if(!item||!item.url)return null;
    const state=read(), id=item.id||('space-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
    const existing=state.items.find(x=>x.id===id);
    if(!existing)state.items.push({id,name:item.name||'Cosmic Surface',type:item.type||'external',url:item.url,minimized:false,x:80+state.items.length*20,y:80+state.items.length*20,w:Math.min(900,innerWidth-40),h:Math.min(620,innerHeight-120)});
    state.active=id;write(state);return id;
  }
  function close(id){const s=read();s.items=s.items.filter(x=>x.id!==id);if(s.active===id)s.active=s.items.at(-1)?.id||null;write(s)}
  function minimize(id,v=true){const s=read(),x=s.items.find(x=>x.id===id);if(x)x.minimized=v;write(s)}
  function activate(id){const s=read();if(s.items.some(x=>x.id===id)){s.active=id;const x=s.items.find(x=>x.id===id);if(x)x.minimized=false;write(s)}}
  function save(){return read()}
  window.CosmicRuntime={version:1,open,close,minimize,activate,save,load:read};
})();