/* गणितीय गणना व हिसाब इंजन (Mazda V2: Bank-as-Party Architecture + Auto SBI/PNB Sync + Chain Engine) */
(function () {
  'use strict';
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2 = n => Math.round((num(n) + Number.EPSILON) * 100) / 100;
  const has = v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  const isOpening = r => !!r && (r.opening === true || (/Opening Balance/i.test(String(r.note || '')) && !num(r.litre)));
  const NZ = []; ['p', 'd'].forEach(pre => { for (let i = 1; i <= 20; i++) NZ.push(pre + i); });  /* हर तरफ़ 20 तक; कौन से चालू हैं वो पंप की सेटिंग (activeNozzles) तय करती है */
  const activeNz = () => { const a = (window.CFG || {}).activeNozzles; return (Array.isArray(a) && a.length) ? NZ.filter(k => a.includes(k)) : NZ.slice(); };

  const nzGroup = pre => activeNz().filter(k => k.charAt(0) === pre);

  const BANK_IDS = ['bank_sbi', 'bank_pnb'];
  const isBankParty = p => !!p && (p.isBank === true || BANK_IDS.includes(p.id) || /state bank of india|punjab national bank/i.test(String(p.name || p.partyName || '')));

  const KH = { kharcha: 'DG (जनरेटर)', driverInaam: 'ड्राइवर इनाम', chaiKhana: 'चाय-खाना' };
  const KH_NONAME = 'अन्य (नाम नहीं लिखा)';
  function khList(d) {
    d = d || {};
    const out = [];
    Object.keys(KH).forEach(k => { const a = r2(d[k]); if (a) out.push({ key: k, label: KH[k], amount: a }); });
    (Array.isArray(d.kharchaItems) ? d.kharchaItems : []).forEach((x, i) => {
      const a = r2(x && x.amount);
      if (a) out.push({ key: 'item', idx: i, label: String((x && x.label) || '').trim() || KH_NONAME, amount: a });
    });
    return out;
  }
  const khTotal = d => r2(khList(d).reduce((a, x) => a + x.amount, 0));
  function khSummary(days) {
    const m = {};
    (days || []).forEach(d => {
      khList(d).forEach(x => { const k = x.label.toLowerCase(); (m[k] = m[k] || { label: x.label, amount: 0 }).amount += x.amount; });
    });
    return Object.keys(m).map(k => ({ label: m[k].label, amount: r2(m[k].amount) })).sort((a, b) => b.amount - a.amount);
  }

  function compute(d, rows) {
    rows = (rows || []).filter(r => !isOpening(r) && !r.autoBankSync && !r.directBankJama);
    const t = has(d.testing) ? num(d.testing) : 5;
    const rateP = num(d.rateP), rateD = num(d.rateD);
    const nz = {};
    let filled = 0, litP = 0, litD = 0;
    const warn = [];

    const act = activeNz();
    NZ.forEach(k => {
      const n = (d.nz && d.nz[k]) || {};
      const hasO = has(n.o), hasC = has(n.c);
      if (hasO && hasC) {
        if (act.includes(k)) filled++;
        const o = num(n.o), c = num(n.c);
        const MM = num((window.CFG || {}).meterMax) || 10000000;
        const roll = c < o && o >= MM * 0.9 && c <= MM * 0.1;
        if (c < o && !roll) {
          warn.push(`${k.toUpperCase()}: क्लोजिंग (${c}) ओपनिंग (${o}) से कम है!`);
          nz[k] = { ok: false, net: 0 };
        } else {
          const gross = roll ? r2(MM - o + c) : r2(c - o);
          const net = r2(Math.max(0, gross - t));
          nz[k] = { ok: true, gross, net };
          if (k.startsWith('p')) litP += net;
          else litD += net;
        }
      } else {
        nz[k] = { ok: false, net: 0 };
      }
    });

    litP = r2(litP); litD = r2(litD);
    const amtP = r2(litP * rateP);
    const amtD = r2(litD * rateD);
    const sale = r2(amtP + amtD);

    let jCash = 0, jPaytm = 0, jSwipe = 0, jBank = 0, udhar = 0, bankCashDeposit = 0;
    rows.forEach(r => {
      const a = num(r.amount);
      if (r.pumpCashDeposit || (isBankParty({ id: r.partyId, name: r.partyName }) && r.kind === 'jama' && r.mode === 'pump_cash')) {
        bankCashDeposit += a;
        return;
      }
      if (isBankParty({ id: r.partyId, name: r.partyName })) return;

      if (r.kind === 'jama') {
        if (r.mode === 'cash') jCash += a;
        else if (r.mode === 'paytm') jPaytm += a;
        else if (r.mode === 'swipe') jSwipe += a;
        else if (r.mode === 'bank') jBank += a;
      } else if (r.kind === 'udhar') {
        udhar += a;
      }
    });

    const openCash = num(d.openCash);
    const kul = r2(sale + openCash + jCash + jPaytm + jSwipe);
    const paytm = num(d.paytm);
    const swipe = num(d.swipe);
    const totalKharcha = khTotal(d);
    const bankOut = r2(num(d.malikDiya) + bankCashDeposit);

    const close = r2(kul - paytm - swipe - udhar - totalKharcha - bankOut);

    const openStockP = num(d.openStockP), openStockD = num(d.openStockD);
    const tankerP = num(d.tankerP), tankerD = num(d.tankerD);

    const expStockP = r2(openStockP + tankerP - litP);
    const expStockD = r2(openStockD + tankerD - litD);

    let actStockP = null, actStockD = null;
    if (window.DipChart) {
      const DC = window.DipChart;   // एक से ज़्यादा टैंक हों तो सबकी डिप का जोड़; कोई डिप खाली हो या चार्ट न हो तो null
      actStockP = DC.totalLiters ? DC.totalLiters('petrol', d) : null;
      actStockD = DC.totalLiters ? DC.totalLiters('diesel', d) : null;
      if (actStockP !== null) actStockP = r2(actStockP);
      if (actStockD !== null) actStockD = r2(actStockD);
    }

    const diffP = (actStockP !== null && expStockP !== null) ? r2(actStockP - expStockP) : null;
    const diffD = (actStockD !== null && expStockD !== null) ? r2(actStockD - expStockD) : null;

    return {
      filled, nz, litP, litD, amtP, amtD, sale,
      jCash, jPaytm, jSwipe, jBank, udhar, bankCashDeposit: bankOut,
      totalKharcha, kul, close,
      expStockP, expStockD, actStockP, actStockD, diffP, diffD, warn
    };
  }

  function stmt(rows, from, to) {
    rows = (rows || []).slice().sort((a, b) => {
      const da = String(a.date || ''), db = String(b.date || '');
      if (da !== db) return da.localeCompare(db);
      const oa = isOpening(a) ? 0 : 1, ob = isOpening(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
    let open = 0, dr = 0, cr = 0, run = 0;
    const out = [];
    rows.forEach(r => {
      const s = signed(r);
      if (from && r.date < from) { open = r2(open + s); run = open; return; }
      if (to && r.date > to) return;
      run = r2(run + s);
      if (r.kind === 'udhar') dr = r2(dr + num(r.amount));
      else cr = r2(cr + num(r.amount));
      out.push(Object.assign({}, r, { run }));
    });
    return { open, dr, cr, close: run, rows: out };
  }

  function validate(d, rows, opts) {
    opts = opts || {};
    const c = compute(d, rows);
    const errors = [], warns = [];
    if (c.filled < activeNz().length) errors.push(`सभी ${activeNz().length} नोज़ल की ओपनिंग और क्लोज़िंग भरें (${c.filled} भरे हैं)`);
    c.warn.forEach(w => errors.push(w));
    if (!(num(d.rateP) > 0) || !(num(d.rateD) > 0)) errors.push('पेट्रोल और डीज़ल दोनों का रेट भरें');
    if (!has(d.dipP) || !has(d.dipD)) warns.push('पेट्रोल या डीज़ल की आज की डिप नहीं भरी है');
    if (opts.prevPending) warns.push(`कल (${opts.prevPending}) का हिसाब अभी लॉक नहीं है`);
    if (opts.gap > 0) warns.push(`${opts.prevDate} के बाद ${opts.gap} दिन का हिसाब छूटा हुआ है`);
    return { errors, warns };
  }

  const signed = e => !e ? 0 : (e.kind === 'udhar' ? r2(num(e.amount)) : -r2(num(e.amount)));

  window.Calc = {
    num, r2, has, isOpening, NZ, activeNz, nzGroup,
    KH, khList, khTotal, khSummary,
    compute, stmt, validate, signed,
    BANK_IDS, isBankParty
  };
})();
