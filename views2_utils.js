/* Mazda Oil Company - बैकअप रीस्टोर (JSON अपलोड). नोट: स्कैनर और थर्मल पर्ची views2.js वाले असली ही चलेंगे, यहाँ उन्हें छुआ नहीं गया। */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C || !APP.db) return;
  const $ = APP.$, esc = APP.esc, toast = APP.toast;
  const COLS = ['days', 'ledger', 'parties', 'priv_ledger', 'priv_parties', 'gaadi_cash', 'bank_deposits', 'audit', 'workers', 'attendance', 'salary_payments', 'rate_history', 'day_costs', 'day_photos', 'runsheets', 'sm_shifts', 'cash_submissions', 'shop'];

  /* Timestamp वाले {seconds, nanoseconds} को वापस असली Timestamp बनाना */
  function revive(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(revive);
    const ks = Object.keys(v);
    const sec = typeof v.seconds === 'number' ? v.seconds : (typeof v._seconds === 'number' ? v._seconds : null);
    const nan = typeof v.nanoseconds === 'number' ? v.nanoseconds : (typeof v._nanoseconds === 'number' ? v._nanoseconds : 0);
    if (sec !== null && ks.length <= 2) return firebase.firestore.Timestamp.fromMillis(sec * 1000 + Math.floor(nan / 1e6));
    const o = {};
    ks.forEach(k => { o[k] = revive(v[k]); });
    return o;
  }

  function plan(json) {
    const out = [];
    COLS.forEach(c => {
      const arr = json && Array.isArray(json[c]) ? json[c] : [];
      const rows = arr.filter(r => r && typeof r.id === 'string' && r.id && r.id.indexOf('/') < 0);
      if (rows.length) out.push({ c, rows });
    });
    return out;
  }

  APP.restoreFromJSON = function () {
    let json = null;
    const m = APP.modal('<h3>📤 पुराना बैकअप अपलोड करें</h3>' +
      '<p class="mut" style="font-size:13px;margin:4px 0 10px">"पूरा बैकअप" से बनी .json फाइल चुनें। कुछ भी डिलीट नहीं होगा।</p>' +
      '<label class="btn o full" style="text-align:center;cursor:pointer;display:block">📁 JSON फाइल चुनें<input type="file" id="rs-file" accept=".json,application/json" style="display:none"></label>' +
      '<div id="rs-info" style="margin:10px 0"></div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" id="rs-over" style="width:auto"> जो डेटा ऐप में पहले से है उसे भी बैकअप वाले से बदलो <span class="mut">(नहीं चुना तो सिर्फ़ गायब डेटा जुड़ेगा — यही सुरक्षित है)</span></label>' +
      '<div class="btns" style="margin-top:12px"><button class="btn g" id="rs-go" disabled>✅ रीस्टोर करो</button><button class="btn w" id="rs-no">बंद</button></div>');
    const q = s => m.querySelector(s);
    q('#rs-no').onclick = () => m.close();

    q('#rs-file').onchange = e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onerror = () => { q('#rs-info').innerHTML = '<div class="err">फाइल पढ़ी नहीं गई</div>'; };
      rd.onload = () => {
        try { json = JSON.parse(String(rd.result).replace(/^\uFEFF/, '')); }
        catch (x) { json = null; q('#rs-info').innerHTML = '<div class="err">ये सही JSON फाइल नहीं है: ' + esc(x.message) + '</div>'; q('#rs-go').disabled = true; return; }
        const p = plan(json);
        if (!p.length) { q('#rs-info').innerHTML = '<div class="err">इस फाइल में कोई हिसाब का डेटा नहीं मिला</div>'; q('#rs-go').disabled = true; return; }
        q('#rs-info').innerHTML = '<div class="ok">✔ ' + esc(f.name) + '</div>' + p.map(x => '<div class="kv"><span>' + esc(x.c) + '</span><b>' + x.rows.length + '</b></div>').join('');
        q('#rs-go').disabled = false;
      };
      rd.readAsText(f);
    };

    q('#rs-go').onclick = async () => {
      if (!json) return;
      const over = q('#rs-over').checked;
      if (!confirm(over ? '⚠️ पहले से मौजूद डेटा भी बैकअप वाले पुराने डेटा से बदल सकता है। आगे बढ़ें?' : 'सिर्फ़ गायब डेटा जुड़ेगा। आगे बढ़ें?')) return;
      const btn = q('#rs-go'); btn.disabled = true;
      const info = q('#rs-info');
      let added = 0, skipped = 0, failed = 0;
      try {
        for (const part of plan(json)) {
          info.innerHTML = '<div class="mut">⏳ ' + esc(part.c) + ' (' + part.rows.length + ')…</div>';
          let have = new Set();
          if (!over) { const snap = await APP.db.collection(part.c).get(); snap.docs.forEach(d => have.add(d.id)); }
          let batch = APP.db.batch(), n = 0;
          for (const r of part.rows) {
            if (!over && have.has(r.id)) { skipped++; continue; }
            const data = {}; Object.keys(r).forEach(k => { if (k !== 'id') data[k] = revive(r[k]); });
            batch.set(APP.db.collection(part.c).doc(r.id), data, { merge: true });
            n++; added++;
            if (n === 400) { try { await batch.commit(); } catch (e) { failed += n; added -= n; } batch = APP.db.batch(); n = 0; }
          }
          if (n) { try { await batch.commit(); } catch (e) { failed += n; added -= n; } }
        }
        if (APP.S) APP.S.parties = null;
        info.innerHTML = '<div class="ok">✔ पूरा हुआ — जुड़े: <b>' + added + '</b> · पहले से थे (छोड़े): <b>' + skipped + '</b>' + (failed ? ' · <span style="color:#c0392b">फेल: ' + failed + '</span>' : '') + '</div>';
        toast('रीस्टोर पूरा ✔');
        if (APP.audit) APP.audit('restore_backup', { added, skipped, failed });
      } catch (e) { info.innerHTML = '<div class="err">रीस्टोर नहीं हुआ: ' + esc(e.message) + '</div>'; btn.disabled = false; }
    };
  };

  /* "और" पेज के नीचे बटन — ग़लती हुई तो भी असली पेज नहीं रुकेगा */
  function addBtn() {
    const main = $('#main'); if (!main || $('#restore-bk-btn') || (APP.isViewer && APP.isViewer())) return;
    const b = document.createElement('button');
    b.id = 'restore-bk-btn'; b.type = 'button'; b.className = 'btn o full'; b.style.marginTop = '12px';
    b.textContent = '📤 पुराना बैकअप अपलोड करें';
    b.onclick = () => APP.restoreFromJSON();
    main.appendChild(b);
  }
  function wrap() {
    const orig = APP.views.more;
    APP.views.more = async function () {
      try { if (orig) await orig.apply(this, arguments); } finally { try { addBtn(); } catch (e) { console.error(e); } }
    };
  }
  if (document.readyState === 'complete') wrap(); else window.addEventListener('load', () => setTimeout(wrap, 50));
  APP.restoreTools = { revive, plan };
  console.log('[Mazda views2_utils.js] restore ✓');
})();
