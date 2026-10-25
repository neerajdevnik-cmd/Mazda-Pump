/* स्टॉक, गाड़ी कैश, निजी उधार, सेटिंग्स, थर्मल पर्ची व फाइनल AI स्कैनर */
(function () {
  'use strict';
  const APP = window.APP || {};
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const r2 = (n) => (K && K.r2 ? K.r2(n) : Number(n || 0).toFixed(2));
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  APP.views = APP.views || {};

  /* ======================= GAADI CASH ======================= */
  APP.views.gaadicash = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">गाड़ी कैश लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('gaadi_cash').orderBy('date', 'desc').limit(40).get(); } catch (e) { snap = { docs: [] }; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const totPending = list.filter(x => x.status !== 'paid').reduce((a, b) => a + num(b.amount), 0);

    main.innerHTML = `
      <div class="card"><div class="kv"><span>कुल बाकी गाड़ी कैश</span><b class="neg">${money(totPending)}</b></div></div>
      <div class="btns" style="margin-bottom:12px"><button class="btn o" id="gc-add">+ नया गाड़ी कैश दें</button></div>
      <div class="card">
        ${list.length ? list.map(item => `
          <div class="item">
            <div class="a"><b>${esc(item.vehicle)} · ${esc(item.partyName || 'लोकल')}</b><small>${dmy(item.date)}</small></div>
            <div style="text-align:right"><b class="neg">${money(item.amount)}</b><br>${item.status === 'paid' ? '<span class="chip g">Paid</span>' : `<button class="btn sm g" data-gc-id="${item.id}">✔ Paid</button>`}</div>
          </div>`).join('') : '<p class="mut">कोई रिकॉर्ड नहीं</p>'}
      </div>`;

    $('#gc-add').onclick = () => {
      const m = modal(`<h3>नया गाड़ी कैश</h3>
        <label>गाड़ी नंबर</label><input id="gc-v" style="text-transform:uppercase">
        <label>पार्टी</label><input id="gc-p">
        <label>रुपये</label><input id="gc-a" inputmode="decimal">
        <div class="btns" style="margin-top:10px"><button class="btn g" id="gc-sv">सेव</button><button class="btn w" id="gc-cl">रद्द</button></div>`);
      $('#gc-cl', m).onclick = () => m.close();
      $('#gc-sv', m).onclick = async () => {
        const v = $('#gc-v', m).value.trim().toUpperCase(), a = num($('#gc-a', m).value);
        if (!v || !(a > 0)) return toast('गाड़ी नंबर व रकम सही भरें');
        await db().collection('gaadi_cash').add({ vehicle: v, partyName: $('#gc-p', m).value.trim(), amount: a, date: APP.todayISO(), status: 'pending', createdAt: APP.FV.serverTimestamp() });
        m.close(); toast('सेव हो गया'); APP.views.gaadicash();
      };
    };
    $$('[data-gc-id]').forEach(b => {
      b.onclick = async () => { await db().collection('gaadi_cash').doc(b.dataset.gcId).update({ status: 'paid' }); toast('Paid हो गया'); APP.views.gaadicash(); };
    });
  };

  /* ======================= STOCK ======================= */
  APP.views.stock = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap; try { snap = await db().collection('days').orderBy('date', 'desc').limit(15).get(); } catch (e) { snap = { docs: [] }; }
    const days = snap.docs.map(d => d.data());
    main.innerHTML = `
      <div class="card">
        <h3>🛢️ स्टॉक रिकॉर्ड</h3>
        <table><tr><th>तारीख</th><th class="n">P सेल</th><th class="n">D सेल</th><th class="n">P डिप</th><th class="n">D डिप</th></tr>
        ${days.map(d => `<tr><td>${dmy(d.date)}</td><td class="n">${d.sum ? d.sum.litP : '-'}</td><td class="n">${d.sum ? d.sum.litD : '-'}</td><td class="n">${d.dipP || '-'}</td><td class="n">${d.dipD || '-'}</td></tr>`).join('')}
        </table>
      </div>`;
  };

  /* ======================= NIJI UDHAR (PRIV) ======================= */
  APP.views.priv = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties = []; try { parties = await APP.getParties(true, true); } catch (e) { }
    const pend = parties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0);
    main.innerHTML = `
      <div class="card"><div class="kv"><span>कुल निजी उधार</span><b class="neg">${money(pend)}</b></div></div>
      <div class="btns" style="margin-bottom:12px"><button class="btn o" id="pv-add">+ नया निजी उधार</button></div>
      <div class="card">
        ${parties.length ? parties.map(p => `<div class="item"><div class="a"><b>${esc(p.name)}</b></div><span class="chip r">${money(p.bal)}</span></div>`).join('') : '<p class="mut">कोई निजी खाता नहीं</p>'}
      </div>`;
    $('#pv-add').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
  };

  /* ======================= MORE / SETTINGS ======================= */
  APP.views.more = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = `
      <div class="card">
        <h3>खाता सेटिंग्स</h3>
        ${kv('लॉगिन', esc(S.user ? S.user.email : 'Salesman'))}
        ${kv('भूमिका', APP.isOwner() ? 'मालिक' : 'मैनेजर')}
        <div class="btns" style="margin-top:10px">
          <button class="btn r full" id="m-logout">लॉगआउट</button>
        </div>
      </div>
      <div class="card">
        <h3>AI स्कैनर सेटिंग्स (Gemini API Key)</h3>
        <label>API Key</label>
        <input id="gemini-key" value="${esc(localStorage.getItem('mazda_gemini_key') || '')}" placeholder="अपनी API Key यहाँ पेस्ट करें">
        <div class="btns" style="margin-top:8px">
          <button class="btn g full" id="save-key">API Key सुरक्षित करें</button>
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
      toast('API Key सुरक्षित हो गई ✔');
    };
  };

  /* ======================= BPCL THERMAL SLIP ======================= */
  APP.showThermalSlip = function (data) {
    const inv = '244' + String(Date.now()).slice(-8);
    const slipDOM = `
      <div id="slip-capture-node" style="background:#faf8f5;color:#111;font-family:'Courier New',Courier,monospace;padding:20px 14px;width:275px;margin:0 auto;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,0.15);border-radius:3px;">
        <div style="text-align:center;margin-bottom:8px;">
          <div style="display:inline-block;border:2px solid #111;border-radius:50%;width:30px;height:30px;line-height:26px;font-weight:bold;font-size:16px;">S</div><br>
          <b style="font-size:14px;">Bharat Petroleum</b><br>
          <div style="font-size:15px;margin:3px 0;">Welcomes You</div>
          <div style="font-size:12px;font-weight:bold;">${esc(C.pump.nameEn)}</div>
          <div style="font-size:10px;color:#444;">${esc(C.pump.addressEn)}</div>
        </div>
        <div style="border-top:1px dashed #666;margin:6px 0;"></div>
        <div>Tel. No.: ${esc(C.pump.phone)}</div>
        <div>Inv.No: ${inv}</div>
        <div>Local ID : 00012894</div>
        <div>FIP No. : 02 &nbsp; Nozzle No.: 02</div>
        <div>Product : ${(data.fuel || 'Diesel').toUpperCase()}</div>
        <div>Density : ${data.fuel === 'petrol' ? '742.0' : '821.5'}Kg/Cu.mtr</div>
        <div>Preset Type: Volume</div>
        <div>Rate(Rs/L) : &nbsp; ${Number(data.rate).toFixed(2)}</div>
        <div>Volume(L) : &nbsp; ${Number(data.litre).toFixed(2)}</div>
        <div style="font-size:14px;font-weight:bold;margin:2px 0;">Amount(Rs) : &nbsp; ${Number(data.amount).toFixed(2)}</div>
        <div style="border-top:1px dashed #666;margin:6px 0;"></div>
        <div>Vehicle No: <b>${esc(data.vehicle || 'CASH')}</b></div>
        <div>Customer : ${esc(data.partyName || 'WALK-IN')}</div>
        <div>Date : ${dmy(data.date)} &nbsp;Time: ${data.time || APP.nowTime()}</div>
        <div style="border-top:1px dashed #666;margin:6px 0;"></div>
        <div style="text-align:center;margin-top:8px;">Thank You! Please Visit Again..</div>
      </div>`;

    const m = modal(`
      <h3>🖨️ BPCL थर्मल पर्ची</h3>
      <div style="padding:10px 0;text-align:center;">${slipDOM}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn bpcl full" id="slip-share">📤 WhatsApp पर शेयर करें (Image)</button>
        <button class="btn w full" id="slip-close">बंद करें</button>
      </div>`);

    $('#slip-close', m).onclick = () => m.close();
    $('#slip-share', m).onclick = async () => {
      toast('पर्ची इमेज तैयार हो रही है…');
      try {
        const node = $('#slip-capture-node', m);
        const cv = await html2canvas(node, { scale: 2.5, backgroundColor: '#faf8f5' });
        cv.toBlob(async blob => {
          const file = new File([blob], `slip-${data.vehicle || 'bpcl'}.png`, { type: 'image/png' });
          const text = `*माज़दा ऑयल कंपनी (BPCL)*\nगाड़ी: ${data.vehicle}\nलीटर: ${data.litre} L\nरकम: ₹${data.amount}`;
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: text });
          } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = file.name; a.click();
            toast('पर्ची डाउनलोड हो गई ✔');
          }
        }, 'image/png');
      } catch (e) { toast('इमेज नहीं बनी: ' + e.message); }
    };
  };

  /* ======================= OFFICIAL HEADER SCANNER ======================= */
  APP.scanRegister = function (st) {
    let k = localStorage.getItem('mazda_gemini_key') || '';
    if (!k) {
      k = prompt('Gemini API Key paste karein:');
      if (k && k.trim()) {
        k = k.trim();
        localStorage.setItem('mazda_gemini_key', k);
      } else {
        return toast('API Key zaroori hai');
      }
    }

    const inp = document.createElement('input'); 
    inp.type = 'file'; 
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0]; 
      if (!file) return;
      toast('AI register padh raha hai…');

      try {
        const bmp = await createImageBitmap(file);
        const sc = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); 
        c.width = Math.round(bmp.width * sc); 
        c.height = Math.round(bmp.height * sc);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1];

        const promptText = 'Extract petrol, diesel readings, and expenses from this register photo. Output valid JSON only: {"petrol":{"rate":100.23,"dip":0},"diesel":{"rate":95.68,"dip":0},"cash":{"paytm":0,"swipe":0,"kharcha":0}}';

        const payload = {
          contents: [{
            parts: [
              { text: promptText },
              { inlineData: { mimeType: 'image/jpeg', data: b64 } }
            ]
          }]
        };

        const endpoints = [
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'
        ];

        let resData = null;
        let lastErrorMsg = '';

        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': k.trim()
              },
              body: JSON.stringify(payload)
            });
            const d = await resp.json();
            if (resp.ok && !d.error && d.candidates && d.candidates[0]) {
              resData = d;
              break;
            } else if (d.error) {
              lastErrorMsg = d.error.message;
            }
          } catch (err) {
            lastErrorMsg = err.message;
          }
        }

        if (!resData) {
          throw new Error(lastErrorMsg || 'API call fail ho gayi');
        }

        const candidateText = resData.candidates[0].content.parts[0].text;
        const cleanJson = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const raw = JSON.parse(cleanJson);

        if (raw.cash) {
          if (raw.cash.paytm && $('#f-paytm')) $('#f-paytm').value = raw.cash.paytm;
          if (raw.cash.swipe && $('#f-swipe')) $('#f-swipe').value = raw.cash.swipe;
          if (raw.cash.kharcha && $('#f-kharcha')) $('#f-kharcha').value = raw.cash.kharcha;
        }
        if (raw.petrol && raw.petrol.rate && $('#f-rateP')) $('#f-rateP').value = raw.petrol.rate;
        if (raw.diesel && raw.diesel.rate && $('#f-rateD')) $('#f-rateD').value = raw.diesel.rate;

        if (APP.recalc) APP.recalc();
        toast('Register data form mein bhar gaya ✔');
      } catch (e) {
        alert('Scan Report: ' + e.message);
      }
    };
    inp.click();
  };

  APP.shareCompactDayReport = async function (st, d) {
    toast('कॉम्पैक्ट रिपोर्ट तैयार हो रही है…');
    const main = $('#main');
    if (!main) return;
    const cv = await html2canvas(main, { scale: 2 });
    cv.toBlob(blob => {
      const file = new File([blob], `report-${st.date}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], text: 'दैनिक रिपोर्ट - ' + dmy(st.date) });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      }
    });
  };
})();
