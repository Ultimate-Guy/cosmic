(() => {
'use strict';
if(window.CosmicRuntimeManifest)return;
const defaults={permissions:{fullscreen:true},compatibility:{},controls:{},fallbacks:{},metadata:{}};
function normalize(item){return {...defaults,...item,launch:{...(item.launch||{}),url:item?.launch?.url||item?.url||''}}}
window.CosmicRuntimeManifest={normalize};
})();