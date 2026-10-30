/* माज़दा ऑयल कंपनी - Party Ledger & Entry System (Model 3.8 Added) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const FUEL = APP.FUEL, MODE = APP.MODE, AUTO_NOTES = APP.AUTO_NOTES, AUTO_LBL = APP.AUTO_LBL;
  const db = () => APP.db, FV = () => APP.FV;
  const today = () => APP.todayISO();
  const nowTime = () => APP.nowTime();

  const sigEntry = (priv, e) => K.signed(e);

  // 🔥 FIX: Added gemini-3.8-flash (based on your error message)
  async function askGemini(key, payload) {
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

  async function findDupEntry(d) {
    try {
      const nv = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const s = await db().collection('ledger').where('date', '==', d.date).where('partyId', '==', d.partyId).get();
      return s.docs.map(x => ({ id: x.id, ...x.data() }))
        .find(r => r.kind === 'udhar' && nv(r.vehicle) === nv(d.vehicle) && Math.abs(num(r.amount) - d.amount) < 0.01) || null;
    } catch (e) { return null; }
  }
  APP.findDupEntry = findDupEntry;

  function sendEntryWhatsApp(data, party, priv) {
    if (!party.phone) return;
    const ph = String(party.phone).replace(/\D/g, '').replace(/^0+/, '');
    if (!ph) return;
    const wa = ph.length === 10 ? '91' + ph : ph;
    let msg;
    if (data.kind === 'udhar') {
      msg = `नमस्ते ${party.name} जी,\n\n`;
      msg += `आपकी गाड़ी *${data.vehicle || ''}* पर भरा:\n`;
      msg += `⛽ ${data.fuel === 'petrol' ? 'पेट्रोल' : 'डीज़ल'} ${r2(data.litre)} L × ₹${r2(data.rate)} = *₹${r2(data.amount)}*\n`;
      msg += `📅 ${dmy(data.date)} ${data.time || ''}\n`;
      msg += `\nमाज़दा ऑयल कंपनी`;
    } else {
      msg = `नमस्ते ${party.name} जी,\n\n`;
      msg += `आपका *₹${r2(data.amount)}* का भुगतान प्राप्त हुआ।\n`;
      msg += `📅 ${dmy(data.date)} ${data.time || ''}\n\n`;
      msg += `धन्यवाद! 🙏\nमाज़दा ऑयल कंपनी`;
    }
    window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), '_blank');
  }

  async function entryModal(o) {
    if (APP.isViewer()) return toast('आप केवल देख सकते हैं');
    const priv = !!o.priv, e = o.entry || null, kind0 = e ? e.kind : (APP.isSalesman() ? 'udhar' : (o.kind || 'udhar'));
    
    if (e && !APP.isTrueOwner()) {
        return toast('सिर्फ मालिक (Neeraj) ही पुरानी एंट्री बदल सकते हैं');
    }

    const parties = await APP.getParties(priv);
    if (!parties.length) { toast('पहले खाते में पार्टी जोड़ें'); return; }
    const date0 = e ? e.date : (o.date || S.date || today());
    const rates = { petrol: S.rates.petrol, diesel: S.rates.diesel };
    const pid0 = e ? e.partyId : (o.partyId || parties[0].id);

    const m = modal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0;">${e ? 'एंट्री बदलें' : priv ? 'निजी उधार जोड़ें' : 'नई एंट्री'}</h3>
        <button class="btn sm w" id="e-voice" style="background:#f4b41a; color:#000; border:0; padding:6px 12px; border-radius:20px;">🎤 बोलकर भरें</button>
      </div>
      ${(APP.isSalesman()) ? '' : `<div class="seg"><button data-k="udhar">उधार (तेल दिया)</button><button data-k="jama">जमा (पैसा आया)</button></div>`}
      <div class="row"><div><label>तारीख</label><input type="date" id="e-date" value="${date0}"></div><div><label>समय</label><input type="time" id="e-time" value="${e ? e.time || '' : nowTime()}"></div></div>
      <label>पार्टी</label><select id="e-party">${parties.map(p => `<option value="${p.id}" ${p.id === pid0 ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <div id="blkU">
        <label>गाड़ी नंबर</label><select id="e-veh"></select><input id="e-vehx" placeholder="गाड़ी नंबर टाइप करें" style="display:none;margin-top:6px">
        <div class="row"><div><label>तेल</label><select id="e-fuel"><option value="petrol">पेट्रोल</option><option value="diesel">डीज़ल</option></select></div>
        <div><label>रेट (Locked) 🔒</label><input id="e-rate" readonly style="background:#f0f0f0;color:#555;font-weight:bold"></div></div>
        <div class="row"><div><label>लीटर</label><input id="e-lit" inputmode="decimal"></div><div><label>रुपये</label><input id="e-amtU" inputmode="decimal"></div></div>
      </div>
      <div id="blkJ"><label>कैसे जमा हुआ</label>
        <select id="e-mode">
          <option value="cash">नकद</option>
          <option value="paytm">Paytm/UPI</option>
          <option value="swipe">स्वाइप</option>
          <option value="bank">बैंक</option>
        </select>
        <label>रुपये</label><input id="e-amtJ" inputmode="decimal"></div>
      <label>नोट</label><input id="e-note" value="${esc(e ? e.note || '' : '')}">
      <div class="btns">
        <button class="btn g" id="e-save">सेव करें</button>
        <button class="btn bpcl" id="e-slip-btn">🖨️ थर्मल पर्ची</button>
        <button class="btn w" id="e-cancel">रद्द</button>
      </div>
      
      <div id="e-voice-load" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:99999; align-items:center; justify-content:center; flex-direction:column; color:#fff; border-radius:14px;">
        <div class="spin" style="width:40px; height:40px; border:4px solid rgba(255,255,255,0.3); border-top-color:#f4b41a; border-radius:50%; animation:spin 1s linear infinite;"></div>
        <div style="margin-top:16px; font-weight:bold;">AI सुन रहा है...</div>
      </div>
    `);

    let kind = kind0, last = 'lit';
    const q = id => $('#' + id, m);
    const showKind = () => {
      $$('.seg button', m).forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      q('blkU').style.display = kind === 'udhar' ? '' : 'none'; q('blkJ').style.display = kind === 'jama' ? '' : 'none';
      q('e-slip-btn').style.display = kind === 'udhar' ? '' : 'none';
      syncNote();
    };
    const syncNote = () => {
      if (kind !== 'jama') return;
      const nt = q('e-note'), v = nt.value.trim();
      if (!v || AUTO_NOTES.includes(v)) nt.value = AUTO_LBL[q('e-mode').value] || '';
    };
    q('e-mode').onchange = syncNote;
    $$('.seg button', m).forEach(b => b.onclick = () => { kind = b.dataset.k; showKind(); });
    const fillVeh = () => {
      const p = APP.partyById(priv, q('e-party').value) || {}; const vs = p.vehicles || [];
      const cur = e && e.partyId === p.id ? e.vehicle : '';
      let h = vs.map(v => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('') + '<option value="__x">अन्य (टाइप करें)</option>';
      q('e-veh').innerHTML = h;
      if (cur && !vs.includes(cur)) { q('e-veh').value = '__x'; q('e-vehx').value = cur; }
      q('e-vehx').style.display = q('e-veh').value === '__x' ? '' : 'none';
    };
    q('e-veh').onchange = () => { q('e-vehx').style.display = q('e-veh').value === '__x' ? '' : 'none'; };
    q('e-party').onchange = fillVeh; fillVeh();
    
    const setRate = () => { q('e-rate').value = rates[q('e-fuel').value] || ''; };
    const calcA = () => { const r = num(q('e-rate').value), l = num(q('e-lit').value); q('e-amtU').value = r && l ? r2(r * l) : ''; };
    const calcL = () => { const r = num(q('e-rate').value), a = num(q('e-amtU').value); q('e-lit').value = r && a ? r2(a / r) : ''; };
    
    q('e-fuel').onchange = () => { setRate(); last === 'lit' ? calcA() : calcL(); };
    q('e-rate').oninput = () => { last === 'lit' ? calcA() : calcL(); };
    q('e-lit').oninput = () => { last = 'lit'; calcA(); };
    q('e-amtU').oninput = () => { last = 'amt'; calcL(); };
    
    if (e && e.kind === 'udhar') { q('e-fuel').value = e.fuel; q('e-rate').value = e.rate; q('e-lit').value = e.litre; q('e-amtU').value = e.amount; }
    else { setRate(); }
    
    if (e && e.kind === 'jama') { q('e-mode').value = e.mode; q('e-amtJ').value = e.amount; }
    showKind();

    /* ================= FAST VOICE ENTRY LOGIC ================= */
    q('e-voice').onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('❌ इस ब्राउज़र में Voice support नहीं है');
      
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      const btn = q('e-voice');
      btn.textContent = '🔴 सुन रहा है...';
      btn.disabled = true;

      rec.onresult = async (ev) => {
        const transcript = ev.results[0][0].transcript;
        btn.textContent = '⏳ AI समझ रहा है...';
        q('e-voice-load').style.display = 'flex';
        
        try {
          const key = localStorage.getItem('mazda_gemini_key');
          if (!key) throw new Error('API Key नहीं मिली');

          const prompt = `Extract data from voice: "${transcript}". Return ONLY JSON (no markdown): 
          {"kind": "udhar" or "jama", "partyName": "string", "vehicle": "string", "fuel": "petrol" or "diesel", "litre": number, "amount": number, "mode": "cash" or "paytm" or "swipe" or "bank"}. 
          If null, omit key.`;

          const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } };
          const txt = await askGemini(key, payload);
          
          let cleanTxt = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
          const a = cleanTxt.indexOf('{'), b = cleanTxt.lastIndexOf('}');
          if (a < 0 || b <= a) throw new Error('AI ne JSON format mein jawab nahi diya');
          
          const data = JSON.parse(cleanTxt.slice(a, b + 1));
          
          if (data.kind) { kind = data.kind; showKind(); }
          
          if (data.partyName) {
            const pObj = parties.find(p => p.name.toLowerCase().includes(data.partyName.toLowerCase()) || data.partyName.toLowerCase().includes(p.name.toLowerCase()));
            if (pObj) { q('e-party').value = pObj.id; fillVeh(); }
          }
          
          if (data.vehicle) {
            const opt = Array.from(q('e-veh').options).find(o => o.value.toLowerCase().includes(data.vehicle.toLowerCase()));
            if (opt) q('e-veh').value = opt.value;
            else { q('e-veh').value = '__x'; q('e-vehx').value = data.vehicle; q('e-vehx').style.display = ''; }
          }
          
          if (data.fuel) { q('e-fuel').value = data.fuel; setRate(); }
          
          if (data.litre) { q('e-lit').value = data.litre; }
          if (data.amount) {
            if (kind === 'udhar') { q('e-amtU').value = data.amount; if(!data.litre) calcL(); }
            else { q('e-amtJ').value = data.amount; }
          }
          if (data.mode && kind === 'jama') { q('e-mode').value = data.mode; syncNote(); }

          toast('✅ AI ne form bhar diya');
        } catch (err) {
          toast('❌ ' + err.message);
        } finally {
          q('e-voice-load').style.display = 'none';
          btn.textContent = '🎤 बोलकर भरें'; btn.disabled = false;
        }
      };

      rec.onerror = (e) => {
        btn.textContent = '🎤 बोलकर भरें'; btn.disabled = false;
        if (e.error === 'not-allowed') toast('माइक की अनुमति दें');
        else toast('आवाज़ नहीं आई, दोबारा बोलें');
      };

      rec.start();
    };

    q('e-slip-btn').onclick = () => {
      const party = APP.partyById(priv, q('e-party').value) || {};
      const veh = q('e-veh').value === '__x' ? q('e-vehx').value.trim().toUpperCase() : q('e-veh').value;
      if (!q('e-amtU').value) return toast('कृपया रकम भरें');
      if (APP.showThermalSlip) {
        APP.showThermalSlip({
          partyName: party.name,
          partyPhone: party.phone || '',
          vehicle: veh,
          fuel: q('e-fuel').value,
          litre: q('e-lit').value,
          rate: q('e-rate').value,
          amount: q('e-amtU').value,
          date: q('e-date').value,
          time: q('e-time').value
        });
      }
    };

    q('e-cancel').onclick = () => m.close();
    q('e-save').onclick = async () => {
      const partyId = q('e-party').value, party = APP.partyById(priv, partyId);
      if (!party) return toast('पार्टी नहीं मिली, रिफ्रेश करें');
      const data = { partyId, partyName: party.name, date: q('e-date').value, time: q('e-time').value || nowTime(), kind: kind, note: q('e-note').value.trim() };
      if (!data.date) return toast('तारीख चुनें');
      
      if (data.kind === 'udhar') {
        data.vehicle = q('e-veh').value === '__x' ? q('e-vehx').value.trim().toUpperCase() : q('e-veh').value;
        data.fuel = q('e-fuel').value; data.rate = num(q('e-rate').value); data.litre = num(q('e-lit').value); data.amount = num(q('e-amtU').value);
        if (!(data.amount > 0)) return toast('रुपये भरें');
        if (!priv) {
            if (!data.vehicle) return toast('गाड़ी नंबर लिखें');
            if (!(data.litre > 0)) return toast('लीटर भरें');
        }
      } else {
        data.mode = q('e-mode').value; data.amount = num(q('e-amtJ').value);
        if (!(data.amount > 0)) return toast('रुपये भरें');
        if (!data.note) data.note = AUTO_LBL[data.mode] || '';
      }
      if (priv) { data.status = e ? e.status : 'pending'; }
      const who = S.salesman ? S.salesman.name : S.user.email;
      if (e) {
        ['by', 'src', 'sid', 'uid', 'verified', 'verifiedBy'].forEach(k => { if (e[k] !== undefined) data[k] = e[k]; });
        data.editedBy = who;
      } else {
        data.by = who;
        data.uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        if (S.salesman) { data.src = 'salesman'; data.sid = S.salesman.id; }
      }
      data.at = FV().serverTimestamp();

      const sbtn = q('e-save');
      if (sbtn.disabled) return;                       
      if (!priv && (await APP.dayIsLocked(data.date) || (e && e.date !== data.date && await APP.dayIsLocked(e.date)))) return toast('❌ यह तारीख लॉक है');
      
      if (!e && data.kind === 'udhar' && APP.cibil && APP.cibil.checkLimit) {
        try {
          const check = await APP.cibil.checkLimit(party, data.amount, priv);
          if (check && !check.allow) {
            if (check.blocked) { sbtn.disabled = false; return toast(check.reason || 'उधार सीमा पार'); }
            if (!confirm((check.reason || '') + '\n\nफिर भी जोड़ें?')) { sbtn.disabled = false; return; }
          }
        } catch (x) { console.error('Credit check error', x); }
      }
      
      if (!e && data.kind === 'udhar' && !priv) {
        const dup = await findDupEntry(data);
        if (dup) {
          const by = dup.src === 'salesman' ? 'सेल्समैन ' + dup.by : (dup.by || '?');
          if (!confirm('⚠️ ऐसी ही एंट्री पहले से मौजूद है:\n' + dup.partyName + ' · ' + dup.vehicle + ' · ' + money(dup.amount) + ' · ' + (dup.time || '') + '\nकिसने की: ' + by + '\n\nफिर भी दोबारा जोड़ें?')) return;
        }
      }
      if (!e && data.kind === 'udhar' && !priv && num(party.limit) > 0 && num(party.bal) + data.amount > num(party.limit)) {
        if (!confirm('⚠️ ' + party.name + ' की उधार सीमा ' + money(party.limit) + ' है।\nअभी बकाया ' + money(party.bal) + ' + यह ' + money(data.amount) + ' = ' + money(num(party.bal) + data.amount) + '\n\nफिर भी उधार दें?')) return;
      }
      sbtn.disabled = true;

      const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
      const ref = e ? db().collection(col).doc(e.id) : db().collection(col).doc();
      const b = db().batch(); b.set(ref, data);
      const newSig = sigEntry(priv, data);
      const delta = newSig - (e ? sigEntry(priv, e) : 0);
      if (e && e.partyId && e.partyId !== partyId) {
        const oldSig = sigEntry(priv, e);
        if (oldSig) b.update(db().collection(pcol).doc(e.partyId), { bal: FV().increment(-oldSig) });
        if (newSig) b.update(db().collection(pcol).doc(partyId), { bal: FV().increment(newSig) });
      } else if (delta) b.update(db().collection(pcol).doc(partyId), { bal: FV().increment(delta) });

      try {
        await APP.commit(b.commit());
        m.close(); toast('सेव हो गया ✔');
        if (e) APP.audit('ledger_edit', { party: party.name, was: { amount: e.amount, litre: e.litre, date: e.date, kind: e.kind }, now: { amount: data.amount, litre: data.litre, date: data.date, kind: data.kind }, priv });
        if (!priv) { APP.refreshDaySum(data.date); if (e && e.date !== data.date) APP.refreshDaySum(e.date); }
        const savedParty = Object.assign({}, party);
        S.parties[priv ? 'priv' : 'pub'] = null;
        if (S.partyView) partyView(S.partyView.id, S.partyView.priv);
        else if (S.tab === 'day') APP.dayView(S.date);
        else if (S.tab === 'ledger') ledgerView();
        else if (S.tab === 'priv') APP.views.priv();
        else if (APP.views && APP.views[S.tab]) APP.views[S.tab]();
        if (APP.afterEntrySaved) { try { APP.afterEntrySaved({ data, party: savedParty, priv, isNew: !e, delta }); } catch (z) { console.error(z); } }
        
        if (!e && !priv && party.phone) {
          setTimeout(() => {
            if (confirm('📤 ' + party.name + ' को WhatsApp पर भेजें?\n\n' + (data.kind === 'udhar' ? 'तेल भरने की पर्ची' : 'जमा की रसीद'))) {
              sendEntryWhatsApp(data, party, priv);
            }
          }, 400);
        }
      } catch (x) { sbtn.disabled = false; toast('सेव नहीं हुआ: ' + x.message); }
    };
  }
  APP.entryModal = entryModal;

  async function ledgerView() {
    S.partyView = null;
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties; try { parties = await APP.getParties(false, true); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const due = parties.filter(p => num(p.bal) > 0);
    main.innerHTML = `
      <div class="card">
        <div class="kv"><span>कुल बकाया (लेना है)</span><b class="neg">${money(due.reduce((a, p) => a + num(p.bal), 0))}</b></div>
      </div>
      <div class="row search"><input id="q" placeholder="पार्टी या गाड़ी खोजें…"></div>
      <div class="card" id="plist"></div>
      <div class="btns">
        <button class="btn o" id="bU">+ उधार</button>
        <button class="btn g" id="bJ">+ जमा</button>
        ${APP.isOwner() ? '<button class="btn w" id="bP">+ नई पार्टी</button>' : ''}
        ${APP.isOwner() ? '<button class="btn w" id="bBulk">📥 लिस्ट से जोड़ें</button>' : ''}
      </div>`;

    const draw = () => {
      const t = $('#q').value.trim().toLowerCase();
      const list = parties.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#plist').innerHTML = list.length ? list.map(p => {
        const b = num(p.bal);
        const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '+₹' + Math.abs(b).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
        const cls = b > 0 ? 'r' : (b < 0 ? 'g' : '');
        const cibilBadge = (APP.cibil && APP.cibil.badgeHtml) ? APP.cibil.badgeHtml(p) : '';
        return `<div class="item" data-id="${p.id}" style="cursor:pointer">
          <div class="a"><b>${esc(p.name)}</b> ${cibilBadge}<small>${esc((p.vehicles || []).join(', '))}</small></div>
          <span class="chip ${cls}">${disp}</span>
        </div>`;
      }).join('') : '<p class="mut">कोई पार्टी नहीं मिली</p>';
      $$('#plist .item').forEach(it => it.onclick = () => partyView(it.dataset.id, false));
    };
    $('#q').oninput = draw; draw();
    $('#bU').onclick = () => entryModal({ kind: 'udhar', date: today() });
    $('#bJ').onclick = () => entryModal({ kind: 'jama', date: today() });
    if (APP.isOwner()) $('#bP').onclick = () => partyModal(null, false);
    if (APP.isOwner()) $('#bBulk').onclick = () => bulkPartyModal();
  }
  APP.ledgerView = ledgerView;

  function partyModal(p, priv) {
    const m = modal(`<h3>${p ? 'पार्टी बदलें' : 'नई पार्टी'}</h3>
      <label>नाम</label><input id="p-name" value="${esc(p ? p.name : '')}">
      <label>मोबाइल नंबर</label><input id="p-phone" inputmode="tel" value="${esc(p ? p.phone || '' : '')}">
      <label>गाड़ियां (कॉमा या नई लाइन में)</label><textarea id="p-veh" rows="3">${esc(p ? (p.vehicles || []).join('\n') : '')}</textarea>
      <div class="btns"><button class="btn g" id="p-save">सेव</button><button class="btn w" id="p-cancel">रद्द</button></div>`);
    $('#p-cancel', m).onclick = () => m.close();
    $('#p-save', m).onclick = async () => {
      const name = $('#p-name', m).value.trim(); if (!name) return toast('नाम लिखें');
      const vehicles = $('#p-veh', m).value.split(/[\n,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const data = { name, phone: $('#p-phone', m).value.trim(), vehicles };
      const pcol = priv ? 'priv_parties' : 'parties';
      const b = db().batch();
      if (p) { b.update(db().collection(pcol).doc(p.id), data); }
      else { const ref = db().collection(pcol).doc(); data.bal = 0; data.createdAt = FV().serverTimestamp(); b.set(ref, data); }
      await APP.commit(b.commit()); m.close(); toast('सेव हो गया'); S.parties[priv ? 'priv' : 'pub'] = null; 
      if(p) { if(priv) partyView(p.id, true); else ledgerView(); }
      else { if(priv) APP.views.priv(); else ledgerView(); }
    };
  }
  APP.partyModal = partyModal;

  async function bulkPartyModal() {
    const m = modal(`<h3>📥 पार्टी लिस्ट जोड़ें</h3>
      <p class="mut" style="margin:4px 0 8px">हर लाइन में एक पार्टी: <b>नाम : गाड़ी1, गाड़ी2</b><br>पार्टी पहले से हो तो सिर्फ नई गाड़ियाँ जुड़ेंगी।</p>
      <textarea id="bk-ta" rows="10" style="width:100%;font-size:13px" placeholder="लक्ष्मण सिंह भराड़ा : 4488, 3388&#10;पारस सती : 2002 CB, 2002 CC"></textarea>
      <div id="bk-pv" style="margin-top:8px"></div>
      <div class="btns" style="margin-top:10px">
        <button class="btn w" id="bk-check">जाँचें</button>
        <button class="btn g" id="bk-save" style="display:none">✅ जोड़ दो</button>
        <button class="btn w" id="bk-no">रद्द</button>
      </div>`);
    let plan = [];
    $('#bk-no', m).onclick = () => m.close();
    const key = s => String(s || '').toLowerCase().replace(/[\s.\-_(),]+/g, '');
    $('#bk-check', m).onclick = async () => {
      let ps; try { ps = await APP.getParties(false, true); } catch (e) { return toast('लिस्ट नहीं मिली: ' + e.message); }
      plan = [];
      $('#bk-ta', m).value.split('\n').forEach(line => {
        line = line.trim(); if (!line) return;
        const i = line.search(/[:|\t]/);
        const name = (i < 0 ? line : line.slice(0, i)).trim();
        const vehicles = (i < 0 ? '' : line.slice(i + 1)).split(/[,;/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
        if (!name) return;
        const ex = ps.find(p => key(p.name) === key(name));
        if (ex) {
          const have = (ex.vehicles || []).map(v => key(v));
          const add = vehicles.filter(v => !have.includes(key(v)));
          plan.push({ ex, name: ex.name, add, all: (ex.vehicles || []).concat(add) });
        } else plan.push({ ex: null, name, add: vehicles, all: vehicles });
      });
      const newN = plan.filter(x => !x.ex).length, upN = plan.filter(x => x.ex && x.add.length).length;
      $('#bk-pv', m).innerHTML = plan.length
        ? `<div class="kv"><span>नई पार्टी</span><b>${newN}</b></div><div class="kv"><span>गाड़ी जुड़ेंगी (पुरानी में)</span><b>${upN}</b></div>` +
          plan.map(x => `<div class="mut" style="font-size:12px">${x.ex ? (x.add.length ? '➕' : '＝') : '🆕'} ${esc(x.name)} ${x.add.length ? '· ' + esc(x.add.join(', ')) : x.ex ? '· कुछ नया नहीं' : ''}</div>`).join('')
        : '<div class="warn">कोई लाइन नहीं मिली</div>';
      $('#bk-save', m).style.display = plan.some(x => !x.ex || x.add.length) ? '' : 'none';
    };
    $('#bk-save', m).onclick = async () => {
      const b = db().batch(); let n = 0;
      plan.forEach(x => {
        if (x.ex) { if (x.add.length) { b.update(db().collection('parties').doc(x.ex.id), { vehicles: x.all }); n++; } }
        else { b.set(db().collection('parties').doc(), { name: x.name, phone: '', vehicles: x.all, bal: 0, createdAt: FV().serverTimestamp() }); n++; }
      });
      try { await APP.commit(b.commit()); m.close(); toast(n + ' पार्टी अपडेट हुईं ✔'); S.parties.pub = null; ledgerView(); }
      catch (e) { toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  async function partyView(id, priv) {
    const col = priv ? 'priv_ledger' : 'ledger', pcol = priv ? 'priv_parties' : 'parties';
    S.partyView = { id, priv: !!priv };
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let ps, es;
    try { [ps, es] = await Promise.all([db().collection(pcol).doc(id).get(), db().collection(col).where('partyId', '==', id).get()]); }
    catch (e) { main.innerHTML = APP.errBox(e); return; }
    if (!ps.exists) { S.partyView = null; main.innerHTML = '<div class="err">पार्टी नहीं मिली</div>'; return; }
    const p = { id, ...ps.data() };
    const all = es.docs.map(x => ({ id: x.id, ...x.data() }));
    const st = K.stmt(all, null, null);
    
    const tDr = st.rows.filter(r => r.kind === 'udhar').reduce((a, b) => a + num(b.amount), 0);
    const tCr = st.rows.filter(r => r.kind === 'jama').reduce((a, b) => a + num(b.amount), 0);
    const ph = String(p.phone || '').replace(/\D/g, '').replace(/^0+/, ''), wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
    const mism = !priv && Math.abs(num(p.bal) - st.close) > 0.5;
    const viewer = APP.isViewer();
    const canEdit = !viewer && APP.isTrueOwner();

    const desc = r => {
      if (r.opening) return '<b>पिछला बैलेंस</b>' + (r.note && !/Opening Balance/i.test(r.note) ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
      if (r.kind === 'udhar') return '<b>' + esc(r.vehicle || '-') + '</b>' + (r.fuel ? '<br><small class="mut">' + (FUEL[r.fuel] || '') + ' · ' + lit(r.litre) + (num(r.rate) ? ' × ₹' + num(r.rate) : '') + '</small>' : '') + (r.note ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
      return '<b>जमा</b> · ' + esc(MODE[r.mode] || 'नकद') + (r.note && !AUTO_NOTES.includes(r.note) ? '<br><small class="mut">' + esc(r.note) + '</small>' : '');
    };

    const balDisp = st.close === 0 ? '₹0' : (st.close > 0 ? '-₹' + Math.abs(st.close).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '+₹' + Math.abs(st.close).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
    const balColor = st.close > 0 ? 'var(--r)' : (st.close < 0 ? 'var(--g)' : 'var(--t)');
    
    const cibilCard = (APP.cibil && APP.cibil.cardHtml) ? APP.cibil.cardHtml(p, all) : '';
    const wasooliChip = (APP.cibil && APP.cibil.wasooliChip) ? APP.cibil.wasooliChip(p, all) : '';
    const showPortalBtn = APP.isOwner() && !viewer && APP.portal && APP.portal.openCodeModal;

    main.innerHTML = `
      <div class="btns" style="margin-bottom:10px">
        <button class="btn sm w" id="back">← वापस</button>
        ${(APP.isOwner() && !viewer) ? '<button class="btn sm o" id="editP">✏️ पार्टी बदलें</button>' : ''}
        ${canEdit ? '<button class="btn sm w" id="addOB">⚖️ पिछला बैलेंस</button>' : ''}
        ${viewer ? '' : '<button class="btn sm g" id="addU">+ उधार</button>'}
        ${(!viewer && !priv) ? '<button class="btn sm g" id="addJ">+ जमा</button>' : ''}
        ${(!viewer && priv) ? '<button class="btn sm g" id="markPaid" style="background:var(--g)">✅ Paid / वसूली</button>' : ''}
        ${priv && canEdit ? '<button class="btn sm r" id="closeK">✅ खाता बंद</button>' : ''}
      </div>
      
      ${cibilCard}
      
      <div class="card" style="padding:12px;">
        <h3 style="margin:0;color:#0b3d91">${esc(p.name)} ${wasooliChip}</h3>
        <p class="mut" style="margin-top:4px">${esc(p.phone || 'फोन नंबर नहीं')} | ${esc((p.vehicles || []).join(', '))}</p>
        ${ph ? `<div class="btns" style="margin:6px 0 2px"><a href="tel:${esc(p.phone)}" class="btn sm g">📞 कॉल</a>${wa ? `<a href="https://wa.me/${wa}" target="_blank" class="btn sm g">💬 WhatsApp</a>` : ''}</div>` : ''}
        ${showPortalBtn ? '<button class="btn full" id="portalBtn" style="margin-top:8px;background:#0a7d33;color:#fff">🔑 पोर्टल कोड / भेजें</button>' : ''}
        
        <div class="ledger-summary">
          <div class="ledger-box debit">
            <span>कुल उधार (Dr)</span>
            <b>${money(tDr)}</b>
          </div>
          <div class="ledger-box credit">
            <span>कुल जमा (Cr)</span>
            <b>${money(tCr)}</b>
          </div>
          <div class="ledger-box">
            <span>असली बैलेंस</span>
            <b style="color:${balColor}">${balDisp}</b>
          </div>
        </div>
        
        ${mism && canEdit ? `<div class="warn" style="margin-top:8px">⚠️ पार्टी का सेव बैलेंस ${money(p.bal)} है, पर एंट्रियों का जोड़ ${money(st.close)}। <button class="btn sm o" id="fixBal" type="button">🔧 ठीक करें</button></div>` : ''}
        <button class="btn full" id="shareStmt" style="margin-top:8px;background:#0b3d91">📄 प्रोफेशनल स्टेटमेंट देखें / भेजें</button>
        ${!viewer && st.close > 0 ? `<button class="btn full" id="invoiceBtn" style="margin-top:8px;background:#0a7d33">🧾 Professional Invoice (UPI QR)</button>` : ''}
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <div class="pro-table-wrap">
          <table class="pro-table">
            <thead>
              <tr>
                <th>तारीख</th>
                <th>विवरण</th>
                <th style="text-align:right">उधार (Dr)</th>
                <th style="text-align:right">जमा (Cr)</th>
                <th style="text-align:right">बैलेंस</th>
                ${canEdit ? '<th style="text-align:center">एक्शन</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${st.rows.length ? st.rows.map(r => `
                <tr>
                  <td class="dt">${dmy(r.date)}</td>
                  <td>${desc(r)}</td>
                  <td class="dr">${r.kind === 'udhar' ? money(r.amount) : ''}</td>
                  <td class="cr">${r.kind === 'jama' ? money(r.amount) : ''}</td>
                  <td class="bal" style="color:${r.run > 0.005 ? '#c0392b' : r.run < -0.005 ? '#0a7d33' : 'inherit'}">${Math.abs(r.run) < 0.005 ? '₹0' : (r.run > 0 ? '-₹' : '+₹') + Math.abs(r.run).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  ${canEdit ? `
                    <td>
                      <div class="action-btns">
                        <button class="edit" data-edit-row="${r.id}">✏️</button>
                        <button class="del" data-del-row="${r.id}">🗑</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('') : `<tr><td colspan="${canEdit ? 6 : 5}" class="mut" style="text-align:center;padding:20px;">कोई एंट्री नहीं है</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
      
    $('#back').onclick = () => { 
      S.partyView = null; 
      if (viewer) return APP.go('v_parties');
      priv ? APP.views.priv() : ledgerView(); 
    };
    if (APP.isOwner() && !viewer && $('#editP')) $('#editP').onclick = () => partyModal(p, priv);
    if (!viewer && $('#addU')) $('#addU').onclick = () => entryModal({ kind: 'udhar', date: today(), partyId: id, priv: priv });
    if (!viewer && $('#addJ')) $('#addJ').onclick = () => entryModal({ kind: 'jama', date: today(), partyId: id, priv: priv });
    if (!viewer && $('#markPaid')) $('#markPaid').onclick = () => paidPrivModal(p, priv);
    if (canEdit && $('#addOB')) $('#addOB').onclick = () => openingBalanceModal(id, priv);
    if ($('#closeK')) $('#closeK').onclick = () => closePrivKhata(p, all);
    if ($('#portalBtn')) $('#portalBtn').onclick = () => APP.portal.openCodeModal(p, priv);
    
    $('#shareStmt').onclick = () => APP.sharePartyStatement(id, priv);
    if ($('#invoiceBtn')) $('#invoiceBtn').onclick = () => APP.showInvoiceModal(p, all);
    
    if (canEdit && $('#fixBal')) $('#fixBal').onclick = async () => {
      if (!confirm('पार्टी का बैलेंस ' + money(p.bal) + ' से बदलकर ' + money(st.close) + ' (एंट्रियों के जोड़ के बराबर) करें?')) return;
      try { await APP.commit(db().collection(pcol).doc(id).update({ bal: st.close })); APP.audit('party_bal_fix', { party: p.name, was: p.bal, now: st.close }); toast('बैलेंस ठीक हो गया ✔'); S.parties[priv ? 'priv' : 'pub'] = null; partyView(id, priv); }
      catch (e) { toast('नहीं हुआ: ' + e.message); }
    };
    
    if (canEdit) {
      $$('[data-edit-row]').forEach(b => b.onclick = () => {
        const row = all.find(x => x.id === b.dataset.editRow);
        if (row) entryModal({ entry: row, date: row.date, priv: priv });
      });
      $$('[data-del-row]').forEach(b => b.onclick = async () => {
        const row = all.find(x => x.id === b.dataset.delRow);
        if (!row) return;
        if (!priv && await APP.dayIsLocked(row.date)) return toast('❌ यह तारीख लॉक है');
        if (!confirm('क्या आप सच में इस एंट्री को हटाना चाहते हैं?\n\n' + dmy(row.date) + ' · ' + (row.kind === 'udhar' ? 'उधार ' : 'जमा ') + money(row.amount))) return;
        b.disabled = true;
        try {
          const b2 = db().batch();
          b2.delete(db().collection(col).doc(row.id));
          const delta = -sigEntry(priv, row);
          if (delta) b2.update(db().collection(pcol).doc(row.partyId), { bal: FV().increment(delta) });
          await APP.commit(b2.commit());
          APP.audit('ledger_delete', { party: row.partyName, kind: row.kind, amount: row.amount, litre: row.litre || 0, vehicle: row.vehicle || '', date: row.date, enteredBy: row.by || '', priv });
          if (!priv) APP.refreshDaySum(row.date);
          toast('एंट्री हटा दी गई ✔');
          S.parties[priv ? 'priv' : 'pub'] = null;
          partyView(id, priv);
        } catch (e) { b.disabled = false; toast('नहीं हटा: ' + e.message); }
      });
    }
  }
  APP.partyView = partyView;

  async function paidPrivModal(p, priv) {
    const bal = num(p.bal);
    if (bal <= 0) return toast('कोई बकाया नहीं है');
    const m = modal(`<h3>✅ Paid / वसूली - ${esc(p.name)}</h3>
      <div class="kv"><span>कुल बकाया</span><b class="neg">${money(bal)}</b></div>
      <label>कितना पैसा मिला? (₹)</label><input id="pd-amt" inputmode="decimal" value="${bal}">
      <label>कैसे मिला?</label>
      <select id="pd-mode">
        <option value="cash">नकद (Cash)</option>
        <option value="paytm">Paytm / UPI</option>
        <option value="swipe">स्वाइप (Card)</option>
        <option value="bank">बैंक</option>
      </select>
      <div class="btns" style="margin-top:12px">
        <button class="btn g" id="pd-sv">✅ सेव करें</button>
        <button class="btn w" id="pd-cl">रद्द</button>
      </div>
    `);
    $('#pd-cl', m).onclick = () => m.close();
    $('#pd-sv', m).onclick = async () => {
      const amt = num($('#pd-amt', m).value);
      const mode = $('#pd-mode', m).value;
      if (!(amt > 0)) return toast('रकम डालें');
      if (amt > bal) {
        if(!confirm('रकम बकाये से ज्यादा है। एडवांस के रूप में सेव करें?')) return;
      }
      const data = {
        partyId: p.id, partyName: p.name, date: today(), time: nowTime(),
        kind: 'jama', mode: mode, amount: amt, note: 'Paid / वसूली', 
        by: S.user.email, at: FV().serverTimestamp(), status: 'paid'
      };
      try {
        const b = db().batch();
        b.set(db().collection('priv_ledger').doc(), data);
        b.update(db().collection('priv_parties').doc(p.id), { bal: FV().increment(-amt) });
        await APP.commit(b.commit());
        m.close(); toast('पैसा जमा हो गया ✔');
        partyView(p.id, priv);
      } catch(e) { toast('एरर: ' + e.message); }
    };
  }

  async function closePrivKhata(p, all) {
    const bal = r2(num(p.bal));
    if (!(bal > 0.01)) return toast('इस खाते में कोई बकाया नहीं है');
    if (!confirm(p.name + ' का ' + money(bal) + ' पूरा मिल गया?\nखाता बंद होकर "हिस्ट्री" में चला जाएगा।')) return;
    try {
      const pend = all.filter(x => x.status === 'pending');
      for (let i = 0; i < pend.length; i += 400) { const b = db().batch(); pend.slice(i, i + 400).forEach(x => b.update(db().collection('priv_ledger').doc(x.id), { status: 'paid', paidAt: FV().serverTimestamp() })); await b.commit(); }
      await db().collection('priv_parties').doc(p.id).update({ bal: 0, closedAmount: bal, closedAt: FV().serverTimestamp() });
      APP.audit('priv_close', { party: p.name, amount: bal });
      S.parties.priv = null; toast('खाता बंद ✔'); APP.views.priv();
    } catch (e) { toast('नहीं हुआ: ' + e.message); }
  }

  function openingBalanceModal(partyId, priv) {
    const m = modal(`<h3>⚖️ पिछला बैलेंस (Opening Balance)</h3>
      <p class="mut" style="font-size:12px">इससे पहले का हिसाब मैन्युअल लेजर में है, यहाँ से आगे का हिसाब ऐप में रहेगा।</p>
      <label>तारीख (जिस दिन से ऐप में हिसाब शुरू)</label><input type="date" id="ob-date" value="${today().slice(0, 8)}01">
      ${priv ? '' : '<label>किस तरह का बैलेंस?</label><select id="ob-type"><option value="due">हमें लेना है (बकाया)</option><option value="adv">पार्टी का एडवांस हमारे पास है</option></select>'}
      <label>रकम (₹)</label><input id="ob-amt" inputmode="decimal">
      <label>नोट</label><input id="ob-note" value="पिछले हिसाब का बैलेंस (Opening Balance)">
      <div class="btns"><button class="btn g" id="ob-save">सेव</button><button class="btn w" id="ob-cancel">रद्द</button></div>`);
    $('#ob-cancel', m).onclick = () => m.close();
    $('#ob-save', m).onclick = async () => {
      const amt = num($('#ob-amt', m).value);
      if (!amt) return toast('रकम भरें');
      const date = $('#ob-date', m).value;
      const note = $('#ob-note', m).value;
      
      const data = {
        partyId, partyName: APP.partyById(priv, partyId).name,
        date, time: '00:00', opening: true, kind: (!priv && $('#ob-type', m).value === 'adv') ? 'jama' : 'udhar', ...((!priv && $('#ob-type', m).value === 'adv') ? { mode: 'cash' } : {}),
        vehicle: '', fuel: '', rate: 0, litre: 0,
        amount: amt, note, by: S.user.email, at: FV().serverTimestamp()
      };
      if (priv) data.status = 'pending';
      
      try {
        const b = db().batch();
        const ref = db().collection(priv ? 'priv_ledger' : 'ledger').doc();
        b.set(ref, data);
        const newSig = sigEntry(priv, data);
        b.update(db().collection(priv ? 'priv_parties' : 'parties').doc(partyId), { bal: FV().increment(newSig) });
        await b.commit();
        m.close(); toast('सेव हो गया ✔');
        S.parties[priv ? 'priv' : 'pub'] = null;
        partyView(partyId, priv);
      } catch(e) { toast('सेव नहीं हुआ: ' + e.message); }
    };
  }

  console.log('[Mazda app_ledger.js] Model 3.8 Added ✓');
})();
