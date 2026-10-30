# ⛽ Mazda Oil Company - Pump Management System

![Status](https://img.shields.io/badge/Status-Active-success)
![Version](https://img.shields.io/badge/Version-6.0-blue)
![Tech](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Firebase-orange)

Mazda Oil Company ek advanced **Progressive Web App (PWA)** hai jo petrol pump ke daily operations, cash (Galla) management, udhar khato (Ledger), stock, aur staff ko ek hi jagah digital tarike se manage karne ke liye banaya gaya hai.

---

## ✨ Key Features (Mukhya Visheshtayein)

### 1. 💼 Manager Desk (Cash & Galla Control)
*   **Galla Reconciliation:** Manager din ke kisi bhi samay apna cash ginkar dal sakta hai. System batayega ki "Hona chahiye" kitna tha aur "Actual" kitna hai.
*   **Niji Udhar:** Manager/Salesman apne personal galla se jo udhar dete hain, wo yahan track hota hai (Owner ke main hisab se alag).
*   **Bank Deposit:** Galla se cash nikal kar bank deposit karne ka option.
*   **Kharcha & Party Jama:** Bina Main Hisab ko touch kiye, direct Manager Desk se kharche aur jama entries ki ja sakti hain.

### 2. 👑 Owner Dashboard (Viewer Mode)
*   Owner ke liye ek alag "Read-Only" dashboard.
*   Jahan se pura stock, sales, cash flow aur party ledger dekha ja sakta hai bina kuch edit kiye.
*   **Edit/Delete Authority:** Ledger ya hisab mein koi bhi purani entry sirf **Owner** (`neeraj@mazda.in`) hi edit ya delete kar sakta hai.

### 3. 🧑‍🤝‍🧑 Party Portal (Customer Login)
*   Parties (Customers) apne 6-digit code ke through login kar sakti hain (`party.html`).
*   Apna mahina select karke pura hisab dekh sakte hain.
*   Ek click mein apna **Professional Statement PDF ya Image** download kar sakte hain.

### 4. 🔒 Rate Lock System (No Manual Change)
*   Meter entry ya udhar karte time rate manually change nahi ho sakta.
*   **Manager** naya rate change request bhej sakta hai.
*   **Owner** usko approve karega, tabhi naya rate pure system par lagu hoga aur Rate History banegi.

### 5. 🚛 Salesman App & Tanker Report
*   Salesman apni shift ke meter readings, udhar aur cash submission manage kar sakta hai.
*   Tanker aane par "Tanker Report" dalkar ye check kiya ja sakta hai ki tayl (fuel) dip calculation ke hisab se pura aaya ya kam.

---

## 🛠️ Tech Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (No frameworks, fast & lightweight).
*   **Backend / Database:** Firebase (Firestore & Auth).
*   **Libraries:** `html2canvas` (for downloading statements & invoices).
*   **PWA:** Service Worker (`sw.js`) included for offline support & caching.

---

## 📂 Project Structure (File Guide)

*   `index.html` - Main App entry point.
*   `party.html` - Customer login page.
*   `config.js` - Firebase keys & Pump details.
*   `app.js` - Core app logic, routing, day view, ledger view.
*   `manager_desk.js` - Manager ka cash aur galla calculation.
*   `features2.js` - Owner Viewer & Workers logic.
*   `calc.js` - Pura calculation engine (Sale, Cash, Party Balance).
*   `sw.js` - Service worker (Version update karte rehna).

---

## ⚙️ How to Run (Setup)

1.  Apne GitHub par ye repository clone karein.
2.  `config.js` file kholein aur apna Firebase Project (API Key, Project ID) update karein.
3.  `index.html` aur `party.html` ko kisi bhi local server ya GitHub Pages par host karein.
4.  **Firebase Security Rules:** Firebase Console > Firestore Database > Rules mein jaakar logged-in users ke liye read/write allow karein:
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /{document=**} {
          allow read, write: if request.auth != null;
        }
      }
    }
