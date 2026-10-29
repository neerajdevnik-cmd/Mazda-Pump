/* Mazda Oil Company - Party Portal Logic (Login, Tabs, UPI Payment) */
(function () {
  'use strict';
  const APP = {};
  let auth, db;

  /* ================= Icons ================= */
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    hisab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    gaadi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
  };

  /* ================= State ================= */
  const S = { party: null, tab: 'home', ledger: [], orders: [], shop: [], cibil: null, loaded: false };

  /* ================= Utils ================= */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const toast = msg => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3000);
  };
  const money = x => '₹' + Number(x || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const dmy = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };

  /* ================= Boot ================= */
  window.addEventListener('load', () => {
    try {
      firebase.initializeApp(window.CFG.firebase);
      auth = firebase.auth(); db = firebase.firestore();
      auth.onAuthStateChanged(u => {
        const saved = localStorage.getItem('mazda_party');
        if (saved) {
          try { S.party = JSON.parse(saved); loadApp(); } catch(e) { localStorage.removeItem('mazda_party'); renderLogin(); }
        } else {
          renderLogin();
        }
      });
    } catch (e) { $('#app').innerHTML = '<div style="padding:20px;color:red">Firebase Init Error: ' + e.message + '</div>'; }
  });

  /* ================= LOGIN ================= */
  function renderLogin() {
    $('#app').innerHTML = `
      <div class="login-screen fade-in">
        <img src="./logo.png" class="login-logo" alt="Logo">
        <h2 style="text-align:center;font-size:24px;">माज़दा पोर्टल</h2>
        <p class="text-mut" style="text-align:center;margin-bottom:30px;">अपना हिसाब देखने के लिए कोड डालें</p>
        
        <div class="glass-card" style="margin:0;">
          <label class="text-mut" style="display:block;text-align:center;margin-bottom:10px;">6-अंकों का पार्टी कोड</label>
          <input type="tel" id="p-code" maxlength="6" placeholder="000000">
          <button class="btn" id="btn-login" style="margin-top:20px;">लॉगिन करें</button>
        </div>
        
        <p class="text-mut" style="text-align:center;margin-top:30px;font-size:11px;">© Mazda Oil Company</p>
      </div>`;

    $('#btn-login').onclick = async () => {
      const code = $('#p-code').value.trim();
      if (code.length < 4) return toast('सही कोड डालें');
      
      const btn = $('#btn-login'); btn.disabled = true; btn.textContent = 'चेक कर रहे हैं...';
      try {
        if (!auth.currentUser) await auth.signInAnonymously();
        const snap = await db.collection('parties').where('portalCode', '==', code).limit(1).get();
        
        if (snap.empty) {
          btn.disabled = false; btn.textContent = 'लॉगिन करें';
          return toast('❌ गलत कोड! मैनेजर से संपर्क करें।');
        }

        const doc = snap.docs[0];
        S.party = { id: doc.id, ...doc.data() };
        localStorage.setItem('mazda_party', JSON.stringify(S.party));
        
        toast('✅ लॉगिन सफल');
        loadApp();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'लॉगिन करें';
        toast('नेटवर्क एरर: ' + e.message);
      }
    };
  }

  /* ================= MAIN APP ================= */
  async function loadApp() {
    $('#app').innerHTML = `
      <div class="p-header fade-in">
        <div class="row">
          <img src="./logo.png" alt="">
          <div>
            <div style="font-weight:700;font-size:16px;">${S.party.name}</div>
            <div class="text-mut" style="font-size:11px;">${S.party.phone || ''}</div>
          </div>
        </div>
        <button id="btn-logout" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${ICONS.logout}</button>
      </div>
      <div id="p-content" style="padding-bottom:100px;"></div>
      <div class="p-nav fade-in">
        <button data-tab="home" class="active">${ICONS.home} होम</button>
        <button data-tab="hisab">${ICONS.hisab} मेरा हिसाब</button>
        <button data-tab="gaadi">${ICONS.gaadi} मेरी गाड़ी</button>
        <button data-tab="shop">${ICONS.shop} शॉप</button>
      </div>
    `;

    $('#btn-logout').onclick = () => {
      if (!confirm('लॉगआउट करें?')) return;
      localStorage.removeItem('mazda_party');
      if (auth) auth.signOut();
      location.reload();
    };

    $$('.p-nav button').forEach(b => b.onclick = () => {
      $$('.p-nav button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      S.tab = b.dataset.tab;
      renderTab();
    });

    await fetchData();
    renderTab();
  }

  async function fetchData() {
    try {
      const [ledgerSnap, shopSnap, ordersSnap] = await Promise.all([
        db.collection('ledger').where('partyId', '==', S.party.id).get(),
        db.collection('shop').get(),
        db.collection('shop_orders').where('partyId', '==', S.party.id).get()
      ]);

      S.ledger = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date + (b.time||'')).localeCompare(a.date + (a.time||'')));
      S.shop = shopSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''));
      S.orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const t1 = a.createdAt ? a.createdAt.toMillis() : 0;
        const t2 = b.createdAt ? b.createdAt.toMillis() : 0;
        return t2 - t1;
      });
      S.loaded = true;
    } catch (e) { toast('डेटा लोड नहीं हुआ: ' + e.message); }
  }

  function calcBal() {
    let b = 0;
    S.ledger.forEach(r => {
      b += r.kind === 'udhar' ? Number(r.amount) : -Number(r.amount);
    });
    return b;
  }

  /* ================= TABS ================= */
  function renderTab() {
    const c = $('#p-content');
    c.className = 'fade-in';
    if (!S.loaded) { c.innerHTML = '<p class="text-mut" style="text-align:center;padding:40px;">लोड हो रहा है...</p>'; return; }

    if (S.tab === 'home') renderHome(c);
    else if (S.tab === 'hisab') renderHisab(c);
    else if (S.tab === 'gaadi') renderGaadi(c);
    else if (S.tab === 'shop') renderShop(c);
  }

  /* --- Home Tab --- */
  function renderHome(c) {
    const bal = calcBal();
    const lastTrx = S.ledger.slice(0, 3);
    
    c.innerHTML = `
      <div class="glass-card" style="background:linear-gradient(135deg, rgba(10,47,107,0.8), rgba(26,95,208,0.6)); text-align:center; padding:24px;">
        <div class="text-mut" style="text-transform:uppercase;letter-spacing:1px;font-size:11px;">कुल बकाया (Balance)</div>
        <div class="balance-big">${bal > 0 ? '-' : '+'}${money(Math.abs(bal))}</div>
        <div style="font-size:12px;margin-top:8px;opacity:0.8;">${bal > 0 ? 'आपको देना है' : 'एडवांस जमा है'}</div>
      </div>

      <div class="glass-card">
        <h3 style="font-size:16px;">ताज़ा लेन-देन</h3>
        ${lastTrx.map(r => `
          <div class="row" style="justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div>
              <div style="font-weight:600;font-size:14px;">${r.vehicle || (r.kind==='jama'?'जमा':'उधार')}</div>
              <div class="text-mut" style="font-size:11px;">${dmy(r.date)}</div>
            </div>
            <div style="font-weight:700;color:${r.kind === 'udhar' ? '#ff8888' : '#7ee0a0'};">
              ${r.kind === 'udhar' ? '-' : '+'}${money(r.amount)}
            </div>
          </div>
        `).join('') || '<p class="text-mut" style="font-size:13px;text-align:center;">कोई एंट्री नहीं</p>'}
        <button class="btn" style="margin-top:16px;background:rgba(255,255,255,0.1);color:#fff;box-shadow:none;" onclick="document.querySelector('[data-tab=hisab]').click()">पूरा हिसाब देखें</button>
      </div>

      <div class="glass-card" style="text-align:center;padding:20px;">
        <h3 style="color:#f4b41a;margin-bottom:12px;">📢 सूचना</h3>
        <p class="text-mut" style="font-size:13px;line-height:1.5;">कृपया 30 दिन से पुराना बकाया जल्द से जल्द जमा करें, ताकि आपको आगे कोई परेशानी न हो।</p>
      </div>
    `;
  }

  /* --- Hisab Tab --- */
  function renderHisab(c) {
    c.innerHTML = `
      <div class="glass-card" style="margin-top:16px;padding:0;overflow:hidden;">
        <div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.1);">
          <h3 style="margin:0;">📄 मेरा हिसाब</h3>
        </div>
        <div style="max-height:60vh;overflow-y:auto;">
          ${S.ledger.map(r => `
            <div class="row" style="justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div>
                <div style="font-weight:600;font-size:14px;">${r.vehicle || 'गाड़ी नहीं'} ${r.fuel?'• '+r.fuel:''}</div>
                <div class="text-mut" style="font-size:11px;">${dmy(r.date)} ${r.time||''} ${r.litre ? '• '+r.litre+' L' : ''}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;color:${r.kind === 'udhar' ? '#ff8888' : '#7ee0a0'};">
                  ${r.kind === 'udhar' ? '-' : '+'}${money(r.amount)}
                </div>
                <div class="text-mut" style="font-size:10px;">${r.kind === 'udhar' ? 'उधार' : 'जमा'}</div>
              </div>
            </div>
          `).join('') || '<p class="text-mut" style="text-align:center;padding:20px;">कोई हिसाब नहीं है</p>'}
        </div>
      </div>
    `;
  }

  /* --- Gaadi Tab --- */
  function renderGaadi(c) {
    const vehs = S.party.vehicles || [];
    if (!vehs.length) { c.innerHTML = '<p class="text-mut" style="text-align:center;padding:40px;">आपकी कोई गाड़ी रजिस्टर्ड नहीं है</p>'; return; }

    c.innerHTML = vehs.map(v => {
      const entries = S.ledger.filter(r => (r.vehicle||'').toUpperCase() === v.toUpperCase());
      const totL = entries.reduce((a,r) => a + Number(r.litre||0), 0);
      const last = entries[0];
      return `
        <div class="glass-card" style="margin-top:16px;">
          <div class="row" style="justify-content:space-between;">
            <div style="font-size:16px;font-weight:700;">🚗 ${v}</div>
            <div class="text-gold" style="font-weight:700;font-size:12px;">${entries.length} बार</div>
          </div>
          <div class="row" style="margin-top:12px;gap:20px;">
            <div>
              <div class="text-mut" style="font-size:11px;">कुल तेल</div>
              <div style="font-weight:700;font-size:15px;">${totL.toFixed(2)} L</div>
            </div>
            <div>
              <div class="text-mut" style="font-size:11px;">आखिरी बार</div>
              <div style="font-weight:700;font-size:15px;">${last ? dmy(last.date) : '-'}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* --- Shop Tab --- */
  function renderShop(c) {
    let ordersHtml = '';
    if (S.orders.length) {
      ordersHtml = `
        <div class="glass-card" style="margin-top:16px;background:rgba(244,180,26,0.1);border-color:rgba(244,180,26,0.3);">
          <h3 style="font-size:14px;color:#f4b41a;">📦 मेरे ऑर्डर</h3>
          ${S.orders.slice(0,3).map(o => `
            <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1);">
              <div>
                <div style="font-weight:600;font-size:13px;">${o.productName}</div>
                <div class="text-mut" style="font-size:10px;">${dmy(o.date)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:12px;font-weight:700;">${money(o.totalAmount)}</div>
                <div style="font-size:9px;color:${o.status==='delivered'?'#7ee0a0':'#f4b41a'};">
                  ${o.status === 'paid_awaiting_delivery' ? '⏳ तैयार हो रहा' : o.status === 'delivered' ? '✔ मिल गया' : '❌ रद्द'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    c.innerHTML = `
      <div style="padding:16px 16px 0;">
        <h2 style="font-size:18px;margin-bottom:12px;">🛍️ माज़दा शॉप</h2>
      </div>
      <div style="padding:0 16px; display:grid; gap:12px;">
        ${S.shop.map(p => `
          <div class="glass-card" style="margin:0;display:flex;gap:12px;align-items:center;padding:12px;">
            ${p.photo ? `<img src="${p.photo}" style="width:60px;height:60px;border-radius:12px;object-fit:cover;">` : `<div style="width:60px;height:60px;border-radius:12px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:24px;">🛢️</div>`}
            <div style="flex:1;">
              <div style="font-weight:700;font-size:14px;">${p.name}</div>
              <div class="text-gold" style="font-weight:800;font-size:16px;">${money(p.rate)}</div>
              <div class="text-mut" style="font-size:10px;">स्टॉक: ${p.stock || 0}</div>
            </div>
            <button class="btn" style="width:auto;padding:8px 16px;font-size:12px;" onclick="window.partyBuyNow('${p.id}')" ${!(p.stock > 0) ? 'disabled' : ''}>Buy Now</button>
          </div>
        `).join('') || '<p class="text-mut" style="text-align:center;">शॉप में कुछ नहीं है</p>'}
      </div>
      ${ordersHtml}
    `;
  }

  /* ================= UPI Payment Flow ================= */
  window.partyBuyNow = async (pid) => {
    const p = S.shop.find(x => x.id === pid);
    if (!p || !(p.stock > 0)) return toast('आउट ऑफ स्टॉक');
    
    if (!confirm(`क्या आप ${p.name} (₹${p.rate}) खरीदना चाहते हैं?`)) return;

    try {
      // 1. Create Order in Firestore
      const upiNote = `Mazda ${p.name} buy`;
      const oRef = await db.collection('shop_orders').add({
        partyId: S.party.id, partyName: S.party.name, partyPhone: S.party.phone || '',
        productId: p.id, productName: p.name, productImage: p.photo || '',
        qty: 1, rate: p.rate, totalAmount: p.rate, upiNote: upiNote,
        status: 'payment_pending', date: today(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 2. Open UPI App
      const upiId = window.CFG.pump.upi;
      const upiName = window.CFG.pump.upiName;
      const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${p.rate}&tn=${encodeURIComponent(upiNote)}&cu=INR`;
      
      toast('UPI ऐप खोल रहे हैं...');
      window.location.href = upiLink;

      // 3. Confirm Payment after returning
      setTimeout(() => {
        if (confirm('क्या आपने UPI से पेमेंट कर दिया है?\n\n(हाँ दबाने पर हम मैनेजर को भेज देंगे)')) {
          db.collection('shop_orders').doc(oRef.id).update({ status: 'paid_awaiting_delivery' })
            .then(() => { toast('✅ पेमेंट सफल! जल्दी ही आपका सामान तैयार होगा।'); fetchData().then(renderTab); })
            .catch(e => toast('एरर: ' + e.message));
        } else {
          db.collection('shop_orders').doc(oRef.id).update({ status: 'cancelled' });
          toast('ऑर्डर रद्द हो गया');
        }
      }, 2000);

    } catch (e) {
      toast('ऑर्डर फेल: ' + e.message);
    }
  };

})();
