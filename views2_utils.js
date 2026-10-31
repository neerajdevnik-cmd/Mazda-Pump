/* Mazda Oil Company - Features Utils (Thermal Slip & Strict Cross-Check AI Scanner) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;

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

  /* ======================= STRICT CROSS-CHECK AI SCANNER ======================= */
  const BASE_PROMPT = `Read this petrol pump register photo. Return ONLY a raw JSON object (no markdown, no backticks).
DO NOT extract these (they are LOCKED): "rateP", "rateD", "openCash", "openStockP", "openStockD", and "nz.*.o" (opening meters).
ONLY extract: "date" (YYYY-MM-DD), "testing" (default 5), "nz.*.c" (closing meters), "paytm", "swipe", "kharcha", "driverInaam", "chaiKhana", "kharchaItems", "tankerP", "tankerD", "dipP", "dipD", "udhar", "jama".
Format: {"date":"YYYY-MM-DD","testing":5,"nz":{"p1":{"c":0}},"paytm":0,"swipe":0,"kharcha":0,"kharchaItems":[],"udhar":[{"party":"","vehicle":"","fuel":"diesel","litre":0,"amount":0}],"jama":[{"party":"","mode":"cash","amount":0}]}`;

  APP.scanRegister = async function (st) {
    if (!st || st.locked) return toast('यह दिन लॉक है, एंट्री नहीं हो सकती।');

    const m = modal(`
      <h3>📷 AI स्कैन (Cross-Check)</h3>
      <p class="mut" style="font-size:12px;margin-bottom:8px;">नीचे दिए गए प्रॉम्प्ट को कॉपी करके AI (Gemini/ChatGPT) में डालें, फोटो अपलोड करें, और उसका दिया हुआ JSON यहाँ पेस्ट करें।</p>
      
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button class="btn sm g" id="copy-prompt" style="flex:1; font-weight:bold;">📋 Copy Prompt</button>
      </div>

      <textarea id="scan-json" rows="7" style="width:100%; font-size:13px; font-family:monospace; border:1px solid #ccc; border-radius:8px; padding:10px;" placeholder='{"date":"2026-10-20","nz":{"p1":{"c":4500}}, "udhar":[{"party":"Pappu", "amount":2000}]}'></textarea>
      
      <div class="btns" style="margin-top:12px;">
        <button class="btn o" id="btn-verify" style="width:100%; font-weight:bold;">🔍 Cross-Check & Verify</button>
        <button class="btn w" id="btn-cancel" style="width:100%; margin-top:8px;">रद्द करें</button>
      </div>
    `);

    // 1. Copy Prompt Button Logic
    m.querySelector('#copy-prompt').onclick = async () => {
      try {
        await navigator.clipboard.writeText(BASE_PROMPT);
        toast('✅ प्रॉम्प्ट कॉपी हो गया! अब AI में पेस्ट करें।');
      } catch (e) {
        toast('❌ कॉपी नहीं हुआ, टेक्स्ट को सेलेक्ट करके कॉपी करें');
      }
    };

    m.querySelector('#btn-cancel').onclick = () => m.close();

    // 2. Verify Button Logic
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

      m.close(); // Close paste modal
      
      // Start Verification Process
      const date = json.date || st.date;
      if (date !== st.date) return toast('⚠️ AI ने दूसरी तारीख का डेटा दिया है। कृपया जांचें।');

      const html = [];
      const toSave = { nz: {}, kharchaItems: [], udhar: [], jama: [] };
      let hasError = false;

      // A. Check Paytm / Swipe
      if (json.paytm != null) { toSave.paytm = num(json.paytm); html.push(`✅ <b>Paytm:</b> ${money(toSave.paytm)}`); }
      if (json.swipe != null) { toSave.swipe = num(json.swipe); html.push(`✅ <b>Swipe:</b> ${money(toSave.swipe)}`); }

      // B. Check Nozzles (Locked: Opening)
      if (json.nz) {
        Object.keys(json.nz).forEach(k => {
          if (!['p1','p2','p3','p4','d1','d2','d3','d4'].includes(k)) return;
          const c = num(json.nz[k].c);
          const open = num(st.d.nz && st.d.nz[k] ? st.d.nz[k].o : 0);
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

      // C. Check Expenses
      if (json.kharcha) { toSave.kharcha = num(json.kharcha); html.push(`✅ <b>DG खर्चा:</b> ${money(toSave.kharcha)}`); }
      if (json.driverInaam) { toSave.driverInaam = num(json.driverInaam); html.push(`✅ <b>ड्राइवर इनाम:</b> ${money(toSave.driverInaam)}`); }
      if (json.chaiKhana) { toSave.chaiKhana = num(json.chaiKhana); html.push(`✅ <b>चाय-खाना:</b> ${money(toSave.chaiKhana)}`); }
      
      if (json.kharchaItems && Array.isArray(json.kharchaItems)) {
        json.kharchaItems.forEach(x => {
          if (x.label && num(x.amount) > 0) {
            toSave.kharchaItems.push({ label: x.label, amount: num(x.amount) });
            html.push(`✅ <b>अन्य खर्चा:</b> ${esc(x.label)} (${money(x.amount)})`);
          }
        });
      }

      // D. Check Udhar / Jama (Double Entry & Party ID Resolution)
      const parties = await APP.getParties(false, true); // Load current parties
      const ledgerSnap = await db().collection('ledger').where('date', '==', date).get();
      const existingL = ledgerSnap.docs.map(d => d.data());

      const resolveParty = (name) => {
        if (!name) return null;
        const p = parties.find(x => x.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(x.name.toLowerCase()));
        return p ? p.id : null;
      };

      const isDuplicate = (entry, type) => {
        return existingL.find(e => 
          e.partyId === entry.partyId && 
          e.kind === type &&
          num(e.amount) === num(entry.amount) && 
          (e.vehicle || '') === (entry.vehicle || '')
        );
      };

      if (json.udhar && Array.isArray(json.udhar)) {
        json.udhar.forEach(u => {
          const amt = num(u.amount);
          if (amt <= 0) return;
          
          u.partyId = resolveParty(u.party);
          if (!u.partyId) {
             html.push(`❌ <b>पार्टी नहीं मिली:</b> ${esc(u.party)} (कृपया डेटाबेस में चेक करें)`);
             hasError = true;
             return;
          }

          if (isDuplicate(u, 'udhar')) {
            html.push(`⚠️ <b>डबल एंट्री स्किप:</b> ${esc(u.party)} - ₹${amt} (पहले से है)`);
          } else {
            toSave.udhar.push(u);
            html.push(`✅ <b>उधार:</b> ${esc(u.party)} - ₹${amt}`);
          }
        });
      }

      if (json.jama && Array.isArray(json.jama)) {
        json.jama.forEach(j => {
          const amt = num(j.amount);
          if (amt <= 0) return;
          
          j.partyId = resolveParty(j.party);
          if (!j.partyId) {
             html.push(`❌ <b>पार्टी नहीं मिली:</b> ${esc(j.party)} (कृपया डेटाबेस में चेक करें)`);
             hasError = true;
             return;
          }

          if (isDuplicate(j, 'jama')) {
            html.push(`⚠️ <b>डबल एंट्री स्किप:</b> ${esc(j.party)} - ₹${amt} (पहले से है)`);
          } else {
            toSave.jama.push(j);
            html.push(`✅ <b>जमा:</b> ${esc(j.party)} - ₹${amt}`);
          }
        });
      }

      // Show Preview Modal
      const preview = modal(`
        <h3>🔍 क्रॉस-चेक रिपोर्ट</h3>
        <div style="max-height:50vh;overflow:auto;font-size:13px;background:#f8f9fc;padding:10px;border-radius:8px;margin-bottom:12px;border:1px solid #dde2ec;">
          ${html.length ? html.join('<br>') : 'कोई डेटा नहीं मिला।'}
        </div>
        ${hasError ? '<div class="err" style="margin-bottom:10px;">❌ ऊपर कुछ गलतियां हैं, कृपया जांचें।</div>' : ''}
        <div class="btns">
          <button class="btn g" id="final-save" style="width:100%; font-weight:bold;" ${hasError ? 'disabled style="opacity:0.5"' : ''}>✅ सही है, डेटाबेस में सेव करें</button>
          <button class="btn w" id="prev-cancel" style="width:100%; margin-top:8px;">रद्द करें</button>
        </div>
      `);

      preview.querySelector('#prev-cancel').onclick = () => preview.close();

      if (!hasError) {
        preview.querySelector('#final-save').onclick = async () => {
          preview.querySelector('#final-save').disabled = true;
          preview.querySelector('#final-save').textContent = '⏳ सेव हो रहा है...';
          
          try {
            const b = db().batch();
            const dayRef = db().collection('days').doc(date);
            
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
              const amt = num(entry.amount);
              const lRef = db().collection('ledger').doc();
              
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

              const pRef = db().collection('parties').doc(entry.partyId);
              b.update(pRef, { bal: APP.FV.increment(type === 'udhar' ? amt : -amt) });
            };

            toSave.udhar.forEach(u => addLedger(u, 'udhar'));
            toSave.jama.forEach(j => addLedger(j, 'jama'));

            await b.commit();
            toast('✅ डेटा सफलतापूर्वक सेव हो गया!');
            preview.close();
            APP.S.parties.pub = null; // Clear cache
            if (APP.recalc) APP.recalc();
            APP.dayView(date); // Reload day

          } catch (e) {
            toast('❌ सेव नहीं हो पाया: ' + e.message);
            preview.querySelector('#final-save').disabled = false;
            preview.querySelector('#final-save').textContent = '✅ सही है, डेटाबेस में सेव करें';
          }
        };
      }
    };
  };

  console.log('[Mazda views2_utils.js] Strict Cross-Check + Syntax Fixed ✓');
})();
