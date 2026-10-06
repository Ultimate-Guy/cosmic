(() => {
  'use strict';

  if (window.__COSMIC_WRAPPER_CONTROLS_LOADER__) return;
  window.__COSMIC_WRAPPER_CONTROLS_LOADER__ = true;

  const cosmicRoot = () => location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  const loadGlobalState = () => {
    if (window.__COSMIC_GLOBAL_STATE__ || document.querySelector('script[data-cosmic-global-state]')) return;
    const s = document.createElement('script');
    s.dataset.cosmicGlobalState = '1';
    s.src = cosmicRoot() + 'scripts/cosmic-global-state.js?v=global-state';
    (document.head || document.documentElement).appendChild(s);
  };

  loadGlobalState();

  const findFrame = () => document.querySelector('#game,#appframe,#unity-canvas,canvas,iframe');

  const buttonStyle = 'width:34px;height:32px;border:1px solid #2dccff;border-radius:8px;background:#0d1a21;color:#2dccff;font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);touch-action:none';
  const warningStyle = 'width:34px;height:32px;border:1px solid #ffb454;border-radius:8px;background:#241b0e;color:#ffc66d;font:700 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);touch-action:none';

  async function resolveCurrentGameName() {
    const base = cosmicRoot();
    let targetPath = location.pathname || '';

    try {
      const raw = new URLSearchParams(location.search).get('game');
      if (raw) targetPath = new URL(raw, location.href).pathname || targetPath;
    } catch (_) {}

    const normalize = value => {
      try {
        return decodeURIComponent(String(value || '')).replace(/\\/g, '/').replace(/\/index\.html$/i, '').replace(/\/+$/, '').toLowerCase();
      } catch (_) {
        return String(value || '').toLowerCase().replace(/\/index\.html$/i, '').replace(/\/+$/, '');
      }
    };

    const current = normalize(targetPath);
    try {
      const response = await fetch(base + 'pages/lessons/games.json?report=' + Date.now(), { cache: 'no-store' });
      if (response.ok) {
        const games = await response.json();
        if (Array.isArray(games)) {
          for (const game of games) {
            if (!game || !game.path || !game.name) continue;
            const gamePath = new URL(base + game.path + (game.entry || ''), location.origin).pathname;
            const normalized = normalize(gamePath);
            if (current === normalized || current.startsWith(normalized + '/')) return String(game.name);
          }
        }
      }
    } catch (_) {}

    try {
      const parts = decodeURIComponent(targetPath).split('/').filter(Boolean);
      const lessons = parts.map(x => x.toLowerCase()).lastIndexOf('lessons');
      if (lessons >= 0 && parts[lessons + 1]) return parts[lessons + 1].replace(/[-_]+/g, ' ');
    } catch (_) {}

    return 'Current game';
  }

  function install() {
    if (document.getElementById('cosmic-wrapper-controls')) return true;

    const frame = findFrame();
    if (!document.body) return false;

    if (!document.getElementById('cosmic-game-home')) {
      const home = document.createElement('button');
      home.id = 'cosmic-game-home';
      home.type = 'button';
      home.textContent = '← Home';
      home.title = 'Return to Cosmic games';
      home.setAttribute('aria-label', 'Return to Cosmic games');
      home.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647;padding:9px 15px;border:2px solid #2dccff;border-radius:10px;background:#0d1a21;color:#2dccff;font:700 14px system-ui,sans-serif;cursor:pointer;user-select:none;touch-action:none;box-shadow:0 4px 16px rgba(0,0,0,.55)';
      home.addEventListener('click', () => { location.href = cosmicRoot() + 'pages/lessons/lessons.html'; });
      document.body.appendChild(home);
    }

    if (!frame) return false;

    const wrap = document.createElement('div');
    wrap.id = 'cosmic-wrapper-controls';
    wrap.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;display:flex;gap:5px;align-items:center;padding:5px;border:1px solid rgba(45,204,255,.24);border-radius:11px;background:rgba(5,14,21,.92);backdrop-filter:blur(8px);box-shadow:0 6px 22px rgba(0,0,0,.5);cursor:grab;user-select:none;touch-action:none';

    const add = (label, title, fn, style = buttonStyle) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.style.cssText = style;
      b.dataset.cosmicControl = '1';
      b.addEventListener('click', e => {
        if (b.dataset.dragged === '1') {
          b.dataset.dragged = '0';
          return;
        }
        fn(e);
      });
      wrap.appendChild(b);
      return b;
    };

    add('⛶', 'Fullscreen', async () => {
      try {
        if (frame.requestFullscreen) await frame.requestFullscreen();
        else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      } catch (_) {}
    });

    add('↻', 'Reload', () => {
      try {
        if (frame.tagName === 'IFRAME' && frame.src) frame.src = frame.src;
        else location.reload();
      } catch (_) { location.reload(); }
    });

    add('↗', 'Pop out', () => {
      try {
        const source = frame.tagName === 'IFRAME' && frame.src ? frame.src : location.href;
        const escaped = source.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosmic</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe id="cosmic-popout" src="' + escaped + '" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe><button id="fs" style="position:fixed;right:12px;bottom:12px;padding:9px 12px;border:1px solid #2dccff;border-radius:9px;background:#081923;color:#8fe8ff;font:700 13px system-ui,sans-serif;cursor:pointer">Fullscreen</button><script>const f=document.getElementById("cosmic-popout"),b=document.getElementById("fs");b.onclick=()=>f.requestFullscreen?.().catch(()=>{});<\/script></body></html>';
        const win = window.open('about:blank', '_blank');
        if (!win) return;
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch (_) {}
    });

    add('⚠', 'Report this game', async () => {
      const form = 'https://docs.google.com/forms/d/e/1FAIpQLSfLFwfXdL_Fk8FGAAXPire3yIPX0qIoj3Ua1dAGQsw4pTb98Q/viewform';
      const reportTab = window.open('about:blank', '_blank');
      if (!reportTab) return;
      try {
        const url = new URL(form);
        url.searchParams.set('usp', 'pp_url');
        url.searchParams.set('entry.1659521365', await resolveCurrentGameName());
        reportTab.location.href = url.href;
      } catch (_) {
        reportTab.location.href = form;
      }
    }, warningStyle);

    document.body.appendChild(wrap);

    let dragging = false, moved = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

    wrap.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('button')) return;
      const r = wrap.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = r.left;
      startTop = r.top;
      wrap.style.left = r.left + 'px';
      wrap.style.top = r.top + 'px';
      wrap.style.right = 'auto';
      wrap.style.cursor = 'grabbing';
      wrap.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    wrap.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
      if (moved) {
        wrap.style.left = Math.max(0, Math.min(window.innerWidth - wrap.offsetWidth, startLeft + dx)) + 'px';
        wrap.style.top = Math.max(0, Math.min(window.innerHeight - wrap.offsetHeight, startTop + dy)) + 'px';
        e.preventDefault();
      }
    });

    const stop = e => {
      if (!dragging) return;
      dragging = false;
      wrap.style.cursor = 'grab';
      if (wrap.releasePointerCapture?.(e.pointerId) && wrap.hasPointerCapture?.(e.pointerId)) wrap.releasePointerCapture(e.pointerId);
    };
    wrap.addEventListener('pointerup', stop);
    wrap.addEventListener('pointercancel', () => { dragging = false; wrap.style.cursor = 'grab'; });

    window.addEventListener('resize', () => {
      if (!wrap.isConnected) return;
      const r = wrap.getBoundingClientRect();
      wrap.style.left = Math.max(0, Math.min(window.innerWidth - wrap.offsetWidth, r.left)) + 'px';
      wrap.style.top = Math.max(0, Math.min(window.innerHeight - wrap.offsetHeight, r.top)) + 'px';
    });

    return true;
  }

  const tryInstall = () => {
    loadGlobalState();
    if (install()) return;
  };

  tryInstall();
  let attempts = 0;
  const timer = setInterval(() => {
    tryInstall();
    attempts++;
    if (attempts >= 80 || document.getElementById('cosmic-wrapper-controls')) clearInterval(timer);
  }, 250);

  if (!window.__COSMIC_WRAPPER_OBSERVER__) {
    window.__COSMIC_WRAPPER_OBSERVER__ = true;
    const observer = new MutationObserver(() => {
      if (!document.getElementById('cosmic-wrapper-controls')) install();
    });
    const observe = () => document.documentElement && observer.observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
    else observe();
  }
})();