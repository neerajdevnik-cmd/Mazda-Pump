/* Mazda Oil Company - Runsheet Management (Manager Side) with History */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();
  const isViewer = () => APP.isViewer && APP.isViewer();

  APP.views = APP.views || {};
  let beepAudio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
  let lastPendingCount = 0;

  APP.views.runsheet = async function (mode) {
    mode = mode || 'active';
    if (isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">रनशीट लोड हो रही है…</p>';

    let snap, cSnap, RSH = { sh: [], cs: [] };
    try {
      if (mode === 'active') {
        snap = await db().collection('runsheets').where('status', '==', 'active').get();
        cSnap = await db().collection('cash_submissions').where('status', '==', 'pending').get();
      } else {
        snap = await db().collection('runsheets').where('date', '>=', APP.shiftDate(today(), -90)).get();
        const from = APP.shiftDate(today(), -90);
        const [a, b] = await Promise.all([db().collection('sm_shifts').where('date', '>=', from).get(), db().collection('cash_submissions').where('date', '>=', from).get()]);
        cSnap = { docs: [] }; RSH = { sh: a.docs.map(d => d.data()), cs: b.docs.map(d => d.data()) };
      }
    } catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }

    let activeSheets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (mode !== 'active') activeSheets = activeSheets.filter(x => x.status === 'closed').sort((a, b) => (b.date + (b.startTime || '')).localeCompare(a.date + (a.startTime || '')));
    const pendingCash = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (mode === 'active') {
      if (pendingCash.length > lastPendingCount && lastPendingCount !== 0) {
         beepAudio.play().catch(()=>{});
      }
      lastPendingCount = pendingCash.length;
    }

    let cashHtml = '';
    if (mode === 'active' && pendingCash.length) {
      cashHtml = `<div class="card" style="border:2px solid var(--r);">
        <h3 style="color:var(--r);margin-bottom:6px;">🔔 कैश अप्रूवल बाकी (${pendingCash.length})</h3>
        ${pendingCash.map(c => `
          <div class="item" style="align-items:flex-start;">
            <div class="a">
              <b>${esc(c.salesmanName)}</b> · ${money(c.total)}<br>
              <small class="mut">${Object.keys(c.breakdown).map(n => '₹'+n+'x'+c.breakdown[n]).join(', ')}</small>
              <small class="mut">${dmy(c.date)} ${c.time}</small>
            </div>
            <button class="btn sm g" data-approve="${c.id}">✔ अप्रूव करें</button>
          </div>
        `).join('')}
      </div>`;
    }

    const histInfo = sh => {
      const s = RSH.sh.find(x => x.rsId === sh.id) || RSH.sh.find(x => !x.rsId && x.sid === sh.sid && x.date === sh.date);
      const got = RSH.cs.filter(x => (x.rsId ? x.rsId === sh.id : (x.sid === sh.sid && x.date === sh.date)) && x.status === 'approved').reduce((a, x) => a + num(x.total), 0);
      return s ? `<div class="mut" style="font-size:12px;">बिक्री ${money((s.sum || {}).sale)} · कैश होना चाहिए ${money((s.sum || {}).expected)} · मिला ${money(got)}</div>` : '';
    };
    let listHtml = activeSheets.length ? activeSheets.map(sheet => {
      const st = sheet.status === 'active' ? '<span class="chip ' + (sheet.date !== today() ? 'o' : 'g') + '">चालू (Active)' + (sheet.date !== today() ? ' · ' + dmy(sheet.date) + ' से' : '') + '</span>' : `<span class="chip r">बंद (${dmy(sheet.date)})</span>`;
      const nzOpen = Object.keys(sheet.openings || {}).map(k => `${k.toUpperCase()}: ${sheet.openings[k]}`).join(' | ');
      return `
        <div class="card" style="margin-bottom:10px;padding:12px;">
          <div class="row" style="align-items:center;">
            <div style="flex:1">
              <b>${esc(sheet.salesmanName)}</b> ${st}
              <div class="mut" style="font-size:12px;">मीटर: ${sheet.nozzles.join(', ').toUpperCase()}</div>
              <div class="mut" style="font-size:12px;">ओपनिंग: ${nzOpen}</div>
              ${sheet.status === 'closed' ? histInfo(sheet) : ''}
              ${sheet.startTime ? `<div class="mut" style="font-size:12px;">शुरू: ${sheet.startTime} ${sheet.endTime ? ' | बंद: ' + sheet.endTime : ''}</div>` : ''}
            </div>
            <div style="text-align:right;">
              ${sheet.status === 'active' ? `<button class="btn sm r" data-close="${sheet.id}">🛑 शिफ्ट बंद करें</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('') : `<p class="mut" style="text-align:center;padding:20px;">${mode === 'active' ? 'आज कोई सक्रिय रनशीट नहीं है।' : 'कोई पुरानी रनशीट नहीं मिली।'}</p>`;

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff;">
        <div class="row" style="align-items:center;">
          <div style="flex:1">
            <h3 style="color:#fff;margin:0;">📋 रनशीट</h3>
            <div style="font-size:12px;opacity:.85;margin-top:4px;">${mode === 'active' ? 'आज की सक्रिय शिफ्ट' : 'पुरानी बंद शिफ्ट'}</div>
          </div>
          <div style="flex:0 0 auto;">
            <button class="btn sm w" id="rs-toggle">${mode === 'active' ? '📜 हिस्ट्री देखें' : '⬅️ वापस'}</button>
          </div>
        </div>
      </div>
      ${cashHtml}
      <div id="rs-list">${listHtml}</div>
      <div class="btns" style="margin-top:12px;">
        ${mode === 'active' ? '<button class="btn o" id="rs-add">+ नई रनशीट बनाएं</button>' : ''}
      </div>
    `;

    $('#rs-toggle').onclick = () => APP.views.runsheet(mode === 'active' ? 'history' : 'active');

    if (mode === 'active' && $('#rs-add')) $('#rs-add').onclick = () => createRunsheetModal();

    $$('[data-approve]').forEach(b => b.onclick = async () => {
      if (!confirm('क्या आपने कैश गिनकर देख लिया है? अप्रूव करने पर यह रकम सेल्समैन के खाते में जुड़ जाएगी।')) return;
      const btn = b; btn.disabled = true;
      try {
        const cid = btn.dataset.approve;
        await db().collection('cash_submissions').doc(cid).update({
          status: 'approved',
          approvedBy: S.user ? S.user.email : 'Manager',
          approvedAt: APP.FV.serverTimestamp()
        });
        APP.audit('cash_approve', { id: cid });
        toast('कैश अप्रूव हो गया ✔'); APP.views.runsheet(mode);
      } catch(e) { btn.disabled = false; toast('एरर: ' + e.message); }
    });

    $$('[data-close]').forEach(b => b.onclick = async () => {
      const sh = activeSheets.find(x => x.id === b.dataset.close); if (!sh) return;
      const warn = [], closings = {};
      try {
        let s1 = await db().collection('sm_shifts').doc(sh.id).get();
        if (!s1.exists) s1 = await db().collection('sm_shifts').doc(sh.sid + '_' + sh.date).get();
        const sd = s1.exists ? s1.data() : null;
        (sh.nozzles || []).forEach(k => {
          const c = sd && sd.nz && sd.nz[k] ? sd.nz[k].c : '';
          if (c === '' || c == null || isNaN(Number(c))) warn.push(k.toUpperCase() + ' की क्लोज़िंग नहीं भरी');
          else closings[k] = num(c);
        });
        const pc = await db().collection('cash_submissions').where('status', '==', 'pending').get();
        const mine = pc.docs.filter(d => { const x = d.data(); return x.sid === sh.sid && (!x.rsId || x.rsId === sh.id); });
        if (mine.length) warn.push('कैश अप्रूवल बाकी है (' + mine.length + ')');
      } catch (e) { }
      if (!confirm((warn.length ? '⚠️ ' + warn.join('\n⚠️ ') + '\n\n' : '') + 'क्या आप इस शिफ्ट को बंद करना चाहते हैं? इसके बाद यह हिस्ट्री में चली जाएगी।')) return;
      try {
        await db().collection('runsheets').doc(sh.id).update({ status: 'closed', endTime: APP.nowTime(), closings, closeWarn: warn });
        APP.audit('shift_close', { sid: sh.sid, rs: sh.id, date: sh.date, warn });
        toast('शिफ्ट बंद हो गई ✔'); APP.views.runsheet(mode);
      } catch (e) { toast('एरर: ' + e.message); }
    });
  };

  function createRunsheetModal() {
    const salesmen = C.salesmen || [];
    const nzKeys = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];

    const m = modal(`
      <h3>नई रनशीट बनाएं</h3>
      <label>सेल्समैन चुनें</label>
      <select id="rs-sm">
        ${salesmen.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
      
      <div class="row" style="margin-top:8px">
        <div><label>आज का पेट्रोल रेट</label><input id="rs-rateP" inputmode="decimal" value="${S.rates.petrol || ''}"></div>
        <div><label>आज का डीज़ल रेट</label><input id="rs-rateD" inputmode="decimal" value="${S.rates.diesel || ''}"></div>
      </div>
      <label style="margin-top:10px;">मीटर चुनें और ओपनिंग रीडिंग डालें</label>
      <div id="rs-nz-grid" style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:6px;">
        ${nzKeys.map(k => `
          <div class="row" style="align-items:center;background:#f4f6fa;padding:6px 10px;border-radius:8px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:14px;flex:1;cursor:pointer;margin:0;">
              <input type="checkbox" class="rs-nz-check" value="${k}" style="width:auto;"> <b>${k.toUpperCase()}</b>
            </label>
            <input type="number" id="rs-open-${k}" class="rs-nz-open" placeholder="ओपनिंग" disabled style="width:100px;padding:6px;font-size:14px;margin:0;">
          </div>
        `).join('')}
      </div>

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="rs-save">▶ शिफ्ट शुरू करें</button>
        <button class="btn w" id="rs-cancel">रद्द</button>
      </div>
    `);

    $$('.rs-nz-check', m).forEach(chk => {
      chk.onchange = () => {
        const inp = $(`#rs-open-${chk.value}`, m);
        inp.disabled = !chk.checked;
        if (!chk.checked) inp.value = '';
        else inp.focus();
      };
    });

    $('#rs-cancel', m).onclick = () => m.close();

    $('#rs-save', m).onclick = async () => {
      const sid = $('#rs-sm', m).value;
      const smObj = salesmen.find(x => x.id === sid);
      const selectedNz = [];
      const openings = {};
      let missingOpen = false;

      $$('.rs-nz-check:checked', m).forEach(chk => {
        const k = chk.value;
        const val = $(`#rs-open-${k}`, m).value;
        if (val === '') { missingOpen = true; return; }
        selectedNz.push(k);
        openings[k] = num(val);
      });

      if (!selectedNz.length) return toast('कम से कम एक मीटर चुनें');
      if (missingOpen) return toast('चुने गए सभी मीटर की ओपनिंग रीडिंग डालें');

      const rateP = num($('#rs-rateP', m).value), rateD = num($('#rs-rateD', m).value);
      if (!(rateP > 0) || !(rateD > 0)) return toast('आज का पेट्रोल व डीज़ल रेट भरें');
      const snap = await db().collection('runsheets').where('status', '==', 'active').get();
      const activeNz = [];
      snap.docs.forEach(d => { activeNz.push(...d.data().nozzles); });

      const conflict = selectedNz.filter(n => activeNz.includes(n));
      if (conflict.length) return toast('ये मीटर पहले से चालू हैं: ' + conflict.join(', ').toUpperCase());

      try {
        await db().collection('runsheets').add({
          date: today(), sid: sid, salesmanName: smObj.name, nozzles: selectedNz, openings: openings, rateP, rateD,
          status: 'active', startTime: APP.nowTime(), createdAt: APP.FV.serverTimestamp(),
          createdBy: S.user ? S.user.email : 'manager'
        });
        S.rates = { petrol: rateP, diesel: rateD }; S.ratesSetAt = today(); S.smRates = null;
        m.close(); toast('रनशीट शुरू हो गई ✔'); APP.views.runsheet();
      } catch (e) { toast('एरर: ' + e.message); }
    };
  }

  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer() || S.role === 'salesman') return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#runsheet-more-btn')) return;

    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btn = document.createElement('button');
      btn.id = 'runsheet-more-btn'; btn.className = 'btn w'; btn.innerHTML = '📋 रनशीट (Salesman Duty)';
      btn.onclick = () => APP.go('runsheet');
      btns.insertBefore(btn, btns.firstChild);
    }
  };
  console.log('[Mazda runsheet.js] Final loaded ✓');
})();
