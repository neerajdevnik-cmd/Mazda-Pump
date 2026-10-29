/* Mazda Oil Company - Invoice-based Margin System */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  APP.views = APP.views || {};
  APP.margins = {};

  function shiftDate(iso, n) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function getAllInvoices() {
    try {
      const snap = await db().collection('tanker_invoices').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date));
    } catch (e) { return []; }
  }

  async function getInvoices(from, to) {
    let arr = await getAllInvoices();
    if (from) arr = arr.filter(x => x.date >= from);
    if (to) arr = arr.filter(x => x.date <= to);
    return arr;
  }

  async function getLatestPurchaseRate(fuelType, date) {
    try {
      const snap = await db().collection('tanker_invoices').where('fuelType', '==', fuelType).get();
      let best = null;
      snap.docs.forEach(d => {
        const x = d.data();
        if (x.date <= date && (!best || x.date > best.date)) best = x;
      });
      return best ? num(best.purchaseRate) : null;
    } catch (e) { return null; }
  }

  async function getDayCost(date) {
    try {
      const snap = await db().collection('day_costs').doc(date).get();
      return snap.exists ? snap.data() : null;
    } catch (e) { return null; }
  }

  async function getPurchaseRatesForDate(date) {
    const [p, d, dc] = await Promise.all([getLatestPurchaseRate('petrol', date), getLatestPurchaseRate('diesel', date), getDayCost(date)]);
    return {
      petrol: p || (dc && num(dc.costP)) || 0,
      diesel: d || (dc && num(dc.costD)) || 0,
      source: (p || d) ? 'invoice' : 'manual'
    };
  }

  async function getDailyMargin(date) {
    const [daySnap, rates] = await Promise.all([db().collection('days').doc(date).get(), getPurchaseRatesForDate(date)]);
    if (!daySnap.exists) return null;
    const d = daySnap.data();
    const sum = d.sum || {};
    const litP = num(sum.litP), litD = num(sum.litD);
    const rateP = num(d.rateP), rateD = num(d.rateD);
    const costP = rates.petrol, costD = rates.diesel;
    const marginP = litP > 0 && rateP > 0 && costP > 0 ? r2((rateP - costP) * litP) : 0;
    const marginD = litD > 0 && rateD > 0 && costD > 0 ? r2((rateD - costD) * litD) : 0;
    const sale = num(sum.sale);
    const marginTotal = r2(marginP + marginD);
    return {
      date,
      petrol: { litres: litP, saleRate: rateP, costRate: costP, margin: marginP, marginPerLitre: r2(rateP - costP) },
      diesel: { litres: litD, saleRate: rateD, costRate: costD, margin: marginD, marginPerLitre: r2(rateD - costD) },
      sale, total: marginTotal,
      pct: sale > 0 ? r2(marginTotal / sale * 100) : 0,
      source: rates.source
    };
  }

  async function getMonthlyMargin(ym) {
    const from = ym + '-01', to = ym + '-31';
    try {
      const [daysSnap, invSnap] = await Promise.all([
        db().collection('days').where('date', '>=', from).where('date', '<=', to).get(),
        db().collection('tanker_invoices').get()
      ]);
      const days = daysSnap.docs.map(x => x.data()).sort((a, b) => a.date.localeCompare(b.date));
      if (!days.length) return null;
      const allInvs = invSnap.docs.map(d => d.data());
      const rateListP = allInvs.filter(x => x.fuelType === 'petrol' && x.date <= to).map(x => ({ date: x.date, rate: num(x.purchaseRate) })).sort((a, b) => a.date.localeCompare(b.date));
      const rateListD = allInvs.filter(x => x.fuelType === 'diesel' && x.date <= to).map(x => ({ date: x.date, rate: num(x.purchaseRate) })).sort((a, b) => a.date.localeCompare(b.date));
      function getRate(list, date) {
        let best = null;
        for (const r of list) { if (r.date <= date) best = r; else break; }
        return best ? best.rate : null;
      }
      const dayCosts = {};
      try {
        const dcSnap = await db().collection('day_costs').where('date', '>=', from).where('date', '<=', to).get();
        dcSnap.docs.forEach(x => { dayCosts[x.id] = x.data(); });
      } catch (e) {}
      const results = days.map(d => {
        const sum = d.sum || {};
        const litP = num(sum.litP), litD = num(sum.litD);
        const rateP = num(d.rateP), rateD = num(d.rateD);
        let costP = getRate(rateListP, d.date);
        let costD = getRate(rateListD, d.date);
        if (!costP && dayCosts[d.date]) costP = num(dayCosts[d.date].costP);
        if (!costD && dayCosts[d.date]) costD = num(dayCosts[d.date].costD);
        costP = costP || 0; costD = costD || 0;
        const marginP = litP > 0 && rateP > 0 && costP > 0 ? r2((rateP - costP) * litP) : 0;
        const marginD = litD > 0 && rateD > 0 && costD > 0 ? r2((rateD - costD) * litD) : 0;
        return {
          date: d.date,
          petrol: { litres: litP, saleRate: rateP, costRate: costP, margin: marginP, marginPerLitre: r2(rateP - costP) },
          diesel: { litres: litD, saleRate: rateD, costRate: costD, margin: marginD, marginPerLitre: r2(rateD - costD) },
          sale: num(sum.sale),
          total: r2(marginP + marginD)
        };
      });
      const tot = results.reduce((a, m) => {
        a.petrolLitres += m.petrol.litres;
        a.dieselLitres += m.diesel.litres;
        a.petrolMargin += m.petrol.margin;
        a.dieselMargin += m.diesel.margin;
        a.totalMargin += m.total;
        a.totalSale += m.sale;
        return a;
      }, { petrolLitres: 0, dieselLitres: 0, petrolMargin: 0, dieselMargin: 0, totalMargin: 0, totalSale: 0 });
      return {
        ym, days: results,
        totals: {
          petrolLitres: r2(tot.petrolLitres), dieselLitres: r2(tot.dieselLitres),
          petrolMargin: r2(tot.petrolMargin), dieselMargin: r2(tot.dieselMargin),
          totalMargin: r2(tot.totalMargin), totalSale: r2(tot.totalSale),
          pct: tot.totalSale > 0 ? r2(tot.totalMargin / tot.totalSale * 100) : 0
        }
      };
    } catch (e) { return null; }
  }

  APP.margins.getDailyMargin = getDailyMargin;
  APP.margins.getMonthlyMargin = getMonthlyMargin;
  APP.margins.getInvoices = getInvoices;
  APP.margins.getLatestPurchaseRate = getLatestPurchaseRate;

  /* ============ Invoice list view (viewer: read-only) ============ */
  APP.views.invoices = async function () {
    const main = $('#main'); if (!main) return;
    if (S.role === 'salesman') return toast('अनुमति नहीं');
    const viewer = APP.isViewer();
    main.innerHTML = '<p class="mut">बिल लोड हो रहा है…</p>';
    const from = shiftDate(today(), -90);
    const list = await getInvoices(from);
    let html = '<div class="card" style="background:#0b3d91;color:#fff"><div class="row" style="align-items:center"><div style="flex:1"><h3 style="color:#fff;margin:0">📄 खरीद बिल</h3><div style="font-size:12px;opacity:.85;margin-top:4px">' + (viewer ? 'केवल देखें' : 'मार्जिन की गणना के लिए') + '</div></div>' +
      (viewer ? '' : '<div><button class="btn sm o" id="inv-add">+ नया बिल</button></div>') + '</div></div>';
    if (!list.length) {
      html += '<div class="card"><p class="mut" style="text-align:center;padding:20px">कोई बिल नहीं मिला' + (viewer ? '' : '<br><small>पहले बिल जोड़ें — मार्जिन अपने-आप निकलेगा</small>') + '</p></div>';
    } else {
      const byMonth = {};
      list.forEach(inv => { const ym = inv.date.slice(0, 7); if (!byMonth[ym]) byMonth[ym] = []; byMonth[ym].push(inv); });
      Object.keys(byMonth).sort().reverse().forEach(ym => {
        const monthInvs = byMonth[ym];
        const totP = monthInvs.filter(i => i.fuelType === 'petrol').reduce((a, i) => a + num(i.litres), 0);
        const totD = monthInvs.filter(i => i.fuelType === 'diesel').reduce((a, i) => a + num(i.litres), 0);
        const totAmt = monthInvs.reduce((a, i) => a + num(i.amount), 0);
        const label = new Date(ym + '-01T12:00:00').toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
        html += '<div class="card"><h3 style="font-size:15px">' + esc(label) + '</h3>';
        html += '<div class="mut" style="font-size:12px;margin-bottom:8px">पेट्रोल ' + lit(totP) + ' · डीज़ल ' + lit(totD) + ' · कुल ' + money(totAmt) + '</div>';
        monthInvs.forEach(inv => {
          const fuelIcon = inv.fuelType === 'petrol' ? '⛽' : '🛢️';
          const fuelName = inv.fuelType === 'petrol' ? 'पेट्रोल' : 'डीज़ल';
          html += '<div class="item" style="padding:8px 0;' + (viewer ? '' : 'cursor:pointer;') + '" ' + (viewer ? '' : 'data-inv-id="' + inv.id + '"') + '>' +
            '<div class="a"><b>' + fuelIcon + ' ' + fuelName + ' · ' + lit(inv.litres) + ' @ ₹' + r2(inv.purchaseRate) + '</b>' +
            '<small>' + dmy(inv.date) + ' · ' + esc(inv.supplier || '') + (inv.invoiceNo ? ' · #' + esc(inv.invoiceNo) : '') + (inv.tankerNo ? ' · ' + esc(inv.tankerNo) : '') + '</small></div>' +
            '<div style="text-align:right"><b>' + money(inv.amount) + '</b></div></div>';
        });
        html += '</div>';
      });
    }
    html += '<div class="btns" style="margin-top:12px"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    main.innerHTML = html;
    if (!viewer) {
      $('#inv-add').onclick = () => invoiceModal(null);
      $$('[data-inv-id]').forEach(el => el.onclick = () => { const inv = list.find(x => x.id === el.dataset.invId); if (inv) invoiceModal(inv); });
    }
  };

  async function invoiceModal(inv) {
    const e = inv || null;
    const suppliers = ['BPCL', 'IOCL', 'HPCL', 'Reliance', 'Shell', 'Nayara', 'Other'];
    let tankerReports = [];
    try {
      const snap = await db().collection('tanker_reports').orderBy('date', 'desc').limit(10).get();
      tankerReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (x) {}
    const m = modal(
      '<h3>' + (e ? 'बिल बदलें' : 'नया खरीद बिल') + '</h3>' +
      '<label>तारीख</label><input type="date" id="inv-date" value="' + esc(e ? e.date : today()) + '">' +
      '<div class="row"><div><label>कंपनी</label><select id="inv-sup">' + suppliers.map(s => '<option ' + (e && e.supplier === s ? 'selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
      '<div><label>ईंधन</label><select id="inv-fuel"><option value="petrol" ' + (e && e.fuelType === 'petrol' ? 'selected' : '') + '>पेट्रोल</option><option value="diesel" ' + (e && e.fuelType === 'diesel' ? 'selected' : '') + '>डीज़ल</option></select></div></div>' +
      '<div class="row"><div><label>लीटर</label><input id="inv-lit" inputmode="decimal" value="' + esc(e ? e.litres : '') + '"></div>' +
      '<div><label>खरीद रेट (₹/L)</label><input id="inv-rate" inputmode="decimal" value="' + esc(e ? e.purchaseRate : '') + '"></div></div>' +
      '<label>कुल रकम (₹)</label><input id="inv-amt" inputmode="decimal" value="' + esc(e ? e.amount : '') + '">' +
      '<div class="row"><div><label>टैंकर नंबर</label><input id="inv-tanker" style="text-transform:uppercase" value="' + esc(e ? e.tankerNo : '') + '"></div>' +
      '<div><label>बिल नंबर</label><input id="inv-no" value="' + esc(e ? e.invoiceNo : '') + '"></div></div>' +
      (tankerReports.length ? '<div style="margin-top:8px"><button class="btn sm w" type="button" id="inv-trfill" style="width:100%">📥 टैंकर रिपोर्ट से लीटर भरें</button></div>' : '') +
      '<div class="btns" style="margin-top:12px"><button class="btn g" id="inv-save">💾 सेव</button>' +
      (e ? '<button class="btn r" id="inv-del">🗑 हटाएं</button>' : '') +
      '<button class="btn w" id="inv-cancel">रद्द</button></div>'
    );
    const q = id => $('#' + id, m);
    const autoAmt = () => {
      const l = num(q('inv-lit').value), r = num(q('inv-rate').value);
      if (l > 0 && r > 0) q('inv-amt').value = r2(l * r);
    };
    q('inv-lit').oninput = autoAmt;
    q('inv-rate').oninput = autoAmt;
    if (q('inv-trfill')) {
      q('inv-trfill').onclick = () => {
        const date = q('inv-date').value;
        const fuel = q('inv-fuel').value;
        const reports = tankerReports.filter(r => r.date === date);
        if (!reports.length) return toast('इस तारीख की कोई टैंकर रिपोर्ट नहीं');
        const rec = reports[0].received && reports[0].received[fuel === 'petrol' ? 'p' : 'd'];
        if (rec) { q('inv-lit').value = rec; autoAmt(); toast('लीटर भर गया ✔'); }
        else toast('इस तारीख की रिपोर्ट में डेटा नहीं');
      };
    }
    q('inv-cancel').onclick = () => m.close();
    q('inv-save').onclick = async () => {
      const date = q('inv-date').value;
      const supplier = q('inv-sup').value;
      const fuelType = q('inv-fuel').value;
      const litres = num(q('inv-lit').value);
      const purchaseRate = num(q('inv-rate').value);
      const amount = num(q('inv-amt').value) || r2(litres * purchaseRate);
      if (!date) return toast('तारीख चुनें');
      if (!(litres > 0)) return toast('लीटर भरें');
      if (!(purchaseRate > 0)) return toast('खरीद रेट भरें');
      const data = {
        date, supplier, fuelType, litres, purchaseRate, amount,
        tankerNo: q('inv-tanker').value.trim().toUpperCase(),
        invoiceNo: q('inv-no').value.trim(),
        updatedAt: APP.FV.serverTimestamp(),
        createdBy: S.user ? S.user.email : 'Manager'
      };
      try {
        if (e) await db().collection('tanker_invoices').doc(e.id).update(data);
        else { data.createdAt = APP.FV.serverTimestamp(); await db().collection('tanker_invoices').add(data); }
        APP.audit('invoice_' + (e ? 'edit' : 'add'), data);
        m.close(); toast('सेव हो गया ✔');
        APP.views.invoices();
      } catch (err) { toast('सेव नहीं हुआ: ' + err.message); }
    };
    if (e) {
      q('inv-del').onclick = async () => {
        if (!confirm('यह बिल हटाएं?')) return;
        try {
          await db().collection('tanker_invoices').doc(e.id).delete();
          APP.audit('invoice_delete', { id: e.id, date: e.date });
          m.close(); toast('हट गया ✔'); APP.views.invoices();
        } catch (err) { toast('नहीं हटा: ' + err.message); }
      };
    }
  }

  /* ============ Monthly report injection ============ */
  const origMonthReport = APP.views.monthreport;
  APP.views.monthreport = async function (ym) {
    if (origMonthReport) await origMonthReport.apply(this, arguments);
    const main = $('#main'); if (!main) return;
    if (S.tab !== 'monthreport') return;
    const ymsg = (typeof ym === 'string' && /^\d{4}-\d{2}$/.test(ym)) ? ym : (document.querySelector('#mr-m') ? document.querySelector('#mr-m').value : today().slice(0, 7));
    const md = await getMonthlyMargin(ymsg);
    if (!md || !md.days.length) return;
    const t = md.totals;
    let html = '<h3 style="color:#166534;margin-top:0">💰 अनुमानित मार्जिन (खरीद बिल से)</h3>';
    html += '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<div style="flex:1;background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:8px;text-align:center"><div class="mut" style="font-size:11px">पेट्रोल मार्जिन</div><div style="font-size:17px;font-weight:700;color:#166534">' + money(t.petrolMargin) + '</div><div class="mut" style="font-size:11px">' + lit(t.petrolLitres) + '</div></div>' +
      '<div style="flex:1;background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:8px;text-align:center"><div class="mut" style="font-size:11px">डीज़ल मार्जिन</div><div style="font-size:17px;font-weight:700;color:#166534">' + money(t.dieselMargin) + '</div><div class="mut" style="font-size:11px">' + lit(t.dieselLitres) + '</div></div></div>';
    html += '<div class="kv"><span>कुल मार्जिन (महीने का)</span><b class="pos" style="font-size:18px">' + money(t.totalMargin) + '</b></div>';
    html += '<div class="kv"><span>मार्जिन दर</span><b>' + r2(t.pct) + '%</b></div>';
    html += '<div class="mut" style="font-size:11px;margin-top:6px">* खरीद बिल के रेट से · जिन दिनों का बिल नहीं, वहाँ day_costs का खरीद रेट इस्तेमाल हुआ है</div>';
    const marginCard = document.createElement('div');
    marginCard.className = 'card';
    marginCard.style.cssText = 'border-left:4px solid #16a34a;background:linear-gradient(180deg,#f0fdf4,#fff)';
    marginCard.innerHTML = html;
    const backBtns = main.querySelector('.btns');
    if (backBtns) main.insertBefore(marginCard, backBtns); else main.appendChild(marginCard);
  };

  /* ============ More menu button ============ */
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer() || S.role === 'salesman') return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#invoices-more-btn')) return;
    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btn = document.createElement('button');
      btn.id = 'invoices-more-btn'; btn.className = 'btn w'; btn.innerHTML = '📄 खरीद बिल (मार्जिन)';
      btn.onclick = () => APP.go('invoices');
      btns.insertBefore(btn, btns.firstChild);
    }
  };

  console.log('[Mazda margins.js] loaded ✓');
})();
