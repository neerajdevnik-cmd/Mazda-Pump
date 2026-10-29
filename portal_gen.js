/* Mazda Oil Company - Portal Code Generator (v4 Bulletproof FAB) */
(function () {
  'use strict';

  /* ==== 1. STATUS BADGE (top-left) — proves file loaded ==== */
  function showStatus(msg, color) {
    let el = document.getElementById('pg-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pg-status';
      el.style.cssText = 'position:fixed;top:4px;left:4px;background:' + (color||'#0a7d33') + ';color:#fff;padding:3px 8px;font-size:10px;font-weight:700;border-radius:4px;z-index:999999;pointer-events:none;font-family:monospace;max-width:90vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = msg;
    el.style.background = color || '#0a7d33';
  }

  // Show loaded immediately
  if (document.body) showStatus('✓ PG-V4 LOADED', '#0a7d33');
  else document.addEventListener('DOMContentLoaded', () => showStatus('✓ PG-V4 LOADED', '#0a7d33'));

  /* ==== 2. MODAL (reusable) ==== */
  function openCodeModal(party) {
    const APP = window.APP;
    if (!APP || !APP.modal || !APP.db) { alert('App not ready'); return; }

    const esc = APP.esc, toast = APP.toast;
    const db = APP.db;

    (async () => {
      let code = party.portalCode;
      if (!code) {
        code = String(Math.floor(100000 + Math.random() * 900000));
        try {
          await db.collection('parties').doc(party.id).update({ portalCode: code });
        } catch (e) {
          alert('Code save नहीं हुआ: ' + e.message);
          return;
        }
      }

      let base = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '');
      if (!base.endsWith('/')) base += '/';
      const link = base + 'party.html';

      const waText = 'नमस्ते ' + party.name + ' जी,\n\nमाज़दा ऑयल कंपनी ने आपके लिए पोर्टल शुरू किया है।\nअब आप अपना हिसाब, गाड़ी और शॉप घर बैठे देख सकते हैं।\n\n🔗 लिंक: ' + link + '\n🔑 आपका कोड: *' + code + '*\n\nकोड डालकर अपना हिसाब देखें।\n\nधन्यवाद,\nमाज़दा ऑयल कंपनी';

      const ph = String(party.phone || '').replace(/\D/g, '');
      const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';

      const m = APP.modal(
        '<h3>🔑 पार्टी पोर्टल कोड</h3>' +
        '<div class="mut" style="margin-bottom:10px">यह कोड पार्टी को WhatsApp पर भेजें।</div>' +
        '<div style="background:#f0f4ff;border:2px dashed #0a2f6b;border-radius:12px;padding:18px;text-align:center;margin:12px 0;">' +
          '<div class="mut" style="font-size:11px;text-transform:uppercase;">PARTY CODE</div>' +
          '<div style="font-size:36px;font-weight:900;letter-spacing:6px;color:#0a2f6b;margin:6px 0;">' + code + '</div>' +
        '</div>' +
        '<div class="mut" style="font-size:11px;text-align:center;word-break:break-all;margin:8px 0;">🔗 ' + esc(link) + '</div>' +
        '<div class="btns" style="margin-top:14px;">' +
          (wa
            ? '<a href="https://wa.me/' + wa + '?text=' + encodeURIComponent(waText) + '" target="_blank" class="btn g">💬 WhatsApp भेजें</a>'
            : '<button class="btn w" disabled>पार्टी का फोन नंबर नहीं है</button>') +
          '<button class="btn w" id="pg-copy">📋 कोड कॉपी करें</button>' +
        '</div>' +
        '<div class="btns" style="margin-top:8px;">' +
          '<button class="btn w" id="pg-reset" style="color:#c62828;border-color:#c62828">🔄 नया कोड बनाएँ</button>' +
          '<button class="btn w" id="pg-close">बंद करें</button>' +
        '</div>'
      );

      m.querySelector('#pg-close').onclick = () => m.close();
      m.querySelector('#pg-copy').onclick = async () => {
        try { await navigator.clipboard.writeText(code); toast('कोड कॉपी हो गया ✔'); }
        catch (e) { toast('कॉपी नहीं हुआ'); }
      };
      m.querySelector('#pg-reset').onclick = async () => {
        if (!confirm('नया कोड बनाने से पुराना बंद हो जाएगा। आगे बढ़ें?')) return;
        const nc = String(Math.floor(100000 + Math.random() * 900000));
        try {
          await db.collection('parties').doc(party.id).update({ portalCode: nc });
          m.close();
          openCodeModal({ ...party, portalCode: nc });
        } catch (e) { alert('नहीं हुआ: ' + e.message); }
      };
    })();
  }

  // Expose globally
  window.APP = window.APP || {};
  window.APP.portal = window.APP.portal || {};
  window.APP.portal.openCodeModal = (party, priv) => {
    if (priv) return alert('निजी उधार के लिए पोर्टल नहीं है');
    openCodeModal(party);
  };

  /* ==== 3. POLLING → FAB (floating green button) ==== */
  let lastState = '';
  setInterval(() => {
    const APP = window.APP;
    if (!APP || !APP.S) {
      if (lastState !== 'wait') { lastState = 'wait'; showStatus('✓ PG-V4 | waiting', '#666'); }
      return;
    }

    const S = APP.S;
    const partyId = S.partyView && S.partyView.id;
    const priv = S.partyView && S.partyView.priv;
    const role = S.role;

    const state = role + '|' + (partyId ? (priv ? 'priv' : 'pub') : 'no-view');
    if (state !== lastState) {
      lastState = state;
      const ok = partyId && !priv && role !== 'viewer' && role !== 'salesman';
      showStatus('✓ PG-V4 | ' + role + ' | ' + (partyId ? (priv ? 'priv' : 'party-view') : 'no-view'), ok ? '#0a7d33' : '#666');
    }

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
        openCodeModal({ id: pid, ...snap.data() });
      }).catch(e => APP.toast('नहीं हो पाया: ' + e.message));
    };
    document.body.appendChild(fab);
  }, 500);

  console.log('[portal_gen v4] active ✓');
})();
