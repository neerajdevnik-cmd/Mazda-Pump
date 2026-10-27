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
