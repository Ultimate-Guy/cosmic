/* Cosmic UGS ad compatibility layer.
   This is intentionally narrow: skip forced/interstitial ad requests while
   keeping rewarded-ad APIs available to the game. */
(() => {
  const patch = () => {
    try {
      if (window.famobi && typeof window.famobi.showAd === 'function' && !window.famobi.__cosmicInterstitialBlocked) {
        window.famobi.showAd = function (callback) {
          setTimeout(() => {
            if (typeof callback === 'function') callback();
          }, 0);
        };
        window.famobi.__cosmicInterstitialBlocked = true;
      }

      if (typeof window.adBreak === 'function' && !window.__cosmicAdBreakWrapped) {
        const original = window.adBreak;
        window.adBreak = function (options) {
          const type = String(options && options.type || '').toLowerCase();
          if (type === 'reward' || type === 'rewarded') {
            return original.apply(this, arguments);
          }
          return Promise.resolve();
        };
        window.__cosmicAdBreakWrapped = true;
      }
    } catch (_) {}
  };

  patch();
  const timer = setInterval(patch, 100);
  setTimeout(() => clearInterval(timer), 15000);
})();
