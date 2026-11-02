/* =========================================================================
   SUPER_ADMIN.JS - Neeraj Master Control & 6-Month Realistic Demo Generator
   - Create New Pumps with Custom Logo / Brand & Initial Rates
   - 1-Click Realistic 6-Month Demo Generator (All 4 Nozzles P1-P4 & D1-D4,
     Proper Debit/Credit Ledger, Bank Deposits, UPI/Paytm, Expenses & CIBIL)
   - 1-Click All Clear (Reset / Wipe Demo Data safely)
   - Remove / Delete Pump Button with Full DB Cleanup
   ========================================================================= */
(function () {
  'use strict';

  const APP = window.APP || {};

  function isSuperAdmin() {
    const user = APP.S?.user?.email || '';
    const u = user.toLowerCase();
    return u === 'neeraj@mazda-pump.in' || u === 'neeraj@mazda.in';
  }

  APP.isSuperAdmin = isSuperAdmin;

  APP.views = APP.views || {};
  APP.views.super_admin = async function () {
    const main = document.querySelector('#main');
    if (!main) return;
    if (!isSuperAdmin()) {
      return APP.toast ? APP.toast('केवल सुपर एडमिन (Neeraj) के लिए') : alert('अनुमति नहीं');
    }

    main.innerHTML = `<p class="mut" style="text-align:center;padding:20px;">सुपर एडमिन कंट्रोल लोड हो रहा है…</p>`;

    let pumps = [];
    try {
      const rawDb = firebase.firestore();
      const snap = await rawDb.collection('pumps').get();
      pumps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Fetch pumps error', e);
    }

    let pumpsHtml = pumps.map(p => `
      <div class="card" style="margin-bottom:10px;padding:12px;border-left:4px solid ${p.brand === 'hpcl' ? '#e11d48' : p.brand === 'iocl' ? '#f97316' : '#0b3d91'};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <b style="font-size:16px;">${p.name || p.id}</b>
            <span class="chip" style="font-size:11px;margin-left:6px;text-transform:uppercase;">${p.brand || 'BPCL'}</span>
            <div class="mut" style="font-size:12px;margin-top:2px;">ID: <code>${p.id}</code> | PIN: <b>${p.ownerPin || '9999'}</b></div>
            <div class="mut" style="font-size:11px;">📍 ${p.address || 'पता नहीं'} · 📞 ${p.phone || '-'} | रेट: P ₹${p.rates?.petrol || 100} | D ₹${p.rates?.diesel || 95}</div>
          </div>
          <div style="text-align:right;">
            <button class="btn sm g" data-switch="${p.id}" style="margin-bottom:4px;">👁️ इस पंप में जाएँ</button>
          </div>
        </div>

        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ddd;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn sm w" data-demo="${p.id}" style="background:#e8f4fd;color:#0369a1;border-color:#bae6fd;">🚀 6 महीने का 100% रियल डेमो डेटा</button>
          <button class="btn sm o" data-clear="${p.id}" style="background:#fff4e5;color:#b26a00;border-color:#fed7aa;">🗑️ ऑल-क्लियर (Reset)</button>
          <button class="btn sm r" data-remove="${p.id}" style="background:#fef2f2;color:#991b1b;border-color:#fecaca;">❌ पंप डिलीट (Remove)</button>
          <button class="btn sm w" data-share-links="${p.id}">📲 शेयर लिंक्स</button>
        </div>
      </div>
    `).join('');

    main.innerHTML = `
      <div class="card" style="background:linear-gradient(135deg, #04091a 0%, #0a1830 50%, #0d2a66 100%);color:#fff;border-radius:16px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h2 style="margin:0;color:#f4b41a;font-size:20px;">👑 Super Admin (God Mode)</h2>
            <div style="font-size:12px;opacity:0.85;margin-top:4px;">मास्टर कंट्रोल · नीरज</div>
          </div>
          <span class="chip g" style="font-size:12px;">Active (${pumps.length + 1} पंप)</span>
        </div>
      </div>

      <div class="btns" style="margin-bottom:12px;">
        <button class="btn g full" id="sa-add-pump" style="font-size:15px;padding:12px;">+ नया पंप जोड़ें (Logo & Rates Setup)</button>
      </div>

      <div class="card" style="background:#f8f9fc;border:1px solid #dde2ec;">
        <h3 style="margin:0 0 6px 0;font-size:15px;color:var(--b);">🏢 सभी पेट्रोल पंप की लिस्ट</h3>
        <div class="mut" style="font-size:12px;margin-bottom:10px;">यहाँ से किसी भी पंप का डेटा देखें, 6-महीने का रियल डेमो भरें, रीसेट करें या पंप डिलीट करें:</div>
        
        <div class="card" style="margin-bottom:10px;padding:12px;border-left:4px solid #0a7d33;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <b style="font-size:16px;">माज़दा ऑयल कंपनी (Main Headquarter)</b>
              <span class="chip g" style="font-size:11px;margin-left:6px;">MASTER</span>
              <div class="mut" style="font-size:12px;margin-top:2px;">ID: <code>mazda</code> (ओरिजिनल डेटा सुरक्षित)</div>
            </div>
            <button class="btn sm w" data-switch="mazda">🏠 मुख्य पंप</button>
          </div>
        </div>

        ${pumpsHtml}
      </div>

      <div class="btns"><button class="btn w" onclick="APP.go('more')">← वापस मेन्यू</button></div>
    `;

    document.querySelector('#sa-add-pump').onclick = () => openAddPumpModal();

    document.querySelectorAll('[data-switch]').forEach(b => {
      b.onclick = () => {
        const pid = b.dataset.switch;
        localStorage.setItem('mazda_active_pump', pid);
        APP.toast(`पंप [${pid}] पर स्विच किया गया!`);
        setTimeout(() => location.reload(), 500);
      };
    });

    document.querySelectorAll('[data-demo]').forEach(b => {
      b.onclick = () => generateSixMonthDemo(b.dataset.demo);
    });

    document.querySelectorAll('[data-clear]').forEach(b => {
      b.onclick = () => clearAllPumpData(b.dataset.clear);
    });

    document.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = () => removePumpStation(b.dataset.remove);
    });

    document.querySelectorAll('[data-share-links]').forEach(b => {
      b.onclick = () => showShareModal(b.dataset.shareLinks);
    });
  };

  // Add Pump with Custom Logo & Rate Setup
  function openAddPumpModal() {
    const rawDb = firebase.firestore();
    let uploadedLogoBase64 = '';

    const m = APP.modal(`
      <h3>🏢 नया पेट्रोल पंप जोड़ें (Logo & Rates)</h3>
      <div class="mut" style="margin-bottom:12px;font-size:12px;">पंप की पूरी पहचान, शुरुआती रेट और लोगो सेट करें:</div>

      <label>पंप कोड (Short ID - बिना स्पेस, जैसे: shree, dobhal)</label>
      <input id="np-id" placeholder="dobhal" style="text-transform:lowercase;">

      <label>पंप का नाम (हिंदी)</label>
      <input id="np-name" placeholder="शहीद चन्दन फिलिंग स्टेशन">

      <label>कंपनी ब्रांड या कस्टम लोगो</label>
      <select id="np-brand">
        <option value="bpcl">Bharat Petroleum (BPCL)</option>
        <option value="hpcl">Hindustan Petroleum (HPCL)</option>
        <option value="iocl">Indian Oil (IOCL)</option>
        <option value="custom">खुद का कस्टम लोगो अपलोड करें</option>
      </select>

      <div id="np-logo-wrap" style="display:none;margin-top:8px;">
        <label>पंप का गोल लोगो इमेज (PNG/JPG)</label>
        <input type="file" id="np-logo-file" accept="image/*">
      </div>

      <div class="row" style="margin-top:8px;">
        <div><label>पेट्रोल रेट (₹/L)</label><input id="np-rp" value="100.23" inputmode="decimal"></div>
        <div><label>डीज़ल रेट (₹/L)</label><input id="np-rd" value="95.68" inputmode="decimal"></div>
      </div>

      <div class="row">
        <div><label>फोन नंबर</label><input id="np-phone" placeholder="9837571535" inputmode="tel"></div>
        <div><label>मालिक VIP PIN (4-अंक)</label><input id="np-pin" placeholder="5555" maxlength="4"></div>
      </div>

      <label>पंप का पूरा पता</label>
      <input id="np-addr" placeholder="बरेली - नैनीताल रोड, उत्तराखंड">

      <label>Paytm / UPI QR ID</label>
      <input id="np-upi" placeholder="dobhal@ptaxis">

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="np-save">✅ पंप बनाएं और चालू करें</button>
        <button class="btn w" id="np-close">रद्द करें</button>
      </div>
    `);

    m.querySelector('#np-brand').onchange = (e) => {
      m.querySelector('#np-logo-wrap').style.display = e.target.value === 'custom' ? '' : 'none';
    };

    m.querySelector('#np-logo-file').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = 150; cv.height = 150;
          cv.getContext('2d').drawImage(img, 0, 0, 150, 150);
          uploadedLogoBase64 = cv.toDataURL('image/png', 0.9);
          APP.toast('लोगो लोड हो गया ✔');
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    };

    m.querySelector('#np-close').onclick = () => m.close();

    m.querySelector('#np-save').onclick = async () => {
      const pid = m.querySelector('#np-id').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const name = m.querySelector('#np-name').value.trim();
      const brand = m.querySelector('#np-brand').value;
      const phone = m.querySelector('#np-phone').value.trim();
      const ownerPin = m.querySelector('#np-pin').value.trim() || '9999';
      const address = m.querySelector('#np-addr').value.trim();
      const upi = m.querySelector('#np-upi').value.trim() || 'paytmqr@upi';
      const rp = Number(m.querySelector('#np-rp').value) || 100.23;
      const rd = Number(m.querySelector('#np-rd').value) || 95.68;

      if (!pid || !name) return APP.toast('पंप आईडी और नाम अनिवार्य हैं');

      const btn = m.querySelector('#np-save');
      btn.disabled = true;
      btn.textContent = 'बना रहे हैं...';

      try {
        await rawDb.collection('pumps').doc(pid).set({
          id: pid,
          name, nameEn: name, brand, phone, ownerPin, address, upi,
          customLogo: uploadedLogoBase64 || '',
          activeNozzles: ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'],
          rates: { petrol: rp, diesel: rd },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: 'Neeraj'
        }, { merge: true });

        APP.toast('✅ नया पंप सफलतापूर्वक जुड़ गया!');
        m.close();
        APP.views.super_admin();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'सेव करें';
        APP.toast('एरर: ' + e.message);
      }
    };
  }

  // 1-Click 100% Real Demo Data Generator
  async function generateSixMonthDemo(pumpId) {
    if (!confirm(`क्या आप [${pumpId}] के लिए 6 महीने का 100% रियल जैसा डेटा भरना चाहते हैं?\n\nइसमें P1-P4 और D1-D4 सभी 8 नोज़ल, टैंकर डिप, डेबिट-क्रेडिट लेजर, बैंक डिपॉजिट, UPI/Paytm और खर्चे शामिल होंगे!`)) return;

    APP.toast('🚀 100% रियल जैसा डेमो डेटा जनरेट हो रहा है...');
    const rawDb = firebase.firestore();
    const pumpRef = rawDb.collection('pumps').doc(pumpId);

    try {
      const demoParties = [
        { id: 'party_rawat', name: 'रावत ब्रदर्स ट्रांसपोर्ट', phone: '9876500001', vehicles: ['UK01CA1122', 'UK01CA3344'], bal: 42500, limit: 100000, portalCode: '100101' },
        { id: 'party_kumaon', name: 'कुमाऊँ मोटर्स कॉर्पोरेशन', phone: '9876500002', vehicles: ['UK04PA5566', 'UK04PA7788'], bal: 68400, limit: 150000, portalCode: '100102' },
        { id: 'party_sharma', name: 'शर्मा ट्रेडर्स & सप्लायर्स', phone: '9876500003', vehicles: ['UK07CB9900'], bal: 15200, limit: 50000, portalCode: '100103' },
        { id: 'party_hill', name: 'हिल रोडवेज लॉजिस्टिक्स', phone: '9876500004', vehicles: ['UK01TA2468', 'UK01TA1357'], bal: 95000, limit: 200000, portalCode: '100104' },
        { id: 'party_bisht', name: 'बिष्ट जी कॉन्ट्रैक्टर', phone: '9876500005', vehicles: ['UK01EA4321'], bal: -12000, limit: 40000, portalCode: '100105' }
      ];

      /* =========================================================================
   SUPER_ADMIN.JS (v4 - PURE REAL DATA GENERATOR)
   Is file me P1-P4, D1-D4, Bank, CIBIL, Party Ledger sab real data generate hoga.
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.db) return;
  const db = APP.db;

  const num = x => Number(x) || 0;
  const r2 = x => Math.round(num(x) * 100) / 100;
  const pad = n => String(n).padStart(2, '0');
  const formatDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  window.superAdminGenerateDemo = async function() {
    const pid = window.PUMP_SYSTEM?.activePumpId;
    if (!pid) return alert("Pump ID nahi mili.");
    if (pid === 'mazda' && !confirm("Aap MAZDA ka original data overwrite karne ja rahe hain. Kya aap sure hain?")) return;

    if (!confirm("6 mahine ka 100% REAL DATA (P1-P4, D1-D4, Bank, CIBIL) generate hoga. Purana delete ho jayega. Ready?")) return;

    // 8 Nozzles Fix
    const nozzles = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
    const daysToGen = 180; // 6 Months
    const today = new Date();
    
    // 4 Real Parties (for Ledger & CIBIL)
    const parties = [
      { name: "Shri Jeevan Dev Transport", phone: "9876543210", limit: 50000, cibil: 780, opening: 15000 },
      { name: "Kumaon Roadlines", phone: "9876543211", limit: 100000, cibil: 820, opening: 25000 },
      { name: "Almora Taxi Union", phone: "9876543212", limit: 20000, cibil: 650, opening: 5000 },
      { name: "Bamsyun Bus Stand", phone: "9876543213", limit: 15000, cibil: 710, opening: 2000 }
    ];

    try {
      alert("⏳ Real Data ban raha hai... Thoda waqt lagega, window close mat karna.");
      
      // Clear old data
      const cols = ['days', 'parties', 'bank_tx', 'tanker_reports', 'dip_chart', 'audit'];
      for (let col of cols) {
        const snap = await db.collection(col).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      // Add Parties
      const partyRefs = [];
      for (let p of parties) {
        const ref = await db.collection('parties').add(p);
        partyRefs.push({ id: ref.id, ...p });
      }

      // Generate 180 Days
      for (let i = daysToGen; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d);

        // Rates fluctuate daily
        const rateP = 100.00 + (Math.sin(i / 10) * 2); 
        const rateD = 90.00 + (Math.cos(i / 10) * 1.5);
        
        let dayData = {
          date: dateStr,
          rateP: r2(rateP),
          rateD: r2(rateD),
          nz: {}, // Nozzle readings
          paytm: 0, swipe: 0, cashGiven: 0,
          kharcha: 0, driverInaam: 0, chaiKhana: 0,
          credits: [], deposits: []
        };

        let totalSaleAmt = 0;

        // 1. Fill ALL 8 Nozzles (P1-P4, D1-D4)
        for (let nz of nozzles) {
          const isPetrol = nz.startsWith('p');
          // Petrol sells less, Diesel sells more
          const baseSale = isPetrol ? (300 + Math.random() * 200) : (500 + Math.random() * 400); 
          const lit = r2(baseSale);
          const rate = isPetrol ? rateP : rateD;
          const amt = r2(lit * rate);
          
          // Meter reading format used by app_day.js
          // 'op' = Opening, 'cl' = Closing, 'lit' = Litres, 'amt' = Amount
          dayData.nz[nz] = { op: 0, cl: lit, test: 0, lit: lit, amt: amt }; 
          totalSaleAmt += amt;
        }
        
        // 2. Split Payments
        dayData.paytm = r2(totalSaleAmt * 0.15); // 15% Paytm/UPI
        dayData.swipe = r2(totalSaleAmt * 0.10); // 10% Card Swipe
        dayData.cashGiven = r2(totalSaleAmt * 0.60); // 60% Cash
        
        // 3. Expenses (Kharcha)
        dayData.kharcha = r2(150 + Math.random() * 300); // DG
        dayData.driverInaam = 100;
        dayData.chaiKhana = r2(50 + Math.random() * 100);

        // 4. Udhaar (Credits) & Jama (Deposits)
        if (i % 2 === 0) { 
          const p = partyRefs[Math.floor(Math.random() * partyRefs.length)];
          dayData.credits.push({ partyId: p.id, partyName: p.name, amount: r2(2000 + Math.random() * 5000) });
        }
        if (i % 3 === 0) { 
          const p = partyRefs[Math.floor(Math.random() * partyRefs.length)];
          // Mix of Cash, Paytm, Swipe, and NEFT
          const modes = ['cash', 'paytm', 'swipe', 'bank'];
          dayData.deposits.push({ 
            partyId: p.id, partyName: p.name, 
            amount: r2(3000 + Math.random() * 4000), 
            mode: modes[Math.floor(Math.random() * modes.length)] 
          });
        }

        // 5. Bank Transactions (NEFT/RTGS & Auto Settlement)
        if (i % 2 === 0) {
           await db.collection('bank_tx').add({
             date: dateStr, bankId: 'sbi_main', type: 'credit',
             amount: r2(dayData.paytm + dayData.swipe), mode: 'Settlement',
             note: 'Paytm/Swipe Auto Settlement'
           });
        }
        if (i % 5 === 0) { // Weekly Cash Deposit
           await db.collection('bank_tx').add({
             date: dateStr, bankId: 'sbi_main', type: 'credit',
             amount: r2(dayData.cashGiven * 0.8), mode: 'Cash Deposit',
             note: 'Cash Deposit by Pump'
           });
        }
        if (i % 7 === 0) { // RTGS for Tanker
           await db.collection('bank_tx').add({
             date: dateStr, bankId: 'sbi_main', type: 'debit',
             amount: r2(150000), mode: 'RTGS',
             note: 'RTGS to BPCL for Tanker'
           });
        }

        // 6. Dip Chart & Tanker Data
        if (i % 4 === 0) {
          await db.collection('tanker_reports').add({
             date: dateStr, tankerNo: 'UK-07-TA-1122', product: 'Diesel', 
             invoiceQty: 8000, receivedQty: 7990, density: 825.5
          });
        }

        // Save Day Data
        await db.collection('days').doc(dateStr).set(dayData);
      }

      alert("✅ 6 Mahine ka REAL DATA successfully generate ho gaya! Ab page refresh karein.");
      location.reload();

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  };
})();
        const dayRecord = {
          date: iso,
          status: 'submitted',
          rateP: rateP,
          rateD: rateD,
          openCash: 30000,
          paytm: paytmAmt,
          swipe: swipeAmt,
          malikDiya: malikAmt,
          kharcha: 1800,
          chaiKhana: 400,
          driverInaam: 250,
          openStockP: openStockP,
          openStockD: openStockD,
          dipP: openStockP - litP + (i % 7 === 0 ? 12000 : 0),
          dipD: openStockD - litD + (i % 4 === 0 ? 25000 : 0),
          tankerP: i % 7 === 0 ? 12000 : 0,
          tankerD: i % 4 === 0 ? 25000 : 0,
          nz: {
            p1: { o: mP1 - lp1, c: mP1, t: 5 },
            p2: { o: mP2 - lp2, c: mP2, t: 5 },
            p3: { o: mP3 - lp3, c: mP3, t: 5 },
            p4: { o: mP4 - lp4, c: mP4, t: 5 },
            d1: { o: mD1 - ld1, c: mD1, t: 5 },
            d2: { o: mD2 - ld2, c: mD2, t: 5 },
            d3: { o: mD3 - ld3, c: mD3, t: 5 },
            d4: { o: mD4 - ld4, c: mD4, t: 5 }
          },
          sum: {
            sale: sale,
            litP: litP,
            litD: litD,
            close: Math.round(sale * 0.12),
            udhar: Math.round(sale * 0.20)
          }
        };

        openStockP = dayRecord.dipP;
        openStockD = dayRecord.dipD;

        await pumpRef.collection('days').doc(iso).set(dayRecord);

        if (malikAmt > 0) {
          await pumpRef.collection('bank_deposits').add({
            bank: 'SBI',
            date: iso,
            amount: malikAmt,
            mode: 'cash',
            note: 'दैनिक बैंक जमा (SBI)',
            by: 'Manager'
          });
        }

        const party = demoParties[i % demoParties.length];
        await pumpRef.collection('ledger').add({
          partyId: party.id,
          partyName: party.name,
          vehicle: party.vehicles[0],
          fuel: 'diesel',
          date: iso,
          time: '11:15',
          kind: 'udhar',
          litre: 120,
          rate: rateD,
          amount: 120 * rateD,
          note: 'ट्रक डीजल उधार',
          by: 'Salesman'
        });

        if (i % 3 === 0) {
          await pumpRef.collection('ledger').add({
            partyId: party.id,
            partyName: party.name,
            date: iso,
            time: '16:45',
            kind: 'jama',
            mode: 'bank',
            amount: 25000,
            note: 'NEFT / बैंक भुगतान प्राप्त',
            by: 'Manager'
          });
        }
      }

      APP.toast('✅ 6 महीने का 100% रियल डेटा तैयार!');
      alert(`✅ [${pumpId}] के लिए 6 महीने का पूरा लेजर, बैंक डिपॉजिट, चारों नोज़ल (P1-P4, D1-D4) और हिसाब लोड हो गया है!`);
    } catch (e) {
      APP.toast('डेमो डेटा एरर: ' + e.message);
    }
  }

  // All Clear (Reset Data)
  async function clearAllPumpData(pumpId) {
    if (pumpId === 'mazda') {
      return alert('⚠️ सुरक्षा चेतावनी: माज़दा (Mazda) का ओरिजिनल डेटा ऑल-क्लियर नहीं किया जा सकता!');
    }

    const check = prompt(`⚠️ क्या आप सचमुच [${pumpId}] का सारा डेटा साफ करना चाहते हैं?\n\nकन्फर्म करने के लिए नीचे 'CLEAR' लिखें:`);
    if (check !== 'CLEAR') return APP.toast('कैंसिल किया गया');

    APP.toast('🗑️ डेटा साफ किया जा रहा है...');
    const rawDb = firebase.firestore();
    const pumpRef = rawDb.collection('pumps').doc(pumpId);

    const cols = ['days', 'ledger', 'parties', 'shop', 'shop_orders', 'workers', 'attendance', 'tanker_reports', 'cash_galla', 'bank_deposits'];

    try {
      for (const c of cols) {
        const snap = await pumpRef.collection(c).get();
        const batch = rawDb.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      APP.toast(`✅ [${pumpId}] का सारा डेटा पूरी तरह साफ (Reset) हो गया!`);
    } catch (e) {
      APP.toast('डिलीट एरर: ' + e.message);
    }
  }

  // Remove / Delete Pump Station entirely
  async function removePumpStation(pumpId) {
    if (pumpId === 'mazda') {
      return alert('⚠️ सुरक्षा चेतावनी: मुख्य माज़दा पंप को डिलीट नहीं किया जा सकता!');
    }

    const check = prompt(`⚠️ चेतावनी: आप पेट्रोल पंप [${pumpId}] को हमेशा के लिए डिलीट (Remove) कर रहे हैं!\n\nयह कार्रवाई वापस नहीं आ सकती। कन्फर्म करने के लिए 'DELETE' लिखें:`);
    if (check !== 'DELETE') return APP.toast('पंप डिलीट कैंसिल किया गया');

    APP.toast('🗑️ पंप हटाया जा रहा है...');
    const rawDb = firebase.firestore();
    const pumpRef = rawDb.collection('pumps').doc(pumpId);

    try {
      // First clear all subcollections
      const cols = ['days', 'ledger', 'parties', 'shop', 'shop_orders', 'workers', 'attendance', 'tanker_reports', 'cash_galla', 'bank_deposits'];
      for (const c of cols) {
        const snap = await pumpRef.collection(c).get();
        const batch = rawDb.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Finally delete the pump document itself
      await pumpRef.delete();

      APP.toast(`✅ पंप [${pumpId}] को सिस्टम से हमेशा के लिए हटा दिया गया!`);
      setTimeout(() => location.reload(), 1000);
    } catch (e) {
      APP.toast('पंप डिलीट एरर: ' + e.message);
    }
  }

  function showShareModal(pumpId) {
    const base = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    const ownerLink = `${base}owner.html?p=${pumpId}`;
    const partyLink = `${base}party.html?p=${pumpId}`;
    const appLink = `${base}index.html?p=${pumpId}`;

    APP.modal(`
      <h3>📲 लिंक्स - ${pumpId.toUpperCase()}</h3>
      <div style="background:#f4f6fa;padding:10px;border-radius:10px;margin:8px 0;word-break:break-all;font-size:12px;">
        <b>1. Main Pump App:</b><br><a href="${appLink}" target="_blank">${appLink}</a>
      </div>
      <div style="background:#f4f6fa;padding:10px;border-radius:10px;margin:8px 0;word-break:break-all;font-size:12px;">
        <b>2. Owner Control (मालिक):</b><br><a href="${ownerLink}" target="_blank">${ownerLink}</a>
      </div>
      <div style="background:#f4f6fa;padding:10px;border-radius:10px;margin:8px 0;word-break:break-all;font-size:12px;">
        <b>3. Party / Customer App (ग्राहक):</b><br><a href="${partyLink}" target="_blank">${partyLink}</a>
      </div>
    `);
  }

  const origMore = APP.views.more;
  APP.views.more = async function () {
    if (origMore) await origMore.apply(this, arguments);
    if (!isSuperAdmin()) return;

    const main = document.querySelector('#main');
    if (!main || document.querySelector('#sa-badge-btn')) return;

    const saCard = document.createElement('div');
    saCard.className = 'card';
    saCard.style.cssText = 'background:linear-gradient(135deg, #0a2f6b, #001233);border:2px solid #f4b41a;color:#fff;margin-top:12px;';
    saCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <b style="color:#f4b41a;font-size:16px;">👑 Super Admin (God Mode)</b>
          <div style="font-size:11px;opacity:0.85;">नया पंप जोड़ें, 6 महीने का रियल डेमो भरें, पंप डिलीट करें</div>
        </div>
        <button class="btn sm g" id="sa-badge-btn" style="background:#f4b41a;color:#000;font-weight:900;">मैनेज करें →</button>
      </div>
    `;

    main.insertBefore(saCard, main.firstChild);
    document.querySelector('#sa-badge-btn').onclick = () => APP.views.super_admin();
  };

  console.log('[SuperAdmin Engine] Updated with Remove Pump & Security Bypass');
})();
