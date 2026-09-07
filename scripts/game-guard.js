(() => {
  'use strict';

  const STYLE_ID = 'cosmic-game-guard-style';
  const BUTTON_ID = 'cosmic-home-button';
  const SCRIPT_ID = 'cosmic-game-guard-loader';

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
    style.textContent = `#${BUTTON_ID}{position:fixed!important;top:12px!important;left:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;padding:8px 14px!important;border:2px solid #2dccff!important;border-radius:10px!important;background:#0d1a21!important;color:#2dccff!important;font:700 14px system-ui,sans-serif!important;cursor:pointer!important;box-shadow:0 4px 16px rgba(0,0,0,.55)!important}#${BUTTON_ID}:hover{background:#16303b!important}`;
  }

  function goHome(event) {
    if (event) event.preventDefault();
    const home = getHomeUrl();
    try { window.top.location.href = home; } catch (_) { window.location.href = home; }
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
      button.addEventListener('click', goHome, true);
    }
    const parent = document.body || document.documentElement;
    if (button.parentNode !== parent) parent.appendChild(button);
    button.style.setProperty('display', 'block', 'important');
    button.style.setProperty('visibility', 'visible', 'important');
    button.style.setProperty('opacity', '1', 'important');
    button.style.setProperty('z-index', '2147483647', 'important');
  }

  function patchFullscreen() {
    const proto = Element.prototype;
    const native = proto.requestFullscreen;
    if (typeof native !== 'function' || proto.__cosmicHomeFullscreenPatched) return;
    proto.__cosmicHomeFullscreenPatched = true;
    proto.requestFullscreen = function(options) {
      const root = document.documentElement;
      if (root && this !== root) return native.call(root, options);
      return native.call(this, options);
    };
  }

  function install() {
    ensureButton();
    patchFullscreen();
    if (!document.__cosmicHomeObserver) {
      document.__cosmicHomeObserver = new MutationObserver(() => ensureButton());
      document.__cosmicHomeObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    if (!document.__cosmicFullscreenListenerInstalled) {
      document.__cosmicFullscreenListenerInstalled = true;
      document.addEventListener('fullscreenchange', ensureButton);
    }
  }

  if (!Document.prototype.__cosmicWriteGuardPatched) {
    Document.prototype.__cosmicWriteGuardPatched = true;
    const nativeWrite = Document.prototype.write;
    Document.prototype.write = function (...args) {
      let html = args.join('');
      if (/<html(?:\s|>)/i.test(html) && !html.includes(SCRIPT_ID)) {
        const scriptSrc = document.currentScript && document.currentScript.src
          ? document.currentScript.src
          : new URL('/cosmic/scripts/game-guard.js?v=guard', window.location.origin).href;
        const reinject = `<script id="cosmic-game-guard-reinject" src="${scriptSrc}"><\\/script>`;
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
