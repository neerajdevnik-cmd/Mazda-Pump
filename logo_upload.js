/* =========================================================================
   लोगो अपलोड — एक फ़ाइल डालो, सारे लोगो अपनी-अपनी जगह पर अपने-आप
   login (गोल) · header (छोटा) · bill (चौकोर) · banner (चौड़ा) ·
   favicon · apple (iPhone होम) · icon192 · icon512 (Android होम)
   सेव: pumps/<id>/logos/<slot>  (हर slot अलग document, 1MB के अंदर)
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP, PS = window.PUMP_SYSTEM;
  if (!APP || !PS) return;

  const SLOTS = [
    { key: 'login',   w: 256, h: 256, shape: 'circle', type: 'image/png',  label: 'लॉगिन (गोल)' },
    { key: 'header',  w: 256, h: 256, shape: 'square', type: 'image/png',  label: 'ऊपर का छोटा' },
    { key: 'bill',    w: 512, h: 512, shape: 'square', type: 'image/jpeg', label: 'बिल/प्रिंट' },
    { key: 'banner',  w: 1200, h: 400, shape: 'banner', type: 'image/jpeg', label: 'बैनर' },
    { key: 'favicon', w: 64,  h: 64,  shape: 'square', type: 'image/png',  label: 'ब्राउज़र टैब' },
    { key: 'apple',   w: 180, h: 180, shape: 'square', type: 'image/png',  label: 'iPhone होम' },
    { key: 'icon192', w: 192, h: 192, shape: 'square', type: 'image/png',  label: 'Android होम (192)' },
    { key: 'icon512', w: 512, h: 512, shape: 'square', type: 'image/png',  label: 'Android होम (512)' }
  ];
  const MAX_DOC = 900 * 1024;

  const loadImg = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });

  /* लोगो के असली हिस्से (सफ़ेद किनारे हटाकर) का बाउंडिंग बॉक्स */
  function contentBox(im) {
    const s = Math.min(1, 400 / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4;
      if (d[i + 3] > 20 && (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235)) {
        if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX <= minX || maxY <= minY) return { sx: 0, sy: 0, sw: im.width, sh: im.height };
    const k = 1 / s, pad = 0.02;
    const bw = (maxX - minX) * k, bh = (maxY - minY) * k;
    return { sx: Math.max(0, minX * k - bw * pad), sy: Math.max(0, minY * k - bh * pad), sw: Math.min(im.width, bw * (1 + 2 * pad)), sh: Math.min(im.height, bh * (1 + 2 * pad)) };
  }

  function render(im, box, slot) {
    const c = document.createElement('canvas'); c.width = slot.w; c.height = slot.h;
    const x = c.getContext('2d');
    if (slot.shape === 'circle') { x.beginPath(); x.arc(slot.w / 2, slot.h / 2, slot.w / 2, 0, Math.PI * 2); x.clip(); }
    if (slot.type === 'image/jpeg' || slot.shape !== 'circle') { x.fillStyle = '#fff'; x.fillRect(0, 0, slot.w, slot.h); }
    const fill = slot.shape === 'banner' ? 0.9 : 0.88;
    const bh = slot.h * fill, bw = Math.min(slot.w * fill, bh * (box.sw / box.sh));
    const dw = slot.shape === 'banner' ? bh * (box.sw / box.sh) : bw, dh = slot.shape === 'banner' ? bh : bw * (box.sh / box.sw);
    x.drawImage(im, box.sx, box.sy, box.sw, box.sh, (slot.w - dw) / 2, (slot.h - dh) / 2, dw, dh);
    return c.toDataURL(slot.type, 0.9);
  }

  async function buildAll(file) {
    const im = await loadImg(file), box = contentBox(im);
    const out = {};
    SLOTS.forEach(s => { out[s.key] = render(im, box, s); });
    return out;
  }

  async function saveAll(db, data, msg) {
    const bad = Object.keys(data).filter(k => data[k].length > MAX_DOC);
    if (bad.length) throw new Error('ये लोगो बहुत बड़ा है: ' + bad.join(', ') + ' — छोटी फ़ाइल डालें');
    const batch = db.batch();
    SLOTS.forEach(s => {
      batch.set(db.collection('logos').doc(s.key), { data: data[s.key], type: s.type, updatedAt: APP.FV.serverTimestamp() });
    });
    await batch.commit();
    msg && msg('सेव हो गया ✔');
  }

  function open() {
    if (!PS.isCustomPump() || !(APP.isOwner && APP.isOwner())) return APP.toast && APP.toast('लोगो सिर्फ़ मालिक डाल सकता है');
    const m = APP.modal(
      '<h3>🖼️ लोगो अपलोड</h3>' +
      '<p class="mut" style="font-size:12px">एक फ़ाइल डालें। सारे लोगो अपने-आप बनकर अपनी जगह पर लग जाएँगे:</p>' +
      '<ul style="font-size:12px;margin:0 0 8px;padding-left:18px">' + SLOTS.map(s => '<li>' + s.label + '</li>').join('') + '</ul>' +
      '<input id="lu-file" type="file" accept="image/*" style="width:100%">' +
      '<div id="lu-prev" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"></div>' +
      '<div id="lu-msg" style="font-size:13px;margin-bottom:8px"></div>' +
      '<div class="btns"><button class="btn g" id="lu-save" disabled>सब लोगो सेव करें</button><button class="btn w" id="lu-no">रद्द</button></div>');
    let built = null;
    m.querySelector('#lu-no').onclick = () => m.close();
    m.querySelector('#lu-file').onchange = async ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      m.querySelector('#lu-msg').textContent = 'लोगो बना रहे हैं…';
      try {
        built = await buildAll(f);
        m.querySelector('#lu-prev').innerHTML = SLOTS.map(s => '<div style="text-align:center;font-size:10px"><img src="' + built[s.key] + '" style="width:64px;height:' + (s.shape === 'banner' ? 21 : 64) + 'px;object-fit:contain;border:1px solid #ddd;border-radius:6px"><div>' + s.label + '</div></div>').join('');
        m.querySelector('#lu-msg').textContent = 'तैयार है। अब सेव करें।';
        m.querySelector('#lu-save').disabled = false;
      } catch (e) { m.querySelector('#lu-msg').textContent = 'फ़ाइल नहीं खुली: ' + (e.message || e); }
    };
    m.querySelector('#lu-save').onclick = async () => {
      if (!built) return;
      if (!confirm('सारे लोगो सेव होंगे और ऐप रीफ़्रेश होगा. आगे बढ़ें?')) return;
      try {
        await saveAll(APP.db, built, msg => m.querySelector('#lu-msg').textContent = msg);
        APP.toast && APP.toast('लोगो लग गए ✔ — ऐप रीफ़्रेश हो रहा है');
        setTimeout(() => location.reload(), 900);
      } catch (e) { m.querySelector('#lu-msg').textContent = 'सेव नहीं हुआ: ' + (e.code ? e.code + ' — ' : '') + (e.message || e); }
    };
  }

  function card() {
    if (!PS.isCustomPump() || !(APP.isOwner && APP.isOwner()) || document.getElementById('logo-up-card')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const c = document.createElement('div');
    c.id = 'logo-up-card'; c.className = 'card'; c.style.marginBottom = '12px';
    c.innerHTML = '<b>🖼️ लोगो अपलोड</b><p class="mut" style="font-size:12px;margin:4px 0 8px">एक फ़ाइल से सारे लोगो (लॉगिन, बिल, होम आइकन आदि) अपने-आप सेट।</p><button id="lu-open" class="btn full">लोगो अपलोड करें</button>';
    main.prepend(c);
    document.getElementById('lu-open').onclick = open;
  }

  setTimeout(() => {
    const A = window.APP; if (!A || !A.views || typeof A.views.more !== 'function') return;
    const o = A.views.more;
    A.views.more = async function () { const r = await o.apply(this, arguments); try { card(); } catch (e) { } return r; };
  }, 3200);
  window.PUMP_LOGO_SLOTS = SLOTS;
})();
