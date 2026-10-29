/* Mazda Oil Company - Owner Portal Logic (Ultimate Rich Dashboard) */
(function () {
  'use strict';
  console.log('[Owner Portal] v5 starting...');

  let auth, db;
  let allDays = [], allTankers = [], allParties = [], allLedger = [], allRequests = [], allVendors = [];
  let allCashSubs = [], allRunsheets = [], allWorkers = [], allAttendance = [], allSalaries = [];
  let allBankDeposits = [], allShopOrders = [], allInvoices = [], allAudit = [];

  const S = { tab: 'home', subView: null, loaded: false };

  /* ================= Icons ================= */
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><circle cx="12" cy="14" r="3"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M4 4v16M10 20v-8M16 20V8M22 20V4"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
  };

  /* ================= Utils ================= */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const toast = msg => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000);
  };
  const money = x => '₹' + Number(x || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const lit = x => Number(x || 0).toFixed(1) + ' L';
  const dmy = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const wNames = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

  // Global modal helper
  function showModal(html) {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--navy-light);width:100%;max-height:92vh;overflow-y:auto;border-radius:24px 24px 0 0;padding:20px;color:#fff;border-top:1px solid var(--gold);';
    sheet.innerHTML = html;
    m.appendChild(sheet);
    m.onclick = (e) => { if(e.target === m) m.remove(); };
    document.body.appendChild(m);
    return { root: m, sheet, close: () => m.remove() };
  }

  /* ================= Boot ================= */
  window.addEventListener('load', () => {
    try {
      firebase.initializeApp(window.CFG.firebase);
      auth = firebase.auth(); db = firebase.firestore();
      const saved = localStorage.getItem('mazda_owner');
      if (saved === 'yes') { loadApp(); } else { renderLogin(); }
    } catch (e) { $('#app').innerHTML = '<div style="padding:20px;color:red">Firebase Error: ' + e.message + '</div>'; }
  });

  function renderLogin() {
    $('#app').innerHTML = `
      <div class="login-screen fade-in">
        <img src="./logo.png" class="login-logo" alt="Logo">
        <h2 style="text-align:center;font-size:24px;color:#fff">Owner Portal</h2>
        <p class="text-mut" style="text-align:center;margin-bottom:30px;">सिर्फ मालिक के लिए</p>
        <div class="glass-card" style="margin:0;">
          <label class="text-mut" style="display:block;text-align:center;margin-bottom:10px;">4-अंकों का VIP PIN</label>
          <input type="password" id="o-pin" maxlength="4" placeholder="****" style="text-align:center;">
          <button class="btn" id="btn-login" style="margin-top:20px;">लॉगिन करें</button>
        </div>
      </div>`;
    $('#btn-login').onclick = async () => {
      const pin = $('#o-pin').value.trim();
      const ownerPin = window.CFG.ownerPin || '9999';
      if (pin === ownerPin) {
        const btn = $('#btn-login'); btn.disabled = true; btn.textContent = 'चेक कर रहे हैं...';
        try {
          if (!auth.currentUser) await auth.signInAnonymously();
          localStorage.setItem('mazda_owner', 'yes');
          loadApp();
        } catch(e) { toast('नेटवर्क एरर'); btn.disabled = false; }
      } else { toast('❌ गलत PIN!'); $('#o-pin').value = ''; }
    };
  }

  async function loadApp() {
    $('#app').innerHTML = `
      <div class="p-header fade-in">
        <div class="row" style="display:flex;align-items:center;gap:12px">
          <img src="./logo.png" alt="">
          <div><div style="font-weight:700;font-size:16px;">Owner Control</div><div class="text-mut" style="font-size:11px;">माज़दा ऑयल कंपनी</div></div>
        </div>
        <button id="btn-logout" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;">↩</button>
      </div>
      <div id="p-content" style="padding-bottom:100px;"></div>
      <div class="p-nav fade-in">
        <button data-tab="home" class="active">${ICONS.home} होम</button>
        <button data-tab="money">${ICONS.money} पैसा</button>
        <button data-tab="fuel">${ICONS.fuel} स्टॉक</button>
        <button data-tab="report">${ICONS.report} रिपोर्ट</button>
        <button data-tab="more">${ICONS.more} और</button>
      </div>
    `;

    $('#btn-logout').onclick = () => { localStorage.removeItem('mazda_owner'); if (auth) auth.signOut(); location.reload(); };

    $$('.p-nav button').forEach(b => b.onclick = () => {
      $$('.p-nav button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      S.tab = b.dataset.tab;
      S.subView = null;
      renderTab();
    });

    await fetchData();
    renderTab();
  }

  async function fetchData() {
    try {
      const [dSnap, tSnap, pSnap, lSnap, vSnap, csSnap, rsSnap, wSnap, attSnap, salSnap, bdSnap, soSnap, invSnap, audSnap] = await Promise.all([
        db.collection('days').orderBy('date', 'desc').limit(60).get(),
        db.collection('tanker_reports').orderBy('date', 'desc').limit(50).get(),
        db.collection('parties').get(),
        db.collection('ledger').get(),
        db.collection('vendors').get(),
        db.collection('cash_submissions').orderBy('createdAt', 'desc').limit(20).get().catch(()=>({docs:[]})),
        db.collection('runsheets').where('status','==','active').get().catch(()=>({docs:[]})),
        db.collection('workers').get().catch(()=>({docs:[]})),
        db.collection('attendance').where('date','==',today()).get().catch(()=>({docs:[]})),
        db.collection('salary_payments').get().catch(()=>({docs:[]})),
        db.collection('bank_deposits').orderBy('date', 'desc').limit(30).get().catch(()=>({docs:[]})),
        db.collection('shop_orders').orderBy('createdAt', 'desc').limit(30).get().catch(()=>({docs:[]})),
        db.collection('tanker_invoices').get().catch(()=>({docs:[]})),
        db.collection('audit').orderBy('at', 'desc').limit(30).get().catch(()=>({docs:[]}))
      ]);
      
      allDays = dSnap.docs.map(d => d.data());
      allTankers = tSnap.docs.map(d => d.data());
      allParties = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allLedger = lSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allVendors = vSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allCashSubs = csSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allRunsheets = rsSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allWorkers = wSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allAttendance = attSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allSalaries = salSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allBankDeposits = bdSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(x => !x.removed);
      allShopOrders = soSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allInvoices = invSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allAudit = audSnap.docs.map(d => ({id: d.id, ...d.data()}));

      try {
        const reqSnap = await db.collection('requests').where('status', '==', 'pending').get();
        allRequests = reqSnap.docs.map(d => ({id: d.id, ...d.data()}));
      } catch(e) { allRequests = []; }

      S.loaded = true;
    } catch (e) { toast('डेटा लोड नहीं हुआ: ' + e.message); }
  }

  function renderTab() {
    const c = $('#p-content');
    c.className = 'fade-in';
    if (!S.loaded) { c.innerHTML = '<p class="text-mut" style="text-align:center;padding:40px;">Data analyse हो रहा है...</p>'; return; }

    if (S.subView) { renderSubView(S.subView, c); return; }

    if (S.tab === 'home') renderHome(c);
    else if (S.tab === 'money') renderMoney(c);
    else if (S.tab === 'fuel') renderFuel(c);
    else if (S.tab === 'report') renderReport(c);
    else if (S.tab === 'more') renderMore(c);
  }

  window.switchTab = (t) => {
    $$('.p-nav button').forEach(x => x.classList.remove('active'));
    const btn = document.querySelector(`.p-nav button[data-tab="${t}"]`);
    if (btn) btn.classList.add('active');
    S.tab = t; S.subView = null;
    renderTab();
  };

  window.openSubView = (view) => { S.subView = view; renderTab(); window.scrollTo(0,0); };
  window.closeSubView = () => { S.subView = null; renderTab(); };

  /* ================= HOME ================= */
  function renderHome(c) {
    const todayData = allDays.find(d => d.date === today()) || (allDays.length ? allDays[0] : {});
    const sum = todayData.sum || {};
    const thisMonth = today().slice(0,7);
    const monthDays = allDays.filter(d => d.date.startsWith(thisMonth));
    const monthSale = monthDays.reduce((a,d) => a + Number(d.sum?.sale || 0), 0);
    const totDue = allParties.reduce((a,p) => a + Math.max(0, Number(p.bal || 0)), 0);

    // Margin
    const pInv = allInvoices.filter(i => i.fuelType === 'petrol').sort((a,b) => b.date.localeCompare(a.date));
    const dInv = allInvoices.filter(i => i.fuelType === 'diesel').sort((a,b) => b.date.localeCompare(a.date));
    const costP = pInv[0]?.purchaseRate || 0;
    const costD = dInv[0]?.purchaseRate || 0;
    const mP = sum.litP && sum.rateP && costP ? (sum.rateP - costP) * sum.litP : 0;
    const mD = sum.litD && sum.rateD && costD ? (sum.rateD - costD) * sum.litD : 0;
    const totalMargin = mP + mD;

    // Alerts
    let ideas = [];
    if (allTankers.length > 0 && allTankers[0].result) {
      let diff = 0;
      if (allTankers[0].result.petrol) diff += allTankers[0].result.petrol.diff || 0;
      if (allTankers[0].result.diesel) diff += allTankers[0].result.diesel.diff || 0;
      if (diff < -20) ideas.push('⚠️ पिछले टैंकर में ' + Math.abs(diff).toFixed(1) + 'L तेल कम आया');
    }
    if (allRequests.length > 0) ideas.push('📩 ' + allRequests.length + ' पार्टियों ने मोहलत मांगी है');
    if (sum.actStockP !== undefined && sum.actStockP < 1500) ideas.push('⛽ पेट्रोल स्टॉक कम है (' + lit(sum.actStockP) + ')');
    if (allCashSubs.filter(x=>x.status==='pending').length > 0) ideas.push('💵 ' + allCashSubs.filter(x=>x.status==='pending').length + ' कैश अप्रूवल बाकी');
    if (allShopOrders.filter(x=>x.status==='paid_awaiting_delivery' || x.status==='paid').length > 0) ideas.push('📦 ' + allShopOrders.filter(x=>x.status==='paid_awaiting_delivery' || x.status==='paid').length + ' शॉप ऑर्डर डिलीवरी बाकी');

    const topDebtors = allParties.filter(p => Number(p.bal) > 0).sort((a,b) => Number(b.bal) - Number(a.bal)).slice(0, 5);
    const recent = [...allLedger].sort((a,b) => ((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||''))).slice(0, 6);
    const chart7 = allDays.slice(0,7).reverse();
    const maxSale = Math.max(...chart7.map(d => Number(d.sum?.sale || 0)), 1);

    c.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 16px;">
        <div class="glass-card" style="margin:0; padding:12px;">
          <div class="text-mut" style="font-size:10px; text-transform:uppercase;">आज की बिक्री</div>
          <div style="font-size:20px; font-weight:800; color:var(--gold); margin-top:4px;">${money(sum.sale)}</div>
        </div>
        <div class="glass-card" style="margin:0; padding:12px;">
          <div class="text-mut" style="font-size:10px; text-transform:uppercase;">आज का प्रॉफिट</div>
          <div style="font-size:20px; font-weight:800; color:${totalMargin >= 0 ? '#7ee0a0' : '#ff8888'}; margin-top:4px;">${money(totalMargin)}</div>
        </div>
        <div class="glass-card" style="margin:0; padding:12px;">
          <div class="text-mut" style="font-size:10px; text-transform:uppercase;">बचा कैश</div>
          <div style="font-size:20px; font-weight:800; margin-top:4px;">${money(sum.close)}</div>
        </div>
        <div class="glass-card" style="margin:0; padding:12px;">
          <div class="text-mut" style="font-size:10px; text-transform:uppercase;">कुल बकाया</div>
          <div style="font-size:20px; font-weight:800; color:#ff8888; margin-top:4px;">${money(totDue)}</div>
        </div>
      </div>

      <div class="glass-card" style="margin-top:12px; background:linear-gradient(135deg, rgba(10,47,107,0.8), rgba(4,11,25,0.8)); border-color:#f4b41a;">
        <div class="text-mut" style="font-size:11px;">📅 इस महीने की कुल सेल</div>
        <div class="big-number" style="color:var(--gold);">${money(monthSale)}</div>
        <div class="text-mut" style="font-size:11px;">${monthDays.length} दिन · औसत ${money(monthSale/(monthDays.length||1))}/दिन</div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">💡 Business Alerts (${ideas.length})</h3>
        ${ideas.length ? ideas.map(i => `<div class="idea-box">${i}</div>`).join('') : '<p class="text-mut" style="font-size:12px;">सब ठीक है ✅</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">📊 पिछले 7 दिन की सेल</h3>
        <div style="display:flex; align-items:flex-end; height:110px; gap:6px; margin-top:14px;">
          ${chart7.map(d => {
            const h = Math.max(8, (Number(d.sum?.sale || 0) / maxSale) * 90);
            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;">
              <div style="width:100%; background:linear-gradient(180deg, var(--gold), var(--gold-dark)); height:${h}px; border-radius:4px 4px 0 0;"></div>
              <div class="text-mut" style="font-size:9px;">${d.date.slice(8)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div style="padding:14px 16px 6px; display:flex; justify-content:space-between; align-items:center;">
          <h3 style="font-size:14px; margin:0;">👥 सबसे ज्यादा बकाया</h3>
          <button onclick="switchTab('money')" style="background:none; border:none; color:var(--gold); font-size:11px; font-weight:700;">सभी →</button>
        </div>
        ${topDebtors.map(p => `
          <div class="item-row" style="padding:10px 16px; cursor:pointer;" onclick="showOwnerPartyLedger('${p.id}')">
            <div><div style="font-weight:600; font-size:13px;">${esc(p.name)}</div><div class="text-mut" style="font-size:10px;">${esc(p.phone || '')}</div></div>
            <div style="font-weight:bold; color:#ff8888; font-size:13px;">${money(p.bal)}</div>
          </div>
        `).join('') || '<p class="text-mut" style="padding:16px; text-align:center; font-size:12px;">कोई बकाया नहीं</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">🕐 हाल की गतिविधि</h3>
        ${recent.map(a => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">
            <div><b>${esc(a.partyName || '?')}</b><div class="text-mut" style="font-size:10px;">${dmy(a.date)} · ${a.vehicle || a.kind}</div></div>
            <div style="color:${a.kind === 'udhar' ? '#ff8888' : '#7ee0a0'}; font-weight:700;">${a.kind === 'udhar' ? '-' : '+'}${money(a.amount)}</div>
          </div>
        `).join('') || '<p class="text-mut" style="font-size:12px;">कोई एंट्री नहीं</p>'}
      </div>
    `;
  }

  /* ================= MONEY (Paisa) ================= */
  function renderMoney(c) {
    const totDue = allParties.reduce((a, p) => a + Math.max(0, Number(p.bal || 0)), 0);
    const sortedParties = allParties.filter(p => Number(p.bal) > 0).sort((a,b) => Number(b.bal) - Number(a.bal));
    const recentBank = allBankDeposits.slice(0, 5);
    const cash30 = allDays.slice(0, 30);
    const totSBI = cash30.reduce((a,d)=>a+Number(d.malikDiya||0),0);
    const totPaytm = cash30.reduce((a,d)=>a+Number(d.paytm||0),0);
    const totSwipe = cash30.reduce((a,d)=>a+Number(d.swipe||0),0);
    const totExpense = cash30.reduce((a,d)=>a+Number(d.kharcha||0)+Number(d.chaiKhana||0)+Number(d.driverInaam||0),0);

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <div class="text-mut" style="font-size:11px; text-transform:uppercase;">मार्केट में कुल बकाया</div>
        <div class="big-number" style="color:#ff8888;">${money(totDue)}</div>
        <div class="text-mut" style="font-size:11px; margin-top:4px;">${sortedParties.length} पार्टियों से लेना है</div>
      </div>

      ${allRequests.length ? `
      <div class="glass-card">
        <h3 style="font-size:14px; color:var(--gold);">📩 मोहलत की रिक्वेस्ट (${allRequests.length})</h3>
        ${allRequests.map(r => `
          <div class="item-row">
            <div><div style="font-weight:600; font-size:13px;">${esc(r.partyName)}</div><div class="text-mut" style="font-size:11px;">"${esc(r.message)}"</div></div>
            <div><button onclick="approveReq('${r.id}')" style="background:#0a7d33; color:#fff; border:none; border-radius:6px; padding:6px 10px; font-size:11px;">Accept</button></div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="glass-card">
        <h3 style="font-size:14px;">💰 कैश फ्लो (पिछले 30 दिन)</h3>
        <div class="item-row"><span class="text-mut">SBI जमा</span><b style="color:#7ee0a0;">${money(totSBI)}</b></div>
        <div class="item-row"><span class="text-mut">Paytm/UPI</span><b>${money(totPaytm)}</b></div>
        <div class="item-row"><span class="text-mut">स्वाइप (Card)</span><b>${money(totSwipe)}</b></div>
        <div class="item-row"><span class="text-mut">कुल खर्चे</span><b style="color:#ff8888;">${money(totExpense)}</b></div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">🏦 हाल के SBI जमा</h3>
        ${recentBank.map(b => `<div class="item-row"><span>${dmy(b.date)}<div class="text-mut" style="font-size:10px;">${esc(b.note||'')}</div></span><b>${money(b.amount)}</b></div>`).join('') || '<p class="text-mut" style="font-size:12px;">कोई जमा नहीं</p>'}
      </div>

      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.05);"><h3 style="font-size:14px; margin:0;">📒 सभी पार्टी (उधार वाले)</h3></div>
        <div style="max-height:60vh; overflow-y:auto;">
          ${sortedParties.map(p => `
            <div class="item-row" style="padding:12px 16px; cursor:pointer;" onclick="showOwnerPartyLedger('${p.id}')">
              <div><div style="font-weight:600; font-size:13px;">${esc(p.name)}</div><div class="text-mut" style="font-size:10px;">${esc(p.phone || '')}</div></div>
              <div style="font-weight:bold; color:#ff8888;">${money(p.bal)}</div>
            </div>
          `).join('') || '<p class="text-mut" style="text-align:center; padding:20px;">कोई बकाया नहीं</p>'}
        </div>
      </div>
    `;
  }

  window.approveReq = async (id) => {
    if(!confirm('मोहलत Accept करनी है?')) return;
    try { await db.collection('requests').doc(id).update({status: 'approved'}); toast('✅ Accept'); fetchData().then(renderTab); }
    catch(e) { toast('एरर: ' + e.message); }
  };

  /* ================= Party Ledger Modal ================= */
  window.showOwnerPartyLedger = (pid) => {
    const party = allParties.find(p => p.id === pid);
    if (!party) return;
    const entries = allLedger.filter(l => l.partyId === pid).sort((a,b) => ((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')));
    let bal = 0; entries.forEach(e => { bal += (e.kind === 'udhar' ? Number(e.amount) : -Number(e.amount)); });
    const ph = String(party.phone || '').replace(/\D/g, '');
    const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';

    const m = showModal(`
      <h3 style="color:var(--gold); margin-bottom:4px;">${esc(party.name)}</h3>
      <div class="text-mut" style="font-size:12px; margin-bottom:12px;">${esc(party.phone || '')} | ${esc((party.vehicles||[]).join(', '))}</div>
      <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div><div class="text-mut" style="font-size:11px;">कुल बकाया</div><div style="font-size:22px; color:#ff8888; font-weight:800; margin:0;">${money(bal)}</div></div>
        <div style="display:flex; gap:8px;">
          ${ph ? `<a href="tel:${ph}" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#2e7d32;color:#fff;text-decoration:none;font-size:16px;">📞</a>` : ''}
          ${wa ? `<a href="https://wa.me/${wa}" target="_blank" style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#25D366;color:#fff;text-decoration:none;font-size:16px;">💬</a>` : ''}
        </div>
      </div>
      <div style="max-height:45vh; overflow-y:auto; margin-bottom:16px;">
        ${entries.map(r => `
          <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between;">
            <div><div style="font-weight:600; font-size:13px;">${r.kind === 'udhar' ? (r.vehicle || 'गाड़ी') : 'जमा'}</div><div class="text-mut" style="font-size:10px;">${dmy(r.date)} ${r.fuel ? '· '+r.fuel : ''} ${r.litre ? '· '+r.litre+'L' : ''}</div></div>
            <div style="font-weight:bold; color:${r.kind === 'udhar' ? '#ff8888' : '#7ee0a0'};">${r.kind === 'udhar' ? '-' : '+'}${money(r.amount)}</div>
          </div>
        `).join('') || '<p class="text-mut">कोई एंट्री नहीं</p>'}
      </div>
      <button onclick="this.closest('div').parentNode.remove()" class="btn" style="background:rgba(255,255,255,0.1); color:#fff;">बंद करें</button>
    `);
  };

  /* ================= FUEL ================= */
  function renderFuel(c) {
    const todayData = allDays[0] || {};
    const sum = todayData.sum || {};
    const recent7 = allDays.slice(0, 7);
    const avgP = recent7.reduce((a, d) => a + Number(d.sum?.litP || 0), 0) / (recent7.length || 1);
    const avgD = recent7.reduce((a, d) => a + Number(d.sum?.litD || 0), 0) / (recent7.length || 1);
    const daysLeftP = avgP > 0 ? (sum.actStockP || 0) / avgP : 0;
    const daysLeftD = avgD > 0 ? (sum.actStockD || 0) / avgD : 0;

    // Driver analysis
    const driverStats = {};
    allTankers.forEach(t => {
      const driver = t.driverName || 'Unknown';
      if (!driverStats[driver]) driverStats[driver] = { trips: 0, shortage: 0, last5: [] };
      let diff = 0;
      if (t.result && t.result.petrol) diff += t.result.petrol.diff || 0;
      if (t.result && t.result.diesel) diff += t.result.diesel.diff || 0;
      driverStats[driver].trips++;
      driverStats[driver].shortage += diff;
      if (driverStats[driver].last5.length < 5) driverStats[driver].last5.push(diff);
    });
    const worstDrivers = Object.keys(driverStats).map(k => ({name: k, ...driverStats[k]})).filter(d => d.shortage < -10).sort((a,b) => a.shortage - b.shortage);

    // Nozzle trend
    const nzTotals = { p1:0, p2:0, p3:0, p4:0, d1:0, d2:0, d3:0, d4:0 };
    allDays.slice(0, 30).forEach(d => {
      const nz = d.nz || {};
      ['p1','p2','p3','p4','d1','d2','d3','d4'].forEach(k => {
        if (nz[k] && nz[k].o && nz[k].c) nzTotals[k] += Math.max(0, Number(nz[k].c) - Number(nz[k].o) - 5);
      });
    });
    const maxNz = Math.max(...Object.values(nzTotals), 1);

    // Weekday
    const wdSales = [0,0,0,0,0,0,0], wdCnt = [0,0,0,0,0,0,0];
    allDays.forEach(d => {
      if(d.sum && d.sum.sale) {
        const wd = new Date(d.date + 'T12:00:00').getDay();
        wdSales[wd] += Number(d.sum.sale); wdCnt[wd]++;
      }
    });

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">⏳ स्टॉक कब खत्म होगा?</h3>
        <div class="item-row"><span class="text-mut">⛽ पेट्रोल (${lit(sum.actStockP)})</span><b style="color:${daysLeftP < 3 ? '#ff8888' : '#7ee0a0'}">${daysLeftP.toFixed(1)} दिन</b></div>
        <div class="item-row"><span class="text-mut">🛢️ डीज़ल (${lit(sum.actStockD)})</span><b style="color:${daysLeftD < 3 ? '#ff8888' : '#7ee0a0'}">${daysLeftD.toFixed(1)} दिन</b></div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">🚛 ड्राइवर चोरी रिपोर्ट (${worstDrivers.length})</h3>
        ${worstDrivers.length ? worstDrivers.map(d => `
          <div class="item-row">
            <div><div style="font-weight:600; font-size:13px;">👤 ${esc(d.name)}</div><div class="text-mut" style="font-size:10px;">${d.trips} ट्रिप में</div></div>
            <div style="text-align:right;"><div style="color:#ff8888; font-weight:bold;">${lit(d.shortage)}</div><div class="text-mut" style="font-size:9px;">पिछली 5: ${d.last5.map(x=>x.toFixed(0)).join(', ')}</div></div>
          </div>
        `).join('') : '<p class="text-mut" style="font-size:12px; color:#7ee0a0;">सब ड्राइवर ठीक हैं ✅</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">⛽ नोज़ल ट्रेंड (30 दिन)</h3>
        ${['p1','p2','p3','p4'].map(k => `
          <div style="margin-top:8px;"><div style="display:flex; justify-content:space-between; font-size:11px;"><b>${k.toUpperCase()}</b><span class="text-mut">${lit(nzTotals[k])}</span></div>
          <div class="trend-bar"><div class="trend-fill" style="width:${(nzTotals[k]/maxNz)*100}%;"></div></div></div>
        `).join('')}
        ${['d1','d2','d3','d4'].map(k => `
          <div style="margin-top:8px;"><div style="display:flex; justify-content:space-between; font-size:11px;"><b>${k.toUpperCase()}</b><span class="text-mut">${lit(nzTotals[k])}</span></div>
          <div class="trend-bar"><div class="trend-fill" style="width:${(nzTotals[k]/maxNz)*100}%;"></div></div></div>
        `).join('')}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">📅 हफ्ते के दिन का ट्रेंड</h3>
        <div style="display:flex; justify-content:space-between; margin-top:12px;">
          ${[1,2,3,4,5,6,0].map(wd => {
            const avg = wdCnt[wd] > 0 ? wdSales[wd]/wdCnt[wd] : 0;
            const h = Math.min(60, Math.max(5, (avg/150000)*60));
            return `<div style="text-align:center"><div style="width:22px; background:${wd===0?'#f4b41a':'#3b82f6'}; height:${h}px; border-radius:4px; margin:0 auto;"></div><div class="text-mut" style="font-size:9px; margin-top:4px;">${wNames[wd]}</div></div>`;
          }).join('')}
        </div>
      </div>

      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div style="padding:14px 16px;"><h3 style="font-size:14px; margin:0;">🚛 हाल के टैंकर</h3></div>
        ${allTankers.slice(0, 8).map(t => {
          const dP = t.result?.petrol?.diff || 0;
          const dD = t.result?.diesel?.diff || 0;
          return `<div class="item-row" style="padding:10px 16px;">
            <div><div style="font-weight:600; font-size:12px;">${dmy(t.date)} · ${esc(t.tankerNo||'?')}</div><div class="text-mut" style="font-size:10px;">👤 ${esc(t.driverName||'?')}</div></div>
            <div style="text-align:right; font-size:11px;">
              <div style="color:${dP < -5 ? '#ff8888' : '#7ee0a0'};">P: ${dP.toFixed(1)}L</div>
              <div style="color:${dD < -5 ? '#ff8888' : '#7ee0a0'};">D: ${dD.toFixed(1)}L</div>
            </div>
          </div>`;
        }).join('') || '<p class="text-mut" style="padding:16px;">कोई टैंकर रिपोर्ट नहीं</p>'}
      </div>
    `;
  }

  /* ================= REPORT ================= */
  function renderReport(c) {
    const thisYM = today().slice(0,7);
    const lastYMDate = new Date(); lastYMDate.setMonth(lastYMDate.getMonth()-1);
    const lastYM = lastYMDate.getFullYear() + '-' + String(lastYMDate.getMonth()+1).padStart(2,'0');
    
    const thisMonth = allDays.filter(d => d.date.startsWith(thisYM));
    const lastMonth = allDays.filter(d => d.date.startsWith(lastYM));
    const tmSale = thisMonth.reduce((a,d)=>a+Number(d.sum?.sale||0),0);
    const lmSale = lastMonth.reduce((a,d)=>a+Number(d.sum?.sale||0),0);
    const pct = lmSale > 0 ? ((tmSale - lmSale)/lmSale*100) : 0;

    // Weekday totals
    const wdSales = [0,0,0,0,0,0,0], wdCnt = [0,0,0,0,0,0,0];
    allDays.forEach(d => {
      if(d.sum && d.sum.sale) { const wd = new Date(d.date+'T12:00:00').getDay(); wdSales[wd]+=Number(d.sum.sale); wdCnt[wd]++; }
    });
    const wdAvg = wdSales.map((s,i) => wdCnt[i] ? s/wdCnt[i] : 0);
    const maxWd = Math.max(...wdAvg, 1);

    // Rate history
    const pInv = allInvoices.filter(i=>i.fuelType==='petrol').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    const dInv = allInvoices.filter(i=>i.fuelType==='diesel').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">📈 इस महीने vs पिछला</h3>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <div style="flex:1; text-align:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;"><div class="text-mut" style="font-size:10px;">इस महीने</div><div style="font-size:16px; font-weight:800; color:var(--gold);">${money(tmSale)}</div></div>
          <div style="flex:1; text-align:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:10px;"><div class="text-mut" style="font-size:10px;">पिछला</div><div style="font-size:16px; font-weight:800;">${money(lmSale)}</div></div>
        </div>
        <div style="text-align:center; margin-top:10px; font-size:14px; color:${pct >= 0 ? '#7ee0a0' : '#ff8888'}; font-weight:800;">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">📅 हफ्ते के दिन का औसत</h3>
        ${[1,2,3,4,5,6,0].map(wd => `
          <div style="margin-top:8px;"><div style="display:flex; justify-content:space-between; font-size:11px;"><b>${wNames[wd]}वार</b><span>${money(wdAvg[wd])}</span></div>
          <div class="trend-bar"><div class="trend-fill" style="width:${(wdAvg[wd]/maxWd)*100}%;"></div></div></div>
        `).join('')}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">⛽ पेट्रोल खरीद रेट (हाल के 5)</h3>
        ${pInv.map(i => `<div class="item-row"><span>${dmy(i.date)}</span><b>₹${Number(i.purchaseRate).toFixed(2)}</b></div>`).join('') || '<p class="text-mut">डेटा नहीं</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">🛢️ डीज़ल खरीद रेट (हाल के 5)</h3>
        ${dInv.map(i => `<div class="item-row"><span>${dmy(i.date)}</span><b>₹${Number(i.purchaseRate).toFixed(2)}</b></div>`).join('') || '<p class="text-mut">डेटा नहीं</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">⏱️ महीने के शुरू से अब तक</h3>
        <div class="item-row"><span class="text-mut">कुल बिक्री</span><b>${money(tmSale)}</b></div>
        <div class="item-row"><span class="text-mut">कुल दिन</span><b>${thisMonth.length}</b></div>
        <div class="item-row"><span class="text-mut">औसत प्रतिदिन</span><b>${money(tmSale/(thisMonth.length||1))}</b></div>
      </div>
    `;
  }

  /* ================= MORE ================= */
  function renderMore(c) {
    const groups = [
      { title: '📊 विश्लेषण', items: [
        { label: '📈 रेट इतिहास', sub: 'rate_history' },
        { label: '⛽ नोज़ल ट्रेंड', sub: 'nozzle' },
        { label: '📊 मंथली डैशबोर्ड', sub: 'dashboard' }
      ]},
      { title: '💰 वित्त', items: [
        { label: '🏦 बैंक जमा', sub: 'bank' },
        { label: '📄 खरीद बिल (मार्जिन)', sub: 'invoices' },
        { label: '🚨 वसूली डैशबोर्ड', sub: 'recovery' }
      ]},
      { title: '👥 पार्टी', items: [
        { label: '👥 सभी ग्राहक', sub: 'customers' },
        { label: '⭐ पार्टी CIBIL', sub: 'cibil' },
        { label: '🚗 गाड़ी प्रोफाइल', sub: 'vehicle' }
      ]},
      { title: '🚛 संचालन', items: [
        { label: '🚛 टैंकर रिपोर्ट', sub: 'tanker' },
        { label: '📦 शॉप ऑर्डर', sub: 'orders' },
        { label: '👨‍💼 स्टाफ / वर्कर', sub: 'staff' }
      ]},
      { title: '🏢 सहायता', items: [
        { label: '🏢 कंपनी सपोर्ट', sub: 'vendors' },
        { label: '🔍 ऑडिट लॉग', sub: 'audit' }
      ]},
      { title: '⚙️ सेटिंग', items: [
        { label: '🔓 लॉगआउट', sub: 'logout' }
      ]}
    ];

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px; background:linear-gradient(135deg, rgba(244,180,26,0.15), rgba(4,11,25,0.8)); border-color:var(--gold);">
        <div style="text-align:center;">
          <img src="./logo.png" style="width:50px; height:50px; border-radius:50%; border:2px solid var(--gold);">
          <div style="font-weight:800; font-size:16px; margin-top:8px;">माज़दा ऑयल कंपनी</div>
          <div class="text-mut" style="font-size:11px;">Owner Control Panel</div>
        </div>
      </div>

      ${groups.map(g => `
        <div class="glass-card" style="padding:0; overflow:hidden;">
          <div style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.05);"><h3 style="font-size:13px; margin:0;">${g.title}</h3></div>
          ${g.items.map(it => `
            <div class="item-row" style="padding:14px 16px; cursor:pointer;" onclick="handleMoreClick('${it.sub}')">
              <span style="font-size:13px;">${it.label}</span>
              <span style="color:var(--text-mut);">›</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  window.handleMoreClick = (sub) => {
    if (sub === 'logout') { localStorage.removeItem('mazda_owner'); if (auth) auth.signOut(); location.reload(); return; }
    window.openSubView(sub);
  };

  /* ================= SUB-VIEWS ================= */
  function renderSubView(view, c) {
    const header = (title) => `
      <div class="p-header fade-in" style="padding-top:20px;">
        <button onclick="closeSubView()" style="background:rgba(255,255,255,0.1); border:none; color:#fff; padding:8px 14px; border-radius:10px; font-family:inherit;">← वापस</button>
        <h2 style="font-size:15px; margin:0;">${title}</h2>
        <div style="width:60px;"></div>
      </div>`;

    if (view === 'rate_history') return renderRateHistory(c, header('📈 रेट इतिहास'));
    if (view === 'nozzle') return renderNozzleTrend(c, header('⛽ नोज़ल ट्रेंड'));
    if (view === 'dashboard') return renderDashboardSub(c, header('📊 मंथली डैशबोर्ड'));
    if (view === 'bank') return renderBankSub(c, header('🏦 बैंक जमा'));
    if (view === 'invoices') return renderInvoicesSub(c, header('📄 खरीद बिल'));
    if (view === 'recovery') return renderRecoverySub(c, header('🚨 वसूली डैशबोर्ड'));
    if (view === 'customers') return renderCustomersSub(c, header('👥 सभी ग्राहक'));
    if (view === 'cibil') return renderCibilSub(c, header('⭐ पार्टी CIBIL'));
    if (view === 'vehicle') return renderVehicleSub(c, header('🚗 गाड़ी प्रोफाइल'));
    if (view === 'tanker') return renderTankerSub(c, header('🚛 टैंकर रिपोर्ट'));
    if (view === 'orders') return renderOrdersSub(c, header('📦 शॉप ऑर्डर'));
    if (view === 'staff') return renderStaffSub(c, header('👨‍💼 स्टाफ'));
    if (view === 'vendors') return renderVendorsSub(c, header('🏢 कंपनी सपोर्ट'));
    if (view === 'audit') return renderAuditSub(c, header('🔍 ऑडिट लॉग'));
    c.innerHTML = '<p class="text-mut" style="text-align:center;padding:40px;">Coming soon</p>';
  }

  function renderRateHistory(c, header) {
    const invs = allInvoices.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0, 30);
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">दिन-वार खरीद रेट</h3>
        ${invs.map(i => `<div class="item-row"><span>${dmy(i.date)} · <b>${i.fuelType === 'petrol' ? 'P' : 'D'}</b></span><b>₹${Number(i.purchaseRate).toFixed(2)}</b></div>`).join('') || '<p class="text-mut">डेटा नहीं</p>'}
      </div>`;
  }

  function renderNozzleTrend(c, header) {
    const nz = { p1:0, p2:0, p3:0, p4:0, d1:0, d2:0, d3:0, d4:0 };
    allDays.slice(0,30).forEach(d => {
      ['p1','p2','p3','p4','d1','d2','d3','d4'].forEach(k => {
        const x = (d.nz || {})[k]; if (x && x.o && x.c) nz[k] += Math.max(0, Number(x.c) - Number(x.o) - 5);
      });
    });
    const maxV = Math.max(...Object.values(nz), 1);
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">पिछले 30 दिन का टोटल</h3>
        ${Object.keys(nz).map(k => `<div style="margin-top:10px;"><div style="display:flex; justify-content:space-between; font-size:12px;"><b>${k.toUpperCase()}</b><span>${lit(nz[k])}</span></div><div class="trend-bar"><div class="trend-fill" style="width:${(nz[k]/maxV)*100}%;"></div></div></div>`).join('')}
      </div>`;
  }

  function renderDashboardSub(c, header) {
    const thisMonth = today().slice(0,7);
    const mDays = allDays.filter(d => d.date.startsWith(thisMonth));
    const tmSale = mDays.reduce((a,d)=>a+Number(d.sum?.sale||0),0);
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">${thisMonth}</h3>
        <div class="item-row"><span class="text-mut">कुल बिक्री</span><b>${money(tmSale)}</b></div>
        <div class="item-row"><span class="text-mut">कुल दिन</span><b>${mDays.length}</b></div>
        <div class="item-row"><span class="text-mut">औसत</span><b>${money(tmSale/(mDays.length||1))}</b></div>
      </div>
      <div class="glass-card">
        <h3 style="font-size:14px;">दिन-वार</h3>
        ${mDays.map(d => `<div class="item-row"><span>${dmy(d.date)}</span><b>${money(d.sum?.sale)}</b></div>`).join('')}
      </div>`;
  }

  function renderBankSub(c, header) {
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${allBankDeposits.map(b => `<div class="item-row" style="padding:12px 16px;"><div><div style="font-weight:600;">${money(b.amount)}</div><div class="text-mut" style="font-size:10px;">${dmy(b.date)} · ${esc(b.note||'')}</div></div></div>`).join('') || '<p class="text-mut" style="padding:16px; text-align:center;">कोई जमा नहीं</p>'}
      </div>`;
  }

  function renderInvoicesSub(c, header) {
    const invs = allInvoices.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        ${invs.map(i => `<div class="item-row"><span>${dmy(i.date)} · ${esc(i.supplier||'')} · ${i.fuelType === 'petrol' ? '⛽' : '🛢️'} ${lit(i.litres)}</span><b>₹${Number(i.purchaseRate).toFixed(2)}</b></div>`).join('') || '<p class="text-mut">कोई बिल नहीं</p>'}
      </div>`;
  }

  function renderRecoverySub(c, header) {
    const partyLast = {};
    allLedger.forEach(l => {
      if (l.kind === 'udhar' && l.partyId) {
        if (!partyLast[l.partyId] || l.date > partyLast[l.partyId]) partyLast[l.partyId] = l.date;
      }
    });
    const today_ms = new Date(today()+'T12:00:00').getTime();
    const aging = allParties.filter(p => Number(p.bal) > 0).map(p => {
      const last = partyLast[p.id];
      const days = last ? Math.round((today_ms - new Date(last+'T12:00:00').getTime())/86400000) : 999;
      return { ...p, days };
    }).sort((a,b) => b.days - a.days);

    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${aging.map(p => `
          <div class="item-row" style="padding:12px 16px; cursor:pointer;" onclick="showOwnerPartyLedger('${p.id}')">
            <div><div style="font-weight:600;">${esc(p.name)}</div><div class="text-mut" style="font-size:10px;">${p.days} दिन से</div></div>
            <div style="color:${p.days > 50 ? '#ff8888' : p.days > 30 ? '#f4b41a' : '#7ee0a0'}; font-weight:bold;">${money(p.bal)}</div>
          </div>
        `).join('') || '<p class="text-mut" style="padding:16px;">कोई बकाया नहीं</p>'}
      </div>`;
  }

  function renderCustomersSub(c, header) {
    const sorted = allParties.slice().sort((a,b) => Number(b.bal) - Number(a.bal));
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${sorted.map(p => `<div class="item-row" style="padding:12px 16px; cursor:pointer;" onclick="showOwnerPartyLedger('${p.id}')"><div><div style="font-weight:600;">${esc(p.name)}</div><div class="text-mut" style="font-size:10px;">${esc(p.phone||'')}</div></div><div style="color:${Number(p.bal) > 0 ? '#ff8888' : '#7ee0a0'}; font-weight:bold;">${money(p.bal)}</div></div>`).join('')}
      </div>`;
  }

  function renderCibilSub(c, header) {
    // Simplified: sort by balance
    const sorted = allParties.filter(p=>Number(p.bal)>0).sort((a,b)=>Number(b.bal)-Number(a.bal));
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        <p class="text-mut" style="font-size:12px;">जो पार्टी ज्यादा बकाया रख रही है, वो risk में है</p>
        ${sorted.map(p => `<div class="item-row" style="cursor:pointer;" onclick="showOwnerPartyLedger('${p.id}')"><div><b>${esc(p.name)}</b></div><span class="chip r">${money(p.bal)}</span></div>`).join('')}
      </div>`;
  }

  function renderVehicleSub(c, header) {
    const vehicles = {};
    allParties.forEach(p => (p.vehicles || []).forEach(v => { vehicles[v] = { no: v, party: p.name }; }));
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        ${Object.values(vehicles).slice(0, 50).map(v => `<div class="item-row"><span>🚗 ${esc(v.no)}</span><span class="text-mut" style="font-size:11px;">${esc(v.party)}</span></div>`).join('') || '<p class="text-mut">कोई गाड़ी नहीं</p>'}
      </div>`;
  }

  function renderTankerSub(c, header) {
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${allTankers.slice(0, 20).map(t => {
          const dP = t.result?.petrol?.diff || 0;
          const dD = t.result?.diesel?.diff || 0;
          return `<div class="item-row" style="padding:12px 16px;"><div><div style="font-weight:600; font-size:12px;">${dmy(t.date)}</div><div class="text-mut" style="font-size:10px;">🚛 ${esc(t.tankerNo||'?')} · 👤 ${esc(t.driverName||'?')}</div></div><div style="text-align:right; font-size:11px;"><div style="color:${dP < -5 ? '#ff8888' : '#7ee0a0'};">P: ${dP.toFixed(1)}L</div><div style="color:${dD < -5 ? '#ff8888' : '#7ee0a0'};">D: ${dD.toFixed(1)}L</div></div></div>`;
        }).join('') || '<p class="text-mut" style="padding:16px;">कोई रिपोर्ट नहीं</p>'}
      </div>`;
  }

  function renderOrdersSub(c, header) {
    const pending = allShopOrders.filter(o => o.status === 'paid_awaiting_delivery' || o.status === 'paid');
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${pending.map(o => `<div class="item-row" style="padding:12px 16px;"><div><div style="font-weight:600;">${esc(o.productName)} × ${o.qty}</div><div class="text-mut" style="font-size:10px;">${esc(o.partyName)}</div></div><b style="color:#f4b41a;">${money(o.totalAmount)}</b></div>`).join('') || '<p class="text-mut" style="padding:16px;">कोई pending ऑर्डर नहीं</p>'}
      </div>`;
  }

  function renderStaffSub(c, header) {
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">📋 Active Runsheet</h3>
        ${allRunsheets.map(r => `<div class="item-row"><span>${esc(r.salesmanName)} · ${r.startTime}</span><b class="chip o">चालू</b></div>`).join('') || '<p class="text-mut" style="font-size:12px;">कोई active नहीं</p>'}
      </div>
      <div class="glass-card">
        <h3 style="font-size:14px;">💵 Pending Cash</h3>
        ${allCashSubs.filter(x=>x.status==='pending').map(x => `<div class="item-row"><span>${esc(x.salesmanName)}<div class="text-mut" style="font-size:10px;">${dmy(x.date)}</div></span><b style="color:#f4b41a;">${money(x.total)}</b></div>`).join('') || '<p class="text-mut" style="font-size:12px;">सब clear</p>'}
      </div>
      <div class="glass-card">
        <h3 style="font-size:14px;">👷 Workers</h3>
        ${allWorkers.filter(w=>w.active!==false).map(w => `<div class="item-row"><span>${esc(w.name)}</span><b class="text-mut" style="font-size:11px;">₹${w.salary}/माह</b></div>`).join('') || '<p class="text-mut">कोई वर्कर नहीं</p>'}
      </div>
    `;
  }

  function renderVendorsSub(c, header) {
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${allVendors.map(v => `<div class="item-row" style="padding:12px 16px; cursor:pointer;" onclick="window.openVendorIssue('${v.id}')"><div><div style="font-weight:600;">${esc(v.name)}</div><div class="text-mut" style="font-size:10px;">${esc(v.category||'')}</div></div><span style="color:var(--text-mut);">›</span></div>`).join('')}
      </div>`;
  }

  function renderAuditSub(c, header) {
    c.innerHTML = header + `
      <div class="glass-card" style="margin-top:16px; padding:0; overflow:hidden;">
        ${allAudit.slice(0, 30).map(a => `<div class="item-row" style="padding:10px 16px;"><div><div style="font-weight:600; font-size:12px;">${esc(a.action)}</div><div class="text-mut" style="font-size:10px;">${esc(a.by)} · ${a.at?.toDate?.().toLocaleString('hi-IN') || ''}</div></div></div>`).join('') || '<p class="text-mut" style="padding:16px;">कोई log नहीं</p>'}
      </div>`;
  }

  console.log('[Owner Portal v5] loaded ✓ (Ultimate Rich)');
})();
