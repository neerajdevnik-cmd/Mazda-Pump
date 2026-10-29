/* Mazda Oil Company - Tanker Report (Separate Module with History & Analytics) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  APP.views = APP.views || {};

  async function getReport(id) {
    if (!id) return null;
    const s = await db().collection('tanker_reports').doc(id).get();
    return s.exists ? { id: s.id, ...s.data() } : null;
  }

  APP.views.tanker_report = async function (mode) {
    mode = mode || 'list';
    if (APP.isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    
    if (mode === 'list') {
      main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
      let snap;
      try { snap = await db().collection('tanker_reports').orderBy('date', 'desc').limit(50).get(); }
      catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }
      
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      let listHtml = list.map(r => {
        const pDiff = r.result ? r.result.diffP : null;
        const dDiff = r.result ? r.result.diffD : null;
        
        const badge = (diff) => {
          if (diff === null) return '<span class="chip w">?</span>';
          if (Math.abs(diff) <= 0.5) return '<span class="chip g">✔ OK</span>';
          if (diff > 0) return `<span class="chip o">+${r2(diff)} L</span>`;
          return `<span class="chip r">${r2(diff)} L</span>`;
        };

        return `
          <div class="card" style="margin-bottom:10px;padding:12px;" data-rs-id="${r.id}">
            <div class="row" style="align-items:center;">
              <div style="flex:1">
                <b>${dmy(r.date)} <span style="font-size:12px;color:#666;font-weight:normal;">(${r.startTime || '?'} - ${r.endTime || '?'})</span></b>
                <div class="mut" style="font-size:12px;">टैंकर: ${esc(r.tankerNo || '?')} | ड्राइवर: ${esc(r.driverName || '?')}</div>
                <div class="row" style="margin-top:6px; gap:6px;">
                  <span style="font-size:12px;color:#555;">पेट्रोल: <b>${badge(pDiff)}</b></span>
                  <span style="font-size:12px;color:#555;">डीज़ल: <b>${badge(dDiff)}</b></span>
                </div>
              </div>
              <div>
                <button class="btn sm w" data-view="${r.id}">देखें</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      main.innerHTML = `
        <div class="card" style="background:#0b3d91;color:#fff;">
          <div class="row" style="align-items:center;">
            <div style="flex:1">
              <h3 style="color:#fff;margin:0;">🚛 टैंकर रिपोर्ट</h3>
              <div style="font-size:12px;opacity:.85;margin-top:4px;">तेल सही मात्रा में आया या नहीं</div>
            </div>
            <div style="flex:0 0 auto;">
              <button class="btn sm o" id="tr-add-new">+ नई रिपोर्ट</button>
            </div>
          </div>
        </div>
        ${listHtml || '<p class="mut" style="text-align:center;padding:20px;">कोई रिपोर्ट नहीं मिली</p>'}
      `;
      
      $('#tr-add-new').onclick = () => APP.views.tanker_report('new');
      $$('[data-view]').forEach(b => b.onclick = () => openViewModal(b.dataset.view));
      
    } else if (mode === 'new') {
      openAddModal();
    }
  };

  async function openViewModal(id) {
    const r = await getReport(id);
    if (!r) return toast('रिपोर्ट नहीं मिली');
    
    const buildFuel = (name, pre, res) => {
      if (!res) return '';
      let rows = ['p1','p2','p3','p4'].map(k => `<tr><td>${k.toUpperCase()}</td><td>${r.before.nz[k]}</td><td>${r.after.nz[k]}</td></tr>`).join('');
      if (pre === 'D') rows = ['d1','d2','d3','d4'].map(k => `<tr><td>${k.toUpperCase()}</td><td>${r.before.nz[k]}</td><td>${r.after.nz[k]}</td></tr>`).join('');
      
      return `
        <div class="card" style="margin-bottom:8px;padding:10px; border-left:4px solid #0b3d91;">
          <h4 style="margin:0 0 6px; color:#0b3d91;">${name} का हिसाब</h4>
          <table style="width:100%; font-size:12px; margin-bottom:8px;">
            <tr style="background:#f4f6fa"><th>नोज़ल</th><th>Before</th><th>After</th></tr>
            ${rows}
          </table>
          <div class="kv" style="padding:4px 0;"><span>मीटर से बिक्री</span><b>${lit(res.sale)}</b></div>
          <div class="kv" style="padding:4px 0;"><span>पहले Dip</span><b>${lit(r.before['dip'+pre])}</b></div>
          <div class="kv" style="padding:4px 0;"><span>+ टैंकर आया</span><b>${lit(r.received[pre.toLowerCase()])}</b></div>
          <div class="kv" style="padding:4px 0;"><span>= होना चाहिए</span><b>${lit(res.expected)}</b></div>
          <div class="kv" style="padding:4px 0;"><span>बाद में Dip (असली)</span><b>${lit(r.after['dip'+pre])}</b></div>
          <div class="kv" style="padding:6px 0; border-top:2px solid #eee; border-bottom:0;"><span style="font-weight:bold;">फर्क (Frak)</span>
            <b class="${res.diff > 0 ? 'pos' : (res.diff < 0 ? 'neg' : '')}" style="font-size:16px;">${res.diff > 0 ? '+' : ''}${r2(res.diff)} L</b>
          </div>
        </div>
      `;
    };

    const m = modal(`
      <h3>🚛 टैंकर रिपोर्ट</h3>
      <div class="mut" style="margin-bottom:12px;">${dmy(r.date)} | ${r.startTime} - ${r.endTime} | ${esc(r.tankerNo||'')} | ${esc(r.driverName||'')}</div>
      ${buildFuel('पेट्रोल', 'P', r.result.petrol)}
      ${buildFuel('डीज़ल', 'D', r.result.diesel)}
      
      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="tr-share">📤 WhatsApp भेजें</button>
        <button class="btn w" id="tr-close">बंद करें</button>
      </div>
    `);
    
    $('#tr-close', m).onclick = () => m.close();
    $('#tr-share', m).onclick = () => {
      const pDiff = r.result.petrol ? r.result.petrol.diff : 0;
      const dDiff = r.result.diesel ? r.result.diesel.diff : 0;
      const text = `*माज़दा ऑयल कंपनी*\n*टैंकर रिपोर्ट*\n\n📅 तारीख: ${dmy(r.date)}\n🕒 समय: ${r.startTime} - ${r.endTime}\n🚛 टैंकर: ${r.tankerNo||'-'}\n👤 ड्राइवर: ${r.driverName||'-'}\n\n⛽ *पेट्रोल*\nटैंकर आया: ${lit(r.received.p)}\nमीटर बिक्री: ${lit(r.result.petrol.sale)}\nअसली Dip फर्क: *${pDiff > 0 ? '+' : ''}${r2(pDiff)} L*\n\n🛢️ *डीज़ल*\nटैंकर आया: ${lit(r.received.d)}\nमीटर बिक्री: ${lit(r.result.diesel.sale)}\nअसली Dip फर्क: *${dDiff > 0 ? '+' : ''}${r2(dDiff)} L*`;
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    };
  }

  async function openAddModal() {
    const date = today();
    let dayData = null;
    try {
      const ds = await db().collection('days').doc(date).get();
      if (ds.exists) dayData = ds.data();
    } catch(e) {}

    const m = modal(`
      <h3>नई टैंकर रिपोर्ट</h3>
      <p class="mut" style="font-size:12px;margin-bottom:10px;">टैंकर unloading से पहले और बाद का मीटर व डिप भरें।</p>
      
      <div class="row">
        <div><label>तारीख</label><input type="date" id="tr-date" value="${date}"></div>
        <div><label>टैंकर नंबर</label><input id="tr-no" placeholder="UK01AB1234" style="text-transform:uppercase"></div>
      </div>
      <div class="row" style="margin-top:8px;">
        <div><label>ड्राइवर का नाम</label><input id="tr-driver" placeholder="Driver ka naam"></div>
      </div>
      <div class="row">
        <div><label>Start Time</label><input type="time" id="tr-st" value="${APP.nowTime()}"></div>
        <div><label>End Time</label><input type="time" id="tr-et" value="${APP.nowTime()}"></div>
      </div>
      
      <div class="mut" style="margin-top:10px; font-weight:bold; color:#0b3d91;">1. अनलोडिंग से पहले (BEFORE)</div>
      <div class="row">
        <div><label>Petrol Dip</label><input id="tr-bdipP" inputmode="decimal"></div>
        <div><label>Diesel Dip</label><input id="tr-bdipD" inputmode="decimal"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:4px;">
        <div><label style="font-size:10px;margin:0">P1</label><input id="tr-bo-p1" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">P2</label><input id="tr-bo-p2" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">P3</label><input id="tr-bo-p3" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">P4</label><input id="tr-bo-p4" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D1</label><input id="tr-bo-d1" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D2</label><input id="tr-bo-d2" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D3</label><input id="tr-bo-d3" class="tr-bo" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D4</label><input id="tr-bo-d4" class="tr-bo" inputmode="decimal"></div>
      </div>

      <div class="mut" style="margin-top:10px; font-weight:bold; color:#0b3d91;">2. अनलोडिंग के बाद (AFTER)</div>
      <div class="row">
        <div><label>Petrol Dip</label><input id="tr-adipP" inputmode="decimal"></div>
        <div><label>Diesel Dip</label><input id="tr-adipD" inputmode="decimal"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:4px;">
        <div><label style="font-size:10px;margin:0">P1</label><input id="tr-ao-p1" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">P2</label><input id="tr-ao-p2" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">P3</label><input id="tr-ao-p3" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">P4</label><input id="tr-ao-p4" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D1</label><input id="tr-ao-d1" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D2</label><input id="tr-ao-d2" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D3</label><input id="tr-ao-d3" class="tr-ao" inputmode="decimal"></div>
        <div><label style="font-size:10px;margin:0">D4</label><input id="tr-ao-d4" class="tr-ao" inputmode="decimal"></div>
      </div>

      <div class="mut" style="margin-top:10px; font-weight:bold; color:#0b3d91;">3. टैंकर में तेल आया</div>
      <div class="row">
        <div><label>Petrol (L)</label><input id="tr-recP" inputmode="decimal"></div>
        <div><label>Diesel (L)</label><input id="tr-recD" inputmode="decimal"></div>
      </div>

      <div id="tr-preview" style="margin-top:12px;"></div>

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="tr-save">💾 सेव करें</button>
        <button class="btn w" id="tr-cancel">रद्द</button>
      </div>
    `);

    const q = id => $('#' + id, m);
    const gv = id => num(q(id).value);

    if (dayData) {
      const autofill = document.createElement('div');
      autofill.innerHTML = `<button class="btn sm w" id="tr-auto" style="margin-top:8px;width:100%;">📥 आज के हिसाब से डेटा भरें</button>`;
      q('tr-no').after(autofill);
      $('#tr-auto', m).onclick = () => {
        if (dayData.dipP) q('tr-adipP').value = dayData.dipP;
        if (dayData.dipD) q('tr-adipD').value = dayData.dipD;
        if (dayData.tankerP) q('tr-recP').value = dayData.tankerP;
        if (dayData.tankerD) q('tr-recD').value = dayData.tankerD;
        if (dayData.nz) {
          ['p1','p2','p3','p4','d1','d2','d3','d4'].forEach(k => {
            if (dayData.nz[k] && dayData.nz[k].c) q('tr-ao-'+k).value = dayData.nz[k].c;
          });
        }
        calc();
        toast('हिसाब से भर गया ✔');
      };
    }

    const calc = () => {
      const calcFuel = (pre, recKey) => {
        const before = {}, after = {};
        let sale = 0;
        ['1','2','3','4'].forEach(n => {
          const k = pre.toLowerCase() + n;
          before[k] = gv('tr-bo-'+k);
          after[k] = gv('tr-ao-'+k);
          if (after[k] > before[k]) sale += (after[k] - before[k]);
        });
        sale = Math.max(0, sale - 5);
        const dipB = gv('tr-bdip'+pre);
        const dipA = gv('tr-adip'+pre);
        const rec = gv('tr-rec'+pre);
        if (!dipB || !dipA || !rec) return null;
        const exp = dipB + rec - sale;
        const diff = dipA - exp;
        return { sale: r2(sale), expected: r2(exp), diff: r2(diff) };
      };
      
      const p = calcFuel('P', 'tr-recP');
      const d = calcFuel('D', 'tr-recD');
      
      const draw = (name, res) => {
        if (!res) return '';
        return `<div class="kv"><span>${name} फर्क</span><b class="${res.diff > 0 ? 'pos' : (res.diff < 0 ? 'neg' : '')}">${res.diff > 0 ? '+' : ''}${res.diff} L</b></div>`;
      };

      q('tr-preview').innerHTML = `<div style="background:#f4f6fa;border-radius:8px;padding:10px;">
        <b style="display:block;margin-bottom:4px;">अनुमानित फर्क:</b>
        ${draw('पेट्रोल', p)}
        ${draw('डीज़ल', d)}
      </div>`;
    };

    $$('input', m).forEach(i => i.addEventListener('input', calc));

    q('tr-cancel').onclick = () => m.close();
    
    q('tr-save').onclick = async () => {
      const dStr = q('tr-date').value;
      if (!dStr) return toast('तारीख चुनें');
      
      const before = { nz: {}, dipP: gv('tr-bdipP'), dipD: gv('tr-bdipD') };
      const after = { nz: {}, dipP: gv('tr-adipP'), dipD: gv('tr-adipD') };
      ['p1','p2','p3','p4','d1','d2','d3','d4'].forEach(k => {
        before.nz[k] = gv('tr-bo-'+k);
        after.nz[k] = gv('tr-ao-'+k);
      });
      const received = { p: gv('tr-recP'), d: gv('tr-recD') };
      
      const calcFuel = (pre) => {
        let sale = 0;
        ['p1','p2','p3','p4','d1','d2','d3','d4'].filter(k=>k.startsWith(pre.toLowerCase())).forEach(k => {
          if (after.nz[k] > before.nz[k]) sale += (after.nz[k] - before.nz[k]);
        });
        sale = Math.max(0, sale - 5);
        const exp = before['dip'+pre] + received[pre.toLowerCase()] - sale;
        return { sale: r2(sale), expected: r2(exp), diff: r2(after['dip'+pre] - exp) };
      };

      const result = { petrol: calcFuel('P'), diesel: calcFuel('D') };
      
      const btn = q('tr-save'); btn.disabled = true; btn.textContent = 'सेव हो रहा है...';
      
      try {
        await db().collection('tanker_reports').add({
          date: dStr,
          tankerNo: q('tr-no').value.trim().toUpperCase(),
          driverName: q('tr-driver').value.trim(),
          startTime: q('tr-st').value,
          endTime: q('tr-et').value,
          before, after, received, result,
          createdAt: APP.FV.serverTimestamp(),
          createdBy: S.user ? S.user.email : 'Manager'
        });
        
        try {
          const dayRef = db().collection('days').doc(dStr);
          const daySnap = await dayRef.get();
          if (daySnap.exists) {
            await dayRef.update({
              tankerP: received.p,
              tankerD: received.d
            });
          }
        } catch(e) { console.log('Day auto update failed', e); }

        APP.audit('tanker_report_add', { date: dStr, tankerNo: q('tr-no').value, pDiff: result.petrol.diff, dDiff: result.diesel.diff });
        
        m.close(); toast('सेव हो गया ✔'); APP.views.tanker_report('list');
      } catch (e) {
        btn.disabled = false; btn.textContent = '💾 सेव करें';
        toast('सेव नहीं हुआ: ' + e.message);
      }
    };
  }

  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer() || S.role === 'salesman') return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#tanker-more-btn')) return;

    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btn = document.createElement('button');
      btn.id = 'tanker-more-btn';
      btn.className = 'btn w';
      btn.innerHTML = '🚛 टैंकर रिपोर्ट';
      btn.onclick = () => APP.go('tanker_report');
      btns.insertBefore(btn, btns.firstChild);
    }
  };
  
  console.log('[Mazda tanker_report.js] loaded ✓');
})();
