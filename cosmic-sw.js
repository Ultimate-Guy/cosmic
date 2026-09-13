// Legacy Cosmic service worker retirement shim.
// This file is intentionally retained for one release so browsers that previously
// registered /cosmic-sw.js can activate it and unregister the obsolete worker.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.registration.unregister().then(() => self.clients.claim())));
self.addEventListener('fetch', event => event.respondWith(fetch(event.request)));
