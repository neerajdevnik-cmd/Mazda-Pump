/* Mazda Oil Company - Ultimate Cognitive AI Assistant (v7.0 - Zero-Bug Fluent Edition)
   Fixes:
   1. Fluent Human-like TTS (No comma/danda/dot/pipe reading, zero stuttering)
   2. Eradicated false Party matches ('Chandan Dev' / 'Local Gaadi Cash' on random queries)
   3. Fixed APP.recalc() DOM crash (#nzwarn null error when on Khate tab)
   4. Added Real Date Parser ('10 tarik ki sale', '10 din purana hisab', 'parso ki sale')
   5. Added Party Visit History ('Inki gaadi kitne din baad aayi', 'aakhiri baar kab aaye')
   6. Added Nozzle Trend Analysis, Pump Info, Mood/Banter & Rotating Conversational Loops
*/
(function () {
  'use strict';

  const APP = window.APP;
  if (!APP) return;

  const S = APP.S || {};
  const esc = APP.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const num = APP.num || (v => Number(v) || 0);
  const money = APP.money || (v => '₹' + Math.round(num(v)).toLocaleString('en-IN'));
  const lit = APP.lit || (v => Number(num(v).toFixed(2)).toLocaleString('en-IN') + ' L');
  const toast = APP.toast || (msg => console.log('[Toast]:', msg));
  const db = () => (APP.db ? (typeof APP.db === 'function' ? APP.db() : APP.db) : null);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const T = () => (APP.todayISO ? APP.todayISO() : iso(new Date()));
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

  // Safe Recalc wrapper so #nzwarn null error NEVER happens when user is on another tab
  function safeRecalc() {
    try {
      if (typeof APP.recalc === 'function' && document.getElementById('nzwarn')) {
        APP.recalc();
      }
    } catch (e) {}
  }

  // ======================================================================
  // 1. PERSISTENT MEMORY & CONVERSATIONAL STATE
  // ======================================================================
  const SK = 'mazda_assistant_v7';
  let MEM = { tts: true, fallbackIdx: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(SK) || 'null');
    if (saved) MEM = Object.assign(MEM, saved);
  } catch (e) {}
  const saveMem = () => { try { localStorage.setItem(SK, JSON.stringify(MEM)); } catch (e) {} };

  const ctx = {
    activeParty: null,
    activeVehicle: null,
    pendingAction: null,
    lastTopic: null
  };

  // ======================================================================
  // 2. FLUENT VOICE ENGINE (Zero Punctuation Reading, Smooth Delivery)
  // ======================================================================
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const HI_WORDS = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सतासी अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे').split(' ');

  function hiNum(n) {
    let val = Math.round(Math.abs(Number(n) || 0));
    if (val === 0) return 'शून्य';
    if (val < 100) return HI_WORDS[val] || String(val);
    const parts = [];
    const cr = Math.floor(val / 1e7); val %= 1e7;
    const lk = Math.floor(val / 1e5); val %= 1e5;
    const th = Math.floor(val / 1e3); val %= 1e3;
    const h = Math.floor(val / 100); val %= 100;

    if (cr) parts.push(hiNum(cr) + ' करोड़');
    if (lk) parts.push((HI_WORDS[lk] || hiNum(lk)) + ' लाख');
    if (th) parts.push((HI_WORDS[th] || hiNum(th)) + ' हज़ार');
    if (h) parts.push((HI_WORDS[h] || String(h)) + ' सौ');
    if (val) parts.push(HI_WORDS[val] || String(val));
    return parts.join(' ');
  }

  // Converts any HTML or text into 100% pure spoken Hindi words without ANY symbols
  function toPureSpeech(input) {
    let t = String(input || '');
    // Replace line breaks with natural pause word
    t = t.replace(/<br\s*\/?>|<\/(div|p|li|h\d)>/gi, ' , ');
    t = t.replace(/<[^>]*>/g, ' ');

    // Convert negative/minus money & normal money: ₹-1,770 or -₹1,770 or ₹1,234
    t = t.replace(/(-?)\s*₹\s*(-?)\s*([\d,]+(?:\.\d+)?)/g, (m, neg1, neg2, numStr) => {
      const isNeg = (neg1 === '-' || neg2 === '-');
      const cleanN = parseFloat(numStr.replace(/,/g, ''));
      return (isNeg ? 'माइनस ' : '') + hiNum(cleanN) + ' रुपये ';
    });

    // Convert Liters: 12,161.05 L -> बारह हज़ार एक सौ इकसठ लीटर
    t = t.replace(/([\d,]+(?:\.\d+)?)\s*(?:L|ltr|Ltr|lit\.?|लीटर)\b/g, (m, numStr) => {
      const cleanN = parseFloat(numStr.replace(/,/g, ''));
      return hiNum(cleanN) + ' लीटर ';
    });

    // Convert standalone numbers (ignore vehicle codes if attached to letters)
    t = t.replace(/\b(\d[\d,]*(?:\.\d+)?)\b/g, (m, numStr) => {
      const cleanN = parseFloat(numStr.replace(/,/g, ''));
      return hiNum(cleanN);
    });

    // Common English terms to Hindi pronunciation so voice never stutters
    t = t.replace(/\bpaytm\b/gi, 'पेटीएम')
         .replace(/\bswipe\b/gi, 'स्वाइप')
         .replace(/\bdiesel\b/gi, 'डीज़ल')
         .replace(/\bpetrol\b/gi, 'पेट्रोल')
         .replace(/\bowner\b/gi, 'ओनर')
         .replace(/\bai\b/gi, 'ए आई')
         .replace(/\bp([1-4])\b/gi, 'पी $1')
         .replace(/\bd([1-4])\b/gi, 'डी $1');

    // CRITICAL: Strip ALL punctuation, pipes, slashes, colons, dots, dashes, emojis so TTS NEVER says "danda", "dash", "comma"
    t = t.replace(/[^a-zA-Z\u0900-\u097F\s]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  const Voice = (() => {
    let chosen = null;

    function loadVoices() {
      if (!window.speechSynthesis) return;
      const voices = speechSynthesis.getVoices() || [];
      const hiVoices = voices.filter(v => /^hi/i.test(v.lang) || /hindi|हिन्दी/i.test(v.name));
      const inVoices = voices.filter(v => /^en[-_]in/i.test(v.lang));
      chosen =
        hiVoices.find(v => /swara|lekha|google|female|kalpana/i.test(v.name)) ||
        hiVoices[0] ||
        inVoices[0] ||
        voices[0] ||
        null;
    }

    if (window.speechSynthesis) {
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return {
      say(textToSpeak) {
        if (!MEM.tts || !window.speechSynthesis) return;
        this.stop();
        loadVoices();

        const cleanSpeech = toPureSpeech(textToSpeak);
        if (!cleanSpeech) return;

        // Speak as a single smooth utterance (up to 260 chars) so there is ZERO gap or stuttering
        const u = new SpeechSynthesisUtterance(cleanSpeech);
        u.lang = (chosen && chosen.lang) ? chosen.lang : 'hi-IN';
        if (chosen) u.voice = chosen;
        u.rate = 1.0;
        u.pitch = 1.0;

        try {
          speechSynthesis.speak(u);
        } catch (e) {}
      },
      stop() {
        try {
          if (window.speechSynthesis) speechSynthesis.cancel();
        } catch (e) {}
      }
    };
  })();

  // ======================================================================
  // 3. STRICT & ACCURATE PARTY / VEHICLE / DATE PARSER
  // ======================================================================
  async function getAppParties() {
    if (S.parties && S.parties.pub && S.parties.pub.length) return S.parties.pub;
    if (typeof APP.getParties === 'function') {
      try { return await APP.getParties(false, true); } catch (e) {}
    }
    return [];
  }

  function detectVehicleInQuery(q, parties) {
    if (!parties || !parties.length) return { vKey: null, party: null };
    const cleanQ = String(q || '').toUpperCase();

    // 1. Full license plate (e.g., UK20CA0627)
    const fullPlate = cleanQ.match(/[A-Z]{2}\s*\d{1,2}\s*[A-Z]{0,3}\s*\d{4}/);
    if (fullPlate) {
      const plateStr = fullPlate[0].replace(/\s+/g, '');
      const p = parties.find(pt => (pt.vehicles || []).some(v => String(v).toUpperCase().replace(/\s+/g, '').includes(plateStr)));
      if (p) return { vKey: plateStr, party: p };
    }

    // 2. 4-digit vehicle number (only if it matches a party's registered vehicle)
    const fourDigits = cleanQ.match(/\b\d{4}\b/g) || [];
    for (const d of fourDigits) {
      // Never treat as vehicle if directly attached to paytm/swipe/p1/d1/dip
      if (new RegExp(`(PAYTM|SWIPE|P[1-4]|D[1-4]|DIP)\\s*${d}`, 'i').test(cleanQ)) continue;
      const p = parties.find(pt => (pt.vehicles || []).some(v => String(v).replace(/\D/g, '').endsWith(d)));
      if (p) return { vKey: d, party: p };
    }
    return { vKey: null, party: null };
  }

  async function extractAmounts(text, parties, excludeVehicle) {
    let str = String(text || '').toLowerCase();
    str = str.replace(/[a-z]{2}\s*\d{1,2}\s*[a-z]{0,3}\s*\d{4}/gi, ' ');
    str = str.replace(/\b(p[1-4]|d[1-4])\b/gi, ' ');
    if (excludeVehicle) {
      str = str.replace(new RegExp(`\\b${excludeVehicle}\\b`, 'gi'), ' ');
    }

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
        const hasMoneyCue = /paytm|swipe|udhar|jama|chai|dg|kharcha|rupaye|rs|का|रुपये|उधार|जमा/i.test(text);
        if (!hasMoneyCue) continue;
      }

      let m = w.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/i);
      if (m) {
        let val = parseFloat(m[1]);
        const suf = (m[2] || '').toLowerCase();
        if (suf === 'k') val *= 1000;
        if (suf === 'l' || suf === 'lakh' || suf === 'lac') val *= 100000;
        if (words[i + 1] && /^(hazar|hajar|हज़ार|हजार)$/i.test(words[i + 1])) val *= 1000;
        if (words[i + 1] && /^(lakh|lac|लाख)$/i.test(words[i + 1])) val *= 100000;
        amounts.push(val);
      }
    }
    return amounts;
  }

  // Bilingual map for accurate Party Name matching without false positives
  const EN_TO_HI_NAMES = {
    'pappu': 'पप्पू', 'singh': 'सिंह', 'adhikari': 'अधिकारी',
    'deepak': 'दीपक', 'dipak': 'दीपक', 'shah': 'शाह',
    'chandan': 'चंदन', 'dev': 'देव',
    'kishor': 'किशोर', 'kishore': 'किशोर', 'upadhyay': 'उपाध्याय',
    'ghanshyam': 'घनश्याम', 'tiwari': 'तिवारी',
    'diwan': 'दीवान', 'bisht': 'बिष्ट',
    'paras': 'पारस', 'sati': 'सती',
    'madhan': 'मधन', 'madan': 'मधन',
    'maa': 'माँ', 'nand': 'नंद', 'stone': 'स्टोन', 'crusher': 'क्रेसर', 'kresar': 'क्रेसर',
    'mohit': 'मोहित', 'negi': 'नेगी',
    'laxman': 'लक्ष्मण', 'lakshman': 'लक्ष्मण', 'bharda': 'भरड़ा'
  };

  // Words that must NEVER trigger a party match (fixes "लोकल / बिना पार्टी (गाड़ी कैश)" & "चंदन देव" bug)
  const BLOCKED_QUERY_WORDS = new Set([
    'local','lokal','bina','party','gaadi','gadi','cash','लोकल','बिना','पार्टी','गाड़ी','कैश',
    'aaj','kal','parso','din','tarik','tareekh','date','purana','hisab','sale','bikri','bika',
    'petrol','diesel','nozzele','nozzle','trend','btao','batao','dikhao','kitna','kitne','kab','kyu','kyun',
    'pump','baje','khulta','band','malik','owner','mood','kaisa','baarish','mausam','dip','stock',
    'udhar','jama','khata','ledger','kholo','paytm','swipe','kharcha','chai','dg','inki','unka','inka',
    'aayi','aaya','gayi','baad','pehle','naam','mera','aapka','kon','kaun','hai','tha','hoga'
  ]);

  // Strictly finds a party ONLY if the user explicitly typed a real party name or vehicle
  async function findExplicitParty(q, parties) {
    if (!parties) parties = await getAppParties();
    if (!parties || !parties.length) return null;

    // 1. Check vehicle match first
    const vCheck = detectVehicleInQuery(q, parties);
    if (vCheck.party) {
      ctx.activeVehicle = vCheck.vKey;
      return vCheck.party;
    }

    // 2. Clean & filter query tokens
    const rawTokens = norm(q).split(' ').filter(w => w.length >= 3 && !BLOCKED_QUERY_WORDS.has(w) && !/^\d+$/.test(w));
    if (!rawTokens.length) return null;

    // Expand tokens with Hindi equivalents
    const searchTokens = new Set();
    rawTokens.forEach(t => {
      searchTokens.add(t);
      if (EN_TO_HI_NAMES[t]) searchTokens.add(EN_TO_HI_NAMES[t]);
    });

    let bestParty = null;
    let bestScore = 0;

    for (const p of parties) {
      // Never fuzzy-match the generic "लोकल / बिना पार्टी (गाड़ी कैश)" account unless user explicitly says "गाड़ी कैश खाता"
      if (/लोकल|बिना पार्टी/i.test(p.name) && !/गाड़ी कैश खाता|gadi cash khata/i.test(q)) {
        continue;
      }

      const pWords = norm(p.name).split(' ').filter(w => w.length >= 2);
      let score = 0;

      searchTokens.forEach(tok => {
        if (pWords.includes(tok)) {
          score += 50; // Exact word match in party name
        } else if (tok.length >= 4 && pWords.some(pw => pw.startsWith(tok) || tok.startsWith(pw))) {
          score += 25;
        }
      });

      if (score > bestScore && score >= 45) {
        bestScore = score;
        bestParty = p;
      }
    }

    return bestParty;
  }

  // Smart Date Parser for "10 tarik", "10 din purana", "kal", "parso"
  function resolveQueryDate(q) {
    const todayStr = T();
    const now = new Date(todayStr + 'T12:00:00');

    if (/\b(parso|परसों)\b/i.test(q)) {
      return { iso: addDays(todayStr, -2), label: 'परसों (' + addDays(todayStr, -2) + ')' };
    }
    if (/\b(kal|yesterday|कल)\b/i.test(q)) {
      return { iso: addDays(todayStr, -1), label: 'कल (' + addDays(todayStr, -1) + ')' };
    }

    // "10 din purana" / "5 din pehle"
    const daysAgoMatch = q.match(/(\d{1,2})\s*(?:din|day|दिन)\s*(?:purana|pehle|pahle|पुराना|पहले)/i);
    if (daysAgoMatch) {
      const dAgo = parseInt(daysAgoMatch[1], 10);
      const target = addDays(todayStr, -dAgo);
      return { iso: target, label: `${dAgo} दिन पहले (${target})` };
    }

    // "10 tarik" / "15 tareekh"
    const tarikMatch = q.match(/(\d{1,2})\s*(?:tarik|tareekh|tarikh|तारीख|तारीक)/i);
    if (tarikMatch) {
      const dayNum = parseInt(tarikMatch[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        let yr = now.getFullYear();
        let mo = now.getMonth() + 1;
        if (dayNum > now.getDate()) {
          mo -= 1;
          if (mo < 1) { mo = 12; yr -= 1; }
        }
        const target = `${yr}-${pad(mo)}-${pad(dayNum)}`;
        return { iso: target, label: `${dayNum} तारीख (${target})` };
      }
    }

    return { iso: todayStr, label: 'आज' };
  }

  // ======================================================================
  // 4. CORE BRAIN (Confident, Smart, Zero-Confusion Logic)
  // ======================================================================
  function R(html, o) {
    return Object.assign({ html }, o || {});
  }

  async function handleQuery(rawText, ui) {
    const raw = String(rawText || '').trim();
    const q = norm(raw);
    const parties = await getAppParties();

    // ------------------------------------------------------------------
    // 0. PENDING CONFIRMATION (Haan / Radd)
    // ------------------------------------------------------------------
    if (ctx.pendingAction) {
      if (/^(haan|yes|ha|ok|theek|sahi|kar do|save|हाँ|हां|जी|सही|कर दो)$/i.test(q)) {
        return await commitAction(ui);
      }
      if (/^(nahi|no|cancel|radd|mat|stop|नहीं|ना|रद्द|मत)$/i.test(q)) {
        ctx.pendingAction = null;
        return R('ठीक है, मैंने वह एंट्री रद्द कर दी है। आगे बताइए, क्या करना है?', {
          say: 'ठीक है, मैंने वह एंट्री रद्द कर दी है। आगे बताइए, क्या करना है?'
        });
      }
      ctx.pendingAction = null;
    }

    // ------------------------------------------------------------------
    // 1. STRICT SAFETY & IDENTITY RULES
    // ------------------------------------------------------------------
    if (/\b(remove|delete|hatao|mita|डिलीट|हटाओ|मिटाओ)\b/i.test(q)) {
      return R('माफ़ कीजिए, मैं कोई भी एंट्री delete नहीं कर सकती। यह अधिकार सिर्फ owner के पास है।', {
        say: 'माफ़ कीजिए, मैं कोई भी एंट्री डिलीट नहीं कर सकती। यह अधिकार सिर्फ ओनर के पास है।'
      });
    }

    // Fun/Banter about Malik Mood (Fixes Screenshot 1: "Malik ka mood kaisa hai aaj")
    if (/malik|owner|shashank|बॉस|मालिक/i.test(q) && /mood|khush|gussa|kaisa|मूड|खुश|गुस्सा/i.test(q)) {
      let saleVal = 0;
      if (db()) {
        try {
          const snap = await db().collection('days').doc(T()).get();
          if (snap.exists) saleVal = num((snap.data().sum || {}).sale);
        } catch (e) {}
      }
      if (saleVal > 50000) {
        return R(`😄 आज की सेल <b>${money(saleVal)}</b> पहुँच चुकी है, तो मालिक का मूड एकदम शानदार ही होगा! वैसे क्या आप आज का गल्ला चेक करना चाहेंगे?`, {
          say: `आज की सेल ${money(saleVal)} पहुँच चुकी है, तो मालिक का मूड एकदम शानदार ही होगा। क्या आप आज का गल्ला चेक करना चाहेंगे?`
        });
      }
      return R(`😊 मालिक का मूड तो हमेशा हिसाब और सेल देखकर बनता है! अभी तक आज की सेल <b>${money(saleVal)}</b> है। थोड़ा मीटर चलाइए, मूड अपने आप बढ़िया हो जाएगा!`, {
        say: `मालिक का मूड तो हिसाब और सेल देखकर बनता है। अभी तक आज की सेल ${money(saleVal)} है।`
      });
    }

    if (/(pump|mazda).*(owner|malik|kiska|shashank|मालिक|किसका)/i.test(q)) {
      return R('इस पंप के मालिक <b>शशांक बंसल (Shashank Bansal)</b> हैं।', {
        say: 'इस पंप के मालिक शशांक बंसल हैं।'
      });
    }

    if (/(tumhara|aapka).*(owner|malik)|kisne banaya|who made you|किसने बनाया/i.test(q)) {
      return R('मैं एक AI हूँ, मेरा कोई owner नहीं है। मुझे <b>नीरज देव (Neeraj Dev)</b> ने बनाया है।', {
        say: 'मैं एक ए आई हूँ, मेरा कोई ओनर नहीं है। मुझे नीरज देव ने बनाया है।'
      });
    }

    if (/(mera naam|main kaun|who am i|मेरा नाम|मैं कौन)/i.test(q)) {
      const uName = S.user ? S.user.email.split('@')[0] : (S.salesman ? S.salesman.name : 'User');
      const role = S.role === 'owner' ? 'मालिक' : (S.role === 'manager' ? 'मैनेजर' : 'यूज़र');
      return R(`आपका नाम <b>${esc(uName)}</b> है और आप इस ऐप में <b>${role}</b> के रूप में लॉगिन हैं।`, {
        say: `आपका नाम ${uName} है और आप इस ऐप में ${role} के रूप में लॉगिन हैं।`
      });
    }

    if (/(tum|aap).*(kaun|kya|kahan)|who are you|तुम कौन/i.test(q)) {
      return R('मैं <b>माज़दा असिस्टेंट</b> हूँ! मैं आपके पंप की सेल, नोज़ल रीडिंग, उधार खाते और डिप का पूरा हिसाब मुंहज़बानी रखती हूँ। बताइए, अभी किसका हिसाब देखें?', {
        say: 'मैं माज़दा असिस्टेंट हूँ। मैं आपके पंप की सेल, नोज़ल रीडिंग और उधार खातों का पूरा हिसाब रखती हूँ। बताइए, अभी किसका हिसाब देखें?'
      });
    }

    // ------------------------------------------------------------------
    // 2. PUMP TIMINGS & GENERAL PUMP INFO (Fixes Screenshot 3: "Pump kitne baje tak khulta hai")
    // ------------------------------------------------------------------
    if (/kitne baje|timing|khulta|band hota|kab khulega|कितने बजे|खुलता|बंद होता/i.test(q)) {
      return R('⛽ माज़दा ऑयल कंपनी पंप पर सुबह से रात तक लगातार सेवा चलती है। आप जब चाहें मीटर रीडिंग, उधार या रोज़ का हिसाब यहाँ दर्ज कर सकते हैं। क्या अभी किसी नोज़ल की रीडिंग डालनी है?', {
        say: 'माज़दा ऑयल कंपनी पंप पर सुबह से रात तक सेवा चलती है। क्या अभी आपको किसी नोज़ल की रीडिंग या हिसाब डालना है?',
        chips: [
          { label: '⛽ नोज़ल ट्रेंड देखें', onClick: () => handleQuery('Nozzle trend batao', ui).then(r => ui.bot(r)) },
          { label: '📊 आज की सेल', onClick: () => handleQuery('आज की सेल', ui).then(r => ui.bot(r)) }
        ]
      });
    }

    // ------------------------------------------------------------------
    // 3. NOZZLE TREND & MACHINE STATUS (Fixes Screenshot 6: "Nozzele trend btao")
    // ------------------------------------------------------------------
    if (/nozzle|nozzele|nozel|meter|नोजल|नोज़ल|मशीन/i.test(q) && /trend|status|report|btao|batao|kaisa|sale|ट्रेंड|हिसाब|बताओ/i.test(q)) {
      if (db()) {
        try {
          const snap = await db().collection('days').doc(T()).get();
          if (snap.exists && snap.data().nz) {
            const nz = snap.data().nz;
            const keys = ['p1', 'p2', 'd1', 'd2'];
            let lines = [];
            let bestNozzle = null;
            let maxLit = 0;

            keys.forEach(k => {
              if (nz[k]) {
                const o = num(nz[k].o);
                const c = num(nz[k].c);
                const sold = c > o ? (c - o) : 0;
                if (sold > maxLit) { maxLit = sold; bestNozzle = k.toUpperCase(); }
                lines.push(`• <b>${k.toUpperCase()}</b>: ${lit(sold)} <small>(ओपनिंग: ${o} → क्लोजिंग: ${c || 'बाकी'})</small>`);
              }
            });

            if (lines.length) {
              const topMsg = bestNozzle ? `<br><br>🏆 सबसे ज्यादा बिक्री <b>${bestNozzle} (${lit(maxLit)})</b> से हुई है।` : '<br><br>💡 अभी क्लोजिंग रीडिंग दर्ज होना बाकी है।';
              return R(`⛽ <b>आज का नोज़ल ट्रेंड:</b><br>${lines.join('<br>')}${topMsg}`, {
                say: bestNozzle ? `आज सबसे ज्यादा बिक्री नोज़ल ${bestNozzle} से ${Math.round(maxLit)} लीटर हुई है।` : 'आज के नोज़ल की क्लोजिंग रीडिंग अभी दर्ज नहीं हुई है।'
              });
            }
          }
        } catch (e) {}
      }
      return R('⛽ आज के नोज़ल मीटर की रीडिंग अभी दर्ज नहीं हुई है। आप <b>"P1 4500"</b> या <b>"D1 8200"</b> बोलकर सीधे रीडिंग चढ़ा सकते हैं।', {
        say: 'आज के नोज़ल मीटर की रीडिंग अभी दर्ज नहीं हुई है। आप पी एक या डी एक बोलकर रीडिंग चढ़ा सकते हैं।'
      });
    }

    // ------------------------------------------------------------------
    // 4. PARTY VISIT HISTORY (Fixes Screenshot 7: "Inki gaadi kitne din baad aayi aaj")
    // ------------------------------------------------------------------
    if (/(kitne din baad|kab aayi|kab aaye|last entry|pichli baar|aakhiri baar|कितने दिन बाद|कब आई|पिछली बार)/i.test(q)) {
      const targetParty = (await findExplicitParty(q, parties)) || ctx.activeParty;
      if (!targetParty) {
        return R('आप किस पार्टी या गाड़ी की पिछली एंट्री पूछ रहे हैं? कृपया पहले उनका नाम या गाड़ी नंबर बताइए।', {
          say: 'आप किस पार्टी या गाड़ी की पिछली एंट्री पूछ रहे हैं? कृपया पहले उनका नाम या गाड़ी नंबर बताइए।'
        });
      }
      ctx.activeParty = targetParty;

      if (db()) {
        try {
          const lSnap = await db().collection('ledger').where('partyId', '==', targetParty.id).get();
          const docs = [];
          lSnap.forEach(d => docs.push(d.data()));
          docs.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

          const uniqueDates = [...new Set(docs.map(d => d.date).filter(Boolean))];
          if (uniqueDates.length >= 2) {
            const latest = new Date(uniqueDates[0] + 'T12:00:00');
            const prev = new Date(uniqueDates[1] + 'T12:00:00');
            const diffDays = Math.max(1, Math.round((latest - prev) / (1000 * 60 * 60 * 24)));
            return R(`📅 <b>${esc(targetParty.name)}</b> की गाड़ी पिछली बार <b>${uniqueDates[1]}</b> को आई थी, यानी आज पूरे <b>${diffDays} दिन बाद</b> एंट्री हुई है।<br>इनका वर्तमान बकाया <b>${money(targetParty.bal)}</b> है।`, {
              say: `${targetParty.name} की गाड़ी पिछली बार ${diffDays} दिन पहले आई थी। इनका वर्तमान बकाया ${money(targetParty.bal)} है।`,
              chips: [
                { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(targetParty.id, false); } }
              ]
            });
          } else if (uniqueDates.length === 1) {
            return R(`📅 <b>${esc(targetParty.name)}</b> के खाते में यह पहली ही तारीख (<b>${uniqueDates[0]}</b>) की एंट्री है।`, {
              say: `${targetParty.name} के खाते में यह पहली ही तारीख की एंट्री है।`
            });
          }
        } catch (e) {}
      }
      return R(`<b>${esc(targetParty.name)}</b> का वर्तमान बकाया <b>${money(targetParty.bal)}</b> है। पूरा रिकॉर्ड देखने के लिए नीचे 'खाता खोलें' दबाएं।`, {
        chips: [{ label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(targetParty.id, false); } }]
      });
    }

    // ------------------------------------------------------------------
    // 5. CONTEXT FOLLOW-UP (Inka / Unka / Khata Kholo)
    // ------------------------------------------------------------------
    if (/\b(inka|uska|iski|uski|unko|unka|inki|इनका|उसका|उनका|इनकी)\b/i.test(q) || /khata kholo|ledger kholo|खाता खोलो/i.test(q)) {
      if (ctx.activeParty) {
        if (/khata|ledger|खाता/i.test(q)) {
          setTimeout(() => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(ctx.activeParty.id, false); }, 700);
          return R(`⏳ <b>${esc(ctx.activeParty.name)}</b> का खाता खोल रही हूँ...`, {
            say: `${ctx.activeParty.name} का खाता खोल रही हूँ।`
          });
        }
        return R(`👤 <b>${esc(ctx.activeParty.name)}</b> का वर्तमान बकाया: <b class="neg">${money(ctx.activeParty.bal)}</b><br>गाड़ियां: ${esc((ctx.activeParty.vehicles || []).join(', ') || 'कोई नहीं')}`, {
          say: `${ctx.activeParty.name} का वर्तमान बकाया ${money(ctx.activeParty.bal)} है।`,
          chips: [
            { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(ctx.activeParty.id, false); } }
          ]
        });
      }
      return R('आप किस पार्टी की बात कर रहे हैं? कृपया पहले नाम या गाड़ी नंबर बताइए।', {
        say: 'आप किस पार्टी की बात कर रहे हैं? कृपया पहले नाम या गाड़ी नंबर बताइए।'
      });
    }

    // ------------------------------------------------------------------
    // 6. STANDALONE VEHICLE NUMBER QUERY (e.g. "9769" or "UK20CA0627")
    // ------------------------------------------------------------------
    if (/^\d{4}$/.test(q) || /^[a-z]{2}\s*\d{1,2}\s*[a-z]{0,3}\s*\d{4}$/i.test(q)) {
      const vCheck = detectVehicleInQuery(q, parties);
      if (vCheck.party) {
        ctx.activeParty = vCheck.party;
        ctx.activeVehicle = vCheck.vKey;
        return R(`🚗 गाड़ी <b>${esc(vCheck.vKey)}</b> पार्टी <b>${esc(vCheck.party.name)}</b> की है।<br>वर्तमान बकाया: <b>${money(vCheck.party.bal)}</b><br><br>बताइए, इसमें कितने का उधार या जमा लिखना है?`, {
          say: `गाड़ी ${vCheck.vKey} पार्टी ${vCheck.party.name} की है। इनका बकाया ${money(vCheck.party.bal)} है। इसमें कितने का उधार लिखना है?`,
          chips: [
            { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(vCheck.party.id, false); } },
            { label: '➕ ₹2000 उधार', onClick: () => handleQuery(`${vCheck.vKey} में 2000 का उधार`, ui).then(r => ui.bot(r)) }
          ]
        });
      }
      return R(`गाड़ी नंबर <b>${esc(q.toUpperCase())}</b> किसी भी पार्टी के खाते में दर्ज नहीं मिली।`, {
        say: 'यह गाड़ी नंबर किसी भी पार्टी के खाते में नहीं मिला।'
      });
    }

    // ------------------------------------------------------------------
    // 7. DIP CHART LOOKUP (e.g. "45 dip mai diesel", "100 dip me kitna diesel")
    // ------------------------------------------------------------------
    if (/dip|डिप/i.test(q)) {
      const dipMatch = q.match(/\b\d+(\.\d+)?\b/);
      if (dipMatch && window.DipChart && typeof window.DipChart.getLiters === 'function') {
        const val = parseFloat(dipMatch[0]);
        const askDiesel = /diesel|hsd|डीजल|डीज़ल/i.test(q);
        const askPetrol = /petrol|ms|पेट्रोल/i.test(q);

        let htmlOut = `📏 <b>${val} सेमी डिप पर स्टॉक:</b><br>`;
        let speechParts = [`${hiNum(val)} सेंटीमीटर डिप पर`];

        if (askDiesel || !askPetrol) {
          const dLit = window.DipChart.getLiters('diesel', val);
          htmlOut += `🛢️ डीज़ल: <b>${lit(dLit)}</b><br>`;
          speechParts.push(`डीज़ल ${hiNum(Math.round(dLit))} लीटर है`);
        }
        if (askPetrol || !askDiesel) {
          const pLit = window.DipChart.getLiters('petrol', val);
          htmlOut += `⛽ पेट्रोल: <b>${lit(pLit)}</b>`;
          speechParts.push(`पेट्रोल ${hiNum(Math.round(pLit))} लीटर है`);
        }
        return R(htmlOut, { say: speechParts.join(' और ') });
      }
    }

    // ------------------------------------------------------------------
    // 8. SALES, DATES & "WHY SALE LOW" ANALYSIS
    //    (Fixes Screenshot 2: "10 tarik ki sale", "10 din purana hisab"
    //     & Screenshot 3: "Aaj jyda petrol kyu nahi bika")
    // ------------------------------------------------------------------
    const hasDatePhrase = /(\d{1,2})\s*(?:tarik|tareekh|tarikh|din purana|din pehle|तारीख|दिन पुराना)/i.test(q);
    if (/sale|bikri|bika|dhandha|galla|सेल|बिक्री|बिका|गल्ला/i.test(q) || (hasDatePhrase && /hisab|sale|bikri|हिसाब|सेल/i.test(q))) {
      const dateObj = resolveQueryDate(q);
      const isWhyQuery = /kyu|kyun|kyo|क्यों|क्युं|कम क्यों/i.test(q);

      if (db()) {
        try {
          const dSnap = await db().collection('days').doc(dateObj.iso).get();
          if (!dSnap.exists) {
            return R(`📅 <b>${dateObj.label}</b> का कोई हिसाब रिकॉर्ड में दर्ज नहीं मिला। क्या आप कल या आज की सेल देखना चाहेंगे?`, {
              say: `${dateObj.label} का कोई हिसाब रिकॉर्ड में नहीं मिला। क्या आप कल या आज की सेल देखना चाहेंगे?`,
              chips: [
                { label: '📊 आज की सेल', onClick: () => handleQuery('आज की सेल', ui).then(r => ui.bot(r)) },
                { label: '📈 कल की सेल', onClick: () => handleQuery('कल की सेल', ui).then(r => ui.bot(r)) }
              ]
            });
          }

          const data = dSnap.data() || {};
          const sum = data.sum || {};
          const totalSale = num(sum.sale);
          const litP = num(sum.litP);
          const litD = num(sum.litD);

          // If user asked "Aaj jyda petrol kyu nahi bika" (Why analysis)
          if (isWhyQuery) {
            if (totalSale === 0 && litP === 0) {
              return R(`💡 <b>${dateObj.label}</b> की नोज़ल क्लोजिंग रीडिंग अभी तक भरी नहीं गई है, इसलिए पेट्रोल और डीज़ल की बिक्री <b>0 लीटर</b> दिख रही है!<br><br>जैसे ही आप <b>"P1 4500"</b> लिखकर क्लोजिंग रीडिंग डालेंगे, असली बिक्री सामने आ जाएगी।`, {
                say: 'आज की नोज़ल क्लोजिंग रीडिंग अभी तक भरी नहीं गई है, इसलिए बिक्री शून्य दिख रही है। रीडिंग डालते ही हिसाब आ जाएगा।'
              });
            }
            return R(`📊 <b>${dateObj.label} का विश्लेषण:</b><br>कुल सेल: <b>${money(totalSale)}</b><br>⛽ पेट्रोल: <b>${lit(litP)}</b><br>🛢️ डीज़ल: <b>${lit(litD)}</b><br><br>💡 ${litP < litD ? 'आज छोटी गाड़ियों के मुकाबले डीज़ल गाड़ियों का उठाव ज्यादा रहा है।' : 'पेट्रोल की बिक्री सामान्य रफ़्तार से चल रही है।'}`, {
              say: `${dateObj.label} की कुल सेल ${money(totalSale)} है, जिसमें पेट्रोल ${Math.round(litP)} लीटर और डीज़ल ${Math.round(litD)} लीटर बिका है।`
            });
          }

          return R(`📊 <b>${dateObj.label} की कुल सेल: ${money(totalSale)}</b><br>⛽ पेट्रोल: <b>${lit(litP)}</b><br>🛢️ डीज़ल: <b>${lit(litD)}</b>`, {
            say: `${dateObj.label} की कुल सेल ${money(totalSale)} है। पेट्रोल ${Math.round(litP)} लीटर और डीज़ल ${Math.round(litD)} लीटर बिका है।`,
            chips: [
              { label: '⛽ नोज़ल ट्रेंड', onClick: () => handleQuery('Nozzle trend batao', ui).then(r => ui.bot(r)) },
              { label: '📒 कुल उधार', onClick: () => handleQuery('कुल उधार', ui).then(r => ui.bot(r)) }
            ]
          });
        } catch (e) {}
      }
      return R(`${dateObj.label} का हिसाब अभी लोड नहीं हो सका।`);
    }

    // ------------------------------------------------------------------
    // 9. SMART PIVOT (Weather, Cricket, Tea/Food, Random Chitchat)
    // ------------------------------------------------------------------
    if (/baarish|mausam|weather|rain|thand|garmi|dhoop|बारिश|मौसम|धूप|ठंड|गर्मी/i.test(q)) {
      let saleMoney = '₹0';
      if (db()) {
        try {
          const dSnap = await db().collection('days').doc(T()).get();
          if (dSnap.exists) saleMoney = money((dSnap.data().sum || {}).sale);
        } catch (e) {}
      }
      return R(`🌤️ मौसम का तो पता नहीं, पर आज अपने पंप की सेल <b>${saleMoney}</b> हो चुकी है! वैसे क्या आज का Paytm या खर्चा दर्ज करना है?`, {
        say: `मौसम का तो पता नहीं, पर आज की सेल ${saleMoney} हो चुकी है।`
      });
    }

    if (/match|cricket|ipl|score|मैच|क्रिकेट/i.test(q)) {
      let saleMoney = '₹0';
      if (db()) {
        try {
          const dSnap = await db().collection('days').doc(T()).get();
          if (dSnap.exists) saleMoney = money((dSnap.data().sum || {}).sale);
        } catch (e) {}
      }
      return R(`🏏 मैच का स्कोर तो टीवी बताएगा, पर आज अपने पंप का स्कोर <b>${saleMoney}</b> पहुँच चुका है!`, {
        say: `मैच का तो पता नहीं, पर आज अपने पंप की सेल ${saleMoney} हो चुकी है।`
      });
    }

    // ------------------------------------------------------------------
    // 10. TOTAL MARKET UDHAR SUMMARY
    // ------------------------------------------------------------------
    if (/(kul|total|market|sabse jyada|top|कुल|मार्केट|सबसे ज्यादा).*(udhar|baaki|उधार|बाकी)/i.test(q) || /^(udhar|kul udhar|कुल उधार)$/i.test(q)) {
      if (!parties || !parties.length) return R('पार्टी खातों का डेटा लोड नहीं हो पाया।');
      const defaulters = parties.filter(p => num(p.bal) > 0).sort((a, b) => num(b.bal) - num(a.bal));
      const totalUdhar = defaulters.reduce((acc, p) => acc + num(p.bal), 0);
      const top3 = defaulters.slice(0, 3).map((p, idx) => `${idx + 1}. <b>${esc(p.name)}</b>: ${money(p.bal)}`).join('<br>');
      return R(`📊 <b>मार्केट में कुल बकाया: ${money(totalUdhar)}</b> (${defaulters.length} खाते)<br><br><b>टॉप बकायादार:</b><br>${top3 || 'कोई बकाया नहीं'}`, {
        say: `मार्केट में कुल बकाया ${money(totalUdhar)} है। सबसे ज्यादा उधार ${defaulters[0] ? defaulters[0].name : ''} पर है।`
      });
    }

    // ------------------------------------------------------------------
    // 11. METER READING ENTRY (P1, P2, D1, D2)
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
    // 12. DAILY LEDGER ENTRY: Paytm / Swipe / Kharcha / Chai / DG
    // ------------------------------------------------------------------
    if (/\b(paytm|swipe|kharcha|chai|dg|पेटीएम|स्वाइप|खर्चा|चाय)\b/i.test(q)) {
      return await handleDailyFieldEntry(q, parties);
    }

    // ------------------------------------------------------------------
    // 13. UDHAR / JAMA ENTRY
    // ------------------------------------------------------------------
    if (/\b(udhar|jama|likho|likhna|chadao|dalna|उधार|जमा|लिखो)\b/i.test(q)) {
      return await handleUdharEntry(q, parties);
    }

    // ------------------------------------------------------------------
    // 14. EXPLICIT PARTY SEARCH ONLY (No Blind Fallback to ctx.activeParty!)
    // ------------------------------------------------------------------
    const explicitParty = await findExplicitParty(q, parties);
    if (explicitParty) {
      ctx.activeParty = explicitParty;
      const amounts = await extractAmounts(q, parties, ctx.activeVehicle);
      if (amounts.length > 0 && /\b(में|mein|me|ka|का)\b/i.test(q)) {
        return await handleUdharEntry(q, parties);
      }
      return R(`👤 <b>${esc(explicitParty.name)}</b><br>वर्तमान बकाया: <b class="neg">${money(explicitParty.bal)}</b><br>गाड़ियां: <small>${esc((explicitParty.vehicles || []).join(', ') || 'कोई नहीं')}</small><br><br>इनके खाते में क्या करना है?`, {
        say: `${explicitParty.name} का वर्तमान बकाया ${money(explicitParty.bal)} है। बताइए, इनके खाते में क्या करना है?`,
        chips: [
          { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(explicitParty.id, false); } },
          { label: '➕ उधार दर्ज करें', onClick: () => handleQuery(`${explicitParty.name} में उधार`, ui).then(r => ui.bot(r)) }
        ]
      });
    }

    // ------------------------------------------------------------------
    // 15. ROTATING CONVERSATIONAL FALLBACK (Never boring, builds a loop)
    // ------------------------------------------------------------------
    const fallbacks = [
      {
        html: `🤔 यह बात मेरे पंप के रजिस्टर से थोड़ी बाहर की है! मैं आपके लिए <b>आज की सेल</b>, <b>पार्टी का उधार</b>, <b>नोज़ल ट्रेंड</b> या <b>डिप स्टॉक</b> तुरंत निकाल सकती हूँ। इनमें से क्या दिखाऊँ?`,
        say: `यह बात मेरे पंप के रजिस्टर से बाहर की है। मैं आपको आज की सेल, पार्टी का उधार या डिप स्टॉक बता सकती हूँ। इनमें से क्या दिखाऊँ?`
      },
      {
        html: `😊 मैं पंप की डिजिटल मैनेजर हूँ, तो हिसाब-किताब में मेरी पकड़ सबसे तेज़ है! आप चाहें तो किसी गाड़ी का नंबर (जैसे <b>9769</b>) बोलें या <b>"Paytm 500"</b> जैसी एंट्री करवा लें।`,
        say: `मैं पंप की डिजिटल मैनेजर हूँ। आप किसी गाड़ी का नंबर बोलें या पेटीएम और मीटर की एंट्री करवा लें।`
      },
      {
        html: `💡 इसका सटीक जवाब मेरे डेटा में नहीं है, पर क्या आप देखना चाहेंगे कि आज किस नोज़ल से सबसे ज्यादा तेल बिका या मार्केट में कुल कितना उधार है?`,
        say: `इसका जवाब मेरे डेटा में नहीं है, पर क्या आप देखना चाहेंगे कि आज किस नोज़ल से सबसे ज्यादा तेल बिका या कुल कितना उधार है?`
      }
    ];

    const pick = fallbacks[MEM.fallbackIdx % fallbacks.length];
    MEM.fallbackIdx = (MEM.fallbackIdx + 1) % fallbacks.length;
    saveMem();

    return R(pick.html, {
      say: pick.say,
      chips: [
        { label: '📊 आज की सेल', onClick: () => handleQuery('आज की सेल', ui).then(r => ui.bot(r)) },
        { label: '⛽ नोज़ल ट्रेंड', onClick: () => handleQuery('Nozzle trend batao', ui).then(r => ui.bot(r)) },
        { label: '📒 कुल उधार', onClick: () => handleQuery('कुल उधार', ui).then(r => ui.bot(r)) }
      ]
    });
  }

  // ======================================================================
  // 5. ENTRY CONFIRMATION HANDLERS
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
      return R(`⚠️ Galti! Opening <b>${openVal}</b> hai, closing kam nahi ho sakti.`, {
        say: `गलती, ओपनिंग ${openVal} है, क्लोजिंग कम नहीं हो सकती।`
      });
    }

    const diffLiters = openVal > 0 ? (closingVal - openVal) : 0;
    const saleLitersHtml = openVal > 0 ? ` (बिक्री: <b>${diffLiters} L</b>)` : '';
    ctx.pendingAction = {
      type: 'METER',
      key: nozzleKey,
      value: closingVal,
      date: today
    };

    return R(`नोज़ल <b>${nozzleKey.toUpperCase()}</b> की क्लोजिंग <b>${closingVal}</b>${saleLitersHtml} दर्ज करनी है?<br>क्या यह सही है?`, {
      say: `नोज़ल ${nozzleKey.toUpperCase()} की क्लोजिंग ${closingVal} दर्ज करनी है, क्या यह सही है?`,
      chips: [
        { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
        { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('ठीक है, रद्द कर दिया गया।')); } }
      ]
    });
  }

  async function handleDailyFieldEntry(q, parties) {
    const amounts = await extractAmounts(q, parties, null);
    const val = amounts[0];
    const today = T();

    if (!val) {
      return R('कृपया रक़म भी साथ में बताइए, जैसे <b>"Paytm 500"</b> या <b>"Chai 70"</b>.', {
        say: 'कृपया रक़म भी साथ में बताइए, जैसे पेटीएम पाँच सौ या चाय सत्तर।'
      });
    }

    if (/paytm|पेटीएम/i.test(q)) {
      ctx.pendingAction = { type: 'DAILY_FIELD', field: 'paytm', value: val, date: today };
      return R(`आज का <b>Paytm</b> कलेक्शन <b>${money(val)}</b> सेट करना है?`, {
        say: `क्या आज का पेटीएम कलेक्शन ${money(val)} सेट करना है?`,
        chips: [
          { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
          { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('ठीक है, रद्द कर दिया।')); } }
        ]
      });
    }

    if (/swipe|स्वाइप/i.test(q)) {
      ctx.pendingAction = { type: 'DAILY_FIELD', field: 'swipe', value: val, date: today };
      return R(`आज का <b>Swipe</b> कलेक्शन <b>${money(val)}</b> सेट करना है?`, {
        say: `क्या आज का स्वाइप कलेक्शन ${money(val)} सेट करना है?`,
        chips: [
          { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
          { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('ठीक है, रद्द कर दिया।')); } }
        ]
      });
    }

    let desc = 'अन्य खर्चा';
    if (/chai|चाय/i.test(q)) desc = 'चाय-नाश्ता';
    else if (/dg|generator|जनरेटर/i.test(q)) desc = 'DG जनरेटर';

    ctx.pendingAction = { type: 'KHARCHA', desc: desc, value: val, date: today };
    return R(`खर्चा <b>${desc}</b> में <b>${money(val)}</b> दर्ज करना है?`, {
      say: `क्या खर्चा ${desc} में ${money(val)} दर्ज करना है?`,
      chips: [
        { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
        { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('ठीक है, रद्द कर दिया।')); } }
      ]
    });
  }

  async function handleUdharEntry(q, parties) {
    const vCheck = detectVehicleInQuery(q, parties);
    let p = vCheck.party || (await findExplicitParty(q, parties)) || ctx.activeParty;
    if (vCheck.vKey) ctx.activeVehicle = vCheck.vKey;

    if (!p) {
      return R('किस पार्टी का उधार दर्ज करना है? कृपया पार्टी का नाम या गाड़ी नंबर बताइए।', {
        say: 'किस पार्टी का उधार दर्ज करना है? कृपया नाम या गाड़ी नंबर बताइए।'
      });
    }

    ctx.activeParty = p;
    const amounts = await extractAmounts(q, parties, vCheck.vKey || ctx.activeVehicle);
    const val = amounts[0];

    if (!val) {
      return R(`<b>${esc(p.name)}</b> के खाते में कितने रुपये का उधार दर्ज करना है?`, {
        say: `${p.name} के खाते में कितने रुपये का उधार दर्ज करना है?`
      });
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
      say: `${p.name} के खाते में ${money(val)} उधार दर्ज करना है। क्या मैं इसे सेव कर दूँ?`,
      chips: [
        { label: '✅ Haan', onClick: (ui) => commitAction(ui) },
        { label: '❌ Radd', onClick: (ui) => { ctx.pendingAction = null; ui.bot(R('ठीक है, एंट्री रद्द कर दी।')); } }
      ]
    });
  }

  // ======================================================================
  // 6. DATABASE WRITERS (Crash-Proof Commit Engine)
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

        safeRecalc();
        return ui.bot(R(`✅ नोज़ल <b>${act.key.toUpperCase()}</b> की क्लोजिंग <b>${act.value}</b> सफलतापूर्वक सेव हो गई। और कोई रीडिंग बाक़ी है?`, {
          say: `नोज़ल ${act.key.toUpperCase()} की क्लोजिंग ${act.value} सेव हो गई।`
        }));
      }

      if (act.type === 'DAILY_FIELD') {
        await db().collection('days').doc(act.date).set({
          [act.field]: act.value
        }, { merge: true });

        safeRecalc();
        return ui.bot(R(`✅ आज का <b>${act.field.toUpperCase()}</b> कलेक्शन <b>${money(act.value)}</b> सफलतापूर्वक सेव हो गया!`, {
          say: `आज का ${act.field} कलेक्शन ${money(act.value)} सेव हो गया।`
        }));
      }

      if (act.type === 'KHARCHA') {
        const dRef = db().collection('days').doc(act.date);
        const dSnap = await dRef.get();
        let items = (dSnap.exists && Array.isArray(dSnap.data().kharchaItems)) ? dSnap.data().kharchaItems.slice() : [];
        items.push({ label: act.desc, amount: act.value });

        await dRef.set({ kharchaItems: items }, { merge: true });
        safeRecalc();
        return ui.bot(R(`✅ खर्चा <b>${esc(act.desc)}</b> में <b>${money(act.value)}</b> सेव हो गया।`, {
          say: `खर्चा ${act.desc} में ${money(act.value)} सेव हो गया।`
        }));
      }

      if (act.type === 'UDHAR') {
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
        if (S.parties) S.parties.pub = null;
        safeRecalc();

        return ui.bot(R(`✅ <b>${esc(act.party.name)}</b> का <b>${money(act.amount)}</b> उधार दर्ज हो गया।`, {
          say: `${act.party.name} का ${money(act.amount)} उधार दर्ज हो गया।`,
          chips: [
            { label: '📒 खाता खोलें', onClick: () => { ui.close(); if (typeof APP.partyView === 'function') APP.partyView(act.party.id, false); } }
          ]
        }));
      }
    } catch (err) {
      return ui.bot(R(`❌ डेटा सेव नहीं हुआ: ${esc(err.message)}`, {
        say: 'माफ़ कीजिए, तकनीकी कारण से डेटा सेव नहीं हो पाया।'
      }));
    }
  }

  // ======================================================================
  // 7. CHAT INTERFACE & FAB INJECTION
  // ======================================================================
  function injectFAB() {
    if (document.getElementById('ai-assist-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-assist-fab';
    fab.innerHTML = '🎤';
    fab.title = 'माज़दा AI असिस्टेंट';
    fab.style.cssText = 'position:fixed;bottom:80px;right:18px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff;font-size:26px;border:2.5px solid #f4b41a;box-shadow:0 6px 18px rgba(11,61,145,0.45);z-index:9999;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
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
      { label: '⛽ नोज़ल ट्रेंड', onClick: () => executeInput('Nozzle trend batao') },
      { label: '📒 कुल उधार', onClick: () => executeInput('कुल उधार') }
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

      const loader = addBubble('<span style="color:#666;font-size:12px;">⚡ देख रही हूँ...</span>', false);
      try {
        const response = await handleQuery(text, ui);
        loader.remove();
        if (response) ui.bot(response);
      } catch (err) {
        loader.remove();
        ui.bot(R(`❌ गड़बड़ हो गई: ${esc(err.message)}`, { say: 'माफ़ कीजिए, कोई तकनीकी गड़बड़ हो गई।' }));
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
    ui.bot(R(`${greet}! मैं <b>माज़दा असिस्टेंट</b> हूँ।<br>आप किसी गाड़ी का नंबर (जैसे <b>9769</b>), रीडिंग (<b>P1 4500</b>), या <b>Paytm 500</b> बोलकर तुरंत काम करवा सकते हैं।`, {
      say: `${greet}, मैं माज़दा असिस्टेंट हूँ। बताइए, आज किसका हिसाब देखना है?`
    }));
  }

  console.log('[Mazda assistant.js v7.0] Zero-Bug Fluent Engine Initialized ✓');
})();
