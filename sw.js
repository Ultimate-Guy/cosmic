const CACHE = 'cosmic-shell-v10';
const OFFLINE_URL = './offline.html';
const STATIC_ASSETS = [OFFLINE_URL];

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
    await Promise.all(keys.filter(key => key.startsWith('cosmic-shell-') && key !== CACHE).map(key => caches.delete(key)));
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
        .catch(async () => {
          // Prefer an explicitly installed offline game entry before the
          // generic offline page. This makes the Studio's opt-in pack cache
          // useful for same-origin game navigations while offline.
          const cachedEntry = await caches.match(event.request);
          return cachedEntry || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(
    fetch(new Request(event.request, { cache: 'no-store' }))
      .catch(() => caches.match(event.request).then(cached => cached || Response.error()))
  );
});
