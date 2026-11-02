/* ============================================================================
   MAZDA OIL COMPANY — KHATA CUSTOMER PORTAL VEHICLE & ROUTE INTELLIGENCE (v7.0)
   Integrates directly inside the existing Khata Party Portal (party.html)
   Features:
   - Odometer (Meter Reading) + Date Tracker -> Auto Running (KM) Calculation
   - Split Running Option: Loaded KM vs Empty (Khali) KM + Custom Load Input (Ton/Quintal/Passengers)
   - Dual Mileage Engine: Loaded Average vs Empty Average vs Overall Average + Best/Worst History
   - Kumaon / Pahadi Route Root-Cause Analyzer (Bamsyun, Ranikhet, Almora, Haldwani, Khairna, Bajeena)
     Detects whether mileage drop is due to Steep Climb, Heavy Load, or Driver/Vehicle Issue
   - Trip Cost-Per-KM & Freight Profit Calculator
   - Vehicle Document Vault & Service Expiry Early Alert System
   - 1-Time Digital Driver Fuel Pass (OTP / QR Slip Request)
   ============================================================================ */
(function() {
  'use strict';

  const PAHADI_ROUTES = [
    { id: 'bamsyun_ranikhet', name: 'बमस्यून ↔ रानीखेत (Steep Climb / चीड़ वन चढ़ाई)', climbFactor: 1.22, idealEmpty: 14.5, idealLoaded: 10.2 },
    { id: 'bamsyun_almora',   name: 'बमस्यून ↔ अल्मोड़ा (कोसी / पाण्डेखोला मार्ग)', climbFactor: 1.18, idealEmpty: 15.0, idealLoaded: 10.8 },
    { id: 'ranikhet_haldwani',name: 'रानीखेत ↔ खैरना ↔ हल्द्वानी (Long Valley & Ghat)', climbFactor: 1.15, idealEmpty: 16.0, idealLoaded: 11.5 },
    { id: 'bamsyun_bajeena',  name: 'बमस्यून ↔ बजीना ↔ मजखाली (Local Hill Link)', climbFactor: 1.20, idealEmpty: 14.2, idealLoaded: 10.0 },
    { id: 'bhikiyasain_ramnagar', name: 'भिकियासैंण ↔ रामनगर (Mixed River Valley)', climbFactor: 1.12, idealEmpty: 16.5, idealLoaded: 12.0 },
    { id: 'custom_hill',      name: 'अन्य पहाड़ी / लोकल रूट (Custom Route)', climbFactor: 1.18, idealEmpty: 14.8, idealLoaded: 10.5 }
  ];

  const STORAGE_KEY = 'mazda_khata_fleet_intel_v7';

  const getStore = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      vehicles: [
        {
          vehNo: 'UK-01-TA-1122 (Mazda Truck)',
          baseEmptyAvg: 14.5,
          baseLoadedAvg: 10.2,
          docs: {
            insurance: '2026-11-18',
            puc: '2026-11-09',
            fitness: '2027-03-15',
            permit: '2027-06-30',
            tax: '2026-12-31',
            nextServiceKm: 48500,
            lastOdo: 47920
          },
          logs: [
            {
              id: 'l1',
              date: '2026-10-25',
              prevOdo: 47100,
              currOdo: 47520,
              totalKm: 420,
              loadedKm: 260,
              emptyKm: 160,
              loadDesc: '3.5 Ton (राशन एवं सीमेंट)',
              loadTons: 3.5,
              fuelLitres: 36.5,
              fuelRate: 87.52,
              routeId: 'ranikhet_haldwani',
              driverName: 'रमेश सिंह',
              freightEarned: 9500,
              overallAvg: 11.51,
              loadedAvgEst: 9.85,
              emptyAvgEst: 14.20,
              diagnosis: '✅ सामान्य: 3.5 Ton लोड और खैरना-रानीखेत चढ़ाई के हिसाब से 11.51 km/L बिल्कुल सही एवरेज है।'
            },
            {
              id: 'l2',
              date: '2026-10-30',
              prevOdo: 47520,
              currOdo: 47920,
              totalKm: 400,
              loadedKm: 120,
              emptyKm: 280,
              loadDesc: '1.2 Ton (सब्जी कैरेट)',
              loadTons: 1.2,
              fuelLitres: 39.0,
              fuelRate: 87.52,
              routeId: 'bamsyun_ranikhet',
              driverName: 'गोपाल',
              freightEarned: 7200,
              overallAvg: 10.26,
              loadedAvgEst: 8.40,
              emptyAvgEst: 11.10,
              diagnosis: '⚠️ एवरेज कम आया (-2.8 km/L): 280 KM गाड़ी खाली चलने और कम लोड (1.2T) के बावजूद एवरेज गिरा है। संभावित कारण: ड्राइवर द्वारा अधिक क्लच/आइडलिंग (Driver Style), एयर फिल्टर जाम या डीज़ल चोरी की जाँच करें!'
            }
          ]
        }
      ],
      passes: []
    };
  };

  const saveStore = (data) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  };

  // Smart Root-Cause Diagnosis Engine (Route + Load + Driver vs Vehicle)
  function analyzeTripMileage(params) {
    const route = PAHADI_ROUTES.find(r => r.id === params.routeId) || PAHADI_ROUTES[0];
    const totalKm = Math.max(1, params.totalKm);
    const loadedKm = Math.min(totalKm, Math.max(0, params.loadedKm));
    const emptyKm = Math.max(0, totalKm - loadedKm);
    const fuel = Math.max(0.1, params.fuelLitres);
    const overallAvg = totalKm / fuel;

    // Weight impact adjustment
    const loadTons = parseFloat(params.loadTons) || 0;
    const weightPenalty = Math.min(0.42, loadTons * 0.065); // ~6.5% drop per ton on hills
    const expectedLoadedAvg = +(route.idealLoaded * (1 - weightPenalty * 0.45)).toFixed(2);
    const expectedEmptyAvg = +route.idealEmpty.toFixed(2);

    // Expected fuel consumption
    const expectedFuel = (loadedKm / expectedLoadedAvg) + (emptyKm / expectedEmptyAvg);
    const expectedOverallAvg = +(totalKm / Math.max(0.1, expectedFuel)).toFixed(2);

    // Split Effective Averages
    const ratio = overallAvg / expectedOverallAvg;
    const loadedAvgEst = +(expectedLoadedAvg * ratio).toFixed(2);
    const emptyAvgEst = +(expectedEmptyAvg * ratio).toFixed(2);

    let diagnosis = '';
    const diff = +(overallAvg - expectedOverallAvg).toFixed(2);

    if (diff >= -0.4) {
      diagnosis = `✅ शानदार परफॉरमेंस (${overallAvg.toFixed(2)} km/L): ${route.name} पर ${params.loadDesc || 'इस लोड'} के साथ अपेक्षित एवरेज (${expectedOverallAvg} km/L) के बराबर या बेहतर रहा। ड्राइवर और इंजन दोनों फिट हैं!`;
    } else if (loadTons >= 3.0 && loadedKm > emptyKm && diff >= -1.6) {
      diagnosis = `🏔️ लोड एवं चढ़ाई प्रभाव (${overallAvg.toFixed(2)} km/L): एवरेज थोड़ा कम है क्योंकि ${route.name} की खड़ी चढ़ाई पर ${params.loadDesc} (${loadTons} Ton) के साथ ${loadedKm} KM गाड़ी चली। यह पहाड़ी मार्ग के अनुसार सामान्य है।`;
    } else if (emptyKm >= loadedKm && diff < -1.2) {
      diagnosis = `🚨 ड्राइवर / फ्यूल अलर्ट (${overallAvg.toFixed(2)} km/L vs अपेक्षित ${expectedOverallAvg} km/L): गाड़ी ${emptyKm} KM खाली चली फिर भी ${(expectedOverallAvg - overallAvg).toFixed(1)} km/L एवरेज टूटा! कारण: ड्राइवर द्वारा गलत गियर/आइडलिंग (${params.driverName || 'Driver'}), टायर प्रेशर कम होना या ~${Math.max(1, (fuel - expectedFuel).toFixed(1))} L ईंधन गड़बड़ी की जाँच करें।`;
    } else {
      diagnosis = `🔧 मेंटेनेंस / रूट अलर्ट (${overallAvg.toFixed(2)} km/L): ${route.name} के हिसाब से लगभग ${(fuel - expectedFuel).toFixed(1)} लीटर डीज़ल अधिक लगा है। एयर फ़िल्टर, इंजेक्टर या क्लच प्लेट और ड्राइवर की ड्राइविंग जाँचें।`;
    }

    return {
      overallAvg: +overallAvg.toFixed(2),
      loadedAvgEst,
      emptyAvgEst,
      expectedOverallAvg,
      extraFuelLitres: +(fuel - expectedFuel).toFixed(2),
      diagnosis
    };
  }

  // Calculate Days Remaining for Documents
  function getDaysLeft(dateStr) {
    if (!dateStr) return 999;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Render Smart Fleet & Vehicle Intelligence Section inside Khata Portal
  window.renderKhataVehicleIntel = function(targetContainer) {
    const store = getStore();
    const veh = store.vehicles[0];
    const logs = veh.logs || [];

    // Compute Best, Worst, Avg Stats
    const allAvgs = logs.map(l => l.overallAvg);
    const bestAvg = allAvgs.length ? Math.max(...allAvgs).toFixed(2) : '0.00';
    const worstAvg = allAvgs.length ? Math.min(...allAvgs).toFixed(2) : '0.00';
    const avgLoaded = logs.length
      ? (logs.reduce((s, l) => s + (l.loadedAvgEst || l.overallAvg), 0) / logs.length).toFixed(2)
      : '0.00';
    const avgEmpty = logs.length
      ? (logs.reduce((s, l) => s + (l.emptyAvgEst || l.overallAvg), 0) / logs.length).toFixed(2)
      : '0.00';

    // Check Document & Service Alerts
    const docAlerts = [];
    const docLabels = {
      insurance: '🛡️ इंश्योरेंस (Insurance)',
      puc: '💨 प्रदूषण (PUC)',
      fitness: '📋 फिटनेस (Fitness)',
      permit: '🛣️ परमिट (Permit)',
      tax: '🏛️ रोड टैक्स (Tax)'
    };
    Object.keys(docLabels).forEach(k => {
      const days = getDaysLeft(veh.docs[k]);
      if (days <= 30) {
        docAlerts.push({
          label: docLabels[k],
          date: veh.docs[k],
          days,
          urgent: days <= 10
        });
      }
    });
    const kmToService = (veh.docs.nextServiceKm || 50000) - (veh.docs.lastOdo || 0);

    const wrap = targetContainer || document.getElementById('khata-fleet-intel-root');
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="glass-card fade-in" style="border:1px solid rgba(244,180,26,0.45);margin-top:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div>
            <span style="font-size:11px;background:rgba(244,180,26,0.2);color:#ffd35c;padding:3px 10px;border-radius:99px;font-weight:700;">
              🚛 SMART FLEET & AVERAGE PORTAL v7.0
            </span>
            <h3 style="margin:6px 0 0;font-size:19px;color:#fff;">गाड़ी एवरेज, लोड स्प्लिट, रूट कारण एवं पेपर अलर्ट</h3>
          </div>
          <select id="kvi-veh-select" style="width:auto;min-width:210px;padding:8px 12px;font-size:13.5px;background:rgba(0,0,0,0.45);color:#ffd35c;border:1px solid #f4b41a;">
            ${store.vehicles.map((v, idx) => `<option value="${idx}">${v.vehNo}</option>`).join('')}
          </select>
        </div>

        <!-- Early Warning Alerts Banner (Docs & Service) -->
        <div style="background:rgba(220,38,38,0.18);border:1px solid rgba(248,113,113,0.5);border-radius:14px;padding:12px;margin-bottom:14px;">
          <div style="font-weight:800;color:#fca5a5;font-size:14px;margin-bottom:6px;">
            🔔 गाड़ी पेपर एवं सर्विस एडवांस अलर्ट (Early Expiry & Maintenance Radar)
          </div>
          ${docAlerts.map(a => `
            <div style="font-size:13px;color:#fff;margin:4px 0;display:flex;justify-content:space-between;">
              <span>${a.label} (वैधता: ${a.date})</span>
              <b style="color:${a.urgent ? '#ff4d4d' : '#ffd35c'};">${a.days < 0 ? 'समाप्त हो गया!' : a.days + ' दिन शेष'}</b>
            </div>
          `).join('')}
          <div style="font-size:13px;color:#93c5fd;margin-top:6px;display:flex;justify-content:space-between;">
            <span>🛠️ अगली इंजन ऑयल / सर्विस (${veh.docs.nextServiceKm} KM पर)</span>
            <b style="color:${kmToService <= 600 ? '#ffd35c' : '#4ade80'};">सिर्फ ${kmToService} KM बाकी (MAK Lubes 10% छूट उपलब्ध)</b>
          </div>
        </div>

        <!-- 4 Summary KPI Boxes: Loaded Avg, Empty Avg, Best Avg, Worst Avg -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">
          <div style="background:rgba(255,255,255,0.06);padding:12px;border-radius:14px;border-left:4px solid #38bdf8;">
            <small class="text-mut">📦 लोड में एवरेज (Loaded Avg)</small>
            <div style="font-size:22px;font-weight:900;color:#38bdf8;font-family:'Orbitron',sans-serif;">${avgLoaded} km/L</div>
            <small style="font-size:11px;color:#cbd5e1;">पहाड़ी चढ़ाई + भार के साथ</small>
          </div>
          <div style="background:rgba(255,255,255,0.06);padding:12px;border-radius:14px;border-left:4px solid #4ade80;">
            <small class="text-mut">🍃 खाली गाड़ी एवरेज (Empty Avg)</small>
            <div style="font-size:22px;font-weight:900;color:#4ade80;font-family:'Orbitron',sans-serif;">${avgEmpty} km/L</div>
            <small style="font-size:11px;color:#cbd5e1;">बिना लोड / वापसी ट्रिप</small>
          </div>
          <div style="background:rgba(255,255,255,0.06);padding:12px;border-radius:14px;border-left:4px solid #ffd35c;">
            <small class="text-mut">🏆 सबसे ज़्यादा एवरेज (Best Record)</small>
            <div style="font-size:20px;font-weight:900;color:#ffd35c;font-family:'Orbitron',sans-serif;">${bestAvg} km/L</div>
          </div>
          <div style="background:rgba(255,255,255,0.06);padding:12px;border-radius:14px;border-left:4px solid #f87171;">
            <small class="text-mut">⚠️ सबसे कम एवरेज (Lowest Record)</small>
            <div style="font-size:20px;font-weight:900;color:#f87171;font-family:'Orbitron',sans-serif;">${worstAvg} km/L</div>
          </div>
        </div>

        <!-- Sub-Navigation Tabs inside Fleet Portal -->
        <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;">
          <button class="btn" id="kvi-tab-btn-entry" style="flex:1;padding:10px;font-size:13px;">➕ नई मीटर रीडिंग & लोड स्प्लिट</button>
          <button class="btn" id="kvi-tab-btn-docs" style="flex:1;padding:10px;font-size:13px;background:rgba(255,255,255,0.12);color:#fff;">📄 गाड़ी पेपर & सर्विस डेट्स</button>
          <button class="btn" id="kvi-tab-btn-pass" style="flex:1;padding:10px;font-size:13px;background:rgba(255,255,255,0.12);color:#fff;">📲 ड्राइवर डिजिटल पर्ची (QR Pass)</button>
        </div>

        <!-- TAB 1: New Odometer, Split Load/Empty KM & Route Diagnosis Form -->
        <div id="kvi-sec-entry" style="background:rgba(0,0,0,0.25);padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);margin-bottom:16px;">
          <h4 style="margin:0 0 10px;color:#ffd35c;">📟 मीटर रीडिंग, लोड-खाली KM स्प्लिट एवं पहाड़ी रूट एनालाइज़र</h4>
          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1;">
              <small class="text-mut">📅 तारीख (Date)</small>
              <input type="date" id="kvi-date" value="2026-11-02" style="letter-spacing:0;text-align:left;padding:10px;">
            </div>
            <div style="flex:1;">
              <small class="text-mut"> पिछली रीडिंग (Prev KM)</small>
              <input type="number" id="kvi-prev-odo" value="${veh.docs.lastOdo || 47920}" style="letter-spacing:0;padding:10px;">
            </div>
            <div style="flex:1;">
              <small class="text-mut">नई मीटर रीडिंग (New KM)</small>
              <input type="number" id="kvi-curr-odo" value="${(veh.docs.lastOdo || 47920) + 360}" style="letter-spacing:0;padding:10px;">
            </div>
          </div>

          <div style="background:rgba(244,180,26,0.12);padding:8px 12px;border-radius:10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>🛣️ कुल रनिंग (Auto Running KM):</span>
            <b id="kvi-total-km-lbl" style="font-size:18px;color:#ffd35c;">360 KM</b>
          </div>

          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1;">
              <small class="text-mut">📦 लोड के साथ कितने KM चली?</small>
              <input type="number" id="kvi-loaded-km" value="220" style="letter-spacing:0;padding:10px;">
            </div>
            <div style="flex:1;">
              <small class="text-mut">🍃 खाली (बिना लोड) कितने KM चली?</small>
              <input type="number" id="kvi-empty-km" value="140" style="letter-spacing:0;padding:10px;">
            </div>
          </div>

          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1.4;">
              <small class="text-mut">⚖️ कितना लोड था? (Type करके लिखें: जैसे 4 Ton सीमेंट / 12 सवारी)</small>
              <input type="text" id="kvi-load-desc" value="3.8 Ton (सीमेंट एवं सरिया)" style="letter-spacing:0;text-align:left;padding:10px;">
            </div>
            <div style="flex:0.8;">
              <small class="text-mut">लोड वज़न (Ton में)</small>
              <input type="number" step="0.1" id="kvi-load-tons" value="3.8" style="letter-spacing:0;padding:10px;">
            </div>
          </div>

          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1;">
              <small class="text-mut">⛽ कुल तेल डलवाया (Litres)</small>
              <input type="number" step="0.1" id="kvi-fuel-l" value="32.5" style="letter-spacing:0;padding:10px;">
            </div>
            <div style="flex:1;">
              <small class="text-mut">👤 ड्राइवर का नाम</small>
              <input type="text" id="kvi-driver" value="रमेश सिंह" style="letter-spacing:0;text-align:left;padding:10px;">
            </div>
            <div style="flex:1;">
              <small class="text-mut">💰 ट्रिप भाड़ा (Optional ₹)</small>
              <input type="number" id="kvi-freight" value="8500" style="letter-spacing:0;padding:10px;">
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <small class="text-mut">🏔️ कुमाऊँ / लोकल पहाड़ी रूट चुनें (Route Analyzer के लिए)</small>
            <select id="kvi-route" style="margin-top:4px;">
              ${PAHADI_ROUTES.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
            </select>
          </div>

          <button class="btn" id="kvi-save-trip-btn">⚡ एवरेज, लोड प्रभाव एवं असली कारण निकालें (Save & Analyze)</button>
        </div>

        <!-- TAB 2: Vehicle Papers & Service Dates Editor -->
        <div id="kvi-sec-docs" style="display:none;background:rgba(0,0,0,0.25);padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);margin-bottom:16px;">
          <h4 style="margin:0 0 10px;color:#ffd35c;">📄 गाड़ी के कागज़ात (Papers) और सर्विस वैधता अपडेट करें</h4>
          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1;"><small class="text-mut">इंश्योरेंस खत्म होने की तारीख</small><input type="date" id="doc-ins" value="${veh.docs.insurance}" style="letter-spacing:0;"></div>
            <div style="flex:1;"><small class="text-mut">प्रदूषण (PUC) वैधता</small><input type="date" id="doc-puc" value="${veh.docs.puc}" style="letter-spacing:0;"></div>
          </div>
          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1;"><small class="text-mut">फिटनेस (Fitness) वैधता</small><input type="date" id="doc-fit" value="${veh.docs.fitness}" style="letter-spacing:0;"></div>
            <div style="flex:1;"><small class="text-mut">परमिट (Permit) वैधता</small><input type="date" id="doc-per" value="${veh.docs.permit}" style="letter-spacing:0;"></div>
          </div>
          <div class="row" style="margin-bottom:10px;">
            <div style="flex:1;"><small class="text-mut">रोड टैक्स (Tax) वैधता</small><input type="date" id="doc-tax" value="${veh.docs.tax}" style="letter-spacing:0;"></div>
            <div style="flex:1;"><small class="text-mut">अगली इंजन सर्विस (Odo KM पर)</small><input type="number" id="doc-srv" value="${veh.docs.nextServiceKm}" style="letter-spacing:0;"></div>
          </div>
          <button class="btn" id="kvi-save-docs-btn">💾 सभी वैधता तारीखें सेव करें (Auto Alert On)</button>
        </div>

        <!-- TAB 3: Digital Driver Fuel Pass (OTP / QR) -->
        <div id="kvi-sec-pass" style="display:none;background:rgba(0,0,0,0.25);padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,0.12);margin-bottom:16px;">
          <h4 style="margin:0 0 10px;color:#ffd35c;">📲 ड्राइवर के लिए 1-Time डिजिटल तेल पर्ची बनाएँ (Zero Chori)</h4>
          <div class="row" style="margin-bottom:8px;">
            <div style="flex:1;"><small class="text-mut">गाड़ी नंबर</small><input type="text" id="pass-veh" value="${veh.vehNo}" style="letter-spacing:0;"></div>
            <div style="flex:1;"><small class="text-mut">डीज़ल/पेट्रोल मात्रा (Litres या ₹)</small><input type="text" id="pass-qty" value="40 Litres HSD" style="letter-spacing:0;"></div>
          </div>
          <button class="btn" id="kvi-gen-pass-btn">🔐 डिजिटल टोकन कोड बनाएँ & ड्राइवर को WhatsApp भेजें</button>
          <div id="kvi-pass-output" style="margin-top:10px;"></div>
        </div>

        <!-- Complete Vehicle Trip & Root-Cause History Table -->
        <h4 style="margin:6px 0 10px;color:#ffd35c;">📊 गाड़ी का पूरा एवरेज रिकॉर्ड एवं AI रूट/ड्राइवर विश्लेषण हिस्ट्री</h4>
        <div id="kvi-history-list" style="display:flex;flex-direction:column;gap:10px;">
          ${logs.map(l => {
            const routeObj = PAHADI_ROUTES.find(r => r.id === l.routeId) || PAHADI_ROUTES[0];
            const fuelCost = Math.round(l.fuelLitres * (l.fuelRate || 87.52));
            const costPerKm = (fuelCost / Math.max(1, l.totalKm)).toFixed(2);
            const netProfit = (l.freightEarned || 0) - fuelCost;
            return `
              <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <b style="color:#ffd35c;font-size:14.5px;">📅 ${l.date} • ${routeObj.name.split('(')[0]}</b>
                  <span style="background:rgba(16,185,129,0.2);color:#4ade80;padding:3px 10px;border-radius:99px;font-weight:800;font-size:13px;">
                    Overall: ${l.overallAvg} km/L
                  </span>
                </div>
                <div style="font-size:12.5px;color:#cbd5e1;margin-bottom:6px;">
                  📟 मीटर: <b>${l.prevOdo} → ${l.currOdo} (${l.totalKm} KM)</b> &nbsp;|&nbsp;
                  📦 लोड में: <b>${l.loadedKm} KM (${l.loadDesc})</b> &nbsp;|&nbsp;
                  🍃 खाली: <b>${l.emptyKm} KM</b>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;margin-bottom:8px;">
                  <span style="background:rgba(56,189,248,0.15);color:#7dd3fc;padding:3px 8px;border-radius:6px;">
                    📦 लोड एवरेज: <b>${l.loadedAvgEst} km/L</b>
                  </span>
                  <span style="background:rgba(74,222,128,0.15);color:#86efac;padding:3px 8px;border-radius:6px;">
                    🍃 खाली एवरेज: <b>${l.emptyAvgEst} km/L</b>
                  </span>
                  <span style="background:rgba(244,180,26,0.15);color:#fde047;padding:3px 8px;border-radius:6px;">
                    💸 खर्चा: <b>₹${costPerKm}/KM (कुल ₹${fuelCost})</b>
                  </span>
                  ${l.freightEarned ? `<span style="background:rgba(255,255,255,0.12);color:#fff;padding:3px 8px;border-radius:6px;">📈 शुद्ध बचत: <b>₹${netProfit}</b></span>` : ''}
                </div>
                <div style="background:rgba(0,0,0,0.35);border-left:3px solid #f4b41a;padding:8px 10px;border-radius:8px;font-size:12.5px;line-height:1.45;color:#f8fafc;">
                  ${l.diagnosis}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind interactive events
    const prevInp = document.getElementById('kvi-prev-odo');
    const currInp = document.getElementById('kvi-curr-odo');
    const loadKmInp = document.getElementById('kvi-loaded-km');
    const emptyKmInp = document.getElementById('kvi-empty-km');
    const totalLbl = document.getElementById('kvi-total-km-lbl');

    const syncRunningKm = (changedField) => {
      const p = parseFloat(prevInp.value) || 0;
      const c = parseFloat(currInp.value) || 0;
      const tot = Math.max(0, c - p);
      totalLbl.textContent = `${tot} KM`;
      if (changedField === 'loaded') {
        const lk = Math.min(tot, Math.max(0, parseFloat(loadKmInp.value) || 0));
        emptyKmInp.value = Math.max(0, tot - lk);
      } else if (changedField === 'empty') {
        const ek = Math.min(tot, Math.max(0, parseFloat(emptyKmInp.value) || 0));
        loadKmInp.value = Math.max(0, tot - ek);
      } else {
        const lk = Math.min(tot, parseFloat(loadKmInp.value) || 0);
        emptyKmInp.value = Math.max(0, tot - lk);
      }
    };

    prevInp.addEventListener('input', () => syncRunningKm('odo'));
    currInp.addEventListener('input', () => syncRunningKm('odo'));
    loadKmInp.addEventListener('input', () => syncRunningKm('loaded'));
    emptyKmInp.addEventListener('input', () => syncRunningKm('empty'));

    // Tab switching
    const secEntry = document.getElementById('kvi-sec-entry');
    const secDocs = document.getElementById('kvi-sec-docs');
    const secPass = document.getElementById('kvi-sec-pass');

    document.getElementById('kvi-tab-btn-entry').addEventListener('click', () => {
      secEntry.style.display = ''; secDocs.style.display = 'none'; secPass.style.display = 'none';
    });
    document.getElementById('kvi-tab-btn-docs').addEventListener('click', () => {
      secEntry.style.display = 'none'; secDocs.style.display = ''; secPass.style.display = 'none';
    });
    document.getElementById('kvi-tab-btn-pass').addEventListener('click', () => {
      secEntry.style.display = 'none'; secDocs.style.display = 'none'; secPass.style.display = '';
    });

    // Save Trip & Run Route/Driver Diagnosis
    document.getElementById('kvi-save-trip-btn').addEventListener('click', () => {
      const prevOdo = parseFloat(prevInp.value) || 0;
      const currOdo = parseFloat(currInp.value) || 0;
      const totalKm = Math.max(1, currOdo - prevOdo);
      const loadedKm = parseFloat(loadKmInp.value) || 0;
      const emptyKm = parseFloat(emptyKmInp.value) || 0;
      const loadDesc = document.getElementById('kvi-load-desc').value;
      const loadTons = parseFloat(document.getElementById('kvi-load-tons').value) || 0;
      const fuelLitres = parseFloat(document.getElementById('kvi-fuel-l').value) || 1;
      const driverName = document.getElementById('kvi-driver').value;
      const freightEarned = parseFloat(document.getElementById('kvi-freight').value) || 0;
      const routeId = document.getElementById('kvi-route').value;
      const date = document.getElementById('kvi-date').value;

      const result = analyzeTripMileage({
        totalKm, loadedKm, emptyKm, loadDesc, loadTons, fuelLitres, driverName, routeId
      });

      const newLog = {
        id: 'trip_' + Date.now(),
        date, prevOdo, currOdo, totalKm, loadedKm, emptyKm,
        loadDesc, loadTons, fuelLitres, fuelRate: 87.52,
        routeId, driverName, freightEarned,
        overallAvg: result.overallAvg,
        loadedAvgEst: result.loadedAvgEst,
        emptyAvgEst: result.emptyAvgEst,
        diagnosis: result.diagnosis
      };

      store.vehicles[0].logs.unshift(newLog);
      store.vehicles[0].docs.lastOdo = currOdo;
      saveStore(store);
      window.renderKhataVehicleIntel(wrap);
    });

    // Save Document Expiry Dates
    document.getElementById('kvi-save-docs-btn').addEventListener('click', () => {
      store.vehicles[0].docs.insurance = document.getElementById('doc-ins').value;
      store.vehicles[0].docs.puc = document.getElementById('doc-puc').value;
      store.vehicles[0].docs.fitness = document.getElementById('doc-fit').value;
      store.vehicles[0].docs.permit = document.getElementById('doc-per').value;
      store.vehicles[0].docs.tax = document.getElementById('doc-tax').value;
      store.vehicles[0].docs.nextServiceKm = parseFloat(document.getElementById('doc-srv').value) || 50000;
      saveStore(store);
      window.renderKhataVehicleIntel(wrap);
    });

    // Generate 1-Time Digital Driver Pass
    document.getElementById('kvi-gen-pass-btn').addEventListener('click', () => {
      const code = 'MZ-' + Math.floor(100000 + Math.random() * 900000);
      const vNo = document.getElementById('pass-veh').value;
      const qty = document.getElementById('pass-qty').value;
      const out = document.getElementById('kvi-pass-output');
      const waText = `⛽ *माज़दा ऑयल कंपनी (डिजिटल ईंधन पर्ची)*\n🔑 *1-Time Token:* *${code}*\n🚛 गाड़ी: ${vNo}\n🛢️ मात्रा: ${qty}\n📍 रानीखेत रोड, बमस्यून`;
      out.innerHTML = `
        <div style="background:rgba(16,185,129,0.2);border:1px solid #10b981;padding:12px;border-radius:12px;text-align:center;">
          <div style="font-size:12px;color:#a7f3d0;">ड्राइवर को यह कोड पंप ऑपरेटर को दिखाने को कहें:</div>
          <div style="font-size:26px;font-weight:900;color:#ffd35c;letter-spacing:3px;margin:4px 0;">${code}</div>
          <a href="https://wa.me/?text=${encodeURIComponent(waText)}" target="_blank" class="btn" style="display:inline-block;width:auto;padding:8px 16px;margin-top:6px;font-size:13px;text-decoration:none;">
            📲 ड्राइवर को WhatsApp करें
          </a>
        </div>
      `;
    });
  };

  // Auto-mount inside party.html AND main app's Customer/Party Ledger View
  const autoMountFleetIntel = () => {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    const checkAndInject = () => {
      if (document.getElementById('khata-fleet-intel-root')) return;
      // If we are on party.html or inside a party ledger screen
      const isPartyPage = window.location.pathname.includes('party') || document.title.includes('पार्टी');
      const hasCustomerView = document.querySelector('.cibil-card') || document.querySelector('.ledger-summary');

      if (isPartyPage || hasCustomerView) {
        const container = document.createElement('div');
        container.id = 'khata-fleet-intel-root';
        const targetParent = document.querySelector('main') || appEl;
        targetParent.appendChild(container);
        window.renderKhataVehicleIntel(container);
      }
    };

    setTimeout(checkAndInject, 900);
    const obs = new MutationObserver(() => checkAndInject());
    obs.observe(appEl, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountFleetIntel);
  } else {
    autoMountFleetIntel();
  }
})();
