const CACHE = 'cosmic-shell-v5';
const OFFLINE_URL = './offline.html';
const STATIC_ASSETS = [
  OFFLINE_URL,
  './apps/apps.json',
  './pages/lessons/games.json',
  './scripts/cosmic-hub.js',
  './scripts/cosmic-pwa.js',
  './scripts/cosmic-profile-widget.js',
  './scripts/cosmic-feedback.js',
  './imgs/cosmic.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));

    // A previous Cosmic build used a separate root-scoped worker. It can remain
    // registered even after its file is removed, so explicitly retire it once.
    const registrations = await self.registration.scope ? self.registration : null;
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    void registrations;
    void all;
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' }))
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response.ok && STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '/')))) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || Response.error()))
  );
});
