/* Mazda Oil Company - Smart Local Assistant (No AI, Self-Learning, Vehicle/Party Match) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  // ==========================================
  // 1. TRAINED INTENTS (PUMP_INTENTS)
  // ==========================================
  const PUMP_INTENTS = {
    TODAY_SALE: { keywords: ["aaj ki sale", "aaj ki bikri", "today sale", "aaj kitna bika", "आज की सेल", "आज की बिक्री"], action: "getTodaySale" },
    TOTAL_UDHAR: { keywords: ["kul udhar", "total udhar", "कुल उधार", "कुल बकाया"], action: "getTotalUdhar" },
    LOW_DIESEL: { keywords: ["kam diesel", "diesel kam", "कम डीजल"], action: "getLowDieselDays" },
    BEST_SALE_DAY: { keywords: ["best sale day", "sabse jyada sale", "सबसे ज्यादा बिक्री"], action: "getBestSaleDay" },
    PEAK_SEASON: { keywords: ["peak season", "पीक सीजन", "सीजन"], action: "getPeakSeason" },
    PETROL_STATUS: { keywords: ["petrol stock", "petrol kitna", "पेट्रोल स्टॉक", "पेट्रोल कितना"], action: "getPetrolStock" }
  };

  const STOP_WORDS = ['ka','ki','ke','kholo','dikhao','ledger','khata','udhar','baaki','kitna','hai','kaun','kab','se','kam','jyada','sabse','gaadi','nayi','add','hui','kya','ko','diya','tha','driver','cash','sale','aaj','din','dinon','2000','litre','diesel','petrol','kitni','thi','wala','wali','karta','karti','karte','h','ho','raha','rahi','par','mein','me','batao','bata','dijiye','do','de','dena','total','koi','sab','sare','sari','mahine','month','season','peak','payment','late','deri','bikri','bika','biki','kis','konsa','konsi', 'a', 'an', 'the', 'is', 'of', 'to', 'in'];

  // ==========================================
  // 2. UI Setup (Floating Mic Button)
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

  // ==========================================
  // 3. Assistant Modal
  // ==========================================
  function openAssistant() {
    if (document.getElementById('assist-modal')) return;

    const m = document.createElement('div');
    m.id = 'assist-modal';
    m.isLoading = false;
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.85);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    
    m.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:20px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.3s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#0b3d91;font-size:18px;">🤖 माज़दा असिस्टेंट</h3>
          <button id="assist-close" style="background:none;border:none;font-size:20px;cursor:pointer;">❌</button>
        </div>
        
        <div id="assist-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:12px;padding:12px;margin-bottom:12px;min-height:150px;max-height:40vh;font-size:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="background:#e8eefc;padding:8px 12px;border-radius:12px;align-self:flex-start;max-width:85%;">नमस्ते! आप पार्टी का नाम, गाड़ी नंबर या सीधा सवाल पूछ सकते हैं (जैसे: "Pappu ka khata" या "UK01PA1234 ka udhar")।</div>
        </div>

        <div id="assist-options" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"></div>

        <div style="display:flex;gap:8px;">
          <input type="text" id="assist-input" placeholder="यहाँ टाइप करें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px;">
          <button id="assist-mic" style="width:50px;height:50px;border-radius:50%;background:#f4b41a;border:none;font-size:22px;cursor:pointer;">🎤</button>
          <button id="assist-send" style="width:50px;height:50px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:20px;cursor:pointer;">➤</button>
        </div>
      </div>
      <style>
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .assist-btn { background:#fff;border:1px solid #0b3d91;border-radius:20px;padding:6px 12px;font-size:12px;color:#0b3d91;cursor:pointer;font-family:inherit; }
        .assist-btn:active { background:#e8eefc; }
      </style>
    `;
    document.body.appendChild(m);

    const chat = m.querySelector('#assist-chat');
    const input = m.querySelector('#assist-input');
    const micBtn = m.querySelector('#assist-mic');
    const sendBtn = m.querySelector('#assist-send');
    const optBox = m.querySelector('#assist-options');
    
    m.querySelector('#assist-close').onclick = () => m.remove();

    const addMsg = (txt, isUser) => {
      const div = document.createElement('div');
      div.style.cssText = `padding:10px 14px;border-radius:12px;max-width:85%;line-height:1.4;${isUser ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;' : 'background:#fff;border:1px solid #e6ebf5;align-self:flex-start;color:#333;border-bottom-left-radius:4px;'}`;
      div.innerHTML = txt;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
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
      showOptions([]); // Clear previous options
      
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

    // --- FIXED VOICE MODULE ---
    micBtn.onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में आवाज़ सपोर्ट नहीं है');
      
      const rec = new SR();
      rec.lang = navigator.language || 'en-IN'; // Hinglish works best with en-IN
      rec.interimResults = false;
      
      micBtn.style.background = '#c62828';
      micBtn.style.color = '#fff';
      input.placeholder = 'सुन रहा हूँ...';
      
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        input.value = text;
        processInput(text);
      };
      
      rec.onerror = () => {
        micBtn.style.background = '#f4b41a';
        micBtn.style.color = '#000';
        input.placeholder = 'यहाँ टाइप करें...';
        toast('आवाज़ नहीं आई, टाइप करके पूछें');
      };
      
      rec.onend = () => {
        micBtn.style.background = '#f4b41a';
        micBtn.style.color = '#000';
        input.placeholder = 'यहाँ टाइप करें...';
      };
      
      try { rec.start(); } catch(e) {}
    };
  }

  // ==========================================
  // 4. Logic: Party & Vehicle Search
  // ==========================================
  function cleanText(str) {
    return str.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  async function findVehicleParty(q) {
    const match = q.match(/uk\s*\d{2}\s*[a-z]{1,2}\s*\d{4}/i);
    if (!match) return null;
    const vNum = match[0].replace(/\s+/g, '').toUpperCase();
    
    const snap = await db().collection('ledger').where('vehicle', '==', vNum).limit(1).get();
    if (snap.empty) return { vNum, party: null };
    
    const partyId = snap.docs[0].data().partyId;
    const pDoc = await db().collection('parties').doc(partyId).get();
    if (pDoc.exists) return { vNum, party: { id: partyId, ...pDoc.data() } };
    return { vNum, party: null };
  }

  function findBestParties(q, parties) {
    if (!parties || !parties.length) return [];
    
    const words = cleanText(q).split(' ');
    const nameWords = words.filter(w => w.length >= 2 && !STOP_WORDS.includes(w));
    if (!nameWords.length) return [];

    let matches = [];

    parties.forEach(p => {
      const pName = cleanText(p.name);
      const pNameNoDouble = pName.replace(/(.)\1+/g, '$1');
      let score = 0;

      nameWords.forEach(nw => {
        const nwNoDouble = nw.replace(/(.)\1+/g, '$1');
        if (pName.includes(nw) || pNameNoDouble.includes(nwNoDouble)) {
          score += nw.length * 10;
        }
      });

      if (score > 0) matches.push({ party: p, score });
    });

    return matches.sort((a, b) => b.score - a.score).map(m => m.party);
  }

  // ==========================================
  // 5. Main Brain (handleQuery)
  // ==========================================
  async function handleQuery(q, addMsg, showOptions, processInput) {
    const parties = S.parties && S.parties.pub ? S.parties.pub : await APP.getParties(false, true);

    // 1. Vehicle Number Check
    const vehRes = await findVehicleParty(q);
    if (vehRes) {
      if (vehRes.party) {
        showPartyMenu(vehRes.party, addMsg, showOptions, processInput, `गाड़ी ${vehRes.vNum}`);
        return null;
      } else {
        return `गाड़ी <b>${vehRes.vNum}</b> का कोई रिकॉर्ड नहीं मिला।`;
      }
    }

    // 2. Party Name Check
    const matchedParties = findBestParties(q, parties);

    if (matchedParties.length === 1) {
      const p = matchedParties[0];
      // Check for explicit commands
      if (q.includes('ledger') || q.includes('khata') || q.includes('खाता')) {
        setTimeout(() => { document.getElementById('assist-modal').remove(); APP.partyView(p.id, false); }, 800);
        return `⏳ <b>${esc(p.name)}</b> का खाता खोल रहा हूँ...`;
      }
      showPartyMenu(p, addMsg, showOptions, processInput);
      return null;
    } 
    
    if (matchedParties.length > 1) {
      // Multiple parties found (Disambiguation)
      const opts = matchedParties.slice(0, 3).map(p => ({
        label: `${p.name} (${p.vehicles && p.vehicles[0] ? p.vehicles[0] : 'कोई गाड़ी नहीं'})`,
        onClick: () => { showPartyMenu(p, addMsg, showOptions, processInput); showOptions([]); }
      }));
      opts.push({ label: '❌ कोई और पार्टी', onClick: () => { addMsg('कृपया पार्टी का नाम टाइप करें:', false); } });
      
      addMsg('आप किस पार्टी की बात कर रहे हैं?', false);
      showOptions(opts);
      return null;
    }

    // 3. Intent Check (if no party found)
    for (const [key, data] of Object.entries(PUMP_INTENTS)) {
      if (data.keywords.some(kw => cleanText(q).includes(cleanText(kw)))) {
        return await executeAction(data.action);
      }
    }

    // 4. Nothing matched
    return 'माफ़ कीजिये, समझ नहीं आया। आप कुछ इस तरह पूछें:<br>• "Pappu ka khata"<br>• "UK01PA1234 ka udhar"<br>• "Aaj ki sale"';
  }

  // ==========================================
  // 6. Party Menu & Self-Learning
  // ==========================================
  function showPartyMenu(p, addMsg, showOptions, processInput, labelPrefix) {
    // Self-Learning: Save the query/alias to localStorage
    try {
      let aliases = JSON.parse(localStorage.getItem('mazda_assist_aliases') || '{}');
      const pNameClean = cleanText(p.name);
      aliases[pNameClean] = p.id; // Save mapping: "pappu" -> party_id
      localStorage.setItem('mazda_assist_aliases', JSON.stringify(aliases));
    } catch (e) {}

    const pre = labelPrefix ? `<small class="mut">${labelPrefix}</small><br>` : '';
    addMsg(`${pre}पार्टी <b>${esc(p.name)}</b> के लिए आप क्या करना चाहेंगे?`, false);
    
    showOptions([
      { label: '📒 खाता (Ledger)', onClick: () => { 
          document.getElementById('assist-modal').remove(); 
          APP.partyView(p.id, false); 
        } 
      },
      { label: '🚗 गाड़ियां देखें', onClick: () => { 
          addMsg(`गाड़ियां: ${p.vehicles && p.vehicles.length ? p.vehicles.join(', ') : 'कोई गाड़ी नहीं'}`, false);
          showOptions([]); 
        } 
      },
      { label: '💰 उधार बताएं', onClick: () => { 
          addMsg(`पार्टी <b>${esc(p.name)}</b> का कुल उधार: <b class="neg">${money(p.bal)}</b>`, false);
          showOptions([]); 
        } 
      }
    ]);
  }

  // ==========================================
  // 7. Intent Actions
  // ==========================================
  async function executeAction(action) {
    switch (action) {
      case 'getTodaySale': return await getTodaySale();
      case 'getTotalUdhar': return await getTotalUdhar();
      case 'getLowDieselDays': return await getLowDieselDays();
      case 'getBestSaleDay': return await getBestSaleDay();
      case 'getPeakSeason': return await getPeakSeason();
      case 'getPetrolStock': return await getPetrolStock();
      default: return 'कुछ गड़बड़ है।';
    }
  }

  async function getTodaySale() {
    const ds = await db().collection('days').doc(today()).get();
    if (!ds.exists) return 'आज का हिसाब अभी शुरू नहीं हुआ है।';
    const sum = ds.data().sum || {};
    return `आज की कुल बिक्री: <b class="pos">${money(sum.sale)}</b><br>पेट्रोल: ${lit(sum.litP)}<br>डीज़ल: ${lit(sum.litD)}`;
  }

  async function getTotalUdhar() {
    const ps = await APP.getParties(false, true);
    const tot = ps.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);
    return `कुल मिलाकर सभी पार्टियों का बकाया: <b class="neg">${money(tot)}</b>`;
  }

  async function getLowDieselDays() {
    const snap = await db().collection('days').where('date', '>=', APP.shiftDate(today(), -30)).get();
    const days = snap.docs.map(d => d.data()).filter(d => d.sum && num(d.sum.litD) < 2000).sort((a,b) => b.date.localeCompare(a.date));
    if (!days.length) return 'पिछले 30 दिनों में डीज़ल 2000L से नीचे नहीं बिका।';
    return 'जिन दिनों डीज़ल 2000L से कम बिका:<br>' + days.slice(0, 5).map(d => `• <b>${dmy(d.date)}</b>: ${lit(d.sum.litD)}`).join('<br>');
  }

  async function getBestSaleDay() {
    const snap = await db().collection('days').orderBy('date', 'desc').limit(90).get();
    let maxD = null, maxV = 0;
    snap.docs.forEach(d => {
      const s = num((d.data().sum || {}).sale);
      if (s > maxV) { maxV = s; maxD = d.data().date; }
    });
    if (!maxD) return 'डेटा नहीं मिला।';
    return `पिछले 90 दिनों में सबसे ज्यादा सेल <b>${dmy(maxD)}</b> को हुई थी: <b class="pos">${money(maxV)}</b>`;
  }

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
    if (sorted.length < 2) return 'डेटा कम है, पीक सीजन का अंदाजा नहीं लगा सकते।';
    const bestMonth = sorted[0];
    const mName = new Date(bestMonth + '-01T12:00:00').toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
    return `सबसे ज्यादा बिक्री <b>${mName}</b> में देखी गई है। यही आपका पीक सीजन हो सकता है।`;
  }

  async function getPetrolStock() {
    const snap = await db().collection('days').orderBy('date', 'desc').limit(1).get();
    if (snap.empty) return 'डेटा नहीं मिला।';
    const d = snap.docs[0].data();
    const s = d.sum || {};
    const pStock = s.actStockP !== undefined ? s.actStockP : (s.expStockP || 0);
    return `आज का पेट्रोल स्टॉक (${dmy(d.date)}): <b class="pos">${lit(pStock)}</b>`;
  }

  console.log('[Mazda assistant.js] Smart Local Brain + Confirmation + Voice ✓');
})();
