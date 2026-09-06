document.addEventListener('DOMContentLoaded', () => {
  const themes = window.CosmicSettings.THEMES;
  const grid = document.getElementById('themeGrid');
  const current = () => localStorage.getItem('cosmic-theme') || 'default';

  Object.entries(themes).forEach(([id, theme]) => {
    const card = document.createElement('button'); card.type='button'; card.className='theme-card'; card.dataset.theme=id;
    card.innerHTML=`<div class="theme-swatch" style="background:${theme.bg};border:1px solid ${theme.accent};box-shadow:0 0 8px ${theme.accent}55"></div><div class="theme-name">${theme.label}</div>`;
    card.addEventListener('click',()=>{window.CosmicSettings.applyTheme(id);markTheme();}); grid.appendChild(card);
  });
  function markTheme(){document.querySelectorAll('.theme-card').forEach(c=>c.classList.toggle('active',c.dataset.theme===current()));} markTheme();

  const interactive=document.getElementById('interactiveBgToggle'); interactive.checked=localStorage.getItem('cosmic-interactive-bg')!=='false';
  interactive.addEventListener('change',()=>{localStorage.setItem('cosmic-interactive-bg',interactive.checked);window.CosmicSettings.applyBackground();});
  const anim=document.getElementById('animToggle'); anim.checked=localStorage.getItem('cosmic-ui-animations')!=='false';
  anim.addEventListener('change',()=>{localStorage.setItem('cosmic-ui-animations',anim.checked);if(!anim.checked)localStorage.setItem('cosmic-interactive-bg','false');window.CosmicSettings.applyBackground();interactive.checked=localStorage.getItem('cosmic-interactive-bg')!=='false';});
  const study=document.getElementById('studyCloakToggle'); study.checked=localStorage.getItem('disableStudyCloak')==='true'; study.addEventListener('change',()=>localStorage.setItem('disableStudyCloak',study.checked));

  const bgInput=document.getElementById('bgImageInput'),bgPreview=document.getElementById('bgImagePreview'),savedImage=localStorage.getItem('cosmic-bg-image');
  function showImage(value){bgPreview.classList.toggle('hidden',!value);if(value)bgPreview.style.backgroundImage=`url("${value}")`;} showImage(savedImage);
  bgInput.addEventListener('change',()=>{const file=bgInput.files&&bgInput.files[0];if(!file)return;if(!file.type.startsWith('image/')){alert('Please choose an image file.');bgInput.value='';return;}if(file.size>2.5*1024*1024){alert('Image is too large. Maximum size is about 2.5 MB.');bgInput.value='';return;}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('cosmic-bg-image',reader.result);showImage(reader.result);window.CosmicSettings.applyBackground();}catch{alert('Could not save the image. Browser storage may be full.');}};reader.readAsDataURL(file);});
  document.getElementById('clearBgImageBtn').addEventListener('click',()=>{localStorage.removeItem('cosmic-bg-image');bgInput.value='';showImage('');window.CosmicSettings.applyBackground();});

  // Crosshair is opt-in so the settings page does not show an unexplained floating symbol by default.
  const crosshair=document.getElementById('crosshair-style-select');
  const CROSSHAIRS={original:['+', '#2dccff'], 'cyan-hud':['⊕','#00f2ff'], 'red-reticle':['⊙','#ff3b3b'], 'gold-lock':['✣','#ffd700'], 'minimal-dot':['•','#ffffff'], 'neon-pulse':['✦','#00ffef'], 'mono-sharp':['×','#ffffff'], 'purple-tactical':['⊹','#a855f7'], none:['','transparent']};
  function drawCrosshair(){
    let el=document.getElementById('cosmic-crosshair');
    const selected=localStorage.getItem('cosmic-crosshair')||'none';
    crosshair.value=selected;
    if(selected==='none'){
      if(el)el.remove();
      return;
    }
    if(!el){el=document.createElement('div');el.id='cosmic-crosshair';document.body.appendChild(el);Object.assign(el.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',zIndex:'99998',pointerEvents:'none',font:'700 24px/1 system-ui,sans-serif',textAlign:'center'});}
    const [symbol,color]=CROSSHAIRS[selected]||CROSSHAIRS.original;
    el.textContent=symbol;el.style.color=color;el.style.textShadow=color==='transparent'?'none':`0 0 7px ${color}`;
  }
  drawCrosshair();
  crosshair.addEventListener('change',()=>{localStorage.setItem('cosmic-crosshair',crosshair.value);drawCrosshair();});

  const musicEnable=document.getElementById('musicEnable'),musicMute=document.getElementById('musicMute'),musicVolume=document.getElementById('musicVolume'),musicLabel=document.getElementById('musicVolumeLabel'),musicTrack=document.getElementById('musicTrack'),musicUpload=document.getElementById('musicUpload'),musicStatus=document.getElementById('musicStatus');
  musicEnable.checked=localStorage.getItem('cosmic-music-enabled')==='true';musicMute.checked=localStorage.getItem('cosmic-music-muted')==='true';musicVolume.value=localStorage.getItem('cosmic-music-volume')||'35';musicTrack.value=localStorage.getItem('cosmic-music-track')||'library-default';musicLabel.textContent=`${musicVolume.value}%`;
  musicEnable.addEventListener('change',()=>localStorage.setItem('cosmic-music-enabled',musicEnable.checked));musicMute.addEventListener('change',()=>localStorage.setItem('cosmic-music-muted',musicMute.checked));musicVolume.addEventListener('input',()=>{musicLabel.textContent=`${musicVolume.value}%`;localStorage.setItem('cosmic-music-volume',musicVolume.value);});
  musicTrack.addEventListener('change',()=>{localStorage.setItem('cosmic-music-track',musicTrack.value);musicStatus.textContent=musicTrack.value==='custom'?'Uploaded track selected.':'Cosmic default selected; a bundled track will be used when available.';});
  musicUpload.addEventListener('change',()=>{const file=musicUpload.files&&musicUpload.files[0];if(!file)return;if(file.size>2.5*1024*1024){alert('MP3 is too large. Maximum size is about 2.5 MB.');musicUpload.value='';return;}if(!/audio\/(mpeg|mp3)/.test(file.type)&&!file.name.toLowerCase().endsWith('.mp3')){alert('Please choose an MP3 file.');musicUpload.value='';return;}const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('cosmic-music-custom',reader.result);localStorage.setItem('cosmic-music-track','custom');musicTrack.value='custom';musicStatus.textContent='Uploaded MP3 saved in this browser.';}catch{alert('Could not save the MP3. Browser storage may be full.');}};reader.readAsDataURL(file);});

  const cloak=document.getElementById('cloakSelect');cloak.value=localStorage.getItem('savedCloak')||'none';cloak.addEventListener('change',()=>{if(cloak.value==='none')localStorage.removeItem('savedCloak');else localStorage.setItem('savedCloak',cloak.value);window.CosmicSettings.applyAll();});
  const panicKey=document.getElementById('panicKeyInput'),panicUrl=document.getElementById('panicUrlInput');panicKey.value=localStorage.getItem('cosmic-panic-key')||'`';panicUrl.value=localStorage.getItem('cosmic-panic-url')||'';
  panicKey.addEventListener('keydown',e=>{e.preventDefault();if(['Escape','Shift','Control','Alt','Meta'].includes(e.key))return;panicKey.value=e.key;localStorage.setItem('cosmic-panic-key',e.key);panicKey.blur();});panicUrl.addEventListener('change',()=>localStorage.setItem('cosmic-panic-url',panicUrl.value.trim()));
  window.addEventListener('keydown',e=>{const key=localStorage.getItem('cosmic-panic-key'),url=localStorage.getItem('cosmic-panic-url');if(key&&url&&e.key===key&&document.activeElement!==panicKey&&document.activeElement!==panicUrl){e.preventDefault();window.top.location.assign(url);}});

  document.getElementById('clearDataBtn').addEventListener('click',()=>{if(!confirm('Reset all Cosmic settings saved in this browser?'))return;Object.keys(localStorage).filter(k=>k.startsWith('cosmic-')||['disableStudyCloak','savedCloak'].includes(k)).forEach(k=>localStorage.removeItem(k));alert('Cosmic settings reset. Reloading…');location.reload();});
  document.getElementById('backButton').addEventListener('click',()=>{if(history.length>1)history.back();else window.location.href='../pages/lessons/lessons.html';});
});
