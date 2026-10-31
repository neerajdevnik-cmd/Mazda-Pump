/* माज़दा ऑयल कंपनी - Daily Hisab Engine (Day View) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const FUEL = APP.FUEL, MODE = APP.MODE, AUTO_NOTES = APP.AUTO_NOTES;
  const db = () => APP.db, FV = () => APP.FV;

  const todayISO = () => APP.todayISO();
  const shiftDate = (iso, n) => APP.shiftDate(iso, n);

  async function prevDay(date) {
    const s = await db().collection('days').where('date', '<', date).orderBy('date', 'desc').limit(1).get();
    return s.empty ? null : s.docs[0].data();
  }
  
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

  async function chainFor(date) {
    const dbPrev = await prevDay(date);
    if (!dbPrev) return null;
    const prev = Object.assign({}, dbPrev, S.draft[dbPrev.date] || {});
    const rs = await db().collection('ledger').where('date', '==', prev.date).get();
    const pc = K.compute(prev, rs.docs.map(x => x.data()));
    const nz = {};
    K.NZ.forEach(k => { const c = prev.nz && prev.nz[k] ? prev.nz[k].c : ''; nz[k] = K.has(c) ? c : ''; });
    return {
      prev, pc, nz, prevDate: prev.date,
      openCash: pc.close,
      openStockP: pc.actStockP !== null ? pc.actStockP : Math.max(0, pc.expStockP || 0),
      openStockD: pc.actStockD !== null ? pc.actStockD : Math.max(0, pc.expStockD || 0),
      estP: pc.actStockP === null, estD: pc.actStockD === null,
      gap: daysBetween(prev.date, date) - 1,
      prevSubmitted: prev.status === 'submitted'
    };
  }

  function applyChain(d, ch) {
    d.nz = d.nz || {};
    K.NZ.forEach(k => { d.nz[k] = Object.assign({ c: '' }, d.nz[k] || {}, { o: ch.nz[k] }); });
    d.openCash = ch.openCash; d.openStockP = ch.openStockP; d.openStockD = ch.openStockD;
    d.chainPrev = ch.prevDate;
  }

  function chainMismatch(d, ch) {
    const out = [], eq = (x, y) => Math.abs(num(x) - num(y)) < 0.01;
    K.NZ.forEach(k => {
      const o = d.nz && d.nz[k] ? d.nz[k].o : '', c = ch.nz[k];
      if ((K.has(o) || K.has(c)) && !(K.has(o) && K.has(c) && eq(o, c))) out.push(k.toUpperCase() + ' ओपनिंग ' + (K.has(o) ? o : '–') + ' ≠ कल की क्लोज़िंग ' + (K.has(c) ? c : '–'));
    });
    if (!eq(d.openCash, ch.openCash)) out.push('पिछला कैश ' + money(d.openCash) + ' ≠ कल का बचा कैश ' + money(ch.openCash));
    if (!eq(d.openStockP, ch.openStockP)) out.push('पेट्रोल ओपनिंग स्टॉक ' + lit(d.openStockP) + ' ≠ कल की डिप ' + lit(ch.openStockP));
    if (!eq(d.openStockD, ch.openStockD)) out.push('डीज़ल ओपनिंग स्टॉक ' + lit(d.openStockD) + ' ≠ कल की डिप ' + lit(ch.openStockD));
    return out;
  }

  async function newDay(date, ch) {
    const d = {
      date, testing: C.testing, rateP: S.rates.petrol, rateD: S.rates.diesel, nz: {},
      driverInaam: 0, chaiKhana: 0, status: 'open', opening_locked: true
    };
    if (ch) { applyChain(d, ch); const fresh = S.ratesSetAt === date; d.rateP = fresh ? S.rates.petrol : (ch.prev.rateP || d.rateP); d.rateD = fresh ? S.rates.diesel : (ch.prev.rateD || d.rateD); }
    else d.opening_locked = false;
    return d;
  }

  async function dayIsLocked(date) {
    if (APP.isTrueOwner()) return false;
    try { const s = await db().collection('days').doc(date).get(); return s.exists && s.data().status === 'submitted'; } catch (e) { return false; }
  }
  
  async function refreshDaySum(date) {
    try {
      const ds = await db().collection('days').doc(date).get(); if (!ds.exists) return;
      const rs = await db().collection('ledger').where('date', '==', date).get();
      const o = K.compute(ds.data(), rs.docs.map(x => x.data()));
      await db().collection('days').doc(date).update({ 'sum.sale': o.sale, 'sum.close': o.close, 'sum.litP': o.litP, 'sum.litD': o.litD });
    } catch (e) { }
  }
  const LOCKMSG = '❌ इस तारीख का हिसाब जमा (लॉक) हो चुका है — मालिक से अनलॉक करवाएँ';

  const baseOf = x => JSON.parse(JSON.stringify(x || {}, (k, v) => k === 'at' ? undefined : v));
  function dayPatch(base, d) {
    const walk = (b, n) => {
      const out = {};
      Object.keys(n).forEach(k => {
        const nv = n[k], bv = b ? b[k] : undefined;
        if (nv && typeof nv === 'object' && !Array.isArray(nv) && Object.getPrototypeOf(nv) === Object.prototype) {
          const sub = walk(bv && typeof bv === 'object' ? bv : {}, nv);
          if (Object.keys(sub).length) out[k] = sub;
        } else if (JSON.stringify(nv) !== JSON.stringify(bv)) out[k] = nv;
      });
      return out;
    };
    const p = walk(base || {}, d);
    ['sum', 'at', 'by', 'status'].forEach(k => { if (d[k] !== undefined) p[k] = d[k]; });
    return p;
  }

  let autoSaveTimer = null;
  function triggerAutoSave() {
    if (S.cur && !S.cur.locked && !APP.isViewer()) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        // 🔥 BULLETPROOF GUARD: Only save if the DOM still matches the current date
        const dateInput = $('#f-date');
        if (dateInput && dateInput.value === S.cur.date) {
          saveDay(false, true);
        }
      }, 2500);
    }
  }

  async function dayView(date) {
    date = (typeof date === 'string' && date) ? date : (S.date || todayISO()); S.date = date;
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let ds, rs, ch, chainErr = null;
    try {
      const [dsR, rsR, chR] = await Promise.all([
        db().collection('days').doc(date).get(),
        db().collection('ledger').where('date', '==', date).get(),
        chainFor(date).catch(e => { chainErr = e; return null; })
      ]);
      ds = dsR; rs = rsR; ch = chR;
    } catch (e) { main.innerHTML = APP.errBox(e) + '<div class="btns" style="margin-top:10px"><button class="btn" onclick="APP.dayView(\'' + date + '\')">🔄 दोबारा कोशिश</button></div>'; return; }
    if (chainErr && !ds.exists) { main.innerHTML = APP.errBox('कल का हिसाब लोड नहीं हुआ: ' + (chainErr.message || chainErr)) + '<div class="btns" style="margin-top:10px"><button class="btn" onclick="APP.dayView(\'' + date + '\')">🔄 दोबारा कोशिश</button></div>'; return; }

    let d = ds.exists ? ds.data() : null;
    const rows = rs.docs.map(x => ({ id: x.id, ...x.data() })).filter(r => !K.isOpening(r)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (!d) d = await newDay(date, ch);
    const frozen = ds.exists && ds.data().status === 'submitted';
    if (S.draft[date]) d = Object.assign({}, d, S.draft[date]);

    let chainDiff = [];
    if (ch && d.opening_locked !== false) {
      if (frozen) chainDiff = chainMismatch(d, ch);
      else applyChain(d, ch);
    }

    const oldLock = !APP.isOwner() && !APP.isViewer() && date < shiftDate(todayISO(), -2);   // मैनेजर: पुराने दिन देख सकता है, बदल नहीं सकता
    const locked = (d.status === 'submitted' && !APP.isOwner()) || oldLock || APP.isViewer();
    const dis = locked ? 'disabled' : '';
    const chainLock = !!(ch && d.opening_locked !== false);
    const stkRO = () => (!locked && chainLock) ? 'readonly style="background:#f0f0f0;font-weight:bold"' : '';
    const isOpeningLocked = chainLock;
    const ro = isOpeningLocked ? 'readonly style="background:#f0f0f0;color:#555;font-weight:bold;"' : '';

    const inp = (id, v, ph) => `<input id="${id}" inputmode="decimal" value="${esc(v == null ? '' : v)}" placeholder="${ph || ''}" ${dis}>`;
    const nzr = (k, lab) => { 
        const n = (d.nz && d.nz[k]) || {}; 
        return `<div class="nz"><b>${lab}</b>
        <input class="nzi" data-k="${k}" data-f="o" inputmode="decimal" value="${esc(n.o == null ? '' : n.o)}" ${ro} ${dis}>
        <input class="nzi" data-k="${k}" data-f="c" inputmode="decimal" value="${esc(n.c == null ? '' : n.c)}" ${dis}>
        <span id="net-${k}">–</span></div>`; 
    };
    const minDate = '';   // कैलेंडर में कोई भी पुरानी तारीख खुल सकती है (जमा/पुराने दिन सिर्फ़ देखने के लिए)
    const splitBtn = f => locked ? '' : `<button class="btn sm w" type="button" data-do="splitF" data-f="${f}" style="padding:2px 8px;font-size:12px">✂️ बाँटें</button>`;

    let chainHtml = '';
    if (ch) {
      const n = [];
      if (ch.gap > 0) n.push('⚠️ ' + dmy(ch.prevDate) + ' के बाद ' + ch.gap + ' दिन का हिसाब नहीं बना — ओपनिंग ' + dmy(ch.prevDate) + ' से आई है');
      if (!ch.prevSubmitted) n.push('⚠️ ' + dmy(ch.prevDate) + ' का हिसाब अभी जमा नहीं हुआ — उसमें बदलाव हुआ तो आज की ओपनिंग भी बदलेगी');
      if (ch.estP || ch.estD) n.push('ℹ️ ' + dmy(ch.prevDate) + ' की ' + [ch.estP ? 'पेट्रोल' : '', ch.estD ? 'डीज़ल' : ''].filter(Boolean).join(' और ') + ' डिप नहीं डली थी — ओपनिंग स्टॉक अंदाज़े से है');
      if (chainDiff.length) n.push('❌ इस जमा हिसाब की ओपनिंग कल से मेल नहीं खाती:<br>' + chainDiff.map(esc).join('<br>'));
      chainHtml = n.map(x => '<div class="warn" style="margin-bottom:8px">' + x + '</div>').join('');
      if (chainDiff.length && APP.isOwner() && !locked) chainHtml += '<div class="btns" style="margin:-4px 0 10px"><button class="btn sm o" data-do="relink">🔗 कल से दोबारा जोड़ें</button></div>';
    }
    if (chainErr) chainHtml += '<div class="warn" style="margin-bottom:8px">⚠️ कल का हिसाब लोड नहीं हुआ — ओपनिंग जाँचकर ही सेव करें</div>';

    main.innerHTML = `
    ${chainHtml}<div class="card"><div class="row"><div><label style="margin-top:0">तारीख</label>
      <input type="date" id="f-date" value="${date}" max="${todayISO()}" ${minDate ? 'min="' + minDate + '"' : ''}></div>
      <div style="flex:0 0 auto;align-self:end">${locked ? (d.status === 'submitted' ? '<span class="chip g">जमा ✔ लॉक</span>' : '<span class="chip o">पुराना दिन · सिर्फ़ देखें</span>') : d.status === 'submitted' ? '<span class="chip o">जमा (खुला)</span>' : '<span class="chip">चालू</span>'}</div></div></div>

    <div class="card"><h3>आज का रेट (₹/लीटर)</h3><div class="row">
      <div><label>पेट्रोल 🔒</label><input id="f-rateP" inputmode="decimal" value="${esc(d.rateP)}" readonly style="background:#f0f0f0;color:#555;font-weight:bold" ${dis}></div>
      <div><label>डीज़ल 🔒</label><input id="f-rateD" inputmode="decimal" value="${esc(d.rateD)}" readonly style="background:#f0f0f0;color:#555;font-weight:bold" ${dis}></div>
      <div><label>टेस्टिंग (L)</label>${inp('f-testing', d.testing)}</div></div></div>

    <div class="card"><h3>मीटर रीडिंग</h3>
      <div class="nz h"><span></span><span>ओपनिंग</span><span>क्लोज़िंग</span><span style="text-align:right">नेट L</span></div>
      <b class="mut">पेट्रोल</b>${['p1', 'p2', 'p3', 'p4'].filter(k => K.activeNz().includes(k)).map(k => nzr(k, k.toUpperCase())).join('')}
      <b class="mut">डीज़ल</b>${['d1', 'd2', 'd3', 'd4'].filter(k => K.activeNz().includes(k)).map(k => nzr(k, k.toUpperCase())).join('')}
      <div id="nzwarn"></div>
      ${(!locked && APP.isOwner() && ch) ? `
      <div class="btns" style="margin-top:8px">
        <button class="btn sm w" id="toggle-open" type="button">${isOpeningLocked ? '🔓 ओपनिंग एडिट करें' : '🔒 ओपनिंग लॉक करें (पिछले दिन से जोड़ें)'}</button>
      </div>` : ''}
    </div>

    <div class="card"><h3>🛢️ पेट्रोल स्टॉक (लीटर)</h3>
      <div class="row">
        <div><label>ओपनिंग स्टॉक (L)</label><input id="f-openStockP" inputmode="decimal" ${stkRO(d.openStockP)} value="${esc(d.openStockP || '')}" ${dis}></div>
        <div><label>टैंकर आया (L)</label>${inp('f-tankerP', d.tankerP)}</div>
      </div>
      <div class="row" style="margin-top:8px">
        <div><label>आज की डिप</label>${inp('f-dipP', d.dipP)}</div>
        <div><label>डिप के हिसाब से (L)</label><input id="f-actStockP" readonly style="background:#f0f0f0;font-weight:bold" value=""></div>
      </div>
      <div id="stkP" style="margin-top:8px"></div>
    </div>

    <div class="card"><h3>🛢️ डीज़ल स्टॉक (लीटर)</h3>
      <div class="row">
        <div><label>ओपनिंग स्टॉक (L)</label><input id="f-openStockD" inputmode="decimal" ${stkRO(d.openStockD)} value="${esc(d.openStockD || '')}" ${dis}></div>
        <div><label>टैंकर आया (L)</label>${inp('f-tankerD', d.tankerD)}</div>
      </div>
      <div class="row" style="margin-top:8px">
        <div><label>आज की डिप</label>${inp('f-dipD', d.dipD)}</div>
        <div><label>डिप के हिसाब से (L)</label><input id="f-actStockD" readonly style="background:#f0f0f0;font-weight:bold" value=""></div>
      </div>
      <div id="stkD" style="margin-top:8px"></div>
    </div>

    <div class="card"><h3>पार्टी उधार / जमा (आज)</h3>
      <div id="rowsbox"></div>
      <div class="btns">${locked ? '' : '<button class="btn o" data-do="addU">+ उधार</button><button class="btn g" data-do="addJ">+ जमा</button>'}</div></div>

    <div class="card"><h3>कैश और भुगतान</h3>
      <label>पिछला कैश / AD (कल का बचा कैश)${chainLock ? ' 🔒' : ''}</label><input id="f-openCash" inputmode="decimal" value="${esc(d.openCash == null ? '' : d.openCash)}" ${dis} ${(!locked && chainLock) ? 'readonly style="background:#f0f0f0;font-weight:bold"' : ''}>
      <div class="row"><div><label>Paytm/UPI कुल</label>${inp('f-paytm', d.paytm)}</div><div><label>स्वाइप कुल</label>${inp('f-swipe', d.swipe)}</div></div>
      
      <div class="row" style="margin-top:8px">
        <div><div class="lh"><label>खर्चा DG (जनरेटर)</label>${splitBtn('kharcha')}</div>${inp('f-kharcha', d.kharcha)}</div>
        <div><div class="lh"><label>ड्राइवर इनाम</label>${splitBtn('driverInaam')}</div>${inp('f-driverInaam', d.driverInaam)}</div>
      </div>
      <div class="row">
        <div><div class="lh"><label>चाय-खाना</label>${splitBtn('chaiKhana')}</div>${inp('f-chaiKhana', d.chaiKhana)}</div>
        <div><div class="lh"><label>मालिक को दिया (SBI जमा)</label></div>${inp('f-malikDiya', d.malikDiya)}</div>
      </div>
      <div class="lh" style="margin-top:10px"><label>और खर्चे (हर चीज़ अलग लिखें)</label></div>
      <div id="expbox"></div>
      ${locked ? '' : '<button class="btn sm w" type="button" data-do="addX">+ और खर्चा जोड़ें</button>'}
      <label>नोट</label><input id="f-note" value="${esc(d.note || '')}" ${dis}></div>

    <div class="card"><h3>आज का हिसाब</h3><div id="sum"></div></div>

    <div class="btns">
      ${locked ? '' : '<button class="btn w" data-do="save">💾 सेव</button>'}
      ${locked ? '' : '<button class="btn g" data-do="submit">✅ जमा करें (लॉक)</button>'}
      ${APP.isOwner() && d.status === 'submitted' ? '<button class="btn o" data-do="unlock">🔓 अनलॉक</button>' : ''}
      <button class="btn" data-do="report">📤 कॉम्पैक्ट रिपोर्ट</button>
      ${locked ? '' : '<button class="btn o" data-do="importShifts">📥 शिफ्ट से भरें</button>'}
      ${locked ? '' : '<button class="btn w" data-do="scan">📷 AI रजिस्टर स्कैन</button>'}
    </div>`;

    APP.setExpItems(Array.isArray(d.kharchaItems) ? d.kharchaItems : [], locked);
    ['P', 'D'].forEach(f => {
      const b = $('#stk-tg' + f); if (!b) return;
      b.onclick = () => {
        if (!confirm('ओपनिंग स्टॉक पिछले दिन की डिप से अपने-आप आता है।\nबदलने पर आज का "फर्क" भी बदल जाएगा। बदलें?')) return;
        const el = $('#f-openStock' + f); el.removeAttribute('readonly'); el.style.background = ''; el.style.fontWeight = ''; el.focus(); b.remove();
      };
    });
    const state = { d, rows, date, locked, chain: ch, chainDiff, base: ds.exists ? baseOf(ds.data()) : {} };
    S.cur = state;
    renderRows(state);
    recalc();
    
    if (APP.ANALYTICS && APP.ANALYTICS.getDayCardHtml && !APP.isViewer()) {
      APP.ANALYTICS.getDayCardHtml(date).then(html => {
        if (!html) return;
        if (document.querySelector('#day-analytics-card-wrapper')) return;
        const dateInput = $('#f-date');
        if (!dateInput) return;
        const dateCard = dateInput.closest('.card');
        if (!dateCard) return;
        const wrap = document.createElement('div');
        wrap.id = 'day-analytics-card-wrapper';
        wrap.innerHTML = html;
        dateCard.after(wrap);
      }).catch(() => {});
    }
    
    $('#f-date').onchange = e => { collectDraft(); S._costCache = {}; dayView(e.target.value || todayISO()); };
    
    if ($('#toggle-open')) {
      const setRO = ro => {
        const els = $$('.nzi[data-f="o"]').concat(['f-openCash', 'f-openStockP', 'f-openStockD'].map(id => $('#' + id)).filter(Boolean));
        els.forEach(el => {
          if (ro) { el.setAttribute('readonly', true); el.style.background = '#f0f0f0'; el.style.fontWeight = 'bold'; }
          else { el.removeAttribute('readonly'); el.style.background = ''; el.style.fontWeight = ''; }
        });
      };
      $('#toggle-open').onclick = () => {
        const cur = S.cur;
        if (cur.d.opening_locked !== false) {
          if (!confirm('⚠️ ओपनिंग (मीटर, कैश, स्टॉक) एडिट करेंगे तो कल की क्लोज़िंग से लिंक टूट जाएगा। आगे बढ़ें?')) return;
          cur.d.opening_locked = false; setRO(false);
          $('#toggle-open').textContent = '🔒 ओपनिंग लॉक करें (कल से जोड़ें)';
        } else {
          const c2 = cur.chain; if (!c2) return toast('कल का हिसाब नहीं मिला');
          cur.d.opening_locked = true;
          $$('.nzi[data-f="o"]').forEach(el => { el.value = c2.nz[el.dataset.k]; });
          $('#f-openCash').value = c2.openCash; $('#f-openStockP').value = c2.openStockP; $('#f-openStockD').value = c2.openStockD;
          setRO(true);
          $('#toggle-open').textContent = '🔓 ओपनिंग एडिट करें';
        }
        recalc(); triggerAutoSave();
      };
    }

    $$('#main input').forEach(i => {
      if (i.id !== 'f-date' && !i.closest('#expbox') && !i.readOnly) {
        i.addEventListener('input', () => { recalc(); triggerAutoSave(); });
      }
    });
    
    main.onclick = e => { const b = e.target.closest('[data-do]'); if (b && A[b.dataset.do]) A[b.dataset.do](b.dataset); };
  }

  function readForm() {
    const st = S.cur;
    if (!st) return {};
    
    // 🔥 BULLETPROOF GUARD: If DOM is not for this date (user navigated away), return DB state
    const dateInput = $('#f-date');
    if (!dateInput || dateInput.value !== st.date) return st.d;

    const g = id => { const el = $('#' + id); return el ? el.value : ''; };
    const d = Object.assign({}, st.d, {
      date: st.date, rateP: g('f-rateP'), rateD: g('f-rateD'), testing: g('f-testing'),
      openCash: g('f-openCash'), paytm: g('f-paytm'), swipe: g('f-swipe'),
      kharcha: g('f-kharcha'), driverInaam: g('f-driverInaam'), chaiKhana: g('f-chaiKhana'),
      malikDiya: g('f-malikDiya'), note: g('f-note'),
      openStockP: g('f-openStockP'), openStockD: g('f-openStockD'),
      tankerP: g('f-tankerP'), tankerD: g('f-tankerD'), 
      dipP: g('f-dipP'), dipD: g('f-dipD'), nz: {},
      physicalCash: $('#f-physicalCash') ? g('f-physicalCash') : (st.d.physicalCash == null ? '' : st.d.physicalCash),
      opening_locked: st.d.opening_locked !== false,
      kharchaItems: $('#expbox')
        ? APP.getExpItems().filter(x => x.label || num(x.amount)).map(x => ({ label: x.label, amount: num(x.amount) }))
        : (st.d.kharchaItems || [])
    });
    K.NZ.forEach(k => { d.nz[k] = Object.assign({ o: '', c: '' }, K.activeNz().includes(k) ? {} : ((st.d.nz || {})[k] || {})); });
    $$('.nzi').forEach(i => { d.nz[i.dataset.k][i.dataset.f] = i.value; });
    return d;
  }
  
  function collectDraft() { 
    if (S.cur && !S.cur.locked) { 
      const d = readForm(); 
      delete d.sum; 
      S.draft[S.cur.date] = d; 
    } 
  }

  function renderRows(st) {
    const rows = st.rows;
    $('#rowsbox').innerHTML = rows.length ? rows.map(r => `<div class="item"><div class="a"><b>${esc(r.partyName)}</b>
      <small>${esc(r.time || '')} · ${r.kind === 'udhar' ? esc(r.vehicle || '') + (r.fuel ? ' · ' + (FUEL[r.fuel] || '') + ' ' + lit(r.litre) : '') : 'जमा · ' + (MODE[r.mode] || '') + (r.note && !AUTO_NOTES.includes(r.note) ? ' · ' + esc(r.note) : '')}</small>
      ${r.src === 'salesman' ? `<small style="color:${r.verified ? '#0a7d33' : '#b26a00'}">👤 ${esc(r.by)} ने की · ${r.verified ? '✔ मिलान हो गया' : '⏳ मिलान बाकी'}</small>` : ''}</div>
      <div style="text-align:right"><b class="${r.kind === 'udhar' ? 'neg' : 'pos'}">${r.kind === 'udhar' ? '-' : '+'}${money(r.amount)}</b>
      ${APP.isTrueOwner() ? `<div>${r.src === 'salesman' && !r.verified ? `<button class="btn sm g" data-do="verE" data-id="${r.id}">✔ मिलान</button> ` : ''}<button class="btn sm w" data-do="editE" data-id="${r.id}">✏️</button> <button class="btn sm r" data-do="delE" data-id="${r.id}">🗑</button></div>` : ''}</div></div>`).join('')
      : '<p class="mut">आज कोई पार्टी एंट्री नहीं</p>';
  }

  async function updateMarginCard(d, o, date) {
    if (!APP.margins) return;
    const cache = S._costCache || (S._costCache = {});
    let rates = cache[date];
    if (!rates || Date.now() - (rates._t || 0) > 5 * 60 * 1000) {
      try {
        const [p, dd] = await Promise.all([
          APP.margins.getLatestPurchaseRate('petrol', date),
          APP.margins.getLatestPurchaseRate('diesel', date)
        ]);
        let dc = null;
        try {
          const snap = await db().collection('day_costs').doc(date).get();
          if (snap.exists) dc = snap.data();
        } catch (e) {}
        rates = {
          petrol: p || (dc && num(dc.costP)) || 0,
          diesel: dd || (dc && num(dc.costD)) || 0,
          source: (p || dd) ? 'invoice' : 'manual',
          _t: Date.now()
        };
        cache[date] = rates;
      } catch (e) { return; }
    }
    const costP = num(rates.petrol), costD = num(rates.diesel);
    const rateP = num(d.rateP), rateD = num(d.rateD);
    const hasP = o.litP > 0 && costP > 0 && rateP > 0;
    const hasD = o.litD > 0 && costD > 0 && rateD > 0;
    if (!hasP && !hasD) {
      const el = document.querySelector('#day-margin-card');
      if (el) el.remove();
      return;
    }
    const marginP = hasP ? r2((rateP - costP) * o.litP) : 0;
    const marginD = hasD ? r2((rateD - costD) * o.litD) : 0;
    const total = r2(marginP + marginD);
    const pct = o.sale > 0 ? r2(total / o.sale * 100) : 0;
    const totalCls = total >= 0 ? 'pos' : 'neg';
    
    let el = document.querySelector('#day-margin-card');
    if (!el) {
      el = document.createElement('div');
      el.id = 'day-margin-card';
      el.className = 'card';
      el.style.cssText = 'border-left:4px solid #16a34a;background:linear-gradient(180deg,#f0fdf4,#fff)';
      const sumBox = document.querySelector('#sum');
      if (sumBox) {
        const sumCard = sumBox.closest('.card');
        if (sumCard) sumCard.after(el);
      } else return;
    }
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<h3 style="margin:0;color:#166534;font-size:15px">💰 आज का अनुमानित मार्जिन</h3>' +
      '<span class="mut" style="font-size:11px">' + (rates.source === 'invoice' ? 'बिल से' : 'manual rate') + '</span></div>' +
      (hasP ? '<div class="kv" style="padding:4px 0"><span>⛽ पेट्रोल <span class="mut" style="font-size:11px">(' + lit(o.litP) + ' × ₹' + r2(rateP - costP) + '/L)</span></span><b class="' + (marginP >= 0 ? 'pos' : 'neg') + '">' + money(marginP) + '</b></div>' : '') +
      (hasD ? '<div class="kv" style="padding:4px 0"><span>🛢️ डीज़ल <span class="mut" style="font-size:11px">(' + lit(o.litD) + ' × ₹' + r2(rateD - costD) + '/L)</span></span><b class="' + (marginD >= 0 ? 'pos' : 'neg') + '">' + money(marginD) + '</b></div>' : '') +
      '<div class="kv" style="border-top:1px solid #bbf7d0;padding-top:6px;margin-top:4px;border-bottom:0"><span><b>कुल मार्जिन</b> <span class="mut" style="font-size:11px">(' + pct + '%)</span></span><b class="' + totalCls + '" style="font-size:16px">' + money(total) + '</b></div>';
  }

  function recalc() {
    const st = S.cur; if (!st) return;
    const d = readForm(), o = K.compute(d, st.rows);
    
    K.NZ.forEach(k => { const e = $('#net-' + k); if (e) e.textContent = o.nz[k].ok ? r2(o.nz[k].net) : '–'; });
    $('#nzwarn').innerHTML = o.warn.map(w => '<div class="warn">' + esc(w) + '</div>').join('') +
      (o.filled < K.activeNz().length ? `<div class="mut">${o.filled}/${K.activeNz().length} नोज़ल भरे हैं</div>` : '');
      
    const tol = num(C.stockTolerance) || 25;
    const setStkHtml = (prefix, exp, act, diff, tanker, sale) => {
      const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
      let html = kvEl('कल की डिप (ओपनिंग स्टॉक)', lit(num(d['openStock' + prefix]))) +
                 kvEl('+ टैंकर आया', lit(num(tanker))) +
                 kvEl('− आज की बिक्री (मीटर)', lit(sale)) +
                 kvEl('= होना चाहिए', lit(exp)) +
                 kvEl('आज की डिप (असली स्टॉक)', act !== null ? lit(act) : 'डिप डालें', 'big');
      if (diff !== null) {
        const a = Math.abs(diff), sg = diff > 0 ? '+' : '';
        html += a <= 0.5 ? '<div class="ok" style="margin-top:6px">✔ स्टॉक बराबर है</div>'
          : a <= tol ? `<div class="warn" style="margin-top:6px">≈ फर्क ${sg}${r2(diff)} L (डिप की सटीकता के अंदर)</div>`
          : `<div class="err" style="margin-top:6px">⚠️ स्टॉक ${diff < 0 ? 'कम' : 'ज़्यादा'}: <b>${sg}${r2(diff)} L</b> — जाँचें</div>`;
      }
      if (act !== null && act < (prefix === 'P' ? 1200 : 1000)) html += `<div class="warn" style="margin-top:6px">⚠️ स्टॉक खत्म होने वाला है! (${act} L बचा है)</div>`;
      return html;
    };

    const elP = $('#stkP'); if (elP) elP.innerHTML = setStkHtml('P', o.expStockP, o.actStockP, o.diffP, d.tankerP, o.litP);
    const elD = $('#stkD'); if (elD) elD.innerHTML = setStkHtml('D', o.expStockD, o.actStockD, o.diffD, d.tankerD, o.litD);

    const actInpP = $('#f-actStockP'); if(actInpP) actInpP.value = o.actStockP !== null ? r2(o.actStockP) : '';
    const actInpD = $('#f-actStockD'); if(actInpD) actInpD.value = o.actStockD !== null ? r2(o.actStockD) : '';

    const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
    
    const gallaIn = r2(num(d.openCash) + o.sale + o.jCash + o.jPaytm + o.jSwipe);
    const gallaOut = r2(num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya));

    $('#sum').innerHTML = `
      <div style="font-size:13px; color:#555; margin-bottom:8px; display:flex; justify-content:space-between;">
        <span>पेट्रोल: <b>${lit(o.litP)}</b> (${money(o.amtP)})</span>
        <span>डीज़ल: <b>${lit(o.litD)}</b> (${money(o.amtD)})</span>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div style="flex:1; min-width:0; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px;">
          <div style="font-weight:bold; color:#166534; margin-bottom:4px; font-size:13px; text-align:center;">💰 गल्ला (आमदनी)</div>
          ${kvEl('बिक्री', money(o.sale))}
          ${kvEl('पिछला कैश (AD)', money(d.openCash))}
          ${kvEl('पार्टी जमा', money(o.jCash + o.jPaytm + o.jSwipe))}
          <div class="kv" style="border-top:1px solid #bbf7d0; margin-top:4px; padding-top:4px; font-weight:bold; color:#166534; border-bottom:0;"><span>कुल गल्ला</span><b>${money(gallaIn)}</b></div>
        </div>
        <div style="flex:1; min-width:0; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:8px;">
          <div style="font-weight:bold; color:#991b1b; margin-bottom:4px; font-size:13px; text-align:center;">💸 खर्चा (निकासी)</div>
          ${kvEl('Paytm + स्वाइप', money(num(d.paytm) + num(d.swipe)))}
          ${kvEl('उधार दिया', money(o.udhar))}
          ${kvEl('DG/चाय/अन्य', money(o.totalKharcha))}
          ${kvEl('SBI जमा', money(d.malikDiya))}
          <div class="kv" style="border-top:1px solid #fecaca; margin-top:4px; padding-top:4px; font-weight:bold; color:#991b1b; border-bottom:0;"><span>कुल खर्चा</span><b>${money(gallaOut)}</b></div>
        </div>
      </div>
      <div style="padding:12px; background:#0b3d91; color:#fff; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 10px rgba(11,61,145,0.3);">
        <span style="font-size:15px; font-weight:600;">असली कैश (बचा)</span>
        <span style="font-size:22px; font-weight:bold;">${money(o.close)}</span>
      </div>
    `;
    st.o = o;
    
    updateMarginCard(d, o, st.date).catch(() => {});
  }

  async function saveDay(submit, silent = false) {
    if (APP.isViewer()) return toast('आप केवल देख सकते हैं');
    const st = S.cur; if(!st) return;
    const d = readForm(); const o = K.compute(d, st.rows);
    if (silent && !st.d.at && o.filled === 0 && !num(d.paytm) && !num(d.swipe) && !num(d.malikDiya) && !K.khTotal(d)) return;
    if (submit && !silent) {
      const ch = st.chain;
      const v = (K.validate || (() => ({ errors: [], warns: [] })))(d, st.rows, { isOwner: APP.isOwner(), prevPending: (ch && !ch.prevSubmitted) ? dmy(ch.prevDate) : '', gap: ch ? ch.gap : 0, prevDate: ch ? dmy(ch.prevDate) : '' });
      if (v.errors.length) { alert('❌ अभी जमा नहीं हो सकता:\n\n• ' + v.errors.join('\n• ')); return; }
      if (v.warns.length) { if (!confirm('⚠️ ध्यान दें:\n\n• ' + v.warns.join('\n• ') + '\n\nफिर भी जमा करके लॉक करें?')) return; }
      else if (!confirm('क्या आप आज का हिसाब जमा करके लॉक करना चाहते हैं?')) return;
    }
    d.sum = { sale: o.sale, litP: o.litP, litD: o.litD, close: o.close, expStockP: o.expStockP, expStockD: o.expStockD, actStockP: o.actStockP, actStockD: o.actStockD, diffP: o.diffP, diffD: o.diffD,
      openCash: num(d.openCash), openStockP: num(d.openStockP), openStockD: num(d.openStockD),
      physical: K.has(d.physicalCash) ? num(d.physicalCash) : null, physDiff: K.has(d.physicalCash) ? r2(num(d.physicalCash) - o.close) : null };
    d.status = submit ? 'submitted' : (st.d.status || 'open');
    d.by = S.user.email; d.at = FV().serverTimestamp();
    
    S.draft[st.date] = d;

    try {
      await APP.commit(db().collection('days').doc(st.date).set(dayPatch(st.base, d), { merge: true }));
      st.base = baseOf(d);
      S.rates = { petrol: d.rateP, diesel: d.rateD }; delete S.draft[st.date];
      
      try {
        const bankRef = db().collection('bank_deposits');
        const docId = 'sbi_auto_' + st.date;
        const mdAmt = num(d.malikDiya);
        
        const exSnap = await bankRef.doc(docId).get();
        const exd = exSnap.exists ? exSnap.data() : null;
        if (exd && (exd.removed || exd.edited)) {
        } else if (mdAmt > 0) {
          await bankRef.doc(docId).set({
            bank: 'SBI', date: st.date, amount: mdAmt, mode: 'cash',
            note: 'मालिक को दिया (SBI जमा)', by: S.user.email, at: FV().serverTimestamp()
          }, { merge: true });
        } else {
          await bankRef.doc(docId).delete().catch(() => {});
        }
      } catch (bankErr) { console.error('Bank sync error:', bankErr); }

      if (!silent) {
        APP.audit(submit ? 'day_submit' : 'day_save', { date: st.date, sale: o.sale, close: o.close });
        toast(submit ? 'हिसाब जमा हो गया' : 'सेव हो गया');
      }
      if (submit && !silent) { await dayView(st.date); } else { st.d = d; }
    } catch (e) { if (!silent) toast('सेव नहीं हुआ: ' + e.message); }
  }

  const A = {
    addU() { collectDraft(); if(APP.entryModal) APP.entryModal({ kind: 'udhar', date: S.cur.date }); },
    addJ() { collectDraft(); if(APP.entryModal) APP.entryModal({ kind: 'jama', date: S.cur.date }); },
    addX() { const it = APP.getExpItems(); it.push({ label: '', amount: '' }); APP.setExpItems(it); const ls = $$('#expbox .exl'); if (ls.length) ls[ls.length - 1].focus(); },
    delX(ds) { const it = APP.getExpItems(); it.splice(+ds.i, 1); APP.setExpItems(it); recalc(); triggerAutoSave(); },
    splitX(ds) {
      const it = APP.getExpItems(), x = it[+ds.i], tot = num(x && x.amount);
      if (!(tot > 0)) return toast('पहले इस खर्चे की रकम भरें');
      APP.expEditor({
        title: '✂️ खर्चा अलग-अलग बाँटें', mustTotal: tot,
        note: `<b>${esc(x.label || 'यह खर्चा')}</b> · ${money(tot)} — इसे अलग-अलग चीज़ों में बाँटें। सबका जोड़ ${money(tot)} ही रहना चाहिए।`,
        lines: [{ cat: 'other', label: x.label, amount: tot }, { cat: 'other', label: '', amount: '' }],
        onOk: lines => { it.splice(+ds.i, 1); APP.applyExpLines(it, lines); toast('खर्चा बँट गया — 💾 सेव करना न भूलें'); }
      });
    },
    splitF(ds) {
      const id = APP.KHF[ds.f], el = $('#' + id), tot = num(el && el.value);
      if (!(tot > 0)) return toast('पहले इस खर्चे की रकम भरें');
      const name = (APP.EXP_CATS.find(c => c[0] === ds.f) || [])[1] || '';
      APP.expEditor({
        title: '✂️ खर्चा अलग-अलग बाँटें', mustTotal: tot,
        note: `<b>${esc(name)}</b> · ${money(tot)} — इसे अलग-अलग चीज़ों में बाँटें। सबका जोड़ ${money(tot)} ही रहना चाहिए।`,
        lines: [{ cat: ds.f, label: '', amount: tot }, { cat: 'other', label: '', amount: '' }],
        onOk: lines => { el.value = ''; APP.applyExpLines(APP.getExpItems(), lines); toast('खर्चा बँट गया — 💾 सेव करना न भूलें'); }
      });
    },
    save() { saveDay(false); },
    submit() { saveDay(true); },
    async unlock() {
      APP.audit('day_unlock', { date: S.cur.date });
      await APP.commit(db().collection('days').doc(S.cur.date).update({ status: 'open' })); dayView(S.cur.date);
    },
    report() { if (APP.shareCompactDayReport) APP.shareCompactDayReport(S.cur, readForm()); },
    async relink() {
      const ch = S.cur.chain; if (!ch) return;
      if (!confirm('इस दिन की ओपनिंग (मीटर, कैश, स्टॉक) कल के क्लोज़ से दोबारा जोड़ें?')) return;
      collectDraft();
      const date = S.cur.date, d = Object.assign({}, S.draft[date] || readForm());
      applyChain(d, ch); d.opening_locked = true; S.draft[date] = d;
      await dayView(date); await saveDay(false, true); toast('कल से जुड़ गया ✔');
    },
    async importShifts() {
      const date = S.cur.date;
      let sh;
      try { sh = await db().collection('sm_shifts').where('date', '==', date).get(); } catch (e) { return toast('शिफ्ट नहीं मिली: ' + e.message); }
      const list = sh.docs.map(x => x.data());
      if (!list.length) return toast('इस दिन की कोई सेल्समैन शिफ्ट नहीं मिली');
      const clo = {}, warns = []; let paytm = 0, swipe = 0; const exps = [];
      list.forEach(x => {
        K.NZ.forEach(k => {
          const n = x.nz && x.nz[k];
          if (!n || !K.has(n.o) || !K.has(n.c)) return;
          if (!(k in clo) || num(n.c) > clo[k]) clo[k] = num(n.c);
          const dOpen = $('.nzi[data-k="' + k + '"][data-f="o"]');
          if (dOpen && K.has(dOpen.value) && Math.abs(num(dOpen.value) - num(n.o)) > 0.01 && !(num(n.o) > num(dOpen.value))) warns.push(k.toUpperCase() + ': शिफ्ट ओपनिंग ' + n.o + ' ≠ दिन की ओपनिंग ' + dOpen.value);
        });
        paytm += num(x.paytm); swipe += num(x.swipe);
        if (num(x.expAmt)) exps.push({ label: (x.name || '') + ': ' + (x.expLabel || 'खर्चा'), amount: num(x.expAmt) });
      });
      const m = modal(`<h3>📥 शिफ्ट से भरें · ${dmy(date)}</h3>
        ${list.map(x => `<div class="kv"><span><b>${esc(x.name || x.sid)}</b><br><small class="mut">Paytm ${money(x.paytm)} · स्वाइप ${money(x.swipe)} · खर्चा ${money(x.expAmt)}</small></span><b>${money((x.sum || {}).sale)}</b></div>`).join('')}
        <div class="mut" style="margin-top:8px;font-size:13px">भरे जाएँगे: ${Object.keys(clo).length} नोज़ल की क्लोज़िंग · Paytm ${money(paytm)} · स्वाइप ${money(swipe)} · ${exps.length} खर्चे</div>
        ${warns.length ? '<div class="warn" style="margin-top:8px">' + warns.map(esc).join('<br>') + '</div>' : ''}
        <div class="btns" style="margin-top:10px"><button class="btn g" id="is-ok">✅ भर दो</button><button class="btn w" id="is-no">रद्द</button></div>`);
      $('#is-no', m).onclick = () => m.close();
      $('#is-ok', m).onclick = () => {
        const fire = el => el.dispatchEvent(new Event('input', { bubbles: true }));
        Object.keys(clo).forEach(k => { const el = $('.nzi[data-k="' + k + '"][data-f="c"]'); if (el && !el.disabled) { el.value = clo[k]; fire(el); } });
        const pe = $('#f-paytm'), se = $('#f-swipe');
        if (pe && !pe.disabled && paytm > 0) { pe.value = r2(paytm); fire(pe); }
        if (se && !se.disabled && swipe > 0) { se.value = r2(swipe); fire(se); }
        if (exps.length) APP.mergeExpItems(exps);
        m.close(); recalc(); triggerAutoSave(); toast('शिफ्ट से भर गया — जाँचकर 💾 सेव करें');
      };
    },
    scan() { if (APP.scanRegister) APP.scanRegister(S.cur); },
    editE(data) {
      collectDraft();
      const row = S.cur.rows.find(r => r.id === data.id);
      if (row && APP.entryModal) APP.entryModal({ entry: row, date: row.date });
    },
    async verE(data) {
      collectDraft();
      try {
        await APP.commit(db().collection('ledger').doc(data.id).update({ verified: true, verifiedBy: S.user.email, verifiedAt: FV().serverTimestamp() }));
        toast('मिलान ✔'); dayView(S.date);
      } catch (e) { toast('नहीं हुआ: ' + e.message); }
    },
    async delE(data) {
      collectDraft();
      const row = S.cur.rows.find(r => r.id === data.id);
      if (!row) return;
      if (await dayIsLocked(row.date)) return toast(LOCKMSG);
      if (!confirm('क्या आप सच में इस एंट्री को हटाना चाहते हैं?')) return;
      try {
        const b = db().batch();
        b.delete(db().collection('ledger').doc(row.id));
        const delta = -K.signed(row); 
        if (delta) b.update(db().collection('parties').doc(row.partyId), { bal: FV().increment(delta) });
        await APP.commit(b.commit());
        APP.audit('ledger_delete', { party: row.partyName, kind: row.kind, amount: row.amount, litre: row.litre || 0, vehicle: row.vehicle || '', date: row.date, enteredBy: row.by || '' });
        refreshDaySum(row.date);
        toast('एंट्री हटा दी गई ✔');
        S.parties.pub = null;
        dayView(S.date);
      } catch (e) { toast('नहीं हटा: ' + e.message); }
    }
  };

  Object.assign(APP, { 
    dayView, readForm, recalc, collectDraft, triggerAutoSave, dayIsLocked, refreshDaySum, A,
    chainFor, applyChain, baseOf, dayPatch
  });

  (function () {
    const st = document.createElement('style'); st.id = 'sum-fix';
    st.textContent = `#sum .kv{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 0;min-width:0}
#sum .kv span{font-size:12.5px;color:#555;line-height:1.25;overflow-wrap:anywhere}
#sum .kv b{font-size:clamp(14px,4.3vw,17px);line-height:1.2;max-width:100%;overflow-wrap:anywhere;word-break:break-word}
#sum > div:first-child{flex-wrap:wrap;gap:4px 12px}`;
    document.head.appendChild(st);
  })();
})();
