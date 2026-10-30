/* Mazda Oil Company - Ultimate Master Assistant (Local, Voice, Smart Pivot) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  // ==========================================
  // 1. MASTER INTENTS (काम की पहचान)
  // ==========================================
  const INTENTS = {
    // 1. उधार और खाता
    LEDGER: ["ledger", "khata", "hisaab", "hisab", "खाता", "लेजर", "kholo", "dikhao", "statement"],
    BALANCE: ["udhar", "baaki", "balance", "उधार", "बकाया", "pending", "lena", "dena", "bakiya"],
    ADVANCE: ["advance", "jama", "पेशगी", "जमा"],
    BLOCK: ["block", "hold", "रोक", "band"],
    
    // 2. सेल और कलेक्शन
    SALE_TODAY: ["aaj ki sale", "aaj ki bikri", "today sale", "आज की सेल", "आज की बिक्री", "aaj ka business"],
    SALE_YESTERDAY: ["kal ki sale", "yesterday sale", "कल की सेल", "कल की बिक्री"],
    SALE_MONTH: ["mahine ki sale", "month sale", "महीने की सेल", "monthly sale"],
    SALE_BEST: ["best sale", "sabse jyada sale", "record sale", "सबसे ज्यादा सेल", "सबसे ज्यादा बिक्री"],
    CASH_COLLECTION: ["galla", "cash", "कैश", "गल्ला", "collection"],
    
    // 3. स्टॉक
    STOCK_PETROL: ["petrol stock", "petrol kitna", "पेट्रोल स्टॉक", "पेट्रोल"],
    STOCK_DIESEL: ["diesel stock", "diesel kitna", "डीजल स्टॉक", "डीजल"],
    STOCK_DAYS: ["kitne din chalega", "stock days", "कितने दिन चलेगा", "stock khatam"],
    LOW_DIESEL: ["kam diesel", "diesel kam", "कम डीजल"],
    
    // 4. पार्टी और गाड़ी
    VEHICLES: ["gaadi", "गाड़ी", "vehicles", "gadiyan"],
    DRIVER_CASH: ["driver", "ड्राइवर", "driver cash"],
    
    // 5. एक्शन (WhatsApp)
    SEND_WA: ["whatsapp", "message bhejo", "व्हाट्सएप", "भेजो", "send"],
    
    // 6. एनालिटिक्स
    PEAK_SEASON: ["peak season", "पीक सीजन", "season", "सीजन"],
    TOP_UDHAR: ["sabse jyada udhar", "top udhar", "सबसे ज्यादा उधार"],
    LATE_PAYMENT: ["late payment", "deri", "देरी", "payment late"]
  };

  // बाहरी दुनिया (Smart Pivot के लिए)
  const EXTERNAL_TOPICS = {
    WEATHER: ["mausam", "barish", "dhup", "thand", "garmi", "weather", "मौसम", "बारिश", "ठंड", "धूप", "कोहरा"],
    SPORTS: ["match", "cricket", "kohli", "ipl", "खेल", "मैच", "क्रिकेट"],
    POLITICS: ["chunav", "party", "sarkar", "election", "चुनाव", "सरकार", "हड़ताल"],
    TECH: ["share market", "sone ka rate", "dollar", "internet", "शेयर", "सोना", "डॉलर"],
    HEALTH: ["sar dard", "bhookh", "neend", "mood", "सिर दर्द", "भूख", "नींद"],
    RANDOM: ["joke", "lottery", "rashifal", "time", "जोक", "लॉटरी", "समय", "तारीख"]
  };

  // स्टॉप वर्ड्स (नाम ढूँढते समय ये शब्द हटा दिए जाएंगे)
  const STOP_WORDS = ['ka','ki','ke','kholo','dikhao','ledger','khata','hisaab','hisab','udhar','baaki','kitna','hai','kaun','kab','se','kam','jyada','sabse','gaadi','nayi','add','hui','kya','ko','diya','tha','driver','cash','sale','aaj','kal','din','dinon','2000','litre','diesel','petrol','kitni','thi','wala','wali','karta','karti','karte','h','ho','raha','rahi','par','mein','me','batao','bata','dijiye','do','de','dena','total','koi','sab','sare','sari','mahine','month','season','peak','payment','late','deri','bikri','bika','biki','kis','konsa','konsi','a','an','the','is','of','to','in','ji','bhai','sahab', 'whatsapp', 'message', 'bhejo', 'send', 'block', 'hold', 'rok', 'roko'];

  let isTTSEnabled = true; // आवाज़ चालू रहेगी

  // ==========================================
  // 2. UI SETUP
  // ==========================================
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
            <button id="assist-tts-toggle" style="background:none;border:none;font-size:18px;cursor:pointer;" title="आवाज़ चालू/बंद करें">🔊</button>
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
        .assist-btn { background:#fff;border:1px solid #0b3d91;border-radius:20px;padding:8px 14px;font-size:13px;color:#0b3d91;cursor:pointer;font-family:inherit;font-weight:600; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
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

    // --- बोलने का फंक्शन (TTS) ---
    const speak = (text) => {
      if (!isTTSEnabled || !window.speechSynthesis) return;
      // HTML टैग्स हटाएं ताकि साफ बोले
      const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/₹/g, ' रुपये ').replace(/[|•·]/g, ' ');
      const utt = new SpeechSynthesisUtterance(cleanText);
      utt.lang = 'hi-IN';
      utt.rate = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang.includes('IN') || v.lang.includes('hi'));
      if (hindiVoice) utt.voice = hindiVoice;

      window.speechSynthesis.cancel(); // पुरानी आवाज़ रोकें
      window.speechSynthesis.speak(utt);
    };

    const addMsg = (txt, isUser) => {
      const div = document.createElement('div');
      div.style.cssText = `padding:10px 14px;border-radius:12px;max-width:85%;line-height:1.4;${isUser ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;' : 'background:#fff;border:1px solid #e6ebf5;align-self:flex-start;color:#333;border-bottom-left-radius:4px;'}`;
      div.innerHTML = txt;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      
      if (!isUser) speak(txt); // जवाब आते ही बोलें
    };

    const showOptions = (opts) => {
      optBox.innerHTML = '';
      if (!opts || !opts.length) return;
      opts.forEach(o => {
        const b = document.createElement('button');
        b.className = 'assist-btn';
        b.textContent = o.label;
        b.onclick = o.onClick;
        optBox.appendChild(b);
      });
    };

    const processInput = async (text) => {
      if (!text || !text.trim() || m.isLoading) return;
      m.isLoading = true;
      showOptions([]);
      
      addMsg(esc(text), true);
      input.value = '';
      
      const load = document.createElement('div');
      load.innerHTML = '⏳ सोच रहा हूँ...';
      load.style.cssText = 'background:#f0f0f0;padding:8px 12px;border-radius:12px;align-self:flex-start;color:#666;font-size:12px;';
      chat.appendChild(load);
      chat.scrollTop = chat.scrollHeight;

      try {
        const reply = await handleQuery(text.toLowerCase(), addMsg, showOptions, processInput);
        load.remove();
        if (reply) addMsg(reply, false);
      } catch (e) {
        load.remove();
        addMsg('❌ माफ़ कीजिये, कोई गड़बड़ हो गई: ' + e.message, false);
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
  // 3. UTILITIES (Cleaning & Matching)
  // ==========================================
  function cleanText(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function fuzzyMatch(text, target) {
    const t = cleanText(text).replace(/(.)\1+/g, '$1');
    const g = cleanText(target).replace(/(.)\1+/g, '$1');
    return t.includes(g) || g.includes(t);
  }

  // ==========================================
  // 4. CORE BRAIN (Logic Engine)
  // ==========================================
  async function handleQuery(q, addMsg, showOptions, processInput) {
    const cq = cleanText(q);
    
    // 1. पहचानें कि क्या करना है (Intent)
    let detectedIntent = null;
    for (const [intent, keywords] of Object.entries(INTENTS)) {
      if (keywords.some(kw => cq.includes(cleanText(kw)))) {
        detectedIntent = intent;
        break;
      }
    }

    // 2. गाड़ी या पार्टी का नाम/नंबर ढूंढें (Entity)
    let searchNum = null;
    const numMatch = q.match(/\b\d{4}\b/); // 4488
    if (numMatch) searchNum = numMatch[0];
    const fullMatch = q.match(/uk\s*\d{2}\s*[a-z]{1,2}\s*\d{4}/i); // UK01...
    if (fullMatch) searchNum = fullMatch[0].replace(/\s+/g, '').toUpperCase();

    const parties = S.parties && S.parties.pub ? S.parties.pub : await APP.getParties(false, true);
    let targetParties = [];

    if (searchNum) {
      targetParties = parties.filter(p => p.vehicles && p.vehicles.some(v => v.toUpperCase().replace(/\s+/g, '').includes(searchNum)));
    } 
    
    if (targetParties.length === 0) {
      const words = cq.split(' ');
      const nameWords = words.filter(w => w.length >= 2 && !STOP_WORDS.includes(w) && !/^\d+$/.test(w));
      
      if (nameWords.length > 0) {
        let matches = [];
        parties.forEach(p => {
          let score = 0;
          const pName = cleanText(p.name);
          nameWords.forEach(nw => {
            if (fuzzyMatch(nw, pName)) score += nw.length;
          });
          if (score > 0) matches.push({ p, score });
        });
        if (matches.length > 0) {
          matches.sort((a, b) => b.score - a.score);
          targetParties = matches.map(m => m.p);
        }
      }
    }

    // ==========================================
    // 3. DECISION MATRIX (क्या जवाब देना है)
    // ==========================================

    // अगर पार्टी/गाड़ी मिल गई है
    if (targetParties.length > 0) {
      if (targetParties.length === 1) {
        const p = targetParties[0];
        
        // खाता खोलना है
        if (detectedIntent === 'LEDGER') {
          setTimeout(() => { document.getElementById('assist-modal').remove(); APP.partyView(p.id, false); }, 800);
          return `⏳ <b>${esc(p.name)}</b> का खाता खोल रहा हूँ...`;
        }
        
        // बैलेंस बताना है
        if (detectedIntent === 'BALANCE') {
          return `पार्टी <b>${esc(p.name)}</b> का कुल उधार: <b class="neg">${money(p.bal)}</b>`;
        }

        // गाड़ियां बतानी हैं
        if (detectedIntent === 'VEHICLES') {
          return `पार्टी <b>${esc(p.name)}</b> की गाड़ियां: <br> ${p.vehicles && p.vehicles.length ? p.vehicles.join(', ') : 'कोई गाड़ी नहीं'}`;
        }
        
        // WhatsApp भेजना है
        if (detectedIntent === 'SEND_WA') {
          const ph = String(p.phone || '').replace(/\D/g, '');
          const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
          if (!wa) return `पार्टी <b>${esc(p.name)}</b> का फोन नंबर नहीं है।`;
          const msg = `नमस्ते ${p.name} जी, आपका बकाया ₹${p.bal} है। कृपया भुगतान करें। - माज़दा ऑयल कंपनी`;
          setTimeout(() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank'), 500);
          return `✅ <b>${esc(p.name)}</b> को WhatsApp मैसेज भेजा जा रहा है...`;
        }

        // अगर कुछ और है (या कन्फ्यूजन है)
        showPartyMenu(p, addMsg, showOptions, processInput);
        return null;
      } 
      
      // अगर एक से ज्यादा पार्टी मिलीं (Disambiguation)
      const opts = targetParties.slice(0, 3).map(p => ({
        label: `${p.name} (${p.vehicles && p.vehicles[0] ? p.vehicles[0] : 'कोई गाड़ी नहीं'})`,
        onClick: () => { 
          if (detectedIntent === 'LEDGER') {
            document.getElementById('assist-modal').remove(); APP.partyView(p.id, false);
          } else {
            addMsg(`पार्टी <b>${esc(p.name)}</b> का कुल उधार: <b class="neg">${money(p.bal)}</b>`, false); showOptions([]);
          }
        }
      }));
      opts.push({ label: '❌ कोई और पार्टी', onClick: () => { addMsg('कृपया पार्टी का नाम या 4 अंकों का गाड़ी नंबर टाइप करें:', false); } });
      
      addMsg(searchNum ? `नंबर <b>${searchNum}</b> पर कई पार्टियां मिलीं, कौन सी चुननी है?` : 'एक से ज्यादा पार्टियां मिलीं:', false);
      showOptions(opts);
      return null;
    }

    // अगर पार्टी नहीं मिली, तो PUMP इंटेंट्स चेक करें
    if (detectedIntent) {
      const ans = await executePumpIntent(detectedIntent);
      if (ans) return ans;
    }

    // अगर बाहरी सवाल है (Smart Pivot)
    return await handleSmartPivot(q);
  }

  // ==========================================
  // 5. SMART PIVOT (बाहरी सवालों के मजेदार जवाब)
  // ==========================================
  async function handleSmartPivot(q) {
    const cq = cleanText(q);
    
    // लाइव डेटा उठाएं
    const ps = await APP.getParties(false, true);
    const totUdhar = ps.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);
    const ds = await db().collection('days').doc(today()).get();
    const sum = ds.exists ? (ds.data().sum || {}) : {};
    const todaySale = money(sum.sale || 0);

    let isWeather = EXTERNAL_TOPICS.WEATHER.some(k => cq.includes(cleanText(k)));
    let isSports = EXTERNAL_TOPICS.SPORTS.some(k => cq.includes(cleanText(k)));
    let isPolitics = EXTERNAL_TOPICS.POLITICS.some(k => cq.includes(cleanText(k)));
    let isTech = EXTERNAL_TOPICS.TECH.some(k => cq.includes(cleanText(k)));
    let isHealth = EXTERNAL_TOPICS.HEALTH.some(k => cq.includes(cleanText(k)));
    let isRandom = EXTERNAL_TOPICS.RANDOM.some(k => cq.includes(cleanText(k)));

    if (isWeather) {
      const pivots = [
        `मौसम का हाल तो बादल जानें, पर अगर बारिश हुई तो सेल गिरेगी; आज अभी तक <b>${todaySale}</b> की सेल हो चुकी है!`,
        `धूप का तो पता नहीं, पर पंप पर नोज़ल लगातार गर्म हैं—आज का कुल कलेक्शन <b>${todaySale}</b> है।`,
        `तापमान का मीटर तो नहीं देखा, लेकिन मार्केट में कुल <b>₹${totUdhar}</b> का उधार फंसा है, वो जरूर याद रखें!`
      ];
      return pivots[Math.floor(Math.random() * pivots.length)];
    }

    if (isSports) {
      const pivots = [
        `मैच का स्कोर तो टीवी बताएगा, लेकिन आज हमारे पंप ने <b>${todaySale}</b> का स्कोर बनाकर मैच जीत लिया है!`,
        `कोहली का शतक तो नहीं देखा, पर आज पंप पर गाड़ियों की लंबी लाइन जरूर लगी है। कुल सेल <b>${todaySale}</b>!`
      ];
      return pivots[Math.floor(Math.random() * pivots.length)];
    }

    if (isPolitics) {
      return `पार्टियों की जीत-हार जनता तय करेगी, पर अपने गल्ले में आज 'कैश पार्टी' आगे है—कुल सेल <b>${todaySale}</b>!`;
    }

    if (isTech) {
      return `सेंसेक्स का तो नहीं पता, पर अपने पंप का ग्राफ आज ग्रीन में है—आज की सेल <b>${todaySale}</b> है।`;
    }

    if (isHealth) {
      return `सेहत का ख्याल रखें भाई! तनाव मत लीजिए, क्योंकि आज का गल्ला <b>${todaySale}</b> बिल्कुल सही चल रहा है।`;
    }

    if (isRandom) {
      return `बोरियत का समय किसे है? जब हर 10 मिनट में नई सेल आ रही है—आज का कलेक्शन <b>${todaySale}</b> पार हो चुका है!`;
    }

    // अगर कुछ समझ न आए
    addMsg('माफ़ कीजिये, मैं यह प्रश्न नहीं समझ पाया। आप नीचे दिए गए बटन दबाकर देख सकते हैं:', false);
    showOptions([
      { label: 'Aaj ki sale', onClick: () => processInput('aaj ki sale') },
      { label: 'Kul udhar', onClick: () => processInput('kul udhar') },
      { label: 'Peak season', onClick: () => processInput('peak season') }
    ]);
    return null;
  }

  // ==========================================
  // 6. PUMP INTENTS EXECUTION
  // ==========================================
  async function executePumpIntent(intent) {
    if (intent === 'SALE_TODAY') {
      const ds = await db().collection('days').doc(today()).get();
      if (!ds.exists) return 'आज का हिसाब अभी शुरू नहीं हुआ है।';
      const sum = ds.data().sum || {};
      return `आज की कुल बिक्री: <b class="pos">${money(sum.sale)}</b><br>पेट्रोल: ${lit(sum.litP)}<br>डीज़ल: ${lit(sum.litD)}`;
    }

    if (intent === 'SALE_YESTERDAY') {
      const yDate = APP.shiftDate(today(), -1);
      const ds = await db().collection('days').doc(yDate).get();
      if (!ds.exists) return `कल (${dmy(yDate)}) का हिसाब नहीं मिला।`;
      const sum = ds.data().sum || {};
      return `कल की कुल बिक्री (${dmy(yDate)}): <b class="pos">${money(sum.sale)}</b>`;
    }

    if (intent === 'BALANCE' || intent === 'TOP_UDHAR') {
      const ps = await APP.getParties(false, true);
      const due = ps.filter(p => num(p.bal) > 0).sort((a, b) => num(b.bal) - num(a.bal));
      const tot = due.reduce((a, p) => a + num(p.bal), 0);
      if (intent === 'TOP_UDHAR') {
        return 'सबसे ज्यादा उधार वाली टॉप 3 पार्टियां:<br>' + due.slice(0, 3).map(p => `• <b>${esc(p.name)}</b>: ${money(p.bal)}`).join('<br>');
      }
      return `कुल मिलाकर सभी पार्टियों का बकाया: <b class="neg">${money(tot)}</b>`;
    }

    if (intent === 'STOCK_PETROL') {
      const snap = await db().collection('days').orderBy('date', 'desc').limit(1).get();
      if (snap.empty) return 'डेटा नहीं मिला।';
      const d = snap.docs[0].data();
      const s = d.sum || {};
      const pStock = s.actStockP !== undefined ? s.actStockP : (s.expStockP || 0);
      return `आज का पेट्रोल स्टॉक (${dmy(d.date)}): <b class="pos">${lit(pStock)}</b>`;
    }

    if (intent === 'PEAK_SEASON') {
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
      if (sorted.length < 2) return 'डेटा कम है, पीक सीजन का अंदाजा नहीं लगा सकते।';
      const bestMonth = sorted[0];
      const mName = new Date(bestMonth + '-01T12:00:00').toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
      return `सबसे ज्यादा बिक्री <b>${mName}</b> में देखी गई है। यही आपका पीक सीजन हो सकता है।`;
    }

    return null; // अगर कोई लॉजिक मैच न हुआ
  }

  // ==========================================
  // 7. Party Menu (Confirmation)
  // ==========================================
  function showPartyMenu(p, addMsg, showOptions, processInput) {
    const vehList = p.vehicles && p.vehicles.length ? p.vehicles.join(', ') : 'कोई गाड़ी नहीं';
    addMsg(`पार्टी: <b>${esc(p.name)}</b><br>गाड़ियां: ${esc(vehList)}<br>बकाया: <b class="neg">${money(p.bal)}</b><br><br>आप क्या करना चाहेंगे?`, false);
    
    showOptions([
      { label: '📒 खाता (Ledger) खोलें', onClick: () => { document.getElementById('assist-modal').remove(); APP.partyView(p.id, false); } },
      { label: '🚗 गाड़ियां देखें', onClick: () => { addMsg(`गाड़ियां: ${esc(vehList)}`, false); showOptions([]); } },
      { label: '💰 उधार बताएं', onClick: () => { addMsg(`पार्टी <b>${esc(p.name)}</b> का कुल उधार: <b class="neg">${money(p.bal)}</b>`, false); showOptions([]); } },
      { label: '💬 WhatsApp भेजें', onClick: () => { 
          const ph = String(p.phone || '').replace(/\D/g, '');
          const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
          if (!wa) { addMsg('इस पार्टी का फोन नंबर नहीं है।', false); showOptions([]); return; }
          const msg = `नमस्ते ${p.name} जी, आपका माज़दा ऑयल कंपनी पर बकाया ₹${p.bal} है। कृपया भुगतान करें।`;
          window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
          addMsg('WhatsApp खोल दिया गया है ✔', false); showOptions([]); 
        } 
      }
    ]);
  }

  console.log('[Mazda assistant.js] Ultimate Master Brain + Voice + Smart Pivot ✓');
})();
