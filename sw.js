/* Service Worker — Mazda / Pump app.
   Browser ko installable app maanne ke liye fetch handler zaroori hai.
   Network-first, cache fallback nahi (taaki purana data na dikhe). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
