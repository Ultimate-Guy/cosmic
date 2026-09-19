(() => {
  'use strict';
  if (window.__COSMIC_DEV_LOADER__) return;
  window.__COSMIC_DEV_LOADER__ = true;
  const base = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  const script = document.createElement('script');
  script.src = base + 'scripts/cosmic-dev-tools.js?build=dev-commands-global';
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
})();
