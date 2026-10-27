/* स्टॉक, गाड़ी कैश, निजी उधार, सेटिंग्स, थर्मल पर्ची (MOC BPCL लोगो सहित) व 100% परफेक्ट AI स्कैनर */
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
  const MOC_BPCL_LOGO = `<img src="./logo.png" alt="" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 6px auto;border-radius:50%">`;

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

    const gcWrite = async (party, veh, amt, kind, note) => {
      const ref = db().collection('ledger').doc(), b = db().batch();
      b.set(ref, { partyId: party.id, partyName: party.name, date: APP.todayISO(), time: APP.nowTime(), kind, vehicle: veh || '', fuel: '', rate: 0, litre: 0, amount: amt, note,
        by: (APP.S.user && APP.S.user.email) || '', uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at: APP.FV.serverTimestamp(),
        ...(kind === 'jama' ? { mode: 'cash' } : {}) });
      b.update(db().collection('parties').doc(party.id), { bal: APP.FV.increment(kind === 'udhar' ? amt : -amt) });
      await b.commit(); return ref.id;
    };
    $('#gc-add').onclick = async () => {
      let ps = []; try { ps = await APP.getParties(false, true); } catch (e) { }
      const m = modal(`<h3>नया गाड़ी कैश</h3>
        <label>पार्टी</label><select id="gc-pp"><option value="">— लोकल / बिना पार्टी —</option>${ps.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        <label>गाड़ी नंबर</label><input id="gc-v" style="text-transform:uppercase">
        <label>रुपये</label><input id="gc-a" inputmode="decimal">
        <div class="mut" style="margin-top:6px;font-size:12px">पार्टी चुनने पर ये रकम उसके उधार में जुड़ेगी और आज के कैश से कम होगी।</div>
        <div class="btns" style="margin-top:10px"><button class="btn g" id="gc-sv">सेव</button><button class="btn w" id="gc-cl">रद्द</button></div>`);
      $('#gc-cl', m).onclick = () => m.close();
      $('#gc-sv', m).onclick = async () => {
        const v = $('#gc-v', m).value.trim().toUpperCase(), a = num($('#gc-a', m).value), p = ps.find(x => x.id === $('#gc-pp', m).value);
        if (!v || !(a > 0)) return toast('गाड़ी नंबर व रकम सही भरें');
        const btn = $('#gc-sv', m); if (btn.disabled) return; btn.disabled = true;
        try {
          const lid = p ? await gcWrite(p, v, a, 'udhar', 'गाड़ी कैश') : '';
          await db().collection('gaadi_cash').add({ vehicle: v, partyId: p ? p.id : '', partyName: p ? p.name : '', ledgerId: lid, amount: a, date: APP.todayISO(), status: 'pending', createdAt: APP.FV.serverTimestamp() });
          APP.S.parties = null; m.close(); toast('सेव हो गया'); APP.views.gaadicash();
        } catch (e) { btn.disabled = false; toast('सेव नहीं हुआ: ' + e.message); }
      };
    };
    $$('[data-gc-id]').forEach(b => {
      b.onclick = async () => {
        const it = list.find(x => x.id === b.dataset.gcId); if (!it) return;
        if (!confirm('क्या ' + money(it.amount) + ' वापस मिल गया?' + (it.partyId ? '\nये पार्टी के खाते में नकद जमा लिखा जाएगा।' : ''))) return;
        b.disabled = true;
        try {
          if (it.partyId) await gcWrite({ id: it.partyId, name: it.partyName }, it.vehicle, num(it.amount), 'jama', 'गाड़ी कैश वापस');
          await db().collection('gaadi_cash').doc(it.id).update({ status: 'paid' });
          APP.S.parties = null; toast('Paid हो गया'); APP.views.gaadicash();
        } catch (e) { b.disabled = false; toast('नहीं हुआ: ' + e.message); }
      };
    });
  };

  /* ======================= STOCK REPORT (MONTHLY) ======================= */
  APP.views.stock = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">स्टॉक रिपोर्ट लोड हो रही है…</p>';
    
    const now = new Date();
    const defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    
    const renderView = async (monthStr) => {
      main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
      const start = monthStr + '-01';
      const end = monthStr + '-31';
      
      let snap;
      try { snap = await db().collection('days').where('date', '>=', start).where('date', '<=', end).get(); } 
      catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }
      
      const days = snap.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date));
      
      let totTankerP = 0, totTankerD = 0;
      let totLitP = 0, totLitD = 0;
      let totDiffP = 0, totDiffD = 0;
      let totTestP = 0, totTestD = 0;
      
      const nzP = { p1: 0, p2: 0, p3: 0, p4: 0 };
      const nzD = { d1: 0, d2: 0, d3: 0, d4: 0 };
      
      days.forEach(d => {
        totTankerP += num(d.tankerP);
        totTankerD += num(d.tankerD);
        
        totLitP += num(d.sum && d.sum.litP);
        totLitD += num(d.sum && d.sum.litD);
        
        totDiffP += num(d.sum && d.sum.diffP);
        totDiffD += num(d.sum && d.sum.diffD);
        
        let activeP = 0, activeD = 0;
        const testing = num(d.testing || 5);
        
        K.NZ.forEach(k => {
          const n = d.nz && d.nz[k];
          if (n && K.has(n.o) && K.has(n.c)) {
            const net = Math.max(0, (num(n.c) - num(n.o)) - testing);
            if (k.startsWith('p')) { nzP[k] += net; activeP++; }
            else { nzD[k] += net; activeD++; }
          }
        });
        totTestP += (activeP * testing);
        totTestD += (activeD * testing);
      });
      
      const pct = (val, tot) => tot > 0 ? ((val / tot) * 100).toFixed(1) + '%' : '0%';
      const sign = (v) => v > 0 ? '+' : '';
      const color = (v) => v > 0 ? 'pos' : (v < 0 ? 'neg' : '');
      
      const kvEl = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
      
      main.innerHTML = `
        <div class="card" style="background:#0b3d91;color:#fff;">
          <div class="row" style="align-items:center;">
            <div style="flex:1">
              <label style="color:#fff;margin:0;">महीना चुनें</label>
              <input type="month" id="stk-month" value="${monthStr}" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid #fff;">
            </div>
            <div style="flex:0 0 auto;">
              <button class="btn sm w" id="stk-refresh" style="margin-top:20px;">🔄 रिफ्रेश</button>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>⛽ पेट्रोल का हिसाब</h3>
          ${kvEl('टैंकर से आया (कुल)', APP.lit(totTankerP))}
          ${kvEl('मीटर से बिक्री (कुल)', APP.lit(totLitP), 'big')}
          ${kvEl('टेस्टिंग (कुल)', APP.lit(totTestP))}
          ${kvEl('वेरिएशन (कम/ज्यादा)', sign(totDiffP) + r2(totDiffP) + ' L', color(totDiffP))}
        </div>

        <div class="card">
          <h3>⛽ डीज़ल का हिसाब</h3>
          ${kvEl('टैंकर से आया (कुल)', APP.lit(totTankerD))}
          ${kvEl('मीटर से बिक्री (कुल)', APP.lit(totLitD), 'big')}
          ${kvEl('टेस्टिंग (कुल)', APP.lit(totTestD))}
          ${kvEl('वेरिएशन (कम/ज्यादा)', sign(totDiffD) + r2(totDiffD) + ' L', color(totDiffD))}
        </div>

        <div class="card">
          <h3>⛽ नोज़ल-वाइज पेट्रोल बिक्री</h3>
          ${['p1','p2','p3','p4'].map(k => kvEl(k.toUpperCase(), APP.lit(nzP[k]) + ' (' + pct(nzP[k], totLitP) + ')')).join('')}
        </div>

        <div class="card">
          <h3>🛢️ नोज़ल-वाइज डीज़ल बिक्री</h3>
          ${['d1','d2','d3','d4'].map(k => kvEl(k.toUpperCase(), APP.lit(nzD[k]) + ' (' + pct(nzD[k], totLitD) + ')')).join('')}
        </div>

        <div class="card" style="overflow-x:auto">
          <h3>📅 दिन-वार स्टॉक रजिस्टर</h3>
          ${days.length ? `
          <table style="font-size:11px;min-width:400px;">
            <tr>
              <th>तारीख</th>
              <th class="n">P टैंकर</th>
              <th class="n">P सेल</th>
              <th class="n">P फर्क</th>
              <th class="n">D टैंकर</th>
              <th class="n">D सेल</th>
              <th class="n">D फर्क</th>
            </tr>
            ${days.map(d => {
              const dp = d.sum ? d.sum.diffP : null;
              const dd = d.sum ? d.sum.diffD : null;
              return `<tr>
                <td>${dmy(d.date)}</td>
                <td class="n">${d.tankerP || '-'}</td>
                <td class="n">${d.sum ? d.sum.litP : '-'}</td>
                <td class="n ${dp > 0 ? 'pos' : (dp < 0 ? 'neg' : '')}">${dp !== null && dp !== undefined ? sign(dp) + r2(dp) : '-'}</td>
                <td class="n">${d.tankerD || '-'}</td>
                <td class="n">${d.sum ? d.sum.litD : '-'}</td>
                <td class="n ${dd > 0 ? 'pos' : (dd < 0 ? 'neg' : '')}">${dd !== null && dd !== undefined ? sign(dd) + r2(dd) : '-'}</td>
              </tr>`;
            }).join('')}
          </table>` : '<p class="mut">इस महीने का कोई डेटा नहीं है।</p>'}
        </div>
      `;
      
      $('#stk-month').onchange = (e) => renderView(e.target.value);
      $('#stk-refresh').onclick = () => renderView($('#stk-month').value);
    };
    
    renderView(defaultMonth);
  };

  /* ======================= NIJI UDHAR (PRIV) - WITH HISTORY ======================= */
  APP.views.priv = async function (mode) {
    mode = mode || 'active';
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let parties = []; try { parties = await APP.getParties(true, true); } catch (e) { }
    
    const activeParties = parties.filter(p => num(p.bal) > 0.01); 
    const historyParties = parties.filter(p => num(p.bal) <= 0.01); 
    
    const list = mode === 'active' ? activeParties : historyParties;
    const pend = activeParties.reduce((a, p) => a + num(p.bal), 0);

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff;">
        <div class="row" style="align-items:center;">
          <div style="flex:1">
            <h3 style="color:#fff;margin:0;">🔒 निजी उधार</h3>
            <div style="font-size:12px;opacity:.85;margin-top:4px;">कुल बाकी: ${money(pend)}</div>
          </div>
          <div style="flex:0 0 auto;">
            <button class="btn sm w" id="pv-toggle">${mode === 'active' ? '📜 हिस्ट्री देखें' : '⬅️ वापस'}</button>
          </div>
        </div>
      </div>
      <div class="btns" style="margin-bottom:12px">
        ${mode === 'active' ? '<button class="btn o" id="pv-add">+ नया निजी उधार</button>' : ''}
      </div>
      <div class="card">
        ${list.length ? list.map(p => `
          <div class="item" style="cursor:pointer" data-pid="${p.id}">
            <div class="a"><b>${esc(p.name)}</b></div>
            <span class="chip ${mode === 'active' ? 'r' : 'g'}">${money(mode === 'active' ? p.bal : (p.closedAmount || p.bal))}</span>
          </div>
        `).join('') : `<p class="mut" style="text-align:center;padding:20px;">${mode === 'active' ? 'कोई बकाया नहीं है' : 'कोई हिस्ट्री नहीं है'}</p>`}
      </div>
    `;
    
    if ($('#pv-add')) $('#pv-add').onclick = () => APP.entryModal({ priv: true, date: APP.todayISO() });
    $('#pv-toggle').onclick = () => APP.views.priv(mode === 'active' ? 'history' : 'active');
    
    $$('[data-pid]').forEach(el => el.onclick = () => APP.partyView(el.dataset.pid, true));
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

    if (APP.isOwner() && APP.syncOldBankData) {
      const btns = main.querySelector('.btns');
      const sb = document.createElement('button');
      sb.id = 'm-sync-bank'; sb.className = 'btn w full'; sb.style.marginBottom = '10px';
      sb.textContent = '🔄 पुराना डेटा SBI बैंक में सिंक करें';
      sb.onclick = () => APP.syncOldBankData();
      if (btns) btns.insertBefore(sb, btns.firstChild);
    }

    $('#m-logout').onclick = () => {
      localStorage.removeItem('mazda_sm');
      localStorage.removeItem('mazda_viewer');
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

  /* ======================= AI REGISTER SCANNER (v2) ======================= */
  APP.scanRegister = async function (st) {
    const esc = APP.esc;
    const NZ = K.NZ;
    const clean = s => String(s == null ? '' : s).replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    const nrm = s => clean(s).toLowerCase().replace(/[\s.\-_(),]+/g, '');
    const nrmVeh = s => clean(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const numOrNull = v => {
      if (v === undefined || v === null) return null;
      const t = String(v).replace(/[,₹\s]/g, '');
      if (t === '') return null;
      const n = Number(t);
      return isNaN(n) ? null : n;
    };

    const AL_KEY = 'mazda_scan_alias';
    const alias = (() => { try { const a = JSON.parse(localStorage.getItem(AL_KEY) || '{}'); return { n: a.n || {}, v: a.v || {} }; } catch (e) { return { n: {}, v: {} }; } })();
    const saveAlias = () => { try { localStorage.setItem(AL_KEY, JSON.stringify(alias)); } catch (e) { } };
    const nrmHi = s => clean(s).toLowerCase().replace(/[\u093c\u200d\u200c]/g, '').replace(/\u0901/g, '\u0902').replace(/[\s.\-_(),]+/g, '');
    const sim = (a, b) => {
      if (!a || !b) return 0;
      if (a === b) return 1;
      const m = a.length, n = b.length;
      let prev = Array.from({ length: n + 1 }, (_, j) => j);
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
      return 1 - prev[n] / Math.max(m, n);
    };
    const digitsOf = s => String(s || '').replace(/\D/g, '');
    const BASE_PROMPT = `Ye petrol pump ke daily hisab register ki photo hai. Photo padhkar SIRF ek JSON do (koi explanation, koi code-fence, koi extra text nahi). Format:
{"date":"YYYY-MM-DD","rateP":0,"rateD":0,"testing":5,
"nz":{"p1":{"o":0,"c":0},"p2":{"o":0,"c":0},"p3":{"o":0,"c":0},"p4":{"o":0,"c":0},"d1":{"o":0,"c":0},"d2":{"o":0,"c":0},"d3":{"o":0,"c":0},"d4":{"o":0,"c":0}},
"openCash":0,"paytm":0,"swipe":0,"kharcha":0,"driverInaam":0,"chaiKhana":0,"kharchaItems":[{"label":"","amount":0}],"malikDiya":0,
"openStockP":0,"openStockD":0,"tankerP":0,"tankerD":0,"dipP":0,"dipD":0,"note":"",
"udhar":[{"party":"","vehicle":"","fuel":"diesel","litre":0,"amount":0}],
"jama":[{"party":"","mode":"cash","amount":0}]}
Rules: p1-p4 petrol nozzle, d1-d4 diesel nozzle; o=opening, c=closing. Sirf numbers (koi rupee sign ya comma nahi). Jo cheez photo mein na dikhe wo key mat likho. fuel sirf "petrol"/"diesel". jama mode sirf cash/paytm/swipe/bank. Register mein "AD" likha ho to wo purane din ka cash hai: usko jama mein mat daalo, "openCash" mein likho. Date YYYY-MM-DD.
Kharcha ke rules: "kharcha" mein SIRF DG/generator ka kharcha likho, "driverInaam" mein driver ka inaam, "chaiKhana" mein chai-khana. Baaki har alag kharcha (jaise puncture, safai, bijli, repair) "kharchaItems" mein ALAG-ALAG likho, har ek ka "label" (kis cheez ka) aur "amount" ke saath. Agar register mein sirf ek total kharcha likha hai aur kis cheez ka hai ye samajh nahi aa raha, to usko kharchaItems mein "label":"" ke saath likho (apni taraf se mat bantna).`;
    const buildPrompt = parties => BASE_PROMPT +
      '\n\nPARTY LIST (party ka naam SIRF is list se, bilkul isi spelling mein likho. Gaadi number se bhi party pehchano. Agar kisi list wali party se na mile to photo wala naam jaisa hai waisa likho):\n' +
      parties.map(p => '- ' + p.name + (p.vehicles && p.vehicles.length ? '  (gaadi: ' + p.vehicles.join(', ') + ')' : '')).join('\n');

    const KEY_LS = 'mazda_gemini_key', MODEL_LS = 'mazda_gemini_model';
    const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
    const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
    const getKey = () => lsGet(KEY_LS);
    const askKey = () => {
      const k = prompt('Gemini API key paste karein (aistudio.google.com/app/apikey se). Ye sirf is phone mein save hogi:', getKey());
      if (k === null) return false;
      lsSet(KEY_LS, k.trim()); lsSet(MODEL_LS, '');
      return !!k.trim();
    };
    const GBASE = 'https://generativelanguage.googleapis.com/v1beta';
    const gErr = (code, j) => {
      const m = (j && j.error && j.error.message) || ('HTTP ' + code);
      const hint = code === 400 && /api key/i.test(m) ? 'Key galat hai — 🔑 se dobara daalein.'
        : code === 403 ? 'Key ko permission nahi mili ya is jagah se block hai.'
        : code === 429 ? 'Free limit poori ho gayi — thodi der baad try karein.'
        : code === 503 ? 'Gemini abhi busy hai — dobara try karein.' : '';
      return 'Gemini error (' + code + '): ' + m + (hint ? '\n' + hint : '');
    };
    const gfetch = async (path, init, key, stage) => {
      const tries = [
        () => fetch(GBASE + path, Object.assign({}, init, { headers: Object.assign({}, init.headers || {}, { 'x-goog-api-key': key }) })),
        () => fetch(GBASE + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(key), init)
      ];
      let last;
      for (const t of tries) { try { return await t(); } catch (e) { last = e; } }
      const err = new Error('इंटरनेट / ब्लॉक की दिक्कत (' + stage + '): ' + ((last && last.message) || '') + '\nजाँचें: नेट चालू हो, VPN / Private Relay / ad-blocker बंद हो, फिर दोबारा करें।');
      err.status = -1; throw err;
    };
    const listModels = async key => {
      const r = await gfetch('/models?pageSize=200', {}, key, 'model list');
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(gErr(r.status, j)); e.status = r.status; throw e; }
      const all = (j.models || []).filter(x => (x.supportedGenerationMethods || []).includes('generateContent')).map(x => x.name.replace(/^models\//, ''));
      const ver = n => { const m = /^gemini-(\d+(?:\.\d+)?)-flash/.exec(n); return m ? parseFloat(m[1]) : 0; };
      const flash = all.filter(n => ver(n) > 0 && !/image|tts|live|audio|embed|thinking|robotics|computer|exp|8b/.test(n));
      const rank = n => (/preview/.test(n) ? 0 : /lite/.test(n) ? 1 : 2);
      flash.sort((a, b) => rank(b) - rank(a) || ver(b) - ver(a));
      const out = flash.slice(0, 3);
      if (all.includes('gemini-flash-latest')) out.push('gemini-flash-latest');
      return out;
    };
    const toJpegB64 = (file, maxPx, q) => new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', q).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('फोटो खुल नहीं पाई — कैमरे से सीधी फोटो लें')); };
      img.src = url;
    });
    const geminiReadOnce = async (file, maxPx, q) => {
      const key = getKey(); if (!key) throw new Error('पहले 🔑 Gemini key डालें');
      const b64 = await toJpegB64(file, maxPx, q);
      let ps = []; try { ps = await APP.getParties(false, true); } catch (e) { }
      const ask = buildPrompt(ps) + '\n\nAaj ki tareekh ' + ((st && st.date) || APP.todayISO()) + ' hai; photo mein tareekh na dikhe to yahi use karo.';
      const body = JSON.stringify({ contents: [{ parts: [{ text: ask }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } });
      const tryModel = async model => {
        const r = await gfetch('/models/' + model + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }, key, 'फोटो भेजना');
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(gErr(r.status, j)); e.status = r.status; throw e; }
        const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = parts.map(x => x.text || '').join('');
        if (!txt.trim()) { const e = new Error('Gemini ne khaali jawab diya (photo saaf nahi ho sakti) — dobara try karein'); e.status = 0; throw e; }
        return txt;
      };
      let models = lsGet(MODEL_LS) ? [lsGet(MODEL_LS)] : [], lastErr;
      for (let round = 0; round < 2; round++) {
        for (const mdl of models) {
          try { const out = await tryModel(mdl); lsSet(MODEL_LS, mdl); return out; }
          catch (e) { lastErr = e; if (![404, 429, 500, 503].includes(e.status)) throw e; }
        }
        if (round === 0) {
          lsSet(MODEL_LS, ''); models = await listModels(key);
          if (!models.length) throw new Error('Is key par koi chalu Gemini model nahi mila');
        }
      }
      throw lastErr;
    };

    const geminiRead = async file => {
      try { return await geminiReadOnce(file, 1600, 0.88); }
      catch (e) { if (e.status === -1) return await geminiReadOnce(file, 1000, 0.8); throw e; }
    };

    const text = await new Promise(resolve => {
      const m = modal(`
        <h3>📷 AI कोड पेस्ट करें</h3>
        <p class="mut" style="margin:4px 0 8px">Gemini / Claude का दिया JSON यहाँ पेस्ट करें</p>
        <textarea id="scan-ta" rows="9" style="width:100%;font-size:13px" placeholder='{ "date": "..." }'></textarea>
        <div class="btns" style="margin-top:10px">
          <button class="btn g" id="scan-auto">📷 फोटो से अपने-आप भरें</button>
          <button class="btn w" id="scan-key">🔑 Gemini key</button>
          <input type="file" id="scan-file" accept="image/*" style="display:none">
          <button class="btn w" id="scan-clip">📋 क्लिपबोर्ड से लें</button>
          <button class="btn w" id="scan-prompt">🧾 Gemini के लिए प्रॉम्प्ट कॉपी (पार्टी लिस्ट के साथ)</button>
          <button class="btn g" id="scan-ok">आगे बढ़ें</button>
          <button class="btn w" id="scan-no">रद्द</button>
        </div>`);
      const ta = $('#scan-ta', m);
      $('#scan-clip', m).onclick = async () => {
        try { ta.value = await navigator.clipboard.readText(); }
        catch (e) { toast('क्लिपबोर्ड नहीं मिला — बॉक्स में दबाकर पेस्ट करें'); }
      };
      const fileEl = $('#scan-file', m), autoBtn = $('#scan-auto', m);
      autoBtn.onclick = () => { if (!getKey() && !askKey()) return; fileEl.value = ''; fileEl.click(); };
      $('#scan-key', m).onclick = () => { askKey(); };
      fileEl.onchange = async () => {
        const f0 = fileEl.files && fileEl.files[0]; if (!f0) return;
        autoBtn.disabled = true; autoBtn.textContent = '⏳ AI पढ़ रहा है…';
        try { ta.value = await geminiRead(f0); $('#scan-ok', m).click(); }
        catch (e) { autoBtn.disabled = false; autoBtn.textContent = '📷 फोटो से अपने-आप भरें'; alert(e.message); }
      };
      $('#scan-prompt', m).onclick = async () => {
        let ps = []; try { ps = await APP.getParties(false, true); } catch (e) { }
        const pr = buildPrompt(ps);
        try { await navigator.clipboard.writeText(pr); toast('प्रॉम्प्ट कॉपी हो गया — Gemini में फोटो के साथ पेस्ट करें'); }
        catch (e) { ta.value = pr; ta.select(); toast('ऊपर बॉक्स में प्रॉम्प्ट है — कॉपी कर लें'); }
      };
      $('#scan-ok', m).onclick = () => { const v = ta.value; m.close(); resolve(v); };
      $('#scan-no', m).onclick = () => { m.close(); resolve(null); };
    });
    if (!text || !text.trim()) return;

    let raw;
    try {
      let t = text.replace(/```json/gi, '').replace(/```/g, '');
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a < 0 || b < a) throw new Error('{ } नहीं मिला');
      t = t.slice(a, b + 1).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/,\s*([}\]])/g, '$1');
      raw = JSON.parse(t);
    } catch (e) {
      alert('कोड पढ़ नहीं पाया (' + e.message + ').\nGemini/Claude का पूरा JSON, पहले { से आख़िरी } तक, कॉपी करें।');
      return;
    }

    const f = {};            
    const put = (id, v) => { const n = numOrNull(v); if (n !== null) f[id] = n; };
    const putTxt = (id, v) => { const s = clean(v); if (s) f[id] = s; };
    const pick = (...vals) => vals.find(v => v !== undefined && v !== null && clean(v) !== '');

    put('f-rateP', pick(raw.rateP, raw.petrol && raw.petrol.rate));
    put('f-rateD', pick(raw.rateD, raw.diesel && raw.diesel.rate));
    put('f-dipP', pick(raw.dipP, raw.petrol && raw.petrol.dip));
    put('f-dipD', pick(raw.dipD, raw.diesel && raw.diesel.dip));
    put('f-testing', pick(raw.testing, raw.test));
    put('f-openCash', pick(raw.openCash, raw.cash && raw.cash.openCash));
    put('f-paytm', pick(raw.paytm, raw.cash && raw.cash.paytm));
    put('f-swipe', pick(raw.swipe, raw.cash && raw.cash.swipe));
    put('f-kharcha', pick(raw.kharcha, raw.cash && raw.cash.kharcha));
    put('f-driverInaam', pick(raw.driverInaam, raw.cash && raw.cash.driverInaam));
    put('f-chaiKhana', pick(raw.chaiKhana, raw.cash && raw.cash.chaiKhana));
    put('f-malikDiya', pick(raw.malikDiya, raw.cash && raw.cash.malikDiya));
    put('f-openStockP', raw.openStockP); put('f-openStockD', raw.openStockD);
    put('f-tankerP', raw.tankerP); put('f-tankerD', raw.tankerD);
    putTxt('f-note', raw.note);

    const nz = {};           
    if (raw.nz && typeof raw.nz === 'object') {
      NZ.forEach(k => {
        const x = raw.nz[k] || raw.nz[k.toUpperCase()];
        if (!x) return;
        const o = numOrNull(x.o !== undefined ? x.o : x.open !== undefined ? x.open : x.opening);
        const c = numOrNull(x.c !== undefined ? x.c : x.close !== undefined ? x.close : x.closing);
        if (o !== null || c !== null) nz[k] = { o, c };
      });
    } else if (Array.isArray(raw.nozzles)) {
      raw.nozzles.forEach((x, i) => {
        if (!x || !NZ[i]) return;
        const c = numOrNull(x.closing !== undefined ? x.closing : x.c);
        const o = numOrNull(x.opening !== undefined ? x.opening : x.o);
        if (o !== null || c !== null) nz[NZ[i]] = { o, c };
      });
    }

    const expL = [];
    [['kharcha', 'f-kharcha'], ['driverInaam', 'f-driverInaam'], ['chaiKhana', 'f-chaiKhana']].forEach(([k, id]) => {
      if (f[id] > 0) { expL.push({ cat: k, label: '', amount: f[id] }); delete f[id]; }
    });
    const exIn = Array.isArray(raw.kharchaItems) ? raw.kharchaItems : Array.isArray(raw.expenses) ? raw.expenses : Array.isArray(raw.kharchaList) ? raw.kharchaList : [];
    exIn.forEach(it => {
      if (!it) return;
      const a = numOrNull(it.amount !== undefined ? it.amount : it.rs);
      if (!(a > 0)) return;
      const lb = clean(it.label || it.name || it.item || it.for);
      let cat = 'other';
      if (/\bdg\b|जनरेटर|generator/i.test(lb)) cat = 'kharcha';
      else if (/ड्राइवर|driver|इनाम/i.test(lb)) cat = 'driverInaam';
      else if (/चाय|खाना|chai|khana|nasta|नाश्ता/i.test(lb)) cat = 'chaiKhana';
      expL.push({ cat, label: cat === 'other' ? lb : '', amount: a });
    });
    const expOrig = K.r2(expL.reduce((a, x) => a + x.amount, 0));
    const KHN = { kharcha: 'DG (जनरेटर)', driverInaam: 'ड्राइवर इनाम', chaiKhana: 'चाय-खाना' };
    const expName = x => x.cat === 'other' ? (x.label || '❓ नाम नहीं पता') : KHN[x.cat];

    const udharIn = Array.isArray(raw.udhar) ? raw.udhar : (Array.isArray(raw.ledger) ? raw.ledger : []);
    const jamaIn = Array.isArray(raw.jama) ? raw.jama : [];

    const date = /^\d{4}-\d{2}-\d{2}$/.test(clean(raw.date)) ? clean(raw.date) : (st && st.date) || APP.todayISO();
    const switching = st && st.date && date !== st.date;

    let parties = [];
    try { parties = await APP.getParties(false, true); } catch (e) { parties = []; }
    const byId = id => parties.find(x => x.id === id) || null;
    const findParty = (name, veh) => {
      const nn = nrm(name), vv = nrmVeh(veh), hn = nrmHi(name);
      let p = null;
      if (vv && alias.v[vv] && (p = byId(alias.v[vv]))) return p;
      if (hn && alias.n[hn] && (p = byId(alias.n[hn]))) return p;
      if (vv) {
        p = parties.find(x => (x.vehicles || []).some(v => nrmVeh(v) === vv));
        if (p) return p;
        const dg = digitsOf(veh);
        if (dg.length >= 3) {
          const hits = parties.filter(x => (x.vehicles || []).some(v => { const d2 = digitsOf(v); return d2.length >= 3 && (d2.endsWith(dg) || dg.endsWith(d2)); }));
          if (hits.length === 1) return hits[0];
        }
      }
      if (nn) {
        p = parties.find(x => nrm(x.name) === nn);
        if (p) return p;
        const sc = parties.map(x => ({ x, s: sim(hn, nrmHi(x.name)) })).sort((a, b) => b.s - a.s);
        if (sc.length && sc[0].s >= 0.88 && (sc.length < 2 || sc[0].s - sc[1].s >= 0.08)) return sc[0].x;
      }
      return null;
    };
    const suggest = (name, veh) => {
      const hn = nrmHi(name), dg = digitsOf(veh);
      return parties.map(x => {
        let sc = sim(hn, nrmHi(x.name));
        if (dg.length >= 3 && (x.vehicles || []).some(v => { const d2 = digitsOf(v); return d2.length >= 3 && (d2.endsWith(dg) || dg.endsWith(d2)); })) sc += 1;
        return { x, sc };
      }).sort((a, b) => b.sc - a.sc);
    };

    let existing = (st && !switching && st.rows) ? st.rows : [];
    if (switching) {
      try { const rs = await db().collection('ledger').where('date', '==', date).get(); existing = rs.docs.map(x => x.data()); } catch (e) { existing = []; }
    }
    const rateNow = fuel => {
      const id = fuel === 'petrol' ? 'f-rateP' : 'f-rateD';
      const n = f[id] !== undefined ? f[id] : numOrNull(($('#' + id) || {}).value);
      return n || (APP.S.rates && APP.S.rates[fuel]) || 0;
    };

    const U = [], J = [], bad = [], pend = [];
    udharIn.forEach((it, i) => {
      if (!it) return;
      const fuel = /petrol|पेट्रोल|^p$/i.test(clean(it.fuel)) ? 'petrol' : 'diesel';
      const veh = clean(it.vehicle || it.gaadi).toUpperCase();
      let amount = numOrNull(it.amount), litre = numOrNull(it.litre), rate = numOrNull(it.rate) || rateNow(fuel);
      if (amount === null && litre !== null && rate) amount = K.r2(litre * rate);
      if (litre === null && amount !== null && rate) litre = K.r2(amount / rate);
      const label = `उधार #${i + 1}: ${clean(it.party) || '?'} ${veh}`;
      if (!(amount > 0)) { bad.push(label + ' — रकम नहीं मिली'); return; }
      const p = findParty(it.party, veh);
      const base = { veh, fuel, rate, litre: litre || 0, amount, time: clean(it.time), note: clean(it.note) };
      if (!p) { pend.push({ kind: 'udhar', label, nameRaw: clean(it.party), base }); return; }
      const dup = existing.some(r => r.kind === 'udhar' && r.partyId === p.id && nrmVeh(r.vehicle) === nrmVeh(veh) && Math.abs(num(r.amount) - amount) < 0.01);
      U.push(Object.assign({ p, dup }, base));
    });
    jamaIn.forEach((it, i) => {
      if (!it) return;
      const amount = numOrNull(it.amount);
      if (/^(ad|a\.?d\.?|एड|ए\.?डी\.?)$/i.test(nrm(it.party)) && amount > 0) {
        if (f['f-openCash'] === undefined) f['f-openCash'] = amount;
        return;
      }
      const label = `जमा #${i + 1}: ${clean(it.party) || '?'}`;
      if (!(amount > 0)) { bad.push(label + ' — रकम नहीं मिली'); return; }
      const p = findParty(it.party, '');
      const md = clean(it.mode).toLowerCase();
      const mode = /paytm|upi/.test(md) ? 'paytm' : /swipe|card/.test(md) ? 'swipe' : /bank/.test(md) ? 'bank' : 'cash';
      const base = { mode, amount, time: clean(it.time), note: clean(it.note) };
      if (!p) { pend.push({ kind: 'jama', label, nameRaw: clean(it.party), base }); return; }
      const dup = existing.some(r => r.kind === 'jama' && r.partyId === p.id && r.mode === mode && Math.abs(num(r.amount) - amount) < 0.01);
      J.push(Object.assign({ p, dup }, base));
    });

    const fieldCount = Object.keys(f).length + Object.values(nz).reduce((a, x) => a + (x.o !== null ? 1 : 0) + (x.c !== null ? 1 : 0), 0);
    const nzTxt = NZ.filter(k => nz[k]).map(k => `${k.toUpperCase()}: ${nz[k].o !== null ? nz[k].o : '–'} → ${nz[k].c !== null ? nz[k].c : '–'}`).join('<br>');
    const newU0 = U.filter(x => !x.dup), newJ0 = J.filter(x => !x.dup);
    const dupN = (U.length - newU0.length) + (J.length - newJ0.length);

    const picks = await new Promise(resolve => {
      const m = modal(`
        <h3>जाँच लें, फिर भरें</h3>
        <div class="kv"><span>तारीख</span><b>${esc(APP.dmy(date))}${switching ? ' ⚠️ (दूसरा दिन)' : ''}</b></div>
        <div class="kv"><span>हिसाब के बॉक्स</span><b>${fieldCount}</b></div>
        ${nzTxt ? `<div class="mut" style="font-size:12px;margin:4px 0">${nzTxt}</div>` : ''}
        <div class="kv"><span>नई उधार एंट्री</span><b>${newU0.length}</b></div>
        ${newU0.map(x => `<div class="mut" style="font-size:12px">• ${esc(x.p.name)} · ${esc(x.veh)} · ${money(x.amount)}</div>`).join('')}
        <div class="kv"><span>नई जमा एंट्री</span><b>${newJ0.length}</b></div>
        ${newJ0.map(x => `<div class="mut" style="font-size:12px">• ${esc(x.p.name)} · ${money(x.amount)}</div>`).join('')}
        <div id="pv-exp"></div>
        ${dupN ? `<div class="mut" style="margin-top:6px">पहले से मौजूद (छोड़ दी जाएँगी): ${dupN}</div>` : ''}
        ${pend.length ? `<div class="warn" style="margin-top:8px"><b>❓ ये पार्टी नहीं पहचानी — सही पार्टी चुनें (${pend.length}):</b>
          ${pend.map((x, i) => { const sg = suggest(x.nameRaw, x.base.veh); return `<div style="margin-top:8px"><small>${esc(x.label)} · ${money(x.base.amount)}</small>
            <select data-pi="${i}" style="width:100%;margin-top:3px">${x.nameRaw ? '<option value="__new" selected>➕ नई पार्टी बनाओ: ' + esc(x.nameRaw) + '</option>' : ''}<option value="">— छोड़ दो —</option>${sg.map((o, j) => `<option value="${o.x.id}">${j < 3 && o.sc > 0.5 ? '⭐ ' : ''}${esc(o.x.name)}</option>`).join('')}</select></div>`; }).join('')}
          <small class="mut">एक बार चुनने पर app ये नाम/गाड़ी याद रखेगा।</small></div>` : ''}
        ${bad.length ? `<div class="warn" style="margin-top:8px"><b>❌ ये नहीं भरी जा सकीं (${bad.length}):</b><br>${bad.map(esc).join('<br>')}</div>` : ''}
        <div class="btns" style="margin-top:12px">
          <button class="btn g" id="pv-ok">✅ भर दो</button>
          <button class="btn w" id="pv-no">रद्द</button>
        </div>`);
      const renderExp = () => {
        const box = $('#pv-exp', m); if (!box) return;
        if (!expL.length) { box.innerHTML = ''; return; }
        const tot = K.r2(expL.reduce((a, x) => a + x.amount, 0));
        const unk = expL.filter(x => x.cat === 'other' && !x.label).length;
        box.innerHTML = `<div class="${unk ? 'warn' : ''}" style="margin-top:8px;${unk ? '' : 'background:#f8f9fc;border-radius:8px;padding:8px 10px'}">
          <div class="kv" style="border:0"><span><b>💸 खर्चा</b></span><b>${money(tot)}</b></div>
          ${expL.map(x => `<div class="mut" style="font-size:12px">• ${esc(expName(x))} · ${money(x.amount)}</div>`).join('')}
          ${unk ? `<div style="font-size:13px;margin-top:4px">❓ ${unk} खर्चा किस चीज़ का है, समझ नहीं आया — नीचे बटन से बता दें।</div>` : ''}
          <div class="btns"><button class="btn w sm" type="button" id="pv-exp-ed">✏️ खर्चा एडिट / अलग-अलग बाँटें</button></div></div>`;
        $('#pv-exp-ed', m).onclick = () => APP.expEditor({
          title: '💸 खर्चा — किस चीज़ में कितना',
          note: `पेस्ट में कुल खर्चा <b>${money(expOrig)}</b> आया है। चाहें तो एक खर्चे को अलग-अलग हिस्सों में बाँटें (जोड़ बराबर रहना चाहिए), नाम सुधारें या हटाएँ।`,
          mustTotal: expOrig, soft: true,
          lines: expL.map(x => ({ cat: x.cat, label: x.label, amount: x.amount })),
          onOk: lines => { expL.length = 0; lines.forEach(l => expL.push(l)); renderExp(); }
        });
      };
      renderExp();
      $('#pv-ok', m).onclick = () => { const r = {}; $$('select[data-pi]', m).forEach(el => { if (el.value) r[el.dataset.pi] = el.value; }); m.close(); resolve(r); };
      $('#pv-no', m).onclick = () => { m.close(); resolve(null); };
    });
    if (!picks) return;

    const mk = {};
    Object.keys(picks).forEach(i => {
      if (picks[i] !== '__new') return;
      const x = pend[i], key = nrmHi(x.nameRaw);
      mk[key] = mk[key] || { name: x.nameRaw, vehicles: [] };
      if (x.base.veh && !mk[key].vehicles.includes(x.base.veh)) mk[key].vehicles.push(x.base.veh);
    });
    const made = {};
    for (const key of Object.keys(mk)) {
      const ref = db().collection('parties').doc();
      await ref.set({ name: mk[key].name, phone: '', vehicles: mk[key].vehicles, bal: 0, createdAt: APP.FV.serverTimestamp() });
      const np = { id: ref.id, name: mk[key].name, vehicles: mk[key].vehicles };
      parties.push(np); made[key] = np;
    }
    pend.forEach((x, i) => {
      const p = picks[i] === '__new' ? made[nrmHi(x.nameRaw)] : (picks[i] ? byId(picks[i]) : null);
      if (!p) return;
      const hn = nrmHi(x.nameRaw), vv = nrmVeh(x.base.veh);
      if (hn && hn !== nrmHi('?')) alias.n[hn] = p.id;
      if (vv) alias.v[vv] = p.id;
      if (x.kind === 'udhar') {
        const dup = existing.some(r => r.kind === 'udhar' && r.partyId === p.id && nrmVeh(r.vehicle) === vv && Math.abs(num(r.amount) - x.base.amount) < 0.01);
        U.push(Object.assign({ p, dup }, x.base));
      } else {
        const dup = existing.some(r => r.kind === 'jama' && r.partyId === p.id && r.mode === x.base.mode && Math.abs(num(r.amount) - x.base.amount) < 0.01);
        J.push(Object.assign({ p, dup }, x.base));
      }
    });
    saveAlias();
    ['kharcha', 'driverInaam', 'chaiKhana'].forEach(k => {
      const ls = expL.filter(x => x.cat === k);
      if (ls.length) f['f-' + k] = K.r2(ls.reduce((a, x) => a + x.amount, 0));
    });
    const newExp = expL.filter(x => x.cat === 'other').map(x => ({ label: x.label, amount: x.amount }));
    const newU = U.filter(x => !x.dup), newJ = J.filter(x => !x.dup);

    if (switching) {
      try { APP.collectDraft(); } catch (e) { }
      await APP.dayView(date);
    }

    const fire = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    let filled = 0; const missing = [];
    const S_cur_locked = () => !!(APP.S.cur && APP.S.cur.locked);
    Object.keys(f).forEach(id => {
      const el = $('#' + id);
      if (!el || el.disabled) { missing.push(id); return; }
      el.value = f[id]; fire(el); filled++;
    });
    NZ.forEach(k => {
      const x = nz[k]; if (!x) return;
      const oEl = $(`.nzi[data-k="${k}"][data-f="o"]`), cEl = $(`.nzi[data-k="${k}"][data-f="c"]`);
      if (x.c !== null) { if (cEl && !cEl.disabled) { cEl.value = x.c; fire(cEl); filled++; } else missing.push(k + ' closing'); }
      if (x.o !== null && oEl && !oEl.disabled && clean(oEl.value) === '') { oEl.value = x.o; fire(oEl); filled++; }
    });
    if (newExp.length) {
      if (S_cur_locked()) missing.push('और खर्चे (लॉक)');
      else { try { APP.mergeExpItems(newExp); filled += newExp.length; } catch (e) { missing.push('और खर्चे'); } }
    }
    try { APP.recalc(); } catch (e) { }

    let wrote = 0; const failed = [];
    const by = APP.S.salesman ? APP.S.salesman.name : (APP.S.user ? APP.S.user.email : '');
    const writeEntry = async (data, delta, pid) => {
      const ref = db().collection('ledger').doc();
      const b = db().batch();
      b.set(ref, data);
      if (delta) b.update(db().collection('parties').doc(pid), { bal: APP.FV.increment(delta) });
      await b.commit();
    };
    for (const x of newU) {
      const data = { partyId: x.p.id, partyName: x.p.name, date, time: x.time || APP.nowTime(), kind: 'udhar', note: x.note, vehicle: x.veh, fuel: x.fuel, rate: x.rate, litre: x.litre, amount: x.amount, by, at: APP.FV.serverTimestamp() };
      try { await writeEntry(data, K.signed(data), x.p.id); wrote++; } catch (e) { failed.push(x.p.name + ' ' + x.veh + ': ' + e.message); }
    }
    for (const x of newJ) {
      const data = { partyId: x.p.id, partyName: x.p.name, date, time: x.time || APP.nowTime(), kind: 'jama', note: x.note, mode: x.mode, amount: x.amount, by, at: APP.FV.serverTimestamp() };
      try { await writeEntry(data, K.signed(data), x.p.id); wrote++; } catch (e) { failed.push(x.p.name + ': ' + e.message); }
    }

    try { APP.collectDraft(); } catch (e) { }
    if (wrote) { APP.S.parties = null; }
    try { await APP.dayView(date); } catch (e) { }

    const tail = [];
    if (missing.length) tail.push('नहीं भरे: ' + missing.join(', '));
    if (failed.length) tail.push('एंट्री फेल: ' + failed.join(' | '));
    if (tail.length) alert(tail.join('\n'));
    toast(`${filled} बॉक्स भरे · ${wrote} एंट्री जुड़ीं — अब 💾 सेव दबाएँ`);
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
