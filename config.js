/* ====== YAHAN APNI JAANKARI BHARNI HAI ====== */
window.CFG = {
  // Firebase configuration
  firebase: {
    apiKey: "AIzaSyA48iKeSn1lEAw6WBdKI2tuViGY9H8DWcs",
    authDomain: "mazda---pump.firebaseapp.com",
    projectId: "mazda---pump",
    storageBucket: "mazda---pump.firebasestorage.app",
    messagingSenderId: "966160602555",
    appId: "1:966160602555:web:545bf1f95e2e94d292e09e",
    measurementId: "G-W4FED5NHJD"
  },

  // Logins & Roles
  ownerEmail: "neeraj@mazda-pump.in",
  managerEmail: "manager@mazda-pump.in",

  // Salesmen credentials (Salesman PIN login supported directly)
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
    // UPI & Merchant Settings
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
  testing: 5,             // litre, har nozzle par roz
  defaultRateP: 100.23,
  defaultRateD: 95.68,

  // Netlify AI scan service endpoint
  scanEndpoint: "/.netlify/functions/scan"
};
