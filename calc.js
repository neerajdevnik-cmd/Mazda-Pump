/* गणितीय गणना व हिसाब इंजन */
(function () {
  'use strict';
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2 = n => Math.round((num(n) + Number.EPSILON) * 100) / 100;
  const has = v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  const isOpening = r => !!r && (r.opening === true || (/Opening Balance/i.test(String(r.note || '')) && !num(r.litre)));
  const NZ = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
  const activeNz = () => { const a = (window.CFG || {}).activeNozzles; return (Array.isArray(a) && a.length) ? NZ.filter(k => a.includes(k)) : NZ.slice(); };

  /* ---------- खर्चा: अलग-अलग चीज़ों की लिस्ट ---------- */
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
  function khSummary(days, withMalik) {
    const m = {};
    (days || []).forEach(d => {
      khList(d).forEach(x => { const k = x.label.toLowerCase(); (m[k] = m[k] || { label: x.label, amount: 0 }).amount += x.amount; });
      if (withMalik && num(d.malikDiya)) { const k = 'मालिक को दिया (sbi जमा)'; (m[k] = m[k] || { label: 'मालिक को दिया (SBI जमा)', amount: 0 }).amount += num(d.malikDiya); }
    });
    return Object.keys(m).map(k => ({ label: m[k].label, amount: r2(m[k].amount) })).sort((a, b) => b.amount - a.amount);
  }

  function compute(d, rows) {
    rows = (rows || []).filter(r => !isOpening(r));
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

    let jCash = 0, jPaytm = 0, jSwipe = 0, jBank = 0, udhar = 0;
    rows.forEach(r => {
      const a = num(r.amount);
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
    const malikDiya = num(d.malikDiya);

    const close = r2(kul - paytm - swipe - udhar - totalKharcha - malikDiya);

    const openStockP = num(d.openStockP), openStockD = num(d.openStockD);
    const tankerP = num(d.tankerP), tankerD = num(d.tankerD);
    
    // New Stock Calculation Logic (Opening + Tanker - Sale = Expected)
    const expStockP = r2(openStockP + tankerP - litP);
    const expStockD = r2(openStockD + tankerD - litD);
    
    // Actual Stock from Dip Chart
    let actStockP = null, actStockD = null;
    if (window.DipChart) {
       if (has(d.dipP)) actStockP = r2(window.DipChart.getLiters('petrol', d.dipP));
       if (has(d.dipD)) actStockD = r2(window.DipChart.getLiters('diesel', d.dipD));
    }
    
    // Variation
    const diffP = (actStockP !== null && expStockP !== null) ? r2(actStockP - expStockP) : null;
    const diffD = (actStockD !== null && expStockD !== null) ? r2(actStockD - expStockD) : null;

    return {
      filled, nz, litP, litD, amtP, amtD, sale,
      jCash, jPaytm, jSwipe, jBank, udhar,
      totalKharcha, kul, close,
      expStockP, expStockD, actStockP, actStockD, diffP, diffD, warn
    };
  }

  function stmt(rows, from, to) {
    rows = (rows || []).slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    let open = 0;
    const inRange = [];
    rows.forEach(r => {
      const d = r.date;
      if (from && d < from) {
        if (r.kind === 'udhar') open += num(r.amount);
        else if (r.kind === 'jama') open -= num(r.amount);
      } else if (!to || d <= to) {
        inRange.push(r);
      }
    });

    let run = open, totU = 0, totJ = 0;
    const out = inRange.map(r => {
      const a = num(r.amount);
      if (r.kind === 'udhar') { run += a; totU += a; }
      else if (r.kind === 'jama') { run -= a; totJ += a; }
      return Object.assign({}, r, { run: r2(run) });
    });

    return { open: r2(open), rows: out, totU: r2(totU), totJ: r2(totJ), close: r2(run) };
  }

  function signed(e) {
    const a = num(e.amount);
    return e.kind === 'udhar' ? a : -a;
  }

  /* ---------- हिसाब जमा करने से पहले जाँच ---------- */
  function validate(d, rows, ctx) {
    ctx = ctx || {};
    const errors = [], warns = [];
    const o = compute(d, rows);
    activeNz().forEach(k => {
      const n = (d.nz && d.nz[k]) || {}, L = k.toUpperCase();
      if (!has(n.o)) errors.push(L + ': ओपनिंग नहीं है (कल की क्लोज़िंग खाली थी?)');
      else if (!has(n.c)) errors.push(L + ': क्लोज़िंग नहीं भरी — नोज़ल बंद रहा तो ओपनिंग जितनी ही लिखें');
      else if (!o.nz[k].ok) errors.push(L + ': क्लोज़िंग (' + num(n.c) + ') ओपनिंग (' + num(n.o) + ') से कम है');
    });
    if (!(num(d.rateP) > 0) || !(num(d.rateD) > 0)) errors.push('पेट्रोल / डीज़ल का रेट भरें');
    [['P', 'petrol', 'पेट्रोल'], ['D', 'diesel', 'डीज़ल']].forEach(x => {
      const dip = d['dip' + x[0]];
      if (!has(dip) || !(num(dip) > 0)) { errors.push(x[2] + ' की डिप नहीं डाली — स्टॉक का मिलान डिप से ही होता है'); return; }
      const mx = window.DipChart && window.DipChart.maxDip ? window.DipChart.maxDip(x[1]) : 0;
      if (mx && num(dip) > mx) errors.push(x[2] + ' डिप ' + num(dip) + ' चार्ट की सीमा (' + mx + ') से ज़्यादा है — दोबारा देखें');
    });
    const tol = num((window.CFG || {}).stockTolerance) || 25;
    [['P', 'पेट्रोल'], ['D', 'डीज़ल']].forEach(x => {
      const df = o['diff' + x[0]];
      if (df !== null && Math.abs(df) > tol) warns.push(x[1] + ' स्टॉक में फर्क ' + (df > 0 ? '+' : '') + r2(df) + ' L (सीमा ' + tol + ' L)');
    });
    if (o.close < 0) warns.push('आज का बचा कैश माइनस है: ' + o.close);
    if (!has(d.physicalCash)) warns.push('दराज़ का असली नकद गिनकर नहीं डाला');
    else { const df = r2(num(d.physicalCash) - o.close); if (Math.abs(df) >= 1) warns.push('असली नकद और हिसाब में ' + (df > 0 ? 'ज़्यादा' : 'कम') + ' ₹' + Math.abs(df)); }
    if (ctx.prevPending) (ctx.isOwner ? warns : errors).push('पिछला दिन (' + ctx.prevPending + ') अभी जमा नहीं हुआ — पहले उसे जमा करें');
    if (ctx.gap > 0) warns.push(ctx.prevDate + ' के बाद ' + ctx.gap + ' दिन का हिसाब नहीं बना');
    return { errors, warns, o };
  }

  window.Calc = { activeNz, validate, isOpening, num, r2, has, NZ, compute, stmt, signed, KH, khList, khTotal, khSummary };
})();
