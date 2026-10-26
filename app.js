/* माज़दा ऑयल कंपनी - कोर ऐप कंट्रोलर */
(function () {
  'use strict';
  const C = window.CFG, K = window.Calc, num = K.num, r2 = K.r2;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const money = x => '₹' + r2(num(x)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const lit = x => r2(num(x)).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' L';
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dmy = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  const shiftDate = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const FUEL = { petrol: 'पेट्रोल', diesel: 'डीज़ल' };
  const MODE = { cash: 'नकद', paytm: 'Paytm/UPI', swipe: 'स्वाइप', bank: 'बैंक' };

  const APP = window.APP = {
    C, K, $, $$, esc, num, r2, money, lit, pad, todayISO, nowTime, dmy, shiftDate, FUEL, MODE,
    S: { role: null, user: null, salesman: null, date: null, tab: 'day', draft: {}, rates: { petrol: C.defaultRateP, diesel: C.defaultRateD }, range: 'month' },
    views: {}
  };
  const S = APP.S;
  let auth, db, FV;
  const isOwner = () => S.role === 'owner';
  const isSalesman = () => S.role === 'salesman';
  const isViewer = () => S.role === 'viewer';

  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3000);
  }
  function commit(p) { return Promise.race([p, new Promise(r => setTimeout(r, 2500))]); }
  function audit(action, detail) {
    try {
      const byUser = S.salesman ? (S.salesman.name + ' (Salesman)') : (S.user ? S.user.email : 'Unknown');
      db.collection('audit').add({ at: FV.serverTimestamp(), by: byUser, action, detail: JSON.stringify(detail || {}).slice(0, 3000) });
    } catch (e) { }
  }
  const errBox = e => '<div class="err">गड़बड़: ' + esc(e && e.message ? e.message : e) + '</div>';
  function modal(html) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = '<div class="sheet">' + html + '</div>';
    document.body.appendChild(m);
    m.addEventListener('mousedown', e => { if (e.target === m) m.remove(); });
    m.close = () => m.remove();
    return m;
  }
  Object.assign(APP, { toast, commit, audit, errBox, modal, isOwner, isSalesman, isViewer });

  async function getParties(priv, force) {
    const key = priv ? 'priv' : 'pub';
    S.parties = S.parties || {};
    if (!force && S.parties[key]) return S.parties[key];
    const snap = await db.collection(priv ? 'priv_parties' : 'parties').get();
    let arr = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hi'));
    S.parties[key] = arr; return arr;
  }
  const partyById = (priv, id) => ((S.parties || {})[priv ? 'priv' : 'pub'] || []).find(p => p.id === id);
  APP.getParties = getParties; APP.partyById = partyById;

  function loginView(msg) {
    $('#app').innerHTML = `
    <div class="login">
      <img src="./logo.png" alt="" style="display:block;width:120px;height:120px;margin:0 auto 12px;border-radius:50%">
      <h1 style="text-align:center">${esc(C.pump.name)}</h1>
      <p class="mut" style="text-align:center">${esc(C.pump.address)}</p>
      
      <div class="seg" style="margin:16px 0">
        <button id="tab-man" class="on">मालिक</button>
        <button id="tab-sm">सेल्समैन</button>
        <button id="tab-vw">मालिक-व्यू</button>
      </div>

      <div id="form-man">
        <label>यूज़रनेम (ईमेल)</label>
        <input id="em" placeholder="neeraj ya manager" autocomplete="username" autocapitalize="none">
        <label>पासवर्ड</label>
        <input id="pw" type="password" autocomplete="current-password">
        <div class="btns" style="margin-top:14px"><button class="btn full" id="go-btn">लॉगिन करें</button></div>
      </div>

      <div id="form-sm" style="display:none">
        <label>सेल्समैन चुनें</label>
        <select id="sm-sel">
          ${(C.salesmen || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
        <label>4-अंकों का PIN</label>
        <input id="sm-pin" type="password" pattern="[0-9]*" inputmode="numeric" maxlength="6" placeholder="अपना PIN दर्ज करें">
        <div class="btns" style="margin-top:14px"><button class="btn full g" id="go-sm">सेल्समैन लॉगिन</button></div>
      </div>

      <div id="form-vw" style="display:none">
        <label>मालिक व्यू कोड</label>
        <input id="vw-code" type="password" placeholder="कोड दर्ज करें" autocomplete="off">
        <div class="btns" style="margin-top:14px"><button class="btn full o" id="go-vw">देखने के लिए लॉगिन</button></div>
        <p class="mut" style="font-size:12px;margin-top:10px;text-align:center">केवल देख सकते हैं — कोई बदलाव नहीं</p>
      </div>

      ${msg ? '<div class="err" style="margin-top:10px">' + esc(msg) + '</div>' : ''}
    </div>`;

    $('#tab-man').onclick = () => {
      $('#tab-man').classList.add('on'); $('#tab-sm').classList.remove('on'); $('#tab-vw').classList.remove('on');
      $('#form-man').style.display = ''; $('#form-sm').style.display = 'none'; $('#form-vw').style.display = 'none';
    };
    $('#tab-sm').onclick = () => {
      $('#tab-sm').classList.add('on'); $('#tab-man').classList.remove('on'); $('#tab-vw').classList.remove('on');
      $('#form-sm').style.display = ''; $('#form-man').style.display = 'none'; $('#form-vw').style.display = 'none';
    };
    $('#tab-vw').onclick = () => {
      $('#tab-vw').classList.add('on'); $('#tab-man').classList.remove('on'); $('#tab-sm').classList.remove('on');
      $('#form-vw').style.display = ''; $('#form-man').style.display = 'none'; $('#form-sm').style.display = 'none';
    };

    $('#go-btn').onclick = async () => {
      localStorage.removeItem('mazda_viewer'); S.role = null;
      let em = $('#em').value.trim();
      if (!em.includes('@')) em = em.toLowerCase() + '@' + (C.loginDomain || 'mazda-pump.in');
      try { await auth.signInWithEmailAndPassword(em, $('#pw').value); }
      catch (e) { loginView('यूज़रनेम या पासवर्ड गलत है: ' + e.message); }
    };

    $('#go-sm').onclick = () => {
      localStorage.removeItem('mazda_viewer'); S.role = null;
      const smId = $('#sm-sel').value;
      const pin = $('#sm-pin').value.trim();
      const s = (C.salesmen || []).find(x => x.id === smId);
      if (s && s.pin === pin) {
        localStorage.setItem('mazda_sm', JSON.stringify(s));
        S.salesman = s;
        S.role = 'salesman';
        S.user = { email: s.id + '@salesman.mazda' };
        S.date = todayISO();
        shell();
      } else {
        loginView('गलत PIN दर्ज किया गया है!');
      }
    };

    $('#go-vw').onclick = async () => {
      const code = $('#vw-code').value.trim();
      if (code !== 'Mazda@123') return loginView('गलत व्यू कोड!');
      try { if (auth) await auth.signOut(); } catch (e) {}
      localStorage.removeItem('mazda_sm');
      localStorage.setItem('mazda_viewer', 'Mazda@123');
      S.salesman = null;
      S.role = 'viewer';
      S.user = { email: 'viewer@owner.local' };
      S.date = todayISO();
      shell();
    };
  }

  function boot() {
    firebase.initializeApp(C.firebase);
    auth = firebase.auth(); db = firebase.firestore(); FV = firebase.firestore.FieldValue;
    db.enablePersistence({ synchronizeTabs: true }).catch(() => { });
    APP.db = db; APP.auth = auth; APP.FV = FV;

    const savedViewer = localStorage.getItem('mazda_viewer');
    if (savedViewer === 'Mazda@123') {
      S.salesman = null;
      S.role = 'viewer';
      S.user = { email: 'viewer@owner.local' };
      S.date = todayISO();
      shell(); return;
    }

    const savedSM = localStorage.getItem('mazda_sm');
    if (savedSM) {
      try {
        const sm = JSON.parse(savedSM);
        S.salesman = sm; S.role = 'salesman'; S.user = { email: sm.id + '@salesman.mazda' }; S.date = todayISO();
        shell(); return;
      } catch (x) { localStorage.removeItem('mazda_sm'); }
    }

    auth.onAuthStateChanged(u => {
      if (isViewer()) return;
      if (!u) {
        if (!S.salesman) { S.user = null; return loginView(); }
      } else {
        localStorage.removeItem('mazda_viewer');
        const em = (u.email || '').toLowerCase();
        S.role = em === C.ownerEmail.toLowerCase() ? 'owner' : 'manager';
        S.user = u; S.date = todayISO(); shell();
        db.collection('days').orderBy('date', 'desc').limit(1).get().then(s => {
          if (!s.empty) { const d = s.docs[0].data(); S.rates = { petrol: d.rateP, diesel: d.rateD }; }
        }).catch(() => { });
      }
    });
  }

  function shell() {
    let tabs = [];
    if (isViewer()) {
      tabs = [
        ['v_home', '🏠', 'होम'],
        ['v_parties', '📒', 'पार्टी'],
        ['v_money', '💰', 'पैसा'],
        ['v_workers', '👥', 'वर्कर'],
        ['more', '⚙️', 'बाहर']
      ];
    } else if (isSalesman()) {
      tabs = [
        ['salesman', '⛽', 'सेल्समैन'],
        ['ledger', '📒', 'खाते'],
        ['more', '⚙️', 'बाहर']
      ];
    } else {
      tabs = [
        ['day', '🧾', 'हिसाब'],
        ['ledger', '📒', 'खाते'],
        ['gaadicash', '🚚', 'गाड़ी कैश'],
        ['stock', '🛢️', 'स्टॉक']
      ];
      if (isOwner()) tabs.push(['priv', '🔒', 'निजी']);
      tabs.push(['more', '⚙️', 'और']);
    }

    const titleRole = isOwner() ? 'मालिक' : isViewer() ? 'केवल देखें' : isSalesman() ? ('सेल्समैन · ' + S.salesman.name) : 'मैनेजर';
    const userName = S.salesman ? S.salesman.name : isViewer() ? 'Owner' : esc((S.user && S.user.email || 'user').split('@')[0]);

    $('#app').innerHTML = `
      <header>
        <div style="display:flex;align-items:center;gap:10px">
          <img src="./logo.png" alt="" style="width:38px;height:38px;border-radius:50%;background:#fff;flex:none">
          <div>
            <b>${esc(C.pump.name)}</b>
            <small>${titleRole} · ${userName}</small>
          </div>
        </div>
        <button id="top-logout">लॉगआउट</button>
      </header>
      <main id="main"></main>
      <nav>${tabs.map(t => `<button data-tab="${t[0]}"><i>${t[1]}</i>${t[2]}</button>`).join('')}</nav>`;

    $('#top-logout').onclick = () => {
      localStorage.removeItem('mazda_sm');
      localStorage.removeItem('mazda_viewer');
      if (auth) auth.signOut();
      location.reload();
    };

    $$('nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
    go(isSalesman() ? 'salesman' : isViewer() ? 'v_home' : 'day');
  }

  function go(tab, arg) {
    S.tab = tab;
    $$('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    window.scrollTo(0, 0);
    if (tab === 'day') return dayView(arg);
    if (tab === 'ledger')]) return ledgerView(arg);

    if (APP.views && typeof APP.views[tab] === 'function') {
      APP.views[tab](arg);
    } else {
      const m = $('#main');
      if (m) m.innerHTML = '<div class="card"><p class="mut">लोड हो रहा है…</p></div>';
      setTimeout(() => { if (APP.views && APP.views[tab]) APP.views[tab](arg); }, 200);
    }
  }
  APP.go = go;

  async function prevDay(date) {
    const s = await db.collection('days').where('date', '<', date).orderBy('date', 'desc').limit(1).get();
    return s.empty ? null : s.docs[0].data();
  }
  
  async function newDay(date) {
    const d = {
      date, testing: C.testing, rateP: S.rates.petrol, rateD: S.rates.diesel, nz: {},
      driverInaam: 0, chaiKhana: 0, status: 'open', opening_locked: true
    };
    
    let prev = null;
    const prevDateStr = shiftDate(date, -1);
    const draftStr = localStorage.getItem('mazda_draft_' + prevDateStr);
    if (draftStr) { try { prev = JSON.parse(draftStr); } catch(e) {} }
    
    if (!prev) prev = await prevDay(date);
    
    if (prev) {
      const rs = prev.date ? await db.collection('ledger').where('date', '==', prev.date).get() : { docs: [] };
      const pc = K.compute(prev, rs.docs.map(x => x.data()));
      K.NZ.forEach(k => { d.nz[k] = { o: prev.nz && prev.nz[k] ? prev.nz[k].c : '', c: '' }; });
      d.rateP = prev.rateP || d.rateP; d.rateD = prev.rateD || d.rateD;
      d.openCash = pc.close;
      d.openStockP = K.has(prev.dipP) ? num(prev.dipP) : pc.stockCloseP;
      d.openStockD = K.has(prev.dipD) ? num(prev.dipD) : pc.stockCloseD;
    } else {
      d.opening_locked = false;
    }
    return d;
  }

  let autoSaveTimer = null;
  function triggerAutoSave() {
    if (S.cur && !S.cur.locked && !isViewer()) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        saveDay(false, true);
      }, 2500);
    }
  }

  async function dayView(date) {
    date = (typeof date === 'string' && date) ? date : (S.date || todayISO()); S.date = date;
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let ds, rs, prev;
    try {
      const [dsR, rsR, prevR] = await Promise.all([
        db.collection('days').doc(date).get(), 
        db.collection('ledger').where('date', '==', date).get(),
        prevDay(date)
      ]);
      ds = dsR; rs = rsR; prev = prevR;
    } catch (e) { main.innerHTML = errBox(e); return; }
    
    let d = ds.exists ? ds.data() : null;
    const rows = rs.docs.map(x => ({ id: x.id, ...x.data() })).filter(r => !r.opening).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (!d) d = await newDay(date);
    
    if (prev && d.opening_locked !== false) {
      if (!d.nz) d.nz = {};
      K.NZ.forEach(k => {
        if (!d.nz[k]) d.nz[k] = {};
        d.nz[k].o = prev.nz && prev.nz[k] ? prev.nz[k].c : '';
      });
    }

    if (S.draft[date {
      d = Object.assign({}, d, S.draft[date]);
      if (d.opening_locked !== false && prev) {
        K.NZ.forEach(k => {
          if(!d.nz[k]) d.nz[k] = {};
          d.nz[k].o = prev.nz && prev.nz[k] ? prev.nz[k].c : '';
        });
      }
    }
    
    const locked = (d.status === 'submitted' && !isOwner()) || isViewer();
    const dis = locked ? 'disabled' : '';
    const isOpeningLocked = d.opening_locked !== false;
    const ro = isOpeningLocked ? 'readonly style="background:#f0f0f0;color:#555;font-weight:bold;"' : '';

    const inp = (id, v, ph) => `<input id="${id}" inputmode="decimal" value="${esc(v == null ? '' : v)}" placeholder="${ph || ''}" ${dis}>`;
    const nzr = (k, lab) => { 
        const n = (d.nz && d.nz[k]) || {}; 
        return `<div class="nz"><b>${lab}</b>
        <input class="nzi" data-k="${k}" data-f="o" inputmode="decimal" value="${esc(n.o == null ? '' : n.o)}" ${ro} ${dis}>
        <input class="nzi" data-k="${k}" data-f="c" inputmode="decimal" value="${esc(n.c == null ? '' : n.c)}" ${dis}>
        <span id="net-${k}">–</span></div>`; 
    };
    const minDate = isOwner() ? '' : shiftDate(todayISO(), -2);

    main.innerHTML = `
    <div class="card"><div class="row"><div><label style="margin-top:0">तारीख</label>
      <input type="date" id="f-date" value="${date}" max="${todayISO()}" ${minDate ? 'min="' + minDate + '"' : ''}></div>
      <div style="flex:0 0 auto;align-self:end">${locked ? '<span class="chip g">जमा ✔ लॉक</span>' : d.status === 'submitted' ? '<span class="chip o">जमा (खुला)</span>' : '<span class="chip">चालू</span>'}</div></div></div>

    <div class="card"><h3>आज का रेट (₹/लीटर)</h3><div class="row">
      <div><label>पेट्रोल</label>${inp('f-rateP', d.rateP)}</div><div><label>डीज़ल</label>${inp('f-rateD', d.rateD)}</div>
      <div><label>टेस्टिंग (L)</label>${inp('f-testing', d.testing)}</div></div></div>

    <div class="card"><h3>मीटर रीडिंग</h3>
      <div class="nz h"><span></span><span>ओपनिंग</span><span>क्लोज़िंग</span><span style="text-align:right">नेट L</span></div>
      <b class="mut">पेट्रोल</b>${['p1', 'p2', 'p3', 'p4'].map((k, i) => nzr(k, 'P' + (i + 1))).join('')}
      <b class="mut">डीज़ल</b>${['d1', 'd2', 'd3', 'd4'].map((k, i) => nzr(k, 'D' + (i + 1))).join('')}
      <div id="nzwarn"></div>
      ${(!locked && isOwner()) ? `
      <div class="btns" style="margin-top:8px">
        <button class="btn sm w" id="toggle-open" type="button">${isOpeningLocked ? '🔓 ओपनिंग एडिट करें' : '🔒 ओपनिंग लॉक करें (पिछले दिन से जोड़ें)'}</button>
      </div>` : ''}
    </div>

    <div class="card"><h3>पार्टी उधार / जमा (आज)</h3>
      <div id="rowsbox"></div>
      <div class="btns">${locked ? '' : '<button class="btn o" data-do="addU">+ उधार</button><button class="btn g" data-do="addJ">+ जमा</button>'}</div></div>

    <div class="card"><h3>कैश और भुगतान</h3>
      <label>पिछला कैश (ओपनिंग)</label>${inp('f-openCash', d.openCash)}
      <div class="row"><div><label>Paytm/UPI कुल</label>${inp('f-paytm', d.paytm)}</div><div><label>स्वाइप कुल</label>${inp('f-swipe', d.swipe)}</div></div>
      
      <div class="row" style="margin-top:8px">
        <div><label>खर्चा DG (जनरेटर)</label>${inp('f-kharcha', d.kharcha)}</div>
        <div><label>ड्राइवर इनाम</label>${inp('f-driverInaam', d.driverInaam)}</div>
      </div>
      <div class="row">
        <div><label>चाय-खाना</label>${inp('f-chaiKhana', d.chaiKhana)}</div>
        <div><label>मालिक को दिया (SBI जमा)</label>${inp('f-malikDiya', d.malikDiya)}</div>
      </div>
      <label>नोट</label><input id="f-note" value="${esc(d.note || '')}" ${dis}></div>

    <div class="card"><h3>आज का हिसाब</h3><div id="sum"></div></div>

    <div class="card"><h3>स्टॉक (लीटर)</h3>
      <div class="row"><div><label>पेट्रोल ओपनिंग</label>${inp('f-openStockP', d.openStockP)}</div><div><label>डीज़ल ओपनिंग</label>${inp('f-openStockD', d.openStockD)}</div></div>
      <div class="row"><div><label>पेट्रोल टैंकर आया</label>${inp('f-tankerP', d.tankerP)}</div><div><label>डीज़ल टैंकर आया</label>${inp('f-tankerD', d.tankerD)}</div></div>
      <div class="row"><div><label>पेट्रोल डिप</label>${inp('f-dipP', d.dipP)}</div><div><label>डीज़ल डिप</label>${inp('f-dipD', d.dipD)}</div></div>
      <div id="stk"></div></div>

    <div class="btns">
      ${locked ? '' : '<button class="btn w" data-do="save">💾 सेव</button>'}
      ${locked ? '' : '<button class="btn g" data-do="submit">✅ जमा करें (लॉक)</button>'}
      ${isOwner() && d.status === 'submitted' ? '<button class="btn o" data-do="unlock">🔓 अनलॉक</button>' : ''}
      <button class="btn" data-do="report">📤 कॉम्पैक्ट रिपोर्ट</button>
      ${locked ? '' : '<button class="btn w" data-do="scan">📷 AI रजिस्टर स्कैन</button>'}
    </div>`;

    const state = { d, rows, date, locked };
    S.cur = state;
    renderRows(state);
    recalc();
    
    $('#f-date').onchange = e => { collectDraft(); dayView(e.target.value || todayISO()); };
    
    if ($('#toggle-open')) {
      $('#toggle-open').onclick = () => {
        if (S.cur.d.opening_locked !== false) {
          if (!confirm('⚠️ अगर आप ओपनिंग एडिट करेंगे तो पिछले दिन की क्लोजिंग से उसका लिंक टूट जाएगा! क्या आप आगे बढ़ना चाहते हैं?')) return;
          S.cur.d.opening_locked = false;
          $$('.nzi[data-f="o"]').forEach(el => {
             el.removeAttribute('readonly');
             el.style.background = '';
             el.style.color = '';
          });
          $('#toggle-open').textContent = '🔒 ओपनिंग लॉक करें (पिछले दिन से जोड़ें)';
          triggerAutoSave();
        } else {
          S.cur.d.opening_locked = true;
          const pDate = shiftDate(S.cur.date, -1);
          db.collection('days').doc(pDate).get().then(ps => {
             const pnz = ps.exists ? (ps.data().nz || {}) : {};
             $$('.nzi[data-f="o"]').forEach(el => {
                const k = el.dataset.k;
                el.value = pnz[k] ? pnz[k].c : '';
                el.setAttribute('readonly', true);
                el.style.background = '#f0f0f0';
                el.style.color = '#555';
                el.style.fontWeight = 'bold';
             });
             recalc();
             triggerAutoSave();
          });
          $('#toggle-open').textContent = '🔓 ओपनिंग एडिट करें';
        }
      };
    }

    $$('#main input').forEach(i => {
      if (i.id !== 'f-date') {
        i.addEventListener('input', () => { recalc(); triggerAutoSave(); });
      }
    });
    
    main.onclick = e => { const b = e.target.closest('[data-do]'); if (b && A[b.dataset.do]) A[b.dataset.do](b.dataset); };
  }

  function readForm() {
    const st = S.cur, g = id => { const el = $('#' + id); return el ? el.value : ''; };
    const d = Object.assign({}, st.d, {
      date: st.date, rateP: g('f-rateP'), rateD: g('f-rateD'), testing: g('f-testing'),
      openCash: g('f-openCash'), paytm: g('f-paytm'), swipe: g('f-swipe'),
      kharcha: g('f-kharcha'), driverInaam: g('f-driverInaam'), chaiKhana: g('f-chaiKhana'),
      malikDiya: g('f-malikDiya'), note: g('f-note'),
      openStockP: g('f-openStockP'), openStockD: g('f-openStockD'),
      tankerP: g('f-tankerP'), tankerD: g('f-tankerD'), dipP: g('f-dipP'), dipD: g('f-dipD'), nz: {},
      opening_locked: st.d.opening_locked !== false
    });
    K.NZ.forEach(k => { d.nz[k] = { o: '', c: '' }; });
    $$('.nzi').forEach(i => { d.nz[i.dataset.k][i.dataset.f] = i.value; });
    return d;
  }
  function collectDraft() { if (S.cur && !S.cur.locked) { const d = readForm(); delete d.sum; S.draft[S.cur.date] = d; } }

  function renderRows(st) {
    const rows = st.rows;
    $('#rowsbox').innerHTML = rows.length ? rows.map(r => `<div class="item"><div class="a"><b>${esc(r.partyName)}</b>
      <small>${esc(r.time || '')} · ${r.kind === 'udhar' ? esc(r.vehicle || '') + ' · ' + FUEL[r.fuel] + ' ' + lit(r.litre) : 'जमा · ' + MODE[r.mode] + (r.note ? ' · ' + esc(r.note) : '')}</small></div>
      <div style="text-align:right"><b class="${r.kind === 'udhar' ? 'neg' : 'pos'}">${r.kind === 'udhar' ? '' : '+'}${money(r.amount)}</b>
      ${isOwner() ? `<div><button class="btn sm w" data-do="editE" data-id="${r.id}">✏️</button> <button class="btn sm r" data-do="delE" data-id="${r.id}">🗑</button></div>` : ''}</div></div>`).join('')
      : '<p class="mut">आज कोई पार्टी एंट्री नहीं</p>';
  }

  function recalc() {
    const st = S.cur; if (!st) return;
    const d = readForm(), o = K.compute(d, st.rows);
    K.NZ.forEach(k => { const e = $('#net-' + k); if (e) e.textContent = o.nz[k].ok ? r2(o.nz[k].net) : '–'; });
    $('#nzwarn').innerHTML = o.warn.map(w => '<div class="warn">' + esc(w) + '</div>').join('') +
      (o.filled < 8 ? `<div class="mut">${o.filled}/8 नोज़ल भरे हैं</div>` : '');
    const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
    $('#sum').innerHTML =
      kvEl('पेट्रोल बिक्री', lit(o.litP) + ' = ' + money(o.amtP)) + kvEl('डीज़ल बिक्री', lit(o.litD) + ' = ' + money(o.amtD)) +
      kvEl('कुल बिक्री', money(o.sale), 'big') +
      kvEl('+ पिछला कैश', money(d.openCash)) +
      kvEl('+ पार्टी जमा (नकद/UPI)', money(o.jCash + o.jPaytm + o.jSwipe)) +
      kvEl('= कुल', money(o.kul)) +
      kvEl('− Paytm कुल', money(d.paytm)) + kvEl('− स्वाइप कुल', money(d.swipe)) + kvEl('− उधार दिया', money(o.udhar)) +
      kvEl('− कुल खर्चा', money(o.totalKharcha)) +
      kvEl('− SBI बैंक जमा', money(d.malikDiya)) +
      kvEl('आज का बचा कैश', money(o.close), 'big' + (o.close < 0 ? ' neg' : ''));
    
    const sd = (a, b) => b == null ? '' : `<div class="${Math.abs(b) > 0.5 ? 'warn' : 'ok'}">डिप फर्क: ${b > 0 ? '+' : ''}${r2(b)} L</div>`;
    $('#stk').innerHTML = kvEl('पेट्रोल हिसाब से बचा', lit(o.stockCloseP)) + sd('P', o.diffP) + kvEl('डीज़ल हिसाब से बचा', lit(o.stockCloseD)) + sd('D', o.diffD);
    st.o = o;
  }

  async function saveDay(submit, silent = false) {
    if (isViewer()) return toast('आप केवल देख सकते हैं');
    const st = S.cur; if(!st) return;
    const d = readForm(); const o = K.compute(d, st.rows);
    if (submit && !silent) {
      if (!confirm('क्या आप आज का हिसाब जमा करके लॉक करना चाहते हैं?')) return;
    }
    d.sum = { sale: o.sale, litP: o.litP, litD: o.litD, close: o.close, stockCloseP: o.stockCloseP, stockCloseD: o.stockCloseD };
    d.status = submit ? 'submitted' : (st.d.status || 'open');
    d.by = S.user.email; d.at = FV.serverTimestamp();
    
    S.draft[st.date] = d;

    try {
      await commit(db.collection('days').doc(st.date).set(d));
      S.rates = { petrol: d.rateP, diesel: d.rateD }; delete S.draft[st.date];
      
      // --- SBI Bank Deposit Auto Sync (Fixed & Error Proof) ---
      try {
        const bankRef = db.collection('bank_deposits');
        const docId = 'sbi_auto_' + st.date;
        const mdAmt = num(d.malikDiya);
        
        if (mdAmt > 0) {
          await bankRef.doc(docId).set({
            bank: 'SBI', 
            date: st.date, 
            amount: mdAmt, 
            mode: 'cash',
            note: 'मालिक को दिया (SBI जमा)', 
            by: S.user.email, 
            at: FV.serverTimestamp()
          }, { merge: true });
        } else {
          await bankRef.doc(docId).delete().catch(() => {});
        }
      } catch (bankErr) { console.error('Bank sync error:', bankErr); }
      // ----------------------------------

      if (!silent) {
        audit(submit ? 'day_submit' : 'day_save', { date: st.date, sale: o.sale, close: o.close });
        toast(submit ? 'हिसाब जमा हो गया' : 'सेव हो गया');
      }
      if (submit && !silent) { await dayView(st.date); } else { st.d = d; }
    } catch (e) { if (!silent) toast('सेव नहीं हुआ: ' + e.message); }
  }

  const sigEntry = (priv, e) => priv ? (e.status === 'pending' ? num(e.amount) : 0) : K.signed(e);

  async function entryModal(o) {
    if (isViewer()) return toast('आप केवल देख सकते हैं');
    const priv = !!o.priv, e = o.entry || null, kind0 = e ? e.kind : (o.kind || 'udhar');
    const parties = await getParties(priv);
    if (!parties.length) { toast('पहले खाते में पार्टी जोड़ें'); return; }
    const date0 = e ? e.date : (o.date || S.date || todayISO());
    const rates = { petrol: S.rates.petrol, diesel: S.rates.diesel };
    const pid0 = e ? e.partyId : (o.partyId || parties[0].id);

    const m = modal(`<h3>${e ? 'एंट्री बदलें' : priv ? 'निजी उधार जोड़ें' : 'नई एंट्री'}</h3>
      ${priv ? '' : `<div class="seg"><button data-k="udhar">उधार (तेल दिया)</button><button data-k="jama">जमा (पैसा आया)</button></div>`}
      <div class="row"><div><label>तारीख</label><input type="date" id="e-date" value="${date0}"></div><div><label>समय</label><input type="time" id="e-time" value="${e ? e.time || '' : nowTime()}"></div></div>
      <label>पार्टी</label><select id="e-party">${parties.map(p => `<option value="${p.id}" ${p.id === pid0 ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <div id="blkU">
        <label>गाड़ी नंबर</label><select id="e-veh"></select><input id="e-vehx" placeholder="गाड़ी नंबर टाइप करें" style="display:none;margin-top:6px">
        <div class="row"><div><label>तेल</label><select id="e-fuel"><option value="petrol">पेट्रोल</option><option value="diesel">डीज़ल</option></select></div>
        <div><label>रेट</label><input id="e-rate" inputmode="decimal"></div></div>
        <div class="row"><div><label>लीटर</label><input id="e-lit" inputmode="decimal"></div><div><label>रुपये</label><input id="e-amtU" inputmode="decimal"></div></div>
      </div>
      <div id="blkJ"><label>कैसे जमा हुआ</label>
        <select id="e-mode">
          <option value="cash">नकद</option>
          <option value="paytm">Paytm/UPI</option>
          <option value="swipe">स्वाइप</option>
          <option value="bank">बैंक</option>
        </select>
        <label>रुपये</label><input id="e-amtJ" inputmode="decimal"></div>
      <label>नोट</label><input id="e-note" value="${esc(e ? e.note || '' : '')}">
      <div class="btns">
        <button class="btn g" id="e-save">सेव करें</button>
        <button class="btn bpcl" id="e-slip-btn">🖨️ थर्मल पर्ची</button>
        <button class="btn w" id="e-cancel">रद्द</button>
      </div>`);

    let kind = kind0, last = 'lit';
    const q = id => $('#' + id, m);
    const showKind = () => {
      $$('.seg button', m).forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      q('blkU').style.display = kind === 'udhar' ? '' : 'none'; q('blkJ').style.display = kind === 'jama' ? '' : 'none';
      q('e-slip-btn').style.display = kind === 'udhar' ? '' : 'none';
    };
    $$('.seg button', m).forEach(b => b.onclick = () => { kind = b.dataset.k; showKind(); });
    const fillVeh = () => {
      const p = partyById(priv, q('e-party').value) || {}; const vs = p.vehicles || [];
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
    if (e && e.kind === 'jama') { q('e-mode').value = e.mode; q('e-amtJ').value = e.amount; }
    showKind();

    q('e-slip-btn').onclick = () => {
      const party = partyById(priv, q('e-party').value) || {};
      const veh = q('e-veh').value === '__x' ? q('e-vehx').value.trim().toUpperCase() : q('e-veh').value;
      if (!q('e-amtU').value) return toast('कृपया रकम भरें');
      if (APP.showThermalSlip) {
        APP.showThermalSlip({
          partyName: party.name,
          partyPhone: party.phone || '',
          vehicle: veh,
          fuel: q('e-fuel').value,
          litre: q('e-lit').value,
          rate: q('e-rate').value,
          amount: q('e-amtU').value,
          date: q('e-date').value,
          time: q('e-time').value
        });
      }
    };

    q('e-cancel').onclick = () => m.close();
    q('e-save').onclick = async () => {
      const partyId = q('e-party').value, party = partyById(priv, partyId);
      const data = { partyId, partyName: party.name, date: q('e-date').value, time: q('e-time').value || nowTime(), kind: priv ? 'udhar' : kind, note: q('e-note').value.trim() };
      if (!data.date) return toast('तारीख चुनें');
      if (data.kind === 'udhar') {
        data.vehicle = q('e-veh').value === '__x' ? q('e-vehx').value.trim().toUpperCase() : q('e-veh').value;
        data.fuel = q('e-fuel').value; data.rate = num(q('e-rate').value); data.litre = num(q('e-lit').value); data.amount = num(q('e-amtU').value);
        if (!data.vehicle) return toast('गाड़ी नंबर लिखें');
        if (!(data.litre > 0) || !(data.amount > 0)) return toast('लीटर व रुपये भरें');
      } else {
        data.mode = q('e-mode').value; data.amount = num(q('e-amtJ').value);
        if (!(data.amount > 0)) return toast('रुपये भरें');
      }
      if (priv) { data.status = e ? e.status : 'pending'; }
      data.by = S.salesman ? S.salesman.name : S.user.email;
      data.at = FV.serverTimestamp();

      const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
      const ref = e ? db.collection(col).doc(e.id) : db.collection(col).doc();
      const b = db.batch(); b.set(ref, data);
      const newSig = sigEntry(priv, data);
      const delta = newSig - (e ? sigEntry(priv, e) : 0);
      if (delta) b.update(db.collection(pcol).doc(partyId), { bal: FV.increment(delta) });

      try {
        await commit(b.commit());
        m.close(); toast('सेव हो गया ✔');
        S.parties[priv ? 'priv' : 'pub'] = null;
        if (S.tab === 'day') dayView(S.date);
        else if (S.tab === 'ledger') ledgerView();
        else if (S.tab === 'priv') partyView(partyId, true);
        else if (APP.views && APP.views[S.tab]) APP.views[S.tab]();
      } catch (x) { toast('सेव नहीं हुआ: ' + x.message); }
    };
  }

  async function ledgerView() {
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties; try { parties = await getParties(false, true); } catch (e) { main.innerHTML = errBox(e); return; }
    const due = parties.filter(p => num(p.bal) > 0);
    main.innerHTML = `
      <div class="card">
        <div class="kv"><span>कुल बकाया (लेना है)</span><b class="neg">${money(due.reduce((a, p) => a + num(p.bal), 0))}</b></div>
      </div>
      <div class="row search"><input id="q" placeholder="पार्टी या गाड़ी खोजें…"></div>
      <div class="card" id="plist"></div>
      <div class="btns">
        <button class="btn o" id="bU">+ उधार</button>
        <button class="btn g" id="bJ">+ जमा</button>
        ${isOwner() ? '<button class="btn w" id="bP">+ नई पार्टी</button>' : ''}
        ${isOwner() ? '<button class="btn w" id="bBulk">📥 लिस्ट से जोड़ें</button>' : ''}
      </div>`;

    const draw = () => {
      const t = $('#q').value.trim().toLowerCase();
      const list = parties.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#plist').innerHTML = list.length ? list.map(p => {
        const b = num(p.bal);
        return `<div class="item" data-id="${p.id}" style="cursor:pointer">
          <div class="a"><b>${esc(p.name)}</b><small>${(p.vehicles || []).join(', ')}</small></div>
          <span class="chip ${b > 0 ? 'r' : 'g'}">${money(b)}</span>
        </div>`;
      }).join('') : '<p class="mut">कोई पार्टी नहीं मिली</p>';
      $$('#plist .item').forEach(it => it.onclick = () => partyView(it.dataset.id, false));
    };
    $('#q').oninput = draw; draw();
    $('#bU').onclick = () => entryModal({ kind: 'udhar', date: todayISO() });
    $('#bJ').onclick = () => entryModal({ kind: 'jama', date: todayISO() });
    if (isOwner()) $('#bP').onclick = () => partyModal(null, false);
    if (isOwner()) $('#bBulk').onclick = () => bulkPartyModal();
  }

  function partyModal(p, priv) {
    const m = modal(`<h3>${p ? 'पार्टी बदलें' : 'नई पार्टी'}</h3>
      <label>नाम</label><input id="p-name" value="${esc(p ? p.name : '')}">
      <label>मोबाइल नंबर</label><input id="p-phone" inputmode="tel" value="${esc(p ? p.phone || '' : '')}">
      <label>गाड़ियां (कॉमा या नई लाइन में)</label><textarea id="p-veh" rows="3">${esc(p ? (p.vehicles || []).join('\n') : '')}</textarea>
      <div class="btns"><button class="btn g" id="p-save">सेव</button><button class="btn w" id="p-cancel">रद्द</button></div>`);
    $('#p-cancel', m).onclick = () => m.close();
    $('#p-save', m).onclick = async () => {
      const name = $('#p-name', m).value.trim(); if (!name) return toast('नाम लिखें');
      const vehicles = $('#p-veh', m).value.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const data = { name, phone: $('#p-phone', m).value.trim(), vehicles };
      const pcol = priv ? 'priv_parties' : 'parties';
      const b = db.batch();
      if (p) { b.update(db.collection(pcol).doc(p.id), data); }
      else { const ref = db.collection(pcol).doc(); data.bal = 0; data.createdAt = FV.serverTimestamp(); b.set(ref, data); }
      await commit(b.commit()); m.close(); toast('सेव हो गया'); S.parties[priv ? 'priv' : 'pub'] = null; 
      if(priv) partyView(p.id, true); else ledgerView();
    };
  }

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
      let ps; try { ps = await getParties(false, true); } catch (e) { return toast('लिस्ट नहीं मिली: ' + e.message); }
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
      const b = db.batch(); let n = 0;
      plan.forEach(x => {
        if (x.ex) { if (x.add.length) { b.update(db.collection('parties').doc(x.ex.id), { vehicles: x.all }); n++; } }
        else { b.set(db.collection('parties').doc(), { name: x.name, phone: '', vehicles: x.all, bal: 0, createdAt: FV.serverTimestamp() }); n++; }
      });
      try { await commit(b.commit()); m.close(); toast(n + ' पार्टी अपडेट हुईं ✔'); S.parties.pub = null; ledgerView(); }
      catch (e) { toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  async function partyView(id, priv) {
    const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const [ps, es] = await Promise.all([db.collection(pcol).doc(id).get(), db.collection(col).where('partyId', '==', id).get()]);
    if (!ps.exists) return;
    const p = { id, ...ps.data() };
    const all = es.docs.map(x => ({ id: x.id, ...x.data() }));
    const st = K.stmt(all, null, null);

    main.innerHTML = `
      <div class="btns" style="margin-bottom:10px">
        <button class="btn sm w" id="back">← वापस</button>
        ${isOwner() ? '<button class="btn sm o" id="editP">✏️ बदलें</button>' : ''}
        <button class="btn sm o" id="addU">+ उधार</button>
        <button class="btn sm g" id="addJ">+ जमा</button>
        <button class="btn sm w" id="addOB">⚖️ पिछला बैलेंस</button>
      </div>
      <div class="card">
        <h3>${esc(p.name)}</h3>
        <p class="mut">${esc(p.phone || 'फोन नंबर नहीं')} | गाड़ियां: ${(p.vehicles || []).join(', ')}</p>
        <div class="due">कुल बैलेंस: ${money(st.close)}</div>
      </div>
      <div class="card" style="overflow-x:auto">
        <table>
          <tr><th>तारीख</th><th>गाड़ी / विवरण</th><th class="n">उधार</th><th class="n">जमा</th><th class="n">बैलेंस</th></tr>
          ${st.rows.map(r => `<tr><td>${dmy(r.date)}</td><td>${esc(r.vehicle || '-')}<br><small class="mut">${esc(r.note||'')}</small></td><td class="n neg">${r.kind === 'udhar' ? money(r.amount) : ''}</td><td class="n pos">${r.kind === 'jama' ? money(r.amount) : ''}</td><td class="n">${money(r.run)}</td></tr>`).join('')}
        </table>
      </div>`;
      
    $('#back').onclick = () => priv ? APP.views.priv() : ledgerView();
    if (isOwner() && $('#editP')) $('#editP').onclick = () => partyModal(p, priv);
    $('#addU').onclick = () => entryModal({ kind: 'udhar', date: todayISO(), partyId: id, priv: priv });
    $('#addJ').onclick = () => entryModal({ kind: 'jama', date: todayISO(), partyId: id, priv: priv });
    $('#addOB').onclick = () => openingBalanceModal(id, priv);
  }
  APP.partyView = partyView;

  function openingBalanceModal(partyId, priv) {
    const m = modal(`<h3>⚖️ पिछला बैलेंस (Opening Balance)</h3>
      <p class="mut" style="font-size:12px">इससे पहले का हिसाब मैन्युअल लेजर में है, यहाँ से आगे का हिसाब ऐप में रहेगा।</p>
      <label>तारीख</label><input type="date" id="ob-date" value="${todayISO()}">
      <label>बकाया रकम (₹) (अगर हमें लेने हैं तो)</label><input id="ob-amt" inputmode="decimal">
      <label>नोट</label><input id="ob-note" value="पिछले हिसाब का बैलेंस (Opening Balance)">
      <div class="btns"><button class="btn g" id="ob-save">सेव</button><button class="btn w" id="ob-cancel">रद्द</button></div>`);
    $('#ob-cancel', m).onclick = () => m.close();
    $('#ob-save', m).onclick = async () => {
      const amt = num($('#ob-amt', m).value);
      if (!amt) return toast('रकम भरें');
      const date = $('#ob-date', m).value;
      const note = $('#ob-note', m).value;
      
      const data = {
        partyId, partyName: APP.partyById(priv, partyId).name,
        date, time: '00:00', kind: 'udhar',
        vehicle: '', fuel: '', rate: 0, litre: 0,
        amount: amt, note, by: S.user.email, at: FV.serverTimestamp()
      };
      if (priv) data.status = 'pending';
      
      try {
        const b = db.batch();
        const ref = db.collection(priv ? 'priv_ledger' : 'ledger').doc();
        b.set(ref, data);
        const newSig = sigEntry(priv, data);
        b.update(db.collection(priv ? 'priv_parties' : 'parties').doc(partyId), { bal: FV.increment(newSig) });
        await b.commit();
        m.close(); toast('सेव हो गया ✔');
        S.parties[priv ? 'priv' : 'pub'] = null;
        partyView(partyId, priv);
      } catch(e) { toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  // 🔄 पुराने सारे दिनों का डेटा बैंक जमा में सिंक करने का फंक्शन
  APP.syncOldBankData = async function() {
    if(!confirm('क्या आप पुराने सारे हिसाब को SBI बैंक जमा में सिंक करना चाहते हैं? इसमें 1 मिनट लग सकता है।')) return;
    toast('पुराना डेटा सिंक हो रहा है...');
    try {
      const daysSnap = await db.collection('days').get();
      let count = 0;
      for (const doc of daysSnap.docs) {
        const d = doc.data();
        const mdAmt = num(d.malikDiya);
        if (mdAmt > 0) {
          const docId = 'sbi_auto_' + d.date;
          await db.collection('bank_deposits').doc(docId).set({
            bank: 'SBI', date: d.date, amount: mdAmt, mode: 'cash',
            note: 'मालिक को दिया (SBI जमा)', by: d.by || 'system', at: FV.serverTimestamp()
          }, { merge: true });
          count++;
        }
      }
      toast(count + ' दिन का पुराना डेटा बैंक में जुड़ गया ✔');
      if (S.tab === 'bank') APP.views.bank();
    } catch(e) { toast('सिंक एरर: ' + e.message); }
  };

  // मालिक के "और" (More) टैब में सिंक बटन जोड़ना
  const origMore = APP.views.more;
  APP.views.more = async function() {
    if(origMore) await origMore();
    const main = $('#main');
    const card = main.querySelector('.card');
    if(card && isOwner()) {
       const btns = card.querySelector('.btns');
       if(btns && !document.getElementById('m-sync-bank')) {
          const btn = document.createElement('button');
          btn.id = 'm-sync-bank';
          btn.className = 'btn w full';
          btn.style.marginBottom = '10px';
          btn.innerHTML = '🔄 पुराना डेटा SBI बैंक में सिंक करें';
          btns.insertBefore(btn, btns.firstChild);
          btn.onclick = () => APP.syncOldBankData();
       }
    }
  };

  const A = {
    addU() { collectDraft(); entryModal({ kind: 'udhar', date: S.cur.date }); },
    addJ() { collectDraft(); entryModal({ kind: 'jama', date: S.cur.date }); },
    save() { saveDay(false); },
    submit() { saveDay(true); },
    async unlock() {
      await commit(db.collection('days').doc(S.cur.date).update({ status: 'open' })); dayView(S.cur.date);
    },
    report() { if (APP.shareCompactDayReport) APP.shareCompactDayReport(S.cur, readForm()); },
    scan() { if (APP.scanRegister) APP.scanRegister(S.cur); },
    editE(data) {
      collectDraft();
      const row = S.cur.rows.find(r => r.id === data.id);
      if (row) entryModal({ entry: row, date: row.date });
    },
    async delE(data) {
      collectDraft();
      const row = S.cur.rows.find(r => r.id === data.id);
      if (!row) return;
      if (!confirm('क्या आप सच में इस एंट्री को हटाना चाहते हैं?')) return;
      try {
        const b = db.batch();
        b.delete(db.collection('ledger').doc(row.id));
        const delta = -K.signed(row); 
        if (delta) b.update(db.collection('parties').doc(row.partyId), { bal: FV.increment(delta) });
        await commit(b.commit());
        toast('एंट्री हटा दी गई ✔');
        S.parties.pub = null;
        dayView(S.date);
      } catch (e) { toast('नहीं हटा: ' + e.message); }
    }
  };
  APP.A = A; APP.dayView = dayView; APP.readForm = readForm; APP.recalc = recalc; APP.collectDraft = collectDraft; APP.entryModal = entryModal;

  window.addEventListener('load', boot);
})();
