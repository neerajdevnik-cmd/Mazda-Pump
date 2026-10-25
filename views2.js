/* स्टॉक, निजी उधार, रिपोर्ट/बिल/QR/शेयर, सेल्समैन डैशबोर्ड, गाड़ी कैश, और AI स्कैन */
(function () {
  'use strict';
  const APP = window.APP, C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, FUEL = APP.FUEL, MODE = APP.MODE, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;

  /* ======================= SALESMAN DASHBOARD ======================= */
  APP.views.salesman = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    const sm = S.salesman;
    let parties = [];
    try { parties = await APP.getParties(false); } catch (e) { }

    main.innerHTML = `
      <div class="card" style="background:#e8f0fe;border-left:4px solid var(--b)">
        <h3 style="margin:0;color:var(--b)">⛽ सेल्समैन: ${esc(sm.name)}</h3>
        <small class="mut">तारीख: ${dmy(APP.todayISO())} | ड्यूटी चालू है</small>
      </div>

      <!-- Quick Action Buttons -->
      <div class="card">
        <h3>त्वरित एंट्री (Quick Action)</h3>
        <div class="quick-btns">
          <button class="btn full o" id="sm-add-u">+ उधार (पर्ची)</button>
          <button class="btn full g" id="sm-add-j">+ जमा (कैश)</button>
        </div>
        <div class="quick-btns">
          <button class="btn full bpcl" id="sm-quick-paytm">⚡ Paytm जमा</button>
          <button class="btn full bpcl" id="sm-quick-swipe">⚡ स्वाइप जमा</button>
        </div>
      </div>

      <!-- 4 / 8 Nozzle Shift Meter Entry -->
      <div class="card">
        <h3>
          <span>मीटर रीडिंग (शिफ्ट क्लोजिंग)</span>
          <button class="btn sm w" id="sm-toggle-nz">4 नोज़ल / 8 नोज़ल</button>
        </h3>
        <p class="mut" style="margin:0 0 8px">अपनी ड्यूटी खत्म होने पर रीडिंग भरें और पर्ची चेक करें:</p>
        <div id="sm-nz-box"></div>

        <div style="margin-top:10px">
          <div class="row">
            <div><label>कुल कैश हाथ में</label><input id="sm-cash" inputmode="decimal" placeholder="₹ कैश"></div>
            <div><label>Paytm/UPI पर्चियां</label><input id="sm-paytm" inputmode="decimal" placeholder="₹ Paytm"></div>
          </div>
          <div class="row">
            <div><label>स्वाइप पर्चियां</label><input id="sm-swipe" inputmode="decimal" placeholder="₹ Swipe"></div>
            <div><label>खर्चा (चाय/इनाम)</label><input id="sm-kharcha" inputmode="decimal" placeholder="₹ खर्चा"></div>
          </div>
        </div>

        <div id="sm-slip-status" style="margin-top:10px"></div>

        <div class="btns" style="margin-top:12px">
          <button class="btn w full" id="sm-check-slip">🔍 पर्ची / जोड़ चेक करें</button>
          <button class="btn g full" id="sm-submit-slip" disabled title="पहले पर्ची चेक पास करें">✅ शिफ्ट पर्ची जमा करें (Submit)</button>
        </div>
      </div>

      <!-- Quick Search Party / Vehicle -->
      <div class="card">
        <h3>पार्टी / गाड़ी तुरंत खोजें</h3>
        <input class="search" id="sm-q" placeholder="गाड़ी या पार्टी का नाम...">
        <div id="sm-quick-list" style="max-height:220px;overflow-y:auto"></div>
      </div>`;

    let nozzleMode = 4; // 4 or 8
    function renderSalesmanNozzles() {
      const keys = nozzleMode === 4 ? ['p1', 'p2', 'd1', 'd2'] : K.NZ;
      $('#sm-nz-box').innerHTML = keys.map(k => {
        const isP = k[0] === 'p';
        return `<div class="nz">
          <b>${k.toUpperCase()}</b>
          <input class="sm-nzi" data-k="${k}" data-f="o" inputmode="decimal" placeholder="ओपनिंग">
          <input class="sm-nzi" data-k="${k}" data-f="c" inputmode="decimal" placeholder="क्लोज़िंग">
          <span id="sm-net-${k}">–</span>
        </div>`;
      }).join('');

      $$('.sm-nzi').forEach(inp => {
        inp.oninput = () => {
          const row = inp.closest('.nz');
          const o = num($('.sm-nzi[data-f="o"]', row).value);
          const c = num($('.sm-nzi[data-f="c"]', row).value);
          const netSpan = $('span', row);
          if (c > o && o > 0) {
            netSpan.textContent = r2(c - o) + ' L';
          } else {
            netSpan.textContent = '–';
          }
          // Reset lock on submit
          $('#sm-submit-slip').disabled = true;
          $('#sm-slip-status').innerHTML = '';
        };
      });
    }

    renderSalesmanNozzles();

    $('#sm-toggle-nz').onclick = () => {
      nozzleMode = nozzleMode === 4 ? 8 : 4;
      toast(`${nozzleMode} नोज़ल मोड सेट किया गया`);
      renderSalesmanNozzles();
    };

    // Quick party search
    const renderQList = () => {
      const q = ($('#sm-q').value || '').trim().toLowerCase();
      if (!q) { $('#sm-quick-list').innerHTML = '<p class="mut">गाड़ी या पार्टी सर्च करें…</p>'; return; }
      const match = parties.filter(p => (p.name || '').toLowerCase().includes(q) || (p.vehicles || []).join(' ').toLowerCase().includes(q));
      $('#sm-quick-list').innerHTML = match.length ? match.map(p => `
        <div class="item" style="cursor:pointer" data-id="${p.id}">
          <div class="a"><b>${esc(p.name)}</b><small>${(p.vehicles || []).join(', ')}</small></div>
          <span class="chip ${num(p.bal) > 0 ? 'r' : 'g'}">${money(p.bal)}</span>
        </div>`).join('') : '<p class="mut">कोई पार्टी नहीं मिली</p>';
      $$('#sm-quick-list .item').forEach(it => it.onclick = () => APP.entryModal({ partyId: it.dataset.id, date: APP.todayISO() }));
    };
    $('#sm-q').oninput = renderQList;

    // Quick Action listeners
    $('#sm-add-u').onclick = () => APP.entryModal({ kind: 'udhar', date: APP.todayISO() });
    $('#sm-add-j').onclick = () => APP.entryModal({ kind: 'jama', date: APP.todayISO() });
    $('#sm-quick-paytm').onclick = () => APP.entryModal({ kind: 'jama', mode: 'paytm', date: APP.todayISO() });
    $('#sm-quick-swipe').onclick = () => APP.entryModal({ kind: 'jama', mode: 'swipe', date: APP.todayISO() });

    // Arithmetic Slip Checking
    $('#sm-check-slip').onclick = () => {
      const errors = [];
      let totalLitre = 0;
      $$('#sm-nz-box .nz').forEach(row => {
        const k = $('b', row).textContent;
        const o = num($('.sm-nzi[data-f="o"]', row).value);
        const c = num($('.sm-nzi[data-f="c"]', row).value);
        if (o > 0 || c > 0) {
          if (c < o) errors.push(`${k}: क्लोज़िंग (${c}) ओपनिंग (${o}) से कम नहीं हो सकती!`);
          else totalLitre += (c - o);
        }
      });

      const cash = num($('#sm-cash').value);
      const paytm = num($('#sm-paytm').value);
      const swipe = num($('#sm-swipe').value);
      const totalRecv = cash + paytm + swipe;

      if (errors.length) {
        $('#sm-slip-status').innerHTML = errors.map(e => `<div class="err">${esc(e)}</div>`).join('');
        $('#sm-submit-slip').disabled = true;
      } else {
        $('#sm-slip-status').innerHTML = `<div class="ok">✔ सभी जोड़ और घटाव सही हैं! कुल तेल: ${r2(totalLitre)} L | कुल प्राप्ति: ${money(totalRecv)}</div>`;
        $('#sm-submit-slip').disabled = false;
        toast('पर्ची की जांच सफल! अब जमा कर सकते हैं।');
      }
    };

    $('#sm-submit-slip').onclick = async () => {
      if (!confirm('क्या आप अपनी शिफ्ट की पर्ची जमा करना चाहते हैं?')) return;
      try {
        await db().collection('salesman_shifts').add({
          salesmanId: sm.id,
          salesmanName: sm.name,
          date: APP.todayISO(),
          time: APP.nowTime(),
          cash: num($('#sm-cash').value),
          paytm: num($('#sm-paytm').value),
          swipe: num($('#sm-swipe').value),
          kharcha: num($('#sm-kharcha').value),
          createdAt: APP.FV.serverTimestamp()
        });
        APP.audit('salesman_shift_submit', { salesman: sm.name });
        toast('शिफ्ट पर्ची सफलतापूर्वक जमा हो गई ✔');
        APP.views.salesman();
      } catch (e) { toast('जमा नहीं हुई: ' + e.message); }
    };
  };

  /* ======================= SALESMAN PERSONAL DIARY ======================= */
  APP.views.diary = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">डायरी लोड हो रही है…</p>';
    const sm = S.salesman || { id: 'generic', name: 'Salesman' };
    let snap;
    try {
      snap = await db().collection('salesman_diary').where('salesmanId', '==', sm.id).orderBy('date', 'desc').limit(30).get();
    } catch (e) { snap = { docs: [] }; }

    const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    main.innerHTML = `
      <div class="card">
        <h3>📝 मेरी पर्सनल डायरी (${esc(sm.name)})</h3>
        <p class="mut">अपनी शिफ्ट के खास नोट, उधारी की बातें या ग्राहक की पर्ची याद रखने के लिए यहाँ लिखें:</p>
        <textarea id="diary-text" rows="3" placeholder="उदा. गाड़ी UK01TA1100 वाले ने ₹500 कल देने को कहा..."></textarea>
        <div class="btns" style="margin-top:8px">
          <button class="btn g" id="diary-save">सेव करें</button>
        </div>
      </div>

      <div class="card">
        <h3>पुराने नोट</h3>
        <div id="diary-list">
          ${notes.length ? notes.map(n => `
            <div class="item">
              <div class="a">
                <b>${dmy(n.date)} (${esc(n.time || '')})</b>
                <p style="margin:4px 0 0">${esc(n.text)}</p>
              </div>
              <button class="btn sm r" data-del="${n.id}">🗑</button>
            </div>`).join('') : '<p class="mut">डायरी में अभी कोई नोट नहीं है।</p>'}
        </div>
      </div>`;

    $('#diary-save').onclick = async () => {
      const text = $('#diary-text').value.trim();
      if (!text) return toast('कृपया नोट लिखें');
      try {
        await db().collection('salesman_diary').add({
          salesmanId: sm.id,
          date: APP.todayISO(),
          time: APP.nowTime(),
          text,
          createdAt: APP.FV.serverTimestamp()
        });
        toast('डायरी में सेव हो गया ✔');
        APP.views.diary();
      } catch (e) { toast('एरर: ' + e.message); }
    };

    $$('#diary-list [data-del]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('यह नोट हटाना है?')) return;
        await db().collection('salesman_diary').doc(btn.dataset.del).delete();
        toast('हटा दिया गया');
        APP.views.diary();
      };
    });
  };

  /* ======================= GAADI CASH (Fleet Advance) ======================= */
  APP.views.gaadicash = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">गाड़ी कैश लोड हो रहा है…</p>';
    let snap;
    try {
      snap = await db().collection('gaadi_cash').orderBy('date', 'desc').limit(50).get();
    } catch (e) { snap = { docs: [] }; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const pending = list.filter(x => x.status !== 'paid');
    const totPending = pending.reduce((a, b) => a + num(b.amount), 0);

    main.innerHTML = `
      <div class="card">
        <div class="kv"><span>कुल बाकी गाड़ी कैश (ड्राइवर/गाड़ी को दिया कैश)</span><b class="neg">${money(totPending)}</b></div>
      </div>
      <div class="btns" style="margin-bottom:12px">
        <button class="btn o" id="gc-add">+ नया गाड़ी कैश दें</button>
      </div>

      <div class="card">
        <h3>गाड़ी कैश रिकॉर्ड</h3>
        <div id="gc-list">
          ${list.length ? list.map(item => `
            <div class="item">
              <div class="a">
                <b>${esc(item.vehicle)} · ${esc(item.partyName || 'लोकल')}</b>
                <small>${dmy(item.date)} · ड्राइवर: ${esc(item.driverName || '-')}${item.phone ? ' · ' + esc(item.phone) : ''}</small>
                <small class="mut">नोट: ${esc(item.note || 'कोई नोट नहीं')}</small>
              </div>
              <div style="text-align:right">
                <b class="neg">${money(item.amount)}</b><br>
                ${item.status === 'paid' ? '<span class="chip g">Paid ✔</span>' : `<button class="btn sm g" data-gc-pay="${item.id}">✔ Paid मार्क करें</button>`}
              </div>
            </div>`).join('') : '<p class="mut">अभी कोई गाड़ी कैश एंट्री नहीं है।</p>'}
        </div>
      </div>`;

    $('#gc-add').onclick = () => showGaadiCashModal();

    $$('[data-gc-pay]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('क्या यह गाड़ी कैश वापस प्राप्त हो गया है (Paid)?')) return;
        try {
          await db().collection('gaadi_cash').doc(btn.dataset.gcPay).update({
            status: 'paid',
            paidDate: APP.todayISO(),
            paidAt: APP.FV.serverTimestamp()
          });
          toast('Paid मार्क कर दिया गया ✔');
          APP.views.gaadicash();
        } catch (e) { toast('अपडेट नहीं हुआ: ' + e.message); }
      };
    });
  };

  function showGaadiCashModal() {
    const m = modal(`
      <h3>नया गाड़ी कैश जोड़ें</h3>
      <label>गाड़ी नंबर</label>
      <input id="gc-veh" placeholder="UK01TA..." style="text-transform:uppercase">
      <label>पार्टी का नाम</label>
      <input id="gc-pname" placeholder="ट्रांसपोर्ट या मालिक का नाम">
      <div class="row">
        <div><label>ड्राइवर का नाम</label><input id="gc-driver" placeholder="ड्राइवर"></div>
        <div><label>ड्राइवर फोन</label><input id="gc-phone" inputmode="tel" placeholder="मोबाइल"></div>
      </div>
      <div class="row">
        <div><label>कैश रकम (₹)</label><input id="gc-amt" inputmode="decimal" placeholder="₹"></div>
        <div><label>तारीख</label><input type="date" id="gc-date" value="${APP.todayISO()}"></div>
      </div>
      <label>नोट</label>
      <input id="gc-note" placeholder="टोल, खर्चा, या वापसी शर्त...">
      <div class="btns">
        <button class="btn g" id="gc-save">सेव करें</button>
        <button class="btn w" id="gc-cancel">रद्द</button>
      </div>`);

    $('#gc-cancel', m).onclick = () => m.close();
    $('#gc-save', m).onclick = async () => {
      const veh = $('#gc-veh', m).value.trim().toUpperCase();
      const amt = num($('#gc-amt', m).value);
      if (!veh || !(amt > 0)) return toast('गाड़ी नंबर व वैध रकम भरें');

      try {
        await db().collection('gaadi_cash').add({
          vehicle: veh,
          partyName: $('#gc-pname', m).value.trim(),
          driverName: $('#gc-driver', m).value.trim(),
          phone: $('#gc-phone', m).value.trim(),
          amount: amt,
          date: $('#gc-date', m).value || APP.todayISO(),
          note: $('#gc-note', m).value.trim(),
          status: 'pending',
          by: S.user ? S.user.email : 'salesman',
          createdAt: APP.FV.serverTimestamp()
        });
        toast('गाड़ी कैश सेव हो गया ✔');
        m.close();
        APP.views.gaadicash();
      } catch (e) { toast('एरर: ' + e.message); }
    };
  }

  /* ======================= COMPACT ONE-PAGE DAILY REPORT ======================= */
  APP.shareCompactDayReport = async function (st, d) {
    const o = K.compute(d, st.rows);
    const nzRow = (k, lab) => {
      const n = (d.nz && d.nz[k]) || {};
      const x = o.nz[k];
      return `<tr><td>${lab}</td><td class="n">${esc(n.o)}</td><td class="n">${esc(n.c)}</td><td class="n"><b>${x.ok ? x.net : '-'}</b></td></tr>`;
    };

    const udh = st.rows.filter(r => r.kind === 'udhar');
    const jm = st.rows.filter(r => r.kind === 'jama');

    const html = `
      <div class="hd" style="border-bottom:2px solid #0b3d91;padding-bottom:6px;margin-bottom:8px">
        <div style="font-size:20px;font-weight:bold;color:#0b3d91">${esc(C.pump.name)}</div>
        <div style="font-size:12px;color:#555">${esc(C.pump.address)} | 📞 ${esc(C.pump.phone)}</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:#222">दैनिक रिपोर्ट — ${dmy(st.date)}</div>
      </div>

      <!-- Side by Side Nozzle Tables -->
      <div class="report-nz-grid">
        <div class="report-nz-box">
          <h4>पेट्रोल नोज़ल (@₹${esc(d.rateP)})</h4>
          <table>
            <tr><th>NZ</th><th class="n">Open</th><th class="n">Close</th><th class="n">Net L</th></tr>
            ${['p1', 'p2', 'p3', 'p4'].map((k, i) => nzRow(k, 'P' + (i + 1))).join('')}
            <tr><th colspan="3">कुल पेट्रोल</th><th class="n">${o.litP} L</th></tr>
          </table>
        </div>
        <div class="report-nz-box">
          <h4>डीज़ल नोज़ल (@₹${esc(d.rateD)})</h4>
          <table>
            <tr><th>NZ</th><th class="n">Open</th><th class="n">Close</th><th class="n">Net L</th></tr>
            ${['d1', 'd2', 'd3', 'd4'].map((k, i) => nzRow(k, 'D' + (i + 1))).join('')}
            <tr><th colspan="3">कुल डीज़ल</th><th class="n">${o.litD} L</th></tr>
          </table>
        </div>
      </div>

      <!-- Financial Breakdown -->
      <div style="background:#f4f6fa;padding:8px;border-radius:6px;font-size:13px;line-height:1.6">
        <div style="display:flex;justify-content:space-between"><span>कुल बिक्री (सेल):</span><b>${money(o.sale)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>+ पिछला ओपनिंग कैश:</span><b>${money(d.openCash)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>+ पार्टी जमा (नकद/Paytm/Swipe):</span><b>${money(o.jCash + o.jPaytm + o.jSwipe)}</b></div>
        <div style="display:flex;justify-content:space-between;border-top:1px dashed #ccc;padding-top:2px"><span>कुल आवक:</span><b>${money(o.kul)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− Paytm / UPI कुल:</span><b>${money(d.paytm)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− स्वाइप कुल:</span><b>${money(d.swipe)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− आज का कुल उधार:</span><b>${money(o.udhar)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− खर्चे (जनरल + इनाम + चाय):</span><b>${money(o.totalKharcha)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− मालिक को दिया:</span><b>${money(d.malikDiya)}</b></div>
        <div style="display:flex;justify-content:space-between;border-top:2px solid #0b3d91;padding-top:4px;font-size:15px">
          <span><b>आज का क्लोजिंग कैश:</b></span><b style="color:#0a7d33">${money(o.close)}</b>
        </div>
      </div>

      <!-- Stock dip -->
      <div style="margin-top:8px;font-size:12px;color:#444">
        <b>स्टॉक स्टेटस:</b> पेट्रोल हिसाब से: ${o.stockCloseP} L (डिप: ${d.dipP || '-'}) | डीज़ल हिसाब से: ${o.stockCloseD} L (डिप: ${d.dipD || '-'})
      </div>`;

    toast('1-Page कॉम्पैक्ट इमेज तैयार हो रही है…');
    const cv = await cardToCanvas(html);
    const blob = await canvasBlob(cv);
    await shareBlob(blob, 'compact-hisab-' + st.date + '.png', C.pump.nameEn + ' — 1-Page रिपोर्ट ' + dmy(st.date));
  };

  /* ======================= THERMAL SLIP GENERATION (BPCL STYLE) ======================= */
  APP.showThermalSlip = function (data) {
    const inv = 'SLIP-' + String(Date.now()).slice(-6);
    let theme = 'white';

    function buildSlipHTML(th) {
      return `
        <div class="thermal-slip ${th}">
          <div class="slip-center">
            <b>${esc(C.pump.nameEn)}</b><br>
            <small>${esc(C.pump.dealer)}</small><br>
            <small>${esc(C.pump.addressEn)}</small><br>
            <small>RO Code: ${esc(C.pump.roCode)} | 📞 ${esc(C.pump.phone)}</small>
          </div>
          <div class="slip-line"></div>
          <div>
            <b>RECEIPT NO:</b> ${inv}<br>
            <b>DATE:</b> ${dmy(data.date)}  <b>TIME:</b> ${data.time || APP.nowTime()}<br>
            <b>VEHICLE:</b> ${esc(data.vehicle || 'CASH')}<br>
            <b>CUSTOMER:</b> ${esc(data.partyName || 'WALK-IN')}<br>
          </div>
          <div class="slip-line"></div>
          <div>
            <b>PRODUCT:</b> ${(data.fuel || 'petrol').toUpperCase()}<br>
            <b>RATE:</b> ₹${data.rate || '0.00'}/L<br>
            <b>VOLUME:</b> ${data.litre || '0.00'} LTR<br>
            <div style="font-size:16px;font-weight:bold;margin:4px 0">
              AMOUNT: ₹${data.amount || '0.00'}
            </div>
            <small>MODE: ${data.slip ? ('SLIP #' + esc(data.slip)) : 'CREDIT'}</small>
          </div>
          <div class="slip-line"></div>
          <div class="slip-center">
            <small>THANK YOU! VISIT AGAIN</small><br>
            <small style="font-size:10px">SAVE FUEL, SAVE MONEY</small>
          </div>
        </div>`;
    }

    const m = modal(`
      <h3>BPCL थर्मल पर्ची (Thermal Receipt)</h3>
      <div class="seg" style="margin-bottom:8px">
        <button id="th-white" class="on">सफेद (Standard)</button>
        <button id="th-vint">विंटेज (Vintage Paper)</button>
        <button id="th-blue">ब्लू (Tinted)</button>
      </div>
      <div id="slip-preview-container">${buildSlipHTML('white')}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn bpcl" id="slip-share">📤 पर्ची शेयर करें (WhatsApp)</button>
        <button class="btn w" id="slip-close">बंद करें</button>
      </div>`);

    $('#th-white', m).onclick = () => { theme = 'white'; updateTheme(); };
    $('#th-vint', m).onclick = () => { theme = 'vintage'; updateTheme(); };
    $('#th-blue', m).onclick = () => { theme = 'blue'; updateTheme(); };

    function updateTheme() {
      $$('.seg button', m).forEach(b => b.classList.remove('on'));
      if (theme === 'white') $('#th-white', m).classList.add('on');
      if (theme === 'vintage') $('#th-vint', m).classList.add('on');
      if (theme === 'blue') $('#th-blue', m).classList.add('on');
      $('#slip-preview-container', m).innerHTML = buildSlipHTML(theme);
    }

    $('#slip-close', m).onclick = () => m.close();
    $('#slip-share', m).onclick = async () => {
      toast('थर्मल पर्ची इमेज तैयार हो रही है…');
      const cv = await cardToCanvas(buildSlipHTML(theme));
      const blob = await canvasBlob(cv);
      await shareBlob(blob, 'slip-' + inv + '.png', `${C.pump.nameEn} - Fuel Receipt ${inv}`);
    };
  };

  /* ======================= AI PHOTO SCAN (NETLIFY FUNCTION) ======================= */
  APP.scanRegister = function (st) {
    runAiScan('register', st);
  };

  APP.scanLedgerPhoto = function () {
    runAiScan('party_ledger', null);
  };

  async function runAiScan(type, st) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      toast('AI फोटो स्कैन हो रहा है… (कृपया 10-20 सेकंड रुकें)');
      try {
        const b64 = await compress(f, 1800);
        const tok = APP.auth && APP.auth.currentUser ? await APP.auth.currentUser.getIdToken() : '';
        const endpoint = C.scanEndpoint || '/.netlify/functions/scan';

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(tok ? { Authorization: 'Bearer ' + tok } : {})
          },
          body: JSON.stringify({ image: b64, mediaType: 'image/jpeg', scanType: type, date: st ? st.date : APP.todayISO() })
        });

        const j = await res.json();
        if (!res.ok) throw new Error(j.error || res.status);

        if (type === 'party_ledger') {
          showLedgerScanResults(j.data);
        } else {
          showScan(st, j.data);
        }
      } catch (e) {
        toast('स्कैन नहीं हुआ: ' + e.message);
      }
    };
    inp.click();
  }

  function showLedgerScanResults(data) {
    const rows = data.udharLines || [];
    const m = modal(`
      <h3>AI लेजर स्कैन परिणाम</h3>
      <p class="mut">रजिस्टर से पहचानी गई प्रविष्टियां:</p>
      ${rows.length ? `<table>
        <tr><th>तारीख</th><th>पार्टी / गाड़ी</th><th>रुपये</th></tr>
        ${rows.map(r => `<tr><td>${dmy(r.date || APP.todayISO())}</td><td>${esc(r.party || '')} ${esc(r.vehicle || '')}</td><td class="n">${money(r.amount)}</td></tr>`).join('')}
      </table>` : '<div class="warn">फोटो से कोई साफ लेजर एंट्री नहीं मिल सकी। हाथ से एंट्री करें।</div>'}
      <div class="btns" style="margin-top:12px"><button class="btn w full" onclick="this.closest('.modal').remove()">बंद करें</button></div>`);
  }

  /* ======================= BILL + MERCHANT PAYTM QR ======================= */
  APP.makeBill = async function (view, from, to) {
    const p = view.p, priv = view.priv; let lines, prev = 0, paid = 0, due;
    if (priv) {
      lines = view.all.filter(e => e.status === 'pending').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      due = r2(lines.reduce((a, e) => a + num(e.amount), 0));
    } else {
      const st = K.stmt(view.all, from, to);
      lines = st.rows.filter(r => r.kind === 'udhar');
      prev = st.open; paid = st.totJ; due = st.close;
    }
    if (!lines.length && due <= 0) return toast('इस अवधि में बिल बनाने लायक कुछ नहीं');

    const inv = 'MOC-' + APP.todayISO().replace(/-/g, '') + '-' + String(Date.now()).slice(-3);
    const upi = C.pump.upi;
    const mch = C.pump.merchant || {};

    // Standard clickable UPI / Paytm payment link with Merchant parameters (mc=5541, mode=02, orgid)
    let upiUrl = '';
    if (upi && due > 0) {
      const params = new URLSearchParams({
        pa: upi,
        pn: C.pump.upiName || C.pump.nameEn,
        am: due.toFixed(2),
        cu: 'INR',
        tn: 'Bill ' + inv,
        mc: mch.mc || '5541',
        mode: mch.mode || '02',
        orgid: mch.orgid || '159011'
      });
      if (mch.mid) params.append('mid', mch.mid);
      if (mch.sign) params.append('sign', mch.sign);
      upiUrl = 'upi://pay?' + params.toString();
    }

    const byVeh = {};
    lines.forEach(l => {
      const k = l.vehicle || '-';
      byVeh[k] = byVeh[k] || { l: 0, a: 0 };
      byVeh[k].l += num(l.litre);
      byVeh[k].a += num(l.amount);
    });

    const html = head('बिल / INVOICE') + `
      <div class="row" style="display:flex;justify-content:space-between">
        <div><b>${esc(p.name)}</b><br>${p.phone ? '📞 ' + esc(p.phone) : ''}</div>
        <div style="text-align:right">बिल नं: ${inv}<br>तारीख: ${dmy(APP.todayISO())}</div>
      </div>
      <div class="mut" style="margin:4px 0">${priv ? 'बाकी उधार का बिल' : (from ? dmy(from) : 'शुरू') + ' से ' + (to ? dmy(to) : 'आज')}</div>
      <table>
        <tr><th>तारीख</th><th>गाड़ी नं.</th><th>तेल</th><th class="n">लीटर</th><th class="n">रेट</th><th class="n">रुपये</th></tr>
        ${lines.map(l => `<tr><td>${dmy(l.date)} ${esc(l.time)}</td><td>${esc(l.vehicle)}</td><td>${FUEL[l.fuel] || ''}</td><td class="n">${l.litre || ''}</td><td class="n">${l.rate || ''}</td><td class="n">${money(l.amount)}</td></tr>`).join('')}
      </table>
      ${Object.keys(byVeh).length > 1 ? '<h3>गाड़ी के हिसाब से</h3><table>' + Object.keys(byVeh).map(v => `<tr><td>${esc(v)}</td><td class="n">${r2(byVeh[v].l)} L</td><td class="n">${money(byVeh[v].a)}</td></tr>`).join('') + '</table>' : ''}
      <div style="margin-top:8px">
        ${prev ? kv('पिछला बैलेंस', money(prev)) : ''}
        ${kv('इस अवधि का उधार', money(lines.reduce((a, l) => a + num(l.amount), 0)))}
        ${paid ? kv('जमा हुआ', '− ' + money(paid)) : ''}
      </div>
      <div class="due">${due > 0 ? 'कुल देय: ' + money(due) : due < 0 ? 'आपका एडवांस: ' + money(-due) : 'कोई बकाया नहीं'}</div>
      ${upiUrl ? `
        <div class="qr">
          <div id="qrbox" style="display:inline-block"></div>
          <div style="font-size:15px;margin-top:6px">
            <b>Paytm / UPI QR स्कैन करके भुगतान करें</b><br>
            <span style="font-size:13px;color:#555">UPI ID: ${esc(upi)}</span>
          </div>
        </div>` : ''}
      <div style="text-align:center;color:#666;font-size:13px;margin-top:8px">धन्यवाद — ${esc(C.pump.nameEn)}</div>`;

    toast('बिल बन रहा है…');
    const cv = await cardToCanvas(html, async el => {
      if (upiUrl) {
        new QRCode($('#qrbox', el), { text: upiUrl, width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M });
        await new Promise(r => setTimeout(r, 300));
      }
    });

    const blob = await canvasBlob(cv);
    const phone = String(p.phone || '').replace(/\D/g, '');
    const wa = phone ? (phone.length === 10 ? '91' + phone : phone) : '';
    const text = `*${C.pump.nameEn}*\nबिल नं: ${inv}\nपार्टी: ${p.name}\n${due > 0 ? 'कुल देय राशि: ' + money(due) + '\n\n💳 सीधे भुगतान के लिए यहाँ क्लिक करें:\n' + upiUrl : 'कोई बकाया नहीं है।'}`;

    const m = modal(`
      <h3>बिल तैयार</h3>
      <img src="${cv.toDataURL('image/png')}" style="width:100%;border:1px solid #ddd;border-radius:8px">
      ${upiUrl ? `<div class="ok" style="margin-top:8px"><a href="${upiUrl}" style="color:var(--b);font-weight:bold;text-decoration:none">👉 मोबाइल से सीधे भुगतान के लिए लिंक खोलें (Click to Pay)</a></div>` : ''}
      <div class="btns">
        <button class="btn g" id="b1">📤 इमेज भेजें</button>
        <button class="btn w" id="b3">📄 PDF</button>
        <button class="btn w" id="b2">💬 WhatsApp संदेश</button>
        <button class="btn w" id="b4">बंद करें</button>
      </div>`);

    $('#b1', m).onclick = () => shareBlob(blob, 'bill-' + inv + '.png', text);
    $('#b3', m).onclick = () => shareBlob(pdfFromCanvas(cv), 'bill-' + inv + '.pdf', text);
    $('#b2', m).onclick = () => window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(text), '_blank');
    $('#b4', m).onclick = () => m.close();
    APP.audit('bill_made', { party: p.name, due, priv });
  };

  /* ======================= STOCK VIEW ======================= */
  APP.views.stock = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>'; S.view = null;
    let snap; try { snap = await db().collection('days').orderBy('date', 'desc').limit(20).get(); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const days = snap.docs.map(d => d.data());
    if (!days.length) { main.innerHTML = '<div class="card">अभी कोई हिसाब सेव नहीं हुआ है।</div>'; return; }
    const tbl = (f, nm) => `<div class="card"><h3>${nm} स्टॉक (लीटर)</h3><div style="overflow-x:auto"><table>
      <tr><th>तारीख</th><th class="n">ओपनिंग</th><th class="n">टैंकर</th><th class="n">बिक्री</th><th class="n">हिसाब से</th><th class="n">डिप</th><th class="n">फर्क</th></tr>
      ${days.map(d => { const o = K.compute(d, []); const cl = f === 'P' ? o.stockCloseP : o.stockCloseD, dip = d['dip' + f], df = f === 'P' ? o.diffP : o.diffD;
        return `<tr><td>${dmy(d.date)}</td><td class="n">${r2(num(d['openStock' + f]))}</td><td class="n">${r2(num(d['tanker' + f]))}</td><td class="n">${f === 'P' ? o.litP : o.litD}</td><td class="n">${cl}</td>
        <td class="n">${K.has(dip) ? r2(num(dip)) : '–'}</td><td class="n ${df != null && Math.abs(df) > 0.5 ? 'neg' : ''}">${df == null ? '–' : (df > 0 ? '+' : '') + df}</td></tr>`; }).join('')}
      </table></div></div>`;
    main.innerHTML = tbl('P', 'पेट्रोल') + tbl('D', 'डीज़ल') +
      '<div class="card mut">टैंकर की एंट्री का कॉलम "हिसाब" पेज में है। मोबिल ऑयल और DEF का स्टॉक भी अगले अपडेट में जोड़ा जा सकता है।</div>';
  };

  /* ======================= NIJI UDHAR (Owner Only) ======================= */
  APP.views.priv = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>'; S.view = null;
    let parties, last;
    try {
      parties = await APP.getParties(true, true);
      const s = await db().collection('days').orderBy('date', 'desc').limit(1).get(); last = s.empty ? null : s.docs[0].data();
    } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const pend = r2(parties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0));
    const show = last && last.sum ? num(last.sum.close) : null;
    main.innerHTML = `<div class="warn">🔒 यह पेज सिर्फ मालिक को दिखता है। मैनेजर/CA के हिसाब में यह उधार नकद की तरह दिखता है।</div>
      <div class="card"><h3>असली कैश का अंदाज़ा</h3>
        ${show != null ? kv('हिसाब में दिखने वाला कैश (' + dmy(last.date) + ')', money(show)) : ''}
        ${kv('बाहर निजी उधार बाकी', money(pend), 'neg')}
        ${show != null ? kv('हाथ में असली कैश', money(show - pend), 'big') : ''}</div>
      <div class="card" id="pl"></div>
      <div class="btns"><button class="btn o" id="pu">+ निजी उधार</button><button class="btn w" id="pn">+ नई पार्टी</button></div>`;
    $('#pl').innerHTML = parties.length ? parties.map(p => `<div class="item" data-id="${p.id}" style="cursor:pointer"><div class="a"><b>${esc(p.name)}</b><small>${esc(p.phone || '')} · ${(p.vehicles || []).length} गाड़ी</small></div>
      <span class="chip ${num(p.bal) > 0 ? 'r' : 'g'}">${num(p.bal) > 0 ? 'बाकी ' + money(p.bal) : 'ठीक'}</span></div>`).join('') : '<p class="mut">अभी कोई निजी पार्टी नहीं</p>';
    $$('#pl .item').forEach(i => i.onclick = () => APP.partyView(i.dataset.id, true));
    $('#pu').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
    $('#pn').onclick = () => APP.partyModal(null, true);
  };

  /* ======================= MORE / SETTINGS ======================= */
  APP.views.more = async function () {
    const main = $('#main'); S.view = null; const own = APP.isOwner();
    main.innerHTML = `
      <div class="card">
        <h3>खाता एवं भूमिका</h3>
        ${kv('लॉगिन', esc(S.user.email))}
        ${kv('भूमिका', own ? 'मालिक' : S.salesman ? 'सेल्समैन' : 'मैनेजर')}
        <div class="btns"><button class="btn r" id="lo">बाहर निकलें (Logout)</button></div>
      </div>
      ${own ? `
      <div class="card">
        <h3>डेटा व बैकअप</h3>
        <div class="btns">
          <button class="btn bpcl" id="bPresetParties">📦 डिफ़ॉल्ट पार्टियां लोड करें</button>
          <button class="btn w" data-x="ledger">पार्टी लेजर (CSV)</button>
          <button class="btn w" data-x="days">रोज़ का हिसाब (CSV)</button>
          <button class="btn w" data-x="gaadi_cash">गाड़ी कैश (CSV)</button>
        </div>
      </div>
      <div class="card">
        <h3>सुधार (Recalculate)</h3>
        <p class="mut">अगर किसी पार्टी का बैलेंस गलत दिखे तो सारी एंट्री दोबारा जोड़ें।</p>
        <div class="btns"><button class="btn w" id="rc">सब बैलेंस दोबारा जोड़ें</button></div>
      </div>
      <div class="card">
        <h3>ऑडिट लॉग (Audit Log)</h3>
        <div id="au">लोड हो रहा है…</div>
      </div>` : ''}`;

    $('#lo').onclick = () => {
      localStorage.removeItem('mazda_sm');
      if (APP.auth) APP.auth.signOut();
      location.reload();
    };

    if (!own) return;
    if ($('#bPresetParties')) $('#bPresetParties').onclick = APP.loadPresetParties;
    $$('[data-x]').forEach(b => b.onclick = () => exportCSV(b.dataset.x));
    $('#rc').onclick = recalcBalances;

    try {
      const s = await db().collection('audit').orderBy('at', 'desc').limit(30).get();
      $('#au').innerHTML = s.docs.map(d => {
        const a = d.data(); const t = a.at && a.at.toDate ? a.at.toDate() : null;
        return `<div class="item"><div class="a"><b>${esc(a.action)}</b><small>${esc(a.by)} · ${t ? t.toLocaleString('en-IN') : ''}</small><small>${esc((a.detail || '').slice(0, 140))}</small></div></div>`;
      }).join('') || '<p class="mut">अभी कोई लॉग नहीं</p>';
    } catch (e) { $('#au').innerHTML = APP.errBox(e); }
  };

  async function exportCSV(col) {
    const s = await db().collection(col).get();
    const rows = s.docs.map(d => {
      const o = Object.assign({ id: d.id }, d.data());
      delete o.at; delete o.createdAt;
      if (o.nz) o.nz = JSON.stringify(o.nz);
      if (o.sum) o.sum = JSON.stringify(o.sum);
      return o;
    });
    if (!rows.length) return toast('कोई डेटा नहीं');
    const keys = Array.from(rows.reduce((a, r) => { Object.keys(r).forEach(k => a.add(k)); return a; }, new Set()));
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = '\ufeff' + [keys.map(q).join(',')].concat(rows.map(r => keys.map(k => q(r[k])).join(','))).join('\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), col + '-' + APP.todayISO() + '.csv');
  }

  async function recalcBalances() {
    if (!confirm('सब पार्टियों का बैलेंस एंट्री से दोबारा जोड़ें?')) return;
    for (const priv of [false, true]) {
      const ps = await APP.getParties(priv, true);
      const es = await db().collection(priv ? 'priv_ledger' : 'ledger').get();
      const all = es.docs.map(d => d.data());
      for (const p of ps) {
        const mine = all.filter(e => e.partyId === p.id);
        const bal = priv ? mine.filter(e => e.status === 'pending').reduce((a, e) => a + num(e.amount), 0) : K.stmt(mine, null, null).close;
        await db().collection(priv ? 'priv_parties' : 'parties').doc(p.id).update({ bal: r2(bal) });
      }
    }
    APP.audit('recalc_balances', {}); toast('हो गया');
  }

  /* ---------- Helpers for Canvas & Download ---------- */
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  async function shareBlob(blob, name, text) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: text || '', title: name }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    download(blob, name); toast('फाइल डाउनलोड हो गई — WhatsApp में भेजें');
  }
  async function cardToCanvas(html, after) {
    const el = document.createElement('div'); el.className = 'off'; el.innerHTML = html; document.body.appendChild(el);
    try { if (after) await after(el); return await html2canvas(el, { scale: 2, backgroundColor: '#fff', useCORS: true }); }
    finally { el.remove(); }
  }
  const canvasBlob = cv => new Promise(r => cv.toBlob(r, 'image/png'));
  function pdfFromCanvas(cv) {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4'); const W = 210, H = 297, per = Math.floor(cv.width * H / W); let y = 0, first = true;
    while (y < cv.height) {
      const h = Math.min(per, cv.height - y); const c = document.createElement('canvas'); c.width = cv.width; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, h); x.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
      if (!first) pdf.addPage(); pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, h * W / cv.width); y += h; first = false;
    }
    return pdf.output('blob');
  }
  const head = sub => `<div class="hd"><h1>${esc(C.pump.name)}</h1><div>${esc(C.pump.nameEn)}</div><div>${esc(C.pump.address)}</div>${C.pump.phone ? '<div>📞 ' + esc(C.pump.phone) + '</div>' : ''}
    <div style="margin-top:6px;font-weight:700;font-size:18px">${sub}</div></div>`;

  async function compress(file, max) {
    const bmp = await createImageBitmap(file); const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  function showScan(st, s) {
    const f = APP.readForm(); const msgs = []; const set = (id, v) => { const el = $('#' + id); if (el && v != null && v !== '') el.value = v; };
    const t = K.has(f.testing) ? num(f.testing) : 5;
    const fills = {};
    if (s.petrol && s.petrol.rate) fills['f-rateP'] = s.petrol.rate; if (s.diesel && s.diesel.rate) fills['f-rateD'] = s.diesel.rate;
    const nz = {};
    [['petrol', 'p'], ['diesel', 'd']].forEach(([fuel, c]) => {
      const x = s[fuel]; if (!x) return; let sumNet = 0;
      (x.nozzles || []).forEach((n, i) => {
        const k = c + (i + 1); nz[k] = { o: n.open, c: n.close };
        const gross = r2(num(n.close) - num(n.open)); const net = r2(gross - t); sumNet += net;
        if (K.has(n.writtenDiff) && r2(num(n.writtenDiff)) !== gross) msgs.push(['err', `${k.toUpperCase()}: रजिस्टर में अंतर ${n.writtenDiff} लिखा है, पर ${n.close} − ${n.open} = ${gross}`]);
        if (K.has(n.writtenNet) && r2(num(n.writtenNet)) !== net) msgs.push(['err', `${k.toUpperCase()}: रजिस्टर में नेट ${n.writtenNet} लिखा है, पर ${gross} − ${t} = ${net}`]);
      });
      if (K.has(x.writtenTotalLitres) && r2(num(x.writtenTotalLitres)) !== r2(sumNet)) msgs.push(['err', `${FUEL[fuel]}: रजिस्टर का कुल ${x.writtenTotalLitres} L है, पर नोज़लों का जोड़ ${r2(sumNet)} L`]);
      if (K.has(x.dip)) fills['f-dip' + c.toUpperCase()] = x.dip;
    });
    const c = s.cash || {};
    ['paytm', 'swipe', 'kharcha', 'driverInaam', 'chaiKhana'].forEach(k => { if (K.has(c[k])) fills['f-' + k] = c[k]; });
    if (K.has(c.openCash) && K.has(f.openCash) && r2(num(c.openCash)) !== r2(num(f.openCash))) msgs.push(['warn', `पिछला कैश: रजिस्टर में ${money(c.openCash)}, ऐप में ${money(f.openCash)} (कल का हिसाब)`]);
    
    const f2 = Object.assign({}, f, { nz: Object.assign({}, f.nz) });
    Object.keys(nz).forEach(k => { f2.nz[k] = { o: nz[k].o, c: nz[k].c }; });
    if (fills['f-rateP']) f2.rateP = fills['f-rateP']; if (fills['f-rateD']) f2.rateD = fills['f-rateD'];
    ['paytm', 'swipe', 'kharcha', 'driverInaam', 'chaiKhana'].forEach(k => { if (fills['f-' + k] != null) f2[k] = fills['f-' + k]; });
    const o = K.compute(f2, st.rows);
    if (K.has(c.closeCashWritten)) {
      const dif = r2(num(c.closeCashWritten) - o.close);
      msgs.push(Math.abs(dif) > 0.5 ? ['err', `बचा कैश: रजिस्टर में ${money(c.closeCashWritten)}, ऐप के हिसाब से ${money(o.close)} — फर्क ${money(dif)}`] : ['ok', 'बचा कैश रजिस्टर से मिल गया ✔']);
    }
    const ul = s.udharLines || [], used = new Set();
    ul.forEach(l => { const hit = st.rows.find(r => r.kind === 'udhar' && !used.has(r.id) && Math.abs(num(r.amount) - num(l.amount)) < 1); if (hit) used.add(hit.id); else msgs.push(['warn', `उधार रजिस्टर में है पर ऐप में नहीं: ${esc(l.party || '')} ${esc(l.vehicle || '')} ${money(l.amount)}`]); });
    st.rows.filter(r => r.kind === 'udhar' && !used.has(r.id)).forEach(r => msgs.push(['warn', `ऐप में उधार है पर रजिस्टर में नहीं मिला: ${esc(r.partyName)} ${money(r.amount)}`]));
    (s.unclear || []).forEach(u => msgs.push(['warn', 'पढ़ने में साफ नहीं: ' + esc(u)]));
    o.warn.forEach(w => msgs.push(['warn', w]));
    if (!msgs.length) msgs.push(['ok', 'कोई गड़बड़ नहीं मिली ✔']);
    const m = modal(`<h3>रजिस्टर की जांच</h3><div class="mut">नीचे "भरें" दबाने पर नंबर फॉर्म में आ जाएंगे। सेव करने से पहले खुद एक बार देख लें।</div>
      ${msgs.map(x => `<div class="${x[0]}">${x[1]}</div>`).join('')}
      <div class="btns"><button class="btn g" id="sf">फॉर्म में भरें</button><button class="btn w" id="sc">बंद करें</button></div>`);
    $('#sc', m).onclick = () => m.close();
    $('#sf', m).onclick = () => {
      Object.keys(fills).forEach(id => set(id, fills[id]));
      $$('.nzi').forEach(i => { const v = nz[i.dataset.k]; if (v) { const x = i.dataset.f === 'o' ? v.o : v.c; if (x != null) i.value = x; } });
      APP.recalc(); APP.collectDraft(); m.close(); toast('भर दिया — अब जांचकर सेव करें');
    };
  }

  // Statements
  function stmtHTML(view, from, to) {
    const p = view.p, priv = view.priv;
    const st = K.stmt(view.all.map(e => priv ? Object.assign({}, e, { kind: 'udhar' }) : e), from, to);
    const per = (from ? dmy(from) : 'शुरू से') + ' से ' + (to ? dmy(to) : 'आज तक');
    let body;
    if (priv) {
      const tot = r2(st.rows.filter(r => r.status !== 'paid').reduce((a, r) => a + num(r.amount), 0));
      body = `<table><tr><th>तारीख</th><th>गाड़ी</th><th>तेल</th><th class="n">लीटर</th><th class="n">रेट</th><th class="n">रुपये</th><th>स्थिति</th></tr>
        ${st.rows.map(r => `<tr><td>${dmy(r.date)}<br><small>${esc(r.time)}</small></td><td>${esc(r.vehicle)}</td><td>${FUEL[r.fuel]}</td><td class="n">${r.litre}</td><td class="n">${r.rate}</td><td class="n">${money(r.amount)}</td><td>${r.status === 'paid' ? 'मिला ' + dmy(r.paidDate) : 'बाकी'}</td></tr>`).join('')}</table>
        <div class="due">कुल बाकी: ${money(tot)}</div>`;
    } else {
      body = `<table><tr><th>तारीख</th><th>विवरण</th><th class="n">उधार</th><th class="n">जमा</th><th class="n">बैलेंस</th></tr>
        <tr><td colspan="4"><i>पिछला बैलेंस</i></td><td class="n">${money(st.open)}</td></tr>
        ${st.rows.map(r => `<tr><td>${dmy(r.date)}</td><td>${r.kind === 'udhar' ? esc(r.vehicle) + ' · ' + (FUEL[r.fuel] || '') + ' ' + (r.litre ? r.litre + ' L @' + r.rate : '') : 'जमा — ' + MODE[r.mode]}${r.note ? '<br><small>' + esc(r.note) + '</small>' : ''}</td>
        <td class="n">${r.kind === 'udhar' ? money(r.amount) : ''}</td><td class="n">${r.kind === 'jama' ? money(r.amount) : ''}</td><td class="n">${money(r.run)}</td></tr>`).join('')}
        <tr><th colspan="2">कुल</th><th class="n">${money(st.totU)}</th><th class="n">${money(st.totJ)}</th><th class="n">${money(st.close)}</th></tr></table>
        <div class="due">${st.close > 0 ? 'कुल बकाया: ' + money(st.close) : st.close < 0 ? 'एडवांस जमा: ' + money(-st.close) : 'कोई बकाया नहीं'}</div>`;
    }
    return head('खाता विवरण (Statement)') + `<div><b>${esc(p.name)}</b>${p.phone ? ' · ' + esc(p.phone) : ''}</div><div class="mut">${per}</div><div style="margin-top:8px">${body}</div>`;
  }

  APP.shareStatement = async function (view, from, to, kind) {
    toast('बन रहा है…');
    const cv = await cardToCanvas(stmtHTML(view, from, to));
    const nm = 'khata-' + view.p.name.replace(/\s+/g, '_');
    if (kind === 'pdf') await shareBlob(pdfFromCanvas(cv), nm + '.pdf', C.pump.nameEn + ' — खाता विवरण ' + view.p.name);
    else await shareBlob(await canvasBlob(cv), nm + '.png', C.pump.nameEn + ' — खाता विवरण ' + view.p.name);
  };
})();
