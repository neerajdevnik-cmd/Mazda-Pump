/* Mazda Oil Company - Owner Portal Logic */
(function () {
  'use strict';
  let auth, db;
  let allDays = [], allTankers = [], allParties = [], allLedger = [], allRequests = [], allVendors = [], allRateReqs = [];
  const S = { tab: 'home', subView: null, loaded: false };

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><circle cx="12" cy="14" r="3"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M4 4v16M10 20v-8M16 20V8M22 20V4"/></svg>',
    req: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
  };

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
        <button data-tab="requests">${ICONS.req} रिक्वेस्ट</button>
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
      const [dSnap, tSnap, pSnap, lSnap, vSnap, reqSnap, rReqSnap] = await Promise.all([
        db.collection('days').orderBy('date', 'desc').limit(60).get(),
        db.collection('tanker_reports').orderBy('date', 'desc').limit(50).get(),
        db.collection('parties').get(),
        db.collection('ledger').get(),
        db.collection('vendors').get(),
        db.collection('requests').where('status', '==', 'pending').get().catch(()=>({docs:[]})),
        db.collection('rate_requests').where('status', '==', 'pending').get().catch(()=>({docs:[]}))
      ]);
      
      allDays = dSnap.docs.map(d => d.data());
      allTankers = tSnap.docs.map(d => d.data());
      allParties = pSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allLedger = lSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allVendors = vSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allRequests = reqSnap.docs.map(d => ({id: d.id, ...d.data()}));
      allRateReqs = rReqSnap.docs.map(d => ({id: d.id, ...d.data()}));

      S.loaded = true;
    } catch (e) { toast('डेटा लोड नहीं हुआ: ' + e.message); }
  }

  function renderTab() {
    const c = $('#p-content');
    c.className = 'fade-in';
    if (!S.loaded) { c.innerHTML = '<p class="text-mut" style="text-align:center;padding:40px;">Data analyse हो रहा है...</p>'; return; }

    if (S.tab === 'home') renderHome(c);
    else if (S.tab === 'money') renderMoney(c);
    else if (S.tab === 'fuel') renderFuel(c);
    else if (S.tab === 'requests') renderRequests(c);
    else if (S.tab === 'more') renderMore(c);
  }

  function renderHome(c) {
    const todayData = allDays.find(d => d.date === today()) || (allDays.length ? allDays[0] : {});
    const sum = todayData.sum || {};
    const thisMonth = today().slice(0,7);
    const monthDays = allDays.filter(d => d.date.startsWith(thisMonth));
    const monthSale = monthDays.reduce((a,d) => a + Number(d.sum?.sale || 0), 0);
    const totDue = allParties.reduce((a,p) => a + Math.max(0, Number(p.bal || 0)), 0);
    const totalReqs = allRequests.length + allRateReqs.length;

    let ideas = [];
    if (totalReqs > 0) ideas.push('📩 ' + totalReqs + ' नई रिक्वेस्ट्स बाकी हैं (देखें)');
    if (sum.actStockP !== undefined && sum.actStockP < 1500) ideas.push('⛽ पेट्रोल स्टॉक कम है (' + (sum.actStockP) + 'L)');

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
    `;
  }

  function renderMoney(c) {
    const totDue = allParties.reduce((a, p) => a + Math.max(0, Number(p.bal || 0)), 0);
    const sortedParties = allParties.filter(p => Number(p.bal) > 0).sort((a,b) => Number(b.bal) - Number(a.bal));

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <div class="text-mut" style="font-size:11px; text-transform:uppercase;">मार्केट में कुल बकाया</div>
        <div class="big-number" style="color:#ff8888;">${money(totDue)}</div>
        <div class="text-mut" style="font-size:11px; margin-top:4px;">${sortedParties.length} पार्टियों से लेना है</div>
      </div>

      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div style="padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.05);"><h3 style="font-size:14px; margin:0;">📒 सभी पार्टी (उधार वाले)</h3></div>
        <div style="max-height:60vh; overflow-y:auto;">
          ${sortedParties.map(p => `
            <div class="item-row" style="padding:12px 16px; cursor:pointer;" onclick="window.showOwnerPartyLedger('${p.id}')">
              <div><div style="font-weight:600; font-size:13px;">${esc(p.name)}</div><div class="text-mut" style="font-size:10px;">${esc(p.phone || '')}</div></div>
              <div style="font-weight:bold; color:#ff8888;">${money(p.bal)}</div>
            </div>
          `).join('') || '<p class="text-mut" style="text-align:center; padding:20px;">कोई बकाया नहीं</p>'}
        </div>
      </div>
    `;
  }

  function renderFuel(c) {
    const todayData = allDays.length ? allDays[0] : {};
    const sum = todayData.sum || {};
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:14px;">🛢️ आज का स्टॉक</h3>
        <div class="item-row"><span class="text-mut">⛽ पेट्रोल</span><b>${sum.actStockP || 0} L</b></div>
        <div class="item-row"><span class="text-mut">🛢️ डीज़ल</span><b>${sum.actStockD || 0} L</b></div>
      </div>
      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div style="padding:14px 16px;"><h3 style="font-size:14px; margin:0;">🚛 हाल के टैंकर</h3></div>
        ${allTankers.slice(0, 8).map(t => {
          const dP = t.result?.petrol?.diff || 0;
          const dD = t.result?.diesel?.diff || 0;
          return `<div class="item-row" style="padding:10px 16px;">
            <div><div style="font-weight:600; font-size:12px;">${dmy(t.date)} · ${esc(t.tankerNo||'?')}</div></div>
            <div style="text-align:right; font-size:11px;">
              <div style="color:${dP < -5 ? '#ff8888' : '#7ee0a0'};">P: ${dP.toFixed(1)}L</div>
              <div style="color:${dD < -5 ? '#ff8888' : '#7ee0a0'};">D: ${dD.toFixed(1)}L</div>
            </div>
          </div>`;
        }).join('') || '<p class="text-mut" style="padding:16px;">कोई टैंकर रिपोर्ट नहीं</p>'}
      </div>
    `;
  }

  function renderRequests(c) {
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
    `;
  }

  function renderMore(c) {
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px; background:linear-gradient(135deg, rgba(244,180,26,0.15), rgba(4,11,25,0.8)); border-color:var(--gold);">
        <div style="text-align:center;">
          <img src="./logo.png" style="width:50px; height:50px; border-radius:50%; border:2px solid var(--gold);">
          <div style="font-weight:800; font-size:16px; margin-top:8px;">माज़दा ऑयल कंपनी</div>
          <div class="text-mut" style="font-size:11px;">Owner Control Panel</div>
        </div>
      </div>
      <div class="glass-card" style="padding:0; overflow:hidden;">
        <div class="item-row" style="padding:14px 16px; cursor:pointer;" onclick="localStorage.removeItem('mazda_owner'); firebase.auth().signOut().then(()=>location.reload())">
          <span style="font-size:13px; color:#ff8888;">🔓 लॉगआउट</span>
        </div>
      </div>
    `;
  }

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
      <button onclick="this.closest('div').parentNode.remove()" class="btn" style="background:rgba(255,255,255,0.1); color:#fff;">बंद करें</button>
    `);
  };

  console.log('[Owner Portal] loaded ✓');
})();
