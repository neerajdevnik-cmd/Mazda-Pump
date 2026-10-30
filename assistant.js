/* Mazda Oil Company - Ultimate God-Tier Assistant (v5.0)
   Fixes: 4-digit amount bug, Context Memory (Inka/Uski), Weather/Smart Pivot, Identity
*/
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;

  const S = APP.S || {};
  const esc = APP.esc || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const num = APP.num || (v => Number(v) || 0);
  const money = APP.money || (v => '₹' + Math.round(num(v)).toLocaleString('en-IN'));
  const lit = APP.lit || (v => Math.round(num(v)).toLocaleString('en-IN') + ' L');
  const toast = APP.toast || (() => {});
  const db = () => APP.db;
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const T = () => (APP.todayISO ? APP.todayISO() : iso(new Date()));
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

  // ======================================================================
  // 1. MEMORY & CONTEXT
  // ======================================================================
  const SK = 'mazda_assistant_v5';
  let MEM = { tts: true, voice: '' };
  try { const j = JSON.parse(localStorage.getItem(SK) || 'null'); if (j) MEM = Object.assign(MEM, j); } catch (e) {}
  const saveMem = () => { try { localStorage.setItem(SK, JSON.stringify(MEM)); } catch (e) {} };

  const ctx = { activeParty: null, activeVehicle: null, pendingAction: null };

  // ======================================================================
  // 2. VOICE (TTS)
  // ======================================================================
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  
  const W = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सतासी अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे').split(' ');
  function hiNum(n) {
    n = Math.floor(Math.abs(n)); if (n < 100) return W[n]; const p = [];
    const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3; const h = Math.floor(n / 100); n %= 100;
    if (cr) p.push(hiNum(cr) + ' करोड़'); if (lk) p.push(W[lk] + ' लाख'); if (th) p.push(W[th] + ' हज़ार');
    if (h) p.push(W[h] + ' सौ'); if (n) p.push(W[n]); return p.join(' ');
  }
  function speechify(html) {
    let t = String(html || '').replace(/<br\s*\/?>|<\/(div|p|li)>/gi, ' । ').replace(/<[^>]*>/g, ' ');
    t = t.replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, ' ');
    t = t.replace(/₹\s*(-?)\s*([\d,]+(?:\.\d+)?)/g, (m, neg, n) => (neg ? 'माइनस ' : '') + hiNum(n.replace(/,/g,'')) + ' रुपये');
    t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:L|ltr|Ltr|lit\.?|लीटर)\b/g, (m, n) => hiNum(n) + ' लीटर');
    t = t.replace(/\d[\d,]*(?:\.\d+)?/g, n => hiNum(n.replace(/,/g,'')));
    t = t.replace(/[|•·*_#~>]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  const Voice = (() => {
    let chosen = null, queue = [], busy = false;
    function load() {
      if (!window.speechSynthesis) return;
      const voices = speechSynthesis.getVoices() || [];
      const list = voices.filter(v => /^hi/i.test(v.lang) || /^en[-_]in/i.test(v.lang));
      chosen = list.find(v => /female|swara|lekha/i.test(v.name)) || list[0] || null;
    }
    if (window.speechSynthesis) { load(); speechSynthesis.onvoiceschanged = load; }
    function next() {
      if (!queue.length) { busy = false; return; }
      busy = true;
      const u = new SpeechSynthesisUtterance(queue.shift());
      u.lang = (chosen && chosen.lang) || 'hi-IN';
      if (chosen) u.voice = chosen;
      u.rate = 0.95; u.pitch = 1.0; 
      u.onend = next; u.onerror = next;
      speechSynthesis.speak(u);
    }
    return {
      say(text) {
        if (!MEM.tts || !window.speechSynthesis) return;
        this.stop(); load();
        queue = (text.match(/[^।.?!]+[।.?!]*/g) || [text]).map(s => s.trim()).filter(Boolean);
        next();
      },
      stop() { queue = []; try { speechSynthesis.cancel(); } catch (e) {} busy = false; }
    };
  })();

  // ======================================================================
  // 3. SMART PARSER & HELPERS
  // ======================================================================
  
  // 🚨 FIX: 4-digit amounts will NOT be ignored unless they match a vehicle in DB
  async function extractAmounts(q, parties) {
    const words = q.replace(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/gi, ' ').split(/\s+/); // Remove full plates
    let amounts = [];
    let knownVehicles = [];
    if (parties) parties.forEach(p => (p.vehicles || []).forEach(v => knownVehicles.push(v.replace(/\D/g, '').slice(-4))));

    for (let i = 0; i < words.length; i++) {
      let w = words[i].replace(/,/g, '');
      if (/^\d{4}$/.test(w) && knownVehicles.includes(w) && !/rupaye|rs|hazar|paytm|swipe|udhar/i.test(q)) continue; // Skip if it's a known vehicle
      
      let m = w.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/);
      if (m) {
        let val = parseFloat(m[1]);
        if (m[2] === 'k') val *= 1000;
        if (m[2] === 'l' || m[2] === 'lakh') val *= 100000;
        if (words[i+1] && /hazar|hajar/i.test(words[i+1])) val *= 1000;
        amounts.push(val);
      }
    }
    return amounts;
  }

  async function findParty(q) {
    const parties = S.parties && S.parties.pub ? S.parties.pub : await APP.getParties(false, true);
    if (!parties || !parties.length) return null;

    const qNorm = norm(q);
    const plate = q.match(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/i);
    const fourDigit = q.match(/\b\d{4}\b/);
    let vKey = plate ? plate[0].toUpperCase().replace(/\s+/g, '') : (fourDigit ? fourDigit[0] : null);

    if (vKey) {
      const match = parties.find(p => (p.vehicles || []).some(v => String(v).toUpperCase().replace(/\s+/g, '').includes(vKey)));
      if (match) { ctx.activeVehicle = vKey; return match; }
    }

    const words = qNorm.split(' ').filter(w => w.length >= 3 && !['kholo','ledger','khata','hisab','udhar','batao','dikhao','rupaye','diesel','petrol','mein','entry'].includes(w));
    if (words.length) {
      let bestP = null, bestScore = 0;
      parties.forEach(p => {
        const pName = norm(p.name);
        let score = 0;
        words.forEach(w => { if (pName.includes(w)) score += w.length; });
        if (score > bestScore) { bestScore = score; bestP = p; }
      });
      if (bestScore > 2) return bestP;
    }
    return null;
  }

  // ======================================================================
  // 4. CORE LOGIC (The Brain)
  // ======================================================================
  function R(html, o) { return Object.assign({ html }, o || {}); }

  async function handleQuery(raw, ui) {
    const q = norm(raw);
    const parties = await APP.getParties(false, true);
    
    // 0. Pending Action (Yes/No)
    if (ctx.pendingAction) {
      if (/haan|yes|ha|ok|theek|sahi/i.test(q)) return commitAction(ui);
      if (/nahi|no|cancel|radd/i.test(q)) { ctx.pendingAction = null; return R('ठीक है, रद्द कर दिया।'); }
      // If user types something else, clear the pending action and process new query
      ctx.pendingAction = null;
    }

    // 1. Identity & Owner (NEW)
    if (/(pump|mazda).*(owner|malik|kiska|shashank)/i.test(q)) {
      return R(`इस माज़दा ऑयल कंपनी (पंप) के मालिक <b>शशांक बंसल</b> हैं।`, { say: 'इस पंप के मालिक शशांक बंसल जी हैं।' });
    }
    if (/(tumhara|aapka).*(owner|malik)|kisne banaya|who made you/i.test(q)) {
      return R(`मैं एक AI हूँ, मेरा कोई मालिक नहीं है। मुझे <b>नीरज देव</b> ने बनाया है।`, { say: 'मैं एक ए आई हूँ, मेरा कोई मालिक नहीं है। मुझे नीरज देव ने बनाया है।' });
    }
    if (/(mera naam|main kaun|who am i)/i.test(q)) {
      const uName = S.user ? S.user.email.split('@')[0] : (S.salesman ? S.salesman.name : 'User');
      const role = S.role === 'owner' ? 'मालिक' : (S.role === 'manager' ? 'मैनेजर' : 'यूज़र');
      return R(`आपका नाम <b>${esc(uName)}</b> है और आप इस ऐप में <b>${role}</b> के रूप में लॉगिन हैं।`);
    }
    if (/(tum|aap).*(kaun|kya|kahan)|who are you/i.test(q)) {
      return R(`मैं माज़दा असिस्टेंट हूँ, एक AI। मेरा कोई शरीर नहीं है, मैं इसी ऐप के अंदर रहती हूँ।`, { say: 'मैं माज़दा असिस्टेंट हूँ, एक ए आई। मैं इसी ऐप के अंदर रहती हूँ।' });
    }

    // 2. Delete Blocker
    if (/remove|delete|hatao|mita/i.test(q)) {
      return R(`माफ़ कीजिए, मैं कोई भी एंट्री delete नहीं कर सकती। यह अधिकार सिर्फ मालिक के पास है।`, { say: 'माफ़ कीजिए, मैं कोई भी एंट्री डिलीट नहीं कर सकती।' });
    }

    // 3. Context Follow-up (Inka, Uski, Khata Kholo)
    if (/inka|uska|iski|uski/i.test(q) || /khata kholo|ledger kholo/i.test(q)) {
      if (ctx.activeParty) {
        if (/khata|ledger/i.test(q)) {
          setTimeout(() => { ui.close(); APP.partyView(ctx.activeParty.id, false); }, 1000);
          return R(`⏳ <b>${esc(ctx.activeParty.name)}</b> का खाता खोल रही हूँ...`);
        }
        if (/udhar|baaki/i.test(q)) {
          return R(`<b>${esc(ctx.activeParty.name)}</b> का कुल उधार: <b class="neg">${money(ctx.activeParty.bal)}</b>`);
        }
      } else {
        return R('किस पार्टी की बात कर रहे हैं? कृपया नाम या गाड़ी नंबर बताइए।');
      }
    }

    // 4. Vehicle Only Query (e.g., "9769")
    if (/^\d{4}$/.test(q) || /^[a-z]{2}\d{2}[a-z]{1,3}\d{4}$/i.test(q)) {
      const p = await findParty(q);
      if (p) {
        ctx.activeParty = p;
        return R(`गाड़ी <b>${q.toUpperCase()}</b> पार्टी <b>${esc(p.name)}</b> की है। बकाया: <b>${money(p.bal)}</b>.<br>आप क्या एंट्री करना चाहते हैं?`, {
          say: speechify(`यह गाड़ी ${p.name} की है। इनका बकाया ${p.bal} रुपये है।`)
        });
      } else {
        return R(`इस नंबर की कोई गाड़ी नहीं मिली।`);
      }
    }

    // 5. Smart Pivot (Weather, Tanker Arrival)
    if (/baarish|mausam|weather|rain|garmi|thand/i.test(q)) {
      const dSnap = await db().collection('days').doc(T()).get();
      const sale = dSnap.exists ? money((dSnap.data().sum || {}).sale) : '₹0';
      return R(`मौसम का हाल तो बादल जानें, पर अगर बारिश हुई तो बिक्री पर असर पड़ेगा। अभी तक आज की सेल <b>${sale}</b> हो चुकी है!`);
    }
    if (/gaadi|tanker/i.test(q) && /kab|aayegi|time|late/i.test(q)) {
      return R(`स्टॉक और टैंकर रिपोर्ट देखकर लगता है कि अगला टैंकर जल्दी आ सकता है। (डेटा अपडेट होते रहेंगे)`);
    }

    // 6. Dip Chart
    if (/dip/i.test(q) && /liter|kitna|petrol|diesel/i.test(q)) {
      const dipMatch = q.match(/\b\d+(\.\d+)?\b/);
      if (dipMatch && window.DipChart) {
        const v = parseFloat(dipMatch[0]);
        let txt = `<b>${v} Dip पर:</b><br>`;
        if (/diesel|hsd/i.test(q) || !/petrol/i.test(q)) txt += `🛢️ डीज़ल: <b>${lit(window.DipChart.getLiters('diesel', v))}</b><br>`;
        if (/petrol|ms/i.test(q) || !/diesel/i.test(q)) txt += `⛽ पेट्रोल: <b>${lit(window.DipChart.getLiters('petrol', v))}</b>`;
        return R(txt, { say: speechify(txt) });
      }
    }

    // 7. Sale Query
    if (/sale|bikri/i.test(q)) {
      const isKal = /kal/i.test(q);
      const dStr = isKal ? addDays(T(), -1) : T();
      const dSnap = await db().collection('days').doc(dStr).get();
      if (!dSnap.exists) return R(`${isKal?'कल':'आज'} का हिसाब शुरू नहीं हुआ है।`);
      const sum = dSnap.data().sum || {};
      return R(`<b>${isKal?'कल':'आज'} की कुल सेल: ${money(sum.sale)}</b><br>⛽ पेट्रोल: ${lit(sum.litP)}<br>🛢️ डीज़ल: ${lit(sum.litD)}`, { 
        say: speechify(`${isKal?'कल':'आज'} की सेल ${sum.sale} रही।`)
      });
    }

    // 8. Entry: Udhar
    if (/udhar/i.test(q) && /likhna|entry|karo|dalna|add|hai/i.test(q)) {
      return handleUdharEntry(q, parties, ui);
    }

    // 9. Entry: Daily (Meter, Paytm, Swipe, Kharcha)
    if (/meter|reading|paytm|swipe|dg|kharcha|chai|p1|p2|p3|p4|d1|d2|d3|d4/i.test(q)) {
      return handleDailyEntry(q, parties, ui);
    }

    // 10. Udhar Balance Query
    if (/udhar|baaki/i.test(q)) {
      const p = await findParty(q) || ctx.activeParty;
      if (!p) return R(`किस पार्टी का उधार देखना है? नाम या गाड़ी नंबर बताइए।`);
      ctx.activeParty = p;
      return R(`<b>${esc(p.name)}</b> का कुल उधार: <b class="neg">${money(p.bal)}</b>`, {
        chips: [{ label: '📒 खाता खोलें', onClick: () => { ui.close(); APP.partyView(p.id, false); } }]
      });
    }

    return R(`मुझे समझ नहीं आया। आप "9769", "P1 4500", "पप्पू का उधार", या "आज का paytm 500" जैसा कुछ पूछ सकते हैं।`);
  }

  // ======================================================================
  // 5. ENTRY LOGIC
  // ======================================================================
  async function handleUdharEntry(q, parties, ui) {
    let val = (await extractAmounts(q, parties))[0];
    let p = await findParty(q) || ctx.activeParty;

    if (!p) return R(`किस पार्टी का उधार दर्ज करना है? नाम या गाड़ी नंबर बताइए।`);
    ctx.activeParty = p;
    
    if (!val) return R(`<b>${esc(p.name)}</b> के लिए, कितने रुपये का उधार दर्ज करना है?`);

    ctx.pendingAction = { type: 'UDHAR', party: p, amount: val, vehicle: ctx.activeVehicle || '', date: T() };
    return R(`<b>उधार एंट्री</b><br>पार्टी: ${esc(p.name)}<br>${ctx.activeVehicle ? 'गाड़ी: '+ctx.activeVehicle+'<br>' : ''}रकम: <b>${money(val)}</b><br><br>क्या दर्ज करूँ?`, {
      say: speechify(`${p.name} का ${val} रुपये उधार दर्ज करना है। क्या यह सही है?`),
      chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द किया।')); } }]
    });
  }

  async function handleDailyEntry(q, parties, ui) {
    const val = (await extractAmounts(q, parties))[0];
    const today = T();

    // Meter (P1, D1 etc)
    const nzMatch = q.match(/\b(p[1-4]|d[1-4])\b/i);
    if (nzMatch && val) {
      const k = nzMatch[0].toLowerCase();
      const dSnap = await db().collection('days').doc(today).get();
      let openVal = dSnap.exists && dSnap.data().nz && dSnap.data().nz[k] ? num(dSnap.data().nz[k].o) : 0;
      if (val < openVal) return R(`⚠️ गलत! नोज़ल ${k.toUpperCase()} की ओपनिंग <b>${openVal}</b> है, क्लोजिंग कम नहीं हो सकती।`);
      
      ctx.pendingAction = { type: 'METER', key: k, value: val, date: today };
      return R(`नोज़ल <b>${k.toUpperCase()}</b> की क्लोजिंग <b>${val}</b> दर्ज करनी है?`, {
        chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }]
      });
    }

    // Paytm / Swipe
    if (/paytm|swipe/i.test(q) && val) {
      const type = /swipe/i.test(q) ? 'swipe' : 'paytm';
      ctx.pendingAction = { type: 'DAILY', field: type, value: val, date: today };
      return R(`${type.toUpperCase()} को <b>${money(val)}</b> सेट करना है?`, {
        chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }]
      });
    }

    // Kharcha
    if (/kharcha|dg|chai/i.test(q) && val) {
      let desc = /dg/i.test(q) ? 'DG (जनरेटर)' : /chai/i.test(q) ? 'चाय-खाना' : 'अन्य खर्चा';
      ctx.pendingAction = { type: 'DAILY', field: 'kharcha', value: val, desc: desc, date: today };
      return R(`खर्चा <b>${desc}</b> में <b>${money(val)}</b> दर्ज करना है?`, {
        chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }]
      });
    }

    return R('साफ बताइए (जैसे: "P1 5000" या "Paytm 2000").');
  }

  async function commitAction(ui) {
    const act = ctx.pendingAction; if (!act) return;
    ctx.pendingAction = null;
    try {
      if (act.type === 'METER') {
        await db().collection('days').doc(act.date).set({ [`nz.${act.key}.c`]: act.value }, { merge: true });
        ui.bot(R(`✅ नोज़ल ${act.key.toUpperCase()} की रीडिंग सेव हो गई।`));
      } 
      else if (act.type === 'DAILY') {
        if (act.field === 'kharcha') {
           const dRef = db().collection('days').doc(act.date);
           const dSnap = await dRef.get();
           let items = (dSnap.exists && dSnap.data().kharchaItems) ? dSnap.data().kharchaItems : [];
           items.push({ label: act.desc, amount: act.value });
           await dRef.set({ kharchaItems: items }, { merge: true });
           if(APP.recalc) APP.recalc();
        } else {
           await db().collection('days').doc(act.date).set({ [act.field]: act.value }, { merge: true });
        }
        ui.bot(R(`✅ एंट्री सेव हो गई।`));
      } 
      else if (act.type === 'UDHAR') {
        const b = db().batch();
        b.set(db().collection('ledger').doc(), {
          partyId: act.party.id, partyName: act.party.name, date: act.date, time: APP.nowTime ? APP.nowTime() : '12:00',
          kind: 'udhar', amount: act.amount, vehicle: act.vehicle, fuel: '', rate: 0, litre: 0, note: 'Assistant entry',
          by: S.user ? S.user.email : 'assistant', at: APP.FV.serverTimestamp()
        });
        b.update(db().collection('parties').doc(act.party.id), { bal: APP.FV.increment(act.amount) });
        await b.commit();
        S.parties.pub = null;
        ui.bot(R(`✅ <b>${esc(act.party.name)}</b> का ₹${act.amount} उधार दर्ज हो गया।`));
      }
    } catch (e) { ui.bot(R(`❌ सेव नहीं हुआ: ${esc(e.message)}`)); }
  }

  // ======================================================================
  // 6. UI (Chat Interface)
  // ======================================================================
  function injectFAB() {
    if (document.getElementById('ai-assist-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-assist-fab'; fab.innerHTML = '🎤';
    fab.style.cssText = 'position:fixed;bottom:80px;right:16px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff;font-size:26px;border:2px solid #f4b41a;box-shadow:0 4px 15px rgba(11,61,145,0.4);z-index:9999;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    fab.onclick = () => openAssistant();
    document.body.appendChild(fab);
  }
  window.addEventListener('load', () => setTimeout(injectFAB, 1500));

  function openAssistant() {
    if (document.getElementById('assist-modal')) return;
    const m = document.createElement('div'); m.id = 'assist-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.85);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    m.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:16px 16px 20px;max-height:88vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="margin:0;color:#0b3d91;font-size:17px;">🤖 माज़दा असिस्टेंट</h3>
          <div style="display:flex;gap:4px;">
            <button id="a-tts" style="background:none;border:none;font-size:19px;cursor:pointer;">🔊</button>
            <button id="a-close" style="background:none;border:none;font-size:20px;cursor:pointer;">❌</button>
          </div>
        </div>
        <div id="a-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:12px;padding:12px;margin-bottom:10px;min-height:150px;max-height:44vh;font-size:14px;display:flex;flex-direction:column;gap:8px;"></div>
        <div id="a-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:34px;"></div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="a-input" placeholder="यहाँ टाइप करें या 🎤 दबाकर बोलें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px;">
          <button id="a-mic" style="width:50px;height:50px;border-radius:50%;background:#f4b41a;border:none;font-size:22px;cursor:pointer;">🎤</button>
          <button id="a-send" style="width:50px;height:50px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:20px;cursor:pointer;">➤</button>
        </div>
      </div>
      <style>.a-chip{background:#fff;border:1px solid #0b3d91;border-radius:20px;padding:8px 14px;font-size:13px;color:#0b3d91;cursor:pointer;font-weight:600;}</style>`;
    document.body.appendChild(m);

    const $ = s => m.querySelector(s);
    const chat = $('#a-chat'), input = $('#a-input'), chipBox = $('#a-chips'), mic = $('#a-mic');
    let rec = null, busy = false;

    const bubble = (html, user) => {
      const d = document.createElement('div');
      d.style.cssText = `padding:10px 14px;border-radius:12px;max-width:88%;line-height:1.5;${user ? 'background:#0b3d91;color:#fff;align-self:flex-end;' : 'background:#fff;border:1px solid #e6ebf5;align-self:flex-start;color:#333;'}`;
      d.innerHTML = html; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
    };
    
    const ui = {
      close: () => { Voice.stop(); try { rec && rec.abort(); } catch(e){} m.remove(); },
      bot: r => {
        if (!r) return; bubble(r.html, false);
        chipBox.innerHTML = '';
        if (r.chips) r.chips.forEach(c => {
          const b = document.createElement('button'); b.className = 'a-chip'; b.textContent = c.label; b.onclick = () => c.onClick(ui); chipBox.appendChild(b);
        });
        Voice.say(r.say || r.html);
      }
    };

    $('#a-close').onclick = ui.close;
    $('#a-tts').onclick = () => { MEM.tts = !MEM.tts; saveMem(); $('#a-tts').textContent = MEM.tts ? '🔊' : '🔇'; if(!MEM.tts) Voice.stop(); };
    $('#a-tts').textContent = MEM.tts ? '🔊' : '🔇';

    async function processInput(text) {
      if (!text || !text.trim() || busy) return;
      busy = true; chipBox.innerHTML = ''; Voice.stop();
      bubble(esc(text), true); input.value = '';
      const load = bubble('<span style="color:#666;font-size:12px">⚡ सोच रही हूँ...</span>');
      try { 
        const r = await handleQuery(text, ui); 
        load.remove(); 
        if (r) ui.bot(r); 
      } catch (e) { 
        load.remove(); 
        ui.bot(R('❌ माफ़ कीजिए, गड़बड़ हो गई: ' + esc(e.message))); 
      } finally { busy = false; }
    }
    
    $('#a-send').onclick = () => processInput(input.value);
    input.onkeypress = e => { if (e.key === 'Enter') processInput(input.value); };

    function listen() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में आवाज़ सपोर्ट नहीं है');
      if (busy) return;
      try { rec && rec.abort(); } catch (e) {}
      rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = true;
      mic.style.background = '#c62828'; input.placeholder = 'सुन रही हूँ...';
      let finalText = '';
      rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t; } input.value = t; };
      rec.onerror = () => { mic.style.background = '#f4b41a'; input.placeholder = 'यहाँ टाइप करें...'; };
      rec.onend = () => { mic.style.background = '#f4b41a'; input.placeholder = 'यहाँ टाइप करें...'; if (finalText) processInput(finalText); };
      try { rec.start(); } catch(e) {}
    }
    mic.onclick = () => { Voice.stop(); listen(); };

    const hr = new Date().getHours(); const wish = hr < 12 ? 'सुप्रभात' : hr < 17 ? 'नमस्कार' : 'शुभ संध्या';
    ui.bot(R(`${wish}! मैं माज़दा असिस्टेंट हूँ। कुछ भी पूछिए, जैसे "5599 में 5000 का उधार", "P1 की रीडिंग 4500", या "आज का paytm 500".`));
  }

  console.log('[Mazda assistant.js v5.0] Ultimate Fix ✓');
})();
