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

  /* ---------- 1b. थीम: पंप का रंग पूरे ऐप में (CSS variables) ---------- */
  PS.THEMES = {
    mazda: { label: 'माज़दा (मूल नीला)', primary: '#0b3d91', dark: '#0a2f6b', accent: '#f4b41a' },
    bpcl:  { label: 'BPCL (नीला + पीला)', primary: '#0b3d91', dark: '#06245a', accent: '#fdb813' },
    hpcl:  { label: 'HPCL (नीला + लाल)', primary: '#0b3d91', dark: '#072a66', accent: '#e11d48' },
    iocl:  { label: 'IOCL (नारंगी + नीला)', primary: '#f97316', dark: '#0a2f6b', accent: '#fbbf24' },
    nayara:{ label: 'नायरा (नीला + नारंगी)', primary: '#00205b', dark: '#001238', accent: '#f26522' },
    jiobp: { label: 'Jio-bp (हरा + नीला)', primary: '#0a8f3c', dark: '#005eb8', accent: '#00a651' },
    shell: { label: 'Shell (लाल + पीला)', primary: '#dd1d21', dark: '#9d0f12', accent: '#ffd500' }
  };
  const mix = (hex, toHex, t) => { const a = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16)), b = [1, 3, 5].map(i => parseInt(toHex.substr(i, 2), 16)); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  PS.applyTheme = function (key) {
    const T = PS.THEMES[key] || PS.THEMES.mazda, r = document.documentElement.style;
    if (key === 'mazda') { ['--b', '--b2', '--bpcl-yellow'].forEach(v => r.removeProperty(v)); }
    else { r.setProperty('--b', T.primary); r.setProperty('--b2', mix(T.primary, '#ffffff', 0.9)); r.setProperty('--bpcl-yellow', T.accent); }
    let st = document.getElementById('ps-theme-css');
    if (!st) { st = document.createElement('style'); st.id = 'ps-theme-css'; document.head.appendChild(st); }
    st.textContent = key === 'mazda' ? '' :
      'header{background:linear-gradient(135deg,' + T.dark + ' 0%,' + T.primary + ' 100%)!important}' +
      'header::after{background:linear-gradient(90deg,transparent,' + T.accent + ',transparent)!important}' +
      'nav button.on::before{background:linear-gradient(90deg,' + T.accent + ',' + mix(T.accent, '#ffffff', 0.4) + ')!important}' +
      '.btn:not(.o):not(.w):not(.r):not(.g){background:linear-gradient(180deg,' + T.primary + ',' + T.dark + ')!important}';
    PS.currentTheme = key;
  };
  PS.savedMazdaTheme = () => { try { return localStorage.getItem('mazda_theme') || 'mazda'; } catch (e) { return 'mazda'; } };
  /* पंप का थीम सेव: custom पंप → pumps/{id}.theme ; माज़दा → इसी फ़ोन में */
  PS.setTheme = async function (key, db) {
    PS.applyTheme(key);
    if (PS.isCustomPump()) { if (db) await db.collection('pumps').doc(PS.activePumpId).set({ theme: key }, { merge: true }); }
    else { try { localStorage.setItem('mazda_theme', key); } catch (e) { } }
    if (PS.currentConfig) PS.currentConfig.theme = key;
  };

  /* ---------- 1c. localStorage: नए पंप के सारे mazda_ keys अलग (माज़दा के keys वैसे ही) ---------- */
  (function () {
    try {
      const pid0 = (new URLSearchParams(window.location.search).get('p') || new URLSearchParams(window.location.search).get('pump') || 'mazda').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'mazda';
      if (pid0 === 'mazda') return;
      const mapK = k => (typeof k === 'string' && k.indexOf('mazda_') === 0) ? ('pp_' + pid0 + '__' + k) : k;
      const g = Storage.prototype.getItem, st = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
      Storage.prototype.getItem = function (k) { return g.call(this, mapK(k)); };
      Storage.prototype.setItem = function (k, v) { return st.call(this, mapK(k), v); };
      Storage.prototype.removeItem = function (k) { return rm.call(this, mapK(k)); };
    } catch (e) { }
  })();

  /* ---------- 2. कौन सा पंप चालू है ---------- */
  const isStandalone = () => { try { return !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)); } catch (e) { return false; } };
  function requestedPumpId() {
    // पंप की पहचान सिर्फ़ URL से (?p=ID). कोई ID नहीं → माज़दा. कभी किसी पुराने ID को याद नहीं रखते.
    try {
      const p = new URLSearchParams(window.location.search), q = p.get('pump') || p.get('p');
      if (q) { const c = q.toLowerCase().trim().replace(/[^a-z0-9_-]/g, ''); if (c) { if (isStandalone()) try { localStorage.setItem('pp_home_pump', c); } catch (e) { } return c; } }
      /* Home Screen वाला ऐप बिना ?p= के खुले तो उसी पंप पर जाए जो install के समय खोला गया था.
         Key 'pp_' से शुरू होनी चाहिए — 'mazda_' वाली keys पंप के हिसाब से बदल जाती हैं (ऊपर देखें) */
      if (isStandalone()) { const h = localStorage.getItem('pp_home_pump'); if (h) return h; }
    } catch (e) { }
    return MAZDA;
  }
  PS.activePumpId = requestedPumpId();
  /* PS.ready: पंप की सेटिंग लोड होने (या फ़ेल होने) पर resolve. लॉगिन इसके बाद ही चलेगा */
  PS.isReady = false; PS.loadError = null;
  PS.ready = new Promise(res => { PS._resolveReady = () => { PS.isReady = true; res(); }; });
  setTimeout(() => { if (!PS.isReady) { PS.loadError = PS.loadError || 'timeout'; PS._resolveReady(); } }, 20000);
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
  /* Firestore में array के अंदर array नहीं रखा जा सकता → चार्ट text ("डिप,लीटर" हर लाइन) में सेव होता है; यहाँ वापस array बनता है */
  function decodeCharts(cfg) {
    const dec = v => (typeof v === 'string') ? ((PS.parseChart(v) || {}).rows || null) : v;
    try {
      if (cfg.dipCharts) { const o = {}; Object.keys(cfg.dipCharts).forEach(k => { const r = dec(cfg.dipCharts[k]); if (r) o[k] = r; }); cfg.dipCharts = o; }
      if (cfg.tankList) { const o = {}; Object.keys(cfg.tankList).forEach(k => { o[k] = (cfg.tankList[k] || []).map(t => Object.assign({}, t, { chart: dec(t.chart) || null })); }); cfg.tankList = o; }
    } catch (e) { console.warn('[MultiPump] chart decode', e); }
    return cfg;
  }
  PS.decodeCharts = decodeCharts;
  function normalize(id, d) {
    const C = window.CFG || {}, base = C.pump || {}, b = PS.BRANDS[d.brand] || PS.BRANDS.bpcl;
    const cfg = decodeCharts(Object.assign({}, d, { id }));
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
    try {
      if (pid !== MAZDA && db) {
        /* नया पंप: पहले पुराना (super admin / माज़दा) login हटाओ, फिर anonymous से पंप की सेटिंग पढ़ो */
        const auth = firebase.auth();
        try {
          if (auth.currentUser && !auth.currentUser.isAnonymous) await auth.signOut();
          if (!auth.currentUser) await auth.signInAnonymously();
        } catch (e) { PS.loadError = 'auth:' + (e.code || e.message); console.warn('[MultiPump] anonymous login fail', e); }
        for (let i = 0; i < 3 && !cfg && !PS.missing; i++) {
          try {
            const snap = await db.collection('pumps').doc(pid).get({ source: 'server' });
            if (snap.exists) { cfg = normalize(pid, snap.data()); PS.loadError = null; } else PS.missing = true;
          } catch (e) { PS.loadError = PS.loadError || ('read:' + (e.code || e.message)); console.warn('[MultiPump] पंप की सेटिंग नहीं मिली:', e); await new Promise(r => setTimeout(r, 800)); }
        }
        /* सर्वर न मिले तो फ़ोन में रखी कॉपी */
        if (!cfg && !PS.missing) {
          try { const snap = await db.collection('pumps').doc(pid).get(); if (snap.exists) { cfg = normalize(pid, snap.data()); } } catch (e) { }
        }
      }
    } catch (e) { console.warn('[MultiPump] initBranding', e); }
    if (!cfg && pid !== MAZDA) {
      /* ❗ दूसरे पंप के लिए कभी माज़दा की सेटिंग नहीं — खाली/न्यूट्रल ढाँचा */
      cfg = { id: pid, isMain: false, name: 'पेट्रोल पंप', nameEn: 'Petrol Pump', brand: 'bpcl', dealer: '', address: '', addressEn: '', phone: '', upi: '', upiName: '', gstin: '', fssai: '', roCode: '', activeNozzles: ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'], rates: { petrol: Number(C.defaultRateP) || 0, diesel: Number(C.defaultRateD) || 0 }, salesmen: [], logo: PS.LOGOS.bpcl, loadFailed: true };
      if (!PS.loadError && !PS.missing) PS.loadError = 'unknown';
    }
    if (!cfg) {
      const p = C.pump || {};
      cfg = { id: MAZDA, isMain: true, name: p.name || 'माज़दा ऑयल कंपनी', nameEn: p.nameEn || 'Mazda Oil Company', brand: 'bpcl', dealer: p.dealer || 'Bharat Petroleum Dealer', address: p.address || '', addressEn: p.addressEn || '', phone: p.phone || '', upi: p.upi || '', upiName: p.upiName || '', ownerEmail: C.ownerEmail, ownerPin: C.ownerPin, activeNozzles: C.activeNozzles || ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'], rates: { petrol: C.defaultRateP, diesel: C.defaultRateD }, logo: './logo.png' };
    }
    PS.currentConfig = cfg;
    PS.applyTheme(PS.isCustomPump() ? (cfg.theme || cfg.brand || 'bpcl') : PS.savedMazdaTheme());
    if (PS.isCustomPump() && window.CFG) {           // माज़दा के पुराने डेटा कभी दूसरे पंप में न दिखें
      const P = window.CFG.pump = Object.assign({}, window.CFG.pump, { name: cfg.name, nameEn: cfg.nameEn, dealer: cfg.dealer, address: cfg.address, addressEn: cfg.addressEn, phone: cfg.phone || '', upi: cfg.upi || '', upiName: cfg.upiName || cfg.nameEn, roCode: cfg.roCode || '', gstin: cfg.gstin || '', fssai: cfg.fssai || '', logo: cfg.logo });
      if (!cfg.upi) P.merchant = {};
      window.CFG.ownerPin = cfg.ownerPin || '';
      window.CFG.activeNozzles = cfg.activeNozzles;
      window.CFG.salesmen = Array.isArray(cfg.salesmen) ? cfg.salesmen : [];
      if (cfg.rates.petrol > 0) { window.CFG.defaultRateP = cfg.rates.petrol; window.CFG.defaultRateD = cfg.rates.diesel; }
      try { const A = window.APP; if (A && A.S && cfg.rates.petrol > 0) A.S.rates = { petrol: cfg.rates.petrol, diesel: cfg.rates.diesel }; } catch (e) { }
      installPatches();
    } else if (window.CFG) { window.CFG.pump = Object.assign({}, window.CFG.pump, { logo: './logo.png' }); }
    document.title = cfg.name + ' - स्मार्ट पंप पोर्टल';
    try { PS.applyDOMBranding(); } catch (e) { } try { PS.updateIcons(); } catch (e) { }
    if (PS.missing) PS.banner('⚠️ पंप कोड [' + pid + '] सिस्टम में नहीं मिला — Super Admin से बनाएँ।');
    try {
      const A0 = window.APP;
      if (PS.isCustomPump() && A0 && A0.isOwner && !A0.__ownerPatched) {
        const o0 = A0.isOwner; A0.__ownerPatched = true;
        A0.isOwner = () => o0() || !!(A0.S && A0.S.role === 'manager' && PS.currentConfig && PS.currentConfig.managerFullEdit);
      }
    } catch (e) { }
    PS._resolveReady();
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

  /* ---------- 7v. व्यू (मालिक-व्यू) कोड: नए पंप पर उसी पंप का अपना कोड ---------- */
  PS.verifyViewer = async function (code) {
    await PS.ready;
    const cfg = PS.currentConfig;
    if (!cfg || !cfg.viewerHash || !cfg.viewerSalt || !code) return false;
    return (await PS.sha256Hex(cfg.viewerSalt + '|' + code)) === cfg.viewerHash;
  };
  /* ---------- 7z. मैनेजर पासवर्ड की जाँच (ऐप के अंदर, SHA-256 + पंप का salt) ---------- */
  PS.sha256Hex = async function (text) {
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2, '0')).join('');
  };
  PS.verifyManager = async function (pass) {
    await PS.ready;
    const cfg = PS.currentConfig;
    if (PS.missing) return { ok: false, msg: 'यह पंप सिस्टम में नहीं मिला — लिंक जाँचें या Super Admin से पंप बनवाएँ' };
    if (PS.loadError && cfg && cfg.loadFailed) return { ok: false, msg: 'पंप की सेटिंग सर्वर से नहीं आई (इंटरनेट/Firebase जाँचें) — कोड: ' + PS.loadError };
    if (!cfg || !cfg.managerHash || !cfg.managerSalt) return { ok: false, msg: 'इस पंप का मैनेजर पासवर्ड सेट नहीं है — Super Admin से सेट करवाएँ' };
    if (!pass) return { ok: false, msg: 'पासवर्ड भरें' };
    const h = await PS.sha256Hex(cfg.managerSalt + '|' + pass);
    return h === cfg.managerHash ? { ok: true } : { ok: false, msg: 'पासवर्ड गलत है' };
  };

  /* ---------- 7o. मालिक (नए पंप): Owner password (hash) — न हो तो पुराना Owner PIN चलेगा ---------- */
  PS.verifyOwner = async function (pass) {
    await PS.ready;
    const cfg = PS.currentConfig;
    if (PS.missing) return { ok: false, msg: 'यह पंप सिस्टम में नहीं मिला — लिंक जाँचें' };
    if (PS.loadError && cfg && cfg.loadFailed) return { ok: false, msg: 'पंप की सेटिंग सर्वर से नहीं आई (इंटरनेट जाँचें) — कोड: ' + PS.loadError };
    if (!pass) return { ok: false, msg: 'पासवर्ड भरें' };
    if (cfg && cfg.ownerHash && cfg.ownerSalt) {
      return (await PS.sha256Hex(cfg.ownerSalt + '|' + pass)) === cfg.ownerHash ? { ok: true } : { ok: false, msg: 'मालिक का पासवर्ड गलत है' };
    }
    if (cfg && cfg.ownerPin && String(pass) === String(cfg.ownerPin)) return { ok: true, usedPin: true };
    return { ok: false, msg: cfg && cfg.ownerPin ? 'मालिक का पासवर्ड/PIN गलत है' : 'इस पंप का मालिक पासवर्ड सेट नहीं है — Super Admin से सेट करवाएँ' };
  };
  const newSalt = () => PS.activePumpId + '-' + Math.random().toString(36).slice(2, 10);
  PS.changePassword = async function (db, who, pass) {
    pass = String(pass || '');
    if (pass.length < 6) throw new Error('पासवर्ड कम से कम 6 अक्षर का हो');
    const salt = newSalt(), hash = await PS.sha256Hex(salt + '|' + pass), upd = {};
    upd[who + 'Salt'] = salt; upd[who + 'Hash'] = hash;
    await db.collection('pumps').doc(PS.activePumpId).update(upd);
    Object.assign(PS.currentConfig, upd);
  };
  PS.accessCard = function (db) {
    if (!PS.isCustomPump() || document.getElementById('ps-access-card')) return;
    const A = window.APP; if (!(A && A.S && A.S.role === 'owner')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const cfg = PS.currentConfig || {};
    const card = document.createElement('div'); card.id = 'ps-access-card'; card.className = 'card'; card.style.marginTop = '12px';
    card.innerHTML = '<h3 style="margin:0 0 6px">🔑 लॉगिन पासवर्ड (सिर्फ़ मालिक)</h3>' +
      '<div class="mut" style="font-size:12px;margin-bottom:8px">' + (cfg.ownerHash ? '' : '⚠️ अभी आप पुराने Owner PIN से चल रहे हैं — नीचे अपना पासवर्ड बना लें।<br>') + 'सेल्समैन जोड़ने का कार्ड नीचे अलग है।</div>' +
      '<label>नया मालिक पासवर्ड (6+ अक्षर)</label><input id="ps-ow-pw" type="password" autocomplete="new-password">' +
      '<div class="btns" style="margin-top:6px"><button class="btn g sm" id="ps-ow-save">💾 मालिक पासवर्ड बदलें</button></div>' +
      '<label style="margin-top:10px">नया मैनेजर पासवर्ड (6+ अक्षर)</label><input id="ps-mg-pw" type="password" autocomplete="new-password">' +
      '<div class="btns" style="margin-top:6px"><button class="btn g sm" id="ps-mg-save">💾 मैनेजर पासवर्ड बदलें</button></div>';
    main.insertBefore(card, main.firstChild);
    const hook = (btn, inp, who, okMsg) => card.querySelector(btn).onclick = async () => {
      try { await PS.changePassword(db, who, card.querySelector(inp).value); card.querySelector(inp).value = ''; if (A.toast) A.toast(okMsg); }
      catch (e) { if (A.toast) A.toast(e.message); }
    };
    hook('#ps-ow-save', '#ps-ow-pw', 'owner', 'मालिक पासवर्ड बदल गया ✔');
    hook('#ps-mg-save', '#ps-mg-pw', 'manager', 'मैनेजर पासवर्ड बदल गया ✔');
  };


  /* ---------- 7s. पंप की सेटिंग (सिर्फ़ मालिक): जानकारी · नोज़ल · टैंक/डिप चार्ट · मैनेजर अधिकार ---------- */
  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* खड़े पड़े (horizontal) बेलनाकार टैंक का डिप→लीटर चार्ट: capacity (L) + diameter (cm); हर 0.5 cm पर */
  PS.makeChart = function (capL, diaCm) {
    capL = Number(capL); diaCm = Number(diaCm) || 0;
    if (!(capL > 0)) return null;
    let estimated = false;
    if (!(diaCm > 0)) { diaCm = Math.round(Math.cbrt((4 * capL * 1000) / (Math.PI * 2))); estimated = true; }   // व्यास न पता हो: लंबाई ≈ 2 × व्यास मानकर अंदाज़ा
    const R = diaCm / 2, len = (capL * 1000) / (Math.PI * R * R), rows = [];
    const vol = h => { h = Math.min(Math.max(h, 0), diaCm); return len * (R * R * Math.acos((R - h) / R) - (R - h) * Math.sqrt(Math.max(0, 2 * R * h - h * h))) / 1000; };
    for (let h = 0.5; h < diaCm; h += 0.5) rows.push([h, Math.round(vol(h) * 100) / 100]);
    rows.push([diaCm, Math.round(capL * 100) / 100]);
    return { rows, dia: diaCm, estimated };
  };
  const chartToText = a => (a || []).map(r => r[0] + ',' + r[1]).join('\n');
  PS.parseChart = function (txt) {
    const rows = [];
    String(txt || '').split(/\n+/).forEach(line => {
      const p = line.trim().split(/[\s,;\t]+/).filter(Boolean);
      if (p.length >= 2) { const d = parseFloat(p[0]), l = parseFloat(p[1]); if (isFinite(d) && isFinite(l)) rows.push([d, l]); }
    });
    rows.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < rows.length; i++) if (rows[i][0] === rows[i - 1][0] || rows[i][1] < rows[i - 1][1]) return { error: 'चार्ट में डिप बढ़ने पर लीटर भी बढ़ने चाहिए (पंक्ति ' + (i + 1) + ' जाँचें)' };
    if (rows.length < 2) return { error: 'चार्ट में कम से कम 2 पंक्तियाँ चाहिए (डिप,लीटर)' };
    return { rows };
  };
  function logoFromFile(file) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader(); rd.onerror = reject;
      rd.onload = () => { const img = new Image(); img.onerror = reject; img.onload = () => { const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S; const k = Math.min(S / img.width, S / img.height); c.getContext('2d').drawImage(img, (S - img.width * k) / 2, (S - img.height * k) / 2, img.width * k, img.height * k); resolve(c.toDataURL('image/png')); }; img.src = rd.result; };
      rd.readAsDataURL(file);
    });
  }
  PS.settingsCard = function (db) {
    if (!PS.isCustomPump() || document.getElementById('ps-settings-card')) return;
    const A = window.APP; if (!(A && A.S && A.S.role === 'owner')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const cfg = PS.currentConfig || {}, tk = cfg.tanks || {}, toast = m => { if (A.toast) A.toast(m); };
    const nzCount = pre => (cfg.activeNozzles || []).filter(k => k.charAt(0) === pre).length;
    const opts = (n, max) => Array.from({ length: max + 1 }, (_, i) => '<option value="' + i + '"' + (i === n ? ' selected' : '') + '>' + i + '</option>').join('');
    const f = (id, label, val, extra) => '<label>' + label + '</label><input id="ps-s-' + id + '" value="' + escH(val) + '" ' + (extra || '') + '>';
    const card = document.createElement('div'); card.id = 'ps-settings-card'; card.className = 'card'; card.style.marginTop = '12px';
    card.innerHTML = '<h3 style="margin:0 0 6px">🏭 मेरे पंप की सेटिंग</h3>' +
      '<details style="margin-bottom:8px"><summary style="font-weight:700;cursor:pointer">📝 पंप की जानकारी (नाम, मोबाइल, पता…)</summary>' +
      f('name', 'पंप का नाम (हिंदी)', cfg.name) + f('nameEn', 'Pump name (English)', cfg.nameEn) + f('phone', 'मोबाइल नंबर (10 अंक)', cfg.phone, 'inputmode="numeric" maxlength="10"') +
      f('address', 'पता (हिंदी)', cfg.address) + f('addressEn', 'Address (English)', cfg.addressEn) + f('dealer', 'Dealer / कंपनी', cfg.dealer) + f('roCode', 'RO Code', cfg.roCode) +
      f('gstin', 'GSTIN', cfg.gstin) + f('fssai', 'FSSAI', cfg.fssai) + f('upi', 'UPI ID', cfg.upi) + f('upiName', 'UPI नाम', cfg.upiName) +
      '<label>लोगो बदलें (फ़ोटो)</label><input id="ps-s-logo" type="file" accept="image/*">' +
      '<div class="btns" style="margin-top:8px"><button class="btn g" id="ps-s-save-info">💾 जानकारी सेव करें</button></div></details>' +
      '<details style="margin-bottom:8px"><summary style="font-weight:700;cursor:pointer">⛽ नोज़ल (मशीन की संख्या)</summary>' +
      '<div class="mut" style="font-size:12px;margin:6px 0">पेट्रोल और डीज़ल के कितने नोज़ल चालू हैं — हर तरफ़ अधिकतम 20. सेव के बाद हिसाब में उतने ही मीटर दिखेंगे।</div>' +
      '<div class="row"><div><label>पेट्रोल नोज़ल</label><select id="ps-n-p">' + opts(nzCount('p') || 4, 20) + '</select></div><div><label>डीज़ल नोज़ल</label><select id="ps-n-d">' + opts(nzCount('d') || 4, 20) + '</select></div><div><label>पावर नोज़ल</label><select id="ps-n-x">' + opts(nzCount('x'), 20) + '</select></div></div>' +
      '<div class="btns" style="margin-top:8px"><button class="btn g" id="ps-n-save">💾 नोज़ल सेव करें</button></div></details>' +
      '<details style="margin-bottom:8px"><summary style="font-weight:700;cursor:pointer">🛢️ टैंक और डिप चार्ट</summary>' +
      '<div class="mut" style="font-size:12px;margin:6px 0">जितने टैंक हैं उतने जोड़ें — हर टैंक का अपना साइज़ और चार्ट। हिसाब में हर टैंक की डिप का अलग खाना आएगा और कुल स्टॉक अपने-आप जुड़ेगा।</div>' +
      '<div id="ps-tanks"></div>' +
      '<div class="btns" style="margin-top:8px"><button class="btn g" id="ps-t-save">💾 टैंक/चार्ट सेव करें</button></div></details>' +
      '<details><summary style="font-weight:700;cursor:pointer">👔 मैनेजर के अधिकार</summary>' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="ps-m-full" ' + (cfg.managerFullEdit ? 'checked' : '') + ' style="width:auto"> मैनेजर भी पुराने दिन/जमा हिसाब बदल-मिटा सके, रेट बदल सके और पार्टी जोड़-हटा सके</label>' +
      '<div class="mut" style="font-size:11px;margin:4px 0">बंद रखने पर मैनेजर सिर्फ़ पिछले 2 दिन के खुले हिसाब बदल सकता है।</div>' +
      '<div class="btns" style="margin-top:8px"><button class="btn g" id="ps-m-save">💾 सेव करें</button></div></details>';
    main.insertBefore(card, main.firstChild);
    const $c = s => card.querySelector(s), val = id => ($c('#' + id) || { value: '' }).value.trim();
    const save = async (upd, okMsg) => {
    try {
      upd.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('pumps').doc(PS.activePumpId).update(upd);
      Object.assign(PS.currentConfig, upd); decodeCharts(PS.currentConfig);
      try { PS.applyDOMBranding(); } catch (e) { }
      toast(okMsg);
    } catch (e) { toast('सेव नहीं हुआ: ' + (e.message || e)); }
  };
    $c('#ps-s-save-info').onclick = async () => {
      const phone = val('ps-s-phone').replace(/\s+/g, '');
      if (!val('ps-s-name')) return toast('पंप का नाम लिखें');
      if (phone && !/^\d{10}$/.test(phone)) return toast('मोबाइल नंबर 10 अंकों का हो');
      const upd = { name: val('ps-s-name'), nameEn: val('ps-s-nameEn') || val('ps-s-name'), phone, address: val('ps-s-address'), addressEn: val('ps-s-addressEn') || val('ps-s-address'), dealer: val('ps-s-dealer'), roCode: val('ps-s-roCode'), gstin: val('ps-s-gstin'), fssai: val('ps-s-fssai'), upi: val('ps-s-upi'), upiName: val('ps-s-upiName') || val('ps-s-name') };
      const file = $c('#ps-s-logo').files[0];
      try { if (file) upd.logoData = await logoFromFile(file); } catch (e) { return toast('लोगो नहीं पढ़ पाए'); }
      await save(upd, 'जानकारी सेव हो गई ✔');
    };
    $c('#ps-n-save').onclick = async () => {
      const p = +val('ps-n-p'), d = +val('ps-n-d'), x = +val('ps-n-x');
      if (p + d < 1) return toast('कम से कम 1 नोज़ल चालू रखें');
      const list = []; for (let i = 1; i <= p; i++) list.push('p' + i); for (let i = 1; i <= d; i++) list.push('d' + i); for (let i = 1; i <= x; i++) list.push('x' + i);
      await save({ activeNozzles: list }, 'नोज़ल सेव हो गए ✔');
    };
    /* ---- टैंक एडिटर: हर ईंधन के कितने भी टैंक, हर टैंक का अपना चार्ट ---- */
    const seed = fuel => {
      const tl = cfg.tankList && cfg.tankList[fuel];
      if (Array.isArray(tl) && tl.length) return tl.map(t => ({ name: t.name || '', capacity: t.capacity || '', diameter: t.diameter || '', chart: chartToText(t.chart) }));
      const ch = cfg.dipCharts && cfg.dipCharts[fuel], t0 = (cfg.tanks && cfg.tanks[fuel]) || {};
      return (ch && ch.length > 1) ? [{ name: '', capacity: t0.capacity || '', diameter: t0.diameter || '', chart: chartToText(ch) }] : [];
    };
    const TS = { petrol: seed('petrol'), diesel: seed('diesel'), power: seed('power') };
    const FT = { petrol: '⛽ पेट्रोल टैंक', diesel: '🛢️ डीज़ल टैंक', power: '⚡ पावर टैंक' };
    const renderTanks = () => {
      const box = $c('#ps-tanks');
      box.innerHTML = ['petrol', 'diesel', 'power'].map(fuel => {
        const rows = TS[fuel].map((t, i) =>
          '<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:8px;margin-top:8px" data-f="' + fuel + '" data-i="' + i + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center"><b>टैंक ' + (i + 1) + '</b><button class="btn sm r" type="button" data-rm="1">🗑 हटाएँ</button></div>' +
          '<label>नाम (जैसे "बड़ा टैंक")</label><input data-k="name" value="' + escH(t.name) + '" placeholder="टैंक ' + (i + 1) + '">' +
          '<div class="row"><div><label>क्षमता (L) — 22 KL = 22000</label><input data-k="capacity" inputmode="decimal" value="' + escH(t.capacity) + '"></div>' +
          '<div><label>व्यास (cm) — न पता हो तो खाली</label><input data-k="diameter" inputmode="decimal" value="' + escH(t.diameter) + '"></div></div>' +
          '<div class="btns" style="margin-top:6px"><button class="btn sm w" type="button" data-gen="1">⚙️ चार्ट अपने-आप बनाओ</button></div>' +
          '<label>डिप चार्ट (हर लाइन: डिप cm , लीटर) — कंपनी का असली चार्ट हो तो वही चिपकाएँ</label>' +
          '<textarea data-k="chart" rows="5" style="width:100%;box-sizing:border-box;font-size:12px" placeholder="0.5,3.3&#10;1,9.35">' + escH(t.chart) + '</textarea>' +
          '<div class="mut" style="font-size:11px">' + (t.chart ? '✅ चार्ट भरा है' : '⚠️ चार्ट खाली') + '</div></div>').join('');
        return '<div style="margin-top:10px"><b>' + FT[fuel] + ' (' + TS[fuel].length + ')</b>' + rows +
          '<div class="btns" style="margin-top:6px"><button class="btn sm o" type="button" data-add="' + fuel + '">➕ ' + ({ petrol: 'पेट्रोल', diesel: 'डीज़ल', power: 'पावर' }[fuel]) + ' टैंक जोड़ें</button></div></div>';
      }).join('') + '<div class="btns" style="margin-top:10px"><button class="btn g" id="ps-t-save">💾 टैंक/चार्ट सेव करें</button></div>';
      box.querySelectorAll('[data-i]').forEach(blk => {
        const fuel = blk.dataset.f, i = +blk.dataset.i, t = TS[fuel][i];
        blk.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => { t[inp.dataset.k] = inp.value; });
        blk.querySelector('[data-rm]').onclick = () => { if (confirm('यह टैंक हटाएँ?')) { TS[fuel].splice(i, 1); renderTanks(); } };
        blk.querySelector('[data-gen]').onclick = () => {
          const r = PS.makeChart(t.capacity, t.diameter);
          if (!r) return toast('पहले टैंक की क्षमता (L) भरें');
          t.chart = chartToText(r.rows); if (r.estimated) t.diameter = r.dia;
          renderTanks(); toast(r.estimated ? 'व्यास का अंदाज़ा ' + r.dia + ' cm लिया — असली व्यास पता हो तो भरकर दोबारा बनाएँ' : 'चार्ट बन गया — जाँचकर सेव करें');
        };
      });
      box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { TS[b.dataset.add].push({ name: '', capacity: '', diameter: '', chart: '' }); renderTanks(); });
      box.querySelector('#ps-t-save').onclick = async () => {
        const upd = { tankList: { petrol: [], diesel: [], power: [] }, tanks: {}, dipCharts: {} };
        for (const fuel of ['petrol', 'diesel', 'power']) {
          for (let i = 0; i < TS[fuel].length; i++) {
            const t = TS[fuel][i], r = PS.parseChart(t.chart);
            if (r.error) return toast(FT[fuel] + ' ' + (i + 1) + ': ' + r.error);
            upd.tankList[fuel].push({ name: String(t.name || '').trim() || ('टैंक ' + (i + 1)), capacity: Number(t.capacity) || 0, diameter: Number(t.diameter) || 0, chart: chartToText(r.rows) });
          }
          const first = upd.tankList[fuel][0];
          if (first) { upd.dipCharts[fuel] = first.chart; upd.tanks[fuel] = { capacity: first.capacity, diameter: first.diameter }; }
        }
        await save(upd, 'टैंक/चार्ट सेव हो गए ✔');
      };
    };
    renderTanks();
    $c('#ps-m-save').onclick = () => save({ managerFullEdit: $c('#ps-m-full').checked }, 'मैनेजर अधिकार सेव ✔');
  };

  /* ---------- 7y. सेल्समैन (नए पंप): PIN ऐप में hash होकर पंप के record में ---------- */
  PS.verifySalesman = async function (smId, pin) {
    await PS.ready;
    const list = (PS.currentConfig && PS.currentConfig.salesmen) || [];
    const s2 = list.find(x => x.id === smId && x.active !== false);
    if (!s2 || !s2.pinHash || !s2.pinSalt) return null;
    const h = await PS.sha256Hex(s2.pinSalt + '|' + pin);
    return h === s2.pinHash ? s2 : null;
  };
  PS.canManageStaff = function () {
    const A = window.APP; return !!(A && A.S && (A.S.role === 'owner' || A.S.role === 'manager'));
  };
  PS.saveSalesmen = async function (db, list) {
    const pid = PS.activePumpId;
    await db.collection('pumps').doc(pid).update({ salesmen: list });
    PS.currentConfig.salesmen = list; window.CFG.salesmen = list;
  };
  PS.addSalesman = async function (db, name, phone, pin) {
    name = String(name || '').trim();
    phone = String(phone || '').replace(/\s+/g, '');
    if (!name) throw new Error('सेल्समैन का नाम लिखें');
    if (phone && !/^\d{10}$/.test(phone)) throw new Error('फ़ोन नंबर 10 अंकों का हो (या खाली छोड़ें)');
    if (!/^\d{4}$/.test(String(pin || ''))) throw new Error('PIN ठीक 4 अंकों का हो');
    const list = (PS.currentConfig.salesmen || []).slice();
    const salt = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) + '-' + Math.random().toString(36).slice(2, 6);
    list.push({ id, name, phone, active: true, pinSalt: salt, pinHash: await PS.sha256Hex(salt + '|' + pin) });
    await PS.saveSalesmen(db, list);
    return id;
  };
  PS.removeSalesman = async function (db, id) {
    const list = (PS.currentConfig.salesmen || []).filter(x => x.id !== id);
    await PS.saveSalesmen(db, list);
  };
  PS.salesmanCard = function (db) {
    if (!PS.isCustomPump() || !PS.canManageStaff() || document.getElementById('ps-sm-card')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const card = document.createElement('div'); card.id = 'ps-sm-card'; card.className = 'card'; card.style.marginTop = '12px';
    const list = PS.currentConfig.salesmen || [];
    const rows = list.length ? list.map(x => '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px dashed #dbe4f5"><span><b>' + x.name + '</b> <small class="mut">' + (x.phone || '') + '</small></span><button class="btn sm r" data-rm="' + x.id + '">🗑</button></div>').join('') : '<div class="mut" style="font-size:13px">अभी कोई सेल्समैन नहीं</div>';
    card.innerHTML = '<h3 style="margin:0 0 6px">👥 सेल्समैन</h3><div style="margin-bottom:8px">' + rows + '</div>' +
      '<label>नाम</label><input id="ps-sm-name"><label>फ़ोन (10 अंक, वैकल्पिक)</label><input id="ps-sm-phone" inputmode="numeric"><label>PIN (4 अंक)</label><input id="ps-sm-pin" inputmode="numeric" maxlength="4" type="password">' +
      '<div class="btns" style="margin-top:8px"><button class="btn g" id="ps-sm-add">➕ सेल्समैन जोड़ें</button></div>';
    main.insertBefore(card, main.firstChild);
    card.querySelector('#ps-sm-add').onclick = async () => {
      try {
        const v = id => card.querySelector('#' + id).value;
        await PS.addSalesman(db, v('ps-sm-name'), v('ps-sm-phone'), v('ps-sm-pin'));
        card.remove(); PS.salesmanCard(db); if (window.APP && APP.toast) APP.toast('सेल्समैन जुड़ गया ✔');
      } catch (e) { if (window.APP && APP.toast) APP.toast(e.message); }
    };
    card.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
      if (!confirm('यह सेल्समैन हटाएँ?')) return;
      try { await PS.removeSalesman(db, b.dataset.rm); card.remove(); PS.salesmanCard(db); } catch (e) { if (window.APP && APP.toast) APP.toast(e.message); }
    });
  };

  /* ---------- 7a. "और" पेज पर थीम चुनने का कार्ड (सिर्फ़ मालिक) ---------- */
  PS.themeCard = function (db) {
    if (document.getElementById('ps-theme-card')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const card = document.createElement('div'); card.id = 'ps-theme-card'; card.className = 'card'; card.style.marginTop = '12px';
    const cur = PS.currentTheme || 'mazda';
    card.innerHTML = '<h3 style="margin:0 0 6px">🎨 पंप का रंग (थीम)</h3><div class="mut" style="font-size:12px;margin-bottom:8px">चुनने पर पूरे ऐप का रंग उसी कंपनी के हिसाब से बदल जाएगा।</div>' +
      Object.keys(PS.THEMES).map(k => '<button class="btn sm ' + (k === cur ? 'g' : 'w') + '" data-theme="' + k + '" style="margin:3px">' + PS.THEMES[k].label + '</button>').join('');
    main.insertBefore(card, main.firstChild);
    card.querySelectorAll('[data-theme]').forEach(b => b.onclick = async () => {
      await PS.setTheme(b.dataset.theme, db);
      card.remove(); PS.themeCard(db);
      if (window.APP && APP.toast) APP.toast('रंग बदला ✔');
    });
  };

  /* ---------- 7. Firestore: हर पंप का डेटा अलग (माज़दा का मूल डेटा मूल जगह) ---------- */
  PS.wrapFirestore = function (db) {
    if (!db || db.__wrappedMultiPump) return db;
    const orig = db.collection.bind(db), pid = PS.activePumpId, GLOBAL = ['pumps', 'system_admins', 'audit_global'];
    db.collection = function (name) { if (pid === MAZDA || GLOBAL.indexOf(name) >= 0) return orig(name); return orig('pumps').doc(pid).collection(name); };
    db.__wrappedMultiPump = true; console.log('[MultiPump] Firestore → पंप [' + pid + ']');
    return db;
  };

  /* "और" पेज खुलने पर मालिक को थीम कार्ड दिखे (सभी scripts लोड होने के बाद) */
  setTimeout(() => {
    const A = window.APP; if (!A || !A.views || typeof A.views.more !== 'function') return;
    const o2 = A.views.more;
    A.views.more = async function () {
      const r = await o2.apply(this, arguments);
      try { if (A.isOwner && A.isOwner()) PS.themeCard(A.db); } catch (e) { }
      try { PS.salesmanCard(A.db); } catch (e) { }
      try { PS.accessCard(A.db); } catch (e) { }
      try { PS.settingsCard(A.db); } catch (e) { }
      return r;
    };
  }, 2000);

  /* नई जनरेट होने वाली स्क्रीनों के लिए हल्का observer */
  let tm = null;
  function watch() { if (!document.body || !PS.isCustomPump()) return; new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { try { PS.applyDOMBranding(); } catch (e) { } }, 250); }).observe(document.body, { childList: true, subtree: true }); }
  window.addEventListener('DOMContentLoaded', () => { setTimeout(() => { PS.applyDOMBranding(); watch(); }, 400); });
})();
