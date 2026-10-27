/* Mazda Oil Company - Owner Dashboard + Udhar Aging & WhatsApp (customers se achhe sambandh) */
(function () {
  'use strict';
  const APP = window.APP; if (!APP || !APP.C) return;
  const C = APP.C, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2, money = APP.money, dmy = APP.dmy, lit = APP.lit;
  const db = () => APP.db, today = () => APP.todayISO();
  const kv = (a, b, c) => '<div class="kv"><span>' + a + '</span><b class="' + (c || '') + '">' + b + '</b></div>';
  const waNum = ph => { let p = String(ph || '').replace(/\D/g, '').replace(/^0+/, ''); return !p ? '' : (p.startsWith('91') && p.length > 10 ? p : '91' + p); };
  const bucket = n => n <= 30 ? 0 : n <= 60 ? 1 : n <= 90 ? 2 : 3;
  const BN = ['0-30 दिन', '31-60 दिन', '61-90 दिन', '90+ दिन'], BC = ['g', 'o', 'o', 'r'];
  const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  APP.extras = { bucket };

  /* ===== Udhar reminder: aging + WhatsApp ===== */
  APP.views.reminders = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">Loading…</p>';
    const from = APP.shiftDate(today(), -120);
    let ps, ls; try { ps = await APP.getParties(false, true); ls = await db().collection('ledger').where('date', '>=', from).get(); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const last = {}; ls.docs.forEach(d => { const r = d.data(); if (r.kind === 'udhar' && r.partyId && (!last[r.partyId] || r.date > last[r.partyId])) last[r.partyId] = r.date; });
    const due = ps.filter(p => num(p.bal) > 0).map(p => { const n = last[p.id] ? dayDiff(last[p.id], today()) : 999; return { p, n, b: bucket(n) }; }).sort((a, b) => b.b - a.b || num(b.p.bal) - num(a.p.bal));
    const tot = [0, 0, 0, 0]; due.forEach(x => { tot[x.b] += num(x.p.bal); });
    main.innerHTML = '<div class="card"><h3>⏰ बकाया उधार</h3>' + kv('कुल बकाया', money(tot.reduce((a, b) => a + b, 0)), 'neg') + BN.map((n, i) => kv(n, money(tot[i]), BC[i] === 'r' ? 'neg' : '')).join('') + '</div>' +
      (due.length ? due.map((x, i) => '<div class="card"><div class="kv"><span><b>' + esc(x.p.name) + '</b><br><small class="mut">' + (x.n === 999 ? '90+ दिन से कोई उधार नहीं' : 'आखिरी उधार ' + dmy(last[x.p.id])) + '</small></span><b class="neg">' + money(x.p.bal) + '</b></div>' +
        '<div class="btns" style="margin-top:6px"><span class="chip ' + BC[x.b] + '">' + BN[x.b] + '</span>' +
        (x.p.phone ? '<a class="btn sm w" href="tel:' + esc(x.p.phone) + '">📞 Call</a>' : '') +
        (waNum(x.p.phone) ? '<button class="btn sm g" data-wa="' + i + '">💬 WhatsApp</button>' : '') + '</div></div>').join('') : '<div class="card"><p class="mut">कोई बकाया नहीं 👍</p></div>') +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← Back</button></div>';
    $$('[data-wa]').forEach(b => b.onclick = () => {
      const x = due[+b.dataset.wa], p = x.p;
      const msg = '*' + C.pump.name + '*\n\nनमस्ते ' + p.name + ' जी 🙏\nहमारे साथ जुड़े रहने के लिए धन्यवाद।\n\nआपका बकाया हिसाब: *₹' + r2(num(p.bal)) + '*\nसुविधा अनुसार भुगतान कर दीजिए।' +
        (C.pump.upi ? '\nUPI: ' + C.pump.upi : '') + '\n\n📞 ' + C.pump.phone;
      window.open('https://wa.me/' + waNum(p.phone) + '?text=' + encodeURIComponent(msg), '_blank');
      b.textContent = '✔ भेजा'; b.className = 'btn sm w';
    });
  };

  /* ===== Owner Dashboard ===== */
  APP.views.dashboard = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">Loading…</p>';
    const t = today(), from = APP.shiftDate(t, -29);
    let ds, ps; try { [ds, ps] = await Promise.all([db().collection('days').where('date', '>=', from).get(), APP.getParties(false, true)]); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const days = ds.docs.map(x => x.data()).sort((a, b) => a.date.localeCompare(b.date)), by = {}; days.forEach(d => { by[d.date] = d; });
    const sale = d => num(((d || {}).sum || {}).sale), sumOf = (f, cond) => days.filter(cond).reduce((a, d) => a + f(d), 0);
    const wk = sumOf(sale, d => d.date > APP.shiftDate(t, -7)), mo = sumOf(sale, d => d.date.slice(0, 7) === t.slice(0, 7));
    const bars = []; for (let i = 13; i >= 0; i--) { const dt = APP.shiftDate(t, -i); bars.push({ dt, s: sale(by[dt]) }); }
    const mx = Math.max(1, ...bars.map(b => b.s));
    const due = ps.filter(p => num(p.bal) > 0).sort((a, b) => num(b.bal) - num(a.bal)), totDue = due.reduce((a, p) => a + num(p.bal), 0);
    const L = days[days.length - 1] || {}, s = L.sum || {}, alerts = [];
    if (s.actStockP != null && s.actStockP < 1200) alerts.push('⛽ पेट्रोल स्टॉक कम: ' + lit(s.actStockP));
    if (s.actStockD != null && s.actStockD < 1000) alerts.push('🛢️ डीज़ल स्टॉक कम: ' + lit(s.actStockD));
    if (s.diffP != null && Math.abs(s.diffP) > (num(C.stockTolerance) || 25)) alerts.push('⚠️ पेट्रोल फर्क ' + r2(s.diffP) + ' L (' + dmy(L.date) + ')');
    if (s.diffD != null && Math.abs(s.diffD) > (num(C.stockTolerance) || 25)) alerts.push('⚠️ डीज़ल फर्क ' + r2(s.diffD) + ' L (' + dmy(L.date) + ')');
    if (!by[t]) alerts.push('📝 आज का हिसाब अभी शुरू नहीं हुआ');
    main.innerHTML = (alerts.length ? '<div class="card">' + alerts.map(a => '<div class="warn">' + esc(a) + '</div>').join('') + '</div>' : '<div class="ok" style="margin-bottom:12px">✔ सब ठीक है — कोई अलर्ट नहीं</div>') +
      '<div class="card"><h3>📊 आज · ' + dmy(t) + '</h3>' + kv('बिक्री', money(sale(by[t])), 'big') + kv('पेट्रोल', lit(((by[t] || {}).sum || {}).litP)) + kv('डीज़ल', lit(((by[t] || {}).sum || {}).litD)) + kv('बचा कैश', money(((by[t] || {}).sum || {}).close)) + '</div>' +
      '<div class="card"><h3>📈 बिक्री</h3>' + kv('कल', money(sale(by[APP.shiftDate(t, -1)]))) + kv('पिछले 7 दिन', money(wk)) + kv('इस महीने', money(mo), 'big') +
      '<div style="display:flex;align-items:flex-end;gap:3px;height:110px;margin-top:10px;padding:6px;background:#f8f9fc;border-radius:10px">' +
      bars.map(b => '<div style="flex:1;text-align:center;min-width:0"><div style="height:' + Math.max(3, Math.round(b.s / mx * 80)) + 'px;background:' + (b.dt === t ? '#fdb813' : '#0b3d91') + ';border-radius:3px 3px 0 0"></div><div style="font-size:9px;color:#666">' + b.dt.slice(8) + '</div></div>').join('') + '</div></div>' +
      '<div class="card"><h3>👥 बकाया उधार</h3>' + kv('कुल बकाया', money(totDue), 'neg') + due.slice(0, 5).map(p => kv(esc(p.name), money(p.bal))).join('') +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'reminders\')">⏰ सबको याद दिलाएँ</button></div></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'monthreport\')">📅 Monthly Report</button><button class="btn w" onclick="APP.go(\'more\')">← Back</button></div>';
  };
  /* ===== Tel kitne din chalega (average bikri ke hisab se) ===== */
  async function stockCard() {
    let snap; try { snap = await db().collection('days').where('date', '>=', APP.shiftDate(today(), -13)).get(); } catch (e) { return ''; }
    const days = snap.docs.map(x => x.data()).filter(d => d.sum && d.sum.litP != null).sort((a, b) => a.date.localeCompare(b.date));
    if (!days.length) return '';
    const rec = days.slice(-7), last = days[days.length - 1], s = last.sum; let low = false;
    const row = (name, lk, ak, ek) => {
      const avg = rec.reduce((a, d) => a + num(d.sum[lk]), 0) / rec.length;
      const st = s[ak] != null ? num(s[ak]) : (s[ek] != null ? num(s[ek]) : null);
      if (st == null || !(avg > 0)) return '<div class="item"><div class="a"><b>' + name + '</b><small>डिप / बिक्री का डेटा नहीं</small></div></div>';
      const d = st / avg; if (d < 3) low = true;
      return '<div class="item"><div class="a"><b>' + name + '</b><small>स्टॉक ' + lit(st) + ' · औसत ' + lit(avg) + '/दिन · लगभग ' + dmy(APP.shiftDate(last.date, Math.floor(d))) + ' तक</small></div><span class="chip ' + (d < 3 ? 'r' : d < 5 ? 'o' : 'g') + '" style="font-size:15px">' + d.toFixed(1) + ' दिन</span></div>';
    };
    return '<h3>⛽ तेल कितने दिन चलेगा</h3>' + row('⛽ पेट्रोल', 'litP', 'actStockP', 'expStockP') + row('🛢️ डीज़ल', 'litD', 'actStockD', 'expStockD') +
      (low ? '<div class="warn">⚠️ 3 दिन से कम बचा है — टैंकर मँगवाएँ</div>' : '') +
      '<div class="mut" style="font-size:12px;margin-top:6px">पिछले ' + rec.length + ' दिन की औसत बिक्री से · स्टॉक ' + dmy(last.date) + ' की डिप से</div>';
  }
  const addStock = name => {
    const orig = APP.views[name];
    APP.views[name] = async function () {
      if (orig) await orig.apply(this, arguments);
      const main = $('#main'); if (!main || S.tab !== name) return;
      const html = await stockCard(); if (!html || S.tab !== name) return;
      const old = $('#stkdays-card'); if (old) old.remove();
      const box = document.createElement('div'); box.id = 'stkdays-card'; box.className = 'card'; box.innerHTML = html;
      main.insertBefore(box, main.children[1] || null);
    };
  };
  addStock('v_home'); addStock('dashboard');
  APP.extras.stockCard = stockCard;
  console.log('[Mazda extras.js] loaded ✓');
})();

