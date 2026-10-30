/* Mazda Oil Company - Features pack 2: Workers + Owner Viewer views + Location Setup */
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

  /* ============ WORKERS MANAGEMENT (Owner/Manager) ============ */
  APP.views.workers = async function () {
    if (isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">वर्कर लोड हो रहे हैं…</p>';
    
    let wSnap, attSnap;
    try {
      [wSnap, attSnap] = await Promise.all([
        db().collection('workers').get(),
        db().collection('attendance').where('date', '==', today()).get()
      ]);
    } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const workers = wSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(w => w.active !== false);
    const att = {};
    attSnap.docs.forEach(d => { const x = d.data(); att[x.workerId] = x.status; });

    let html = '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">👷 वर्कर हाज़िरी</h3><div style="font-size:12px;opacity:.85;margin-top:4px">आज: ' + dmy(today()) + '</div></div>';
    
    if (!workers.length) {
      html += '<div class="card"><p class="mut" style="text-align:center;padding:20px">कोई वर्कर नहीं जुड़ा है</p></div>';
    } else {
      html += '<div class="card">';
      workers.forEach(w => {
        const status = att[w.id];
        let chip = '<span class="chip">?</span>';
        if (status === 'present') chip = '<span class="chip g">✔ आया</span>';
        if (status === 'absent') chip = '<span class="chip r">❌ नहीं आया</span>';
        if (status === 'half') chip = '<span class="chip o">½ आधा दिन</span>';

        html += `<div class="item">
          <div class="a"><b>${esc(w.name)}</b><small>${esc(w.role || 'Staff')} · ₹${w.salary || 0}/माह</small></div>
          <div style="text-align:right">
            ${chip}
            <div style="margin-top:4px">
              <button class="btn sm w" data-att="present" data-wid="${w.id}">P</button>
              <button class="btn sm w" data-att="absent" data-wid="${w.id}">A</button>
              <button class="btn sm w" data-att="half" data-wid="${w.id}">H</button>
            </div>
          </div>
        </div>`;
      });
      html += '</div>';
    }
    
    html += '<div class="btns"><button class="btn o" id="w-add">+ नया वर्कर</button><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    main.innerHTML = html;

    $$('[data-att]').forEach(b => b.onclick = async () => {
      const wid = b.dataset.wid, st = b.dataset.att;
      b.disabled = true;
      try {
        await db().collection('attendance').doc(today() + '_' + wid).set({
          date: today(), workerId: wid, status: st, markedBy: S.user.email, at: APP.FV.serverTimestamp()
        }, { merge: true });
        toast('मार्क हो गया ✔');
        APP.views.workers();
      } catch (e) { b.disabled = false; toast('नहीं हुआ: ' + e.message); }
    });

    if ($('#w-add')) $('#w-add').onclick = () => {
      const m = modal(`
        <h3>नया वर्कर</h3>
        <label>नाम</label><input id="w-name">
        <label>काम (जैसे: Helper, Manager)</label><input id="w-role">
        <label>महीने की सैलरी (₹)</label><input id="w-sal" inputmode="decimal">
        <div class="btns"><button class="btn g" id="w-sv">सेव</button><button class="btn w" id="w-cl">रद्द</button></div>
      `);
      $('#w-cl', m).onclick = () => m.close();
      $('#w-sv', m).onclick = async () => {
        const name = $('#w-name', m).value.trim();
        if(!name) return toast('नाम लिखें');
        try {
          await db().collection('workers').add({
            name, role: $('#w-role', m).value.trim(), salary: num($('#w-sal', m).value), active: true, createdAt: APP.FV.serverTimestamp()
          });
          m.close(); toast('वर्कर जुड़ गया ✔'); APP.views.workers();
        } catch(e) { toast('एरर: ' + e.message); }
      };
    };
  };


  /* ============ VIEWER VIEWS (Read Only) ============ */

  // 1. VIEWER HOME
  APP.views.v_home = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">होम लोड हो रहा है…</p>';
    let ds, ps;
    try {
      [ds, ps] = await Promise.all([
        db().collection('days').orderBy('date', 'desc').limit(1).get(),
        APP.getParties(false, true)
      ]);
    } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const lastDay = ds.empty ? {} : ds.docs[0].data();
    const sum = lastDay.sum || {};
    const totDue = ps.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);

    main.innerHTML = `
      <div class="card" style="background:linear-gradient(135deg,#0a2f6b,#1a5fd0);color:#fff">
        <div style="font-size:14px;opacity:.9">आखिरी हिसाब: ${lastDay.date ? dmy(lastDay.date) : 'कोई नहीं'}</div>
        <div style="font-size:32px;font-weight:900;margin:4px 0">${money(sum.sale || 0)}</div>
        <div style="font-size:13px;opacity:.8">कुल बिक्री</div>
      </div>
      
      <div class="row">
        <div class="card" style="flex:1;margin:0;text-align:center">
          <div class="mut">बचा कैश</div>
          <b class="pos" style="font-size:18px">${money(sum.close || 0)}</b>
        </div>
        <div class="card" style="flex:1;margin:0;text-align:center">
          <div class="mut">कुल बकाया</div>
          <b class="neg" style="font-size:18px">${money(totDue)}</b>
        </div>
      </div>

      <div class="card"><h3>आज का स्टॉक</h3>
        ${kv('⛽ पेट्रोल', APP.lit(sum.actStockP || sum.expStockP || 0))}
        ${kv('🛢️ डीज़ल', APP.lit(sum.actStockD || sum.expStockD || 0))}
      </div>

      <div class="btns"><button class="btn w" onclick="APP.go('v_parties')">📒 पार्टी खाते देखें</button></div>
    `;
  };

  // 2. VIEWER PARTIES
  APP.views.v_parties = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">पार्टी लोड हो रही हैं…</p>';
    let ps;
    try { ps = await APP.getParties(false, true); } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const sorted = ps.slice().sort((a, b) => num(b.bal) - num(a.bal));
    const totDue = sorted.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);

    main.innerHTML = `
      <div class="card">
        <div class="kv"><span>कुल बकाया (लेना है)</span><b class="neg">${money(totDue)}</b></div>
      </div>
      <div class="card"><div class="row search"><input id="vpq" placeholder="पार्टी खोजें…"></div></div>
      <div class="card" id="vplist"></div>
    `;

    const draw = t => {
      const list = sorted.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#vplist').innerHTML = list.length ? list.map(p => {
        const b = num(p.bal);
        // 🔥 RED/GREEN RULE APPLIED
        const disp = b === 0 ? '₹0' : (b > 0 ? '-₹' + Math.abs(b).toLocaleString('en-IN') : '+₹' + Math.abs(b).toLocaleString('en-IN'));
        const cls = b > 0 ? 'r' : (b < 0 ? 'g' : '');
        return `<div class="item" data-id="${p.id}" style="cursor:pointer">
          <div class="a"><b>${esc(p.name)}</b><small>${esc((p.vehicles || []).join(', '))}</small></div>
          <span class="chip ${cls}">${disp}</span>
        </div>`;
      }).join('') : '<p class="mut">कोई पार्टी नहीं मिली</p>';
      
      $$('#vplist .item').forEach(it => it.onclick = () => APP.partyView(it.dataset.id, false));
    };
    $('#vpq').oninput = e => draw(e.target.value.toLowerCase());
    draw('');
  };

  // 3. VIEWER MONEY (Cash Flow)
  APP.views.v_money = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">पैसा लोड हो रहा है…</p>';
    const from = APP.shiftDate(today(), -30);
    let ds, bs;
    try {
      [ds, bs] = await Promise.all([
        db().collection('days').where('date', '>=', from).get(),
        db().collection('bank_deposits').where('date', '>=', from).get().catch(()=>({docs:[]}))
      ]);
    } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const days = ds.docs.map(x => x.data());
    const banks = bs.docs.map(x => x.data()).filter(x=>!x.removed).sort((a,b)=>b.date.localeCompare(a.date));

    const totSBI = days.reduce((a, d) => a + num(d.malikDiya), 0);
    const totPaytm = days.reduce((a, d) => a + num(d.paytm), 0);
    const totSwipe = days.reduce((a, d) => a + num(d.swipe), 0);
    const totKharcha = days.reduce((a, d) => a + (K.khTotal ? K.khTotal(d) : 0), 0);

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">💰 पैसा (30 दिन)</h3></div>
      
      <div class="card">
        <h3>कैश फ्लो</h3>
        ${kv('SBI जमा (Owner को दिया)', money(totSBI), 'pos')}
        ${kv('Paytm / UPI', money(totPaytm))}
        ${kv('स्वाइप (कार्ड)', money(totSwipe))}
        ${kv('कुल खर्चे', money(totKharcha), 'neg')}
      </div>

      <div class="card">
        <h3>हाल के SBI जमा</h3>
        ${banks.slice(0, 10).map(b => kv(dmy(b.date), money(b.amount))).join('') || '<p class="mut">कोई जमा नहीं</p>'}
      </div>
      
      <div class="btns"><button class="btn w" onclick="APP.go('more')">← वापस</button></div>
    `;
  };

  // 4. VIEWER WORKERS (Read Only)
  APP.views.v_workers = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let wSnap, attSnap;
    try {
      [wSnap, attSnap] = await Promise.all([
        db().collection('workers').get(),
        db().collection('attendance').where('date', '==', today()).get()
      ]);
    } catch (e) { main.innerHTML = APP.errBox(e); return; }

    const workers = wSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(w => w.active !== false);
    const att = {};
    attSnap.docs.forEach(d => { const x = d.data(); att[x.workerId] = x.status; });

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">👥 वर्कर हाज़िरी</h3><div style="font-size:12px;opacity:.85;margin-top:4px">आज: ${dmy(today())}</div></div>
      <div class="card">
        ${workers.length ? workers.map(w => {
          const status = att[w.id];
          let chip = '<span class="chip">?</span>';
          if (status === 'present') chip = '<span class="chip g">✔ आया</span>';
          if (status === 'absent') chip = '<span class="chip r">❌ नहीं आया</span>';
          if (status === 'half') chip = '<span class="chip o">½ आधा दिन</span>';
          
          return `<div class="item">
            <div class="a"><b>${esc(w.name)}</b><small>${esc(w.role || 'Staff')}</small></div>
            ${chip}
          </div>`;
        }).join('') : '<p class="mut">कोई वर्कर नहीं जुड़ा</p>'}
      </div>
      <div class="btns"><button class="btn w" onclick="APP.go('more')">← वापस</button></div>
    `;
  };


  /* ============ VIEWER'S MORE MENU ============ */
  const origMoreViewer = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMoreViewer) await origMoreViewer.apply(this, arguments);
    if (!isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#extra-more-card')) return;
    
    const extra = document.createElement('div');
    extra.id = 'extra-more-card';
    extra.innerHTML =
      '<div class="card"><h3>📊 विश्लेषण</h3><div class="btns">' +
        (APP.views.analytics ? '<button class="btn w" data-nav="analytics">📊 आंकड़ों का विश्लेषण</button>' : '') +
        (APP.views.rate_history ? '<button class="btn w" data-nav="rate_history">📈 रेट इतिहास</button>' : '') +
        (APP.views.dashboard ? '<button class="btn w" data-nav="dashboard">📊 डैशबोर्ड</button>' : '') +
        (APP.views.monthreport ? '<button class="btn w" data-nav="monthreport">📅 मासिक रिपोर्ट</button>' : '') +
        (APP.views.nozzle ? '<button class="btn w" data-nav="nozzle">⛽ नोज़ल ट्रेंड</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>💰 वित्त</h3><div class="btns">' +
        (APP.views.bank ? '<button class="btn w" data-nav="bank">🏦 बैंक जमा</button>' : '') +
        (APP.views.invoices ? '<button class="btn w" data-nav="invoices">📄 खरीद बिल / मार्जिन</button>' : '') +
        (APP.views.reminders ? '<button class="btn w" data-nav="reminders">⏰ उधार रिमाइंडर</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>👥 पार्टी</h3><div class="btns">' +
        (APP.views.customers ? '<button class="btn w" data-nav="customers">👥 ग्राहक कार्ड</button>' : '') +
        (APP.cibil ? '<button class="btn w" data-nav="cibil">⭐ पार्टी CIBIL</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>👷 वर्कर</h3><div class="btns">' +
        '<button class="btn w" data-nav="v_workers">👷 वर्कर हाज़िरी</button>' +
      '</div></div>' +
      '<div class="card"><h3>🔍 लॉग</h3><div class="btns">' +
        (APP.views.audit ? '<button class="btn w" data-nav="audit">🔍 ऑडिट लॉग</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>💾 बैकअप</h3>' +
        '<p class="mut" style="font-size:12px;margin:4px 0">सारा डेटा एक फ़ाइल में।</p>' +
        '<div class="btns"><button class="btn g" id="bk-json">JSON</button><button class="btn w" id="bk-csv">CSV (Excel)</button></div></div>';
    
    main.appendChild(extra);
    extra.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => APP.go(b.dataset.nav));
    const jb = $('#bk-json'); if (jb) jb.onclick = () => APP.downloadBackup('json');
    const cb = $('#bk-csv'); if (cb) cb.onclick = () => APP.downloadBackup('csv');
  };

  console.log('[Mazda features2.js] loaded ✓ (owner view enhanced + workers fixed)');
})();
