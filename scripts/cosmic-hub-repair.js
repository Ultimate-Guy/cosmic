(() => {
  'use strict';
  if (window.__COSMIC_HUB_REPAIR__) return;
  window.__COSMIC_HUB_REPAIR__ = true;

  const path = location.pathname || '';
  const isGames = /\/pages\/lessons\/lessons\.html$/i.test(path);
  const isApps = /\/apps\/apps\.html$/i.test(path);
  if (!isGames && !isApps) return;

  const rootBase = location.hostname.endsWith('.github.io') ? '/cosmic/' : '/';
  const scriptBase = isGames ? rootBase + 'scripts/' : rootBase + 'scripts/';
  const currentHubUrl = scriptBase + 'cosmic-hub.js?repair=' + Date.now();

  const hasCurrentHub = () => !!document.getElementById('cosmic-account');

  function loadCurrentHub() {
    if (hasCurrentHub()) return Promise.resolve();
    try { delete window.__COSMIC_HUB_V1__; } catch (_) { window.__COSMIC_HUB_V1__ = undefined; }
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = currentHubUrl;
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  function getItems() {
    return fetch(rootBase + 'pages/lessons/games.json?repair=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);
  }

  function openIssue(title, body) {
    const url = 'https://github.com/Ultimate-Guy/cosmic/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function addRepairTools() {
    if (!isGames) return;
    const main = document.querySelector('main');
    if (!main || document.getElementById('cosmic-repair-tools')) return;

    const wrap = document.createElement('div');
    wrap.id = 'cosmic-repair-tools';
    wrap.style.cssText = 'max-width:1400px;margin:0 auto;padding:0 40px 8px;display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:20';

    const style = 'border:1px solid var(--accent,#2dccff);border-radius:999px;padding:8px 13px;background:rgba(0,0,0,.22);color:var(--accent,#2dccff);cursor:pointer;font-weight:700';
    const suggest = document.createElement('button');
    suggest.type = 'button'; suggest.style.cssText = style; suggest.textContent = '💡 Suggest a Game';
    suggest.onclick = () => window.open('https://docs.google.com/forms/d/e/1FAIpQLSelUdV2ZsRrufoHV16KYsy1WpG6ecc4r5dugcrrTe1V7n6G9g/viewform?usp=publish-editor', '_blank', 'noopener,noreferrer');

    const report = document.createElement('button');
    report.type = 'button'; report.style.cssText = style; report.textContent = '⚠️ Report a Game';
    report.onclick = () => openIssue('Game report for Cosmic', 'Report a game problem or broken game.\n\nGame name: \nWhat is wrong: \nWhat should happen: ');

    const daily = document.createElement('button');
    daily.type = 'button'; daily.style.cssText = style; daily.textContent = '✦ Daily Special Game';
    daily.onclick = async () => {
      const items = await getItems();
      if (!Array.isArray(items) || !items.length) return;
      const item = items[Math.floor(Date.now() / 86400000) % items.length];
      const pathPart = String(item.path || '').replace(/^\.?\//, '');
      const target = rootBase + pathPart + (item.entry || '');
      const shell = rootBase + 'pages/lessons/game-shell.html?game=' + encodeURIComponent(new URL(target, location.origin).href);
      window.location.href = shell;
    };

    wrap.append(suggest, report, daily);
    main.insertBefore(wrap, main.firstChild);

    const missionTitle = document.querySelector('#cosmic-mission h3');
    if (missionTitle) missionTitle.textContent = '✦ Daily Special Game';
  }

  async function repair() {
    await loadCurrentHub();
    setTimeout(addRepairTools, 150);
    setTimeout(addRepairTools, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repair, { once: true });
  else repair();
})();
