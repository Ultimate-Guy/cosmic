(() => {
'use strict';
window.CosmicDeploymentShield={version:1,async check(){
 const checks=[];const add=async(name,fn)=>{try{const r=await fn();checks.push({name,ok:!!r})}catch(e){checks.push({name,ok:false,error:String(e)})}};
 await add('games.json parses',async()=>Array.isArray(await (await fetch('pages/lessons/games.json',{cache:'no-store'})).json()));
 await add('ugs-games.json parses',async()=>Array.isArray(await (await fetch('pages/lessons/ugs-games.json',{cache:'no-store'})).json()));
 for(const p of ['index.html','pages/lessons/lessons.html','apps/apps.html','youtube/youtube.html','settings/settings.html','pages/lessons/game-shell.html'])await add(p,async()=>{const r=await fetch(p,{cache:'no-store'});return r.ok});
 const a=await (await fetch('pages/lessons/games.json',{cache:'no-store'})).json(),u=await (await fetch('pages/lessons/ugs-games.json',{cache:'no-store'})).json();
 checks.push({name:'catalog consistency',ok:a.length+u.length>0,count:a.length+u.length});
 return {ok:checks.every(x=>x.ok),checks};
}};
})();