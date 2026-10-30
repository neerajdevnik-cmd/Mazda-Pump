const V = 'mazda-v72';
const SHELL = [
  './', 'index.html', 'style.css', 'config.js', 'dip_chart.js', 'calc.js',
  'device_features.js', 'features2.js', 'assistant.js',
  'salesman.js', 'shop.js', 'runsheet.js', 'monthly.js',
  'shifts.js', 'extras.js', 'dayreport.js',
  'tanker_report.js', 'analytics.js', 'margins.js',
  'cibil.js', 'applock.js', 'vehicle_profile.js', 'shop_orders.js', 'vendors.js',
  'portal_gen.js', 'invoice_gen.js', 
  'manager_desk.js',
  'preset_parties.js', 'manifest.json', 
  'logo.png', 'icon-192.png', 'icon-512.png',
  'party.html', 'party_portal.js', 'party_manifest.json',
  'owner.html', 'owner_portal.js', 'owner_manifest.json',
  
  // 🔥 Nayi Split Files
  'app_core.js', 'ai_core.js', 'app_day.js', 'app_ledger.js',
  'views2_core.js', 'views2_utils.js',
  'features_core.js', 'features_utils.js', 'features_custom.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(f => c.add(f)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => { 
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); 
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname.endsWith('googleapis.com') || u.hostname.endsWith('firebaseio.com') || u.pathname.startsWith('/.netlify/functions/') || u.pathname === '/pay') return;
  const same = u.origin === location.origin;
  if (same) {
    e.respondWith(new Promise(res => {
      let done = false;
      const t = setTimeout(() => { caches.match(e.request).then(h => { if (h && !done) { done = true; res(h); } }); }, 4000);
      fetch(e.request).then(r => {
        clearTimeout(t);
        if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); }
        if (!done) { done = true; res(r); }
      }).catch(() => {
        clearTimeout(t);
        caches.match(e.request).then(h => { if (!done) { done = true; res(h || Response.error()); } });
      });
    }));
  } else {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; })));
  }
});
