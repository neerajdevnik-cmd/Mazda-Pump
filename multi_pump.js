/* =========================================================================
   MULTI_PUMP.JS - Dynamic Branding & Firestore Routing Engine
   Auto-detects Pump from URL (?p=xxx or ?pump=xxx) or LocalStorage
   Reroutes Firestore collections to /pumps/{pumpId}/{col} seamlessly!
   ========================================================================= */
(function () {
  'use strict';

  window.PUMP_SYSTEM = window.PUMP_SYSTEM || {};
  const PS = window.PUMP_SYSTEM;

  // 1. Built-in Oil Company SVG Logos & Brand Themes
  PS.LOGOS = {
    bpcl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23003399"/><circle cx="50" cy="50" r="40" fill="%23fdb813"/><path d="M50 20 C40 38 35 48 35 60 C35 72 41 78 50 78 C59 78 65 72 65 60 C65 48 60 38 50 20 Z" fill="%23003399"/><circle cx="50" cy="62" r="7" fill="%23fdb813"/></svg>`,
    hpcl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%230b3d91"/><circle cx="50" cy="50" r="40" fill="%23ffffff"/><circle cx="50" cy="50" r="34" fill="%23e11d48"/><circle cx="50" cy="50" r="24" fill="%230b3d91"/><text x="50" y="58" font-size="22" font-weight="900" fill="%23ffffff" text-anchor="middle" font-family="sans-serif">HP</text></svg>`,
    iocl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23f97316"/><circle cx="50" cy="50" r="40" fill="%230a2f6b"/><rect x="20" y="42" width="60" height="16" fill="%23f97316"/><text x="50" y="55" font-size="10" font-weight="900" fill="%23ffffff" text-anchor="middle" font-family="sans-serif">INDIANOIL</text></svg>`,
    custom: `./logo.png`
  };

  // 2. Identify Current Active Pump
  function getRequestedPumpId() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('pump') || params.get('p');
    if (fromUrl) {
      const clean = fromUrl.toLowerCase().trim();
      try { localStorage.setItem('mazda_active_pump', clean); } catch (e) {}
      return clean;
    }
    try {
      const saved = localStorage.getItem('mazda_active_pump');
      if (saved) return saved.toLowerCase().trim();
    } catch (e) {}
    return 'mazda'; // Default fallback
  }

  PS.activePumpId = getRequestedPumpId();
  PS.currentConfig = null;

  // 3. Load & Apply Pump Branding Configuration
  PS.initBranding = async function (db) {
    const pid = PS.activePumpId;
    let cfg = null;

    if (pid !== 'mazda' && db) {
      try {
        const snap = await db.collection('pumps').doc(pid).get();
        if (snap.exists) {
          cfg = snap.data();
        }
      } catch (e) {
        console.warn('[MultiPump] Failed to fetch pump config from DB:', e);
      }
    }

    // Default Mazda config if not custom
    if (!cfg) {
      const C = window.CFG || {};
      cfg = {
        id: 'mazda',
        name: C.pump?.name || "माज़दा ऑयल कंपनी",
        nameEn: C.pump?.nameEn || "Mazda Oil Company",
        brand: "bpcl",
        dealer: C.pump?.dealer || "Bharat Petroleum Dealer",
        address: C.pump?.address || "बमस्यूँ, रानीखेत रोड, अल्मोड़ा (263645)",
        addressEn: C.pump?.addressEn || "Bamsyun, Ranikhet Road, Almora",
        phone: C.pump?.phone || "8077083874",
        upi: C.pump?.upi || "paytmqr621vlg@ptys",
        upiName: C.pump?.upiName || "Mazda Oil Company",
        ownerEmail: C.ownerEmail || "neeraj@mazda-pump.in",
        ownerPin: C.ownerPin || "9999",
        logo: PS.LOGOS.bpcl,
        activeNozzles: C.activeNozzles || ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'],
        rates: { petrol: C.defaultRateP || 100.23, diesel: C.defaultRateD || 95.68 }
      };
    } else {
      // Setup dynamic logo if standard brand chosen
      if (cfg.brand && PS.LOGOS[cfg.brand]) {
        cfg.logo = PS.LOGOS[cfg.brand];
      } else if (!cfg.logo) {
        cfg.logo = './logo.png';
      }
    }

    PS.currentConfig = cfg;

    // Apply to Global window.CFG dynamically
    if (window.CFG) {
      window.CFG.pump = window.CFG.pump || {};
      window.CFG.pump.name = cfg.name;
      window.CFG.pump.nameEn = cfg.nameEn || cfg.name;
      window.CFG.pump.address = cfg.address;
      window.CFG.pump.addressEn = cfg.addressEn || cfg.address;
      window.CFG.pump.phone = cfg.phone;
      window.CFG.pump.upi = cfg.upi;
      window.CFG.pump.upiName = cfg.upiName || cfg.name;
      if (cfg.ownerPin) window.CFG.ownerPin = cfg.ownerPin;
      if (cfg.activeNozzles) window.CFG.activeNozzles = cfg.activeNozzles;
      if (cfg.rates) {
        window.CFG.defaultRateP = cfg.rates.petrol || window.CFG.defaultRateP;
        window.CFG.defaultRateD = cfg.rates.diesel || window.CFG.defaultRateD;
      }
    }

    // Apply to Page Titles & Elements
    document.title = cfg.name + " - स्मार्ट पंप पोर्टल";
    PS.applyDOMBranding();
  };

  // 4. Update Images & Text dynamically on the Active Page
  PS.applyDOMBranding = function () {
    const cfg = PS.currentConfig;
    if (!cfg) return;

    // Replace all logo images
    const logos = document.querySelectorAll('img[src*="logo.png"], .login-logo, .p-header img, header img');
    logos.forEach(img => {
      img.src = cfg.logo;
    });

    // Update Headings with Pump Name
    const h1s = document.querySelectorAll('header b, .login h1, .p-header div > div:first-child');
    h1s.forEach(el => {
      if (el.textContent.includes('माज़दा') || el.textContent.includes('Mazda') || el.classList.contains('pump-title-dyn')) {
        el.textContent = cfg.name;
      }
    });

    // Inject Quick Share Buttons if on Login Screen
    PS.injectLoginShareButtons();
  };

  // 5. WhatsApp App Share Links for Owner & Parties
  PS.injectLoginShareButtons = function () {
    if (document.getElementById('ps-share-wrap')) return;
    const loginCard = document.querySelector('.login, .login-screen, .glass-card');
    if (!loginCard) return;

    const pid = PS.activePumpId;
    const cfg = PS.currentConfig || { name: 'पेट्रोल पंप' };
    const base = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

    const ownerLink = `${base}owner.html?p=${encodeURIComponent(pid)}`;
    const partyLink = `${base}party.html?p=${encodeURIComponent(pid)}`;

    const wrap = document.createElement('div');
    wrap.id = 'ps-share-wrap';
    wrap.style.cssText = 'margin:16px 0;padding:12px;background:rgba(255,255,255,0.08);border:1px dashed rgba(255,255,255,0.25);border-radius:14px;text-align:center;font-size:12px;';
    wrap.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;color:#f4b41a;">📲 ${cfg.name} - शेयर ऐप लिंक</div>
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
        <button id="btn-share-owner-link" style="flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:none;background:#f4b41a;color:#000;font-weight:bold;cursor:pointer;font-size:11px;">👑 मालिक ऐप भेजें</button>
        <button id="btn-share-party-link" style="flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:none;background:#25D366;color:#fff;font-weight:bold;cursor:pointer;font-size:11px;">🚚 पार्टी ऐप भेजें</button>
      </div>
    `;

    loginCard.parentNode.insertBefore(wrap, loginCard.nextSibling);

    document.getElementById('btn-share-owner-link').onclick = function () {
      const msg = `नमस्ते!\n\n*${cfg.name}* के मालिक के लिए VIP Owner Control पोर्टल का लिंक:\n\n🔗 ${ownerLink}\n\nयह लिंक खोलकर अपना 4-अंकों का VIP PIN डालें।`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };

    document.getElementById('btn-share-party-link').onclick = function () {
      const msg = `नमस्ते!\n\n*${cfg.name}* पार्टी पोर्टल का लिंक:\n\n🔗 ${partyLink}\n\nयहाँ से आप अपनी गाड़ी, डीज़ल बिल और पूरा हिसाब देख सकते हैं। अपना 6-अंकों का पार्टी कोड डालकर लॉगिन करें।`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    };
  };

  // 6. FIRESTORE MULTI-TENANT PROXY (Seamless Database Rerouting)
  PS.wrapFirestore = function (db) {
    if (!db || db.__wrappedMultiPump) return db;

    const originalCollection = db.collection.bind(db);
    const pid = PS.activePumpId;

    // Collections that stay GLOBAL
    const GLOBAL_COLS = ['pumps', 'system_admins', 'audit_global'];

    db.collection = function (name) {
      if (pid === 'mazda' || GLOBAL_COLS.includes(name)) {
        return originalCollection(name);
      }
      // Reroute to /pumps/{pid}/{collection}
      return originalCollection('pumps').doc(pid).collection(name);
    };

    db.__wrappedMultiPump = true;
    console.log(`[MultiPump] Firestore safely routed for Pump ID: [${pid}]`);
    return db;
  };

  // Auto-init on load
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(PS.applyDOMBranding, 400);
  });

})();
