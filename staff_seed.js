/* =========================================================================
   गुरुनानक फिलिंग स्टेशन — मैनेजर + सेल्समैन बनाना और उनके कोड दिखाना
   • सिर्फ़ मालिक, सिर्फ़ दूसरे पंप पर (माज़दा पर कुछ नहीं)
   • सेल्समैन: 4-अंकी PIN (हैश होकर सेव), मैनेजर: 6-अंकी पासवर्ड (मैनेजर का login)
   • कोड सिर्फ़ एक बार दिखते हैं — यहीं नोट/कॉपी कर लें
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP, PS = window.PUMP_SYSTEM;
  if (!APP || !PS) return;

  const STAFF = {
    manager: 'Gurpinder Singh',
    salesmen: ['Ashok Patel', 'Sanjay Singh', 'Nittin Singh', 'Taj Singh', 'Arvind Singh', 'Laxmi Kant Verma', 'Ramchander']
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function randDigits(n) {
    const a = new Uint32Array(1); crypto.getRandomValues(a);
    return String(a[0] % Math.pow(10, n)).padStart(n, '0');
  }
  function uniquePins(count) {
    const set = new Set();
    while (set.size < count) set.add(randDigits(4));
    return [...set];
  }
  const isGurunanakLike = () => PS.isCustomPump() && APP.isOwner && APP.isOwner();
  const namesOf = cfg => (cfg.salesmen || []).map(s => String(s.name || '').trim().toLowerCase());

  function showCodes(rows) {
    const o = document.createElement('div');
    o.id = 'staff-codes';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
    const tbl = rows.map(r => '<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">' + esc(r.name) + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;color:#555">' + esc(r.role) + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:800;font-size:18px;letter-spacing:2px">' + esc(r.code) + '</td></tr>').join('');
    o.innerHTML = '<div style="background:#fff;color:#111;border-radius:14px;padding:16px;max-width:440px;width:100%;max-height:90vh;overflow:auto">' +
      '<h3 style="margin:0 0 4px">👥 गुरुनानक स्टाफ़ के कोड</h3>' +
      '<p style="font-size:12px;color:#b91c1c;margin:0 0 10px">ये कोड अभी ही नोट कर लें — दोबारा नहीं दिखेंगे।</p>' +
      '<table style="width:100%;border-collapse:collapse">' + tbl + '</table>' +
      '<div style="display:flex;gap:8px;margin-top:12px"><button id="sc-copy" style="flex:1;padding:10px;border-radius:8px;border:none;background:#0b3d91;color:#fff;font-weight:700">कॉपी करें</button><button id="sc-close" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ccc;background:#fff;font-weight:700">बंद करें</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('#sc-close').onclick = () => o.remove();
    o.querySelector('#sc-copy').onclick = async () => {
      const txt = rows.map(r => r.name + ' (' + r.role + ') : ' + r.code).join('\n');
      try { await navigator.clipboard.writeText(txt); APP.toast && APP.toast('कॉपी हो गया ✔'); }
      catch (e) { alert(txt); }
    };
  }

  async function createStaff() {
    const db = APP.db, cfg = PS.currentConfig || {};
    const have = namesOf(cfg);
    const todo = STAFF.salesmen.filter(n => !have.includes(n.toLowerCase()));
    const skipped = STAFF.salesmen.filter(n => have.includes(n.toLowerCase()));
    if (cfg.managerHash && !confirm('मैनेजर (' + STAFF.manager + ') का नया पासवर्ड बनेगा, पुराना बंद हो जाएगा. आगे बढ़ें?')) return;
    if (!confirm((todo.length ? todo.length + ' सेल्समैन' : '') + (todo.length ? ' और ' : '') + 'मैनेजर ' + STAFF.manager + ' बनेंगे.' + (skipped.length ? '\nपहले से मौजूद (छोड़े जाएँगे): ' + skipped.join(', ') : '') + '\n\nआगे बढ़ें?')) return;

    const pins = uniquePins(todo.length);
    const mgrCode = randDigits(6);
    const rows = [];
    try {
      for (let i = 0; i < todo.length; i++) {
        await PS.addSalesman(db, todo[i], '', pins[i]);
        rows.push({ name: todo[i], role: 'सेल्समैन', code: pins[i] });
      }
      await PS.changePassword(db, 'manager', mgrCode);
      rows.unshift({ name: STAFF.manager, role: 'मैनेजर (लॉगिन पासवर्ड)', code: mgrCode });
      await db.collection('pumps').doc(PS.activePumpId).set({ staffSeeded: true }, { merge: true });
      PS.currentConfig.staffSeeded = true;
      const card = document.getElementById('staff-card'); if (card) card.remove();
      showCodes(rows);
    } catch (e) {
      alert('स्टाफ़ नहीं बन पाया: ' + (e.code ? e.code + ' — ' : '') + (e.message || e) + '\n\nअब तक बने: ' + rows.map(r => r.name).join(', '));
    }
  }

  function staffCard() {
    if (!isGurunanakLike() || document.getElementById('staff-card')) return;
    const cfg = PS.currentConfig || {};
    const pending = STAFF.salesmen.some(n => !namesOf(cfg).includes(n.toLowerCase())) || !cfg.managerHash;
    if (cfg.staffSeeded && !pending) return;
    const main = document.querySelector('#main'); if (!main) return;
    const c = document.createElement('div');
    c.id = 'staff-card'; c.className = 'card'; c.style.marginBottom = '12px';
    c.innerHTML = '<b>👥 गुरुनानक स्टाफ़ बनाएँ</b><p class="mut" style="font-size:12px;margin:4px 0 8px">मैनेजर ' + esc(STAFF.manager) + ' + ' + STAFF.salesmen.length + ' सेल्समैन — हर एक का कोड अपने-आप बनेगा।</p><button id="staff-go" class="btn full">कोड बनाएँ</button>';
    main.prepend(c);
    document.getElementById('staff-go').onclick = createStaff;
  }

  setTimeout(() => {
    const A = window.APP; if (!A || !A.views || typeof A.views.more !== 'function') return;
    const o = A.views.more;
    A.views.more = async function () {
      const r = await o.apply(this, arguments);
      try { staffCard(); } catch (e) { }
      return r;
    };
  }, 2600);
})();
