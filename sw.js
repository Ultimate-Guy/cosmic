const CACHE = 'cosmic-shell-v1';
const SHELL = [
  './',
  './apps/apps.html',
  './apps/apps.json',
  './pages/lessons/lessons.html',
  './pages/lessons/games.json',
  './scripts/cosmic-hub.js',
  './imgs/cosmic.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && (event.request.mode === 'navigate' || SHELL.some(p => url.pathname.endsWith(p.replace('./','/'))))) {
      const copy = response.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(event.request).then(r => r || caches.match('./'))));
});
