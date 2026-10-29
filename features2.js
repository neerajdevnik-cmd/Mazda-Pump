/* Mazda Oil Company - Features pack 2: Workers + Owner Viewer views */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();
  const isViewer = () => APP.isViewer && APP.isViewer();
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c||''}">${b}</b></div>`;
  APP.views = APP.views || {};

  const khBreak = days => K.khSummary(days, true).map(x => '<div class="kv" style="padding:2px 0 2px 14px;font-size:13px"><span class="mut">• ' + esc(x.label) + '</span><span class="mut">' + money(x.amount) + '</span></div>').join('');
  function monthKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthLabel(ym) { const p = ym.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('hi-IN', { month: 'long', year: 'numeric' }); }
  function initials(name) { return String(name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }
  function waNum(ph) { let p = String(ph || '').replace(/\D/g, ''); if (!p) return ''; p = p.replace(/^0+/, ''); if (!p.startsWith('91')) p = '91' + p; return p; }
  function avatar(w, size) {
    size = size || 44;
    if (w.photo) return '<img src="' + esc(w.photo) + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:2px solid #0b3d91;flex:none">';
    return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#0b3d91;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:' + Math.round(size * 0.4) + 'px;flex:none">' + esc(initials(w.name)) + '</div>';
  }

  const ATT = { present: { t: 'आया', c: 'g', i: '✔' }, absent: { t: 'नहीं', c: 'r', i: '✖' }, leave: { t: 'छुट्टी', c: 'o', i: '🏖' }, half: { t: 'आधा', c: 'o', i: '½' } };

  async function getWorkers(force) {
    if (!force && S._workers) return S._workers;
    try {
      const snap = await db().collection('workers').get();
      S._workers = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hi'));
      return S._workers;
    } catch (e) { return []; }
  }
  async function getAtt(date) {
    try {
      const snap = await db().collection('attendance').where('date', '==', date).get();
      const m = {}; snap.docs.forEach(d => { const r = d.data(); m[r.workerId] = { id: d.id, ...r }; });
      return m;
    } catch (e) { return {}; }
  }
  async function markAtt(wid, date, status, exId) {
    const data = { workerId: wid, date, status, by: S.salesman ? S.salesman.name : (S.user && S.user.email) || '', at: APP.FV.serverTimestamp() };
    try {
      if (exId) await db().collection('attendance').doc(exId).update(data);
      else await db().collection('attendance').add(data);
      return true;
    } catch (e) { toast('सेव नहीं हुआ: ' + e.message); return false; }
  }
  async function getSalary(month) {
    try {
      const snap = await db().collection('salary_payments').where('month', '==', month).get();
      const m = {};
      snap.docs.forEach(d => { const r = d.data(); if (!m[r.workerId]) m[r.workerId] = []; m[r.workerId].push({ id: d.id, ...r }); });
      return m;
    } catch (e) { return {}; }
  }

  /* ============ WORKER MODAL ============ */
  function workerModal(w) {
    if (isViewer()) return toast('केवल देखें');
    const isE = !!w;
    let phData = (w && w.photo) || '';
    const m = modal('<h3>' + (isE ? 'वर्कर बदलें' : 'नया वर्कर') + '</h3>' +
      '<div style="text-align:center;padding:8px 0" id="wk-photo-box">' + avatar({ name: (w && w.name) || '?', photo: phData }, 90) + '</div>' +
      '<div class="btns" style="margin-bottom:8px"><label class="btn sm w" style="cursor:pointer;text-align:center">📷 फोटो<input type="file" accept="image/*" id="wk-photo" style="display:none"></label></div>' +
      '<label>नाम</label><input id="wk-name" value="' + esc((w && w.name) || '') + '">' +
      '<label>फोन</label><input id="wk-phone" inputmode="tel" value="' + esc((w && w.phone) || '') + '">' +
      '<label>मासिक सैलरी (₹)</label><input id="wk-sal" inputmode="decimal" value="' + esc((w && w.salary) || '') + '">' +
      '<label>बैंक नाम</label><input id="wk-bank" value="' + esc((w && w.bankName) || 'SBI') + '">' +
      '<label>अकाउंट नंबर</label><input id="wk-acc" value="' + esc((w && w.accountNo) || '') + '">' +
      '<label>IFSC कोड</label><input id="wk-ifsc" value="' + esc((w && w.ifsc) || '') + '" style="text-transform:uppercase">' +
      '<label>जॉइन तारीख</label><input type="date" id="wk-join" value="' + esc((w && w.joinDate) || today()) + '">' +
      '<label>नोट</label><input id="wk-note" value="' + esc((w && w.note) || '') + '">' +
      '<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="wk-active" ' + ((!w || w.active !== false) ? 'checked' : '') + ' style="width:auto"> सक्रिय</label>' +
      '<div class="btns" style="margin-top:12px"><button class="btn g" id="wk-save">💾 सेव</button>' +
      (isE ? '<button class="btn r" id="wk-del">🗑 हटाएँ</button>' : '') +
      '<button class="btn w" id="wk-cancel">रद्द</button></div>');
    $('#wk-photo', m).onchange = e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 220, sc = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          phData = cv.toDataURL('image/jpeg', 0.75);
          $('#wk-photo-box', m).innerHTML = '<img src="' + esc(phData) + '" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">';
          toast('फोटो तैयार ✔');
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    };
    $('#wk-cancel', m).onclick = () => m.close();
    $('#wk-save', m).onclick = async () => {
      const data = {
        name: $('#wk-name', m).value.trim(), phone: $('#wk-phone', m).value.trim(),
        salary: num($('#wk-sal', m).value), bankName: $('#wk-bank', m).value.trim(),
        accountNo: $('#wk-acc', m).value.trim(), ifsc: $('#wk-ifsc', m).value.trim().toUpperCase(),
        joinDate: $('#wk-join', m).value || today(), note: $('#wk-note', m).value.trim(),
        active: $('#wk-active', m).checked, photo: phData, updatedAt: APP.FV.serverTimestamp()
      };
      if (!data.name) return toast('नाम ज़रूरी');
      try {
        if (isE) await db().collection('workers').doc(w.id).update(data);
        else { data.createdAt = APP.FV.serverTimestamp(); await db().collection('workers').add(data); }
        S._workers = null; m.close(); toast('सेव ✔'); APP.views.workers('workers');
      } catch (e) { toast('नहीं हुआ: ' + e.message); }
    };
    if (isE) $('#wk-del', m).onclick = async () => {
      if (!confirm('निष्क्रिय करें?')) return;
      try { await db().collection('workers').doc(w.id).update({ active: false }); S._workers = null; m.close(); toast('निष्क्रिय ✔'); APP.views.workers('workers'); }
      catch (e) { toast('नहीं हुआ: ' + e.message); }
    };
  }

  function salaryModal(w, month) {
    if (isViewer()) return toast('केवल देखें');
    const m = modal('<h3>सैलरी भुगतान</h3>' +
      '<div style="display:flex;align-items:center;gap:10px;padding:8px 0">' + avatar(w, 44) +
        '<div><b>' + esc(w.name) + '</b><br><small class="mut">' + esc(monthLabel(month)) + '</small></div></div>' +
      kv('मासिक सैलरी', money(w.salary)) +
      '<label>दी गई रकम (₹)</label><input id="sp-amt" inputmode="decimal" value="' + esc(w.salary) + '">' +
      '<label>तरीका</label><select id="sp-mode"><option value="cash">नकद</option><option value="bank">बैंक</option><option value="upi">UPI</option></select>' +
      '<label>तारीख</label><input type="date" id="sp-date" value="' + today() + '">' +
      '<label>नोट</label><input id="sp-note">' +
      '<div class="btns" style="margin-top:12px"><button class="btn g" id="sp-save">💾 दर्ज</button><button class="btn w" id="sp-cancel">रद्द</button></div>');
    $('#sp-cancel', m).onclick = () => m.close();
    $('#sp-save', m).onclick = async () => {
      const amt = num($('#sp-amt', m).value); if (!(amt > 0)) return toast('रकम भरें');
      try {
        await db().collection('salary_payments').add({
          workerId: w.id, workerName: w.name, month, amount: amt,
          mode: $('#sp-mode', m).value, date: $('#sp-date', m).value, note: $('#sp-note', m).value.trim(),
          by: S.salesman ? S.salesman.name : (S.user && S.user.email) || '',
          at: APP.FV.serverTimestamp()
        });
        m.close(); toast('दर्ज ✔'); APP.views.workers('salary');
      } catch (e) { toast('नहीं हुआ: ' + e.message); }
    };
  }

  /* ============ STAFF VIEW ============ */
  APP.views.workers = async function (tab) {
    if (isViewer()) { const m = $('#main'); if (m) m.innerHTML = '<div class="err">केवल मालिक/मैनेजर बदल सकते हैं</div>'; return; }
    tab = tab || 'workers';
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const workers = await getWorkers(true);
    const active = workers.filter(w => w.active !== false);

    main.innerHTML =
      '<div class="seg" style="margin-bottom:12px">' +
        '<button data-ttab="workers" class="' + (tab === 'workers' ? 'on' : '') + '">👥 वर्कर</button>' +
        '<button data-ttab="attendance" class="' + (tab === 'attendance' ? 'on' : '') + '">📋 हाज़िरी</button>' +
        '<button data-ttab="salary" class="' + (tab === 'salary' ? 'on' : '') + '">💰 सैलरी</button>' +
      '</div><div id="tabbody"></div>' +
      '<div class="btns" style="margin-top:12px"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';

    $$('[data-ttab]').forEach(b => b.onclick = () => APP.views.workers(b.dataset.ttab));
    const body = $('#tabbody');

    if (tab === 'workers') {
      body.innerHTML =
        '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="w-new">+ नया वर्कर</button></div>' +
        '<div class="card">' + (active.length ? active.map(w =>
          '<div class="item" data-wid="' + w.id + '" style="cursor:pointer">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              avatar(w, 44) +
              '<div class="a"><b>' + esc(w.name) + '</b><small>' + esc(w.phone || '') + ' · ₹' + num(w.salary).toFixed(0) + '/माह</small></div>' +
            '</div>' +
          '</div>').join('') : '<p class="mut">कोई वर्कर नहीं</p>') + '</div>';
      $('#w-new').onclick = () => workerModal(null);
      $$('[data-wid]').forEach(el => el.onclick = () => workerModal(workers.find(w => w.id === el.dataset.wid)));
    }

    else if (tab === 'attendance') {
      const date = today();
      const att = await getAtt(date);
      body.innerHTML =
        '<div class="card"><label>तारीख</label><input type="date" id="att-date" value="' + date + '"></div>' +
        '<div class="card"><h3>हाज़िरी लगाओ</h3>' +
        (active.length ? active.map(w => {
          const a = att[w.id];
          const st = a ? ATT[a.status] : null;
          return '<div class="item">' +
            '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">' + avatar(w, 36) +
              '<div class="a"><b>' + esc(w.name) + '</b><small>' + (st ? st.i + ' ' + st.t : 'अभी दर्ज नहीं') + '</small></div>' +
            '</div>' +
            '<div style="display:flex;gap:3px">' +
              Object.keys(ATT).map(k => {
                const s = ATT[k];
                const on = a && a.status === k;
                return '<button class="btn sm ' + (on ? s.c : 'w') + '" data-mark="' + k + '" data-w="' + w.id + '" data-existing="' + (a ? a.id : '') + '" title="' + s.t + '">' + s.i + '</button>';
              }).join('') +
            '</div></div>';
        }).join('') : '<p class="mut">कोई सक्रिय वर्कर नहीं</p>') +
        '</div>';
      $$('[data-mark]').forEach(b => b.onclick = async () => {
        const ok = await markAtt(b.dataset.w, $('#att-date').value, b.dataset.mark, b.dataset.existing);
        if (ok) APP.views.workers('attendance');
      });
      const ad = $('#att-date');
      if (ad) ad.onchange = () => APP.views.workers('attendance');
    }

    else if (tab === 'salary') {
      const mth = monthKey();
      const pays = await getSalary(mth);
      const pendingList = [];
      let alertHtml = '';
      body.innerHTML =
        '<div class="card"><h3>' + esc(monthLabel(mth)) + '</h3>' +
          '<p class="mut" style="margin:4px 0">सैलरी दी तो ✔ चिन्ह लगाओ। बाकी वालों को ऊपर दिखेगा।</p></div>' +
        '<div class="card">' +
        (active.length ? active.map(w => {
          const list = pays[w.id] || [];
          const paid = list.reduce((a, x) => a + num(x.amount), 0);
          const due = num(w.salary) - paid;
          if (due > 0) pendingList.push({ w, due });
          return '<div class="item">' +
            '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">' + avatar(w, 36) +
              '<div class="a"><b>' + esc(w.name) + '</b><small>मासिक: ' + money(w.salary) + ' · दिया: ' + money(paid) + '</small></div>' +
            '</div>' +
            '<div style="text-align:right">' +
              (due <= 0 ? '<span class="chip g">✔ पूरी</span>' : '<span class="chip o">बाकी ' + money(due) + '</span>') +
              '<br><button class="btn sm g" data-sal="' + w.id + '" style="margin-top:4px">💰 दें</button>' +
            '</div></div>';
        }).join('') : '<p class="mut">कोई सक्रिय वर्कर नहीं</p>') +
        '</div>';
      if (pendingList.length) {
        alertHtml = '<div class="warn"><b>⚠️ बकाया सैलरी:</b> ' + pendingList.map(x => esc(x.w.name) + ' (' + money(x.due) + ')').join(' · ') + '</div>';
        const alert = document.createElement('div');
        alert.innerHTML = alertHtml;
        main.insertBefore(alert.firstChild, body);
      }
      $$('[data-sal]').forEach(b => b.onclick = () => salaryModal(active.find(w => w.id === b.dataset.sal), mth));
    }
  };

  /* ============ VIEWER: HOME ============ */
  APP.views.v_home = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const todayStr = today();
    const mth = monthKey();
    const mStart = mth + '-01', mEnd = mth + '-31';

    let daySnap, partySnap, bankSnap, wSnap, attSnap, salSnap;
    try {
      daySnap = await db().collection('days').where('date', '>=', mStart).where('date', '<=', mEnd).get();
      partySnap = await db().collection('parties').get();
      try { bankSnap = await db().collection('bank_deposits').where('date', '>=', mStart).where('date', '<=', mEnd).get(); } catch (e) { bankSnap = { docs: [] }; }
      try { wSnap = await db().collection('workers').get(); } catch (e) { wSnap = { docs: [] }; }
      try { attSnap = await db().collection('attendance').where('date', '==', todayStr).get(); } catch (e) { attSnap = { docs: [] }; }
      try { salSnap = await db().collection('salary_payments').where('month', '==', mth).get(); } catch (e) { salSnap = { docs: [] }; }
    } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }

    const days = daySnap.docs.map(x => x.data()).sort((a, b) => a.date.localeCompare(b.date));
    const parties = partySnap.docs.map(x => x.data());
    const banks = bankSnap.docs.map(x => x.data()).filter(x => !x.removed);
    const workers = wSnap.docs.map(x => x.data()).filter(w => w.active !== false);
    const att = {}; attSnap.docs.forEach(d => { const r = d.data(); att[r.workerId] = r.status; });
    const salaries = {}; salSnap.docs.forEach(d => { const r = d.data(); if (!salaries[r.workerId]) salaries[r.workerId] = 0; salaries[r.workerId] += num(r.amount); });

    const totSale = days.reduce((a, d) => a + num((d.sum || {}).sale), 0);
    const totKharcha = days.reduce((a, d) => a + K.khTotal(d) + num(d.malikDiya), 0);
    const totUdhar = parties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);
    const totBank = banks.reduce((a, x) => a + num(x.amount), 0);
    const last = days[days.length - 1];
    const cash = last ? num((last.sum || {}).close) : 0;
    const paytm = days.reduce((a, d) => a + num(d.paytm), 0);
    const swipe = days.reduce((a, d) => a + num(d.swipe), 0);
    const present = workers.filter(w => att[w.id] === 'present' || att[w.id] === 'half').length;
    const salPending = workers.filter(w => (salaries[w.id] || 0) < num(w.salary)).length;

    main.innerHTML =
      '<div class="card" style="background:#0b3d91;color:#fff">' +
        '<h3 style="color:#fff;margin:0 0 6px">👁️ मालिक व्यू · ' + esc(monthLabel(mth)) + '</h3>' +
        '<div style="font-size:12px;opacity:.85">केवल देखने का ऐप — कोई बदलाव नहीं</div>' +
      '</div>' +
      '<div class="card"><h3>📊 मुख्य आंकड़े (माह)</h3>' +
        kv('कुल बिक्री', money(totSale), 'big') +
        kv('कुल खर्चा', money(totKharcha), 'neg') +
        khBreak(days) +
        kv('कुल उधार (बकाया)', money(totUdhar), 'neg') +
        kv('बैंक जमा', money(totBank), 'pos') +
        kv('Paytm/UPI', money(paytm)) +
        kv('स्वाइप (कार्ड)', money(swipe)) +
        kv('आज का बचा कैश', money(cash)) +
      '</div>' +
      '<div class="card"><h3>आज का स्नैपशॉट</h3>' +
        (last && last.date === todayStr ? kv('आज की बिक्री', money((last.sum || {}).sale)) : '<p class="mut">आज का हिसाब अभी नहीं बना</p>') +
        kv('वर्कर हाज़िर', present + ' / ' + workers.length) +
        (salPending ? kv('सैलरी बकाया', salPending + ' वर्कर', 'neg') : kv('सैलरी', 'सब को दी ✔', 'pos')) +
      '</div>' +
      '<div class="btns">' +
        '<button class="btn w" data-nv="v_parties">📒 पार्टी लेजर</button>' +
        '<button class="btn w" data-nv="v_money">💰 पूरा पैसा</button>' +
        '<button class="btn w" data-nv="v_workers">👥 वर्कर</button>' +
      '</div>';
    $$('[data-nv]').forEach(b => b.onclick = () => APP.go(b.dataset.nv));
  };

  /* ============ VIEWER: PARTIES (with party click → full ledger) ============ */
  APP.views.v_parties = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties;
    try { parties = await APP.getParties(false, true); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const sorted = parties.slice().sort((a, b) => num(b.bal) - num(a.bal));
    main.innerHTML =
      '<div class="btns" style="margin-bottom:10px"><input id="vpq" placeholder="नाम/गाड़ी खोजें…" style="flex:1;min-width:0"></div>' +
      '<p class="mut" style="font-size:12px;margin:-4px 0 10px;text-align:center">पूरी लेजर देखने के लिए पार्टी के नाम पर टैप करें</p>' +
      '<div id="vplist"></div>';
    const draw = t => {
      const list = sorted.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#vplist').innerHTML = list.length ? list.map(p => {
        const b = num(p.bal);
        const ph = (p.phone || '').replace(/\D/g, '');
        const w = waNum(p.phone);
        const bTxt = Math.abs(b) < 0.005 ? '₹0' : (b > 0 ? '-' : '+') + money(Math.abs(b));
        return '<div class="card">' +
          '<div class="item" style="cursor:pointer;padding-bottom:8px;" data-vpid="' + p.id + '">' +
            '<div class="a"><b>' + esc(p.name) + '</b><small>' + esc((p.vehicles || []).join(', ')) + '</small></div>' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span class="chip ' + (b > 0.005 ? 'r' : b < -0.005 ? 'g' : '') + '">' + bTxt + '</span>' +
              '<span style="color:#9aa5bb;font-size:22px;font-weight:300;">›</span>' +
            '</div>' +
          '</div>' +
          '<div class="btns" style="margin-top:8px">' +
            (ph ? '<a href="tel:' + esc(p.phone) + '" class="btn sm w">📞 कॉल</a>' : '') +
            (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn sm g">💬 WhatsApp</a>' : '') +
            '<button class="btn sm" data-stmt="' + p.id + '">📤 स्टेटमेंट</button>' +
          '</div>' +
        '</div>';
      }).join('') : '<p class="mut">कोई पार्टी नहीं</p>';
      
      // Party card click → open full ledger (read-only)
      $$('[data-vpid]').forEach(el => el.onclick = () => APP.partyView(el.dataset.vpid, false));
      // Statement button click
      $$('[data-stmt]').forEach(b => b.onclick = () => APP.sharePartyStatement(b.dataset.stmt, false));
    };
    $('#vpq').oninput = e => draw(e.target.value.trim().toLowerCase());
    draw('');
  };

  /* ============ VIEWER: MONEY ============ */
  APP.views.v_money = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const mth = monthKey();
    const mStart = mth + '-01', mEnd = mth + '-31';
    let daySnap, bankSnap, ledgerSnap;
    try {
      daySnap = await db().collection('days').where('date', '>=', mStart).where('date', '<=', mEnd).get();
      try { bankSnap = await db().collection('bank_deposits').where('date', '>=', mStart).where('date', '<=', mEnd).get(); }
      catch (e) { bankSnap = { docs: [] }; }
      ledgerSnap = await db().collection('ledger').where('date', '>=', mStart).where('date', '<=', mEnd).get();
    } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const days = daySnap.docs.map(x => x.data()).sort((a, b) => a.date.localeCompare(b.date));
    const banks = bankSnap.docs.map(x => x.data()).filter(x => !x.removed).sort((a, b) => a.date.localeCompare(b.date));
    const ledger = ledgerSnap.docs.map(x => x.data());
    const jd = {};
    ledger.forEach(r => {
      if (r.kind === 'jama') {
        if (!jd[r.date]) jd[r.date] = { cash: 0, paytm: 0, swipe: 0, bank: 0 };
        if (r.mode === 'paytm') jd[r.date].paytm += num(r.amount);
        else if (r.mode === 'swipe') jd[r.date].swipe += num(r.amount);
        else if (r.mode === 'bank') jd[r.date].bank += num(r.amount);
        else jd[r.date].cash += num(r.amount);
      }
    });
    const totPaytm = days.reduce((a, d) => a + num(d.paytm), 0);
    const totSwipe = days.reduce((a, d) => a + num(d.swipe), 0);
    const totBank = banks.reduce((a, x) => a + num(x.amount), 0);
    const totKharcha = days.reduce((a, d) => a + K.khTotal(d) + num(d.malikDiya), 0);
    const totJama = ledger.filter(r => r.kind === 'jama').reduce((a, r) => a + num(r.amount), 0);

    main.innerHTML =
      '<div class="card"><h3>💰 ' + esc(monthLabel(mth)) + '</h3>' +
        kv('Paytm/UPI', money(totPaytm)) +
        kv('स्वाइप (कार्ड)', money(totSwipe)) +
        kv('बैंक जमा', money(totBank)) +
        kv('पार्टी जमा', money(totJama)) +
        kv('कुल खर्चे', money(totKharcha), 'neg') +
      '</div>' +
      '<div class="card"><h3>📅 रोज़ का Paytm / स्वाइप</h3>' +
        '<div style="overflow-x:auto"><table><tr><th>तारीख</th><th class="n">Paytm</th><th class="n">स्वाइप</th><th class="n">जमा</th></tr>' +
        days.map(d => {
          const x = jd[d.date] || {};
          return '<tr><td>' + dmy(d.date) + '</td><td class="n">' + money(d.paytm) + '</td><td class="n">' + money(d.swipe) + '</td><td class="n">' + money((x.paytm || 0) + (x.swipe || 0) + (x.bank || 0) + (x.cash || 0)) + '</td></tr>';
        }).join('') +
        '</table></div></div>' +
      '<div class="card"><h3>🏦 बैंक जमा</h3>' +
        (banks.length ? banks.map(b => '<div class="item"><div class="a"><b>' + money(b.amount) + ' · ' + esc(b.bank || '') + '</b><small>' +
          dmy(b.date) + ' · ' + esc(b.mode || '') + (b.cheque ? ' · चेक ' + esc(b.cheque) : '') + '</small></div></div>').join('')
          : '<p class="mut">कोई जमा नहीं</p>') +
      '</div>' +
      '<div class="card"><h3>💸 खर्चा — किस चीज़ में कितना (माह)</h3>' +
        (K.khSummary(days, true).map(x => kv(esc(x.label), money(x.amount), 'neg')).join('') || '<p class="mut">कोई खर्चा नहीं</p>') +
      '</div>' +
      '<div class="card"><h3>💸 रोज़ के खर्चे (अलग-अलग)</h3>' +
        (days.map(d => {
          const L = K.khList(d);
          if (num(d.malikDiya)) L.push({ label: 'मालिक को दिया (SBI जमा)', amount: num(d.malikDiya) });
          if (!L.length) return '';
          const t = L.reduce((a, x) => a + x.amount, 0);
          return '<div style="padding:8px 0;border-bottom:1px solid #e5e7eb">' +
            '<div class="kv" style="border:0;padding:0"><b>' + dmy(d.date) + '</b><b class="neg">' + money(t) + '</b></div>' +
            L.map(x => '<div class="kv" style="border:0;padding:1px 0 1px 12px;font-size:13px"><span class="mut">• ' + esc(x.label) + '</span><span>' + money(x.amount) + '</span></div>').join('') +
            (d.note ? '<div class="mut" style="font-size:12px;padding-left:12px">नोट: ' + esc(d.note) + '</div>' : '') +
            '</div>';
        }).join('') || '<p class="mut">कोई खर्चा नहीं</p>') +
      '</div>';
  };

  /* ============ VIEWER: WORKERS ============ */
  APP.views.v_workers = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const workers = await getWorkers(true);
    const active = workers.filter(w => w.active !== false);
    const todayStr = today();
    const att = await getAtt(todayStr);
    const mth = monthKey();
    const sal = await getSalary(mth);
    const present = active.filter(w => att[w.id] && (att[w.id].status === 'present' || att[w.id].status === 'half')).length;
    const salPaid = active.filter(w => (sal[w.id] || []).reduce((a, x) => a + num(x.amount), 0) >= num(w.salary)).length;
    main.innerHTML =
      '<div class="card"><h3>👷 वर्कर (' + active.length + ')</h3>' +
        kv('आज हाज़िर', present + ' / ' + active.length) +
        kv('सैलरी पूरी (माह)', salPaid + ' / ' + active.length) +
      '</div>' +
      '<div class="card">' +
        (active.map(w => {
          const a = att[w.id];
          const s = a ? ATT[a.status] : null;
          const paid = (sal[w.id] || []).reduce((x, y) => x + num(y.amount), 0);
          const due = num(w.salary) - paid;
          return '<div class="item"><div style="display:flex;align-items:center;gap:10px">' +
            avatar(w, 44) +
            '<div class="a"><b>' + esc(w.name) + '</b><small>' + esc(w.phone || '') + ' · ₹' + num(w.salary).toFixed(0) + '/माह</small>' +
            (s ? '<small class="' + (s.c === 'g' ? 'pos' : s.c === 'r' ? 'neg' : '') + '">' + s.i + ' ' + s.t + ' आज</small>' : '') +
            '</div></div>' +
            '<div style="text-align:right">' +
              (due <= 0 ? '<span class="chip g">✔ सैलरी पूरी</span>' : '<span class="chip o">बाकी ' + money(due) + '</span>') +
            '</div></div>';
        }).join('') || '<p class="mut">कोई वर्कर नहीं</p>') +
      '</div>';
  };

  console.log('[Mazda features2.js] loaded ✓ (v_parties clickable fix)');
})();
