/* =========================================================================
   NAYA PUMP - sab kuch yahin (sirf Super Admin)
   - naya pump banana / existing pump edit karna (naam, address, UPI, Owner PIN, rate, brand)
   - pump ka logo change karna (image upload)
   - pump ka 3 mahine ka rules-wala demo (wahi pump kholkar; Mazda nahi)
   Links: owner.html?p=ID | party.html?p=ID | index.html?p=ID
   
   ========================================================================= */
(function () {
  'use strict';
  const RESERVED = ['mazda', 'pumps', 'system_admins', 'audit_global'];
  const FIELDS = [
    ['name', 'पंप का नाम (हिंदी)'], ['nameEn', 'Pump name (English)'], ['ownerEmail', 'Owner email (जानकारी)'],
    ['ownerPin', 'Owner PIN (4 अंक)'], ['phone', 'फ़ोन'], ['address', 'पता (हिंदी)'], ['addressEn', 'Address (English)'],
    ['ownerPass', 'मालिक लॉगिन पासवर्ड (कम से कम 6 अक्षर) — मालिक यहीं से सब खुद सँभालेगा'],
    ['managerPass', 'मैनेजर लॉगिन पासवर्ड (कम से कम 6 अक्षर)'],
    ['viewerPass', 'मालिक-व्यू कोड (4+ अक्षर, वैकल्पिक)'],
    ['upi', 'UPI ID'], ['upiName', 'UPI नाम'], ['dealer', 'Dealer / कंपनी'], ['roCode', 'RO Code'],
    ['gstin', 'GSTIN'], ['fssai', 'FSSAI'], ['rateP', 'Petrol रेट'], ['rateD', 'Diesel रेट']
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dbOf = () => (window.APP && window.APP.db) || firebase.firestore();
  const rawDb = () => firebase.firestore();
  const base = () => location.origin + location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
  const activePump = () => (window.PUMP_SYSTEM && window.PUMP_SYSTEM.activePumpId) || 'mazda';
  const randPin = () => String(1000 + Math.floor(Math.random() * 9000));
  const isAuthorized = () => {
    const A = window.APP || {};
    if (window.PUMP_SYSTEM && PUMP_SYSTEM.isCustomPump && PUMP_SYSTEM.isCustomPump()) return false;  // दूसरे पंप पर नहीं
    const email = ((A.S && A.S.user && A.S.user.email) || '').toLowerCase();
    return email.includes('neeraj') || (A.isTrueOwner && A.isTrueOwner()) || localStorage.getItem('mazda_owner') === 'yes';
  };

  // Logo: image -> 256px PNG data URL
  function fileToLogo(file) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = reject;
      rd.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
          const k = Math.min(S / img.width, S / img.height);
          const w = img.width * k, h = img.height * k;
          c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
          resolve(c.toDataURL('image/png'));
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

  function readForm(root) {
    const v = id => (root.querySelector('#' + id) || { value: '' }).value.trim();
    const f = {};
    FIELDS.forEach(([k]) => f[k] = v('pc-' + k));
    f.brand = root.querySelector('#pc-brand').value;
    f.pid = v('pc-pid').toLowerCase();
    return f;
  }

  // पासवर्ड कभी सादा टेक्स्ट में नहीं: SHA-256(salt + पासवर्ड). salt हर पंप का अलग.
  async function hashPass(pass, salt) {
    const buf = new TextEncoder().encode(salt + '|' + pass);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function savePump(f, editing, logoData, out) {
    const id = f.pid;
    if (!editing) {
      if (!/^[a-z0-9][a-z0-9-]{2,19}$/.test(id)) return alert('Pump ID: small letters, numbers, - ; 3-20 अक्षर');
      if (RESERVED.includes(id)) return alert('यह ID रिज़र्व है');
    }
    if (!/^\d{4}$/.test(f.ownerPin)) return alert('Owner PIN ठीक 4 अंकों का होना चाहिए');
    if (!f.name) return alert('पंप का नाम लिखें');

    const ref = rawDb().collection('pumps').doc(id);
    const snap = await ref.get();
    if (!editing && snap.exists) return alert('यह Pump ID पहले से है: ' + id);
    if (editing && !snap.exists) return alert('यह पंप नहीं मिला');

    const data = {
      name: f.name, nameEn: f.nameEn || f.name, brand: f.brand, dealer: f.dealer, roCode: f.roCode,
      gstin: f.gstin, fssai: f.fssai, address: f.address, addressEn: f.addressEn || f.address,
      phone: f.phone, upi: f.upi, upiName: f.upiName || f.name, ownerEmail: f.ownerEmail, ownerPin: f.ownerPin,
      rates: { petrol: Number(f.rateP) || 100.23, diesel: Number(f.rateD) || 95.68 },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (logoData) data.logoData = logoData;
    if (f.ownerPass) {
      if (f.ownerPass.length < 6) return alert('मालिक पासवर्ड कम से कम 6 अक्षर का हो');
      const osalt = id + '-o-' + Math.random().toString(36).slice(2, 10);
      data.ownerSalt = osalt;
      data.ownerHash = await hashPass(f.ownerPass, osalt);
    } else if (!editing) {
      return alert('मालिक लॉगिन पासवर्ड भरें (मालिक इसी से लॉगिन करके पार्टी/सेल्समैन खुद जोड़ेगा)');
    }
    if (f.managerPass) {
      if (f.managerPass.length < 6) return alert('मैनेजर पासवर्ड कम से कम 6 अक्षर का हो');
      const salt = id + '-' + Math.random().toString(36).slice(2, 10);
      data.managerSalt = salt;
      data.managerHash = await hashPass(f.managerPass, salt);
    } else if (!editing) {
      return alert('मैनेजर लॉगिन पासवर्ड भरें (मैनेजर इसी से लॉगिन करेगा)');
    }
    if (f.viewerPass) {
      if (f.viewerPass.length < 4) return alert('मालिक-व्यू कोड कम से कम 4 अक्षर का हो');
      const vs = id + '-v-' + Math.random().toString(36).slice(2, 8);
      data.viewerSalt = vs;
      data.viewerHash = await hashPass(f.viewerPass, vs);
    }
    if (!editing) {
      data.id = id;
      data.activeNozzles = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      data.createdBy = ((window.APP && APP.S && APP.S.user && APP.S.user.email) || '');
      await ref.set(data);
    } else {
      await ref.update(data);
    }

    const ownerLink = `${base()}owner.html?p=${encodeURIComponent(id)}`;
    const partyLink = `${base()}party.html?p=${encodeURIComponent(id)}`;
    const appLink = `${base()}index.html?p=${encodeURIComponent(id)}`;
    out.innerHTML = `
      <div style="background:#052e16;border:1px solid #16a34a;border-radius:12px;padding:12px;font-size:12px;line-height:1.7;">
        <b style="color:#86efac;font-size:14px;">✅ "${esc(data.name)}" ${editing ? 'अपडेट हो गया' : 'बन गया'}</b><br>
        Pump ID: <b>${esc(id)}</b> &nbsp; Owner PIN: <b>${esc(f.ownerPin)}</b><br>
        👑 Owner: <a href="${ownerLink}" target="_blank" style="color:#fbbf24;">${ownerLink}</a><br>
        🚚 Party: <a href="${partyLink}" target="_blank" style="color:#fbbf24;">${partyLink}</a><br>
        🏠 Main: <a href="${appLink}" target="_blank" style="color:#fbbf24;">${appLink}</a>
      </div>`;
    return true;
  }

  function fieldHTML(k, label, val) {
    if (k === 'managerPass' || k === 'viewerPass' || k === 'ownerPass') return `<label style="font-size:11px;color:#cbd5e1;grid-column:span 2;">${label}<input id="pc-${k}" type="password" autocomplete="new-password" value="" placeholder="${val ? 'बदलना हो तो नया लिखें, वरना खाली छोड़ें' : ''}" style="width:100%;margin-top:3px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:13px;"></label>`;
    return `<label style="font-size:11px;color:#cbd5e1;">${label}<input id="pc-${k}" value="${esc(val)}" style="width:100%;margin-top:3px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:13px;box-sizing:border-box;"></label>`;
  }

  function formHTML(pid, data, editing) {
    const d = data || {};
    const r = d.rates || {};
    const vals = { ...d, rateP: r.petrol ?? 100.23, rateD: r.diesel ?? 95.68, ownerPin: d.ownerPin || randPin() };
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${editing ? `<div style="grid-column:span 2;font-size:12px;color:#94a3b8;">Pump ID: <b style="color:#fff;">${esc(pid)}</b></div>`
          : `<label style="font-size:11px;color:#cbd5e1;grid-column:span 2;">Pump ID (link के लिए, जैसे sharma-pump)<input id="pc-pid" value="" style="width:100%;margin-top:3px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:13px;box-sizing:border-box;"></label>`}
        ${FIELDS.map(([k, l]) => fieldHTML(k, l, vals[k] ?? '')).join('')}
        <label style="font-size:11px;color:#cbd5e1;">Brand
          <select id="pc-brand" style="width:100%;margin-top:3px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:13px;">
            ${['custom', 'bpcl', 'hpcl', 'iocl'].map(b => `<option value="${b}" ${(d.brand || 'custom') === b ? 'selected' : ''}>${b.toUpperCase()}</option>`).join('')}
          </select></label>
        <label style="font-size:11px;color:#cbd5e1;">Logo बदलें (image)
          <input id="pc-logo" type="file" accept="image/*" style="width:100%;margin-top:3px;font-size:12px;color:#fff;"></label>
      </div>
      ${d.logoData ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8;">मौजूदा logo: <img src="${d.logoData}" style="height:36px;vertical-align:middle;background:#fff;border-radius:6px;"></div>` : ''}
      <button id="pc-submit" style="margin-top:10px;width:100%;background:#f4b41a;color:#000;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;">${editing ? '💾 बदलाव सेव करें' : '➕ नया पंप बनाएँ'}</button>
      <div id="pc-out" style="margin-top:10px;"></div>`;
  }


  async function loadList(sel) {
    const snap = await rawDb().collection('pumps').get();
    const opts = snap.docs.map(d => `<option value="${esc(d.id)}">${esc((d.data().name || d.id))} (${esc(d.id)})</option>`).join('');
    sel.innerHTML = `<option value="">➕ नया पंप</option>` + opts;
  }

  function panelHTML() {
    return `
      <details id="pump-create-box" style="margin-top:14px;">
        <summary style="cursor:pointer;font-weight:800;color:#f4b41a;font-size:14px;">🏭 पंप बनाएँ / बदलें (Super Admin)</summary>
        <label style="font-size:11px;color:#cbd5e1;display:block;margin-top:10px;">पंप चुनें
          <select id="pc-select" style="width:100%;margin-top:3px;padding:8px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:13px;"></select></label>
        <div id="pc-form" style="margin-top:10px;"></div>
      </details>`;
  }

  async function renderForm(sel, wrap) {
    const pid = sel.value;
    let data = null;
    if (pid) {
      const s = await rawDb().collection('pumps').doc(pid).get();
      data = s.exists ? s.data() : null;
    }
    const form = wrap.querySelector('#pc-form');
    form.innerHTML = formHTML(pid, data, !!pid);

    const submit = form.querySelector('#pc-submit');
    submit.onclick = async () => {
      const f = readForm(form);
      if (!pid) f.pid = (form.querySelector('#pc-pid').value || '').trim().toLowerCase();
      else f.pid = pid;
      let logoData = null;
      const file = form.querySelector('#pc-logo').files[0];
      try {
        if (file) logoData = await fileToLogo(file);
        const ok = await savePump(f, !!pid, logoData, form.querySelector('#pc-out'));
        if (ok && !pid) sel.value = f.pid;
      } catch (e) { alert('❌ एरर: ' + e.message); }
    };
  }

  function inject() {
    if (document.querySelector('#pump-create-box')) return;
    const v2 = document.querySelector('#super-admin-panel');
    if (!v2) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:linear-gradient(135deg,#071329,#0a1f3d);border:2px solid #f4b41a;border-radius:16px;padding:16px;margin:16px;color:#fff;';
    wrap.innerHTML = panelHTML();
    v2.insertAdjacentElement('afterend', wrap);
    const sel = wrap.querySelector('#pc-select');
    loadList(sel).then(() => renderForm(sel, wrap));
    sel.onchange = () => renderForm(sel, wrap);
  }

  setInterval(() => { if (isAuthorized()) inject(); }, 1000);
})();
