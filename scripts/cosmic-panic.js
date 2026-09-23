(() => {
  'use strict';
  if (window.__COSMIC_PANIC__) return;

  const API_KEY = 'cosmic-panic-key';
  const API_URL = 'cosmic-panic-url';
  let installed = false;

  function getConfig() {
    try {
      return {
        key: localStorage.getItem(API_KEY) || '',
        url: localStorage.getItem(API_URL) || ''
      };
    } catch (_) {
      return { key: '', url: '' };
    }
  }

  function navigate(url) {
    try {
      if (window.top && window.top !== window) {
        window.top.location.assign(url);
      } else {
        window.location.assign(url);
      }
    } catch (_) {
      try { window.location.assign(url); } catch (__){}
    }
  }

  function install() {
    if (installed) return;
    installed = true;

    window.addEventListener('keydown', (event) => {
      const config = getConfig();
      if (!config.key || !config.url || event.key !== config.key) return;

      const target = event.target;
      if (target && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(config.url);
    }, true);
  }

  window.CosmicPanic = { install, getConfig };
  install();
})();