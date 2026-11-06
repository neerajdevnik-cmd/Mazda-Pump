/* =========================================================================
   PUMP_LOGIN.JS — हर नए पंप का अपना Login ID + Password
   • पंप के लिंक पर पहले यही login माँगा जाता है (superadmin session नहीं चलता)
   • हर पंप का localStorage अलग (mazda_owner::pumpid) — एक पंप का login दूसरे में नहीं चलता
   • Password सिर्फ़ hash (SHA-256) होकर सेव होता है
   • माज़दा (mazda) पर कुछ नहीं बदलता
   ========================================================================= */
(function () {
  'use strict';
  const PS = window.PUMP_SYSTEM = window.PUMP_SYSTEM || {};
  const sha256 = async s => {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join('');
  };
  PS.hashLogin = (pid, loginId, pw) => sha256('mazda-pump|' + pid + '|' + String(loginId).trim() + '|' + pw);

  const pid = PS.activePumpId || 'mazda';
  if (pid === 'mazda') return;

  /* 1) इस पंप के लिए localStorage की चाबियाँ अलग */
  const KEYS = ['mazda_owner', 'mazda_sm', 'mazda_viewer', 'mazda_pump_unlock', 'mazda_party'];
  const SP = Storage.prototype, gI = SP.getItem, sI = SP.setItem, rI = SP.removeItem;
  const nk = (self, k) => (self === window.localStorage && KEYS.indexOf(k) >= 0) ? k + '::' + pid : k;
  SP.getItem = function (k) { return gI.call(this, nk(this, k)); };
  SP.setItem = function (k, v) { return sI.call(this, nk(this, k), v); };
  SP.removeItem = function (k) { return rI.call(this, nk(this, k)); };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const waitFor = (fn, ms) => new Promise(res => { const t0 = Date.now(); const t = setInterval(() => { const v = fn(); if (v || Date.now() - t0 > ms) { clearInterval(t); res(v); } }, 150); });

  /* 2) ब्राउज़र टैब का शीर्षक / होम-स्क्रीन नाम उसी पंप का */
  waitFor(() => PS.currentConfig, 10000).then(cfg => {
    if (!cfg || PS.missing) return;
    document.title = cfg.name + ' - स्मार्ट पंप पोर्टल';
    const m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (m) m.content = cfg.name;
  });

  /* 3) Login gate */
  function gateHTML(name) {
    const inp = 'width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:15px;margin-bottom:10px;box-sizing:border-box;';
    return `
      <div style="width:100%;max-width:360px;background:rgba(255,255,255,.05);border:1px solid rgba(244,180,26,.35);border-radius:20px;padding:24px;color:#e2e8f0;text-align:center;">
        <div style="font-size:19px;font-weight:800;color:#f4b41a;margin-bottom:4px;">${esc(name)}</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:18px;">पंप का Login ID और Password डालें</div>
        <input id="pl-id" placeholder="Login ID" autocomplete="username" autocapitalize="none" style="${inp}">
        <input id="pl-pw" type="password" placeholder="Password" autocomplete="current-password" style="${inp}">
        <button id="pl-go" style="width:100%;padding:12px;border-radius:10px;border:none;background:#f4b41a;color:#000;font-weight:800;font-size:15px;cursor:pointer;">लॉगिन करें</button>
        <div id="pl-err" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px;"></div>
      </div>`;
  }

  function showGate(name, db, auth) {
    if (document.getElementById('pl-gate')) return;
    const g = document.createElement('div');
    g.id = 'pl-gate';
    g.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#040b19;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Poppins,"Noto Sans Devanagari",sans-serif;';
    g.innerHTML = gateHTML(name);
    document.body.appendChild(g);
    const err = m => { document.getElementById('pl-err').textContent = m; };
    const go = document.getElementById('pl-go');
    go.onclick = async () => {
      const id = document.getElementById('pl-id').value.trim();
      const pw = document.getElementById('pl-pw').value;
      if (!id || !pw) return err('Login ID और password दोनों लिखें');
      go.disabled = true; err('');
      try {
        const snap = await db.collection('pumps').doc(pid).get();
        const d = snap.exists ? snap.data() : null;
        if (!d) { go.disabled = false; return err('यह पंप सिस्टम में नहीं है'); }
        if (!d.loginHash) { go.disabled = false; return err('इस पंप का login अभी सेट नहीं है — Super Admin से बनवाएँ'); }
        const h = await PS.hashLogin(pid, id, pw);
        if (id !== d.loginId || h !== d.loginHash) { go.disabled = false; return err('Login ID या password गलत है'); }
        if (!auth.currentUser) await auth.signInAnonymously();
        localStorage.setItem('mazda_pump_unlock', 'yes');
        location.reload();
      } catch (e) { go.disabled = false; err('नेटवर्क एरर: ' + e.message); }
    };
  }

  (async function run() {
    await waitFor(() => window.firebase && firebase.apps && firebase.apps.length, 15000);
    if (!(window.firebase && firebase.apps && firebase.apps.length)) return;
    const auth = firebase.auth(), db = firebase.firestore();

    // superadmin / manager ka पुराना session इस पंप पर नहीं चलेगा
    const first = await new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); });
    if (first && !first.isAnonymous) { try { await auth.signOut(); } catch (e) { } }

    if (window.PUMP_NO_GATE) return;   // party portal: gate nahi (party apna code se login karta hai)
    if (localStorage.getItem('mazda_pump_unlock') === 'yes') {
      if (!auth.currentUser) { try { await auth.signInAnonymously(); } catch (e) { } }
      return;
    }
    await waitFor(() => PS.currentConfig, 10000);
    const name = PS.missing ? 'पंप नहीं मिला' : ((PS.currentConfig && PS.currentConfig.name) || 'पंप');
    const show = () => showGate(name, db, auth);
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  })();
})();
