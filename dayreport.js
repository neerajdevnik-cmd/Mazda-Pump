/* Mazda Oil Company - हर नोज़ल की टेस्टिंग + प्रो दैनिक हिसाब रिपोर्ट (index.html में सबसे आख़िरी script रखें) */
(function () {
  'use strict';
  const APP = window.APP; if (!APP || !APP.K) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, esc = APP.esc, num = APP.num, r2 = APP.r2, money = APP.money, lit = APP.lit, dmy = APP.dmy;

  /* ---------- 1. हर नोज़ल की अलग टेस्टिंग (खाली/बराबर हो तो सब का 5 L ही चलता है) ---------- */
  const orig = K.compute;
  const gT = d => K.has(d.testing) ? num(d.testing) : 5;
  K.compute = function (d, rows) {
    const T = gT(d || {});
    if (d && d.nz && K.NZ.some(k => d.nz[k] && K.has(d.nz[k].t) && Math.abs(num(d.nz[k].t) - T) > 1e-9)) {
      const dd = Object.assign({}, d, { nz: {} });
      K.NZ.forEach(k => {
        const n = Object.assign({}, d.nz[k] || {});
        if (K.has(n.t) && K.has(n.o) && K.has(n.c) && num(n.c) >= num(n.o)) n.c = String(r2(Math.max(num(n.o), num(n.c) + T - num(n.t))));
        dd.nz[k] = n;
      });
      return orig.call(this, dd, rows);
    }
    return orig.call(this, d, rows);
  };

  function inject() {
    const st = S.cur, anchor = $('#nzwarn');
    if (!st || !anchor || !$('#f-testing') || $('#tst-card')) return;
    const g = $('#f-testing').value, dis = st.locked ? 'disabled' : '';
    const box = document.createElement('div'); box.id = 'tst-card'; box.className = 'card';
    box.innerHTML = '<h3>🧪 टेस्टिंग (हर नोज़ल, लीटर)</h3><div class="mut" style="font-size:12px;margin-bottom:6px">सब में अपने-आप ' + esc(g || 5) + ' L है। किसी नोज़ल में ज़्यादा टेस्ट हुआ हो तो सिर्फ़ उसे बदलें।</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + K.activeNz().map(k => {
        const n = (st.d.nz && st.d.nz[k]) || {}, v = K.has(n.t) ? n.t : g, auto = !K.has(n.t) || Math.abs(num(n.t) - num(g)) < 1e-9;
        return '<div><label style="margin:0;font-size:12px;text-align:center;display:block">' + k.toUpperCase() + '</label><input class="nzi" data-k="' + k + '" data-f="t" data-auto="' + (auto ? 1 : 0) + '" inputmode="decimal" value="' + esc(v) + '" style="text-align:center;padding:8px 2px" ' + dis + '></div>';
      }).join('') + '</div>';
    anchor.closest('.card').after(box);
    box.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { i.dataset.auto = 0; APP.recalc(); APP.triggerAutoSave(); }));
    $('#f-testing').addEventListener('input', e => { box.querySelectorAll('input[data-auto="1"]').forEach(i => { i.value = e.target.value; }); APP.recalc(); });
    APP.recalc();
  }
  window.addEventListener('load', () => setTimeout(() => { const m = $('#main'); if (m) new MutationObserver(() => setTimeout(inject, 120)).observe(m, { childList: true }); }, 1300));

  /* ---------- 2. दैनिक हिसाब रिपोर्ट — रजिस्टर के पन्ने जैसी, बड़े अक्षर, एक ही फोटो ---------- */
  const W = 720;                                   /* फोटो की चौड़ाई — फोन की स्क्रीन पर बड़ा दिखे */
  const NAVY = '#0a2f6b', INK = '#111827', MUT = '#4b5563', LINE = '#c9d3e6', RED = '#b91c1c', GRN = '#15803d', AMB = '#b45309';
  const FM = "system-ui,-apple-system,'Noto Sans Devanagari','Segoe UI',sans-serif";
  const fmt = (x, d) => r2(num(x)).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: 2 });
  const pm = x => '₹' + fmt(x, Math.abs(num(x) - Math.round(num(x))) < 0.005 ? 0 : 2);
  const L2 = x => fmt(x, 2) + ' L';
  const box = (inner, extra) => '<div style="border:2px solid ' + LINE + ';border-radius:12px;padding:10px 14px;' + (extra || '') + '">' + inner + '</div>';
  const title = t => '<div style="font-size:22px;font-weight:800;color:' + NAVY + ';margin:18px 0 8px;padding-bottom:5px;border-bottom:3px solid ' + NAVY + '">' + t + '</div>';
  const line = (a, b, o) => { o = o || {}; return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px dashed ' + LINE + ';font-size:' + (o.fs || 19) + 'px;' + (o.s || '') + '"><span style="color:' + (o.lc || MUT) + '">' + a + '</span><b style="color:' + (o.c || INK) + ';white-space:nowrap">' + b + '</b></div>'; };
  const kpi = (a, b, c) => '<div style="flex:1;border:2px solid ' + LINE + ';border-radius:12px;padding:10px 12px;text-align:center;background:#fafcff"><div style="font-size:18px;color:' + MUT + ';font-weight:600">' + a + '</div><div style="font-size:32px;font-weight:900;color:' + c + ';line-height:1.2;margin-top:2px">' + b + '</div></div>';

  /* रजिस्टर की तरह: ऊपर नोज़ल के नाम, नीचे क्लोज़िंग / ओपनिंग / टेस्टिंग / बिक्री */
  function meterTable(grp, o, d, T, fuelName, lit, rate, amt, pl) {
    const act = K.activeNz().filter(k => grp.includes(k));
    if (!act.length) return '';
    const cell = (v, s) => '<td style="text-align:right;padding:8px 8px;border-bottom:1px solid ' + LINE + ';font-size:22px;font-variant-numeric:tabular-nums;' + (s || '') + '">' + v + '</td>';
    const lab = t => '<td style="padding:8px 8px;border-bottom:1px solid ' + LINE + ';font-size:19px;color:' + MUT + ';font-weight:700;white-space:nowrap">' + t + '</td>';
    const hd = t => '<th style="background:' + NAVY + ';color:#fff;font-size:21px;padding:8px;text-align:right">' + t + '</th>';
    const val = (k, f) => { const n = (d.nz && d.nz[k]) || {}; return K.has(n[f]) ? esc(n[f]) : '–'; };
    const ok = k => o.nz[k] && o.nz[k].ok;
    const tt = k => { const n = (d.nz && d.nz[k]) || {}; return K.has(n.t) ? num(n.t) : T; };
    return '<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:4px"><tr><th style="background:' + NAVY + ';color:#fff;font-size:21px;padding:8px;text-align:left;width:104px">' + fuelName + '</th>' + act.map(k => hd(k.toUpperCase())).join('') + '<th style="background:' + NAVY + ';color:#fff;font-size:21px;padding:8px;text-align:right;width:132px">कुल</th></tr>' +
      '<tr>' + lab('क्लोज़िंग') + act.map(k => cell(val(k, 'c'))).join('') + cell('') + '</tr>' +
      '<tr>' + lab('ओपनिंग') + act.map(k => cell(val(k, 'o'))).join('') + cell('') + '</tr>' +
      '<tr>' + lab('टेस्टिंग −') + act.map(k => cell(ok(k) ? r2(tt(k)) : '–', 'color:' + AMB)).join('') + cell('') + '</tr>' +
      '<tr style="background:#eef3fc">' + lab('<span style="color:' + NAVY + '">बिक्री L</span>') + act.map(k => cell(ok(k) ? '<b>' + fmt(o.nz[k].net, 2) + '</b>' : '–')).join('') + cell('<b style="color:' + NAVY + '">' + fmt(lit, 2) + '</b>', 'font-size:22px') + '</tr></table>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;padding:8px 12px;background:#f3f6fc;border-radius:10px;font-size:21px"><span>' + fmt(lit, 2) + ' L × ₹' + fmt(rate, 2) + '</span><b style="color:' + NAVY + ';font-size:25px">= ' + pm(amt) + '</b></div>' + farkStrip(pl, o, d);
  }

  /* डिप: सिर्फ़ सुबह का स्टॉक + बड़ा, रंग वाला फर्क — मीटर रीडिंग के ठीक नीचे */
  function farkStrip(p, o, d) {
    const a = o['actStock' + p], df = o['diff' + p], tol = num(C.stockTolerance) || 25, tk = num(d['tanker' + p]);
    let bg, bd, col, big, small;
    if (a === null || df === null || df === undefined) { bg = '#f3f4f6'; bd = '#9ca3af'; col = MUT; big = 'डिप नहीं ली'; small = 'फर्क पता नहीं'; }
    else if (Math.abs(df) <= 0.5) { bg = '#dcfce7'; bd = '#16a34a'; col = '#166534'; big = '✔ बराबर'; small = 'स्टॉक पूरा मिला'; }
    else if (Math.abs(df) <= tol) { bg = '#fef3c7'; bd = '#d97706'; col = '#92400e'; big = (df > 0 ? '+' : '−') + fmt(Math.abs(df), 2) + ' L'; small = (df < 0 ? 'कम' : 'ज़्यादा') + ' · सीमा के अंदर'; }
    else { bg = '#fee2e2'; bd = '#dc2626'; col = '#991b1b'; big = '⚠ ' + (df > 0 ? '+' : '−') + fmt(Math.abs(df), 2) + ' L'; small = (df < 0 ? 'स्टॉक कम!' : 'स्टॉक ज़्यादा!') + ' · जाँचें'; }
    return '<div style="display:flex;gap:10px;margin-top:8px;align-items:stretch">' +
      '<div style="flex:1;min-width:0;border:2px solid ' + LINE + ';border-radius:12px;padding:8px 12px;background:#fafcff"><div style="font-size:17px;color:' + MUT + ';font-weight:600">🌅 सुबह का स्टॉक</div><div style="font-size:27px;font-weight:900;color:' + NAVY + ';line-height:1.25">' + fmt(d['openStock' + p], 2) + ' L</div>' + (tk ? '<div style="font-size:16px;color:' + AMB + ';font-weight:700">+ टैंकर ' + fmt(tk, 2) + ' L</div>' : '') + '</div>' +
      '<div style="flex:1.15;min-width:0;border:3px solid ' + bd + ';border-radius:12px;padding:8px 12px;background:' + bg + ';text-align:center"><div style="font-size:17px;color:' + col + ';font-weight:700">डिप फर्क</div><div style="font-size:31px;font-weight:900;color:' + col + ';line-height:1.2">' + big + '</div><div style="font-size:15px;color:' + col + ';font-weight:600">' + small + '</div></div></div>';
  }

  function build(st, d) {
    const o = K.compute(d, st.rows), T = gT(d), done = (st.d && st.d.status === 'submitted');
    const gIn = r2(num(d.openCash) + o.sale + o.jCash + o.jPaytm + o.jSwipe), gOut = r2(num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya));
    const ex = (K.khList ? K.khList(d) : []).concat(num(d.malikDiya) ? [{ label: 'मालिक को दिया (SBI जमा)', amount: num(d.malikDiya) }] : []);
    let totU = 0, totJ = 0, tLP = 0, tLD = 0, i = 0;
    const byP = {};
    const FL = f => f === 'petrol' ? 'M.S.' : f === 'diesel' ? 'HSD' : '';
    const ent = st.rows.map(r => {
      const isU = r.kind === 'udhar', amt = num(r.amount), l = num(r.litre); i++;
      const nm = String(r.partyName || '—');
      const g = byP[nm] = byP[nm] || { u: 0, j: 0, lp: 0, ld: 0, n: 0 }; g.n++;
      if (isU) { totU += amt; g.u += amt; if (l > 0) { if (r.fuel === 'petrol') { tLP += l; g.lp += l; } else { tLD += l; g.ld += l; } } } else { totJ += amt; g.j += amt; }
      const rate = num(r.rate) > 0 ? num(r.rate) : (l > 0 ? amt / l : 0);
      let det;
      if (isU) {
        det = (r.vehicle ? '<b style="color:' + INK + ';font-size:20px;letter-spacing:.3px">' + esc(r.vehicle) + '</b>' : '<span>गाड़ी नहीं</span>') +
          (l > 0 ? ' &nbsp;·&nbsp; <b style="color:' + NAVY + '">' + (FL(r.fuel) || 'तेल') + ' ' + fmt(l, 2) + ' L</b> × ₹' + fmt(rate, 2) : ' &nbsp;·&nbsp; गाड़ी कैश / नकद') +
          (r.time ? ' &nbsp;·&nbsp; ' + esc(r.time) : '');
      } else {
        det = '<b style="color:' + GRN + '">जमा · ' + ((APP.MODE && APP.MODE[r.mode]) || 'नकद') + '</b>' + (r.time ? ' &nbsp;·&nbsp; ' + esc(r.time) : '');
      }
      return '<div style="display:flex;gap:10px;padding:9px 4px;border-bottom:1px solid ' + LINE + ';' + (isU ? '' : 'background:#f0fdf4;') + '">' +
        '<div style="width:34px;font-size:18px;color:' + MUT + ';font-weight:700;padding-top:2px">' + i + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:22px;font-weight:800;color:' + INK + '">' + esc(nm) + '</div><div style="font-size:17px;color:' + MUT + ';margin-top:2px">' + det + '</div>' +
        (r.note && !/Opening Balance/i.test(r.note) ? '<div style="font-size:16px;color:' + AMB + ';margin-top:2px">📝 ' + esc(r.note) + '</div>' : '') + '</div>' +
        '<div style="text-align:right;font-size:25px;font-weight:900;white-space:nowrap;color:' + (isU ? RED : GRN) + '">' + (isU ? '' : '+ ') + pm(amt) + '</div></div>';
    }).join('');
    const pnames = Object.keys(byP);
    const psum = pnames.length > 1 ? title('👥 पार्टी-वार कुल') + pnames.sort((a, b) => byP[b].u - byP[a].u).map(n => { const g = byP[n]; const lt = g.lp + g.ld; return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 4px;border-bottom:1px dashed ' + LINE + '"><span style="font-size:20px;font-weight:700;min-width:0">' + esc(n) + '<span style="font-size:15px;color:' + MUT + ';font-weight:500"> · ' + g.n + ' एंट्री' + (lt ? ' · ' + fmt(lt, 2) + ' L' : '') + '</span></span><span style="white-space:nowrap;font-size:21px;font-weight:800">' + (g.u ? '<span style="color:' + RED + '">' + pm(g.u) + '</span>' : '') + (g.j ? ' <span style="color:' + GRN + '">+' + pm(g.j) + '</span>' : '') + '</span></div>'; }).join('') : '';
    const entTot = '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:10px 12px;background:#eef3fc;border-radius:10px"><span style="font-size:18px;color:' + MUT + ';font-weight:700">कुल तेल: M.S. ' + fmt(tLP, 2) + ' L · HSD ' + fmt(tLD, 2) + ' L</span><span style="font-size:22px;font-weight:900"><span style="color:' + RED + '">' + pm(totU) + '</span>' + (totJ ? ' <span style="color:' + GRN + '">+' + pm(totJ) + '</span>' : '') + '</span></div>';

    return '<div style="width:' + W + 'px;background:#fff;color:' + INK + ';font-family:' + FM + ';padding:22px 22px 16px;box-sizing:border-box;line-height:1.3">' +
      /* ऊपर का हिस्सा */
      '<div style="display:flex;align-items:center;gap:14px;border-bottom:5px solid ' + NAVY + ';padding-bottom:12px"><img src="./logo.png" crossorigin="anonymous" style="width:60px;height:60px;border-radius:50%"><div style="flex:1;min-width:0"><div style="font-size:26px;font-weight:900;color:' + NAVY + '">' + esc(C.pump.name) + '</div><div style="font-size:15px;color:' + MUT + '">दैनिक हिसाब</div></div>' +
      '<div style="text-align:right"><div style="font-size:34px;font-weight:900;line-height:1.1">' + dmy(st.date) + '</div><span style="display:inline-block;margin-top:3px;padding:2px 12px;border-radius:12px;font-size:16px;font-weight:800;background:' + (done ? '#dcfce7' : '#fef3c7') + ';color:' + (done ? GRN : AMB) + '">' + (done ? '✔ फाइनल' : '⏳ चालू') + '</span></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:19px;font-weight:700"><span>M.S. ₹' + fmt(d.rateP, 2) + '</span><span>HSD ₹' + fmt(d.rateD, 2) + '</span><span style="color:' + MUT + '">टेस्टिंग ' + r2(T) + ' L</span></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px">' + kpi('कुल बिक्री', pm(o.sale), NAVY) + kpi('बचा कैश', pm(o.close), GRN) + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:10px">' + kpi('उधार दिया', pm(o.udhar), RED) + kpi('कुल खर्चा', pm(o.totalKharcha), AMB) + '</div>' +
      /* मीटर — रजिस्टर की तरह */
      title('⛽ पेट्रोल (M.S.) — मीटर') + meterTable(['p1', 'p2', 'p3', 'p4'], o, d, T, 'M.S.', o.litP, d.rateP, o.amtP, 'P') +
      title('⛽ डीज़ल (HSD) — मीटर') + meterTable(['d1', 'd2', 'd3', 'd4'], o, d, T, 'HSD', o.litD, d.rateD, o.amtD, 'D') +
      /* डिप / स्टॉक */
      /* कैश */
      title('💰 कैश का हिसाब') + '<div style="display:flex;gap:10px">' +
      '<div style="flex:1;min-width:0;border:2px solid #86efac;background:#f0fdf4;border-radius:12px;padding:8px 12px"><div style="font-size:20px;font-weight:800;color:#166534">गल्ला — आया</div>' + line('पिछला कैश', pm(d.openCash), { fs: 18 }) + line('आज बिक्री', pm(o.sale), { fs: 18 }) + line('पार्टी जमा', pm(o.jCash + o.jPaytm + o.jSwipe), { fs: 18 }) + line('कुल', pm(gIn), { fs: 21, c: '#166534', s: 'font-weight:900;border:0' }) + '</div>' +
      '<div style="flex:1;min-width:0;border:2px solid #fca5a5;background:#fef2f2;border-radius:12px;padding:8px 12px"><div style="font-size:20px;font-weight:800;color:#991b1b">खर्चा — गया</div>' + line('Paytm+स्वाइप', pm(num(d.paytm) + num(d.swipe)), { fs: 18 }) + line('उधार दिया', pm(o.udhar), { fs: 18 }) + line('DG/चाय/अन्य', pm(o.totalKharcha), { fs: 18 }) + line('SBI जमा', pm(d.malikDiya), { fs: 18 }) + line('कुल', pm(gOut), { fs: 21, c: '#991b1b', s: 'font-weight:900;border:0' }) + '</div></div>' +
      '<div style="margin-top:10px;background:' + NAVY + ';color:#fff;border-radius:12px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:21px;font-weight:700">आज का बचा कैश<div style="font-size:14px;opacity:.8;font-weight:400">कुल गल्ला − कुल खर्चा</div></span><b style="font-size:38px">' + pm(o.close) + '</b></div>' +
      (ex.length ? title('💸 खर्चे') + ex.map(x => line(esc(x.label), pm(x.amount), { fs: 20 })).join('') : '') +
      /* पार्टी उधार / जमा */
      title('📒 उधार खाता / जमा (' + st.rows.length + ' एंट्री)') +
      (st.rows.length ? ent + entTot + psum : '<div style="padding:12px;color:' + MUT + ';text-align:center;font-size:19px">आज कोई पार्टी एंट्री नहीं</div>') +
      '<div style="margin-top:14px;padding-top:6px;border-top:2px solid ' + LINE + ';display:flex;justify-content:space-between;font-size:14px;color:' + MUT + '"><span>' + esc(C.pump.name) + ' · ' + dmy(st.date) + '</span><span>' + new Date().toLocaleString('en-IN') + '</span></div></div>';
  }

  APP.shareCompactDayReport = async function (st, d) {
    if (typeof html2canvas !== 'function') return APP.toast('html2canvas लोड नहीं हुआ — नेट चेक करें');
    APP.toast('रिपोर्ट तैयार हो रही है…');
    const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1';
    try { wrap.innerHTML = build(st, d); document.body.appendChild(wrap); } catch (e) { return APP.toast('रिपोर्ट नहीं बनी: ' + e.message); }
    try {
      const imgs = Array.from(wrap.querySelectorAll('img')); await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      /* scale 2 = साफ़ अक्षर; JPEG = फाइल छोटी (PNG से ~5 गुना हल्की) */
      const cv = await html2canvas(wrap.firstChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
      APP.showReportPreview([new File([blob], 'hisab-' + st.date + '.jpg', { type: 'image/jpeg' })], 'दैनिक हिसाब - ' + dmy(st.date));
    } catch (e) { APP.toast('फोटो नहीं बनी: ' + e.message); } finally { wrap.remove(); }
  };
  APP.__buildDayReport = build;   /* टेस्ट के लिए */
  console.log('[Mazda dayreport.js] loaded ✓');
})();
