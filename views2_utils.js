/* Mazda Oil Company - Views Utils (Thermal Slip & AI Scanner Fix) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const r2 = (n) => (K && K.r2 ? K.r2(n) : Number(n || 0).toFixed(2));
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const today = () => APP.todayISO();

  const MOC_BPCL_LOGO = `<img src="./logo.png" alt="" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 6px auto;border-radius:50%">`;

  /* ======================= BPCL THERMAL SLIP ======================= */
  APP.showThermalSlip = function (data) {
    const inv = 'CR' + String(data.date || '').replace(/-/g, '').slice(2) + String(data.time || '').replace(':', '') + String(data.vehicle || '').replace(/\D/g, '').slice(-4);
    const slipDOM = `
      <div id="slip-capture-node" style="background:#faf8f5;color:#111;font-family:'Courier New',Courier,monospace;padding:18px 14px;width:275px;margin:0 auto;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,0.15);border-radius:3px;">
        <div style="text-align:center;margin-bottom:8px;">
          ${MOC_BPCL_LOGO}
          <b style="font-size:14px;letter-spacing:0.5px;">उधार पर्ची / CREDIT SLIP</b><br>
          <div style="font-size:12px;margin:2px 0;font-weight:bold;">${esc(C.pump.nameEn)}</div>
          <div style="font-size:10px;color:#444;">${esc(C.pump.addressEn)}</div>
        </div>
        <div style="border-top:1px dashed #666;margin:6px 0;"></div>
        <div>Tel. No.: ${esc(C.pump.phone)}</div>
        <div>Slip No: ${inv}</div>
        <div>Product : ${(data.fuel || 'Diesel').toUpperCase()}</div>
        <div>Rate(Rs/L) : &nbsp; ${Number(data.rate).toFixed(2)}</div>
        <div>Volume(L) : &nbsp; ${Number(data.litre).toFixed(2)}</div>
        <div style="font-size:14px;font-weight:bold;margin:2px 0;">Amount(Rs) : &nbsp; ${Number(data.amount).toFixed(2)}</div>
        <div style="border-top:1px dashed #666;margin:6px 0;"></div>
        <div>Vehicle No: <b>${esc(data.vehicle || 'CASH')}</b></div>
        <div>Customer : ${esc(data.partyName || 'WALK-IN')}</div>
        <div>Date : ${dmy(data.date)} &nbsp;Time: ${data.time || APP.nowTime()}</div>
        <div style="border-top:1px dashed #666;margin:6px 0;"></div>
        <div style="text-align:center;margin-top:8px;">धन्यवाद! फिर पधारें<br><span style="font-size:9px;color:#666">यह उधार पर्ची है, टैक्स इनवॉइस नहीं</span></div>
      </div>`;

    const m = modal(`
      <h3>🖨️ उधार पर्ची</h3>
      <div style="padding:10px 0;text-align:center;">${slipDOM}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn bpcl full" id="slip-share">📤 WhatsApp पर शेयर करें (Image)</button>
        <button class="btn w full" id="slip-close">बंद करें</button>
      </div>`);

    $('#slip-close', m).onclick = () => m.close();
    $('#slip-share', m).onclick = async () => {
      toast('पर्ची इमेज तैयार हो रही है…');
      try {
        const node = $('#slip-capture-node', m);
        const cv = await html2canvas(node, { scale: 2.5, backgroundColor: '#faf8f5' });
        cv.toBlob(async blob => {
          const file = new File([blob], `slip-${data.vehicle || 'bpcl'}.png`, { type: 'image/png' });
          const text = `*माज़दा ऑयल कंपनी (BPCL)*\nगाड़ी: ${data.vehicle}\nलीटर: ${data.litre} L\nरकम: ₹${data.amount}`;
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: text });
          } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = file.name; a.click();
            toast('पर्ची डाउनलोड हो गई ✔');
          }
        }, 'image/png');
      } catch (e) { toast('इमेज नहीं बनी: ' + e.message); }
    };
  };

  /* ======================= STRICT AI REGISTER SCANNER ======================= */
  async function askGemini(key, payload) {
    // 🔥 FIX: Added gemini-3.8-flash
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
    let lastErr = new Error('AI connect नहीं हो पाया (API Key या Net चेक करें)');

    for (const model of modelsToTry) {
      try {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 15000);
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal
        });
        clearTimeout(tId);
        
        const data = await res.json();
        if (!res.ok) {
          lastErr = new Error(data.error?.message || 'HTTP ' + res.status);
          continue; 
        }
        
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt && txt.trim()) return txt;
        else lastErr = new Error('AI ne khaali jawab diya');
      } catch(e) { 
        lastErr = e;
        if (e.name === 'AbortError') lastErr = new Error('Net Timeout (15 sec)');
      }
    }
    throw lastErr;
  }

  APP.scanRegister = async function (st) {
    const esc = APP.esc;
    const NZ = K.NZ;
    const clean = s => String(s == null ? '' : s).replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    const numOrNull = v => {
      if (v === undefined || v === null) return null;
      const t = String(v).replace(/[,₹\s]/g, '');
      if (t === '') return null;
      const n = Number(t);
      return isNaN(n) ? null : n;
    };

    const KEY_LS = 'mazda_gemini_key', MODEL_LS = 'mazda_gemini_model';
    const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
    const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
    const getKey = () => lsGet(KEY_LS);
    const askKey = () => {
      const k = prompt('Gemini API key paste karein (aistudio.google.com/app/apikey se):', getKey());
      if (k === null) return false;
      lsSet(KEY_LS, k.trim()); lsSet(MODEL_LS, '');
      return !!k.trim();
    };
    
    const BASE_PROMPT = `Read this petrol pump register photo. Return ONLY a raw JSON object (no markdown, no backticks):
{"date":"YYYY-MM-DD","rateP":0,"rateD":0,"testing":5,
"nz":{"p1":{"o":0,"c":0},"p2":{"o":0,"c":0},"p3":{"o":0,"c":0},"p4":{"o":0,"c":0},"d1":{"o":0,"c":0},"d2":{"o":0,"c":0},"d3":{"o":0,"c":0},"d4":{"o":0,"c":0}},
"openCash":0,"paytm":0,"swipe":0,"kharcha":0,"driverInaam":0,"chaiKhana":0,"kharchaItems":[{"label":"","amount":0}],"malikDiya":0,
"openStockP":0,"openStockD":0,"tankerP":0,"tankerD":0,"dipP":0,"dipD":0,"note":"",
"udhar":[{"party":"","vehicle":"","fuel":"diesel","litre":0,"amount":0}],
"jama":[{"party":"","mode":"cash","amount":0}]}
Rules: If 'AD' is written, put it in 'openCash'. Extract party names exactly as written.`;

    const toJpegB64 = (file, maxPx, q) => new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', q).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('फोटो खुल नहीं पाई')); };
      img.src = url;
    });

    const geminiRead = async (file) => {
      const key = getKey(); if (!key) throw new Error('पहले 🔑 Gemini key डालें');
      const b64 = await toJpegB64(file, 800, 0.7);
      
      const payload = { contents: [{ parts: [{ text: BASE_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { temperature: 0 } };
      const txt = await askGemini(key, payload);
      return txt;
    };

    const text = await new Promise(resolve => {
      const m = modal(`
        <h3>📷 AI कोड पेस्ट करें</h3>
        <p class="mut" style="margin:4px 0 8px">Gemini / Claude का दिया JSON यहाँ पेस्ट करें</p>
        <textarea id="scan-ta" rows="9" style="width:100%;font-size:13px" placeholder='{ "date": "..." }'></textarea>
        <div class="btns" style="margin-top:10px">
          <button class="btn g" id="scan-auto">📷 फोटो से भरें</button>
          <button class="btn w" id="scan-key">🔑 Gemini key</button>
          <input type="file" id="scan-file" accept="image/*" style="display:none">
          <button class="btn w" id="scan-clip">📋 क्लिपबोर्ड</button>
          <button class="btn g" id="scan-ok">आगे</button>
          <button class="btn w" id="scan-no">रद्द</button>
        </div>`);
      const ta = $('#scan-ta', m);
      $('#scan-clip', m).onclick = async () => { try { ta.value = await navigator.clipboard.readText(); } catch (e) { toast('बॉक्स में पेस्ट करें'); } };
      const fileEl = $('#scan-file', m), autoBtn = $('#scan-auto', m);
      autoBtn.onclick = () => { if (!getKey() && !askKey()) return; fileEl.value = ''; fileEl.click(); };
      $('#scan-key', m).onclick = () => { askKey(); };
      fileEl.onchange = async () => {
        const f0 = fileEl.files && fileEl.files[0]; if (!f0) return;
        autoBtn.disabled = true; autoBtn.textContent = '⏳ AI पढ़ रहा…';
        try { ta.value = await geminiRead(f0); $('#scan-ok', m).click(); }
        catch (e) { autoBtn.disabled = false; autoBtn.textContent = '📷 फोटो से भरें'; alert(e.name === 'AbortError' ? 'AI Timeout! (Net slow hai)' : e.message); }
      };
      $('#scan-ok', m).onclick = () => { const v = ta.value; m.close(); resolve(v); };
      $('#scan-no', m).onclick = () => { m.close(); resolve(null); };
    });
    if (!text || !text.trim()) return;

    let raw;
    try {
      let t = text.replace(/```json/gi, '').replace(/```/g, '');
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a < 0 || b < a) throw new Error('AI ne JSON format mein jawab nahi diya');
      t = t.slice(a, b + 1).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/,\s*([}\]])/g, '$1');
      raw = JSON.parse(t);
    } catch (e) { alert('JSON पढ़ नहीं पाया: ' + e.message); return; }

    const f = {};
    const put = (id, v) => { const n = numOrNull(v); if (n !== null) f[id] = n; };
    const putTxt = (id, v) => { const s = clean(v); if (s) f[id] = s; };
    const pick = (...vals) => vals.find(v => v !== undefined && v !== null && clean(v) !== '');

    put('f-rateP', pick(raw.rateP, raw.petrol && raw.petrol.rate));
    put('f-rateD', pick(raw.rateD, raw.diesel && raw.diesel.rate));
    put('f-dipP', pick(raw.dipP, raw.petrol && raw.petrol.dip));
    put('f-dipD', pick(raw.dipD, raw.diesel && raw.diesel.dip));
    put('f-testing', pick(raw.testing, raw.test));
    put('f-openCash', pick(raw.openCash, raw.cash && raw.cash.openCash));
    put('f-paytm', pick(raw.paytm));
    put('f-swipe', pick(raw.swipe));
    put('f-kharcha', pick(raw.kharcha));
    put('f-driverInaam', pick(raw.driverInaam));
    put('f-chaiKhana', pick(raw.chaiKhana));
    put('f-malikDiya', pick(raw.malikDiya));
    put('f-openStockP', raw.openStockP); put('f-openStockD', raw.openStockD);
    put('f-tankerP', raw.tankerP); put('f-tankerD', raw.tankerD);
    putTxt('f-note', raw.note);

    const nz = {};
    if (raw.nz && typeof raw.nz === 'object') {
      NZ.forEach(k => {
        const x = raw.nz[k] || raw.nz[k.toUpperCase()];
        if (!x) return;
        const o = numOrNull(x.o !== undefined ? x.o : x.open);
        const c = numOrNull(x.c !== undefined ? x.c : x.close);
        if (o !== null || c !== null) nz[k] = { o, c };
      });
    }

    if (raw.udhar && raw.udhar.length) { toast(`${raw.udhar.length} उधार + ` + ((raw.jama && raw.jama.length) || 0) + ' जमा मिले'); }

    const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    Object.keys(f).forEach(id => { const el = $('#' + id); if (el && !el.disabled) { el.value = f[id]; fire(el); } });
    NZ.forEach(k => {
      const x = nz[k]; if (!x) return;
      const oEl = $(`.nzi[data-k="${k}"][data-f="o"]`), cEl = $(`.nzi[data-k="${k}"][data-f="c"]`);
      if (x.c !== null && cEl && !cEl.disabled) { cEl.value = x.c; fire(cEl); }
      if (x.o !== null && oEl && !oEl.disabled && clean(oEl.value) === '') { oEl.value = x.o; fire(oEl); }
    });
    try { APP.recalc(); } catch (e) { }
    toast('बॉक्स भर गए ✔ — जाँचकर 💾 सेव करें');
  };

  console.log('[Mazda views2_utils.js] Model 3.8 Added ✓');
})();
