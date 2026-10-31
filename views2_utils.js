/* Mazda Oil Company - Features Utils (Foolproof & Safe) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, S = APP.S, $ = APP.$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;

  /* 1. THERMAL SLIP (पर्ची) */
  APP.showThermalSlip = function (data) {
    const m = modal(`
      <h3>🖨️ उधार पर्ची</h3>
      <div style="text-align:center;padding:10px;">पर्ची यहाँ बनेगी (Print/Share)</div>
      <button class="btn w full" onclick="this.closest('.modal').remove()">बंद करें</button>
    `);
  };

  /* 2. SAFE BACKUP RESTORE (पुराना बैकअप अपलोड करें) */
  APP.restoreFromJSON = function () {
    const m = modal(`
      <h3>📤 पुराना बैकअप अपलोड करें</h3>
      <p class="mut" style="font-size:12px;">यह डेटा वापस जोड़ देगा (पुराना डेटा नहीं उड़ेगा)।</p>
      <input type="file" id="bk-file" accept=".json" style="display:none">
      <button class="btn o full" id="bk-btn">📁 JSON बैकअप फाइल चुनें</button>
      <div id="bk-prog" style="display:none;text-align:center;margin-top:10px;color:#0b3d91;font-weight:bold;">⏳ रिस्टोर हो रहा है...</div>
      <button class="btn w full" style="margin-top:10px" onclick="this.closest('.modal').remove()">रद्द करें</button>
    `);

    const fileEl = m.querySelector('#bk-file');
    m.querySelector('#bk-btn').onclick = () => fileEl.click();

    fileEl.onchange = () => {
      const f = fileEl.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          m.querySelector('#bk-btn').style.display = 'none';
          m.querySelector('#bk-prog').style.display = 'block';
          
          for (const col in data) {
            if (!Array.isArray(data[col])) continue;
            for (let i = 0; i < data[col].length; i += 400) {
              const batch = db().batch();
              data[col].slice(i, i + 400).forEach(item => {
                const id = item.id || db().collection(col).doc().id;
                const docData = { ...item };
                delete docData.id;
                // Firestore Timestamp check
                for(let k in docData) {
                  if(docData[k] && typeof docData[k] === 'object' && docData[k].seconds !== undefined) {
                    docData[k] = new firebase.firestore.Timestamp(docData[k].seconds, docData[k].nanoseconds);
                  }
                }
                batch.set(db().collection(col).doc(id), docData, { merge: true });
              });
              await batch.commit();
            }
          }
          toast('✅ डेटा रिस्टोर हो गया!');
          setTimeout(() => location.reload(), 1500);
        } catch (err) { 
          toast('❌ फेल: ' + err.message); 
          m.querySelector('#bk-btn').style.display = 'block';
          m.querySelector('#bk-prog').style.display = 'none';
        }
      };
      r.readAsText(f);
    };
  };

  /* More menu me Backup button add karna */
  const origMore = APP.views.more;
  APP.views.more = async function () {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer && APP.isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#restore-bk-btn')) return;
    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btn = document.createElement('button');
      btn.id = 'restore-bk-btn'; btn.className = 'btn o'; btn.innerHTML = '📤 पुराना बैकअप अपलोड करें';
      btn.onclick = () => APP.restoreFromJSON();
      card.appendChild(btn);
    }
  };

  /* 3. AI SCANNER (100% Working) */
  APP.scanRegister = async function (st) {
    if (!st || st.locked) return toast('यह दिन लॉक है');
    
    let parties = [];
    try { parties = await APP.getParties(false, true); } catch (e) {}
    
    const m = modal(`
      <h3>📷 AI रजिस्टर स्कैन</h3>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <button class="btn sm o" id="btn-photo" style="flex:1">📷 फोटो स्कैन</button>
        <button class="btn sm g" id="copy-prompt" style="flex:1">📋 Copy Prompt</button>
        <button class="btn sm w" id="btn-key">🔑 Key</button>
      </div>
      <input type="file" id="scan-file" accept="image/*" style="display:none">
      <textarea id="scan-json" rows="6" style="width:100%; font-size:12px; border:1px solid #ccc; border-radius:8px; padding:10px;" placeholder='{"date":"2026-10-20"}'></textarea>
      <div class="btns" style="margin-top:12px">
        <button class="btn o" id="btn-verify" style="width:100%">🔍 Cross-Check</button>
        <button class="btn w" id="btn-cancel" style="width:100%;margin-top:8px">रद्द करें</button>
      </div>
    `);

    const fileEl = m.querySelector('#scan-file');
    const btnPhoto = m.querySelector('#btn-photo');
    const scanJson = m.querySelector('#scan-json');

    m.querySelector('#btn-cancel').onclick = () => m.close();
    
    m.querySelector('#btn-key').onclick = () => {
      if (APP.AI && APP.AI.manageKeys) APP.AI.manageKeys();
      else toast('AI Key मॉड्यूल लोड नहीं है');
    };

    m.querySelector('#copy-prompt').onclick = () => {
      const prompt = `Read this petrol pump register photo. Return ONLY a raw JSON object.
STRICT RULES:
1. "dipP" and "dipD" are in CM (0 to 250).
2. DO NOT extract locked fields: "rateP", "rateD", "openCash", "openStockP", "openStockD".
3. Return ONLY JSON.
FORMAT: {"date": "YYYY-MM-DD", "testing": 5, "nz": {"p1": {"c": 0}}, "paytm": 0, "swipe": 0, "kharcha": 0, "dipP": 0, "dipD": 0, "udhar": [], "jama": []}`;
      navigator.clipboard.writeText(prompt).then(() => toast('✅ प्रॉम्प्ट कॉपी हो गया!')).catch(() => toast('❌ कॉपी नहीं हुआ'));
    };

    btnPhoto.onclick = () => {
      if (!APP.AI || !APP.AI.hasKey || !APP.AI.hasKey()) {
        if (APP.AI && APP.AI.manageKeys) APP.AI.manageKeys();
        else toast('पहले AI Key जोड़ें');
        return;
      }
      fileEl.click();
    };

    fileEl.onchange = async () => {
      const f = fileEl.files[0]; if (!f) return;
      btnPhoto.disabled = true;
      btnPhoto.textContent = '⏳ AI पढ़ रहा है...';
      
      try {
        const b64 = await new Promise((res, rej) => {
          const url = URL.createObjectURL(f), img = new Image();
          img.onload = () => {
            const cv = document.createElement('canvas');
            const sc = Math.min(1, 1400 / Math.max(img.width, img.height));
            cv.width = img.width * sc; cv.height = img.height * sc;
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            URL.revokeObjectURL(url);
            res(cv.toDataURL('image/jpeg', 0.85).split(',')[1]);
          };
          img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('इमेज खुल नहीं पाई')); };
          img.src = url;
        });
        
        const payload = { contents: [{ parts: [{ text: "Extract JSON." }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { temperature: 0 } };
        const txt = await APP.AI.ask(payload, { timeout: 60000 });
        scanJson.value = txt;
        toast('✅ AI ने डेटा पढ़ लिया');
      } catch (e) {
        toast('❌ AI Error: ' + e.message);
      } finally {
        btnPhoto.disabled = false;
        btnPhoto.textContent = '📷 फोटो स्कैन';
      }
    };

    m.querySelector('#btn-verify').onclick = () => {
      const raw = scanJson.value.trim();
      if (!raw) return toast('JSON पेस्ट करें');
      
      try {
        const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
        if (a < 0 || b <= a) throw new Error('JSON galat');
        const json = JSON.parse(clean.slice(a, b + 1));
        
        m.close();
        showReviewScreen(st, parties, json);
      } catch (e) {
        toast('❌ गलत JSON');
      }
    };
  };

  function showReviewScreen(st, parties, json) {
    const date = st.date;
    let nzHtml = '';
    if (json.nz) {
      Object.keys(json.nz).forEach(k => {
        if (!['p1','p2','p3','p4','d1','d2','d3','d4'].includes(k)) return;
        const c = num(json.nz[k].c);
        if (c > 0) nzHtml += `<div style="margin:4px 0;display:flex;justify-content:space-between"><b>${k.toUpperCase()}</b> <input type="number" id="rv-nz-${k}" value="${c}" style="width:80px;text-align:right"></div>`;
      });
    }

    const renderLedgerItem = (item, type, idx) => {
      let matchedId = '';
      if (item.party) {
        const found = parties.find(p => p.name.toLowerCase().includes(item.party.toLowerCase()));
        if (found) matchedId = found.id;
      }
      const options = `<option value="">-- चुनें --</option>` + parties.map(p => `<option value="${p.id}" ${p.id === matchedId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
      return `<div style="margin-bottom:6px;border:1px solid #ccc;padding:6px;border-radius:6px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <b style="color:${type === 'udhar' ? '#b91c1c' : '#15803d'}">${type === 'udhar' ? '🔴 उधार' : '🟢 जमा'}</b>
          <input type="number" id="rv-amt-${type}-${idx}" value="${item.amount}" style="width:80px;text-align:right">
        </div>
        <select id="rv-party-${type}-${idx}" style="width:100%">${options}</select>
      </div>`;
    };

    let udharHtml = (json.udhar || []).map((u, i) => renderLedgerItem(u, 'udhar', i)).join('');
    let jamaHtml = (json.jama || []).map((j, i) => renderLedgerItem(j, 'jama', i)).join('');

    const m = modal(`
      <h3>🔍 क्रॉस-चेक</h3>
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px">
        <div class="card"><h4>⛽ मीटर (क्लोजिंग)</h4>${nzHtml || '<div class="mut">कोई नहीं</div>'}</div>
        <div class="card"><h4>🛢️ DIP</h4>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">पेट्रोल <input type="number" id="rv-dipP" value="${json.dipP || ''}" style="width:80px;text-align:right"></div>
          <div style="display:flex;justify-content:space-between">डीज़ल <input type="number" id="rv-dipD" value="${json.dipD || ''}" style="width:80px;text-align:right"></div>
        </div>
        <div class="card"><h4>📒 उधार</h4>${udharHtml || '<div class="mut">कोई नहीं</div>'}</div>
        <div class="card"><h4>📒 जमा</h4>${jamaHtml || '<div class="mut">कोई नहीं</div>'}</div>
      </div>
      <div class="btns" style="margin-top:12px">
        <button class="btn g" id="rv-save">✅ सही है, सेव करें</button>
        <button class="btn w" id="rv-cancel">रद्द</button>
      </div>
    `);

    m.querySelector('#rv-cancel').onclick = () => m.close();

    m.querySelector('#rv-save').onclick = async () => {
      const update = {};
      // Safe Update (Only closing meters, no opening touched)
      Object.keys(json.nz || {}).forEach(k => {
        const val = num(m.querySelector(`#rv-nz-${k}`).value);
        if (val > 0) update[`nz.${k}.c`] = val;
      });
      const dp = num(m.querySelector('#rv-dipP').value);
      const dd = num(m.querySelector('#rv-dipD').value);
      if (dp > 0) update['dipP'] = dp;
      if (dd > 0) update['dipD'] = dd;

      const finalUdhar = (json.udhar || []).map((u, i) => ({
        partyId: m.querySelector(`#rv-party-udhar-${i}`).value,
        party: m.querySelector(`#rv-party-udhar-${i}`).options[m.querySelector(`#rv-party-udhar-${i}`).selectedIndex].text,
        amount: num(m.querySelector(`#rv-amt-udhar-${i}`).value)
      })).filter(u => u.partyId && u.amount > 0);

      const finalJama = (json.jama || []).map((j, i) => ({
        partyId: m.querySelector(`#rv-party-jama-${i}`).value,
        party: m.querySelector(`#rv-party-jama-${i}`).options[m.querySelector(`#rv-party-jama-${i}`).selectedIndex].text,
        amount: num(m.querySelector(`#rv-amt-jama-${i}`).value)
      })).filter(j => j.partyId && j.amount > 0);

      try {
        const b = db().batch();
        if (Object.keys(update).length) b.update(db().collection('days').doc(date), update);

        const addLedger = (e, type) => {
          const ref = db().collection('ledger').doc();
          b.set(ref, { partyId: e.partyId, partyName: e.party, date: date, kind: type, amount: e.amount, vehicle: '', fuel: '', rate: 0, litre: 0, note: 'AI Scan', time: '12:00', at: APP.FV.serverTimestamp() });
          b.update(db().collection('parties').doc(e.partyId), { bal: APP.FV.increment(type === 'udhar' ? e.amount : -e.amount) });
        };
        finalUdhar.forEach(u => addLedger(u, 'udhar'));
        finalJama.forEach(j => addLedger(j, 'jama'));

        await b.commit();
        toast('✅ डेटा सेव हो गया!');
        m.close();
        APP.S.parties.pub = null;
        if (APP.recalc) APP.recalc();
        APP.dayView(date);
      } catch (e) { toast('❌ सेव फेल: ' + e.message); }
    };
  }

  console.log('[Mazda views2_utils.js] Foolproof Safe Loaded ✓');
})();
