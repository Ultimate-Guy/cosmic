(() => {
  'use strict';
  if (window.__COSMIC_GLOBAL_STATE__) return;
  window.__COSMIC_GLOBAL_STATE__ = true;

  const API = location.hostname.endsWith('.github.io')
    ? 'https://cosmicv2.v75ultimate.workers.dev'
    : location.origin;
  const DISMISS_KEY = 'cosmicGlobalAnnouncementDismissedV3';

  function removeBanner() {
    document.getElementById('cosmic-global-announcement')?.remove();
  }

  function renderAnnouncement(data) {
    const announcement = data?.announcement;
    if (!announcement?.text) {
      removeBanner();
      return;
    }

    const id = String(announcement.created_at || announcement.text);
    let dismissed = '';
    try { dismissed = localStorage.getItem(DISMISS_KEY) || ''; } catch (_) {}
    if (dismissed === id) {
      removeBanner();
      return;
    }

    let banner = document.getElementById('cosmic-global-announcement');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'cosmic-global-announcement';
      banner.style.cssText =
        'position:fixed;left:0;right:0;top:0;z-index:2147483647;' +
        'min-height:40px;display:flex;align-items:center;justify-content:center;' +
        'padding:9px 54px 9px 16px;border-bottom:1px solid #2dccff;' +
        'background:linear-gradient(90deg,rgba(5,20,28,.985),rgba(8,17,29,.985),rgba(13,12,29,.985));' +
        'color:#f2f7fa;font:700 13px system-ui,sans-serif;text-align:center;' +
        'box-shadow:0 8px 30px rgba(0,0,0,.4);backdrop-filter:blur(10px);' +
        'box-sizing:border-box;';
      const message = document.createElement('span');
      message.id = 'cosmic-global-announcement-text';
      message.style.cssText = 'display:block;max-width:min(1000px,calc(100vw - 90px));overflow-wrap:anywhere;';
      const close = document.createElement('button');
      close.type = 'button';
      close.id = 'cosmic-global-announcement-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'Dismiss global announcement');
      close.style.cssText =
        'position:absolute;right:10px;top:5px;width:34px;height:34px;' +
        'border:1px solid rgba(45,204,255,.35);border-radius:8px;' +
        'background:rgba(45,204,255,.07);color:#2dccff;font-size:21px;' +
        'line-height:1;cursor:pointer;';
      close.onclick = () => {
        try { localStorage.setItem(DISMISS_KEY, id); } catch (_) {}
        removeBanner();
      };
      banner.append(message, close);
      document.body.appendChild(banner);
    }

    const message = document.getElementById('cosmic-global-announcement-text');
    if (message) message.textContent = announcement.text;
  }

  async function sync() {
    try {
      const response = await fetch(API + '/api/site-state?global=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) return;
      renderAnnouncement(await response.json());
    } catch (_) {}
  }

  function boot() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    sync();
    window.setInterval(sync, 5000);
  }

  boot();
})();