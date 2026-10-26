/* माज़दा ऑयल कंपनी — सेल्समैन ऐप
   - "मेरा हिसाब": मीटर रीडिंग (पेट्रोल/डीज़ल) → बिक्री → पेमेंट/खर्चा → कैश हिसाब → शिफ्ट जमा
   - "उधार एंट्री": पार्टी चुनकर उधार लिखना (ledger + पार्टी बैलेंस में अपने-आप, मालिक के दिन के हिसाब में भी दिखती है)
   - मालिक/मैनेजर के "हिसाब" पेज पर सेल्समैन शिफ्ट का कार्ड: एक बटन से रीडिंग / Paytm / स्वाइप / खर्चा दिन के हिसाब में भर जाते हैं
   डेटा: collection "sm_shifts" (doc id = <सेल्समैन id>_<तारीख>) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db, FV = () => APP.FV;
  const isSm = () => !!(APP.isSalesman && APP.isSalesman());
  const isVw = () => !!(APP.isViewer && APP.isViewer());
  const today = () => APP.todayISO();
  const COL = 'sm_shifts';
  const NZP = ['p1', 'p2', 'p3', 'p4'], NZD = ['d1', 'd2', 'd3', 'd4'];
  const shiftId = (sid, date) => sid + '_' + date;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
  const val = v => (v == null ? '' : v);
  const tsMs = x => (x && x.toMillis ? x.toMillis() : 0);
  const errMsg = e => (e && e.code === 'permission-denied')
    ? 'इजाज़त नहीं मिली — Firebase rules में "sm_shifts" को खोलना होगा'
    : ((e && e.message) || String(e));
  const FUELN = { petrol: 'पेट्रोल', diesel: 'डीज़ल' };

  let ST = null;            // सेल्समैन की मौजूदा शिफ्ट का हाल
  let saveTimer = null;

  /* ==================== डेटा लोड ==================== */
  async function latestRates() {
    if (S.smRates && Date.now() - (S.smRatesAt || 0) < 600000) return S.smRates;
    const r = { rateP: S.rates.petrol, rateD: S.rates.diesel };
    try {
      const s = await db().collection('days').orderBy('date', 'desc').limit(1).get();
      if (!s.empty) { const d = s.docs[0].data(); if (num(d.rateP)) r.rateP = d.rateP; if (num(d.rateD)) r.rateD = d.rateD; }
    } catch (e) { }
    S.smRates = r; S.smRatesAt = Date.now();
    return r;
  }

  // हर नोज़ल की पिछली क्लोज़िंग (मालिक के दिन से या किसी और की जमा शिफ्ट से) = आज की ओपनिंग
  async function loadPrevOpen(date, sid) {
    const best = {};
    const take = (k, c, key) => { if (!K.has(c)) return; if (!best[k] || key > best[k].key) best[k] = { c: num(c), key }; };
    try {
      const s = await db().collection('days').where('date', '<', date).orderBy('date', 'desc').limit(1).get();
      s.docs.forEach(x => { const d = x.data(); K.NZ.forEach(k => take(k, d.nz && d.nz[k] && d.nz[k].c, d.date + '|2')); });
    } catch (e) { }
    try {
      const s = await db().collection(COL).where('date', '<=', date).orderBy('date', 'desc').limit(30).get();
      s.docs.forEach(x => {
        const d = x.data();
        if (d.status !== 'submitted' || x.id === shiftId(sid, date)) return;
        K.NZ.forEach(k => take(k, d.nz && d.nz[k] && d.nz[k].c, d.date + '|1|' + String(tsMs(d.submittedAt)).padStart(15, '0')));
      });
    } catch (e) { }
    return best;
  }

  async function loadState(date, light) {
    const sm = S.salesman, sid = sm.id;
    const snapP = db().collection(COL).doc(shiftId(sid, date)).get();
    const rowsP = db().collection('ledger').where('date', '==', date).where('sid', '==', sid).get().catch(() => null);
    const ratesP = latestRates();
    const prevP = light ? Promise.resolve({}) : loadPrevOpen(date, sid);
    const [snap, rs, rates, prev] = await Promise.all([snapP, rowsP, ratesP, prevP]);
    const rows = rs ? rs.docs.map(x => ({ id: x.id, ...x.data() })).filter(r => r.kind === 'udhar') : [];
    const base = {
      sid, name: sm.name, date, status: 'open', rateP: rates.rateP, rateD: rates.rateD,
      testing: C.testing != null ? C.testing : 5, nz: {}, paytm: '', swipe: '', expLabel: '', expAmt: '', cashActual: '', note: ''
    };
    const doc = Object.assign(base, snap.exists ? snap.data() : {});
    doc.nz = doc.nz || {};
    const autoO = {};
    K.NZ.forEach(k => {
      const n = doc.nz[k] = Object.assign({ o: '', c: '' }, doc.nz[k] || {});
      if (prev[k]) {
        if (!K.has(n.o)) n.o = prev[k].c;
        if (num(n.o) === prev[k].c) autoO[k] = true;
      }
    });
    return { date, doc, rows, prev, autoO, locked: doc.status === 'submitted', openEdit: false, exists: snap.exists };
  }

  /* ==================== हिसाब ==================== */
  function readForm() {
    if (!ST) return null;
    if (!$('#sm-rateP')) return ST.doc;
    const g = id => { const el = $('#' + id); return el ? el.value : ''; };
    const d = Object.assign({}, ST.doc, {
      rateP: g('sm-rateP'), rateD: g('sm-rateD'), testing: g('sm-testing'),
      paytm: g('sm-paytm'), swipe: g('sm-swipe'), expLabel: g('sm-expLabel'), expAmt: g('sm-expAmt'),
      cashActual: g('sm-cash'), note: g('sm-note'), nz: {}
    });
    K.NZ.forEach(k => { d.nz[k] = { o: '', c: '' }; });
    $$('.smn').forEach(i => { d.nz[i.dataset.k][i.dataset.f] = i.value; });
    return d;
  }
  function computeSm(d) {
    return K.compute(Object.assign({}, d, { kharcha: d.expAmt, driverInaam: 0, chaiKhana: 0, kharchaItems: [], malikDiya: 0, openCash: 0 }), ST.rows);
  }
  function summaryOf(d, o) {
    const act = K.has(d.cashActual) ? num(d.cashActual) : null;
    return {
      litP: o.litP, litD: o.litD, amtP: o.amtP, amtD: o.amtD, sale: o.sale,
      udhar: o.udhar, udharCount: ST.rows.length, expected: o.close,
      actual: act, diff: act === null ? null : r2(act - o.close)
    };
  }

  async function saveShift(status, silent) {
    const d = readForm(); if (!d) return;
    const o = computeSm(d);
    const data = Object.assign({}, d, {
      sid: S.salesman.id, name: S.salesman.name, date: ST.date, status,
      sum: summaryOf(d, o), updatedAt: FV().serverTimestamp()
    });
    if (status === 'submitted') { data.submittedAt = FV().serverTimestamp(); data.imported = false; }
    await APP.commit(db().collection(COL).doc(shiftId(S.salesman.id, ST.date)).set(data, { merge: true }));
    ST.doc = Object.assign({}, d, { status });
    if (!silent) toast(status === 'submitted' ? 'शिफ्ट जमा हो गई ✔' : 'सेव हो गया ✔');
  }
  function scheduleSave() {
    if (!ST || ST.locked) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; saveShift('open', true).catch(() => { }); }, 1500);
  }
  async function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer); saveTimer = null;
      if (ST && !ST.locked) { try { await saveShift('open', true); } catch (e) { } }
    }
  }

  function recalc() {
    if (!ST) return;
    const d = readForm(); ST.doc = d;
    const o = computeSm(d);
    K.NZ.forEach(k => { const e = $('#smnet-' + k); if (e) e.textContent = o.nz[k].ok ? r2(o.nz[k].net) : '–'; });
    const w = $('#sm-warn');
    if (w) w.innerHTML = o.warn.map(x => '<div class="warn">' + esc(x) + '</div>').join('') +
      (o.filled === 0 ? '<div class="mut">जिस नोज़ल पर काम किया उसकी क्लोज़िंग भरें</div>' : '<div class="mut">' + o.filled + '/8 नोज़ल भरे हैं</div>');
    const sum = $('#sm-sum');
    if (sum) {
      const hasCash = K.has(d.cashActual);
      const diff = hasCash ? r2(num(d.cashActual) - o.close) : null;
      sum.innerHTML =
        kv('पेट्रोल बिक्री', lit(o.litP) + ' = ' + money(o.amtP)) +
        kv('डीज़ल बिक्री', lit(o.litD) + ' = ' + money(o.amtD)) +
        kv('कुल बिक्री', money(o.sale), 'big') +
        kv('− Paytm / UPI', money(d.paytm)) +
        kv('− स्वाइप (कार्ड)', money(d.swipe)) +
        kv('− उधार दिया (' + ST.rows.length + ' एंट्री)', money(o.udhar)) +
        kv('− खर्चा' + (d.expLabel ? ' (' + esc(d.expLabel) + ')' : ''), money(d.expAmt)) +
        kv('कैश जमा होना चाहिए', money(o.close), 'big' + (o.close < 0 ? ' neg' : '')) +
        (hasCash ? `<div class="${Math.abs(diff) < 0.5 ? 'ok' : 'warn'}" style="margin-top:8px">${Math.abs(diff) < 0.5 ? '✔ कैश बराबर है' : (diff < 0 ? 'कैश कम है: ' + money(-diff) : 'कैश ज़्यादा है: ' + money(diff))}</div>` : '');
    }
  }

  function shareText() {
    const d = ST.doc, o = computeSm(d), sm = S.salesman;
    const diff = K.has(d.cashActual) ? r2(num(d.cashActual) - o.close) : null;
    return [
      '*' + C.pump.name + ' — शिफ्ट हिसाब*',
      'सेल्समैन: ' + sm.name + ' · ' + dmy(ST.date),
      'पेट्रोल: ' + lit(o.litP) + ' = ' + money(o.amtP),
      'डीज़ल: ' + lit(o.litD) + ' = ' + money(o.amtD),
      'कुल बिक्री: ' + money(o.sale),
      'Paytm/UPI: ' + money(d.paytm) + ' · स्वाइप: ' + money(d.swipe),
      'उधार: ' + money(o.udhar) + ' (' + ST.rows.length + ' एंट्री)',
      num(d.expAmt) ? 'खर्चा: ' + money(d.expAmt) + (d.expLabel ? ' (' + d.expLabel + ')' : '') : '',
      'कैश हिसाब से: ' + money(o.close),
      K.has(d.cashActual) ? 'कैश गिना/दिया: ' + money(d.cashActual) + (diff === null || Math.abs(diff) < 0.5 ? ' ✔' : (diff < 0 ? ' (कम ' + money(-diff) + ')' : ' (ज़्यादा ' + money(diff) + ')')) : ''
    ].filter(Boolean).join('\n');
  }
  function share() {
    const t = shareText();
    if (navigator.share) navigator.share({ text: t }).catch(() => { });
    else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  }

  async function submit() {
    const d = readForm(), o = computeSm(d);
    if (o.warn.length) return alert('पहले ये गलती सुधारें:\n\n' + o.warn.join('\n'));
    let partial = null;
    K.NZ.forEach(k => { const n = d.nz[k]; if (K.has(n.c) && !K.has(n.o) && !partial) partial = k.toUpperCase(); });
    if (partial) return alert(partial + ' की क्लोज़िंग भरी है पर ओपनिंग खाली है — ओपनिंग भरें।');
    if (o.filled === 0) return toast('कम से कम एक नोज़ल की रीडिंग भरें');
    if (o.litP > 0 && !(num(d.rateP) > 0)) return toast('पेट्रोल का रेट भरें');
    if (o.litD > 0 && !(num(d.rateD) > 0)) return toast('डीज़ल का रेट भरें');
    if (!K.has(d.cashActual)) return toast('गिना हुआ कैश भरें (कैश न हो तो 0 लिखें)');
    const diff = r2(num(d.cashActual) - o.close);
    const msg = 'शिफ्ट जमा करें?\n\nकुल बिक्री: ' + money(o.sale) + '\nकैश हिसाब से: ' + money(o.close) + '\nकैश गिना: ' + money(d.cashActual) +
      (Math.abs(diff) >= 0.5 ? '\n\n⚠️ ' + (diff < 0 ? 'कैश कम है: ' + money(-diff) : 'कैश ज़्यादा है: ' + money(diff)) : '\n\n✔ कैश बराबर है') +
      '\n\nजमा करने के बाद आप बदलाव नहीं कर पाएँगे।';
    if (!confirm(msg)) return;
    try {
      await saveShift('submitted', true);
      if (APP.audit) APP.audit('sm_shift_submit', { sid: S.salesman.id, date: ST.date, sale: o.sale, expected: o.close, actual: num(d.cashActual) });
      toast('शिफ्ट जमा हो गई ✔ — मालिक को दिख रही है');
      APP.go('salesman');
    } catch (e) { toast('जमा नहीं हुई: ' + errMsg(e)); }
  }

  /* ==================== उधार एंट्री ==================== */
  function rowsHtml(rows, canDel) {
    if (!rows.length) return '<p class="mut">अभी कोई उधार एंट्री नहीं</p>';
    return rows.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(r => `<div class="item"><div class="a"><b>${esc(r.partyName)}</b>
      <small>${esc(r.time || '')} · ${esc(r.vehicle || '')} · ${FUELN[r.fuel] || ''} ${lit(r.litre)}</small>
      ${r.verified ? '<small style="color:#0a7d33">✔ मालिक ने मिलान कर लिया</small>' : '<small style="color:#b26a00">⏳ मिलान बाकी</small>'}</div>
      <div style="text-align:right"><b class="neg">${money(r.amount)}</b>
      ${canDel && !r.verified ? `<div><button class="btn sm r" data-smdel="${r.id}">🗑</button></div>` : ''}</div></div>`).join('');
  }
  function bindDel(root) {
    $$('[data-smdel]', root).forEach(b => b.onclick = () => delRow(b.dataset.smdel));
  }
  async function delRow(id) {
    if (!ST || ST.locked) return toast('शिफ्ट जमा हो चुकी है');
    const r = ST.rows.find(x => x.id === id);
    if (!r || r.verified) return;
    if (!confirm('ये उधार एंट्री हटाएँ?\n\n' + r.partyName + ' · ' + (r.vehicle || '') + ' · ' + money(r.amount))) return;
    try {
      const b = db().batch();
      b.delete(db().collection('ledger').doc(id));
      b.update(db().collection('parties').doc(r.partyId), { bal: FV().increment(-K.signed(r)) });
      await APP.commit(b.commit());
      if (APP.audit) APP.audit('sm_udhar_delete', { id, party: r.partyName, amount: r.amount });
      if (S.parties) S.parties.pub = null;
      toast('हट गई ✔');
      APP.go(S.tab);
    } catch (e) { toast('हटा नहीं पाया: ' + errMsg(e)); }
  }

  async function udharModal(pre) {
    pre = pre || {};
    if (ST && ST.locked) return toast('शिफ्ट जमा हो चुकी है — बदलाव के लिए मालिक से खुलवाएँ');
    const date = S.date || today();
    let parties;
    try { parties = await APP.getParties(false, true); } catch (e) { return toast('पार्टी लिस्ट नहीं मिली: ' + errMsg(e)); }
    if (!parties.length) return toast('पार्टी लिस्ट खाली है — मालिक से पार्टी जुड़वाएँ');
    const rates = { petrol: num(ST && ST.doc.rateP) || S.rates.petrol, diesel: num(ST && ST.doc.rateD) || S.rates.diesel };
    const m = modal(`<h3>🚚 उधार लिखें</h3>
      <div class="mut">${dmy(date)} · ${esc(S.salesman.name)}</div>
      <label>पार्टी खोजें (नाम या गाड़ी नंबर)</label><input id="su-q" placeholder="टाइप करें…" autocomplete="off">
      <label>पार्टी</label><select id="su-p"></select>
      <label>गाड़ी नंबर</label><select id="su-v"></select><input id="su-vx" placeholder="गाड़ी नंबर टाइप करें" style="display:none;margin-top:6px;text-transform:uppercase">
      <div class="row"><div><label>तेल</label><select id="su-f"><option value="petrol">पेट्रोल</option><option value="diesel">डीज़ल</option></select></div>
      <div><label>रेट</label><input id="su-r" inputmode="decimal"></div></div>
      <div class="row"><div><label>लीटर</label><input id="su-l" inputmode="decimal"></div><div><label>रुपये</label><input id="su-a" inputmode="decimal"></div></div>
      <label>नोट</label><input id="su-n">
      <div class="btns"><button class="btn g" id="su-sv">सेव करें</button><button class="btn bpcl" id="su-slip">🖨️ पर्ची</button><button class="btn w" id="su-cl">रद्द</button></div>`);
    const q = id => $('#' + id, m);
    const nrm = s => String(s || '').toLowerCase().replace(/[\s\-.]/g, '');
    let last = 'lit';

    const fillVeh = (wantVeh) => {
      const p = parties.find(x => x.id === q('su-p').value) || {};
      const vs = p.vehicles || [];
      q('su-v').innerHTML = vs.map(v => `<option ${wantVeh && nrm(v) === nrm(wantVeh) ? 'selected' : ''}>${esc(v)}</option>`).join('') + '<option value="__x">अन्य (टाइप करें)</option>';
      if (wantVeh && !vs.some(v => nrm(v) === nrm(wantVeh))) { q('su-v').value = '__x'; q('su-vx').value = wantVeh; }
      q('su-vx').style.display = q('su-v').value === '__x' ? '' : 'none';
    };
    const fillParties = (selId, wantVeh) => {
      const t = nrm(q('su-q').value);
      let list = parties.filter(p => !t || nrm(p.name).includes(t) || (p.vehicles || []).some(v => nrm(v).includes(t)));
      if (selId && !list.some(p => p.id === selId)) { const sp = parties.find(p => p.id === selId); if (sp) list.unshift(sp); }
      q('su-p').innerHTML = list.length ? list.map(p => `<option value="${p.id}" ${p.id === selId ? 'selected' : ''}>${esc(p.name)}</option>`).join('') : '<option value="">— कोई पार्टी नहीं मिली —</option>';
      fillVeh(wantVeh);
    };
    q('su-q').oninput = () => fillParties(null, '');
    q('su-p').onchange = () => fillVeh('');
    q('su-v').onchange = () => { q('su-vx').style.display = q('su-v').value === '__x' ? '' : 'none'; };
    fillParties(pre.partyId || parties[0].id, pre.vehicle || '');

    const setRate = () => { q('su-r').value = rates[q('su-f').value] || ''; };
    const calcA = () => { const r = num(q('su-r').value), l = num(q('su-l').value); q('su-a').value = r && l ? r2(r * l) : ''; };
    const calcL = () => { const r = num(q('su-r').value), a = num(q('su-a').value); q('su-l').value = r && a ? r2(a / r) : ''; };
    q('su-f').onchange = () => { setRate(); last === 'lit' ? calcA() : calcL(); };
    q('su-r').oninput = () => { last === 'lit' ? calcA() : calcL(); };
    q('su-l').oninput = () => { last = 'lit'; calcA(); };
    q('su-a').oninput = () => { last = 'amt'; calcL(); };
    setRate();

    const vehOf = () => q('su-v').value === '__x' ? q('su-vx').value.trim().toUpperCase() : q('su-v').value;
    q('su-cl').onclick = () => m.close();
    q('su-slip').onclick = () => {
      const p = parties.find(x => x.id === q('su-p').value) || {};
      if (!q('su-a').value) return toast('कृपया रकम भरें');
      if (APP.showThermalSlip) APP.showThermalSlip({
        partyName: p.name, partyPhone: p.phone || '', vehicle: vehOf(), fuel: q('su-f').value,
        litre: q('su-l').value, rate: q('su-r').value, amount: q('su-a').value, date, time: APP.nowTime()
      });
    };
    q('su-sv').onclick = async () => {
      const p = parties.find(x => x.id === q('su-p').value);
      if (!p) return toast('पार्टी चुनें');
      const data = {
        partyId: p.id, partyName: p.name, date, time: APP.nowTime(), kind: 'udhar', note: q('su-n').value.trim(),
        vehicle: vehOf(), fuel: q('su-f').value, rate: num(q('su-r').value), litre: num(q('su-l').value), amount: num(q('su-a').value),
        by: S.salesman.name, uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        src: 'salesman', sid: S.salesman.id
      };
      if (!data.vehicle) return toast('गाड़ी नंबर लिखें');
      if (!(data.litre > 0) || !(data.amount > 0)) return toast('लीटर व रुपये भरें');
      const btn = q('su-sv'); if (btn.disabled) return;
      btn.disabled = true;
      try {
        const dup = APP.findDupEntry ? await APP.findDupEntry(data) : null;
        if (dup && !confirm('⚠️ ऐसी ही एंट्री पहले से मौजूद है:\n' + dup.partyName + ' · ' + dup.vehicle + ' · ' + money(dup.amount) + ' · ' + (dup.time || '') + '\nकिसने की: ' + (dup.by || '?') + '\n\nफिर भी दोबारा जोड़ें?')) { btn.disabled = false; return; }
        if (num(p.limit) > 0 && num(p.bal) + data.amount > num(p.limit) && !confirm('⚠️ इस पार्टी की उधार सीमा पार हो रही है।\n\nफिर भी उधार दें?')) { btn.disabled = false; return; }
        data.at = FV().serverTimestamp();
        const b = db().batch();
        b.set(db().collection('ledger').doc(), data);
        b.update(db().collection('parties').doc(p.id), { bal: FV().increment(K.signed(data)) });
        await APP.commit(b.commit());
        if (APP.audit) APP.audit('sm_udhar_add', { party: p.name, vehicle: data.vehicle, amount: data.amount, date });
        m.close(); toast('उधार लिख गया ✔');
        if (S.parties) S.parties.pub = null;
        APP.go(S.tab);
      } catch (e) { btn.disabled = false; toast('सेव नहीं हुआ: ' + errMsg(e)); }
    };
  }

  /* ==================== स्क्रीन: मेरा हिसाब ==================== */
  APP.views.salesman = async function () {
    const main = $('#main'); if (!main) return;
    await flush();
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const date = S.date || today();
    try { ST = await loadState(date, false); }
    catch (e) { main.innerHTML = APP.errBox(e) + '<p class="mut">' + esc(errMsg(e)) + '</p>'; return; }
    draw();
  };

  function draw() {
    const main = $('#main'); if (!main || !ST) return;
    const d = ST.doc, locked = ST.locked, dis = locked ? 'disabled' : '';
    const minD = APP.shiftDate(today(), -2);
    const inp = (id, v, ph, cls) => `<input id="${id}" class="${cls || 'smi'}" inputmode="decimal" value="${esc(val(v))}" placeholder="${ph || ''}" ${dis}>`;
    const nzr = (k, lab) => {
      const n = d.nz[k] || {};
      const auto = ST.autoO[k] && !ST.openEdit;
      const roO = locked ? 'disabled' : (auto ? 'readonly style="background:#f0f0f0;color:#555;font-weight:bold"' : '');
      return `<div class="nz"><b>${lab}</b>
        <input class="smn" data-k="${k}" data-f="o" inputmode="decimal" value="${esc(val(n.o))}" ${roO}>
        <input class="smn" data-k="${k}" data-f="c" inputmode="decimal" value="${esc(val(n.c))}" placeholder="क्लोज़िंग" ${dis}>
        <span id="smnet-${k}">–</span></div>`;
    };
    const anyAuto = K.NZ.some(k => ST.autoO[k]);
    const chip = locked
      ? (d.imported ? '<span class="chip g">जमा ✔ हिसाब में जुड़ा</span>' : '<span class="chip g">जमा ✔ लॉक</span>')
      : '<span class="chip">चालू</span>';

    main.innerHTML = `
    <div class="card"><div class="row"><div><label style="margin-top:0">तारीख</label>
      <input type="date" id="sm-date" value="${ST.date}" max="${today()}" min="${minD}"></div>
      <div style="flex:0 0 auto;align-self:end">${chip}</div></div>
      ${locked ? '<p class="mut" style="margin:8px 0 0">शिफ्ट जमा हो चुकी है। कुछ बदलना हो तो मालिक/मैनेजर से "दोबारा खुलवाएँ"।</p>' : ''}</div>

    <div class="card"><h3>आज का रेट (₹/लीटर)</h3><div class="row">
      <div><label>पेट्रोल</label>${inp('sm-rateP', d.rateP)}</div>
      <div><label>डीज़ल</label>${inp('sm-rateD', d.rateD)}</div>
      <div><label>टेस्टिंग (L)</label>${inp('sm-testing', d.testing)}</div></div></div>

    <div class="card"><h3>⛽ मीटर रीडिंग</h3>
      <div class="nz h"><span></span><span>ओपनिंग</span><span>क्लोज़िंग</span><span style="text-align:right">नेट L</span></div>
      <b class="mut">पेट्रोल</b>${NZP.map((k, i) => nzr(k, 'P' + (i + 1))).join('')}
      <b class="mut">डीज़ल</b>${NZD.map((k, i) => nzr(k, 'D' + (i + 1))).join('')}
      <div id="sm-warn"></div>
      ${(!locked && anyAuto) ? `<div class="btns" style="margin-top:8px"><button class="btn sm w" id="sm-open-edit" type="button">${ST.openEdit ? '🔒 ओपनिंग वापस लॉक करें' : '🔓 ओपनिंग बदलें (सिर्फ़ गलती होने पर)'}</button></div>` : ''}
      <p class="mut" style="margin:8px 0 0;font-size:12px">ओपनिंग पिछली क्लोज़िंग से अपने-आप आती है। जिस नोज़ल पर आपने काम नहीं किया उसे खाली छोड़ दें।</p></div>

    <div class="card"><h3>🚚 मेरी उधार एंट्री</h3>
      <div id="sm-rows">${rowsHtml(ST.rows, !locked)}</div>
      ${locked ? '' : '<div class="btns"><button class="btn o" id="sm-addu" type="button">+ उधार लिखें</button></div>'}</div>

    <div class="card"><h3>💳 पेमेंट और खर्चा</h3>
      <div class="row"><div><label>Paytm / UPI कुल</label>${inp('sm-paytm', d.paytm)}</div><div><label>स्वाइप (कार्ड) कुल</label>${inp('sm-swipe', d.swipe)}</div></div>
      <div class="row"><div><label>खर्चा (किस चीज़ का)</label><input id="sm-expLabel" class="smi" value="${esc(val(d.expLabel))}" placeholder="जैसे चाय, पंचर" ${dis}></div>
      <div><label>खर्चा ₹</label>${inp('sm-expAmt', d.expAmt)}</div></div></div>

    <div class="card"><h3>🧾 मेरा हिसाब</h3><div id="sm-sum"></div>
      <label>गिना हुआ कैश (जो आप जमा कर रहे हैं)</label>${inp('sm-cash', d.cashActual, 'कैश न हो तो 0 लिखें')}
      <label>नोट</label><input id="sm-note" class="smi" value="${esc(val(d.note))}" ${dis}></div>

    <div class="btns">
      ${locked ? '' : '<button class="btn w" id="sm-save" type="button">💾 सेव</button><button class="btn g" id="sm-submit" type="button">✅ शिफ्ट जमा करें</button>'}
      <button class="btn" id="sm-share" type="button">📤 हिसाब भेजें</button>
    </div>`;

    $('#sm-date').onchange = async e => {
      const v = e.target.value || today();
      await flush();
      S.date = v < minD ? minD : (v > today() ? today() : v);
      APP.go('salesman');
    };
    $$('.smi, .smn', main).forEach(i => i.addEventListener('input', () => { recalc(); scheduleSave(); }));
    const oe = $('#sm-open-edit');
    if (oe) oe.onclick = () => {
      if (!ST.openEdit && !confirm('⚠️ ओपनिंग तभी बदलें जब पिछली क्लोज़िंग गलत हो। मालिक को ये बदलाव दिखेगा। आगे बढ़ें?')) return;
      ST.doc = readForm(); ST.openEdit = !ST.openEdit; draw();
    };
    const au = $('#sm-addu'); if (au) au.onclick = async () => { ST.doc = readForm(); await flush(); udharModal(); };
    const sv = $('#sm-save'); if (sv) sv.onclick = async () => { try { await saveShift('open', false); } catch (e) { toast('सेव नहीं हुआ: ' + errMsg(e)); } };
    const sb = $('#sm-submit'); if (sb) sb.onclick = submit;
    $('#sm-share').onclick = () => { ST.doc = readForm(); share(); };
    bindDel(main);
    recalc();
  }

  /* ==================== स्क्रीन: उधार एंट्री ==================== */
  APP.views.sm_udhar = async function () {
    const main = $('#main'); if (!main) return;
    await flush();
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const date = S.date || today();
    let parties;
    try { ST = await loadState(date, true); parties = await APP.getParties(false, true); }
    catch (e) { main.innerHTML = APP.errBox(e) + '<p class="mut">' + esc(errMsg(e)) + '</p>'; return; }
    const locked = ST.locked;
    const totA = ST.rows.reduce((a, r) => a + num(r.amount), 0), totL = ST.rows.reduce((a, r) => a + num(r.litre), 0);
    main.innerHTML = `
      <div class="card"><h3>🚚 उधार एंट्री · ${dmy(date)}</h3>
        ${kv('मेरी एंट्री', ST.rows.length)}${kv('कुल उधार', money(totA), 'neg')}${kv('कुल लीटर', lit(totL))}
        ${locked ? '<div class="warn">आज की शिफ्ट जमा हो चुकी है — नई एंट्री के लिए मालिक से शिफ्ट खुलवाएँ।</div>' : ''}</div>
      ${locked ? '' : '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="sq-new" type="button">+ नई उधार एंट्री</button></div>'}
      ${locked ? '' : `<div class="card"><h3>पार्टी से जल्दी एंट्री</h3>
        <input id="sq-q" class="search" placeholder="🔍 पार्टी का नाम या गाड़ी नंबर" autocomplete="off">
        <div id="sq-list"></div></div>`}
      <div class="card"><h3>मेरी एंट्रियाँ</h3><div id="sm-rows">${rowsHtml(ST.rows, !locked)}</div></div>`;
    bindDel(main);
    if (locked) return;
    $('#sq-new').onclick = () => udharModal();
    const nrm = s => String(s || '').toLowerCase().replace(/[\s\-.]/g, '');
    const drawList = () => {
      const t = nrm($('#sq-q').value);
      const list = parties.filter(p => !t || nrm(p.name).includes(t) || (p.vehicles || []).some(v => nrm(v).includes(t))).slice(0, 40);
      $('#sq-list').innerHTML = list.length ? list.map(p => `<div class="item" style="flex-wrap:wrap"><div class="a"><b>${esc(p.name)}</b>
        <div>${(p.vehicles || []).map(v => `<span class="veh-pill" data-pid="${p.id}" data-v="${esc(v)}" style="cursor:pointer">${esc(v)}</span>`).join('') || '<small>गाड़ी दर्ज नहीं</small>'}</div></div>
        <button class="btn sm o" data-pid="${p.id}" type="button">+ उधार</button></div>`).join('') : '<p class="mut">कोई पार्टी नहीं मिली</p>';
      $$('#sq-list [data-pid]').forEach(b => b.onclick = () => udharModal({ partyId: b.dataset.pid, vehicle: b.dataset.v || '' }));
    };
    $('#sq-q').oninput = drawList; drawList();
  };

  /* ==================== सेल्समैन के "और" पेज से मालिक वाली चीज़ें हटाओ ==================== */
  const origMore = APP.views.more;
  APP.views.more = async function () {
    if (origMore) await origMore.apply(this, arguments);
    if (!isSm()) return;
    const x = $('#extra-more-card'); if (x) x.remove();
    $$('#main .kv').forEach(r => {
      const sp = r.querySelector('span'), b = r.querySelector('b');
      if (sp && b && sp.textContent.trim() === 'भूमिका') b.textContent = 'सेल्समैन';
    });
    const sb = $('#m-sync-bank'); if (sb) sb.remove();
  };

  /* ==================== मालिक/मैनेजर: दिन के हिसाब में सेल्समैन शिफ्ट का कार्ड ==================== */
  let shCache = null, shBusy = false;
  const shiftChip = s => s.status === 'submitted'
    ? (s.imported ? '<span class="chip g">हिसाब में जुड़ा</span>' : '<span class="chip o">जमा · जोड़ना बाकी</span>')
    : '<span class="chip">चालू (जमा नहीं)</span>';

  async function injectShifts() {
    if (isSm() || isVw() || shBusy) return;
    const main = $('#main'), fd = main && $('#f-date');
    if (!fd || $('#sm-card')) return;
    const date = fd.value;
    shBusy = true;
    try {
      if (!shCache || shCache.date !== date || Date.now() - shCache.at > 30000) {
        let list = [];
        try { const s = await db().collection(COL).where('date', '==', date).get(); list = s.docs.map(x => ({ id: x.id, ...x.data() })); } catch (e) { }
        shCache = { date, list, at: Date.now() };
      }
    } finally { shBusy = false; }
    const fd2 = $('#f-date');
    if (!fd2 || fd2.value !== date || $('#sm-card') || !shCache.list.length) return;
    const list = shCache.list.slice().sort((a, b) => tsMs(a.submittedAt) - tsMs(b.submittedAt));
    const card = document.createElement('div');
    card.className = 'card'; card.id = 'sm-card';
    card.setAttribute('data-html2canvas-ignore', 'true');
    const canImport = list.some(s => s.status === 'submitted');
    card.innerHTML = `<h3>👤 सेल्समैन शिफ्ट (${list.length})</h3>` + list.map(s => {
      const sm = s.sum || {}, diff = sm.diff;
      const nzTxt = K.NZ.filter(k => s.nz && s.nz[k] && K.has(s.nz[k].c)).map(k => k.toUpperCase() + ': ' + val(s.nz[k].o) + '→' + s.nz[k].c).join(' · ');
      return `<div class="item" style="align-items:flex-start"><div class="a"><b>${esc(s.name || s.sid)}</b> ${shiftChip(s)}
        <small>बिक्री ${money(sm.sale)} · उधार ${money(sm.udhar)} · Paytm ${money(s.paytm)} · स्वाइप ${money(s.swipe)}${num(s.expAmt) ? ' · खर्चा ' + money(s.expAmt) + (s.expLabel ? ' (' + esc(s.expLabel) + ')' : '') : ''}</small>
        <small>कैश हिसाब से ${money(sm.expected)}${sm.actual != null ? ' · दिया ' + money(sm.actual) : ''}${diff != null && Math.abs(diff) >= 0.5 ? ' · <b class="' + (diff < 0 ? 'neg' : 'pos') + '">' + (diff < 0 ? 'कम ' + money(-diff) : 'ज़्यादा ' + money(diff)) + '</b>' : (diff != null ? ' · ✔ बराबर' : '')}</small>
        ${nzTxt ? `<small>${nzTxt}</small>` : ''}${s.note ? `<small>नोट: ${esc(s.note)}</small>` : ''}</div>
        ${s.status === 'submitted' ? `<button class="btn sm w" data-smreopen="${s.id}" type="button">↩ खोलें</button>` : ''}</div>`;
    }).join('') + (canImport ? '<div class="btns"><button class="btn g" id="sm-import" type="button">📥 शिफ्ट से हिसाब में भरें</button></div>' : '');
    main.insertBefore(card, main.children[1] || null);
    $$('[data-smreopen]', card).forEach(b => b.onclick = () => reopenShift(b.dataset.smreopen));
    const im = $('#sm-import', card); if (im) im.onclick = () => importShifts(list.filter(s => s.status === 'submitted'));
  }

  function refreshCard() { shCache = null; const c = $('#sm-card'); if (c) c.remove(); setTimeout(injectShifts, 50); }

  async function reopenShift(id) {
    if (!confirm('इस शिफ्ट को दोबारा खोलें? सेल्समैन फिर से बदलाव कर पाएगा।')) return;
    try {
      await APP.commit(db().collection(COL).doc(id).update({ status: 'open', imported: false }));
      if (APP.audit) APP.audit('sm_shift_reopen', { id });
      toast('शिफ्ट खुल गई ✔'); refreshCard();
    } catch (e) { toast('नहीं खुली: ' + errMsg(e)); }
  }

  function importShifts(shifts) {
    const get = id => $('#' + id);
    if (!get('f-paytm') || get('f-paytm').disabled) return toast('ये दिन लॉक है — पहले अनलॉक करें');
    const best = {};
    shifts.forEach(s => K.NZ.forEach(k => {
      const n = s.nz && s.nz[k]; if (!n || !K.has(n.c)) return;
      const c = num(n.c), o = K.has(n.o) ? num(n.o) : null;
      const b = best[k] = best[k] || { o: null, c: -Infinity };
      if (c > b.c) b.c = c;
      if (o !== null && (b.o === null || o < b.o)) b.o = o;
    }));
    const keys = K.NZ.filter(k => best[k]);
    const sumP = r2(shifts.reduce((a, s) => a + num(s.paytm), 0)), sumS = r2(shifts.reduce((a, s) => a + num(s.swipe), 0));
    const exps = shifts.filter(s => num(s.expAmt) > 0).map(s => ({ label: (s.expLabel || '').trim() || 'सेल्समैन खर्चा (' + (s.name || s.sid) + ')', amount: num(s.expAmt) }));
    const warns = [];
    keys.forEach(k => {
      const oEl = $(`.nzi[data-k="${k}"][data-f="o"]`);
      if (oEl && K.has(oEl.value) && best[k].o !== null && Math.abs(num(oEl.value) - best[k].o) > 0.001)
        warns.push(k.toUpperCase() + ': फॉर्म की ओपनिंग ' + oEl.value + ', शिफ्ट की ' + best[k].o);
    });
    const rP = shifts.find(s => num(s.rateP) > 0), rD = shifts.find(s => num(s.rateD) > 0);
    if (rP && get('f-rateP') && K.has(get('f-rateP').value) && Math.abs(num(get('f-rateP').value) - num(rP.rateP)) > 0.001) warns.push('पेट्रोल रेट: फॉर्म ' + get('f-rateP').value + ', शिफ्ट ' + rP.rateP);
    if (rD && get('f-rateD') && K.has(get('f-rateD').value) && Math.abs(num(get('f-rateD').value) - num(rD.rateD)) > 0.001) warns.push('डीज़ल रेट: फॉर्म ' + get('f-rateD').value + ', शिफ्ट ' + rD.rateD);
    const m = modal(`<h3>📥 शिफ्ट से हिसाब भरें</h3>
      <p class="mut" style="margin:4px 0 8px">${shifts.length} जमा शिफ्ट: ${shifts.map(s => esc(s.name || s.sid)).join(', ')}</p>
      ${keys.length ? `<div class="mut" style="font-size:13px">${keys.map(k => k.toUpperCase() + ': ' + (best[k].o !== null ? best[k].o : '–') + ' → <b>' + best[k].c + '</b>').join('<br>')}</div>` : '<div class="mut">कोई मीटर रीडिंग नहीं</div>'}
      ${kv('Paytm/UPI कुल', money(sumP))}${kv('स्वाइप कुल', money(sumS))}
      ${exps.length ? kv('खर्चे (अलग पंक्ति में)', exps.map(x => esc(x.label) + ' ' + money(x.amount)).join('<br>')) : ''}
      <p class="mut" style="font-size:12px">उधार एंट्री पहले से इस दिन की लिस्ट में अपने-आप आ चुकी हैं। इससे फॉर्म के क्लोज़िंग, Paytm और स्वाइप बॉक्स बदल जाएँगे — पुरानी वैल्यू की जगह।</p>
      ${warns.length ? `<div class="warn"><b>⚠️ मिलान जाँचें:</b><br>${warns.map(esc).join('<br>')}</div>` : ''}
      <div class="btns" style="margin-top:10px"><button class="btn g" id="im-ok">✅ भर दो</button><button class="btn w" id="im-no">रद्द</button></div>`);
    $('#im-no', m).onclick = () => m.close();
    $('#im-ok', m).onclick = async () => {
      m.close();
      const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      keys.forEach(k => {
        const cEl = $(`.nzi[data-k="${k}"][data-f="c"]`), oEl = $(`.nzi[data-k="${k}"][data-f="o"]`);
        if (cEl && !cEl.disabled) { cEl.value = best[k].c; fire(cEl); }
        if (oEl && !oEl.disabled && !oEl.readOnly && !K.has(oEl.value) && best[k].o !== null) { oEl.value = best[k].o; fire(oEl); }
      });
      const set = (id, v) => { const el = get(id); if (el && !el.disabled) { el.value = v || ''; fire(el); } };
      if (sumP) set('f-paytm', sumP);
      if (sumS) set('f-swipe', sumS);
      if (rP && get('f-rateP') && !K.has(get('f-rateP').value)) set('f-rateP', rP.rateP);
      if (rD && get('f-rateD') && !K.has(get('f-rateD').value)) set('f-rateD', rD.rateD);
      if (exps.length && APP.mergeExpItems) { try { APP.mergeExpItems(exps); } catch (e) { } }
      try { APP.recalc(); } catch (e) { }
      try {
        await Promise.all(shifts.map(s => APP.commit(db().collection(COL).doc(s.id).update({ imported: true, importedAt: FV().serverTimestamp() }))));
        if (APP.audit) APP.audit('sm_shift_import', { date: shifts[0] && shifts[0].date, shifts: shifts.map(s => s.id) });
      } catch (e) { }
      toast('हिसाब में भर गया — अब 💾 सेव दबाएँ');
      refreshCard();
    };
  }

  function startObs() {
    const root = document.getElementById('app');
    if (!root) { setTimeout(startObs, 800); return; }
    new MutationObserver(() => { setTimeout(injectShifts, 120); }).observe(root, { childList: true, subtree: true });
    setTimeout(injectShifts, 400);
  }
  window.addEventListener('load', () => setTimeout(startObs, 900));
  console.log('[Mazda salesman.js] loaded ✓');
})();
