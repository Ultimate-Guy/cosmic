const CACHE = 'cosmic-shell-v4';
const SHELL = [
  './offline.html',
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
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // HTML/navigation must always come from the current deployment. This prevents
  // an old Cosmic Hub page from surviving a GitHub Pages/Cloudflare deployment.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' }))
        .catch(() => caches.match('./offline.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(response => {
        if (response.ok && SHELL.some(p => url.pathname.endsWith(p.replace('./', '/')))) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || Response.error()))
  );
});
