/* माज़दा ऑयल कंपनी — सेल्समैन ऐप (Geofencing Added) */
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

  function showLocationLock(main, err) {
    main.innerHTML = `
      <div class="card" style="text-align:center; padding: 40px 20px; border-top: 5px solid #c62828; margin-top: 20px;">
        <h1 style="font-size: 60px; margin: 0;">📍</h1>
        <h3 style="color: #c62828; margin-top: 10px; font-size: 22px;">आप पंप पर नहीं हैं</h3>
        <p class="mut" style="font-size: 15px; margin-top: 8px;">${err || 'कृपया अपनी लोकेशन चालू करें और पंप के दायरे में आएं।'}</p>
        <div class="warn" style="margin-top: 20px; text-align: left;">
          <b>⚠️ ध्यान दें:</b> रनशीट खोलने या काम शुरू करने के लिए आपको पंप पर ही होना पड़ेगा। मैनेजर और मालिक कहीं से भी ऐप चला सकते हैं।
        </div>
        <div class="btns" style="margin-top: 20px;">
          <button class="btn g full" onclick="APP.go('salesman')">🔄 लोकेशन दोबारा चेक करें</button>
        </div>
      </div>
    `;
  }

  APP.views.salesman = async function () {
    const main = $('#main'); if (!main) return;
    
    // 🔒 GEOFENCING CHECK
    main.innerHTML = '<p class="mut" style="text-align:center; padding: 40px;">📍 लोकेशन चेक हो रही है...</p>';
    const locCheck = await APP.checkSalesmanLocation();
    if (!locCheck.ok) {
      if (locCheck.err) showLocationLock(main, locCheck.err);
      else showLocationLock(main, `आप पंप से <b>${locCheck.dist} मीटर</b> दूर हैं। कृपया ${locCheck.radius} मीटर के अंदर आएं।`);
      return;
    }

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
    
    // 🔒 GEOFENCING CHECK
    main.innerHTML = '<p class="mut" style="text-align:center; padding: 40px;">📍 लोकेशन चेक हो रही है...</p>';
    const locCheck = await APP.checkSalesmanLocation();
    if (!locCheck.ok) {
      if (locCheck.err) showLocationLock(main, locCheck.err);
      else showLocationLock(main, `आप पंप से <b>${locCheck.dist} मीटर</b> दूर हैं। कृपया ${locCheck.radius} मीटर के अंदर आएं।`);
      return;
    }

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
  console.log('[Mazda salesman.js] Geofence Loaded ✓');

  // ... (baaki bacha hua salesman.js ka code waisa hi rahega: recalc, readForm, rowsHtml, etc.)
  // Note: Since the original file was long, I'm providing the updated views.
  // I will combine it all in the final code block for the user.

})();
