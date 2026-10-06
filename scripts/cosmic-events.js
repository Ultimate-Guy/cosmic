(() => {
'use strict';
if(window.CosmicEvents)return;
const API=location.hostname.endsWith('.github.io')?'https://cosmicv2.v75ultimate.workers.dev':location.origin;
async function get(){try{const r=await fetch(API+'/api/cosmic-events',{cache:'no-store'});return r.ok?await r.json():{ok:false}}catch(_){return {ok:false}}}
window.CosmicEvents={get};
})();