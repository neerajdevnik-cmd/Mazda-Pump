/* Mazda Oil Company - Runsheet Management (Manager Side) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();
  const isViewer = () => APP.isViewer && APP.isViewer();

  APP.views = APP.views || {};

  APP.views.runsheet = async function () {
    if (isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">रनशीट लोड हो रही है…</p>';

    let snap;
    try {
      snap = await db().collection('runsheets').where('date', '==', today()).get();
    } catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }

    const activeSheets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    let listHtml = activeSheets.length ? activeSheets.map(sheet => {
      const st = sheet.status === 'active' ? '<span class="chip g">चालू (Active)</span>' : '<span class="chip r">बंद</span>';
      const nzOpen = Object.keys(sheet.openings || {}).map(k => `${k.toUpperCase()}: ${sheet.openings[k]}`).join(' | ');
      return `
        <div class="card" style="margin-bottom:10px;padding:12px;">
          <div class="row" style="align-items:center;">
            <div style="flex:1">
              <b>${esc(sheet.salesmanName)}</b> ${st}
              <div class="mut" style="margin-top:4px;font-size:12px;">
                मीटर: ${sheet.nozzles.join(', ').toUpperCase()}
              </div>
              <div class="mut" style="font-size:12px;">
                ओपनिंग: ${nzOpen}
              </div>
              <div class="mut" style="font-size:12px;">
                शुरू: ${sheet.startTime || '-'}
              </div>
            </div>
            <div style="text-align:right;">
              ${sheet.status === 'active' ? `<button class="btn sm r" data-close="${sheet.id}">🛑 शिफ्ट बंद करें</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('') : '<p class="mut" style="text-align:center;">आज कोई रनशीट नहीं बनी है।</p>';

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff;">
        <h3 style="color:#fff;margin:0;">📋 रनशीट (Salesman Duty)</h3>
        <div style="font-size:12px;opacity:.85;margin-top:4px;">सेल्समैन को मीटर अलॉट करें और ओपनिंग डालें</div>
      </div>
      
      <div id="rs-list">${listHtml}</div>

      <div class="btns" style="margin-top:12px;">
        <button class="btn o" id="rs-add">+ नई रनशीट बनाएं</button>
        <button class="btn w" onclick="APP.go('more')">← वापस</button>
      </div>
    `;

    if ($('#rs-add')) $('#rs-add').onclick = () => createRunsheetModal();

    $$('[data-close]').forEach(b => b.onclick = async () => {
      if (!confirm('क्या आप इस शिफ्ट को बंद करना चाहते हैं? सेल्समैन अपना हिसाब जमा कर सकेगा।')) return;
      try {
        await db().collection('runsheets').doc(b.dataset.close).update({ status: 'closed', endTime: APP.nowTime() });
        toast('शिफ्ट बंद हो गई ✔'); APP.views.runsheet();
      } catch (e) { toast('एरर: ' + e.message); }
    });
  };

  function createRunsheetModal() {
    const salesmen = C.salesmen || [];
    const nzKeys = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];

    const m = modal(`
      <h3>नई रनशीट बनाएं</h3>
      <label>सेल्समैन चुनें</label>
      <select id="rs-sm">
        ${salesmen.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
      
      <label style="margin-top:10px;">मीटर चुनें और ओपनिंग रीडिंग डालें</label>
      <div id="rs-nz-grid" style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:6px;">
        ${nzKeys.map(k => `
          <div class="row" style="align-items:center;background:#f4f6fa;padding:6px 10px;border-radius:8px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:14px;flex:1;cursor:pointer;margin:0;">
              <input type="checkbox" class="rs-nz-check" value="${k}" style="width:auto;"> <b>${k.toUpperCase()}</b>
            </label>
            <input type="number" id="rs-open-${k}" class="rs-nz-open" placeholder="ओपनिंग" disabled style="width:100px;padding:6px;font-size:14px;margin:0;">
          </div>
        `).join('')}
      </div>

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="rs-save">▶ शिफ्ट शुरू करें</button>
        <button class="btn w" id="rs-cancel">रद्द</button>
      </div>
    `);

    // Checkbox toggle logic
    $$('.rs-nz-check', m).forEach(chk => {
      chk.onchange = () => {
        const inp = $(`#rs-open-${chk.value}`, m);
        inp.disabled = !chk.checked;
        if (!chk.checked) inp.value = '';
        else inp.focus();
      };
    });

    $('#rs-cancel', m).onclick = () => m.close();

    $('#rs-save', m).onclick = async () => {
      const sid = $('#rs-sm', m).value;
      const smObj = salesmen.find(x => x.id === sid);
      
      const selectedNz = [];
      const openings = {};
      let missingOpen = false;

      $$('.rs-nz-check:checked', m).forEach(chk => {
        const k = chk.value;
        const val = $(`#rs-open-${k}`, m).value;
        if (val === '') { missingOpen = true; return; }
        selectedNz.push(k);
        openings[k] = num(val);
      });

      if (!selectedNz.length) return toast('कम से कम एक मीटर चुनें');
      if (missingOpen) return toast('चुने गए सभी मीटर की ओपनिंग रीडिंग डालें');

      // चेक करें कि ये मीटर पहले से किसी और के पास तो नहीं हैं
      const snap = await db().collection('runsheets').where('date', '==', today()).where('status', '==', 'active').get();
      const activeNz = [];
      snap.docs.forEach(d => { activeNz.push(...d.data().nozzles); });

      const conflict = selectedNz.filter(n => activeNz.includes(n));
      if (conflict.length) return toast('ये मीटर पहले से चालू हैं: ' + conflict.join(', ').toUpperCase());

      try {
        await db().collection('runsheets').add({
          date: today(),
          sid: sid,
          salesmanName: smObj.name,
          nozzles: selectedNz,
          openings: openings,
          status: 'active',
          startTime: APP.nowTime(),
          createdAt: APP.FV.serverTimestamp(),
          createdBy: S.user ? S.user.email : 'manager'
        });
        m.close();
        toast('रनशीट शुरू हो गई ✔');
        APP.views.runsheet();
      } catch (e) { toast('एरर: ' + e.message); }
    };
  }

  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer() || S.role === 'salesman') return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#runsheet-more-btn')) return;

    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btn = document.createElement('button');
      btn.id = 'runsheet-more-btn';
      btn.className = 'btn w';
      btn.innerHTML = '📋 रनशीट (Salesman Duty)';
      btn.onclick = () => APP.go('runsheet');
      btns.insertBefore(btn, btns.firstChild);
    }
  };
  console.log('[Mazda runsheet.js] loaded ✓');
})();
