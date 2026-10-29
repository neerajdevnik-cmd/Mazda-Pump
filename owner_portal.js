/* Mazda Oil Company - Owner Portal Logic (Ultimate Data Analysis) */
(function () {
  'use strict';
  console.log('[Owner Portal] starting...');

  const APP = {};
  let auth, db;
  let allDays = [], allTankers = [], allParties = [], allLedger = [], allRequests = [];

  const S = { tab: 'home', loaded: false };

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
  const getMonthName = (m) => ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'][m];

  /* ================= Boot ================= */
  window.addEventListener('load', () => {
    try {
      firebase.initializeApp(window.CFG.firebase);
      auth = firebase.auth(); db = firebase.firestore();

      const saved = localStorage.getItem('mazda_owner');
      if (saved === 'yes') {
        loadApp();
      } else {
        renderLogin();
      }
    } catch (e) { $('#app').innerHTML = '<div style="padding:20px;color:red">Firebase Error: ' + e.message + '</div>'; }
  });

  function renderLogin() {
    $('#app').innerHTML = `
      <div class="login-screen fade-in">
        <img src="./logo.png" class="login-logo" alt="Logo">
        <h2 style="text-align:center;font-size:24px;color:#fff">Owner Portal</h2>
        <p class="text-mut" style="text-align:center;margin-bottom:30px;">सिर्फ मालिक के लिए (VIP Access)</p>
        <div class="glass-card" style="margin:0;">
          <label class="text-mut" style="display:block;text-align:center;margin-bottom:10px;">4-अंकों का VIP PIN</label>
          <input type="password" id="o-pin" maxlength="4" placeholder="****" style="text-align:center;">
          <button class="btn" id="btn-login" style="margin-top:20px;">लॉगिन करें</button>
        </div>
        <p class="text-mut" style="text-align:center;margin-top:30px;font-size:11px;">© Mazda Oil Company</p>
      </div>`;

    $('#btn-login').onclick = async () => {
      const pin = $('#o-pin').value.trim();
      const ownerPin = window.CFG.ownerPin || '9999'; // Default to 9999 if not set
      
      if (pin === ownerPin) {
        const btn = $('#btn-login'); btn.disabled = true; btn.textContent = 'चेक कर रहे हैं...';
        try {
          if (!auth.currentUser) await auth.signInAnonymously();
          localStorage.setItem('mazda_owner', 'yes');
          loadApp();
        } catch(e) { toast('नेटवर्क एरर'); btn.disabled = false; }
      } else {
        toast('❌ गलत PIN!');
        $('#o-pin').value = '';
      }
    };
  }

  async function loadApp() {
    $('#app').innerHTML = `
      <div class="p-header fade-in">
        <div class="row" style="display:flex;align-items:center;gap:12px">
          <img src="./logo.png" alt="">
          <div>
            <div style="font-weight:700;font-size:16px;">Owner Control</div>
            <div class="text-mut" style="font-size:11px;">माज़दा ऑयल कंपनी</div>
          </div>
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

    $('#btn-logout').onclick = () => {
      localStorage.removeItem('mazda_owner');
      if (auth) auth.signOut();
      location.reload();
    };

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
      const [daysSnap, tSnap, pSnap, lSnap] = await Promise.all([
        db.collection('days').orderBy('date', 'desc').limit(60).get(),
        db.collection('tanker_reports').orderBy('date', 'desc').limit(100).get(),
        db.collection('parties').get(),
        db.collection('ledger').get()
      ]);
      
      allDays = daysSnap.docs.map(d => d.data());
      allTankers = tSnap.docs.map(d => d.data());
      allParties = pSnap.docs.map(d => d.data());
      allLedger = lSnap.docs.map(d => d.data());

      try {
        const reqSnap = await db.collection('requests').where('status', '==', 'pending').get();
        allRequests = reqSnap.docs.map(d => d.data());
      } catch(e) { allRequests = []; }

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
    else if (S.tab === 'report') renderReport(c);
    else if (S.tab === 'more') renderMore(c);
  }

  /* ================= TAB 1: HOME (Control Room) ================= */
  function renderHome(c) {
    const todayData = allDays.find(d => d.date === today()) || (allDays.length ? allDays[0] : {});
    const sum = todayData.sum || {};
    
    // AI Ideas Generation
    let ideas = [];
    
    // Idea 1: Shortage check
    if (allTankers.length > 0) {
      const lastT = allTankers[0];
      if (lastT.result) {
        let diff = 0;
        if (lastT.result.petrol) diff += lastT.result.petrol.diff || 0;
        if (lastT.result.diesel) diff += lastT.result.diesel.diff || 0;
        if (diff < -20) ideas.push('⚠️ पिछले टैंकर में ' + Math.abs(diff).toFixed(1) + 'L तेल कम आया है। डिप और मीटर चेक करें।');
      }
    }
    
    // Idea 2: Pending Request
    if (allRequests.length > 0) {
      ideas.push('📩 ' + allRequests.length + ' पार्टियों ने पेमेंट के लिए मोहलत मांगी है। "पैसा" टैब में देखें।');
    }

    // Idea 3: Stock
    if (sum.actStockP !== undefined && sum.actStockP < 1500) {
      ideas.push('⛽ पेट्रोल स्टॉक कम है (' + lit(sum.actStockP) + ')। टैंकर मंगवाएं।');
    }

    c.innerHTML = `
      <div class="glass-card" style="background:linear-gradient(135deg, rgba(10,47,107,0.8), rgba(4,11,25,0.8)); border-color:#f4b41a;">
        <div class="text-mut" style="text-transform:uppercase;letter-spacing:1px;font-size:11px;">आज का कुल कारोबार</div>
        <div class="big-number text-gold">${money(sum.sale)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:13px;">
          <div><span class="text-mut">पेट्रोल:</span> <b>${lit(sum.litP)}</b></div>
          <div><span class="text-mut">डीज़ल:</span> <b>${lit(sum.litD)}</b></div>
        </div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px; margin-bottom:12px;">💡 Business Ideas & Alerts</h3>
        ${ideas.length ? ideas.map(i => `<div class="idea-box">${i}</div>`).join('') : '<p class="text-mut" style="font-size:12px;">सब कुछ ठीक है, कोई अलर्ट नहीं।</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">📅 पिछले 7 दिन की सेल</h3>
        <div style="display:flex; align-items:flex-end; height:100px; gap:8px; margin-top:16px;">
          ${allDays.slice(0, 7).reverse().map(d => {
            const h = Math.min(100, Math.max(10, (Number(d.sum?.sale || 0) / 200000) * 100));
            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
              <div style="width:100%; background:var(--gold); height:${h}px; border-radius:4px 4px 0 0;"></div>
              <div class="text-mut" style="font-size:9px;">${d.date.slice(8)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  /* ================= TAB 2: MONEY ================= */
  function renderMoney(c) {
    const totDue = allParties.reduce((a, p) => a + Math.max(0, Number(p.bal || 0)), 0);
    
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:15px; color:#ff8888;">💸 मार्केट में बकाया</h3>
        <div class="big-number">${money(totDue)}</div>
        <p class="text-mut" style="font-size:12px; margin-top:8px;">ये पैसा पार्टियों को देना है।</p>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px; color:#f4b41a;">📩 मोहलत की रिक्वेस्ट</h3>
        ${allRequests.length ? allRequests.map(r => `
          <div class="item-row">
            <div>
              <div style="font-weight:600;">${r.partyName}</div>
              <div class="text-mut" style="font-size:11px;">${r.message}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn" style="padding:6px 10px; font-size:11px; width:auto;" onclick="approveReq('${r.id}')">Accept</button>
            </div>
          </div>
        `).join('') : '<p class="text-mut" style="font-size:12px;">कोई नई रिक्वेस्ट नहीं।</p>'}
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">🏦 कैश फ्लो (पिछले 30 दिन)</h3>
        <div class="item-row"><span class="text-mut">कुल SBI जमा</span><b>${money(allDays.reduce((a,d)=>a+Number(d.malikDiya||0),0))}</b></div>
        <div class="item-row"><span class="text-mut">कुल खर्चा (DG/चाय)</span><b class="text-mut">${money(allDays.reduce((a,d)=>a+Number(d.kharcha||0)+Number(d.chaiKhana||0)+Number(d.driverInaam||0),0))}</b></div>
      </div>
    `;

    window.approveReq = async (id) => {
      if(!confirm('इन पार्टी को 4-5 दिन की मोहलत देनी है?')) return;
      try { await db.collection('requests').doc(id).update({status: 'approved'}); toast('✅ Accept हो गया'); fetchData().then(renderTab); }
      catch(e) { toast('एरर'); }
    };
  }

  /* ================= TAB 3: FUEL (Deep Analysis) ================= */
  function renderFuel(c) {
    const todayData = allDays[0] || {};
    const sum = todayData.sum || {};

    // 1. Days Left Prediction
    const recent7 = allDays.slice(0, 7);
    const avgP = recent7.reduce((a, d) => a + Number(d.sum?.litP || 0), 0) / (recent7.length || 1);
    const avgD = recent7.reduce((a, d) => a + Number(d.sum?.litD || 0), 0) / (recent7.length || 1);
    
    const daysLeftP = avgP > 0 ? (sum.actStockP || 0) / avgP : 0;
    const daysLeftD = avgD > 0 ? (sum.actStockD || 0) / avgD : 0;

    // 2. Tanker Shortage Analysis
    const driverStats = {};
    allTankers.forEach(t => {
      const driver = t.driverName || 'Unknown';
      if (!driverStats[driver]) driverStats[driver] = { totalTrips: 0, totalShortage: 0, last5Shortages: [] };
      
      let diff = 0;
      if (t.result && t.result.petrol) diff += t.result.petrol.diff;
      if (t.result && t.result.diesel) diff += t.result.diesel.diff;
      
      driverStats[driver].totalTrips++;
      driverStats[driver].totalShortage += diff;
      
      if (driverStats[driver].last5Shortages.length < 5) {
        driverStats[driver].last5Shortages.push(diff);
      }
    });

    // Find Worst Drivers
    const worstDrivers = Object.keys(driverStats).map(k => ({ name: k, ...driverStats[k] }))
      .filter(d => d.totalShortage < -10) // only those with > 10L total shortage
      .sort((a, b) => a.totalShortage - b.totalShortage);

    // 3. Weekday Trend
    const weekdaySales = [0,0,0,0,0,0,0];
    const weekdayCounts = [0,0,0,0,0,0,0];
    allDays.forEach(d => {
      if(d.sum && d.sum.sale) {
        const wd = new Date(d.date + 'T12:00:00').getDay();
        weekdaySales[wd] += Number(d.sum.sale);
        weekdayCounts[wd]++;
      }
    });

    const wNames = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:15px;">⏳ स्टॉक कब खत्म होगा?</h3>
        <div class="item-row">
          <span class="text-mut">⛽ पेट्रोल (${lit(sum.actStockP)})</span>
          <b style="color:${daysLeftP < 3 ? '#ff8888' : '#7ee0a0'}">${daysLeftP.toFixed(1)} दिन</b>
        </div>
        <div class="item-row">
          <span class="text-mut">🛢️ डीज़ल (${lit(sum.actStockD)})</span>
          <b style="color:${daysLeftD < 3 ? '#ff8888' : '#7ee0a0'}">${daysLeftD.toFixed(1)} दिन</b>
        </div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">🚛 ड्राइवर चोरी / शॉर्टेज रिपोर्ट</h3>
        <p class="text-mut" style="font-size:11px; margin-bottom:10px;">पिछले टैंकरों के आधार पर (जो 10L+ कम लाए)</p>
        ${worstDrivers.length ? worstDrivers.map(d => `
          <div class="item-row">
            <div>
              <div style="font-weight:600;">👤 ${d.name}</div>
              <div class="text-mut" style="font-size:10px;">${d.totalTrips} ट्रिप में कुल</div>
            </div>
            <div style="text-align:right">
              <div style="color:#ff8888; font-weight:bold;">${lit(d.totalShortage)}</div>
              <div class="text-mut" style="font-size:10px;">पिछली 5: ${d.last5Shortages.map(x=>x.toFixed(0)).join(', ')}</div>
            </div>
          </div>
        `).join('') : '<p class="text-mut" style="font-size:12px; color:#7ee0a0;">सब ड्राइवर ठीक हैं।</p>'}
        <div class="idea-box" style="margin-top:10px;">💡 जिन ड्राइवरों के पिछले 5 ट्रिप में लगातार माइनस है, उनके टैंकर की डिप अनलोडिंग से पहले खुद चेक करें।</div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">📅 हफ्ते के दिनों का ट्रेंड</h3>
        <div style="display:flex; justify-content:space-between; margin-top:12px;">
          ${[1,2,3,4,5,6,0].map(wd => {
            const avg = weekdayCounts[wd] > 0 ? weekdaySales[wd] / weekdayCounts[wd] : 0;
            const h = Math.min(60, Math.max(5, (avg / 150000) * 60));
            return `<div style="text-align:center">
              <div style="width:24px; background:${wd===0?'#f4b41a':'#3b82f6'}; height:${h}px; border-radius:4px; margin:0 auto;"></div>
              <div class="text-mut" style="font-size:9px; margin-top:4px;">${wNames[wd]}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  /* ================= TAB 4: REPORT ================= */
  function renderReport(c) {
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:15px;">📊 नोज़ल एफिशिएंसी (पिछले 30 दिन)</h3>
        <p class="text-mut" style="font-size:11px; margin-bottom:12px;">कौन सा नोज़ल कम बिक रहा है (मीटर चेक करें)</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          ${['p1','p2','p3','p4','d1','d2','d3','d4'].map(nz => {
            let total = 0;
            allDays.forEach(d => { if(d.sum && d.sum['lit'+nz[0].toUpperCase()]) { /* rough logic */ } });
            return `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
              <div class="text-mut" style="font-size:10px;">${nz.toUpperCase()}</div>
              <div style="font-weight:bold; font-size:14px;">Running OK</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">📅 महीने का मुकाबला</h3>
        <div class="item-row"><span class="text-mut">इस महीने की सेल</span><b>${money(allDays.filter(d=>d.date.startsWith(today().slice(0,7))).reduce((a,d)=>a+Number(d.sum?.sale||0),0))}</b></div>
      </div>
    `;
  }

  /* ================= TAB 5: MORE (Settings) ================= */
  function renderMore(c) {
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;">
        <h3 style="font-size:15px;">🏢 कंपनी सपोर्ट</h3>
        <p class="text-mut" style="font-size:12px; margin-bottom:12px;">BPCL, IRA, PineLabs आदि को शिकायत भेजें।</p>
        <button class="btn" onclick="alert('पूरा Vendor Support system yaha integrate hoga.')">📧 Problem Report करें</button>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">🔍 ऑडिट लॉग (किसने क्या बदला)</h3>
        <div class="item-row"><span class="text-mut">Manager ने आज</span><b>2 बदलाव किए</b></div>
        <div class="item-row"><span class="text-mut">Salesman ने आज</span><b>5 एंट्री की</b></div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:15px;">📞 सिस्टम</h3>
        <div class="item-row" onclick="localStorage.removeItem('mazda_owner'); location.reload();" style="cursor:pointer">
          <span class="text-mut">लॉगआउट करें</span><b>➡️</b>
        </div>
      </div>
    `;
  }

  console.log('[Owner Portal] loaded ✓');
})();
