/* Mazda Oil Company - Manager Desk (Cash Control, Galla, Udhar) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db, FV = () => APP.FV;
  const today = () => APP.todayISO();
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  APP.views.manager_desk = async function () {
    if (APP.isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">मैनेजर डेस्क लोड हो रहा है…</p>';

    const date = today();
    let daySnap, ledgerSnap, parties, gallaSnap, smCashSnap, smShiftsSnap;
    
    try {
      const [ds, ls, ps, gs, cs, ss] = await Promise.all([
        db().collection('days').doc(date).get(),
        db().collection('ledger').where('date', '==', date).get(),
        APP.getParties(false, true),
        db().collection('cash_galla').where('date', '==', date).get().catch(() => ({ docs: [] })),
        db().collection('cash_submissions').where('date', '==', date).get().catch(() => ({ docs: [] })),
        db().collection('sm_shifts').where('date', '==', date).get().catch(() => ({ docs: [] }))
      ]);
      daySnap = ds; ledgerSnap = ls; parties = ps; gallaSnap = gs; smCashSnap = cs; smShiftsSnap = ss;
    } catch (e) {
      main.innerHTML = APP.errBox(e); return;
    }

    const d = daySnap.exists ? daySnap.data() : {};
    const rows = ledgerSnap.docs.map(x => ({ id: x.id, ...x.data() }));
    const o = K.compute(d, rows.filter(r => !K.isOpening(r)));

    // Galla calculation
    let physicalCash = 0;
    let lastSaved = 'कोई नहीं';
    if (!gallaSnap.empty) {
      const gData = gallaSnap.docs[0].data();
      physicalCash = num(gData.total);
      lastSaved = gData.time;
    }

    // What SHOULD be in the galla (Expected Cash)
    // AD + Sales - (Paytm + Swipe + Udhar + Kharcha + Bank/Owner)
    const ad = num(d.openCash);
    const gallaOut = num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya);
    const expectedCash = r2(ad + o.sale - gallaOut);
    const diff = r2(physicalCash - expectedCash);

    // Salesman cash pending
    const smCash = smCashSnap.docs.map(x => ({ id: x.id, ...x.data() })).filter(c => c.status === 'pending');

    main.innerHTML = `
      <div class="card" style="background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff">
        <h3 style="color:#fff;margin:0">💼 मैनेजर डेस्क</h3>
        <div style="font-size:12px;opacity:.85;margin-top:4px">आज: ${dmy(date)}</div>
      </div>

      <div class="card">
        <h3>💰 गल्ला (Cash Box)</h3>
        ${kv('आज की AD (Subah ka cash)', money(ad))}
        ${kv('होना चाहिए (Expected)', money(expectedCash))}
        ${kv('अभी गल्ले में (गिनकर)', money(physicalCash), 'big')}
        <div class="kv" style="border:0;padding-bottom:0">
          <span>फर्क (अंतर)</span>
          <b class="${diff === 0 ? 'pos' : (diff > 0 ? 'pos' : 'neg')}">${diff > 0 ? '+' : ''}${money(diff)}</b>
        </div>
        ${diff !== 0 && physicalCash > 0 ? `<div class="warn" style="margin-top:6px;font-size:12px">${diff > 0 ? '⚠️ गल्ले में पैसे ज्यादा हैं।' : '⚠️ गल्ले में पैसे कम हैं।'} (Last saved: ${lastSaved})</div>` : ''}
        <div class="btns"><button class="btn g" id="md-galla">💵 गल्ला गिनें / अपडेट करें</button></div>
      </div>

      <div class="card">
        <h3>🛢️ आज की बिक्री & खर्चा</h3>
        ${kv('पेट्रोल बिक्री', lit(o.litP))}
        ${kv('डीज़ल बिक्री', lit(o.litD))}
        ${kv('कुल बिक्री', money(o.sale), 'big')}
        ${kv('Paytm / Swipe', money(num(d.paytm) + num(d.swipe)))}
        ${kv('कुल खर्चा', money(o.totalKharcha), 'neg')}
        <div class="btns">
          <button class="btn o" id="md-kharcha">+ खर्चा जोड़ें</button>
          <button class="btn w" id="md-bank">🏦 बैंक जमा</button>
        </div>
      </div>

      <div class="card">
        <h3>🚚 उधार (Udhar)</h3>
        <div class="row" style="gap:8px">
          <button class="btn g" id="md-udhar-inside" style="flex:1">आज का उधार</button>
          <button class="btn o" id="md-udhar-outside" style="flex:1">बाहर का उधार</button>
        </div>
        ${kv('आज कुल उधार दिया', money(o.udhar), 'neg')}
      </div>

      <div class="card">
        <h3>🧑‍💼 सेल्समैन का हिसाब</h3>
        ${smCash.length ? smCash.map(c => `
          <div class="item">
            <div class="a"><b>${esc(c.salesmanName)}</b><small>कैश दिया: ${money(c.total)}</small></div>
            <button class="btn sm g" data-approve-sm="${c.id}">✔ मिल गया</button>
          </div>
        `).join('') : '<p class="mut">कोई पेंडिंग कैश नहीं है।</p>'}
        <div class="btns"><button class="btn w" id="md-sm-hist">📜 सेल्समैन हिस्ट्री देखें</button></div>
      </div>
    `;

    // --- EVENT LISTENERS ---

    // 1. Galla Counter Modal
    $('#md-galla').onclick = () => openGallaModal(expectedCash, date);

    // 2. Add Kharcha Modal
    $('#md-kharcha').onclick = () => {
      if (APP.expEditor) {
        APP.expEditor({
          title: 'आज का खर्चा जोड़ें',
          lines: [{ cat: 'other', label: '', amount: '' }],
          onOk: async (lines) => {
            const b = db().batch();
            const dayRef = db().collection('days').doc(date);
            let newItems = (d.kharchaItems || []);
            lines.forEach(l => {
               if (l.cat === 'kharcha') b.update(dayRef, { kharcha: FV().increment(l.amount) });
               else if (l.cat === 'driverInaam') b.update(dayRef, { driverInaam: FV().increment(l.amount) });
               else if (l.cat === 'chaiKhana') b.update(dayRef, { chaiKhana: FV().increment(l.amount) });
               else newItems.push({ label: l.label, amount: l.amount });
            });
            if (lines.some(l => l.cat === 'other')) b.update(dayRef, { kharchaItems: newItems });
            try { await b.commit(); toast('खर्चा जुड़ गया ✔'); APP.views.manager_desk(); } catch(e) { toast('एरर'); }
          }
        });
      }
    };

    // 3. Bank Deposit
    $('#md-bank').onclick = () => {
      const m = modal(`
        <h3>🏦 बैंक जमा</h3>
        <label>रकम (₹)</label><input id="bd-amt" inputmode="decimal" placeholder="गल्ले से निकालकर">
        <div class="mut" style="font-size:12px;margin-top:6px">ये रकम गल्ले से कट जाएगी और बैंक में जुड़ जाएगी।</div>
        <div class="btns" style="margin-top:10px"><button class="btn g" id="bd-sv">जमा करें</button><button class="btn w" id="bd-cl">रद्द</button></div>
      `);
      $('#bd-cl', m).onclick = () => m.close();
      $('#bd-sv', m).onclick = async () => {
        const amt = num($('#bd-amt', m).value);
        if (!amt) return toast('रकम डालें');
        try {
          await db().collection('bank_deposits').add({
            bank: 'SBI', date: date, amount: amt, mode: 'cash', note: 'Manager Desk से जमा',
            by: S.user.email, at: FV().serverTimestamp()
          });
          // Also add to Day's malikDiya (so it deducts from expected cash)
          await db().collection('days').doc(date).update({ malikDiya: FV().increment(amt) });
          m.close(); toast('बैंक में जमा हो गया ✔'); APP.views.manager_desk();
        } catch(e) { toast('एरर: ' + e.message); }
      };
    };

    // 4. Udhar (Inside)
    $('#md-udhar-inside').onclick = () => openUdharModal('inside', date, parties);

    // 5. Udhar (Outside)
    $('#md-udhar-outside').onclick = () => openUdharModal('outside', date, parties);

    // 6. Approve Salesman Cash
    $$('[data-approve-sm]').forEach(b => b.onclick = async () => {
      if (!confirm('कैश गिन लिया? अप्रूव करने पर ये सेल्समैन के खाते में चला जाएगा।')) return;
      b.disabled = true;
      try {
        await db().collection('cash_submissions').doc(b.dataset.approveSm).update({ status: 'approved', approvedBy: S.user.email, approvedAt: FV().serverTimestamp() });
        toast('कैश अप्रूव हो गया ✔'); APP.views.manager_desk();
      } catch(e) { b.disabled = false; toast('एरर: ' + e.message); }
    });

    // 7. Salesman History
    $('#md-sm-hist').onclick = () => {
      const shifts = smShiftsSnap.docs.map(x => ({id: x.id, ...x.data()}));
      let html = '<h3>📜 सेल्समैन हिस्ट्री (आज)</h3>';
      if (!shifts.length) html += '<p class="mut">आज किसी सेल्समैन की शिफ्ट नहीं है।</p>';
      else {
        html += shifts.map(s => `
          <div class="item">
            <div class="a"><b>${esc(s.name)}</b><small>मीटर: ${s.nz ? Object.keys(s.nz).join(', ').toUpperCase() : ''}</small><small>बिक्री: ${money((s.sum || {}).sale)}</small></div>
          </div>
        `).join('');
      }
      const m = modal(html + '<div class="btns" style="margin-top:12px"><button class="btn w" id="smh-cl">बंद</button></div>');
      $('#smh-cl', m).onclick = () => m.close();
    };
  };

  /* ================== GALLA COUNTER MODAL ================== */
  function openGallaModal(expectedCash, date) {
    const notes = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    let html = `<h3>💵 गल्ला काउंटर</h3>
      <div class="mut" style="margin-bottom:10px;font-size:13px">नोटों की गिनती डालें:</div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;" id="note-grid">
        ${notes.map(n => `
          <div style="background:#f8f9fc;border:1px solid #dde2ec;border-radius:8px;padding:8px;text-align:center">
            <div style="font-size:11px;color:#555">₹${n}</div>
            <input type="number" class="galla-inp" data-v="${n}" placeholder="0" style="text-align:center;padding:6px;margin-top:4px;font-size:15px;width:100%;border:1px solid #ccc;border-radius:4px;">
          </div>
        `).join('')}
      </div>
      <div class="kv" style="margin-top:12px;border-bottom:2px solid #0b3d91">
        <span>कुल असली कैश</span>
        <b id="galla-total" style="font-size:20px;color:#0b3d91">₹0</b>
      </div>
      <div class="kv">
        <span>होना चाहिए (Expected)</span>
        <b>${money(expectedCash)}</b>
      </div>
      <div class="kv" style="border:0">
        <span>फर्क (अंतर)</span>
        <b id="galla-diff" style="font-size:18px"></b>
      </div>
      <div class="btns" style="margin-top:12px">
        <button class="btn g" id="galla-sv">✅ गल्ला सेव करें</button>
        <button class="btn w" id="galla-cl">रद्द</button>
      </div>
    `;
    const m = modal(html);

    const calc = () => {
      let tot = 0;
      $$('.galla-inp', m).forEach(inp => { tot += (num(inp.value) * num(inp.dataset.v)); });
      $('#galla-total', m).textContent = money(tot);
      
      const diff = r2(tot - expectedCash);
      const dEl = $('#galla-diff', m);
      if (tot === 0) { dEl.textContent = '—'; dEl.className = 'mut'; }
      else if (diff === 0) { dEl.textContent = '✔ बराबर है'; dEl.className = 'pos'; }
      else { dEl.textContent = (diff > 0 ? '+' : '') + money(diff); dEl.className = diff > 0 ? 'pos' : 'neg'; }
    };

    $$('.galla-inp', m).forEach(inp => inp.addEventListener('input', calc));
    $('#galla-cl', m).onclick = () => m.close();

    $('#galla-sv', m).onclick = async () => {
      let tot = 0, breakdown = {};
      $$('.galla-inp', m).forEach(inp => { 
        const count = num(inp.value);
        if (count > 0) { tot += (count * num(inp.dataset.v)); breakdown[inp.dataset.v] = count; }
      });
      if (tot === 0) return toast('कम से कम एक नोट डालें');

      $('#galla-sv', m).disabled = true;
      try {
        await db().collection('cash_galla').add({
          date: date, total: tot, breakdown: breakdown, expected: expectedCash,
          time: APP.nowTime(), by: S.user.email, at: FV().serverTimestamp()
        });
        m.close(); toast('गल्ला सेव हो गया ✔'); APP.views.manager_desk();
      } catch (e) { $('#galla-sv', m).disabled = false; toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  /* ================== UDHAR MODAL ================== */
  async function openUdharModal(type, date, parties) {
    let list = [];
    if (type === 'inside') {
      // Fetch today's udhar
      const snap = await db().collection('ledger').where('date', '==', date).where('kind', '==', 'udhar').get();
      list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      // Fetch old pending udhar (parties with bal > 0)
      list = parties.filter(p => num(p.bal) > 0).map(p => ({
        id: p.id, // partyId
        partyName: p.name,
        amount: p.bal,
        isOld: true
      }));
    }

    if (!list.length) return toast('कोई उधार नहीं मिला');

    let html = `<h3>${type === 'inside' ? 'आज का उधार' : 'बाहर का उधार (Pending)'}</h3>
      <div style="max-height:50vh; overflow-y:auto; margin-bottom:12px">
        ${list.map(x => `
          <div class="item">
            <div class="a"><b>${esc(x.partyName)}</b><small>${x.vehicle ? esc(x.vehicle) + ' · ' : ''}${x.time || ''}</small></div>
            <div style="text-align:right">
              <b class="neg">${money(x.amount)}</b><br>
              <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin-top:4px;color:var(--g);font-weight:bold;">
                <input type="checkbox" class="udhar-check" value="${x.id}" data-amt="${x.amount}" data-pid="${x.partyId || x.id}"> Paid
              </label>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="kv"><span>चुनी हुई रकम</span><b id="udhar-sel-tot" class="pos">₹0</b></div>
      <label>कैसे जमा हुआ?</label>
      <select id="udhar-mode">
        <option value="cash">नकद (Cash)</option>
        <option value="paytm">Paytm/UPI</option>
        <option value="swipe">स्वाइप (Card)</option>
        <option value="bank">बैंक</option>
      </select>
      <div class="btns" style="margin-top:12px">
        <button class="btn g" id="udhar-sv">✅ जमा करें (Paid)</button>
        <button class="btn w" id="udhar-cl">रद्द</button>
      </div>
    `;
    const m = modal(html);

    const calcSel = () => {
      let tot = 0;
      $$('.udhar-check:checked', m).forEach(c => { tot += num(c.dataset.amt); });
      $('#udhar-sel-tot', m).textContent = money(tot);
    };
    $$('.udhar-check', m).forEach(c => c.addEventListener('change', calcSel));
    $('#udhar-cl', m).onclick = () => m.close();

    $('#udhar-sv', m).onclick = async () => {
      const checked = $$('.udhar-check:checked', m);
      if (!checked.length) return toast('कम से कम एक उधार चुनें');
      const mode = $('#udhar-mode', m).value;
      
      $('#udhar-sv', m).disabled = true;
      const b = db().batch();
      
      try {
        for (const c of checked) {
          const amt = num(c.dataset.amt);
          const partyId = c.dataset.pid;
          
          if (type === 'inside') {
            const entryId = c.value;
            // Update existing entry to reflect payment (optional, or just create a new jama entry)
            // Better to create a new jama entry so history is clean
            const party = parties.find(p => p.id === partyId);
            b.set(db().collection('ledger').doc(), {
              partyId: partyId, partyName: party ? party.name : 'Unknown',
              date: date, time: APP.nowTime(), kind: 'jama', mode: mode, amount: amt,
              note: 'Manager Desk से Paid (Inside)', by: S.user.email, at: FV().serverTimestamp()
            });
            b.update(db().collection('parties').doc(partyId), { bal: FV().increment(-amt) });
          } else {
            // Outside: Party bal is already > 0, we just create a Jama entry
            const party = parties.find(p => p.id === partyId);
            b.set(db().collection('ledger').doc(), {
              partyId: partyId, partyName: party ? party.name : 'Unknown',
              date: date, time: APP.nowTime(), kind: 'jama', mode: mode, amount: amt,
              note: 'Manager Desk से Paid (Outside)', by: S.user.email, at: FV().serverTimestamp()
            });
            b.update(db().collection('parties').doc(partyId), { bal: FV().increment(-amt) });
          }
        }
        await b.commit();
        m.close(); toast('उधार जमा हो गया ✔'); APP.views.manager_desk();
      } catch (e) { $('#udhar-sv', m).disabled = false; toast('एरर: ' + e.message); }
    };
  }

  console.log('[Mazda manager_desk.js] loaded ✓');
})();
