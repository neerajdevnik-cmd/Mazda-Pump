/* Mazda Oil Company - Features Utils (Ultimate AI Scanner + Strict Cross-Check) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;

  const MOC_BPCL_LOGO = `<img src="./logo.png" alt="" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 6px auto;border-radius:50%">`;

  /* ======================= 1. BPCL THERMAL SLIP ======================= */
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

  /* ======================= 2. AI REGISTER SCANNER (Ultimate) ======================= */

  // Helper to format prompt with party names
  function buildAIPrompt(parties) {
    const partyList = parties.map(p => p.name).join(', ');
    return `You are an expert data extractor for an Indian Petrol Pump. Read this register photo carefully.
    
    STRICT RULES:
    1. "dipP" (Petrol Dip) and "dipD" (Diesel Dip) are in CM (centimeters). They are ALWAYS between 0 and 250. If you see a number like 7605 next to DIP, DO NOT extract it as dip, it is probably liters or sales. Find the actual dip (0-200).
    2. DO NOT extract locked fields: "rateP", "rateD", "openCash", "openStockP", "openStockD". They are already in the system.
    3. For "udhar" (Credit) and "jama" (Cash Received), extract the party name exactly as written. Try to match it with this list of existing parties: [${partyList}]. If exact match not found, write the name as is.
    4. Extract vehicle numbers exactly (e.g., UK01TA1234 or 4 digits like 4488).
    5. Extract kharcha (expenses) items correctly.
    6. Return ONLY a JSON object. No markdown, no extra text.

    JSON FORMAT:
    {
      "date": "YYYY-MM-DD",
      "testing": 5,
      "nz": { "p1": {"c": 0}, "p2": {"c": 0} },
      "paytm": 0, "swipe": 0, "kharcha": 0, "driverInaam": 0, "chaiKhana": 0,
      "kharchaItems": [{"label":"", "amount":0}],
      "tankerP": 0, "tankerD": 0, "dipP": 0, "dipD": 0,
      "udhar": [{"party":"", "vehicle":"", "fuel":"diesel", "litre":0, "amount":0}],
      "jama": [{"party":"", "mode":"cash", "amount":0}]
    }`;
  }

  // UI to Review and Fix AI Data
  function showReviewScreen(st, parties, json) {
    const date = st.date;
    const html = [];
    
    // Normalize Data
    const toSave = {
      nz: {}, kharchaItems: [], udhar: [], jama: [],
      paytm: num(json.paytm), swipe: num(json.swipe), kharcha: num(json.kharcha), 
      driverInaam: num(json.driverInaam), chaiKhana: num(json.chaiKhana),
      dipP: num(json.dipP), dipD: num(json.dipD), tankerP: num(json.tankerP), tankerD: num(json.tankerD)
    };

    // Meter Validation
    let nzHtml = '';
    if (json.nz) {
      Object.keys(json.nz).forEach(k => {
        if (!['p1','p2','p3','p4','d1','d2','d3','d4'].includes(k)) return;
        const c = num(json.nz[k].c);
        const o = num(st.d.nz && st.d.nz[k] ? st.d.nz[k].o : 0);
        if (c > 0) {
          let err = '';
          if (c < o) { err = `<span style="color:red;font-size:11px;">⚠️ क्लोजिंग ओपनिंग (${o}) से कम है</span>`; }
          nzHtml += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;">
            <b>${k.toUpperCase()}</b> 
            <input type="number" id="rv-nz-${k}" value="${c}" style="width:100px;padding:4px;text-align:right;">
            ${err}
          </div>`;
          toSave.nz[k] = { c: c };
        }
      });
    }

    // Dip Validation
    let dipErrP = (toSave.dipP > 250) ? `<span style="color:red;font-size:11px;">⚠️ गलत DIP (250 से बड़ा)</span>` : '';
    let dipErrD = (toSave.dipD > 250) ? `<span style="color:red;font-size:11px;">⚠️ गलत DIP (250 से बड़ा)</span>` : '';
    const dipHtml = `
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <b>पेट्रोल DIP (cm)</b> <input type="number" id="rv-dipP" value="${toSave.dipP || ''}" style="width:80px;padding:4px;text-align:right;"> ${dipErrP}
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;">
        <b>डीज़ल DIP (cm)</b> <input type="number" id="rv-dipD" value="${toSave.dipD || ''}" style="width:80px;padding:4px;text-align:right;"> ${dipErrD}
      </div>`;

    // Ledger (Udhar/Jama) Fix UI
    const renderLedgerItem = (item, type, idx) => {
      // Find closest party match
      let matchedId = '';
      if (item.party) {
        const found = parties.find(p => p.name.toLowerCase().includes(item.party.toLowerCase()) || item.party.toLowerCase().includes(p.name.toLowerCase()));
        if (found) matchedId = found.id;
      }

      const options = `<option value="">-- चुनें --</option>` + parties.map(p => `<option value="${p.id}" ${p.id === matchedId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
      
      return `
        <div style="border:1px solid #dde2ec;border-radius:8px;padding:8px;margin-bottom:6px;background:#fbfcff;" id="rv-ldg-${type}-${idx}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:bold;color:${type === 'udhar' ? '#b91c1c' : '#15803d'};">${type === 'udhar' ? '🔴 उधार' : '🟢 जमा'}</span>
            <input type="number" id="rv-amt-${type}-${idx}" value="${item.amount}" style="width:80px;padding:4px;font-weight:bold;text-align:right;">
          </div>
          <select id="rv-party-${type}-${idx}" style="width:100%;padding:4px;margin-bottom:4px;font-size:12px;">${options}</select>
          <div style="display:flex;gap:4px;">
            <input type="text" id="rv-veh-${type}-${idx}" value="${item.vehicle || ''}" placeholder="गाड़ी नंबर" style="flex:1;padding:4px;font-size:12px;text-transform:uppercase;">
            ${type === 'udhar' ? `<input type="number" id="rv-lit-${type}-${idx}" value="${item.litre || ''}" placeholder="लीटर" style="width:60px;padding:4px;font-size:12px;">` : ''}
          </div>
        </div>
      `;
    };

    let udharHtml = (json.udhar || []).map((u, i) => renderLedgerItem(u, 'udhar', i)).join('');
    let jamaHtml = (json.jama || []).map((j, i) => renderLedgerItem(j, 'jama', i)).join('');

    // Build Modal
    const m = modal(`
      <h3>🔍 क्रॉस-चेक और सुधार</h3>
      <div class="mut" style="font-size:12px;margin-bottom:8px;">AI ने जो पढ़ा है, उसे यहाँ सुधारें। सब सही होने पर ही 'सेव' दबाएं।</div>
      
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px;">
        
        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#0b3d91;">⛽ मीटर रीडिंग (क्लोजिंग)</h4>
          ${nzHtml || '<div class="mut">कोई मीटर रीडिंग नहीं मिली</div>'}
        </div>

        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#0b3d91;">🛢️ टैंक DIP (cm)</h4>
          ${dipHtml}
        </div>

        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#0b3d91;">💸 पेमेंट और खर्चे</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div><label style="font-size:11px;">Paytm</label><input type="number" id="rv-paytm" value="${toSave.paytm || ''}" style="width:100%;padding:4px;"></div>
            <div><label style="font-size:11px;">Swipe</label><input type="number" id="rv-swipe" value="${toSave.swipe || ''}" style="width:100%;padding:4px;"></div>
            <div><label style="font-size:11px;">DG खर्चा</label><input type="number" id="rv-kharcha" value="${toSave.kharcha || ''}" style="width:100%;padding:4px;"></div>
            <div><label style="font-size:11px;">चाय-खाना</label><input type="number" id="rv-chai" value="${toSave.chaiKhana || ''}" style="width:100%;padding:4px;"></div>
          </div>
        </div>

        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#b91c1c;">📒 उधार एंट्री</h4>
          ${udharHtml || '<div class="mut">कोई उधार नहीं मिला</div>'}
        </div>

        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#15803d;">📒 जमा एंट्री</h4>
          ${jamaHtml || '<div class="mut">कोई जमा नहीं मिला</div>'}
        </div>

      </div>

      <div class="btns" style="margin-top:12px;position:sticky;bottom:0;background:#fff;padding-top:10px;border-top:1px solid #eee;">
        <button class="btn g full" id="rv-save" style="font-size:16px;">✅ सही है, सेव करें</button>
        <button class="btn w full" id="rv-cancel" style="margin-top:6px;">रद्द करें</button>
      </div>
    `);

    $('#rv-cancel', m).onclick = () => m.close();

    $('#rv-save', m).onclick = async () => {
      // 1. Collect all edited values
      const finalNz = {};
      Object.keys(toSave.nz).forEach(k => { finalNz[k] = { c: num($(`#rv-nz-${k}`, m).value) }; });
      
      const finalPaytm = num($('#rv-paytm', m).value);
      const finalSwipe = num($('#rv-swipe', m).value);
      const finalKharcha = num($('#rv-kharcha', m).value);
      const finalChai = num($('#rv-chai', m).value);

      const finalUdhar = (json.udhar || []).map((u, i) => ({
        partyId: $(`#rv-party-udhar-${i}`, m).value,
        party: $(`#rv-party-udhar-${i}`, m).options[$(`#rv-party-udhar-${i}`, m).selectedIndex].text,
        amount: num($(`#rv-amt-udhar-${i}`, m).value),
        vehicle: $(`#rv-veh-udhar-${i}`, m).value.trim().toUpperCase(),
        litre: num($(`#rv-lit-udhar-${i}`, m).value)
      })).filter(u => u.partyId && u.amount > 0);

      const finalJama = (json.jama || []).map((j, i) => ({
        partyId: $(`#rv-party-jama-${i}`, m).value,
        party: $(`#rv-party-jama-${i}`, m).options[$(`#rv-party-jama-${i}`, m).selectedIndex].text,
        amount: num($(`#rv-amt-jama-${i}`, m).value)
      })).filter(j => j.partyId && j.amount > 0);

      // 2. Validation
      if (Object.values(finalNz).some(n => n.c <= 0)) return toast('कृपया सभी मीटर क्लोजिंग सही भरें');
      if (finalUdhar.some(u => !u.partyId)) return toast('कृपया सभी उधार की पार्टी चुनें');

      $('#rv-save', m).disabled = true;
      $('#rv-save', m).textContent = '⏳ सेव हो रहा है...';

      try {
        const b = db().batch();
        const dayRef = db().collection('days').doc(date);
        
        // Save Day fields
        b.update(dayRef, {
          ...finalNz, // Object spread for nz.p1.c etc.
          'nz.p1.c': finalNz.p1 ? finalNz.p1.c : 0,
          'nz.p2.c': finalNz.p2 ? finalNz.p2.c : 0,
          'nz.p3.c': finalNz.p3 ? finalNz.p3.c : 0,
          'nz.p4.c': finalNz.p4 ? finalNz.p4.c : 0,
          'nz.d1.c': finalNz.d1 ? finalNz.d1.c : 0,
          'nz.d2.c': finalNz.d2 ? finalNz.d2.c : 0,
          'nz.d3.c': finalNz.d3 ? finalNz.d3.c : 0,
          'nz.d4.c': finalNz.d4 ? finalNz.d4.c : 0,
          dipP: num($('#rv-dipP', m).value), dipD: num($('#rv-dipD', m).value),
          paytm: finalPaytm, swipe: finalSwipe, kharcha: finalKharcha, chaiKhana: finalChai
        });

        // Save Ledger Entries
        const addLedger = (entry, type) => {
          const amt = entry.amount;
          const lRef = db().collection('ledger').doc();
          b.set(lRef, {
            partyId: entry.partyId,
            partyName: entry.party,
            date: date, time: APP.nowTime ? APP.nowTime() : '12:00',
            kind: type, amount: amt, vehicle: entry.vehicle || '', fuel: entry.fuel || '',
            rate: 0, litre: entry.litre || 0, note: 'AI Scan Entry',
            by: APP.S.user ? APP.S.user.email : 'AI', at: APP.FV.serverTimestamp()
          });
          b.update(db().collection('parties').doc(entry.partyId), { bal: APP.FV.increment(type === 'udhar' ? amt : -amt) });
        };

        finalUdhar.forEach(u => addLedger(u, 'udhar'));
        finalJama.forEach(j => addLedger(j, 'jama'));

        await b.commit();
        toast('✅ डेटा सफलतापूर्वक सेव हो गया!');
        m.close();
        APP.S.parties.pub = null; if (APP.recalc) APP.recalc();
        APP.dayView(date); 

      } catch (e) {
        toast('❌ सेव नहीं हो पाया: ' + e.message);
        $('#rv-save', m).disabled = false;
      }
    };
  }

  APP.scanRegister = async function (st) {
    if (!st || st.locked) return toast('यह दिन लॉक है, एंट्री नहीं हो सकती।');
    let parties = []; try { parties = await APP.getParties(false, true); } catch (e) {}
    
    const BASE_PROMPT = buildAIPrompt(parties);
    const m = modal(`
      <h3>📷 AI रजिस्टर स्कैन</h3>
      <p class="mut" style="font-size:12px;margin-bottom:8px;">फोटो अपलोड करें या AI (Gemini) से बना JSON यहाँ पेस्ट करें।</p>
      
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button class="btn sm o" id="btn-photo" style="flex:1;">📷 फोटो से स्कैन</button>
        <input type="file" id="scan-file" accept="image/*" style="display:none">
        <button class="btn sm g" id="copy-prompt" style="flex:1;">📋 Copy Prompt</button>
        <button class="btn sm w" id="btn-key">🔑 Key</button>
      </div>

      <textarea id="scan-json" rows="6" style="width:100%; font-size:12px; font-family:monospace; border:1px solid #ccc; border-radius:8px; padding:10px;" placeholder='{"date":"2026-10-20","nz":{"p1":{"c":4500}}}'></textarea>
      
      <div class="btns" style="margin-top:12px;">
        <button class="btn o" id="btn-verify" style="width:100%; font-weight:bold;">🔍 Cross-Check & Verify</button>
        <button class="btn w" id="btn-cancel" style="width:100%; margin-top:8px;">रद्द करें</button>
      </div>
    `);

    m.querySelector('#copy-prompt').onclick = async () => {
      try { await navigator.clipboard.writeText(BASE_PROMPT); toast('✅ प्रॉम्प्ट कॉपी हो गया!'); } 
      catch (e) { toast('❌ कॉपी नहीं हुआ'); }
    };

    m.querySelector('#btn-key').onclick = () => {
      if (APP.AI && APP.AI.manageKeys) APP.AI.manageKeys();
    };

    const fileEl = m.querySelector('#scan-file');
    m.querySelector('#btn-photo').onclick = () => {
      if (!APP.AI || !APP.AI.hasKey()) { toast('पहले 🔑 Gemini key जोड़ें'); return APP.AI.manageKeys(); }
      fileEl.click();
    };

    fileEl.onchange = async () => {
      const f = fileEl.files && fileEl.files[0]; if (!f) return;
      const btn = m.querySelector('#btn-photo');
      btn.disabled = true; btn.textContent = '⏳ AI पढ़ रहा है (कृपया 20-30 सेकंड रुकें)...';
      
      try {
        const b64 = await new Promise((res, rej) => {
          const url = URL.createObjectURL(f), img = new Image();
          img.onload = () => {
            const sc = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
            res(cv.toDataURL('image/jpeg', 0.85).split(',')[1]);
          };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('फोटो खुल नहीं पाई')); };
          img.src = url;
        });

        const payload = { contents: [{ parts: [{ text: BASE_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { temperature: 0 } };
        const txt = await APP.AI.ask(payload, { timeout: 60000 });
        
        m.querySelector('#scan-json').value = txt;
        btn.disabled = false; btn.textContent = '📷 फोटो से स्कैन';
        toast('✅ AI ने डेटा पढ़ लिया, अब Cross-Check दबाएं');
      } catch (e) {
        btn.disabled = false; btn.textContent = '📷 फोटो से स्कैन';
        toast('❌ AI नहीं पढ़ पाया: ' + e.message);
      }
    };

    m.querySelector('#btn-cancel').onclick = () => m.close();

    m.querySelector('#btn-verify').onclick = async () => {
      const raw = m.querySelector('#scan-json').value.trim();
      if (!raw) return toast('पहले JSON पेस्ट करें');

      let json;
      try {
        const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
        if (a < 0 || b <= a) throw new Error('JSON format galat hai');
        json = JSON.parse(clean.slice(a, b + 1));
      } catch (e) {
        return toast('❌ गलत JSON फॉर्मेट! कृपया सही JSON पेस्ट करें।');
      }

      m.close();
      showReviewScreen(st, parties, json);
    };
  };

  console.log('[Mazda views2_utils.js] Ultimate Scanner with Review UI Loaded ✓');
})();
