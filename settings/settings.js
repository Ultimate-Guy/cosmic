document.addEventListener('DOMContentLoaded', () => {
  const settings = window.CosmicSettings;
  if (!settings) { console.error('Cosmic Settings Engine did not load.'); return; }
  const themes = settings.THEMES;
  const grid = document.getElementById('themeGrid');
  const current = () => localStorage.getItem('cosmic-theme') || 'default';

  Object.entries(themes).forEach(([id, theme]) => {
    const card = document.createElement('button');
    card.type='button'; card.className='theme-card'; card.dataset.theme=id;
    card.innerHTML=`<div class="theme-swatch" style="background:${theme.bg};border:1px solid ${theme.accent};box-shadow:0 0 8px ${theme.accent}55"></div><div class="theme-name">${theme.label}</div>`;
    card.addEventListener('click',()=>{settings.applyTheme(id);settings.applyBackground();markTheme();});
    grid.appendChild(card);
  });
  function markTheme(){document.querySelectorAll('.theme-card').forEach(c=>c.classList.toggle('active',c.dataset.theme===current()));}
  markTheme();

  const interactive=document.getElementById('interactiveBgToggle');
  interactive.checked=localStorage.getItem('cosmic-interactive-bg')!=='false';
  interactive.addEventListener('change',()=>{localStorage.setItem('cosmic-interactive-bg',interactive.checked);settings.applyBackground();});

  const anim=document.getElementById('animToggle');
  anim.checked=localStorage.getItem('cosmic-ui-animations')!=='false';
  anim.addEventListener('change',()=>{localStorage.setItem('cosmic-ui-animations',anim.checked);settings.applyBackground();});

  const study=document.getElementById('studyCloakToggle');
  study.checked=localStorage.getItem('disableStudyCloak')==='true';
  study.addEventListener('change',()=>{localStorage.setItem('disableStudyCloak',study.checked);settings.applyStudyCloak();});

  const bgInput=document.getElementById('bgImageInput');
  const bgPreview=document.getElementById('bgImagePreview');
  const savedImage=localStorage.getItem('cosmic-bg-image');
  function showImage(value){bgPreview.classList.toggle('hidden',!value);if(value)bgPreview.style.backgroundImage=`url(\"${value}\")`;}
  showImage(savedImage);
  bgInput.addEventListener('change',()=>{
    const file=bgInput.files&&bgInput.files[0];
    if(!file)return;
    if(!file.type.startsWith('image/')){alert('Please choose an image file.');bgInput.value='';return;}
    if(file.size>2.5*1024*1024){alert('Image is too large. Maximum size is about 2.5 MB.');bgInput.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{try{localStorage.setItem('cosmic-bg-image',reader.result);showImage(reader.result);settings.applyBackground();}catch{alert('Could not save the image. Browser storage may be full.');}};
    reader.readAsDataURL(file);
  });
  document.getElementById('clearBgImageBtn').addEventListener('click',()=>{localStorage.removeItem('cosmic-bg-image');bgInput.value='';showImage('');settings.applyBackground();});

  const crosshair=document.getElementById('crosshair-style-select');
  crosshair.value=localStorage.getItem('cosmic-crosshair')||'none';
  crosshair.addEventListener('change',()=>{localStorage.setItem('cosmic-crosshair',crosshair.value);settings.applyCrosshair();});

  const musicEnable=document.getElementById('musicEnable');
  const musicMute=document.getElementById('musicMute');
  const musicVolume=document.getElementById('musicVolume');
  const musicLabel=document.getElementById('musicVolumeLabel');
  const musicTrack=document.getElementById('musicTrack');
  const musicUpload=document.getElementById('musicUpload');
  const musicStatus=document.getElementById('musicStatus');
  function updateMusicStatus(){
    const custom=localStorage.getItem('cosmic-music-custom');
    const track=localStorage.getItem('cosmic-music-track')||'library-default';
    const enabled=localStorage.getItem('cosmic-music-enabled')==='true';
    if(track==='custom'&&custom)musicStatus.textContent=enabled?'Uploaded MP3 is ready and will play after a user interaction.':'Uploaded MP3 saved. Enable music to play it.';
    else musicStatus.textContent='No bundled Cosmic track is installed yet. Upload an MP3 to use background music.';
  }
  musicEnable.checked=localStorage.getItem('cosmic-music-enabled')==='true';
  musicMute.checked=localStorage.getItem('cosmic-music-muted')==='true';
  musicVolume.value=localStorage.getItem('cosmic-music-volume')||'35';
  musicTrack.value=localStorage.getItem('cosmic-music-track')||'library-default';
  musicLabel.textContent=`${musicVolume.value}%`;
  updateMusicStatus();
  musicEnable.addEventListener('change',()=>{localStorage.setItem('cosmic-music-enabled',musicEnable.checked);settings.applyMusic();updateMusicStatus();});
  musicMute.addEventListener('change',()=>{localStorage.setItem('cosmic-music-muted',musicMute.checked);settings.applyMusic();});
  musicVolume.addEventListener('input',()=>{musicLabel.textContent=`${musicVolume.value}%`;localStorage.setItem('cosmic-music-volume',musicVolume.value);settings.applyMusic();});
  musicTrack.addEventListener('change',()=>{localStorage.setItem('cosmic-music-track',musicTrack.value);settings.applyMusic();updateMusicStatus();});
  musicUpload.addEventListener('change',()=>{
    const file=musicUpload.files&&musicUpload.files[0];
    if(!file)return;
    if(file.size>2.5*1024*1024){alert('MP3 is too large. Maximum size is about 2.5 MB.');musicUpload.value='';return;}
    if(!/audio\/(mpeg|mp3)/.test(file.type)&&!file.name.toLowerCase().endsWith('.mp3')){alert('Please choose an MP3 file.');musicUpload.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{try{localStorage.setItem('cosmic-music-custom',reader.result);localStorage.setItem('cosmic-music-track','custom');localStorage.setItem('cosmic-music-enabled','true');musicTrack.value='custom';musicEnable.checked=true;settings.applyMusic();updateMusicStatus();}catch{alert('Could not save the MP3. Browser storage may be full.');}};
    reader.readAsDataURL(file);
  });

  const cloakSelect=document.getElementById('cloakSelect');
  const cloakGrid=document.getElementById('cloakGrid');
  const cloakPresets=[
    ['none','None','No tab cloak','fa-ban','#64748b'],
    ['google','Google Search','Google Search','fa-magnifying-glass','#4285f4'],
    ['classroom','Google Classroom','Google Classroom','fa-chalkboard','#1967d2'],
    ['canvas','Canvas','Canvas','fa-layer-group','#e66000'],
    ['drive','Google Drive','Google Drive','fa-hard-drive','#0f9d58']
  ];
  const savedCloak=localStorage.getItem('savedCloak')||'none';
  cloakSelect.value=cloakPresets.some(p=>p[0]===savedCloak)?savedCloak:'none';
  cloakPresets.forEach(([id,label,sub,icon,accent])=>{
    const card=document.createElement('button');
    card.type='button';card.className='cloak-card';card.dataset.cloak=id;card.setAttribute('role','radio');
    card.setAttribute('aria-checked',id===cloakSelect.value?'true':'false');
    card.innerHTML=`<span class="cloak-icon" style="--cloak-accent:${accent}"><i class="fas ${icon}"></i></span><span class="cloak-copy"><strong>${label}</strong><small>${sub}</small></span><span class="cloak-check"><i class="fas fa-check"></i></span>`;
    card.addEventListener('click',()=>{
      cloakSelect.value=id;
      if(id==='none')localStorage.removeItem('savedCloak');else localStorage.setItem('savedCloak',id);
      cloakGrid.querySelectorAll('.cloak-card').forEach(c=>{const active=c.dataset.cloak===id;c.classList.toggle('active',active);c.setAttribute('aria-checked',active?'true':'false');});
      settings.applyCloak();
    });
    cloakGrid.appendChild(card);
  });
  cloakGrid.querySelectorAll('.cloak-card').forEach(c=>c.classList.toggle('active',c.dataset.cloak===cloakSelect.value));

  const panicKey=document.getElementById('panicKeyInput'),panicUrl=document.getElementById('panicUrlInput');
  panicKey.value=localStorage.getItem('cosmic-panic-key')||'`';
  panicUrl.value=localStorage.getItem('cosmic-panic-url')||'';
  panicKey.addEventListener('keydown',e=>{e.preventDefault();if(['Escape','Shift','Control','Alt','Meta'].includes(e.key))return;panicKey.value=e.key;localStorage.setItem('cosmic-panic-key',e.key);settings.applyPanicShortcut();panicKey.blur();});
  panicUrl.addEventListener('change',()=>{localStorage.setItem('cosmic-panic-url',panicUrl.value.trim());settings.applyPanicShortcut();});

  document.getElementById('clearDataBtn').addEventListener('click',()=>{
    if(!confirm('Reset all Cosmic settings saved in this browser?'))return;
    Object.keys(localStorage).filter(k=>k.startsWith('cosmic-')||['disableStudyCloak','savedCloak'].includes(k)).forEach(k=>localStorage.removeItem(k));
    alert('Cosmic settings reset. Reloading…'); location.reload();
  });
  document.getElementById('backButton').addEventListener('click',()=>{if(history.length>1)history.back();else window.location.href='../pages/lessons/lessons.html';});
});
