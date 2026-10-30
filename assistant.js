/* Mazda Oil Company - Over-Smart Cognitive Assistant (No AI, TTS Fixed, Multi-Intent) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  // ==========================================
  // 1. DICTIONARIES & BRAIN SETUP
  // ==========================================
  const INTENTS = {
    LEDGER: ["ledger", "khata", "hisaab", "hisab", "खाता", "लेजर", "kholo", "dikhao", "statement"],
    BALANCE: ["udhar", "baaki", "balance", "उधार", "बकाया", "pending", "lena", "dena", "bakiya"],
    SALE_TODAY: ["aaj ki sale", "aaj ki bikri", "today sale", "आज की सेल", "आज की बिक्री", "aaj ka business"],
    SALE_YESTERDAY: ["kal ki sale", "yesterday sale", "कल की सेल", "कल की बिक्री"],
    STOCK_PETROL: ["petrol stock", "petrol kitna", "पेट्रोल स्टॉक", "पेट्रोल"],
    STOCK_DIESEL: ["diesel stock", "diesel kitna", "डीजल स्टॉक", "डीजल"],
    PEAK_SEASON: ["peak season", "पीक सीजन", "season", "सीजन"],
    SEND_WA: ["whatsapp", "message bhejo", "व्हाट्सएप", "भेजो", "send", "reminder"],
    VEHICLES: ["gaadi", "गाड़ी", "vehicles", "gadiyan"]
  };

  const STOP_WORDS = ['ka','ki','ke','kholo','dikhao','ledger','khata','hisaab','hisab','udhar','baaki','kitna','hai','kaun','kab','se','kam','jyada','sabse','gaadi','nayi','add','hui','kya','ko','diya','tha','driver','cash','sale','aaj','kal','din','dinon','2000','litre','diesel','petrol','kitni','thi','wala','wali','karta','karti','karte','h','ho','raha','rahi','par','mein','me','batao','bata','dijiye','do','de','dena','total','koi','sab','sare','sari','mahine','month','season','peak','payment','late','deri','bikri','bika','biki','kis','konsa','konsi','a','an','the','is','of','to','in','ji','bhai','sahab','aur','and','तथा','और'];

  // Phonetic Normalization (Soundex jaisa)
  function getPhonetic(str) {
    return cleanText(str)
      .replace(/[कखगघ]/g, "k").replace(/[चछजझ]/g, "j").replace(/[तथदधटठडढ]/g, "t")
      .replace(/[पफबभ]/g, "p").replace(/[शषस]/g, "s")
      .replace(/[aeiouy]/g, "").replace(/c|q/g, "k").replace(/sh|ss/g, "s")
      .replace(/ph/g, "f").replace(/v/g, "w").replace(/(.)\1+/g, "$1");
  }

  function cleanText(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Relative Date Parser
  function parseDateRange(q) {
    if (/kal|yesterday|कल/i.test(q)) return { date: APP.shiftDate(today(), -1), label: "कल" };
    if (/parso|परसों/i.test(q)) return { date: APP.shiftDate(today(), -2), label: "परसों" };
    return { date: today(), label: "आज" };
  }

  // ==========================================
  // 2. UI & TTS ENGINE
  // ==========================================
  let isTTSEnabled = true;

  function injectFAB() {
    if (document.getElementById('ai-assist-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-assist-fab';
    fab.innerHTML = '🎤';
    fab.style.cssText = 'position:fixed;bottom:80px;right:16px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff;font-size:26px;border:2px solid #f4b41a;box-shadow:0 4px 15px rgba(11,61,145,0.4);z-index:9999;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;';
    fab.onclick = () => openAssistant();
    document.body.appendChild(fab);
  }
  window.addEventListener('load', () => setTimeout(injectFAB, 1500));

  function openAssistant() {
    if (document.getElementById('assist-modal')) return;

    const m = document.createElement('div');
    m.id = 'assist-modal';
    m.isLoading = false;
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.85);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    
    m.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:20px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.3s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#0b3d91;font-size:18px;display:flex;align-items:center;gap:8px;">
            🤖 माज़दा असिस्टेंट 
            <button id="assist-tts-toggle" style="background:none;border:none;font-size:18px;cursor:pointer;">🔊</button>
          </h3>
          <button id="assist-close" style="background:none;border:none;font-size:20px;cursor:pointer;">❌</button>
        </div>
        
        <div id="assist-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:12px;padding:12px;margin-bottom:12px;min-height:150px;max-height:40vh;font-size:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="background:#e8eefc;padding:8px 12px;border-radius:12px;align-self:flex-start;max-width:85%;">नमस्ते! आप गाड़ी नंबर (4488), पार्टी का नाम, या सीधा सवाल (Aaj ki sale) पूछ सकते हैं।</div>
        </div>

        <div id="assist-options" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:36px;"></div>

        <div style="display:flex;gap:8px;">
          <input type="text" id="assist-input" placeholder="यहाँ टाइप करें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px;">
          <button id="assist-mic" style="width:50px;height:50px;border-radius:50%;background:#f4b41a;border:none;font-size:22px;cursor:pointer;">🎤</button>
          <button id="assist-send" style="width:50px;height:50px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:20px;cursor:pointer;">➤</button>
        </div>
      </div>
      <style>
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .assist-btn { background:#fff;border:1px solid #0b3d91;border-radius:20px;padding:8px 14px;font-size:13px;color:#0b3d91;cursor:pointer;font-family:inherit;font-weight:600; box-shadow:0 2px 5px rgba(0,0,0,0.1); transition:0.2s; }
        .assist-btn:active { background:#e8eefc; }
      </style>
    `;
    document.body.appendChild(m);

    const chat = m.querySelector('#assist-chat');
    const input = m.querySelector('#assist-input');
    const micBtn = m.querySelector('#assist-mic');
    const sendBtn = m.querySelector('#assist-send');
    const optBox = m.querySelector('#assist-options');
    const ttsBtn = m.querySelector('#assist-tts-toggle');
    
    m.querySelector('#assist-close').onclick = () => { window.speechSynthesis.cancel(); m.remove(); };
    ttsBtn.onclick = () => {
      isTTSEnabled = !isTTSEnabled;
      ttsBtn.textContent = isTTSEnabled ? '🔊' : '🔇';
      if (!isTTSEnabled) window.speechSynthesis.cancel();
    };

    // 🔥 FIXED TTS ENGINE (Chunking to avoid 15s cutoff)
    const speak = (htmlText) => {
      if (!isTTSEnabled || !window.speechSynthesis) return;
      // HTML tags clean karo
      let rawText = htmlText.replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]*>?/gm, ' ').replace(/₹/g, ' रुपये ').replace(/[|•·]/g, ' ');
      
      // Sentences me todo
      const sentences = rawText.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
      window.speechSynthesis.cancel(); // Purana clear karo
      
      let voices = window.speechSynthesis.getVoices();
      let hindiVoice = voices.find(v => v.lang.includes('hi')) || voices.find(v => v.lang.includes('IN')) || voices[0];

      sentences.forEach((sentence) => {
        const utt = new SpeechSynthesisUtterance(sentence);
        utt.lang = 'hi-IN';
        utt.rate = 1.0;
        if (hindiVoice) utt.voice = hindiVoice;
        window.speechSynthesis.speak(utt);
      });
    };

    const streamReplyToUI = async (txt, isUser) => {
      const div = document.createElement('div');
      div.style.cssText = `padding:10px 14px;border-radius:12px;max-width:85%;line-height:1.4;${isUser ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;' : 'background:#fff;border:1px solid #e6ebf5;align-self:flex-start;color:#333;border-bottom-left-radius:4px;'}`;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      
      if (isUser) {
        div.innerHTML = txt;
        return;
      }

      // Typewriter effect for Bot
      const words = txt.split(' ');
      for (let i = 0; i < words.length; i++) {
        div.innerHTML += words[i] + ' ';
        chat.scrollTop = chat.scrollHeight;
        await new Promise(r => setTimeout(r, 20)); // NLG effect
      }
      speak(txt);
    };

    const showOptions = (opts) => {
      optBox.innerHTML = '';
      if (!opts || !opts.length) return;
      opts.forEach(o => {
        const b = document.createElement('button');
        b.className = 'assist-btn';
        b.textContent = o.label;
        b.onclick = () => { o.onClick(); };
        optBox.appendChild(b);
      });
    };

    const processInput = async (text) => {
      if (!text || !text.trim() || m.isLoading) return;
      m.isLoading = true;
      showOptions([]);
      
      await streamReplyToUI(esc(text), true);
      input.value = '';
      
      const load = document.createElement('div');
      load.innerHTML = '⚡ सोच रहा हूँ...';
      load.style.cssText = 'background:#f0f0f0;padding:8px 12px;border-radius:12px;align-self:flex-start;color:#666;font-size:12px;';
      chat.appendChild(load);
      chat.scrollTop = chat.scrollHeight;

      try {
        const reply = await handleQuery(text.toLowerCase(), streamReplyToUI, showOptions, processInput);
        load.remove();
        if (reply) await streamReplyToUI(reply, false);
      } catch (e) {
        load.remove();
        await streamReplyToUI('❌ माफ़ कीजिये, गड़बड़ हो गई: ' + e.message, false);
      } finally {
        m.isLoading = false;
      }
    };

    sendBtn.onclick = () => processInput(input.value);
    input.onkeypress = (e) => { if (e.key === 'Enter') processInput(input.value); };

    micBtn.onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में आवाज़ सपोर्ट नहीं है');
      const rec = new SR();
      rec.lang = 'hi-IN';
      
      micBtn.style.background = '#c62828'; micBtn.style.color = '#fff'; input.placeholder = 'सुन रहा हूँ...';
      
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        input.value = text;
        processInput(text);
      };
      rec.onerror = () => { micBtn.style.background = '#f4b41a'; micBtn.style.color = '#000'; input.placeholder = 'यहाँ टाइप करें...'; };
      rec.onend = () => { micBtn.style.background = '#f4b41a'; micBtn.style.color = '#000'; input.placeholder = 'यहाँ टाइप करें...'; };
      try { rec.start(); } catch(e) {}
    };
  }

  // ==========================================
  // 3. CORE BRAIN (Multi-Intent & Logic)
  // ==========================================
  async function handleQuery(q, addMsg, showOptions, processInput) {
    const cq = cleanText(q);
    
    // 1. Multi-Intent Splitting (Split by "aur", "and", etc.)
    const parts = q.split(/\s+(?:aur|and|तथा|और|\+)\s+/i);
    if (parts.length > 1) {
      let finalReply = "";
      for (let i = 0; i < parts.length; i++) {
        const subAns = await processSingleQuery(parts[i], addMsg, showOptions, processInput);
        if (subAns) finalReply += `<b>${i+1}.</b> ${subAns}<br><br>`;
      }
      return finalReply;
    }

    // 2. Single Intent
    return await processSingleQuery(q, addMsg, showOptions, processInput);
  }

  async function processSingleQuery(q, addMsg, showOptions, processInput) {
    const cq = cleanText(q);
    
    // Check Learned Dictionary
    const learned = checkLearnedWords(cq);
    if (learned) {
      const p = (S.parties.pub || []).find(x => x.name === learned);
      if (p) return showPartyMenu(p, addMsg, showOptions);
    }

    // Entity Extraction (Vehicle / Party)
    let searchNum = null;
    const numMatch = q.match(/\b\d{4}\b/);
    if (numMatch) searchNum = numMatch[0];
    const fullMatch = q.match(/uk\s*\d{2}\s*[a-z]{1,2}\s*\d{4}/i);
    if (fullMatch) searchNum = fullMatch[0].replace(/\s+/g, '').toUpperCase();

    const parties = S.parties && S.parties.pub ? S.parties.pub : await APP.getParties(false, true);
    let targetParties = [];

    if (searchNum) {
      targetParties = parties.filter(p => p.vehicles && p.vehicles.some(v => v.toUpperCase().replace(/\s+/g, '').includes(searchNum)));
    } else {
      // Phonetic & Fuzzy matching
      const words = cq.split(' ');
      const nameWords = words.filter(w => w.length >= 2 && !STOP_WORDS.includes(w) && !/^\d+$/.test(w));
      
      if (nameWords.length > 0) {
        let matches = [];
        parties.forEach(p => {
          let score = 0;
          const pName = cleanText(p.name);
          nameWords.forEach(nw => {
            if (pName.includes(nw) || getPhonetic(pName).includes(getPhonetic(nw))) score += nw.length;
          });
          if (score > 0) matches.push({ p, score });
        });
        if (matches.length > 0) {
          matches.sort((a, b) => b.score - a.score);
          targetParties = matches.map(m => m.p);
        }
      }
    }

    // ---- IF PARTY FOUND ----
    if (targetParties.length > 0) {
      if (targetParties.length === 1) {
        const p = targetParties[0];
        // Direct Ledger Open
        if (q.includes('ledger') || q.includes('khata') || q.includes('खाता')) {
          setTimeout(() => { document.getElementById('assist-modal').remove(); APP.partyView(p.id, false); }, 1200);
          return `⏳ <b>${esc(p.name)}</b> का खाता खोल रहा हूँ...`;
        }
        // WhatsApp Action
        if (q.includes('whatsapp') || q.includes('message') || q.includes('bhejo')) {
          return sendWhatsApp(p, addMsg, showOptions);
        }
        // Otherwise show Menu
        showPartyMenu(p, addMsg, showOptions);
        return null; // Menu handles the UI
      } 
      
      // Multiple parties found (Disambiguation)
      const opts = targetParties.slice(0, 3).map(p => ({
        label: `${p.name} (${p.vehicles && p.vehicles[0] ? p.vehicles[0] : 'कोई गाड़ी नहीं'})`,
        onClick: () => { 
          saveLearnedWord(cq, p.name);
          if (q.includes('ledger') || q.includes('khata')) {
            document.getElementById('assist-modal').remove(); APP.partyView(p.id, false);
          } else {
            showPartyMenu(p, addMsg, showOptions); showOptions([]);
          }
        }
      }));
      opts.push({ label: '❌ कोई और पार्टी', onClick: () => { addMsg('कृपया पूरा नाम या गाड़ी नंबर टाइप करें:', false); } });
      
      addMsg(searchNum ? `नंबर <b>${searchNum}</b> पर कई पार्टियां मिलीं:` : 'आप किस पार्टी की बात कर रहे हैं?', false);
      showOptions(opts);
      return null;
    }

    // ---- IF NO PARTY, CHECK INTENTS ----
    let detectedIntent = null;
    for (const [intent, keywords] of Object.entries(INTENTS)) {
      if (keywords.some(kw => cq.includes(cleanText(kw)))) { detectedIntent = intent; break; }
    }

    if (detectedIntent === 'SALE_TODAY' || detectedIntent === 'SALE_YESTERDAY') {
      const dateObj = detectedIntent === 'SALE_YESTERDAY' ? parseDateRange('kal') : parseDateRange('aaj');
      return await getSaleAnswer(dateObj.date, dateObj.label, addMsg, showOptions);
    }

    if (detectedIntent === 'STOCK_DIESEL') return await getStockAnswer('diesel');
    if (detectedIntent === 'STOCK_PETROL') return await getStockAnswer('petrol');
    if (detectedIntent === 'BALANCE') return await getTotalUdhar();
    if (detectedIntent === 'PEAK_SEASON') return await getPeakSeason();

    // ---- SMART PIVOT (External Questions) ----
    return await handleSmartPivot(q, addMsg, showOptions, processInput);
  }

  // ==========================================
  // 4. ACTION & FORMATTING FUNCTIONS
  // ==========================================
  
  // 📊 SMART SALE ANSWER (Direct + Insight + Action)
  async function getSaleAnswer(dateStr, label, addMsg, showOptions) {
    const ds = await db().collection('days').doc(dateStr).get();
    if (!ds.exists) return `${label} (${dmy(dateStr)}) का हिसाब अभी शुरू नहीं हुआ है।`;
    
    const sum = ds.data().sum || {};
    const sale = num(sum.sale);
    const litP = num(sum.litP), litD = num(sum.litD);
    
    // Insight context
    let insight = "";
    if (label === "आज") {
       const yDate = APP.shiftDate(today(), -1);
       const yDs = await db().collection('days').doc(yDate).get();
       if (yDs.exists) {
         const ySale = num((yDs.data().sum || {}).sale);
         if (ySale > 0) {
           const diff = sale - ySale;
           const pct = Math.round((diff / ySale) * 100);
           insight = diff >= 0 ? `📈 कल के मुकाबले <b>${pct}% ज्यादा</b> है।` : `📉 कल के मुकाबले <b>${Math.abs(pct)}% कम</b> है।`;
         }
       }
    }

    showOptions([
      { label: '🖨️ रिपोर्ट', onClick: () => { document.getElementById('assist-modal').remove(); APP.shareCompactDayReport({date: dateStr, d: ds.data(), rows: []}); } },
      { label: '📊 कल की सेल', onClick: () => addMsg(await getSaleAnswer(APP.shiftDate(today(), -1), 'कल', addMsg, showOptions), false) }
    ]);

    return `<b>${label} की कुल बिक्री: ${money(sale)}</b><br><br>⛽ पेट्रोल: ${lit(litP)}<br>🛢️ डीज़ल: ${lit(litD)}<br><br>${insight}`;
  }

  // ⛽ SMART STOCK ANSWER
  async function getStockAnswer(type) {
    const snap = await db().collection('days').orderBy('date', 'desc').limit(1).get();
    if (snap.empty) return 'डेटा नहीं मिला।';
    const d = snap.docs[0].data();
    const s = d.sum || {};
    const isP = type === 'petrol';
    const stock = isP ? (s.actStockP !== undefined ? s.actStockP : (s.expStockP || 0)) : (s.actStockD !== undefined ? s.actStockD : (s.expStockD || 0));
    
    // Insight
    let insight = stock < 1500 ? "⚠️ स्टॉक खत्म होने वाला है, टैंकर मंगवा लें!" : "✅ स्टॉक पर्याप्त है।";
    return `<b>${isP?'पेट्रोल':'डीज़ल'} का वर्तमान स्टॉक: ${lit(stock)}</b><br><br>${insight}`;
  }

  // 💰 SMART UDHAR ANSWER
  async function getTotalUdhar() {
    const ps = await APP.getParties(false, true);
    const due = ps.filter(p => num(p.bal) > 0).sort((a, b) => num(b.bal) - num(a.bal));
    const tot = due.reduce((a, p) => a + num(p.bal), 0);
    if (!due.length) return '🎉 किसी पार्टी पर कोई उधार बाकी नहीं है!';
    return `<b>कुल बाजार उधार: ${money(tot)}</b><br><br>सबसे ज्यादा उधार वाली पार्टी: <br>1. ${esc(due[0].name)} (${money(due[0].bal)})`;
  }

  // 🔮 SEASON PREDICTION
  async function getPeakSeason() {
    const snap = await db().collection('days').get();
    if (snap.empty) return 'डेटा कम है।';
    const months = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.sum || !data.sum.sale) return;
      const m = data.date.slice(0, 7);
      months[m] = (months[m] || 0) + num(data.sum.sale);
    });
    const sorted = Object.keys(months).sort((a,b) => months[b] - months[a]);
    const bestMonth = sorted[0];
    const mName = new Date(bestMonth + '-01T12:00:00').toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
    return `<b>आपका पीक सीज़न: ${mName}</b><br><br>इस महीने में सबसे ज्यादा बिक्री (${money(months[bestMonth])}) देखी गई है।`;
  }

  // ==========================================
  // 5. UI MENUS & ACTIONS
  // ==========================================
  
  function showPartyMenu(p, addMsg, showOptions) {
    const vehList = p.vehicles && p.vehicles.length ? p.vehicles.join(', ') : 'कोई गाड़ी नहीं';
    addMsg(`पार्टी: <b>${esc(p.name)}</b><br>गाड़ियां: ${esc(vehList)}<br>बकाया: <b class="neg">${money(p.bal)}</b><br><br>आप क्या करना चाहेंगे?`, false);
    
    // Dynamic Chips based on context
    showOptions([
      { label: '📒 खाता खोलें', onClick: () => { document.getElementById('assist-modal').remove(); APP.partyView(p.id, false); } },
      { label: '💬 WhatsApp', onClick: () => sendWhatsApp(p, addMsg, showOptions) },
      { label: '🚗 गाड़ियां', onClick: () => { addMsg(`गाड़ियां: ${esc(vehList)}`, false); showOptions([]); } }
    ]);
  }

  function sendWhatsApp(p, addMsg, showOptions) {
    const ph = String(p.phone || '').replace(/\D/g, '');
    const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
    if (!wa) { addMsg('इस पार्टी का फोन नंबर नहीं है।', false); showOptions([]); return; }
    const msg = `नमस्ते ${p.name} जी, आपका माज़दा ऑयल कंपनी पर बकाया ₹${p.bal} है। कृपया भुगतान करें। - धन्यवाद!`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
    addMsg('✅ WhatsApp खोल दिया गया है...', false);
    showOptions([]);
  }

  // ==========================================
  // 6. SMART PIVOT (Roasting & External)
  // ==========================================
  async function handleSmartPivot(q, addMsg, showOptions, processInput) {
    const cq = cleanText(q);
    
    // Live data for pivot
    const ds = await db().collection('days').doc(today()).get();
    const sum = ds.exists ? (ds.data().sum || {}) : {};
    const todaySale = money(sum.sale || 0);

    if (/mausam|barish|dhup|thand|weather|मौसम|बारिश|ठंड|धूप|कोहरा/i.test(cq)) {
      return `मौसम का हाल तो बादल जानें, पर अगर बारिश हुई तो सेल गिरेगी; अभी तक <b>${todaySale}</b> की सेल हो चुकी है!`;
    }
    if (/match|cricket|kohli|ipl|खेल|मैच|क्रिकेट/i.test(cq)) {
      return `मैच का स्कोर तो टीवी बताएगा, लेकिन आज हमारे पंप ने <b>${todaySale}</b> का स्कोर बनाकर मैच जीत लिया है!`;
    }
    if (/chunav|party|sarkar|election|चुनाव|सरकार/i.test(cq)) {
      return `पार्टियों की जीत-हार जनता तय करेगी, पर अपने गल्ले में आज 'कैश पार्टी' आगे है—कुल सेल <b>${todaySale}</b>!`;
    }
    if (/joke|lottery|time|जोक|लॉटरी|समय|तारीख/i.test(cq)) {
      return `समय तो बदलता रहता है, पर पंप पर हर 10 मिनट में नई सेल आ रही है। आज का कलेक्शन <b>${todaySale}</b> है!`;
    }

    // Fallback
    addMsg('माफ़ कीजिये, मैं यह प्रश्न नहीं समझ पाया। आप नीचे दिए गए बटन दबाकर देख सकते हैं:', false);
    showOptions([
      { label: 'Aaj ki sale', onClick: () => processInput('aaj ki sale') },
      { label: 'Kul udhar', onClick: () => processInput('kul udhar') },
      { label: 'Diesel stock', onClick: () => processInput('diesel stock') }
    ]);
    return null;
  }

  // ==========================================
  // 7. SELF-LEARNING ALIAS (LocalStorage)
  // ==========================================
  function saveLearnedWord(input, mappedName) {
    try {
      let dict = JSON.parse(localStorage.getItem('mazda_learned_words') || '{}');
      const words = cleanText(input).split(' ').filter(w => !STOP_WORDS.includes(w) && w.length > 2);
      if (words.length) {
        dict[words[0]] = mappedName; // Save first major word as alias
        localStorage.setItem('mazda_learned_words', JSON.stringify(dict));
      }
    } catch(e) {}
  }

  function checkLearnedWords(q) {
    try {
      let dict = JSON.parse(localStorage.getItem('mazda_learned_words') || '{}');
      for (let key in dict) {
        if (cleanText(q).includes(key)) return dict[key];
      }
    } catch(e) {}
    return null;
  }

  console.log('[Mazda assistant.js] OVER-SMART Brain (Chunked TTS, Multi-Intent, Pivot) ✓');
})();
