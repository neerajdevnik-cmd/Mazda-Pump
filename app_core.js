/* माज़दा ऑयल कंपनी - Core App Controller (Base & Setup + Multi-Pump Engine Integrated) */
(function () {
  'use strict';
  const C = window.CFG, K = window.Calc;
  if (!K) return;
  const num = K.num, r2 = K.r2;
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
  const FUEL = { petrol: 'पेट्रोल', diesel: 'डीज़ल', power: 'पावर' };
  const MODE = { cash: 'नकद', paytm: 'Paytm/UPI', swipe: 'स्वाइप', bank: 'बैंक' };
  const AUTO_LBL = { cash: 'नकद जमा', paytm: 'Paytm/UPI से जमा', swipe: 'स्वाइप (कार्ड) से जमा', bank: 'बैंक ट्रांसफर से जमा' };
  const AUTO_NOTES = Object.values(AUTO_LBL);

  const APP = window.APP = {
    C, K, $, $$, esc, num, r2, money, lit, pad, todayISO, nowTime, dmy, shiftDate, FUEL, MODE,
    S: { role: null, user: null, salesman: null, date: null, tab: 'day', draft: {}, rates: { petrol: C.defaultRateP, diesel: C.defaultRateD, power: C.defaultRateX || 0 }, range: 'month', _costCache: {} },
    views: {}
  };
  const S = APP.S;
  let auth, db, FV;
  
  const isOwner = () => S.role === 'owner';
  const isTrueOwner = () => {
    if (!S.user || !S.user.email) return false;
    const em = S.user.email.toLowerCase();
    return em === 'neeraj@mazda.in' || em === 'neeraj@mazda-pump.in';
  };
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
  
  Object.assign(APP, { AUTO_LBL, AUTO_NOTES, toast, commit, audit, errBox, modal, isOwner, isSalesman, isViewer, isTrueOwner });

  /* ================= खर्चा: अलग-अलग चीज़ों में बाँटने / एडिट करने वाला एडिटर ================= */
  const EXP_CATS = [['kharcha', 'DG (जनरेटर)'], ['driverInaam', 'ड्राइवर इनाम'], ['chaiKhana', 'चाय-खाना'], ['other', 'अन्य (नाम लिखें)'], ['paytm', 'Paytm / UPI (खर्चा नहीं)'], ['swipe', 'स्वाइप / कार्ड (खर्चा नहीं)']];
  const EXP_HINTS = ['पंचर', 'सफाई', 'बिजली', 'मरम्मत', 'स्टेशनरी', 'पानी', 'ट्रांसपोर्ट', 'स्टाफ'];
  const KHF = { kharcha: 'f-kharcha', driverInaam: 'f-driverInaam', chaiKhana: 'f-chaiKhana', paytm: 'f-paytm', swipe: 'f-swipe' };

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
    $$('#expbox input').forEach(i => i.addEventListener('input', () => { if(APP.recalc) APP.recalc(); if(APP.triggerAutoSave) APP.triggerAutoSave(); }));
  }
  
  function applyExpLines(items, lines) {
    lines.forEach(l => {
      if (KHF[l.cat]) { const el = $('#' + KHF[l.cat]); if (el) el.value = r2(num(el.value) + num(l.amount)) || ''; }
      else items.push({ label: l.label, amount: l.amount });
    });
    setExpItems(items); if(APP.recalc) APP.recalc(); if(APP.triggerAutoSave) APP.triggerAutoSave();
  }
  function mergeExpItems(newItems) {
    const cur = getExpItems();
    newItems.forEach(n => {
      if (!cur.some(c => c.label.trim() === String(n.label).trim() && Math.abs(num(c.amount) - num(n.amount)) < 0.01)) cur.push({ label: n.label, amount: n.amount });
    });
    setExpItems(cur); if(APP.recalc) APP.recalc(); if(APP.triggerAutoSave) APP.triggerAutoSave();
  }
  Object.assign(APP, { expEditor, getExpItems, setExpItems, applyExpLines, mergeExpItems, KHF, EXP_CATS });

  async function getParties(priv, force) {
    const key = priv ? 'priv' : 'pub';
    S.parties = S.parties || {};
    if (!force && S.parties[key]) return S.parties[key];
    const snap = await db.collection(priv ? 'priv_parties' : 'parties').get();
    let arr = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hi'));
    S.parties[key] = arr; return arr;
  }
  const partyById = (priv, id) => ((S.parties || {})[priv ? 'priv' : 'pub'] || []).find(p => p.id === id);
  Object.assign(APP, { getParties, partyById });

  function loginView(msg) {
    const PS0 = window.PUMP_SYSTEM;
    const custom0 = !!(PS0 && PS0.isCustomPump && PS0.isCustomPump());
    if (custom0 && PS0.ready && !PS0.isReady) {   // पंप की सेटिंग आने तक लॉगिन फ़ॉर्म नहीं (वरना खाली/माज़दा डेटा दिखता था)
      $('#app').innerHTML = '<div class="login"><p class="mut" style="text-align:center;margin-top:40vh">⏳ पंप लोड हो रहा है…</p></div>';
      PS0.ready.then(() => loginView(msg));
      return;
    }
    const logoSrc = (window.PUMP_SYSTEM && window.PUMP_SYSTEM.currentConfig && window.PUMP_SYSTEM.currentConfig.logo) || './logo.png';
    $('#app').innerHTML = `
      <div class="login">
        <img src="${esc(logoSrc)}" alt="" class="login-logo" style="display:block;width:120px;height:120px;margin:0 auto 12px;border-radius:50%">
        <h1 style="text-align:center" class="pump-title-dyn">${esc(C.pump.name)}</h1>
        <p class="mut" style="text-align:center">${esc(C.pump.address)}</p>
        
        <div class="seg" style="margin:16px 0">
          <button id="tab-man" class="on">${custom0 ? 'मालिक / मैनेजर' : 'मालिक'}</button>
          <button id="tab-sm">सेल्समैन</button>
          <button id="tab-vw">मालिक-व्यू</button>
        </div>

        <div id="form-man">
          ${custom0 ? '<label>कौन लॉगिन कर रहा है?</label><select id="man-role"><option value="owner">👑 मालिक (पूरा कंट्रोल)</option><option value="manager">💼 मैनेजर</option></select><input id="em" type="hidden" value="">' : `<label>यूज़रनेम (ईमेल)</label>
          <input id="em" placeholder="neeraj ya manager" autocomplete="username" autocapitalize="none">`}
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

    if (window.PUMP_SYSTEM && window.PUMP_SYSTEM.applyDOMBranding) {
      setTimeout(() => window.PUMP_SYSTEM.applyDOMBranding(), 50);
    }

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
      const PS = window.PUMP_SYSTEM;
      if (PS && PS.isCustomPump && PS.isCustomPump()) {
        // नए पंप: मैनेजर का पासवर्ड ऐप खुद जाँचता है (Firebase email वाला रास्ता यहाँ नहीं)
        const asOwner = ($('#man-role') || {}).value === 'owner';
        const r = asOwner ? await PS.verifyOwner($('#pw').value) : await PS.verifyManager($('#pw').value);
        if (!r.ok) return loginView(r.msg);
        try {
          if (!auth.currentUser) await auth.signInAnonymously();
          S.role = asOwner ? 'owner' : 'manager'; S.user = { email: (asOwner ? 'owner@' : 'manager@') + PS.activePumpId }; S.date = todayISO();
          try { localStorage.setItem('mazda_sess', JSON.stringify({ pid: PS.activePumpId, role: S.role, email: S.user.email })); } catch (e) { }
          shell();
        } catch (e) { loginView('लॉगिन नहीं हो पाया (इंटरनेट चेक करें): ' + e.message); }
        return;
      }
      let em = $('#em').value.trim();
      if (!em.includes('@')) em = em.toLowerCase() + '@' + (C.loginDomain || 'mazda-pump.in');
      try { await auth.signInWithEmailAndPassword(em, $('#pw').value); }
      catch (e) { loginView('यूज़रनेम या पासवर्ड गलत है: ' + e.message); }
    };

    $('#go-sm').onclick = async () => {
      localStorage.removeItem('mazda_viewer'); S.role = null;
      const smId = $('#sm-sel').value;
      const pin = $('#sm-pin').value.trim();
      const PS = window.PUMP_SYSTEM;
      let s = (C.salesmen || []).find(x => x.id === smId);
      if (PS && PS.isCustomPump && PS.isCustomPump()) {
        // नए पंप: PIN ऐप खुद hash से जाँचता है (पंप के सेल्समैन सूची से)
        s = await PS.verifySalesman(smId, pin);
        if (!s) return loginView('गलत PIN दर्ज किया गया है!');
      } else if (!(s && s.pin === pin)) s = null;
      if (s) {
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
      const PSV = window.PUMP_SYSTEM;
      const customPump = !!(PSV && PSV.isCustomPump && PSV.isCustomPump());
      if (customPump) { if (!(await PSV.verifyViewer(code))) return loginView('गलत व्यू कोड!'); }
      else {
        const expectedCode = C.viewerCode || 'Mazda@123';
        if (code !== expectedCode && code !== 'Mazda@123') return loginView('गलत व्यू कोड!');
      }
      try {
        if (auth) {
          if (!auth.currentUser) await auth.signInAnonymously();
        }
      } catch (e) { console.error('Auth error:', e); }
      
      localStorage.removeItem('mazda_sm');
      localStorage.setItem('mazda_viewer', (window.PUMP_SYSTEM && PUMP_SYSTEM.isCustomPump && PUMP_SYSTEM.isCustomPump()) ? 'pump-viewer-ok' : 'Mazda@123');
      S.salesman = null;
      S.role = 'viewer';
      S.user = { email: 'viewer@owner.local' };
      S.date = todayISO();
      shell();
    };
  }

  function boot() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(C.firebase);
      }
      auth = firebase.auth(); db = firebase.firestore(); FV = firebase.firestore.FieldValue;
      try { db.settings({ ignoreUndefinedProperties: true }); } catch(e) { console.log('Settings error', e); }
      // Offline storage: jo writes server tak nahi gaye wo phone/browser mein save rahenge, aur net/quota aate hi apne-aap chale jaayenge
      try { db.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('Persistence off:', e && e.code)); } catch(e) { console.log('Persistence error', e); }

      // Multi-Pump Multi-Tenant Routing & Branding Hook
      if (window.PUMP_SYSTEM && window.PUMP_SYSTEM.wrapFirestore) {
        db = window.PUMP_SYSTEM.wrapFirestore(db);
        window.PUMP_SYSTEM.initBranding(db);
      }

      APP.db = db; APP.auth = auth; APP.FV = FV;
    } catch (e) {
      console.error(e);
      const err = document.getElementById('error-box');
      if (err) { err.style.display = 'block'; err.innerText = 'Firebase init error: ' + e.message; }
    }

    const restoreAndListen = () => {
    // दूसरे पंप का मालिक/मैनेजर: refresh या ऐप बंद होने के बाद फिर login न माँगे (सिर्फ़ उसी पंप के लिए)
  try {
    const sx = JSON.parse(localStorage.getItem('mazda_sess') || 'null');
    if (sx && window.PUMP_SYSTEM && PUMP_SYSTEM.isCustomPump && PUMP_SYSTEM.isCustomPump() && sx.pid === PUMP_SYSTEM.activePumpId && (sx.role === 'owner' || sx.role === 'manager')) {
      S.role = sx.role; S.user = { email: sx.email }; S.date = todayISO(); shell(); return;
    }
  } catch (e) { }

  const savedViewer = localStorage.getItem('mazda_viewer');
    if (savedViewer === ((window.PUMP_SYSTEM && PUMP_SYSTEM.isCustomPump && PUMP_SYSTEM.isCustomPump()) ? 'pump-viewer-ok' : 'Mazda@123')) {
      S.salesman = null; S.role = 'viewer'; S.user = { email: 'viewer@owner.local' }; S.date = todayISO(); shell(); return;
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
      const PSa = window.PUMP_SYSTEM;
      if (u && !u.isAnonymous && PSa && PSa.isCustomPump && PSa.isCustomPump()) {
        // दूसरे पंप पर माज़दा/Super Admin का पुराना login कभी नहीं चलेगा
        auth.signOut().catch(() => { });
        return;
      }
      if (u && u.isAnonymous) { if (!S.role && !S.salesman) loginView(); return; }
      if (!u) {
        if (!S.salesman) { S.user = null; return loginView(); }
      } else {
        localStorage.removeItem('mazda_viewer');
        const em = (u.email || '').toLowerCase();
        const isOwnerAccount = em === (C.ownerEmail || '').toLowerCase() || em === 'neeraj@mazda.in' || em === 'neeraj@mazda-pump.in';
        S.role = isOwnerAccount ? 'owner' : 'manager';
        S.user = u; S.date = todayISO(); shell();
        db.collection('days').orderBy('date', 'desc').limit(1).get().then(s => {
          if (!s.empty) { const d = s.docs[0].data(); S.rates = { petrol: d.rateP, diesel: d.rateD, power: d.rateX || S.rates.power || 0 }; }
        }).catch(() => { });
      }
    });
    };
    const PSr = window.PUMP_SYSTEM;
    // दूसरे पंप पर पहले उसकी सेटिंग (नोज़ल, टैंक, डिप चार्ट) आए, फिर स्क्रीन — वरना माज़दा के default दिखते हैं
    if (PSr && PSr.ready && !PSr.isReady) PSr.ready.then(restoreAndListen); else restoreAndListen();
  }

  function shell() {
    let tabs = [];
    if (isViewer()) {
      tabs = [ ['v_home', '🏠', 'होम'], ['v_parties', '📒', 'पार्टी'], ['v_money', '💰', 'पैसा'], ['v_workers', '👥', 'वर्कर'], ['more', '⚙️', 'बाहर'] ];
    } else if (isSalesman()) {
      tabs = [ ['salesman', '⛽', 'मेरा हिसाब'], ['sm_udhar', '🚚', 'उधार एंट्री'], ['more', '⚙️', 'बाहर'] ];
    } else {
      tabs = [ ['day', '🧾', 'हिसाब'], ['ledger', '📒', 'खाते'], ['gaadicash', '🚚', 'गाड़ी कैश'], ['stock', '🛢️', 'स्टॉक'], ['manager_desk', '💼', 'मैनेजर डेस्क'] ];
      tabs.push(['priv', '🔒', 'निजी']); tabs.push(['more', '⚙️', 'और']);
    }

    const titleRole = isOwner() ? 'मालिक' : isViewer() ? 'केवल देखें' : isSalesman() ? ('सेल्समैन · ' + S.salesman.name) : 'मैनेजर';
    const userName = S.salesman ? S.salesman.name : isViewer() ? 'Owner' : esc((S.user && S.user.email || 'user').split('@')[0]);

    $('#app').innerHTML = `
      <header>
        <div style="display:flex;align-items:center;gap:10px">
          <div><b class="pump-title-dyn">${esc(C.pump.name)}</b><small>${titleRole} · ${userName}</small></div>
        </div>
        <button id="top-logout">लॉगआउट</button>
      </header>
      <main id="main"></main>
      <nav>${tabs.map(t => `<button data-tab="${t[0]}"><i>${t[1]}</i>${t[2]}</button>`).join('')}</nav>`;

    if (window.PUMP_SYSTEM && window.PUMP_SYSTEM.applyDOMBranding) {
      setTimeout(() => window.PUMP_SYSTEM.applyDOMBranding(), 50);
    }

    $('#top-logout').onclick = () => {
      localStorage.removeItem('mazda_sm'); localStorage.removeItem('mazda_viewer'); localStorage.removeItem('mazda_sess');
      if (auth) auth.signOut(); location.reload();
    };

    $$('nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
    go(isSalesman() ? 'salesman' : isViewer() ? 'v_home' : 'day');
  }

  function go(tab, arg) {
    if (isSalesman() && !['salesman', 'sm_udhar', 'more'].includes(tab)) tab = 'salesman';
    S.tab = tab; S.partyView = null;
    $$('nav button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.classList.toggle('active', on); });
    window.scrollTo(0, 0);
    
    if (tab === 'day' && APP.dayView) return APP.dayView(arg);
    if (tab === 'ledger' && APP.ledgerView) return APP.ledgerView(arg);

    if (APP.views && typeof APP.views[tab] === 'function') {
      APP.views[tab](arg);
    } else {
      const m = $('#main');
      if (m) m.innerHTML = '<div class="card"><p class="mut">लोड हो रहा है…</p></div>';
      setTimeout(() => { if (APP.views && APP.views[tab]) APP.views[tab](arg); }, 200);
    }
  }
  APP.go = go;
  APP.boot = boot;
  
  S._today = todayISO();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || S._today === todayISO()) return;
    S._today = todayISO();
    if (isSalesman() || !S.role) return;
    S.date = S._today; if (S.tab === 'day' && APP.dayView) APP.dayView(S.date);
  });

  window.addEventListener('load', boot);
})();
