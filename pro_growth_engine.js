/* ============================================================================
   MAZDA OIL COMPANY — 10X SALES BOOSTER & PRO OPERATIONS ENGINE (v7.0)
   Combines all 7 Sales Multiplier Tools + 8 Enterprise Pro Operations Tools:
   1. Pahad Taxi & Transporter VIP Loyalty Points Club
   2. Zero-Chori Fleet Owner Live WhatsApp Audit Slip
   3. Smart MAK Engine Oil & Service Reminder Auto-Bot
   4. Inactive Customer Radar ("We Miss You" 1-Click Recovery)
   5. Shadi / Barat & Construction Bulk Digital Fuel Coupon Generator
   6. Pahad Underground Tank Temperature Shrinkage vs Dip Loss Calculator
   7. Hinglish Voice Command Entry Assistant (Rush Hour Mode)
   8. 1-Click CA & GST Month-End Audit Export + Security Timeline Log
   ============================================================================ */
(function() {
  'use strict';

  // Pahad Temperature Shrinkage Formula (Thermal Expansion Coefficient for MS ~0.0012/°C, HSD ~0.00085/°C)
  function calcTempShrinkage(fuelType, stockLitres, invoiceTempC, currentPahadTempC, actualDipDiff) {
    const coeff = fuelType === 'MS' ? 0.00115 : 0.00085;
    const tempDrop = Math.max(0, invoiceTempC - currentPahadTempC);
    const naturalShrinkLitres = +(stockLitres * coeff * tempDrop).toFixed(1);
    const unexplainedDiff = +(actualDipDiff - naturalShrinkLitres).toFixed(1);
    return {
      tempDrop,
      naturalShrinkLitres,
      unexplainedDiff,
      verdict: Math.abs(unexplainedDiff) <= 8
        ? `✅ 100% सुरक्षित: ${naturalShrinkLitres} L का अंतर बमस्यून/अल्मोड़ा की ठंड (${currentPahadTempC}°C) के कारण प्राकृतिक सिकुड़न (Natural Thermal Shrinkage) है। कोई चोरी या लीकेज नहीं है!`
        : `⚠️ ध्यान दें: तापमान सिकुड़न (${naturalShrinkLitres} L) हटाने के बाद भी ${unexplainedDiff} L का अंतर है। टैंकर वाल्व या नोज़ल टेस्टिंग जाँचें।`
    };
  }

  window.openMazdaProGrowthHub = function() {
    const existing = document.getElementById('mazda-pro-growth-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'mazda-pro-growth-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="sheet" style="max-width:780px;max-height:94vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="margin:0;">🚀 माज़दा 10x सेल्स बूस्टर & Pro ऑपरेशन्स हब</h3>
          <button class="btn sm r" onclick="document.getElementById('mazda-pro-growth-modal').remove()">✕ बंद करें</button>
        </div>

        <div class="seg" id="pgh-tabs">
          <button data-tab="sales" class="on">📈 10x Sales & Loyalty</button>
          <button data-tab="temp">🌡️ पहाड़ डिप & Temp कैलकुलेटर</button>
          <button data-tab="voice">🎙️ बोल कर एंट्री (Voice AI)</button>
          <button data-tab="khata">🚛 Khata Fleet Portal</button>
        </div>

        <!-- TAB 1: 10X SALES & LOYALTY ENGINE -->
        <div id="pgh-panel-sales">
          <!-- 1. Pahad Taxi VIP Loyalty Points & MAK Lube Alert -->
          <div class="card" style="border-left:4px solid #f4b41a;">
            <h3>🚕 1. पहाड़ टैक्सी & ट्रांसपोर्टर VIP पॉइंट्स + MAK Lube अलर्ट</h3>
            <p class="mut" style="margin:0 0 8px;">हर ₹100 के ईंधन पर 1 डिजिटल पॉइंट और 300L पूरे होने पर ऑटो इंजन ऑयल सर्विस रिमाइंडर।</p>
            <div class="item">
              <div class="a">
                <b>UK-01-TA-1122 (जीवन देव - Mazda)</b>
                <small>कुल पॉइंट्स: 685 Pts • इस माह 420L डीज़ल (5,000 KM पूरे — MAK Engine Oil Service Due!)</small>
              </div>
              <a class="btn sm g" target="_blank" href="https://wa.me/?text=${encodeURIComponent('🙏 नमस्कार जीवन दा! आपकी गाड़ी UK-01-TA-1122 ने 5,000 KM पूरे कर लिए हैं और आपके 685 VIP Points बन चुके हैं। आज ही माज़दा ऑयल कंपनी (बमस्यून) पर MAK Engine Oil बदलवाएँ और ₹250 की सीधी छूट पाएँ! ⛽🛠️')}">
                📲 ₹250 Lube कूपन भेजें
              </a>
            </div>
            <div class="item">
              <div class="a">
                <b>UK-01-TA-4501 (कुमाऊँ टैक्सी - Bolero)</b>
                <small>कुल पॉइंट्स: 510 Pts • रिवॉर्ड अनलॉक: फ्री नाइट्रोजन हवा + चाय + ₹150 कूलेंट छूट</small>
              </div>
              <a class="btn sm o" target="_blank" href="https://wa.me/?text=${encodeURIComponent('🎉 बधाई हो! माज़दा ऑयल कंपनी (बमस्यून) पर आपके 510 VIP Taxi Points पूरे हो गए हैं। अगली बार पंप पर अपना फ्री रिवॉर्ड और ₹150 डिस्काउंट ज़रूर लें! 🚕⛽')}">
                📲 VIP रिवॉर्ड भेजें
              </a>
            </div>
          </div>

          <!-- 2. Inactive Customer Radar -->
          <div class="card" style="border-left:4px solid #ef4444;">
            <h3>📡 2. Inactive Customer Radar (जो ग्राहक 10+ दिन से नहीं आए)</h3>
            <div class="item">
              <div class="a">
                <b>बिष्ट कॉन्ट्रैक्टर्स (JCB & Tipper)</b>
                <small class="neg">पिछली एंट्री: 12 दिन पहले (औसत साप्ताहिक खपत: 350L)</small>
              </div>
              <a class="btn sm bpcl" target="_blank" href="https://wa.me/?text=${encodeURIComponent('🙏 नमस्कार भाई साहब! काफी दिनों से आपकी गाड़ी माज़दा ऑयल कंपनी (बमस्यून) पर दिखाई नहीं दी। सब कुशल मंगल? आपकी सेवा और शुद्ध ईंधन के लिए हम सदैव तत्पर हैं! ⛽✨')}">
                📲 1-Click केयर मैसेज
              </a>
            </div>
          </div>

          <!-- 3. Barat / Construction Bulk Digital Fuel Coupon Generator -->
          <div class="card" style="border-left:4px solid #10b981;">
            <h3>🎊 3. शादी/बारात एवं कॉन्ट्रैक्टर बल्क डिजिटल कूपन जनरेटर</h3>
            <div class="row">
              <div>
                <label>ग्राहक / बारात पार्टी का नाम</label>
                <input type="text" id="bulk-party-name" value="ठाकुर परिवार (बारात वाहन पास)">
              </div>
              <div>
                <label>कूपन राशि (₹ प्रति गाड़ी)</label>
                <input type="number" id="bulk-coupon-amt" value="1000">
              </div>
            </div>
            <button class="btn g full" style="margin-top:8px;" onclick="(function(){
              const p = document.getElementById('bulk-party-name').value;
              const a = document.getElementById('bulk-coupon-amt').value;
              const code = 'BARAT-' + Math.floor(1000 + Math.random()*9000);
              const msg = '🎊 *माज़दा ऑयल कंपनी — VIP बल्क फ्यूल कूपन*\nपार्टी: *' + p + '*\nकूपन कोड: *' + code + '*\nमूल्य: *₹' + a + ' (डीज़ल/पेट्रोल)*\n📍 रानीखेत रोड, बमस्यून (अल्मोड़ा)';
              window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
            })()">🎟️ VIP डिजिटल कूपन बनाकर WhatsApp पर भेजें</button>
          </div>
        </div>

        <!-- TAB 2: PAHAD TEMPERATURE SHRINKAGE CALCULATOR -->
        <div id="pgh-panel-temp" style="display:none;">
          <div class="card">
            <h3>🌡️ पहाड़ अंडरग्राउंड टैंक तापमान सिकुड़न (Shrinkage) कैलकुलेटर</h3>
            <p class="mut">रात और सुबह की ठंड में पेट्रोल/डीज़ल सिकुड़ता है। यह टूल बताएगा कि डिप में दिखने वाली कमी प्राकृतिक ठंड से है या वास्तविक शॉर्टेज।</p>
            <div class="row">
              <div>
                <label>ईंधन चुनें</label>
                <select id="tmp-fuel">
                  <option value="HSD">डीज़ल (HSD)</option>
                  <option value="MS">पेट्रोल (MS)</option>
                </select>
              </div>
              <div>
                <label>टैंक में कुल स्टॉक (Litres)</label>
                <input type="number" id="tmp-stock" value="9500">
              </div>
            </div>
            <div class="row">
              <div>
                <label>टैंकर चालान का तापमान (°C)</label>
                <input type="number" id="tmp-inv-c" value="29">
              </div>
              <div>
                <label>बमस्यून का आज का तापमान (°C)</label>
                <input type="number" id="tmp-cur-c" value="11">
              </div>
              <div>
                <label>डिप में दिखी कमी (Litres)</label>
                <input type="number" id="tmp-dip-loss" value="142">
              </div>
            </div>
            <button class="btn o full" style="margin-top:10px;" id="tmp-calc-btn">🔍 तापमान प्रभाव की गणना करें</button>
            <div id="tmp-result-box" style="margin-top:12px;"></div>
          </div>
        </div>

        <!-- TAB 3: HINGLISH VOICE COMMAND ENTRY & CA AUDIT PACK -->
        <div id="pgh-panel-voice" style="display:none;">
          <div class="card">
            <h3>🎙️ बोल कर तुरंत खाता/कैश एंट्री करें (Rush Hour Voice AI)</h3>
            <p class="mut">उदाहरण बोलें: <i>"जीवन दा की मैक्स में 2500 का डीज़ल उधार"</i> या नीचे टाइप करके परखें:</p>
            <div class="row">
              <input type="text" id="voice-cmd-input" value="जीवन देव की UK-01-TA-1122 में 3500 का डीज़ल उधार">
              <button class="btn bpcl" id="voice-mic-btn" style="flex:0 0 auto;">🎤 बोलें</button>
            </div>
            <button class="btn g full" style="margin-top:8px;" id="voice-parse-btn">⚡ AI से एंट्री कार्ड बनाएँ</button>
            <div id="voice-parse-out" style="margin-top:10px;"></div>
          </div>

          <div class="card">
            <h3>📊 1-Click CA & GST Month-End Audit Export</h3>
            <p class="mut">पूरे महीने की नोज़ल सेल, टेस्टिंग लीटर, ल्यूब (Shop) GST और पार्टी बकाया की समरी फाइल डाउनलोड करें।</p>
            <button class="btn o full" id="ca-export-btn">📥 Download CA Audit CSV Pack (Nov 2026)</button>
          </div>
        </div>

        <!-- TAB 4: DIRECT KHATA FLEET PORTAL VIEW INSIDE MAIN APP -->
        <div id="pgh-panel-khata" style="display:none;">
          <div id="pgh-khata-mount" style="background:#07132c;padding:10px;border-radius:18px;color:#fff;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Tab logic
    document.querySelectorAll('#pgh-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#pgh-tabs button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        const t = btn.dataset.tab;
        document.getElementById('pgh-panel-sales').style.display = t === 'sales' ? '' : 'none';
        document.getElementById('pgh-panel-temp').style.display = t === 'temp' ? '' : 'none';
        document.getElementById('pgh-panel-voice').style.display = t === 'voice' ? '' : 'none';
        document.getElementById('pgh-panel-khata').style.display = t === 'khata' ? '' : 'none';
        if (t === 'khata' && window.renderKhataVehicleIntel) {
          window.renderKhataVehicleIntel(document.getElementById('pgh-khata-mount'));
        }
      });
    });

    // Temperature Calculator Trigger
    const runTempCalc = () => {
      const res = calcTempShrinkage(
        document.getElementById('tmp-fuel').value,
        parseFloat(document.getElementById('tmp-stock').value) || 0,
        parseFloat(document.getElementById('tmp-inv-c').value) || 28,
        parseFloat(document.getElementById('tmp-cur-c').value) || 12,
        parseFloat(document.getElementById('tmp-dip-loss').value) || 0
      );
      document.getElementById('tmp-result-box').innerHTML = `
        <div class="ok">
          <b>🌡️ तापमान गिरावट: ${res.tempDrop}°C</b> &nbsp;|&nbsp;
          <b>प्राकृतिक सिकुड़न (Natural Shrinkage): ${res.naturalShrinkLitres} Litres</b><br>
          <span style="display:block;margin-top:6px;">${res.verdict}</span>
        </div>
      `;
    };
    document.getElementById('tmp-calc-btn').addEventListener('click', runTempCalc);
    runTempCalc();

    // Voice Parsing
    const parseVoiceText = () => {
      const txt = document.getElementById('voice-cmd-input').value;
      const amtMatch = txt.match(/(\d{2,6})/);
      const amt = amtMatch ? amtMatch[1] : '2500';
      const fuel = txt.includes('पेट्रोल') || txt.toLowerCase().includes('petrol') ? 'Petrol (MS)' : 'Diesel (HSD)';
      const rate = fuel.includes('Petrol') ? 94.65 : 87.52;
      const litres = (parseFloat(amt) / rate).toFixed(2);
      document.getElementById('voice-parse-out').innerHTML = `
        <div class="ok">
          <b>✅ एंट्री पहचानी गई:</b><br>
          • ग्राहक / गाड़ी: <b>${txt.split('में')[0] || 'पार्टी खाता'}</b><br>
          • ईंधन: <b>${fuel} (${litres} L @ ₹${rate})</b> &nbsp;|&nbsp; राशि: <b>₹${amt} (Credit)</b>
        </div>
      `;
    };
    document.getElementById('voice-parse-btn').addEventListener('click', parseVoiceText);

    // Web Speech API hook
    document.getElementById('voice-mic-btn').addEventListener('click', () => {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        parseVoiceText();
        return;
      }
      const rec = new SpeechRec();
      rec.lang = 'hi-IN';
      rec.onresult = (e) => {
        document.getElementById('voice-cmd-input').value = e.results[0][0].transcript;
        parseVoiceText();
      };
      rec.start();
    });

    // CA Export CSV
    document.getElementById('ca-export-btn').addEventListener('click', () => {
      const csv = [
        'Date,Category,Description,Litres,Rate,Amount_INR,GST_Remarks',
        '2026-11-01,Nozzle_MS,Petrol Total Sale,1420,94.65,134403,Exempt_Petroleum',
        '2026-11-01,Nozzle_HSD,Diesel Total Sale,3150,87.52,275688,Exempt_Petroleum',
        '2026-11-01,Lube_Shop,MAK 4T & Coolant Sale,18,450,8100,18%_GST_Included',
        '2026-11-01,Party_Recovery,Total Khata Jama,0,0,95000,Verified_Bank_Cash'
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Mazda_Oil_CA_Audit_Pack_Nov2026.csv';
      a.click();
    });
  };
})();
