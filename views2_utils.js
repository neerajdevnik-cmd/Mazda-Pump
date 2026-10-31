/* Mazda Oil Company - Features Utils (Fully Safe AI Scanner + Backup Restore) */
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

  /* ======================= 2. SAFE BACKUP RESTORE ======================= */
  APP.restoreFromJSON = function () {
    const m = modal(`
      <h3>📤 पुराना बैकअप अपलोड करें</h3>
      <p class="mut" style="font-size:12px;margin-bottom:10px;">अपनी पुरानी JSON बैकअप फाइल चुनें। यह सुरक्षित तरीके से डेटा वापस जोड़ देगा (पुराना डेटा नहीं उड़ेगा)।</p>
      
      <div style="text-align:center; margin: 20px 0;">
        <input type="file" id="bk-file" accept=".json" style="display:none;">
        <button class="btn o full" id="bk-btn" style="padding:15px;font-size:16px;">📁 JSON बैकअप फाइल चुनें</button>
      </div>

      <div id="bk-progress" class="mut" style="text-align:center;font-weight:bold;color:#0b3d91;display:none;">⏳ रिस्टोर हो रहा है...</div>
      <div class="btns" style="margin-top:12px;"><button class="btn w full" id="bk-cancel">रद्द करें</button></div>
    `);

    const fileEl = m.querySelector('#bk-file');
    m.querySelector('#bk-cancel').onclick = () => m.close();
    m.querySelector('#bk-btn').onclick = () => fileEl.click();

    fileEl.onchange = async () => {
      const f = fileEl.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object') throw new Error("गलत फाइल");
          
          m.querySelector('#bk-btn').style.display = 'none';
          m.querySelector('#bk-progress').style.display = 'block';
          m.querySelector('#bk-cancel').disabled = true;

          const convertTS = (obj) => {
            for (let k in obj) {
              if (obj[k] && typeof obj[k] === 'object' && obj[k].seconds !== undefined && obj[k].nanoseconds !== undefined) {
                obj[k] = new firebase.firestore.Timestamp(obj[k].seconds, obj[k].nanoseconds);
              }
            }
            return obj;
          };

          const db = APP.db;
          const cols = Object.keys(data).filter(k => Array.isArray(data[k]) && k !== '_meta');
          
          for (const col of cols) {
            const items = data[col];
            if (!items.length) continue;
            for (let i = 0; i < items.length; i += 400) {
              const batch = db.batch();
              items.slice(i, i + 400).forEach(item => {
                const docId = item.id || db.collection(col).doc().id;
                const docData = convertTS({ ...item });
                delete docData.id;
                batch.set(db.collection(col).doc(docId), docData, { merge: true }); // merge:true safe
              });
              await batch.commit();
            }
          }
          m.querySelector('#bk-progress').textContent = "✅ सफल! रीलोड हो रहा है...";
          setTimeout(() => { m.close(); window.location.reload(); }, 1500);
        } catch (err) {
          toast('❌ रिस्टोर फेल: ' + err.message);
          m.querySelector('#bk-btn').style.display = 'block';
          m.querySelector('#bk-progress').style.display = 'none';
          m.querySelector('#bk-cancel').disabled = false;
        }
      };
      reader.readAsText(f);
    };
  };

  // More menu me button add karna
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
      btn.style.marginTop = '10px'; btn.style.width = '100%';
      btn.onclick = () => APP.restoreFromJSON();
      card.appendChild(btn);
    }
  };

  /* ======================= 3. AI SCANNER (SAFE) ======================= */
  function buildAIPrompt(parties) {
    const partyList = parties.map(p => p.name).join(', ');
    return `You are an expert data extractor for an Indian Petrol Pump. Read this register photo carefully.
STRICT RULES:
1. "dipP" and "dipD" are in CM (0 to 250). If you see 7605, it is NOT a dip. Find the actual dip (0-200).
2. DO NOT extract locked fields: "rateP", "rateD", "openCash", "openStockP", "openStockD".
3. For "udhar" and "jama", match party names with this list: [${partyList}].
4. Return ONLY JSON.
FORMAT: {"date": "YYYY-MM-DD", "testing": 5, "nz": {"p1": {"c": 0}}, "paytm": 0, "swipe": 0, "kharcha": 0, "dipP": 0, "dipD": 0, "udhar": [{"party":"", "vehicle":"", "amount":0}], "jama": [{"party":"", "amount":0}]}`;
  }

  function showReviewScreen(st, parties, json) {
    const date = st.date;
    let nzHtml = '';
    if (json.nz) {
      Object.keys(json.nz).forEach(k => {
        if (!['p1','p2','p3','p4','d1','d2','d3','d4'].includes(k)) return;
        const c = num(json.nz[k].c);
        const o = num(st.d.nz && st.d.nz[k] ? st.d.nz[k].o : 0);
        if (c > 0) {
          let err = (c < o) ? `<span style="color:red;font-size:11px;">⚠️ कम है</span>` : '';
          nzHtml += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;">
            <b>${k.toUpperCase()}</b> <input type="number" id="rv-nz-${k}" value="${c}" style="width:80px;padding:4px;text-align:right;"> ${err}
          </div>`;
        }
      });
    }

    const renderLedgerItem = (item, type, idx) => {
      let matchedId = '';
      if (item.party) {
        const found = parties.find(p => p.name.toLowerCase().includes(item.party.toLowerCase()) || item.party.toLowerCase().includes(p.name.toLowerCase()));
        if (found) matchedId = found.id;
      }
      const options = `<option value="">-- चुनें --</option>` + parties.map(p => `<option value="${p.id}" ${p.id === matchedId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
      return `
        <div style="border:1px solid #dde2ec;border-radius:8px;padding:8px;margin-bottom:6px;background:#fbfcff;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:bold;color:${type === 'udhar' ? '#b91c1c' : '#15803d'};">${type === 'udhar' ? '🔴 उधार' : '🟢 जमा'}</span>
            <input type="number" id="rv-amt-${type}-${idx}" value="${item.amount}" style="width:80px;padding:4px;font-weight:bold;text-align:right;">
          </div>
          <select id="rv-party-${type}-${idx}" style="width:100%;padding:4px;margin-bottom:4px;font-size:12px;">${options}</select>
          <input type="text" id="rv-veh-${type}-${idx}" value="${item.vehicle || ''}" placeholder="गाड़ी नंबर" style="width:100%;padding:4px;font-size:12px;text-transform:uppercase;">
        </div>
      `;
    };

    let udharHtml = (json.udhar || []).map((u, i) => renderLedgerItem(u, 'udhar', i)).join('');
    let jamaHtml = (json.jama || []).map((j, i) => renderLedgerItem(j, 'jama', i)).join('');

    const m = modal(`
      <h3>🔍 क्रॉस-चेक और सुधार</h3>
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px;">
        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#0b3d91;">⛽ मीटर रीडिंग</h4>
          ${nzHtml || '<div class="mut">कोई मीटर रीडिंग नहीं</div>'}
        </div>
        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#0b3d91;">🛢️ टैंक DIP</h4>
          <div style="display:flex;justify-content:space-between;padding:4px 0;"><b>पेट्रोल DIP</b> <input type="number" id="rv-dipP" value="${json.dipP || ''}" style="width:80px;padding:4px;"></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;"><b>डीज़ल DIP</b> <input type="number" id="rv-dipD" value="${json.dipD || ''}" style="width:80px;padding:4px;"></div>
        </div>
        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#b91c1c;">📒 उधार</h4>${udharHtml || '<div class="mut">कोई उधार नहीं</div>'}
        </div>
        <div class="card" style="padding:10px;margin-bottom:10px;">
          <h4 style="margin:0 0 6px;font-size:14px;color:#15803d;">📒 जमा</h4>${jamaHtml || '<div class="mut">कोई जमा नहीं</div>'}
        </div>
      </div>
      <div class="btns" style="margin-top:12px;position:sticky;bottom:0;background:#fff;padding-top:10px;border-top:1px solid #eee;">
        <button class="btn g full" id="rv-save">✅ सही है, सेव करें</button>
        <button class="btn w full" id="rv-cancel">रद्द करें</button>
      </div>
    `);

    $('#rv-cancel', m).onclick = () => m.close();

    $('#rv-save', m).onclick = async () => {
      const dayUpdate = {};
      // Safe Dot Notation Update (No opening overwritten)
      Object.keys(json.nz || {}).forEach(k => {
        if (!['p1','p2','p3','p4','d1','d2','d3','d4'].includes(k)) return;
        const val = num($(`#rv-nz-${k}`, m).value);
        if (val > 0) dayUpdate[`nz.${k}.c`] = val;
      });
      const dp = num($('#rv-dipP', m).value);
      const dd = num($('#rv-dipD', m).value);
      if (dp > 0) dayUpdate['dipP'] = dp;
      if (dd > 0) dayUpdate['dipD'] = dd;

      const finalUdhar = (json.udhar || []).map((u, i) => ({
        partyId: $(`#rv-party-udhar-${i}`, m).value,
        party: $(`#rv-party-udhar-${i}`, m).options[$(`#rv-party-udhar-${i}`, m).selectedIndex].text,
        amount: num($(`#rv-amt-udhar-${i}`, m).value),
        vehicle: $(`#rv-veh-udhar-${i}`, m).value.trim().toUpperCase()
      })).filter(u => u.partyId && u.amount > 0);

      const finalJama = (json.jama || []).map((j, i) => ({
        partyId: $(`#rv-party-jama-${i}`, m).value,
        party: $(`#rv-party-jama-${i}`, m).options[$(`#rv-party-jama-${i}`, m).selectedIndex].text,
        amount: num($(`#rv-amt-jama-${i}`, m).value)
      })).filter(j => j.partyId && j.amount > 0);

      $('#rv-save', m).disabled = true;
      $('#rv-save', m).textContent = '⏳ सेव हो रहा है...';

      try {
        const b = db().batch();
        if (Object.keys(dayUpdate).length > 0) b.update(db().collection('days').doc(date), dayUpdate);

        const addLedger = (entry, type) => {
          const lRef = db().collection('ledger').doc();
          b.set(lRef, {
            partyId: entry.partyId, partyName: entry.party, date: date, time: APP.nowTime ? APP.nowTime() : '12:00',
            kind: type, amount: entry.amount, vehicle: entry.vehicle || '', fuel: '', rate: 0, litre: 0,
            note: 'AI Scan Entry', by: APP.S.user ? APP.S.user.email : 'AI', at: APP.FV.serverTimestamp()
          });
          b.update(db().collection('parties').doc(entry.partyId), { bal: APP.FV.increment(type === 'udhar' ? entry.amount : -entry.amount) });
        };

        finalUdhar.forEach(u => addLedger(u, 'udhar'));
        finalJama.forEach(j => addLedger(j, 'jama'));

        await b.commit();
        toast('✅ डेटा सेव हो गया!');
        m.close();
        APP.S.parties.pub = null; if (APP.recalc) APP.recalc();
        APP.dayView(date); 
      } catch (e) {
        toast('❌ सेव नहीं हो पाया: ' + e.message);
        $('#rv-save', m).disabled = false;
        $('#rv-save', m).textContent = '✅ सही है, सेव करें';
      }
    };
  }

  APP.scanRegister = async function (st) {
    try {
      if (!st || st.locked) return toast('यह दिन लॉक है');
      let parties = []; try { parties = await APP.getParties(false, true); } catch (e) {}
      
      const m = modal(`
        <h3>📷 AI रजिस्टर स्कैन</h3>
        <div style="display:flex; gap:6px; margin-bottom:10px;">
          <button class="btn sm o" id="btn-photo" style="flex:1;">📷 फोटो स्कैन</button>
          <input type="file" id="scan-file" accept="image/*" style="display:none">
          <button class="btn sm g" id="copy-prompt" style="flex:1;">📋 Copy Prompt</button>
          <button class="btn sm w" id="btn-key">🔑 Key</button>
        </div>
        <textarea id="scan-json" rows="6" style="width:100%; font-size:12px; font-family:monospace; border:1px solid #ccc; border-radius:8px; padding:10px;" placeholder='{"date":"2026-10-20","nz":{"p1":{"c":4500}}}'></textarea>
        <div class="btns" style="margin-top:12px;">
          <button class="btn o" id="btn-verify" style="width:100%; font-weight:bold;">🔍 Cross-Check</button>
          <button class="btn w" id="btn-cancel" style="width:100%; margin-top:8px;">रद्द करें</button>
        </div>
      `);

      m.querySelector('#copy-prompt').onclick = async () => {
        try { await navigator.clipboard.writeText(buildAIPrompt(parties)); toast('✅ कॉपी हो गया!'); } 
        catch (e) { toast('❌ कॉपी नहीं हुआ'); }
      };

      m.querySelector('#btn-key').onclick = () => { if (APP.AI && APP.AI.manageKeys) APP.AI.manageKeys(); };

      const fileEl = m.querySelector('#scan-file');
      m.querySelector('#btn-photo').onclick = () => {
        if (!APP.AI || !APP.AI.hasKey || !APP.AI.hasKey()) {
          if (APP.AI && APP.AI.manageKeys) APP.AI.manageKeys();
          else toast('❌ AI मॉड्यूल लोड नहीं है।');
          return;
        }
        fileEl.click();
      };

      fileEl.onchange = async () => {
        const f = fileEl.files && fileEl.files[0]; if (!f) return;
        const btn = m.querySelector('#btn-photo');
        btn.disabled = true; btn.textContent = '⏳ AI पढ़ रहा है...';
        
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

          const payload = { contents: [{ parts: [{ text: buildAIPrompt(parties) }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { temperature: 0 } };
          const txt = await APP.AI.ask(payload, { timeout: 60000 });
          
          m.querySelector('#scan-json').value = txt;
          btn.disabled = false; btn.textContent = '📷 फोटो स्कैन';
          toast('✅ AI ने डेटा पढ़ लिया');
        } catch (e) {
          btn.disabled = false; btn.textContent = '📷 फोटो स्कैन';
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
          if (a < 0 || b <= a) throw new Error('JSON galat hai');
          json = JSON.parse(clean.slice(a, b + 1));
        } catch (e) { return toast('❌ गलत JSON फॉर्मेट!'); }
        m.close();
        showReviewScreen(st, parties, json);
      };
    } catch (err) {
      console.error(err);
      toast('❌ स्कैनर खोलने में दिक्कत: ' + err.message);
    }
  };

  console.log('[Mazda views2_utils.js] Fully Safe Loaded ✓');
})();
