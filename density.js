/* =========================================================================
   डेंसिटी मॉड्यूल (सिर्फ़ मालिक/मैनेजर) — नया लुक
   • इनपुट: हाइड्रोमीटर (kg/m³) + तापमान (°C, 0.25 के गुणे में)
   • आउटपुट: 15°C पर डेंसिटी (kg/m³) — कोई भी 2 दो, तीसरी अपने-आप
   • सरकारी रेंज अलर्ट, इनवॉइस मिलान, मौसम सुझाव, गाड़ी/ड्राइवर के साथ सेव
   ⚠ सरकारी रेंज और गुणांक डिफ़ॉल्ट हैं — IS 2448 / ASTM D1250 से मिलाएँ
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP, PS = window.PUMP_SYSTEM;
  if (!APP || !PS) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // गुणांक kg/L प्रति °C. ρ15 = ρt + γ·(t−15). दोनों मान हाल के टेस्ट में
  // 740@30°C→753.3 और 812@30°C→822.6 से मेल खाते हैं.
  const PRODUCT = {
    MS:  { label: 'Petrol (MS)',  gamma: 0.000886, min: 720, max: 775, tolerance: 1.5 },
    HSD: { label: 'Diesel (HSD)', gamma: 0.000707, min: 820, max: 845, tolerance: 1.5 }
  };
  const UTT = { lat: 29.21, lon: 78.96, place: 'Kashipur (डिफ़ॉल्ट)' };

  const r1 = x => Math.round(x * 10) / 10;

  // सब कुछ kg/m³ में; गुणांक kg/L में है, इसलिए 1000 से गुणा/भाग
  function toRho15(h, t, prod) { return h + PRODUCT[prod].gamma * 1000 * (t - 15); }
  function toHydro(rho15, t, prod) { return rho15 - PRODUCT[prod].gamma * 1000 * (t - 15); }

  function solve(prod, t, h, d15) {
    const g = PRODUCT[prod].gamma * 1000;
    if (t != null && h != null) return { temp: t, hydro: h, rho15: r1(toRho15(h, t, prod)) };
    if (t != null && d15 != null) return { temp: t, hydro: r1(toHydro(d15, t, prod)), rho15: d15 };
    if (h != null && d15 != null) return { temp: Math.round((15 + (d15 - h) / g) * 4) / 4, hydro: h, rho15: d15 };
    return null;
  }

  function rangeCheck(prod, rho15) {
    const p = PRODUCT[prod];
    if (rho15 < p.min) return { ok: false, msg: 'सरकारी न्यूनतम (' + p.min + ') से कम — माल जाँचें, गड़बड़ी संभव' };
    if (rho15 > p.max) return { ok: false, msg: 'सरकारी अधिकतम (' + p.max + ') से ज़्यादा — मिलावट या गलत रीडिंग की जाँच करें' };
    return { ok: true, msg: 'सरकारी रेंज में है (' + p.min + ' – ' + p.max + ')' };
  }

  function invoiceAdvice(prod, invRho, recRho) {
    const p = PRODUCT[prod], diff = r1(recRho - invRho), abs = Math.abs(diff);
    if (abs <= p.tolerance) return { diff, level: 'ok', msg: 'इनवॉइस और पंप की डेंसिटी लगभग बराबर हैं (फ़र्क ' + diff + ' kg/m³)। सामान्य है।' };
    if (diff > 0) return { diff, level: 'warn', msg: 'पंप पर डेंसिटी इनवॉइस से ' + abs + ' ज़्यादा है। भारी हिस्से की मिलावट या पुराना बचा माल हो सकता है। सैंपल दोबारा लें और लीटर इनवॉइस से मिलाएँ।' };
    return { diff, level: 'warn', msg: 'पंप पर डेंसिटी इनवॉइस से ' + abs + ' कम है। हल्के हिस्से का मिश्रण, पानी या गलत तापमान रीडिंग संभव है। तापमान और हाइड्रोमीटर दोबारा नापें।' };
  }

  async function weatherSuggest() {
    try {
      const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + UTT.lat + '&longitude=' + UTT.lon +
        '&current=temperature_2m&daily=temperature_2m_mean&past_days=7&forecast_days=1&timezone=Asia%2FKolkata';
      const j = await (await fetch(u)).json();
      const now = j.current && j.current.temperature_2m;
      const days = ((j.daily && j.daily.temperature_2m_mean) || []).filter(x => x != null);
      if (now == null || !days.length) return { ok: false, msg: 'मौसम का डेटा नहीं मिला।' };
      const avg = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
      let tip = now > 35 ? 'गर्मी ज़्यादा है: सुबह जल्दी या शाम को माल उतारें, और 15°C पर सुधार ज़रूर करें।'
        : now < 10 ? 'ठंड है: सैंपल को कुछ देर रखकर तापमान स्थिर होने दें, फिर नापें।'
        : 'मौसम सामान्य है: नापने से पहले सैंपल का तापमान स्थिर होने दें।';
      return { ok: true, msg: 'अभी हवा ' + now + '°C, पिछले 7 दिन का औसत ' + avg + '°C। टैंक/माल का अनुमानित तापमान लगभग ' + avg + '°C (' + UTT.place + ')। ' + tip };
    } catch (e) { return { ok: false, msg: 'मौसम नहीं मिल पाया: ' + (e.message || e) }; }
  }

  async function saveLog(rec) {
    await APP.db.collection('density_log').add({ ...rec, by: (APP.S && APP.S.user && APP.S.user.email) || '', at: APP.FV.serverTimestamp(), date: APP.todayISO() });
  }

  const CSS = {
    ov: 'position:fixed;inset:0;background:#070b1f;z-index:99999;overflow:auto;font-family:system-ui,-apple-system,sans-serif;color:#e8edff',
    wrap: 'max-width:440px;margin:0 auto;padding:18px 16px 40px',
    head: 'font-size:28px;font-weight:800;margin:4px 0 14px;letter-spacing:.5px;display:flex;justify-content:space-between;align-items:center',
    hero: 'border-radius:22px;padding:18px;background:linear-gradient(135deg,#0d1f5c,#2452e0);box-shadow:0 10px 30px rgba(36,82,224,.35);display:flex;justify-content:space-between;align-items:center;min-height:150px',
    panel: 'margin-top:14px;border-radius:20px;padding:16px;background:#0e1636;border:1px solid #1b2a5a',
    lbl: 'font-size:13px;color:#9fb0e0;margin:10px 0 6px',
    inp: 'width:100%;box-sizing:border-box;padding:14px;border-radius:14px;border:1px solid #27407f;background:#0a1230;color:#fff;font-size:20px;font-weight:700',
    btn: 'flex:1;padding:14px;border-radius:14px;border:none;font-weight:800;font-size:17px',
  };

  function open() {
    if (!PS.isCustomPump() || !(APP.isOwner && APP.isOwner())) return APP.toast && APP.toast('डेंसिटी सिर्फ़ मालिक के लिए है');
    const ov = document.createElement('div');
    ov.id = 'dn-ov'; ov.style.cssText = CSS.ov;
    ov.innerHTML =
      '<div style="' + CSS.wrap + '">' +
        '<div style="' + CSS.head + '"><span>Density</span><button id="dn-x" style="border:none;background:none;color:#9fb0e0;font-size:26px">✕</button></div>' +
        '<div style="' + CSS.hero + '"><div>' +
          '<div style="font-size:14px;color:#c9d6ff">Density at 15 °C</div>' +
          '<div id="dn-big" style="font-size:52px;font-weight:800;margin:4px 0">—</div>' +
          '<div style="color:#c9d6ff">kg/m³</div></div>' +
          '<div style="font-size:54px;opacity:.9">🧪</div></div>' +
        '<div style="' + CSS.panel + '">' +
          '<div style="' + CSS.lbl + '">Fuel type</div>' +
          '<select id="dn-p" style="' + CSS.inp + '">' + Object.keys(PRODUCT).map(k => '<option value="' + k + '">' + PRODUCT[k].label + '</option>').join('') + '</select>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<div><div style="' + CSS.lbl + '">Hydrometer density</div><div style="position:relative"><input id="dn-h" type="number" step="0.1" inputmode="decimal" style="' + CSS.inp + '"><span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#7f93cc;font-size:13px">kg/m³</span></div></div>' +
            '<div><div style="' + CSS.lbl + '">Temperature</div><div style="position:relative"><input id="dn-t" type="number" step="0.25" inputmode="decimal" style="' + CSS.inp + '"><span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#7f93cc;font-size:13px">°C</span></div></div>' +
          '</div>' +
          '<div style="font-size:12px;color:#7f93cc;margin-top:6px">तापमान 0.25°C के गुणे में डालें</div>' +
          '<div style="display:flex;gap:10px;margin-top:14px">' +
            '<button id="dn-clr" style="' + CSS.btn + ';background:#0a1230;color:#8fb0ff;border:1px solid #27407f">Clear</button>' +
            '<button id="dn-calc" style="' + CSS.btn + ';background:linear-gradient(135deg,#3a63f0,#2452e0);color:#fff">Calculate</button>' +
          '</div>' +
          '<div id="dn-out" style="margin-top:12px;font-size:14px"></div>' +
        '</div>' +
        '<div style="' + CSS.panel + '">' +
          '<div style="font-weight:800;font-size:16px;margin-bottom:6px">रिकॉर्ड के लिए</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<input id="dn-veh" placeholder="गाड़ी नं." style="' + CSS.inp.replace('font-size:20px;font-weight:700', 'font-size:15px') + '">' +
            '<input id="dn-drv" placeholder="ड्राइवर" style="' + CSS.inp.replace('font-size:20px;font-weight:700', 'font-size:15px') + '">' +
            '<input id="dn-inv" placeholder="इनवॉइस नं." style="' + CSS.inp.replace('font-size:20px;font-weight:700', 'font-size:15px') + '">' +
            '<input id="dn-idn" type="number" step="0.1" placeholder="इनवॉइस kg/m³" style="' + CSS.inp.replace('font-size:20px;font-weight:700', 'font-size:15px') + '">' +
          '</div>' +
          '<div style="display:flex;gap:10px;margin-top:12px">' +
            '<button id="dn-save" style="' + CSS.btn + ';background:#15803d;color:#fff">सेव करें</button>' +
            '<button id="dn-wx" style="' + CSS.btn + ';background:#0a1230;color:#8fb0ff;border:1px solid #27407f">तापमान सुझाव</button>' +
          '</div>' +
          '<div id="dn-msg" style="margin-top:12px;font-size:14px"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    const $ = id => ov.querySelector('#' + id);
    const num = id => { const v = $(id).value; return v === '' ? null : Number(v); };
    let last = null;

    $('dn-x').onclick = () => ov.remove();
    $('dn-clr').onclick = () => { $('dn-h').value = ''; $('dn-t').value = ''; $('dn-big').textContent = '—'; $('dn-out').innerHTML = ''; last = null; };
    $('dn-calc').onclick = () => {
      const prod = $('dn-p').value, t = num('dn-t'), h = num('dn-h');
      if (t == null || h == null) return ($('dn-out').innerHTML = '<span style="color:#ff8a8a">तापमान और हाइड्रोमीटर दोनों भरें</span>');
      if (Math.abs(t * 4 - Math.round(t * 4)) > 1e-9) return ($('dn-out').innerHTML = '<span style="color:#ff8a8a">तापमान 0.25°C के गुणे में डालें</span>');
      last = solve(prod, t, h, null);
      $('dn-big').textContent = last.rho15.toFixed(1);
      const rc = rangeCheck(prod, last.rho15);
      $('dn-out').innerHTML = '<div style="background:#0a1230;border-radius:14px;padding:12px;border:1px solid ' + (rc.ok ? '#1f6b44' : '#8a2b2b') + '"><div style="color:' + (rc.ok ? '#7ee2a8' : '#ff9a9a') + ';font-weight:700">' + (rc.ok ? '✔ ' : '⚠ ') + esc(rc.msg) + '</div></div>';
    };
    $('dn-wx').onclick = async () => {
      $('dn-msg').textContent = 'मौसम देख रहे हैं…';
      const w = await weatherSuggest();
      $('dn-msg').innerHTML = '<div style="background:#0a1230;border-radius:14px;padding:12px;color:#c9d6ff">' + esc(w.msg) + '</div>';
    };
    $('dn-save').onclick = async () => {
      if (!last) return ($('dn-msg').innerHTML = '<span style="color:#ff8a8a">पहले Calculate दबाएँ</span>');
      const prod = $('dn-p').value, inv = num('dn-idn');
      const rec = { product: prod, temp: last.temp, hydro: last.hydro, rho15: last.rho15, vehicle: $('dn-veh').value.trim(), driver: $('dn-drv').value.trim(), invoiceNo: $('dn-inv').value.trim(), invoiceRho15: inv };
      let extra = '';
      if (inv != null) { const a = invoiceAdvice(prod, inv, last.rho15); rec.diffVsInvoice = a.diff; rec.diffLevel = a.level; extra = '<div style="margin-top:6px;color:#c9d6ff">' + esc(a.msg) + '</div>'; }
      try { await saveLog(rec); $('dn-msg').innerHTML = '<div style="color:#7ee2a8;font-weight:700">सेव हो गया ✔</div>' + extra; }
      catch (e) { $('dn-msg').innerHTML = '<span style="color:#ff9a9a">सेव नहीं हुआ: ' + esc(e.message || e) + '</span>'; }
    };
  }

  function card() {
    if (!PS.isCustomPump() || !(APP.isOwner && APP.isOwner()) || document.getElementById('dn-card')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const c = document.createElement('div');
    c.id = 'dn-card'; c.className = 'card'; c.style.marginBottom = '12px';
    c.innerHTML = '<b>🧪 Density</b><p class="mut" style="font-size:12px;margin:4px 0 8px">Hydrometer और तापमान से 15°C density, सरकारी रेंज अलर्ट, इनवॉइस मिलान और मौसम सुझाव।</p><button id="dn-open" class="btn full">Density खोलें</button>';
    main.prepend(c);
    document.getElementById('dn-open').onclick = open;
  }

  setTimeout(() => {
    const A = window.APP; if (!A || !A.views || typeof A.views.more !== 'function') return;
    const o = A.views.more;
    A.views.more = async function () { const r = await o.apply(this, arguments); try { card(); } catch (e) { } return r; };
  }, 3000);
})();
