/* गणितीय गणना व हिसाब इंजन */
(function () {
  'use strict';
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const r2 = n => Math.round((num(n) + Number.EPSILON) * 100) / 100;
  const has = v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  const NZ = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];

  function compute(d, rows) {
    rows = rows || [];
    const t = has(d.testing) ? num(d.testing) : 5;
    const rateP = num(d.rateP), rateD = num(d.rateD);
    const nz = {};
    let filled = 0, litP = 0, litD = 0;
    const warn = [];

    NZ.forEach(k => {
      const n = (d.nz && d.nz[k]) || {};
      const hasO = has(n.o), hasC = has(n.c);
      if (hasO && hasC) {
        filled++;
        const o = num(n.o), c = num(n.c);
        if (c < o) {
          warn.push(`${k.toUpperCase()}: क्लोजिंग (${c}) ओपनिंग (${o}) से कम है!`);
          nz[k] = { ok: false, net: 0 };
        } else {
          const gross = r2(c - o);
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
    const kharcha = num(d.kharcha);
    const driverInaam = num(d.driverInaam);
    const chaiKhana = num(d.chaiKhana);
    const totalKharcha = r2(kharcha + driverInaam + chaiKhana);
    const malikDiya = num(d.malikDiya);

    const close = r2(kul - paytm - swipe - udhar - totalKharcha - malikDiya);

    const openStockP = num(d.openStockP), openStockD = num(d.openStockD);
    const tankerP = num(d.tankerP), tankerD = num(d.tankerD);
    const stockCloseP = r2(openStockP + tankerP - litP);
    const stockCloseD = r2(openStockD + tankerD - litD);

    const diffP = has(d.dipP) ? r2(num(d.dipP) - stockCloseP) : null;
    const diffD = has(d.dipD) ? r2(num(d.dipD) - stockCloseD) : null;

    return {
      filled, nz, litP, litD, amtP, amtD, sale,
      jCash, jPaytm, jSwipe, jBank, udhar,
      totalKharcha, kul, close,
      stockCloseP, stockCloseD, diffP, diffD, warn
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

  window.Calc = { num, r2, has, NZ, compute, stmt, signed };
})();
