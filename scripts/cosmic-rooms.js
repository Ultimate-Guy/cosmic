(() => {
'use strict';
if(window.CosmicRooms)return;
const API=location.hostname.endsWith('.github.io')?'https://cosmicv2.v75ultimate.workers.dev':location.origin;
async function create(name){const r=await fetch(API+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});return r.json()}
async function join(code){const r=await fetch(API+'/api/rooms/'+encodeURIComponent(code),{cache:'no-store'});return r.json()}
window.CosmicRooms={create,join};
})();