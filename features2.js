/* Mazda Oil Company - Features pack 2: Workers + Owner Viewer views + Location Setup */
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

  // ... (Purane workers, attendance, salary, v_home, v_parties, v_money, v_workers functions same rahenge)
  // Yaha sirf more view ka extension dikha raha hoon

  /* ============ More view — VIEWER-SPECIFIC extension ============ */
  const origMoreViewer = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMoreViewer) await origMoreViewer.apply(this, arguments);
    if (!isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#extra-more-card')) return;
    
    const extra = document.createElement('div');
    extra.id = 'extra-more-card';
    extra.innerHTML =
      '<div class="card"><h3>📊 विश्लेषण</h3><div class="btns">' +
        (APP.views.analytics ? '<button class="btn w" data-nav="analytics">📊 आंकड़ों का विश्लेषण</button>' : '') +
        (APP.views.rate_history ? '<button class="btn w" data-nav="rate_history">📈 रेट इतिहास</button>' : '') +
        (APP.views.dashboard ? '<button class="btn w" data-nav="dashboard">📊 डैशबोर्ड</button>' : '') +
        (APP.views.monthreport ? '<button class="btn w" data-nav="monthreport">📅 मासिक रिपोर्ट</button>' : '') +
        (APP.views.nozzle ? '<button class="btn w" data-nav="nozzle">⛽ नोज़ल ट्रेंड</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>💰 वित्त</h3><div class="btns">' +
        (APP.views.bank ? '<button class="btn w" data-nav="bank">🏦 बैंक जमा</button>' : '') +
        (APP.views.invoices ? '<button class="btn w" data-nav="invoices">📄 खरीद बिल / मार्जिन</button>' : '') +
        (APP.views.reminders ? '<button class="btn w" data-nav="reminders">⏰ उधार रिमाइंडर</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>👥 पार्टी</h3><div class="btns">' +
        (APP.views.customers ? '<button class="btn w" data-nav="customers">👥 ग्राहक कार्ड</button>' : '') +
        (APP.cibil ? '<button class="btn w" data-nav="cibil">⭐ पार्टी CIBIL</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>👷 वर्कर</h3><div class="btns">' +
        '<button class="btn w" data-nav="v_workers">👷 वर्कर हाज़िरी</button>' +
      '</div></div>' +
      '<div class="card"><h3>🔍 लॉग</h3><div class="btns">' +
        (APP.views.audit ? '<button class="btn w" data-nav="audit">🔍 ऑडिट लॉग</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>💾 बैकअप</h3>' +
        '<p class="mut" style="font-size:12px;margin:4px 0">सारा डेटा एक फ़ाइल में।</p>' +
        '<div class="btns"><button class="btn g" id="bk-json">JSON</button><button class="btn w" id="bk-csv">CSV (Excel)</button></div></div>';
    
    main.appendChild(extra);
    extra.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => APP.go(b.dataset.nav));
    const jb = $('#bk-json'); if (jb) jb.onclick = () => APP.downloadBackup('json');
    const cb = $('#bk-csv'); if (cb) cb.onclick = () => APP.downloadBackup('csv');
  };

  console.log('[Mazda features2.js] loaded ✓ (owner view enhanced)');
})();
