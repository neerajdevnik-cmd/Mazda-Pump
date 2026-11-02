mkdir -p /home/claude/mp && cd /home/claude/mp && cat > multi_pump.js <<'EOF'
/* =========================================================================
   MULTI_PUMP.JS v2 — हर पंप की अपनी पहचान: नाम · लोगो · रेट · डेटा अलग
   • ?p=pumpid से पंप चुनता है; Firestore को /pumps/{id}/... पर भेजता है
   • लोगो: कस्टम (अपलोड) → नहीं तो कंपनी-ब्रांड (BPCL/HPCL/IOCL/Nayara/Jio-bp/Shell)
   • नाम + लोगो हर जगह: हेडर, लॉगिन, स्टेटमेंट, इनवॉइस, थर्मल पर्ची, पॉप-अप, PDF/इमेज
   • माज़दा का अपना पंप 100% जैसा था वैसा रहता है (कुछ नहीं बदलता)
   ========================================================================= */
(function () {
  'use strict';
  window.PUMP_SYSTEM = window.PUMP_SYSTEM || {};
  const PS = window.PUMP_SYSTEM;
  const MAZDA = 'mazda';

  /* ---------- 1. ब्रांड + वेक्टर लोगो ---------- */
  const uri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const T = (x, y, s, fill, txt, w) => '<text x="' + x + '" y="' + y + '" font-family="Arial,Helvetica,sans-serif" font-weight="' + (w || 800) + '" font-size="' + s + '" fill="' + fill + '" text-anchor="middle">' + txt + '</text>';
  const wrap = inner => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' + inner + '</svg>';
  PS.BRANDS = {
    bpcl: { key: 'bpcl', label: 'Bharat Petroleum (BPCL)', short: 'BPCL', dealer: 'Bharat Petroleum Dealer', dealerHi: 'भारत पेट्रोलियम डीलर', color: '#0b3d91', accent: '#fdb813',
      svg: wrap('<circle cx="100" cy="100" r="96" fill="#0b3d91"/><circle cx="100" cy="100" r="80" fill="#fdb813"/><path d="M100 38c22 30 38 48 38 70a38 38 0 0 1-76 0c0-22 16-40 38-70z" fill="#0b3d91"/><path d="M100 70c12 18 22 28 22 41a22 22 0 0 1-44 0c0-13 10-23 22-41z" fill="#fff"/>' + T(100, 168, 26, '#0b3d91', 'BPCL')) },
    hpcl: { key: 'hpcl', label: 'Hindustan Petroleum (HPCL)', short: 'HPCL', dealer: 'HPCL Dealer', dealerHi: 'हिंदुस्तान पेट्रोलियम डीलर', color: '#0b3d91', accent: '#e11d48',
      svg: wrap('<circle cx="100" cy="100" r="96" fill="#0b3d91"/><circle cx="100" cy="100" r="82" fill="#fff"/><circle cx="100" cy="100" r="82" fill="none" stroke="#e11d48" stroke-width="6"/>' + T(100, 128, 84, '#e11d48', 'HP', 900) + T(100, 160, 16, '#0b3d91', 'HINDUSTAN PETROLEUM', 700)) },
    iocl: { key: 'iocl', label: 'Indian Oil (IOCL)', short: 'IOCL', dealer: 'IndianOil Dealer', dealerHi: 'इंडियन ऑयल डीलर', color: '#f97316', accent: '#0a2f6b',
      svg: wrap('<circle cx="100" cy="100" r="96" fill="#fff" stroke="#0a2f6b" stroke-width="6"/><path d="M12 100a88 88 0 0 1 176 0z" fill="#f97316"/><path d="M12 100a88 88 0 0 0 176 0z" fill="#0a2f6b"/><rect x="12" y="84" width="176" height="32" fill="#fff"/>' + T(100, 109, 28, '#0a2f6b', 'IndianOil', 900)) },
    nayara: { key: 'nayara', label: 'Nayara Energy', short: 'NAYARA', dealer: 'Nayara Energy Dealer', dealerHi: 'नायरा एनर्जी डीलर', color: '#00205b', accent: '#f26522',
      svg: wrap('<circle cx="100" cy="100" r="96" fill="#00205b"/><circle cx="100" cy="100" r="82" fill="none" stroke="#f26522" stroke-width="8"/><path d="M62 128V72h14l48 38V72h14v56h-14L76 90v38z" fill="#fff"/>' + T(100, 160, 22, '#fff', 'NAYARA', 900) + T(100, 178, 11, '#f26522', 'E N E R G Y', 700)) },
    jiobp: { key: 'jiobp', label: 'Jio-bp', short: 'JIO-BP', dealer: 'Jio-bp Dealer', dealerHi: 'जियो-बीपी डीलर', color: '#0a8f3c', accent: '#005eb8',
      svg: wrap('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00a651"/><stop offset="1" stop-color="#005eb8"/></linearGradient></defs><circle cx="100" cy="100" r="96" fill="url(#g)"/><circle cx="100" cy="100" r="80" fill="none" stroke="#fff" stroke-width="5" opacity=".7"/>' + T(100, 118, 54, '#fff', 'jio-bp', 900) + T(100, 150, 15, '#e8fff0', 'FUEL · ENERGY · MOBILITY', 700)) },
    shell: { key: 'shell', label: 'Shell', short: 'SHELL', dealer: 'Shell Dealer', dealerHi: 'शेल डीलर', color: '#dd1d21', accent: '#ffd500',
      svg: wrap('<circle cx="100" cy="100" r="96" fill="#fff" stroke="#dd1d21" stroke-width="6"/><path d="M100 36C60 36 28 74 28 116c0 8 4 14 10 14h124c6 0 10-6 10-14 0-42-32-80-72-80z" fill="#ffd500" stroke="#dd1d21" stroke-width="7" stroke-linejoin="round"/><path d="M100 130V44M100 130L62 52M100 130L138 52M100 130L40 66M100 130L160 66M100 130L32 88M100 130L168 88" stroke="#dd1d21" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M70 130l8 28h44l8-28" fill="#ffd500" stroke="#dd1d21" stroke-width="7" stroke-linejoin="round"/>') }
  };
  PS.LOGOS = {}; Object.keys(PS.BRANDS).forEach(k => { PS.LOGOS[k] = uri(PS.BRANDS[k].svg); });
  PS.LOGOS.custom = './logo.png';
  PS.brandList = () => Object.keys(PS.BRANDS).map(k => PS.BRANDS[k]);

  /* ---------- 2. कौन सा पंप चालू है ---------- */
  function requestedPumpId() {
    try {
      const p = new URLSearchParams(window.location.search), q = p.get('pump') || p.get('p');
      if (q) { const c = q.toLowerCase().trim().replace(/[^a-z0-9_]/g, ''); if (c) { try { localStorage.setItem('mazda_active_pump', c); } catch (e) { } return c; } }
    } catch (e) { }
    try { const s = localStorage.getItem('mazda_active_pump'); if (s) return s.toLowerCase().trim(); } catch (e) { }
    return MAZDA;
  }
  PS.activePumpId = requestedPumpId();
  PS.currentConfig = null;
  PS.isCustomPump = () => PS.activePumpId !== MAZDA;

  /* पंप के लिए सही लोगो: कस्टम (अपलोड) → नहीं तो ब्रांड → नहीं तो BPCL */
  PS.logoFor = function (cfg) {
    if (!cfg) return PS.LOGOS.bpcl;
    if (cfg.id === MAZDA || cfg.isMain) return './logo.png';
    const c = cfg.customLogo || cfg.logoData || '';
    if (c && (c.indexOf('data:image') === 0 || /^https?:/.test(c))) return c;
    return PS.LOGOS[cfg.brand] && cfg.brand !== 'custom' ? PS.LOGOS[cfg.brand] : PS.LOGOS.bpcl;
  };
  PS.getLogo = () => (PS.currentConfig && PS.currentConfig.logo) || './logo.png';

  /* ---------- 3. पंप की सेटिंग लोड करके पूरे ऐप पर लगाना ---------- */
  function normalize(id, d) {
    const C = window.CFG || {}, base = C.pump || {}, b = PS.BRANDS[d.brand] || PS.BRANDS.bpcl;
    const cfg = Object.assign({}, d, { id });
    cfg.name = d.name || id; cfg.nameEn = d.nameEn || d.name || id;
    cfg.brand = PS.BRANDS[d.brand] ? d.brand : (d.customLogo ? 'custom' : 'bpcl');
    cfg.dealer = d.dealer || b.dealer; cfg.address = d.address || ''; cfg.addressEn = d.addressEn || d.address || '';
    cfg.activeNozzles = (Array.isArray(d.activeNozzles) && d.activeNozzles.length) ? d.activeNozzles : ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
    cfg.rates = (d.rates && Number(d.rates.petrol) > 0 && Number(d.rates.diesel) > 0) ? { petrol: Number(d.rates.petrol), diesel: Number(d.rates.diesel) } : { petrol: Number(C.defaultRateP) || 0, diesel: Number(C.defaultRateD) || 0 };
    cfg.logo = PS.logoFor(cfg);
    return cfg;
  }
  PS.initBranding = async function (db) {
    const pid = PS.activePumpId, C = window.CFG || {};
    let cfg = null;
    if (pid !== MAZDA && db) {
      try { const snap = await db.collection('pumps').doc(pid).get(); if (snap.exists) cfg = normalize(pid, snap.data()); else PS.missing = true; }
      catch (e) { console.warn('[MultiPump] पंप की सेटिंग नहीं मिली:', e); }
    }
    if (!cfg) {
      const p = C.pump || {};
      cfg = { id: MAZDA, isMain: true, name: p.name || 'माज़दा ऑयल कंपनी', nameEn: p.nameEn || 'Mazda Oil Company', brand: 'bpcl', dealer: p.dealer || 'Bharat Petroleum Dealer', address: p.address || '', addressEn: p.addressEn || '', phone: p.phone || '', upi: p.upi || '', upiName: p.upiName || '', ownerEmail: C.ownerEmail, ownerPin: C.ownerPin, activeNozzles: C.activeNozzles || ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'], rates: { petrol: C.defaultRateP, diesel: C.defaultRateD }, logo: './logo.png' };
    }
    PS.currentConfig = cfg;
    if (PS.isCustomPump() && window.CFG) {           // माज़दा के पुराने डेटा कभी दूसरे पंप में न दिखें
      const P = window.CFG.pump = Object.assign({}, window.CFG.pump, { name: cfg.name, nameEn: cfg.nameEn, dealer: cfg.dealer, address: cfg.address, addressEn: cfg.addressEn, phone: cfg.phone || '', upi: cfg.upi || '', upiName: cfg.upiName || cfg.nameEn, roCode: cfg.roCode || '', gstin: cfg.gstin || '', fssai: cfg.fssai || '', logo: cfg.logo });
      if (!cfg.upi) P.merchant = {};
      window.CFG.ownerPin = cfg.ownerPin || '9999';
      window.CFG.activeNozzles = cfg.activeNozzles;
      window.CFG.salesmen = Array.isArray(cfg.salesmen) ? cfg.salesmen : [];
      if (cfg.rates.petrol > 0) { window.CFG.defaultRateP = cfg.rates.petrol; window.CFG.defaultRateD = cfg.rates.diesel; }
      try { const A = window.APP; if (A && A.S && cfg.rates.petrol > 0) A.S.rates = { petrol: cfg.rates.petrol, diesel: cfg.rates.diesel }; } catch (e) { }
      installPatches();
    } else if (window.CFG) { window.CFG.pump = Object.assign({}, window.CFG.pump, { logo: './logo.png' }); }
    document.title = cfg.name + ' - स्मार्ट पंप पोर्टल';
    PS.applyDOMBranding(); PS.updateIcons();
    if (PS.missing) PS.banner('⚠ पंप कोड [' + pid + '] सिस्टम में नहीं मिला — Super Admin से बनाएँ।');
    return cfg;
  };

  /* ---------- 4. हर जगह लोगो + नाम (HTML स्ट्रिंग, पॉप-अप, इमेज, पर्ची, सब) ---------- */
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function brandize(s) {
    if (typeof s !== 'string' || !s || !PS.isCustomPump() || !PS.currentConfig) return s;
    const c = PS.currentConfig; let o = s;
    if (o.indexOf('logo.png') >= 0) o = o.replace(/(\.\/|\/)?logo\.png(\?[\w=.&-]*)?/g, c.logo);
    if (o.indexOf('Mazda') >= 0 || o.indexOf('MAZDA') >= 0 || o.indexOf('माज़दा') >= 0 || o.indexOf('माजदा') >= 0) {
      o = o.replace(/माज़दा ऑयल कंपनी|माजदा ऑयल कंपनी/g, c.name).replace(/Mazda Oil Company/g, c.nameEn).replace(/MAZDA OIL COMPANY/g, c.nameEn.toUpperCase()).replace(/Mazda Oil/g, c.nameEn)
        .replace(/(^|[^\w\-_])Mazda(?![\w\-_])/g, (m, p) => p + c.nameEn).replace(/माज़दा|माजदा/g, c.name);
    }
    if (o.indexOf('Bharat Petroleum Dealer') >= 0) o = o.replace(/Bharat Petroleum Dealer/g, c.dealer);
    if (c.gstin === '' && o.indexOf('05AAAAA0000A1Z5') >= 0) o = o.replace(/05AAAAA0000A1Z5/g, '');
    return o;
  }
  PS.brandize = brandize;
  let patched = false;
  function installPatches() {
    if (patched) return; patched = true;
    try {
      const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      if (d && d.set) Object.defineProperty(Element.prototype, 'innerHTML', { get: d.get, set: function (v) { d.set.call(this, brandize(v)); }, configurable: true });
      const iah = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (p, h) { return iah.call(this, p, brandize(h)); };
      const dw = Document.prototype.write; Document.prototype.write = function () { return dw.apply(this, Array.prototype.map.call(arguments, brandize)); };
      const dwl = Document.prototype.writeln; Document.prototype.writeln = function () { return dwl.apply(this, Array.prototype.map.call(arguments, brandize)); };
      const sd = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (sd && sd.set) Object.defineProperty(HTMLImageElement.prototype, 'src', { get: sd.get, set: function (v) { sd.set.call(this, brandize(v)); }, configurable: true });
      const sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (n, v) { return sa.call(this, n, (n === 'src' || n === 'href' || n === 'srcdoc') && typeof v === 'string' ? brandize(v) : v); };
      const wo = window.open;                           // स्टेटमेंट / प्रिंट वाली नई विंडो में भी वही पंप
      window.open = function () {
        const w = wo.apply(window, arguments);
        try { if (w && w.document) { const w1 = w.document.write.bind(w.document), w2 = w.document.writeln.bind(w.document); w.document.write = function () { return w1.apply(null, Array.prototype.map.call(arguments, brandize)); }; w.document.writeln = function () { return w2.apply(null, Array.prototype.map.call(arguments, brandize)); }; } } catch (e) { }
        return w;
      };
    } catch (e) { console.warn('[MultiPump] patch', e); }
  }

  /* ---------- 5. स्क्रीन पर पहले से बने तत्व ---------- */
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1 };
  PS.applyDOMBranding = function () {
    const cfg = PS.currentConfig; if (!cfg) return;
    if (PS.isCustomPump()) {
      document.querySelectorAll('img').forEach(img => { const s = img.getAttribute('src') || ''; if (/logo\.png/.test(s) || img.classList.contains('login-logo') || img.classList.contains('hdr-logo')) { if (img.src !== cfg.logo) img.src = cfg.logo; } });
      if (document.body) { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null); const todo = []; let n; while ((n = w.nextNode())) { if (n.parentNode && !SKIP[n.parentNode.nodeName] && /Mazda|MAZDA|माज़दा|माजदा/.test(n.nodeValue)) todo.push(n); } todo.forEach(t => { t.nodeValue = brandize(t.nodeValue); }); }
    } else {
      document.querySelectorAll('.login-logo, .p-header img, header img').forEach(img => { if (!/logo\.png/.test(img.getAttribute('src') || '')) return; });
    }
    PS.injectLoginShareButtons();
  };
  PS.banner = function (msg) {
    if (document.getElementById('ps-banner')) return; const b = document.createElement('div'); b.id = 'ps-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;padding:8px 12px;font-size:13px;font-weight:700;text-align:center'; b.textContent = msg;
    (document.body || document.documentElement).appendChild(b);
  };

  /* फ़ेविकॉन / होम-स्क्रीन आइकन / इंस्टॉल का नाम — उसी पंप का */
  PS.updateIcons = function () {
    const cfg = PS.currentConfig; if (!cfg || !PS.isCustomPump()) return;
    const setLink = (rel, href, extra) => { let l = document.querySelector('link[rel="' + rel + '"]'); if (!l) { l = document.createElement('link'); l.rel = rel; document.head.appendChild(l); } if (extra) Object.keys(extra).forEach(k => l.setAttribute(k, extra[k])); l.href = href; };
    const img = new Image();
    img.onload = () => {
      const mk = size => { const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); const s = Math.min(size * 0.9 / img.width, size * 0.9 / img.height); const w = img.width * s, h = img.height * s; x.drawImage(img, (size - w) / 2, (size - h) / 2, w, h); return cv.toDataURL('image/png'); };
      try {
        const i192 = mk(192), i512 = mk(512);
        setLink('icon', i192, { type: 'image/png' }); setLink('apple-touch-icon', mk(180));
        const man = { name: cfg.name, short_name: cfg.name.slice(0, 14), start_url: new URL(location.pathname + '?p=' + PS.activePumpId, location.origin).href, scope: new URL(location.pathname.replace(/[^\/]*$/, ''), location.origin).href, display: 'standalone', orientation: 'portrait', background_color: '#ffffff', theme_color: (PS.BRANDS[cfg.brand] || PS.BRANDS.bpcl).color, icons: [{ src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' }] };
        setLink('manifest', URL.createObjectURL(new Blob([JSON.stringify(man)], { type: 'application/manifest+json' })));
        const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = man.theme_color;
      } catch (e) { }
    };
    img.src = cfg.logo;
  };

  /* ---------- 6. WhatsApp शेयर बटन ---------- */
  PS.injectLoginShareButtons = function () {
    if (document.getElementById('ps-share-wrap')) return;
    const card = document.querySelector('.login, .login-screen, .glass-card'); if (!card) return;
    const pid = PS.activePumpId, cfg = PS.currentConfig || { name: 'पेट्रोल पंप' };
    const base = location.origin + location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
    const ownerLink = base + 'owner.html?p=' + encodeURIComponent(pid), partyLink = base + 'party.html?p=' + encodeURIComponent(pid);
    const w = document.createElement('div'); w.id = 'ps-share-wrap';
    w.style.cssText = 'margin:16px 0;padding:12px;background:rgba(10,42,102,.06);border:1px dashed rgba(10,42,102,.25);border-radius:14px;text-align:center;font-size:12px;';
    w.innerHTML = '<div style="font-weight:700;margin-bottom:8px;color:#0a2a66">📲 ' + cfg.name + ' — शेयर ऐप लिंक</div><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap"><button id="btn-share-owner-link" style="flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:none;background:#f4b41a;color:#000;font-weight:bold;cursor:pointer;font-size:11px">👑 मालिक ऐप भेजें</button><button id="btn-share-party-link" style="flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:none;background:#25D366;color:#fff;font-weight:bold;cursor:pointer;font-size:11px">🚚 पार्टी ऐप भेजें</button></div>';
    card.parentNode.insertBefore(w, card.nextSibling);
    document.getElementById('btn-share-owner-link').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent('नमस्ते!\n\n*' + cfg.name + '* के मालिक के लिए VIP Owner Control पोर्टल का लिंक:\n\n🔗 ' + ownerLink + '\n\nलिंक खोलकर अपना 4-अंकों का VIP PIN डालें।'), '_blank');
    document.getElementById('btn-share-party-link').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent('नमस्ते!\n\n*' + cfg.name + '* पार्टी पोर्टल का लिंक:\n\n🔗 ' + partyLink + '\n\nयहाँ से आप अपना पूरा हिसाब, गाड़ी और बिल देख सकते हैं। अपना 6-अंकों का पार्टी कोड डालकर लॉगिन करें।'), '_blank');
  };

  /* ---------- 7. Firestore: हर पंप का डेटा अलग (माज़दा का मूल डेटा मूल जगह) ---------- */
  PS.wrapFirestore = function (db) {
    if (!db || db.__wrappedMultiPump) return db;
    const orig = db.collection.bind(db), pid = PS.activePumpId, GLOBAL = ['pumps', 'system_admins', 'audit_global'];
    db.collection = function (name) { if (pid === MAZDA || GLOBAL.indexOf(name) >= 0) return orig(name); return orig('pumps').doc(pid).collection(name); };
    db.__wrappedMultiPump = true; console.log('[MultiPump] Firestore → पंप [' + pid + ']');
    return db;
  };

  /* नई जनरेट होने वाली स्क्रीनों के लिए हल्का observer */
  let tm = null;
  function watch() { if (!document.body || !PS.isCustomPump()) return; new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { try { PS.applyDOMBranding(); } catch (e) { } }, 250); }).observe(document.body, { childList: true, subtree: true }); }
  window.addEventListener('DOMContentLoaded', () => { setTimeout(() => { PS.applyDOMBranding(); watch(); }, 400); });
})();
EOF
node -e "new Function(require('fs').readFileSync('multi_pump.js','utf8'));console.log('syntax ok')"
