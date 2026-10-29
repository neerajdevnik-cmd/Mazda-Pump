/* Mazda Oil Company - Vendor/Company Support with Gemini + Templates */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  APP.views = APP.views || {};

  const PRESET = {
    'pinelabs': {
      name: 'Pine Labs', cat: 'POS / Payment', color: '#00387a',
      fields: [
        { id: 'posId', label: 'POS Machine ID', required: true },
        { id: 'txnId', label: 'Transaction ID', required: false },
        { id: 'mid', label: 'Merchant ID (MID)', required: false },
        { id: 'issueTime', label: 'Issue date & time', required: true }
      ],
      categories: ['Machine not working', 'Transaction failed', 'Settlement delayed', 'Printer issue', 'App / software crash', 'Other']
    },
    'ira': {
      name: 'IRA Retail', cat: 'Software', color: '#1a5fd0',
      fields: [
        { id: 'machineId', label: 'Machine ID', required: true },
        { id: 'deviceType', label: 'Device type (Camera/WiFi/Printer/Screen)', required: true },
        { id: 'swVersion', label: 'Software version', required: false }
      ],
      categories: ['Software not working', 'Camera offline', 'WiFi / network issue', 'Printer issue', 'Display / screen issue', 'Other']
    },
    'bpcl': {
      name: 'BPCL', cat: 'Fuel Supplier', color: '#fdb813',
      fields: [
        { id: 'tankerNo', label: 'Tanker number', required: false },
        { id: 'invoiceNo', label: 'Invoice number', required: false },
        { id: 'product', label: 'Product (MS/HSD)', required: true },
        { id: 'litres', label: 'Litres', required: false }
      ],
      categories: ['Supply delay', 'Quality issue', 'Billing discrepancy', 'Transit loss', 'Document issue', 'Other']
    },
    'oildepo': {
      name: 'Oil Depo', cat: 'Supply', color: '#666',
      fields: [
        { id: 'tankerNo', label: 'Tanker number', required: true },
        { id: 'invoiceNo', label: 'Invoice number', required: false },
        { id: 'shortage', label: 'Shortage (litres)', required: true },
        { id: 'transitLoss', label: 'Transit loss', required: false }
      ],
      categories: ['Tanker late', 'Shortage', 'Document issue', 'Payment issue', 'Other']
    }
  };

  async function getVendors() {
    try {
      const snap = await db().collection('vendors').get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!list.length) {
        const b = db().batch();
        Object.keys(PRESET).forEach(k => {
          const v = PRESET[k];
          const ref = db().collection('vendors').doc(k);
          b.set(ref, { name: v.name, category: v.cat, color: v.color, phone: '', email: '', notes: '', presetId: k, createdAt: APP.FV.serverTimestamp() }, { merge: true });
        });
        await b.commit();
        const s2 = await db().collection('vendors').get();
        return s2.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      return list;
    } catch (e) { return []; }
  }

  APP.views.vendors = async function () {
    const main = $('#main'); if (!main) return;
    if (APP.isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    main.innerHTML = '<p class="mut">कंपनियाँ लोड हो रही हैं…</p>';
    const list = await getVendors();

    let html = '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">🏢 कंपनी सपोर्ट</h3><div style="font-size:12px;opacity:.85;margin-top:4px">Problem report → professional email/WhatsApp</div></div>';
    html += '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="vnd-add">+ नई कंपनी</button></div>';
    html += '<div class="card">';
    list.forEach(v => {
      const logo = v.logo ? '<img src="' + esc(v.logo) + '" style="width:44px;height:44px;border-radius:10px;object-fit:cover">' : '<div style="width:44px;height:44px;border-radius:10px;background:' + (v.color || '#666') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">' + esc((v.name || '?').slice(0, 2).toUpperCase()) + '</div>';
      html += '<div class="item" style="cursor:pointer" data-vid="' + v.id + '">' +
        '<div style="display:flex;gap:10px;align-items:center">' + logo +
        '<div class="a"><b>' + esc(v.name) + '</b><small>' + esc(v.category || '') + ' · ' + esc(v.phone || 'फोन नहीं') + '</small></div>' +
        '</div><span style="color:#9aa5bb;font-size:22px">›</span></div>';
    });
    html += '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    main.innerHTML = html;

    $('#vnd-add').onclick = () => vendorModal(null);
    $$('[data-vid]').forEach(el => el.onclick = () => {
      const v = list.find(x => x.id === el.dataset.vid);
      if (v) vendorDetail(v);
    });
  };

  function vendorModal(v) {
    const e = v || null;
    let logoData = (e && e.logo) || '';
    const m = modal('<h3>' + (e ? 'कंपनी बदलें' : 'नई कंपनी') + '</h3>' +
      '<div style="text-align:center;padding:8px 0" id="vd-logo-box">' + (logoData ? '<img src="' + esc(logoData) + '" style="width:80px;height:80px;border-radius:14px;object-fit:cover">' : '<div style="width:80px;height:80px;border-radius:14px;background:#e8eefc;display:inline-flex;align-items:center;justify-content:center;font-size:30px">🏢</div>') + '</div>' +
      '<div class="btns" style="margin-bottom:8px"><label class="btn sm w" style="cursor:pointer;text-align:center">📷 Logo<input type="file" accept="image/*" id="vd-logo" style="display:none"></label></div>' +
      '<label>नाम</label><input id="vd-name" value="' + esc(e ? e.name : '') + '">' +
      '<label>Category</label><input id="vd-cat" value="' + esc(e ? e.category || '' : '') + '" placeholder="POS / Supply / Software">' +
      '<label>फोन</label><input id="vd-phone" inputmode="tel" value="' + esc(e ? e.phone || '' : '') + '">' +
      '<label>ईमेल</label><input id="vd-email" inputmode="email" value="' + esc(e ? e.email || '' : '') + '">' +
      '<label>नोट</label><input id="vd-notes" value="' + esc(e ? e.notes || '' : '') + '">' +
      '<div class="btns"><button class="btn g" id="vd-save">💾 सेव</button>' +
      (e ? '<button class="btn r" id="vd-del">🗑 हटाएँ</button>' : '') +
      '<button class="btn w" id="vd-cancel">रद्द</button></div>');

    $('#vd-logo', m).onchange = ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 200, sc = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          logoData = cv.toDataURL('image/jpeg', 0.8);
          $('#vd-logo-box', m).innerHTML = '<img src="' + esc(logoData) + '" style="width:80px;height:80px;border-radius:14px;object-fit:cover">';
          toast('Logo तैयार ✔');
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    };
    $('#vd-cancel', m).onclick = () => m.close();
    $('#vd-save', m).onclick = async () => {
      const name = $('#vd-name', m).value.trim(); if (!name) return toast('नाम ज़रूरी');
      const data = {
        name, category: $('#vd-cat', m).value.trim(),
        phone: $('#vd-phone', m).value.trim(), email: $('#vd-email', m).value.trim(),
        notes: $('#vd-notes', m).value.trim(), logo: logoData
      };
      try {
        if (e) await db().collection('vendors').doc(e.id).update(data);
        else { data.createdAt = APP.FV.serverTimestamp(); await db().collection('vendors').add(data); }
        m.close(); toast('सेव ✔'); APP.views.vendors();
      } catch (er) { toast('नहीं हुआ: ' + er.message); }
    };
    if (e) $('#vd-del', m).onclick = async () => {
      if (!confirm('"' + e.name + '" हटाएँ?')) return;
      try { await db().collection('vendors').doc(e.id).delete(); m.close(); toast('हट गया ✔'); APP.views.vendors(); }
      catch (er) { toast('नहीं हुआ: ' + er.message); }
    };
  }

  function vendorDetail(v) {
    const m = modal(
      '<h3>' + esc(v.name) + '</h3>' +
      '<div class="kv"><span>Category</span><b>' + esc(v.category || '') + '</b></div>' +
      (v.phone ? '<div class="kv"><span>📞</span><b>' + esc(v.phone) + '</b></div>' : '') +
      (v.email ? '<div class="kv"><span>✉️</span><b>' + esc(v.email) + '</b></div>' : '') +
      (v.notes ? '<div class="mut" style="margin-top:6px">' + esc(v.notes) + '</div>' : '') +
      '<div class="btns" style="margin-top:12px">' +
        '<button class="btn g" id="vd-report">⚠️ समस्या बताएँ</button>' +
        '<button class="btn w" id="vd-edit">✏️ बदलें</button>' +
        '<button class="btn w" id="vd-close">बंद</button>' +
      '</div>'
    );
    $('#vd-close', m).onclick = () => m.close();
    $('#vd-edit', m).onclick = () => { m.close(); vendorModal(v); };
    $('#vd-report', m).onclick = () => { m.close(); reportProblem(v); };
  }

  function reportProblem(v) {
    const preset = PRESET[v.presetId] || null;
    const fields = preset ? preset.fields : [{ id: 'detail', label: 'विवरण', required: true }];
    const cats = preset ? preset.categories : ['General issue', 'Other'];

    let html = '<h3>⚠️ समस्या बताएँ — ' + esc(v.name) + '</h3>' +
      '<label>किस तरह की समस्या?</label><select id="rp-cat">' + cats.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>';
    fields.forEach(f => {
      html += '<label>' + esc(f.label) + (f.required ? ' *' : '') + '</label><input id="rp-f-' + f.id + '" data-rpf="' + f.id + '">';
    });
    html += '<label>विस्तार से बताएँ (voice/text)</label>' +
      '<div style="display:flex;gap:6px"><textarea id="rp-detail" rows="4" style="flex:1"></textarea><button class="btn sm w" id="rp-voice" style="align-self:flex-end;padding:10px 12px">🎤</button></div>' +
      '<label>फोटो (optional)</label>' +
      '<div class="btns"><label class="btn sm w" style="cursor:pointer">📷 फोटो<input type="file" accept="image/*" id="rp-photo" style="display:none"></label></div>' +
      '<div id="rp-photo-preview"></div>' +
      '<div class="btns" style="margin-top:12px">' +
        '<button class="btn g" id="rp-gen-ai">🤖 AI से बनाएँ</button>' +
        '<button class="btn w" id="rp-gen-tpl">📝 बिना AI (template)</button>' +
        '<button class="btn w" id="rp-cancel">रद्द</button>' +
      '</div>';

    const m = modal(html);
    let photoData = '';

    $('#rp-cancel', m).onclick = () => m.close();
    $('#rp-voice', m).onclick = () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return toast('Voice support नहीं');
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'hi-IN';
      rec.continuous = false;
      rec.onresult = e => {
        const txt = e.results[0][0].transcript;
        const ta = $('#rp-detail', m);
        ta.value = (ta.value ? ta.value + ' ' : '') + txt;
        toast('✅ voice add');
      };
      rec.onerror = () => toast('Voice नहीं सुना');
      rec.start();
      toast('🎤 बोलें...');
    };
    $('#rp-photo', m).onchange = e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 900, sc = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          photoData = cv.toDataURL('image/jpeg', 0.8);
          $('#rp-photo-preview', m).innerHTML = '<img src="' + photoData + '" style="width:100%;max-width:200px;border-radius:8px;margin-top:8px">';
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    };

    $('#rp-gen-ai', m).onclick = () => generateReport('ai');
    $('#rp-gen-tpl', m).onclick = () => generateReport('template');

    function collect() {
      const cat = $('#rp-cat', m).value;
      const detail = $('#rp-detail', m).value.trim();
      const extras = {};
      $$('[data-rpf]', m).forEach(el => { extras[el.dataset.rpf] = el.value.trim(); });
      return { cat, detail, extras, photoData };
    }

    async function generateReport(mode) {
      const d = collect();
      if (!d.cat) return toast('Category चुनें');
      if (mode === 'ai') {
        const key = localStorage.getItem('mazda_gemini_key');
        if (!key) { toast('पहले Gemini key डालें (More → AI settings)'); return; }
        toast('🤖 AI लिख रहा है…');
        try {
          const draft = await aiDraft(v, d, key);
          showPreview(draft, d);
        } catch (e) { toast('AI fail: ' + e.message); showPreview(templateDraft(v, d), d); }
      } else {
        showPreview(templateDraft(v, d), d);
      }
    }

    function showPreview(draft, d) {
      m.close();
      const preview = modal(
        '<h3>📄 तैयार संदेश</h3>' +
        '<div class="seg" style="margin-bottom:8px"><button data-lang="en" class="on">English</button><button data-lang="hi">हिन्दी</button></div>' +
        '<div id="pv-text" style="background:#f7f9fe;border:1px solid #dde2ec;border-radius:10px;padding:12px;white-space:pre-wrap;font-size:13px;line-height:1.55;max-height:300px;overflow:auto"></div>' +
        (d.photoData ? '<div style="margin-top:8px"><img src="' + d.photoData + '" style="max-width:100%;max-height:120px;border-radius:6px"></div>' : '') +
        '<div class="btns" style="margin-top:12px">' +
          '<button class="btn g" id="pv-email">📧 ईमेल</button>' +
          '<button class="btn g" id="pv-wa">💬 WhatsApp</button>' +
          '<button class="btn w" id="pv-copy">📋 Copy</button>' +
          '<button class="btn w" id="pv-close">बंद</button>' +
        '</div>'
      );
      let curLang = 'en';
      const update = () => { $('#pv-text', preview).textContent = draft[curLang]; };
      $$('[data-lang]', preview).forEach(b => b.onclick = () => {
        $$('[data-lang]', preview).forEach(x => x.classList.toggle('on', x.dataset.lang === b.dataset.lang));
        curLang = b.dataset.lang; update();
      });
      update();

      $('#pv-close', preview).onclick = () => preview.close();
      $('#pv-copy', preview).onclick = async () => {
        try { await navigator.clipboard.writeText(draft[curLang]); toast('Copy ✔'); }
        catch (e) { toast('Copy नहीं हुआ'); }
      };
      $('#pv-email', preview).onclick = () => {
        if (!v.email) return toast('कंपनी का ईमेल नहीं है');
        const subj = encodeURIComponent('Issue Report - ' + C.pump.nameEn + ' (' + C.pump.roCode + ')');
        const body = encodeURIComponent(draft[curLang]);
        window.location.href = 'mailto:' + v.email + '?subject=' + subj + '&body=' + body;
      };
      $('#pv-wa', preview).onclick = async () => {
        if (!v.phone) return toast('कंपनी का फोन नहीं है');
        const ph = String(v.phone).replace(/\D/g, '');
        const wa = ph.length === 10 ? '91' + ph : ph;
        if (d.photoData) {
          try {
            const blob = await (await fetch(d.photoData)).blob();
            const file = new File([blob], 'issue.jpg', { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], text: draft[curLang] });
              return;
            }
          } catch (e) {}
        }
        window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(draft[curLang]), '_blank');
      };
    }
  }

  function templateDraft(v, d) {
    const extras = Object.keys(d.extras || {}).filter(k => d.extras[k]).map(k => '  - ' + k + ': ' + d.extras[k]).join('\n');
    const pump = C.pump;
    const en = `Subject: Issue Report - ${v.name} (${d.cat})\n\nDear ${v.name} Support Team,\n\nI am writing to report an issue with your services at our petrol pump.\n\nPump Details:\n- Name: ${pump.nameEn}\n- Dealer: ${pump.dealer}\n- RO Code: ${pump.roCode}\n- Address: ${pump.addressEn}\n- Contact: ${pump.phone}\n- GSTIN: ${pump.gstin}\n\nIssue Details:\n- Category: ${d.cat}\n${extras ? '- Additional details:\n' + extras : ''}\n- Description: ${d.detail || '(no description)'}\n- Date reported: ${dmy(today())}\n\nKindly look into this at the earliest. Please let us know the expected resolution time.\n\nThank you,\n${pump.nameEn}\n${pump.phone}`;
    const hi = `विषय: समस्या रिपोर्ट - ${v.name} (${d.cat})\n\nआदरणीय ${v.name} सपोर्ट टीम,\n\nहमारे पेट्रोल पंप पर आपकी सेवाओं में एक समस्या की रिपोर्ट कर रहे हैं।\n\nपंप विवरण:\n- नाम: ${pump.name}\n- डीलर: ${pump.dealer}\n- RO कोड: ${pump.roCode}\n- पता: ${pump.address}\n- फोन: ${pump.phone}\n- GSTIN: ${pump.gstin}\n\nसमस्या विवरण:\n- श्रेणी: ${d.cat}\n${extras ? '- अतिरिक्त विवरण:\n' + extras : ''}\n- विस्तृत विवरण: ${d.detail || '(कोई विवरण नहीं)'}\n- रिपोर्ट तारीख: ${dmy(today())}\n\nकृपया जल्द से जल्द इसका समाधान करें और अनुमानित समय बताएँ।\n\nधन्यवाद,\n${pump.name}\n${pump.phone}`;
    return { en, hi };
  }

  async function aiDraft(v, d, key) {
    const pump = C.pump;
    const extras = Object.keys(d.extras || {}).filter(k => d.extras[k]).map(k => k + ': ' + d.extras[k]).join('\n');
    const prompt = `You are helping a petrol pump owner write a professional complaint email.\n\nPump Details:\n- Name: ${pump.nameEn}\n- Dealer: ${pump.dealer}\n- RO Code: ${pump.roCode}\n- Address: ${pump.addressEn}\n- Phone: ${pump.phone}\n- GSTIN: ${pump.gstin}\n- FSSAI: ${pump.fssai}\n\nVendor: ${v.name} (${v.category})\nIssue Category: ${d.cat}\nIssue Details:\n${extras}\nDescription: ${d.detail}\nDate: ${dmy(today())}\n\nWrite TWO versions and return ONLY valid JSON (no markdown, no code fences):\n{"en": "English professional email body (with Subject line at top)", "hi": "Same email in Hindi (Devanagari)"}\n\nKeep tone: professional, respectful, concise. Include all pump details for verification. Mention this is an urgent issue. Sign off with pump name and phone.`;

    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } })
    });
    if (!r.ok) throw new Error('Gemini HTTP ' + r.status);
    const j = await r.json();
    const txt = (((j.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || '';
    let out;
    try {
      let t = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a >= 0 && b > a) t = t.slice(a, b + 1);
      out = JSON.parse(t);
    } catch (e) { throw new Error('AI response invalid'); }
    if (!out.en || !out.hi) throw new Error('AI incomplete');
    return out;
  }

  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer() || S.role === 'salesman') return;
    if (document.querySelector('#vendor-more-btn')) return;
    const main = $('#main'); if (!main) return;
    const card = main.querySelector('#extra-more-card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns && !card.querySelector('[data-nav="vendors"]')) {
      const btn = document.createElement('button');
      btn.id = 'vendor-more-btn';
      btn.className = 'btn w';
      btn.innerHTML = '🏢 कंपनी सपोर्ट';
      btn.onclick = () => APP.go('vendors');
      btns.insertBefore(btn, btns.firstChild);
    }
  };

  console.log('[Mazda vendors.js] loaded ✓');
})();
