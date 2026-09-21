(() => {
  'use strict';

  const STYLE_ID = 'cosmic-game-guard-style';
  const BUTTON_ID = 'cosmic-home-button';
  const SCRIPT_ID = 'cosmic-game-guard-loader';
  const RUNTIME_MARK = 'data-cosmic-runtime';
  const cosmicRoot = () => window.location.hostname.endsWith('github.io') ? '/cosmic/' : '/';

  function getHomeUrl() {
    const marker = '/pages/lessons/';
    const path = window.location.pathname || '';
    const markerIndex = path.indexOf(marker);
    const prefix = markerIndex >= 0 ? path.slice(0, markerIndex) : (window.location.hostname.endsWith('github.io') ? '/cosmic' : '');
    return window.location.origin + prefix + marker + 'lessons.html';
  }

  function addStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = `#${BUTTON_ID}{position:fixed!important;top:12px!important;left:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;padding:8px 14px!important;border:2px solid #2dccff!important;border-radius:10px!important;background:#0d1a21!important;color:#2dccff!important;font:700 14px system-ui,sans-serif!important;cursor:grab!important;user-select:none!important;touch-action:none!important;box-shadow:0 4px 16px rgba(0,0,0,.55)!important}#${BUTTON_ID}:hover{background:#16303b!important}#${BUTTON_ID}:active{cursor:grabbing!important}`;
  }

  function goHome(event) {
    if (event) event.preventDefault();
    const home = getHomeUrl();
    try { window.top.location.href = home; } catch (_) { window.location.href = home; }
  }

  function makeDraggable(button) {
    if (button.__cosmicDraggable) return;
    button.__cosmicDraggable = true;

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    button.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      const rect = button.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      button.style.cursor = 'grabbing';
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    button.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
      if (!moved) return;

      const maxLeft = Math.max(0, window.innerWidth - button.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - button.offsetHeight);
      button.style.left = `${Math.max(0, Math.min(maxLeft, startLeft + dx))}px`;
      button.style.top = `${Math.max(0, Math.min(maxTop, startTop + dy))}px`;
      event.preventDefault();
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      button.style.cursor = 'grab';
      if (button.releasePointerCapture && button.hasPointerCapture?.(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }

      if (!moved) goHome(event);
      else {
        // Suppress the synthetic click generated after a drag.
        button.__cosmicSuppressClick = true;
        setTimeout(() => { button.__cosmicSuppressClick = false; }, 0);
      }
    };

    button.addEventListener('pointerup', endDrag);
    button.addEventListener('pointercancel', () => {
      dragging = false;
      button.style.cursor = 'grab';
    });
    button.addEventListener('click', (event) => {
      if (button.__cosmicSuppressClick) {
        event.preventDefault();
        event.stopPropagation();
        button.__cosmicSuppressClick = false;
      }
    }, true);
  }

  function ensureButton() {
    if (!document.documentElement) return;
    addStyle();
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.setAttribute('aria-label', 'Return to Cosmic games');
      button.textContent = '← Home';
    }
    const parent = document.body || document.documentElement;
    if (button.parentNode !== parent) parent.appendChild(button);
    button.style.setProperty('display', 'block', 'important');
    button.style.setProperty('visibility', 'visible', 'important');
    button.style.setProperty('opacity', '1', 'important');
    button.style.setProperty('z-index', '2147483647', 'important');
    makeDraggable(button);
  }

  function patchFullscreenMethod(proto, name) {
    if (!proto || typeof proto[name] !== 'function' || proto[name]['__cosmicWrapped']) return;
    const native = proto[name];
    const wrapped = function(options) {
      const root = document.documentElement;
      if (root && this !== root) return native.call(root, options);
      return native.call(this, options);
    };
    wrapped.__cosmicWrapped = true;
    proto[name] = wrapped;
  }

  function patchFullscreen() {
    patchFullscreenMethod(Element.prototype, 'requestFullscreen');
    patchFullscreenMethod(Element.prototype, 'webkitRequestFullscreen');
    patchFullscreenMethod(Element.prototype, 'webkitRequestFullScreen');
    patchFullscreenMethod(Element.prototype, 'mozRequestFullScreen');
    patchFullscreenMethod(Element.prototype, 'msRequestFullscreen');
  }

  function ensureRuntimeCompanions() {
    const root = cosmicRoot();
    const files = [
      'scripts/cosmic-wrapper-controls.js?v=wrapper-v2',
      'scripts/cosmic-global-state.js?v=global-state',
      'scripts/cosmic-dev-tools.js?build=dev-commands'
    ];
    files.forEach(file => {
      const key = 'cosmic-runtime-' + file.split('?')[0].replace(/[^a-z0-9]/gi, '-');
      if (document.querySelector('[' + RUNTIME_MARK + '="' + key + '"]')) return;
      const script = document.createElement('script');
      script.setAttribute(RUNTIME_MARK, key);
      script.src = root + file;
      (document.head || document.documentElement).appendChild(script);
    });
  }


  function install() {
    ensureButton();
    ensureRuntimeCompanions();
    patchFullscreen();
    if (!document.__cosmicHomeObserver) {
      document.__cosmicHomeObserver = new MutationObserver(() => ensureButton());
      document.__cosmicHomeObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    if (!document.__cosmicFullscreenListenerInstalled) {
      document.__cosmicFullscreenListenerInstalled = true;
      document.addEventListener('fullscreenchange', ensureButton);
      document.addEventListener('webkitfullscreenchange', ensureButton);
      document.addEventListener('mozfullscreenchange', ensureButton);
      document.addEventListener('MSFullscreenChange', ensureButton);
    }
  }

  if (!Document.prototype.__cosmicWriteGuardPatched) {
    Document.prototype.__cosmicWriteGuardPatched = true;
    const nativeWrite = Document.prototype.write;
    Document.prototype.write = function (...args) {
      let html = args.join('');
      if (/<html(?:\s|>)/i.test(html) && !html.includes(SCRIPT_ID)) {
        const root = cosmicRoot();
        const reinject = `<script id="cosmic-game-guard-reinject" src="${root}scripts/game-guard.js?v=guard"><\\/script>`;
        html = /<head(?:\s|>)/i.test(html)
          ? html.replace(/<head(?:\s|>)/i, match => match + reinject)
          : reinject + html;
      }
      return nativeWrite.call(this, html);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
