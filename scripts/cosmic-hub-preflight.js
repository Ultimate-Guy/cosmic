(() => {
  'use strict';
  if (!/\/pages\/lessons\/lessons\.html$|\/apps\/apps\.html$/i.test(location.pathname)) return;

  const KEY = 'cosmicHubPreflightV1';
  let ran = false;
  try { ran = sessionStorage.getItem(KEY) === '1'; } catch (_) {}

  async function cleanup() {
    let changed = false;
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          const script = String(reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '');
          const isCosmic = /\/sw\.js(?:\?|$)|\/cosmic-sw\.js(?:\?|$)/i.test(script);
          if (isCosmic) {
            const ok = await reg.unregister();
            changed = changed || ok;
          }
        }
      } catch (_) {}
    }
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (/^cosmic-shell-v\d+$/i.test(key) || /^cosmic-/i.test(key)) {
            changed = (await caches.delete(key)) || changed;
          }
        }
      } catch (_) {}
    }
    return changed;
  }

  async function verifyHub() {
    await new Promise(r => setTimeout(r, 900));
    if (document.getElementById('cosmic-account') || document.getElementById('cosmic-hub-tools')) return;
    try { delete window.__COSMIC_HUB_V1__; } catch (_) { window.__COSMIC_HUB_V1__ = undefined; }
    const rootBase = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
    const s = document.createElement('script');
    s.src = rootBase + 'scripts/cosmic-hub.js?preflight=' + Date.now();
    s.async = false;
    document.head.appendChild(s);
  }

  async function start() {
    if (!ran) {
      try { sessionStorage.setItem(KEY, '1'); } catch (_) {}
      const changed = await cleanup();
      if (changed && navigator.serviceWorker?.controller) {
        location.reload();
        return;
      }
    }
    verifyHub();
  }

  start();
})();
