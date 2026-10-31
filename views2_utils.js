/* Mazda Oil Company - Features Utils (Emergency Bulletproof Version) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;

  /* 1. AI SCANNER */
  APP.scanRegister = function (st) {
    if (!st) return alert("पहले दिन का हिसाब खोलें!");
    
    try {
      const m = APP.modal(`
        <h3>📷 AI रजिस्टर स्कैन</h3>
        <div style="margin-bottom:10px;">
          <textarea id="scan-json" rows="5" style="width:100%;margin-bottom:10px;" placeholder='यहाँ JSON पेस्ट करें'></textarea>
          <button class="btn g full" id="btn-verify">✅ Cross-Check & Save</button>
          <button class="btn w full" id="btn-cancel" style="margin-top:8px;">रद्द करें</button>
        </div>
      `);

      m.querySelector('#btn-cancel').onclick = function () { m.close(); };
      m.querySelector('#btn-verify').onclick = function () { 
        alert("बटन काम कर रहा है! (डेटा सेव करने का लॉजिक बाद में जोड़ेंगे)"); 
      };

    } catch (e) {
      alert("स्कैनर खोलने में एरर: " + e.message);
    }
  };

  /* 2. RESTORE BACKUP */
  APP.restoreFromJSON = function () {
    try {
      const m = APP.modal(`
        <h3>📤 पुराना बैकअप अपलोड करें</h3>
        <button class="btn o full" id="btn-bk">📁 JSON फाइल चुनें</button>
        <button class="btn w full" id="btn-cancel" style="margin-top:10px;">रद्द करें</button>
      `);

      m.querySelector('#btn-cancel').onclick = function () { m.close(); };
      m.querySelector('#btn-bk').onclick = function () { 
        alert("बैकअप बटन काम कर रहा है!"); 
      };

    } catch (e) {
      alert("बैकअप खोलने में एरर: " + e.message);
    }
  };

  /* 3. Add Restore Button to "More" Menu */
  const origMore = APP.views.more;
  APP.views.more = async function () {
    if (origMore) await origMore.apply(this, arguments);
    const main = APP.$('#main'); if (!main) return;
    
    if (document.querySelector('#restore-bk-btn')) return;
    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    
    const btn = document.createElement('button');
    btn.id = 'restore-bk-btn'; 
    btn.className = 'btn o full'; 
    btn.style.marginTop = '10px';
    btn.innerHTML = '📤 पुराना बैकअप अपलोड करें';
    btn.onclick = function() { APP.restoreFromJSON(); };
    card.appendChild(btn);
  };

  /* 4. Thermal Slip */
  APP.showThermalSlip = function (data) {
    APP.modal(`<h3>🖨️ पर्ची</h3><button class="btn w full" onclick="this.closest('.modal').remove()">बंद करें</button>`);
  };

  console.log('[Mazda views2_utils.js] Emergency Bulletproof Loaded ✓');
})();
