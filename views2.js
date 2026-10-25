/* स्टॉक, निजी उधार, रिपोर्ट/बिल/QR/शेयर, सेल्समैन डैशबोर्ड, गाड़ी कैश, थर्मल पर्ची व AI स्कैन */
(function () {
  'use strict';
  const APP = window.APP, C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const r2 = (n) => (K && K.r2 ? K.r2(n) : Number(n || 0).toFixed(2));
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, FUEL = APP.FUEL, MODE = APP.MODE, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  /* ======================= SALESMAN DASHBOARD ======================= */
  APP.views.salesman = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const sm = S.salesman || { name: 'Salesman', id: 'sm1' };
    let parties = [];
    try { parties = await APP.getParties(false); } catch (e) { }

    main.innerHTML = `
      <div class="card" style="background:#e8f0fe;border-left:4px solid var(--b)">
        <h3 style="margin:0;color:var(--b)">⛽ सेल्समैन: ${esc(sm.name)}</h3>
        <small class="mut">तारीख: ${dmy(APP.todayISO())} | ड्यूटी चालू है</small>
      </div>
      <div class="card">
        <h3>त्वरित एंट्री</h3>
        <div class="quick-btns" style="display:flex;gap:8px;margin-bottom:8px">
          <button class="btn full o" id="sm-add-u">+ उधार</button>
          <button class="btn full g" id="sm-add-j">+ जमा</button>
        </div>
      </div>
      <div class="card">
        <h3>शिफ्ट क्लोजिंग</h3>
        <div class="row">
          <div><label>कुल कैश</label><input id="sm-cash" inputmode="decimal" placeholder="₹ कैश"></div>
          <div><label>Paytm/UPI</label><input id="sm-paytm" inputmode="decimal" placeholder="₹ Paytm"></div>
        </div>
        <div class="btns" style="margin-top:10px">
          <button class="btn g full" id="sm-submit-slip">✅ शिफ्ट जमा करें</button>
        </div>
      </div>`;

    $('#sm-add-u').onclick = () => APP.entryModal({ kind: 'udhar', date: APP.todayISO() });
    $('#sm-add-j').onclick = () => APP.entryModal({ kind: 'jama', date: APP.todayISO() });
    $('#sm-submit-slip').onclick = async () => {
      if (!confirm('क्या आप शिफ्ट पर्ची जमा करना चाहते हैं?')) return;
      try {
        await db().collection('salesman_shifts').add({
          salesmanId: sm.id,
          salesmanName: sm.name,
          date: APP.todayISO(),
          time: APP.nowTime(),
          cash: num($('#sm-cash').value),
          paytm: num($('#sm-paytm').value),
          createdAt: APP.FV.serverTimestamp()
        });
        toast('शिफ्ट पर्ची जमा हो गई ✔');
      } catch (e) { toast('एरर: ' + e.message); }
    };
  };

  /* ======================= GAADI CASH ======================= */
  APP.views.gaadicash = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">गाड़ी कैश लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('gaadi_cash').orderBy('date', 'desc').limit(40).get(); } catch (e) { snap = { docs: [] }; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totPending = list.filter(x => x.status !== 'paid').reduce((a, b) => a + num(b.amount), 0);

    main.innerHTML = `
      <div class="card">
        <div class="kv"><span>कुल बाकी गाड़ी कैश</span><b class="neg">${money(totPending)}</b></div>
      </div>
      <div class="btns" style="margin-bottom:12px">
        <button class="btn o" id="gc-add">+ नया गाड़ी कैश दें</button>
      </div>
      <div class="card" id="gc-box">
        ${list.length ? list.map(item => `
          <div class="item">
            <div class="a">
              <b>${esc(item.vehicle)} · ${esc(item.partyName || 'लोकल')}</b>
              <small>${dmy(item.date)} · ड्राइवर: ${esc(item.driverName || '-')}</small>
            </div>
            <div style="text-align:right">
              <b class="neg">${money(item.amount)}</b><br>
              ${item.status === 'paid' ? '<span class="chip g">Paid</span>' : `<button class="btn sm g" data-gc-id="${item.id}">✔ Paid</button>`}
            </div>
          </div>`).join('') : '<p class="mut">कोई गाड़ी कैश रिकॉर्ड नहीं है</p>'}
      </div>`;

    $('#gc-add').onclick = () => {
      const m = modal(`
        <h3>नया गाड़ी कैश</h3>
        <label>गाड़ी नंबर</label><input id="gc-v" style="text-transform:uppercase">
        <label>पार्टी नाम</label><input id="gc-p">
        <label>कैश रकम (₹)</label><input id="gc-a" inputmode="decimal">
        <div class="btns" style="margin-top:10px">
          <button class="btn g" id="gc-save">सेव करें</button>
          <button class="btn w" id="gc-close">रद्द</button>
        </div>`);
      $('#gc-close', m).onclick = () => m.close();
      $('#gc-save', m).onclick = async () => {
        const v = $('#gc-v', m).value.trim().toUpperCase(), a = num($('#gc-a', m).value);
        if (!v || !(a > 0)) return toast('गाड़ी नंबर व रकम सही भरें');
        await db().collection('gaadi_cash').add({
          vehicle: v, partyName: $('#gc-p', m).value.trim(), amount: a,
          date: APP.todayISO(), status: 'pending', createdAt: APP.FV.serverTimestamp()
        });
        m.close(); toast('सेव हो गया'); APP.views.gaadicash();
      };
    };

    $$('[data-gc-id]').forEach(b => {
      b.onclick = async () => {
        await db().collection('gaadi_cash').doc(b.dataset.gcId).update({ status: 'paid' });
        toast('Paid मार्क हो गया'); APP.views.gaadicash();
      };
    });
  };

  /* ======================= STOCK VIEW ======================= */
  APP.views.stock = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap; try { snap = await db().collection('days').orderBy('date', 'desc').limit(15).get(); } catch (e) { snap = { docs: [] }; }
    const days = snap.docs.map(d => d.data());
    if (!days.length) { main.innerHTML = '<div class="card">कोई डेटा उपलब्ध नहीं है।</div>'; return; }
    main.innerHTML = `
      <div class="card">
        <h3>🛢️ स्टॉक रिकॉर्ड (हाल के दिन)</h3>
        <table>
          <tr><th>तारीख</th><th class="n">P सेल</th><th class="n">D सेल</th><th class="n">P डिप</th><th class="n">D डिप</th></tr>
          ${days.map(d => `<tr><td>${dmy(d.date)}</td><td class="n">${d.sum ? d.sum.litP : '-'}</td><td class="n">${d.sum ? d.sum.litD : '-'}</td><td class="n">${d.dipP || '-'}</td><td class="n">${d.dipD || '-'}</td></tr>`).join('')}
        </table>
      </div>`;
  };

  /* ======================= NIJI UDHAR (PRIV) ======================= */
  APP.views.priv = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties = [];
    try { parties = await APP.getParties(true, true); } catch (e) { }
    const pend = parties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);

    main.innerHTML = `
      <div class="card">
        <div class="kv"><span>कुल निजी उधार</span><b class="neg">${money(pend)}</b></div>
      </div>
      <div class="btns" style="margin-bottom:12px">
        <button class="btn o" id="pv-add">+ नया निजी उधार</button>
      </div>
      <div class="card">
        ${parties.length ? parties.map(p => `
          <div class="item" style="cursor:pointer" data-pid="${p.id}">
            <div class="a"><b>${esc(p.name)}</b><small>${(p.vehicles || []).join(', ')}</small></div>
            <span class="chip ${num(p.bal) > 0 ? 'r' : 'g'}">${money(p.bal)}</span>
          </div>`).join('') : '<p class="mut">कोई निजी पार्टी नहीं है</p>'}
      </div>`;

    $('#pv-add').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
    $$('[data-pid]').forEach(el => el.onclick = () => APP.partyView(el.dataset.pid, true));
  };

  /* ======================= MORE VIEW ======================= */
  APP.views.more = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = `
      <div class="card">
        <h3>खाता एवं सेटिंग्स</h3>
        ${kv('उपयोगकर्ता', esc(S.user ? S.user.email : 'Salesman'))}
        ${kv('भूमिका', APP.isOwner() ? 'मालिक' : 'मैनेजर / सेल्समैन')}
        <div class="btns" style="margin-top:10px">
          <button class="btn r full" id="m-logout">लॉगआउट</button>
        </div>
      </div>
      <div class="card">
        <h3>AI स्कैनर सेटिंग्स</h3>
        <label>Gemini API Key</label>
        <input id="gemini-key" value="${esc(localStorage.getItem('mazda_gemini_key') || '')}" placeholder="API Key यहाँ डालें">
        <div class="btns" style="margin-top:8px">
          <button class="btn g full" id="save-key">API Key सेव करें</button>
        </div>
      </div>`;

    $('#m-logout').onclick = () => {
      localStorage.removeItem('mazda_sm');
      if (APP.auth) APP.auth.signOut();
      location.reload();
    };
    $('#save-key').onclick = () => {
      const k = $('#gemini-key').value.trim();
      localStorage.setItem('mazda_gemini_key', k);
      toast('Key सुरक्षित हो गई ✔');
    };
  };

  /* ======================= THERMAL SLIP SYSTEM ======================= */
  APP.showThermalSlip = function (data) {
    const inv = '244' + String(Date.now()).slice(-8);
    const slipHTML = `
      <div id="slip-capture-node" style="background:#fff;color:#000;font-family:'Courier New',monospace;padding:16px 12px;width:280px;margin:0 auto;border:1px solid #ddd;font-size:12px;line-height:1.35;text-align:left;">
        <div style="text-align:center;font-weight:bold;margin-bottom:6px;">
          <div style="font-size:16px;border-bottom:1px dashed #000;padding-bottom:4px;">${esc(C.pump.nameEn || 'MAZDA OIL COMPANY')}</div>
          <div style="font-size:10px;margin-top:2px;">${esc(C.pump.dealer || 'BHARAT PETROLEUM DEALER')}</div>
          <div style="font-size:10px;">${esc(C.pump.addressEn || '')}</div>
          <div style="font-size:13px;margin:4px 0;">*** Welcomes You ***</div>
        </div>
        <div style="border-bottom:1px dashed #000;margin:4px 0;"></div>
        <div>INV NO &nbsp;: ${inv}</div>
        <div>DATE &nbsp; &nbsp;: ${dmy(data.date)} ${data.time || APP.nowTime()}</div>
        <div>VEHICLE : <b>${esc(data.vehicle || 'CASH')}</b></div>
        <div>PARTY &nbsp; : ${esc(data.partyName || 'WALK-IN')}</div>
        <div style="border-bottom:1px dashed #000;margin:4px 0;"></div>
        <div>PRODUCT : ${(data.fuel || 'petrol').toUpperCase()}</div>
        <div>RATE &nbsp; &nbsp;: ₹${r2(data.rate)}/L</div>
        <div>VOLUME &nbsp;: ${r2(data.litre)} L</div>
        <div style="font-size:14px;font-weight:bold;margin:4px 0;">AMOUNT &nbsp;: ₹${r2(data.amount)}</div>
        <div style="border-bottom:1px dashed #000;margin:4px 0;"></div>
        <div style="text-align:center;margin-top:6px;">THANK YOU! VISIT AGAIN</div>
      </div>`;

    const m = modal(`
      <h3>🖨️ पर्ची रसीद</h3>
      <div id="slip-preview-render" style="padding:10px 0;text-align:center">${slipHTML}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn g full" id="slip-share-btn">📤 WhatsApp पर शेयर करें (Image)</button>
        <button class="btn w full" id="slip-close-btn">बंद करें</button>
      </div>`);

    $('#slip-close-btn', m).onclick = () => m.close();
    $('#slip-share-btn', m).onclick = async () => {
      toast('इमेज तैयार हो रही है…');
      try {
        const node = $('#slip-capture-node', m);
        const cv = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
        cv.toBlob(async blob => {
          const file = new File([blob], `slip-${data.vehicle || 'cash'}.png`, { type: 'image/png' });
          const text = `*${C.pump.nameEn}*\nगाड़ी: ${data.vehicle || 'Cash'}\nलीटर: ${data.litre} L\nरकम: ₹${data.amount}`;
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: text });
          } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = file.name; a.click();
            toast('पर्ची डाउनलोड हो गई ✔');
          }
        }, 'image/png');
      } catch (e) {
        toast('शेयर नहीं हो पाई: ' + e.message);
      }
    };
  };

  /* ======================= AI REGISTER SCAN ======================= */
  APP.scanRegister = function (st) {
    const key = localStorage.getItem('mazda_gemini_key') || '';
    if (!key) return toast('पहले "और" टैब में Gemini API Key सेव करें');

    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      toast('AI रजिस्टर पढ़ रहा है… कृपया रुकें');
      try {
        const bmp = await createImageBitmap(file);
        const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1];

        const promptText = `Extract meter numbers, cash and expenses from this register. Output strict JSON only:
        {"petrol":{"rate":100.23,"dip":0},"diesel":{"rate":95.68,"dip":0},"cash":{"paytm":0,"swipe":0,"kharcha":0}}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: 'image/jpeg', data: b64 } }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        const j = await res.json();
        if (j.error) throw new Error(j.error.message || 'API Fail');
        const raw = JSON.parse(j.candidates[0].content.parts[0].text);

        if (raw.cash) {
          if (raw.cash.paytm && $('#f-paytm')) $('#f-paytm').value = raw.cash.paytm;
          if (raw.cash.swipe && $('#f-swipe')) $('#f-swipe').value = raw.cash.swipe;
          if (raw.cash.kharcha && $('#f-kharcha')) $('#f-kharcha').value = raw.cash.kharcha;
        }
        if (raw.petrol && raw.petrol.rate && $('#f-rateP')) $('#f-rateP').value = raw.petrol.rate;
        if (raw.diesel && raw.diesel.rate && $('#f-rateD')) $('#f-rateD').value = raw.diesel.rate;
        if (APP.recalc) APP.recalc();
        toast('रजिस्टर डेटा फॉर्म में भर गया ✔');
      } catch (e) {
        toast('स्कैन असफल: ' + e.message);
      }
    };
    inp.click();
  };

  APP.scanLedgerPhoto = () => toast('लेजर स्कैन जल्द उपलब्ध होगा');
  APP.shareCompactDayReport = () => toast('रिपोर्ट फीचर उपलब्ध है');
})();
