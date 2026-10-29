/* Mazda Oil Company - हर नोज़ल की टेस्टिंग + प्रो दैनिक हिसाब रिपोर्ट (Multi-Page) */
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

  /* ---------- 2. दैनिक हिसाब रिपोर्ट (Multi-page, Fit Size) ---------- */
  const W = 750;
  const NAVY = '#0a2f6b', INK = '#111827', MUT = '#4b5563', LINE = '#c9d3e6', RED = '#b91c1c', GRN = '#15803d', AMB = '#b45309';
  const FM = "system-ui,-apple-system,'Noto Sans Devanagari','Segoe UI',sans-serif";
  const fmt = (x, d) => r2(num(x)).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: 2 });
  const pm = x => '₹' + fmt(x, Math.abs(num(x) - Math.round(num(x))) < 0.005 ? 0 : 2);
  const L2 = x => fmt(x, 2) + ' L';
  
  const title = t => '<div style="font-size:22px;font-weight:800;color:' + NAVY + ';margin:18px 0 8px;padding-bottom:5px;border-bottom:3px solid ' + NAVY + '">' + t + '</div>';
  const line = (a, b, o) => { o = o || {}; return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px dashed ' + LINE + ';font-size:' + (o.fs || 19) + 'px;' + (o.s || '') + '"><span style="color:' + (o.lc || MUT) + '">' + a + '</span><b style="color:' + (o.c || INK) + ';white-space:nowrap">' + b + '</b></div>'; };
  const kpi = (a, b, c) => '<div style="flex:1;border:2px solid ' + LINE + ';border-radius:12px;padding:10px 12px;text-align:center;background:#fafcff"><div style="font-size:18px;color:' + MUT + ';font-weight:600">' + a + '</div><div style="font-size:32px;font-weight:900;color:' + c + ';line-height:1.2;margin-top:2px">' + b + '</div></div>';

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

  function buildPage1(st, d, o) {
    const done = (st.d && st.d.status === 'submitted');
    const gIn = r2(num(d.openCash) + o.sale + o.jCash + o.jPaytm + o.jSwipe), gOut = r2(num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya));
    const T = gT(d);

    return `
      <div style="display:flex;align-items:center;gap:14px;border-bottom:5px solid ${NAVY};padding-bottom:12px">
        <img src="./logo.png" crossorigin="anonymous" style="width:60px;height:60px;border-radius:50%">
        <div style="flex:1;min-width:0">
          <div style="font-size:26px;font-weight:900;color:${NAVY}">${esc(C.pump.name)}</div>
          <div style="font-size:15px;color:${MUT}">दैनिक हिसाब</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:34px;font-weight:900;line-height:1.1">${dmy(st.date)}</div>
          <span style="display:inline-block;margin-top:3px;padding:2px 12px;border-radius:12px;font-size:16px;font-weight:800;background:${done ? '#dcfce7' : '#fef3c7'};color:${done ? GRN : AMB}">${done ? '✔ फाइनल' : '⏳ चालू'}</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:19px;font-weight:700">
        <span>M.S. ₹${fmt(d.rateP, 2)}</span>
        <span>HSD ₹${fmt(d.rateD, 2)}</span>
        <span style="color:${MUT}">टेस्टिंग ${r2(T)} L</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px">
        ${kpi('कुल बिक्री', pm(o.sale), NAVY)} ${kpi('बचा कैश', pm(o.close), GRN)}
      </div>
      <div style="display:flex;gap:10px;margin-top:10px">
        ${kpi('उधार दिया', pm(o.udhar), RED)} ${kpi('कुल खर्चा', pm(o.totalKharcha), AMB)}
      </div>
      
      ${title('⛽ पेट्रोल (M.S.) — मीटर')} 
      ${meterTable(['p1', 'p2', 'p3', 'p4'], o, d, T, 'M.S.', o.litP, d.rateP, o.amtP, 'P')}
      
      ${title('⛽ डीज़ल (HSD) — मीटर')} 
      ${meterTable(['d1', 'd2', 'd3', 'd4'], o, d, T, 'HSD', o.litD, d.rateD, o.amtD, 'D')}
      
      ${title('💰 कैश का हिसाब')} 
      <div style="display:flex;gap:10px">
        <div style="flex:1;min-width:0;border:2px solid #86efac;background:#f0fdf4;border-radius:12px;padding:8px 12px">
          <div style="font-size:20px;font-weight:800;color:#166534">गल्ला — आया</div>
          ${line('पिछला कैश', pm(d.openCash), { fs: 18 })}
          ${line('आज बिक्री', pm(o.sale), { fs: 18 })}
          ${line('पार्टी जमा', pm(o.jCash + o.jPaytm + o.jSwipe), { fs: 18 })}
          ${line('कुल', pm(gIn), { fs: 21, c: '#166534', s: 'font-weight:900;border:0' })}
        </div>
        <div style="flex:1;min-width:0;border:2px solid #fca5a5;background:#fef2f2;border-radius:12px;padding:8px 12px">
          <div style="font-size:20px;font-weight:800;color:#991b1b">खर्चा — गया</div>
          ${line('Paytm+स्वाइप', pm(num(d.paytm) + num(d.swipe)), { fs: 18 })}
          ${line('उधार दिया', pm(o.udhar), { fs: 18 })}
          ${line('DG/चाय/अन्य', pm(o.totalKharcha), { fs: 18 })}
          ${line('SBI जमा', pm(d.malikDiya), { fs: 18 })}
          ${line('कुल', pm(gOut), { fs: 21, c: '#991b1b', s: 'font-weight:900;border:0' })}
        </div>
      </div>
      <div style="margin-top:10px;background:${NAVY};color:#fff;border-radius:12px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:21px;font-weight:700">आज का बचा कैश<div style="font-size:14px;opacity:.8;font-weight:400">कुल गल्ला − कुल खर्चा</div></span>
        <b style="font-size:38px">${pm(o.close)}</b>
      </div>
    `;
  }

  function buildPage2(st, d, o) {
    const ex = (K.khList ? K.khList(d) : []).concat(num(d.malikDiya) ? [{ label: 'मालिक को दिया (SBI जमा)', amount: num(d.malikDiya) }] : []);
    
    const th = (t, al, w) => '<th style="padding:4px 5px;color:#fff;text-align:' + al + ';font-weight:700;background:' + NAVY + ';' + (w ? 'width:' + w + ';' : '') + '">' + t + '</th>';
    const tHead = '<tr>' + th('समय', 'left', '60px') + th('पार्टी', 'left') + th('विवरण', 'left', '300px') + th('उधार ₹', 'right', '110px') + th('जमा ₹', 'right', '110px') + '</tr>';
    const FL = f => f === 'petrol' ? 'M.S.' : f === 'diesel' ? 'HSD' : '';
    const detail = r => r.kind === 'udhar'
      ? esc(r.vehicle || '') + (r.fuel ? ' · ' + (FL(r.fuel) || '') + ' ' + fmt(r.litre, 2) + ' L' : '')
      : 'जमा · ' + esc((APP.MODE && APP.MODE[r.mode]) || 'नकद') + (r.note && !APP.AUTO_NOTES.includes(r.note) ? ' · ' + esc(r.note) : '');
    
    let totU = 0, totJ = 0;
    const rowsHtml = st.rows.map(r => {
      const isU = r.kind === 'udhar', amt = num(r.amount);
      if (isU) totU += amt; else totJ += amt;
      return '<tr style="border-bottom:1px solid #e9edf5">' +
        '<td style="padding:6px 5px;color:#666;font-size:14px">' + esc(r.time || '') + '</td>' +
        '<td style="padding:6px 5px;font-weight:700;font-size:16px">' + esc(r.partyName || '—') + '</td>' +
        '<td style="padding:6px 5px;font-size:15px;color:#444">' + detail(r) + '</td>' +
        '<td style="padding:6px 5px;text-align:right;color:' + RED + ';font-weight:700">' + (isU ? fmt(amt, 2) : '') + '</td>' +
        '<td style="padding:6px 5px;text-align:right;color:' + GRN + ';font-weight:700">' + (!isU ? fmt(amt, 2) : '') + '</td>' +
        '</tr>';
    }).join('');

    return `
      ${ex.length ? title('💸 खर्चे') + ex.map(x => line(esc(x.label), pm(x.amount), { fs: 20 })).join('') : ''}
      ${title('📒 उधार खाता / जमा (' + st.rows.length + ' एंट्री)')}
      ${st.rows.length ? `
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px">
          ${tHead}
          <tbody>${rowsHtml}</tbody>
          <tr style="background:#eef3fc;font-weight:900">
            <td colspan="3" style="padding:8px 5px;text-align:right">कुल</td>
            <td style="padding:8px 5px;text-align:right;color:${RED}">${fmt(totU, 2)}</td>
            <td style="padding:8px 5px;text-align:right;color:${GRN}">${fmt(totJ, 2)}</td>
          </tr>
        </table>
      ` : '<div style="padding:12px;color:' + MUT + ';text-align:center;font-size:19px">आज कोई पार्टी एंट्री नहीं</div>'}
    `;
  }

  APP.shareCompactDayReport = async function (st, d) {
    if (typeof html2canvas !== 'function') return APP.toast('html2canvas लोड नहीं हुआ — नेट चेक करें');
    APP.toast('रिपोर्ट तैयार हो रही है…');
    
    const o = K.compute(d, st.rows);
    const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1';
    
    // Page 1 (Fit size)
    const p1 = document.createElement('div');
    p1.className = 'dr-page';
    p1.style.cssText = 'width:' + W + 'px; background:#fff; color:' + INK + '; font-family:' + FM + '; padding:22px 22px 16px; box-sizing:border-box; line-height:1.3;';
    p1.innerHTML = buildPage1(st, d, o);
    wrap.appendChild(p1);

    // Page 2+ (Expenses + Entries)
    if (st.rows.length || K.khList(d).length || num(d.malikDiya)) {
      const p2 = document.createElement('div');
      p2.className = 'dr-page';
      p2.style.cssText = 'width:' + W + 'px; background:#fff; color:' + INK + '; font-family:' + FM + '; padding:22px 22px 16px; box-sizing:border-box; line-height:1.3;';
      
      const miniHdr = '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ' + NAVY + ';padding-bottom:8px;margin-bottom:12px"><div style="font-size:20px;font-weight:900;color:' + NAVY + '">' + esc(C.pump.name) + '</div><div style="font-size:16px;font-weight:700">' + dmy(st.date) + ' (जारी)</div></div>';
      p2.innerHTML = miniHdr + buildPage2(st, d, o);
      
      // Footer for page 1
      const f1 = document.createElement('div');
      f1.style.cssText = 'margin-top:14px;padding-top:6px;border-top:2px solid ' + LINE + ';display:flex;justify-content:space-between;font-size:14px;color:' + MUT;
      f1.innerHTML = '<span>' + esc(C.pump.name) + ' · ' + dmy(st.date) + '</span><span>Page 1</span>';
      p1.appendChild(f1);

      // Footer for page 2
      const f2 = document.createElement('div');
      f2.style.cssText = 'margin-top:14px;padding-top:6px;border-top:2px solid ' + LINE + ';display:flex;justify-content:space-between;font-size:14px;color:' + MUT;
      f2.innerHTML = '<span>' + esc(C.pump.name) + ' · ' + dmy(st.date) + '</span><span>Page 2</span>';
      p2.appendChild(f2);
      
      wrap.appendChild(p2);
    } else {
      // Agar page 2 nahi hai, to page 1 pe hi footer laga do
      const f1 = document.createElement('div');
      f1.style.cssText = 'margin-top:14px;padding-top:6px;border-top:2px solid ' + LINE + ';display:flex;justify-content:space-between;font-size:14px;color:' + MUT;
      f1.innerHTML = '<span>' + esc(C.pump.name) + ' · ' + dmy(st.date) + '</span><span>Page 1</span>';
      p1.appendChild(f1);
    }

    document.body.appendChild(wrap);

    try {
      const imgs = Array.from(wrap.querySelectorAll('img')); 
      await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { }
      
      const pages = wrap.querySelectorAll('.dr-page');
      const files = [];
      
      for (let i = 0; i < pages.length; i++) {
        const cv = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.92));
        files.push(new File([blob], 'hisab-' + st.date + '_p' + (i+1) + '.jpg', { type: 'image/jpeg' }));
      }
      
      APP.showReportPreview(files, 'दैनिक हिसाब - ' + dmy(st.date));
    } catch (e) { APP.toast('फोटो नहीं बनी: ' + e.message); } finally { wrap.remove(); }
  };
  
  APP.__buildDayReport = (st, d) => buildPage1(st, d, K.compute(d, st.rows));
  console.log('[Mazda dayreport.js] Multi-Page loaded ✓');
})();
