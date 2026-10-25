/* स्टॉक, गाड़ी कैश, निजी उधार, सेटिंग्स, थर्मल पर्ची (MOC BPCL लोगो सहित) व मल्टी-डेट AI स्कैनर */
(function () {
  'use strict';
  const APP = window.APP || {};
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const r2 = (n) => (K && K.r2 ? K.r2(n) : Number(n || 0).toFixed(2));
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  APP.views = APP.views || {};

  /* ======================= MOC BPCL VECTOR EMBLEM ======================= */
  const MOC_BPCL_LOGO = `
    <svg width="44" height="44" viewBox="0 0 100 100" style="display:block;margin:0 auto 6px auto;">
      <circle cx="50" cy="50" r="47" fill="#003399" stroke="#FFCC00" stroke-width="4"/>
      <circle cx="50" cy="50" r="39" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-dasharray="2,2"/>
      <path d="M50 24 C50 24 36 40 36 50 C36 58 42 64 50 64 C58 64 64 58 64 50 C64 40 50 24 50 24 Z" fill="#FFCC00"/>
      <text x="50" y="56" font-family="'Arial Black',Impact,sans-serif" font-size="14" font-weight="900" fill="#003399" text-anchor="middle">MOC</text>
      <text x="50" y="82" font-family="'Helvetica Neue',Arial,sans-serif" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">BPCL DEALER</text>
    </svg>`;

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
        <div style="text-align:center;padding:12px 0 6px 0;">
          ${MOC_BPCL_LOGO}
          <b style="font-size:16px;">माज़दा ऑयल कंपनी</b><br>
          <small class="mut">Bharat Petroleum Corporation Limited</small>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0;">
        ${kv('लॉगिन', esc(S.user ? S.user.email : 'Salesman'))}
        ${kv('भूमिका', APP.isOwner() ? 'मालिक' : 'मैनेजर')}
        <div class="btns" style="margin-top:12px">
          <button class="btn r full" id="m-logout">लॉगआउट</button>
        </div>
      </div>`;

    $('#m-logout').onclick = () => {
      localStorage.removeItem('mazda_sm');
      if (APP.auth) APP.auth.signOut();
      location.reload();
    };
  };

  /* ======================= BPCL THERMAL SLIP ======================= */
  APP.showThermalSlip = function (data) {
    const inv = '244' + String(Date.now()).slice(-8);
    const slipDOM = `
      <div id="slip-capture-node" style="background:#faf8f5;color:#111;font-family:'Courier New',Courier,monospace;padding:18px 14px;width:275px;margin:0 auto;font-size:12px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,0.15);border-radius:3px;">
        <div style="text-align:center;margin-bottom:8px;">
          ${MOC_BPCL_LOGO}
          <b style="font-size:14px;letter-spacing:0.5px;">Bharat Petroleum</b><br>
          <div style="font-size:12px;margin:2px 0;font-weight:bold;">${esc(C.pump.nameEn)}</div>
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

  /* ======================= MULTI-DATE SMART PASTE SCANNER ======================= */
  APP.scanRegister = async function (st) {
    let text = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (e) {}

    if (!text || !text.includes('{')) {
      text = prompt('Gemini se copy kiya hua code yahan paste karein:');
    }
    if (!text || !text.trim()) return;

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const raw = JSON.parse(cleanJson);

      let targetDate = raw.date || (st && st.date ? st.date : ($('#f-date') ? $('#f-date').value : APP.todayISO()));

      if (raw.date && st && st.date && raw.date !== st.date) {
        const confirmSwitch = confirm(`Yeh code ${raw.date} tareekh ka hai. Kya aap is din ka hisaab update karna chahte hain?`);
        if (!confirmSwitch) return;
        if (APP.loadDay) {
          await APP.loadDay(raw.date);
        }
      }

      let filledCount = 0;

      // 1. DIPS AUR RATES (Petrol & Diesel)
      if (raw.petrol) {
        if (raw.petrol.rate && $('#f-rateP')) { $('#f-rateP').value = raw.petrol.rate; filledCount++; }
        if (raw.petrol.dip && $('#f-dipP')) { $('#f-dipP').value = raw.petrol.dip; filledCount++; }
      }
      if (raw.diesel) {
        if (raw.diesel.rate && $('#f-rateD')) { $('#f-rateD').value = raw.diesel.rate; filledCount++; }
        if (raw.diesel.dip && $('#f-dipD')) { $('#f-dipD').value = raw.diesel.dip; filledCount++; }
      }

      // 2. NOZZLE METER READINGS (Closing / Testing)
      if (Array.isArray(raw.nozzles)) {
        raw.nozzles.forEach((noz, idx) => {
          const closeInp = $(`#f-close-${idx}`) || $(`[name="noz_close_${idx}"]`);
          const testInp = $(`#f-test-${idx}`) || $(`[name="noz_test_${idx}"]`);
          if (closeInp && noz.closing) { closeInp.value = noz.closing; filledCount++; }
          if (testInp && noz.testing !== undefined) { testInp.value = noz.testing; filledCount++; }
        });
      }

      // 3. CASH, PAYTM, SWIPE, KHARCHA & BANK
      if (raw.cash) {
        if (raw.cash.paytm !== undefined && $('#f-paytm')) { $('#f-paytm').value = raw.cash.paytm; filledCount++; }
        if (raw.cash.swipe !== undefined && $('#f-swipe')) { $('#f-swipe').value = raw.cash.swipe; filledCount++; }
        if (raw.cash.kharcha !== undefined && $('#f-kharcha')) { $('#f-kharcha').value = raw.cash.kharcha; filledCount++; }
        if (raw.cash.bank !== undefined && $('#f-bank')) { $('#f-bank').value = raw.cash.bank; filledCount++; }
        if (raw.cash.cash2000 !== undefined && $('#f-cash')) { $('#f-cash').value = raw.cash.cash2000; filledCount++; }
      }

      // 4. UDHAR / LEDGER PARTIES
      if (Array.isArray(raw.ledger) && raw.ledger.length > 0) {
        for (const item of raw.ledger) {
          if (item.party && item.amount > 0 && db()) {
            try {
              await db().collection('entries').add({
                partyName: item.party.trim(),
                vehicle: (item.vehicle || '').toUpperCase().trim(),
                amount: num(item.amount),
                fuel: item.fuel || 'diesel',
                date: targetDate,
                time: APP.nowTime(),
                type: 'credit',
                createdAt: APP.FV.serverTimestamp()
              });
              filledCount++;
            } catch (err) {}
          }
        }
        toast(`${raw.ledger.length} पार्टी उधार (${targetDate}) में दर्ज हुए`);
      }

      if (APP.recalc) APP.recalc();
      toast(`तारीख ${targetDate} का हिसाब ऑटो-अपडेट हो गया (${filledCount} एंट्रीज) ✔`);
    } catch (e) {
      alert('Data match nahi hua! Kripya Gemini ka pura code sahi se copy karein.');
    }
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
