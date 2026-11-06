/* =========================================================================
   BANK_SYNC.JS - Super Admin ka panel + SBI / PNB bank sync engine
   (super_admin.js aur super_admin_v2.js ki jagah. Sirf zaroori hisa bacha hai.)
   - Panel: #super-admin-panel (pump_create.js aur demo_3m.js isi me buttons jodte hain)
   - window.syncBankFromDays: hisab (days / tanker / ledger) se SBI & PNB ki entries
     banata hai; demo_core.js isi ko call karta hai.
   - Auto-sync: days / tanker / jama badlne par 3 second baad apne aap sync.
   ========================================================================= */
(function () {
  'use strict';

  const r2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  const num = n => (isNaN(parseFloat(n)) ? 0 : parseFloat(n));

  function isAuthorized() {
    const APP = window.APP || {};
    const email = ((APP.S && APP.S.user && APP.S.user.email) || '').toLowerCase();
    return email.includes('neeraj') || (APP.isTrueOwner && APP.isTrueOwner()) || localStorage.getItem('mazda_owner') === 'yes';
  }

  // =========================================================================
  // 1. BANK SYNC
  // =========================================================================
  let bankSyncing = false;
  const pickAmt = o => num(o.amount ?? o.amt ?? o.rakam ?? o.value ?? o.val ?? 0);
  const pickNote = o => String(o.note ?? o.name ?? o.title ?? o.label ?? o.desc ?? 'और खर्चा');
  function extraExpenses(d) {
    const keys = ['kharchaItems', 'otherExp', 'extraExp', 'extraExpenses', 'aurKharche', 'otherExpenses', 'extras', 'expenses', 'other'];
    for (const k of keys) {
      if (Array.isArray(d[k])) return d[k];
    }
    return [];
  }

  async function syncBankFromDays(opts = {}) {
    if (bankSyncing) return;
    bankSyncing = true;
    const APP = window.APP || {};
    const db = firebase.firestore();
    try {
      if (APP.Rules) APP.Rules.sys = true;
      const [daysSnap, ledSnap, invSnap, sbiDoc, pnbDoc] = await Promise.all([
        db.collection('days').get(),
        db.collection('ledger').get(),
        db.collection('tanker_invoices').get(),
        db.collection('parties').doc('bank_sbi').get(),
        db.collection('parties').doc('bank_pnb').get()
      ]);

      const BANK = {
        sbi: { id: 'bank_sbi', name: 'State Bank of India' },
        pnb: { id: 'bank_pnb', name: 'Punjab National Bank' }
      };
      const want = new Map(); // docId -> entry
      // App ka apna format: bank mai jama = + (hara), udhar = - (laal)
      const add = (id, key, dir, date, time, amount, note, mode = 'bank') => {
        amount = r2(amount);
        if (!(amount > 0) || !date) return;
        want.set(id, {
          partyId: BANK[key].id, partyName: BANK[key].name, date, time,
          kind: dir === 'in' ? 'jama' : 'udhar', mode, amount, note,
          autoBankSync: true, createdOn: date, by: 'bank-sync'
        });
      };

      // A) Daily hisab se
      daysSnap.forEach(doc => {
        const d = doc.data() || {};
        const dt = d.date || doc.id;
        add(`bk_paytm_${dt}`, 'sbi', 'in', dt, '20:00', num(d.paytm), 'Paytm/UPI दैनिक बिक्री जमा', 'paytm');
        add(`bk_swipe_${dt}`, 'sbi', 'in', dt, '20:05', num(d.swipe), 'कार्ड स्वाइप जमा', 'swipe');
        add(`bk_malik_${dt}`, 'sbi', 'in', dt, '18:00', num(d.malikDiya), 'पंप गल्ले से कैश जमा (SBI)', 'cash');
        add(`bk_sbitop_${dt}`, 'sbi', 'in', dt, '18:30', num(d.sbiTopup), 'गल्ले से SBI जमा', 'cash');
        add(`bk_pnbtop_${dt}`, 'pnb', 'in', dt, '18:40', num(d.pnbTopup), 'गल्ले से PNB जमा', 'cash');
        // खर्चे (DG, चाय-खाना, ड्राइवर इनाम, अन्य) बैंक में नहीं जाते — ये सिर्फ़ हिसाब/गल्ले में रहते हैं
        //   और मासिक रिपोर्ट में इन्हीं दिन के फ़ील्ड से जुड़ते हैं। पुरानी bk_dg/bk_chai/bk_inaam/bk_xp
        //   entries अगले सिंक में अपने-आप हट जाती हैं (नीचे "stale" delete वाला हिस्सा)।
      });

      // B) Tanker / margin bill -> SBI se katega
      invSnap.forEach(doc => {
        const d = doc.data() || {};
        const from = String(d.paidFrom || d.bank || 'sbi').toLowerCase();
        add(`bk_tinv_${doc.id}`, from.includes('pnb') ? 'pnb' : 'sbi', 'out', d.date || d.invoiceDate,
          '19:00', pickAmt(d), `Tanker/Margin bill${d.litre ? ' (' + d.litre + ' L)' : ''}`, 'tanker');
      });

      // C) App ke apne bank entries ko CHHUA nahi jata; sirf existing map banta hai taaki double na ho.
      const existing = new Map();
      const appBank = [];
      const appKeys = new Set();
      ledSnap.forEach(doc => {
        const d = doc.data() || {};
        if (doc.id.startsWith('bk_')) { existing.set(doc.id, d); return; }
        if (d.partyId === 'bank_sbi' || d.partyId === 'bank_pnb') {
          appBank.push(d);
          appKeys.add(`${d.partyId}|${d.date}|${d.kind}|${r2(num(d.amount))}`);
        }
      });
      // Agar app ne wahi entry (same bank, din, rakam, jama/udhar) pehle hi bana rakhi hai to dobara nahi banate
      for (const [id, e] of [...want]) {
        if (appKeys.has(`${e.partyId}|${e.date}|${e.kind}|${e.amount}`)) want.delete(id);
      }

      // D) Sirf wahi likho jo badla hai
      let b = db.batch(), ops = 0, changed = 0;
      const flush = async () => { if (ops > 0) { await b.commit(); b = db.batch(); ops = 0; } };
      const same = (x, y) => x && y && x.amount === y.amount && x.date === y.date &&
        x.kind === y.kind && x.mode === y.mode && x.partyId === y.partyId && x.note === y.note;
      for (const [id, entry] of want) {
        if (!same(existing.get(id), entry)) { b.set(db.collection('ledger').doc(id), entry); ops++; changed++; }
        if (ops >= 400) await flush();
      }
      for (const [id] of existing) {
        if (!want.has(id)) { b.delete(db.collection('ledger').doc(id)); ops++; changed++; }
        if (ops >= 400) await flush();
      }

      // E) Bank balance = opening + jama(+) - udhar(-)
      const bal = { sbi: num(sbiDoc.data()?.openingBal), pnb: num(pnbDoc.data()?.openingBal) };
      const addBal = e => {
        const k = e.partyId === 'bank_pnb' ? 'pnb' : 'sbi';
        bal[k] += (e.kind === 'jama' ? 1 : e.kind === 'udhar' ? -1 : 0) * num(e.amount);
      };
      appBank.forEach(addBal);
      for (const e of want.values()) addBal(e);
      b.set(db.collection('parties').doc('bank_sbi'), { bal: r2(bal.sbi), currentBal: r2(bal.sbi), isBank: true }, { merge: true }); ops++;
      b.set(db.collection('parties').doc('bank_pnb'), { bal: r2(bal.pnb), currentBal: r2(bal.pnb), isBank: true }, { merge: true }); ops++;
      await flush();

      console.log(`[BankSync] done: ${changed} badlav | SBI ₹${r2(bal.sbi)} | PNB ₹${r2(bal.pnb)}`);
      if (!opts.silent && !opts.auto) {
        alert(`✅ बैंक सिंक पूरा!\n\nबदलाव: ${changed} एंट्री\nSBI बैलेंस: ₹${r2(bal.sbi).toLocaleString('en-IN')}\nPNB बैलेंस: ₹${r2(bal.pnb).toLocaleString('en-IN')}`);
      }
    } catch (e) {
      console.error('[BankSync] error', e);
      if (!opts.auto) alert('❌ बैंक सिंक एरर: ' + e.message);
    } finally {
      bankSyncing = false;
      if (APP.Rules) APP.Rules.sys = false;
    }
  }
  window.syncBankFromDays = syncBankFromDays;

  // Hisab mein koi bhi badlav aate hi apne aap sync
  let autoSyncStarted = false, autoTimer = null;
  function startBankAutoSync() {
    if (autoSyncStarted || typeof firebase === 'undefined' || !firebase.apps?.length) return;
    autoSyncStarted = true;
    const db = firebase.firestore();
    const kick = () => { clearTimeout(autoTimer); autoTimer = setTimeout(() => syncBankFromDays({ auto: true }), 3000); };
    db.collection('days').onSnapshot(kick, () => {});
    db.collection('tanker_invoices').onSnapshot(kick, () => {});
    db.collection('ledger').where('kind', '==', 'jama').onSnapshot(kick, () => {});
  }

  // =========================================================================
  // 2. SUPER ADMIN PANEL (sirf authorized user ko dikhta hai)
  //    pump_create.js (naya pump) aur demo_3m.js (Mazda demo) isi panel mein jude hain
  // =========================================================================
  function injectPanel() {
    const main = document.querySelector('#main') || document.querySelector('#p-content');
    if (!main || document.querySelector('#super-admin-panel')) return;
    const onMore = document.querySelector('nav button[data-tab="more"].active');
    if (!onMore) return;

    const panel = document.createElement('div');
    panel.id = 'super-admin-panel';
    panel.className = 'glass-card';
    panel.style.cssText = 'background:linear-gradient(135deg, #071329, #0a1f3d);border:2px solid #f4b41a;border-radius:16px;padding:16px;margin:16px;color:#fff;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="font-size:24px;">👑</span>
        <div>
          <b style="color:#f4b41a;font-size:16px;">Super Admin</b>
          <div style="font-size:11px;color:#94a3b8;">पंप बनाना, डेमो डेटा, बैंक सिंक</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button id="btn-bank-sync" class="btn" style="grid-column:span 2;background:#1d4ed8;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
          🏦 Bank Sync (हिसाब से SBI / PNB एंट्री)
        </button>
      </div>
    `;

    main.insertBefore(panel, main.firstChild);
    document.querySelector('#btn-bank-sync').onclick = () => syncBankFromDays();
  }

  setInterval(() => {
    if (isAuthorized()) { injectPanel(); startBankAutoSync(); }
  }, 1000);

  console.log('[BankSync] Super Admin panel & bank sync loaded ✓');
})();
