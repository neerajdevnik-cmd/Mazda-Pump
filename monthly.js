/* Mazda Oil Company - CA Monthly Report (Excel/PDF) + Aaj ki Checklist */
(function () {
  'use strict';
  const APP = window.APP; if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, db = () => APP.db;
  const MN = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
  const label = ym => MN[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
  const kv = (a, b, c) => '<div class="kv"><span>' + a + '</span><b class="' + (c || '') + '">' + b + '</b></div>';

  async function build(ym) {
    const a = ym + '-01', b = ym + '-31', col = n => db().collection(n).where('date', '>=', a).where('date', '<=', b).get();
    const [ds, ls, bs, parties] = await Promise.all([col('days'), col('ledger'), col('bank_deposits').catch(() => ({ docs: [] })), APP.getParties(false, true)]);
    const days = ds.docs.map(x => x.data()).sort((p, q) => p.date.localeCompare(q.date));
    const led = ls.docs.map(x => x.data()).filter(r => !K.isOpening(r));
    const banks = bs.docs.map(x => x.data()).filter(x => !x.removed).sort((p, q) => p.date.localeCompare(q.date));
    const by = {}; led.forEach(r => { const o = by[r.date] = by[r.date] || { u: 0, j: 0 }; if (r.kind === 'udhar') o.u += num(r.amount); else if (r.kind === 'jama') o.j += num(r.amount); });
    const rows = days.map(d => {
      const s = d.sum || {}, l = by[d.date] || { u: 0, j: 0 };
      return { date: d.date, litP: num(s.litP), litD: num(s.litD), sale: num(s.sale), paytm: num(d.paytm), swipe: num(d.swipe), udhar: r2(l.u), jama: r2(l.j),
        kharcha: K.khTotal(d), sbi: num(d.malikDiya), close: num(s.close), tkP: num(d.tankerP), tkD: num(d.tankerD), dfP: s.diffP == null ? '' : num(s.diffP), dfD: s.diffD == null ? '' : num(s.diffD) };
    });
    const tot = { litP: 0, litD: 0, sale: 0, paytm: 0, swipe: 0, udhar: 0, jama: 0, kharcha: 0, sbi: 0, tkP: 0, tkD: 0 };
    rows.forEach(r => Object.keys(tot).forEach(k => { tot[k] = r2(tot[k] + r[k]); }));
    const pm = {}; led.forEach(r => { const o = pm[r.partyId] = pm[r.partyId] || { name: r.partyName, u: 0, j: 0 }; if (r.kind === 'udhar') o.u += num(r.amount); else if (r.kind === 'jama') o.j += num(r.amount); });
    const plist = Object.keys(pm).map(id => { const p = parties.find(x => x.id === id) || {}; return { name: pm[id].name || p.name || '?', u: r2(pm[id].u), j: r2(pm[id].j), bal: r2(num(p.bal)) }; }).sort((x, y) => y.u - x.u);
    return { ym, rows, tot, plist, banks, exp: K.khSummary(days, false), due: r2(parties.reduce((t, p) => t + Math.max(0, num(p.bal)), 0)) };
  }

  const H = ['तारीख', 'पेट्रोल L', 'डीज़ल L', 'कुल बिक्री', 'Paytm/UPI', 'स्वाइप', 'उधार', 'जमा', 'खर्चा', 'SBI जमा', 'बचा कैश', 'P टैंकर', 'D टैंकर', 'P फर्क', 'D फर्क'];
  const rowArr = r => [dmy(r.date), r.litP, r.litD, r.sale, r.paytm, r.swipe, r.udhar, r.jama, r.kharcha, r.sbi, r.close, r.tkP, r.tkD, r.dfP, r.dfD];
  function toCSV(R) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const L = [];
    const add = a => L.push(a.map(q).join(','));
    add([C.pump.nameEn + ' - Monthly Report - ' + R.ym]); add([]);
    add(H); R.rows.forEach(r => add(rowArr(r)));
    add(['कुल', R.tot.litP, R.tot.litD, R.tot.sale, R.tot.paytm, R.tot.swipe, R.tot.udhar, R.tot.jama, R.tot.kharcha, R.tot.sbi, '', R.tot.tkP, R.tot.tkD, '', '']);
    add([]); add(['खर्चा विवरण', 'रकम']); R.exp.forEach(x => add([x.label, x.amount]));
    add([]); add(['पार्टी', 'इस माह उधार', 'इस माह जमा', 'कुल बकाया (अभी)']); R.plist.forEach(p => add([p.name, p.u, p.j, p.bal]));
    add([]); add(['बैंक जमा तारीख', 'बैंक', 'रकम']); R.banks.forEach(b => add([dmy(b.date), b.bank || '', num(b.amount)]));
    return '\ufeff' + L.join('\r\n');
  }
  function toHTML(R) {
    const t = (hd, rs) => '<table><tr>' + hd.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + rs.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>';
    return '<html><head><meta charset="utf-8"><title>' + esc(C.pump.nameEn) + ' ' + R.ym + '</title><style>body{font-family:sans-serif;font-size:11px;padding:14px}h2{color:#0a2f6b;margin:0}table{border-collapse:collapse;width:100%;margin:8px 0 14px}th{background:#0a2f6b;color:#fff}th,td{border:1px solid #bbb;padding:3px 4px;text-align:right}td:first-child,th:first-child{text-align:left}</style></head><body><h2>' + esc(C.pump.name) + '</h2><div>' + esc(C.pump.addressEn) + ' · ' + esc(label(R.ym)) + '</div>' +
      t(H, R.rows.map(rowArr).concat([['कुल', R.tot.litP, R.tot.litD, R.tot.sale, R.tot.paytm, R.tot.swipe, R.tot.udhar, R.tot.jama, R.tot.kharcha, R.tot.sbi, '', R.tot.tkP, R.tot.tkD, '', '']])) +
      '<b>खर्चा विवरण</b>' + t(['खर्चा', 'रकम'], R.exp.map(x => [x.label, x.amount])) +
      '<b>पार्टी हिसाब</b>' + t(['पार्टी', 'उधार', 'जमा', 'बकाया'], R.plist.map(p => [p.name, p.u, p.j, p.bal])) +
      '<b>बैंक जमा</b>' + t(['तारीख', 'बैंक', 'रकम'], R.banks.map(b => [dmy(b.date), b.bank || '', num(b.amount)])) + '</body></html>';
  }

  APP.views.monthreport = async function (ym) {
    const main = $('#main'); if (!main) return;
    ym = (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym)) ? ym : APP.todayISO().slice(0, 7);
    main.innerHTML = '<p class="mut">Report loading…</p>';
    let R; try { R = await build(ym); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    S._mr = R;
    main.innerHTML = '<div class="card"><label style="margin-top:0">Month</label><input type="month" id="mr-m" value="' + ym + '"></div>' +
      '<div class="card"><h3>📅 ' + esc(label(ym)) + '</h3>' + kv('कुल बिक्री', money(R.tot.sale), 'big') + kv('पेट्रोल', APP.lit(R.tot.litP)) + kv('डीज़ल', APP.lit(R.tot.litD)) +
      kv('Paytm/UPI', money(R.tot.paytm)) + kv('स्वाइप', money(R.tot.swipe)) + kv('उधार दिया', money(R.tot.udhar), 'neg') + kv('पार्टी जमा', money(R.tot.jama), 'pos') +
      kv('कुल खर्चा', money(R.tot.kharcha)) + kv('SBI जमा', money(R.tot.sbi)) + kv('हिसाब के दिन', R.rows.length) + kv('अभी कुल बकाया', money(R.due), 'neg') + '</div>' +
      '<div class="btns"><button class="btn g" id="mr-x">📊 Excel</button><button class="btn" id="mr-p">📄 PDF / Print</button></div>' +
      '<div class="card" style="overflow-x:auto;margin-top:12px"><h3>दिन-वार</h3><table style="font-size:11px;min-width:520px"><tr><th>तारीख</th><th class="n">P L</th><th class="n">D L</th><th class="n">बिक्री</th><th class="n">उधार</th><th class="n">खर्चा</th><th class="n">कैश</th></tr>' +
      R.rows.map(r => '<tr><td>' + dmy(r.date) + '</td><td class="n">' + r.litP + '</td><td class="n">' + r.litD + '</td><td class="n">' + money(r.sale) + '</td><td class="n">' + money(r.udhar) + '</td><td class="n">' + money(r.kharcha) + '</td><td class="n">' + money(r.close) + '</td></tr>').join('') + '</table></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← Back</button></div>';
    $('#mr-m').onchange = e => APP.views.monthreport(e.target.value);
    $('#mr-x').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toCSV(R)], { type: 'text/csv;charset=utf-8' })); a.download = 'mazda-report-' + ym + '.csv'; a.click(); toast('Excel file ready ✔'); };
    $('#mr-p').onclick = () => { const w = window.open('', '_blank'); if (!w) return toast('Popup allow karein'); w.document.write(toHTML(R)); w.document.close(); setTimeout(() => w.print(), 400); };
  };
  APP.monthly = { build, toCSV };

  /* ---- Aaj ki checklist (sirf aaj ka din, mukhya hisab screen par) ---- */
  let busy = false;
  async function checklist() {
    const main = document.querySelector('#main'); const st = S.cur;
    if (busy || !main || !st || !document.querySelector('#f-date') || st.date !== APP.todayISO() || APP.isViewer()) return;
    let box = document.querySelector('#chk-card');
    if (!box) { box = document.createElement('div'); box.id = 'chk-card'; box.className = 'card'; main.insertBefore(box, main.firstChild); }
    busy = true;
    try {
      let y = null; try { y = await db().collection('days').doc(APP.shiftDate(st.date, -1)).get(); } catch (e) { }
      const prev = !y ? null : (y.exists && y.data().status === 'submitted');
      const filled = document.querySelectorAll('.nzi[data-f="c"]').length ? Array.from(document.querySelectorAll('.nzi[data-f="c"]')).filter(i => i.value !== '').length : 0;
      const v = id => { const e = document.getElementById(id); return e && e.value !== ''; };
      const it = (ok, t) => '<div class="kv"><span>' + t + '</span><b>' + (ok ? '✅' : '⬜') + '</b></div>';
      box.innerHTML = '<h3>📋 Today checklist</h3>' + (prev === null ? '' : it(prev, 'कल का हिसाब जमा') ) + it(filled >= K.activeNz().length, 'Meter closing (' + filled + '/' + K.activeNz().length + ')') + it(v('f-dipP') && v('f-dipD'), 'Dip (Petrol + Diesel)') + it(st.d && st.d.status === 'submitted', 'आज का हिसाब जमा');
    } finally { busy = false; }
  }
  document.addEventListener('input', () => setTimeout(checklist, 300));
  window.addEventListener('load', () => setTimeout(() => {
    const m = document.querySelector('#main'); if (m) new MutationObserver(() => setTimeout(checklist, 150)).observe(m, { childList: true });
  }, 1000));
  console.log('[Mazda monthly.js] loaded ✓');
})();
