/* Mazda Oil Company - Views Core (Gaadi Cash, Stock, Niji Udhar) */
(function () {
  'use strict';
  const APP = window.APP || {};
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const r2 = (n) => (K && K.r2 ? K.r2(n) : Number(n || 0).toFixed(2));
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db, FV = () => APP.FV;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  APP.views = APP.views || {};

  const MOC_BPCL_LOGO = `<img src="./logo.png" alt="" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 6px auto;border-radius:50%">`;

  /* ======================= GAADI CASH ======================= */
  APP.views.gaadicash = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">गाड़ी कैश लोड हो रहा है…</p>';
    let snap, pSnap;
    try { [snap, pSnap] = await Promise.all([db().collection('gaadi_cash').orderBy('date', 'desc').limit(40).get(), db().collection('gaadi_cash').where('status', '==', 'pending').get()]); } catch (e) { snap = { docs: [] }; pSnap = { docs: [] }; }
    const seen = {}, list = [];
    pSnap.docs.concat(snap.docs).forEach(d => { if (!seen[d.id]) { seen[d.id] = 1; list.push({ id: d.id, ...d.data() }); } });
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const totPending = pSnap.docs.reduce((a, d) => a + num(d.data().amount), 0);
    const LOCAL_GC = 'लोकल / बिना पार्टी (गाड़ी कैश)';

    main.innerHTML = `
      <div class="card"><div class="kv"><span>कुल बाकी गाड़ी कैश</span><b class="neg">${money(totPending)}</b></div></div>
      <div class="btns" style="margin-bottom:12px"><button class="btn o" id="gc-add">+ नया गाड़ी कैश दें</button></div>
      <div class="card">
        ${list.length ? list.map(item => `
          <div class="item">
            <div class="a"><b>${esc(item.vehicle)} · ${esc(item.partyName || 'लोकल')}</b><small>${dmy(item.date)}</small></div>
            <div style="text-align:right"><b class="neg">${money(item.amount)}</b><br>${item.status === 'paid' ? '<span class="chip g">Paid</span>' : `<button class="btn sm g" data-gc-id="${item.id}">✔ Paid</button>`}</div>
          </div>`).join('') : '<p class="mut">कोई रिकॉर्ड नहीं</p>'}
      </div>`;

    const gcWrite = async (party, veh, amt, kind, note) => {
      const ref = db().collection('ledger').doc(), b = db().batch();
      b.set(ref, { partyId: party.id, partyName: party.name, date: APP.todayISO(), time: APP.nowTime(), kind, vehicle: veh || '', fuel: '', rate: 0, litre: 0, amount: amt, note,
        by: (APP.S.user && APP.S.user.email) || '', uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at: APP.FV.serverTimestamp(),
        ...(kind === 'jama' ? { mode: 'cash' } : {}) });
      b.update(db().collection('parties').doc(party.id), { bal: APP.FV.increment(kind === 'udhar' ? amt : -amt) });
      await b.commit(); return ref.id;
    };
    $('#gc-add').onclick = async () => {
      let ps = []; try { ps = await APP.getParties(false, true); } catch (e) { }
      const m = modal(`<h3>नया गाड़ी कैश</h3>
        <label>पार्टी</label><select id="gc-pp"><option value="">— लोकल / बिना पार्टी —</option>${ps.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        <label>गाड़ी नंबर</label><input id="gc-v" style="text-transform:uppercase">
        <label>रुपये</label><input id="gc-a" inputmode="decimal">
        <div class="mut" style="margin-top:6px;font-size:12px">पार्टी चुनने पर ये रकम उसके उधार में जुड़ेगी; बिना पार्टी हो तो "लोकल / बिना पार्टी (गाड़ी कैश)" खाते में जुड़ेगी।</div>
        <div class="btns" style="margin-top:10px"><button class="btn g" id="gc-sv">सेव</button><button class="btn w" id="gc-cl">रद्द</button></div>`);
      $('#gc-cl', m).onclick = () => m.close();
      $('#gc-sv', m).onclick = async () => {
        const v = $('#gc-v', m).value.trim().toUpperCase(), a = num($('#gc-a', m).value), p = ps.find(x => x.id === $('#gc-pp', m).value);
        if (!v || !(a > 0)) return toast('गाड़ी नंबर व रकम सही भरें');
        const btn = $('#gc-sv', m); if (btn.disabled) return; btn.disabled = true;
        try {
          let pp = p;
          if (!pp) {
            pp = ps.find(x => x.name === LOCAL_GC);
            if (!pp) { const ref = db().collection('parties').doc(); await ref.set({ name: LOCAL_GC, phone: '', vehicles: [], bal: 0, createdAt: APP.FV.serverTimestamp() }); pp = { id: ref.id, name: LOCAL_GC }; }
          }
          const lid = await gcWrite(pp, v, a, 'udhar', 'गाड़ी कैश');
          await db().collection('gaadi_cash').add({ vehicle: v, partyId: pp.id, partyName: pp.name, ledgerId: lid, amount: a, date: APP.todayISO(), status: 'pending', createdAt: APP.FV.serverTimestamp() });
          APP.S.parties = null; m.close(); toast('सेव हो गया'); APP.views.gaadicash();
        } catch (e) { btn.disabled = false; toast('सेव नहीं हुआ: ' + e.message); }
      };
    };
    $$('[data-gc-id]').forEach(b => {
      b.onclick = async () => {
        const it = list.find(x => x.id === b.dataset.gcId); if (!it) return;
        if (!confirm('क्या ' + money(it.amount) + ' वापस मिल गया?' + (it.partyId ? '\nये पार्टी के खाते में नकद जमा लिखा जाएगा।' : ''))) return;
        b.disabled = true;
        try {
          if (it.partyId) await gcWrite({ id: it.partyId, name: it.partyName }, it.vehicle, num(it.amount), 'jama', 'गाड़ी कैश वापस');
          await db().collection('gaadi_cash').doc(it.id).update({ status: 'paid' });
          APP.S.parties = null; toast('Paid हो गया'); APP.views.gaadicash();
        } catch (e) { b.disabled = false; toast('नहीं हुआ: ' + e.message); }
      };
    });
  };

  /* ======================= STOCK REPORT (MONTHLY) ======================= */
  APP.views.stock = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">स्टॉक रिपोर्ट लोड हो रही है…</p>';
    const now = new Date();
    const defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const renderView = async (monthStr) => {
      main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
      const start = monthStr + '-01';
      const end = monthStr + '-31';
      let snap;
      try { snap = await db().collection('days').where('date', '>=', start).where('date', '<=', end).get(); }
      catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }
      const days = snap.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date));

      let totTankerP = 0, totTankerD = 0;
      let totLitP = 0, totLitD = 0;
      let totDiffP = 0, totDiffD = 0;
      let totTestP = 0, totTestD = 0;
      const nzP = { p1: 0, p2: 0, p3: 0, p4: 0 };
      const nzD = { d1: 0, d2: 0, d3: 0, d4: 0 };

      days.forEach(d => {
        totTankerP += num(d.tankerP);
        totTankerD += num(d.tankerD);
        totLitP += num(d.sum && d.sum.litP);
        totLitD += num(d.sum && d.sum.litD);
        totDiffP += num(d.sum && d.sum.diffP);
        totDiffD += num(d.sum && d.sum.diffD);
        const testing = K.has(d.testing) ? num(d.testing) : 5;
        K.NZ.forEach(k => {
          const n = d.nz && d.nz[k];
          if (n && K.has(n.o) && K.has(n.c)) {
            const tn = K.has(n.t) ? num(n.t) : testing;
            const net = Math.max(0, (num(n.c) - num(n.o)) - tn);
            if (k.startsWith('p')) { nzP[k] += net; totTestP += tn; }
            else { nzD[k] += net; totTestD += tn; }
          }
        });
      });

      const pct = (val, tot) => tot > 0 ? ((val / tot) * 100).toFixed(1) + '%' : '0%';
      const sign = (v) => v > 0 ? '+' : '';
      const color = (v) => v > 0 ? 'pos' : (v < 0 ? 'neg' : '');
      const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

      main.innerHTML = `
        <div class="card" style="background:#0b3d91;color:#fff;">
          <div class="row" style="align-items:center;">
            <div style="flex:1">
              <label style="color:#fff;margin:0;">महीना चुनें</label>
              <input type="month" id="stk-month" value="${monthStr}" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid #fff;">
            </div>
            <div style="flex:0 0 auto;">
              <button class="btn sm w" id="stk-refresh" style="margin-top:20px;">🔄 रिफ्रेश</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>⛽ पेट्रोल का हिसाब</h3>
          ${kvEl('टैंकर से आया (कुल)', APP.lit(totTankerP))}
          ${kvEl('मीटर से बिक्री (कुल)', APP.lit(totLitP), 'big')}
          ${kvEl('टेस्टिंग (कुल)', APP.lit(totTestP))}
          ${kvEl('वेरिएशन (कम/ज्यादा)', sign(totDiffP) + r2(totDiffP) + ' L', color(totDiffP))}
        </div>

        <div class="card">
          <h3>⛽ डीज़ल का हिसाब</h3>
          ${kvEl('टैंकर से आया (कुल)', APP.lit(totTankerD))}
          ${kvEl('मीटर से बिक्री (कुल)', APP.lit(totLitD), 'big')}
          ${kvEl('टेस्टिंग (कुल)', APP.lit(totTestD))}
          ${kvEl('वेरिएशन (कम/ज्यादा)', sign(totDiffD) + r2(totDiffD) + ' L', color(totDiffD))}
        </div>

        <div class="card">
          <h3>⛽ नोज़ल-वाइज पेट्रोल बिक्री</h3>
          ${['p1','p2','p3','p4'].map(k => kvEl(k.toUpperCase(), APP.lit(nzP[k]) + ' (' + pct(nzP[k], totLitP) + ')')).join('')}
        </div>

        <div class="card">
          <h3>🛢️ नोज़ल-वाइज डीज़ल बिक्री</h3>
          ${['d1','d2','d3','d4'].map(k => kvEl(k.toUpperCase(), APP.lit(nzD[k]) + ' (' + pct(nzD[k], totLitD) + ')')).join('')}
        </div>

        <div class="card" style="overflow-x:auto">
          <h3>📅 दिन-वार स्टॉक रजिस्टर</h3>
          ${days.length ? `
          <table style="font-size:11px;min-width:400px;">
            <tr>
              <th>तारीख</th>
              <th class="n">P टैंकर</th>
              <th class="n">P सेल</th>
              <th class="n">P फर्क</th>
              <th class="n">D टैंकर</th>
              <th class="n">D सेल</th>
              <th class="n">D फर्क</th>
            </tr>
            ${days.map(d => {
              const dp = d.sum ? d.sum.diffP : null;
              const dd = d.sum ? d.sum.diffD : null;
              return `<tr>
                <td>${dmy(d.date)}</td>
                <td class="n">${d.tankerP || '-'}</td>
                <td class="n">${d.sum ? d.sum.litP : '-'}</td>
                <td class="n ${dp > 0 ? 'pos' : (dp < 0 ? 'neg' : '')}">${dp !== null && dp !== undefined ? sign(dp) + r2(dp) : '-'}</td>
                <td class="n">${d.tankerD || '-'}</td>
                <td class="n">${d.sum ? d.sum.litD : '-'}</td>
                <td class="n ${dd > 0 ? 'pos' : (dd < 0 ? 'neg' : '')}">${dd !== null && dd !== undefined ? sign(dd) + r2(dd) : '-'}</td>
              </tr>`;
            }).join('')}
          </table>` : '<p class="mut">इस महीने का कोई डेटा नहीं है।</p>'}
        </div>
      `;
      $('#stk-month').onchange = (e) => renderView(e.target.value);
      $('#stk-refresh').onclick = () => renderView($('#stk-month').value);
    };
    renderView(defaultMonth);
  };

  /* ======================= NIJI UDHAR (PRIV) ======================= */
  APP.views.priv = async function (mode) {
    mode = mode || 'active';
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties = []; try { parties = await APP.getParties(true, true); } catch (e) { }

    const activeParties = parties.filter(p => num(p.bal) !== 0); // Private parties can have 0 balance if settled
    const historyParties = parties.filter(p => num(p.bal) === 0);
    const list = mode === 'active' ? activeParties : historyParties;
    const pend = activeParties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff;">
        <div class="row" style="align-items:center;">
          <div style="flex:1">
            <h3 style="color:#fff;margin:0;">🔒 निजी उधार</h3>
            <div style="font-size:12px;opacity:.85;margin-top:4px;">कुल बाकी: ${money(pend)}</div>
          </div>
          <div style="flex:0 0 auto;">
            <button class="btn sm w" id="pv-toggle">${mode === 'active' ? '📜 हिस्ट्री देखें' : '⬅️ वापस'}</button>
          </div>
        </div>
      </div>
      <div class="btns" style="margin-bottom:12px">
        ${mode === 'active' ? '<button class="btn o" id="pv-add">+ नया निजी उधार</button>' : ''}
        ${mode === 'active' ? '<button class="btn g" id="pv-new-party">+ नई निजी पार्टी</button>' : ''}
      </div>
      <div class="card">
        ${list.length ? list.map(p => {
          const cibilBadge = (APP.cibil && APP.cibil.badgeHtml) ? APP.cibil.badgeHtml(p) : '';
          const b = num(p.bal);
          const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN') : '+₹' + Math.abs(b).toLocaleString('en-IN'));
          const cls = b > 0 ? 'r' : (b < 0 ? 'g' : '');
          
          return `
          <div class="item" style="cursor:pointer" data-pid="${p.id}">
            <div class="a"><b>${esc(p.name)}</b> ${cibilBadge}</div>
            <span class="chip ${cls}">${disp}</span>
          </div>`;
        }).join('') : `<p class="mut" style="text-align:center;padding:20px;">${mode === 'active' ? 'कोई बकाया नहीं है' : 'कोई हिस्ट्री नहीं है'}</p>`}
      </div>
    `;

    if ($('#pv-add')) $('#pv-add').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
    if ($('#pv-new-party')) $('#pv-new-party').onclick = () => APP.partyModal(null, true);
    $('#pv-toggle').onclick = () => APP.views.priv(mode === 'active' ? 'history' : 'active');
    $$('[data-pid]').forEach(el => el.onclick = () => APP.partyView(el.dataset.pid, true));
  };

  /* ======================= MORE / SETTINGS (base) ======================= */
  APP.views.more = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = `
      <div class="card">
        <div style="text-align:center;padding:12px 0 6px 0;">
          ${MOC_BPCL_LOGO}
          <b style="font-size:16px;">माज़दा ऑयल कंपनी</b><br>
          <small class="mut">Bharat Petroleum Corporation Limited</small>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0;">
        ${kv('लॉगिन', esc(S.user ? S.user.email : 'Salesman'))}
        ${kv('भूमिका', APP.isOwner() ? 'मालिक' : 'मैनेजर')}
        <div class="btns" style="margin-top:12px">
          <button class="btn r full" id="m-logout">लॉगआउट</button>
        </div>
      </div>`;

    if (APP.isOwner() && APP.syncOldBankData) {
      const btns = main.querySelector('.btns');
      const sb = document.createElement('button');
      sb.id = 'm-sync-bank'; sb.className = 'btn w full'; sb.style.marginBottom = '10px';
      sb.textContent = '🔄 पुराना डेटा SBI बैंक में सिंक करें';
      sb.onclick = () => APP.syncOldBankData();
      if (btns) btns.insertBefore(sb, btns.firstChild);
    }

    $('#m-logout').onclick = () => {
      localStorage.removeItem('mazda_sm');
      localStorage.removeItem('mazda_viewer');
      if (APP.auth) APP.auth.signOut();
      location.reload();
    };
  };

  console.log('[Mazda views2_core.js] loaded ✓');
})();
