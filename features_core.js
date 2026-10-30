/* Mazda Oil Company - Features Core (Backup, Audit, Extras, Menu) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();
  const isViewer = () => APP.isViewer && APP.isViewer();
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c||''}">${b}</b></div>`;
  APP.views = APP.views || {};

  function dlBlob(txt, name, mime) {
    const b = new Blob([txt], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ============ AUTO-DRAFT ============ */
  const DRAFT_K = 'mazda_draft_', TS_K = 'mazda_draft_ts_';
  const origCollect = APP.collectDraft;
  APP.collectDraft = function () {
    try { if (origCollect) origCollect(); } catch (e) {}
    try {
      if (S.cur && S.cur.date && S.draft && S.draft[S.cur.date]) {
        localStorage.setItem(DRAFT_K + S.cur.date, JSON.stringify(S.draft[S.cur.date]));
        localStorage.setItem(TS_K + S.cur.date, String(Date.now()));
      }
    } catch (e) {}
  };

  let dTimer = null;
  document.addEventListener('input', e => {
    if (!S.cur || S.cur.locked || !e.target.closest('#main')) return;
    if (e.target.id === 'f-date' || e.target.id === 'f-costP' || e.target.id === 'f-costD' || e.target.id === 'reg-photo-in') return;
    clearTimeout(dTimer);
    dTimer = setTimeout(() => { try { APP.collectDraft(); } catch (x) {} }, 500);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.cur && !S.cur.locked) { try { APP.collectDraft(); } catch (x) {} }
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-do]'); if (!btn) return;
    if (btn.dataset.do !== 'save' && btn.dataset.do !== 'submit') return;
    const date = S.cur && S.cur.date; if (!date) return;
    setTimeout(async () => {
      try {
        const snap = await db().collection('days').doc(date).get();
        if (snap.exists && snap.get('at')) {
          const at = snap.get('at'); const ts = at && at.toDate ? at.toDate().getTime() : 0;
          if (Date.now() - ts < 15000) {
            localStorage.removeItem(DRAFT_K + date);
            localStorage.removeItem(TS_K + date);
            if (S.draft) delete S.draft[date];
          }
        }
      } catch (x) {}
    }, 2500);
  }, true);

  async function restoreDraftsSmart() {
    if (!db()) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(DRAFT_K) === 0) keys.push(k);
    }
    for (const k of keys) {
      const date = k.slice(DRAFT_K.length);
      let draft; try { draft = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
      if (!draft) { localStorage.removeItem(k); continue; }
      const dTs = parseInt(localStorage.getItem(TS_K + date) || '0', 10);
      try {
        const snap = await db().collection('days').doc(date).get();
        if (snap.exists) {
          const at = snap.get('at'); const dbTs = at && at.toDate ? at.toDate().getTime() : 0;
          if (dTs > dbTs + 1000) S.draft[date] = draft;
          else { localStorage.removeItem(k); localStorage.removeItem(TS_K + date); }
        } else S.draft[date] = draft;
      } catch (e) {}
    }
  }

  /* ============ BACKUP ============ */
  APP.downloadBackup = async function (fmt) {
    toast('बैकअप तैयार हो रहा है…');
    try {
      const cols = ['days', 'ledger', 'parties', 'priv_ledger', 'priv_parties', 'gaadi_cash',
                    'bank_deposits', 'audit', 'workers', 'attendance', 'salary_payments',
                    'rate_history', 'day_costs', 'day_photos', 'runsheets', 'sm_shifts', 'cash_submissions', 'shop',
                    'tanker_reports', 'tanker_invoices', 'shop_orders', 'vendors', 'depot_holidays', 'cash_galla', 'requests', 'rate_requests'];
      const out = {};
      for (const c of cols) {
        try {
          const snap = await db().collection(c).get();
          out[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { out[c] = []; }
      }
      out._meta = { exportedAt: new Date().toISOString(), app: 'mazda-pump', version: 6 };
      const stamp = today();
      if (fmt === 'csv') {
        const lines = ['collection,id,data'];
        Object.keys(out).forEach(k => {
          if (!Array.isArray(out[k])) return;
          out[k].forEach(r => {
            lines.push([k, r.id, JSON.stringify(r)].map(s => '"' + String(s).replace(/"/g, '""') + '"').join(','));
          });
        });
        dlBlob('\ufeff' + lines.join('\n'), 'mazda-backup-' + stamp + '.csv', 'text/csv;charset=utf-8');
      } else {
        dlBlob(JSON.stringify(out, null, 2), 'mazda-backup-' + stamp + '.json', 'application/json');
      }
      try { localStorage.setItem('mazda_last_backup', String(Date.now())); } catch(e) {}
      toast('बैकअप डाउनलोड ✔');
    } catch (e) { alert('बैकअप नहीं बना: ' + e.message); }
  };

  /* ============ AUDIT LOG ============ */
  APP.views.audit = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लॉग लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('audit').orderBy('at', 'desc').limit(200).get(); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    main.innerHTML =
      '<div class="card"><h3>🔍 बदलाव का रिकॉर्ड</h3>' +
        (list.length ? list.map(x => '<div class="item"><div class="a"><b>' + esc(x.action || '?') + '</b><small>' +
          esc(x.by || '?') + ' · ' + (x.at && x.at.toDate ? x.at.toDate().toLocaleString('hi-IN') : '') +
          '</small><small class="mut" style="word-break:break-all">' + esc(String(x.detail || '').slice(0, 220)) + '</small></div></div>').join('') : '<p class="mut">कोई लॉग नहीं</p>') +
      '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
  };

  /* ============ DAYVIEW EXTRAS ============ */
  function injectDayExtras() {
    injectCashBox();
    injectPhotoBtn();
    if (document.querySelector('#sum')) checkDuplicates();
  }
  function injectCashBox() {
    if (document.querySelector('#f-physicalCash')) return;
    const note = document.querySelector('#f-note'); if (!note) return;
    const card = note.closest('.card'); if (!card) return;
    const locked = S.cur && S.cur.locked;
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<label>दराज़ में असली नकद (गिनकर)</label>' +
      '<input id="f-physicalCash" inputmode="decimal" placeholder="गिनकर डालें"' + (locked ? ' disabled' : '') + '>' +
      '<div id="cash-diff"></div>';
    card.appendChild(wrap);
    const inp = document.getElementById('f-physicalCash');
    const update = () => {
      const el = document.getElementById('cash-diff'); if (!el) return;
      const st = S.cur;
      if (!inp.value || !st || !st.o) { el.innerHTML = ''; return; }
      const actual = num(inp.value), exp = st.o.close, diff = K.r2(actual - exp);
      if (Math.abs(diff) < 1) el.innerHTML = '<div class="ok">✔ नकद बिल्कुल सही</div>';
      else if (diff > 0) el.innerHTML = '<div class="warn">➕ ज़्यादा: ₹' + Math.abs(diff).toFixed(2) + '</div>';
      else el.innerHTML = '<div class="err">➖ कम: ₹' + Math.abs(diff).toFixed(2) + '</div>';
    };
    inp.addEventListener('input', () => { update(); if (APP.triggerAutoSave) APP.triggerAutoSave(); });
    const sum = document.querySelector('#sum');
    if (sum) new MutationObserver(update).observe(sum, { childList: true, subtree: true, characterData: true });
    const pc0 = S.cur && S.cur.d ? S.cur.d.physicalCash : '';
    if (pc0 !== undefined && pc0 !== null && pc0 !== '') inp.value = pc0;
    update();
  }
  function injectPhotoBtn() {
    if (document.querySelector('#reg-photo-btn')) return;
    if (!document.querySelector('#f-date')) return;
    if (isViewer()) return;
    const btns = document.querySelectorAll('#main .btns');
    if (!btns.length) return;
    const target = btns[btns.length - 1];
    const wrap = document.createElement('div');
    wrap.style.display = 'contents';
    wrap.innerHTML = '<button class="btn w" id="reg-photo-btn">📷 रजिस्टर फोटो</button>' +
                     '<input type="file" accept="image/*" capture="environment" id="reg-photo-in" style="display:none">';
    target.appendChild(wrap);
    document.getElementById('reg-photo-btn').onclick = () => document.getElementById('reg-photo-in').click();
    document.getElementById('reg-photo-in').onchange = async function (e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      toast('फोटो सेव हो रही है…');
      try {
        const b64 = await compressImg(f, 900, 0.75);
        const date = S.cur && S.cur.date; if (!date) return;
        await db().collection('day_photos').add({
          date, photo: b64, at: APP.FV.serverTimestamp(),
          by: S.salesman ? S.salesman.name : (S.user && S.user.email) || ''
        });
        toast('फोटो सेव ✔');
      } catch (err) { toast('फोटो सेव नहीं हुई: ' + err.message); }
    };
  }
  function compressImg(file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('फोटो नहीं खुली')); };
      img.src = url;
    });
  }

  /* ============ DUPLICATE CHECK ============ */
  let dupTimer = null;
  function checkDuplicates() {
    if (!db() || !S.date || !S.cur || isViewer()) return;
    clearTimeout(dupTimer);
    dupTimer = setTimeout(async () => {
      try {
        const rows = (S.cur && S.cur.rows) || [];
        const seen = {}, dups = [];
        rows.forEach(r => {
          const key = (r.kind || '') + '|' + (r.partyId || '') + '|' + (r.vehicle || '') + '|' + num(r.amount).toFixed(2) + '|' + (r.time || '');
          if (seen[key]) dups.push(r); else seen[key] = r;
        });
        const main = document.querySelector('#main');
        if (!main) return;
        const old = document.querySelector('#dup-banner');
        if (!dups.length) { if (old) old.remove(); return; }
        const html = '⚠️ ' + dups.length + ' संभावित डुप्लीकेट: ' +
          dups.slice(0, 3).map(r => esc(r.partyName) + ' ' + money(r.amount)).join(' · ');
        if (old) { old.innerHTML = html; return; }
        const b = document.createElement('div');
        b.id = 'dup-banner'; b.className = 'warn'; b.innerHTML = html;
        main.insertBefore(b, main.firstChild);
      } catch (e) {}
    }, 1500);
  }

  /* ============ NOZZLE TREND ============ */
  APP.views.nozzle = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('days').orderBy('date', 'desc').limit(30).get(); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const days = snap.docs.map(x => x.data()).reverse();
    const nzKeys = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
    const sums = {}; nzKeys.forEach(k => sums[k] = 0);
    const perDay = days.map(d => {
      const out = { date: d.date };
      nzKeys.forEach(k => {
        const nz = d.nz && d.nz[k]; let net = 0;
        if (nz && nz.o !== undefined && nz.c !== undefined && K.has(nz.o) && K.has(nz.c)) {
          const g = num(nz.c) - num(nz.o);
          net = Math.max(0, g - (K.has(nz.t) ? num(nz.t) : (K.has(d.testing) ? num(d.testing) : 5)));
        }
        out[k] = net; sums[k] += net;
      });
      return out;
    });
    const grandTotal = nzKeys.reduce((a, k) => a + sums[k], 0) || 1;
    main.innerHTML =
      '<div class="card"><h3>⛽ नोज़ल-वार बिक्री (30 दिन)</h3>' +
        nzKeys.map(k =>
          '<div class="kv"><span>' + k.toUpperCase() + '</span><b>' + APP.lit(sums[k]) + ' <small class="mut">(' +
          ((sums[k] / grandTotal) * 100).toFixed(1) + '%)</small></b></div>'
        ).join('') +
      '</div>' +
      '<div class="card"><h3>रोज़ का ट्रेंड</h3>' +
        '<div style="overflow-x:auto"><table style="font-size:11px"><tr><th>तारीख</th>' +
        nzKeys.map(k => '<th class="n">' + k.toUpperCase() + '</th>').join('') + '</tr>' +
        perDay.slice(-10).map(r => '<tr><td>' + dmy(r.date) + '</td>' +
          nzKeys.map(k => '<td class="n">' + (r[k] > 0 ? r[k].toFixed(0) : '-') + '</td>').join('') +
        '</tr>').join('') + '</table></div></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
  };

  /* ============ MORE VIEW — BASE MENU ============ */
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#extra-more-card')) return;

    const has = tab => APP.views && typeof APP.views[tab] === 'function';
    const btn = (id, label, tab) => has(tab) ? '<button class="btn w" id="' + id + '" data-nav="' + tab + '">' + label + '</button>' : '';

    const extra = document.createElement('div');
    extra.id = 'extra-more-card';

    let html = '';

    const analysisBtns =
      btn('analytics-more-btn', '📊 आंकड़ों का विश्लेषण', 'analytics') +
      btn('rate-more-btn', '📈 रेट इतिहास', 'rate_history') +
      btn('dashboard-btn', '📊 डैशबोर्ड', 'dashboard') +
      btn('monthreport-btn', '📅 मासिक रिपोर्ट', 'monthreport') +
      btn('nozzle-btn', '⛽ नोज़ल ट्रेंड', 'nozzle');
    if (analysisBtns.trim()) html += '<div class="card"><h3>📊 विश्लेषण</h3><div class="btns">' + analysisBtns + '</div></div>';

    const finBtns =
      btn('requests-btn', '📩 रिक्वेस्ट्स (Rate/Mohalat)', 'requests') +
      btn('bank-btn', '🏦 बैंक जमा', 'bank') +
      btn('invoices-more-btn', '📄 खरीद बिल / मार्जिन', 'invoices') +
      btn('reminders-btn', '⏰ उधार रिमाइंडर', 'reminders') +
      btn('recovery-btn', '🚨 वसूली (Recovery)', 'recovery');
    if (finBtns.trim()) html += '<div class="card"><h3>💰 वित्त</h3><div class="btns">' + finBtns + '</div></div>';

    const partyBtns =
      btn('customers-btn', '👥 ग्राहक कार्ड', 'customers') +
      btn('workers-btn', '👷 वर्कर हाज़िरी', 'workers') +
      btn('vehicle-btn', '🚗 गाड़ी प्रोफाइल', 'vehicle_search') +
      btn('cibil-more-btn', '⭐ पार्टी CIBIL', 'cibil');
    if (partyBtns.trim()) html += '<div class="card"><h3>👥 पार्टी / वर्कर</h3><div class="btns">' + partyBtns + '</div></div>';

    const opsBtns =
      btn('runsheet-more-btn', '📋 रनशीट', 'runsheet') +
      btn('tanker-more-btn', '🚛 टैंकर रिपोर्ट', 'tanker_report') +
      btn('shop-more-btn', '🛍️ दुकान', 'shop') +
      btn('orders-more-btn', '📦 शॉप ऑर्डर', 'shop_orders');
    if (opsBtns.trim()) html += '<div class="card"><h3>🚛 संचालन</h3><div class="btns">' + opsBtns + '</div></div>';

    const suppBtns =
      btn('vendor-more-btn', '🏢 कंपनी सपोर्ट', 'vendors') +
      btn('audit-btn', '🔍 ऑडिट लॉग', 'audit');
    if (suppBtns.trim()) html += '<div class="card"><h3>🏢 सहायता</h3><div class="btns">' + suppBtns + '</div></div>';

    const settingsBtns =
      btn('applock-more-btn', '🔒 ऐप लॉक', 'applock_settings') +
      '<button class="btn w" id="darkmode-more-btn">🌙 डार्क मोड</button>' +
      btn('holidays-more-btn', '📅 डिपो छुट्टियाँ', 'holidays');
    html += '<div class="card"><h3>⚙️ सेटिंग</h3><div class="btns">' + settingsBtns + '</div></div>';

    html += '<div class="card"><h3>💾 पूरा बैकअप</h3>' +
      '<p class="mut" style="font-size:12px;margin:4px 0">सारा डेटा एक फ़ाइल में।</p>' +
      '<div class="btns"><button class="btn g" id="bk-json">JSON</button><button class="btn w" id="bk-csv">CSV (Excel)</button></div></div>';

    extra.innerHTML = html;
    main.appendChild(extra);

    extra.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => APP.go(b.dataset.nav));
    const jb = $('#bk-json'); if (jb) jb.onclick = () => APP.downloadBackup('json');
    const cb = $('#bk-csv'); if (cb) cb.onclick = () => APP.downloadBackup('csv');

    const dk = $('#darkmode-more-btn');
    if (dk) {
      const isDark = document.body.classList.contains('dark');
      dk.textContent = isDark ? '☀️ लाइट मोड' : '🌙 डार्क मोड';
      dk.onclick = () => {
        document.body.classList.toggle('dark');
        const nowDark = document.body.classList.contains('dark');
        dk.textContent = nowDark ? '☀️ लाइट मोड' : '🌙 डार्क मोड';
        try { localStorage.setItem('mazda_dark', nowDark ? '1' : '0'); } catch (e) {}
        toast(nowDark ? '🌙 डार्क मोड चालू' : '☀️ लाइट मोड चालू');
      };
    }
  };

  /* ============ BOOT ============ */
  function startObs() {
    const main = document.querySelector('#main');
    if (!main) { setTimeout(startObs, 800); return; }
    new MutationObserver(() => { setTimeout(injectDayExtras, 80); })
      .observe(main, { childList: true, subtree: true });
    setTimeout(injectDayExtras, 300);
  }

  window.addEventListener('load', () => {
    try { if (localStorage.getItem('mazda_dark') === '1') document.body.classList.add('dark'); } catch (e) {}
    setTimeout(() => { restoreDraftsSmart(); startObs(); }, 800);
  });

  console.log('[Mazda features_core.js] loaded ✓');
})();
