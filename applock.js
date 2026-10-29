/* Mazda Oil Company - App Lock (PIN + Fingerprint/WebAuthn) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, toast = APP.toast, modal = APP.modal;
  const LS_PIN = 'mazda_applock_pin';
  const LS_ENABLED = 'mazda_applock_enabled';
  const LS_LASTUNLOCK = 'mazda_applock_lastunlock';

  APP.views = APP.views || {};
  APP.applock = {};

  function isEnabled() {
    if (C.applock && C.applock.enabled) return true;
    try { return localStorage.getItem(LS_ENABLED) === '1'; } catch (e) { return false; }
  }
  function getPin() {
    if (C.applock && C.applock.pin) return C.applock.pin;
    try { return localStorage.getItem(LS_PIN) || ''; } catch (e) { return ''; }
  }
  function setPin(pin) { try { localStorage.setItem(LS_PIN, pin); } catch (e) {} }
  function setEnabled(v) { try { localStorage.setItem(LS_ENABLED, v ? '1' : '0'); } catch (e) {} }

  async function sha256(str) {
    try {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { return str; }
  }

  function hasBiometric() {
    return !!(window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable);
  }

  async function tryBiometric() {
    if (!hasBiometric()) return false;
    try {
      const avail = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!avail) return false;
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Mazda Oil', id: location.hostname },
          user: { id: new Uint8Array(16), name: 'owner', displayName: 'Owner' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
          attestation: 'none'
        }
      });
      return !!cred;
    } catch (e) { return false; }
  }

  function pinScreen(onSuccess, onFail) {
    let attempts = 0;
    const m = modal(
      '<div style="text-align:center;padding:20px 0">' +
        '<img src="./logo.png" alt="" style="width:80px;height:80px;border-radius:50%;border:3px solid #f4b41a;margin-bottom:12px">' +
        '<h3 style="justify-content:center;color:#0a2f6b">🔒 माज़दा पंप</h3>' +
        '<p class="mut" style="margin:8px 0 16px">4-अंकों का PIN डालें</p>' +
        '<div id="ap-pin-display" style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">' +
          [0,1,2,3].map(() => '<div class="ap-pin-dot" style="width:14px;height:14px;border-radius:50%;border:2px solid #0a2f6b;background:transparent"></div>').join('') +
        '</div>' +
        '<div id="ap-pin-keys" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:280px;margin:0 auto">' +
          [1,2,3,4,5,6,7,8,9,'bio',0,'del'].map(k => {
            if (k === 'bio') return '<button class="btn w" data-key="bio" style="height:56px;font-size:20px" ' + (hasBiometric() ? '' : 'disabled') + '>👆</button>';
            if (k === 'del') return '<button class="btn w" data-key="del" style="height:56px;font-size:20px">⌫</button>';
            return '<button class="btn w" data-key="' + k + '" style="height:56px;font-size:22px;font-weight:700">' + k + '</button>';
          }).join('') +
        '</div>' +
        '<div id="ap-pin-error" class="err" style="display:none;margin-top:12px"></div>' +
      '</div>'
    );

    let entered = '';
    const dots = $$('.ap-pin-dot', m);
    const errBox = $('#ap-pin-error', m);

    const update = () => {
      dots.forEach((d, i) => {
        d.style.background = i < entered.length ? '#0a2f6b' : 'transparent';
      });
    };

    const verify = async () => {
      const stored = await sha256(getPin());
      if (await sha256(entered) === stored) {
        try { localStorage.setItem(LS_LASTUNLOCK, String(Date.now())); } catch (e) {}
        m.close();
        onSuccess();
      } else {
        attempts++;
        entered = ''; update();
        errBox.style.display = '';
        errBox.textContent = '❌ गलत PIN (' + attempts + '/5)';
        if (attempts >= 5) {
          errBox.textContent = '❌ 5 बार गलत — 30 सेकंड रुकें';
          $$('[data-key]', m).forEach(b => b.disabled = true);
          setTimeout(() => { $$('[data-key]', m).forEach(b => { if (b.dataset.key !== 'bio' || hasBiometric()) b.disabled = false; }); errBox.style.display = 'none'; attempts = 0; }, 30000);
        }
      }
    };

    $$('[data-key]', m).forEach(b => {
      b.onclick = async () => {
        const k = b.dataset.key;
        if (k === 'del') { entered = entered.slice(0, -1); update(); return; }
        if (k === 'bio') {
          const ok = await tryBiometric();
          if (ok) {
            try { localStorage.setItem(LS_LASTUNLOCK, String(Date.now())); } catch (e) {}
            m.close(); onSuccess();
          } else toast('Fingerprint नहीं हो पाया');
          return;
        }
        if (entered.length >= 4) return;
        entered += String(k);
        update();
        if (entered.length === 4) setTimeout(verify, 200);
      };
    });
    m.close = function() { if (onFail) onFail(); modal.prototype.remove.call(m); };
    return m;
  }

  APP.applock.maybeLock = function (onSuccess) {
    if (!isEnabled()) { onSuccess(); return; }
    let lastUnlock = 0;
    try { lastUnlock = parseInt(localStorage.getItem(LS_LASTUNLOCK) || '0', 10); } catch (e) {}
    if (Date.now() - lastUnlock < 60 * 1000) { onSuccess(); return; }
    pinScreen(onSuccess, () => {});
  };

  APP.applock.resetLock = function () {
    if (!confirm('App Lock PIN भूल गए हैं? नया PIN set करना होगा। आगे बढ़ें?')) return;
    const newPin = prompt('नया 4-अंकों का PIN डालें:');
    if (!newPin || !/^\d{4}$/.test(newPin)) return toast('4 अंकों का PIN ज़रूरी');
    setPin(newPin); toast('✅ नया PIN set हो गया');
  };

  /* ============ Settings View ============ */
  APP.views.applock_settings = async function () {
    if (APP.isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    const enabled = isEnabled();
    const pinSet = !!getPin();
    const bioAvailable = hasBiometric();

    main.innerHTML =
      '<div class="card"><h3>🔒 ऐप लॉक</h3>' +
        '<p class="mut" style="margin:4px 0">ऐप कभी भी दूसरे के हाथ में — बस PIN माँगेगा</p>' +
      '</div>' +
      '<div class="card"><div class="kv"><span>अभी</span><b>' + (enabled ? '✅ चालू' : '❌ बंद') + '</b></div>' +
        '<div class="kv"><span>PIN set</span><b>' + (pinSet ? '✅ हाँ' : '❌ नहीं') + '</b></div>' +
        '<div class="kv"><span>Fingerprint</span><b>' + (bioAvailable ? '✅ उपलब्ध' : '❌ उपलब्ध नहीं') + '</b></div>' +
        '<div class="btns">' +
          (!pinSet ? '<button class="btn g" id="ap-setpin">🔑 नया PIN बनाएँ</button>' :
           '<button class="btn w" id="ap-changepin">🔄 PIN बदलें</button>') +
          (pinSet ? '<button class="btn ' + (enabled ? 'r' : 'g') + '" id="ap-toggle">' + (enabled ? 'बंद करें' : 'चालू करें') + '</button>' : '') +
          '<button class="btn w" onclick="APP.go(\'more\')">← वापस</button>' +
        '</div>' +
      '</div>';

    if ($('#ap-setpin')) $('#ap-setpin').onclick = () => {
      const pin = prompt('4-अंकों का PIN डालें (जैसे 1234):');
      if (!pin || !/^\d{4}$/.test(pin)) return toast('4 अंकों का PIN');
      const pin2 = prompt('दोबारा डालें:');
      if (pin !== pin2) return toast('PIN match नहीं');
      setPin(pin); setEnabled(true); toast('✅ PIN set + App lock चालू'); APP.views.applock_settings();
    };
    if ($('#ap-changepin')) $('#ap-changepin').onclick = async () => {
      const cur = prompt('पुराना PIN:');
      if (await sha256(cur || '') !== await sha256(getPin())) return toast('गलत PIN');
      const pin = prompt('नया PIN:');
      if (!pin || !/^\d{4}$/.test(pin)) return toast('4 अंकों का PIN');
      setPin(pin); toast('✅ PIN बदला'); APP.views.applock_settings();
    };
    if ($('#ap-toggle')) $('#ap-toggle').onclick = () => {
      setEnabled(!enabled); toast(enabled ? '🔓 App lock बंद' : '🔒 App lock चालू'); APP.views.applock_settings();
    };
  };

  /* Boot: auto-lock if enabled and page loads */
  window.addEventListener('load', () => {
    if (!isEnabled()) return;
    let lastUnlock = 0;
    try { lastUnlock = parseInt(localStorage.getItem(LS_LASTUNLOCK) || '0', 10); } catch (e) {}
    if (Date.now() - lastUnlock < 60 * 1000) return;
    setTimeout(() => {
      if (document.querySelector('#app main')) {
        APP.applock.maybeLock(() => {});
      }
    }, 800);
  });

  console.log('[Mazda applock.js] loaded ✓');
})();
