const V = 'mazda-v7';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'views2.js', 'calc.js', 'config.js', 'preset_parties.js', 'manifest.json', 'features.js', 'features2.js', 'statement.js', 'notify.js', 'salesman.js', 'shop.js', 'runsheet.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('firebaseio.com') || u.pathname.startsWith('/.netlify/functions/') || u.pathname === '/pay') return;
  const same = u.origin === location.origin;
  if (same) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; })));
  }
});
