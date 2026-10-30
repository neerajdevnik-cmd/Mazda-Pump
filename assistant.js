/* Mazda Oil Company - Ultimate God-Tier Assistant (assistant.js)
   Production-ready, Zero-dependency, Cognitive Engine for Mazda Oil Company PWA
*/
(function () {
  'use strict';

  const APP = window.APP;
  if (!APP) return;

  const S = APP.S || {};
  const esc = APP.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const num = APP.num || (v => Number(v) || 0);
  const money = APP.money || (v => '₹' + Math.round(num(v)).toLocaleString('en-IN'));
  const lit = APP.lit || (v => Math.round(num(v)).toLocaleString('en-IN') + ' L');
  const toast = APP.toast || (msg => console.log('[Toast]:', msg));
  const db = () => (APP.db ? (typeof APP.db === 'function' ? APP.db() : APP.db) : null);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const T = () => (APP.todayISO ? APP.todayISO() : iso(new Date()));
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

  // ======================================================================
  // 1. PERSISTENT SETTINGS & CONTEXT
  // ======================================================================
  const SK = 'mazda_assistant_master_v1';
  let MEM = { tts: true };
  try {
    const saved = JSON.parse(localStorage.getItem(SK) || 'null');
    if (saved) MEM = Object.assign(MEM, saved);
  } catch (e) {}
  const saveMem = () => { try { localStorage.setItem(SK, JSON.stringify(MEM)); } catch (e) {} };

  const ctx = {
    activeParty: null,
    activeVehicle: null,
    pendingAction: null
  };

  // ======================================================================
  // 2. TEXT NORMALIZATION & HINDI NUMBERS CONVERSION FOR TTS
  // ======================================================================
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const HI_WORDS = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सतासी अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे').split(' ');

  function hiNum(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n < 100) return HI_WORDS[n] || String(n);
    const parts = [];
    const cr = Math.floor(n / 1e7); n %= 1e7;
    const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3;
    const h = Math.floor(n / 100); n %= 100;

    if (cr) parts.push(hiNum(cr) + ' करोड़');
    if (lk) parts.push((HI_WORDS[lk] || hiNum(lk)) + ' लाख');
    if (th) parts.push((HI_WORDS[th] || hiNum(th)) + ' हज़ार');
    if (h) parts.push((HI_WORDS[h] || String(h)) + ' सौ');
    if (n) parts.push(HI_WORDS[n] || String(n));
    return parts.join(' ');
  }

  function speechify(html) {
    let t = String(html || '').replace(/<br\s*\/?>|<\/(div|p|li)>/gi, ' । ').replace(/<[^>]*>/g, ' ');
    t = t.replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, ' ');
    t = t.replace(/₹\s*(-?)\s*([\d,]+(?:\.\d+)?)/g, (m, neg, n) => (neg ? 'माइनस ' : '') + hiNum(n.replace(/,/g, '')) + ' रुपये');
    t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:L|ltr|Ltr|lit\.?|लीटर)\b/g, (m, n) => hiNum(n.replace(/,/g, '')) + ' लीटर');
    t = t.replace(/\d[\d,]*(?:\.\d+)?/g, n => hiNum(n.replace(/,/g, '')));
    t = t.replace(/[|•·*_#~>]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  // ======================================================================
  // 3. VOICE ENGINE (TTS - Chunking, Voice Picker & Auto Resume)
  // ======================================================================
  const Voice = (() => {
    let chosen = null;
    let queue = [];
    let busy = false;
    let resumeTimer = null;

    function loadVoices() {
      if (!window.speechSynthesis) return;
      const voices = speechSynthesis.getVoices() || [];
      const hiList = voices.filter(v => /^hi/i.test(v.lang) || /^en[-_]in/i.test(v.lang));
      chosen = hiList.find(v => /female|swara|lekha|google हिन्दी|kalpana/i.test(v.name)) || hiList[0] || voices[0] || null;
    }

    if (window.speechSynthesis) {
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    function clearTimer() {
      if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
    }

    function startTimer() {
      clearTimer();
      resumeTimer = setInterval(() => {
        if (!window.speechSynthesis) return;
        if (speechSynthesis.speaking) {
          speechSynthesis.pause();
          speechSynthesis.resume();
        } else {
          clearTimer();
        }
      }, 10000);
    }

    function next() {
      if (!queue.length) {
        busy = false;
        clearTimer();
        return;
      }
      busy = true;
      const textChunk = queue.shift();
      const u = new SpeechSynthesisUtterance(textChunk);
      u.lang = (chosen && chosen.lang) || 'hi-IN';
      if (chosen) u.voice = chosen;
      u.rate = 0.96;
      u.pitch = 1.0;

      u.onend = () => { next(); };
      u.onerror = () => { next(); };

      startTimer();
      speechSynthesis.speak(u);
    }

    return {
      say(textOrHtml) {
        if (!MEM.tts || !window.speechSynthesis) return;
        this.stop();
        loadVoices();
        const clean = speechify(textOrHtml);
        queue = (clean.match(/[^।.?!]+[।.?!]*/g) || [clean]).map(s => s.trim()).filter(Boolean);
        next();
      },
      stop() {
        queue = [];
        clearTimer();
        try {
          if (window.speechSynthesis) speechSynthesis.cancel();
        } catch (e) {}
        busy = false;
      }
    };
  })();

  // ======================================================================
  // 4. ADVANCED PARSER (4-Digit Number Bug Fix & Phonetic Party Matching)
  // ======================================================================
  function phoneticHash(str) {
    let s = String(str || '').toLowerCase();
    const hiMap = {
      'अ':'a','आ':'a','इ':'i','ई':'i','उ':'u','ऊ':'u','ए':'e','ऐ':'e','ओ':'o','औ':'o',
      'क':'k','ख':'k','ग':'g','घ':'g','च':'c','छ':'c','ज':'j','झ':'j',
      'ट':'t','ठ':'t','ड':'d','ढ':'d','ण':'n','त':'t','थ':'t','द':'d','ध':'d','न':'n',
      'प':'p','फ':'f','ब':'b','भ':'b','म':'m','य':'y','र':'r','ल':'l','व':'v',
      'श':'s','ष':'s','स':'s','ह':'h','क्ष':'k','त्र':'tr','ज्ञ':'gy',
      'ा':'','ि':'','ी':'','ु':'','ू':'','े':'','ै':'','ो':'','ौ':'','ं':'n','ँ':'n','्':'','़':''
    };
    s = s.split('').map(ch => (hiMap[ch] !== undefined ? hiMap[ch] : ch)).join('');
    return s
      .replace(/sh|ss/g, 's')
      .replace(/ph/g, 'f')
      .replace(/kh|q|c/g, 'k')
      .replace(/gh/g, 'g')
      .replace(/ch/g, 'c')
      .replace(/th|dh/g, 't')
      .replace(/bh/g, 'b')
      .replace(/w/g, 'v')
      .replace(/z/g, 'j')
      .replace(/[aeiouy]/g, '')
      .replace(/(.)\1+/g, '$1')
      .replace(/[^a-z0-9]/g, '');
  }

  async function getAppParties() {
    if (S.parties && S.parties.pub && S.parties.pub.length) return S.parties.pub;
    if (typeof APP.getParties === 'function') {
      try { return await APP.getParties(false, true); } catch (e) {}
    }
    return [];
  }

  function detectVehicleInQuery(q, parties) {
    if (!parties || !parties.length) return { vKey: null, party: null };
    const cleanQ = norm(q);

    // 1. Full Vehicle plate check (UK01CA0627, UK 01 0627, etc.)
    const fullPlate = cleanQ.match(/[a-z]{2}\s*\d{1,2}\s*[a-z]{1,3}\s*\d{4}/i);
    if (fullPlate) {
      const plateStr = fullPlate[0].toUpperCase().replace(/\s+/g, '');
      const p = parties.find(pt => (pt.vehicles || []).some(v => String(v).toUpperCase().replace(/\s+/g, '').includes(plateStr)));
      if (p) return { vKey: plateStr, party: p };
    }

    // 2. 4-Digit vehicle number match
    const fourDigits = cleanQ.match(/\b\d{4}\b/g) || [];
    for (const d of fourDigits) {
      // If preceded or followed by cash/payment keywords, check priority
      const isExplicitPay = new RegExp(`(paytm|swipe|kharcha|chai|dg)\\s*${d}|${d}\\s*(rupaye|rs|rupya|hazar|का|रुपये)`, 'i').test(cleanQ);
      if (isExplicitPay && fourDigits.length > 1) continue;

      const p = parties.find(pt => (pt.vehicles || []).some(v => String(v).replace(/\D/g, '').endsWith(d)));
      if (p) return { vKey: d, party: p };
    }

    return { vKey: null, party: null };
  }

  async function extractAmounts(text, parties, excludeVehicle) {
    let str = String(text || '').toLowerCase();
    str = str.replace(/[a-z]{2}\s*\d{1,2}\s*[a-z]{1,3}\s*\d{4}/gi, ' ');
    str = str.replace(/\b(p[1-4]|d[1-4])\b/gi, ' ');

    if (excludeVehicle) {
      str = str.replace(new RegExp(`\\b${excludeVehicle}\\b`, 'g'), ' ');
    }

    // Known vehicles from DB
    const knownVehicles = new Set();
    if (parties && parties.length) {
      parties.forEach(p => (p.vehicles || []).forEach(v => {
        const digits = String(v).replace(/\D/g, '').slice(-4);
        if (digits.length === 4) knownVehicles.add(digits);
      }));
    }

    const words = str.split(/\s+/);
    const amounts = [];

    for (let i = 0; i < words.length; i++) {
      let w = words[i].replace(/[,₹]/g, '');
      if (/^\d{4}$/.test(w) && knownVehicles.has(w)) {
        // If it's directly attached to payment keywords, allow as amount
        const hasPayContext = /paytm|swipe|udhar|chai|dg|kharcha|rupaye|rs|हजार|लाख|का/i.test(text);
        if (!hasPayContext) continue;
      }

      let m = w.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/i);
      if (m) {
        let val = parseFloat(m[1]);
        const suffix = (m[2] || '').toLowerCase();
        if (suffix === 'k') val *= 1000;
        if (suffix === 'l' || suffix === 'lakh' || suffix === 'lac') val *= 100000;
        if (words[i + 1] && /^(hazar|hajar|हज़ार|हजार)$/i.test(words[i + 1])) val *= 1000;
        if (words[i + 1] && /^(lakh|lac|लाख)$/i.test(words[i + 1])) val *= 100000;
        amounts.push(val);
      }
    }
    return amounts;
  }

  const STOP_WORDS = new Set([
    'kholo','ledger','khata','hisab','udhar','batao','dikhao','rupaye','diesel','petrol',
    'mein','entry','karo','likho','likhna','dalna','jama','baaki','kitna','aaj','kal',
    'ka','ki','ke','ko','in','me','ha','haan','yes','no','nahi',
    'का','की','के','को','में','उधार','खाता','हिसाब','बताओ','दिखाओ','रुपये','जमा','बाकी','कितना','पार्टी','गाड़ी'
  ]);

  async function findParty(q, parties) {
    if (!parties) parties = await getAppParties();
    if (!parties || !parties.length) return null;

    // 1. Vehicle match first
    const vCheck = detectVehicleInQuery(q, parties);
    if (vCheck.party) {
      ctx.activeVehicle = vCheck.vKey;
      return vCheck.party;
    }

    // 2. Name & Phonetic Matching
    const cleanQ = norm(q);
    const words = cleanQ.split(' ').filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
    if (!words.length) return null;

    const qPhonetics = words.map(w => phoneticHash(w)).filter(w => w.length >= 2);
    let bestParty = null;
    let highestScore = 0;

    parties.forEach(p => {
      const pNorm = norm(p.name);
      const pWords = pNorm.split(' ');
      const pPhonetics = pWords.map(w => phoneticHash(w));
      let score = 0;

      words.forEach(w => {
        if (pWords.includes(w)) score += 35;
        else if (pNorm.includes(w)) score += 18;
      });

      qPhonetics.forEach(qw => {
        if (pPhonetics.includes(qw)) score += 30;
        else if (pPhonetics.some(pw => pw.includes(qw) || qw.includes(pw))) score += 15;
      });

      if (score > highestScore && score >= 25) {
        highestScore = score;
        bestParty = p;
      }
    });

    return bestParty;
  }

  // ======================================================================
  // 5. INTENT RESOLUTION & RESPONSE GENERATOR
  // ======================================================================
  function R(html, o) {
    return Object.assign({ html }, o || {});
  }

  async function handleQuery(rawText, ui) {
    const raw = String(rawText || '').trim();
    const q = norm(raw);
    const parties = await getAppParties();

    // ------------------------------------------------------------------
    // STEP 0: Pending Action (Confirmation Flow: Haan / Radd)
    // ------------------------------------------------------------------
    if (ctx.pendingAction) {
      if (/^(haan|yes|ha|ok|theek|sahi|kar do|save|confirm|हाँ|हां|जी|सही|कर दो)$/i.test(q)) {
        return await commitAction(ui);
      }
      if (/^(nahi|no|cancel|radd|mat|stop|नहीं|ना|रद्द|मत)$/i.test(q)) {
        ctx.pendingAction = null;
        return R('ठीक है, एंट्री रद्द कर दी गई।');
      }
      // If user typed a completely new command, reset pending action
      ctx.pendingAction = null;
    }

    // ------------------------------------------------------------------
    // STEP 1: Strict Identity, Owner & Safety Rules
    // ------------------------------------------------------------------
    if (/remove|delete|hatao|mita|डिलीट|हटाओ|मिटाओ/i.test(q)) {
      return R('माफ़ कीजिए, मैं कोई भी एंट्री delete नहीं कर सकती। यह अधिकार सिर्फ owner के पास है।');
    }

    if (/(pump|mazda).*(owner|malik|kiska|shashank|मालिक|किसका)/i.test(q)) {
      return R('इस पंप के मालिक <b>शशांक बंसल (Shashank Bansal)</b> हैं।');
    }

    if (/(tumhara|aapka).*(owner|malik)|kisne banaya|who made you|किसने बनाया/i.test(q)) {
      return R('मैं एक AI हूँ, मेरा कोई owner नहीं है। मुझे <b>नीरज देव (Neeraj Dev)</b> ने बनाया है।');
    }

    if (/(mera naam|main kaun|who am i|मेरा नाम|मैं कौन)/i.test(q)) {
      const uName = S.user ? S.user.email.split('@')[0] : (S.salesman ? S.salesman.name : 'User');
      const role = S.role === 'owner' ? 'मालिक' : (S.role === 'manager' ? 'मैनेजर' : 'यूज़र');
      return R(`आपका नाम <b>${esc(uName)}</b> है और आप इस ऐप में <b>${role}</b> के रूप में लॉगिन हैं।`);
    }

    if (/(tum|aap).*(kaun|kya|kahan)|who are you|तुम कौन/i.test(q)) {
      return R('मैं <b>माज़दा असिस्टेंट</b> हूँ, आपका डिजिटल पेट्रोल पंप मैनेजर। मैं मीटर रीडिंग, उधार, सेल और खर्चों का हिसाब रखती हूँ।');
    }

    // ------------------------------------------------------------------
    // STEP 2: Context Memory (Inka / Unka / Khata Kholo)
    // ------------------------------------------------------------------
    if (/\b(inka|uska|iski|uski|unko|unka|इनका|उसका|उनका)\b/i.test(q) || /khata kholo|ledger kholo|खाता खोलो/i.test(q)) {
      if (ctx.activeParty) {
        if (/khata|ledger|खाता/i.test(q)) {
          setTimeout(() => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(ctx.activeParty.id, false); }, 800);
          return R(`⏳ <b>${esc(ctx.activeParty.name)}</b> का खाता खोला जा रहा है...`);
        }
        return R(`<b>${esc(ctx.activeParty.name)}</b> का वर्तमान बकाया: <b class="neg">${money(ctx.activeParty.bal)}</b>`, {
          chips: [
            { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(ctx.activeParty.id, false); } }
          ]
        });
      }
      return R('किस पार्टी की बात कर रहे हैं? कृपया पहले नाम या गाड़ी नंबर बताइए।');
    }

    // ------------------------------------------------------------------
    // STEP 3: Standalone Vehicle Number Query (e.g. "9769" or "UK01CA0627")
    // ------------------------------------------------------------------
    if (/^\d{4}$/.test(q) || /^[a-z]{2}\s*\d{1,2}\s*[a-z]{1,3}\s*\d{4}$/i.test(q)) {
      const vCheck = detectVehicleInQuery(q, parties);
      if (vCheck.party) {
        ctx.activeParty = vCheck.party;
        ctx.activeVehicle = vCheck.vKey;
        return R(`🚗 गाड़ी <b>${esc(vCheck.vKey)}</b> पार्टी <b>${esc(vCheck.party.name)}</b> की है।<br>वर्तमान बकाया: <b>${money(vCheck.party.bal)}</b>.<br>आप क्या एंट्री करना चाहते हैं?`, {
          chips: [
            { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(vCheck.party.id, false); } },
            { label: '➕ ₹2000 उधार जोड़ें', onClick: () => handleQuery(`${vCheck.vKey} में 2000 का उधार`, ui).then(r => ui.bot(r)) }
          ]
        });
      }
      return R(`गाड़ी नंबर <b>${esc(q.toUpperCase())}</b> किसी भी खाते में नहीं मिली।`);
    }

    // ------------------------------------------------------------------
    // STEP 4: Dip Chart Query (e.g. "100 dip me kitna diesel?")
    // ------------------------------------------------------------------
    if (/dip|डिप/i.test(q)) {
      const dipMatch = q.match(/\b\d+(\.\d+)?\b/);
      if (dipMatch && window.DipChart && typeof window.DipChart.getLiters === 'function') {
        const val = parseFloat(dipMatch[0]);
        let out = `📏 <b>${val} सेमी डिप पर स्टॉक:</b><br>`;
        if (/diesel|hsd|डीजल|डीज़ल/i.test(q) || !/petrol|पेट्रोल/i.test(q)) {
          out += `🛢️ डीज़ल: <b>${lit(window.DipChart.getLiters('diesel', val))}</b><br>`;
        }
        if (/petrol|ms|पेट्रोल/i.test(q) || !/diesel|डीजल|डीज़ल/i.test(q)) {
          out += `⛽ पेट्रोल: <b>${lit(window.DipChart.getLiters('petrol', val))}</b>`;
        }
        return R(out);
      }
    }

    // ------------------------------------------------------------------
    // STEP 5: Sales Report (Today, Yesterday)
    // ------------------------------------------------------------------
    if (/sale|bikri|bika|dhandha|galla|सेल|बिक्री|गल्ला/i.test(q)) {
      const isKal = /\b(kal|yesterday|कल)\b/i.test(q);
      const dStr = isKal ? addDays(T(), -1) : T();
      let saleText = `${isKal ? 'कल' : 'आज'} का हिसाब अभी दर्ज नहीं हुआ है।`;

      if (db()) {
        try {
          const dSnap = await db().collection('days').doc(dStr).get();
          if (dSnap.exists) {
            const sum = dSnap.data().sum || {};
            return R(`<b>${isKal ? 'कल' : 'आज'} की कुल सेल: ${money(sum.sale)}</b><br>⛽ पेट्रोल: ${lit(sum.litP)} | 🛢️ डीज़ल: ${lit(sum.litD)}`, {
              chips: [
                { label: isKal ? '📊 आज की सेल' : '📊 कल की सेल', onClick: () => handleQuery(isKal ? 'आज की सेल' : 'कल की सेल', ui).then(r => ui.bot(r)) },
                { label: '📒 कुल उधार', onClick: () => handleQuery('कुल उधार', ui).then(r => ui.bot(r)) }
              ]
            });
          }
        } catch (e) {}
      }
      return R(saleText);
    }

    // ------------------------------------------------------------------
    // STEP 6: Smart Pivot (Weather, Cricket, External Queries)
    // ------------------------------------------------------------------
    if (/baarish|mausam|weather|rain|thand|garmi|dhoop|बारिश|मौसम|धूप|ठंड|गर्मी/i.test(q)) {
      let saleMoney = '₹0';
      if (db()) {
        try {
          const dSnap = await db().collection('days').doc(T()).get();
          if (dSnap.exists) saleMoney = money((dSnap.data().sum || {}).sale);
        } catch (e) {}
      }
      return R(`मौसम का तो पता नहीं, पर आज की सेल <b>${saleMoney}</b> हो चुकी है!`);
    }

    if (/match|cricket|ipl|score|मैच|क्रिकेट/i.test(q)) {
      let saleMoney = '₹0';
      if (db()) {
        try {
          const dSnap = await db().collection('days').doc(T()).get();
          if (dSnap.exists) saleMoney = money((dSnap.data().sum || {}).sale);
        } catch (e) {}
      }
      return R(`मैच का तो पता नहीं, पर आज अपने पंप पर <b>${saleMoney}</b> की सेल हो चुकी है!`);
    }

    // ------------------------------------------------------------------
    // STEP 7: Total Market Udhar Summary
    // ------------------------------------------------------------------
    if (/(kul|total|market|कुल|मार्केट).*(udhar|baaki|उधार|बाकी)/i.test(q) || /^(udhar|kul udhar|कुल उधार)$/i.test(q)) {
      if (!parties || !parties.length) return R('पार्टी खातों का डेटा लोड नहीं हो पाया।');
      const defaulters = parties.filter(p => num(p.bal) > 0).sort((a, b) => num(b.bal) - num(a.bal));
      const totalUdhar = defaulters.reduce((acc, p) => acc + num(p.bal), 0);
      const top3 = defaulters.slice(0, 3).map((p, idx) => `${idx + 1}. <b>${esc(p.name)}</b>: ${money(p.bal)}`).join('<br>');
      return R(`📊 <b>मार्केट में कुल बकाया: ${money(totalUdhar)}</b> (${defaulters.length} खाते)<br><br><b>टॉप बकायादार:</b><br>${top3 || 'कोई बकाया नहीं'}`);
    }

    // ------------------------------------------------------------------
    // STEP 8: Meter Entry (P1, P2, D1, D2)
    // ------------------------------------------------------------------
    const nzMatch = q.match(/\b(p[1-4]|d[1-4])\b/i);
    if (nzMatch) {
      const amounts = await extractAmounts(q, parties, null);
      const val = amounts[0];
      if (val) {
        return await handleMeterEntry(nzMatch[0].toLowerCase(), val);
      }
    }

    // ------------------------------------------------------------------
    // STEP 9: Daily Ledger: Paytm / Swipe / Kharcha / Chai / DG
    // ------------------------------------------------------------------
    if (/\b(paytm|swipe|kharcha|chai|dg|पेटीएम|स्वाइप|खर्चा|चाय)\b/i.test(q)) {
      return await handleDailyFieldEntry(q, parties);
    }

    // ------------------------------------------------------------------
    // STEP 10: Udhar / Credit Entry
    // ------------------------------------------------------------------
    if (/udhar|likho|likhna|chadao|dalna|उधार|लिखो/i.test(q)) {
      return await handleUdharEntry(q, parties);
    }

    // ------------------------------------------------------------------
    // STEP 11: Party Balance Check (Name / Fallback Match)
    // ------------------------------------------------------------------
    const partyFound = await findParty(q, parties) || ctx.activeParty;
    if (partyFound) {
      ctx.activeParty = partyFound;
      const amounts = await extractAmounts(q, parties, ctx.activeVehicle);
      if (amounts.length > 0 && /में|mein|ka|का/i.test(q)) {
        return await handleUdharEntry(q, parties);
      }
      return R(`👤 <b>${esc(partyFound.name)}</b><br>वर्तमान बकाया: <b class="neg">${money(partyFound.bal)}</b><br>गाड़ियां: <small>${esc((partyFound.vehicles || []).join(', ') || 'कोई नहीं')}</small>`, {
        chips: [
          { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(partyFound.id, false); } },
          { label: '➕ उधार दर्ज करें', onClick: () => handleQuery(`${partyFound.name} में उधार`, ui).then(r => ui.bot(r)) }
        ]
      });
    }

    return R('मुझे समझ नहीं आया। आप ऐसे निर्देश दे सकते हैं:<br>• <b>"9769"</b> (गाड़ी सर्च)<br>• <b>"5000 udhar"</b> (सक्रिय खाते में उधार)<br>• <b>"P1 4500"</b> (मीटर रीडिंग)<br>• <b>"Paytm 500"</b> या <b>"Chai 70"</b> (दैनिक एंट्री)<br>• <b>"100 dip me kitna diesel"</b>');
  }

  // ======================================================================
  // 6. ACTION PREPARATION HANDLERS (Confirmation Prompts)
  // ======================================================================
  async function handleMeterEntry(nozzleKey, closingVal) {
    const today = T();
    let openVal = 0;

    if (db()) {
      try {
        const dSnap = await db().collection('days').doc(today).get();
        if (dSnap.exists && dSnap.data().nz && dSnap.data().nz[nozzleKey]) {
          openVal = num(dSnap.data().nz[nozzleKey].o);
        }
      } catch (e) {}
    }

    if (closingVal < openVal) {
      return R(`⚠️ Galti! Opening <b>${openVal}</b> hai, closing kam nahi ho sakti.`);
    }

    const saleLiters = openVal > 0 ? ` (बिक्री: <b>${closingVal - openVal} L</b>)` : '';
    ctx.pendingAction = {
      type: 'METER',
      key: nozzleKey,
      value: closingVal,
      date: today
    };

    return R(`नोज़ल <b>${nozzleKey.toUpperCase()}</b> की क्लोजिंग <b>${closingVal}</b>${saleLiters} दर्ज करनी है?<br>क्या यह सही है?`, {
      chips: [
        { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
        { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('रद्द कर दिया गया।')); } }
      ]
    });
  }

  async function handleDailyFieldEntry(q, parties) {
    const amounts = await extractAmounts(q, parties, null);
    const val = amounts[0];
    const today = T();

    if (!val) {
      return R('कृपया रक़म भी साथ में बताइए (जैसे: "Paytm 500" या "Chai 70").');
    }

    if (/paytm|पेटीएम/i.test(q)) {
      ctx.pendingAction = { type: 'DAILY_FIELD', field: 'paytm', value: val, date: today };
      return R(`आज का <b>Paytm</b> कलेक्शन <b>${money(val)}</b> सेट करना है?`, {
        chips: [
          { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
          { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }
        ]
      });
    }

    if (/swipe|स्वाइप/i.test(q)) {
      ctx.pendingAction = { type: 'DAILY_FIELD', field: 'swipe', value: val, date: today };
      return R(`आज का <b>Swipe</b> कार्ड कलेक्शन <b>${money(val)}</b> सेट करना है?`, {
        chips: [
          { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
          { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }
        ]
      });
    }

    // Kharcha (Chai, DG, General)
    let desc = 'अन्य खर्चा';
    if (/chai|चाय/i.test(q)) desc = 'चाय-नाश्ता';
    else if (/dg|generator|जनरेटर/i.test(q)) desc = 'DG जनरेटर';

    ctx.pendingAction = { type: 'KHARCHA', desc: desc, value: val, date: today };
    return R(`खर्चा <b>${desc}</b> में <b>${money(val)}</b> दर्ज करना है?`, {
      chips: [
        { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
        { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }
      ]
    });
  }

  async function handleUdharEntry(q, parties) {
    const vCheck = detectVehicleInQuery(q, parties);
    let p = vCheck.party || ctx.activeParty;
    if (vCheck.vKey) ctx.activeVehicle = vCheck.vKey;

    if (!p) {
      p = await findParty(q, parties);
    }

    if (!p) {
      return R('किस पार्टी का उधार दर्ज करना है? कृपया नाम या गाड़ी नंबर बताइए।');
    }

    ctx.activeParty = p;
    const amounts = await extractAmounts(q, parties, vCheck.vKey || ctx.activeVehicle);
    const val = amounts[0];

    if (!val) {
      return R(`<b>${esc(p.name)}</b> के खाते में कितने रुपये का उधार दर्ज करना है?`);
    }

    ctx.pendingAction = {
      type: 'UDHAR',
      party: p,
      amount: val,
      vehicle: vCheck.vKey || ctx.activeVehicle || '',
      date: T()
    };

    const vText = ctx.pendingAction.vehicle ? `गाड़ी: <b>${esc(ctx.pendingAction.vehicle)}</b><br>` : '';
    return R(`<b>उधार एंट्री</b><br>पार्टी: <b>${esc(p.name)}</b><br>${vText}रकम: <b>${money(val)}</b><br><br>क्या दर्ज करूँ?`, {
      chips: [
        { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
        { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('रद्द कर दिया गया।')); } }
      ]
    });
  }

  // ======================================================================
  // 7. COMMIT ACTIONS (Database Writers with Validation)
  // ======================================================================
  async function commitAction(ui) {
    const act = ctx.pendingAction;
    if (!act) return;
    ctx.pendingAction = null;

    if (!db()) {
      ui.bot(R('❌ डेटाबेस कनेक्शन उपलब्ध नहीं है।'));
      return;
    }

    try {
      if (act.type === 'METER') {
        await db().collection('days').doc(act.date).set({
          [`nz.${act.key}.c`]: act.value
        }, { merge: true });

        if (typeof APP.recalc === 'function') APP.recalc();
        ui.bot(R(`✅ नोज़ल <b>${act.key.toUpperCase()}</b> की क्लोजिंग <b>${act.value}</b> सेव हो गई।`));
      }
      else if (act.type === 'DAILY_FIELD') {
        await db().collection('days').doc(act.date).set({
          [act.field]: act.value
        }, { merge: true });

        if (typeof APP.recalc === 'function') APP.recalc();
        ui.bot(R(`✅ <b>${act.field.toUpperCase()}</b> में <b>${money(act.value)}</b> सफलतापूर्वक सेव हो गया।`));
      }
      else if (act.type === 'KHARCHA') {
        const dRef = db().collection('days').doc(act.date);
        const dSnap = await dRef.get();
        let items = (dSnap.exists && dSnap.data().kharchaItems) ? dSnap.data().kharchaItems : [];
        items.push({ label: act.desc, amount: act.value });

        await dRef.set({ kharchaItems: items }, { merge: true });
        if (typeof APP.recalc === 'function') APP.recalc();
        ui.bot(R(`✅ खर्चा <b>${esc(act.desc)}</b> में <b>${money(act.value)}</b> दर्ज हो गया।`));
      }
      else if (act.type === 'UDHAR') {
        const batch = db().batch();
        const ledgerRef = db().collection('ledger').doc();
        const serverTS = (APP.FV && APP.FV.serverTimestamp) ? APP.FV.serverTimestamp() : new Date();
        const incrementFn = (APP.FV && APP.FV.increment) ? APP.FV.increment(act.amount) : act.amount;

        batch.set(ledgerRef, {
          partyId: act.party.id,
          partyName: act.party.name,
          date: act.date,
          time: (typeof APP.nowTime === 'function') ? APP.nowTime() : '12:00',
          kind: 'udhar',
          amount: Math.abs(act.amount),
          vehicle: act.vehicle || '',
          fuel: '',
          rate: 0,
          litre: 0,
          note: 'Assistant entry',
          by: S.user ? S.user.email : 'assistant',
          at: serverTS
        });

        batch.update(db().collection('parties').doc(act.party.id), {
          bal: incrementFn
        });

        await batch.commit();
        if (S.parties) S.parties.pub = null; // Clear cached parties

        ui.bot(R(`✅ <b>${esc(act.party.name)}</b> का <b>${money(act.amount)}</b> उधार दर्ज हो गया।`, {
          chips: [
            { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(act.party.id, false); } }
          ]
        }));
      }
    } catch (err) {
      ui.bot(R(`❌ डेटा सेव नहीं हुआ: ${esc(err.message)}`));
    }
  }

  // ======================================================================
  // 8. CHAT INTERFACE & FAB INJECTION
  // ======================================================================
  function injectFAB() {
    if (document.getElementById('ai-assist-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-assist-fab';
    fab.innerHTML = '🎤';
    fab.title = 'माज़दा AI असिस्टेंट';
    fab.style.cssText = 'position:fixed;bottom:80px;right:18px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff;font-size:26px;border:2.5px solid #f4b41a;box-shadow:0 6px 18px rgba(11,61,145,0.45);z-index:9999;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
    fab.onmouseenter = () => { fab.style.transform = 'scale(1.08)'; };
    fab.onmouseleave = () => { fab.style.transform = 'scale(1)'; };
    fab.onclick = () => openAssistant();
    document.body.appendChild(fab);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(injectFAB, 1000);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(injectFAB, 1000));
  }

  function openAssistant() {
    if (document.getElementById('assist-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'assist-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.85);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:16px 16px 20px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -6px 25px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:22px;">🤖</span>
            <h3 style="margin:0;color:#0b3d91;font-size:17px;font-weight:700;">माज़दा असिस्टेंट</h3>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="a-tts" title="आवाज़ चालू/बंद" style="background:#f4f6fa;border:1px solid #d0d7e5;border-radius:50%;width:36px;height:36px;font-size:17px;cursor:pointer;">🔊</button>
            <button id="a-close" title="बंद करें" style="background:#f4f6fa;border:1px solid #d0d7e5;border-radius:50%;width:36px;height:36px;font-size:17px;cursor:pointer;">❌</button>
          </div>
        </div>
        <div id="a-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:14px;padding:12px;margin-bottom:10px;min-height:160px;max-height:46vh;font-size:14px;display:flex;flex-direction:column;gap:10px;"></div>
        <div id="a-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:34px;"></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="a-input" placeholder="यहाँ टाइप करें या 🎤 दबाकर बोलें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;">
          <button id="a-mic" title="बोलकर निर्देश दें" style="width:48px;height:48px;border-radius:50%;background:#f4b41a;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(244,180,26,0.4);">🎤</button>
          <button id="a-send" title="भेजें" style="width:48px;height:48px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(11,61,145,0.4);">➤</button>
        </div>
      </div>
      <style>
        .a-chip { background:#fff; border:1px solid #0b3d91; border-radius:20px; padding:7px 14px; font-size:12.5px; color:#0b3d91; cursor:pointer; font-weight:600; transition:all 0.15s; white-space:nowrap; }
        .a-chip:active { background:#0b3d91; color:#fff; }
        .neg { color: #d32f2f; }
      </style>
    `;
    document.body.appendChild(modal);

    const $ = s => modal.querySelector(s);
    const chat = $('#a-chat');
    const input = $('#a-input');
    const chipBox = $('#a-chips');
    const mic = $('#a-mic');
    const send = $('#a-send');
    const ttsBtn = $('#a-tts');
    const closeBtn = $('#a-close');

    let rec = null;
    let isProcessing = false;

    const addBubble = (html, isUser) => {
      const d = document.createElement('div');
      d.style.cssText = `padding:10px 14px;border-radius:14px;max-width:88%;line-height:1.5;word-break:break-word;${isUser ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:2px;' : 'background:#fff;border:1px solid #e1e7f2;align-self:flex-start;color:#222;border-bottom-left-radius:2px;box-shadow:0 2px 5px rgba(0,0,0,0.03);'}`;
      d.innerHTML = html;
      chat.appendChild(d);
      chat.scrollTop = chat.scrollHeight;
      return d;
    };

    const defaultChips = [
      { label: '📊 आज की सेल', onClick: () => executeInput('आज की सेल') },
      { label: '📒 कुल उधार', onClick: () => executeInput('कुल उधार') },
      { label: '📈 कल की सेल', onClick: () => executeInput('कल की सेल') }
    ];

    const ui = {
      close: () => {
        Voice.stop();
        try { if (rec) rec.abort(); } catch (e) {}
        modal.remove();
      },
      bot: r => {
        if (!r) return;
        addBubble(r.html, false);
        chipBox.innerHTML = '';
        const chips = (r.chips && r.chips.length) ? r.chips : defaultChips;
        chips.forEach(c => {
          const btn = document.createElement('button');
          btn.className = 'a-chip';
          btn.textContent = c.label;
          btn.onclick = () => c.onClick(ui);
          chipBox.appendChild(btn);
        });
        Voice.say(r.say || r.html);
      }
    };

    closeBtn.onclick = ui.close;
    ttsBtn.onclick = () => {
      MEM.tts = !MEM.tts;
      saveMem();
      ttsBtn.textContent = MEM.tts ? '🔊' : '🔇';
      if (!MEM.tts) Voice.stop();
    };
    ttsBtn.textContent = MEM.tts ? '🔊' : '🔇';

    async function executeInput(text) {
      if (!text || !text.trim() || isProcessing) return;
      isProcessing = true;
      chipBox.innerHTML = '';
      Voice.stop();
      addBubble(esc(text), true);
      input.value = '';

      const loader = addBubble('<span style="color:#666;font-size:12px;">⚡ सोच रही हूँ...</span>', false);
      try {
        const response = await handleQuery(text, ui);
        loader.remove();
        if (response) ui.bot(response);
      } catch (err) {
        loader.remove();
        ui.bot(R(`❌ गड़बड़ हो गई: ${esc(err.message)}`));
      } finally {
        isProcessing = false;
      }
    }

    send.onclick = () => executeInput(input.value);
    input.onkeypress = e => { if (e.key === 'Enter') executeInput(input.value); };

    function startListening() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return toast('इस ब्राउज़र में वॉइस स्पीच सपोर्ट नहीं है');
      if (isProcessing) return;

      try { if (rec) rec.abort(); } catch (e) {}
      rec = new SpeechRecognition();
      rec.lang = 'hi-IN';
      rec.interimResults = true;

      mic.style.background = '#c62828';
      input.placeholder = 'सुन रही हूँ... बोलिए';
      let finalTranscript = '';

      rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalTranscript = e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }
        input.value = finalTranscript || interim;
      };

      rec.onerror = () => {
        mic.style.background = '#f4b41a';
        input.placeholder = 'यहाँ टाइप करें...';
      };

      rec.onend = () => {
        mic.style.background = '#f4b41a';
        input.placeholder = 'यहाँ टाइप करें...';
        if (finalTranscript) executeInput(finalTranscript);
      };

      try { rec.start(); } catch (e) {}
    }

    mic.onclick = () => { Voice.stop(); startListening(); };

    const hours = new Date().getHours();
    const greet = hours < 12 ? 'सुप्रभात' : hours < 17 ? 'नमस्कार' : 'शुभ संध्या';
    ui.bot(R(`${greet}! मैं <b>माज़दा असिस्टेंट</b> हूँ।<br>आप निर्देश दे सकते हैं—जैसे <b>"9769"</b>, <b>"5000 udhar"</b>, <b>"P1 4500"</b>, या <b>"Paytm 500"</b>.`));
  }

  console.log('[Mazda assistant.js] God-Tier Engine Initialized ✓');
})();
