const V = 'mazda-v32';
const SHELL = [
  // Core
  './',
  'index.html',
  'style.css',
  'config.js',
  'dip_chart.js',
  'calc.js',
  'app.js',
  'views2.js',
  'features.js',
  'features2.js',
  'salesman.js',
  'shop.js',
  'runsheet.js',
  'monthly.js',
  'shifts.js',
  'extras.js',
  'dayreport.js',
  'preset_parties.js',

  // Phase A - Tanker
  'tanker_report.js',

  // Phase B - Analytics + Margins
  'analytics.js',
  'margins.js',

  // Phase C - CIBIL + App Lock + Vehicle
  'cibil.js',
  'applock.js',
  'vehicle_profile.js',

  // Phase D - Shop Orders
  'shop_orders.js',

  // Phase E - Vendors + Portal Generator
  'vendors.js',
  'portal_gen.js',

  // Party Portal (separate app)
  'party.html',
  'party_portal.js',
  'party_manifest.json',

  // Assets
  'manifest.json',
  'logo.png',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(SHELL.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);

  // Only GET
  if (e.request.method !== 'GET') return;

  // Skip Firebase, Google APIs, Netlify functions
  if (u.hostname.endsWith('googleapis.com') ||
      u.hostname.endsWith('firebaseio.com') ||
      u.hostname.endsWith('gstatic.com') ||
      u.pathname.startsWith('/.netlify/functions/') ||
      u.pathname === '/pay') return;

  const sameOrigin = u.origin === location.origin;

  if (sameOrigin) {
    // Network-first with cache fallback (for HTML/JS/CSS updates)
    e.respondWith(new Promise(resolve => {
      let done = false;

      const timeout = setTimeout(() => {
        caches.match(e.request).then(hit => {
          if (hit && !done) { done = true; resolve(hit); }
        });
      }, 4000);

      fetch(e.request)
        .then(r => {
          clearTimeout(timeout);
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(V).then(c => c.put(e.request, clone));
          }
          if (!done) { done = true; resolve(r); }
        })
        .catch(() => {
          clearTimeout(timeout);
          caches.match(e.request).then(hit => {
            if (!done) { done = true; resolve(hit || Response.error()); }
          });
        });
    }));
  } else {
    // Cross-origin: cache-first
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(r => {
          const clone = r.clone();
          caches.open(V).then(c => c.put(e.request, clone));
          return r;
        }).catch(() => Response.error());
      })
    );
  }
});
