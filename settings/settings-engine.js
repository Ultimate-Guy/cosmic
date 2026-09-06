(function () {
  const THEMES={default:{label:'Cosmic Default',bg:'#061410',accent:'#2dccff'},crimson:{label:'Crimson',bg:'#0d0606',accent:'#ff3b3b'},purple:{label:'NXOS Purple',bg:'#0b0813',accent:'#8b00ff'},cyan:{label:'Cyber Cyan',bg:'#041018',accent:'#00f2ff'},emerald:{label:'Matrix Green',bg:'#04140c',accent:'#00ff88'},midnight:{label:'Midnight',bg:'#000000',accent:'#888888'},ocean:{label:'Ocean',bg:'#051425',accent:'#0088ff'},amber:{label:'Amber',bg:'#1a1005',accent:'#ffb020'},rose:{label:'Rose',bg:'#1a0a12',accent:'#ff5ca8'},vampire:{label:'Vampire',bg:'#0d0202',accent:'#ff0000'},forest:{label:'Forest',bg:'#030c05',accent:'#00cc44'},cyberpunk:{label:'Cyberpunk',bg:'#1c0024',accent:'#fcee0a'},toxic:{label:'Toxic',bg:'#0f1402',accent:'#a3ff00'},solar:{label:'Solar',bg:'#140700',accent:'#ff5500'},ice:{label:'Ice',bg:'#0f191c',accent:'#00f3ff'},arcade:{label:'Arcade',bg:'#120421',accent:'#ff007f'},bubblegum:{label:'Bubblegum',bg:'#3d2b34',accent:'#ffb7b2'},desert:{label:'Desert Strike',bg:'#211e14',accent:'#d4af37'},royal:{label:'Royal Luxury',bg:'#1b0a24',accent:'#ffd700'},ghost:{label:'Ghostly',bg:'#1d242a',accent:'#708090'},espresso:{label:'Cocoa Espresso',bg:'#1c140f',accent:'#875c36'},copper:{label:'Chrono Copper',bg:'#241610',accent:'#b87333'},eclipse:{label:'Crimson Eclipse',bg:'#101017',accent:'#800020'},cotton:{label:'Cotton Candy',bg:'#1b2836',accent:'#ffa6c9'},moonlight:{label:'Moonlight',bg:'#101420',accent:'#7b92b5'},neon:{label:'Neon Pulse',bg:'#090314',accent:'#00ffef'},rgb:{label:'Fading RGB',bg:'#050505',accent:'#00ffef'},matrix:{label:'Matrix Rain',bg:'#000000',accent:'#00ff00'},cosmic:{label:'Cosmic Void',bg:'#0b0414',accent:'#7f00ff'},magma:{label:'Magma Core',bg:'#260f02',accent:'#ff3b00'},glacial:{label:'Glacial Shard',bg:'#122028',accent:'#7fe9ff'},titanium:{label:'Industrial Titanium',bg:'#161618',accent:'#c0c0c0'},aurora:{label:'Aurora Sky',bg:'#0c1520',accent:'#00ffa6'},starforge:{label:'Starforge',bg:'#140024',accent:'#ff00c8'},lab:{label:'Laboratory Sterile',bg:'#181b20',accent:'#c8e6ff'},dragon:{label:'Dragon Scale',bg:'#141c10',accent:'#cc0000'},storm:{label:'Stormfront',bg:'#111923',accent:'#8bb8ff'}};
  const get=(key,fallback)=>localStorage.getItem(key)??fallback;
  const root=document.documentElement;
  const presets={
    google:['Google Search','#4285f4'],
    drive:['Google Drive','#0f9d58'],
    classroom:['Google Classroom','#1967d2'],
    canvas:['Canvas','#e66000']
  };
  const CROSSHAIRS={original:['+', '#2dccff'], 'cyan-hud':['⊕','#00f2ff'], 'red-reticle':['⊙','#ff3b3b'], 'gold-lock':['✣','#ffd700'], 'minimal-dot':['•','#ffffff'], 'neon-pulse':['✦','#00ffef'], 'mono-sharp':['×','#ffffff'], 'purple-tactical':['⊹','#a855f7']};
  let cloakObserver=null;
  let musicReady=false;

  function getBody(){return document.body;}

  function applyTheme(name){
    const key=Object.prototype.hasOwnProperty.call(THEMES,name)?name:'default';
    const t=THEMES[key];
    localStorage.setItem('cosmic-theme',key);
    root.dataset.cosmicTheme=key;
    root.style.setProperty('--cosmic-bg',t.bg);
    root.style.setProperty('--cosmic-accent',t.accent);
    root.style.setProperty('--accent',t.accent);
    root.style.setProperty('--card-border',t.accent+'66');
    root.style.setProperty('--card-hover',t.accent+'22');
    root.style.setProperty('--bg',t.bg);
    const body=getBody();
    if(body){
      body.dataset.cosmicTheme=key;
      body.style.setProperty('--cosmic-bg',t.bg);
      body.style.setProperty('--cosmic-accent',t.accent);
      body.style.setProperty('--accent',t.accent);
    }
    root.classList.toggle('cosmic-rgb-theme',key==='rgb');
  }

  function applyBackground(){
    const body=getBody();
    if(!body)return;
    const image=get('cosmic-bg-image','');
    const interactive=get('cosmic-interactive-bg','true')==='true';
    const animations=get('cosmic-ui-animations','true')==='true';
    body.classList.toggle('cosmic-interactive-bg',interactive);
    body.classList.toggle('cosmic-no-animations',!animations);
    body.classList.toggle('cosmic-custom-background',!!image);
    body.style.setProperty('background-color',getComputedStyle(root).getPropertyValue('--cosmic-bg').trim()||'#061410','important');
    const accent=getComputedStyle(root).getPropertyValue('--cosmic-accent').trim()||'#2dccff';
    const x=getComputedStyle(body).getPropertyValue('--cosmic-mx').trim()||'20%';
    const y=getComputedStyle(body).getPropertyValue('--cosmic-my').trim()||'20%';
    const layers=[];
    if(interactive)layers.push(`radial-gradient(circle at ${x} ${y}, color-mix(in srgb, ${accent} 14%, transparent), transparent 30%)`,`radial-gradient(circle at 80% 80%, color-mix(in srgb, ${accent} 8%, transparent), transparent 35%)`);
    if(image)layers.push('linear-gradient(rgba(0,0,0,.48),rgba(0,0,0,.48))',`url("${image}")`);
    body.style.setProperty('background-image',layers.length?layers.join(','):'none','important');
    body.style.setProperty('background-attachment',image?'fixed':'','important');
    body.style.setProperty('background-size',image?'cover':'','important');
    body.style.setProperty('background-position','center','important');
    body.style.setProperty('background-repeat',image?'no-repeat':'','important');
  }

  function makeCloakIcon(accent){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${accent}"/><text x="32" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="white">C</text></svg>`;
    return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
  }

  function applyCloak(){
    const cloak=get('savedCloak','none');
    if(!document.head)return;
    if(!sessionStorage.getItem('cosmic-original-title'))sessionStorage.setItem('cosmic-original-title',document.title||'Cosmic');
    let icon=document.querySelector('link[data-cosmic-cloak="true"]');
    if(cloak==='none'||!presets[cloak]){
      document.title=sessionStorage.getItem('cosmic-original-title')||document.title;
      if(icon)icon.remove();
      return;
    }
    const [title,accent]=presets[cloak];
    document.title=title;
    if(!icon){
      icon=document.createElement('link');
      icon.rel='icon';
      icon.dataset.cosmicCloak='true';
      document.head.appendChild(icon);
    }
    icon.href=makeCloakIcon(accent);
    if(!cloakObserver){
      cloakObserver=new MutationObserver(()=>{
        if(get('savedCloak','none')!=='none'){
          const active=document.querySelector('link[data-cosmic-cloak="true"]');
          if(!active)applyCloak();
          else if(document.title!==presets[get('savedCloak','none')]?.[0])document.title=presets[get('savedCloak','none')][0];
        }
      });
      cloakObserver.observe(document.head,{childList:true,subtree:true,characterData:true});
    }
  }

  function applyStudyCloak(){
    const body=getBody();
    if(!body)return;
    const disabled=get('disableStudyCloak','false')==='true';
    body.classList.toggle('cosmic-study-cloak-disabled',disabled);
    const hide=()=>{const el=document.getElementById('educational-cloak');if(el)el.style.display=disabled?'none':'';};
    hide();
    if(!disabled&&!body.dataset.cosmicStudyObserver){
      const observer=new MutationObserver(hide);
      observer.observe(body,{childList:true,subtree:true});
      body.dataset.cosmicStudyObserver='true';
    }
  }

  function applyCrosshair(){
    const body=getBody();
    if(!body)return;
    const selected=get('cosmic-crosshair','none');
    let el=document.getElementById('cosmic-crosshair');
    if(selected==='none'){
      if(el)el.remove();
      return;
    }
    if(!el){
      el=document.createElement('div');
      el.id='cosmic-crosshair';
      body.appendChild(el);
      Object.assign(el.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:'2147483646',pointerEvents:'none',font:'700 24px/1 system-ui,sans-serif',textAlign:'center'});
    }
    const [symbol,color]=CROSSHAIRS[selected]||CROSSHAIRS.original;
    el.textContent=symbol;
    el.style.color=color;
    el.style.textShadow=`0 0 7px ${color}`;
  }

  function ensureMusicElement(){
    const body=getBody();
    if(!body)return null;
    let audio=document.getElementById('cosmic-background-audio');
    if(!audio){
      audio=document.createElement('audio');
      audio.id='cosmic-background-audio';
      audio.loop=true;
      audio.preload='auto';
      audio.setAttribute('aria-hidden','true');
      audio.style.display='none';
      body.appendChild(audio);
    }
    return audio;
  }

  function applyMusic(){
    const audio=ensureMusicElement();
    if(!audio)return;
    const enabled=get('cosmic-music-enabled','false')==='true';
    const muted=get('cosmic-music-muted','false')==='true';
    const volume=Math.max(0,Math.min(1,Number(get('cosmic-music-volume','35'))/100));
    const track=get('cosmic-music-track','library-default');
    const custom=get('cosmic-music-custom','');
    audio.volume=volume;
    audio.muted=muted;
    const src=track==='custom'?custom:'';
    if(audio.dataset.cosmicSrc!==src){
      audio.dataset.cosmicSrc=src;
      audio.src=src;
      if(src)audio.load();
    }
    if(!enabled||!src){audio.pause();return;}
    if(musicReady)audio.play().catch(()=>{});
  }

  function enableMusicGesture(){
    if(musicReady)return;
    musicReady=true;
    applyMusic();
    if(musicReady){document.removeEventListener('pointerdown',enableMusicGesture,true);document.removeEventListener('keydown',enableMusicGesture,true);}
  }

  function applyPanicShortcut(){
    if(window.__cosmicPanicHandler)window.removeEventListener('keydown',window.__cosmicPanicHandler,true);
    window.__cosmicPanicHandler=e=>{
      const key=localStorage.getItem('cosmic-panic-key'),url=localStorage.getItem('cosmic-panic-url');
      if(!key||!url||e.key!==key)return;
      const target=document.activeElement;
      if(target&&['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;
      e.preventDefault();e.stopPropagation();
      try{window.top.location.assign(url);}catch{window.location.assign(url);}
    };
    window.addEventListener('keydown',window.__cosmicPanicHandler,true);
  }

  function installStyle(){
    if(document.getElementById('cosmic-settings-engine-style'))return;
    const style=document.createElement('style');
    style.id='cosmic-settings-engine-style';
    style.textContent=`:root{--cosmic-bg:#061410;--cosmic-accent:#2dccff;--accent:#2dccff}.cosmic-rgb-theme{animation:cosmicRgb 7s linear infinite}@keyframes cosmicRgb{0%{--cosmic-accent:#ff0055;--accent:#ff0055}33%{--cosmic-accent:#00ff88;--accent:#00ff88}66%{--cosmic-accent:#0088ff;--accent:#0088ff}100%{--cosmic-accent:#ff0055;--accent:#ff0055}}body.cosmic-interactive-bg{background-color:var(--cosmic-bg)!important}body.cosmic-no-animations *,body.cosmic-no-animations *::before,body.cosmic-no-animations *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}.cosmic-study-cloak-disabled #educational-cloak{display:none!important}`;
    (document.head||document.documentElement).appendChild(style);
  }

  function boot(){
    installStyle();
    window.CosmicSettings={THEMES,applyTheme,applyBackground,applyCloak,applyStudyCloak,applyCrosshair,applyMusic,applyPanicShortcut,applyAll};
    applyAll();
    document.addEventListener('pointerdown',enableMusicGesture,true);
    document.addEventListener('keydown',enableMusicGesture,true);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')applyMusic();});
    window.addEventListener('storage',e=>{if(!e.key||e.key.startsWith('cosmic-')||e.key==='savedCloak'||e.key==='disableStudyCloak')applyAll();});
  }

  function applyAll(){
    applyTheme(get('cosmic-theme','default'));
    applyBackground();
    applyCloak();
    applyStudyCloak();
    applyCrosshair();
    applyMusic();
    applyPanicShortcut();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
