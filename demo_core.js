/* =========================================================================
   DEMO CORE - rules wala 3-mahine ka demo engine (shared)
   Sirf calculation + writer. UI: pump_create.js (naye pump) aur demo_3m.js (Mazda).
   Rules:
   - Petrol roz max 2000 L, Diesel roz max 3000 L
   - Nozzle sale average ke aas-paas (+/-20%), jaise 100 / 120 / 85 / 115
   - Testing roz 5 L fix; meter = pichla closing
   - Rate fix: Petrol 100.23, Diesel 95.68
   - Tanker = 6000 L Petrol + 6000 L Diesel; margin bill Petrol 97.30, Diesel 92.80
   - Roz stock farak +/-20 L (kabhi 40 nahi)
   - Paytm/Swipe average mein; Udhar sirf diesel gaadiyon ka
   ========================================================================= */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;

  const RULES = {
    months: 3,
    rateP: 100.23, rateD: 95.68,
    buyP: 97.30, buyD: 92.80,
    testing: 5,
    tankerL: 6000,
    dieselTrigger: 3000,
    capP: 2000, capD: 3000,
    avg: { p1: 105, p2: 420, p3: 300, p4: 150, d1: 900, d2: 500, d3: 600, d4: 350 },
    spread: 0.20,
    stockDiffMax: 20,
    openP: 8000, openD: 9000,
    openSBI: 500000, openPNB: 50000,
    cashKeep: 150000, cashMin: 450000, malikBlock: 10000,
    meters: { p1: 268000, p2: 170000, p3: 206000, p4: 44500, d1: 300000, d2: 218000, d3: 157000, d4: 78600 }
  };

  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const rInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseD = s => { if (s instanceof Date) return s; const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const todayStr = () => fmt(new Date());

  // startDate se endDate tak (dono included). Default: aaj se 3 mahine pehle ka agla din.
  function dateList(startDate, endDate) {
    const end = parseD(endDate || todayStr());
    const start = startDate ? parseD(startDate) : (() => { const s = new Date(end); s.setMonth(s.getMonth() - RULES.months); s.setDate(s.getDate() + 1); return s; })();
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(fmt(d));
    return out;
  }

  const vary = avg => Math.round(avg * (1 + (Math.random() * 2 - 1) * RULES.spread));

  // Pure logic: DB se koi lena-dena nahi
  function build(opts = {}) {
    const dates = dateList(opts.startDate, opts.endDate);
    const R = { ...RULES, ...(opts.rules || {}) };
    const src = (opts.parties && opts.parties.length) ? opts.parties : [];
    const parties = src.map((p, i) => ({
      id: p.id || ('demo_' + i), name: p.name, phone: p.phone || '',
      vehicles: (p.vehicles || []).slice(), bal: 0
    })).filter(p => p.vehicles.length);
    if (!parties.length) parties.push({ id: 'demo_0', name: 'डेमो पार्टी', phone: '', vehicles: ['DEMO0001'], bal: 0 });

    const days = [], ledger = [], invoices = [];
    const partyBal = {}; parties.forEach(p => partyBal[p.id] = 0);
    const M = { ...R.meters, ...(opts.meters || {}) };
    let stockP = opts.openP ?? R.openP, stockD = opts.openD ?? R.openD;
    let cash = opts.openCash ?? 0;
    let sbi = opts.openSBI ?? R.openSBI, pnb = opts.openPNB ?? R.openPNB;
    const injections = [];
    let jamaRR = 0;

    // Pehle ka din (start se ek din pehle): opening = closing = meter, sale 0, testing 0
    const KEYS = ['p1','p2','p3','p4','d1','d2','d3','d4'];
    if (opts.meters) {
      const prevD = parseD(dates[0]); prevD.setDate(prevD.getDate() - 1);
      const prev = fmt(prevD);
      days.push({
        _id: prev, date: prev, status: 'submitted', testing: 0, rateP: R.rateP, rateD: R.rateD,
        openCash: 0, paytm: 0, swipe: 0, kharcha: 0, chaiKhana: 0, driverInaam: 0,
        malikDiya: 0, sbiTopup: 0, pnbTopup: 0, openStockP: stockP, openStockD: stockD, tankerP: 0, tankerD: 0,
        nz: Object.fromEntries(KEYS.map(k => [k, { o: M[k], c: M[k], t: 0 }])),
        sum: { sale: 0, litP: 0, litD: 0, close: 0, openCash: 0, actStockP: stockP, actStockD: stockD,
          expStockP: stockP, expStockD: stockD, diffP: 0, diffD: 0, udhar: 0, totalKharcha: 0, jCash: 0,
          amtP: 0, amtD: 0, sbiBal: sbi, pnbBal: pnb },
        by: "demo"
      });
    }

    dates.forEach((dt, i) => {
      const sale = {}, nz = {};
      ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'].forEach(k => {
        sale[k] = vary(R.avg[k]);
        const o = M[k], c = o + sale[k] + R.testing;
        M[k] = c; nz[k] = { o, c, t: R.testing };
      });
      const litP = sale.p1 + sale.p2 + sale.p3 + sale.p4;
      const litD = sale.d1 + sale.d2 + sale.d3 + sale.d4;
      if (litP > R.capP || litD > R.capD) throw new Error('Cap cross: ' + litP + ' / ' + litD);

      const openStockP = stockP, openStockD = stockD;
      const tanker = (openStockD - litD) < R.dieselTrigger;
      const tP = tanker ? R.tankerL : 0, tD = tanker ? R.tankerL : 0;
      const expP = r2(openStockP + tP - litP), expD = r2(openStockD + tD - litD);
      const diffP = rInt(-R.stockDiffMax, R.stockDiffMax), diffD = rInt(-R.stockDiffMax, R.stockDiffMax);
      const actP = r2(expP + diffP), actD = r2(expD + diffD);
      stockP = actP; stockD = actD;

      const amtP = r2(litP * R.rateP), amtD = r2(litD * R.rateD);
      const saleAmt = r2(amtP + amtD);

      let udhar = 0;
      const nU = rInt(2, 5);
      for (let u = 0; u < nU; u++) {
        const p = parties[(i * 3 + u) % parties.length];
        const veh = p.vehicles[(i + u) % p.vehicles.length];
        const litre = r2(rInt(40, 140) + rInt(0, 99) / 100);
        const amount = r2(litre * R.rateD);
        udhar = r2(udhar + amount);
        partyBal[p.id] = r2(partyBal[p.id] + amount);
        ledger.push({ partyId: p.id, partyName: p.name, date: dt, time: `1${u}:${pad(rInt(5, 55))}`, kind: 'udhar', vehicle: veh, fuel: 'diesel', rate: R.rateD, litre, amount, createdOn: dt, by: 'demo' });
      }

      const paytm = Math.round(saleAmt * (0.13 + Math.random() * 0.07) / 10) * 10;
      const swipe = Math.round(saleAmt * (0.03 + Math.random() * 0.03) / 10) * 10;

      let jCash = 0;
      if (i % 3 === 0) {
        const p = parties[jamaRR++ % parties.length];
        jCash = Math.round(rInt(20000, 40000) / 1000) * 1000;
        partyBal[p.id] = r2(partyBal[p.id] - jCash);
        ledger.push({ partyId: p.id, partyName: p.name, date: dt, time: '14:30', kind: 'jama', mode: 'cash', amount: jCash, createdOn: dt, by: 'demo' });
      }

      const chai = rInt(150, 250);
      pnb = r2(pnb - chai);
      let pnbTopup = 0;
      if (pnb < 5000) { pnbTopup = 20000; pnb = r2(pnb + pnbTopup); }

      const openCash = r2(cash);
      let rem = r2(openCash + (saleAmt - udhar - paytm - swipe) + jCash - pnbTopup);

      let malik = 0;
      if (rem > R.cashMin) { malik = Math.floor((rem - R.cashKeep) / R.malikBlock) * R.malikBlock; rem = r2(rem - malik); }
      sbi = r2(sbi + paytm + swipe + malik);

      if (tanker) {
        const bill = r2(R.tankerL * R.buyP + R.tankerL * R.buyD);
        invoices.push({ _id: 'inv_' + dt, date: dt, fuel: 'petrol+diesel', litre: R.tankerL * 2, petrolLitre: R.tankerL, dieselLitre: R.tankerL, petrolRate: R.buyP, dieselRate: R.buyD, amount: bill, paidFrom: 'SBI', status: 'paid', by: 'demo' });
        sbi = r2(sbi - bill);
      }
      if (sbi < 50000) {
        const amt = Math.ceil((50000 - sbi) / 100000) * 100000;
        sbi = r2(sbi + amt);
        injections.push({ partyId: 'bank_sbi', partyName: 'State Bank of India', date: dt, time: '10:00', kind: 'jama', mode: 'bank', amount: amt, note: 'मालिक द्वारा बैंक में रकम जमा', createdOn: dt, by: 'demo' });
      }

      cash = rem;
      days.push({
        _id: dt, date: dt, status: 'submitted', testing: R.testing, rateP: R.rateP, rateD: R.rateD,
        openCash, paytm, swipe, kharcha: 0, chaiKhana: chai, driverInaam: 0,
        malikDiya: malik, sbiTopup: 0, pnbTopup, openStockP, openStockD, tankerP: tP, tankerD: tD,
        nz,
        sum: {
          sale: saleAmt, litP, litD, close: cash, openCash,
          actStockP: actP, actStockD: actD, expStockP: expP, expStockD: expD,
          diffP: r2(actP - expP), diffD: r2(actD - expD),
          udhar, totalKharcha: chai, jCash, amtP, amtD, sbiBal: sbi, pnbBal: pnb
        },
        by: 'demo'
      });
    });

    parties.forEach(p => p.bal = partyBal[p.id]);
    return { dates, parties, days, ledger: ledger.concat(injections), invoices, finalSBI: sbi, finalPNB: pnb, meters: M };
  }

  function verify(ds) {
    const errs = [];
    ds.days.forEach(d => {
      const s = d.sum;
      if (s.litP > RULES.capP) errs.push(d.date + ' petrol cap');
      if (s.litD > RULES.capD) errs.push(d.date + ' diesel cap');
      if (Math.abs(s.diffP) >= 40 || Math.abs(s.diffD) >= 40) errs.push(d.date + ' stock diff >= 40');
      if (d.openCash < 0 || s.close < 0) errs.push(d.date + ' negative cash');
      if (s.sbiBal < 0) errs.push(d.date + ' negative SBI');
    });
    return errs;
  }

  root.DEMO_CORE = { RULES, build, verify, dateList };

  /* ---------- Firestore writer (browser) ---------- */
  if (typeof document === 'undefined') return;

  const dbOf = () => (root.APP && root.APP.db) || firebase.firestore();

  async function wipe(col) {
    const snap = await dbOf().collection(col).get();
    let b = dbOf().batch(), n = 0;
    for (const doc of snap.docs) { b.delete(doc.ref); n++; if (n >= 400) { await b.commit(); b = dbOf().batch(); n = 0; } }
    if (n) await b.commit();
  }

  async function writeAll(list, col, idOf) {
    let b = dbOf().batch(), n = 0;
    for (const item of list) {
      const data = { ...item }; const id = idOf(item); delete data._id;
      b.set(dbOf().collection(col).doc(id), data); n++;
      if (n >= 400) { await b.commit(); b = dbOf().batch(); n = 0; }
    }
    if (n) await b.commit();
  }

  // opts: { startDate, endDate, meters, parties, banks:true }  -> active pump mein likhta hai
  async function writeDemo(opts) {
    const ds = build(opts);
    const errs = verify(ds);
    if (errs.length) throw new Error('Rules mein गड़बड़: ' + errs.slice(0, 5).join(', '));
    const APP = root.APP || {};
    try {
      if (APP.Rules) APP.Rules.sys = true;
      for (const c of ['days', 'ledger', 'parties', 'bank_deposits', 'rate_history', 'tanker_invoices', 'tanker_reports', 'runsheets']) await wipe(c);
      await writeAll(ds.parties.map(p => ({ ...p, bal: 0 })), 'parties', p => p.id);
      await writeAll([
        { _id: 'bank_sbi', name: 'State Bank of India', isBank: true, bal: 0, openingBal: opts.openSBI ?? RULES.openSBI, pinned: true },
        { _id: 'bank_pnb', name: 'Punjab National Bank', isBank: true, bal: 0, openingBal: opts.openPNB ?? RULES.openPNB, pinned: true }
      ], 'parties', b => b._id);
      await writeAll(ds.days, 'days', d => d._id);
      await writeAll(ds.invoices, 'tanker_invoices', i => i._id);
      let b = dbOf().batch(), n = 0;
      for (const e of ds.ledger) { b.set(dbOf().collection('ledger').doc(), e); n++; if (n >= 400) { await b.commit(); b = dbOf().batch(); n = 0; } }
      if (n) await b.commit();
      b = dbOf().batch(); n = 0;
      for (const p of ds.parties) { b.update(dbOf().collection('parties').doc(p.id), { bal: p.bal }); n++; }
      if (n) await b.commit();
      if (root.syncBankFromDays) await root.syncBankFromDays({ silent: true });
      return ds;
    } finally {
      if (APP.Rules) APP.Rules.sys = false;
    }
  }
  root.DEMO_CORE.writeDemo = writeDemo;
})();
