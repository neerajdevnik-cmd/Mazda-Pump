/* ====== पंप कॉन्फ़िगरेशन (माज़दा = मूल पंप; बाकी पंप अपना डेटा खुद लेते हैं) ====== */
window.CFG = {
  firebase: {
    apiKey: "AIzaSyA48iKeSn1lEAw6WBdKI2tuViGY9H8DWcs",
    authDomain: "mazda---pump.firebaseapp.com",
    projectId: "mazda---pump",
    storageBucket: "mazda---pump.firebasestorage.app",
    messagingSenderId: "966160602555",
    appId: "1:966160602555:web:545bf1f95e2e94d292e09e",
    measurementId: "G-W4FED5NHJD"
  },

  // 🔔 PUSH NOTIFICATIONS KEY (Firebase Console -> Project Settings -> Cloud Messaging -> Web Push Certificates se lein)
  vapidKey: "YAHAN_APNI_VAPID_KEY_PASTE_KAREIN",

  // ---- पंप की पहचान: सिर्फ़ माज़दा (mazda) के लिए असली डेटा; बाकी हर पंप का डेटा pumps/{id} से आता है ----
  // ?p=ID link से पंप चुना जाता है। कोई ?p नहीं (या mazda) → माज़दा। दूसरे पंप को माज़दा का कुछ भी नहीं मिलेगा।
  ...(function () {
    let pid = 'mazda';
    try {
      const q = new URLSearchParams(location.search);
      pid = (q.get('p') || q.get('pump') || 'mazda').toLowerCase().trim();
    } catch (e) { }
    if (pid === 'mazda') {
      return {
        ownerEmail: "neeraj@mazda-pump.in",
        ownerPin: "9999",
        managerEmail: "manager@mazda-pump.in",
        salesmen: [
          { id: "manoj", name: "Manoj", pin: "1234", phone: "9876543211", active: true },
          { id: "rohit", name: "Rohit", pin: "1104", phone: "8077083874", active: true },
          { id: "chamu", name: "Chamu", pin: "2233", phone: "9876543213", active: true }
        ]
      };
    }
    // दूसरा पंप: यहाँ कोई माज़दा डेटा नहीं; PIN/स्टाफ पंप की अपनी सेटिंग से आएँगे
    return { ownerEmail: "", ownerPin: "", managerEmail: "", salesmen: [] };
  })(),

  pump: (function () {
    let pid = 'mazda';
    try {
      const q = new URLSearchParams(location.search);
      pid = (q.get('p') || q.get('pump') || 'mazda').toLowerCase().trim();
    } catch (e) { }
    if (pid === 'mazda') {
      return {
        name: "माज़दा ऑयल कंपनी", nameEn: "Mazda Oil Company", dealer: "Bharat Petroleum Dealer",
        roCode: "BPCL-UK-263645", address: "बमस्यूँ, रानीखेत रोड, अल्मोड़ा (263645)", addressEn: "Bamsyun, Ranikhet Road, Almora - 263645",
        phone: "8077083874", fssai: "12345678901234", gstin: "05AAAAA0000A1Z5", upi: "paytmqr621vlg@ptys", upiName: "Mazda Oil Company",
        merchant: { mc: "5541", mode: "02", orgid: "159011", mid: "", sign: "" }
      };
    }
    // दूसरा पंप: खाली ढाँचा — नाम/पता/लोगो पंप के record से भरेंगे, कोई माज़दा मान नहीं
    return { name: "पेट्रोल पंप", nameEn: "Petrol Pump", dealer: "", roCode: "", address: "", addressEn: "", phone: "", fssai: "", gstin: "", upi: "", upiName: "", merchant: {} };
  })(),

  loginDomain: (function () {
    try {
      const q = new URLSearchParams(location.search);
      const p = (q.get('p') || q.get('pump') || 'mazda').toLowerCase().trim();
      return p === 'mazda' ? 'mazda-pump.in' : '';
    } catch (e) { return ''; }
  })(),
  testing: 5,
  activeNozzles: ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'],
  stockTolerance: 25,
  meterMax: 10000000,
  defaultRateP: 100.23,
  defaultRateD: 95.68
};
