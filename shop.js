/* Mazda Oil Company - Shop Inventory (Mobil, DEF, Engine Oil) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const isViewer = () => APP.isViewer && APP.isViewer();

  APP.views = APP.views || {};

  APP.views.shop = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">दुकान का स्टॉक लोड हो रहा है…</p>';

    let snap;
    try { snap = await db().collection('shop').get(); } 
    catch (e) { main.innerHTML = '<div class="err">' + e.message + '</div>'; return; }

    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let totalValue = 0;
    let totalItems = 0;

    const cardsHtml = items.map(it => {
      const stock = num(it.stock);
      const rate = num(it.rate);
      const val = stock * rate;
      totalValue += val;
      totalItems += stock;

      return `
        <div class="card" style="margin-bottom:8px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <b style="font-size:15px;color:var(--b);">${esc(it.name)}</b>
              <div class="mut" style="margin-top:4px;">रेट: <b>${money(rate)}</b></div>
            </div>
            <div style="text-align:right;">
              <div class="chip ${stock < 5 ? 'r' : 'g'}" style="font-size:14px;padding:6px 12px;">${stock} पीस</div>
              ${(!isViewer()) ? `<button class="btn sm w" style="margin-top:6px;" data-edit="${it.id}">✏️ बदलें</button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    main.innerHTML = `
      <div class="card" style="background:#0b3d91;color:#fff;">
        <h3 style="color:#fff;margin:0 0 6px;">🛍️ माज़दा शॉप (स्टॉक)</h3>
        <div style="font-size:12px;opacity:.85;">मोबिल, DEF यूरिया, इंजन ऑयल आदि</div>
      </div>
      
      <div class="card" style="background:#f8f9fc;border:1px solid #dde2ec;">
        <div class="row">
          <div>
            <div class="mut">कुल पीस</div>
            <b style="font-size:18px;">${totalItems}</b>
          </div>
          <div style="text-align:right;">
            <div class="mut">कुल कीमत (स्टॉक की)</div>
            <b style="font-size:18px;color:var(--g);">${money(totalValue)}</b>
          </div>
        </div>
      </div>

      <div id="shop-list">${items.length ? cardsHtml : '<p class="mut" style="text-align:center;padding:20px;">दुकान में अभी कोई सामान नहीं है।</p>'}</div>

      ${(!isViewer()) ? `
      <div class="btns" style="margin-top:12px;">
        <button class="btn g" id="shop-add">+ नया सामान जोड़ें</button>
        <button class="btn w" onclick="APP.go('more')">← वापस</button>
      </div>` : '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>'}
    `;

    if (!isViewer()) {
      $('#shop-add').onclick = () => shopModal(null);
      $$('[data-edit]').forEach(b => b.onclick = () => shopModal(items.find(x => x.id === b.dataset.edit)));
    }
  };

  function shopModal(it) {
    if (isViewer()) return toast('केवल देखें');
    const e = it || null;
    const m = modal(`
      <h3>${e ? 'सामान बदलें' : 'नया सामान जोड़ें'}</h3>
      <label>सामान का नाम (जैसे: Mobil 1L, DEF 5L)</label>
      <input id="sh-name" value="${esc(e ? e.name : '')}">
      <label>रेट (₹)</label>
      <input id="sh-rate" inputmode="decimal" value="${esc(e ? e.rate : '')}">
      <label>स्टॉक (पीस)</label>
      <input id="sh-stock" inputmode="numeric" value="${esc(e ? e.stock : '')}">
      <div class="btns" style="margin-top:12px;">
        <button class="btn g" id="sh-save">💾 सेव</button>
        ${e ? '<button class="btn r" id="sh-del">🗑 हटाएँ</button>' : ''}
        <button class="btn w" id="sh-cancel">रद्द</button>
      </div>
    `);

    $('#sh-cancel', m).onclick = () => m.close();

    $('#sh-save', m).onclick = async () => {
      const name = $('#sh-name', m).value.trim();
      const rate = num($('#sh-rate', m).value);
      const stock = num($('#sh-stock', m).value);
      if (!name) return toast('नाम लिखें');

      const data = { name, rate, stock, updatedAt: APP.FV.serverTimestamp() };
      try {
        if (e) await db().collection('shop').doc(e.id).update(data);
        else await db().collection('shop').add(Object.assign({ createdAt: APP.FV.serverTimestamp() }, data));
        m.close(); toast('सेव ✔'); APP.views.shop();
      } catch (err) { toast('सेव नहीं हुआ: ' + err.message); }
    };

    if (e) {
      $('#sh-del', m).onclick = async () => {
        if (!confirm('इस सामान को हटाएँ?')) return;
        try {
          await db().collection('shop').doc(e.id).delete();
          m.close(); toast('हट गया ✔'); APP.views.shop();
        } catch (err) { toast('नहीं हटा: ' + err.message); }
      };
    }
  }

  // 'More' टैब में शॉप का बटन जोड़ना
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#shop-more-btn')) return;

    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btn = document.createElement('button');
      btn.id = 'shop-more-btn';
      btn.className = 'btn w';
      btn.innerHTML = '🛍️ दुकान (शॉप स्टॉक)';
      btn.onclick = () => APP.go('shop');
      btns.insertBefore(btn, btns.firstChild);
    }
  };

  console.log('[Mazda shop.js] loaded ✓');
})();
