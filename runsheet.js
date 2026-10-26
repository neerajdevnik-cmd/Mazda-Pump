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
  const isOwner = () => APP.isOwner && APP.isOwner();
  const isManager = () => S.role === 'manager';

  APP.views = APP.views || {};

  // मैनेजर के लिए रनशीट पेज
  APP.views.runsheet = async function () {
    if (isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">रनशीट लोड हो रही है…</p>';

    // आज की रनशीट चेक करो
    let snap;
    try {
      snap = await db().collection('runsheets').where('date', '==', today()).get();
    } catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }

    const activeSheets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    let listHtml = activeSheets.length ? activeSheets.map(sheet => {
      const st = sheet.status === 'active' ? '<span class="chip g">चालू (Active)</span>' : '<span class="chip r">बंद</span>';
      return `
        <div class="card" style="margin-bottom:10px;padding:12px;">
          <div class="row" style="align-items:center;">
            <div style="flex:1">
              <b>${esc(sheet.salesmanName)}</b> ${st}
              <div class="mut" style="margin-top:4px;font-size:12px;">
                मीटर: ${sheet.nozzles.join(', ').toUpperCase()}
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
        <div style="font-size:12px;opacity:.85;margin-top:4px;">सेल्समैन को मीटर अलॉट करें</div>
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
      
      <label style="margin-top:10px;">मीटर अलॉट करें (एक या ज्यादा चुनें)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:6px;">
        ${nzKeys.map(k => `
          <label style="display:flex;align-items:center;gap:4px;font-size:14px;background:#f4f6fa;padding:6px;border-radius:6px;cursor:pointer;">
            <input type="checkbox" class="rs-nz" value="${k}" style="width:auto;"> ${k.toUpperCase()}
          </label>
        `).join('')}
      </div>

      <div class="btns" style="margin-top:16px;">
        <button class="btn g" id="rs-save">▶ शिफ्ट शुरू करें</button>
        <button class="btn w" id="rs-cancel">रद्द</button>
      </div>
    `);

    $('#rs-cancel', m).onclick = () => m.close();

    $('#rs-save', m).onclick = async () => {
      const sid = $('#rs-sm', m).value;
      const smObj = salesmen.find(x => x.id === sid);
      const selectedNz = $$('.rs-nz:checked', m).map(el => el.value);

      if (!selectedNz.length) return toast('कम से कम एक मीटर चुनें');

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

  // 'More' टैब में रनशीट का बटन जोड़ना
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer() || S.role === 'salesman') return;
    const main = $('#main'); if (!main) return;
    
    // अगर बटन पहले से है तो दोबारा मत जोड़ो
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
