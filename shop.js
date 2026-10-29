/* Mazda Oil Company - Shop Inventory with Product Images */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const isViewer = () => APP.isViewer && APP.isViewer();

  APP.views = APP.views || {};

  // Compress image to max 220px, JPEG 0.75
  function compressImg(file, maxPx, q) {
    maxPx = maxPx || 220; q = q || 0.75;
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxPx / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc);
        cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('फोटो नहीं खुली')); };
      img.src = url;
    });
  }

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
      
      const photoHtml = it.photo 
        ? '<img src="' + esc(it.photo) + '" alt="" style="width:64px;height:64px;border-radius:10px;object-fit:cover;border:2px solid #e0e5ef;flex:none;">'
        : '<div style="width:64px;height:64px;border-radius:10px;background:linear-gradient(135deg,#e8eefc,#d4dff7);display:flex;align-items:center;justify-content:center;font-size:26px;flex:none;">🛢️</div>';

      return '<div class="card" style="margin-bottom:8px;padding:10px;">' +
        '<div style="display:flex;gap:10px;align-items:flex-start;">' +
          photoHtml +
          '<div style="flex:1;min-width:0;">' +
            '<b style="font-size:15px;color:var(--b);display:block;">' + esc(it.name) + '</b>' +
            '<div class="mut" style="margin-top:4px;">रेट: <b>' + money(rate) + '</b></div>' +
            (val > 0 ? '<div class="mut" style="font-size:11px;margin-top:2px;">कुल: ' + money(val) + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;flex:none;">' +
            '<div class="chip ' + (stock < 5 ? 'r' : 'g') + '" style="font-size:13px;padding:5px 10px;">' + stock + ' पीस</div>' +
            (!isViewer() ? '<div style="margin-top:6px;"><button class="btn sm w" data-edit="' + it.id + '" style="font-size:12px;padding:5px 8px;">✏️ बदलें</button></div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    main.innerHTML = 
      '<div class="card" style="background:#0b3d91;color:#fff;">' +
        '<h3 style="color:#fff;margin:0 0 6px;">🛍️ माज़दा शॉप (स्टॉक)</h3>' +
        '<div style="font-size:12px;opacity:.85;">मोबिल, DEF यूरिया, इंजन ऑयल आदि</div>' +
      '</div>' +
      '<div class="card" style="background:#f8f9fc;border:1px solid #dde2ec;">' +
        '<div class="row">' +
          '<div>' +
            '<div class="mut">कुल पीस</div>' +
            '<b style="font-size:18px;">' + totalItems + '</b>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div class="mut">कुल कीमत (स्टॉक की)</div>' +
            '<b style="font-size:18px;color:var(--g);">' + money(totalValue) + '</b>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="shop-list">' + (items.length ? cardsHtml : '<p class="mut" style="text-align:center;padding:20px;">दुकान में अभी कोई सामान नहीं है।</p>') + '</div>' +
      (!isViewer() ? 
        '<div class="btns" style="margin-top:12px;">' +
          '<button class="btn g" id="shop-add">+ नया सामान जोड़ें</button>' +
          '<button class="btn w" onclick="APP.go(\'more\')">← वापस</button>' +
        '</div>' : 
        '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>');

    if (!isViewer()) {
      $('#shop-add').onclick = () => shopModal(null);
      $$('[data-edit]').forEach(b => b.onclick = () => shopModal(items.find(x => x.id === b.dataset.edit)));
    }
  };

  function shopModal(it) {
    if (isViewer()) return toast('केवल देखें');
    const e = it || null;
    let photoData = (e && e.photo) || '';
    
    const initialPhoto = photoData 
      ? '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:14px;object-fit:cover;border:2px solid #c5d2ee;">'
      : '<div style="width:100px;height:100px;border-radius:14px;background:linear-gradient(135deg,#e8eefc,#d4dff7);display:inline-flex;align-items:center;justify-content:center;font-size:40px;">🛢️</div>';
    
    const m = modal(
      '<h3>' + (e ? 'सामान बदलें' : 'नया सामान जोड़ें') + '</h3>' +
      '<div style="text-align:center;padding:8px 0;" id="sh-photo-box">' + initialPhoto + '</div>' +
      '<div style="text-align:center;margin-bottom:8px;">' +
        '<label class="btn sm w" style="cursor:pointer;display:inline-block;">' +
          '📷 ' + (photoData ? 'फोटो बदलें' : 'फोटो जोड़ें') +
          '<input type="file" accept="image/*" id="sh-photo" style="display:none;">' +
        '</label>' +
      '</div>' +
      '<label>सामान का नाम (जैसे: Mobil 1L, DEF 5L)</label>' +
      '<input id="sh-name" value="' + esc(e ? e.name : '') + '">' +
      '<label>रेट (₹)</label>' +
      '<input id="sh-rate" inputmode="decimal" value="' + esc(e ? e.rate : '') + '">' +
      '<label>स्टॉक (पीस)</label>' +
      '<input id="sh-stock" inputmode="numeric" value="' + esc(e ? e.stock : '') + '">' +
      '<div class="btns" style="margin-top:12px;">' +
        '<button class="btn g" id="sh-save">💾 सेव</button>' +
        (e ? '<button class="btn r" id="sh-del">🗑 हटाएँ</button>' : '') +
        '<button class="btn w" id="sh-cancel">रद्द</button>' +
      '</div>'
    );

    $('#sh-photo', m).onchange = async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        photoData = await compressImg(f, 220, 0.75);
        $('#sh-photo-box', m).innerHTML = '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:14px;object-fit:cover;border:2px solid #c5d2ee;">';
        toast('फोटो तैयार ✔');
      } catch (err) { toast('फोटो नहीं बनी: ' + err.message); }
    };

    $('#sh-cancel', m).onclick = () => m.close();

    $('#sh-save', m).onclick = async () => {
      const name = $('#sh-name', m).value.trim();
      const rate = num($('#sh-rate', m).value);
      const stock = num($('#sh-stock', m).value);
      if (!name) return toast('नाम लिखें');

      const data = { name: name, rate: rate, stock: stock, photo: photoData, updatedAt: APP.FV.serverTimestamp() };
      try {
        if (e) await db().collection('shop').doc(e.id).update(data);
        else await db().collection('shop').add(Object.assign({ createdAt: APP.FV.serverTimestamp() }, data));
        APP.audit('shop_save', { name: name, rate: rate, stock: stock, was: e ? { rate: e.rate, stock: e.stock } : null });
        m.close(); toast('सेव ✔'); APP.views.shop();
      } catch (err) { toast('सेव नहीं हुआ: ' + err.message); }
    };

    if (e) {
      $('#sh-del', m).onclick = async () => {
        if (!confirm('"' + e.name + '" को दुकान से हटाएँ?\n\nस्टॉक: ' + e.stock + ' पीस · रेट: ₹' + e.rate)) return;
        try {
          await db().collection('shop').doc(e.id).delete();
          APP.audit('shop_delete', { name: e.name, stock: e.stock });
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

  console.log('[Mazda shop.js] loaded with images ✓');
})();
