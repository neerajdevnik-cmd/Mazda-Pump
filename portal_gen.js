/* Mazda Oil Company - Party Portal Code Generator (Final Clean v5) */
(function () {
  'use strict';

  const APP = window.APP;
  if (!APP || !APP.C) return;

  const $ = APP.$;
  const db = () => APP.db;
  const toast = APP.toast, modal = APP.modal;
  const esc = APP.esc;

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

    let base = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
    if (!base.endsWith('/')) base += '/';
    const link = base + 'party.html';

    const waText = 'नमस्ते ' + party.name + ' जी,\n\nमाज़दा ऑयल कंपनी ने आपके लिए पोर्टल शुरू किया है।\nअब आप अपना हिसाब, गाड़ी और शॉप घर बैठे देख सकते हैं।\n\n🔗 लिंक: ' + link + '\n🔑 आपका कोड: *' + currentCode + '*\n\nकोड डालकर अपना हिसाब देखें।\n\nधन्यवाद,\nमाज़दा ऑयल कंपनी';

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

  /* ===== INJECTION (FAB - Floating Button) — Only in party view ===== */
  let lastState = '';
  setInterval(() => {
    const S = APP.S;
    if (!S) return;

    const partyId = S.partyView && S.partyView.id;
    const priv = S.partyView && S.partyView.priv;
    const role = S.role;

    const shouldShow = partyId && !priv && role !== 'viewer' && role !== 'salesman';
    let fab = document.getElementById('portal-fab');

    if (!shouldShow) {
      if (fab) fab.remove();
      return;
    }

    if (fab) return;

    fab = document.createElement('button');
    fab.id = 'portal-fab';
    fab.innerHTML = '🔑<br><span style="font-size:9px;font-weight:700;">पोर्टल</span>';
    fab.style.cssText = 'position:fixed;bottom:96px;right:16px;width:62px;height:62px;border-radius:50%;background:linear-gradient(135deg,#0a7d33,#0d9a3f);color:#fff;border:2px solid rgba(255,255,255,0.3);font-size:18px;box-shadow:0 6px 20px rgba(10,125,51,0.6);z-index:99999;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1;font-family:inherit;';
    fab.onclick = () => {
      const pid = S.partyView.id;
      APP.db.collection('parties').doc(pid).get().then(snap => {
        if (!snap.exists) return APP.toast('पार्टी नहीं मिली');
        APP.portal.openCodeModal({ id: pid, ...snap.data() });
      }).catch(e => APP.toast('नहीं हो पाया: ' + e.message));
    };
    document.body.appendChild(fab);
  }, 500);

  console.log('[Mazda portal_gen.js] Final Clean ✓');
})();
