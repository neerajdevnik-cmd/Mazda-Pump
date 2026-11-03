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
      vehicles: (p.vehicles || []).slice(), bal: 0, fixedLitre: p.fixedLitre || 0
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
    let nextTanker = 2, lastT = -10;                                        // tanker ka agla din (random gap 2-5 din)
    const bulk = parties.find(p => p.fixedLitre) || null;   // pickup party (jaise 800 L wali gaadi)
    const dipOf = (type, liters) => {                          // app ke dip chart se ulta dip nikalo
      const DC = root.DipChart; if (!DC || !(liters > 0)) return null;
      let lo = 0, hi = DC.maxDip(type);
      if (DC.getLiters(type, hi) < liters) return null;
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (DC.getLiters(type, mid) < liters) lo = mid; else hi = mid; }
      return Math.round(hi * 100) / 100;
    };

    // Pehle ka din (start se ek din pehle): opening = closing = meter, sale 0, testing 0
    const KEYS = ['p1','p2','p3','p4','d1','d2','d3','d4'];
    if (opts.meters) {
      const prevD = parseD(dates[0]); prevD.setDate(prevD.getDate() - 1);
      const prev = fmt(prevD);
      // stock ko dip-chart ke liters par snap karo (app dip se hi stock padhta hai)
      const roundK = n => Math.round(n / 1000) * 1000;
      let cashPre = 0;
      const jamaModes = ['cash', 'neft', 'cheque'];
      parties.forEach((p, idx) => {
        const od = roundK(rInt(150000, 300000));                 // pichla baaki (opening)
        ledger.push({ partyId: p.id, partyName: p.name, date: prev, time: '09:00', kind: 'udhar', opening: true, note: 'Opening Balance', amount: od, createdOn: prev, by: 'demo' });
        partyBal[p.id] = r2(partyBal[p.id] + od);
        const amt = roundK(rInt(50000, 100000));                 // is din ka jama
        const mode = jamaModes[idx % 3];
        partyBal[p.id] = r2(partyBal[p.id] - amt);
        if (mode === 'cash') {
          cashPre = r2(cashPre + amt);
          ledger.push({ partyId: p.id, partyName: p.name, date: prev, time: '11:00', kind: 'jama', mode: 'cash', amount: amt, note: 'नकद जमा (पंप पर)', createdOn: prev, by: 'demo' });
        } else {
          const payMode = mode === 'neft' ? 'NEFT' : 'Cheque';
          const bankRef = mode === 'cheque' ? 'CHQ-' + rInt(100000, 999999) : '';
          const payId = 'PAY-' + prev.replace(/-/g, '').slice(2) + '-' + idx + (mode === 'neft' ? 'N' : 'C');
          // party ka row (app ke "सीधे बैंक में जमा" jaisa) + bank ka mirror row
          ledger.push({ partyId: p.id, partyName: p.name, date: prev, time: '12:00', kind: 'jama', mode: 'bank', directBankJama: true, bankTarget: 'bank_sbi', bankTargetName: 'State Bank of India', payMode, bankRef, payId, amount: amt, note: `बैंक में जमा (SBI · ${payMode}${bankRef ? ' · ' + bankRef : ''}) · कोड: ${payId}`, createdOn: prev, by: 'demo' });
          ledger.push({ partyId: 'bank_sbi', partyName: 'State Bank of India', date: prev, time: '12:00', kind: 'jama', mode: 'bank', payMode, bankRef, payId, linkedPartyId: p.id, linkedPartyName: p.name, directBankJama: true, autoBankSync: true, hisabVerified: true, amount: amt, note: `पार्टी जमा: ${p.name} · ${payMode}${bankRef ? ' (' + bankRef + ')' : ''} · कोड: ${payId}`, createdOn: prev, by: 'demo' });
        }
      });
      cash = cashPre;                                            // 1 Aug ki opening cash = 31 July ka cash
      const pdP = dipOf('petrol', stockP), pdD = dipOf('diesel', stockD);
      if (pdP !== null) stockP = r2(root.DipChart.getLiters('petrol', pdP));
      if (pdD !== null) stockD = r2(root.DipChart.getLiters('diesel', pdD));
      days.push({
        dipP: pdP, dipD: pdD,
        _id: prev, date: prev, status: 'submitted', testing: 0, rateP: R.rateP, rateD: R.rateD,
        openCash: 0, paytm: 0, swipe: 0, kharcha: 0, chaiKhana: 0, driverInaam: 0,
        malikDiya: 0, sbiTopup: 0, pnbTopup: 0, openStockP: stockP, openStockD: stockD, tankerP: 0, tankerD: 0,
        nz: Object.fromEntries(KEYS.map(k => [k, { o: M[k], c: M[k], t: 0 }])),
        sum: { sale: 0, litP: 0, litD: 0, close: cashPre, openCash: 0, actStockP: stockP, actStockD: stockD,
          expStockP: stockP, expStockD: stockD, diffP: 0, diffD: 0, udhar: 0, totalKharcha: 0, jCash: 0,
          amtP: 0, amtD: 0, jCash: cashPre, sbiBal: sbi, pnbBal: pnb },
        by: "demo"
      });
    }

    dates.forEach((dt, i) => {
      const sale = {}, nz = {};
      const pickup = !!bulk && i % 3 === 1;                   // har 3rd din bulk pickup; us din diesel sale thoda zyada
      ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'].forEach(k => {
        sale[k] = vary(R.avg[k]);
        if (pickup && k[0] === 'd') sale[k] = Math.round(sale[k] * 1.05);
        const o = M[k], c = o + sale[k] + R.testing;
        M[k] = c; nz[k] = { o, c, t: R.testing };
      });
      const litP = sale.p1 + sale.p2 + sale.p3 + sale.p4;
      const litD = sale.d1 + sale.d2 + sale.d3 + sale.d4;
      if (litP > R.capP || litD > R.capD) throw new Error('Cap cross: ' + litP + ' / ' + litD);

      const openStockP = stockP, openStockD = stockD;
      // Tanker: ek tanker = 12000 L (3 x 4000 ya 4 x 3000 chamber). Dono configs mein se wo chuno jo
      // petrol aur diesel ki need se sabse kareeb ho. Gap random 2-5 din.
      const low = (openStockD - litD) < 4500 || (openStockP - litP) < 2500;   // stock kam: min 2 din baad tanker
      const gap = i - lastT, totLeft = (openStockP - litP) + (openStockD - litD);
      // gap 2-5 din; scheduled din par stock bahut bhara ho to 1 din ruk jaata hai (5 din se zyada nahi)
      const tanker = gap >= 2 && (low || (i >= nextTanker && totLeft <= 14000) || gap >= 5);
      let tP = 0, tD = 0;
      if (tanker) {
        const pNeed = rInt(8000, 10000) - (openStockP - litP);
        const dNeed = rInt(12000, 15000) - (openStockD - litD);
        let best = null;
        [{ n: 3, size: 4000 }, { n: 4, size: 3000 }].forEach(cfg => {
          for (let cd = 0; cd <= cfg.n; cd++) {               // cd = diesel ke chambers
            const dq = cd * cfg.size, pq = (cfg.n - cd) * cfg.size;
            const after = (openStockP - litP + pq) > 12500 || (openStockD - litD + dq) > 19000;   // dip chart ki limit ke andar
            const score = Math.abs(dNeed - dq) + Math.abs(pNeed - pq) + (after ? 1e6 : 0);
            if (!best || score < best.score) best = { score, dq, pq };
          }
        });
        tD = best.dq; tP = best.pq;
        nextTanker = i + rInt(2, 5); lastT = i;
      }
      const expP = r2(openStockP + tP - litP), expD = r2(openStockD + tD - litD);
      const diffP = rInt(-R.stockDiffMax, R.stockDiffMax), diffD = rInt(-R.stockDiffMax, R.stockDiffMax);
      // Dip chart ke andar ho to dip ke liters; chart se bahar ho to dip nahi banta -> actual = expected (koi farak nahi)
      const snap = (type, l, exp) => { const dp = dipOf(type, l); return dp === null ? exp : r2(root.DipChart.getLiters(type, dp)); };
      const actP = snap('petrol', r2(expP + diffP), expP), actD = snap('diesel', r2(expD + diffD), expD);
      stockP = actP; stockD = actD;

      const amtP = r2(litP * R.rateP), amtD = r2(litD * R.rateD);
      const saleAmt = r2(amtP + amtD);

      let udhar = 0;
      const nU = rInt(2, 5);
      const entries = [];
      if (pickup) entries.push({ p: bulk, veh: bulk.vehicles[0], litre: bulk.fixedLitre });
      for (let u = 0; u < nU; u++) {
        const p = parties[(i * 3 + u) % parties.length];
        if (p.fixedLitre) continue;                             // bulk party sirf pickup din aati hai
        entries.push({ p, veh: p.vehicles[(i + u) % p.vehicles.length], litre: r2(rInt(40, 140) + rInt(0, 99) / 100) });
      }
      entries.forEach(({ p, veh, litre }) => {
        const amount = r2(litre * R.rateD);
        udhar = r2(udhar + amount);
        partyBal[p.id] = r2(partyBal[p.id] + amount);
        ledger.push({ partyId: p.id, partyName: p.name, date: dt, time: `1${rInt(0, 9)}:${pad(rInt(5, 55))}`, kind: 'udhar', vehicle: veh, fuel: 'diesel', rate: R.rateD, litre, amount, createdOn: dt, by: 'demo' });
      });

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
      // PNB top-up galla se jata hai: ye ledger mein 'pump cash' jama hai (app ke calc mein bank-out)
      if (pnbTopup) ledger.push({ partyId: 'bank_pnb', partyName: 'Punjab National Bank', date: dt, time: '18:40', kind: 'jama', mode: 'pump_cash', pumpCashDeposit: true, hisabVerified: true, payId: 'DEP-' + dt.replace(/-/g, '').slice(2) + '-PNB' + i, amount: pnbTopup, note: 'पंप का नकद कैश बैंक में जमा (गल्ला से) · [DEP-' + dt.replace(/-/g, '').slice(2) + '-PNB' + i + ']', createdOn: dt, by: 'demo' });

      const openCash = r2(cash);
      // App ke calc se bilkul match: close = open + sale + jCash - udhar - paytm - swipe - chai - bankOut(malik + pnb top-up)
      let rem = r2(openCash + saleAmt + jCash - udhar - paytm - swipe - chai - pnbTopup);

      let malik = 0;
      if (rem > R.cashMin) { malik = Math.floor((rem - R.cashKeep) / R.malikBlock) * R.malikBlock; rem = r2(rem - malik); }
      sbi = r2(sbi + paytm + swipe + malik);

      if (tanker) {
        // App ka invoice format: ek fuel = ek bill (margins.js dekhta hai fuelType / litres / purchaseRate / amount)
        const bp = r2(tP * R.buyP), bd = r2(tD * R.buyD);
        if (tP > 0) invoices.push({ _id: 'inv_' + dt + '_p', date: dt, supplier: 'Tanker (Depot)', fuelType: 'petrol', litres: tP, purchaseRate: R.buyP, amount: bp, tankerNo: '', invoiceNo: '', paidFrom: 'SBI', by: 'demo' });
        if (tD > 0) invoices.push({ _id: 'inv_' + dt + '_d', date: dt, supplier: 'Tanker (Depot)', fuelType: 'diesel', litres: tD, purchaseRate: R.buyD, amount: bd, tankerNo: '', invoiceNo: '', paidFrom: 'SBI', by: 'demo' });
        sbi = r2(sbi - bp - bd);
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
        malikDiya: malik, sbiTopup: 0, pnbTopup: 0, openStockP, openStockD, tankerP: tP, tankerD: tD,
        dipP: dipOf('petrol', actP), dipD: dipOf('diesel', actD),
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


/* ===== SUPER ADMIN: bank sync + chain sync button (pehle bank_sync.js mein tha) ===== */
/* =========================================================================
   BANK_SYNC.JS - Super Admin ka panel + SBI / PNB bank sync engine
   (super_admin.js aur super_admin_v2.js ki jagah. Sirf zaroori hisa bacha hai.)
   - Panel: #super-admin-panel (pump_create.js aur demo_3m.js isi me buttons jodte hain)
   - window.syncBankFromDays: hisab (days / tanker / ledger) se SBI & PNB ki entries
     banata hai; demo_core.js isi ko call karta hai.
   - Auto-sync: days / tanker / jama badlne par 3 second baad apne aap sync.
   ========================================================================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;   // sirf browser mein

  const r2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  const num = n => (isNaN(parseFloat(n)) ? 0 : parseFloat(n));

  function isAuthorized() {
    const APP = window.APP || {};
    const email = ((APP.S && APP.S.user && APP.S.user.email) || '').toLowerCase();
    return email.includes('neeraj') || (APP.isTrueOwner && APP.isTrueOwner()) || localStorage.getItem('mazda_owner') === 'yes';
  }

  // =========================================================================
  // 1. BANK SYNC
  // =========================================================================
  let bankSyncing = false;
  const pickAmt = o => num(o.amount ?? o.amt ?? o.rakam ?? o.value ?? o.val ?? 0);
  const pickNote = o => String(o.note ?? o.name ?? o.title ?? o.label ?? o.desc ?? 'और खर्चा');
  function extraExpenses(d) {
    const keys = ['kharchaItems', 'otherExp', 'extraExp', 'extraExpenses', 'aurKharche', 'otherExpenses', 'extras', 'expenses', 'other'];
    for (const k of keys) {
      if (Array.isArray(d[k])) return d[k];
    }
    return [];
  }

  async function syncBankFromDays(opts = {}) {
    if (bankSyncing) return;
    bankSyncing = true;
    const APP = window.APP || {};
    const db = firebase.firestore();
    try {
      if (APP.Rules) APP.Rules.sys = true;
      const [daysSnap, ledSnap, invSnap, sbiDoc, pnbDoc] = await Promise.all([
        db.collection('days').get(),
        db.collection('ledger').get(),
        db.collection('tanker_invoices').get(),
        db.collection('parties').doc('bank_sbi').get(),
        db.collection('parties').doc('bank_pnb').get()
      ]);

      const BANK = {
        sbi: { id: 'bank_sbi', name: 'State Bank of India' },
        pnb: { id: 'bank_pnb', name: 'Punjab National Bank' }
      };
      const want = new Map(); // docId -> entry
      // App ka apna format: bank mai jama = + (hara), udhar = - (laal)
      const add = (id, key, dir, date, time, amount, note, mode = 'bank') => {
        amount = r2(amount);
        if (!(amount > 0) || !date) return;
        want.set(id, {
          partyId: BANK[key].id, partyName: BANK[key].name, date, time,
          kind: dir === 'in' ? 'jama' : 'udhar', mode, amount, note,
          autoBankSync: true, createdOn: date, by: 'bank-sync'
        });
      };

      // A) Daily hisab se
      daysSnap.forEach(doc => {
        const d = doc.data() || {};
        const dt = d.date || doc.id;
        add(`bk_paytm_${dt}`, 'sbi', 'in', dt, '20:00', num(d.paytm), 'Paytm/UPI दैनिक बिक्री जमा', 'paytm');
        add(`bk_swipe_${dt}`, 'sbi', 'in', dt, '20:05', num(d.swipe), 'कार्ड स्वाइप जमा', 'swipe');
        add(`bk_malik_${dt}`, 'sbi', 'in', dt, '18:00', num(d.malikDiya), 'पंप गल्ले से कैश जमा (SBI)', 'cash');
        add(`bk_sbitop_${dt}`, 'sbi', 'in', dt, '18:30', num(d.sbiTopup), 'गल्ले से SBI जमा', 'cash');
        add(`bk_pnbtop_${dt}`, 'pnb', 'in', dt, '18:40', num(d.pnbTopup), 'गल्ले से PNB जमा', 'cash');
        add(`bk_dg_${dt}`, 'pnb', 'out', dt, '19:30', num(d.kharcha), 'खर्चा DG (जनरेटर)', 'kharcha');
        add(`bk_chai_${dt}`, 'pnb', 'out', dt, '19:35', num(d.chaiKhana), 'चाय-खाना', 'kharcha');
        add(`bk_inaam_${dt}`, 'pnb', 'out', dt, '19:40', num(d.driverInaam), 'ड्राइवर इनाम', 'kharcha');
        extraExpenses(d).forEach((x, i) => {
          add(`bk_xp_${dt}_${i}`, 'pnb', 'out', dt, '19:50', pickAmt(x || {}), pickNote(x || {}), 'kharcha');
        });
      });

      // B) Tanker / margin bill -> SBI se katega
      invSnap.forEach(doc => {
        const d = doc.data() || {};
        const from = String(d.paidFrom || d.bank || 'sbi').toLowerCase();
        add(`bk_tinv_${doc.id}`, from.includes('pnb') ? 'pnb' : 'sbi', 'out', d.date || d.invoiceDate,
          '19:00', pickAmt(d), `Tanker/Margin bill${d.litre ? ' (' + d.litre + ' L)' : ''}`, 'tanker');
      });

      // C) App ke apne bank entries ko CHHUA nahi jata; sirf existing map banta hai taaki double na ho.
      const existing = new Map();
      const appBank = [];
      const appKeys = new Set();
      ledSnap.forEach(doc => {
        const d = doc.data() || {};
        if (doc.id.startsWith('bk_')) { existing.set(doc.id, d); return; }
        if (d.partyId === 'bank_sbi' || d.partyId === 'bank_pnb') {
          appBank.push(d);
          appKeys.add(`${d.partyId}|${d.date}|${d.kind}|${r2(num(d.amount))}`);
        }
      });
      // Agar app ne wahi entry (same bank, din, rakam, jama/udhar) pehle hi bana rakhi hai to dobara nahi banate
      for (const [id, e] of [...want]) {
        if (appKeys.has(`${e.partyId}|${e.date}|${e.kind}|${e.amount}`)) want.delete(id);
      }

      // D) Sirf wahi likho jo badla hai
      let b = db.batch(), ops = 0, changed = 0;
      const flush = async () => { if (ops > 0) { await b.commit(); b = db.batch(); ops = 0; } };
      const same = (x, y) => x && y && x.amount === y.amount && x.date === y.date &&
        x.kind === y.kind && x.mode === y.mode && x.partyId === y.partyId && x.note === y.note;
      for (const [id, entry] of want) {
        if (!same(existing.get(id), entry)) { b.set(db.collection('ledger').doc(id), entry); ops++; changed++; }
        if (ops >= 400) await flush();
      }
      for (const [id] of existing) {
        if (!want.has(id)) { b.delete(db.collection('ledger').doc(id)); ops++; changed++; }
        if (ops >= 400) await flush();
      }

      // E) Bank balance = opening + jama(+) - udhar(-)
      const bal = { sbi: num(sbiDoc.data()?.openingBal), pnb: num(pnbDoc.data()?.openingBal) };
      const addBal = e => {
        const k = e.partyId === 'bank_pnb' ? 'pnb' : 'sbi';
        bal[k] += (e.kind === 'jama' ? 1 : e.kind === 'udhar' ? -1 : 0) * num(e.amount);
      };
      appBank.forEach(addBal);
      for (const e of want.values()) addBal(e);
      b.set(db.collection('parties').doc('bank_sbi'), { bal: r2(bal.sbi), currentBal: r2(bal.sbi), isBank: true }, { merge: true }); ops++;
      b.set(db.collection('parties').doc('bank_pnb'), { bal: r2(bal.pnb), currentBal: r2(bal.pnb), isBank: true }, { merge: true }); ops++;
      await flush();

      console.log(`[BankSync] done: ${changed} badlav | SBI ₹${r2(bal.sbi)} | PNB ₹${r2(bal.pnb)}`);
      if (!opts.silent && !opts.auto) {
        alert(`✅ बैंक सिंक पूरा!\n\nबदलाव: ${changed} एंट्री\nSBI बैलेंस: ₹${r2(bal.sbi).toLocaleString('en-IN')}\nPNB बैलेंस: ₹${r2(bal.pnb).toLocaleString('en-IN')}`);
      }
    } catch (e) {
      console.error('[BankSync] error', e);
      if (!opts.auto) alert('❌ बैंक सिंक एरर: ' + e.message);
    } finally {
      bankSyncing = false;
      if (APP.Rules) APP.Rules.sys = false;
    }
  }
  window.syncBankFromDays = syncBankFromDays;

  // Hisab mein koi bhi badlav aate hi apne aap sync
  let autoSyncStarted = false, autoTimer = null;
  function startBankAutoSync() {
    if (autoSyncStarted || typeof firebase === 'undefined' || !firebase.apps?.length) return;
    autoSyncStarted = true;
    const db = firebase.firestore();
    const kick = () => { clearTimeout(autoTimer); autoTimer = setTimeout(() => syncBankFromDays({ auto: true }), 3000); };
    db.collection('days').onSnapshot(kick, () => {});
    db.collection('tanker_invoices').onSnapshot(kick, () => {});
    db.collection('ledger').where('kind', '==', 'jama').onSnapshot(kick, () => {});
  }

  // =========================================================================
  // 1B. ONE-CLICK CHAIN SYNC: shuru se aaj tak har din ki opening (cash, stock, meter)
  //     pichle din ki closing se jodta hai, phir bank (SBI / PNB) sync karta hai.
  // =========================================================================
  async function chainSyncAll() {
    const APP = window.APP || {};
    if (!APP.recalculateAllDaysChain) return alert('❌ चेन सिंक फ़ंक्शन नहीं मिला');
    if (!confirm('🔗 शुरू से आज तक के सभी दिनों की चेन (कैश, स्टॉक, मीटर) और बैंक सिंक होगा।\n\nजारी रखें?')) return;
    const btn = document.querySelector('#btn-chain-sync');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ चेन सिंक हो रही है...'; }
    try {
      await APP.recalculateAllDaysChain();
      await syncBankFromDays({ silent: true });
      alert('✅ सभी दिनों की चेन और बैंक सिंक पूरा हो गया।');
      if (APP.views && APP.views.more) APP.views.more();
    } catch (e) {
      console.error('[BankSync] chain sync error', e);
      alert('❌ चेन सिंक में एरर: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔗 सभी दिनों की चेन एक क्लिक में सिंक करें'; }
    }
  }

  // =========================================================================
  // 2. SUPER ADMIN PANEL (sirf authorized user ko dikhta hai)
  //    pump_create.js (naya pump) aur demo_3m.js (Mazda demo) isi panel mein jude hain
  // =========================================================================
  function injectPanel() {
    const main = document.querySelector('#main') || document.querySelector('#p-content');
    if (!main || document.querySelector('#super-admin-panel')) return;
    const onMore = document.querySelector('nav button[data-tab="more"].active');
    if (!onMore) return;

    const panel = document.createElement('div');
    panel.id = 'super-admin-panel';
    panel.className = 'glass-card';
    panel.style.cssText = 'background:linear-gradient(135deg, #071329, #0a1f3d);border:2px solid #f4b41a;border-radius:16px;padding:16px;margin:16px;color:#fff;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="font-size:24px;">👑</span>
        <div>
          <b style="color:#f4b41a;font-size:16px;">Super Admin</b>
          <div style="font-size:11px;color:#94a3b8;">पंप बनाना, डेमो डेटा, बैंक सिंक</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button id="btn-chain-sync" class="btn" style="grid-column:span 2;background:#0a7d33;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
          🔗 सभी दिनों की चेन एक क्लिक में सिंक करें
        </button>
        <button id="btn-bank-sync" class="btn" style="grid-column:span 2;background:#1d4ed8;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
          🏦 Bank Sync (हिसाब से SBI / PNB एंट्री)
        </button>
      </div>
    `;

    main.insertBefore(panel, main.firstChild);
    document.querySelector('#btn-bank-sync').onclick = () => syncBankFromDays();
    document.querySelector('#btn-chain-sync').onclick = chainSyncAll;
  }

  setInterval(() => {
    if (isAuthorized()) { injectPanel(); startBankAutoSync(); }
  }, 1000);

  console.log('[BankSync] Super Admin panel & bank sync loaded ✓');
})();
