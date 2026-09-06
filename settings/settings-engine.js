(function () {
  const THEMES = {
    default:{label:'Cosmic Default',bg:'#061410',accent:'#2dccff'}, crimson:{label:'Crimson',bg:'#0d0606',accent:'#ff3b3b'}, purple:{label:'NXOS Purple',bg:'#0b0813',accent:'#8b00ff'}, cyan:{label:'Cyber Cyan',bg:'#041018',accent:'#00f2ff'}, emerald:{label:'Matrix Green',bg:'#04140c',accent:'#00ff88'}, midnight:{label:'Midnight',bg:'#000000',accent:'#888888'}, ocean:{label:'Ocean',bg:'#051425',accent:'#0088ff'}, amber:{label:'Amber',bg:'#1a1005',accent:'#ffb020'}, rose:{label:'Rose',bg:'#1a0a12',accent:'#ff5ca8'}, vampire:{label:'Vampire',bg:'#0d0202',accent:'#ff0000'}, forest:{label:'Forest',bg:'#030c05',accent:'#00cc44'}, cyberpunk:{label:'Cyberpunk',bg:'#1c0024',accent:'#fcee0a'}, toxic:{label:'Toxic',bg:'#0f1402',accent:'#a3ff00'}, solar:{label:'Solar',bg:'#140700',accent:'#ff5500'}, ice:{label:'Ice',bg:'#0f191c',accent:'#00f3ff'}, arcade:{label:'Arcade',bg:'#120421',accent:'#ff007f'}, bubblegum:{label:'Bubblegum',bg:'#3d2b34',accent:'#ffb7b2'}, desert:{label:'Desert Strike',bg:'#211e14',accent:'#d4af37'}, royal:{label:'Royal Luxury',bg:'#1b0a24',accent:'#ffd700'}, ghost:{label:'Ghostly',bg:'#1d242a',accent:'#708090'}, espresso:{label:'Cocoa Espresso',bg:'#1c140f',accent:'#875c36'}, copper:{label:'Chrono Copper',bg:'#241610',accent:'#b87333'}, eclipse:{label:'Crimson Eclipse',bg:'#101017',accent:'#800020'}, cotton:{label:'Cotton Candy',bg:'#1b2836',accent:'#ffa6c9'}, moonlight:{label:'Moonlight',bg:'#101420',accent:'#7b92b5'}, neon:{label:'Neon Pulse',bg:'#090314',accent:'#00ffef'}, rgb:{label:'Fading RGB',bg:'#050505',accent:'#00ffef'}, matrix:{label:'Matrix Rain',bg:'#000000',accent:'#00ff00'}, cosmic:{label:'Cosmic Void',bg:'#0b0414',accent:'#7f00ff'}, magma:{label:'Magma Core',bg:'#260f02',accent:'#ff3b00'}, glacial:{label:'Glacial Shard',bg:'#122028',accent:'#7fe9ff'}, titanium:{label:'Industrial Titanium',bg:'#161618',accent:'#c0c0c0'}, aurora:{label:'Aurora Sky',bg:'#0c1520',accent:'#00ffa6'}, starforge:{label:'Starforge',bg:'#140024',accent:'#ff00c8'}, lab:{label:'Laboratory Sterile',bg:'#181b20',accent:'#c8e6ff'}, dragon:{label:'Dragon Scale',bg:'#141c10',accent:'#cc0000'}, storm:{label:'Stormfront',bg:'#111923',accent:'#8bb8ff'}
  };
  const get=(key,fallback)=>localStorage.getItem(key)??fallback;
  const root=document.documentElement, body=document.body;

  function applyTheme(name){
    const key=Object.prototype.hasOwnProperty.call(THEMES,name)?name:'default';
    const theme=THEMES[key];
    localStorage.setItem('cosmic-theme',key);
    root.dataset.cosmicTheme=key;
    root.style.setProperty('--cosmic-bg',theme.bg);
    root.style.setProperty('--cosmic-accent',theme.accent);
    // Also expose the variable names used by Cosmic's existing pages.
    root.style.setProperty('--accent',theme.accent);
    root.style.setProperty('--card-border',theme.accent+'66');
    root.style.setProperty('--card-hover',theme.accent+'22');
    root.style.setProperty('--bg',theme.bg);
    if(body){ body.dataset.cosmicTheme=key; body.style.setProperty('--cosmic-bg',theme.bg); body.style.setProperty('--cosmic-accent',theme.accent); body.style.setProperty('--accent',theme.accent); }
    root.classList.toggle('cosmic-rgb-theme',key==='rgb');
  }

  function applyBackground(){
    if(!body)return;
    const image=get('cosmic-bg-image','');
    const interactive=get('cosmic-interactive-bg','true')==='true';
    const animations=get('cosmic-ui-animations','true')==='true';
    body.classList.toggle('cosmic-interactive-bg',interactive&&animations&&!image);
    body.classList.toggle('cosmic-no-animations',!animations);
    if(image){body.style.backgroundImage=`linear-gradient(rgba(0,0,0,.48),rgba(0,0,0,.48)),url("${image}")`;body.style.backgroundAttachment='fixed';body.style.backgroundSize='cover';body.style.backgroundPosition='center';}
    else {body.style.backgroundImage='';body.style.backgroundAttachment='';body.style.backgroundSize='';body.style.backgroundPosition='';}
  }
  function applyAll(){applyTheme(get('cosmic-theme','default'));applyBackground();}

  const style=document.createElement('style');
  style.id='cosmic-settings-engine-style';
  style.textContent=`
    :root{--cosmic-bg:#061410;--cosmic-accent:#2dccff;--accent:#2dccff}
    body.cosmic-interactive-bg{background-color:var(--cosmic-bg)!important;background-image:radial-gradient(circle at var(--cosmic-mx,20%) var(--cosmic-my,20%),color-mix(in srgb,var(--cosmic-accent) 14%,transparent),transparent 30%),radial-gradient(circle at 80% 80%,color-mix(in srgb,var(--cosmic-accent) 8%,transparent),transparent 35%)!important}
    body.cosmic-no-animations *,body.cosmic-no-animations *::before,body.cosmic-no-animations *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
    .cosmic-rgb-theme{animation:cosmicRgb 7s linear infinite}
    @keyframes cosmicRgb{0%{--cosmic-accent:#ff0055;--accent:#ff0055}33%{--cosmic-accent:#00ff88;--accent:#00ff88}66%{--cosmic-accent:#0088ff;--accent:#0088ff}100%{--cosmic-accent:#ff0055;--accent:#ff0055}}
  `;
  document.head.appendChild(style);
  document.addEventListener('mousemove',e=>{if(!body||!body.classList.contains('cosmic-interactive-bg'))return;body.style.setProperty('--cosmic-mx',`${e.clientX/innerWidth*100}%`);body.style.setProperty('--cosmic-my',`${e.clientY/innerHeight*100}%`);});
  window.CosmicSettings={THEMES,applyTheme,applyBackground,applyAll};
  applyAll();
})();
