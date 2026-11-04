/* माज़दा ऑयल कंपनी - Mazda V2 Ultimate Party & Bank Ledger System
   - Pinned SBI & PNB Banks + Shortage-Adjusted Live Profit Graph
   - Smart Hisab Scanner & Mandatory Day-Hisab Verification Gate (for Udhar & Jama)
   - Close Khata (Archive to History with Safe Entries) vs Delete Khata (Full Erase + Chain Recalculation)
   - Dual Jama Flow: In Pump (Cash / Paytm) vs Direct In Bank (NEFT / RTGS / Cheque / UPI / Cash)
*/
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const FUEL = APP.FUEL, MODE = APP.MODE, AUTO_NOTES = APP.AUTO_NOTES, AUTO_LBL = APP.AUTO_LBL;
  const db = () => APP.db, FV = () => APP.FV;
  const today = () => APP.todayISO();
  const nowTime = () => APP.nowTime();

  const sigEntry = (priv, e) => K.signed(e);
  const askGemini = (key, payload) => APP.AI.ask(payload);

  // Pinned Bank Accounts Definition
  const PINNED_BANKS = [
    { id: 'bank_sbi', name: 'State Bank of India', isBank: true, pinned: true, bankCode: 'SBI', subtitle: '📌 मुख्य बिज़नेस खाता (Paytm, Swipe, पार्टी बैंक जमा व टैंकर बिल)' },
    { id: 'bank_pnb', name: 'Punjab National Bank', isBank: true, pinned: true, bankCode: 'PNB', subtitle: '📌 पंप खर्चा व सैलरी खाता (DG, चाय-खाना, अन्य खर्चे व स्टाफ वेतन)' }
  ];

  async function ensurePinnedBanks() {
    try {
      const snap = await db().collection('parties').get();
      const existingIds = new Set(snap.docs.map(d => d.id));
      const b = db().batch();
      let needed = false;
      for (const bk of PINNED_BANKS) {
        if (!existingIds.has(bk.id)) {
          b.set(db().collection('parties').doc(bk.id), {
            name: bk.name,
            phone: '',
            vehicles: [],
            bal: 0,
            isBank: true,
            pinned: true,
            bankCode: bk.bankCode,
            subtitle: bk.subtitle,
            createdAt: FV().serverTimestamp()
          }, { merge: true });
          needed = true;
        }
      }
      if (needed) {
        if (APP.Rules) APP.Rules.sys = true;
        try { await b.commit(); } finally { if (APP.Rules) APP.Rules.sys = false; }
      }
    } catch (e) { console.warn('Ensure banks err:', e); }
  }
  APP.ensurePinnedBanks = ensurePinnedBanks;

  // Override getParties to always keep SBI & PNB pinned at the very top
  const origGetParties = APP.getParties;
  APP.getParties = async function (priv, force) {
    if (!priv) await ensurePinnedBanks();
    const list = await origGetParties(priv, force);
    if (priv) return list;
    const banks = [], others = [];
    list.forEach(p => {
      if (K.isBankParty && K.isBankParty(p)) {
        p.isBank = true; p.pinned = true;
        banks.push(p);
      } else {
        others.push(p);
      }
    });
    banks.sort((a, b) => (a.id === 'bank_sbi' ? -1 : 1));
    if (S.role === 'manager') return others; // manager ko bank ledger nahi dikhega
    return banks.concat(others);
  };

  async function findDupEntry(d) {
    try {
      const nv = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const s = await db().collection('ledger').where('date', '==', d.date).where('partyId', '==', d.partyId).get();
      return s.docs.map(x => ({ id: x.id, ...x.data() }))
        .find(r => r.kind === 'udhar' && nv(r.vehicle) === nv(d.vehicle) && Math.abs(num(r.amount) - d.amount) < 0.01) || null;
    } catch (e) { return null; }
  }
  APP.findDupEntry = findDupEntry;

  /* ================= GLOBAL CHAIN RECALCULATOR (Cascading AD Cash, Meter & Stock Sync) ================= */
  async function recalculateAllDaysChain() {
    try {
      if (APP.Rules) APP.Rules.sys = true;
      const [ds, ls] = await Promise.all([
        db().collection('days').get(),
        db().collection('ledger').get()
      ]);
      const days = ds.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
      const allRows = ls.docs.map(x => ({ id: x.id, ...x.data() }));
      // Pehle ka saved data: sirf badle hue din hi likhein (writes bachane ke liye)
      const origById = {};
      ds.docs.forEach(x => { origById[x.id] = x.data(); });
      const deepEq = (a, b) => {
        if (a === b) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
        const ka = Object.keys(a).filter(k => a[k] !== undefined);
        const kb = Object.keys(b).filter(k => b[k] !== undefined);
        if (ka.length !== kb.length) return false;
        return ka.every(k => deepEq(a[k], b[k]));
      };
      let skipped = 0;

      const rowsByDate = {};
      allRows.forEach(r => {
        if (!r.date) return;
        (rowsByDate[r.date] = rowsByDate[r.date] || []).push(r);
      });

      let prevCloseCash = null;
      let prevStockP = null;
      let prevStockD = null;
      let prevNz = null;
      let prevDate = null;

      let batch = db().batch(), cnt = 0;
      for (const d of days) {
        const dt = d.date || d.id;
        if (prevDate !== null && d.opening_locked !== false) {
          d.openCash = r2(prevCloseCash);
          if (prevStockP !== null) d.openStockP = r2(prevStockP);
          if (prevStockD !== null) d.openStockD = r2(prevStockD);
          d.chainPrev = prevDate;
          if (prevNz && d.nz) {
            K.NZ.forEach(k => {
              if (prevNz[k] && K.has(prevNz[k].c)) {
                d.nz[k] = Object.assign({}, d.nz[k] || {}, { o: prevNz[k].c });
              }
            });
          }
        }
        const dayRows = (rowsByDate[dt] || []).filter(r => !K.isOpening(r) && !r.autoBankSync && !r.directBankJama);
        const o = K.compute(d, dayRows);
        d.sum = Object.assign({}, d.sum || {}, {
          sale: o.sale,
          litP: o.litP,
          litD: o.litD,
          amtP: o.amtP,
          amtD: o.amtD,
          jCash: o.jCash,
          jPaytm: o.jPaytm,
          jSwipe: o.jSwipe,
          jBank: o.jBank,
          udhar: o.udhar,
          bankCashDeposit: o.bankCashDeposit || 0,
          totalKharcha: o.totalKharcha,
          kul: o.kul,
          close: o.close,
          openCash: num(d.openCash),
          expStockP: o.expStockP,
          expStockD: o.expStockD,
          actStockP: o.actStockP,
          actStockD: o.actStockD,
          diffP: o.diffP,
          diffD: o.diffD
        });

        prevCloseCash = o.close;
        prevStockP = o.actStockP !== null ? o.actStockP : Math.max(0, o.expStockP || 0);
        prevStockD = o.actStockD !== null ? o.actStockD : Math.max(0, o.expStockD || 0);
        prevNz = d.nz;
        prevDate = dt;

        const { id: _ignoreId, ...dataNoId } = d;
        const before = origById[dt];
        if (before && deepEq(before, dataNoId)) { skipped++; continue; }
        batch.set(db().collection('days').doc(dt), d, { merge: true });
        cnt++;
        if (cnt >= 350) {
          await batch.commit();
          batch = db().batch();
          cnt = 0;
        }
      }
      if (cnt > 0) await batch.commit();
      if (APP.Rules) APP.Rules.sys = false;
      console.info(`Chain sync: ${days.length} din check, ${days.length - skipped} likhe, ${skipped} pehle se sahi`);
      return days.length;
    } catch (e) {
      if (APP.Rules) APP.Rules.sys = false;
      console.error('Chain recalculation error:', e);
      throw e;
    }
  }
  APP.recalculateAllDaysChain = recalculateAllDaysChain;

  /* ================= SMART HISAB SCANNER & MANDATORY DAY VERIFICATION GATE ================= */
  async function verifyAndLinkWithDayHisab(data, party) {
    // Direct bank jama plays zero role in daily galla hisab, so only verify if it's a pump entry or udhar
    if (data.directBankJama) return data.date;

    const [dsSnap, lsSnap] = await Promise.all([
      db().collection('days').get(),
      db().collection('ledger').where('partyId', '==', party.id).get()
    ]);

    const daysMap = {};
    const allDays = [];
    dsSnap.docs.forEach(doc => {
      const dd = doc.data();
      const dt = dd.date || doc.id;
      daysMap[dt] = dd;
      allDays.push(dd);
    });
    allDays.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const existingPartyRows = lsSnap.docs.map(x => ({ id: x.id, ...x.data() }));
    const amt = num(data.amount);

    // 1. Scan all Daily Hisab records to see if this party/amount was mentioned in Day Notes or Galla difference or unlinked!
    const candidateDays = [];
    const pNameClean = String(party.name || '').toLowerCase().trim();
    const firstWord = pNameClean.split(/\s+/)[0] || '';

    for (const d of allDays) {
      const dt = d.date;
      const alreadyOnDate = existingPartyRows.some(r => r.date === dt && r.kind === data.kind && Math.abs(num(r.amount) - amt) < 1);
      if (alreadyOnDate) continue;

      let reason = '';
      const noteStr = String(d.note || '').toLowerCase();
      if (noteStr && ((firstWord && noteStr.includes(firstWord)) || noteStr.includes(String(amt)))) {
        reason = `हिसाब के नोट में ज़िक्र है: "${d.note}"`;
      } else if (d.sum && K.has(d.physicalCash)) {
        const diff = num(d.physicalCash) - num(d.sum.close);
        if (data.kind === 'jama' && Math.abs(diff - amt) < 500) {
          reason = `उस दिन के गल्ले में +${money(diff)} अतिरिक्त कैश मिला था`;
        } else if (data.kind === 'udhar' && Math.abs(diff + amt) < 500) {
          reason = `उस दिन के गल्ले में -${money(Math.abs(diff))} का अंतर था`;
        }
      }
      if (reason) candidateDays.push({ date: dt, day: d, reason });
    }

    const reqDate = data.date || today();
    const exactDayExists = !!daysMap[reqDate];

    // If user is entering directly from Ledger View (not from inside Day View) OR the target day Hisab doesn't exist yet,
    // show the Smart Hisab Scanner & Verification Modal!
    const isFromLedger = S.tab === 'ledger' || S.partyView || !exactDayExists;
    if (!isFromLedger && exactDayExists) {
      return reqDate;
    }

    return new Promise((resolve) => {
      const candHtml = candidateDays.slice(0, 4).map(c => `
        <div class="item" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <b style="color:#166534;">📅 ${dmy(c.date)} का हिसाब मिला!</b>
            <small style="display:block;color:#15803d;">${esc(c.reason)}</small>
          </div>
          <button type="button" class="btn sm g pick-cand-date" data-dt="${c.date}">✔ इसी से जोड़ें</button>
        </div>
      `).join('');

      const recentDaysHtml = allDays.slice(0, 8).map(d => `
        <option value="${d.date}" ${d.date === reqDate ? 'selected' : ''}>
          ${dmy(d.date)} — बिक्री: ${money(d.sum?.sale || 0)} | बचा कैश: ${money(d.sum?.close || 0)} (${d.status === 'submitted' ? 'लॉक' : 'चालू'})
        </option>
      `).join('');

      const vm = modal(`
        <h3 style="color:#0b3d91;margin:0 0 6px;">🔍 दैनिक हिसाब मिलान एवं सत्यापन (Smart Scanner)</h3>
        <div style="background:#eff6ff;border-left:4px solid #0b3d91;padding:10px;border-radius:8px;font-size:12.5px;margin-bottom:10px;">
          <b>नियम:</b> किसी भी पार्टी के खाते में <b>${data.kind === 'jama' ? 'जमा (+)' : 'उधार (−)'} ${money(amt)}</b> तभी जुड़ेगा जब वह किसी दिन के <b>दैनिक हिसाब</b> के साथ वेरीफाई होकर जुड़ेगा।
        </div>

        ${candHtml ? `
          <div style="margin-bottom:10px;">
            <label style="color:#166534;margin-top:0;">✨ स्कैनर को संभावित दिन मिले (जिनमें यह एंट्री छूटी हो सकती है):</label>
            ${candHtml}
          </div>
        ` : `
          <div class="warn" style="font-size:12px;margin-bottom:10px;">
            🔎 स्कैनर ने सभी पुराने हिसाब जाँचे — <b>${esc(party.name)}</b> की <b>${money(amt)}</b> वाली कोई अनलिंक्ड एंट्री नहीं मिली। कृपया नीचे तारीख चुनें ताकि इसे उस दिन के हिसाब में जोड़ा जा सके:
          </div>
        `}

        <label>किस तारीख के दैनिक हिसाब के साथ वेरीफाई करके जोड़ें?</label>
        <input type="date" id="ver-hisab-date" value="${reqDate}" max="${today()}">

        ${allDays.length ? `
          <label style="margin-top:8px;">या मौजूदा हिसाब वाले दिनों में से चुनें:</label>
          <select id="ver-hisab-sel">
            <option value="">— तारीख चुनें —</option>
            ${recentDaysHtml}
          </select>
        ` : ''}

        <div id="ver-day-status" style="margin-top:8px;font-size:12px;"></div>

        <div class="btns" style="margin-top:14px;">
          <button class="btn g" id="ver-ok">✅ हिसाब से जोड़ें व वेरीफाई करें</button>
          <button class="btn w" id="ver-cancel">रद्द करें</button>
        </div>
      `);

      const dtInp = $('#ver-hisab-date', vm);
      const dtSel = $('#ver-hisab-sel', vm);
      const stBox = $('#ver-day-status', vm);

      const updateStatusInfo = () => {
        const chosen = dtInp.value;
        const dy = daysMap[chosen];
        if (dy) {
          stBox.innerHTML = `<div class="ok" style="padding:8px;border-radius:8px;">✔ <b>${dmy(chosen)}</b> का हिसाब मौजूद है (बिक्री: ${money(dy.sum?.sale || 0)}, बचा कैश: ${money(dy.sum?.close || 0)})। यह रकम सीधे उस दिन के हिसाब में जुड़ जाएगी और आगे के सभी दिनों की चेन अपने-आप अपडेट हो जाएगी!</div>`;
        } else {
          stBox.innerHTML = `<div class="warn" style="padding:8px;border-radius:8px;">ℹ️ <b>${dmy(chosen)}</b> का हिसाब अभी नहीं बना है — सेव करने पर इस तारीख का नया हिसाब कार्ड अपने-आप खुल जाएगा और यह एंट्री उसमें जुड़ जाएगी!</div>`;
        }
      };

      dtInp.onchange = updateStatusInfo;
      if (dtSel) {
        dtSel.onchange = () => {
          if (dtSel.value) {
            dtInp.value = dtSel.value;
            updateStatusInfo();
          }
        };
      }
      updateStatusInfo();

      $$('.pick-cand-date', vm).forEach(b => {
        b.onclick = () => {
          dtInp.value = b.dataset.dt;
          updateStatusInfo();
        };
      });

      $('#ver-cancel', vm).onclick = () => {
        vm.close();
        resolve(null);
      };

      $('#ver-ok', vm).onclick = async () => {
        const finalDate = dtInp.value;
        if (!finalDate) return toast('कृपया तारीख चुनें');
        const btn = $('#ver-ok', vm);
        btn.disabled = true;
        btn.textContent = 'हिसाब में जोड़ रहे हैं...';

        try {
          if (!daysMap[finalDate]) {
            if (APP.Rules) APP.Rules.sys = true;
            const ch = APP.chainFor ? await APP.chainFor(finalDate).catch(() => null) : null;
            const newDayObj = {
              date: finalDate,
              testing: C.testing || 5,
              rateP: S.rates.petrol || C.defaultRateP || 100.23,
              rateD: S.rates.diesel || C.defaultRateD || 95.68,
              openCash: ch ? ch.openCash : 0,
              openStockP: ch ? ch.openStockP : 0,
              openStockD: ch ? ch.openStockD : 0,
              nz: {},
              status: 'open',
              opening_locked: !!ch,
              by: (S.user && S.user.email) || 'Owner',
              at: FV().serverTimestamp()
            };
            if (ch && APP.applyChain) APP.applyChain(newDayObj, ch);
            await db().collection('days').doc(finalDate).set(newDayObj, { merge: true });
            if (APP.Rules) APP.Rules.sys = false;
          }
          vm.close();
          resolve(finalDate);
        } catch (err) {
          if (APP.Rules) APP.Rules.sys = false;
          btn.disabled = false;
          btn.textContent = '✅ हिसाब से जोड़ें व वेरीफाई करें';
          toast('त्रुटि: ' + err.message);
        }
      };
    });
  }

  function sendEntryWhatsApp(data, party) {
    if (!party.phone || party.isBank) return;
    const ph = String(party.phone).replace(/\D/g, '').replace(/^0+/, '');
    if (!ph) return;
    const wa = ph.length === 10 ? '91' + ph : ph;
    let msg;
    if (data.kind === 'udhar') {
      msg = `नमस्ते ${party.name} जी,\n\n`;
      msg += `आपकी गाड़ी *${data.vehicle || ''}* पर भरा:\n`;
      msg += `⛽ ${data.fuel === 'petrol' ? 'पेट्रोल' : 'डीज़ल'} ${r2(data.litre)} L × ₹${r2(data.rate)} = *₹${r2(data.amount)}*\n`;
      msg += `📅 ${dmy(data.date)} ${data.time || ''}\n`;
      msg += `\n${C.pump.name}`;
    } else {
      msg = `नमस्ते ${party.name} जी,\n\n`;
      msg += `आपका *₹${r2(data.amount)}* का भुगतान प्राप्त हुआ (${data.note || data.mode || 'जमा'})।\n`;
      msg += `📅 ${dmy(data.date)} ${data.time || ''}\n\n`;
      msg += `धन्यवाद! 🙏\n${C.pump.name}`;
    }
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), '_blank');
  }

  /* ================= पंप का कैश बैंक में जमा करें (Galla -> SBI / PNB) ================= */
  async function pumpCashToBankModal(defaultDate, defaultBankId) {
    if (APP.isViewer()) return toast('आप केवल देख सकते हैं');
    const date0 = defaultDate || S.date || today();
    const bId0 = defaultBankId || 'bank_sbi';

    const m = modal(`
      <h3>🏦 पंप का कैश बैंक में जमा करें</h3>
      <p class="mut" style="font-size:12px;margin-bottom:10px;">
        यह रकम चुने गए दिन के <b>हिसाब (AD / गल्ले) में से माइनस (− लाल)</b> होगी और चुने गए <b>बैंक के खाते में प्लस (+ हरा)</b> हो जाएगी।
      </p>
      <div class="row">
        <div><label>तारीख (हिसाब से जुड़ेगी)</label><input type="date" id="pcb-date" value="${date0}"></div>
        <div><label>समय</label><input type="time" id="pcb-time" value="${nowTime()}"></div>
      </div>
      <label>किस बैंक में जमा किया?</label>
      <select id="pcb-bank">
        <option value="bank_sbi" ${bId0 === 'bank_sbi' ? 'selected' : ''}>📌 State Bank of India (SBI)</option>
        <option value="bank_pnb" ${bId0 === 'bank_pnb' ? 'selected' : ''}>📌 Punjab National Bank (PNB)</option>
      </select>
      <label>जमा की गई नकद रकम (₹)</label>
      <input id="pcb-amt" inputmode="decimal" placeholder="रुपये डालें">
      <label>विवरण / स्लिप नंबर (Optional)</label>
      <input id="pcb-note" placeholder="जैसे: पंप गल्ला से नकद जमा">
      <div class="btns" style="margin-top:14px;">
        <button class="btn g" id="pcb-save">✅ बैंक में जमा करें</button>
        <button class="btn w" id="pcb-cancel">रद्द</button>
      </div>
    `);

    $('#pcb-cancel', m).onclick = () => m.close();
    $('#pcb-save', m).onclick = async () => {
      const bankId = $('#pcb-bank', m).value;
      const bankName = bankId === 'bank_pnb' ? 'Punjab National Bank' : 'State Bank of India';
      const amt = num($('#pcb-amt', m).value);
      const dt = $('#pcb-date', m).value || today();
      const tm = $('#pcb-time', m).value || nowTime();
      const nt = $('#pcb-note', m).value.trim() || 'पंप का नकद कैश बैंक में जमा (गल्ला से)';
      if (!(amt > 0)) return toast('कृपया सही रकम भरें');
      if (await APP.dayIsLocked(dt)) return toast('❌ यह तारीख लॉक है');

      const btn = $('#pcb-save', m); btn.disabled = true;
      const payId = 'DEP-' + dt.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const who = S.salesman ? S.salesman.name : (S.user && S.user.email) || '';

      try {
        await ensurePinnedBanks();
        const b = db().batch();
        const lRef = db().collection('ledger').doc();
        b.set(lRef, {
          partyId: bankId,
          partyName: bankName,
          date: dt,
          time: tm,
          kind: 'jama',
          mode: 'pump_cash',
          pumpCashDeposit: true,
          hisabVerified: true,
          payId: payId,
          amount: amt,
          note: `${nt} · [${payId}]`,
          createdOn: dt,
          by: who,
          uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          at: FV().serverTimestamp()
        });
        b.update(db().collection('parties').doc(bankId), { bal: FV().increment(-amt) });
        if (APP.Rules) APP.Rules.sys = true;
        try { await APP.commit(b.commit()); } finally { if (APP.Rules) APP.Rules.sys = false; }

        await recalculateAllDaysChain();
        S.parties.pub = null;
        m.close();
        toast(`✅ ${bankName} में ${money(amt)} जमा हो गया और हिसाब अपडेट हो गया!`);
        if (S.partyView) partyView(S.partyView.id, S.partyView.priv);
        else if (S.tab === 'day') APP.dayView(S.date);
        else if (S.tab === 'ledger') ledgerView();
      } catch (e) {
        btn.disabled = false;
        toast('सेव नहीं हुआ: ' + e.message);
      }
    };
  }
  APP.pumpCashToBankModal = pumpCashToBankModal;

  /* ================= ENTRY MODAL (UDHAR + DUAL JAMA + MANDATORY HISAB VERIFICATION) ================= */
  async function entryModal(o) {
    if (APP.isViewer()) return toast('आप केवल देख सकते हैं');
    const priv = !!o.priv, e = o.entry || null, kind0 = e ? e.kind : (APP.isSalesman() ? 'udhar' : (o.kind || 'udhar'));

    if (e && !APP.isTrueOwner() && !APP.isOwner()) {
      return toast('सिर्फ मालिक ही पुरानी एंट्री बदल सकते हैं');
    }

    const allParties = await APP.getParties(priv);
    // Filter out closed/archived parties unless editing an existing entry for them
    const custParties = (priv ? allParties : allParties.filter(p => !p.isBank)).filter(p => !p.closed || (e && e.partyId === p.id));
    if (!custParties.length) { toast('पहले खाते में सक्रिय पार्टी जोड़ें'); return; }

    const date0 = e ? e.date : (o.date || S.date || today());
    const rates = { petrol: S.rates.petrol, diesel: S.rates.diesel };
    const pid0 = e ? e.partyId : (o.partyId && !['bank_sbi', 'bank_pnb'].includes(o.partyId) ? o.partyId : custParties[0].id);

    const m = modal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0;">${e ? 'एंट्री बदलें' : priv ? 'निजी खाता एंट्री' : 'नई लेजर व हिसाब एंट्री'}</h3>
        <button class="btn sm w" id="e-voice" style="background:#f4b41a; color:#000; border:0; padding:6px 12px; border-radius:20px;">🎤 बोलकर भरें</button>
      </div>
      ${(APP.isSalesman()) ? '' : `<div class="seg"><button data-k="udhar">उधार (तेल / डेबिट)</button><button data-k="jama">जमा (पैसा आया)</button></div>`}
      <div class="row"><div><label>तारीख</label><input type="date" id="e-date" value="${date0}"></div><div><label>समय</label><input type="time" id="e-time" value="${e ? e.time || '' : nowTime()}"></div></div>
      <label>पार्टी चुनें</label>
      <select id="e-party">${custParties.map(p => `<option value="${p.id}" ${p.id === pid0 ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>

      <div id="blkU">
        <label>गाड़ी नंबर</label><select id="e-veh"></select><input id="e-vehx" placeholder="गाड़ी नंबर टाइप करें" style="display:none;margin-top:6px">
        <div class="row"><div><label>तेल</label><select id="e-fuel"><option value="petrol">पेट्रोल</option><option value="diesel" selected>डीज़ल</option></select></div>
        <div><label>रेट (Locked) 🔒</label><input id="e-rate" readonly style="background:#f0f0f0;color:#555;font-weight:bold"></div></div>
        <div class="row"><div><label>लीटर</label><input id="e-lit" inputmode="decimal"></div><div><label>रुपये</label><input id="e-amtU" inputmode="decimal"></div></div>
      </div>

      <div id="blkJ" style="display:none;">
        <label style="color:#0b3d91;font-weight:700;">पैसा कहाँ जमा हुआ?</label>
        <div class="seg" id="j-where-seg" style="margin:6px 0 10px;">
          <button type="button" data-jw="pump" class="on">⛽ पंप पर जमा (In Pump)</button>
          <button type="button" data-jw="bank">🏦 सीधे बैंक में जमा (In Bank)</button>
        </div>

        <div id="blkJ-pump">
          <label>पंप पर कैसे मिला? (केवल 2 विकल्प)</label>
          <select id="e-mode-pump">
            <option value="cash">💵 नकद (Cash in Pump)</option>
            <option value="paytm">📱 Paytm / UPI (Pump QR)</option>
          </select>
          <div class="mut" style="font-size:11px;margin-top:4px;">✔ यह रकम दिन के हिसाब के साथ वेरीफाई होकर पंप गल्ले में जुड़ेगी और पार्टी के खाते में (+ हरा) दिखेगी।</div>
        </div>

        <div id="blkJ-bank" style="display:none;background:#f0f7ff;border:1px solid #bae6fd;border-radius:10px;padding:10px;margin-bottom:8px;">
          <div class="row">
            <div>
              <label style="margin-top:0;">किस बैंक खाते में आया?</label>
              <select id="e-bank-target">
                <option value="bank_sbi">State Bank of India (SBI)</option>
                <option value="bank_pnb">Punjab National Bank (PNB)</option>
              </select>
            </div>
            <div>
              <label style="margin-top:0;">भुगतान का तरीका (Mode)</label>
              <select id="e-bank-paymode">
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="Cheque">Cheque (चेक)</option>
                <option value="UPI">UPI / IMPS</option>
                <option value="Cash Deposit">Direct Cash (बैंक में नकद)</option>
              </select>
            </div>
          </div>
          <label>UTR / चेक नंबर / Reference (Optional)</label>
          <input id="e-bank-ref" placeholder="जैसे: UTR 41258963 या Cheque 004512">
          <div class="mut" style="font-size:11px;margin-top:4px;color:#0369a1;">
            ✔ यह रकम <b>पार्टी खाते में (+ हरा)</b> और <b>बैंक खाते में (+ हरा)</b> दोनों जगह यूनिक कोड के साथ दिखेगी, पर <b>दैनिक गल्ले के हिसाब में कोई फर्क नहीं डालेगी</b>।
          </div>
        </div>

        <label>जमा रकम (₹)</label>
        <input id="e-amtJ" inputmode="decimal" placeholder="रुपये भरें">
      </div>

      <label>नोट</label><input id="e-note" value="${esc(e ? e.note || '' : '')}">
      <div class="btns" style="margin-top:12px;">
        <button class="btn g" id="e-save">✅ वेरीफाई व सेव करें</button>
        <button class="btn bpcl" id="e-slip-btn">🖨️ थर्मल पर्ची</button>
        <button class="btn w" id="e-cancel">रद्द</button>
      </div>

      <div id="e-voice-load" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:99999; align-items:center; justify-content:center; flex-direction:column; color:#fff; border-radius:14px;">
        <div class="spin" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.3); border-top-color:#f4b41a; border-radius:50%; animation:spin 1s linear infinite;"></div>
        <div style="margin-top:16px; font-weight:bold;">AI सुन रहा है...</div>
      </div>
    `);

    let kind = kind0, last = 'lit';
    let jamaWhere = (e && (e.mode === 'bank' || e.directBankJama)) ? 'bank' : 'pump';
    const q = id => $('#' + id, m);

    const updateJamaWhereUI = () => {
      $$('#j-where-seg button', m).forEach(b => b.classList.toggle('on', b.dataset.jw === jamaWhere));
      q('blkJ-pump').style.display = jamaWhere === 'pump' ? '' : 'none';
      q('blkJ-bank').style.display = jamaWhere === 'bank' ? '' : 'none';
      syncNote();
    };

    $$('#j-where-seg button', m).forEach(b => b.onclick = () => {
      jamaWhere = b.dataset.jw;
      updateJamaWhereUI();
    });

    const showKind = () => {
      $$('.seg button[data-k]', m).forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      q('blkU').style.display = kind === 'udhar' ? '' : 'none';
      q('blkJ').style.display = kind === 'jama' ? '' : 'none';
      q('e-slip-btn').style.display = kind === 'udhar' ? '' : 'none';
      if (kind === 'jama') updateJamaWhereUI();
    };

    const syncNote = () => {
      if (kind !== 'jama') return;
      const nt = q('e-note'), v = nt.value.trim();
      if (jamaWhere === 'pump') {
        const md = q('e-mode-pump').value;
        if (!v || AUTO_NOTES.includes(v) || /बैंक में जमा/.test(v)) {
          nt.value = md === 'paytm' ? 'Paytm/UPI से पंप पर जमा' : 'नकद जमा (पंप पर)';
        }
      } else {
        const pm = q('e-bank-paymode').value;
        if (!v || AUTO_NOTES.includes(v) || /पंप पर/.test(v)) {
          nt.value = `बैंक में जमा (${pm})`;
        }
      }
    };

    q('e-mode-pump').onchange = syncNote;
    q('e-bank-paymode').onchange = syncNote;
    $$('.seg button[data-k]', m).forEach(b => b.onclick = () => { kind = b.dataset.k; showKind(); });

    const fillVeh = () => {
      const p = APP.partyById(priv, q('e-party').value) || {};
      const vs = p.vehicles || [];
      const cur = e && e.partyId === p.id ? e.vehicle : '';
      let h = vs.map(v => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('') + '<option value="__x">अन्य (टाइप करें)</option>';
      q('e-veh').innerHTML = h;
      if (cur && !vs.includes(cur)) { q('e-veh').value = '__x'; q('e-vehx').value = cur; }
      q('e-vehx').style.display = q('e-veh').value === '__x' ? '' : 'none';
    };
    q('e-veh').onchange = () => { q('e-vehx').style.display = q('e-veh').value === '__x' ? '' : 'none'; };
    q('e-party').onchange = fillVeh; fillVeh();

    const setRate = () => { q('e-rate').value = rates[q('e-fuel').value] || ''; };
    const calcA = () => { const r = num(q('e-rate').value), l = num(q('e-lit').value); q('e-amtU').value = r && l ? r2(r * l) : ''; };
    const calcL = () => { const r = num(q('e-rate').value), a = num(q('e-amtU').value); q('e-lit').value = r && a ? r2(a / r) : ''; };

    q('e-fuel').onchange = () => { setRate(); last === 'lit' ? calcA() : calcL(); };
    q('e-rate').oninput = () => { last === 'lit' ? calcA() : calcL(); };
    q('e-lit').oninput = () => { last = 'lit'; calcA(); };
    q('e-amtU').oninput = () => { last = 'amt'; calcL(); };

    if (e && e.kind === 'udhar') { q('e-fuel').value = e.fuel; q('e-rate').value = e.rate; q('e-lit').value = e.litre; q('e-amtU').value = e.amount; }
    else { setRate(); }

    if (e && e.kind === 'jama') {
      q('e-amtJ').value = e.amount;
      if (e.mode === 'bank' || e.directBankJama) {
        jamaWhere = 'bank';
        if (e.bankTarget) q('e-bank-target').value = e.bankTarget;
        if (e.payMode) q('e-bank-paymode').value = e.payMode;
        if (e.bankRef) q('e-bank-ref').value = e.bankRef;
      } else {
        jamaWhere = 'pump';
        q('e-mode-pump').value = e.mode === 'paytm' ? 'paytm' : 'cash';
      }
    }
    showKind();

    /* Voice Entry */
    q('e-voice').onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('❌ इस ब्राउज़र में Voice support नहीं है');
      const rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = false; rec.maxAlternatives = 1;
      const btn = q('e-voice'); btn.textContent = '🔴 सुन रहा है...'; btn.disabled = true;
      rec.onresult = async (ev) => {
        const transcript = ev.results[0][0].transcript;
        btn.textContent = '⏳ AI समझ रहा है...'; q('e-voice-load').style.display = 'flex';
        try {
          if (!APP.AI.hasKey()) { APP.AI.manageKeys(); throw new Error('पहले 🔑 Gemini key जोड़ें'); }
          const prompt = `Extract data from voice: "${transcript}". Return ONLY JSON: {"kind": "udhar" or "jama", "partyName": "string", "vehicle": "string", "fuel": "petrol" or "diesel", "litre": number, "amount": number, "mode": "cash" or "paytm" or "bank"}.`;
          const txt = await askGemini('', { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } });
          let cleanTxt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
          const a = cleanTxt.indexOf('{'), b = cleanTxt.lastIndexOf('}');
          const data = JSON.parse(cleanTxt.slice(a, b + 1));
          if (data.kind) { kind = data.kind; showKind(); }
          if (data.partyName) {
            const pObj = custParties.find(p => p.name.toLowerCase().includes(data.partyName.toLowerCase()) || data.partyName.toLowerCase().includes(p.name.toLowerCase()));
            if (pObj) { q('e-party').value = pObj.id; fillVeh(); }
          }
          if (data.vehicle) {
            const opt = Array.from(q('e-veh').options).find(o => o.value.toLowerCase().includes(data.vehicle.toLowerCase()));
            if (opt) q('e-veh').value = opt.value;
            else { q('e-veh').value = '__x'; q('e-vehx').value = data.vehicle; q('e-vehx').style.display = ''; }
          }
          if (data.fuel) { q('e-fuel').value = data.fuel; setRate(); }
          if (data.litre) q('e-lit').value = data.litre;
          if (data.amount) {
            if (kind === 'udhar') { q('e-amtU').value = data.amount; if (!data.litre) calcL(); }
            else q('e-amtJ').value = data.amount;
          }
          if (data.mode && kind === 'jama') {
            if (data.mode === 'bank') { jamaWhere = 'bank'; updateJamaWhereUI(); }
            else { jamaWhere = 'pump'; q('e-mode-pump').value = data.mode === 'paytm' ? 'paytm' : 'cash'; updateJamaWhereUI(); }
          }
          toast('✅ AI ने फॉर्म भर दिया');
        } catch (err) { toast('❌ ' + err.message); }
        finally { q('e-voice-load').style.display = 'none'; btn.textContent = '🎤 बोलकर भरें'; btn.disabled = false; }
      };
      rec.onerror = () => { btn.textContent = '🎤 बोलकर भरें'; btn.disabled = false; toast('आवाज़ नहीं आई, दोबारा बोलें'); };
      rec.start();
    };

    q('e-slip-btn').onclick = () => {
      const party = APP.partyById(priv, q('e-party').value) || {};
      const veh = q('e-veh').value === '__x' ? q('e-vehx').value.trim().toUpperCase() : q('e-veh').value;
      if (!q('e-amtU').value) return toast('कृपया रकम भरें');
      if (APP.showThermalSlip) {
        APP.showThermalSlip({
          partyName: party.name, partyPhone: party.phone || '', vehicle: veh,
          fuel: q('e-fuel').value, litre: q('e-lit').value, rate: q('e-rate').value,
          amount: q('e-amtU').value, date: q('e-date').value, time: q('e-time').value
        });
      }
    };

    q('e-cancel').onclick = () => m.close();
    q('e-save').onclick = async () => {
      const partyId = q('e-party').value, party = APP.partyById(priv, partyId);
      if (!party) return toast('पार्टी नहीं मिली, रिफ्रेश करें');
      const data = { partyId, partyName: party.name, date: q('e-date').value, time: q('e-time').value || nowTime(), kind: kind, note: q('e-note').value.trim() };
      if (!data.date) return toast('तारीख चुनें');

      if (data.kind === 'udhar') {
        data.vehicle = q('e-veh').value === '__x' ? q('e-vehx').value.trim().toUpperCase() : q('e-veh').value;
        data.fuel = q('e-fuel').value; data.rate = num(q('e-rate').value); data.litre = num(q('e-lit').value); data.amount = num(q('e-amtU').value);
        if (!(data.amount > 0)) return toast('रुपये भरें');
        if (!priv) {
          if (!data.vehicle) return toast('गाड़ी नंबर लिखें');
          if (!(data.litre > 0)) return toast('लीटर भरें');
        }
      } else {
        data.amount = num(q('e-amtJ').value);
        if (!(data.amount > 0)) return toast('रुपये भरें');

        if (jamaWhere === 'pump') {
          data.mode = q('e-mode-pump').value; // 'cash' or 'paytm'
          data.directBankJama = false;
          if (!data.note) data.note = data.mode === 'paytm' ? 'Paytm/UPI से पंप पर जमा' : 'नकद जमा (पंप पर)';
        } else {
          const bankTarget = q('e-bank-target').value || 'bank_sbi';
          const bankTargetName = bankTarget === 'bank_pnb' ? 'Punjab National Bank' : 'State Bank of India';
          const payMode = q('e-bank-paymode').value || 'NEFT';
          const bankRef = q('e-bank-ref').value.trim();
          const payId = (e && e.payId) ? e.payId : ('PAY-' + data.date.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());

          data.mode = 'bank';
          data.directBankJama = true;
          data.bankTarget = bankTarget;
          data.bankTargetName = bankTargetName;
          data.payMode = payMode;
          data.bankRef = bankRef;
          data.payId = payId;
          data.bankId = 'bank_ledger_' + payId;
          data.note = `बैंक में जमा (${bankTarget === 'bank_pnb' ? 'PNB' : 'SBI'} · ${payMode}${bankRef ? ' · ' + bankRef : ''}) · कोड: ${payId}`;
        }
      }

      // Mandatory Hisab Verification & Smart Scanner for Main Ledger Entries
      if (!priv && !data.directBankJama) {
        const verifiedDate = await verifyAndLinkWithDayHisab(data, party);
        if (!verifiedDate) return; // User cancelled verification
        data.date = verifiedDate;
        data.hisabVerified = true;

        // Ensure rate matches that day's rate if udhar
        if (data.kind === 'udhar') {
          try {
            const dSnap = await db().collection('days').doc(verifiedDate).get();
            if (dSnap.exists) {
              const dd = dSnap.data();
              const dayRate = data.fuel === 'petrol' ? num(dd.rateP) : num(dd.rateD);
              if (dayRate > 0 && Math.abs(dayRate - data.rate) > 0.01) {
                data.rate = dayRate;
                data.litre = r2(data.amount / dayRate);
              }
            }
          } catch (z) {}
        }
      } else {
        data.hisabVerified = true;
      }

      if (priv) { data.status = e ? e.status : 'pending'; }
      const who = S.salesman ? S.salesman.name : (S.user && S.user.email) || '';
      if (e) {
        ['by', 'src', 'sid', 'uid', 'verified', 'verifiedBy', 'createdOn'].forEach(k => { if (e[k] !== undefined) data[k] = e[k]; });
        data.editedBy = who;
      } else {
        data.by = who;
        data.createdOn = data.date;
        data.uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        if (S.salesman) { data.src = 'salesman'; data.sid = S.salesman.id; }
      }
      data.at = FV().serverTimestamp();

      const sbtn = q('e-save');
      if (sbtn.disabled) return;
      if (!priv && !data.directBankJama && (await APP.dayIsLocked(data.date) || (e && e.date !== data.date && await APP.dayIsLocked(e.date)))) {
        return toast('❌ यह तारीख लॉक है');
      }

      if (!e && data.kind === 'udhar' && !priv) {
        const dup = await findDupEntry(data);
        if (dup) {
          if (!confirm('⚠️ ऐसी ही एंट्री पहले से मौजूद है:\n' + dup.partyName + ' · ' + dup.vehicle + ' · ' + money(dup.amount) + '\n\nफिर भी दोबारा जोड़ें?')) return;
        }
      }

      sbtn.disabled = true;
      const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
      const ref = e ? db().collection(col).doc(e.id) : db().collection(col).doc();
      const b = db().batch();
      b.set(ref, data);

      const newSig = sigEntry(priv, data);
      const delta = newSig - (e ? sigEntry(priv, e) : 0);
      if (e && e.partyId && e.partyId !== partyId) {
        const oldSig = sigEntry(priv, e);
        if (oldSig) b.update(db().collection(pcol).doc(e.partyId), { bal: FV().increment(-oldSig) });
        if (newSig) b.update(db().collection(pcol).doc(partyId), { bal: FV().increment(newSig) });
      } else if (delta) {
        b.update(db().collection(pcol).doc(partyId), { bal: FV().increment(delta) });
      }

      // Mirror Direct Bank Jama into target Bank Account's Ledger (+Green in Bank!)
      if (!priv && data.kind === 'jama' && data.directBankJama) {
        await ensurePinnedBanks();
        const bankDocId = 'bmir_' + (e ? e.id : ref.id);
        const bankLedgerRef = db().collection('ledger').doc(bankDocId);
        const bankEntry = {
          partyId: data.bankTarget,
          partyName: data.bankTargetName,
          date: data.date,
          time: data.time,
          kind: 'jama',
          mode: 'bank',
          payMode: data.payMode,
          bankRef: data.bankRef || '',
          payId: data.payId,
          linkedPartyId: party.id,
          linkedPartyName: party.name,
          directBankJama: true,
          autoBankSync: true,
          hisabVerified: true,
          amount: data.amount,
          note: `पार्टी जमा: ${party.name} · ${data.payMode}${data.bankRef ? ' (' + data.bankRef + ')' : ''} · कोड: ${data.payId}`,
          createdOn: data.date,
          by: who,
          at: FV().serverTimestamp()
        };
        b.set(bankLedgerRef, bankEntry);
        if (!e) {
          b.update(db().collection('parties').doc(data.bankTarget), { bal: FV().increment(-data.amount) });
        }
      }

      try {
        if (APP.Rules) APP.Rules.sys = true;
        try { await APP.commit(b.commit()); } finally { if (APP.Rules) APP.Rules.sys = false; }
        m.close();
        toast('वेरीफाई व सेव हो गया ✔');
        if (!priv && !data.directBankJama) {
          await recalculateAllDaysChain();
        }
        S.parties[priv ? 'priv' : 'pub'] = null;
        if (S.partyView) partyView(S.partyView.id, S.partyView.priv);
        else if (S.tab === 'day') APP.dayView(S.date);
        else if (S.tab === 'ledger') ledgerView();
        else if (S.tab === 'priv') APP.views.priv();

        if (!e && !priv && party.phone) {
          setTimeout(() => {
            if (confirm('📤 ' + party.name + ' को WhatsApp पर रसीद भेजें?')) {
              sendEntryWhatsApp(data, party);
            }
          }, 400);
        }
      } catch (x) { sbtn.disabled = false; toast('सेव नहीं हुआ: ' + x.message); }
    };
  }
  APP.entryModal = entryModal;

  /* ================= CLOSE KHATA (MOVE TO HISTORY SAFELY - BOTH MAIN & NIJI) ================= */
  async function closeKhataToHistory(party, allRows, priv) {
    if (party.isBank) return toast('बैंक खाता बंद नहीं किया जा सकता');
    const bal = r2(num(party.bal));
    const pcol = priv ? 'priv_parties' : 'parties';
    const lcol = priv ? 'priv_ledger' : 'ledger';

    const msg = Math.abs(bal) > 0.5
      ? `क्या "${party.name}" का बकाया/बैलेंस (${money(Math.abs(bal))}) बराबर हो गया है और आप यह खाता बंद (Close) करके "हिस्ट्री" में भेजना चाहते हैं?\n\n✔ इसकी सभी पुरानी एंट्रियाँ और दैनिक हिसाब 100% सुरक्षित रहेंगे, बस यह पार्टी मुख्य लिस्ट से हटकर हिस्ट्री में चली जाएगी।`
      : `क्या आप "${party.name}" का खाता बंद (Close) करके "हिस्ट्री" में भेजना चाहते हैं?\n\n✔ इसकी सभी पुरानी एंट्रियाँ 100% सुरक्षित रहेंगी।`;

    if (!confirm(msg)) return;

    try {
      if (APP.Rules) APP.Rules.sys = true;
      if (priv) {
        const pend = (allRows || []).filter(x => x.status === 'pending');
        for (let i = 0; i < pend.length; i += 350) {
          const b = db().batch();
          pend.slice(i, i + 350).forEach(x => b.update(db().collection(lcol).doc(x.id), { status: 'paid', paidAt: FV().serverTimestamp() }));
          await b.commit();
        }
      }
      await db().collection(pcol).doc(party.id).update({
        closed: true,
        closedAmount: bal,
        closedAt: FV().serverTimestamp()
      });
      if (APP.Rules) APP.Rules.sys = false;

      S.parties[priv ? 'priv' : 'pub'] = null;
      toast(`✅ "${party.name}" का खाता बंद होकर हिस्ट्री में सुरक्षित चला गया!`);
      if (priv) APP.views.priv('active');
      else ledgerView('active');
    } catch (e) {
      if (APP.Rules) APP.Rules.sys = false;
      toast('खाता बंद नहीं हुआ: ' + e.message);
    }
  }
  APP.closeKhataToHistory = closeKhataToHistory;

  async function reopenKhataFromHistory(party, priv) {
    const pcol = priv ? 'priv_parties' : 'parties';
    try {
      if (APP.Rules) APP.Rules.sys = true;
      await db().collection(pcol).doc(party.id).update({ closed: false });
      if (APP.Rules) APP.Rules.sys = false;
      S.parties[priv ? 'priv' : 'pub'] = null;
      toast(`✅ "${party.name}" का खाता वापस चालू हो गया!`);
      if (priv) APP.views.priv('active');
      else ledgerView('active');
    } catch (e) {
      if (APP.Rules) APP.Rules.sys = false;
      toast('एरर: ' + e.message);
    }
  }
  APP.reopenKhataFromHistory = reopenKhataFromHistory;

  /* ================= DELETE PARTY ENTIRELY (REMOVE ALL ENTRIES + RE-CHAIN ALL DAYS) ================= */
  async function deletePartyEntirely(party, priv) {
    if (party.isBank) return toast('⚠️ पिन किए गए बैंक खाते (SBI / PNB) को हटाया नहीं जा सकता!');
    if (!APP.isOwner() && !APP.isSuperAdmin?.()) return toast('केवल मालिक ही पार्टी डिलीट कर सकते हैं');

    const b = num(party.bal);
    const balTxt = b === 0 ? '₹0' : (b > 0 ? 'बकाया -₹' + Math.abs(b).toLocaleString('en-IN') : 'एडवांस +₹' + Math.abs(b).toLocaleString('en-IN'));
    if (!confirm(`🗑️ क्या आप सचमुच पार्टी "${party.name}" (${balTxt}) को हमेशा के लिए डिलीट करना चाहते हैं?\n\n⚠️ नियम: खाता डिलीट करने से इसकी सभी पुरानी एंट्रियाँ दैनिक हिसाब से भी हट जाएँगी और उन सभी दिनों का हिसाब (कैश चेन) ऑटो-फिक्स से दोबारा री-कैलकुलेट होगा!\n(अगर एंट्रियाँ सुरक्षित रखनी हैं तो 'खाता बंद / हिस्ट्री' का उपयोग करें)`)) return;

    const pcol = priv ? 'priv_parties' : 'parties';
    const lcol = priv ? 'priv_ledger' : 'ledger';

    toast('🗑️ पार्टी और उसकी हिसाब एंट्रियाँ हटाई जा रही हैं...');
    try {
      if (APP.Rules) APP.Rules.sys = true;
      const es = await db().collection(lcol).where('partyId', '==', party.id).get();
      let batch = db().batch(), cnt = 0;

      for (const doc of es.docs) {
        const rData = doc.data();
        batch.delete(doc.ref);
        cnt++;
        // Also delete mirrored bank entry if it was a direct bank jama
        if (!priv && rData.directBankJama && rData.bankTarget) {
          batch.delete(db().collection('ledger').doc('bmir_' + doc.id));
          batch.update(db().collection('parties').doc(rData.bankTarget), { bal: FV().increment(num(rData.amount)) });
          cnt += 2;
        }
        if (cnt >= 350) { await batch.commit(); batch = db().batch(); cnt = 0; }
      }
      batch.delete(db().collection(pcol).doc(party.id));
      await batch.commit();

      // Re-run the full daily Hisab chain so all affected days update their Udhar/Jama & Closing Cash automatically!
      if (!priv) {
        toast('🔧 सभी दिनों की हिसाब चेन ऑटो-फिक्स की जा रही है...');
        await recalculateAllDaysChain();
      }
      if (APP.Rules) APP.Rules.sys = false;

      S.parties[priv ? 'priv' : 'pub'] = null;
      toast(`✅ पार्टी "${party.name}" डिलीट हो गई और हिसाब चेन री-कैलकुलेट हो गई!`);
      if (priv) APP.views.priv('active'); else ledgerView('active');
    } catch (e) {
      if (APP.Rules) APP.Rules.sys = false;
      toast('डिलीट नहीं हुआ: ' + e.message);
    }
  }
  APP.deletePartyEntirely = deletePartyEntirely;

  /* ================= LEDGER VIEW (PINNED BANKS + ACTIVE / HISTORY TABS + DELETE BUTTON) ================= */
  async function ledgerView(mode) {
    mode = (typeof mode === 'string' && (mode === 'active' || mode === 'history')) ? mode : (S.ledgerMode || 'active');
    S.ledgerMode = mode;
    S.partyView = null;
    const main = $('#main'); main.innerHTML = '<p class="mut">खाते लोड हो रहे हैं…</p>';
    let parties; try { parties = await APP.getParties(false, true); } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const bankParties = parties.filter(p => p.isBank);
    const allCustParties = parties.filter(p => !p.isBank);
    const activeCust = allCustParties.filter(p => !p.closed);
    const historyCust = allCustParties.filter(p => p.closed === true);

    const custParties = mode === 'history' ? historyCust : activeCust;
    const due = activeCust.filter(p => num(p.bal) > 0);
    const canDel = APP.isOwner() || (APP.isSuperAdmin && APP.isSuperAdmin());

    main.innerHTML = `
      <div class="card" style="background:linear-gradient(135deg,#04091a,#0b3d91);color:#fff;padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:12px;opacity:0.85;">सक्रिय पार्टियों से कुल लेना (बकाया)</div>
            <div style="font-size:24px;font-weight:900;color:#fca5a5;">${money(due.reduce((a, p) => a + num(p.bal), 0))}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn sm w" id="bToggleHist" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);">
              ${mode === 'active' ? `📜 बंद खाते / हिस्ट्री (${historyCust.length})` : `⬅️ चालू खाते (${activeCust.length})`}
            </button>
            <button class="btn sm g" id="bPumpBank" style="background:#f4b41a;color:#000;font-weight:800;">🏦 पंप कैश बैंक में जमा</button>
          </div>
        </div>
      </div>

      ${mode === 'active' ? `
      <div class="card" style="border:2px solid #0b3d91;background:linear-gradient(180deg,#f0f7ff,#ffffff);padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h3 style="margin:0;color:#0b3d91;font-size:15px;">📌 पिन किए गए बैंक खाते (Pinned Banks)</h3>
          <span class="chip" style="font-size:10px;background:#e0f2fe;color:#0369a1;">Auto-Sync Active</span>
        </div>
        <div id="bank-pinned-list"></div>
      </div>
      ` : `
      <div class="card" style="background:#fffbeb;border:1px solid #fde68a;padding:10px;">
        <b style="color:#92400e;">📜 बंद खाते (History Archive)</b>
        <div class="mut" style="font-size:12px;">यहाँ वे पार्टियाँ हैं जिनका खाता क्लोज़ किया गया है। इनकी सभी पुरानी एंट्रियाँ और हिसाब 100% सुरक्षित हैं।</div>
      </div>
      `}

      <div class="row search"><input id="q" placeholder="🔍 पार्टी का नाम या गाड़ी नंबर खोजें…"></div>
      <div class="card" id="plist"></div>
      <div class="btns">
        ${mode === 'active' ? `
          <button class="btn o" id="bU">+ उधार</button>
          <button class="btn g" id="bJ">+ जमा (Pump / Bank)</button>
          ${APP.isOwner() ? '<button class="btn w" id="bP">+ नई पार्टी</button>' : ''}
          ${APP.isOwner() ? '<button class="btn w" id="bBulk">📥 लिस्ट से जोड़ें</button>' : ''}
        ` : ''}
      </div>`;

    if (mode === 'active' && $('#bank-pinned-list')) {
      $('#bank-pinned-list').innerHTML = bankParties.map(b => {
        const bal = num(b.bal);
        const netDeposit = -bal;
        const disp = Math.abs(netDeposit) < 0.01 ? '₹0' : (netDeposit >= 0 ? '+₹' + Math.abs(netDeposit).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-₹' + Math.abs(netDeposit).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
        const cls = netDeposit >= 0 ? 'g' : 'r';
        const icon = b.id === 'bank_sbi' ? '🏦' : '🏛️';
        return `
          <div class="item bank-pin-item" data-id="${b.id}" style="cursor:pointer;padding:10px 8px;border-bottom:1px dashed #cbd5e1;">
            <div class="a">
              <b style="font-size:16px;color:#0b3d91;">${icon} ${esc(b.name)}</b>
              <span class="chip" style="font-size:10px;background:#fef3c7;color:#92400e;margin-left:4px;">📌 PINNED BANK</span>
              <small style="color:#475569;display:block;margin-top:2px;">${esc(b.subtitle || '')}</small>
            </div>
            <div style="text-align:right;">
              <span class="chip ${cls}" style="font-size:14px;font-weight:800;">${disp}</span>
              <div style="font-size:10px;color:#0369a1;margin-top:3px;">📈 प्रॉफिट ग्राफ देखें →</div>
            </div>
          </div>
        `;
      }).join('');

      $$('#bank-pinned-list .bank-pin-item').forEach(it => {
        it.onclick = () => partyView(it.dataset.id, false);
      });
    }

    const draw = () => {
      const t = $('#q').value.trim().toLowerCase();
      const list = custParties.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#plist').innerHTML = list.length ? list.map(p => {
        const b = num(p.bal);
        const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '+₹' + Math.abs(b).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
        const cls = b > 0 ? 'r' : (b < 0 ? 'g' : '');
        const cibilBadge = (APP.cibil && APP.cibil.badgeHtml) ? APP.cibil.badgeHtml(p) : '';
        return `<div class="item" data-id="${p.id}" style="cursor:pointer;display:flex;align-items:center;gap:8px;">
          <div class="a" style="flex:1;">
            <b>${esc(p.name)}</b> ${cibilBadge} ${p.closed ? '<span class="chip" style="font-size:10px;">बंद खाता</span>' : ''}
            <small>${esc((p.vehicles || []).join(', '))}</small>
          </div>
          <span class="chip ${cls}">${disp}</span>
          ${canDel ? `<button class="btn sm r del-party-list-btn" data-del-pid="${p.id}" title="पार्टी हमेशा के लिए डिलीट करें" style="padding:5px 8px;font-size:12px;">🗑️</button>` : ''}
        </div>`;
      }).join('') : `<p class="mut" style="text-align:center;padding:16px;">${mode === 'history' ? 'कोई बंद खाता (हिस्ट्री) नहीं है' : 'कोई पार्टी नहीं मिली'}</p>`;

      $$('#plist .item').forEach(it => {
        it.onclick = (ev) => {
          if (ev.target.closest('.del-party-list-btn')) return;
          partyView(it.dataset.id, false);
        };
      });

      $$('.del-party-list-btn').forEach(btn => {
        btn.onclick = (ev) => {
          ev.stopPropagation();
          const p = custParties.find(x => x.id === btn.dataset.delPid);
          if (p) deletePartyEntirely(p, false);
        };
      });
    };

    $('#q').oninput = draw; draw();
    $('#bToggleHist').onclick = () => ledgerView(mode === 'active' ? 'history' : 'active');
    $('#bPumpBank').onclick = () => pumpCashToBankModal(today(), 'bank_sbi');
    if ($('#bU')) $('#bU').onclick = () => entryModal({ kind: 'udhar', date: today() });
    if ($('#bJ')) $('#bJ').onclick = () => entryModal({ kind: 'jama', date: today() });
    if (APP.isOwner() && $('#bP')) $('#bP').onclick = () => partyModal(null, false);
    if (APP.isOwner() && $('#bBulk')) $('#bBulk').onclick = () => bulkPartyModal();
  }
  APP.ledgerView = ledgerView;

  function partyModal(p, priv) {
    const m = modal(`<h3>${p ? 'पार्टी बदलें' : 'नई पार्टी'}</h3>
      <label>नाम</label><input id="p-name" value="${esc(p ? p.name : '')}">
      <label>मोबाइल नंबर</label><input id="p-phone" inputmode="tel" value="${esc(p ? p.phone || '' : '')}">
      <label>गाड़ियां (कॉमा या नई लाइन में)</label><textarea id="p-veh" rows="3">${esc(p ? (p.vehicles || []).join('\n') : '')}</textarea>
      <div class="btns">
        <button class="btn g" id="p-save">सेव</button>
        ${p && !p.isBank ? '<button class="btn r" id="p-del">🗑️ पार्टी डिलीट करें</button>' : ''}
        <button class="btn w" id="p-cancel">रद्द</button>
      </div>`);
    $('#p-cancel', m).onclick = () => m.close();
    if ($('#p-del', m)) {
      $('#p-del', m).onclick = () => { m.close(); deletePartyEntirely(p, priv); };
    }
    $('#p-save', m).onclick = async () => {
      const name = $('#p-name', m).value.trim(); if (!name) return toast('नाम लिखें');
      const vehicles = $('#p-veh', m).value.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const data = { name, phone: $('#p-phone', m).value.trim(), vehicles };
      const pcol = priv ? 'priv_parties' : 'parties';
      const b = db().batch();
      if (p) { b.update(db().collection(pcol).doc(p.id), data); }
      else { const ref = db().collection(pcol).doc(); data.bal = 0; data.closed = false; data.createdAt = FV().serverTimestamp(); b.set(ref, data); }
      await APP.commit(b.commit()); m.close(); toast('सेव हो गया'); S.parties[priv ? 'priv' : 'pub'] = null;
      if (p) { if (priv) partyView(p.id, true); else ledgerView(); }
      else { if (priv) APP.views.priv(); else ledgerView(); }
    };
  }
  APP.partyModal = partyModal;

  async function bulkPartyModal() {
    const m = modal(`<h3>📥 पार्टी लिस्ट जोड़ें</h3>
      <p class="mut" style="margin:4px 0 8px">हर लाइन में एक पार्टी: <b>नाम : गाड़ी1, गाड़ी2</b><br>पार्टी पहले से हो तो सिर्फ नई गाड़ियाँ जुड़ेंगी।</p>
      <textarea id="bk-ta" rows="10" style="width:100%;font-size:13px" placeholder="लक्ष्मण सिंह भराड़ा : 4488, 3388&#10;पारस सती : 2002 CB, 2002 CC"></textarea>
      <div id="bk-pv" style="margin-top:8px"></div>
      <div class="btns" style="margin-top:10px">
        <button class="btn w" id="bk-check">जाँचें</button>
        <button class="btn g" id="bk-save" style="display:none">✅ जोड़ दो</button>
        <button class="btn w" id="bk-no">रद्द</button>
      </div>`);
    let plan = [];
    $('#bk-no', m).onclick = () => m.close();
    const key = s => String(s || '').toLowerCase().replace(/[\s.\-_(),]+/g, '');
    $('#bk-check', m).onclick = async () => {
      let ps; try { ps = await APP.getParties(false, true); } catch (e) { return toast('लिस्ट नहीं मिली: ' + e.message); }
      plan = [];
      $('#bk-ta', m).value.split('\n').forEach(line => {
        line = line.trim(); if (!line) return;
        const i = line.search(/[:|\t]/);
        const name = (i < 0 ? line : line.slice(0, i)).trim();
        const vehicles = (i < 0 ? '' : line.slice(i + 1)).split(/[,;/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
        if (!name) return;
        const ex = ps.find(p => key(p.name) === key(name));
        if (ex) {
          const have = (ex.vehicles || []).map(v => key(v));
          const add = vehicles.filter(v => !have.includes(key(v)));
          plan.push({ ex, name: ex.name, add, all: (ex.vehicles || []).concat(add) });
        } else plan.push({ ex: null, name, add: vehicles, all: vehicles });
      });
      const newN = plan.filter(x => !x.ex).length, upN = plan.filter(x => x.ex && x.add.length).length;
      $('#bk-pv', m).innerHTML = plan.length
        ? `<div class="kv"><span>नई पार्टी</span><b>${newN}</b></div><div class="kv"><span>गाड़ी जुड़ेंगी (पुरानी में)</span><b>${upN}</b></div>` +
          plan.map(x => `<div class="mut" style="font-size:12px">${x.ex ? (x.add.length ? '➕' : '＝') : '🆕'} ${esc(x.name)} ${x.add.length ? '· ' + esc(x.add.join(', ')) : x.ex ? '· कुछ नया नहीं' : ''}</div>`).join('')
        : '<div class="warn">कोई लाइन नहीं मिली</div>';
      $('#bk-save', m).style.display = plan.some(x => !x.ex || x.add.length) ? '' : 'none';
    };
    $('#bk-save', m).onclick = async () => {
      const b = db().batch(); let n = 0;
      plan.forEach(x => {
        if (x.ex) { if (x.add.length) { b.update(db().collection('parties').doc(x.ex.id), { vehicles: x.all }); n++; } }
        else { b.set(db().collection('parties').doc(), { name: x.name, phone: '', vehicles: x.all, bal: 0, closed: false, createdAt: FV().serverTimestamp() }); n++; }
      });
      try { await APP.commit(b.commit()); m.close(); toast(n + ' पार्टी अपडेट हुईं ✔'); S.parties.pub = null; ledgerView(); }
      catch (e) { toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  /* ================= BANK PROFIT & SHORTAGE GRAPH BUILDER ================= */
  async function buildBankProfitGraphHtml(bankParty, allRows) {
    try {
      const daysSnap = await db().collection('days').get();
      const days = daysSnap.docs.map(d => d.data());
      let totShortageP = 0, totShortageD = 0;
      let latestRateP = num(S.rates?.petrol) || 100.23;
      let latestRateD = num(S.rates?.diesel) || 95.68;

      days.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(d => {
        if (num(d.rateP) > 0) latestRateP = num(d.rateP);
        if (num(d.rateD) > 0) latestRateD = num(d.rateD);
        const dp = num(d.sum?.diffP);
        const dd = num(d.sum?.diffD);
        if (dp < 0) totShortageP += Math.abs(dp);
        if (dd < 0) totShortageD += Math.abs(dd);
      });

      const totShortageLit = r2(totShortageP + totShortageD);
      const shortageLossRs = r2(totShortageP * latestRateP + totShortageD * latestRateD);

      const totalJamaCr = r2(allRows.filter(r => r.kind === 'jama').reduce((a, b) => a + num(b.amount), 0));
      const totalKharchaDr = r2(allRows.filter(r => r.kind === 'udhar').reduce((a, b) => a + num(b.amount), 0));
      const grossBankSurplus = r2(totalJamaCr - totalKharchaDr);
      const netActualProfit = r2(grossBankSurplus - shortageLossRs);

      const maxBar = Math.max(totalJamaCr, totalKharchaDr + shortageLossRs, 1);
      const crPct = Math.min(100, Math.round((totalJamaCr / maxBar) * 100));
      const drPct = Math.min(100, Math.round((totalKharchaDr / maxBar) * 100));
      const shPct = Math.min(100, Math.round((shortageLossRs / maxBar) * 100));

      return `
        <div class="card" style="background:linear-gradient(135deg,#04091a 0%,#0b2b5e 100%);color:#fff;border:2px solid #f4b41a;border-radius:14px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <h3 style="margin:0;color:#f4b41a;font-size:16px;">📊 लाइव बैंक & प्रॉफिट ग्राफ (Shortage Adjusted)</h3>
              <div style="font-size:11px;opacity:0.8;">CIBIL की जगह वास्तविक जमा, खर्चा/बिल और शॉर्टेज कटौती का पूरा विश्लेषण</div>
            </div>
            <span class="chip ${netActualProfit >= 0 ? 'g' : 'r'}" style="font-size:12px;font-weight:900;">
              ${netActualProfit >= 0 ? '🟢 मुनाफा (Surplus)' : '🔴 दबाव (Deficit)'}
            </span>
          </div>

          <div style="margin:10px 0;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>🟢 कुल जमा (Paytm + Swipe + पार्टी/गल्ला जमा)</span>
              <b style="color:#4ade80;">+${money(totalJamaCr)}</b>
            </div>
            <div style="background:rgba(255,255,255,0.12);height:10px;border-radius:99px;overflow:hidden;margin-bottom:8px;">
              <div style="width:${crPct}%;height:100%;background:linear-gradient(90deg,#16a34a,#4ade80);"></div>
            </div>

            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>🔴 कुल निकासी / टैंकर बिल / पंप खर्चे</span>
              <b style="color:#f87171;">-${money(totalKharchaDr)}</b>
            </div>
            <div style="background:rgba(255,255,255,0.12);height:10px;border-radius:99px;overflow:hidden;margin-bottom:8px;">
              <div style="width:${drPct}%;height:100%;background:linear-gradient(90deg,#dc2626,#f87171);"></div>
            </div>

            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>⚠️ कुल तेल शॉर्टेज कटौती (${lit(totShortageLit)} × वर्तमान रेट)</span>
              <b style="color:#fbbf24;">-${money(shortageLossRs)}</b>
            </div>
            <div style="background:rgba(255,255,255,0.12);height:10px;border-radius:99px;overflow:hidden;">
              <div style="width:${shPct}%;height:100%;background:linear-gradient(90deg,#d97706,#fbbf24);"></div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.2);">
            <div style="background:rgba(255,255,255,0.08);padding:8px;border-radius:8px;">
              <div style="font-size:10px;opacity:0.8;">शॉर्टेज विवरण (P: ₹${latestRateP} | D: ₹${latestRateD})</div>
              <div style="font-size:13px;font-weight:700;color:#fbbf24;margin-top:2px;">P: ${lit(totShortageP)} · D: ${lit(totShortageD)}</div>
            </div>
            <div style="background:rgba(255,255,255,0.12);padding:8px;border-radius:8px;text-align:right;">
              <div style="font-size:10px;opacity:0.85;">शॉर्टेज घटाकर शुद्ध बैलेंस / प्रॉफिट</div>
              <div style="font-size:16px;font-weight:900;color:${netActualProfit >= 0 ? '#4ade80' : '#f87171'};margin-top:2px;">
                ${netActualProfit >= 0 ? '+' : '-'}${money(Math.abs(netActualProfit))}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      return '';
    }
  }

  /* ================= PARTY / BANK LEDGER DETAIL VIEW ================= */
  async function partyView(id, priv) {
    const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
    S.partyView = { id, priv: !!priv };
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let ps, es;
    try { [ps, es] = await Promise.all([db().collection(pcol).doc(id).get(), db().collection(col).where('partyId', '==', id).get()]); }
    catch (e) { main.innerHTML = APP.errBox(e); return; }
    if (!ps.exists) { S.partyView = null; main.innerHTML = '<div class="err">खाता नहीं मिला</div>'; return; }
    const p = { id, ...ps.data() };
    const isBank = !priv && (K.isBankParty ? K.isBankParty(p) : p.isBank);
    const all = es.docs.map(x => ({ id: x.id, ...x.data() }));
    const st = K.stmt(all, null, null);

    const tDr = st.rows.filter(r => r.kind === 'udhar').reduce((a, b) => a + num(b.amount), 0);
    const tCr = st.rows.filter(r => r.kind === 'jama').reduce((a, b) => a + num(b.amount), 0);
    const ph = String(p.phone || '').replace(/\D/g, '').replace(/^0+/, ''), wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
    const mism = !priv && Math.abs(num(p.bal) - st.close) > 0.5;
    const viewer = APP.isViewer();
    const canEdit = !viewer && (APP.isTrueOwner() || APP.isOwner());

    const desc = r => {
      if (r.opening) return '<b>पिछला बैलेंस</b>' + (r.note && !/Opening Balance/i.test(r.note) ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
      if (isBank) {
        if (r.kind === 'jama') {
          return `<b style="color:#15803d;">🟢 जमा: ${esc(r.note || r.payMode || 'बैंक जमा')}</b>` +
            (r.payId ? `<br><small class="mut">कोड: <b>${esc(r.payId)}</b></small>` : '');
        } else {
          return `<b style="color:#b91c1c;">🔴 कटौती / खर्च: ${esc(r.note || r.vehicle || 'भुगतान')}</b>`;
        }
      }
      if (r.kind === 'udhar') {
        return '<b>' + esc(r.vehicle || '-') + '</b> <span class="chip g" style="font-size:9px;padding:1px 5px;">✔ हिसाब वेरीफाइड</span>' + (r.fuel ? '<br><small class="mut">' + (FUEL[r.fuel] || '') + ' · ' + lit(r.litre) + (num(r.rate) ? ' × ₹' + num(r.rate) : '') + '</small>' : '') + (r.note ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
      }
      if (r.directBankJama || r.mode === 'bank') {
        return `<b style="color:#0369a1;">🏦 सीधे बैंक में जमा (${esc(r.payMode || 'Bank')})</b>` +
          `<br><small class="mut">${esc(r.note || '')}</small>`;
      }
      return '<b>जमा (पंप पर)</b> · ' + esc(MODE[r.mode] || 'नकद') + ' <span class="chip g" style="font-size:9px;padding:1px 5px;">✔ हिसाब वेरीफाइड</span>' + (r.note && !AUTO_NOTES.includes(r.note) ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
    };

    const balDisp = st.close === 0 ? '₹0' : (st.close > 0 ? '-₹' + Math.abs(st.close).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '+₹' + Math.abs(st.close).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
    const balColor = st.close > 0 ? 'var(--r)' : (st.close < 0 ? 'var(--g)' : 'var(--t)');

    const topVisualCard = isBank
      ? await buildBankProfitGraphHtml(p, all)
      : ((APP.cibil && APP.cibil.cardHtml) ? APP.cibil.cardHtml(p, all) : '');

    const wasooliChip = (!isBank && APP.cibil && APP.cibil.wasooliChip) ? APP.cibil.wasooliChip(p, all) : '';
    const showPortalBtn = !isBank && APP.isOwner() && !viewer && APP.portal && APP.portal.openCodeModal;

    main.innerHTML = `
      <div class="btns" style="margin-bottom:10px;flex-wrap:wrap;">
        <button class="btn sm w" id="back">← वापस</button>
        ${(!isBank && APP.isOwner() && !viewer) ? '<button class="btn sm o" id="editP">✏️ पार्टी बदलें</button>' : ''}
        ${(!isBank && canEdit && !p.closed) ? '<button class="btn sm w" id="closeK" style="background:#fef3c7;color:#92400e;border-color:#fde68a;">📦 खाता बंद (हिस्ट्री में भेजें)</button>' : ''}
        ${(!isBank && canEdit && p.closed) ? '<button class="btn sm g" id="reopenK">🔓 खाता दोबारा चालू करें</button>' : ''}
        ${(!isBank && canEdit) ? '<button class="btn sm r" id="delP">🗑️ पार्टी डिलीट</button>' : ''}
        ${canEdit ? '<button class="btn sm w" id="addOB">⚖️ पिछला बैलेंस</button>' : ''}
        ${isBank && !viewer ? `<button class="btn sm g" id="addPumpCash">🏦 पंप कैश बैंक में जमा करें</button>` : ''}
        ${(!isBank && !viewer && !p.closed) ? '<button class="btn sm g" id="addU">+ उधार</button>' : ''}
        ${(!isBank && !viewer && !priv && !p.closed) ? '<button class="btn sm g" id="addJ">+ जमा</button>' : ''}
        ${(!viewer && priv && !p.closed) ? '<button class="btn sm g" id="markPaid" style="background:var(--g)">✅ Paid / वसूली</button>' : ''}
      </div>

      ${p.closed ? `<div class="warn" style="margin-bottom:10px;">📦 यह खाता <b>बंद (History Archive)</b> में है। इसकी सभी पुरानी एंट्रियाँ सुरक्षित हैं।</div>` : ''}

      ${topVisualCard}

      <div class="card" style="padding:12px;">
        <h3 style="margin:0;color:#0b3d91">${isBank ? '🏦 ' : ''}${esc(p.name)} ${wasooliChip}</h3>
        ${isBank
          ? `<p class="mut" style="margin-top:4px">${esc(p.subtitle || 'बैंक खाता लेजर')}</p>`
          : `<p class="mut" style="margin-top:4px">${esc(p.phone || 'फोन नंबर नहीं')} | ${esc((p.vehicles || []).join(', '))}</p>`
        }
        ${(!isBank && ph) ? `<div class="btns" style="margin:6px 0 2px"><a href="tel:${esc(p.phone)}" class="btn sm g">📞 कॉल</a>${wa ? `<a href="https://wa.me/${wa}" target="_blank" class="btn sm g">💬 WhatsApp</a>` : ''}</div>` : ''}
        ${showPortalBtn ? '<button class="btn full" id="portalBtn" style="margin-top:8px;background:#0a7d33;color:#fff">🔑 पोर्टल कोड / भेजें</button>' : ''}

        <div class="ledger-summary">
          <div class="ledger-box debit">
            <span>${isBank ? 'कुल निकासी / खर्च (Dr)' : 'कुल उधार (Dr)'}</span>
            <b>${money(tDr)}</b>
          </div>
          <div class="ledger-box credit">
            <span>${isBank ? 'कुल जमा / आया (Cr)' : 'कुल जमा (Cr)'}</span>
            <b>${money(tCr)}</b>
          </div>
          <div class="ledger-box">
            <span>${isBank ? 'बैंक बैलेंस' : 'असली बैलेंस'}</span>
            <b style="color:${balColor}">${balDisp}</b>
          </div>
        </div>

        ${mism && canEdit ? `<div class="warn" style="margin-top:8px">⚠️ सेव बैलेंस ${money(p.bal)} है, पर एंट्रियों का जोड़ ${money(st.close)}। <button class="btn sm o" id="fixBal" type="button">🔧 ठीक करें</button></div>` : ''}
        <button class="btn full" id="shareStmt" style="margin-top:8px;background:#0b3d91">📄 प्रोफेशनल स्टेटमेंट देखें / भेजें</button>
        ${!isBank && !viewer && st.close > 0 ? `<button class="btn full" id="invoiceBtn" style="margin-top:8px;background:#0a7d33">🧾 Professional Invoice (UPI QR)</button>` : ''}
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="pro-table-wrap">
          <table class="pro-table">
            <thead>
              <tr>
                <th>तारीख</th>
                <th>विवरण</th>
                <th style="text-align:right">${isBank ? 'खर्च/बिल (Dr)' : 'उधार (Dr)'}</th>
                <th style="text-align:right">${isBank ? 'जमा (Cr)' : 'जमा (Cr)'}</th>
                <th style="text-align:right">बैलेंस</th>
                ${canEdit ? '<th style="text-align:center">एक्शन</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${st.rows.length ? st.rows.map(r => `
                <tr>
                  <td class="dt">${dmy(r.date)}<br><small class="mut">${esc(r.time || '')}</small></td>
                  <td>${desc(r)}</td>
                  <td class="dr">${r.kind === 'udhar' ? money(r.amount) : ''}</td>
                  <td class="cr">${r.kind === 'jama' ? money(r.amount) : ''}</td>
                  <td class="bal" style="color:${r.run > 0.005 ? '#c0392b' : r.run < -0.005 ? '#0a7d33' : 'inherit'}">${Math.abs(r.run) < 0.005 ? '₹0' : (r.run > 0 ? '-₹' : '+₹') + Math.abs(r.run).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  ${canEdit ? `
                    <td>
                      <div class="action-btns">
                        ${!isBank ? `<button class="edit" data-edit-row="${r.id}">✏️</button>` : ''}
                        <button class="del" data-del-row="${r.id}">🗑</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('') : `<tr><td colspan="${canEdit ? 6 : 5}" class="mut" style="text-align:center;padding:20px;">कोई एंट्री नहीं है</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;

    $('#back').onclick = () => {
      S.partyView = null;
      if (viewer) return APP.go('v_parties');
      priv ? APP.views.priv() : ledgerView();
    };
    if ($('#editP')) $('#editP').onclick = () => partyModal(p, priv);
    if ($('#delP')) $('#delP').onclick = () => deletePartyEntirely(p, priv);
    if ($('#closeK')) $('#closeK').onclick = () => closeKhataToHistory(p, all, priv);
    if ($('#reopenK')) $('#reopenK').onclick = () => reopenKhataFromHistory(p, priv);
    if ($('#addPumpCash')) $('#addPumpCash').onclick = () => pumpCashToBankModal(today(), id);
    if ($('#addU')) $('#addU').onclick = () => entryModal({ kind: 'udhar', date: today(), partyId: id, priv: priv });
    if ($('#addJ')) $('#addJ').onclick = () => entryModal({ kind: 'jama', date: today(), partyId: id, priv: priv });
    if ($('#markPaid')) $('#markPaid').onclick = () => paidPrivModal(p, priv);
    if (canEdit && $('#addOB')) $('#addOB').onclick = () => openingBalanceModal(id, priv);
    if ($('#portalBtn')) $('#portalBtn').onclick = () => APP.portal.openCodeModal(p, priv);

    $('#shareStmt').onclick = () => APP.sharePartyStatement(id, priv);
    if ($('#invoiceBtn')) $('#invoiceBtn').onclick = () => APP.showInvoiceModal(p, all);

    if (canEdit && $('#fixBal')) $('#fixBal').onclick = async () => {
      if (!confirm('खाते का बैलेंस ' + money(p.bal) + ' से बदलकर ' + money(st.close) + ' (एंट्रियों के जोड़ के बराबर) करें?')) return;
      try {
        if (APP.Rules) APP.Rules.sys = true;
        await APP.commit(db().collection(pcol).doc(id).update({ bal: st.close }));
        if (APP.Rules) APP.Rules.sys = false;
        toast('बैलेंस ठीक हो गया ✔'); S.parties[priv ? 'priv' : 'pub'] = null; partyView(id, priv);
      } catch (e) { if (APP.Rules) APP.Rules.sys = false; toast('नहीं हुआ: ' + e.message); }
    };

    if (canEdit) {
      $$('[data-edit-row]').forEach(b => b.onclick = () => {
        const row = all.find(x => x.id === b.dataset.editRow);
        if (row) entryModal({ entry: row, date: row.date, priv: priv });
      });
      $$('[data-del-row]').forEach(b => b.onclick = async () => {
        const row = all.find(x => x.id === b.dataset.delRow);
        if (!row) return;
        if (!priv && !isBank && await APP.dayIsLocked(row.date)) return toast('❌ यह तारीख लॉक है');
        if (!confirm('क्या आप सच में इस एंट्री को हटाना चाहते हैं?\n\n' + dmy(row.date) + ' · ' + money(row.amount) + '\n(हटाने पर उस दिन का हिसाब और आगे की चेन अपने-आप अपडेट हो जाएगी)')) return;
        b.disabled = true;
        try {
          if (APP.Rules) APP.Rules.sys = true;
          const b2 = db().batch();
          b2.delete(db().collection(col).doc(row.id));
          const delta = -sigEntry(priv, row);
          if (delta) b2.update(db().collection(pcol).doc(row.partyId), { bal: FV().increment(delta) });
          await APP.commit(b2.commit());
          if (!priv) await recalculateAllDaysChain();
          if (APP.Rules) APP.Rules.sys = false;
          toast('एंट्री हटा दी गई व हिसाब चेन अपडेट हो गई ✔');
          S.parties[priv ? 'priv' : 'pub'] = null;
          partyView(id, priv);
        } catch (e) { if (APP.Rules) APP.Rules.sys = false; b.disabled = false; toast('नहीं हटा: ' + e.message); }
      });
    }
  }
  APP.partyView = partyView;

  async function paidPrivModal(p, priv) {
    const bal = num(p.bal);
    if (bal <= 0) return toast('कोई बकाया नहीं है');
    const m = modal(`<h3>✅ Paid / वसूली - ${esc(p.name)}</h3>
      <div class="kv"><span>कुल बकाया</span><b class="neg">${money(bal)}</b></div>
      <label>कितना पैसा मिला? (₹)</label><input id="pd-amt" inputmode="decimal" value="${bal}">
      <label>कैसे मिला?</label>
      <select id="pd-mode">
        <option value="cash">नकद (Cash)</option>
        <option value="paytm">Paytm / UPI</option>
      </select>
      <div class="btns" style="margin-top:12px">
        <button class="btn g" id="pd-sv">✅ सेव करें</button>
        <button class="btn w" id="pd-cl">रद्द</button>
      </div>
    `);
    $('#pd-cl', m).onclick = () => m.close();
    $('#pd-sv', m).onclick = async () => {
      const amt = num($('#pd-amt', m).value);
      const mode = $('#pd-mode', m).value;
      if (!(amt > 0)) return toast('रकम डालें');
      const data = {
        partyId: p.id, partyName: p.name, date: today(), time: nowTime(),
        kind: 'jama', mode: mode, amount: amt, note: 'Paid / वसूली',
        by: S.user.email, at: FV().serverTimestamp(), status: 'paid'
      };
      try {
        const b = db().batch();
        b.set(db().collection('priv_ledger').doc(), data);
        b.update(db().collection('priv_parties').doc(p.id), { bal: FV().increment(-amt) });
        await APP.commit(b.commit());
        m.close(); toast('पैसा जमा हो गया ✔');
        partyView(p.id, priv);
      } catch (e) { toast('एरर: ' + e.message); }
    };
  }

  function openingBalanceModal(partyId, priv) {
    const m = modal(`<h3>⚖️ पिछला बैलेंस (Opening Balance)</h3>
      <label>तारीख (जिस दिन से ऐप में हिसाब शुरू)</label><input type="date" id="ob-date" value="${today().slice(0, 8)}01">
      ${priv ? '' : '<label>किस तरह का बैलेंस?</label><select id="ob-type"><option value="due">हमें लेना है (बकाया / Debit)</option><option value="adv">जमा / एडवांस (Credit)</option></select>'}
      <label>रकम (₹)</label><input id="ob-amt" inputmode="decimal">
      <label>नोट</label><input id="ob-note" value="पिछले हिसाब का बैलेंस (Opening Balance)">
      <div class="btns"><button class="btn g" id="ob-save">सेव</button><button class="btn w" id="ob-cancel">रद्द</button></div>`);
    $('#ob-cancel', m).onclick = () => m.close();
    $('#ob-save', m).onclick = async () => {
      const amt = num($('#ob-amt', m).value);
      if (!amt) return toast('रकम भरें');
      const date = $('#ob-date', m).value;
      const note = $('#ob-note', m).value;
      const pObj = APP.partyById(priv, partyId) || { name: partyId };

      const data = {
        partyId, partyName: pObj.name,
        date, time: '00:00', opening: true, hisabVerified: true,
        kind: (!priv && $('#ob-type', m).value === 'adv') ? 'jama' : 'udhar',
        ...((!priv && $('#ob-type', m).value === 'adv') ? { mode: 'cash' } : {}),
        vehicle: '', fuel: '', rate: 0, litre: 0,
        amount: amt, note, createdOn: today(), by: S.user.email, at: FV().serverTimestamp()
      };
      if (priv) data.status = 'pending';

      try {
        if (APP.Rules) APP.Rules.sys = true;
        const b = db().batch();
        const ref = db().collection(priv ? 'priv_ledger' : 'ledger').doc();
        b.set(ref, data);
        const newSig = sigEntry(priv, data);
        b.update(db().collection(priv ? 'priv_parties' : 'parties').doc(partyId), { bal: FV().increment(newSig) });
        await b.commit();
        if (APP.Rules) APP.Rules.sys = false;
        m.close(); toast('सेव हो गया ✔');
        S.parties[priv ? 'priv' : 'pub'] = null;
        partyView(partyId, priv);
      } catch (e) { if (APP.Rules) APP.Rules.sys = false; toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  console.log('[Mazda V2 app_ledger.js] Loaded with Mandatory Hisab Verification, Close-to-History & Chain Recalc');
})();
