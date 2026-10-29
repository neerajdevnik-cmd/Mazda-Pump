/* माज़दा ऑयल कंपनी - कोर ऐप कंट्रोलर */
(function () {
  'use strict';
  const C = window.CFG, K = window.Calc, num = K.num, r2 = K.r2;
  if (!K.isOpening) K.isOpening = r => !!r && (r.opening === true || (/Opening Balance/i.test(String(r.note || '')) && !num(r.litre)));
  if (!K.activeNz) K.activeNz = () => K.NZ.slice();
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
  const AUTO_LBL = { cash: 'नकद जमा', paytm: 'Paytm/UPI से जमा', swipe: 'स्वाइप (कार्ड) से जमा', bank: 'बैंक ट्रांसफर से जमा' };
  const AUTO_NOTES = Object.values(AUTO_LBL);

  const APP = window.APP = {
    C, K, $, $$, esc, num, r2, money, lit, pad, todayISO, nowTime, dmy, shiftDate, FUEL, MODE,
    S: { role: null, user: null, salesman: null, date: null, tab: 'day', draft: {}, rates: { petrol: C.defaultRateP, diesel: C.defaultRateD }, range: 'month', _costCache: {} },
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
  let pendingW = 0;
  function syncBadge() {
    let b = document.getElementById('sync-badge');
    if (!pendingW) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'sync-badge'; b.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top) + 58px);right:8px;z-index:50;background:#b26a00;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:700'; document.body.appendChild(b); }
    b.textContent = '⏳ ' + pendingW + ' सेव सर्वर पर जाना बाकी';
  }
  function commit(p) {
    let done = false, timedOut = false;
    pendingW++; syncBadge();
    p.then(() => { done = true; pendingW--; syncBadge(); },
      e => {
        done = true; pendingW--; syncBadge();
        if (timedOut) { const m = (e && e.message) || e; toast('❌ सर्वर ने सेव नहीं लिया: ' + m); try { alert('❌ एक सेव सर्वर तक नहीं पहुँचा:\n' + m + '\n\nउस एंट्री को दोबारा जाँचें।'); } catch (x) { } }
      });
    return Promise.race([p, new Promise(r => setTimeout(() => { if (!done) { timedOut = true; toast('⏳ नेट धीमा है — डेटा फ़ोन में सुरक्षित है, नेट आते ही अपने-आप जुड़ जाएगा'); } r(); }, 2500))]);
  }
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

  /* ================= खर्चा: अलग-अलग चीज़ों में बाँटने / एडिट करने वाला एडिटर ================= */
  const EXP_CATS = [['kharcha', 'DG (जनरेटर)'], ['driverInaam', 'ड्राइवर इनाम'], ['chaiKhana', 'चाय-खाना'], ['other', 'अन्य (नाम लिखें)']];
  const EXP_HINTS = ['पंचर', 'सफाई', 'बिजली', 'मरम्मत', 'स्टेशनरी', 'पानी', 'ट्रांसपोर्ट', 'स्टाफ'];
  const KHF = { kharcha: 'f-kharcha', driverInaam: 'f-driverInaam', chaiKhana: 'f-chaiKhana' };

  function expEditor(o) {
    const must = (o.mustTotal === undefined || o.mustTotal === null) ? null : r2(o.mustTotal);
    let lines = (o.lines || []).map(x => ({ cat: x.cat || 'other', label: x.label || '', amount: x.amount == null ? '' : x.amount }));
    if (!lines.length) lines = [{ cat: 'other', label: '', amount: '' }];
    const m = modal(`<h3>${esc(o.title || 'खर्चा')}</h3>
      <div class="mut" style="margin-bottom:6px">${o.note || ''}</div>
      <datalist id="xe-dl">${EXP_HINTS.map(h => `<option value="${esc(h)}">`).join('')}</datalist>
      <div id="xe-rows"></div>
      <div class="btns"><button class="btn w sm" id="xe-add" type="button">+ और हिस्सा</button></div>
      <div id="xe-tot" style="margin-top:8px"></div>
      <div class="btns" style="margin-top:10px"><button class="btn g" id="xe-ok">✅ ठीक है</button><button class="btn w" id="xe-no">रद्द</button></div>`);
    const rowsEl = $('#xe-rows', m);
    const read = () => {
      lines = $$('.xe-r', m).map(r => ({
        cat: $('.xe-c', r).value, label: $('.xe-l', r).value.trim(), amount: $('.xe-a', r).value
      }));
    };
    const total = () => r2(lines.reduce((a, x) => a + num(x.amount), 0));
    const upd = () => {
      const t = total();
      let h = `<div class="kv"><span>अभी का जोड़</span><b>${money(t)}</b></div>`;
      if (must !== null) {
        const left = r2(must - t);
        h = `<div class="kv"><span>बाँटना है (कुल)</span><b>${money(must)}</b></div>` + h +
          `<div class="${Math.abs(left) < 0.01 ? 'ok' : 'warn'}" style="margin-top:6px">${Math.abs(left) < 0.01 ? '✔ कुल बराबर है' : (left > 0 ? 'अभी बाकी: ' + money(left) : 'ज़्यादा हो गया: ' + money(-left))}</div>`;
      }
      $('#xe-tot', m).innerHTML = h;
    };
    const draw = () => {
      rowsEl.innerHTML = lines.map((x, i) => `<div class="xe-r" data-i="${i}">
        <div class="xe-top">
          <select class="xe-c">${EXP_CATS.map(c => `<option value="${c[0]}" ${c[0] === x.cat ? 'selected' : ''}>${c[1]}</option>`).join('')}</select>
          <input class="xe-a" inputmode="decimal" placeholder="रुपये" value="${esc(x.amount)}">
          <button class="btn sm r xe-d" type="button">🗑</button>
        </div>
        <input class="xe-l" list="xe-dl" placeholder="किस चीज़ का खर्चा है? (नाम लिखें)" value="${esc(x.label)}" style="margin-top:6px;${x.cat === 'other' ? '' : 'display:none'}">
        ${must !== null ? '<button class="btn sm w xe-f" type="button" style="margin-top:6px">= बाकी रकम यहाँ डालें</button>' : ''}
      </div>`).join('');
      $$('.xe-r', m).forEach(r => {
        const i = +r.dataset.i;
        $('.xe-c', r).onchange = () => { read(); draw(); upd(); };
        $('.xe-a', r).oninput = () => { read(); upd(); };
        $('.xe-l', r).oninput = () => read();
        $('.xe-d', r).onclick = () => { read(); lines.splice(i, 1); if (!lines.length) lines.push({ cat: 'other', label: '', amount: '' }); draw(); upd(); };
        const f = $('.xe-f', r);
        if (f) f.onclick = () => { read(); const others = lines.reduce((a, x, j) => a + (j === i ? 0 : num(x.amount)), 0); lines[i].amount = Math.max(0, r2(must - others)) || ''; draw(); upd(); };
      });
    };
    draw(); upd();
    $('#xe-add', m).onclick = () => { read(); lines.push({ cat: 'other', label: '', amount: '' }); draw(); upd(); };
    $('#xe-no', m).onclick = () => m.close();
    $('#xe-ok', m).onclick = () => {
      read();
      const out = lines.filter(x => num(x.amount) !== 0).map(x => ({ cat: x.cat, label: x.cat === 'other' ? x.label : '', amount: r2(x.amount) }));
      if (out.some(x => x.cat === 'other' && !x.label)) return toast('जिस खर्चे का "अन्य" चुना है, उसका नाम लिखें');
      const t = r2(out.reduce((a, x) => a + x.amount, 0));
      if (must !== null && Math.abs(t - must) >= 0.01) {
        if (!o.soft) return toast('कुल बराबर होना चाहिए — ' + (t < must ? 'अभी बाकी ' + money(must - t) : 'ज़्यादा है ' + money(t - must)));
        if (!confirm('जोड़ ' + money(t) + ' है, पहले कुल ' + money(must) + ' था। फिर भी यही रखें?')) return;
      }
      m.close(); o.onOk(out);
    };
  }

  function getExpItems() { return $$('#expbox .exr').map(r => ({ label: $('.exl', r).value.trim(), amount: $('.exa', r).value })); }
  function setExpItems(items, locked) {
    const box = $('#expbox'); if (!box) return;
    const lk = locked === undefined ? !!(S.cur && S.cur.locked) : locked;
    const dis = lk ? 'disabled' : '';
    box.innerHTML = items.length ? items.map((it, i) => `<div class="exr item" style="padding:6px 0">
        <div class="a"><input class="exl" placeholder="किस चीज़ का खर्चा?" value="${esc(it.label || '')}" ${dis}></div>
        <input class="exa" inputmode="decimal" placeholder="रुपये" value="${esc(it.amount == null ? '' : it.amount)}" style="width:96px" ${dis}>
        ${lk ? '' : `<button class="btn sm w" type="button" data-do="splitX" data-i="${i}">✂️</button><button class="btn sm r" type="button" data-do="delX" data-i="${i}">🗑</button>`}
      </div>`).join('') : '<div class="mut" style="font-size:12px;margin:4px 0">अभी कोई और खर्चा नहीं — नीचे "+ और खर्चा जोड़ें" दबाएँ</div>';
    $$('#expbox input').forEach(i => i.addEventListener('input', () => { recalc(); triggerAutoSave(); }));
  }
  function applyExpLines(items, lines) {
    lines.forEach(l => {
      if (KHF[l.cat]) { const el = $('#' + KHF[l.cat]); if (el) el.value = r2(num(el.value) + num(l.amount)) || ''; }
      else items.push({ label: l.label, amount: l.amount });
    });
    setExpItems(items); recalc(); triggerAutoSave();
  }
  function mergeExpItems(newItems) {
    const cur = getExpItems();
    newItems.forEach(n => {
      if (!cur.some(c => c.label.trim() === String(n.label).trim() && Math.abs(num(c.amount) - num(n.amount)) < 0.01)) cur.push({ label: n.label, amount: n.amount });
    });
    setExpItems(cur); recalc(); triggerAutoSave();
  }

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

   $('#go-sm').onclick = async () => {
      localStorage.removeItem('mazda_viewer'); S.role = null;
      const smId = $('#sm-sel').value;
      const pin = $('#sm-pin').value.trim();
      const s = (C.salesmen || []).find(x => x.id === smId);
      if (s && s.pin === pin) {
        try {
          if (!auth.currentUser) await auth.signInAnonymously();
          localStorage.setItem('mazda_sm', JSON.stringify({ id: s.id, name: s.name }));
          S.salesman = s;
          S.role = 'salesman';
          S.user = { email: s.id + '@salesman.mazda' };
          S.date = todayISO();
          shell();
        } catch (e) {
          loginView('लॉगिन नहीं हो पाया (इंटरनेट चेक करें): ' + e.message);
        }
      } else {
        loginView('गलत PIN दर्ज किया गया है!');
      }
    }; 

    $('#go-vw').onclick = async () => {
      const code = $('#vw-code').value.trim();
      if (code !== 'Mazda@123') return loginView('गलत व्यू कोड!');
      try {
        if (auth) {
          if (!auth.currentUser) await auth.signInAnonymously();
        }
      } catch (e) { console.error('Auth error:', e); }
      
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
    try {
      firebase.initializeApp(C.firebase);
      auth = firebase.auth(); db = firebase.firestore(); FV = firebase.firestore.FieldValue;
      
      APP.db = db; APP.auth = auth; APP.FV = FV;
      try { db.settings({ ignoreUndefinedProperties: true }); } catch(e) { console.log('Settings error', e); }

    } catch (e) {
      console.error(e);
      const err = document.getElementById('error-box');
      if (err) { err.style.display = 'block'; err.innerText = 'Firebase init error: ' + e.message; }
    }

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
      if (u && u.isAnonymous) { if (!S.role && !S.salesman) loginView(); return; }
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
        ['salesman', '⛽', 'मेरा हिसाब'],
        ['sm_udhar', '🚚', 'उधार एंट्री'],
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
    if (isSalesman() && !['salesman', 'sm_udhar', 'more'].includes(tab)) tab = 'salesman';
    S.tab = tab; S.partyView = null;
    $$('nav button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.classList.toggle('active', on); });
    window.scrollTo(0, 0);
    if (tab === 'day') return dayView(arg);
    if (tab === 'ledger') return ledgerView(arg);

    if (APP.views && typeof APP.views[tab] === 'function') {
      APP.views[tab](arg);
    } else {
      const m = $('#main');
      if (m) m.innerHTML = '<div class="card"><p class="mut">लोड हो रहा है…</p></div>';
      setTimeout(() => { if (APP.views && APP.views[tab]) APP.views[tab](arg); }, 200);
    }
  }
  APP.go = go;
  S._today = todayISO();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || S._today === todayISO()) return;
    S._today = todayISO();
    if (isSalesman() || !S.role) return;
    S.date = S._today; if (S.tab === 'day') dayView(S.date);
  });

  async function prevDay(date) {
    const s = await db.collection('days').where('date', '<', date).orderBy('date', 'desc').limit(1).get();
    return s.empty ? null : s.docs[0].data();
  }
  
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

  async function chainFor(date) {
    const dbPrev = await prevDay(date);
    if (!dbPrev) return null;
    const prev = Object.assign({}, dbPrev, S.draft[dbPrev.date] || {});
    const rs = await db.collection('ledger').where('date', '==', prev.date).get();
    const pc = K.compute(prev, rs.docs.map(x => x.data()));
    const nz = {};
    K.NZ.forEach(k => { const c = prev.nz && prev.nz[k] ? prev.nz[k].c : ''; nz[k] = K.has(c) ? c : ''; });
    return {
      prev, pc, nz, prevDate: prev.date,
      openCash: pc.close,
      openStockP: pc.actStockP !== null ? pc.actStockP : Math.max(0, pc.expStockP || 0),
      openStockD: pc.actStockD !== null ? pc.actStockD : Math.max(0, pc.expStockD || 0),
      estP: pc.actStockP === null, estD: pc.actStockD === null,
      gap: daysBetween(prev.date, date) - 1,
      prevSubmitted: prev.status === 'submitted'
    };
  }

  function applyChain(d, ch) {
    d.nz = d.nz || {};
    K.NZ.forEach(k => { d.nz[k] = Object.assign({ c: '' }, d.nz[k] || {}, { o: ch.nz[k] }); });
    d.openCash = ch.openCash; d.openStockP = ch.openStockP; d.openStockD = ch.openStockD;
    d.chainPrev = ch.prevDate;
  }

  function chainMismatch(d, ch) {
    const out = [], eq = (x, y) => Math.abs(num(x) - num(y)) < 0.01;
    K.NZ.forEach(k => {
      const o = d.nz && d.nz[k] ? d.nz[k].o : '', c = ch.nz[k];
      if ((K.has(o) || K.has(c)) && !(K.has(o) && K.has(c) && eq(o, c))) out.push(k.toUpperCase() + ' ओपनिंग ' + (K.has(o) ? o : '–') + ' ≠ कल की क्लोज़िंग ' + (K.has(c) ? c : '–'));
    });
    if (!eq(d.openCash, ch.openCash)) out.push('पिछला कैश ' + money(d.openCash) + ' ≠ कल का बचा कैश ' + money(ch.openCash));
    if (!eq(d.openStockP, ch.openStockP)) out.push('पेट्रोल ओपनिंग स्टॉक ' + lit(d.openStockP) + ' ≠ कल की डिप ' + lit(ch.openStockP));
    if (!eq(d.openStockD, ch.openStockD)) out.push('डीज़ल ओपनिंग स्टॉक ' + lit(d.openStockD) + ' ≠ कल की डिप ' + lit(ch.openStockD));
    return out;
  }

  async function newDay(date, ch) {
    const d = {
      date, testing: C.testing, rateP: S.rates.petrol, rateD: S.rates.diesel, nz: {},
      driverInaam: 0, chaiKhana: 0, status: 'open', opening_locked: true
    };
    if (ch) { applyChain(d, ch); const fresh = S.ratesSetAt === date; d.rateP = fresh ? S.rates.petrol : (ch.prev.rateP || d.rateP); d.rateD = fresh ? S.rates.diesel : (ch.prev.rateD || d.rateD); }
    else d.opening_locked = false;
    return d;
  }

  async function dayIsLocked(date) {
    if (isOwner()) return false;
    try { const s = await db.collection('days').doc(date).get(); return s.exists && s.data().status === 'submitted'; } catch (e) { return false; }
  }
  async function refreshDaySum(date) {
    try {
      const ds = await db.collection('days').doc(date).get(); if (!ds.exists) return;
      const rs = await db.collection('ledger').where('date', '==', date).get();
      const o = K.compute(ds.data(), rs.docs.map(x => x.data()));
      await db.collection('days').doc(date).update({ 'sum.sale': o.sale, 'sum.close': o.close, 'sum.litP': o.litP, 'sum.litD': o.litD });
    } catch (e) { }
  }
  APP.dayIsLocked = dayIsLocked; APP.refreshDaySum = refreshDaySum;
  const LOCKMSG = '❌ इस तारीख का हिसाब जमा (लॉक) हो चुका है — मालिक से अनलॉक करवाएँ';

  const baseOf = x => JSON.parse(JSON.stringify(x || {}, (k, v) => k === 'at' ? undefined : v));
  function dayPatch(base, d) {
    const walk = (b, n) => {
      const out = {};
      Object.keys(n).forEach(k => {
        const nv = n[k], bv = b ? b[k] : undefined;
        if (nv && typeof nv === 'object' && !Array.isArray(nv) && Object.getPrototypeOf(nv) === Object.prototype) {
          const sub = walk(bv && typeof bv === 'object' ? bv : {}, nv);
          if (Object.keys(sub).length) out[k] = sub;
        } else if (JSON.stringify(nv) !== JSON.stringify(bv)) out[k] = nv;
      });
      return out;
    };
    const p = walk(base || {}, d);
    ['sum', 'at', 'by', 'status'].forEach(k => { if (d[k] !== undefined) p[k] = d[k]; });
    return p;
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
    let ds, rs, ch, chainErr = null;
    try {
      const [dsR, rsR, chR] = await Promise.all([
        db.collection('days').doc(date).get(),
        db.collection('ledger').where('date', '==', date).get(),
        chainFor(date).catch(e => { chainErr = e; return null; })
      ]);
      ds = dsR; rs = rsR; ch = chR;
    } catch (e) { main.innerHTML = errBox(e) + '<div class="btns" style="margin-top:10px"><button class="btn" onclick="APP.dayView(\'' + date + '\')">🔄 दोबारा कोशिश</button></div>'; return; }
    if (chainErr && !ds.exists) { main.innerHTML = errBox('कल का हिसाब लोड नहीं हुआ: ' + (chainErr.message || chainErr)) + '<div class="btns" style="margin-top:10px"><button class="btn" onclick="APP.dayView(\'' + date + '\')">🔄 दोबारा कोशिश</button></div>'; return; }

    let d = ds.exists ? ds.data() : null;
    const rows = rs.docs.map(x => ({ id: x.id, ...x.data() })).filter(r => !K.isOpening(r)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    if (!d) d = await newDay(date, ch);
    const frozen = ds.exists && ds.data().status === 'submitted';
    if (S.draft[date]) d = Object.assign({}, d, S.draft[date]);

    let chainDiff = [];
    if (ch && d.opening_locked !== false) {
      if (frozen) chainDiff = chainMismatch(d, ch);
      else applyChain(d, ch);
    }

    const locked = (d.status === 'submitted' && !isOwner()) || isViewer();
    const dis = locked ? 'disabled' : '';
    const chainLock = !!(ch && d.opening_locked !== false);
    const stkRO = () => (!locked && chainLock) ? 'readonly style="background:#f0f0f0;font-weight:bold"' : '';
    const stkBtn = () => '';
    const isOpeningLocked = chainLock;
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
    const splitBtn = f => locked ? '' : `<button class="btn sm w" type="button" data-do="splitF" data-f="${f}" style="padding:2px 8px;font-size:12px">✂️ बाँटें</button>`;

    let chainHtml = '';
    if (ch) {
      const n = [];
      if (ch.gap > 0) n.push('⚠️ ' + dmy(ch.prevDate) + ' के बाद ' + ch.gap + ' दिन का हिसाब नहीं बना — ओपनिंग ' + dmy(ch.prevDate) + ' से आई है');
      if (!ch.prevSubmitted) n.push('⚠️ ' + dmy(ch.prevDate) + ' का हिसाब अभी जमा नहीं हुआ — उसमें बदलाव हुआ तो आज की ओपनिंग भी बदलेगी');
      if (ch.estP || ch.estD) n.push('ℹ️ ' + dmy(ch.prevDate) + ' की ' + [ch.estP ? 'पेट्रोल' : '', ch.estD ? 'डीज़ल' : ''].filter(Boolean).join(' और ') + ' डिप नहीं डली थी — ओपनिंग स्टॉक अंदाज़े से है');
      if (chainDiff.length) n.push('❌ इस जमा हिसाब की ओपनिंग कल से मेल नहीं खाती:<br>' + chainDiff.map(esc).join('<br>'));
      chainHtml = n.map(x => '<div class="warn" style="margin-bottom:8px">' + x + '</div>').join('');
      if (chainDiff.length && isOwner() && !locked) chainHtml += '<div class="btns" style="margin:-4px 0 10px"><button class="btn sm o" data-do="relink">🔗 कल से दोबारा जोड़ें</button></div>';
    }
    if (chainErr) chainHtml += '<div class="warn" style="margin-bottom:8px">⚠️ कल का हिसाब लोड नहीं हुआ — ओपनिंग जाँचकर ही सेव करें</div>';

    main.innerHTML = `
    ${chainHtml}<div class="card"><div class="row"><div><label style="margin-top:0">तारीख</label>
      <input type="date" id="f-date" value="${date}" max="${todayISO()}" ${minDate ? 'min="' + minDate + '"' : ''}></div>
      <div style="flex:0 0 auto;align-self:end">${locked ? '<span class="chip g">जमा ✔ लॉक</span>' : d.status === 'submitted' ? '<span class="chip o">जमा (खुला)</span>' : '<span class="chip">चालू</span>'}</div></div></div>

    <div class="card"><h3>आज का रेट (₹/लीटर)</h3><div class="row">
      <div><label>पेट्रोल</label>${inp('f-rateP', d.rateP)}</div><div><label>डीज़ल</label>${inp('f-rateD', d.rateD)}</div>
      <div><label>टेस्टिंग (L)</label>${inp('f-testing', d.testing)}</div></div></div>

    <div class="card"><h3>मीटर रीडिंग</h3>
      <div class="nz h"><span></span><span>ओपनिंग</span><span>क्लोज़िंग</span><span style="text-align:right">नेट L</span></div>
      <b class="mut">पेट्रोल</b>${['p1', 'p2', 'p3', 'p4'].filter(k => K.activeNz().includes(k)).map(k => nzr(k, k.toUpperCase())).join('')}
      <b class="mut">डीज़ल</b>${['d1', 'd2', 'd3', 'd4'].filter(k => K.activeNz().includes(k)).map(k => nzr(k, k.toUpperCase())).join('')}
      <div id="nzwarn"></div>
      ${(!locked && isOwner() && ch) ? `
      <div class="btns" style="margin-top:8px">
        <button class="btn sm w" id="toggle-open" type="button">${isOpeningLocked ? '🔓 ओपनिंग एडिट करें' : '🔒 ओपनिंग लॉक करें (पिछले दिन से जोड़ें)'}</button>
      </div>` : ''}
    </div>

    <div class="card"><h3>🛢️ पेट्रोल स्टॉक (लीटर)</h3>
      <div class="row">
        <div><label>ओपनिंग स्टॉक (L)</label><input id="f-openStockP" inputmode="decimal" ${stkRO(d.openStockP)} value="${esc(d.openStockP || '')}" ${dis}>${stkBtn('P')}</div>
        <div>
          <label>टैंकर आया (L)</label>${inp('f-tankerP', d.tankerP)}
        </div>
      </div>
      <div class="row" style="margin-top:8px">
        <div><label>आज की डिप</label>${inp('f-dipP', d.dipP)}</div>
        <div><label>डिप के हिसाब से (L)</label><input id="f-actStockP" readonly style="background:#f0f0f0;font-weight:bold" value=""></div>
      </div>
      <div id="stkP" style="margin-top:8px"></div>
    </div>

    <div class="card"><h3>🛢️ डीज़ल स्टॉक (लीटर)</h3>
      <div class="row">
        <div><label>ओपनिंग स्टॉक (L)</label><input id="f-openStockD" inputmode="decimal" ${stkRO(d.openStockD)} value="${esc(d.openStockD || '')}" ${dis}>${stkBtn('D')}</div>
        <div>
          <label>टैंकर आया (L)</label>${inp('f-tankerD', d.tankerD)}
        </div>
      </div>
      <div class="row" style="margin-top:8px">
        <div><label>आज की डिप</label>${inp('f-dipD', d.dipD)}</div>
        <div><label>डिप के हिसाब से (L)</label><input id="f-actStockD" readonly style="background:#f0f0f0;font-weight:bold" value=""></div>
      </div>
      <div id="stkD" style="margin-top:8px"></div>
    </div>

    <div class="card"><h3>पार्टी उधार / जमा (आज)</h3>
      <div id="rowsbox"></div>
      <div class="btns">${locked ? '' : '<button class="btn o" data-do="addU">+ उधार</button><button class="btn g" data-do="addJ">+ जमा</button>'}</div></div>

    <div class="card"><h3>कैश और भुगतान</h3>
      <label>पिछला कैश / AD (कल का बचा कैश)${chainLock ? ' 🔒' : ''}</label><input id="f-openCash" inputmode="decimal" value="${esc(d.openCash == null ? '' : d.openCash)}" ${dis} ${(!locked && chainLock) ? 'readonly style="background:#f0f0f0;font-weight:bold"' : ''}>
      <div class="row"><div><label>Paytm/UPI कुल</label>${inp('f-paytm', d.paytm)}</div><div><label>स्वाइप कुल</label>${inp('f-swipe', d.swipe)}</div></div>
      
      <div class="row" style="margin-top:8px">
        <div><div class="lh"><label>खर्चा DG (जनरेटर)</label>${splitBtn('kharcha')}</div>${inp('f-kharcha', d.kharcha)}</div>
        <div><div class="lh"><label>ड्राइवर इनाम</label>${splitBtn('driverInaam')}</div>${inp('f-driverInaam', d.driverInaam)}</div>
      </div>
      <div class="row">
        <div><div class="lh"><label>चाय-खाना</label>${splitBtn('chaiKhana')}</div>${inp('f-chaiKhana', d.chaiKhana)}</div>
        <div><div class="lh"><label>मालिक को दिया (SBI जमा)</label></div>${inp('f-malikDiya', d.malikDiya)}</div>
      </div>
      <div class="lh" style="margin-top:10px"><label>और खर्चे (हर चीज़ अलग लिखें)</label></div>
      <div id="expbox"></div>
      ${locked ? '' : '<button class="btn sm w" type="button" data-do="addX">+ और खर्चा जोड़ें</button>'}
      <label>नोट</label><input id="f-note" value="${esc(d.note || '')}" ${dis}></div>

    <div class="card"><h3>आज का हिसाब</h3><div id="sum"></div></div>

    <div class="btns">
      ${locked ? '' : '<button class="btn w" data-do="save">💾 सेव</button>'}
      ${locked ? '' : '<button class="btn g" data-do="submit">✅ जमा करें (लॉक)</button>'}
      ${isOwner() && d.status === 'submitted' ? '<button class="btn o" data-do="unlock">🔓 अनलॉक</button>' : ''}
      <button class="btn" data-do="report">📤 कॉम्पैक्ट रिपोर्ट</button>
      ${locked ? '' : '<button class="btn o" data-do="importShifts">📥 शिफ्ट से भरें</button>'}
      ${locked ? '' : '<button class="btn w" data-do="scan">📷 AI रजिस्टर स्कैन</button>'}
    </div>`;

    setExpItems(Array.isArray(d.kharchaItems) ? d.kharchaItems : [], locked);
    ['P', 'D'].forEach(f => {
      const b = $('#stk-tg' + f); if (!b) return;
      b.onclick = () => {
        if (!confirm('ओपनिंग स्टॉक पिछले दिन की डिप से अपने-आप आता है।\nबदलने पर आज का "फर्क" भी बदल जाएगा। बदलें?')) return;
        const el = $('#f-openStock' + f); el.removeAttribute('readonly'); el.style.background = ''; el.style.fontWeight = ''; el.focus(); b.remove();
      };
    });
    const state = { d, rows, date, locked, chain: ch, chainDiff, base: ds.exists ? baseOf(ds.data()) : {} };
    S.cur = state;
    renderRows(state);
    recalc();
    
    // Analytics card injection (async, doesn't block)
    if (APP.ANALYTICS && APP.ANALYTICS.getDayCardHtml && !isViewer()) {
      APP.ANALYTICS.getDayCardHtml(date).then(html => {
        if (!html) return;
        if (document.querySelector('#day-analytics-card-wrapper')) return;
        const dateInput = $('#f-date');
        if (!dateInput) return;
        const dateCard = dateInput.closest('.card');
        if (!dateCard) return;
        const wrap = document.createElement('div');
        wrap.id = 'day-analytics-card-wrapper';
        wrap.innerHTML = html;
        dateCard.after(wrap);
      }).catch(() => {});
    }
    
    $('#f-date').onchange = e => { collectDraft(); S._costCache = {}; dayView(e.target.value || todayISO()); };
    
    if ($('#toggle-open')) {
      const setRO = ro => {
        const els = $$('.nzi[data-f="o"]').concat(['f-openCash', 'f-openStockP', 'f-openStockD'].map(id => $('#' + id)).filter(Boolean));
        els.forEach(el => {
          if (ro) { el.setAttribute('readonly', true); el.style.background = '#f0f0f0'; el.style.fontWeight = 'bold'; }
          else { el.removeAttribute('readonly'); el.style.background = ''; el.style.fontWeight = ''; }
        });
      };
      $('#toggle-open').onclick = () => {
        const cur = S.cur;
        if (cur.d.opening_locked !== false) {
          if (!confirm('⚠️ ओपनिंग (मीटर, कैश, स्टॉक) एडिट करेंगे तो कल की क्लोज़िंग से लिंक टूट जाएगा। आगे बढ़ें?')) return;
          cur.d.opening_locked = false; setRO(false);
          $('#toggle-open').textContent = '🔒 ओपनिंग लॉक करें (कल से जोड़ें)';
        } else {
          const c2 = cur.chain; if (!c2) return toast('कल का हिसाब नहीं मिला');
          cur.d.opening_locked = true;
          $$('.nzi[data-f="o"]').forEach(el => { el.value = c2.nz[el.dataset.k]; });
          $('#f-openCash').value = c2.openCash; $('#f-openStockP').value = c2.openStockP; $('#f-openStockD').value = c2.openStockD;
          setRO(true);
          $('#toggle-open').textContent = '🔓 ओपनिंग एडिट करें';
        }
        recalc(); triggerAutoSave();
      };
    }

    $$('#main input').forEach(i => {
      if (i.id !== 'f-date' && !i.closest('#expbox')) {
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
      tankerP: g('f-tankerP'), tankerD: g('f-tankerD'), 
      dipP: g('f-dipP'), dipD: g('f-dipD'), nz: {},
      physicalCash: $('#f-physicalCash') ? g('f-physicalCash') : (st.d.physicalCash == null ? '' : st.d.physicalCash),
      opening_locked: st.d.opening_locked !== false,
      kharchaItems: $('#expbox')
        ? getExpItems().filter(x => x.label || num(x.amount)).map(x => ({ label: x.label, amount: num(x.amount) }))
        : (st.d.kharchaItems || [])
    });
    K.NZ.forEach(k => { d.nz[k] = Object.assign({ o: '', c: '' }, K.activeNz().includes(k) ? {} : ((st.d.nz || {})[k] || {})); });
    $$('.nzi').forEach(i => { d.nz[i.dataset.k][i.dataset.f] = i.value; });
    return d;
  }
  function collectDraft() { if (S.cur && !S.cur.locked) { const d = readForm(); delete d.sum; S.draft[S.cur.date] = d; } }

  function renderRows(st) {
    const rows = st.rows;
    $('#rowsbox').innerHTML = rows.length ? rows.map(r => `<div class="item"><div class="a"><b>${esc(r.partyName)}</b>
      <small>${esc(r.time || '')} · ${r.kind === 'udhar' ? esc(r.vehicle || '') + (r.fuel ? ' · ' + (FUEL[r.fuel] || '') + ' ' + lit(r.litre) : '') : 'जमा · ' + (MODE[r.mode] || '') + (r.note && !AUTO_NOTES.includes(r.note) ? ' · ' + esc(r.note) : '')}</small>
      ${r.src === 'salesman' ? `<small style="color:${r.verified ? '#0a7d33' : '#b26a00'}">👤 ${esc(r.by)} ने की · ${r.verified ? '✔ मिलान हो गया' : '⏳ मिलान बाकी'}</small>` : ''}</div>
      <div style="text-align:right"><b class="${r.kind === 'udhar' ? 'neg' : 'pos'}">${r.kind === 'udhar' ? '' : '+'}${money(r.amount)}</b>
      ${isOwner() ? `<div>${r.src === 'salesman' && !r.verified ? `<button class="btn sm g" data-do="verE" data-id="${r.id}">✔ मिलान</button> ` : ''}<button class="btn sm w" data-do="editE" data-id="${r.id}">✏️</button> <button class="btn sm r" data-do="delE" data-id="${r.id}">🗑</button></div>` : ''}</div></div>`).join('')
      : '<p class="mut">आज कोई पार्टी एंट्री नहीं</p>';
  }

  async function updateMarginCard(d, o, date) {
    if (!APP.margins) return;
    const cache = S._costCache || (S._costCache = {});
    let rates = cache[date];
    if (!rates || Date.now() - (rates._t || 0) > 5 * 60 * 1000) {
      try {
        const [p, dd] = await Promise.all([
          APP.margins.getLatestPurchaseRate('petrol', date),
          APP.margins.getLatestPurchaseRate('diesel', date)
        ]);
        let dc = null;
        try {
          const snap = await db().collection('day_costs').doc(date).get();
          if (snap.exists) dc = snap.data();
        } catch (e) {}
        rates = {
          petrol: p || (dc && num(dc.costP)) || 0,
          diesel: dd || (dc && num(dc.costD)) || 0,
          source: (p || dd) ? 'invoice' : 'manual',
          _t: Date.now()
        };
        cache[date] = rates;
      } catch (e) { return; }
    }
    const costP = num(rates.petrol), costD = num(rates.diesel);
    const rateP = num(d.rateP), rateD = num(d.rateD);
    const hasP = o.litP > 0 && costP > 0 && rateP > 0;
    const hasD = o.litD > 0 && costD > 0 && rateD > 0;
    if (!hasP && !hasD) {
      const el = document.querySelector('#day-margin-card');
      if (el) el.remove();
      return;
    }
    const marginP = hasP ? r2((rateP - costP) * o.litP) : 0;
    const marginD = hasD ? r2((rateD - costD) * o.litD) : 0;
    const total = r2(marginP + marginD);
    const pct = o.sale > 0 ? r2(total / o.sale * 100) : 0;
    const totalCls = total >= 0 ? 'pos' : 'neg';
    
    let el = document.querySelector('#day-margin-card');
    if (!el) {
      el = document.createElement('div');
      el.id = 'day-margin-card';
      el.className = 'card';
      el.style.cssText = 'border-left:4px solid #16a34a;background:linear-gradient(180deg,#f0fdf4,#fff)';
      const sumBox = document.querySelector('#sum');
      if (sumBox) {
        const sumCard = sumBox.closest('.card');
        if (sumCard) sumCard.after(el);
      } else return;
    }
    el.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<h3 style="margin:0;color:#166534;font-size:15px">💰 आज का अनुमानित मार्जिन</h3>' +
      '<span class="mut" style="font-size:11px">' + (rates.source === 'invoice' ? 'बिल से' : 'manual rate') + '</span></div>' +
      (hasP ? '<div class="kv" style="padding:4px 0"><span>⛽ पेट्रोल <span class="mut" style="font-size:11px">(' + lit(o.litP) + ' × ₹' + r2(rateP - costP) + '/L)</span></span><b class="' + (marginP >= 0 ? 'pos' : 'neg') + '">' + money(marginP) + '</b></div>' : '') +
      (hasD ? '<div class="kv" style="padding:4px 0"><span>🛢️ डीज़ल <span class="mut" style="font-size:11px">(' + lit(o.litD) + ' × ₹' + r2(rateD - costD) + '/L)</span></span><b class="' + (marginD >= 0 ? 'pos' : 'neg') + '">' + money(marginD) + '</b></div>' : '') +
      '<div class="kv" style="border-top:1px solid #bbf7d0;padding-top:6px;margin-top:4px;border-bottom:0"><span><b>कुल मार्जिन</b> <span class="mut" style="font-size:11px">(' + pct + '%)</span></span><b class="' + totalCls + '" style="font-size:16px">' + money(total) + '</b></div>';
  }

  function recalc() {
    const st = S.cur; if (!st) return;
    const d = readForm(), o = K.compute(d, st.rows);
    
    K.NZ.forEach(k => { const e = $('#net-' + k); if (e) e.textContent = o.nz[k].ok ? r2(o.nz[k].net) : '–'; });
    $('#nzwarn').innerHTML = o.warn.map(w => '<div class="warn">' + esc(w) + '</div>').join('') +
      (o.filled < K.activeNz().length ? `<div class="mut">${o.filled}/${K.activeNz().length} नोज़ल भरे हैं</div>` : '');
      
    const tol = num(C.stockTolerance) || 25;
    const setStkHtml = (prefix, exp, act, diff, tanker, sale) => {
      const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
      let html = kvEl('कल की डिप (ओपनिंग स्टॉक)', lit(num(d['openStock' + prefix]))) +
                 kvEl('+ टैंकर आया', lit(num(tanker))) +
                 kvEl('− आज की बिक्री (मीटर)', lit(sale)) +
                 kvEl('= होना चाहिए', lit(exp)) +
                 kvEl('आज की डिप (असली स्टॉक)', act !== null ? lit(act) : 'डिप डालें', 'big');
      if (diff !== null) {
        const a = Math.abs(diff), sg = diff > 0 ? '+' : '';
        html += a <= 0.5 ? '<div class="ok" style="margin-top:6px">✔ स्टॉक बराबर है</div>'
          : a <= tol ? `<div class="warn" style="margin-top:6px">≈ फर्क ${sg}${r2(diff)} L (डिप की सटीकता के अंदर)</div>`
          : `<div class="err" style="margin-top:6px">⚠️ स्टॉक ${diff < 0 ? 'कम' : 'ज़्यादा'}: <b>${sg}${r2(diff)} L</b> — जाँचें</div>`;
      }
      if (act !== null && act < (prefix === 'P' ? 1200 : 1000)) html += `<div class="warn" style="margin-top:6px">⚠️ स्टॉक खत्म होने वाला है! (${act} L बचा है)</div>`;
      return html;
    };

    const elP = $('#stkP'); if (elP) elP.innerHTML = setStkHtml('P', o.expStockP, o.actStockP, o.diffP, d.tankerP, o.litP);
    const elD = $('#stkD'); if (elD) elD.innerHTML = setStkHtml('D', o.expStockD, o.actStockD, o.diffD, d.tankerD, o.litD);

    const actInpP = $('#f-actStockP'); if(actInpP) actInpP.value = o.actStockP !== null ? r2(o.actStockP) : '';
    const actInpD = $('#f-actStockD'); if(actInpD) actInpD.value = o.actStockD !== null ? r2(o.actStockD) : '';

    const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
    
    const gallaIn = r2(num(d.openCash) + o.sale + o.jCash + o.jPaytm + o.jSwipe);
    const gallaOut = r2(num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya));

    $('#sum').innerHTML = `
      <div style="font-size:13px; color:#555; margin-bottom:8px; display:flex; justify-content:space-between;">
        <span>पेट्रोल: <b>${lit(o.litP)}</b> (${money(o.amtP)})</span>
        <span>डीज़ल: <b>${lit(o.litD)}</b> (${money(o.amtD)})</span>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div style="flex:1; min-width:0; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px;">
          <div style="font-weight:bold; color:#166534; margin-bottom:4px; font-size:13px; text-align:center;">💰 गल्ला (आमदनी)</div>
          ${kvEl('बिक्री', money(o.sale))}
          ${kvEl('पिछला कैश (AD)', money(d.openCash))}
          ${kvEl('पार्टी जमा', money(o.jCash + o.jPaytm + o.jSwipe))}
          <div class="kv" style="border-top:1px solid #bbf7d0; margin-top:4px; padding-top:4px; font-weight:bold; color:#166534; border-bottom:0;"><span>कुल गल्ला</span><b>${money(gallaIn)}</b></div>
        </div>
        <div style="flex:1; min-width:0; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:8px;">
          <div style="font-weight:bold; color:#991b1b; margin-bottom:4px; font-size:13px; text-align:center;">💸 खर्चा (निकासी)</div>
          ${kvEl('Paytm + स्वाइप', money(num(d.paytm) + num(d.swipe)))}
          ${kvEl('उधार दिया', money(o.udhar))}
          ${kvEl('DG/चाय/अन्य', money(o.totalKharcha))}
          ${kvEl('SBI जमा', money(d.malikDiya))}
          <div class="kv" style="border-top:1px solid #fecaca; margin-top:4px; padding-top:4px; font-weight:bold; color:#991b1b; border-bottom:0;"><span>कुल खर्चा</span><b>${money(gallaOut)}</b></div>
        </div>
      </div>
      <div style="padding:12px; background:#0b3d91; color:#fff; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 10px rgba(11,61,145,0.3);">
        <span style="font-size:15px; font-weight:600;">असली कैश (बचा)</span>
        <span style="font-size:22px; font-weight:bold;">${money(o.close)}</span>
      </div>
    `;
    st.o = o;
    
    // Margin card injection
    updateMarginCard(d, o, st.date).catch(() => {});
  }

  async function saveDay(submit, silent = false) {
    if (isViewer()) return toast('आप केवल देख सकते हैं');
    const st = S.cur; if(!st) return;
    const d = readForm(); const o = K.compute(d, st.rows);
    if (silent && !st.d.at && o.filled === 0 && !num(d.paytm) && !num(d.swipe) && !num(d.malikDiya) && !K.khTotal(d)) return;
    if (submit && !silent) {
      const ch = st.chain;
      const v = (K.validate || (() => ({ errors: [], warns: [] })))(d, st.rows, { isOwner: isOwner(), prevPending: (ch && !ch.prevSubmitted) ? dmy(ch.prevDate) : '', gap: ch ? ch.gap : 0, prevDate: ch ? dmy(ch.prevDate) : '' });
      if (v.errors.length) { alert('❌ अभी जमा नहीं हो सकता:\n\n• ' + v.errors.join('\n• ')); return; }
      if (v.warns.length) { if (!confirm('⚠️ ध्यान दें:\n\n• ' + v.warns.join('\n• ') + '\n\nफिर भी जमा करके लॉक करें?')) return; }
      else if (!confirm('क्या आप आज का हिसाब जमा करके लॉक करना चाहते हैं?')) return;
    }
    d.sum = { sale: o.sale, litP: o.litP, litD: o.litD, close: o.close, expStockP: o.expStockP, expStockD: o.expStockD, actStockP: o.actStockP, actStockD: o.actStockD, diffP: o.diffP, diffD: o.diffD,
      openCash: num(d.openCash), openStockP: num(d.openStockP), openStockD: num(d.openStockD),
      physical: K.has(d.physicalCash) ? num(d.physicalCash) : null, physDiff: K.has(d.physicalCash) ? r2(num(d.physicalCash) - o.close) : null };
    d.status = submit ? 'submitted' : (st.d.status || 'open');
    d.by = S.user.email; d.at = FV.serverTimestamp();
    
    S.draft[st.date] = d;

    try {
      await commit(db.collection('days').doc(st.date).set(dayPatch(st.base, d), { merge: true }));
      st.base = baseOf(d);
      S.rates = { petrol: d.rateP, diesel: d.rateD }; delete S.draft[st.date];
      
      try {
        const bankRef = db.collection('bank_deposits');
        const docId = 'sbi_auto_' + st.date;
        const mdAmt = num(d.malikDiya);
        
        const exSnap = await bankRef.doc(docId).get();
        const exd = exSnap.exists ? exSnap.data() : null;
        if (exd && (exd.removed || exd.edited)) {
        } else if (mdAmt > 0) {
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

      if (!silent) {
        audit(submit ? 'day_submit' : 'day_save', { date: st.date, sale: o.sale, close: o.close });
        toast(submit ? 'हिसाब जमा हो गया' : 'सेव हो गया');
      }
      if (submit && !silent) { await dayView(st.date); } else { st.d = d; }
    } catch (e) { if (!silent) toast('सेव नहीं हुआ: ' + e.message); }
  }

  async function findDupEntry(d) {
    try {
      const nv = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const s = await db.collection('ledger').where('date', '==', d.date).where('partyId', '==', d.partyId).get();
      return s.docs.map(x => ({ id: x.id, ...x.data() }))
        .find(r => r.kind === 'udhar' && nv(r.vehicle) === nv(d.vehicle) && Math.abs(num(r.amount) - d.amount) < 0.01) || null;
    } catch (e) { return null; }
  }
  APP.findDupEntry = findDupEntry;

  const sigEntry = (priv, e) => priv ? (e.status === 'pending' ? num(e.amount) : 0) : K.signed(e);

  function sendEntryWhatsApp(data, party, priv) {
    if (!party.phone) return;
    const ph = String(party.phone).replace(/\D/g, '').replace(/^0+/, '');
    if (!ph) return;
    const wa = ph.length === 10 ? '91' + ph : ph;
    let msg;
    if (data.kind === 'udhar') {
      msg = `नमस्ते ${party.name} जी,\n\n`;
      msg += `आपकी गाड़ी *${data.vehicle || ''}* पर भरा:\n`;
      msg += `⛽ ${data.fuel === 'petrol' ? 'पेट्रोल' : 'डीज़ल'} ${r2(data.litre)} L × ₹${r2(data.rate)} = *₹${r2(data.amount)}*\n`;
      msg += `📅 ${dmy(data.date)} ${data.time || ''}\n`;
      msg += `\nमाज़दा ऑयल कंपनी`;
    } else {
      msg = `नमस्ते ${party.name} जी,\n\n`;
      msg += `आपका *₹${r2(data.amount)}* का भुगतान प्राप्त हुआ।\n`;
      msg += `📅 ${dmy(data.date)} ${data.time || ''}\n\n`;
      msg += `धन्यवाद! 🙏\nमाज़दा ऑयल कंपनी`;
    }
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), '_blank');
  }

  async function entryModal(o) {
    if (isViewer()) return toast('आप केवल देख सकते हैं');
    const priv = !!o.priv, e = o.entry || null, kind0 = e ? e.kind : (isSalesman() ? 'udhar' : (o.kind || 'udhar'));
    const parties = await getParties(priv);
    if (!parties.length) { toast('पहले खाते में पार्टी जोड़ें'); return; }
    const date0 = e ? e.date : (o.date || S.date || todayISO());
    const rates = { petrol: S.rates.petrol, diesel: S.rates.diesel };
    const pid0 = e ? e.partyId : (o.partyId || parties[0].id);

    const m = modal(`<h3>${e ? 'एंट्री बदलें' : priv ? 'निजी उधार जोड़ें' : 'नई एंट्री'}</h3>
      ${(priv || isSalesman()) ? '' : `<div class="seg"><button data-k="udhar">उधार (तेल दिया)</button><button data-k="jama">जमा (पैसा आया)</button></div>`}
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
      syncNote();
    };
    const syncNote = () => {
      if (kind !== 'jama') return;
      const nt = q('e-note'), v = nt.value.trim();
      if (!v || AUTO_NOTES.includes(v)) nt.value = AUTO_LBL[q('e-mode').value] || '';
    };
    q('e-mode').onchange = syncNote;
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
      if (!party) return toast('पार्टी नहीं मिली, रिफ्रेश करें');
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
        if (!data.note) data.note = AUTO_LBL[data.mode] || '';
      }
      if (priv) { data.status = e ? e.status : 'pending'; }
      const who = S.salesman ? S.salesman.name : S.user.email;
      if (e) {
        ['by', 'src', 'sid', 'uid', 'verified', 'verifiedBy'].forEach(k => { if (e[k] !== undefined) data[k] = e[k]; });
        data.editedBy = who;
      } else {
        data.by = who;
        data.uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        if (S.salesman) { data.src = 'salesman'; data.sid = S.salesman.id; }
      }
      data.at = FV.serverTimestamp();

      const sbtn = q('e-save');
      if (sbtn.disabled) return;                       
      if (!priv && (await dayIsLocked(data.date) || (e && e.date !== data.date && await dayIsLocked(e.date)))) return toast(LOCKMSG);
      
      // CIBIL-based credit limit check
      if (!e && data.kind === 'udhar' && APP.cibil && APP.cibil.checkLimit) {
        try {
          const check = await APP.cibil.checkLimit(party, data.amount, priv);
          if (check && !check.allow) {
            if (check.blocked) { sbtn.disabled = false; return toast(check.reason || 'उधार सीमा पार'); }
            if (!confirm((check.reason || '') + '\n\nफिर भी जोड़ें?')) { sbtn.disabled = false; return; }
          }
        } catch (x) { console.error('Credit check error', x); }
      }
      
      if (!e && data.kind === 'udhar' && !priv) {
        const dup = await findDupEntry(data);
        if (dup) {
          const by = dup.src === 'salesman' ? 'सेल्समैन ' + dup.by : (dup.by || '?');
          if (!confirm('⚠️ ऐसी ही एंट्री पहले से मौजूद है:\n' + dup.partyName + ' · ' + dup.vehicle + ' · ' + money(dup.amount) + ' · ' + (dup.time || '') + '\nकिसने की: ' + by + '\n\nफिर भी दोबारा जोड़ें?')) return;
        }
      }
      if (!e && data.kind === 'udhar' && !priv && num(party.limit) > 0 && num(party.bal) + data.amount > num(party.limit)) {
        if (!confirm('⚠️ ' + party.name + ' की उधार सीमा ' + money(party.limit) + ' है।\nअभी बकाया ' + money(party.bal) + ' + यह ' + money(data.amount) + ' = ' + money(num(party.bal) + data.amount) + '\n\nफिर भी उधार दें?')) return;
      }
      sbtn.disabled = true;

      const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
      const ref = e ? db.collection(col).doc(e.id) : db.collection(col).doc();
      const b = db.batch(); b.set(ref, data);
      const newSig = sigEntry(priv, data);
      const delta = newSig - (e ? sigEntry(priv, e) : 0);
      if (e && e.partyId && e.partyId !== partyId) {
        const oldSig = sigEntry(priv, e);
        if (oldSig) b.update(db.collection(pcol).doc(e.partyId), { bal: FV.increment(-oldSig) });
        if (newSig) b.update(db.collection(pcol).doc(partyId), { bal: FV.increment(newSig) });
      } else if (delta) b.update(db.collection(pcol).doc(partyId), { bal: FV.increment(delta) });

      try {
        await commit(b.commit());
        m.close(); toast('सेव हो गया ✔');
        if (e) audit('ledger_edit', { party: party.name, was: { amount: e.amount, litre: e.litre, date: e.date, kind: e.kind }, now: { amount: data.amount, litre: data.litre, date: data.date, kind: data.kind }, priv });
        if (!priv) { refreshDaySum(data.date); if (e && e.date !== data.date) refreshDaySum(e.date); }
        const savedParty = Object.assign({}, party);
        S.parties[priv ? 'priv' : 'pub'] = null;
        if (S.partyView) partyView(S.partyView.id, S.partyView.priv);
        else if (S.tab === 'day') dayView(S.date);
        else if (S.tab === 'ledger') ledgerView();
        else if (S.tab === 'priv') partyView(partyId, true);
        else if (APP.views && APP.views[S.tab]) APP.views[S.tab]();
        if (APP.afterEntrySaved) { try { APP.afterEntrySaved({ data, party: savedParty, priv, isNew: !e, delta }); } catch (z) { console.error(z); } }
        
        // WhatsApp prompt (only for new entries, non-private, party has phone)
        if (!e && !priv && party.phone) {
          setTimeout(() => {
            if (confirm('📤 ' + party.name + ' को WhatsApp पर भेजें?\n\n' + (data.kind === 'udhar' ? 'तेल भरने की पर्ची' : 'जमा की रसीद'))) {
              sendEntryWhatsApp(data, party, priv);
            }
          }, 400);
        }
      } catch (x) { sbtn.disabled = false; toast('सेव नहीं हुआ: ' + x.message); }
    };
  }

  async function ledgerView() {
    S.partyView = null;
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
        const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '+₹' + Math.abs(b).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
        const cls = b > 0 ? 'r' : (b < 0 ? 'g' : '');
        const cibilBadge = (APP.cibil && APP.cibil.badgeHtml) ? APP.cibil.badgeHtml(p) : '';
        return `<div class="item" data-id="${p.id}" style="cursor:pointer">
          <div class="a"><b>${esc(p.name)}</b> ${cibilBadge}<small>${esc((p.vehicles || []).join(', '))}</small></div>
          <span class="chip ${cls}">${disp}</span>
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
    S.partyView = { id, priv: !!priv };
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let ps, es;
    try { [ps, es] = await Promise.all([db.collection(pcol).doc(id).get(), db.collection(col).where('partyId', '==', id).get()]); }
    catch (e) { main.innerHTML = errBox(e); return; }
    if (!ps.exists) { S.partyView = null; main.innerHTML = '<div class="err">पार्टी नहीं मिली</div>'; return; }
    const p = { id, ...ps.data() };
    const all = es.docs.map(x => ({ id: x.id, ...x.data() }));
    const st = K.stmt(all, null, null);
    
    const tDr = st.rows.filter(r => r.kind === 'udhar').reduce((a, b) => a + num(b.amount), 0);
    const tCr = st.rows.filter(r => r.kind === 'jama').reduce((a, b) => a + num(b.amount), 0);
    const ph = String(p.phone || '').replace(/\D/g, '').replace(/^0+/, ''), wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
    const mism = !priv && Math.abs(num(p.bal) - st.close) > 0.5;
    const viewer = isViewer();
    const desc = r => {
      if (r.opening) return '<b>पिछला बैलेंस</b>' + (r.note && !/Opening Balance/i.test(r.note) ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
      if (r.kind === 'udhar') return '<b>' + esc(r.vehicle || '-') + '</b>' + (r.fuel ? '<br><small class="mut">' + (FUEL[r.fuel] || '') + ' · ' + lit(r.litre) + (num(r.rate) ? ' × ₹' + num(r.rate) : '') + '</small>' : '') + (r.note ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
      return '<b>जमा</b> · ' + esc(MODE[r.mode] || 'नकद') + (r.note && !AUTO_NOTES.includes(r.note) ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
    };

    const balDisp = st.close === 0 ? '₹0' : (st.close > 0 ? '-₹' + Math.abs(st.close).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '+₹' + Math.abs(st.close).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
    const balColor = st.close > 0 ? 'var(--r)' : (st.close < 0 ? 'var(--g)' : 'var(--t)');
    
    const cibilCard = (APP.cibil && APP.cibil.cardHtml) ? APP.cibil.cardHtml(p, all) : '';
    const wasooliChip = (APP.cibil && APP.cibil.wasooliChip) ? APP.cibil.wasooliChip(p, all) : '';
    const showPortalBtn = isOwner() && !viewer && APP.portal && APP.portal.openCodeModal;

    main.innerHTML = `
      <div class="btns" style="margin-bottom:10px">
        <button class="btn sm w" id="back">← वापस</button>
        ${(isOwner() && !viewer) ? '<button class="btn sm o" id="editP">✏️ पार्टी बदलें</button>' : ''}
        ${viewer ? '' : '<button class="btn sm w" id="addOB">⚖️ पिछला बैलेंस</button>'}
        ${viewer ? '' : '<button class="btn sm g" id="addU">+ उधार</button>'}
        ${viewer ? '' : '<button class="btn sm g" id="addJ">+ जमा</button>'}
        ${priv && isOwner() && !viewer ? '<button class="btn sm r" id="closeK">✅ खाता बंद</button>' : ''}
      </div>
      
      ${cibilCard}
      
      <div class="card" style="padding:12px;">
        <h3 style="margin:0;color:#0b3d91">${esc(p.name)} ${wasooliChip}</h3>
        <p class="mut" style="margin-top:4px">${esc(p.phone || 'फोन नंबर नहीं')} | ${esc((p.vehicles || []).join(', '))}</p>
        ${ph ? `<div class="btns" style="margin:6px 0 2px"><a href="tel:${esc(p.phone)}" class="btn sm g">📞 कॉल</a>${wa ? `<a href="https://wa.me/${wa}" target="_blank" class="btn sm g">💬 WhatsApp</a>` : ''}</div>` : ''}
        ${showPortalBtn ? '<button class="btn full" id="portalBtn" style="margin-top:8px;background:#0a7d33;color:#fff">🔑 पोर्टल कोड / भेजें</button>' : ''}
        
        <div class="ledger-summary">
          <div class="ledger-box debit">
            <span>कुल उधार (Dr)</span>
            <b>${money(tDr)}</b>
          </div>
          <div class="ledger-box credit">
            <span>कुल जमा (Cr)</span>
            <b>${money(tCr)}</b>
          </div>
          <div class="ledger-box">
            <span>असली बैलेंस</span>
            <b style="color:${balColor}">${balDisp}</b>
          </div>
        </div>
        
        ${mism && isOwner() && !viewer ? `<div class="warn" style="margin-top:8px">⚠️ पार्टी का सेव बैलेंस ${money(p.bal)} है, पर एंट्रियों का जोड़ ${money(st.close)}। <button class="btn sm o" id="fixBal" type="button">🔧 ठीक करें</button></div>` : ''}
        <button class="btn full" id="shareStmt" style="margin-top:8px;background:#0b3d91">📄 प्रोफेशनल स्टेटमेंट देखें / भेजें</button>
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="pro-table-wrap">
          <table class="pro-table">
            <thead>
              <tr>
                <th>तारीख</th>
                <th>विवरण</th>
                <th style="text-align:right">उधार (Dr)</th>
                <th style="text-align:right">जमा (Cr)</th>
                <th style="text-align:right">बैलेंस</th>
                ${viewer ? '' : '<th style="text-align:center">एक्शन</th>'}
              </tr>
            </thead>
            <tbody>
              ${st.rows.length ? st.rows.map(r => `
                <tr>
                  <td class="dt">${dmy(r.date)}</td>
                  <td>
                    ${desc(r)}
                  </td>
                  <td class="dr">${r.kind === 'udhar' ? money(r.amount) : ''}</td>
                  <td class="cr">${r.kind === 'jama' ? money(r.amount) : ''}</td>
                  <td class="bal" style="color:${r.run > 0.005 ? '#c0392b' : r.run < -0.005 ? '#0a7d33' : 'inherit'}">${Math.abs(r.run) < 0.005 ? '₹0' : (r.run > 0 ? '-' : '+') + '₹' + Math.abs(r.run).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  ${viewer ? '' : `
                    <td>
                      <div class="action-btns">
                        <button class="edit" data-edit-row="${r.id}">✏️</button>
                        <button class="del" data-del-row="${r.id}">🗑</button>
                      </div>
                    </td>
                  `}
                </tr>
              `).join('') : `<tr><td colspan="${viewer ? 5 : 6}" class="mut" style="text-align:center;padding:20px;">कोई एंट्री नहीं है</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
      
    $('#back').onclick = () => { 
      S.partyView = null; 
      if (viewer) return APP.go('v_parties');
      priv ? APP.views.priv() : ledgerView(); 
    };
    if (isOwner() && !viewer && $('#editP')) $('#editP').onclick = () => partyModal(p, priv);
    if (!viewer && $('#addU')) $('#addU').onclick = () => entryModal({ kind: 'udhar', date: todayISO(), partyId: id, priv: priv });
    if (!viewer && $('#addJ')) $('#addJ').onclick = () => entryModal({ kind: 'jama', date: todayISO(), partyId: id, priv: priv });
    if (!viewer && $('#addOB')) $('#addOB').onclick = () => openingBalanceModal(id, priv);
    if ($('#closeK')) $('#closeK').onclick = () => closePrivKhata(p, all);
    if ($('#portalBtn')) $('#portalBtn').onclick = () => APP.portal.openCodeModal(p, priv);
    
    $('#shareStmt').onclick = () => APP.sharePartyStatement(id, priv);
    if ($('#fixBal')) $('#fixBal').onclick = async () => {
      if (!confirm('पार्टी का बैलेंस ' + money(p.bal) + ' से बदलकर ' + money(st.close) + ' (एंट्रियों के जोड़ के बराबर) करें?')) return;
      try { await commit(db.collection(pcol).doc(id).update({ bal: st.close })); audit('party_bal_fix', { party: p.name, was: p.bal, now: st.close }); toast('बैलेंस ठीक हो गया ✔'); S.parties[priv ? 'priv' : 'pub'] = null; partyView(id, priv); }
      catch (e) { toast('नहीं हुआ: ' + e.message); }
    };
    
    if (!viewer) {
      $$('[data-edit-row]').forEach(b => b.onclick = () => {
        const row = all.find(x => x.id === b.dataset.editRow);
        if (row) entryModal({ entry: row, date: row.date, priv: priv });
      });
      $$('[data-del-row]').forEach(b => b.onclick = async () => {
        const row = all.find(x => x.id === b.dataset.delRow);
        if (!row) return;
        if (!priv && await dayIsLocked(row.date)) return toast(LOCKMSG);
        if (!confirm('क्या आप सच में इस एंट्री को हटाना चाहते हैं?\n\n' + dmy(row.date) + ' · ' + (row.kind === 'udhar' ? 'उधार ' : 'जमा ') + money(row.amount))) return;
        b.disabled = true;
        try {
          const b2 = db.batch();
          b2.delete(db.collection(col).doc(row.id));
          const delta = -sigEntry(priv, row);
          if (delta) b2.update(db.collection(pcol).doc(row.partyId), { bal: FV.increment(delta) });
          await commit(b2.commit());
          audit('ledger_delete', { party: row.partyName, kind: row.kind, amount: row.amount, litre: row.litre || 0, vehicle: row.vehicle || '', date: row.date, enteredBy: row.by || '', priv });
          if (!priv) refreshDaySum(row.date);
          toast('एंट्री हटा दी गई ✔');
          S.parties[priv ? 'priv' : 'pub'] = null;
          partyView(id, priv);
        } catch (e) { b.disabled = false; toast('नहीं हटा: ' + e.message); }
      });
    }
  }
  APP.partyView = partyView;

  async function closePrivKhata(p, all) {
    const bal = r2(num(p.bal));
    if (!(bal > 0.01)) return toast('इस खाते में कोई बकाया नहीं है');
    if (!confirm(p.name + ' का ' + money(bal) + ' पूरा मिल गया?\nखाता बंद होकर "हिस्ट्री" में चला जाएगा।')) return;
    try {
      const pend = all.filter(x => x.status === 'pending');
      for (let i = 0; i < pend.length; i += 400) { const b = db.batch(); pend.slice(i, i + 400).forEach(x => b.update(db.collection('priv_ledger').doc(x.id), { status: 'paid', paidAt: FV.serverTimestamp() })); await b.commit(); }
      await db.collection('priv_parties').doc(p.id).update({ bal: 0, closedAmount: bal, closedAt: FV.serverTimestamp() });
      audit('priv_close', { party: p.name, amount: bal });
      S.parties.priv = null; toast('खाता बंद ✔'); APP.views.priv();
    } catch (e) { toast('नहीं हुआ: ' + e.message); }
  }

  function openingBalanceModal(partyId, priv) {
    const m = modal(`<h3>⚖️ पिछला बैलेंस (Opening Balance)</h3>
      <p class="mut" style="font-size:12px">इससे पहले का हिसाब मैन्युअल लेजर में है, यहाँ से आगे का हिसाब ऐप में रहेगा।</p>
      <label>तारीख (जिस दिन से ऐप में हिसाब शुरू)</label><input type="date" id="ob-date" value="${todayISO().slice(0, 8)}01">
      ${priv ? '' : '<label>किस तरह का बैलेंस?</label><select id="ob-type"><option value="due">हमें लेना है (बकाया)</option><option value="adv">पार्टी का एडवांस हमारे पास है</option></select>'}
      <label>रकम (₹)</label><input id="ob-amt" inputmode="decimal">
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
        date, time: '00:00', opening: true, kind: (!priv && $('#ob-type', m).value === 'adv') ? 'jama' : 'udhar', ...((!priv && $('#ob-type', m).value === 'adv') ? { mode: 'cash' } : {}),
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

  APP.syncOldBankData = async function() {
    if(!confirm('क्या आप पुराने सारे हिसाब को SBI बैंक जमा में सिंक करना चाहते हैं? इसमें 1 मिनट लग सकता है।')) return;
    toast('पुराना डेटा सिंक हो रहा है...');
    try {
      const daysSnap = await db.collection('days').get();
      const bankSnap0 = await db.collection('bank_deposits').get();
      const bankEx = {}; bankSnap0.docs.forEach(x => { bankEx[x.id] = x.data(); });
      let count = 0;
      for (const doc of daysSnap.docs) {
        const d = doc.data();
        const mdAmt = num(d.malikDiya);
        if (mdAmt > 0) {
          const docId = 'sbi_auto_' + d.date;
          if (bankEx[docId] && (bankEx[docId].removed || bankEx[docId].edited)) continue;
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

  const A = {
    addU() { collectDraft(); entryModal({ kind: 'udhar', date: S.cur.date }); },
    addJ() { collectDraft(); entryModal({ kind: 'jama', date: S.cur.date }); },
    addX() { const it = getExpItems(); it.push({ label: '', amount: '' }); setExpItems(it); const ls = $$('#expbox .exl'); if (ls.length) ls[ls.length - 1].focus(); },
    delX(ds) { const it = getExpItems(); it.splice(+ds.i, 1); setExpItems(it); recalc(); triggerAutoSave(); },
    splitX(ds) {
      const it = getExpItems(), x = it[+ds.i], tot = num(x && x.amount);
      if (!(tot > 0)) return toast('पहले इस खर्चे की रकम भरें');
      expEditor({
        title: '✂️ खर्चा अलग-अलग बाँटें', mustTotal: tot,
        note: `<b>${esc(x.label || 'यह खर्चा')}</b> · ${money(tot)} — इसे अलग-अलग चीज़ों में बाँटें। सबका जोड़ ${money(tot)} ही रहना चाहिए।`,
        lines: [{ cat: 'other', label: x.label, amount: tot }, { cat: 'other', label: '', amount: '' }],
        onOk: lines => { it.splice(+ds.i, 1); applyExpLines(it, lines); toast('खर्चा बँट गया — 💾 सेव करना न भूलें'); }
      });
    },
    splitF(ds) {
      const id = KHF[ds.f], el = $('#' + id), tot = num(el && el.value);
      if (!(tot > 0)) return toast('पहले इस खर्चे की रकम भरें');
      const name = (EXP_CATS.find(c => c[0] === ds.f) || [])[1] || '';
      expEditor({
        title: '✂️ खर्चा अलग-अलग बाँटें', mustTotal: tot,
        note: `<b>${esc(name)}</b> · ${money(tot)} — इसे अलग-अलग चीज़ों में बाँटें। सबका जोड़ ${money(tot)} ही रहना चाहिए।`,
        lines: [{ cat: ds.f, label: '', amount: tot }, { cat: 'other', label: '', amount: '' }],
        onOk: lines => { el.value = ''; applyExpLines(getExpItems(), lines); toast('खर्चा बँट गया — 💾 सेव करना न भूलें'); }
      });
    },
    save() { saveDay(false); },
    submit() { saveDay(true); },
    async unlock() {
      audit('day_unlock', { date: S.cur.date });
      await commit(db.collection('days').doc(S.cur.date).update({ status: 'open' })); dayView(S.cur.date);
    },
    report() { if (APP.shareCompactDayReport) APP.shareCompactDayReport(S.cur, readForm()); },
    async relink() {
      const ch = S.cur.chain; if (!ch) return;
      if (!confirm('इस दिन की ओपनिंग (मीटर, कैश, स्टॉक) कल के क्लोज़ से दोबारा जोड़ें?')) return;
      collectDraft();
      const date = S.cur.date, d = Object.assign({}, S.draft[date] || readForm());
      applyChain(d, ch); d.opening_locked = true; S.draft[date] = d;
      await dayView(date); await saveDay(false, true); toast('कल से जुड़ गया ✔');
    },
    async importShifts() {
      const date = S.cur.date;
      let sh;
      try { sh = await db.collection('sm_shifts').where('date', '==', date).get(); } catch (e) { return toast('शिफ्ट नहीं मिली: ' + e.message); }
      const list = sh.docs.map(x => x.data());
      if (!list.length) return toast('इस दिन की कोई सेल्समैन शिफ्ट नहीं मिली');
      const clo = {}, warns = []; let paytm = 0, swipe = 0; const exps = [];
      list.forEach(x => {
        K.NZ.forEach(k => {
          const n = x.nz && x.nz[k];
          if (!n || !K.has(n.o) || !K.has(n.c)) return;
          if (!(k in clo) || num(n.c) > clo[k]) clo[k] = num(n.c);
          const dOpen = $('.nzi[data-k="' + k + '"][data-f="o"]');
          if (dOpen && K.has(dOpen.value) && Math.abs(num(dOpen.value) - num(n.o)) > 0.01 && !(num(n.o) > num(dOpen.value))) warns.push(k.toUpperCase() + ': शिफ्ट ओपनिंग ' + n.o + ' ≠ दिन की ओपनिंग ' + dOpen.value);
        });
        paytm += num(x.paytm); swipe += num(x.swipe);
        if (num(x.expAmt)) exps.push({ label: (x.name || '') + ': ' + (x.expLabel || 'खर्चा'), amount: num(x.expAmt) });
      });
      const m = modal(`<h3>📥 शिफ्ट से भरें · ${dmy(date)}</h3>
        ${list.map(x => `<div class="kv"><span><b>${esc(x.name || x.sid)}</b><br><small class="mut">Paytm ${money(x.paytm)} · स्वाइप ${money(x.swipe)} · खर्चा ${money(x.expAmt)}</small></span><b>${money((x.sum || {}).sale)}</b></div>`).join('')}
        <div class="mut" style="margin-top:8px;font-size:13px">भरे जाएँगे: ${Object.keys(clo).length} नोज़ल की क्लोज़िंग · Paytm ${money(paytm)} · स्वाइप ${money(swipe)} · ${exps.length} खर्चे</div>
        ${warns.length ? '<div class="warn" style="margin-top:8px">' + warns.map(esc).join('<br>') + '</div>' : ''}
        <div class="btns" style="margin-top:10px"><button class="btn g" id="is-ok">✅ भर दो</button><button class="btn w" id="is-no">रद्द</button></div>`);
      $('#is-no', m).onclick = () => m.close();
      $('#is-ok', m).onclick = () => {
        const fire = el => el.dispatchEvent(new Event('input', { bubbles: true }));
        Object.keys(clo).forEach(k => { const el = $('.nzi[data-k="' + k + '"][data-f="c"]'); if (el && !el.disabled) { el.value = clo[k]; fire(el); } });
        const pe = $('#f-paytm'), se = $('#f-swipe');
        if (pe && !pe.disabled && paytm > 0) { pe.value = r2(paytm); fire(pe); }
        if (se && !se.disabled && swipe > 0) { se.value = r2(swipe); fire(se); }
        if (exps.length) mergeExpItems(exps);
        m.close(); recalc(); triggerAutoSave(); toast('शिफ्ट से भर गया — जाँचकर 💾 सेव करें');
      };
    },
    scan() { if (APP.scanRegister) APP.scanRegister(S.cur); },
    editE(data) {
      collectDraft();
      const row = S.cur.rows.find(r => r.id === data.id);
      if (row) entryModal({ entry: row, date: row.date });
    },
    async verE(data) {
      collectDraft();
      try {
        await commit(db.collection('ledger').doc(data.id).update({ verified: true, verifiedBy: S.user.email, verifiedAt: FV.serverTimestamp() }));
        toast('मिलान ✔'); dayView(S.date);
      } catch (e) { toast('नहीं हुआ: ' + e.message); }
    },
    async delE(data) {
      collectDraft();
      const row = S.cur.rows.find(r => r.id === data.id);
      if (!row) return;
      if (await dayIsLocked(row.date)) return toast(LOCKMSG);
      if (!confirm('क्या आप सच में इस एंट्री को हटाना चाहते हैं?')) return;
      try {
        const b = db.batch();
        b.delete(db.collection('ledger').doc(row.id));
        const delta = -K.signed(row); 
        if (delta) b.update(db.collection('parties').doc(row.partyId), { bal: FV.increment(delta) });
        await commit(b.commit());
        audit('ledger_delete', { party: row.partyName, kind: row.kind, amount: row.amount, litre: row.litre || 0, vehicle: row.vehicle || '', date: row.date, enteredBy: row.by || '' });
        refreshDaySum(row.date);
        toast('एंट्री हटा दी गई ✔');
        S.parties.pub = null;
        dayView(S.date);
      } catch (e) { toast('नहीं हटा: ' + e.message); }
    }
  };
  APP.expEditor = expEditor; APP.mergeExpItems = mergeExpItems; APP.getExpItems = getExpItems; APP.A = A; APP.dayView = dayView; APP.readForm = readForm; APP.recalc = recalc; APP.collectDraft = collectDraft; APP.entryModal = entryModal; APP.triggerAutoSave = triggerAutoSave;

  (function () {
    const st = document.createElement('style'); st.id = 'sum-fix';
    st.textContent = `#sum .kv{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:6px 0;min-width:0}
#sum .kv span{font-size:12.5px;color:#555;line-height:1.25;overflow-wrap:anywhere}
#sum .kv b{font-size:clamp(14px,4.3vw,17px);line-height:1.2;max-width:100%;overflow-wrap:anywhere;word-break:break-word}
#sum > div:first-child{flex-wrap:wrap;gap:4px 12px}`;
    document.head.appendChild(st);
  })();

  window.addEventListener('load', boot);
})();
