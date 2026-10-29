/* Mazda Oil Company - Party Portal Code Generator (Owner + Manager) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const db = () => APP.db;
  const toast = APP.toast, modal = APP.modal;
  const today = () => APP.todayISO();

  APP.portal = APP.portal || {};

  APP.portal.openCodeModal = async function (party, priv) {
    if (priv) return toast('निजी उधार के लिए पोर्टल नहीं है');
    if (!party || !party.id) return toast('पार्टी नहीं मिली');

    let currentCode = party.portalCode || '';

    if (!currentCode) {
      currentCode = String(Math.floor(100000 + Math.random() * 900000));
      try {
        await db().collection('parties').doc(party.id).update({ portalCode: currentCode });
        party.portalCode = currentCode;
      } catch (e) {
        return toast('कोड नहीं बन पाया: ' + e.message);
      }
    }

    // Party portal URL — handles github pages / custom domain / subfolder
    let base = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
    if (!base.endsWith('/')) base += '/';
    const link = base + 'party.html';

    const waText = `नमस्ते ${party.name} जी,\n\nमाज़दा ऑयल कंपनी ने आपके लिए पोर्टल शुरू किया है।\nअब आप अपना हिसाब, गाड़ी और शॉप घर बैठे देख सकते हैं।\n\n🔗 लिंक: ${link}\n🔑 आपका कोड: *${currentCode}*\n\nकोड डालकर अपना हिसाब देखें।\n\nधन्यवाद,\nमाज़दा ऑयल कंपनी`;

    const ph = String(party.phone || '').replace(/\D/g, '');
    const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';

    const m = modal(`
      <h3>🔑 पार्टी पोर्टल कोड</h3>
      <div class="mut" style="margin-bottom:12px">यह कोड पार्टी को भेजें, ताकि वे अपना हिसाब देख सकें।</div>
      
      <div style="background:#f0f4ff;border:2px dashed #0a2f6b;border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;">
        <div class="mut" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;">Party Code</div>
        <div style="font-size:36px;font-weight:900;letter-spacing:6px;color:#0a2f6b;margin:8px 0;">${currentCode}</div>
      </div>

      <div class="mut" style="font-size:12px;margin-bottom:8px;text-align:center;word-break:break-all;">🔗 ${esc(link)}</div>

      <div class="btns" style="margin-top:16px">
        ${wa ? `<a href="https://wa.me/${wa}?text=${encodeURIComponent(waText)}" target="_blank" class="btn g">💬 WhatsApp भेजें</a>` : `<button class="btn w" disabled>पार्टी का फोन नंबर नहीं है</button>`}
        <button class="btn w" id="pv-copy">📋 कोड कॉपी करें</button>
      </div>
      
      <div class="btns" style="margin-top:8px">
        <button class="btn w" id="pv-reset" style="color:#c62828;border-color:#c62828">🔄 नया कोड बनाएँ</button>
        <button class="btn w" id="pv-close">बंद करें</button>
      </div>
    `);

    $('#pv-close', m).onclick = () => m.close();

    $('#pv-copy', m).onclick = async () => {
      try { await navigator.clipboard.writeText(currentCode); toast('कोड कॉपी हो गया ✔'); }
      catch (e) { toast('कॉपी नहीं हुआ'); }
    };

    $('#pv-reset', m).onclick = async () => {
      if (!confirm('नया कोड बनाने से पुराना कोड बंद हो जाएगा। आगे बढ़ें?')) return;
      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      try {
        await db().collection('parties').doc(party.id).update({ portalCode: newCode });
        toast('✅ नया कोड बन गया');
        m.close();
        APP.portal.openCodeModal({ ...party, portalCode: newCode }, priv);
      } catch (e) { toast('नहीं हुआ: ' + e.message); }
    };
  };

  /* ========== AUTO-INJECT "पोर्टल कोड" BUTTON into party view ========== */
  let injected = false;

  function injectPortalButton() {
    if (injected) return;
    if (!S.partyView || !S.partyView.id || S.partyView.priv) return;
    if (S.role === 'viewer' || S.role === 'salesman') return;
    if ($('#portalBtn-js') || $('#portalBtn')) return;

    const main = $('#main');
    if (!main) return;

    const cards = main.querySelectorAll('.card');
    let partyCard = null;
    for (const c of cards) {
      const h3 = c.querySelector('h3');
      if (h3 && h3.textContent && !c.querySelector('table')) {
        partyCard = c;
        break;
      }
    }
    if (!partyCard) return;

    const phoneBtns = partyCard.querySelector('.btns');
    if (!phoneBtns) return;

    const btn = document.createElement('button');
    btn.id = 'portalBtn-js';
    btn.className = 'btn full';
    btn.style.cssText = 'margin-top:8px;background:#0a7d33;color:#fff';
    btn.innerHTML = '🔑 पोर्टल कोड / भेजें';
    btn.onclick = () => {
      const pid = S.partyView.id;
      db().collection('parties').doc(pid).get().then(snap => {
        if (!snap.exists) return toast('पार्टी नहीं मिली');
        APP.portal.openCodeModal({ id: pid, ...snap.data() }, false);
      }).catch(e => toast('नहीं हो पाया: ' + e.message));
    };

    phoneBtns.after(btn);
    injected = true;
  }

  window.addEventListener('load', () => {
    const main = document.querySelector('#main');
    if (!main) return;
    new MutationObserver(() => {
      injected = false;
      setTimeout(injectPortalButton, 200);
    }).observe(main, { childList: true, subtree: true });
    setTimeout(injectPortalButton, 500);
  });

  console.log('[Mazda portal_gen.js] loaded ✓ (auto-inject for owner+manager)');
})();
