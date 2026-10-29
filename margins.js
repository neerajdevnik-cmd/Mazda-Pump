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
          petrolLitres: r2(tot.petrolLitres), dieselLitres: r2(tot.d
