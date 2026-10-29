/* ====== माज़दा पंप कॉन्फ़िगरेशन ====== */
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

  ownerEmail: "neeraj@mazda-pump.in",
  managerEmail: "manager@mazda-pump.in",

  /* ===== Naye fields (baaki system inhe optional samjhega) ===== */
  ownerPhone: "",                 // Owner ka WhatsApp number (jaise "919876543210"). Empty rakho to share sheet khulega.
  autoWhatsApp: false,            // true = udhar/jama entry save hote hi party ko auto WhatsApp
  applock: {                      // App PIN + fingerprint lock
    enabled: false,               // true karne pe app kholte hi PIN puchega
    pin: "",                      // 4-digit PIN (jaise "1234")
    fingerprint: true             // fingerprint/face unlock ka option
  },
  depotHolidays: [],              // Custom holidays (Sunday default hai). Format: ["2026-11-12", "2026-11-13"]

  salesmen: [
    { id: "manoj", name: "Manoj", pin: "1234", phone: "9876543211", active: true },
    { id: "rohit", name: "Rohit", pin: "1104", phone: "8077083874", active: true },
    { id: "chamu", name: "Chamu", pin: "2233", phone: "9876543213", active: true }
  ],

  pump: {
    name: "माज़दा ऑयल कंपनी",
    nameEn: "Mazda Oil Company",
    dealer: "Bharat Petroleum Dealer",
    roCode: "BPCL-UK-263645",
    address: "बमस्यूँ, रानीखेत रोड, अल्मोड़ा (263645)",
    addressEn: "Bamsyun, Ranikhet Road, Almora - 263645",
    phone: "8077083874",
    fssai: "12345678901234",
    gstin: "05AAAAA0000A1Z5",
    upi: "paytmqr621vlg@ptys",
    upiName: "Mazda Oil Company",
    merchant: {
      mc: "5541",
      mode: "02",
      orgid: "159011",
      mid: "",
      sign: ""
    }
  },

  loginDomain: "mazda-pump.in",
  testing: 5,
  activeNozzles: ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'],
  stockTolerance: 25,
  meterMax: 10000000,
  defaultRateP: 100.23,
  defaultRateD: 95.68
};
