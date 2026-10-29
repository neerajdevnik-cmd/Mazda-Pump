/* माज़दा ऑयल कंपनी — सेल्समैन ऐप (Final: Runsheet, Timer, Cash, Credit, Auto WA) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db, FV = () => APP.FV;
  const today = () => APP.todayISO();
  const COL = 'sm_shifts';
  const shiftId = (sid, date) => sid + '_' + date;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
  const val = v => (v == null ? '' : v);
  const errMsg = e => (e && e.code === 'permission-denied') ? 'इजाज़त नहीं मिली (Firebase Rules चेक करें)' : ((e && e.message) || String(e));
  const FUELN = { petrol: 'पेट्रोल', diesel: 'डीज़ल' };

  let ST = null;
  let saveTimer = null;
  let timerInterval = null;
  let cashHistory = [];

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

  async function loadState(date, light) {
    const sm = S.salesman, sid = sm.id;
    let rsSnap;
    try { rsSnap = await db().collection('runsheets').where('sid', '==', sid).where('status', '==', 'active').get(); }
    catch (e) { console.error(e); }
    const activeRs = rsSnap && !rsSnap.empty ? { id: rsSnap.docs[0].id, ...rsSnap.docs[0].data() } : null;
    if (activeRs && activeRs.date) { date = activeRs.date; S.date = date; }
    const docId = activeRs ? activeRs.id : shiftId(sid, date);

    const snapP = db().collection(COL).doc(docId).get();
    const rowsP = db().collection('ledger').where('date', '==', date).where('sid', '==', sid).get().catch(() => null);
    const ratesP = latestRates();
    const [snap, rs, rates] = await Promise.all([snapP, rowsP, ratesP]);

    try {
      const cSnap = await db().collection('cash_submissions').where('date', '==', date).where('sid', '==', sid).get();
      cashHistory = cSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !activeRs || !c.rsId || c.rsId === activeRs.id).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    } catch (e) { cashHistory = []; }

    const rows = rs ? rs.docs.map(x => ({ id: x.id, ...x.data() })).filter(r => r.kind === 'udhar' && (!activeRs || !r.rsId || r.rsId === activeRs.id)) : [];
    const base = {
      sid, name: sm.name, date, status: 'open', rsId: activeRs ? activeRs.id : null, rateP: (activeRs && num(activeRs.rateP)) || rates.rateP, rateD: (activeRs && num(activeRs.rateD)) || rates.rateD,
      testing: C.testing != null ? C.testing : 5, nz: {}, paytm: '', swipe: '', expLabel: '', expAmt: '', note: ''
    };
    const doc = Object.assign(base, snap.exists ? snap.data() : {});
    doc.nz = doc.nz || {};

    let allowedNz = K.NZ;
    if (activeRs) allowedNz = activeRs.nozzles;

    const autoO = {};
    K.NZ.forEach(k => {
      const n = doc.nz[k] = Object.assign({ o: '', c: '' }, doc.nz[k] || {});
      if (activeRs && activeRs.openings && K.has(activeRs.openings[k])) {
        n.o = activeRs.openings[k];
        autoO[k] = true;
      }
    });

    return { date, docId, doc, rows, autoO, activeRs, allowedNz, locked: doc.status === 'submitted', exists: snap.exists };
  }

  function readForm() {
    if (!ST) return null;
    if (!$('#sm-rateP')) return ST.doc;
    const g = id => { const el = $('#' + id); return el ? el.value : ''; };
    const d = Object.assign({}, ST.doc, {
      rateP: g('sm-rateP'), rateD: g('sm-rateD'), testing: g('sm-testing'),
      paytm: g('sm-paytm'), swipe: g('sm-swipe'), expLabel: g('sm-expLabel'), expAmt: g('sm-expAmt'),
      note: g('sm-note'), nz: {}
    });
    K.NZ.forEach(k => { d.nz[k] = { o: '', c: '' }; });
    $$('.smn').forEach(i => { d.nz[i.dataset.k][i.dataset.f] = i.value; });
    return d;
  }

  function computeSm(d) {
    return K.compute(Object.assign({}, d, { kharcha: d.expAmt, driverInaam: 0, chaiKhana: 0, kharchaItems: [], malikDiya: 0, openCash: 0 }), ST.rows);
  }

  async function saveShift(status, silent) {
    const d = readForm(); if (!d) return;
    const o = computeSm(d);
    const data = Object.assign({}, d, {
      sid: S.salesman.id, name: S.salesman.name, date: ST.date, status, rsId: ST.activeRs ? ST.activeRs.id : null,
      sum: {
        litP: o.litP, litD: o.litD, amtP: o.amtP, amtD: o.amtD, sale: o.sale,
        udhar: o.udhar, udharCount: ST.rows.length, expected: o.close
      },
      updatedAt: FV().serverTimestamp()
    });
    if (status === 'submitted') { data.submittedAt = FV().serverTimestamp(); }
    await APP.commit(db().collection(COL).doc(ST.docId).set(data, { merge: true }));
    ST.doc = Object.assign({}, d, { status });
    if (!silent) toast(status === 'submitted' ? 'शिफ्ट जमा हो गई ✔' : 'सेव हो गया ✔');
  }

  function scheduleSave() {
    if (!ST || ST.locked) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; saveShift('open', true).catch(() => { }); }, 1500);
  }

  async function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; if (ST && !ST.locked) { try { await saveShift('open', true); } catch (e) { } } }
  }

  function recalc() {
    if (!ST) return;
    const d = readForm(); ST.doc = d;
    const o = computeSm(d);
    K.NZ.forEach(k => { const e = $('#smnet-' + k); if (e) e.textContent = o.nz[k].ok ? r2(o.nz[k].net) : '–'; });
    const w = $('#sm-warn');
    if (w) w.innerHTML = o.warn.map(x => '<div class="warn">' + esc(x) + '</div>').join('') +
      (o.filled === 0 ? '<div class="mut">जिस नोज़ल पर काम किया उसकी क्लोज़िंग भरें</div>' : '<div class="mut">' + o.filled + ' नोज़ल भरे हैं</div>');
    const sum = $('#sm-sum');
    if (sum) {
      const approved = cashHistory.filter(c => c.status === 'approved').reduce((a, c) => a + num(c.total), 0);
      const pending = cashHistory.filter(c => c.status === 'pending').reduce((a, c) => a + num(c.total), 0);
      const diff = r2(approved + pending - o.close);
      sum.innerHTML =
        kv('पेट्रोल बिक्री', lit(o.litP) + ' = ' + money(o.amtP)) +
        kv('डीज़ल बिक्री', lit(o.litD) + ' = ' + money(o.amtD)) +
        kv('कुल बिक्री', money(o.sale), 'big') +
        kv('− Paytm / UPI', money(d.paytm)) +
        kv('− स्वाइप (कार्ड)', money(d.swipe)) +
        kv('− उधार दिया', money(o.udhar)) +
        kv('− खर्चा' + (d.expLabel ? ' (' + esc(d.expLabel) + ')' : ''), money(d.expAmt)) +
        kv('कैश जमा होना चाहिए', money(o.close), 'big') +
        `<div style="margin-top:10px;padding:10px;background:#f8f9fc;border-radius:8px;">
          ${kv('✔ मैनेजर अप्रूवल (Approved)', money(approved), 'pos')}
          ${kv('⏳ अप्रूवल बाकी (Pending)', money(pending), 'neg')}
          <div class="${Math.abs(diff) < 1 ? 'ok' : 'warn'}" style="margin-top:6px">${Math.abs(diff) < 1 ? '✔ कैश बराबर है' : (diff < 0 ? 'कैश कम है: ' + money(-diff) : 'कैश ज़्यादा है: ' + money(diff))}</div>
        </div>`;
    }
  }

  function rowsHtml(rows, canDel) {
    if (!rows.length) return '<p class="mut">अभी कोई उधार एंट्री नहीं</p>';
    return rows.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(r => `<div class="item"><div class="a"><b>${esc(r.partyName)}</b>
      <small>${esc(r.time || '')} · ${esc(r.vehicle || '')} · ${FUELN[r.fuel] || ''} ${lit(r.litre)}</small>
      ${r.verified ? '<small style="color:#0a7d33">✔ मिलान हो गया</small>' : '<small style="color:#b26a00">⏳ मिलान बाकी</small>'}</div>
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
    if (await APP.dayIsLocked(ST.date)) return toast('❌ इस तारीख का हिसाब जमा हो चुका है');
    if (!confirm('ये उधार एंट्री हटाएँ?')) return;
    try {
      const b = db().batch();
      b.delete(db().collection('ledger').doc(id));
      b.update(db().collection('parties').doc(r.partyId), { bal: FV().increment(-K.signed(r)) });
      await APP.commit(b.commit());
      APP.audit('sm_delete_udhar', { party: r.partyName, vehicle: r.vehicle, amount: r.amount, litre: r.litre, date: r.date, time: r.time });
      APP.refreshDaySum(r.date);
      toast('हट गई ✔'); APP.go(S.tab);
    } catch (e) { toast('हटा नहीं पाया: ' + errMsg(e)); }
  }

  async function cashModal() {
    if (ST.locked) return toast('शिफ्ट जमा हो चुकी है');
    const notes = [500, 200, 100, 50, 20, 10];
    const m = modal(`
      <h3>💵 कैश जमा करें</h3>
      <p class="mut" style="font-size:12px;margin-bottom:10px;">नोटों की संख्या डालें</p>
      <div id="cs-list">
        ${notes.map(n => `
          <div class="row" style="align-items:center;margin-bottom:6px;">
            <div style="flex:1;font-weight:bold;">₹${n} का नोट</div>
            <input type="number" class="cs-qty" data-n="${n}" inputmode="numeric" placeholder="0" style="width:80px;padding:6px;text-align:center;">
            <div style="flex:1;text-align:right;font-weight:bold;" id="cs-amt-${n}">₹0</div>
          </div>
        `).join('')}
      </div>
      <div class="kv" style="margin-top:10px;font-size:18px;border-top:2px solid #eee;padding-top:10px;">
        <span>कुल कैश</span><b id="cs-total" class="big">₹0</b>
      </div>
      <div class="btns" style="margin-top:14px;">
        <button class="btn g" id="cs-save">✔ जमा करें</button>
        <button class="btn w" id="cs-cancel">रद्द</button>
      </div>
    `);
    const calcTotal = () => {
      let tot = 0;
      $$('.cs-qty', m).forEach(inp => {
        const n = num(inp.dataset.n);
        const qty = num(inp.value);
        const amt = n * qty;
        tot += amt;
        $('#cs-amt-' + n, m).textContent = '₹' + amt;
      });
      $('#cs-total', m).textContent = '₹' + tot;
    };
    $$('.cs-qty', m).forEach(inp => inp.oninput = calcTotal);
    $('#cs-cancel', m).onclick = () => m.close();
    $('#cs-save', m).onclick = async () => {
      let tot = 0; const breakdown = {};
      $$('.cs-qty', m).forEach(inp => {
        const n = num(inp.dataset.n);
        const qty = num(inp.value);
        if (qty > 0) { breakdown[n] = qty; tot += (n * qty); }
      });
      if (tot <= 0) return toast('कम से कम एक नोट की संख्या डालें');
      const btn = $('#cs-save', m); btn.disabled = true;
      try {
        await db().collection('cash_submissions').add({
          date: ST.date, sid: ST.sid, salesmanName: ST.name,
          breakdown, total: tot, status: 'pending', rsId: ST.activeRs ? ST.activeRs.id : null,
          time: APP.nowTime(), createdAt: FV().serverTimestamp()
        });
        m.close(); toast('कैश जमा हो गया ✔');
        APP.go('salesman');
      } catch (e) { btn.disabled = false; toast('एरर: ' + errMsg(e)); }
    };
  }

  function sendEntryWhatsApp(data, party) {
    if (!party.phone) return;
    const ph = String(party.phone).replace(/\D/g, '').replace(/^0+/, '');
    if (!ph) return;
    const wa = ph.length === 10 ? '91' + ph : ph;
    let msg = `नमस्ते ${party.name} जी,\n\n`;
    msg += `आपकी गाड़ी *${data.vehicle || ''}* पर भरा:\n`;
    msg += `⛽ ${data.fuel === 'petrol' ? 'पेट्रोल' : 'डीज़ल'} ${r2(data.litre)} L × ₹${r2(data.rate)} = *₹${r2(data.amount)}*\n`;
    msg += `📅 ${dmy(data.date)} ${data.time || ''}\n\n`;
    msg += `माज़दा ऑयल कंपनी`;
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), '_blank');
  }

  async function udharModal(pre) {
    pre = pre || {};
    if (ST && ST.locked) return toast('शिफ्ट जमा हो चुकी है');
    const date = (ST && ST.date) || S.date || today();
    let parties;
    try { parties = await APP.getParties(false, true); } catch (e) { return toast('पार्टी लिस्ट नहीं मिली'); }
    if (!parties.length) return toast('पार्टी लिस्ट खाली है');
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
      <div class="btns"><button class="btn g" id="su-sv">सेव करें</button><button class="btn w" id="su-cl">रद्द</button></div>`);
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
    q('su-cl').onclick = () => m.close();
    q('su-sv').onclick = async () => {
      const p = parties.find(x => x.id === q('su-p').value);
      if (!p) return toast('पार्टी चुनें');
      const veh = q('su-v').value === '__x' ? q('su-vx').value.trim().toUpperCase() : q('su-v').value;
      const data = {
        partyId: p.id, partyName: p.name, date, time: APP.nowTime(), kind: 'udhar', note: q('su-n').value.trim(),
        vehicle: veh, fuel: q('su-f').value, rate: num(q('su-r').value), litre: num(q('su-l').value), amount: num(q('su-a').value),
        by: S.salesman.name, src: 'salesman', sid: S.salesman.id, rsId: ST && ST.activeRs ? ST.activeRs.id : null
      };
      if (!data.vehicle) return toast('गाड़ी नंबर लिखें');
      if (!(data.litre > 0) || !(data.amount > 0)) return toast('लीटर व रुपये भरें');
      if (await APP.dayIsLocked(date)) return toast('❌ इस तारीख का हिसाब जमा हो चुका है');
      if (APP.cibil && APP.cibil.checkLimit) {
        try {
          const check = await APP.cibil.checkLimit(p, data.amount, false);
          if (check && !check.allow) {
            if (check.blocked) return toast(check.reason || 'उधार सीमा पार');
            if (!confirm((check.reason || '') + '\n\nफिर भी जोड़ें?')) return;
          }
        } catch (x) { console.error('Credit check error', x); }
      }
      const dup = await APP.findDupEntry(data);
      if (dup && !confirm('⚠️ ऐसी ही एंट्री पहले से है: ' + dup.partyName + ' · ' + dup.vehicle + ' · ' + money(dup.amount) + '\nफिर भी जोड़ें?')) return;
      const btn = q('su-sv'); if (btn.disabled) return; btn.disabled = true;
      try {
        data.at = FV().serverTimestamp();
        const b = db().batch();
        b.set(db().collection('ledger').doc(), data);
        b.update(db().collection('parties').doc(p.id), { bal: FV().increment(K.signed(data)) });
        await APP.commit(b.commit());
        m.close(); toast('उधार लिख गया ✔'); APP.go(S.tab);
        if (C.autoWhatsApp && p.phone) setTimeout(() => { try { sendEntryWhatsApp(data, p); } catch (x) {} }, 600);
      } catch (e) { btn.disabled = false; toast('सेव नहीं हुआ: ' + errMsg(e)); }
    };
  }

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
    if (!ST.activeRs) { main.innerHTML = '<div class="card" style="text-align:center;padding:24px"><h3 style="justify-content:center">⏸ कोई चालू शिफ्ट नहीं</h3><p class="mut">मैनेजर से रनशीट शुरू करवाएँ।</p></div>'; return; }
    const d = ST.doc, locked = ST.locked, dis = locked ? 'disabled' : '';
    const minD = APP.shiftDate(today(), -2);
    const inp = (id, v, ph, cls) => `<input id="${id}" class="${cls || 'smi'}" inputmode="decimal" value="${esc(val(v))}" placeholder="${ph || ''}" ${dis}>`;
    let timerHtml = '';
    if (ST.activeRs) {
      timerHtml = `<div class="card" style="text-align:center;background:#0b3d91;color:#fff;">
        <h3 style="color:#fff;margin-bottom:4px;">⏱️ चालू शिफ्ट</h3>
        <div id="sm-timer" style="font-size:32px;font-weight:bold;font-family:monospace;letter-spacing:2px;">00:00:00</div>
        <div style="font-size:12px;opacity:.8;margin-top:4px;">मीटर: ${ST.activeRs.nozzles.join(', ').toUpperCase()}</div>
      </div>`;
    }
    const nzr = (k, lab) => {
      const n = d.nz[k] || {};
      const roO = (locked || ST.autoO[k]) ? 'readonly style="background:#e9ecef;color:#555;font-weight:bold"' : '';
      return `<div class="nz"><b>${lab}</b>
        <input class="smn" data-k="${k}" data-f="o" inputmode="decimal" value="${esc(val(n.o))}" ${roO}>
        <input class="smn" data-k="${k}" data-f="c" inputmode="decimal" value="${esc(val(n.c))}" placeholder="क्लोज़िंग" ${dis}>
        <span id="smnet-${k}">–</span></div>`;
    };
    const chip = locked ? '<span class="chip g">जमा ✔ लॉक</span>' : '<span class="chip">चालू</span>';
    const allowP = ST.allowedNz.filter(k => k.startsWith('p'));
    const allowD = ST.allowedNz.filter(k => k.startsWith('d'));
    let cashListHtml = '';
    if (cashHistory.length) {
      cashListHtml = `<div class="card" style="padding:10px;"><h3>💵 मेरा कैश हिसाब</h3>
      ${cashHistory.map(c => `<div class="item"><div class="a"><b>${money(c.total)}</b><small>${c.time}</small></div>
        <div>${c.status === 'approved' ? `<span class="chip g">✔ Received</span>` : '<span class="chip o">⏳ पेंडिंग</span>'}</div></div>`).join('')}</div>`;
    }
    main.innerHTML = `
    ${timerHtml}
    <div class="card"><div class="row"><div><label style="margin-top:0">तारीख</label>
      <input type="date" id="sm-date" value="${ST.date}" max="${today()}" min="${minD}"></div>
      <div style="flex:0 0 auto;align-self:end">${chip}</div></div></div>
    <div class="card"><h3>आज का रेट (₹/लीटर)</h3><div class="row">
      <div><label>पेट्रोल</label>${inp('sm-rateP', d.rateP)}</div>
      <div><label>डीज़ल</label>${inp('sm-rateD', d.rateD)}</div>
      <div><label>टेस्टिंग (L)</label>${inp('sm-testing', d.testing)}</div></div></div>
    <div class="card"><h3>⛽ मीटर रीडिंग</h3>
      <div class="nz h"><span></span><span>ओपनिंग</span><span>क्लोज़िंग</span><span style="text-align:right">नेट L</span></div>
      ${allowP.length ? '<b class="mut">पेट्रोल</b>' + allowP.map(k => nzr(k, k.toUpperCase())).join('') : ''}
      ${allowD.length ? '<b class="mut">डीज़ल</b>' + allowD.map(k => nzr(k, k.toUpperCase())).join('') : ''}
      <div id="sm-warn"></div>
      </div>
    <div class="card"><h3>🚚 मेरी उधार एंट्री</h3>
      <div id="sm-rows">${rowsHtml(ST.rows, !locked)}</div>
      ${locked || !ST.activeRs ? '' : '<div class="btns"><button class="btn o" id="sm-addu" type="button">+ उधार लिखें</button></div>'}</div>
    <div class="card"><h3>💳 पेमेंट और खर्चा</h3>
      <div class="row"><div><label>Paytm / UPI कुल</label>${inp('sm-paytm', d.paytm)}</div><div><label>स्वाइप (कार्ड) कुल</label>${inp('sm-swipe', d.swipe)}</div></div>
      <div class="row"><div><label>खर्चा (किस चीज़ का)</label><input id="sm-expLabel" class="smi" value="${esc(val(d.expLabel))}" placeholder="जैसे चाय" ${dis}></div>
      <div><label>खर्चा ₹</label>${inp('sm-expAmt', d.expAmt)}</div></div></div>
    <div class="card"><h3>🧾 मेरा हिसाब</h3><div id="sm-sum"></div>
      <label>नोट</label><input id="sm-note" class="smi" value="${esc(val(d.note))}" ${dis}></div>
    ${cashListHtml}
    <div class="btns">
      ${locked || !ST.activeRs ? '' : '<button class="btn g" id="sm-depcash" type="button">💵 कैश जमा करें</button>'}
      <button class="btn w" id="sm-save" type="button">💾 सेव</button>
    </div>`;
    if (ST.activeRs && ST.activeRs.startTime) {
      if (timerInterval) clearInterval(timerInterval);
      const [sh, sm] = ST.activeRs.startTime.split(':').map(Number);
      const start = new Date((ST.activeRs.date || today()) + 'T00:00:00'); start.setHours(sh, sm, 0, 0);
      timerInterval = setInterval(() => {
        const el = $('#sm-timer');
        if (!el) { clearInterval(timerInterval); return; }
        const diff = new Date() - start;
        if (diff < 0) return;
        el.textContent = `${String(Math.floor(diff/3600000)).padStart(2,'0')}:${String(Math.floor((diff%3600000)/60000)).padStart(2,'0')}:${String(Math.floor((diff%60000)/1000)).padStart(2,'0')}`;
      }, 1000);
    }
    $('#sm-date').onchange = async e => { await flush(); S.date = e.target.value || today(); APP.go('salesman'); };
    $$('.smi, .smn', main).forEach(i => i.addEventListener('input', () => { recalc(); scheduleSave(); }));
    const au = $('#sm-addu'); if (au) au.onclick = async () => { ST.doc = readForm(); await flush(); udharModal(); };
    const dc = $('#sm-depcash'); if (dc) dc.onclick = () => { ST.doc = readForm(); cashModal(); };
    const sv = $('#sm-save'); if (sv) sv.onclick = async () => { try { await saveShift('open', false); } catch (e) { toast('सेव नहीं हुआ'); } };
    bindDel(main);
    recalc();
  }

  APP.views.sm_udhar = async function () {
    const main = $('#main'); if (!main) return;
    await flush();
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const date = S.date || today();
    try { ST = await loadState(date, true); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    if (!ST.activeRs) { main.innerHTML = '<div class="card" style="text-align:center;padding:24px"><h3 style="justify-content:center">⏸ कोई चालू शिफ्ट नहीं</h3><p class="mut">मैनेजर से रनशीट शुरू करवाएँ।</p></div>'; return; }
    const locked = ST.locked;
    const totA = ST.rows.reduce((a, r) => a + num(r.amount), 0), totL = ST.rows.reduce((a, r) => a + num(r.litre), 0);
    main.innerHTML = `
      <div class="card"><h3>🚚 उधार एंट्री · ${dmy(ST.date)}</h3>
        ${kv('मेरी एंट्री', ST.rows.length)}${kv('कुल उधार', money(totA), 'neg')}${kv('कुल लीटर', lit(totL))}
        ${locked ? '<div class="warn">आज की शिफ्ट जमा हो चुकी है</div>' : ''}</div>
      ${locked || !ST.activeRs ? '' : '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="sq-new" type="button">+ नई उधार एंट्री</button></div>'}
      <div class="btns" style="margin-bottom:12px"><button class="btn w" id="sq-priv" type="button">🔒 Private Udhar</button></div>
      <div class="card"><h3>मेरी एंट्रियाँ</h3><div id="sm-rows">${rowsHtml(ST.rows, !locked)}</div></div>`;
    bindDel(main);
    $('#sq-priv').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
    if (locked || !ST.activeRs) return;
    $('#sq-new').onclick = () => udharModal();
  };

  const origMore = APP.views.more;
  APP.views.more = async function () {
    if (origMore) await origMore.apply(this, arguments);
    if (S.role !== 'salesman') return;
    const x = $('#extra-more-card'); if (x) x.remove();
  };
  console.log('[Mazda salesman.js] Final loaded ✓');
})();
