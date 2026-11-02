/* =========================================================================
   SUPER_ADMIN.JS - Neeraj Master Control & 5-Month 100% Real-Match Demo Generator
   - Custom Logo Upload, Brand Selection & Initial Rates Setup
   - Exact Real Parties & Vehicle Numbers (Kishor Upadhyay, Pappu Singh, etc.)
   - Exact Monthly Rates:
     * June & July 2026: Petrol ₹93.90 | Diesel ₹89.30
     * August & September 2026: Petrol ₹100.20 | Diesel ₹95.60
     * October & November 2026: Petrol ₹100.23 | Diesel ₹95.68
   - DG (Generator) Expense strictly 5L or 10L of Diesel Rate (or 0 on non-DG days)
   - 100% Mathematical Chain Match:
     * Opening Meter = Yesterday's Closing Meter (P1-P4 & D1-D4)
     * Opening Cash (AD) = Yesterday's Closing Cash
     * Opening Stock = Yesterday's Dip Stock
     * Day Udhar Total = Exact Sum of Ledger Udhar Entries of that Day
     * Party Final Balance = Exact Sum of all Debit - Credit Entries
     * Bank Deposits = Exact Match with Daily SBI Jama (malikDiya) + Direct NEFT/RTGS
   ========================================================================= */
(function () {
  'use strict';

  const APP = window.APP || {};
  const r2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

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
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="display:flex;gap:10px;align-items:center;">
            ${p.customLogo ? `<img src="${p.customLogo}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #0b3d91;">` : ''}
            <div>
              <b style="font-size:16px;">${p.name || p.id}</b>
              <span class="chip" style="font-size:11px;margin-left:6px;text-transform:uppercase;">${p.brand || 'BPCL'}</span>
              <div class="mut" style="font-size:12px;margin-top:2px;">ID: <code>${p.id}</code> | PIN: <b>${p.ownerPin || '9999'}</b></div>
              <div class="mut" style="font-size:11px;">📍 ${p.address || 'पता नहीं'} · 📞 ${p.phone || '-'} | रेट: P ₹${p.rates?.petrol || 100.23} | D ₹${p.rates?.diesel || 95.68}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <button class="btn sm g" data-switch="${p.id}" style="margin-bottom:4px;">👁️ इस पंप में जाएँ</button>
          </div>
        </div>

        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ddd;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn sm w" data-demo="${p.id}" style="background:#e8f4fd;color:#0369a1;border-color:#bae6fd;font-weight:700;">🚀 जून से अक्टूबर (5+ महीने) का 100% रियल डेटा भरें</button>
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
            <div style="font-size:12px;opacity:0.85;margin-top:4px;">मास्टर कंट्रोल · नीरज (100% Accurate Real Engine)</div>
          </div>
          <span class="chip g" style="font-size:12px;">Active (${pumps.length + 1} पंप)</span>
        </div>
      </div>

      <div class="btns" style="margin-bottom:12px;">
        <button class="btn g full" id="sa-add-pump" style="font-size:15px;padding:12px;">+ नया पंप जोड़ें (Logo & Rates Setup)</button>
      </div>

      <div class="card" style="background:#f8f9fc;border:1px solid #dde2ec;">
        <h3 style="margin:0 0 6px 0;font-size:15px;color:var(--b);">🏢 सभी पेट्रोल पंप की लिस्ट</h3>
        <div class="mut" style="font-size:12px;margin-bottom:10px;">यहाँ से किसी भी पंप का डेटा देखें, जून-अक्टूबर का 100% मैचिंग डेटा भरें, रीसेट करें या पंप डिलीट करें:</div>
        
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
      b.onclick = () => generateAccurateFiveMonthData(b.dataset.demo);
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

      <label>पंप कोड (Short ID - बिना स्पेस, जैसे: shree, dobhal, chandan)</label>
      <input id="np-id" placeholder="chandan" style="text-transform:lowercase;">

      <label>पंप का नाम (हिंदी)</label>
      <input id="np-name" placeholder="शहीद चन्दन फिलिंग स्टेशन">

      <label>कंपनी ब्रांड या कस्टम लोगो</label>
      <select id="np-brand">
        <option value="bpcl">Bharat Petroleum (BPCL)</option>
        <option value="hpcl">Hindustan Petroleum (HPCL)</option>
        <option value="iocl">Indian Oil (IOCL)</option>
        <option value="custom">खुद का कस्टम लोगो अपलोड करें</option>
      </select>

      <div id="np-logo-wrap" style="margin-top:8px;">
        <label>पंप का गोल लोगो इमेज (PNG/JPG - Optional)</label>
        <input type="file" id="np-logo-file" accept="image/*">
      </div>

      <div class="row" style="margin-top:8px;">
        <div><label>वर्तमान पेट्रोल रेट (₹/L)</label><input id="np-rp" value="100.23" inputmode="decimal"></div>
        <div><label>वर्तमान डीज़ल रेट (₹/L)</label><input id="np-rd" value="95.68" inputmode="decimal"></div>
      </div>

      <div class="row">
        <div><label>फोन नंबर</label><input id="np-phone" placeholder="9837571535" inputmode="tel"></div>
        <div><label>मालिक VIP PIN (4-अंक)</label><input id="np-pin" placeholder="5555" maxlength="4"></div>
      </div>

      <label>पंप का पूरा पता</label>
      <input id="np-addr" placeholder="बरेली - नैनीताल रोड, उत्तराखंड">

      <label>Paytm / UPI QR ID</label>
      <input id="np-upi" placeholder="paytmqr@ptys">

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="np-save">✅ पंप बनाएं और चालू करें</button>
        <button class="btn w" id="np-close">रद्द करें</button>
      </div>
    `);

    m.querySelector('#np-logo-file').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = 160; cv.height = 160;
          cv.getContext('2d').drawImage(img, 0, 0, 160, 160);
          uploadedLogoBase64 = cv.toDataURL('image/png', 0.9);
          APP.toast('लोगो तैयार हो गया ✔');
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
      const upi = m.querySelector('#np-upi').value.trim() || 'paytmqr@ptys';
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

  /* =========================================================================
     100% REALISTIC & MATHEMATICALLY MATCHED 5-MONTH DATA GENERATOR
     (June, July, August, September, October 2026)
     ========================================================================= */
  function getHistoricalRate(dateStr) {
    const ym = dateStr.slice(0, 7);
    if (ym === '2026-06' || ym === '2026-07') {
      return { rateP: 93.90, rateD: 89.30 };
    }
    if (ym === '2026-08' || ym === '2026-09') {
      return { rateP: 100.20, rateD: 95.60 };
    }
    // October 2026 onwards
    return { rateP: 100.23, rateD: 95.68 };
  }

  // Convert Liters to Dip (cm) if DipChart is loaded, so K.compute gets exact liters!
  function litersToDipCm(fuelType, targetLiters) {
    if (window.DipChart && typeof window.DipChart.getLiters === 'function') {
      let bestCm = 50, minDiff = 1e9;
      for (let cm = 5; cm <= 245; cm += 0.2) {
        const l = window.DipChart.getLiters(fuelType, cm);
        const diff = Math.abs(l - targetLiters);
        if (diff < minDiff) {
          minDiff = diff;
          bestCm = r2(cm);
        }
      }
      return bestCm;
    }
    return r2(targetLiters);
  }

  function actualLitersFromDip(fuelType, dipVal, fallbackLiters) {
    if (window.DipChart && typeof window.DipChart.getLiters === 'function') {
      return r2(window.DipChart.getLiters(fuelType, dipVal));
    }
    return r2(fallbackLiters);
  }

  async function generateAccurateFiveMonthData(pumpId) {
    if (pumpId === 'mazda') {
      return alert('⚠️ माज़दा (Main Pump) पर पहले से ओरिजिनल डेटा है। यह डेमो जेनरेटर केवल नए पंपों के लिए है!');
    }

    if (!confirm(`क्या आप पंप [${pumpId}] के लिए 01 जून 2026 से 31 अक्टूबर 2026 (पूरे 5 महीने / 153 दिन) का 100% सटीक और रियल मैचिंग हिसाब भरना चाहते हैं?\n\n✔ जून-जुलाई रेट: P ₹93.90, D ₹89.30\n✔ अगस्त-सितंबर रेट: P ₹100.20, D ₹95.60\n✔ अक्टूबर रेट: P ₹100.23, D ₹95.68\n✔ DG खर्चा: सिर्फ 5L या 10L डीज़ल के बराबर\n✔ असली पार्टियाँ और गाड़ियाँ (किशोर उपाध्याय, पप्पू सिंह अधिकारी, दीपक शाह आदि)\n✔ लेजर, नोज़ल मीटर (P1-P4, D1-D4), कैश गल्ला और SBI बैंक डिपॉजिट 100% मैच!`)) return;

    const progressModal = APP.modal(`
      <h3 style="color:#0b3d91;">⏳ 5 महीने का 100% सटीक हिसाब बन रहा है…</h3>
      <p class="mut" style="font-size:13px;">कृपया पेज बंद न करें। हर दिन का ओपनिंग-क्लोजिंग मीटर, लेजर, DG खर्चा (5L/10L) और बैंक जमा एकदम सटीक जोड़ा जा रहा है।</p>
      <div style="background:#e5e7eb;height:12px;border-radius:99px;overflow:hidden;margin:14px 0;">
        <div id="demo-prog-bar" style="width:2%;height:100%;background:#0a7d33;transition:width 0.2s;"></div>
      </div>
      <div id="demo-prog-txt" style="text-align:center;font-weight:700;font-size:14px;color:#0b3d91;">शुरू हो रहा है...</div>
    `);

    const setProg = (pct, txt) => {
      const b = document.getElementById('demo-prog-bar');
      const t = document.getElementById('demo-prog-txt');
      if (b) b.style.width = pct + '%';
      if (t) t.textContent = txt;
    };

    const rawDb = firebase.firestore();
    const pumpRef = rawDb.collection('pumps').doc(pumpId);

    try {
      // Step 0: Wipe any old mismatched demo data on this pump first so zero conflicts happen
      setProg(5, 'पुराना अधूरा डेटा साफ किया जा रहा है...');
      const cleanCols = ['days', 'ledger', 'parties', 'bank_deposits', 'rate_history', 'tanker_reports', 'cash_galla'];
      for (const c of cleanCols) {
        const snap = await pumpRef.collection(c).get();
        if (!snap.empty) {
          let b = rawDb.batch(), cnt = 0;
          for (const doc of snap.docs) {
            b.delete(doc.ref);
            cnt++;
            if (cnt >= 400) { await b.commit(); b = rawDb.batch(); cnt = 0; }
          }
          if (cnt > 0) await b.commit();
        }
      }

      // Step 1: Real Parties & Exact Vehicle Numbers from Screenshots
      const realParties = [
        { id: 'p_kishor', name: 'किशोर उपाध्याय', phone: '8091762889', vehicles: ['3335', '3336', '3337'], bal: 0, limit: 150000, portalCode: '333501' },
        { id: 'p_pappu', name: 'पप्पू सिंह अधिकारी', phone: '9412097690', vehicles: ['6637', '9769', 'UK 20 9769', '0783'], bal: 0, limit: 200000, portalCode: '663702' },
        { id: 'p_paras', name: 'पारस सती', phone: '9758200211', vehicles: ['2002 CB', '2002 CC'], bal: 0, limit: 100000, portalCode: '200203' },
        { id: 'p_lakshman', name: 'लक्ष्मण सिंह भरड़ा', phone: '9411133880', vehicles: ['3388', '4488'], bal: 0, limit: 150000, portalCode: '338804' },
        { id: 'p_chandan', name: 'चंदन देव', phone: '9917099770', vehicles: ['9977', '9884', '1706'], bal: 0, limit: 120000, portalCode: '997705' },
        { id: 'p_deepak', name: 'दीपक शाह', phone: '9837006270', vehicles: ['UK01CA0627', 'UK20CA0627'], bal: 0, limit: 150000, portalCode: '062706' },
        { id: 'p_madhan', name: 'मधन अधिकारी', phone: '9412907691', vehicles: ['0769'], bal: 0, limit: 80000, portalCode: '076907' },
        { id: 'p_nanda', name: 'माँ नंदा स्टोन क्रेसर', phone: '9412055111', vehicles: ['PICKUP', 'UK04CA5511'], bal: 0, limit: 250000, portalCode: '551108' },
        { id: 'p_mohit', name: 'मोहित नेगी', phone: '8126055990', vehicles: ['5599'], bal: 0, limit: 80000, portalCode: '559909' },
        { id: 'p_ghanshyam', name: 'घनश्याम तिवारी', phone: '9760008560', vehicles: ['0856'], bal: 0, limit: 60000, portalCode: '085610' },
        { id: 'p_bhagwati', name: 'जय माँ भगवती ट्रांसपोर्ट', phone: '9412013830', vehicles: ['UK01 CA 1383', 'UK20 CA 1283', 'UK20 CA 0083'], bal: 0, limit: 150000, portalCode: '138311' },
        { id: 'p_diwan', name: 'दीवान सिंह बिष्ट', phone: '9411512120', vehicles: ['UK01CA1212'], bal: 0, limit: 50000, portalCode: '121212' }
      ];

      const partyBalances = {};
      realParties.forEach(p => { partyBalances[p.id] = 0; });

      // Step 2: Record Rate History for June, August, and October
      const rateHistBatch = rawDb.batch();
      [
        { date: '2026-06-01', rateP: 93.90, rateD: 89.30 },
        { date: '2026-08-01', rateP: 100.20, rateD: 95.60 },
        { date: '2026-10-01', rateP: 100.23, rateD: 95.68 }
      ].forEach(rh => {
        rateHistBatch.set(pumpRef.collection('rate_history').doc(rh.date), {
          date: rh.date, rateP: rh.rateP, rateD: rh.rateD, by: 'neeraj@mazda-pump.in', at: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await rateHistBatch.commit();

      // Step 3: Build Date List from 2026-06-01 to 2026-10-31 (153 Days)
      const startDate = new Date('2026-06-01T12:00:00');
      const endDate = new Date('2026-10-31T12:00:00');
      const allDates = [];
      for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        allDates.push(`${y}-${m}-${d}`);
      }

      // Initial Continuous Meter Readings (Before 1st June so by October they reach ~3,50,000 / ~5,00,000 like screenshot)
      let mP1 = 285100, mP2 = 178200, mP3 = 218400, mP4 = 42100;
      let mD1 = 362400, mD2 = 216500, mD3 = 148200, mD4 = 41200;

      // Initial Cash & Tank Stock on 1st June Morning
      let prevCloseCash = 185420.00;
      let prevStockP = 8450.00;
      let prevStockD = 11820.00;

      // Deterministic pseudo-random helper for realistic variation
      let seed = 42;
      const rand = (min, max) => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return min + Math.floor((seed / 4294967296) * (max - min + 1));
      };

      let writeBatch = rawDb.batch();
      let opCount = 0;
      const flushBatch = async () => {
        if (opCount > 0) {
          await writeBatch.commit();
          writeBatch = rawDb.batch();
          opCount = 0;
        }
      };

      for (let idx = 0; idx < allDates.length; idx++) {
        const iso = allDates[idx];
        const { rateP, rateD } = getHistoricalRate(iso);
        const testing = 5;

        if (idx % 15 === 0) {
          const pct = Math.min(92, 10 + Math.round((idx / allDates.length) * 80));
          setProg(pct, `${iso} का हिसाब और लेजर जोड़ा जा रहा है (${idx + 1}/${allDates.length} दिन)...`);
        }

        // 1. Nozzle Net Sales (in Liters) - All 8 Nozzles Active
        const netP1 = rand(410, 540);
        const netP2 = rand(310, 420);
        const netP3 = rand(380, 520);
        const netP4 = rand(140, 230);
        const litP = r2(netP1 + netP2 + netP3 + netP4);

        const netD1 = rand(820, 1180);
        const netD2 = rand(410, 580);
        const netD3 = rand(390, 560);
        const netD4 = rand(450, 860);
        const litD = r2(netD1 + netD2 + netD3 + netD4);

        // Gross meter movement = Net Sale + Testing (5L per nozzle)
        const oP1 = mP1, cP1 = mP1 + netP1 + testing; mP1 = cP1;
        const oP2 = mP2, cP2 = mP2 + netP2 + testing; mP2 = cP2;
        const oP3 = mP3, cP3 = mP3 + netP3 + testing; mP3 = cP3;
        const oP4 = mP4, cP4 = mP4 + netP4 + testing; mP4 = cP4;

        const oD1 = mD1, cD1 = mD1 + netD1 + testing; mD1 = cD1;
        const oD2 = mD2, cD2 = mD2 + netD2 + testing; mD2 = cD2;
        const oD3 = mD3, cD3 = mD3 + netD3 + testing; mD3 = cD3;
        const oD4 = mD4, cD4 = mD4 + netD4 + testing; mD4 = cD4;

        const amtP = r2(litP * rateP);
        const amtD = r2(litD * rateD);
        const sale = r2(amtP + amtD);

        // 2. Generate 5 to 8 Accurate Udhar (Debit) Ledger Entries for Today
        const numUdharEntries = rand(5, 8);
        let dayUdharTotal = 0;
        const dayLedgerRows = [];

        for (let e = 0; e < numUdharEntries; e++) {
          const p = realParties[(idx + e * 3) % realParties.length];
          const veh = p.vehicles[(idx + e) % p.vehicles.length];
          const isPetrol = (e === 4 && idx % 3 === 0); // Occasional small petrol entry
          const fType = isPetrol ? 'petrol' : 'diesel';
          const fRate = isPetrol ? rateP : rateD;

          // Realistic liter quantities matching screenshot (e.g., 86.00 L, 93.23 L, 106.46 L, 114.44 L)
          let lQty, entryAmt;
          if (isPetrol) {
            entryAmt = rand(5, 25) * 100; // ₹500 to ₹2500
            lQty = r2(entryAmt / fRate);
            entryAmt = r2(lQty * fRate);
          } else {
            const baseLiters = [47.09, 65.50, 86.00, 88.11, 91.45, 93.23, 96.61, 101.43, 104.51, 106.46, 110.79, 114.44, 120.00];
            lQty = baseLiters[(idx + e * 2) % baseLiters.length];
            entryAmt = r2(lQty * fRate);
          }

          dayUdharTotal = r2(dayUdharTotal + entryAmt);
          partyBalances[p.id] = r2(partyBalances[p.id] + entryAmt);

          const hr = String(9 + e).padStart(2, '0');
          const mn = String(10 + (e * 7) % 45).padStart(2, '0');

          const lRef = pumpRef.collection('ledger').doc();
          const lData = {
            partyId: p.id,
            partyName: p.name,
            date: iso,
            time: `${hr}:${mn}`,
            kind: 'udhar',
            vehicle: veh,
            fuel: fType,
            rate: fRate,
            litre: lQty,
            amount: entryAmt,
            note: '',
            createdOn: iso,
            by: 'neeraj@mazda-pump.in',
            uid: `demo_u_${iso}_${e}`
          };
          dayLedgerRows.push(lData);
          writeBatch.set(lRef, lData);
          opCount++;
        }

        // 3. Generate Party Jama (Credit) Entries (Cash / Paytm / Bank NEFT/RTGS)
        let jCash = 0, jPaytm = 0, jSwipe = 0, jBank = 0;

        // Every 2nd day a party pays Cash at pump (goes into Galla)
        if (idx % 2 === 0) {
          const pCash = realParties[(idx * 2) % realParties.length];
          const cashJamaAmt = [15000, 20000, 25000, 30000, 35000, 40000][(idx / 2) % 6];
          jCash = r2(jCash + cashJamaAmt);
          partyBalances[pCash.id] = r2(partyBalances[pCash.id] - cashJamaAmt);

          const lRef = pumpRef.collection('ledger').doc();
          const lData = {
            partyId: pCash.id,
            partyName: pCash.name,
            date: iso,
            time: '13:15',
            kind: 'jama',
            mode: 'cash',
            amount: cashJamaAmt,
            note: 'नकद जमा',
            createdOn: iso,
            by: 'neeraj@mazda-pump.in',
            uid: `demo_jc_${iso}`
          };
          dayLedgerRows.push(lData);
          writeBatch.set(lRef, lData);
          opCount++;
        }

        // Every 3rd day a party pays directly into Bank via NEFT / RTGS / Cheque (matches bank_deposits + ledger)
        if (idx % 3 === 1) {
          const pBank = realParties[(idx + 4) % realParties.length];
          const bankJamaAmt = [25000, 30000, 45000, 50000, 60000][idx % 5];
          const payModes = ['neft', 'rtgs', 'cheque', 'upi'];
          const pm = payModes[idx % payModes.length];
          const payId = `PAY-${iso.replace(/-/g, '').slice(2)}-B${idx}`;

          jBank = r2(jBank + bankJamaAmt);
          partyBalances[pBank.id] = r2(partyBalances[pBank.id] - bankJamaAmt);

          const bRef = pumpRef.collection('bank_deposits').doc();
          const lRef = pumpRef.collection('ledger').doc();

          writeBatch.set(bRef, {
            bank: 'SBI',
            date: iso,
            amount: bankJamaAmt,
            mode: pm,
            partyId: pBank.id,
            partyName: pBank.name,
            direct: true,
            payId: payId,
            note: `पार्टी बैंक जमा (${pm.toUpperCase()})`,
            by: 'neeraj@mazda-pump.in'
          });

          const lData = {
            partyId: pBank.id,
            partyName: pBank.name,
            date: iso,
            time: '15:40',
            kind: 'jama',
            mode: 'bank',
            payMode: pm,
            amount: bankJamaAmt,
            bankId: bRef.id,
            payId: payId,
            note: `बैंक जमा — ${pm.toUpperCase()} · ${payId}`,
            createdOn: iso,
            by: 'neeraj@mazda-pump.in',
            uid: `demo_jb_${iso}`
          };
          dayLedgerRows.push(lData);
          writeBatch.set(lRef, lData);
          opCount += 2;
        }

        // 4. STRICT DG (Generator) EXPENSE RULE:
        // Only 5 Liters or 10 Liters of that day's Diesel Rate (or 0 on some days)!
        const dgLiters = (idx % 4 === 0) ? 0 : (idx % 2 === 0 ? 5 : 10);
        const kharchaDG = r2(dgLiters * rateD); // e.g., 5L * 95.68 = ₹478.40 or 10L * 95.68 = ₹956.80
        const chaiKhana = [60, 70, 80, 90, 100][idx % 5];
        const driverInaam = (idx % 5 === 0) ? 100 : 0;
        const totalKharcha = r2(kharchaDG + chaiKhana + driverInaam);

        // 5. Daily Paytm & Card Swipe Collection
        const paytm = Math.round(sale * (0.34 + (idx % 5) * 0.01));
        const swipe = Math.round(sale * (0.08 + (idx % 3) * 0.01));

        // 6. Cash Calculation & SBI Bank Deposit (malikDiya)
        const openCash = r2(prevCloseCash);
        const kulGalla = r2(sale + openCash + jCash + jPaytm + jSwipe);
        const availableCashBeforeBank = r2(kulGalla - paytm - swipe - dayUdharTotal - totalKharcha);

        // If accumulated cash exceeds ₹3,50,000, deposit a clean round amount in SBI
        let malikDiya = 0;
        if (availableCashBeforeBank > 380000 && idx % 2 === 0) {
          malikDiya = Math.floor((availableCashBeforeBank - 120000) / 10000) * 10000;
          const sbiDocId = `sbi_auto_${iso}`;
          writeBatch.set(pumpRef.collection('bank_deposits').doc(sbiDocId), {
            bank: 'SBI',
            date: iso,
            amount: malikDiya,
            mode: 'cash',
            payId: `PAY-${iso.replace(/-/g, '').slice(2)}-SBI`,
            note: 'दैनिक गल्ला से SBI बैंक जमा (मालिक को दिया)',
            by: 'neeraj@mazda-pump.in'
          });
          opCount++;
        }

        const closeCash = r2(availableCashBeforeBank - malikDiya);
        prevCloseCash = closeCash;

        // 7. Tanker Arrival & Underground Tank Stock + Dip Chart Sync
        const openStockP = r2(prevStockP);
        const openStockD = r2(prevStockD);

        let tankerP = 0, tankerD = 0;
        if (openStockP - litP < 3500) tankerP = 6000;
        if (openStockD - litD < 4500) tankerD = 12000;

        const expStockP = r2(openStockP + tankerP - litP);
        const expStockD = r2(openStockD + tankerD - litD);

        // Realistic minor dip variation (-8L to -18L within 25L tolerance)
        const targetActP = r2(expStockP - rand(4, 14));
        const targetActD = r2(expStockD - rand(6, 18));

        const dipP = litersToDipCm('petrol', targetActP);
        const dipD = litersToDipCm('diesel', targetActD);

        const actStockP = actualLitersFromDip('petrol', dipP, targetActP);
        const actStockD = actualLitersFromDip('diesel', dipD, targetActD);

        const diffP = r2(actStockP - expStockP);
        const diffD = r2(actStockD - expStockD);

        prevStockP = actStockP;
        prevStockD = actStockD;

        // 8. Build Complete Day Document matching app_day.js & calc.js 100%
        const prevDateStr = idx > 0 ? allDates[idx - 1] : null;
        const dayDoc = {
          date: iso,
          status: 'submitted',
          opening_locked: idx > 0,
          ...(prevDateStr ? { chainPrev: prevDateStr } : {}),
          testing: testing,
          rateP: rateP,
          rateD: rateD,
          openCash: openCash,
          physicalCash: closeCash,
          paytm: paytm,
          swipe: swipe,
          kharcha: kharchaDG,
          chaiKhana: chaiKhana,
          driverInaam: driverInaam,
          kharchaItems: [],
          malikDiya: malikDiya,
          openStockP: openStockP,
          openStockD: openStockD,
          tankerP: tankerP,
          tankerD: tankerD,
          dipP: dipP,
          dipD: dipD,
          note: dgLiters > 0 ? `DG जनरेटर: ${dgLiters} L डीज़ल (₹${kharchaDG})` : '',
          nz: {
            p1: { o: oP1, c: cP1, t: testing },
            p2: { o: oP2, c: cP2, t: testing },
            p3: { o: oP3, c: cP3, t: testing },
            p4: { o: oP4, c: cP4, t: testing },
            d1: { o: oD1, c: cD1, t: testing },
            d2: { o: oD2, c: cD2, t: testing },
            d3: { o: oD3, c: cD3, t: testing },
            d4: { o: oD4, c: cD4, t: testing }
          },
          sum: {
            filled: 8,
            litP: litP,
            litD: litD,
            amtP: amtP,
            amtD: amtD,
            sale: sale,
            jCash: jCash,
            jPaytm: jPaytm,
            jSwipe: jSwipe,
            jBank: jBank,
            udhar: dayUdharTotal,
            totalKharcha: totalKharcha,
            kul: kulGalla,
            close: closeCash,
            openCash: openCash,
            expStockP: expStockP,
            expStockD: expStockD,
            actStockP: actStockP,
            actStockD: actStockD,
            diffP: diffP,
            diffD: diffD
          },
          by: 'neeraj@mazda-pump.in',
          at: firebase.firestore.FieldValue.serverTimestamp()
        };

        writeBatch.set(pumpRef.collection('days').doc(iso), dayDoc);
        opCount++;

        if (opCount >= 350) {
          await flushBatch();
        }
      }

      // Step 4: Adjust Final Party Balances so Some Parties Have Advance (+ Green) & Some Have Due (- Red) like Screenshots
      // And save exact calculated party.bal so Rule Audit shows ZERO mismatch!
      setProg(95, 'पार्टियों के खाते और CIBIL बैलेंस मैच किए जा रहे हैं...');
      const advancePartyIds = ['p_kishor', 'p_chandan', 'p_deepak', 'p_madhan', 'p_mohit', 'p_lakshman'];

      for (const p of realParties) {
        let currentBal = r2(partyBalances[p.id] || 0);

        // If this party is meant to have an Advance (Green + balance like Kishor Upadhyay +₹13,458.61)
        if (advancePartyIds.includes(p.id) && currentBal > 0) {
          const extraAdvance = p.id === 'p_kishor' ? 13458.61 : p.id === 'p_chandan' ? 15070.27 : p.id === 'p_deepak' ? 63551.00 : 28311.67;
          const creditNeeded = r2(currentBal + extraAdvance);
          const payId = `PAY-261031-${p.id.slice(2, 6).toUpperCase()}`;

          const bRef = pumpRef.collection('bank_deposits').doc();
          const lRef = pumpRef.collection('ledger').doc();

          writeBatch.set(bRef, {
            bank: 'SBI',
            date: '2026-10-31',
            amount: creditNeeded,
            mode: 'rtgs',
            partyId: p.id,
            partyName: p.name,
            direct: true,
            payId: payId,
            note: 'एडवांस RTGS जमा',
            by: 'neeraj@mazda-pump.in'
          });

          writeBatch.set(lRef, {
            partyId: p.id,
            partyName: p.name,
            date: '2026-10-31',
            time: '17:20',
            kind: 'jama',
            mode: 'bank',
            payMode: 'rtgs',
            amount: creditNeeded,
            bankId: bRef.id,
            payId: payId,
            note: `बैंक जमा — RTGS · ${payId}`,
            createdOn: '2026-10-31',
            by: 'neeraj@mazda-pump.in',
            uid: `demo_adv_${p.id}`
          });

          currentBal = r2(currentBal - creditNeeded); // Negative bal = Advance (+ Green)
          opCount += 2;
        }

        // Diwan Singh Bisht = ₹0 settled
        if (p.id === 'p_diwan' && Math.abs(currentBal) > 0) {
          const settleAmt = r2(Math.abs(currentBal));
          const payId = `PAY-261031-DIWAN`;
          const lRef = pumpRef.collection('ledger').doc();
          writeBatch.set(lRef, {
            partyId: p.id,
            partyName: p.name,
            date: '2026-10-31',
            time: '18:00',
            kind: currentBal > 0 ? 'jama' : 'udhar',
            mode: 'bank',
            bankId: 'settled_bank',
            amount: settleAmt,
            note: `बैंक जमा — हिसाब बराबर · ${payId}`,
            createdOn: '2026-10-31',
            by: 'neeraj@mazda-pump.in',
            uid: `demo_settle_${p.id}`
          });
          currentBal = 0;
          opCount++;
        }

        writeBatch.set(pumpRef.collection('parties').doc(p.id), {
          ...p,
          bal: r2(currentBal),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        opCount++;
      }

      await flushBatch();
      setProg(100, '✅ 5 महीने का 100% सटीक हिसाब तैयार हो गया!');
      setTimeout(() => {
        progressModal.close();
        alert(`🎉 पंप [${pumpId}] के लिए जून, जुलाई, अगस्त, सितंबर और अक्टूबर (5 महीने) का 100% सटीक डेटा भर दिया गया है!\n\n✔ जून-जुलाई रेट: ₹93.90 / ₹89.30\n✔ अगस्त-सितंबर रेट: ₹100.20 / ₹95.60\n✔ अक्टूबर रेट: ₹100.23 / ₹95.68\n✔ DG खर्चा: सिर्फ 5L या 10L डीज़ल\n✔ सभी 8 नोज़ल (P1-P4, D1-D4), लेजर और बैंक 100% मैच!`);
      }, 500);

    } catch (e) {
      progressModal.close();
      APP.toast('डेमो डेटा एरर: ' + e.message);
      console.error(e);
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

    const cols = ['days', 'ledger', 'parties', 'shop', 'shop_orders', 'workers', 'attendance', 'tanker_reports', 'cash_galla', 'bank_deposits', 'rate_history'];

    try {
      for (const c of cols) {
        const snap = await pumpRef.collection(c).get();
        if (!snap.empty) {
          let batch = rawDb.batch(), cnt = 0;
          for (const doc of snap.docs) {
            batch.delete(doc.ref);
            cnt++;
            if (cnt >= 400) { await batch.commit(); batch = rawDb.batch(); cnt = 0; }
          }
          if (cnt > 0) await batch.commit();
        }
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
      const cols = ['days', 'ledger', 'parties', 'shop', 'shop_orders', 'workers', 'attendance', 'tanker_reports', 'cash_galla', 'bank_deposits', 'rate_history'];
      for (const c of cols) {
        const snap = await pumpRef.collection(c).get();
        if (!snap.empty) {
          let batch = rawDb.batch(), cnt = 0;
          for (const doc of snap.docs) {
            batch.delete(doc.ref);
            cnt++;
            if (cnt >= 400) { await batch.commit(); batch = rawDb.batch(); cnt = 0; }
          }
          if (cnt > 0) await batch.commit();
        }
      }

      await pumpRef.delete();

      if (localStorage.getItem('mazda_active_pump') === pumpId) {
        localStorage.setItem('mazda_active_pump', 'mazda');
      }

      APP.toast(`✅ पंप [${pumpId}] को सिस्टम से हमेशा के लिए हटा दिया गया!`);
      setTimeout(() => location.reload(), 800);
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
          <div style="font-size:11px;opacity:0.85;">नया पंप जोड़ें, 5-महीने का सटीक डेटा भरें, पंप डिलीट करें</div>
        </div>
        <button class="btn sm g" id="sa-badge-btn" style="background:#f4b41a;color:#000;font-weight:900;">मैनेज करें →</button>
      </div>
    `;

    main.insertBefore(saCard, main.firstChild);
    document.querySelector('#sa-badge-btn').onclick = () => APP.views.super_admin();
  };

  console.log('[SuperAdmin Engine v10] Loaded with 100% Accurate 5-Month Real Data Generator');
})();
