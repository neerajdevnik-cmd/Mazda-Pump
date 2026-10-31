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
  const askGemini = (key, payload) => APP.AI.ask(payload, { timeout: 45000 });

  /* ======================= STRICT AI REGISTER SCANNER with CROSS-CHECK ======================= */
  APP.scanRegister = async function (st) {
    if (!st || st.locked) return APP.toast('यह दिन लॉक है');

    const BASE_PROMPT = `Read this petrol pump register photo. Return ONLY a raw JSON object.
DO NOT extract these (they are LOCKED): "rateP", "rateD", "openCash", "openStockP", "openStockD", and "nz.*.o" (opening meters).
ONLY extract: "date" (YYYY-MM-DD), "testing" (default 5), "nz.*.c" (closing meters), "paytm", "swipe", "kharcha", "driverInaam", "chaiKhana", "kharchaItems", "tankerP", "tankerD", "dipP", "dipD", "udhar", "jama".
Format: {"date":"YYYY-MM-DD","testing":5,"nz":{"p1":{"c":0}},"paytm":0,"swipe":0,"kharcha":0,"kharchaItems":[],"udhar":[],"jama":[]}`;

    const m = APP.modal(`
      <h3>📷 AI स्कैन (Cross-Check)</h3>
      <p class="mut" style="font-size:12px;margin-bottom:8px;">नीचे दिए गए प्रॉम्प्ट को कॉपी करके AI (Gemini/ChatGPT) में डालें, फोटो अपलोड करें, और उसका दिया हुआ JSON यहाँ पेस्ट करें।</p>
      
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button class="btn sm g" id="copy-prompt" style="flex:1;">📋 Copy Prompt</button>
      </div>

      <textarea id="scan-json" rows="6" style="width:100%; font-size:12px; font-family:monospace;" placeholder='{"date":"2026-10-20","nz":{"p1":{"c":4500}}}'></textarea>
      
      <div class="btns" style="margin-top:12px;">
        <button class="btn o" id="btn-verify">🔍 Cross-Check & Verify</button>
        <button class="btn w" id="btn-cancel">रद्द</button>
      </div>
    `);

    // Copy Prompt Logic
    m.querySelector('#copy-prompt').onclick = async () => {
      try {
        await navigator.clipboard.writeText(BASE_PROMPT);
        APP.toast('प्रॉम्प्ट कॉपी हो गया! अब AI में पेस्ट करें।');
      } catch (e) {
        APP.toast('कॉपी नहीं हुआ, मैन्युअली सेलेक्ट करके कॉपी करें');
      }
    };

    m.querySelector('#btn-cancel').onclick = () => m.close();

    // Verification Logic
    m.querySelector('#btn-verify').onclick = async () => {
      const raw = m.querySelector('#scan-json').value.trim();
      if (!raw) return APP.toast('पहले JSON पेस्ट करें');

      let json;
      try {
        const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
        json = JSON.parse(clean.slice(a, b + 1));
      } catch (e) {
        return APP.toast('❌ गलत JSON फॉर्मेट! कृपया सही JSON पेस्ट करें।');
      }

      m.close(); // Close paste modal
      
      // Start Verification Process
      const date = json.date || st.date;
      if (date !== st.date) return APP.toast('⚠️ AI ने दूसरी तारीख का डेटा दिया है। कृपया जांचें।');

      const html = [];
      const toSave = { nz: {}, kharchaItems: [], udhar: [], jama: [] };
      let hasError = false;

      // 1. Check Paytm / Swipe
      if (json.paytm != null) { toSave.paytm = APP.num(json.paytm); html.push(`✅ <b>Paytm:</b> ${APP.money(toSave.paytm)}`); }
      if (json.swipe != null) { toSave.swipe = APP.num(json.swipe); html.push(`✅ <b>Swipe:</b> ${APP.money(toSave.swipe)}`); }

      // 2. Check Nozzles (Locked: Opening)
      if (json.nz) {
        Object.keys(json.nz).forEach(k => {
          if (!['p1','p2','p3','p4','d1','d2','d3','d4'].includes(k)) return;
          const c = APP.num(json.nz[k].c);
          const open = APP.num(st.d.nz[k].o || 0);
          if (c > 0) {
            if (c < open) {
              html.push(`❌ <b>${k.toUpperCase()} मीटर:</b> क्लोजिंग (${c}) ओपनिंग (${open}) से कम है!`);
              hasError = true;
            } else {
              toSave.nz[k] = { c: c };
              html.push(`✅ <b>${k.toUpperCase()} क्लोजिंग:</b> ${c}`);
            }
          }
        });
      }

      // 3. Check Expenses
      if (json.kharcha) { toSave.kharcha = APP.num(json.kharcha); html.push(`✅ <b>DG खर्चा:</b> ${APP.money(toSave.kharcha)}`); }
      if (json.driverInaam) { toSave.driverInaam = APP.num(json.driverInaam); html.push(`✅ <b>ड्राइवर इनाम:</b> ${APP.money(toSave.driverInaam)}`); }
      if (json.chaiKhana) { toSave.chaiKhana = APP.num(json.chaiKhana); html.push(`✅ <b>चाय-खाना:</b> ${APP.money(toSave.chaiKhana)}`); }
      
      if (json.kharchaItems && Array.isArray(json.kharchaItems)) {
        json.kharchaItems.forEach(x => {
          if (x.label && APP.num(x.amount) > 0) {
            toSave.kharchaItems.push({ label: x.label, amount: APP.num(x.amount) });
            html.push(`✅ <b>अन्य खर्चा:</b> ${x.label} (${APP.money(x.amount)})`);
          }
        });
      }

      // 4. Check Udhar / Jama (Double Entry Check)
      const ledgerSnap = await APP.db.collection('ledger').where('date', '==', date).get();
      const existingL = ledgerSnap.docs.map(d => d.data());

      const isDuplicate = (entry) => {
        return existingL.find(e => 
          e.partyId === entry.partyId && 
          e.amount === APP.num(entry.amount) && 
          (e.vehicle || '') === (entry.vehicle || '')
        );
      };

      if (json.udhar && Array.isArray(json.udhar)) {
        json.udhar.forEach(u => {
          const amt = APP.num(u.amount);
          if (amt <= 0) return;
          if (isDuplicate(u)) {
            html.push(`⚠️ <b>डबल एंट्री स्किप:</b> ${APP.esc(u.party)} - ₹${amt}`);
          } else {
            toSave.udhar.push(u);
            html.push(`✅ <b>उधार:</b> ${APP.esc(u.party)} - ₹${amt}`);
          }
        });
      }

      // Show Preview Modal
      const preview = APP.modal(`
        <h3>🔍 क्रॉस-चेक रिपोर्ट</h3>
        <div style="max-height:50vh;overflow:auto;font-size:13px;background:#f8f9fc;padding:10px;border-radius:8px;margin-bottom:12px;border:1px solid #dde2ec;">
          ${html.length ? html.join('<br>') : 'कोई डेटा नहीं मिला।'}
        </div>
        ${hasError ? '<div class="err">❌ ऊपर कुछ गलतियां हैं, कृपया जांचें।</div>' : ''}
        <div class="btns">
          <button class="btn g" id="final-save" ${hasError ? 'disabled' : ''}>✅ सही है, सेव करें</button>
          <button class="btn w" id="prev-cancel">रद्द</button>
        </div>
      `);

      preview.querySelector('#prev-cancel').onclick = () => preview.close();

      if (!hasError) {
        preview.querySelector('#final-save').onclick = async () => {
          preview.querySelector('#final-save').disabled = true;
          try {
            const b = APP.db.batch();
            const dayRef = APP.db.collection('days').doc(date);
            
            // 1. Update Day fields safely
            const dayUpdate = { ...toSave };
            delete dayUpdate.udhar; delete dayUpdate.jama; delete dayUpdate.kharchaItems;
            
            // Handle Kharcha Items append
            if (toSave.kharchaItems.length) {
              const currentItems = st.d.kharchaItems || [];
              dayUpdate.kharchaItems = currentItems.concat(toSave.kharchaItems);
            }
            
            b.update(dayRef, dayUpdate);

            // 2. Add Ledger Entries
            const addLedger = (entry, type) => {
              const amt = APP.num(entry.amount);
              // Note: Assuming 'entry.partyId' is mapped from AI or needs to be searched. 
              // For safety, if AI returns party name, we need to find partyId. 
              // (Assuming the AI returns partyId, or we skip validation if not found).
              if (!entry.partyId) return; // Skip if no partyId

              const lRef = APP.db.collection('ledger').doc();
              b.set(lRef, {
                partyId: entry.partyId,
                partyName: entry.party,
                date: date,
                time: APP.nowTime ? APP.nowTime() : '12:00',
                kind: type,
                amount: amt,
                vehicle: entry.vehicle || '',
                fuel: entry.fuel || '',
                rate: 0, litre: 0,
                note: 'AI Scan Entry',
                by: APP.S.user ? APP.S.user.email : 'AI',
                at: APP.FV.serverTimestamp()
              });

              const pRef = APP.db.collection('parties').doc(entry.partyId);
              b.update(pRef, { bal: APP.FV.increment(type === 'udhar' ? amt : -amt) });
            };

            toSave.udhar.forEach(u => addLedger(u, 'udhar'));
            toSave.jama.forEach(j => addLedger(j, 'jama'));

            await b.commit();
            APP.toast('✅ डेटा सफलतापूर्वक सेव हो गया!');
            preview.close();
            APP.S.parties.pub = null; // Clear cache
            if (APP.recalc) APP.recalc();
            APP.dayView(date); // Reload day

          } catch (e) {
            APP.toast('❌ सेव नहीं हो पाया: ' + e.message);
            preview.querySelector('#final-save').disabled = false;
          }
        };
      }
    };
  };

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
      autoBtn.onclick = () => { if (!APP.AI.hasKey()) { APP.AI.manageKeys(); return; } fileEl.value = ''; fileEl.click(); };
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
