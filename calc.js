/* Hisab ka saara calculation yahan hai (UI se alag, taaki test ho sake) */
(function (root) {
  const NZ = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const has = v => v !== '' && v != null && !isNaN(parseFloat(v));

  // party ledger: udhar = +, jama = -   (balance + => baaki lena, - => advance)
  const signed = e => (e.kind === 'udhar' ? num(e.amount) : -num(e.amount));

  function compute(d, rows) {
    d = d || {};
    rows = (rows || []).filter(r => !r.opening);
    const t = has(d.testing) ? num(d.testing) : 5;
    const o = { nz: {}, litP: 0, litD: 0, warn: [], filled: 0 };
    NZ.forEach(k => {
      const n = (d.nz && d.nz[k]) || {};
      const ok = has(n.o) && has(n.c);
      const gross = ok ? r2(num(n.c) - num(n.o)) : 0;
      const net = ok ? r2(gross - t) : 0;
      if (ok) o.filled++;
      if (ok && gross < 0) o.warn.push(k.toUpperCase() + ': क्लोज़िंग रीडिंग ओपनिंग से कम है');
      else if (ok && net < 0) o.warn.push(k.toUpperCase() + ': बिक्री टेस्टिंग (' + t + ' L) से कम है');
      o.nz[k] = { ok, gross, net };
      if (k[0] === 'p') o.litP += net; else o.litD += net;
    });
    o.litP = r2(o.litP); o.litD = r2(o.litD);
    o.amtP = r2(o.litP * num(d.rateP));
    o.amtD = r2(o.litD * num(d.rateD));
    o.sale = r2(o.amtP + o.amtD);

    o.udhar = 0; o.jCash = 0; o.jPaytm = 0; o.jSwipe = 0; o.jBank = 0;
    rows.forEach(r => {
      const a = num(r.amount);
      if (r.kind === 'udhar') o.udhar += a;
      else if (r.mode === 'paytm') o.jPaytm += a;
      else if (r.mode === 'swipe') o.jSwipe += a;
      else if (r.mode === 'bank') o.jBank += a;
      else o.jCash += a;
    });
    ['udhar', 'jCash', 'jPaytm', 'jSwipe', 'jBank'].forEach(k => (o[k] = r2(o[k])));

    // Extra expenses: driver inaam & chai-khana
    o.driverInaam = num(d.driverInaam || 0);
    o.chaiKhana = num(d.chaiKhana || 0);
    o.genKharcha = num(d.kharcha || 0);
    o.totalKharcha = r2(o.genKharcha + o.driverInaam + o.chaiKhana);

    // kul = pichla cash + bikri + party se aaya cash/paytm/swipe
    o.kul = r2(num(d.openCash) + o.sale + o.jCash + o.jPaytm + o.jSwipe);
    // ghatao = paytm(kul) + swipe(kul) + udhar + total kharcha + malik ko diya
    o.ghatao = r2(num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya));
    o.close = r2(o.kul - o.ghatao);

    // stock (litre)
    o.stockCloseP = r2(num(d.openStockP) + num(d.tankerP) - o.litP);
    o.stockCloseD = r2(num(d.openStockD) + num(d.tankerD) - o.litD);
    o.diffP = has(d.dipP) ? r2(num(d.dipP) - o.stockCloseP) : null;
    o.diffD = has(d.dipD) ? r2(num(d.dipD) - o.stockCloseD) : null;
    return o;
  }

  // statement: from/to 'YYYY-MM-DD' (null = poora)
  function stmt(entries, from, to) {
    const all = entries.filter(e => !e.deleted).slice().sort((a, b) =>
      (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    let open = 0;
    const rows = [];
    all.forEach(e => { if (from && e.date < from) open += signed(e); });
    let run = open, totU = 0, totJ = 0;
    all.forEach(e => {
      if (from && e.date < from) return;
      if (to && e.date > to) return;
      const s = signed(e);
      run += s;
      if (s > 0) totU += s; else totJ += -s;
      rows.push(Object.assign({}, e, { run: r2(run) }));
    });
    return { open: r2(open), rows, totU: r2(totU), totJ: r2(totJ), close: r2(run) };
  }

  root.Calc = { NZ, num, r2, has, compute, signed, stmt };
  if (typeof module !== 'undefined') module.exports = root.Calc;
})(typeof window !== 'undefined' ? window : globalThis);
