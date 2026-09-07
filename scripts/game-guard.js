(() => {
  'use strict';

  const HOME_URL = 'https://ultimate-guy.github.io/cosmic/pages/lessons/lessons.html';
  const GUARD_URL = 'https://ultimate-guy.github.io/cosmic/scripts/game-guard.js?v=guard';
  const STYLE_ID = 'cosmic-game-guard-style';
  const BUTTON_ID = 'cosmic-home-button';

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `#${BUTTON_ID}{position:fixed!important;top:12px!important;left:12px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;padding:7px 12px!important;border:1px solid rgba(45,204,255,.55)!important;border-radius:9px!important;background:rgba(13,26,33,.95)!important;color:#2dccff!important;font:700 13px system-ui,sans-serif!important;cursor:pointer!important;box-shadow:0 4px 14px rgba(0,0,0,.35)!important}#${BUTTON_ID}:hover{background:rgba(45,204,255,.18)!important}`;
    (document.head || document.documentElement).appendChild(style);
  }

  function goHome() {
    window.top.location.assign(HOME_URL);
  }

  function ensureButton() {
    if (!document.body) return null;
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.setAttribute('aria-label', 'Return to Cosmic games');
      button.textContent = '← Home';
      button.addEventListener('click', goHome);
      document.body.appendChild(button);
    } else if (!button.onclick) {
      button.onclick = goHome;
    }
    return button;
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
    addStyle();
    ensureButton();
    patchFullscreen();
    if (!document.__cosmicFullscreenListenerInstalled) {
      document.__cosmicFullscreenListenerInstalled = true;
      document.addEventListener('fullscreenchange', () => {
        addStyle();
        const button = ensureButton();
        if (button) {
          button.style.setProperty('display', 'block', 'important');
          button.style.setProperty('visibility', 'visible', 'important');
          button.style.setProperty('opacity', '1', 'important');
          button.style.setProperty('z-index', '2147483647', 'important');
        }
      });
    }
  }

  if (!Document.prototype.__cosmicWriteGuardPatched) {
    Document.prototype.__cosmicWriteGuardPatched = true;
    const nativeWrite = Document.prototype.write;
    Document.prototype.write = function (...args) {
      let html = args.join('');
      if (/<html(?:\s|>)/i.test(html) && !html.includes('cosmic-game-guard-reinject')) {
        const reinject = `<script id="cosmic-game-guard-reinject" src="${GUARD_URL}"><\\/script>`;
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
