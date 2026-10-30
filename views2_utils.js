/* Mazda Oil Company - Views Utils (Thermal Slip & AI Scanner) */
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

  /* ======================= AI REGISTER SCANNER (v2) ======================= */
  APP.scanRegister = async function (st) {
    const esc = APP.esc;
    const NZ = K.NZ;
    const clean = s => String(s == null ? '' : s).replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    const nrm = s => clean(s).toLowerCase().replace(/[\s.\-_(),]+/g, '');
    const nrmVeh = s => clean(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const numOrNull = v => {
      if (v === undefined || v === null) return null;
      const t = String(v).replace(/[,₹\s]/g, '');
      if (t === '') return null;
      const n = Number(t);
      return isNaN(n) ? null : n;
    };

    const AL_KEY = 'mazda_scan_alias';
    const alias = (() => { try { const a = JSON.parse(localStorage.getItem(AL_KEY) || '{}'); return { n: a.n || {}, v: a.v || {} }; } catch (e) { return { n: {}, v: {} }; } })();
    const saveAlias = () => { try { localStorage.setItem(AL_KEY, JSON.stringify(alias)); } catch (e) { } };
    const nrmHi = s => clean(s).toLowerCase().replace(/[\u093c\u200d\u200c]/g, '').replace(/\u0901/g, '\u0902').replace(/[\s.\-_(),]+/g, '');
    const sim = (a, b) => {
      if (!a || !b) return 0;
      if (a === b) return 1;
      const m = a.length, n = b.length;
      let prev = Array.from({ length: n + 1 }, (_, j) => j);
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
      return 1 - prev[n] / Math.max(m, n);
    };
    const digitsOf = s => String(s || '').replace(/\D/g, '');
    const BASE_PROMPT = `Ye petrol pump ke daily hisab register ki photo hai. Photo padhkar SIRF ek JSON do (koi explanation, koi code-fence, koi extra text nahi). Format:
{"date":"YYYY-MM-DD","rateP":0,"rateD":0,"testing":5,
"nz":{"p1":{"o":0,"c":0},"p2":{"o":0,"c":0},"p3":{"o":0,"c":0},"p4":{"o":0,"c":0},"d1":{"o":0,"c":0},"d2":{"o":0,"c":0},"d3":{"o":0,"c":0},"d4":{"o":0,"c":0}},
"openCash":0,"paytm":0,"swipe":0,"kharcha":0,"driverInaam":0,"chaiKhana":0,"kharchaItems":[{"label":"","amount":0}],"malikDiya":0,
"openStockP":0,"openStockD":0,"tankerP":0,"tankerD":0,"dipP":0,"dipD":0,"note":"",
"udhar":[{"party":"","vehicle":"","fuel":"diesel","litre":0,"amount":0}],
"jama":[{"party":"","mode":"cash","amount":0}]}
Rules: p1-p4 petrol nozzle, d1-d4 diesel nozzle; o=opening, c=closing. Sirf numbers (koi rupee sign ya comma nahi). Jo cheez photo mein na dikhe wo key mat likho. fuel sirf "petrol"/"diesel". jama mode sirf cash/paytm/swipe/bank. Register mein "AD" likha ho to wo purane din ka cash hai: usko jama mein mat daalo, "openCash" mein likho. Date YYYY-MM-DD.
Kharcha ke rules: "kharcha" mein SIRF DG/generator ka kharcha likho, "driverInaam" mein driver ka inaam, "chaiKhana" mein chai-khana. Baaki har alag kharcha (jaise puncture, safai, bijli, repair) "kharchaItems" mein ALAG-ALAG likho, har ek ka "label" (kis cheez ka) aur "amount" ke saath.`;
    const buildPrompt = parties => BASE_PROMPT +
      '\n\nPARTY LIST (party ka naam SIRF is list se, bilkul isi spelling mein likho. Gaadi number se bhi party pehchano):\n' +
      parties.map(p => '- ' + p.name + (p.vehicles && p.vehicles.length ? '  (gaadi: ' + p.vehicles.join(', ') + ')' : '')).join('\n');

    const KEY_LS = 'mazda_gemini_key', MODEL_LS = 'mazda_gemini_model';
    const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
    const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
    const getKey = () => lsGet(KEY_LS);
    const askKey = () => {
      const k = prompt('Gemini API key paste karein (aistudio.google.com/app/apikey se). Ye sirf is phone mein save hogi:', getKey());
      if (k === null) return false;
      lsSet(KEY_LS, k.trim()); lsSet(MODEL_LS, '');
      return !!k.trim();
    };
    const GBASE = 'https://generativelanguage.googleapis.com/v1beta';
    const gErr = (code, j) => {
      const m = (j && j.error && j.error.message) || ('HTTP ' + code);
      const hint = code === 400 && /api key/i.test(m) ? 'Key galat hai.'
        : code === 403 ? 'Key ko permission nahi.'
        : code === 429 ? 'Free limit poori — thodi der baad.'
        : code === 503 ? 'Gemini busy — dobara try.' : '';
      return 'Gemini error (' + code + '): ' + m + (hint ? ' ' + hint : '');
    };
    const gfetch = async (path, init, key) => {
      const tries = [
        () => fetch(GBASE + path, Object.assign({}, init, { headers: Object.assign({}, init.headers || {}, { 'x-goog-api-key': key }) })),
        () => fetch(GBASE + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(key), init)
      ];
      let last;
      for (const t of tries) { try { return await t(); } catch (e) { last = e; } }
      throw new Error('नेट ब्लॉक: ' + ((last && last.message) || '') + ' — VPN/Private Relay बंद करें');
    };
    const listModels = async key => {
      const r = await gfetch('/models?pageSize=200', {}, key);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(gErr(r.status, j));
      const all = (j.models || []).filter(x => (x.supportedGenerationMethods || []).includes('generateContent')).map(x => x.name.replace(/^models\//, ''));
      const ver = n => { const m = /^gemini-(\d+(?:\.\d+)?)-flash/.exec(n); return m ? parseFloat(m[1]) : 0; };
      const flash = all.filter(n => ver(n) > 0 && !/image|tts|live|audio|embed|thinking|robotics|computer|exp|8b/.test(n));
      const rank = n => (/preview/.test(n) ? 0 : /lite/.test(n) ? 1 : 2);
      flash.sort((a, b) => rank(b) - rank(a) || ver(b) - ver(a));
      const out = flash.slice(0, 3);
      if (all.includes('gemini-flash-latest')) out.push('gemini-flash-latest');
      return out;
    };
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
    const geminiReadOnce = async (file, maxPx, q) => {
      const key = getKey(); if (!key) throw new Error('पहले 🔑 Gemini key डालें');
      const b64 = await toJpegB64(file, maxPx, q);
      let ps = []; try { ps = await APP.getParties(false, true); } catch (e) { }
      const ask = buildPrompt(ps) + '\n\nAaj ki tareekh ' + ((st && st.date) || APP.todayISO()) + ' hai.';
      const body = JSON.stringify({ contents: [{ parts: [{ text: ask }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } });
      let models = lsGet(MODEL_LS) ? [lsGet(MODEL_LS)] : [], lastErr;
      const tryModel = async model => {
        const r = await gfetch('/models/' + model + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, key);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(gErr(r.status, j)); e.status = r.status; throw e; }
        const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = parts.map(x => x.text || '').join('');
        if (!txt.trim()) throw new Error('Gemini khaali jawab');
        return txt;
      };
      for (let round = 0; round < 2; round++) {
        for (const mdl of models) {
          try { const out = await tryModel(mdl); lsSet(MODEL_LS, mdl); return out; }
          catch (e) { lastErr = e; if (![404, 429, 500, 503].includes(e.status)) throw e; }
        }
        if (round === 0) { lsSet(MODEL_LS, ''); models = await listModels(key); if (!models.length) throw new Error('Model nahi mila'); }
      }
      throw lastErr;
    };
    const geminiRead = async file => {
      try { return await geminiReadOnce(file, 1600, 0.88); }
      catch (e) { if (e.status === -1) return await geminiReadOnce(file, 1000, 0.8); throw e; }
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
        catch (e) { autoBtn.disabled = false; autoBtn.textContent = '📷 फोटो से भरें'; alert(e.message); }
      };
      $('#scan-ok', m).onclick = () => { const v = ta.value; m.close(); resolve(v); };
      $('#scan-no', m).onclick = () => { m.close(); resolve(null); };
    });
    if (!text || !text.trim()) return;

    let raw;
    try {
      let t = text.replace(/```json/gi, '').replace(/```/g, '');
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a < 0 || b < a) throw new Error('{ } नहीं मिला');
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

  console.log('[Mazda views2_utils.js] loaded ✓');
})();
