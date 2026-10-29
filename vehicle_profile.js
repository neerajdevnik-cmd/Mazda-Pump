/* Mazda Oil Company - Vehicle Profile & Search */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  APP.views = APP.views || {};

  function nrmVeh(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  APP.views.vehicle_search = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">वाहन खोज…</p>';

    let parties;
    try { parties = await APP.getParties(false, true); } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }

    const vehicles = [];
    parties.forEach(p => {
      (p.vehicles || []).forEach(v => {
        vehicles.push({ no: v, partyId: p.id, partyName: p.name, bal: num(p.bal) });
      });
    });
    vehicles.sort((a, b) => a.no.localeCompare(b.no));

    main.innerHTML =
      '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">🚗 गाड़ी प्रोफाइल</h3><div style="font-size:12px;opacity:.85;margin-top:4px">' + vehicles.length + ' गाड़ियाँ registered</div></div>' +
      '<div class="btns" style="margin-bottom:10px"><input id="vs-q" placeholder="गाड़ी नंबर खोजें…" style="flex:1;min-width:0"></div>' +
      '<div class="card" id="vs-list"></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';

    const draw = t => {
      const nv = nrmVeh(t || '');
      const list = vehicles.filter(v => !nv || nrmVeh(v.no).includes(nv));
      $('#vs-list').innerHTML = list.length ? list.slice(0, 100).map(v =>
        '<div class="item" style="cursor:pointer" data-vnum="' + esc(v.no) + '">' +
          '<div class="a"><b>🚗 ' + esc(v.no) + '</b><small>' + esc(v.partyName) + '</small></div>' +
          '<span class="chip ' + (v.bal > 0 ? 'r' : 'g') + '">' + money(v.bal) + '</span>' +
        '</div>'
      ).join('') : '<p class="mut">कोई गाड़ी नहीं मिली</p>';
      $$('[data-vnum]').forEach(el => el.onclick = () => showVehicle(el.dataset.vnum));
    };

    $('#vs-q').oninput = e => draw(e.target.value);
    draw('');

    async function showVehicle(vno) {
      const target = nrmVeh(vno);
      try {
        const snap = await db().collection('ledger').get();
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => nrmVeh(r.vehicle) === target);
        all.sort((a, b) => b.date.localeCompare(a.date));
        const totLit = all.reduce((a, r) => a + num(r.litre), 0);
        const totAmt = all.reduce((a, r) => a + num(r.amount), 0);
        const pids = [...new Set(all.map(r => r.partyId))];
        const parties = [];
        for (const pid of pids) {
          try {
            const p = await db().collection('parties').doc(pid).get();
            if (p.exists) parties.push({ id: pid, ...p.data() });
          } catch (e) {}
        }
        const visits = all.length;
        const avgVisit = visits > 0 ? totLit / visits : 0;

        const byFuel = {};
        all.forEach(r => { if (r.fuel) { byFuel[r.fuel] = (byFuel[r.fuel] || 0) + num(r.litre); } });

        let html = '<h3>🚗 ' + esc(vno) + '</h3>' +
          '<div class="kv"><span>कुल बार आई</span><b>' + visits + ' बार</b></div>' +
          '<div class="kv"><span>कुल तेल</span><b>' + lit(totLit) + '</b></div>' +
          '<div class="kv"><span>कुल रकम</span><b class="neg">' + money(totAmt) + '</b></div>' +
          '<div class="kv"><span>औसत per visit</span><b>' + lit(avgVisit) + '</b></div>' +
          (Object.keys(byFuel).length ? '<div class="kv"><span>ईंधन</span><b>' + Object.keys(byFuel).map(k => (k === 'petrol' ? '⛽' : '🛢️') + ' ' + lit(byFuel[k])).join(' · ') + '</b></div>' : '') +
          (parties.length ? '<div class="kv"><span>पार्टी</span><b>' + parties.map(p => esc(p.name)).join(', ') + '</b></div>' : '') +
          (parties[0] ? '<div class="btns" style="margin-top:10px"><button class="btn g" id="vp-go-party">पार्टी खोलें →</button></div>' : '') +
          '<div class="mut" style="margin-top:12px;font-size:12px">आखिरी 20 एंट्री:</div>';

        html += '<div style="max-height:300px;overflow-y:auto;margin-top:6px">';
        all.slice(0, 20).forEach(r => {
          html += '<div class="kv" style="padding:6px 0;font-size:13px;border-bottom:1px solid #f0f2f6"><span>' + dmy(r.date) + (r.time ? ' ' + r.time : '') + '</span><b>' + lit(r.litre) + ' · ' + money(r.amount) + '</b></div>';
        });
        html += '</div>';

        const m = modal(html + '<div class="btns" style="margin-top:12px"><button class="btn w" id="vp-close">बंद करें</button></div>');
        $('#vp-close', m).onclick = () => m.close();
        if ($('#vp-go-party', m) && parties[0]) $('#vp-go-party', m).onclick = () => { m.close(); APP.partyView(parties[0].id, false); };
      } catch (e) { toast('डेटा नहीं मिला: ' + e.message); }
    }
  };

  /* More menu button override */
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer() || S.role === 'salesman') return;
    if (document.querySelector('#vehicle-more-btn')) return;
    const main = $('#main'); if (!main) return;
    const card = main.querySelector('#extra-more-card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns && !card.querySelector('[data-nav="vehicle_search"]')) {
      const btn = document.createElement('button');
      btn.id = 'vehicle-more-btn';
      btn.className = 'btn w';
      btn.innerHTML = '🚗 गाड़ी प्रोफाइल';
      btn.onclick = () => APP.go('vehicle_search');
      btns.insertBefore(btn, btns.firstChild);
    }
  };

  console.log('[Mazda vehicle_profile.js] loaded ✓');
})();
