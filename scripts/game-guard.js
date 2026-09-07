(() => {
  'use strict';

  // Build the Games URL from the page the game is actually running on.
  // This keeps a custom/Cloudflare host instead of forcing GitHub Pages.
  const GUARD_URL = new URL('/cosmic/scripts/game-guard.js?v=guard4', window.location.origin).href;
  const STYLE_ID = 'cosmic-game-guard-style';
  const BUTTON_ID = 'cosmic-home-button';

  function getHomeUrl() {
    const current = new URL(window.location.href);
    const marker = '/pages/lessons/';
    const index = current.pathname.indexOf(marker);
    if (index !== -1) {
      return new URL(current.pathname.slice(0, index) + '/pages/lessons/lessons.html', current.origin).href;
    }
    return new URL('/cosmic/pages/lessons/lessons.html', current.origin).href;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `#${BUTTON_ID}{position:fixed!important;top:12px!important;left:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;padding:7px 12px!important;border:1px solid rgba(45,204,255,.55)!important;border-radius:9px!important;background:rgba(13,26,33,.95)!important;color:#2dccff!important;font:700 13px system-ui,sans-serif!important;cursor:pointer!important;box-shadow:0 4px 14px rgba(0,0,0,.35)!important;box-sizing:border-box!important;width:auto!important;height:auto!important}`;
    (document.head || document.documentElement).appendChild(style);
  }

  function goHome(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    const homeUrl = getHomeUrl();
    try {
      window.top.location.assign(homeUrl);
    } catch (_) {
      window.location.assign(homeUrl);
    }
  }

  function makeButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.setAttribute('aria-label', 'Return to Cosmic games');
    button.textContent = '← Home';
    button.addEventListener('click', goHome, { capture: true });
    button.addEventListener('pointerdown', event => event.stopPropagation(), { capture: true });
    button.addEventListener('mousedown', event => event.stopPropagation(), { capture: true });
    return button;
  }

  function ensureButton(target) {
    const root = target || document.body;
    if (!root || !root.appendChild) return null;
    let button = document.getElementById(BUTTON_ID);
    if (!button) button = makeButton();
    if (button.parentNode !== root && root !== document.body) {
      try { root.appendChild(button); } catch (_) {}
    } else if (!button.parentNode) {
      root.appendChild(button);
    }
    return button;
  }

  function keepButtonAlive() {
    if (!document.body || document.__cosmicGuardObserver) return;
    const observer = new MutationObserver(() => {
      if (document.body && !document.getElementById(BUTTON_ID)) ensureButton();
    });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    document.__cosmicGuardObserver = observer;
  }

  function install() {
    addStyle();
    ensureButton();
    keepButtonAlive();

    if (!document.__cosmicFullscreenListenerInstalled) {
      document.__cosmicFullscreenListenerInstalled = true;
      document.addEventListener('fullscreenchange', () => {
        addStyle();
        const fullscreenElement = document.fullscreenElement;
        if (fullscreenElement && fullscreenElement.nodeType === 1 && fullscreenElement !== document.documentElement) {
          ensureButton(fullscreenElement);
        } else {
          ensureButton();
        }
      });
    }
  }

  // Only Smash Karts needs document.write protection. Most games do not use it,
  // so never patch document.write globally and risk changing another game's loader.
  const isSmashKarts = decodeURIComponent(window.location.pathname).toLowerCase().includes('/smash karts/');
  if (isSmashKarts && !Document.prototype.__cosmicSmashWriteGuardPatched) {
    Document.prototype.__cosmicSmashWriteGuardPatched = true;
    const nativeWrite = Document.prototype.write;
    Document.prototype.write = function (...args) {
      let html = args.join('');
      if (/<html(?:\s|>)/i.test(html) && !html.includes('cosmic-game-guard-reinject')) {
        const reinject = '<script id="cosmic-game-guard-reinject" src="' + GUARD_URL + '"></' + 'script>';
        if (/<head(?:\s|>)/i.test(html)) {
          html = html.replace(/<head(?:\s|>)/i, match => match + reinject);
        } else {
          html = reinject + html;
        }
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
