/* Mazda Oil Company - Features pack 1 (backup, reports, cash alert, party cards, extras) */
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
  function initials(name) { return String(name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }
  function monthKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthLabel(ym) { const p = ym.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('hi-IN', { month: 'long', year: 'numeric' }); }
  function waNum(ph) { let p = String(ph || '').replace(/\D/g, ''); if (!p) return ''; p = p.replace(/^0+/, ''); if (!p.startsWith('91')) p = '91' + p; return p; }

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
    if (e.target.id === 'f-date' ||
        e.target.id === 'f-costP' || e.target.id === 'f-costD' || e.target.id === 'reg-photo-in') return;
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
                    'rate_history', 'day_costs', 'day_photos'];
      const out = {};
      for (const c of cols) {
        try {
          const snap = await db().collection(c).get();
          out[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { out[c] = []; }
      }
      out._meta = { exportedAt: new Date().toISOString(), app: 'mazda-pump', version: 3 };
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
      toast('बैकअप डाउनलोड ✔');
    } catch (e) { alert('बैकअप नहीं बना: ' + e.message); }
  };

  /* ============ PARTY STATEMENT ============ */
  APP.sharePartyStatement = async function (partyId, priv) {
    toast('स्टेटमेंट बन रहा है…');
    try {
      const pcol = priv ? 'priv_parties' : 'parties';
      const lcol = priv ? 'priv_ledger' : 'ledger';
      const [ps, es] = await Promise.all([
        db().collection(pcol).doc(partyId).get(),
        db().collection(lcol).where('partyId', '==', partyId).get()
      ]);
      if (!ps.exists) return toast('पार्टी नहीं मिली');
      const p = { id: partyId, ...ps.data() };
      const st = K.stmt(es.docs.map(x => ({ id: x.id, ...x.data() })), null, null);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-99999px;top:0;width:520px;background:#fff;padding:24px;font-family:sans-serif;color:#111;line-height:1.4';
      wrap.innerHTML =
        '<div style="text-align:center;border-bottom:3px solid #0b3d91;padding-bottom:10px;margin-bottom:12px">' +
          '<img src="./logo.png" style="width:64px;height:64px;border-radius:50%;display:block;margin:0 auto 4px">' +
          '<h2 style="margin:4px 0;color:#0b3d91;font-size:20px">' + esc(C.pump.nameEn) + '</h2>' +
          '<div style="font-size:12px;color:#555">' + esc(C.pump.addressEn) + '</div>' +
          '<div style="font-size:12px;color:#555">📞 ' + esc(C.pump.phone) + '</div>' +
        '</div>' +
        '<div style="margin:10px 0">' +
          '<div style="font-size:16px;font-weight:700">' + esc(p.name) + '</div>' +
          (p.phone ? '<div style="font-size:12px;color:#555">📞 ' + esc(p.phone) + '</div>' : '') +
          ((p.vehicles || []).length ? '<div style="font-size:12px;color:#555">🚚 ' + esc(p.vehicles.join(', ')) + '</div>' : '') +
        '</div>' +
        '<div style="background:#e8eefb;padding:12px;border-radius:8px;text-align:center;margin:12px 0">' +
          '<div style="font-size:12px;color:#555">कुल बकाया</div>' +
          '<div style="font-size:24px;font-weight:700;color:#c62828">' + money(st.close) + '</div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
          '<tr style="background:#0b3d91;color:#fff">' +
            '<th style="padding:6px 4px;text-align:left">तारीख</th>' +
            '<th style="padding:6px 4px;text-align:left">विवरण</th>' +
            '<th style="padding:6px 4px;text-align:right">उधार</th>' +
            '<th style="padding:6px 4px;text-align:right">जमा</th>' +
            '<th style="padding:6px 4px;text-align:right">बैलेंस</th>' +
          '</tr>' +
          st.rows.slice(-25).map(r =>
            '<tr>' +
              '<td style="padding:4px;border-bottom:1px solid #eee">' + dmy(r.date) + '</td>' +
              '<td style="padding:4px;border-bottom:1px solid #eee">' + esc(r.vehicle || (r.kind === 'jama' ? 'जमा' : '-')) + '</td>' +
              '<td style="padding:4px;border-bottom:1px solid #eee;text-align:right;color:#c62828">' + (r.kind === 'udhar' ? money(r.amount) : '') + '</td>' +
              '<td style="padding:4px;border-bottom:1px solid #eee;text-align:right;color:#0a7d33">' + (r.kind === 'jama' ? money(r.amount) : '') + '</td>' +
              '<td style="padding:4px;border-bottom:1px solid #eee;text-align:right">' + money(r.run) + '</td>' +
            '</tr>'
          ).join('') +
        '</table>' +
        '<p style="font-size:10px;color:#666;text-align:center;margin-top:14px">कृपया बकाया राशि जल्द चुकाएँ। धन्यवाद!</p>';
      document.body.appendChild(wrap);
      await new Promise(r => setTimeout(r, 300));
      const cv = await html2canvas(wrap, { scale: 2, backgroundColor: '#fff' });
      document.body.removeChild(wrap);
      cv.toBlob(async blob => {
        const safe = (p.name || 'party').replace(/[^a-z0-9]+/gi, '-');
        const file = new File([blob], 'statement-' + safe + '.png', { type: 'image/png' });
        const text = '*' + C.pump.name + '*\n' + p.name + '\nकुल बकाया: ' + money(st.close);
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text }); } catch (e) {}
        } else {
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = file.name; a.click(); toast('डाउनलोड हो गया ✔');
        }
      }, 'image/png');
    } catch (e) { alert('स्टेटमेंट नहीं बना: ' + e.message); }
  };

  /* ============ MONTHLY REPORT ============ */
  APP.views.monthreport = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">महीने की रिपोर्ट लोड हो रही है…</p>';
    const now = new Date();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    let daySnap, costSnap;
    try {
      daySnap = await db().collection('days').where('date', '>=', ym + '-01').where('date', '<=', ym + '-31').get();
      costSnap = await db().collection('day_costs').where('__name__', '>=', ym + '-01').where('__name__', '<=', ym + '-31').get();
    } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const days = daySnap.docs.map(x => x.data()).sort((a, b) => a.date.localeCompare(b.date));
    const costs = {};
    costSnap.docs.forEach(d => { costs[d.id] = d.data(); });
    const tot = { sale: 0, litP: 0, litD: 0, close: 0, kharcha: 0, profit: 0, cost: 0 };
    let best = null, worst = null;
    days.forEach(d => {
      const s = d.sum || {};
      const sale = num(s.sale);
      tot.sale += sale; tot.litP += num(s.litP); tot.litD += num(s.litD); tot.close += num(s.close);
      tot.kharcha += K.khTotal(d);
      const cc = costs[d.date] || {};
      const cg = num(s.litP) * num(cc.costP) + num(s.litD) * num(cc.costD);
      tot.cost += cg; tot.profit += (sale - cg);
      if (!best || sale > num((best.sum || {}).sale)) best = d;
      if (!worst || sale < num((worst.sum || {}).sale)) worst = d;
    });
    const maxSale = Math.max(1, ...days.map(d => num((d.sum || {}).sale)));
    const bars = days.map(d => {
      const s = num((d.sum || {}).sale);
      const h = Math.max(4, Math.round(s / maxSale * 120));
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0">' +
        '<div style="width:100%;height:' + h + 'px;background:#0b3d91;border-radius:2px 2px 0 0;max-height:120px"></div>' +
        '<div style="font-size:9px;color:#666;margin-top:2px">' + d.date.slice(8) + '</div></div>';
    }).join('');
    const pc = tot.profit >= 0 ? 'pos' : 'neg';
    main.innerHTML =
      '<div class="card"><h3>📅 ' + esc(monthLabel(ym)) + '</h3>' +
        kv('कुल बिक्री', money(tot.sale), 'big') +
        kv('पेट्रोल', APP.lit(tot.litP)) +
        kv('डीज़ल', APP.lit(tot.litD)) +
        kv('कुल खर्चा', money(tot.kharcha)) +
        K.khSummary(days).map(x => '<div class="kv" style="padding:2px 0 2px 14px;font-size:13px"><span class="mut">• ' + esc(x.label) + '</span><span class="mut">' + money(x.amount) + '</span></div>').join('') +
        kv('कुल बचा कैश', money(tot.close)) +
        kv('खरीद लागत', money(tot.cost)) +
        kv('कुल मुनाफा', money(tot.profit), pc + ' big') +
        kv('हिसाब किए दिन', days.length) +
      '</div>' +
      '<div class="card"><h3>रोज़ाना बिक्री</h3>' +
        '<div style="display:flex;align-items:flex-end;height:140px;gap:2px;padding:6px;background:#f8f9fc;border-radius:8px;overflow-x:auto">' +
          (bars || '<p class="mut" style="margin:auto">डेटा नहीं</p>') +
        '</div></div>' +
      (best ? '<div class="card"><h3>🏆 सबसे अच्छा दिन</h3>' + kv(dmy(best.date), money(num((best.sum || {}).sale)), 'pos') + '</div>' : '') +
      (worst && worst !== best ? '<div class="card"><h3>⚠️ सबसे कम</h3>' + kv(dmy(worst.date), money(num((worst.sum || {}).sale)), 'neg') + '</div>' : '') +
      '<div class="card" style="overflow-x:auto"><h3>दिन-वार</h3>' +
        '<table><tr><th>तारीख</th><th class="n">P</th><th class="n">D</th><th class="n">बिक्री</th><th class="n">मुनाफा</th></tr>' +
        days.map(d => {
          const cc = costs[d.date] || {};
          const cg = num((d.sum || {}).litP) * num(cc.costP) + num((d.sum || {}).litD) * num(cc.costD);
          const pr = num((d.sum || {}).sale) - cg;
          return '<tr><td>' + dmy(d.date) + '</td><td class="n">' + num((d.sum || {}).litP).toFixed(1) + '</td><td class="n">' + num((d.sum || {}).litD).toFixed(1) + '</td><td class="n">' + money((d.sum || {}).sale) + '</td><td class="n ' + (pr >= 0 ? 'pos' : 'neg') + '">' + (cc.costP ? money(pr) : '-') + '</td></tr>';
        }).join('') +
        '</table></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
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
          '</small></div></div>').join('') : '<p class="mut">कोई लॉग नहीं</p>') +
      '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
  };

  /* ============ DASHBOARD ============ */
  APP.views.dashboard = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">डैशबोर्ड लोड हो रहा है…</p>';
    const t = new Date();
    const todayStr = today();
    const y = new Date(t); y.setDate(y.getDate() - 1);
    const pad = n => String(n).padStart(2, '0');
    const yStr = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate());
    const w = new Date(t); w.setDate(w.getDate() - 7);
    const wStr = w.getFullYear() + '-' + pad(w.getMonth() + 1) + '-' + pad(w.getDate());
    let snap;
    try { snap = await db().collection('days').where('date', '>=', wStr).get(); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const days = snap.docs.map(x => x.data());
    const td = days.find(d => d.date === todayStr);
    const yd = days.find(d => d.date === yStr);
    const week = days.filter(d => d.date >= wStr);
    const weekSale = week.reduce((a, d) => a + num((d.sum || {}).sale), 0);
    main.innerHTML =
      '<div class="card"><h3>📊 आज (' + dmy(todayStr) + ')</h3>' +
        kv('बिक्री', money((td && td.sum || {}).sale), 'big') +
        kv('कैश बचा', money((td && td.sum || {}).close)) +
        kv('पेट्रोल', APP.lit((td && td.sum || {}).litP)) +
        kv('डीज़ल', APP.lit((td && td.sum || {}).litD)) +
      '</div>' +
      '<div class="card"><h3>कल (' + dmy(yStr) + ')</h3>' +
        kv('बिक्री', money((yd && yd.sum || {}).sale)) +
        kv('कैश बचा', money((yd && yd.sum || {}).close)) +
      '</div>' +
      '<div class="card"><h3>पिछले 7 दिन</h3>' +
        kv('कुल बिक्री', money(weekSale), 'big') +
        kv('औसत/दिन', money(weekSale / Math.max(1, week.length))) +
        kv('हिसाब दिन', week.length) +
      '</div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
  };

  /* ============ REMINDERS ============ */
  APP.views.reminders = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutStr = APP.shiftDate(APP.todayISO(), -30);
    let ps, ls;
    try { ps = await APP.getParties(false, true); ls = await db().collection('ledger').get(); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const lastU = {};
    ls.docs.forEach(d => {
      const r = d.data();
      if (r.kind === 'udhar' && r.partyId && (!lastU[r.partyId] || r.date > lastU[r.partyId])) lastU[r.partyId] = r.date;
    });
    const old = ps.filter(p => num(p.bal) > 0 && lastU[p.id] && lastU[p.id] < cutStr).sort((a, b) => num(b.bal) - num(a.bal));
    const tot = old.reduce((a, p) => a + num(p.bal), 0);
    main.innerHTML =
      '<div class="card"><h3>⏰ 30+ दिन का उधार</h3>' + kv('कुल बकाया', money(tot), 'neg') + kv('पार्टी संख्या', old.length) + '</div>' +
      (old.length ? old.map(p => {
        const ph = (p.phone || '').replace(/\D/g, '');
        const w = waNum(p.phone);
        return '<div class="card"><div class="kv"><span>' + esc(p.name) + '</span><b class="neg">' + money(p.bal) + '</b></div>' +
          '<div class="mut" style="font-size:12px">आखिरी उधार: ' + dmy(lastU[p.id]) + (p.phone ? ' · 📞 ' + esc(p.phone) : '') + '</div>' +
          '<div class="btns" style="margin-top:8px">' +
            (ph ? '<a class="btn sm w" href="tel:' + esc(p.phone) + '">📞 कॉल</a>' : '') +
            (w ? '<button class="btn sm g" data-wa="' + w + '" data-name="' + esc(p.name) + '" data-bal="' + p.bal + '">💬 WhatsApp</button>' : '') +
          '</div></div>';
      }).join('') : '<div class="card"><p class="mut">कोई पुराना बकाया नहीं 👍</p></div>') +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    $$('[data-wa]').forEach(b => b.onclick = () => {
      const text = '*' + C.pump.name + '*\n\nप्रिय ' + b.dataset.name + ',\n\nआपका बकाया ₹' + b.dataset.bal +
        ' है।\nकृपया जल्द भुगतान करें।\n\nधन्यवाद!\n📞 ' + C.pump.phone;
      window.open('https://wa.me/' + b.dataset.wa + '?text=' + encodeURIComponent(text), '_blank');
    });
  };

  /* ============ CUSTOMERS ============ */
  APP.views.customers = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">ग्राहक लोड हो रहे हैं…</p>';
    let parties;
    try { parties = await APP.getParties(false, true); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const sorted = parties.slice().sort((a, b) => num(b.bal) - num(a.bal));
    main.innerHTML =
      '<div class="btns" style="margin-bottom:10px"><input id="cq" placeholder="नाम या गाड़ी खोजें…" style="flex:1;min-width:0"></div>' +
      '<div id="cgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px"></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    const draw = t => {
      const list = sorted.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#cgrid').innerHTML = list.map(p => {
        const b = num(p.bal), photo = p.photo || '', ini = initials(p.name);
        const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
        return '<div class="card" style="padding:10px;cursor:pointer" data-pid="' + p.id + '">' +
          '<div style="display:flex;flex-direction:column;align-items:center">' +
          (photo
            ? '<img src="' + esc(photo) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #0b3d91">'
            : '<div style="width:64px;height:64px;border-radius:50%;background:#0b3d91;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">' + esc(ini) + '</div>') +
          '<b style="margin-top:6px;text-align:center;font-size:13px;line-height:1.2">' + esc(p.name) + '</b>' +
          '<span class="chip ' + (b > 0 ? 'r' : 'g') + '" style="margin-top:4px;font-size:11px">' + money(b) + '</span>' +
          (ph ? '<div style="display:flex;gap:4px;margin-top:6px" onclick="event.stopPropagation()">' +
            '<a href="tel:' + esc(p.phone) + '" class="btn sm w" style="padding:4px 8px;font-size:11px">📞</a>' +
            (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn sm g" style="padding:4px 8px;font-size:11px">💬</a>' : '') +
          '</div>' : '') +
          '</div></div>';
      }).join('') || '<p class="mut">कोई ग्राहक नहीं</p>';
      $$('[data-pid]').forEach(el => el.onclick = () => APP.customerCard(el.dataset.pid));
    };
    $('#cq').oninput = e => draw(e.target.value.trim().toLowerCase());
    draw('');
  };

  APP.customerCard = async function (id) {
    let ps; try { ps = await db().collection('parties').doc(id).get(); } catch (e) { return; }
    if (!ps.exists) return;
    const p = { id, ...ps.data() };
    const ini = initials(p.name);
    const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
    let photoData = p.photo || '';
    const m = modal(
      '<h3>' + esc(p.name) + '</h3>' +
      '<div style="text-align:center;padding:8px 0" id="cc-photo-box">' +
        (photoData ? '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">'
        : '<div style="width:100px;height:100px;border-radius:50%;background:#0b3d91;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:700">' + esc(ini) + '</div>') +
      '</div>' +
      (isViewer() ? '' :
        '<div class="btns" style="margin-bottom:8px"><label class="btn sm w" style="cursor:pointer;text-align:center">📷 फोटो<input type="file" accept="image/*" id="cc-photo" style="display:none"></label></div>') +
      '<label>नाम</label><input id="cc-name" value="' + esc(p.name || '') + '"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>फोन</label><input id="cc-phone" value="' + esc(p.phone || '') + '" inputmode="tel"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>गाड़ियाँ</label><input id="cc-veh" value="' + esc((p.vehicles || []).join(', ')) + '"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>उधार सीमा (₹)</label><input id="cc-limit" value="' + esc(p.limit || '') + '" inputmode="decimal"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>दस्तावेज़ / नोट</label><textarea id="cc-doc" rows="2"' + (isViewer() ? ' disabled' : '') + '>' + esc(p.docs || '') + '</textarea>' +
      '<div class="kv" style="margin-top:8px"><span>वर्तमान बकाया</span><b class="' + (num(p.bal) > 0 ? 'neg' : 'pos') + '">' + money(p.bal) + '</b></div>' +
      '<div class="btns" style="margin-top:12px">' +
        (ph ? '<a href="tel:' + esc(p.phone) + '" class="btn g">📞 कॉल</a>' : '') +
        (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn g">💬 WhatsApp</a>' : '') +
      '</div>' +
      '<div class="btns">' +
        '<button class="btn" id="cc-stmt">📤 स्टेटमेंट</button>' +
        (isViewer() ? '' : '<button class="btn g" id="cc-save">💾 सेव</button>') +
        '<button class="btn w" id="cc-close">बंद</button>' +
      '</div>'
    );
    $('#cc-close', m).onclick = () => m.close();
    if (!isViewer()) {
      $('#cc-photo', m).onchange = e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 200, sc = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = img.width * sc; cv.height = img.height * sc;
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            photoData = cv.toDataURL('image/jpeg', 0.75);
            $('#cc-photo-box', m).innerHTML = '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">';
            toast('फोटो तैयार ✔');
          };
          img.src = r.result;
        };
        r.readAsDataURL(f);
      };
      $('#cc-save', m).onclick = async () => {
        const data = {
          name: $('#cc-name', m).value.trim(),
          phone: $('#cc-phone', m).value.trim(),
          vehicles: $('#cc-veh', m).value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean),
          limit: num($('#cc-limit', m).value) || 0,
          docs: $('#cc-doc', m).value.trim(),
          photo: photoData
        };
        if (!data.name) return toast('नाम ज़रूरी');
        try { await db().collection('parties').doc(id).update(data); S.parties.pub = null; m.close(); toast('सेव ✔'); APP.views.customers(); }
        catch (e) { toast('सेव नहीं हुआ: ' + e.message); }
      };
    }
    $('#cc-stmt', m).onclick = () => APP.sharePartyStatement(id, false);
  };

  /* ============ BANK DEPOSITS ============ */
  const isOwnerF = () => APP.isOwner && APP.isOwner();
  const isAutoBank = id => String(id || '').indexOf('sbi_auto_') === 0;   // "मालिक को दिया" से अपने-आप बनी

  function bankModal(x, done) {
    const e = x || null;
    const banks = ['SBI', 'HDFC', 'PNB', 'BOB', 'अन्य'];
    if (e && e.bank && banks.indexOf(e.bank) < 0) banks.unshift(e.bank);
    const modes = [['cash', 'नकद'], ['cheque', 'चेक'], ['upi', 'UPI']];
    const m = modal('<h3>' + (e ? '✏️ बैंक जमा बदलें' : 'बैंक जमा') + '</h3>' +
      (e && isAutoBank(e.id) ? '<div class="warn">ये एंट्री दिन के "मालिक को दिया (SBI जमा)" से अपने-आप बनी थी। बदलने के बाद वो दिन दोबारा सेव करने पर भी ये एंट्री अपने-आप नहीं बदलेगी।</div>' : '') +
      '<label>बैंक</label><select id="bn-b">' + banks.map(b => '<option' + (e && e.bank === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>' +
      '<label>तारीख</label><input type="date" id="bn-d" value="' + esc(e ? e.date : today()) + '">' +
      '<label>रकम (₹)</label><input id="bn-a" inputmode="decimal" value="' + esc(e ? e.amount : '') + '">' +
      '<label>माध्यम</label><select id="bn-m">' + modes.map(o => '<option value="' + o[0] + '"' + (e && e.mode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label>चेक नंबर</label><input id="bn-c" value="' + esc(e ? e.cheque || '' : '') + '">' +
      '<label>नोट</label><input id="bn-n" value="' + esc(e ? e.note || '' : '') + '">' +
      '<div class="btns"><button class="btn g" id="bn-sv">सेव</button>' +
      (e ? '<button class="btn r" id="bn-rm">🗑 हटाएँ</button>' : '') +
      '<button class="btn w" id="bn-cl">रद्द</button></div>');
    $('#bn-cl', m).onclick = () => m.close();
    if (e) $('#bn-rm', m).onclick = () => { m.close(); bankRemove(e, done); };
    $('#bn-sv', m).onclick = async () => {
      const a = num($('#bn-a', m).value); if (!(a > 0)) return toast('रकम भरें');
      if (!$('#bn-d', m).value) return toast('तारीख चुनें');
      const who = S.salesman ? S.salesman.name : (S.user && S.user.email) || '';
      const data = {
        bank: $('#bn-b', m).value, date: $('#bn-d', m).value, amount: a,
        mode: $('#bn-m', m).value, cheque: $('#bn-c', m).value.trim(), note: $('#bn-n', m).value.trim()
      };
      try {
        if (e) {
          Object.assign(data, { edited: true, editedBy: who, editedAt: APP.FV.serverTimestamp() });
          await db().collection('bank_deposits').doc(e.id).update(data);
          if (APP.audit) APP.audit('bank_edit', { id: e.id, was: num(e.amount), now: a, date: data.date });
        } else {
          Object.assign(data, { by: who, at: APP.FV.serverTimestamp() });
          await db().collection('bank_deposits').add(data);
        }
        m.close(); toast('सेव ✔'); done();
      } catch (er) { toast('सेव नहीं हुआ: ' + er.message); }
    };
  }

  async function bankRemove(x, done) {
    const auto = isAutoBank(x.id);
    if (!confirm('इस बैंक जमा को हटाएँ?\n\n' + money(x.amount) + ' · ' + (x.bank || 'SBI') + ' · ' + dmy(x.date) +
      (auto ? '\n\nये एंट्री "मालिक को दिया" से अपने-आप बनी थी — हटाने पर दोबारा अपने-आप नहीं बनेगी।' : ''))) return;
    try {
      const who = (S.user && S.user.email) || '';
      if (auto) await db().collection('bank_deposits').doc(x.id).update({ removed: true, removedBy: who, removedAt: APP.FV.serverTimestamp() });
      else await db().collection('bank_deposits').doc(x.id).delete();
      if (APP.audit) APP.audit('bank_delete', { id: x.id, amount: num(x.amount), date: x.date });
      toast('हट गया ✔'); done();
    } catch (er) { toast('हटा नहीं पाया: ' + er.message); }
  }

  APP.views.bank = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('bank_deposits').orderBy('date', 'desc').limit(50).get(); } catch (e) { snap = { docs: [] }; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.removed);
    const tot = list.reduce((a, b) => a + num(b.amount), 0);
    const canEdit = isOwnerF();
    main.innerHTML =
      '<div class="card"><h3>🏦 बैंक जमा</h3>' + kv('कुल जमा', money(tot), 'pos') + kv('जमा संख्या', list.length) + '</div>' +
      (isViewer() ? '' : '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="bn-add">+ नई जमा</button></div>') +
      '<div class="card">' +
        (list.length ? list.map((x, i) => '<div class="item"><div class="a"><b>' + money(x.amount) + ' · ' + esc(x.bank || 'SBI') + '</b><small>' +
          dmy(x.date) + ' · ' + esc(x.mode || 'नकद') + (x.cheque ? ' · चेक ' + esc(x.cheque) : '') +
          (x.note ? ' · ' + esc(x.note) : '') + (x.edited ? ' · ✏️ बदली हुई' : '') + '</small></div>' +
          (canEdit ? '<div style="white-space:nowrap"><button class="btn sm w" data-bn-e="' + i + '">✏️</button> <button class="btn sm r" data-bn-d="' + i + '">🗑</button></div>' : '') +
          '</div>').join('') : '<p class="mut">कोई जमा नहीं</p>') +
      '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    const again = () => APP.views.bank();
    if (!isViewer() && $('#bn-add')) $('#bn-add').onclick = () => bankModal(null, again);
    $$('[data-bn-e]', main).forEach(b => b.onclick = () => bankModal(list[+b.dataset.bnE], again));
    $$('[data-bn-d]', main).forEach(b => b.onclick = () => bankRemove(list[+b.dataset.bnD], again));
  };

  /* ============ PARTY VIEW BUTTONS (call/WA/statement) ============ */
  document.addEventListener('click', e => {
    const item = e.target.closest('#plist .item[data-id]');
    if (item) window.__mazdaLastPartyId = item.dataset.id;
  }, true);

  function injectPartyActions() {
    const back = document.querySelector('#main #back'); if (!back) return;
    if (document.querySelector('#main #stmt-share')) return;
    const pid = window.__mazdaLastPartyId; if (!pid) return;
    db().collection('parties').doc(pid).get().then(snap => {
      if (!snap.exists) return;
      const p = snap.data();
      const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
      const wrap = document.createElement('span');
      wrap.style.display = 'inline-flex'; wrap.style.gap = '6px';
      let html = '';
      if (ph) html += '<a href="tel:' + esc(p.phone) + '" class="btn sm g">📞</a>';
      if (w) html += '<a href="https://wa.me/' + w + '" target="_blank" class="btn sm g">💬</a>';
      html += '<button class="btn sm g" id="stmt-share">📤 स्टेटमेंट</button>';
      wrap.innerHTML = html;
      back.parentNode.appendChild(wrap);
      const sb = document.getElementById('stmt-share');
      if (sb) sb.onclick = () => APP.sharePartyStatement(pid, false);
    }).catch(() => {});
  }

  /* ============ DAYVIEW EXTRAS: cash box, cost fields, register photo, dup check ============ */
  function injectDayExtras() {
    injectCashBox();
    injectCostFields();
    injectPhotoBtn();
    injectPartyActions();
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
  function injectCostFields() {
    if (document.querySelector('#f-costP')) return;
    const h3s = document.querySelectorAll('#main .card h3');
    let rateCard = null;
    h3s.forEach(h => { if (h.textContent.includes('आज का रेट')) rateCard = h.closest('.card'); });
    if (!rateCard) return;
    const locked = S.cur && S.cur.locked;
    const dis = locked ? ' disabled' : '';
    const row = document.createElement('div');
    row.className = 'row'; row.style.marginTop = '8px';
    row.innerHTML =
      '<div><label>खरीद रेट P (₹/L)</label><input id="f-costP" inputmode="decimal" placeholder="लागत रेट P"' + dis + '></div>' +
      '<div><label>खरीद रेट D (₹/L)</label><input id="f-costD" inputmode="decimal" placeholder="लागत रेट D"' + dis + '></div>';
    rateCard.appendChild(row);
    const date = S.cur && S.cur.date;
    if (!date) return;
    db().collection('day_costs').doc(date).get().then(snap => {
      if (snap.exists) {
        const d = snap.data();
        const pe = document.getElementById('f-costP'), de = document.getElementById('f-costD');
        if (pe && d.costP) pe.value = d.costP;
        if (de && d.costD) de.value = d.costD;
      }
    }).catch(() => {});
    if (!locked) {
      const save = async () => {
        try {
          await db().collection('day_costs').doc(date).set({
            costP: num(document.getElementById('f-costP').value),
            costD: num(document.getElementById('f-costD').value),
            at: APP.FV.serverTimestamp()
          }, { merge: true });
          try {
            const existing = await db().collection('rate_history').where('date', '==', date).limit(1).get();
            const dayDoc = await db().collection('days').doc(date).get();
            const dd = dayDoc.exists ? dayDoc.data() : {};
            const entry = {
              date, costP: num(document.getElementById('f-costP').value),
              costD: num(document.getElementById('f-costD').value),
              rateP: num(dd.rateP), rateD: num(dd.rateD),
              at: APP.FV.serverTimestamp()
            };
            if (existing.empty) await db().collection('rate_history').add(entry);
            else await db().collection('rate_history').doc(existing.docs[0].id).update(entry);
          } catch (x) {}
        } catch (e) {}
      };
      const pe = document.getElementById('f-costP'); if (pe) pe.onchange = save;
      const de = document.getElementById('f-costD'); if (de) de.onchange = save;
    }
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
        const snap = await db().collection('ledger').where('date', '==', S.date).get();
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const seen = {}, dups = [];
        rows.forEach(r => {
          const key = (r.kind || '') + '|' + (r.partyId || '') + '|' + (r.vehicle || '') + '|' + num(r.amount).toFixed(2);
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
          net = Math.max(0, g - num(d.testing || 5));
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

  /* ============ MORE VIEW EXTENSION ============ */
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#extra-more-card')) return;
    const extra = document.createElement('div');
    extra.id = 'extra-more-card';
    extra.innerHTML =
      '<div class="card"><h3>🔧 और सुविधाएँ</h3><div class="btns">' +
        '<button class="btn w" data-nav="dashboard">📊 डैशबोर्ड</button>' +
        '<button class="btn w" data-nav="monthreport">📅 मासिक रिपोर्ट</button>' +
        '<button class="btn w" data-nav="reminders">⏰ उधार रिमाइंडर</button>' +
        '<button class="btn w" data-nav="customers">👥 ग्राहक कार्ड</button>' +
        '<button class="btn w" data-nav="bank">🏦 बैंक जमा</button>' +
        '<button class="btn w" data-nav="workers">👷 वर्कर हाज़िरी</button>' +
        '<button class="btn w" data-nav="nozzle">⛽ नोज़ल ट्रेंड</button>' +
        (APP.isOwner && APP.isOwner() ? '<button class="btn w" data-nav="audit">🔍 ऑडिट लॉग</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>💾 पूरा बैकअप</h3>' +
        '<p class="mut" style="font-size:12px;margin:4px 0">सारा डेटा एक फ़ाइल में।</p>' +
        '<div class="btns"><button class="btn g" id="bk-json">JSON</button><button class="btn w" id="bk-csv">CSV (Excel)</button></div></div>';
    main.appendChild(extra);
    extra.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => APP.go(b.dataset.nav));
    const jb = $('#bk-json'); if (jb) jb.onclick = () => APP.downloadBackup('json');
    const cb = $('#bk-csv'); if (cb) cb.onclick = () => APP.downloadBackup('csv');
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
    setTimeout(() => { restoreDraftsSmart(); startObs(); }, 800);
  });
  console.log('[Mazda features.js] loaded ✓');
})();
