(() => {
'use strict';
if(window.CosmicCloudProfile)return;
const API=location.hostname.endsWith('.github.io')?'https://cosmicv2.v75ultimate.workers.dev':location.origin;
const KEY='cosmicCloudProfileV1';
const local=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(_){return {}}};
const save=x=>{try{localStorage.setItem(KEY,JSON.stringify(x))}catch(_){}};
async function reserve(username){const r=await fetch(API+'/api/usernames/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});const d=await r.json();if(!d.ok)throw new Error(d.error||'Account creation failed');const p={...local(),username:d.username,account_token:d.account_token};save(p);return p}
async function load(){const p=local();if(!p.username||!p.account_token)return null;const r=await fetch(API+'/api/cosmic-profile?username='+encodeURIComponent(p.username)+'&account_token='+encodeURIComponent(p.account_token),{cache:'no-store'});if(!r.ok)return null;const d=await r.json();if(d.profile&&typeof d.profile==='object'){save({...p,...d.profile,username:p.username,account_token:p.account_token});return {...p,...d.profile}}return p}
async function syncActivity(game_name){const p=local();if(!p.username||!p.account_token)return false;const r=await fetch(API+'/api/accounts/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:p.username,account_token:p.account_token,game_name})});return r.ok}
window.CosmicCloudProfile={local,reserve,syncActivity,api:API};
})();