/* Mazda Oil Company - Manager Desk (Cash Reconciliation & Galla) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = APP.db, FV = APP.FV;
  const today = () => APP.todayISO();
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  APP.views.manager_desk = async function () {
    if (APP.isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">मैनेजर डेस्क लोड हो रहा है…</p>';

    const date = today();
    let daySnap, gallaSnap, ledgerSnap, privSnap;
    
    try {
      const [ds, gs, ls, ps] = await Promise.all([
        db.collection('days').doc(date).get(),
        db.collection('cash_galla').where('date', '==', date).get().catch(() => ({ docs: [] })),
        db.collection('ledger').where('date', '==', date).get(),
        db.collection('priv_ledger').where('date', '==', date).get().catch(() => ({ docs: [] }))
      ]);
      daySnap = ds; gallaSnap = gs; ledgerSnap = ls; privSnap = ps;
    } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const d = daySnap.exists ? daySnap.data() : {};
    const rows = ledgerSnap.docs.map(x => ({ id: x.id, ...x.data() }));
    const privRows = privSnap.docs.map(x => ({ id: x.id, ...x.data() }));

    // 1. Base AD & Opening Meter Readings (From Main Hisab)
    const ad = num(d.openCash);
    const openNz = d.nz || {};

    // 2. Calculations for the day
    const o = K.compute(d, rows.filter(r => !K.isOpening(r)));

    // Galla Data
    let physicalCash = 0, lastSaved = 'कोई नहीं';
    if (!gallaSnap.empty) {
      const gData = gallaSnap.docs[0].data();
      physicalCash = num(gData.total);
      lastSaved = gData.time;
    }

    // Cash In / Out (Manual entries via Manager Desk)
    // For simplicity, we calculate what SHOULD be in the galla.
    const expectedCash = r2(ad + o.sale - o.udhar - o.totalKharcha - num(d.malikDiya));
    const diff = r2(physicalCash - expectedCash);

    main.innerHTML = `
      <div class="card" style="background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff">
        <h3 style="color:#fff;margin:0">💼 मैनेजर डेस्क</h3>
        <div style="font-size:12px;opacity:.85;margin-top:4px">आज: ${dmy(date)} · AD: ${money(ad)}</div>
      </div>

      <div class="card">
        <h3>💰 गल्ला (Cash Reconciliation)</h3>
        ${kv('AD (Subah ka cash)', money(ad))}
        ${kv('+ आज की सेल', money(o.sale))}
        ${kv('- आज का उधार', money(o.udhar))}
        ${kv('- खर्चा (DG/चाय/अन्य)', money(o.totalKharcha))}
        ${kv('- बैंक/मालिक को दिया', money(d.malikDiya))}
        <div class="kv" style="border:0; border-top:2px solid #ddd; margin-top:8px; padding-top:8px;">
          <span style="font-weight:bold; font-size:15px;">होना चाहिए (Expected)</span>
          <b style="font-size:18px; color:#0b3d91;">${money(expectedCash)}</b>
        </div>
        
        <div class="kv" style="border:0; background:#f0f0f0; padding:8px; border-radius:8px; margin-top:8px;">
          <span style="font-weight:bold;">अभी गल्ले में (Actual)</span>
          <b style="font-size:18px; color:${diff === 0 ? 'var(--g)' : 'var(--r)'}">${money(physicalCash)}</b>
        </div>
        ${physicalCash > 0 ? `
        <div class="kv" style="border:0">
          <span>फर्क (Difference)</span>
          <b class="${diff === 0 ? 'pos' : (diff > 0 ? 'pos' : 'neg')}" style="font-size:18px;">${diff > 0 ? '+' : ''}${money(diff)}</b>
        </div>
        ${diff !== 0 ? `<div class="warn" style="font-size:12px;margin-top:4px">${diff > 0 ? 'गल्ले में ज्यादा कैश है।' : 'गल्ले में कैश कम है।'} (Last saved: ${lastSaved})</div>` : ''}
        ` : ''}
        
        <div class="btns"><button class="btn g" id="md-galla">💵 गल्ला गिनें / अपडेट करें</button></div>
      </div>

      <div class="card">
        <h3>⛽ मीटर रीडिंग (Current)</h3>
        <div class="mut" style="font-size:12px;margin-bottom:8px;">नई सेल अपडेट करने के लिए आज की क्लोज़िंग डालें</div>
        <div class="row">
          <div><label>P1</label><input class="md-nz" data-k="p1" inputmode="decimal" value="${esc((d.nz && d.nz['p1'] && d.nz['p1'].c) || '')}"></div>
          <div><label>P2</label><input class="md-nz" data-k="p2" inputmode="decimal" value="${esc((d.nz && d.nz['p2'] && d.nz['p2'].c) || '')}"></div>
          <div><label>P3</label><input class="md-nz" data-k="p3" inputmode="decimal" value="${esc((d.nz && d.nz['p3'] && d.nz['p3'].c) || '')}"></div>
          <div><label>P4</label><input class="md-nz" data-k="p4" inputmode="decimal" value="${esc((d.nz && d.nz['p4'] && d.nz['p4'].c) || '')}"></div>
        </div>
        <div class="row" style="margin-top:8px">
          <div><label>D1</label><input class="md-nz" data-k="d1" inputmode="decimal" value="${esc((d.nz && d.nz['d1'] && d.nz['d1'].c) || '')}"></div>
          <div><label>D2</label><input class="md-nz" data-k="d2" inputmode="decimal" value="${esc((d.nz && d.nz['d2'] && d.nz['d2'].c) || '')}"></div>
          <div><label>D3</label><input class="md-nz" data-k="d3" inputmode="decimal" value="${esc((d.nz && d.nz['d3'] && d.nz['d3'].c) || '')}"></div>
          <div><label>D4</label><input class="md-nz" data-k="d4" inputmode="decimal" value="${esc((d.nz && d.nz['d4'] && d.nz['d4'].c) || '')}"></div>
        </div>
        <div class="btns" style="margin-top:10px"><button class="btn o" id="md-save-nz">💾 सेल अपडेट करें</button></div>
      </div>

      <div class="card">
        <h3>💸 कैश गया (Cash Out)</h3>
        ${kv('आज का खर्चा (DG/चाय)', money(o.totalKharcha))}
        ${kv('निजी उधार दिया', money(privRows.filter(r=>r.kind==='udhar').reduce((a,b)=>a+num(b.amount),0)))}
        ${kv('बैंक जमा', money(d.malikDiya))}
        <div class="btns">
          <button class="btn w" id="md-add-exp">+ खर्चा</button>
          <button class="btn w" id="md-add-priv">+ निजी उधार</button>
          <button class="btn w" id="md-add-bank">+ बैंक जमा</button>
        </div>
      </div>

      <div class="card">
        <h3>📥 कैश आया (Cash In)</h3>
        ${kv('पार्टी जमा (आज)', money(o.jCash))}
        <div class="btns">
          <button class="btn w" id="md-add-jama">+ पार्टी जमा</button>
        </div>
      </div>
    `;

    // --- EVENT LISTENERS ---

    // 1. Galla Counter Modal
    $('#md-galla').onclick = () => openGallaModal(expectedCash, date);

    // 2. Update Meter Reading
    $('#md-save-nz').onclick = async () => {
      const btn = $('#md-save-nz'); btn.disabled = true;
      const nzData = {};
      $$('.md-nz').forEach(inp => {
        const k = inp.dataset.k;
        if(inp.value) {
          nzData[`nz.${k}.c`] = num(inp.value);
        }
      });
      try {
        await db.collection('days').doc(date).set(nzData, { merge: true });
        toast('मीटर रीडिंग अपडेट ✔');
        APP.views.manager_desk();
      } catch(e) { btn.disabled = false; toast('एरर: ' + e.message); }
    };

    // 3. Add Expense
    $('#md-add-exp').onclick = () => {
      const m = modal(`
        <h3>खर्चा जोड़ें</h3>
        <label>किस चीज़ का?</label><input id="ex-lbl" placeholder="जैसे: चाय, DG">
        <label>रकम (₹)</label><input id="ex-amt" inputmode="decimal">
        <div class="btns"><button class="btn g" id="ex-sv">सेव</button><button class="btn w" id="ex-cl">रद्द</button></div>
      `);
      $('#ex-cl', m).onclick = () => m.close();
      $('#ex-sv', m).onclick = async () => {
        const lbl = $('#ex-lbl', m).value.trim();
        const amt = num($('#ex-amt', m).value);
        if(!lbl || !amt) return toast('नाम और रकम दोनों डालें');
        try {
          const dayRef = db.collection('days').doc(date);
          const snap = await dayRef.get();
          let items = (snap.exists && snap.data().kharchaItems) ? snap.data().kharchaItems : [];
          items.push({ label: lbl, amount: amt });
          await dayRef.set({ kharchaItems: items }, { merge: true });
          m.close(); toast('खर्चा जुड़ गया ✔'); APP.views.manager_desk();
        } catch(e) { toast('एरर: ' + e.message); }
      };
    };

    // 4. Add Niji Udhar
    $('#md-add-priv').onclick = () => {
      const m = modal(`
        <h3>निजी उधार दिया</h3>
        <label>किसको दिया? (नाम)</label><input id="pv-name">
        <label>रकम (₹)</label><input id="pv-amt" inputmode="decimal">
        <div class="btns"><button class="btn g" id="pv-sv">सेव</button><button class="btn w" id="pv-cl">रद्द</button></div>
      `);
      $('#pv-cl', m).onclick = () => m.close();
      $('#pv-sv', m).onclick = async () => {
        const name = $('#pv-name', m).value.trim();
        const amt = num($('#pv-amt', m).value);
        if(!name || !amt) return toast('नाम और रकम दोनों डालें');
        try {
          // Find or create party
          let ps = await db.collection('priv_parties').where('name', '==', name).get();
          let pid = ps.empty ? db.collection('priv_parties').doc().id : ps.docs[0].id;
          
          const b = db.batch();
          if(ps.empty) b.set(db.collection('priv_parties').doc(pid), { name: name, bal: amt, createdAt: FV.serverTimestamp() });
          else b.update(db.collection('priv_parties').doc(pid), { bal: FV.increment(amt) });

          b.set(db.collection('priv_ledger').doc(), {
            partyId: pid, partyName: name, date: date, time: APP.nowTime(),
            kind: 'udhar', amount: amt, note: 'Manager Desk से दिया', by: S.user.email, at: FV.serverTimestamp()
          });
          await b.commit();
          m.close(); toast('निजी उधार जुड़ गया ✔'); APP.views.manager_desk();
        } catch(e) { toast('एरर: ' + e.message); }
      };
    };

    // 5. Add Bank Deposit
    $('#md-add-bank').onclick = () => {
      const m = modal(`
        <h3>बैंक जमा</h3>
        <label>रकम (₹)</label><input id="bn-amt" inputmode="decimal" placeholder="गल्ले से निकालकर">
        <div class="btns"><button class="btn g" id="bn-sv">जमा करें</button><button class="btn w" id="bn-cl">रद्द</button></div>
      `);
      $('#bn-cl', m).onclick = () => m.close();
      $('#bn-sv', m).onclick = async () => {
        const amt = num($('#bn-amt', m).value);
        if (!amt) return toast('रकम डालें');
        try {
          const b = db.batch();
          b.set(db.collection('bank_deposits').doc(), {
            bank: 'SBI', date: date, amount: amt, mode: 'cash', note: 'Manager Desk से जमा',
            by: S.user.email, at: FV.serverTimestamp()
          });
          b.set(db.collection('days').doc(date), { malikDiya: FV.increment(amt) }, { merge: true });
          await b.commit();
          m.close(); toast('बैंक में जमा हो गया ✔'); APP.views.manager_desk();
        } catch(e) { toast('एरर: ' + e.message); }
      };
    };

    // 6. Add Party Jama (Cash In)
    $('#md-add-jama').onclick = () => {
      const m = modal(`
        <h3>पार्टी जमा (Cash In)</h3>
        <label>पार्टी का नाम</label><input id="jm-name">
        <label>रकम (₹)</label><input id="jm-amt" inputmode="decimal">
        <div class="btns"><button class="btn g" id="jm-sv">सेव</button><button class="btn w" id="jm-cl">रद्द</button></div>
      `);
      $('#jm-cl', m).onclick = () => m.close();
      $('#jm-sv', m).onclick = async () => {
        const name = $('#jm-name', m).value.trim();
        const amt = num($('#jm-amt', m).value);
        if(!name || !amt) return toast('नाम और रकम दोनों डालें');
        try {
          let ps = await db.collection('parties').where('name', '==', name).get();
          if(ps.empty) return toast('यह पार्टी मुख्य खाते में नहीं है');
          const pid = ps.docs[0].id;
          
          const b = db.batch();
          b.set(db.collection('ledger').doc(), {
            partyId: pid, partyName: name, date: date, time: APP.nowTime(),
            kind: 'jama', mode: 'cash', amount: amt, note: 'Manager Desk से जमा', 
            by: S.user.email, at: FV.serverTimestamp()
          });
          b.update(db.collection('parties').doc(pid), { bal: FV.increment(-amt) });
          await b.commit();
          m.close(); toast('पार्टी जमा जुड़ गया ✔'); APP.views.manager_desk();
        } catch(e) { toast('एरर: ' + e.message); }
      };
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
        await db.collection('cash_galla').add({
          date: date, total: tot, breakdown: breakdown, expected: expectedCash,
          time: APP.nowTime(), by: S.user.email, at: FV.serverTimestamp()
        });
        m.close(); toast('गल्ला सेव हो गया ✔'); APP.views.manager_desk();
      } catch (e) { $('#galla-sv', m).disabled = false; toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  console.log('[Mazda manager_desk.js] NEW LOGIC loaded ✓');
})();