/* ===== Premium UI enhancer: nav icons, header logo, emoji → clean SVG icons ===== */
(function () {
  'use strict';
  const P = {
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 12h-5a2 2 0 0 0 0 4h5z"/><path d="M3 7h14"/>',
    car: '<path d="M5 17H3v-5l2-5a2 2 0 0 1 2-1.4h10A2 2 0 0 1 19 7l2 5v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>',
    stock: '<path d="M3 21h18"/><rect x="4" y="13" width="3.5" height="6" rx="1"/><rect x="10.2" y="9" width="3.5" height="10" rx="1"/><rect x="16.5" y="12" width="3.5" height="7" rx="1"/><path d="M4 8l5-4 4 3 7-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    wa: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/><path d="M9 8.8c.2 2.6 3.6 6 6.2 6.2l1.2-1.3-2-1-.9.6c-.9-.4-1.9-1.4-2.3-2.3l.6-.9-1-2z"/>',
    share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6M19 5l1.5 1.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13"/><path d="M7 8h5"/><path d="M15 9h2.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    trend: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h-4M6 22v-4h4"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  const svg = n => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>';
  const E = {
    '📞': 'phone', '💬': 'wa', '📤': 'share', '🖨': 'print', '⏰': 'clock', '📊': 'chart', '📅': 'cal', '🏦': 'bank', '👥': 'users',
    '👷': 'users', '⛽': 'fuel', '🛢': 'fuel', '🔍': 'search', '📄': 'doc', '📝': 'doc', '📒': 'doc', '🧾': 'doc', '📈': 'trend',
    '🔄': 'refresh', '⚠': 'warn', '🚚': 'truck', '💰': 'wallet', '🏠': 'doc', '🚗': 'car', '👤': 'user', '⚙': 'dots', '➕': 'plus'
  };
  const RE = new RegExp('^\\s*(' + Object.keys(E).join('|') + ')[\\uFE0F\\u200D]*\\s*');

  function navIcon(btn) {
    const i = btn.querySelector('i'); if (!i || i.dataset.pi) return;
    const t = (btn.textContent || '').replace(i.textContent, '').trim();
    let k = null;
    if (/हिसाब|होम|डैश|आज|दिन/.test(t)) k = 'doc';
    else if (/खाते|खाता|पार्टी|उधार|ग्राहक/.test(t)) k = 'wallet';
    else if (/गाड़ी|गाडी|कैश/.test(t)) k = 'car';
    else if (/स्टॉक|स्टाक|शॉप|दुकान/.test(t)) k = 'stock';
    else if (/निजी|प्राइवेट/.test(t)) k = 'user';
    else if (/और|मोर|सेटिंग|अन्य/.test(t)) k = 'dots';
    else { const m = (i.textContent || '').trim().match(RE); if (m) k = E[m[1]]; }
    if (!k) return;
    i.innerHTML = svg(k); i.dataset.pi = '1';
  }

  function swapEmoji(el) {
    if (el.dataset.pi) return;
    const n = el.firstChild;
    if (!n || n.nodeType !== 3) return;
    const m = n.nodeValue.match(RE);
    if (!m) return;
    n.nodeValue = n.nodeValue.slice(m[0].length);
    const s = document.createElement('span'); s.innerHTML = svg(E[m[1]]); s.style.display = 'contents';
    el.insertBefore(s.firstChild, n);
    el.dataset.pi = '1';
  }

  function headerLogo() {
    const h = document.querySelector('header'); if (!h || h.querySelector('.hdr-logo')) return;
    const im = new Image(); im.className = 'hdr-logo'; im.alt = ''; im.src = './logo.png';
    im.onerror = () => im.remove();
    h.insertBefore(im, h.firstChild);
  }

  function run() {
    try {
      headerLogo();
      document.querySelectorAll('nav button').forEach(navIcon);
      document.querySelectorAll('.btn, .card h3, .sheet h3').forEach(swapEmoji);
    } catch (e) { }
  }
  let t = null;
  const sched = () => { if (t) return; t = requestAnimationFrame(() => { t = null; run(); }); };
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
  run();
})();
