/* Mazda Oil Company - Ultimate Owner Portal (God Mode) */
(function () {
  'use strict';
  console.log('[Owner Portal] v7 starting...');

  let auth, db;
  let allDays = [], allTankers = [], allParties = [], allLedger = [], allRequests = [], allVendors = [], allRateReqs = [], allWorkers = [], allSalaries = [], allBankDeposits = [];

  const S = { tab: 'home', loaded: false };

  /* ================= Icons ================= */
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M4 4v16M10 20v-8M16 20V8M22 20V4"/></svg>',
    parties: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
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
  const dmy = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const wNames = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

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
        <h2 style="text-align:center;font-size:24px;color:#fff">Owner Control</h2>
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
        <button data-tab="reports">${ICONS.reports} रिपोर्ट</button>
        <button data-tab="parties">${ICONS.parties} पार्टी</button>
        <button data-tab="money">${ICONS.money} पैसा</button>
        <button data-tab="more">${ICONS.more} और</button>
      </div>
    `;

    $('#btn-logout').onclick = () => { localStorage.removeItem('mazda_owner'); if (auth) auth.signOut(); location.reload(); };

    $$('.p-nav button').forEach(b => b.onclick = () => {
      $$('.p-nav button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      S.tab = b.dataset.tab;
      renderTab();
    });

    await fetchData();
    renderTab();
  }

  async function fetchData() {
    try {
      const [dSnap, tSnap, pSnap, lSnap, vSnap, reqSnap, rReqSnap, wSnap, salSnap, bdSnap, rtSnap] = await Promise.all([
        db.collection('days').orderBy('date', 'desc').limit(90).get(),
        db.collection('tanker_reports').orderBy('date', 'desc').limit(20).get(),
        db.collection('parties').get(),
        db.collection('ledger').get(),
        db.collection('vendors').get(),
        db.collection('requests').where('status', '==', 'pending').get().catch(()=>({docs:[]})),
        db.collection('rate_requests').where('status', '==', 'pending').get().catch(()=>({docs:[]})),
        db.collection('workers').get().catch(()=>({docs:[]})),
        db.collection('salary_payments').orderBy('date', 'desc').limit(20).get().catch(()=>({docs:[]})),
        db.collection('bank_deposits').orderBy('date', 'desc').limit(20).get().catch(()=>({docs:[]})),
        db.collection('rate_history').orderBy('date', 'desc').limit(10).get().catch(()=>({docs:[]}))
      ]);
      
      allDays = dSnap.docs.map(d => d.data());
      allTankers = tSnap.docs.map(d => d.data());
      allParties = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allLedger = lSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allVendors = vSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allRequests = reqSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allRateReqs = rReqSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allWorkers = wSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allSalaries = salSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allBankDeposits = bdSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(x => !x.removed);

      S.loaded = true;
    } catch (e) { toast('डेटा लोड नहीं हुआ: ' + e.message); }
  }

  function renderTab() {
    const c = $('#p-content');
    c.className = 'fade-in';
    if (!S.loaded) { c.innerHTML = '<p class="text-mut" style="text-align:center;padding:40px;">Data analyse हो रहा है...</p>'; return; }

    if (S.tab === 'home') renderHome(c);
    else if (S.tab === 'reports') renderReports(c);
    else if (S.tab === 'parties') renderParties(c);
    else if (S.tab === 'money') renderMoney(c);
    else if (S.tab === 'more') renderMore(c);
  }

  /* ================= HOME ================= */
  function renderHome(c) {
    const todayData = allDays.find(d => d.date === today()) || (allDays.length ? allDays[0] : {});
    const sum = todayData.sum || {};
    const thisMonth = today().slice(0,7);
    const monthDays = allDays.filter(d => d.date.startsWith(thisMonth));
    const monthSale = monthDays.reduce((a,d) => a + Number(d.sum?.sale || 0), 0);
    const totDue = allParties.reduce((a,p) => a + Math.max(0, Number(p.bal || 0)), 0);
    const totalReqs = allRequests.length + allRateReqs.length;

    let ideas = [];
    if (totalReqs > 0) ideas.push('📩 ' + totalReqs + ' नई रिक्वेस्ट्स बाकी हैं (और टैब में देखें)');
    if (sum.actStockP !== undefined && sum.actStockP < 1500) ideas.push('⛽ पेट्रोल स्टॉक कम है (' + (sum.actStockP) + 'L)');
    if (sum.actStockD !== undefined && sum.actStockD < 1000) ideas.push('🛢️ डीज़ल स्टॉक कम है (' + (sum.actStockD) + 'L)');

    const last7 = allDays.slice(0, 7).reverse();
    const maxSale = Math.max(...last7.map(d => Number(d.sum?.sale || 0)), 1);

    c.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 16px;">
        <div class="glass-card" style="margin:0; padding:12px;">
          <div class="text-mut" style="font-size:10px; text-transform:uppercase;">आज की बिक्री</div>
          <div style="font-size:20px; font-weight:800; color:var(--gold); margin-top:4px;">${money(sum.sale)}</div>
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

      ${ideas.length ? `
      <div class="glass-card">
        <h3 style="font-size:14px;">💡 Business Alerts</h3>
        ${ideas.map(i => `<div class="idea-box">${i}</div>`).join('')}
      </div>` : ''}

      <div class="glass-card">
        <h3 style="font-size:14px;">📊 पिछले 7 दिन की सेल</h3>
        <div style="display:flex; align-items:flex-end; height:110px; gap:6px; margin-top:14px;">
          ${last7.map(d => {
            const h = Math.max(8, (Number(d.sum?.sale || 0) / maxSale) * 90);
            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;">
              <div style="width:100%; background:linear-gradient(180deg, var(--gold), var(--gold-dark)); height:${h}px; border-radius:4px 4px 0 0;"></div>
              <div class="text-mut" style="font-size:9px;">${d.date.slice(8)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  /* ================= REPORTS ================= */
  function renderReports(c) {
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">📅 Daily Hisab (Purani Date Dekhein)</h3>
        <div style="display:flex; gap:10px; margin-top:10px;">
          <input type="date" id="r-date" value="${today()}" style="flex:1; padding:10px; border-radius:10px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2);">
          <button class="btn g" onclick="window.showDayReport(document.getElementById('r-date').value)">देखें</button>
        </div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">⛽ Nozzle Trend (30 दिन)</h3>
        ${['p1','p2','p3','p4','d1','d2','d3','d4'].map(k => {
           let sum = 0;
           allDays.slice(0,30).forEach(d => { if(d.nz && d.nz[k] && d.nz[k].o && d.nz[k].c) sum += Math.max(0, Number(d.nz[k].c) - Number(d.nz[k].o) - 5); });
           return `<div class="item-row"><span>${k.toUpperCase()}</span><b>${sum.toFixed(0)} L</b></div>`;
        }).join('')}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">📊 हफ्ते के दिन का औसत</h3>
        ${[1,2,3,4,5,6,0].map(wd => {
          const days = allDays.filter(d => new Date(d.date + 'T12:00:00').getDay() === wd && d.sum);
          const avg = days.length ? days.reduce((a,b) => a + Number(b.sum.sale || 0), 0) / days.length : 0;
          return `<div class="item-row"><span>${wNames[wd]}वार</span><b>${money(avg)}</b></div>`;
        }).join('')}
      </div>
    `;
  }

  window.showDayReport = (date) => {
    const day = allDays.find(d => d.date === date);
    if (!day) return toast('इस तारीख का कोई हिसाब नहीं मिला');
    const o = day.sum || {};
    
    const m = showModal(`
      <h3 style="color:var(--gold); margin-bottom:12px;">📅 ${dmy(date)} का हिसाब</h3>
      
      <div class="item-row"><span class="text-mut">कुल बिक्री</span><b>${money(o.sale)}</b></div>
      <div class="item-row"><span class="text-mut">पेट्रोल</span><b>${o.litP || 0} L</b></div>
      <div class="item-row"><span class="text-mut">डीज़ल</span><b>${o.litD || 0} L</b></div>
      
      <div style="margin-top:16px; margin-bottom:8px; font-weight:700; color:var(--gold);">💰 कैश हिसाब</div>
      <div class="item-row"><span class="text-mut">असली बचा कैश (Close)</span><b style="color:#7ee0a0;">${money(o.close)}</b></div>
      <div class="item-row"><span class="text-mut">पिछला कैश (AD)</span><b>${money(o.openCash)}</b></div>
      
      <div style="margin-top:16px; margin-bottom:8px; font-weight:700; color:var(--gold);">🛢️ स्टॉक</div>
      <div class="item-row"><span class="text-mut">पेट्रोल स्टॉक (असली)</span><b>${o.actStockP || 0} L</b></div>
      <div class="item-row"><span class="text-mut">डीज़ल स्टॉक (असली)</span><b>${o.actStockD || 0} L</b></div>
      
      <button onclick="this.closest('.p-nav').parentNode.remove()" class="btn" style="margin-top:20px; background:rgba(255,255,255,0.1); color:#fff; width:100%;">बंद करें</button>
    `);
  };

  /* ================= PARTIES ================= */
  function renderParties(c) {
    const sortedParties = allParties.slice().sort((a,b) => Number(b.bal) - Number(a.bal));
    
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px; padding:10px;">
        <input id="p-search" placeholder="पार्टी खोजें..." style="width:100%; border-radius:10px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.1); color:#fff; padding:10px;">
      </div>
      <div id="p-list" style="margin-top:12px;"></div>
    `;

    const drawList = (search = '') => {
      const filtered = sortedParties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.vehicles || []).join(' ').toLowerCase().includes(search.toLowerCase()));
      $('#p-list').innerHTML = filtered.map(p => {
        const b = Number(p.bal);
        const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN') : '+₹' + Math.abs(b).toLocaleString('en-IN'));
        const cls = b > 0 ? '#ff8888' : (b < 0 ? '#7ee0a0' : 'inherit');
        
        return `
          <div class="glass-card" style="padding:12px; margin-bottom:8px; cursor:pointer;" onclick="window.showOwnerPartyLedger('${p.id}')">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; font-size:14px;">${esc(p.name)}</div>
                <div class="text-mut" style="font-size:11px;">${esc(p.phone || 'फोन नहीं')}</div>
              </div>
              <div style="font-size:16px; font-weight:800; color:${cls};">${disp}</div>
            </div>
          </div>
        `;
      }).join('') || '<p class="text-mut" style="text-align:center;">कोई पार्टी नहीं मिली</p>';
    };

    drawList();
    $('#p-search').oninput = (e) => drawList(e.target.value);
  }

  window.showOwnerPartyLedger = (pid) => {
    const party = allParties.find(p => p.id === pid);
    if (!party) return;
    const entries = allLedger.filter(l => l.partyId === pid).sort((a,b) => ((b.date||'')+(b.time||'')).localeCompare((a.date||'')+(a.time||'')));
    let bal = 0; entries.forEach(e => { bal += (e.kind === 'udhar' ? Number(e.amount) : -Number(e.amount)); });
    
    const m = showModal(`
      <h3 style="color:var(--gold); margin-bottom:4px;">${esc(party.name)}</h3>
      <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div><div class="text-mut" style="font-size:11px;">कुल बकाया</div><div style="font-size:22px; color:#ff8888; font-weight:800; margin:0;">${money(bal)}</div></div>
      </div>
      <div style="max-height:45vh; overflow-y:auto; margin-bottom:16px;">
        ${entries.map(r => `
          <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between;">
            <div><div style="font-weight:600; font-size:13px;">${r.kind === 'udhar' ? (r.vehicle || 'गाड़ी') : 'जमा'}</div><div class="text-mut" style="font-size:10px;">${dmy(r.date)}</div></div>
            <div style="font-weight:bold; color:${r.kind === 'udhar' ? '#ff8888' : '#7ee0a0'};">${r.kind === 'udhar' ? '-' : '+'}${money(r.amount)}</div>
          </div>
        `).join('')}
      </div>
      <button onclick="this.closest('.p-nav').parentNode.remove()" class="btn" style="background:rgba(255,255,255,0.1); color:#fff; width:100%;">बंद करें</button>
    `);
  };

  /* ================= MONEY ================= */
  function renderMoney(c) {
    const cash30 = allDays.slice(0, 30);
    const totSBI = cash30.reduce((a,d)=>a+Number(d.malikDiya||0),0);
    const totPaytm = cash30.reduce((a,d)=>a+Number(d.paytm||0),0);
    const totSwipe = cash30.reduce((a,d)=>a+Number(d.swipe||0),0);
    const totKharcha = cash30.reduce((a,d)=>a+Number(d.kharcha||0)+Number(d.chaiKhana||0)+Number(d.driverInaam||0),0);

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">💰 कैश फ्लो (30 दिन)</h3>
        <div class="item-row"><span class="text-mut">SBI जमा</span><b style="color:#7ee0a0;">${money(totSBI)}</b></div>
        <div class="item-row"><span class="text-mut">Paytm/UPI</span><b>${money(totPaytm)}</b></div>
        <div class="item-row"><span class="text-mut">स्वाइप (Card)</span><b>${money(totSwipe)}</b></div>
        <div class="item-row"><span class="text-mut">कुल खर्चे</span><b style="color:#ff8888;">${money(totKharcha)}</b></div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">🏦 हाल के SBI जमा</h3>
        ${allBankDeposits.slice(0, 10).map(b => `<div class="item-row"><span>${dmy(b.date)}<div class="text-mut" style="font-size:10px;">${esc(b.note||'')}</div></span><b>${money(b.amount)}</b></div>`).join('') || '<p class="text-mut" style="font-size:12px;">कोई जमा नहीं</p>'}
      </div>

      <div class="glass-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h3 style="font-size:14px; margin:0;">👷 स्टाफ सैलरी</h3>
          <button class="btn sm g" onclick="window.paySalaryModal()">+ सैलरी दें</button>
        </div>
        ${allSalaries.slice(0, 5).map(s => `<div class="item-row"><span>${esc(s.workerName)}<div class="text-mut" style="font-size:10px;">${dmy(s.date)}</div></span><b style="color:#ff8888;">-${money(s.amount)}</b></div>`).join('') || '<p class="text-mut" style="font-size:12px;">कोई सैलरी पेमेंट नहीं</p>'}
      </div>
    `;
  }

  window.paySalaryModal = () => {
    const m = showModal(`
      <h3>सैलरी पेमेंट</h3>
      <label class="text-mut">वर्कर चुनें</label>
      <select id="sal-w" style="width:100%; padding:10px; border-radius:8px; margin-bottom:10px;">
        ${allWorkers.map(w => `<option value="${w.id}" data-name="${w.name}">${w.name}</option>`).join('')}
      </select>
      <label class="text-mut">रकम (₹)</label>
      <input id="sal-a" type="number" style="width:100%; padding:10px; border-radius:8px; margin-bottom:10px;">
      <div style="display:flex; gap:10px; margin-top:20px;">
        <button class="btn g" id="sal-sv" style="flex:1;">सेव करें</button>
        <button class="btn w" onclick="this.closest('.p-nav').parentNode.remove()" style="flex:1;">रद्द</button>
      </div>
    `);
    m.sheet.querySelector('#sal-sv').onclick = async () => {
      const sel = m.sheet.querySelector('#sal-w');
      const wId = sel.value; const wName = sel.options[sel.selectedIndex].dataset.name;
      const amt = Number(m.sheet.querySelector('#sal-a').value);
      if(!amt) return toast('रकम डालें');
      try {
        await db.collection('salary_payments').add({ workerId: wId, workerName: wName, amount: amt, date: today(), paidBy: 'Owner' });
        toast('सैलरी सेव हो गई'); fetchData().then(() => { m.close(); renderTab(); });
      } catch(e) { toast('एरर: ' + e.message); }
    };
  };

  /* ================= MORE ================= */
  function renderMore(c) {
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px; color:var(--gold);">📈 रेट चेंज रिक्वेस्ट</h3>
        ${allRateReqs.length ? allRateReqs.map(r => `
          <div class="item-row">
            <div><div style="font-weight:600; font-size:13px;">P: ₹${r.petrol} | D: ₹${r.diesel}</div><div class="text-mut" style="font-size:10px;">${dmy(r.date)}</div></div>
            <div>
              <button class="btn sm g" onclick="window.approveRate('${r.id}', ${r.petrol}, ${r.diesel}, '${r.date}')">✔</button>
              <button class="btn sm r" onclick="window.rejectRate('${r.id}')">✖</button>
            </div>
          </div>
        `).join('') : '<p class="text-mut" style="font-size:12px;">कोई पेंडिंग रेट रिक्वेस्ट नहीं</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px; color:var(--gold);">⏰ पार्टी मोहलत रिक्वेस्ट</h3>
        ${allRequests.length ? allRequests.map(r => `
          <div class="item-row">
            <div><div style="font-weight:600; font-size:13px;">${esc(r.partyName)}</div><div class="text-mut" style="font-size:11px;">"${esc(r.message)}"</div></div>
            <div>
              <button class="btn sm g" onclick="window.approveReq('${r.id}')">✔</button>
              <button class="btn sm r" onclick="window.rejectReq('${r.id}')">✖</button>
            </div>
          </div>
        `).join('') : '<p class="text-mut" style="font-size:12px;">कोई पेंडिंग मोहलत रिक्वेस्ट नहीं</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:14px;">🏢 कंपनी सपोर्ट</h3>
        ${allVendors.map(v => `<div class="item-row"><span>${esc(v.name)}</span><b class="text-mut" style="font-size:11px;">${esc(v.category||'')}</b></div>`).join('') || '<p class="text-mut">कोई वेंडर नहीं</p>'}
      </div>

      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div class="item-row" style="padding:14px 16px; cursor:pointer;" onclick="localStorage.removeItem('mazda_owner'); firebase.auth().signOut().then(()=>location.reload())">
          <span style="font-size:13px; color:#ff8888;">🔓 लॉगआउट</span>
        </div>
      </div>
    `;
  }

  /* ================= ACTIONS ================= */
  window.approveRate = async (id, p, d, dt) => {
    if(!confirm('रेट चेंज अप्रूव करें?')) return;
    try {
      const b = db.batch();
      b.update(db.collection('rate_requests').doc(id), { status: 'approved', approvedAt: firebase.firestore.FieldValue.serverTimestamp() });
      b.set(db.collection('config').doc('rates'), { petrol: p, diesel: d, date: dt, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await b.commit();
      toast('✅ रेट अप्रूव हो गया'); fetchData().then(renderTab);
    } catch(e) { toast('एरर: ' + e.message); }
  };
  window.rejectRate = async (id) => {
    try { await db.collection('rate_requests').doc(id).update({ status: 'rejected' }); toast('रिजेक्ट किया'); fetchData().then(renderTab); } catch(e) {}
  };
  window.approveReq = async (id) => {
    try { await db.collection('requests').doc(id).update({ status: 'approved' }); toast('✅ अप्रूव हो गया'); fetchData().then(renderTab); } catch(e) {}
  };
  window.rejectReq = async (id) => {
    try { await db.collection('requests').doc(id).update({ status: 'rejected' }); toast('रिजेक्ट किया'); fetchData().then(renderTab); } catch(e) {}
  };

  console.log('[Owner Portal v7] loaded ✓');
})();
