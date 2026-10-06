(() => {
'use strict';
if(window.CosmicFoundry)return;
const normalizeName=s=>String(s||'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,c=>c.toUpperCase());
function scan(entry){
 const text=String(entry||'').trim();if(!text)return {ok:false,error:'Source or entry is required'};
 const absolute=/^https?:\/\//i.test(text);
 const path=absolute?new URL(text).pathname:text;
 const suspicious=[];if(/serviceWorker|navigator\.serviceWorker/i.test(text))suspicious.push('service-worker');if(/document\.write/i.test(text))suspicious.push('document-write');if(/https?:\/\//i.test(text))suspicious.push('external-dependency');
 return {ok:true,source:text,detected_entry:path,source_type:absolute?'external':'local',normalized_name:normalizeName(path.split('/').pop()?.replace(/\.html?$/i,'')),suspicious,compatibility:{base_path:true,assets:true,resize:true,focus:true,service_worker:isNaN(suspicious.indexOf('service-worker'))}};
}
window.CosmicFoundry={scan,normalizeName,preview:x=>({registry:{name:normalizeName(x?.name||x?.entry),path:x?.entry||'',tags:['foundry'],compatibility:x?.compatibility||{}}})};
})();