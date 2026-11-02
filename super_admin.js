/* =========================================================================
   SUPER_ADMIN.JS - Neeraj Master Control & 6-Month Demo Generator
   - Create New Pumps in 60 seconds (BPCL / HPCL / IOCL / Custom)
   - 1-Click Realistic 6-Month Demo Data Generator
   - 1-Click All Clear (Reset / Wipe Demo Data safely)
   - Manage Multi-Pump Subscriptions & Remote Access
   ========================================================================= */
(function () {
  'use strict';

  const APP = window.APP || {};
  const C = window.CFG || {};
  const PS = window.PUMP_SYSTEM || {};

  // Neeraj Master Verification
  function isSuperAdmin() {
    const user = APP.S?.user?.email || '';
    const u = user.toLowerCase();
    return u === 'neeraj@mazda-pump.in' || u === 'neeraj@mazda.in';
  }

  APP.isSuperAdmin = isSuperAdmin;

  // 1. Super Admin Main View
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
      // Always get pumps from root collection
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
            <div class="mut" style="font-size:11px;">📍 ${p.address || 'पता नहीं'} · 📞 ${p.phone || '-'}</div>
          </div>
          <div style="text-align:right;">
            <button class="btn sm g" data-switch="${p.id}" style="margin-bottom:4px;">👁️ इस पंप में जाएँ</button>
          </div>
        </div>

        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ddd;display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn sm w" data-demo="${p.id}" style="background:#e8f4fd;color:#0369a1;border-color:#bae6fd;">🚀 6 महीने का डेमो डेटा भरें</button>
          <button class="btn sm r" data-clear="${p.id}" style="background:#fef2f2;color:#991b1b;border-color:#fecaca;">🗑️ डेटा ऑल-क्लियर (Reset)</button>
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
        <button class="btn g full" id="sa-add-pump" style="font-size:15px;padding:12px;">+ नया पंप जोड़ें (New Station)</button>
      </div>

      <div class="card" style="background:#f8f9fc;border:1px solid #dde2ec;">
        <h3 style="margin:0 0 6px 0;font-size:15px;color:var(--b);">🏢 सभी पेट्रोल पंप की लिस्ट</h3>
        <div class="mut" style="font-size:12px;margin-bottom:10px;">यहाँ से किसी भी पंप का डेटा देखें, डेमो भरें या डिलीट करें:</div>
        
        <!-- Default Mazda Pump -->
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

    // Bind Add Pump
    document.querySelector('#sa-add-pump').onclick = () => openAddPumpModal();

    // Bind Actions
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

    document.querySelectorAll('[data-share-links]').forEach(b => {
      b.onclick = () => showShareModal(b.dataset.shareLinks);
    });
  };

  // 2. Add New Pump Modal (60-second creation)
  function openAddPumpModal() {
    const rawDb = firebase.firestore();
    const m = APP.modal(`
      <h3>🏢 नया पेट्रोल पंप जोड़ें</h3>
      <div class="mut" style="margin-bottom:12px;font-size:12px;">सिर्फ 1 मिनट में नया पंप एक्टिवेट करें:</div>

      <label>पंप कोड (Short ID - बिना स्पेस, जैसे: shree, dobhal)</label>
      <input id="np-id" placeholder="dobhal" style="text-transform:lowercase;">

      <label>पंप का नाम (हिंदी)</label>
      <input id="np-name" placeholder="डोभाल फिलिंग स्टेशन">

      <label>पंप का नाम (English)</label>
      <input id="np-name-en" placeholder="Dobhal Filling Station">

      <label>कंपनी (Branding & Logo)</label>
      <select id="np-brand">
        <option value="bpcl">Bharat Petroleum (BPCL)</option>
        <option value="hpcl">Hindustan Petroleum (HPCL)</option>
        <option value="iocl">Indian Oil (IOCL)</option>
      </select>

      <div class="row">
        <div><label>फोन नंबर</label><input id="np-phone" placeholder="9876543210" inputmode="tel"></div>
        <div><label>मालिक VIP PIN (4-अंक)</label><input id="np-pin" placeholder="5555" maxlength="4"></div>
      </div>

      <label>पंप का पूरा पता</label>
      <input id="np-addr" placeholder="रानीखेत रोड, अल्मोड़ा">

      <label>Paytm / UPI QR ID</label>
      <input id="np-upi" placeholder="dobhal@ptaxis">

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="np-save">✅ पंप बनाएं और चालू करें</button>
        <button class="btn w" id="np-close">रद्द करें</button>
      </div>
    `);

    m.querySelector('#np-close').onclick = () => m.close();

    m.querySelector('#np-save').onclick = async () => {
      const pid = m.querySelector('#np-id').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const name = m.querySelector('#np-name').value.trim();
      const nameEn = m.querySelector('#np-name-en').value.trim() || name;
      const brand = m.querySelector('#np-brand').value;
      const phone = m.querySelector('#np-phone').value.trim();
      const ownerPin = m.querySelector('#np-pin').value.trim() || '9999';
      const address = m.querySelector('#np-addr').value.trim();
      const upi = m.querySelector('#np-upi').value.trim() || 'paytmqr@upi';

      if (!pid || !name) return APP.toast('पंप आईडी और नाम अनिवार्य हैं');

      const btn = m.querySelector('#np-save');
      btn.disabled = true;
      btn.textContent = 'बना रहे हैं...';

      try {
        await rawDb.collection('pumps').doc(pid).set({
          id: pid,
          name, nameEn, brand, phone, ownerPin, address, upi,
          activeNozzles: ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'],
          rates: { petrol: 100.23, diesel: 95.68 },
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

  // 3. 6-Month Realistic Demo Data Generator
  async function generateSixMonthDemo(pumpId) {
    if (!confirm(`क्या आप [${pumpId}] के लिए 6 महीने का पूरा यथार्थवादी (Realistic) डेटा भरना चाहते हैं?\n\nइसमें 180 दिन का हिसाब, पार्टियां, लेजर और स्टॉक सब अपने आप भर जाएगा!`)) return;

    APP.toast('🚀 6 महीने का डेटा जनरेट हो रहा है... कृपया रुकें');
    const rawDb = firebase.firestore();
    const pumpRef = rawDb.collection('pumps').doc(pumpId);

    try {
      // 1. Create Demo Parties
      const demoParties = [
        { id: 'party_rawat', name: 'रावत ब्रदर्स ट्रांसपोर्ट', phone: '9876500001', vehicles: ['UK01CA1122', 'UK01CA3344'], bal: 34500, limit: 100000, portalCode: '100101' },
        { id: 'party_kumaon', name: 'कुमाऊँ मोटर्स कॉर्पोरेशन', phone: '9876500002', vehicles: ['UK04PA5566', 'UK04PA7788'], bal: 52100, limit: 150000, portalCode: '100102' },
        { id: 'party_sharma', name: 'शर्मा ट्रेडर्स & सप्लायर्स', phone: '9876500003', vehicles: ['UK07CB9900'], bal: 18400, limit: 50000, portalCode: '100103' },
        { id: 'party_hill', name: 'हिल रोडवेज लॉजिस्टिक्स', phone: '9876500004', vehicles: ['UK01TA2468', 'UK01TA1357'], bal: 87000, limit: 200000, portalCode: '100104' },
        { id: 'party_bisht', name: 'बिष्ट जी कॉन्ट्रैक्टर', phone: '9876500005', vehicles: ['UK01EA4321'], bal: -5000, limit: 40000, portalCode: '100105' } // Advance
      ];

      for (const p of demoParties) {
        await pumpRef.collection('parties').doc(p.id).set({ ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      }

      // 2. Generate Past 180 Days of Daily Accounts & Sales
      const today = new Date();
      let prevMeterP1 = 120000, prevMeterD1 = 340000;
      let openStockP = 9500, openStockD = 18200;

      // Batch write in chunks of 25 days to avoid timeout
      for (let i = 180; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

        // Randomized daily sale: Petrol 800-1400 L, Diesel 2500-4500 L
        const litP = Math.floor(800 + Math.random() * 600);
        const litD = Math.floor(2500 + Math.random() * 2000);
        const rateP = 100.23, rateD = 95.68;
        const amtP = Math.round(litP * rateP);
        const amtD = Math.round(litD * rateD);
        const sale = amtP + amtD;

        prevMeterP1 += litP;
        prevMeterD1 += litD;

        const dayRecord = {
          date: iso,
          status: 'submitted',
          rateP: rateP,
          rateD: rateD,
          openCash: 25000,
          paytm: Math.round(sale * 0.28),
          swipe: Math.round(sale * 0.12),
          malikDiya: Math.round(sale * 0.40),
          kharcha: 1500,
          chaiKhana: 350,
          driverInaam: 200,
          openStockP: openStockP,
          openStockD: openStockD,
          actStockP: Math.max(2000, openStockP - litP + (i % 8 === 0 ? 10000 : 0)),
          actStockD: Math.max(3000, openStockD - litD + (i % 5 === 0 ? 20000 : 0)),
          tankerP: i % 8 === 0 ? 10000 : 0,
          tankerD: i % 5 === 0 ? 20000 : 0,
          nz: {
            p1: { o: prevMeterP1 - litP, c: prevMeterP1, t: 5 },
            d1: { o: prevMeterD1 - litD, c: prevMeterD1, t: 5 }
          },
          sum: {
            sale: sale,
            litP: litP,
            litD: litD,
            close: Math.round(sale * 0.15),
            udhar: Math.round(sale * 0.18)
          }
        };

        openStockP = dayRecord.actStockP;
        openStockD = dayRecord.actStockD;

        await pumpRef.collection('days').doc(iso).set(dayRecord);

        // Add 2-3 sample ledger credit entries per day
        if (i % 2 === 0) {
          const party = demoParties[i % demoParties.length];
          const veh = party.vehicles[0] || 'UK01CA1122';
          await pumpRef.collection('ledger').add({
            partyId: party.id,
            partyName: party.name,
            vehicle: veh,
            fuel: 'diesel',
            date: iso,
            time: '14:30',
            kind: 'udhar',
            litre: 100,
            rate: rateD,
            amount: 100 * rateD,
            by: 'Salesman'
          });
        }
      }

      APP.toast('✅ 6 महीने का शानदार डेमो डेटा तैयार!');
      alert(`✅ [${pumpId}] के लिए 6 महीने का पूरा ग्राफ, सेल, पार्टी और स्टॉक डेटा लोड हो गया है!\n\nअब आप ग्राहक को पूरा भरा-पूरा ऐप दिखा सकते हैं।`);
    } catch (e) {
      APP.toast('डेमो डेटा एरर: ' + e.message);
    }
  }

  // 4. 1-Click All Clear (Wipe Demo Data safely)
  async function clearAllPumpData(pumpId) {
    if (pumpId === 'mazda') {
      return alert('⚠️ सुरक्षा चेतावनी: माज़दा (Mazda) का ओरिजिनल डेटा ऑल-क्लियर नहीं किया जा सकता!');
    }

    const check = prompt(`⚠️ क्या आप सचमुच [${pumpId}] का सारा डेटा (Days, Ledger, Parties) साफ करना चाहते हैं?\n\nकन्फर्म करने के लिए नीचे 'CLEAR' लिखें:`);
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
      alert(`पंप [${pumpId}] अब एकदम नया और कोरा (Fresh) है।`);
    } catch (e) {
      APP.toast('डिलीट एरर: ' + e.message);
    }
  }

  // 5. Share Links Modal
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

  // 6. Inject Super Admin Button into 'More' Menu if Neeraj
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
          <div style="font-size:11px;opacity:0.85;">नया पंप जोड़ें, 6 महीने का डेमो भरें, ऑल-क्लियर करें</div>
        </div>
        <button class="btn sm g" id="sa-badge-btn" style="background:#f4b41a;color:#000;font-weight:900;">मैनेज करें →</button>
      </div>
    `;

    main.insertBefore(saCard, main.firstChild);
    document.querySelector('#sa-badge-btn').onclick = () => APP.views.super_admin();
  };

  console.log('[SuperAdmin Engine] Loaded successfully for Neeraj');
})();
