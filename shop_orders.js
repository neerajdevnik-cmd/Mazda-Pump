/* Mazda Oil Company - Shop Orders (owner side, from party portal) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;

  APP.views = APP.views || {};

  const STATUS = {
    paid_awaiting_delivery: { label: '💳 भुगतान हुआ (डिलीवरी बाकी)', cls: 'o' },
    paid: { label: '✅ Paid (confirm बाकी)', cls: 'g' },
    delivered: { label: '🚚 Delivered', cls: 'g' },
    cancelled: { label: '❌ रद्द', cls: 'r' }
  };

  APP.views.shop_orders = async function (tab) {
    if (APP.isViewer() || S.role === 'salesman') return toast('अनुमति नहीं');
    const main = $('#main'); if (!main) return;
    tab = tab || 'pending';
    main.innerHTML = '<p class="mut">ऑर्डर लोड हो रहे हैं…</p>';

    let snap;
    try {
      snap = await db().collection('shop_orders').orderBy('createdAt', 'desc').limit(100).get();
    } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }

    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pending = all.filter(o => o.status === 'paid_awaiting_delivery' || o.status === 'paid');
    const delivered = all.filter(o => o.status === 'delivered');
    const cancelled = all.filter(o => o.status === 'cancelled');

    const list = tab === 'pending' ? pending : tab === 'delivered' ? delivered : cancelled;
    const totPending = pending.reduce((a, o) => a + num(o.totalAmount), 0);

    main.innerHTML =
      '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">📦 शॉप ऑर्डर</h3>' +
      '<div style="font-size:12px;opacity:.85;margin-top:4px">पार्टी पोर्टल से आने वाले ऑर्डर</div></div>' +
      '<div class="card"><div class="kv"><span>Pending</span><b class="neg">' + pending.length + ' · ₹' + r2(totPending) + '</b></div></div>' +
      '<div class="seg" style="margin-bottom:12px">' +
        '<button data-otab="pending" class="' + (tab === 'pending' ? 'on' : '') + '">⏳ Pending (' + pending.length + ')</button>' +
        '<button data-otab="delivered" class="' + (tab === 'delivered' ? 'on' : '') + '">🚚 Delivered (' + delivered.length + ')</button>' +
        '<button data-otab="cancelled" class="' + (tab === 'cancelled' ? 'on' : '') + '">❌ रद्द (' + cancelled.length + ')</button>' +
      '</div>' +
      '<div id="orders-list"></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';

    $$('[data-otab]').forEach(b => b.onclick = () => APP.views.shop_orders(b.dataset.otab));

    const listEl = $('#orders-list');
    if (!list.length) {
      listEl.innerHTML = '<div class="card"><p class="mut" style="text-align:center;padding:20px">कोई ऑर्डर नहीं</p></div>';
      return;
    }

    listEl.innerHTML = list.map(o => {
      const st = STATUS[o.status] || { label: o.status, cls: '' };
      const ph = (o.partyPhone || '').replace(/\D/g, '');
      const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
      const dt = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate().toLocaleString('hi-IN') : (o.createdAtStr || '');
      
      return '<div class="card" style="padding:12px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="flex:1">' +
            '<b>' + esc(o.partyName || '?') + '</b> ' +
            '<span class="chip ' + st.cls + '">' + st.label + '</span>' +
            '<div class="mut" style="font-size:12px;margin-top:4px">' + esc(o.productName) + ' × ' + o.qty + '</div>' +
            '<div class="mut" style="font-size:12px">' + dt + '</div>' +
            (o.upiNote ? '<div class="mut" style="font-size:11px">UPI note: "' + esc(o.upiNote) + '"</div>' : '') +
          '</div>' +
          '<div style="text-align:right">' +
            '<b class="neg" style="font-size:16px">₹' + r2(o.totalAmount) + '</b>' +
          '</div>' +
        '</div>' +
        '<div class="btns" style="margin-top:8px">' +
          (ph ? '<a href="tel:' + esc(o.partyPhone) + '" class="btn sm w">📞</a>' : '') +
          (wa ? '<a href="https://wa.me/' + wa + '?text=' + encodeURIComponent('नमस्ते ' + o.partyName + ' जी, आपका ' + o.productName + ' ऑर्डर मिल गया है। कब लेने आएंगे?') + '" target="_blank" class="btn sm g">💬</a>' : '') +
          (o.status === 'paid_awaiting_delivery' ? '<button class="btn sm g" data-confirm-pay="' + o.id + '">✅ Payment मिली</button>' : '') +
          ((o.status === 'paid' || o.status === 'paid_awaiting_delivery') ? '<button class="btn sm g" data-deliver="' + o.id + '">🚚 Delivered</button>' : '') +
          (o.status !== 'delivered' && o.status !== 'cancelled' ? '<button class="btn sm r" data-cancel="' + o.id + '">❌ रद्द</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    $$('[data-confirm-pay]').forEach(b => b.onclick = async () => {
      if (!confirm('UPI app में payment check कर लिया?\n\nConfirm करने पर stock कम होगा और status "Paid" होगा।')) return;
      b.disabled = true;
      try {
        const oid = b.dataset.confirmPay;
        const o = all.find(x => x.id === oid);
        if (!o) return;
        await db().collection('shop_orders').doc(oid).update({
          status: 'paid',
          confirmedAt: APP.FV.serverTimestamp(),
          confirmedBy: S.user ? S.user.email : 'Manager'
        });
        if (o.productId) {
          try {
            const pref = db().collection('shop').doc(o.productId);
            await db().runTransaction(async tx => {
              const s = await tx.get(pref);
              if (s.exists) {
                const curStock = num(s.data().stock);
                tx.update(pref, { stock: Math.max(0, curStock - num(o.qty)) });
              }
            });
          } catch (e) {}
        }
        APP.audit('order_confirmed', { id: oid, product: o.productName });
        toast('✅ Payment confirm ✔');
        APP.views.shop_orders(tab);
      } catch (e) { b.disabled = false; toast('नहीं हुआ: ' + e.message); }
    });

    $$('[data-deliver]').forEach(b => b.onclick = async () => {
      if (!confirm('पार्टी को सामान दे दिया?')) return;
      b.disabled = true;
      try {
        await db().collection('shop_orders').doc(b.dataset.deliver).update({
          status: 'delivered',
          deliveredAt: APP.FV.serverTimestamp(),
          deliveredBy: S.user ? S.user.email : 'Manager'
        });
        APP.audit('order_delivered', { id: b.dataset.deliver });
        toast('🚚 Delivered ✔');
        APP.views.shop_orders(tab);
      } catch (e) { b.disabled = false; toast('नहीं हुआ: ' + e.message); }
    });

    $$('[data-cancel]').forEach(b => b.onclick = async () => {
      if (!confirm('इस ऑर्डर को रद्द करें?\n\nStock वापस add होगा (agar pehle कम हुआ था)।')) return;
      b.disabled = true;
      try {
        const oid = b.dataset.cancel;
        const o = all.find(x => x.id === oid);
        if (!o) return;
        await db().collection('shop_orders').doc(oid).update({
          status: 'cancelled',
          cancelledAt: APP.FV.serverTimestamp(),
          cancelledBy: S.user ? S.user.email : 'Manager'
        });
        if (o.productId && (o.status === 'paid' || o.status === 'paid_awaiting_delivery')) {
          try {
            const pref = db().collection('shop').doc(o.productId);
            await db().runTransaction(async tx => {
              const s = await tx.get(pref);
              if (s.exists) tx.update(pref, { stock: num(s.data().stock) + num(o.qty) });
            });
          } catch (e) {}
        }
        APP.audit('order_cancelled', { id: oid });
        toast('❌ रद्द ✔');
        APP.views.shop_orders(tab);
      } catch (e) { b.disabled = false; toast('नहीं हुआ: ' + e.message); }
    });
  };

  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer() || S.role === 'salesman') return;
    if (document.querySelector('#orders-more-btn')) return;
    const main = $('#main'); if (!main) return;
    const card = main.querySelector('#extra-more-card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns && !card.querySelector('[data-nav="shop_orders"]')) {
      const btn = document.createElement('button');
      btn.id = 'orders-more-btn';
      btn.className = 'btn w';
      btn.innerHTML = '📦 शॉप ऑर्डर';
      btn.onclick = () => APP.go('shop_orders');
      btns.insertBefore(btn, btns.firstChild);
    }
  };

  console.log('[Mazda shop_orders.js] loaded ✓');
})();
