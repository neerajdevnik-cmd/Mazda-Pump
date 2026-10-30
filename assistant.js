/* Mazda Oil Company - Local Voice & Keyword Assistant (No AI needed for 95% queries) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  // === 1. UI Setup (Floating Mic Button) ===
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

  // === 2. Assistant Modal ===
  function openAssistant() {
    if (document.getElementById('assist-modal')) return;

    const m = document.createElement('div');
    m.id = 'assist-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.85);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    
    m.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:20px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.3s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;color:#0b3d91;font-size:18px;">🤖 माज़दा असिस्टेंट</h3>
          <button id="assist-close" style="background:none;border:none;font-size:20px;cursor:pointer;">❌</button>
        </div>
        
        <div id="assist-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:12px;padding:12px;margin-bottom:12px;min-height:150px;max-height:40vh;font-size:14px;display:flex;flex-direction:column;gap:8px;">
          <div style="background:#e8eefc;padding:8px 12px;border-radius:12px;align-self:flex-start;max-width:85%;">नमस्ते! मैं आपका असिस्टेंट हूँ। आप बोलकर या टाइप करके सवाल पूछ सकते हैं।</div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <input type="text" id="assist-input" placeholder="यहाँ टाइप करें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px;">
          <button id="assist-mic" style="width:50px;height:50px;border-radius:50%;background:#f4b41a;border:none;font-size:22px;cursor:pointer;">🎤</button>
          <button id="assist-send" style="width:50px;height:50px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:20px;cursor:pointer;">➤</button>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <button class="quick-btn" data-q="आज की सेल कितनी है">आज की सेल</button>
          <button class="quick-btn" data-q="कुल उधार कितना बाकी है">कुल उधार</button>
          <button class="quick-btn" data-q="2000 लीटर से कम डीजल कब बिका">कम डीजल वाले दिन</button>
          <button class="quick-btn" data-q="सबसे ज्यादा सेल किस दिन थी">बेस्ट सेल डे</button>
          <button class="quick-btn" data-q="पीक सीजन कब शुरू होगा">पीक सीजन</button>
        </div>
      </div>
      <style>
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .quick-btn { background:#fff;border:1px solid #c9d3e6;border-radius:20px;padding:6px 12px;font-size:12px;color:#0b3d91;cursor:pointer;font-family:inherit; }
        .quick-btn:active { background:#e8eefc; }
      </style>
    `;
    document.body.appendChild(m);

    const chat = m.querySelector('#assist-chat');
    const input = m.querySelector('#assist-input');
    const micBtn = m.querySelector('#assist-mic');
    const sendBtn = m.querySelector('#assist-send');
    
    m.querySelector('#assist-close').onclick = () => m.remove();

    const addMsg = (txt, isUser) => {
      const div = document.createElement('div');
      div.style.cssText = `padding:10px 14px;border-radius:12px;max-width:85%;line-height:1.4;${isUser ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;' : 'background:#fff;border:1px solid #e6ebf5;align-self:flex-start;color:#333;border-bottom-left-radius:4px;'}`;
      div.innerHTML = txt;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    };

    const processInput = async (text) => {
      if (!text || !text.trim()) return;
      addMsg(esc(text), true);
      input.value = '';
      
      // Show loading
      const load = document.createElement('div');
      load.innerHTML = '⏳ सोच रहा हूँ...';
      load.style.cssText = 'background:#f0f0f0;padding:8px 12px;border-radius:12px;align-self:flex-start;color:#666;font-size:12px;';
      chat.appendChild(load);
      chat.scrollTop = chat.scrollHeight;

      try {
        const reply = await handleQuery(text.toLowerCase());
        load.remove();
        addMsg(reply, false);
      } catch (e) {
        load.remove();
        addMsg('❌ माफ़ कीजिये, कोई गड़बड़ हो गई: ' + e.message, false);
      }
    };

    sendBtn.onclick = () => processInput(input.value);
    input.onkeypress = (e) => { if (e.key === 'Enter') processInput(input.value); };
    
    m.querySelectorAll('.quick-btn').forEach(b => {
      b.onclick = () => processInput(b.dataset.q);
    });

    // Voice Recognition
    micBtn.onclick = () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में आवाज़ सपोर्ट नहीं है');
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.interimResults = false;
      
      micBtn.style.background = '#c62828';
      micBtn.style.color = '#fff';
      rec.onstart = () => { input.placeholder = 'सुन रहा हूँ...'; };
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        input.value = text;
        processInput(text);
      };
      rec.onerror = () => {
        micBtn.style.background = '#f4b41a';
        micBtn.style.color = '#000';
        input.placeholder = 'यहाँ टाइप करें...';
        toast('आवाज़ नहीं आई, दोबारा बोलें');
      };
      rec.onend = () => {
        micBtn.style.background = '#f4b41a';
        micBtn.style.color = '#000';
        input.placeholder = 'यहाँ टाइप करें...';
      };
      rec.start();
    };
  }

  // === 3. The Brain: Keyword Matching & Data Fetching ===
  async function handleQuery(q) {
    // 3.1 Party Name Detection
    let matchedParty = null;
    const parties = S.parties && S.parties.pub ? S.parties.pub : await APP.getParties(false, true);
    if (parties && parties.length) {
      matchedParty = parties.find(p => {
        const n = p.name.toLowerCase();
        return q.includes(n) || n.split(' ').some(w => w.length > 2 && q.includes(w));
      });
    }

    // 3.2 Intent Detection
    
    // Q1: 2000 litres se kam diesel kab bika
    if (q.includes('diesel') && (q.includes('kam') || q.includes('2000')) || q.includes('डीजल') && q.includes('कम')) {
      return await findLowDieselDays();
    }

    // Q2: Sale kis din max thi
    if (q.includes('sale') && (q.includes('max') || q.includes('jyada') || q.includes('best') || q.includes('ज्यादा'))) {
      return await findMaxSaleDay();
    }

    // Q3: Peak Season Kab start hoga
    if (q.includes('season') || q.includes('peak') || q.includes('सीजन')) {
      return await findPeakSeason();
    }

    // Q4: Sabse late payment kaun karta hai
    if (q.includes('late') || q.includes('deri') || q.includes('payment') || q.includes('देरी')) {
      return await findLatePayers();
    }

    // Q5: Kis party ki gaadi sabse jyada tel bharwati hai
    if ((q.includes('gaadi') || q.includes('गाड़ी')) && (q.includes('jyada') || q.includes('sabse'))) {
      return await findTopFuelVehicle();
    }

    // Q8: Driver ko cash diya kya (Party check)
    if (q.includes('driver') || q.includes('ड्राइवर')) {
      if (!matchedParty) return 'कृपया पार्टी का नाम भी बताएं (जैसे: "Pappu ke driver ko cash diya kya?")';
      return await checkDriverCash(matchedParty.id);
    }

    // Q7: Party ki nayi gaadi
    if ((q.includes('gaadi') || q.includes('गाड़ी')) && (q.includes('nayi') || q.includes('add') || q.includes('नई'))) {
      if (!matchedParty) return 'कृपया पार्टी का नाम बताएं (जैसे: "Pappu ki nayi gaadi add hui hai kya?")';
      return `पार्टी <b>${esc(matchedParty.name)}</b> की गाड़ियां: <br> ${matchedParty.vehicles && matchedParty.vehicles.length ? matchedParty.vehicles.join(', ') : 'कोई गाड़ी नहीं'}`;
    }

    // Q6: Party ka ledger kholo
    if (q.includes('ledger') || q.includes('khata') || q.includes('खाता')) {
      if (!matchedParty) return 'किस पार्टी का खाता खोलना है? नाम बताएं।';
      setTimeout(() => { document.getElementById('assist-modal').remove(); APP.partyView(matchedParty.id, false); }, 1000);
      return `⏳ <b>${esc(matchedParty.name)}</b> का खाता खोल रहा हूँ...`;
    }

    // Simple Party Balance
    if (matchedParty && (q.includes('udhar') || q.includes('baaki') || q.includes('उधार') || q.includes('बकाया'))) {
      return `पार्टी <b>${esc(matchedParty.name)}</b> का कुल उधार: <b class="neg">${money(matchedParty.bal)}</b>`;
    }

    // Total Udhar
    if (q.includes('total') && (q.includes('udhar') || q.includes('बकाया'))) {
      const tot = parties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);
      return `कुल मिलाकर सभी पार्टियों का बकाया: <b class="neg">${money(tot)}</b>`;
    }

    // Aaj ki Sale
    if (q.includes('sale') || q.includes('bikri') || q.includes('सेल')) {
      const ds = await db().collection('days').doc(today()).get();
      if (!ds.exists) return 'आज का हिसाब अभी शुरू नहीं हुआ है।';
      const sum = ds.data().sum || {};
      return `आज की कुल बिक्री: <b class="pos">${money(sum.sale)}</b><br>पेट्रोल: ${lit(sum.litP)}<br>डीज़ल: ${lit(sum.litD)}`;
    }

    // Agar kuch samajh na aaye, toh AI ko bhej dein
    if (APP.AI && APP.AI.hasKey()) {
      return '🤖 मुझे यह प्रश्न समझ नहीं आया, मैं AI से पूछ कर बताता हूँ...<br><br><i>' + (await askAI(q)) + '</i>';
    }
    
    return 'माफ़ कीजिये, मैं यह प्रश्न नहीं समझ पाया। आप कुछ इस तरह पूछ सकते हैं:<br>• आज की सेल?<br>• पप्पू का उधार?<br>• सबसे ज्यादा तेल किसकी गाड़ी लेती है?';
  }

  // === 4. Functions to fetch specific answers ===

  async function findLowDieselDays() {
    const snap = await db().collection('days').where('date', '>=', APP.shiftDate(today(), -30)).get();
    const days = snap.docs.map(d => d.data()).filter(d => d.sum && num(d.sum.litD) < 2000).sort((a,b) => b.date.localeCompare(a.date));
    if (!days.length) return 'पिछले 30 दिनों में डीज़ल 2000 लीटर से नीचे नहीं बिका।';
    return 'पिछले 30 दिनों में जिन दिनों डीज़ल 2000L से कम बिका:<br>' + days.slice(0, 5).map(d => `• <b>${dmy(d.date)}</b>: ${lit(d.sum.litD)}`).join('<br>');
  }

  async function findMaxSaleDay() {
    const snap = await db().collection('days').orderBy('date', 'desc').limit(90).get();
    let maxD = null, maxV = 0;
    snap.docs.forEach(d => {
      const s = num((d.data().sum || {}).sale);
      if (s > maxV) { maxV = s; maxD = d.data().date; }
    });
    if (!maxD) return 'डेटा नहीं मिला।';
    return `पिछले 90 दिनों में सबसे ज्यादा सेल <b>${dmy(maxD)}</b> को हुई थी: <b class="pos">${money(maxV)}</b>`;
  }

  async function findPeakSeason() {
    const snap = await db().collection('days').get();
    if (snap.empty) return 'डेटा कम है।';
    const months = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.sum || !data.sum.sale) return;
      const m = data.date.slice(0, 7); // YYYY-MM
      months[m] = (months[m] || 0) + num(data.sum.sale);
    });
    const sorted = Object.keys(months).sort((a,b) => months[b] - months[a]);
    if (sorted.length < 2) return 'अभी डेटा कम है, पीक सीजन का अंदाजा नहीं लगाया जा सकता।';
    const bestMonth = sorted[0];
    const mName = new Date(bestMonth + '-01T12:00:00').toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
    return `आपके डेटा के अनुसार सबसे ज्यादा बिक्री <b>${mName}</b> में देखी गई है (${money(months[bestMonth])})। यही आपका पीक सीजन हो सकता है।`;
  }

  async function findLatePayers() {
    // Basic logic: find parties with highest balance and low recent jama
    const ps = await APP.getParties(false, true);
    const due = ps.filter(p => num(p.bal) > 0).sort((a,b) => num(b.bal) - num(a.bal));
    if (!due.length) return 'सबका हिसाब बराबर है!';
    return 'सबसे ज्यादा बकाया वाली टॉप 3 पार्टियां (जो देरी कर रही हैं):<br>' + due.slice(0, 3).map(p => `• <b>${esc(p.name)}</b>: ${money(p.bal)}`).join('<br>');
  }

  async function findTopFuelVehicle() {
    const snap = await db().collection('ledger').where('kind', '==', 'udhar').get();
    const veh = {};
    snap.docs.forEach(d => {
      const x = d.data();
      if (!x.vehicle) return;
      veh[x.vehicle] = (veh[x.vehicle] || 0) + num(x.litre);
    });
    const sorted = Object.keys(veh).sort((a,b) => veh[b] - veh[a]);
    if (!sorted.length) return 'कोई गाड़ी डेटा नहीं मिला।';
    return `सबसे ज्यादा तेल भरवाने वाली गाड़ी: <b>${sorted[0]}</b><br>कुल तेल: <b>${lit(veh[sorted[0]])}</b>`;
  }

  async function checkDriverCash(pid) {
    const snap = await db().collection('ledger').where('partyId', '==', pid).get();
    const hasDriver = snap.docs.some(d => {
      const x = d.data();
      return (x.note && x.note.toLowerCase().includes('driver')) || (x.note && x.note.includes('ड्राइवर'));
    });
    if (hasDriver) return 'हाँ, इस पार्टी की एंट्री में ड्राइवर को कैश देने का ज़िक्र मिला है।';
    return 'नहीं, इस पार्टी के खाते में ड्राइवर को कैश देने का कोई रिकॉर्ड नहीं मिला।';
  }

  async function askAI(q) {
    try {
      const prompt = `You are a petrol pump assistant. The user asks: "${q}". Reply in short Hindi with data if possible. Keep it under 3 lines.`;
      const txt = await APP.AI.ask({ contents: [{ parts: [{ text: prompt }] }] });
      return txt;
    } catch(e) {
      return 'AI से भी जवाब नहीं मिल पाया (नेटवर्क या लिमिट की समस्या)।';
    }
  }

  console.log('[Mazda assistant.js] Local Brain + Voice Loaded ✓');
})();
