(() => {
  'use strict';
  const ADMIN = 'TheDevilAngel';
  const SESSION = 'cosmicCurrentUserV1';
  const user = () => { try { return localStorage.getItem(SESSION) || 'Guest'; } catch (_) { return 'Guest'; } };
  const allowed = () => user() === ADMIN;
  const clean = () => {
    if (allowed()) return;
    document.querySelectorAll('.cosmic-result').forEach(el => {
      if (/registry health check/i.test(el.textContent || '')) el.remove();
    });
  };
  const observer = new MutationObserver(clean);
  observer.observe(document.documentElement, {childList:true, subtree:true});
  clean();
})();
