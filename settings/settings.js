document.addEventListener('DOMContentLoaded', () => {
  const themes = window.CosmicSettings.THEMES;
  const grid = document.getElementById('themeGrid');
  const current = () => localStorage.getItem('cosmic-theme') || 'default';

  Object.entries(themes).forEach(([id, theme]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.theme = id;
    card.innerHTML = `<div class="theme-swatch" style="background:${theme.bg};border:1px solid ${theme.accent};box-shadow:0 0 8px ${theme.accent}55"></div><div class="theme-name">${theme.label}</div>`;
    card.addEventListener('click', () => {
      window.CosmicSettings.applyTheme(id);
      markTheme();
    });
    grid.appendChild(card);
  });
  function markTheme() { document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === current())); }
  markTheme();

  const interactive = document.getElementById('interactiveBgToggle');
  interactive.checked = localStorage.getItem('cosmic-interactive-bg') !== 'false';
  interactive.addEventListener('change', () => { localStorage.setItem('cosmic-interactive-bg', interactive.checked); window.CosmicSettings.applyBackground(); });

  const anim = document.getElementById('animToggle');
  anim.checked = localStorage.getItem('cosmic-ui-animations') !== 'false';
  anim.addEventListener('change', () => { localStorage.setItem('cosmic-ui-animations', anim.checked); if (!anim.checked) localStorage.setItem('cosmic-interactive-bg', 'false'); window.CosmicSettings.applyBackground(); if (interactive) interactive.checked = localStorage.getItem('cosmic-interactive-bg') !== 'false'; });

  const study = document.getElementById('studyCloakToggle');
  study.checked = localStorage.getItem('disableStudyCloak') === 'true';
  study.addEventListener('change', () => localStorage.setItem('disableStudyCloak', study.checked));

  const bgInput = document.getElementById('bgImageInput');
  const bgPreview = document.getElementById('bgImagePreview');
  const savedImage = localStorage.getItem('cosmic-bg-image');
  function showImage(value) { bgPreview.classList.toggle('hidden', !value); if (value) bgPreview.style.backgroundImage = `url("${value}")`; }
  showImage(savedImage);
  bgInput.addEventListener('change', () => {
    const file = bgInput.files && bgInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); bgInput.value=''; return; }
    if (file.size > 2.5 * 1024 * 1024) { alert('Image is too large. Maximum size is about 2.5 MB.'); bgInput.value=''; return; }
    const reader = new FileReader();
    reader.onload = () => { try { localStorage.setItem('cosmic-bg-image', reader.result); showImage(reader.result); window.CosmicSettings.applyBackground(); } catch { alert('Could not save the image. Browser storage may be full.'); } };
    reader.readAsDataURL(file);
  });
  document.getElementById('clearBgImageBtn').addEventListener('click', () => { localStorage.removeItem('cosmic-bg-image'); bgInput.value=''; showImage(''); window.CosmicSettings.applyBackground(); });

  const musicEnable = document.getElementById('musicEnable');
  const musicMute = document.getElementById('musicMute');
  const musicVolume = document.getElementById('musicVolume');
  const musicLabel = document.getElementById('musicVolumeLabel');
  musicEnable.checked = localStorage.getItem('cosmic-music-enabled') === 'true';
  musicMute.checked = localStorage.getItem('cosmic-music-muted') === 'true';
  musicVolume.value = localStorage.getItem('cosmic-music-volume') || '35';
  musicLabel.textContent = `${musicVolume.value}%`;
  musicEnable.addEventListener('change', () => localStorage.setItem('cosmic-music-enabled', musicEnable.checked));
  musicMute.addEventListener('change', () => localStorage.setItem('cosmic-music-muted', musicMute.checked));
  musicVolume.addEventListener('input', () => { musicLabel.textContent=`${musicVolume.value}%`; localStorage.setItem('cosmic-music-volume', musicVolume.value); });

  const cloak = document.getElementById('cloakSelect');
  cloak.value = localStorage.getItem('savedCloak') || 'none';
  cloak.addEventListener('change', () => { if (cloak.value === 'none') localStorage.removeItem('savedCloak'); else localStorage.setItem('savedCloak', cloak.value); });

  const panicKey = document.getElementById('panicKeyInput');
  const panicUrl = document.getElementById('panicUrlInput');
  panicKey.value = localStorage.getItem('cosmic-panic-key') || '`';
  panicUrl.value = localStorage.getItem('cosmic-panic-url') || '';
  panicKey.addEventListener('keydown', e => { e.preventDefault(); if (['Escape','Shift','Control','Alt','Meta'].includes(e.key)) return; panicKey.value=e.key; localStorage.setItem('cosmic-panic-key',e.key); panicKey.blur(); });
  panicUrl.addEventListener('change', () => localStorage.setItem('cosmic-panic-url', panicUrl.value.trim()));
  window.addEventListener('keydown', e => { const key=localStorage.getItem('cosmic-panic-key'); const url=localStorage.getItem('cosmic-panic-url'); if (key && url && e.key === key && document.activeElement !== panicKey && document.activeElement !== panicUrl) window.location.href=url; });

  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (!confirm('Reset all Cosmic settings saved in this browser?')) return;
    Object.keys(localStorage).filter(k => k.startsWith('cosmic-') || ['disableStudyCloak','savedCloak'].includes(k)).forEach(k => localStorage.removeItem(k));
    alert('Cosmic settings reset. Reloading…');
    location.reload();
  });

  document.getElementById('backButton').addEventListener('click', () => {
    if (history.length > 1) history.back(); else window.location.href='../pages/lessons/lessons.html';
  });
});
