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

  /* ---------- 2. प्रो दैनिक हिसाब रिपोर्ट ---------- */
  const NAVY = '#0a2f6b', INK = '#1b2433', MUT = '#6b7385', LINE = '#e3e8f2';
  const pm = x => '₹' + r2(num(x)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L2 = x => r2(num(x)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
  const sec = (t, inner) => '<div style="margin-top:16px"><div style="font-size:15px;font-weight:700;color:' + NAVY + ';padding:0 0 6px;border-bottom:2px solid ' + NAVY + '">' + t + '</div>' + inner + '</div>';
  const row = (a, b, o) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed ' + LINE + ';font-size:14px;' + ((o && o.s) || '') + '"><span style="color:' + MUT + '">' + a + '</span><b style="color:' + ((o && o.c) || INK) + '">' + b + '</b></div>';
  const kpi = (a, b, c) => '<div style="flex:1;min-width:0;border:1px solid ' + LINE + ';border-radius:10px;padding:10px 6px;text-align:center"><div style="font-size:12px;color:' + MUT + '">' + a + '</div><div style="font-size:19px;font-weight:800;color:' + c + ';margin-top:2px">' + b + '</div></div>';
  const th = (t, al) => '<th style="text-align:' + (al || 'right') + ';padding:7px 6px;background:' + NAVY + ';color:#fff;font-size:12.5px">' + t + '</th>';
  const td = (t, al, s) => '<td style="text-align:' + (al || 'right') + ';padding:6px;border-bottom:1px solid ' + LINE + ';font-size:13.5px;' + (s || '') + '">' + t + '</td>';

  function build(st, d) {
    const o = K.compute(d, st.rows), T = gT(d), done = (st.d && st.d.status === 'submitted');
    const act = K.activeNz();
    const nzRows = grp => grp.filter(k => act.includes(k)).map(k => {
      const n = (d.nz && d.nz[k]) || {}, ok = o.nz[k] && o.nz[k].ok, t = K.has(n.t) ? num(n.t) : T;
      return '<tr>' + td('<b>' + k.toUpperCase() + '</b>', 'left') + td(esc(n.o || '–')) + td(K.has(n.c) ? esc(n.c) : '–') + td(ok ? '− ' + r2(t) : '–', 'right', 'color:#b26a00') + td(ok ? '<b>' + r2(o.nz[k].net) + '</b>' : '–') + '</tr>';
    }).join('');
    const sub = (a, v) => '<tr><td colspan="4" style="text-align:right;padding:6px;font-size:13.5px;background:#f3f6fc;font-weight:700;color:' + NAVY + '">' + a + '</td><td style="text-align:right;padding:6px;font-size:14px;background:#f3f6fc;font-weight:800;color:' + NAVY + '">' + L2(v) + '</td></tr>';
    const stock = (name, p) => {
      const exp = o['expStock' + p], a = o['actStock' + p], df = o['diff' + p], tol = num(C.stockTolerance) || 25;
      const msg = a === null ? '<span style="color:' + MUT + '">डिप नहीं ली</span>' : Math.abs(df) <= 0.5 ? '<span style="color:#0a7d33">✔ बराबर</span>' : Math.abs(df) <= tol ? '<span style="color:#b26a00">≈ ' + (df > 0 ? '+' : '') + r2(df) + ' L (ठीक-ठाक)</span>' : '<span style="color:#c0392b">⚠ ' + (df > 0 ? '+' : '') + r2(df) + ' L ' + (df < 0 ? 'कम' : 'ज़्यादा') + '</span>';
      return '<div style="flex:1;min-width:0;border:1px solid ' + LINE + ';border-radius:10px;padding:10px 12px">' + '<div style="font-weight:700;color:' + NAVY + ';margin-bottom:4px">' + name + '</div>' +
        row('कल की डिप से शुरुआत', L2(d['openStock' + p])) + row('+ टैंकर आया', L2(d['tanker' + p])) + row('− आज की बिक्री', L2(o['lit' + p])) + row('= होना चाहिए', L2(exp), { s: 'font-weight:600' }) +
        row('आज की डिप (असली)', a === null ? '–' : L2(a)) + '<div style="text-align:right;font-size:14px;font-weight:700;margin-top:6px">फर्क: ' + msg + '</div></div>';
    };
    const gIn = r2(num(d.openCash) + o.sale + o.jCash + o.jPaytm + o.jSwipe), gOut = r2(num(d.paytm) + num(d.swipe) + o.udhar + o.totalKharcha + num(d.malikDiya));
    const ex = (K.khList ? K.khList(d) : []).concat(num(d.malikDiya) ? [{ label: 'मालिक को दिया (SBI जमा)', amount: num(d.malikDiya) }] : []);
    const ent = st.rows.map(r => '<tr>' + td(esc(r.time || ''), 'left') + td('<b>' + esc(r.partyName) + '</b>', 'left') + td(r.kind === 'udhar' ? esc(r.vehicle || '') + (r.fuel ? ' · ' + (APP.FUEL[r.fuel] || '') + ' ' + r2(r.litre) + ' L' : '') : 'जमा · ' + (APP.MODE[r.mode] || 'नकद'), 'left', 'color:' + MUT) + td(r.kind === 'udhar' ? pm(r.amount) : '', 'right', 'color:#c0392b;font-weight:700') + td(r.kind === 'jama' ? pm(r.amount) : '', 'right', 'color:#0a7d33;font-weight:700') + '</tr>').join('');
    return '<div style="width:820px;background:#fff;color:' + INK + ';font-family:system-ui,-apple-system,\'Noto Sans Devanagari\',sans-serif;padding:26px 30px 20px;box-sizing:border-box">' +
      '<div style="display:flex;align-items:center;gap:14px;border-bottom:4px solid ' + NAVY + ';padding-bottom:14px"><img src="./logo.png" crossorigin="anonymous" style="width:64px;height:64px;border-radius:50%"><div style="flex:1"><div style="font-size:24px;font-weight:800;color:' + NAVY + '">' + esc(C.pump.name) + '</div><div style="font-size:12.5px;color:' + MUT + '">' + esc(C.pump.address) + '</div></div>' +
      '<div style="text-align:right"><div style="font-size:12px;color:' + MUT + '">दैनिक हिसाब · DAILY ACCOUNT</div><div style="font-size:26px;font-weight:800">' + dmy(st.date) + '</div><span style="display:inline-block;margin-top:2px;padding:3px 12px;border-radius:12px;font-size:12.5px;font-weight:700;background:' + (done ? '#e3f6ea' : '#fff1d6') + ';color:' + (done ? '#0a7d33' : '#b26a00') + '">' + (done ? '✔ फाइनल' : '⏳ चालू (फाइनल नहीं)') + '</span></div></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px;font-size:13px;color:' + MUT + '"><span>पेट्रोल रेट <b style="color:' + INK + '">' + pm(d.rateP) + '/L</b></span><span>·</span><span>डीज़ल रेट <b style="color:' + INK + '">' + pm(d.rateD) + '/L</b></span><span>·</span><span>टेस्टिंग <b style="color:' + INK + '">' + r2(T) + ' L हर नोज़ल</b></span></div>' +
      '<div style="display:flex;gap:10px;margin-top:12px">' + kpi('कुल बिक्री', pm(o.sale), NAVY) + kpi('उधार दिया', pm(o.udhar), '#c0392b') + kpi('कुल खर्चा', pm(o.totalKharcha), '#b26a00') + kpi('आज का बचा कैश', pm(o.close), '#0a7d33') + '</div>' +
      sec('⛽ मीटर रीडिंग — बिक्री = क्लोज़िंग − ओपनिंग − टेस्टिंग', '<table style="width:100%;border-collapse:collapse;margin-top:6px"><tr>' + th('नोज़ल', 'left') + th('ओपनिंग') + th('क्लोज़िंग') + th('टेस्टिंग') + th('बिक्री (L)') + '</tr>' + nzRows(['p1', 'p2', 'p3', 'p4']) + sub('पेट्रोल कुल', o.litP) + nzRows(['d1', 'd2', 'd3', 'd4']) + sub('डीज़ल कुल', o.litD) + '</table>' +
        '<div style="display:flex;justify-content:space-between;margin-top:8px;padding:8px 12px;background:#f3f6fc;border-radius:8px;font-size:14px"><span>पेट्रोल <b>' + L2(o.litP) + '</b> = ' + pm(o.amtP) + '</span><span>डीज़ल <b>' + L2(o.litD) + '</b> = ' + pm(o.amtD) + '</span><span>कुल बिक्री <b style="color:' + NAVY + '">' + pm(o.sale) + '</b></span></div>') +
      sec('🛢️ टैंकर का स्टॉक', '<div style="display:flex;gap:12px;margin-top:8px">' + stock('पेट्रोल', 'P') + stock('डीज़ल', 'D') + '</div>') +
      sec('💰 कैश का हिसाब', '<div style="display:flex;gap:12px;margin-top:8px"><div style="flex:1;min-width:0;border:1px solid #bfe6cd;background:#f4fbf6;border-radius:10px;padding:8px 12px"><div style="font-weight:700;color:#166534;margin-bottom:2px">गल्ला — जो आया</div>' + row('पिछला कैश', pm(d.openCash)) + row('आज की बिक्री', pm(o.sale)) + row('पार्टी जमा', pm(o.jCash + o.jPaytm + o.jSwipe)) + row('कुल गल्ला', pm(gIn), { c: '#166534', s: 'font-weight:800;border:0' }) + '</div>' +
        '<div style="flex:1;min-width:0;border:1px solid #f1c3c3;background:#fdf5f5;border-radius:10px;padding:8px 12px"><div style="font-weight:700;color:#991b1b;margin-bottom:2px">खर्चा — जो गया</div>' + row('Paytm + स्वाइप', pm(num(d.paytm) + num(d.swipe))) + row('उधार दिया', pm(o.udhar)) + row('DG / चाय / अन्य खर्चे', pm(o.totalKharcha)) + row('SBI जमा (मालिक को)', pm(d.malikDiya)) + row('कुल खर्चा', pm(gOut), { c: '#991b1b', s: 'font-weight:800;border:0' }) + '</div></div>' +
        '<div style="margin-top:10px;background:' + NAVY + ';color:#fff;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px">आज का बचा कैश <small style="opacity:.8">(कुल गल्ला − कुल खर्चा)</small></span><b style="font-size:26px">' + pm(o.close) + '</b></div>') +
      (ex.length ? sec('💸 खर्चे — किस चीज़ में कितना', ex.map(x => row(esc(x.label), pm(x.amount))).join('')) : '') +
      sec('📒 पार्टी उधार / जमा (' + st.rows.length + ' एंट्री)', st.rows.length ? '<table style="width:100%;border-collapse:collapse;margin-top:6px"><tr>' + th('समय', 'left') + th('पार्टी', 'left') + th('विवरण', 'left') + th('उधार ₹') + th('जमा ₹') + '</tr>' + ent + '</table>' : '<div style="padding:12px;color:' + MUT + ';text-align:center">आज कोई पार्टी एंट्री नहीं</div>') +
      '<div style="margin-top:18px;padding-top:8px;border-top:1px solid ' + LINE + ';display:flex;justify-content:space-between;font-size:11.5px;color:' + MUT + '"><span>' + esc(C.pump.name) + ' · दैनिक हिसाब ' + dmy(st.date) + '</span><span>तैयार: ' + new Date().toLocaleString('en-IN') + '</span></div></div>';
  }

  APP.shareCompactDayReport = async function (st, d) {
    APP.toast('रिपोर्ट तैयार हो रही है…');
    const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1';
    try { wrap.innerHTML = build(st, d); document.body.appendChild(wrap); } catch (e) { return APP.toast('रिपोर्ट नहीं बनी: ' + e.message); }
    try {
      const imgs = Array.from(wrap.querySelectorAll('img')); await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      const cv = await html2canvas(wrap.firstChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      cv.toBlob(blob => {
        const file = new File([blob], 'hisab-' + st.date + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text: 'दैनिक हिसाब - ' + dmy(st.date) }).catch(() => { });
        else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); }
      });
    } catch (e) { APP.toast('फोटो नहीं बनी: ' + e.message); } finally { wrap.remove(); }
  };
  console.log('[Mazda dayreport.js] loaded ✓');
})();
