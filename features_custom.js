/* Mazda Oil Company - Features Custom (Customers, Bank, Requests) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();
  const isViewer = () => APP.isViewer && APP.isViewer();
  const isTrueOwner = () => APP.isTrueOwner && APP.isTrueOwner();
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c||''}">${b}</b></div>`;
  APP.views = APP.views || {};

  function initials(name) { return String(name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }
  function waNum(ph) { let p = String(ph || '').replace(/\D/g, ''); if (!p) return ''; p = p.replace(/^0+/, ''); if (!p.startsWith('91')) p = '91' + p; return p; }

  /* ============ REQUESTS (RATE CHANGE & MOHALAT) ============ */
  APP.views.requests = async function () {
    if (isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">Requests लोड हो रही हैं…</p>';

    let reqSnap, rateSnap;
    try {
      [reqSnap, rateSnap] = await Promise.all([
        db().collection('requests').orderBy('createdAt', 'desc').limit(50).get(),
        db().collection('rate_requests').where('status', '==', 'pending').get()
      ]);
    } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rateReqs = rateSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let html = '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">📩 रिक्वेस्ट्स</h3></div>';

    // Rate Requests (Owner Only)
    if (isTrueOwner()) {
      html += '<div class="card"><h3 style="color:var(--b)">📈 रेट बदलने की रिक्वेस्ट</h3>';
      if (rateReqs.length === 0) html += '<p class="mut">कोई पेंडिंग रेट रिक्वेस्ट नहीं।</p>';
      else {
        rateReqs.forEach(r => {
          html += `<div class="item">
            <div class="a"><b>नया रेट: P ₹${r.petrol} | D ₹${r.diesel}</b><small>${dmy(r.date)} · ${esc(r.requestedBy)}</small></div>
            <div style="display:flex; gap:6px;">
              <button class="btn sm g" data-rate-approve="${r.id}">✔</button>
              <button class="btn sm r" data-rate-reject="${r.id}">✖</button>
            </div>
          </div>`;
        });
      }
      html += '</div>';
    }

    // Party Mohalat Requests
    const partyReqs = requests.filter(r => r.status === 'pending');
    html += '<div class="card"><h3 style="color:var(--b)">⏰ पार्टी मोहलत</h3>';
    if (!partyReqs.length) html += '<p class="mut">कोई पेंडिंग मोहलत रिक्वेस्ट नहीं।</p>';
    else {
      partyReqs.forEach(r => {
        html += `<div class="item">
          <div class="a"><b>${esc(r.partyName)}</b><small>"${esc(r.message)}"</small><small>${dmy(r.date)}</small></div>
          <div style="display:flex; gap:6px;">
            <button class="btn sm g" data-req-ok="${r.id}">✔</button>
            <button class="btn sm r" data-req-reject="${r.id}">✖</button>
          </div>
        </div>`;
      });
    }
    html += '</div>';

    main.innerHTML = html;

    // Approve Rate
    $$('[data-rate-approve]').forEach(b => b.onclick = async () => {
      if (!confirm('रेट चेंज अप्रूव करें? यह पूरे सिस्टम पर लागू हो जाएगा।')) return;
      const id = b.dataset.rateApprove;
      const r = rateReqs.find(x => x.id === id);
      try {
        const batch = db().batch();
        batch.update(db().collection('rate_requests').doc(id), { status: 'approved', approvedBy: S.user.email, approvedAt: APP.FV.serverTimestamp() });
        batch.set(db().collection('config').doc('rates'), { petrol: r.petrol, diesel: r.diesel, date: r.date, updatedAt: APP.FV.serverTimestamp() }, { merge: true });
        await batch.commit();
        toast('रेट अप्रूव हो गया ✔'); APP.views.requests();
      } catch (e) { toast('एरर: ' + e.message); }
    });

    // Reject Rate
    $$('[data-rate-reject]').forEach(b => b.onclick = async () => {
      if (!confirm('रेट चेंज रिजेक्ट करें?')) return;
      try {
        await db().collection('rate_requests').doc(b.dataset.rateReject).update({ status: 'rejected', rejectedBy: S.user.email });
        toast('रिजेक्ट कर दिया ✖'); APP.views.requests();
      } catch (e) { toast('एरर: ' + e.message); }
    });

    // Approve Mohalat
    $$('[data-req-ok]').forEach(b => b.onclick = async () => {
      try {
        await db().collection('requests').doc(b.dataset.reqOk).update({ status: 'approved', approvedBy: S.user.email });
        toast('मोहलत अप्रूव हो गई ✔'); APP.views.requests();
      } catch (e) { toast('एरर: ' + e.message); }
    });

    // Reject Mohalat
    $$('[data-req-reject]').forEach(b => b.onclick = async () => {
      try {
        await db().collection('requests').doc(b.dataset.reqReject).update({ status: 'rejected', rejectedBy: S.user.email });
        toast('मोहलत रिजेक्ट कर दी ✖'); APP.views.requests();
      } catch (e) { toast('एरर: ' + e.message); }
    });

    // Manager Rate Change Button
    if (!isTrueOwner() && !isViewer()) {
      const btn = document.createElement('button');
      btn.className = 'btn w full'; btn.style.marginTop = '12px';
      btn.innerHTML = '📈 नया रेट चेंज रिक्वेस्ट भेजें';
      btn.onclick = () => {
        const m = modal(`
          <h3>नया रेट (Request)</h3>
          <label>पेट्रोल (₹)</label><input id="rq-p" inputmode="decimal" value="${S.rates.petrol}">
          <label>डीज़ल (₹)</label><input id="rq-d" inputmode="decimal" value="${S.rates.diesel}">
          <label>कब से लागू हो?</label><input type="date" id="rq-dt" value="${today()}">
          <div class="btns"><button class="btn g" id="rq-sv">भेजें</button><button class="btn w" id="rq-cl">रद्द</button></div>
        `);
        $('#rq-cl', m).onclick = () => m.close();
        $('#rq-sv', m).onclick = async () => {
          const p = num($('#rq-p', m).value), d = num($('#rq-d', m).value);
          if (!p || !d) return toast('रेट डालें');
          try {
            await db().collection('rate_requests').add({
              petrol: p, diesel: d, date: $('#rq-dt', m).value,
              requestedBy: S.user.email, status: 'pending', createdAt: APP.FV.serverTimestamp()
            });
            m.close(); toast('रिक्वेस्ट भेज दी गई ✔'); APP.views.requests();
          } catch (e) { toast('एरर: ' + e.message); }
        };
      };
      main.appendChild(btn);
    }

    const back = document.createElement('div'); back.className = 'btns';
    back.innerHTML = '<button class="btn w" onclick="APP.go(\'more\')">← वापस</button>';
    main.appendChild(back);
  };

  /* ============ CUSTOMERS ============ */
  APP.views.customers = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">ग्राहक लोड हो रहे हैं…</p>';
    let parties;
    try { parties = await APP.getParties(false, true); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const sorted = parties.slice().sort((a, b) => num(b.bal) - num(a.bal));
    main.innerHTML =
      '<div class="btns" style="margin-bottom:10px"><input id="cq" placeholder="नाम या गाड़ी खोजें…" style="flex:1;min-width:0"></div>' +
      '<div id="cgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px"></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    const draw = t => {
      const list = sorted.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#cgrid').innerHTML = list.map(p => {
        const b = num(p.bal), photo = p.photo || '', ini = initials(p.name);
        const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
        const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN') : '+₹' + Math.abs(b).toLocaleString('en-IN'));
        const cls = b > 0 ? 'r' : (b < 0 ? 'g' : '');
        
        return '<div class="card" style="padding:10px;cursor:pointer" data-pid="' + p.id + '">' +
          '<div style="display:flex;flex-direction:column;align-items:center">' +
          (photo
            ? '<img src="' + esc(photo) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #0b3d91">'
            : '<div style="width:64px;height:64px;border-radius:50%;background:#0b3d91;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">' + esc(ini) + '</div>') +
          '<b style="margin-top:6px;text-align:center;font-size:13px;line-height:1.2">' + esc(p.name) + '</b>' +
          '<span class="chip ' + cls + '" style="margin-top:4px;font-size:11px">' + disp + '</span>' +
          (ph ? '<div style="display:flex;gap:4px;margin-top:6px" onclick="event.stopPropagation()">' +
            '<a href="tel:' + esc(p.phone) + '" class="btn sm w" style="padding:4px 8px;font-size:11px">📞</a>' +
            (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn sm g" style="padding:4px 8px;font-size:11px">💬</a>' : '') +
          '</div>' : '') +
          '</div></div>';
      }).join('') || '<p class="mut">कोई ग्राहक नहीं</p>';
      $$('[data-pid]').forEach(el => el.onclick = () => APP.customerCard(el.dataset.pid));
    };
    $('#cq').oninput = e => draw(e.target.value.trim().toLowerCase());
    draw('');
  };

  APP.customerCard = async function (id) {
    let ps; try { ps = await db().collection('parties').doc(id).get(); } catch (e) { return; }
    if (!ps.exists) return;
    const p = { id, ...ps.data() };
    const ini = initials(p.name);
    const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
    let photoData = p.photo || '';
    const m = modal(
      '<h3>' + esc(p.name) + '</h3>' +
      '<div style="text-align:center;padding:8px 0" id="cc-photo-box">' +
        (photoData ? '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">'
        : '<div style="width:100px;height:100px;border-radius:50%;background:#0b3d91;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:700">' + esc(ini) + '</div>') +
      '</div>' +
      (isViewer() ? '' :
        '<div class="btns" style="margin-bottom:8px"><label class="btn sm w" style="cursor:pointer;text-align:center">📷 फोटो<input type="file" accept="image/*" id="cc-photo" style="display:none"></label></div>') +
      '<label>नाम</label><input id="cc-name" value="' + esc(p.name || '') + '"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>फोन</label><input id="cc-phone" value="' + esc(p.phone || '') + '" inputmode="tel"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>गाड़ियाँ</label><input id="cc-veh" value="' + esc((p.vehicles || []).join(', ')) + '"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>उधार सीमा (₹)</label><input id="cc-limit" value="' + esc(p.limit || '') + '" inputmode="decimal"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>दस्तावेज़ / नोट</label><textarea id="cc-doc" rows="2"' + (isViewer() ? ' disabled' : '') + '>' + esc(p.docs || '') + '</textarea>' +
      '<div class="kv" style="margin-top:8px"><span>वर्तमान बकाया</span><b class="' + (num(p.bal) > 0 ? 'neg' : 'pos') + '">' + money(p.bal) + '</b></div>' +
      '<div class="btns" style="margin-top:12px">' +
        (ph ? '<a href="tel:' + esc(p.phone) + '" class="btn g">📞 कॉल</a>' : '') +
        (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn g">💬 WhatsApp</a>' : '') +
      '</div>' +
      '<div class="btns">' +
        '<button class="btn" id="cc-stmt">📤 स्टेटमेंट</button>' +
        (isViewer() ? '' : '<button class="btn g" id="cc-save">💾 सेव</button>') +
        '<button class="btn w" id="cc-close">बंद</button>' +
      '</div>'
    );
    $('#cc-close', m).onclick = () => m.close();
    if (!isViewer()) {
      $('#cc-photo', m).onchange = e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 200, sc = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = img.width * sc; cv.height = img.height * sc;
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            photoData = cv.toDataURL('image/jpeg', 0.75);
            $('#cc-photo-box', m).innerHTML = '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">';
            toast('फोटो तैयार ✔');
          };
          img.src = r.result;
        };
        r.readAsDataURL(f);
      };
      $('#cc-save', m).onclick = async () => {
        const data = {
          name: $('#cc-name', m).value.trim(),
          phone: $('#cc-phone', m).value.trim(),
          vehicles: $('#cc-veh', m).value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean),
          limit: num($('#cc-limit', m).value) || 0,
          docs: $('#cc-doc', m).value.trim(),
          photo: photoData
        };
        if (!data.name) return toast('नाम ज़रूरी');
        try { await db().collection('parties').doc(id).update(data); S.parties.pub = null; m.close(); toast('सेव ✔'); APP.views.customers(); }
        catch (e) { toast('सेव नहीं हुआ: ' + e.message); }
      };
    }
    $('#cc-stmt', m).onclick = () => APP.sharePartyStatement(id, false);
  };

  /* ============ BANK DEPOSITS ============ */
  const isOwnerF = () => APP.isOwner && APP.isOwner();
  const isAutoBank = id => String(id || '').indexOf('sbi_auto_') === 0;

  function bankModal(x, done) {
    const e = x || null;
    const banks = ['SBI', 'HDFC', 'PNB', 'BOB', 'अन्य'];
    if (e && e.bank && banks.indexOf(e.bank) < 0) banks.unshift(e.bank);
    const modes = [['cash', 'नकद'], ['cheque', 'चेक'], ['upi', 'UPI']];
    const m = modal('<h3>' + (e ? '✏️ बैंक जमा बदलें' : 'बैंक जमा') + '</h3>' +
      (e && isAutoBank(e.id) ? '<div class="warn">ये एंट्री दिन के "मालिक को दिया (SBI जमा)" से अपने-आप बनी थी। बदलने के बाद वो दिन दोबारा सेव करने पर भी ये एंट्री अपने-आप नहीं बदलेगी।</div>' : '') +
      '<label>बैंक</label><select id="bn-b">' + banks.map(b => '<option' + (e && e.bank === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>' +
      '<label>तारीख</label><input type="date" id="bn-d" value="' + esc(e ? e.date : today()) + '">' +
      '<label>रकम (₹)</label><input id="bn-a" inputmode="decimal" value="' + esc(e ? e.amount : '') + '">' +
      '<label>माध्यम</label><select id="bn-m">' + modes.map(o => '<option value="' + o[0] + '"' + (e && e.mode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label>चेक नंबर</label><input id="bn-c" value="' + esc(e ? e.cheque || '' : '') + '">' +
      '<label>नोट</label><input id="bn-n" value="' + esc(e ? e.note || '' : '') + '">' +
      '<div class="btns"><button class="btn g" id="bn-sv">सेव</button>' +
      (e ? '<button class="btn r" id="bn-rm">🗑 हटाएँ</button>' : '') +
      '<button class="btn w" id="bn-cl">रद्द</button></div>');
    $('#bn-cl', m).onclick = () => m.close();
    if (e) $('#bn-rm', m).onclick = () => { m.close(); bankRemove(e, done); };
    $('#bn-sv', m).onclick = async () => {
      const a = num($('#bn-a', m).value); if (!(a > 0)) return toast('रकम भरें');
      if (!$('#bn-d', m).value) return toast('तारीख चुनें');
      const who = S.salesman ? S.salesman.name : (S.user && S.user.email) || '';
      const data = {
        bank: $('#bn-b', m).value, date: $('#bn-d', m).value, amount: a,
        mode: $('#bn-m', m).value, cheque: $('#bn-c', m).value.trim(), note: $('#bn-n', m).value.trim()
      };
      try {
        if (e) {
          Object.assign(data, { edited: true, editedBy: who, editedAt: APP.FV.serverTimestamp() });
          await db().collection('bank_deposits').doc(e.id).update(data);
          if (APP.audit) APP.audit('bank_edit', { id: e.id, was: num(e.amount), now: a, date: data.date });
        } else {
          Object.assign(data, { by: who, at: APP.FV.serverTimestamp() });
          await db().collection('bank_deposits').add(data);
        }
        m.close(); toast('सेव ✔'); done();
      } catch (er) { toast('सेव नहीं हुआ: ' + er.message); }
    };
  }

  async function bankRemove(x, done) {
    const auto = isAutoBank(x.id);
    if (!confirm('इस बैंक जमा को हटाएँ?\n\n' + money(x.amount) + ' · ' + (x.bank || 'SBI') + ' · ' + dmy(x.date) +
      (auto ? '\n\nये एंट्री "मालिक को दिया" से अपने-आप बनी थी — हटाने पर दोबारा अपने-आप नहीं बनेगी।' : ''))) return;
    try {
      const who = (S.user && S.user.email) || '';
      if (auto) await db().collection('bank_deposits').doc(x.id).update({ removed: true, removedBy: who, removedAt: APP.FV.serverTimestamp() });
      else await db().collection('bank_deposits').doc(x.id).delete();
      if (APP.audit) APP.audit('bank_delete', { id: x.id, amount: num(x.amount), date: x.date });
      toast('हट गया ✔'); done();
    } catch (er) { toast('हटा नहीं पाया: ' + er.message); }
  }

  APP.views.bank = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('bank_deposits').orderBy('date', 'desc').limit(50).get(); } catch (e) { snap = { docs: [] }; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.removed);
    const tot = list.reduce((a, b) => a + num(b.amount), 0);
    const canEdit = isOwnerF() && !isViewer();
    main.innerHTML =
      '<div class="card"><h3>🏦 बैंक जमा</h3>' + kv('कुल जमा', money(tot), 'pos') + kv('जमा संख्या', list.length) + '</div>' +
      (isViewer() ? '' : '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="bn-add">+ नई जमा</button></div>') +
      '<div class="card">' +
        (list.length ? list.map((x, i) => '<div class="item"><div class="a"><b>' + money(x.amount) + ' · ' + esc(x.bank || 'SBI') + '</b><small>' +
          dmy(x.date) + ' · ' + esc(x.mode || 'नकद') + (x.cheque ? ' · चेक ' + esc(x.cheque) : '') +
          (x.note ? ' · ' + esc(x.note) : '') + (x.edited ? ' · ✏️ बदली हुई' : '') + '</small></div>' +
          (canEdit ? '<div style="white-space:nowrap"><button class="btn sm w" data-bn-e="' + i + '">✏️</button> <button class="btn sm r" data-bn-d="' + i + '">🗑</button></div>' : '') +
          '</div>').join('') : '<p class="mut">कोई जमा नहीं</p>') +
      '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    const again = () => APP.views.bank();
    if (!isViewer() && $('#bn-add')) $('#bn-add').onclick = () => bankModal(null, again);
    $$('[data-bn-e]', main).forEach(b => b.onclick = () => bankModal(list[+b.dataset.bnE], again));
    $$('[data-bn-d]', main).forEach(b => b.onclick = () => bankRemove(list[+b.dataset.bnD], again));
  };

  console.log('[Mazda features_custom.js] loaded ✓');
})();
