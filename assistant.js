/* Mazda Oil Company - Ultimate God-Tier Assistant (v4.0)
   Features:
   - Context Memory (बातचीत याद रखता है)
   - Smart Parsing (गाड़ी नंबर vs रकम)
   - Dip Chart Integration
   - Identity & Owner Knowledge
   - Data Entry (Meter, Udhar, Paytm, Kharcha) with strict Confirm & Validation
   - Block Delete/Remove
   - Premium Hindi TTS Voice (Chunked)
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
  const dmy = APP.dmy || (d => String(d).split('-').reverse().join('-'));
  const toast = APP.toast || (() => {});
  const db = () => APP.db;
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const T = () => (APP.todayISO ? APP.todayISO() : iso(new Date()));
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };

  // ======================================================================
  // 1. MEMORY & CONTEXT (बातचीत और सीख याद रखना)
  // ======================================================================
  const SK = 'mazda_assistant_v4';
  let MEM = { alias: {}, facts: [], tts: true, voice: '' };
  try { const j = JSON.parse(localStorage.getItem(SK) || 'null'); if (j) MEM = Object.assign(MEM, j); } catch (e) {}
  const saveMem = () => { try { localStorage.setItem(SK, JSON.stringify(MEM)); } catch (e) {} };
  saveMem();

  const ctx = { 
    activeParty: null, 
    activeVehicle: null, 
    pendingAction: null, 
    lastQuery: '', 
    lastIntent: null 
  };

  // ======================================================================
  // 2. LANGUAGE & NUMBERS (भाषा और हिंदी नंबर)
  // ======================================================================
  const CONS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h' };
  const MATRA = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au' };
  const VOW = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au' };
  function dev2lat(s) {
    s = s.replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x966));
    let out = '', pend = false;
    for (const ch of s) {
      if (CONS[ch] !== undefined) { out += CONS[ch] + 'a'; pend = true; continue; }
      if (MATRA[ch] !== undefined) { if (pend) out = out.slice(0, -1); out += MATRA[ch]; pend = false; continue; }
      if (ch === '्') { if (pend) out = out.slice(0, -1); pend = false; continue; }
      if (VOW[ch] !== undefined) { out += VOW[ch]; pend = false; continue; }
      if (ch === 'ं' || ch === 'ँ') { out += 'n'; pend = false; continue; }
      if (pend && /[^a-z0-9]/i.test(ch)) out = out.slice(0, -1);
      pend = false; out += ch;
    }
    if (pend) out = out.slice(0, -1);
    return out;
  }
  const norm = s => dev2lat(String(s || '').toLowerCase()).replace(/[^a-z0-9.,%+\-*\/@\s]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const W = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सतासी अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे').split(' ');
  function hiNum(n) {
    n = Math.floor(Math.abs(n)); if (n < 100) return W[n]; const p = [];
    const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3; const h = Math.floor(n / 100); n %= 100;
    if (cr) p.push(hiNum(cr) + ' करोड़'); if (lk) p.push(W[lk] + ' लाख'); if (th) p.push(W[th] + ' हज़ार');
    if (h) p.push(W[h] + ' सौ'); if (n) p.push(W[n]); return p.join(' ');
  }
  function numSpeak(str) {
    str = String(str).replace(/,/g, ''); const [i, f] = str.split('.');
    let r = hiNum(parseInt(i || '0', 10)); if (f && /[1-9]/.test(f)) r += ' दशमलव ' + f.split('').map(d => W[+d]).join(' '); return r;
  }
  const MONTH_HI = ['', 'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
  
  function speechify(html) {
    let t = String(html || '');
    t = t.replace(/<br\s*\/?>|<\/(div|p|li)>/gi, ' । ').replace(/<[^>]*>/g, ' ');
    t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, ' और ');
    t = t.replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, ' ');
    t = t.replace(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/g, (m, d, mo, y) => MONTH_HI[+mo] ? `${numSpeak(d)} ${MONTH_HI[+mo]} ${numSpeak(y)}` : m);
    t = t.replace(/₹\s*(-?)\s*([\d,]+(?:\.\d+)?)/g, (m, neg, n) => (neg ? 'माइनस ' : '') + numSpeak(n) + ' रुपये');
    t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s*%/g, (m, n) => numSpeak(n) + ' प्रतिशत');
    t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:L|ltr|Ltr|lit\.?|लीटर)\b/g, (m, n) => numSpeak(n) + ' लीटर');
    t = t.replace(/\d[\d,]*(?:\.\d+)?/g, n => numSpeak(n));
    t = t.replace(/₹/g, ' रुपये ').replace(/&/g, ' और ').replace(/[|•·*_#~>]/g, ' ').replace(/\s[-–—]\s/g, ', ');
    t = t.replace(/\s*[।]\s*(?:[।.]\s*)+/g, ' । ').replace(/\s+/g, ' ').trim();
    return t;
  }

  const Voice = (() => {
    let chosen = null, queue = [], busy = false, onIdle = null;
    const FEM = /(female|lekha|kalpana|swara|neerja|heera|veena|aditi|priya|raveena|isha|kajal|sangeeta|google\s*(हिन्दी|hindi)|hindi india)/i;
    
    function load() {
      if (!window.speechSynthesis) return;
      const voices = speechSynthesis.getVoices() || [];
      // Preference: Hindi Female -> Hindi any -> Indian English
      const list = voices.filter(v => /^hi/i.test(v.lang) || /^en[-_]in/i.test(v.lang));
      list.sort((a, b) => {
        let sa = FEM.test(a.name) ? 10 : 0;
        let sb = FEM.test(b.name) ? 10 : 0;
        if (/^hi/i.test(a.lang)) sa += 5;
        if (/^hi/i.test(b.lang)) sb += 5;
        return sb - sa;
      });
      chosen = list.find(v => v.voiceURI === MEM.voice || v.name === MEM.voice) || list[0] || null;
    }
    if (window.speechSynthesis) { load(); speechSynthesis.onvoiceschanged = load; }

    function chunks(text) {
      const sents = (text.match(/[^।.?!]+[।.?!]*/g) || [text]).map(s => s.trim()).filter(Boolean);
      const out = [];
      sents.forEach(s => {
        if (s.length <= 150) return out.push(s);
        let cur = '';
        s.split(/(?<=,|;|:)\s*/).forEach(p => { if ((cur + ' ' + p).length > 150 && cur) { out.push(cur.trim()); cur = p; } else cur += ' ' + p; });
        if (cur.trim()) out.push(cur.trim());
      });
      return out;
    }
    function next() {
      if (!queue.length) { busy = false; if (onIdle) { const f = onIdle; onIdle = null; f(); } return; }
      busy = true;
      const u = new SpeechSynthesisUtterance(queue.shift());
      u.lang = (chosen && chosen.lang) || 'hi-IN';
      if (chosen) u.voice = chosen;
      u.rate = 0.95; u.pitch = 1.1; u.volume = 1;
      u.onend = next; u.onerror = next;
      speechSynthesis.speak(u);
    }
    return {
      nextVoice() {
        load(); const v = speechSynthesis.getVoices() || [];
        const list = v.filter(x => /^hi/i.test(x.lang) || /^en[-_]in/i.test(x.lang));
        if(!list.length) return null;
        let i = Math.max(0, list.indexOf(chosen));
        chosen = list[(i + 1) % list.length]; MEM.voice = chosen.voiceURI || chosen.name; saveMem(); return chosen;
      },
      say(html, cb) {
        if (!MEM.tts || !window.speechSynthesis) { if (cb) cb(); return; }
        this.stop(true); load();
        queue = chunks(speechify(html)); onIdle = cb || null; next();
      },
      stop(silent) { queue = []; if (!silent) onIdle = null; try { speechSynthesis.cancel(); } catch (e) {} busy = false; },
      isBusy: () => busy
    };
  })();

  // ======================================================================
  // 3. SMART PARSER (समझने वाला इंजन)
  // ======================================================================
  function extractAmounts(q) {
    // Find numbers in query, excluding vehicle-like patterns (e.g. 5599, UK01...)
    const cleanQ = q.replace(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/gi, ' '); // remove full plate
    const words = cleanQ.split(/\s+/);
    let amounts = [];
    for (let i = 0; i < words.length; i++) {
      let w = words[i].replace(/,/g, '');
      let m = w.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/);
      if (m) {
        let val = parseFloat(m[1]);
        if (m[2] === 'k') val *= 1000;
        if (m[2] === 'l' || m[2] === 'lakh' || m[2] === 'lac') val *= 100000;
        // check for "hazar" next word
        const nx = words[i+1] ? words[i+1].toLowerCase() : '';
        if (nx.includes('hazar') || nx.includes('hajar')) val *= 1000;
        amounts.push(val);
      }
    }
    return amounts;
  }

  async function findParty(q) {
    const parties = S.parties && S.parties.pub ? S.parties.pub : await APP.getParties(false, true);
    if (!parties || !parties.length) return null;

    const qNorm = norm(q);
    // 1. Check Vehicle Number (Full or 4-digit)
    const plate = q.match(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/i);
    const fourDigit = q.match(/\b\d{4}\b/);
    let vKey = null;
    if (plate) vKey = plate[0].toUpperCase().replace(/\s+/g, '');
    else if (fourDigit) vKey = fourDigit[0];

    if (vKey) {
      const match = parties.find(p => (p.vehicles || []).some(v => String(v).toUpperCase().replace(/\s+/g, '').includes(vKey)));
      if (match) return match;
    }

    // 2. Check Name (Fuzzy + Phonetic)
    const words = qNorm.split(' ').filter(w => w.length >= 2 && !['ka','ki','ke','kholo','ledger','khata','hisab','udhar','batao','dikhao','rupaye','ka','aaj','kal','diesel','petrol','mein','mai','add','karo','entry','hai','kitna','ki','kro'].includes(w));
    
    if (words.length) {
      let bestP = null, bestScore = 0;
      parties.forEach(p => {
        const pName = norm(p.name);
        let score = 0;
        words.forEach(w => {
          if (pName.includes(w)) score += w.length;
        });
        if (score > bestScore) { bestScore = score; bestP = p; }
      });
      if (bestScore > 3) return bestP;
    }
    return null;
  }

  // ======================================================================
  // 4. DATA FETCHING & VALIDATION
  // ======================================================================
  async function getTodayData() {
    const snap = await db().collection('days').doc(T()).get();
    return snap.exists ? snap.data() : null;
  }

  async function handleQuery(raw, ui) {
    const q = norm(raw);
    
    // --- IDENTITY & MAIN INFO ---
    if (/owner|malik|shashank/i.test(q) && /kon|kaun|kiska|name/i.test(q)) {
      return R(`इस माज़दा ऑयल कंपनी (पंप) के मालिक <b>शशांक बंसल</b> हैं।`, { say: 'इस पंप के मालिक शशांक बंसल जी हैं।' });
    }
    if (/tumhara owner|tumhara malik|tumhe kisne banaya|who made you/i.test(q)) {
      return R(`मैं एक AI हूँ, मेरा कोई मालिक नहीं है। मुझे <b>नीरज देव</b> ने बनाया है।`, { say: 'मैं एक ए आई हूँ, मेरा कोई मालिक नहीं है। मुझे नीरज देव ने बनाया है।' });
    }
    if (/tum kaun ho|kahan rehti ho|who are you|your name/i.test(q)) {
      return R(`मैं माज़दा असिस्टेंट हूँ, एक AI। मेरा कोई शरीर नहीं है, मैं इसी ऐप के अंदर रहती हूँ और आपकी मदद करती हूँ।`, { say: 'मैं माज़दा असिस्टेंट हूँ, एक ए आई। मैं इसी ऐप के अंदर रहती हूँ।' });
    }
    if (/chatgpt|claude|gemini|openai/i.test(q)) {
      return R(`नहीं, मैं कोई बाहरी API नहीं हूँ। मैं इस ऐप के अंदर बना एक लोकल AI असिस्टेंट हूँ, जो आपके डेटा से जवाब देता है।`);
    }

    // --- REMOVE / DELETE BLOCKER ---
    if (/remove|delete|hatao|mitto|mita|clear/i.test(q)) {
      return R(`माफ़ कीजिए, मैं कोई भी एंट्री delete या remove नहीं कर सकती। यह अधिकार सिर्फ मालिक के पास है।`, { say: 'माफ़ कीजिए, मैं कोई भी एंट्री डिलीट नहीं कर सकती।' });
    }

    // --- DIP CHART (डिप से लीटर) ---
    if (/dip/i.test(q) && /liter|kitna|petrol|diesel|tel/i.test(q)) {
      const dipMatch = q.match(/\b\d+(\.\d+)?\b/);
      const dipVal = dipMatch ? parseFloat(dipMatch[0]) : null;
      const isDiesel = /diesel|hsd/i.test(q);
      const isPetrol = /petrol|ms/i.test(q);
      
      if (dipVal && window.DipChart && window.DipChart.getLiters) {
        let txt = `<b>${dipVal} Dip (सेमी) पर:</b><br>`;
        if (isDiesel || !isPetrol) {
          const dL = window.DipChart.getLiters('diesel', dipVal);
          txt += `🛢️ डीज़ल: <b>${lit(dL)}</b><br>`;
        }
        if (isPetrol || !isDiesel) {
          const pL = window.DipChart.getLiters('petrol', dipVal);
          txt += `⛽ पेट्रोल: <b>${lit(pL)}</b>`;
        }
        return R(txt, { say: speechify(txt) });
      }
    }

    // --- DATE & SALES ---
    if (/sale|bikri/i.test(q)) {
      const isKal = /kal/i.test(q);
      const dStr = isKal ? addDays(T(), -1) : T();
      const dSnap = await db().collection('days').doc(dStr).get();
      if (!dSnap.exists) return R(`${isKal?'कल':'आज'} का हिसाब शुरू नहीं हुआ है।`);
      const sum = dSnap.data().sum || {};
      
      let funMsg = '';
      if (!isKal && sum.litD < 500) funMsg = `<br><br>😅 क्या बात, आज तो सिर्फ ${lit(sum.litD)} डीज़ल ही बिका! कोई नई गाड़ी नहीं आई या धूप तेज़ थी?`;

      return R(`<b>${isKal?'कल':'आज'} की कुल सेल: ${money(sum.sale)}</b><br>⛽ पेट्रोल: ${lit(sum.litP)}<br>🛢️ डीज़ल: ${lit(sum.litD)}${funMsg}`, { 
        say: `${isKal?'कल':'आज'} की सेल ${money(sum.sale)} रही। ${funMsg ? speechify(funMsg) : ''}`
      });
    }

    // --- UDHAR BALANCE ---
    if (/udhar|baaki|balance/i.test(q) && !/likhna|entry|karo|dalna|add/i.test(q)) {
      const p = await findParty(q) || ctx.activeParty;
      if (!p) return R(`किस पार्टी का उधार देखना है? नाम या गाड़ी नंबर बताइए।`);
      ctx.activeParty = p;
      return R(`<b>${esc(p.name)}</b> का कुल उधार: <b class="neg">${money(p.bal)}</b>`, {
        chips: [{ label: '📒 खाता खोलें', onClick: () => { ui.close(); APP.partyView(p.id, false); } }]
      });
    }

    // --- METER / STOCK / PAYTM ENTRY (DAILY HISAB) ---
    if (/meter|reading|paytm|swipe|dg|kharcha|chai/i.test(q) && /karo|likho|entry|add|dalna|hai/i.test(q)) {
      return handleDailyEntry(q, raw, ui);
    }

    // --- UDHAR ENTRY ---
    if (/udhar|udhari/i.test(q) && /likhna|entry|karo|dalna|add|hai/i.test(q)) {
      return handleUdharEntry(q, raw, ui);
    }

    // --- FALLBACK / SMART PIVOT ---
    if (/mausam|weather|rain|cricket|match/i.test(q)) {
      const dSnap = await getTodayData();
      const sale = dSnap ? money((dSnap.sum || {}).sale) : '₹0';
      return R(`मौसम या मैच का पता तो नहीं, पर हमारे पंप पर आज <b>${sale}</b> का धंधा हो चुका है!`);
    }

    return R(`मुझे समझ नहीं आया। आप 'आज की सेल', 'P1 की रीडिंग', 'पप्पू का उधार', या '5599 में 5000 का उधार' जैसा कुछ पूछ सकते हैं।`);
  }

  // ======================================================================
  // 5. ENTRY HANDLERS (एंट्री और कन्फर्मेशन)
  // ======================================================================
  
  // Daily Entries (Paytm, Swipe, Meter, DG)
  async function handleDailyEntry(q, raw, ui) {
    const nums = extractAmounts(q);
    const val = nums.length ? nums[0] : null;
    const today = T();

    // 1. Meter Entry (P1, P2, etc)
    const nzMatch = q.match(/\b(p[1-4]|d[1-4]|नोजल\s*\d|nozzle\s*\d)\b/i);
    if (nzMatch && val) {
      const k = nzMatch[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0,2);
      const dSnap = await db().collection('days').doc(today).get();
      let openVal = 0;
      if (dSnap.exists && dSnap.data().nz && dSnap.data().nz[k]) {
        openVal = num(dSnap.data().nz[k].o);
      }
      
      // Validation: Closing cannot be less than Opening
      if (val < openVal) {
        return R(`⚠️ गलत रीडिंग! नोज़ल ${k.toUpperCase()} की ओपनिंग <b>${openVal}</b> है, तो क्लोजिंग इससे कम नहीं हो सकती। कृपया सही रीडिंग बताइए।`, {
          say: `गलत रीडिंग। नोज़ल ${k.toUpperCase()} की ओपनिंग ${openVal} है। क्लोजिंग कम नहीं हो सकती।`
        });
      }

      // Fun / Anomaly check
      let fun = '';
      if (openVal > 0 && (val - openVal) < 50) {
        fun = `<br><br>😅 वाह, आज ${k.toUpperCase()} पर सिर्फ ${val-openVal} लीटर बिका? कोई गाड़ी ही नहीं आई क्या?`;
      }

      ctx.pendingAction = { type: 'METER', key: k, value: val, date: today };
      return R(`नोज़ल <b>${k.toUpperCase()}</b> की नई रीडिंग <b>${val}</b> दर्ज करनी है।${fun}<br><br>क्या यह सही है?`, {
        chips: [
          { label: '✅ हाँ, दर्ज करो', onClick: () => commitAction(ui) },
          { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('ठीक है, रद्द कर दिया।')); } }
        ]
      });
    }

    // 2. Paytm / Swipe
    if (/paytm|swipe|upi/i.test(q) && val) {
      const type = /swipe/i.test(q) ? 'swipe' : 'paytm';
      const dSnap = await db().collection('days').doc(today).get();
      let prev = dSnap.exists ? num(dSnap.data()[type]) : 0;
      
      let warn = '';
      if (prev > 0 && val < prev * 0.5) {
        warn = `<br><br>⚠️ ध्यान दें: अभी तक ${type} ${money(prev)} था, अब ${money(val)} हो गया है। क्या यह सही है?`;
      }

      ctx.pendingAction = { type: 'DAILY', field: type, value: val, date: today };
      return R(`${type.toUpperCase()} को <b>${money(val)}</b> सेट करना है।${warn}<br><br>क्या दर्ज करूँ?`, {
        chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }]
      });
    }

    // 3. Kharcha (DG, Chai, etc)
    if (/kharcha|dg|chai|expense/i.test(q) && val) {
      let desc = 'अन्य खर्चा';
      if (/dg/i.test(q)) desc = 'DG (जनरेटर)';
      if (/chai/i.test(q)) desc = 'चाय-खाना';

      ctx.pendingAction = { type: 'DAILY', field: 'kharcha', value: val, desc: desc, date: today };
      return R(`खर्चा <b>${desc}</b> में <b>${money(val)}</b> दर्ज करना है।<br><br>क्या दर्ज करूँ?`, {
        chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द।')); } }]
      });
    }
    
    return R('मुझे नहीं पता यह किसकी एंट्री है। कृपया साफ बताइए (जैसे: "P1 की रीडिंग 5000" या "Paytm 2000").');
  }

  // Udhar Entry (Vehicle / Party + Amount)
  async function handleUdharEntry(q, raw, ui) {
    const amounts = extractAmounts(q);
    const val = amounts.length ? amounts[0] : null;
    
    let p = await findParty(q);
    if (!p && ctx.activeParty) p = ctx.activeParty;

    if (!p) return R(`किस पार्टी का उधार दर्ज करना है? नाम या गाड़ी नंबर बताइए।`);
    
    // Vehicle Number extraction
    let vNum = '';
    const plate = q.match(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/i);
    if (plate) vNum = plate[0].toUpperCase();
    else {
      const four = q.match(/\b\d{4}\b/);
      if (four && p.vehicles && p.vehicles.some(v => v.includes(four[0]))) vNum = p.vehicles.find(v => v.includes(four[0]));
    }
    if (!vNum && ctx.activeVehicle && p.vehicles.includes(ctx.activeVehicle)) vNum = ctx.activeVehicle;

    if (!val) {
      ctx.activeParty = p;
      return R(`<b>${esc(p.name)}</b> के लिए, कितने रुपये का उधार दर्ज करना है?`);
    }

    ctx.activeParty = p;
    if (vNum) ctx.activeVehicle = vNum;

    ctx.pendingAction = { type: 'UDHAR', party: p, amount: val, vehicle: vNum, date: T() };
    
    let html = `<b>उधार एंट्री</b><br>पार्टी: ${esc(p.name)}<br>${vNum ? 'गाड़ी: '+vNum+'<br>' : ''}रकम: <b>${money(val)}</b><br><br>क्या दर्ज करूँ?`;
    
    return R(html, {
      say: speechify(`${p.name} ${vNum ? 'की गाड़ी ' + vNum : ''} का ${val} रुपये उधार दर्ज करना है। क्या दर्ज करूँ?`),
      chips: [{ label: '✅ हाँ', onClick: () => commitAction(ui) }, { label: '❌ रद्द', onClick: () => { ctx.pendingAction = null; ui.bot(R('रद्द किया।')); } }]
    });
  }

  // Commit Action
  async function commitAction(ui) {
    const act = ctx.pendingAction;
    if (!act) return;
    ctx.pendingAction = null;

    try {
      if (act.type === 'METER') {
        await db().collection('days').doc(act.date).set({ [`nz.${act.key}.c`]: act.value }, { merge: true });
        ui.bot(R(`✅ नोज़ल ${act.key.toUpperCase()} की रीडिंग <b>${act.value}</b> सेव हो गई।`));
      } 
      else if (act.type === 'DAILY') {
        const update = {};
        if (act.field === 'kharcha') {
           // To handle Kharcha properly, we push to kharchaItems and recalc
           const dRef = db().collection('days').doc(act.date);
           const dSnap = await dRef.get();
           let items = (dSnap.exists && dSnap.data().kharchaItems) ? dSnap.data().kharchaItems : [];
           items.push({ label: act.desc, amount: act.value });
           await dRef.set({ kharchaItems: items }, { merge: true });
           if(APP.recalc) APP.recalc();
        } else {
           await db().collection('days').doc(act.date).set({ [act.field]: act.value }, { merge: true });
        }
        ui.bot(R(`✅ ${act.field} की एंट्री सेव हो गई।`));
      } 
      else if (act.type === 'UDHAR') {
        const b = db().batch();
        const ref = db().collection('ledger').doc();
        b.set(ref, {
          partyId: act.party.id, partyName: act.party.name, date: act.date, time: APP.nowTime ? APP.nowTime() : '12:00',
          kind: 'udhar', amount: act.amount, vehicle: act.vehicle, fuel: '', rate: 0, litre: 0, note: 'Assistant entry',
          by: S.user ? S.user.email : 'assistant', at: APP.FV.serverTimestamp()
        });
        b.update(db().collection('parties').doc(act.party.id), { bal: APP.FV.increment(act.amount) });
        await b.commit();
        S.parties.pub = null;
        ui.bot(R(`✅ <b>${esc(act.party.name)}</b> का ₹${act.amount} उधार दर्ज हो गया।`));
      }
    } catch (e) {
      ui.bot(R(`❌ एंट्री सेव नहीं हो पाई: ${esc(e.message)}`));
    }
  }

  // ======================================================================
  // 6. UI & ROUTING
  // ======================================================================
  function R(html, o) { return Object.assign({ html }, o || {}); }

  async function processInput(text, ui) {
    const q = norm(text);
    
    // 1. Pending Action handling (Yes/No)
    if (ctx.pendingAction) {
      if (/haan|yes|ha|ok|theek/i.test(q)) return commitAction(ui);
      if (/nahi|no|cancel|radd/i.test(q)) { ctx.pendingAction = null; return R('रद्द कर दिया।'); }
    }

    // 2. Main Handler
    return await handleQuery(text, ui);
  }

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
            <button id="a-voice" style="background:none;border:none;font-size:19px;cursor:pointer;">🗣️</button>
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
    $('#a-voice').onclick = () => { const v = Voice.nextVoice(); if(v) toast('Voice changed'); };
    $('#a-tts').textContent = MEM.tts ? '🔊' : '🔇';

    async function processInput(text) {
      if (!text || !text.trim() || busy) return;
      busy = true; chipBox.innerHTML = ''; Voice.stop();
      bubble(esc(text), true); input.value = '';
      const load = bubble('<span style="color:#666;font-size:12px">⚡ सोच रही हूँ...</span>');
      try { const r = await processInputLogic(text, ui); load.remove(); if (r) ui.bot(r); }
      catch (e) { load.remove(); ui.bot(R('❌ माफ़ कीजिए, गड़बड़ हो गई: ' + esc(e.message))); }
      finally { busy = false; }
    }
    
    const processInputLogic = async (text, ui) => await processInput(text, ui); // Call core logic

    $('#a-send').onclick = () => processInput(input.value);
    input.onkeypress = e => { if (e.key === 'Enter') processInput(input.value); };

    function listen() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में आवाज़ सपोर्ट नहीं है');
      if (busy || Voice.isBusy()) return;
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

  console.log('[Mazda assistant.js v4] Ultimate God-Tier Loaded ✓');
})();
