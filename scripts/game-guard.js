(() => {
  'use strict';

  const HOME_URL = new URL('../lessons.html', window.location.href).href;
  const STYLE_ID = 'cosmic-game-guard-style';
  const BUTTON_ID = 'cosmic-home-button';

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{
        position:fixed !important;
        top:12px !important;
        left:12px !important;
        z-index:2147483647 !important;
        display:block !important;
        visibility:visible !important;
        opacity:1 !important;
        pointer-events:auto !important;
        padding:7px 12px !important;
        border:1px solid rgba(45,204,255,.55) !important;
        border-radius:9px !important;
        background:rgba(13,26,33,.95) !important;
        color:#2dccff !important;
        font:700 13px system-ui,sans-serif !important;
        cursor:pointer !important;
        box-shadow:0 4px 14px rgba(0,0,0,.35) !important;
      }
      #${BUTTON_ID}:hover{background:rgba(45,204,255,.18) !important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function goHome() {
    try { window.top.location.assign(HOME_URL); }
    catch { window.location.assign(HOME_URL); }
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
    }
    return button;
  }

  function patchFullscreen() {
    const proto = Element.prototype;
    const native = proto.requestFullscreen;
    if (typeof native !== 'function' || proto.__cosmicHomeFullscreenPatched) return;

    proto.__cosmicHomeFullscreenPatched = true;
    proto.requestFullscreen = function(options) {
      // Fullscreen the document instead of an individual game element.
      // That keeps the Cosmic Home button inside the fullscreen document.
      const root = document.documentElement;
      if (root && this !== root) return native.call(root, options);
      return native.call(this, options);
    };
  }

  function install() {
    addStyle();
    ensureButton();
    patchFullscreen();

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
