/* स्टॉक, निजी उधार, रिपोर्ट/बिल/QR/शेयर, सेल्समैन डैशबोर्ड, गाड़ी कैश, थर्मल पर्ची व AI स्कैन */
(function () {
  'use strict';
  const APP = window.APP, C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = K ? K.r2 : (n => Number(n).toFixed(2));
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

    let nozzleMode = 4;
    function renderSalesmanNozzles() {
      const keys = nozzleMode === 4 ? ['p1', 'p2', 'd1', 'd2'] : (K ? K.NZ : ['p1','p2','p3','p4','d1','d2','d3','d4']);
      $('#sm-nz-box').innerHTML = keys.map(k => {
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

    const renderQList = () => {
      const q = ($('#sm-q').value || '').trim().toLowerCase();
      if (!q) { $('#sm-quick-list').innerHTML = '<p class="mut">गाड़ी या पार्टी सर्च करें…</p>'; return; }
      const match = parties.filter(p => (p.name || '').toLowerCase().includes(q) || (p.vehicles || []).join(' ').toLowerCase().includes(q));
      $('#sm-quick-list').innerHTML = match.length ? match.map(p => `
        <div class="item" style="cursor:pointer" data-id="${p.id}">
          <div class="a"><b>${esc(p.name)}</b><small>${(p.vehicles || []).join(', ')}</small></div>
          <span class="chip ${num(p.bal) > 0 ? 'r' : 'g'}">${money(p.bal)}</span>
        </div>`).join('') : '<p class="mut">कोई पार्टी नहीं मिली</p>';
      $$('#sm-quick-list .item').forEach(it => it.onclick = () => APP.entryModal({ partyId: it.dataset.id, date: APP.todayISO() }));
    };
    $('#sm-q').oninput = renderQList;

    $('#sm-add-u').onclick = () => APP.entryModal({ kind: 'udhar', date: APP.todayISO() });
    $('#sm-add-j').onclick = () => APP.entryModal({ kind: 'jama', date: APP.todayISO() });
    $('#sm-quick-paytm').onclick = () => APP.entryModal({ kind: 'jama', mode: 'paytm', date: APP.todayISO() });
    $('#sm-quick-swipe').onclick = () => APP.entryModal({ kind: 'jama', mode: 'swipe', date: APP.todayISO() });

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

  /* ======================= GAADI CASH ======================= */
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
        <div class="kv"><span>कुल बाकी गाड़ी कैश (ड्राइवर/गाड़ी को दिया कैश)</span><b class="neg">${money(totPending)}</b></div>
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

  /* ======================= COMPACT REPORT ======================= */
  APP.shareCompactDayReport = async function (st, d) {
    const o = K.compute(d, st.rows);
    const nzRow = (k, lab) => {
      const n = (d.nz && d.nz[k]) || {};
      const x = o.nz[k];
      return `<tr><td>${lab}</td><td class="n">${esc(n.o)}</td><td class="n">${esc(n.c)}</td><td class="n"><b>${x.ok ? x.net : '-'}</b></td></tr>`;
    };

    const html = `
      <div class="hd" style="border-bottom:2px solid #0b3d91;padding-bottom:6px;margin-bottom:8px">
        <div style="font-size:20px;font-weight:bold;color:#0b3d91">${esc(C.pump.name)}</div>
        <div style="font-size:12px;color:#555">${esc(C.pump.address)} | 📞 ${esc(C.pump.phone)}</div>
        <div style="margin-top:4px;font-size:15px;font-weight:700;color:#222">दैनिक रिपोर्ट — ${dmy(st.date)}</div>
      </div>
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
      <div style="background:#f4f6fa;padding:8px;border-radius:6px;font-size:13px;line-height:1.6">
        <div style="display:flex;justify-content:space-between"><span>कुल बिक्री:</span><b>${money(o.sale)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>+ पिछला ओपनिंग कैश:</span><b>${money(d.openCash)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>+ पार्टी जमा:</span><b>${money(o.jCash + o.jPaytm + o.jSwipe)}</b></div>
        <div style="display:flex;justify-content:space-between;border-top:1px dashed #ccc;padding-top:2px"><span>कुल आवक:</span><b>${money(o.kul)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− Paytm / UPI कुल:</span><b>${money(d.paytm)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− स्वाइप कुल:</span><b>${money(d.swipe)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− आज का उधार:</span><b>${money(o.udhar)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− कुल खर्चे:</span><b>${money(o.totalKharcha)}</b></div>
        <div style="display:flex;justify-content:space-between"><span>− मालिक को दिया:</span><b>${money(d.malikDiya)}</b></div>
        <div style="display:flex;justify-content:space-between;border-top:2px solid #0b3d91;padding-top:4px;font-size:15px">
          <span><b>क्लोजिंग कैश:</b></span><b style="color:#0a7d33">${money(o.close)}</b>
        </div>
      </div>`;

    toast('रिपोर्ट तैयार हो रही है…');
    const cv = await cardToCanvas(html);
    const blob = await canvasBlob(cv);
    await shareBlob(blob, 'compact-hisab-' + st.date + '.png', C.pump.nameEn + ' — दैनिक रिपोर्ट');
  };

  /* ======================= REALISTIC BPCL THERMAL SLIP ======================= */
  APP.showThermalSlip = function (data) {
    const inv = '244' + String(Date.now()).slice(-10);
    const localId = '000' + String(Math.floor(10000 + Math.random() * 90000));
    const density = data.fuel === 'diesel' ? '821.5' : '742.0';
    let currentBg = 'hand';

    const bgStyles = {
      hand: 'background: radial-gradient(circle at 50% 50%, #4a3830 0%, #1a120d 100%);',
      wood: 'background: linear-gradient(135deg, #3d2817 0%, #1c1108 100%);',
      counter: 'background: linear-gradient(135deg, #475569 0%, #1e293b 100%);',
      plain: 'background: #ffffff;'
    };

    function buildSlipDOM(bg) {
      const isPlain = bg === 'plain';
      return `
        <div id="thermal-canvas-wrap" style="${bgStyles[bg]} padding: ${isPlain ? '0' : '30px 15px'}; display: flex; justify-content: center; align-items: center; border-radius: 8px;">
          <div style="background: #faf8f5; color: #111; font-family: 'Courier New', Courier, monospace; width: 285px; padding: 20px 16px; border-radius: 2px; box-shadow: ${isPlain ? 'none' : '0 12px 30px rgba(0,0,0,0.6)'}; font-size: 13px; line-height: 1.35; letter-spacing: -0.3px;">
            <div style="text-align: center; margin-bottom: 8px;">
              <div style="display:inline-block; border: 2px solid #111; border-radius: 50%; width: 34px; height: 34px; line-height: 30px; font-weight: bold; font-size: 18px; margin-bottom: 2px;">S</div><br>
              <b style="font-size: 15px; letter-spacing: 0.5px;">Bharat<br>Petroleum</b><br>
              <div style="font-size: 16px; font-weight: 500; margin: 4px 0 6px;">Welcomes You</div>
              <div style="font-size: 12px;"><b>${esc(C.pump.nameEn)}</b></div>
              <div style="font-size: 11px; color:#333;">${esc(C.pump.addressEn)}</div>
            </div>

            <div style="border-top: 1px dashed #666; margin: 6px 0;"></div>
            <div>Tel. No.: ${esc(C.pump.phone || '9876543210')}</div>
            <div>Inv.No: ${inv}</div>
            <div>Local ID &nbsp;: ${localId}</div>
            <div>FIP No. &nbsp; : 02</div>
            <div>Nozzle No.: 02</div>
            <div>Product &nbsp; : ${(data.fuel || 'Diesel').toUpperCase()}</div>
            <div>Density &nbsp; : ${density}Kg/Cu.mtr</div>
            <div>Preset Type: Volume</div>
            <div>Rate(Rs/L) : &nbsp; ${padLeft(num(data.rate).toFixed(2), 6)}</div>
            <div>Volume(L) : &nbsp; ${padLeft(num(data.litre).toFixed(2), 7)}</div>
            <div style="font-size: 14px; font-weight: bold; margin: 2px 0;">Amount(Rs) : &nbsp; ${padLeft(num(data.amount).toFixed(2), 7)}</div>
            <div>Atot: 00040227090.24</div>
            <div>Vtot: 00000450120.26</div>

            <div style="border-top: 1px dashed #666; margin: 6px 0;"></div>
            <div>Vehicle No: <b>${esc(data.vehicle || 'CASH')}</b></div>
            <div>Mobile No : ${esc(data.partyPhone || 'Not Entered')}</div>
            <div>Customer &nbsp;: ${esc(data.partyName || 'WALK-IN')}</div>
            <div style="margin-top: 4px;">Date : ${dmy(data.date)} &nbsp;Time: ${data.time || APP.nowTime()}</div>

            <div style="border-top: 1px dashed #666; margin: 6px 0;"></div>
            <div>CST No: </div>
            <div>LST No: </div>
            <div>VAT No: </div>

            <div style="text-align: center; margin: 10px 0 6px;">
              Thank You! Please Visit<br>Again..
            </div>
            <div style="text-align: center; font-size: 11px;">
              Printed on:<br>${dmy(data.date)} ${data.time || APP.nowTime()}
            </div>
          </div>
        </div>`;
    }

    function padLeft(str, len) {
      str = String(str);
      while (str.length < len) str = '0' + str;
      return str;
    }

    const m = modal(`
      <h3>🖨️ BPCL थर्मल पर्ची (Thermal Receipt)</h3>
      <div class="seg" style="margin-bottom:10px">
        <button id="bg-hand" class="on">हाथ में पर्ची (Hand)</button>
        <button id="bg-wood">लकड़ी/डेस्क (Desk)</button>
        <button id="bg-plain">सफेद (Plain)</button>
      </div>
      <div id="slip-box" style="max-height: 400px; overflow-y: auto; text-align: center;">
        ${buildSlipDOM('hand')}
      </div>
      <div class="btns" style="margin-top:14px">
        <button class="btn g full" id="slip-wa">📤 WhatsApp पर पर्ची भेजें (Image)</button>
        <button class="btn w full" id="slip-close">बंद करें</button>
      </div>`);

    const updateBg = b => {
      currentBg = b;
      $$('.seg button', m).forEach(btn => btn.classList.remove('on'));
      $('#bg-' + b, m).classList.add('on');
      $('#slip-box', m).innerHTML = buildSlipDOM(b);
    };

    $('#bg-hand', m).onclick = () => updateBg('hand');
    $('#bg-wood', m).onclick = () => updateBg('wood');
    $('#bg-plain', m).onclick = () => updateBg('plain');

    $('#slip-close', m).onclick = () => m.close();

    $('#slip-wa', m).onclick = async () => {
      toast('पर्ची की फोटो बन रही है…');
      try {
        const wrap = $('#thermal-canvas-wrap', m);
        const cv = await html2canvas(wrap, { scale: 2.5, backgroundColor: null, useCORS: true });
        const blob = await canvasBlob(cv);
        const phone = String(data.partyPhone || '').replace(/\D/g, '');
        const text = `*माज़दा ऑयल कंपनी (BPCL)*\nगाड़ी: ${data.vehicle || ''}\nडीज़ल/पेट्रोल: ${data.litre} L\nरकम: ₹${data.amount}\n\nआपकी डिजिटल पर्ची संलग्न है ✔`;
        await shareBlob(blob, `slip-${data.vehicle || 'bpcl'}.png`, text);
      } catch (e) {
        toast('इमेज नहीं बन पाई: ' + e.message);
      }
    };
  };

  /* ======================= BROWSER-DIRECT GEMINI AI SCAN ======================= */
  APP.scanRegister = function (st) {
    runDirectAiScan('register', st);
  };

  APP.scanLedgerPhoto = function () {
    runDirectAiScan('ledger', null);
  };

  async function runDirectAiScan(type, st) {
    let apiKey = localStorage.getItem('mazda_gemini_key') || (C.firebase && C.firebase.apiKey) || '';

    // If key not configured, prompt owner once
    if (!localStorage.getItem('mazda_gemini_key')) {
      const ask = prompt('Gemini API Key दर्ज करें (निःशुल्क key google aistudio से मिलती है):', apiKey);
      if (ask) {
        apiKey = ask.trim();
        localStorage.setItem('mazda_gemini_key', apiKey);
      } else if (!apiKey) {
        return toast('AI स्कैन के लिए API Key आवश्यक है');
      }
    }

    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      toast('Gemini AI फोटो पढ़ रहा है… (कृपया 5-10 सेकंड रुकें)');
      try {
        const b64 = await compress(f, 1600);
        const promptText = type === 'register' 
          ? `Extract fuel pump daily reading from this photo. Return strictly a JSON object:
             {"petrol":{"rate":100.23,"dip":0,"nozzles":[{"open":0,"close":0}]},"diesel":{"rate":95.68,"dip":0,"nozzles":[{"open":0,"close":0}]},"cash":{"paytm":0,"swipe":0,"kharcha":0,"closeCashWritten":0},"udharLines":[{"party":"","vehicle":"","amount":0}]}`
          : `Extract credit entries from ledger photo. Return JSON strictly: {"udharLines":[{"date":"","party":"","vehicle":"","amount":0}]}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inlineData: { mimeType: 'image/jpeg', data: b64 } }
              ]
            }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        const j = await res.json();
        if (j.error) throw new Error(j.error.message || 'API Error');
        const textResp = j.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(textResp);

        if (type === 'ledger') {
          showLedgerScanResults(parsed);
        } else {
          showScan(st, parsed);
        }
      } catch (e) {
        toast('स्कैन असफल: ' + e.message);
      }
    };
    inp.click();
  }

  function showLedgerScanResults(data) {
    const rows = data.udharLines || [];
    modal(`
      <h3>AI लेजर स्कैन परिणाम</h3>
      <p class="mut">रजिस्टर से पहचानी गई प्रविष्टियां:</p>
      ${rows.length ? `<table>
        <tr><th>तारीख</th><th>पार्टी / गाड़ी</th><th>रुपये</th></tr>
        ${rows.map(r => `<tr><td>${dmy(r.date || APP.todayISO())}</td><td>${esc(r.party || '')} ${esc(r.vehicle || '')}</td><td class="n">${money(r.amount)}</td></tr>`).join('')}
      </table>` : '<div class="warn">फोटो से कोई प्रविष्टि नहीं मिल सकी। हाथ से एंट्री करें।</div>'}
      <div class="btns" style="margin-top:12px"><button class="btn w full" onclick="this.closest('.modal').remove()">बंद करें</button></div>`);
  }

  /* ======================= BILL & SHARE ======================= */
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
      upiUrl = 'upi://pay?' + params.toString();
    }

    const html = head('बिल / INVOICE') + `
      <div class="row" style="display:flex;justify-content:space-between">
        <div><b>${esc(p.name)}</b><br>${p.phone ? '📞 ' + esc(p.phone) : ''}</div>
        <div style="text-align:right">बिल नं: ${inv}<br>तारीख: ${dmy(APP.todayISO())}</div>
      </div>
      <table>
        <tr><th>तारीख</th><th>गाड़ी</th><th>तेल</th><th class="n">लीटर</th><th class="n">रेट</th><th class="n">रुपये</th></tr>
        ${lines.map(l => `<tr><td>${dmy(l.date)}</td><td>${esc(l.vehicle)}</td><td>${FUEL[l.fuel] || ''}</td><td class="n">${l.litre || ''}</td><td class="n">${l.rate || ''}</td><td class="n">${money(l.amount)}</td></tr>`).join('')}
      </table>
      <div style="margin-top:8px">
        ${prev ? kv('पिछला बैलेंस', money(prev)) : ''}
        ${kv('इस अवधि का उधार', money(lines.reduce((a, l) => a + num(l.amount), 0)))}
        ${paid ? kv('जमा हुआ', '− ' + money(paid)) : ''}
      </div>
      <div class="due">${due > 0 ? 'कुल देय: ' + money(due) : 'कोई बकाया नहीं'}</div>
      ${upiUrl ? `
        <div class="qr">
          <div id="qrbox" style="display:inline-block"></div>
          <div style="font-size:15px;margin-top:6px"><b>Paytm / UPI QR स्कैन करके भुगतान करें</b></div>
        </div>` : ''}`;

    toast('बिल बन रहा है…');
    const cv = await cardToCanvas(html, async el => {
      if (upiUrl && window.QRCode) {
        new QRCode($('#qrbox', el), { text: upiUrl, width: 220, height: 220 });
        await new Promise(r => setTimeout(r, 300));
      }
    });

    const blob = await canvasBlob(cv);
    const text = `*${C.pump.nameEn}*\nबिल नं: ${inv}\nपार्टी: ${p.name}\nकुल देय: ${money(due)}`;
    const m = modal(`
      <h3>बिल तैयार</h3>
      <img src="${cv.toDataURL('image/png')}" style="width:100%;border-radius:8px">
      <div class="btns" style="margin-top:10px">
        <button class="btn g" id="b1">📤 इमेज भेजें</button>
        <button class="btn w" id="b2">बंद करें</button>
      </div>`);

    $('#b1', m).onclick = () => shareBlob(blob, 'bill-' + inv + '.png', text);
    $('#b2', m).onclick = () => m.close();
  };

  /* ======================= STOCK VIEW ======================= */
  APP.views.stock = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>'; S.view = null;
    let snap; try { snap = await db().collection('days').orderBy('date', 'desc').limit(20).get(); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const days = snap.docs.map(d => d.data());
    if (!days.length) { main.innerHTML = '<div class="card">अभी कोई हिसाब सेव नहीं हुआ है।</div>'; return; }
    const tbl = (f, nm) => `<div class="card"><h3>${nm} स्टॉक (लीटर)</h3><div style="overflow-x:auto"><table>
      <tr><th>तारीख</th><th class="n">ओपनिंग</th><th class="n">टैंकर</th><th class="n">बिक्री</th><th class="n">हिसाब से</th><th class="n">डिप</th></tr>
      ${days.map(d => { const o = K.compute(d, []); const cl = f === 'P' ? o.stockCloseP : o.stockCloseD, dip = d['dip' + f];
        return `<tr><td>${dmy(d.date)}</td><td class="n">${r2(num(d['openStock' + f]))}</td><td class="n">${r2(num(d['tanker' + f]))}</td><td class="n">${f === 'P' ? o.litP : o.litD}</td><td class="n">${cl}</td>
        <td class="n">${K.has(dip) ? r2(num(dip)) : '–'}</td></tr>`; }).join('')}
      </table></div></div>`;
    main.innerHTML = tbl('P', 'पेट्रोल') + tbl('D', 'डीज़ल');
  };

  /* ======================= PRIV (Owner) ======================= */
  APP.views.priv = async function () {
    const main = $('#main'); main.innerHTML = '<p class="mut">लोड हो रहा है…</p>'; S.view = null;
    let parties;
    try { parties = await APP.getParties(true, true); } catch (e) { main.innerHTML = APP.errBox(e); return; }
    const pend = r2(parties.reduce((a, p) => a + Math.max(0, num(p.bal)), 0));
    main.innerHTML = `<div class="warn">🔒 यह पेज सिर्फ मालिक को दिखता है।</div>
      <div class="card"><h3>निजी उधार बाकी: <span class="neg">${money(pend)}</span></h3></div>
      <div class="card" id="pl"></div>
      <div class="btns"><button class="btn o" id="pu">+ निजी उधार</button><button class="btn w" id="pn">+ नई पार्टी</button></div>`;
    $('#pl').innerHTML = parties.length ? parties.map(p => `<div class="item" data-id="${p.id}" style="cursor:pointer"><div class="a"><b>${esc(p.name)}</b></div><span class="chip ${num(p.bal) > 0 ? 'r' : 'g'}">${money(p.bal)}</span></div>`).join('') : '<p class="mut">अभी कोई निजी पार्टी नहीं</p>';
    $$('#pl .item').forEach(i => i.onclick = () => APP.partyView(i.dataset.id, true));
    $('#pu').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
    $('#pn').onclick = () => APP.partyModal(null, true);
  };

  /* ======================= MORE / LOGOUT ======================= */
  APP.views.more = async function () {
    const main = $('#main'); S.view = null; const own = APP.isOwner();
    main.innerHTML = `
      <div class="card">
        <h3>खाता एवं भूमिका</h3>
        ${kv('लॉगिन', esc(S.user ? S.user.email : 'सेल्समैन'))}
        ${kv('भूमिका', own ? 'मालिक' : S.salesman ? 'सेल्समैन' : 'मैनेजर')}
        <div class="btns"><button class="btn r" id="lo">बाहर निकलें (Logout)</button></div>
      </div>
      <div class="card">
        <h3>AI स्कैनर सेटिंग्स</h3>
        <label>Gemini API Key</label>
        <input id="gemini-key-inp" value="${esc(localStorage.getItem('mazda_gemini_key') || '')}" placeholder="AI Studio Key पेस्ट करें">
        <div class="btns" style="margin-top:8px"><button class="btn g" id="gemini-key-save">API Key सेव करें</button></div>
      </div>`;

    $('#lo').onclick = () => {
      localStorage.removeItem('mazda_sm');
      if (APP.auth) APP.auth.signOut();
      location.reload();
    };

    $('#gemini-key-save').onclick = () => {
      const v = $('#gemini-key-inp').value.trim();
      localStorage.setItem('mazda_gemini_key', v);
      toast('API Key सुरक्षित हो गई ✔');
    };
  };

  /* ---------- Helpers ---------- */
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
  const head = sub => `<div class="hd"><h1>${esc(C.pump.name)}</h1><div>${esc(C.pump.address)}</div><div style="margin-top:6px;font-weight:700;font-size:18px">${sub}</div></div>`;

  async function compress(file, max) {
    const bmp = await createImageBitmap(file); const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  }

  function showScan(st, s) {
    const f = APP.readForm();
    const fills = {};
    if (s.petrol && s.petrol.rate) fills['f-rateP'] = s.petrol.rate;
    if (s.diesel && s.diesel.rate) fills['f-rateD'] = s.diesel.rate;
    const c = s.cash || {};
    ['paytm', 'swipe', 'kharcha'].forEach(k => { if (c[k] != null) fills['f-' + k] = c[k]; });

    const m = modal(`
      <h3>रजिस्टर AI स्कैन परिणाम</h3>
      <p class="mut">पहचाना गया डेटा फॉर्म में भरने के लिए तैयार है:</p>
      <div>पेट्रोल रेट: ₹${s.petrol ? s.petrol.rate : '-'} | डीज़ल रेट: ₹${s.diesel ? s.diesel.rate : '-'}</div>
      <div>Paytm: ₹${c.paytm || 0} | Swipe: ₹${c.swipe || 0}</div>
      <div class="btns" style="margin-top:12px">
        <button class="btn g" id="sf">फॉर्म में भरें</button>
        <button class="btn w" id="sc">रद्द</button>
      </div>`);

    $('#sc', m).onclick = () => m.close();
    $('#sf', m).onclick = () => {
      Object.keys(fills).forEach(id => {
        const el = $('#' + id);
        if (el) el.value = fills[id];
      });
      APP.recalc(); APP.collectDraft(); m.close();
      toast('डेटा फॉर्म में भर दिया गया ✔');
    };
  }

  APP.shareStatement = async function (view, from, to, kind) {
    toast('बन रहा है…');
    const p = view.p;
    const st = K.stmt(view.all, from, to);
    const html = head('खाता विवरण') + `<div><b>${esc(p.name)}</b></div><div class="due">बकाया: ${money(st.close)}</div>`;
    const cv = await cardToCanvas(html);
    const nm = 'khata-' + view.p.name.replace(/\s+/g, '_');
    await shareBlob(await canvasBlob(cv), nm + '.png', C.pump.nameEn + ' — खाता विवरण');
  };
})();
