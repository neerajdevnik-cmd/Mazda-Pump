/* =========================================================================
   SUPER_ADMIN.JS - ULTIMATE ACCURATE ENGINE (SBI / PNB COMPLETE SYNC)
   1. 🔄 Auto-Fix & Sync All Days Hisab (Chain Sync + Full Bank Re-ledgering)
   2. 🚀 Realistic Demo Data Generator (Paytm/Swipe/Cash -> SBI | Kharcha -> PNB)
   3. ⚠️ Clear Pump Data (Zero All, Delete Private Parties, Reset SBI/PNB)
   ========================================================================= */
(function () {
  'use strict';

  const r2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

  function getDB() {
    return (window.APP && window.APP.db) ? window.APP.db : firebase.firestore();
  }

  function isSuperAdmin() {
    const APP = window.APP || {};
    const email = (APP.S && APP.S.user && APP.S.user.email) ? APP.S.user.email.toLowerCase() : '';
    if (email.includes('neeraj') || (APP.isTrueOwner && APP.isTrueOwner())) return true;
    if (localStorage.getItem('mazda_owner') === 'yes') return true;
    if (APP.S && APP.S.role === 'owner') return true;
    return false;
  }

  function showProgress(title, subtitle) {
    if (window.APP && window.APP.modal) {
      return window.APP.modal(`<h3 style="color:#0b3d91;margin:0 0 8px 0;">${title}</h3><p class="mut" style="margin:0;">${subtitle}</p>`);
    }
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
    d.innerHTML = `<div class="sheet" style="background:#0a1830;border:2px solid #f4b41a;border-radius:16px;padding:24px;color:#fff;text-align:center;max-width:340px;width:100%;">
      <h3 style="color:#f4b41a;margin:0 0 8px 0;">${title}</h3>
      <p style="color:#94a3b8;font-size:13px;margin:0;">${subtitle}</p>
    </div>`;
    document.body.appendChild(d);
    return {
      querySelector: s => d.querySelector(s),
      close: () => d.remove()
    };
  }

  // =========================================================================
  // BUTTON 1: AUTO-FIX & SYNC ALL DAYS (INCLUDING SBI & PNB COMPLETE AUDIT)
  // =========================================================================
  async function autoFixAllDaysChain() {
    if (!confirm('🔄 क्या आप शुरू से आज तक का पूरा हिसाब (AD कैश, मीटर, स्टॉक, पार्टी खाता और SBI/PNB बैंक लेजर) सिंक व ऑटो-फिक्स करना चाहते हैं?')) return;

    const prog = showProgress('⏳ पूरा हिसाब व बैंक सिंक हो रहा है...', 'SBI और PNB के लेजर व दिनों की चेन मिलाई जा रही है...');
    const db = getDB();
    const APP = window.APP || {};

    try {
      if (APP.Rules) APP.Rules.sys = true;

      const [daysSnap, ledgerSnap, partiesSnap] = await Promise.all([
        db.collection('days').get(),
        db.collection('ledger').get(),
        db.collection('parties').get()
      ]);

      const days = daysSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date || a.id).localeCompare(b.date || b.id));
      const allLedger = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const rowsByDate = {};
      const partyBalMap = {};

      allLedger.forEach(r => {
        if (r.date) {
          (rowsByDate[r.date] = rowsByDate[r.date] || []).push(r);
        }
        if (r.partyId) {
          const amt = num(r.amount);
          if (r.partyId === 'bank_sbi' || r.partyId === 'bank_pnb') {
            // Bank balances: jama increases bank balance (+), udhar/kharcha decreases (-)
            if (r.kind === 'jama') partyBalMap[r.partyId] = r2((partyBalMap[r.partyId] || 0) + amt);
            else if (r.kind === 'udhar') partyBalMap[r.partyId] = r2((partyBalMap[r.partyId] || 0) - amt);
          } else {
            // Customer Party balances: udhar increases customer debt (+), jama decreases (-)
            if (r.kind === 'udhar' || r.opening === true) {
              partyBalMap[r.partyId] = r2((partyBalMap[r.partyId] || 0) + amt);
            } else if (r.kind === 'jama') {
              partyBalMap[r.partyId] = r2((partyBalMap[r.partyId] || 0) - amt);
            }
          }
        }
      });

      let prevCloseCash = null;
      let prevStockP = null;
      let prevStockD = null;
      let prevNz = null;
      let prevDate = null;

      let batch = db.batch(), ops = 0;
      const commitBatch = async () => {
        if (ops > 0) { await batch.commit(); batch = db.batch(); ops = 0; }
      };

      const NZ = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];

      for (let i = 0; i < days.length; i++) {
        const d = days[i];
        const dt = d.date || d.id;

        if (prevDate !== null) {
          d.openCash = r2(prevCloseCash);
          if (prevStockP !== null) d.openStockP = r2(prevStockP);
          if (prevStockD !== null) d.openStockD = r2(prevStockD);
          d.chainPrev = prevDate;

          if (prevNz && d.nz) {
            NZ.forEach(k => {
              if (prevNz[k] && prevNz[k].c !== undefined && prevNz[k].c !== '') {
                d.nz[k] = Object.assign({}, d.nz[k] || {}, { o: num(prevNz[k].c) });
              }
            });
          }
        }

        const testing = d.testing !== undefined ? num(d.testing) : 5;
        const rateP = num(d.rateP) || 100.23;
        const rateD = num(d.rateD) || 96.68;

        let litP = 0, litD = 0;
        NZ.forEach(k => {
          const n = (d.nz && d.nz[k]) || {};
          if (n.o !== undefined && n.o !== '' && n.c !== undefined && n.c !== '') {
            const net = Math.max(0, r2(num(n.c) - num(n.o) - testing));
            if (k.startsWith('p')) litP = r2(litP + net);
            else litD = r2(litD + net);
          }
        });

        const amtP = r2(litP * rateP);
        const amtD = r2(litD * rateD);
        const sale = r2(amtP + amtD);

        const dayRows = rowsByDate[dt] || [];
        let jCash = 0, jPaytm = 0, jSwipe = 0, udhar = 0, bankCashDeposit = 0;

        dayRows.forEach(r => {
          if (r.opening || r.autoBankSync || r.directBankJama) return;
          const a = num(r.amount);
          const isBank = r.partyId === 'bank_sbi' || r.partyId === 'bank_pnb';
          if (r.pumpCashDeposit || (isBank && r.kind === 'jama' && r.mode === 'pump_cash')) {
            bankCashDeposit = r2(bankCashDeposit + a);
            return;
          }
          if (isBank) return;
          if (r.kind === 'jama') {
            if (r.mode === 'cash') jCash = r2(jCash + a);
            else if (r.mode === 'paytm') jPaytm = r2(jPaytm + a);
            else if (r.mode === 'swipe') jSwipe = r2(jSwipe + a);
          } else if (r.kind === 'udhar') {
            udhar = r2(udhar + a);
          }
        });

        let extraKharcha = 0;
        if (Array.isArray(d.kharchaItems)) {
          d.kharchaItems.forEach(x => { extraKharcha = r2(extraKharcha + num(x && x.amount)); });
        }
        const totalKharcha = r2(num(d.kharcha) + num(d.chaiKhana) + num(d.driverInaam) + extraKharcha);

        const openCash = num(d.openCash);
        const kul = r2(sale + openCash + jCash + jPaytm + jSwipe);
        const paytm = num(d.paytm);
        const swipe = num(d.swipe);
        const bankOut = r2(num(d.malikDiya) + bankCashDeposit);
        const close = r2(kul - paytm - swipe - udhar - totalKharcha - bankOut);

        const expStockP = r2(num(d.openStockP) + num(d.tankerP) - litP);
        const expStockD = r2(num(d.openStockD) + num(d.tankerD) - litD);

        let actStockP = (d.sum && d.sum.actStockP != null) ? num(d.sum.actStockP) : expStockP;
        let actStockD = (d.sum && d.sum.actStockD != null) ? num(d.sum.actStockD) : expStockD;

        if (window.DipChart) {
          if (d.dipP !== undefined && d.dipP !== '') actStockP = r2(window.DipChart.getLiters('petrol', d.dipP));
          if (d.dipD !== undefined && d.dipD !== '') actStockD = r2(window.DipChart.getLiters('diesel', d.dipD));
        }

        const diffP = r2(actStockP - expStockP);
        const diffD = r2(actStockD - expStockD);

        d.sum = Object.assign({}, d.sum || {}, {
          sale, litP, litD, amtP, amtD,
          openCash, close, udhar, jCash, jPaytm, jSwipe,
          totalKharcha, expStockP, expStockD, actStockP, actStockD, diffP, diffD
        });

        prevCloseCash = close;
        prevStockP = actStockP;
        prevStockD = actStockD;
        prevNz = d.nz;
        prevDate = dt;

        batch.set(db.collection('days').doc(dt), d, { merge: true });
        ops++;
        if (ops >= 350) await commitBatch();
      }

      // Update parties & bank balances
      partiesSnap.docs.forEach(pDoc => {
        const pid = pDoc.id;
        const newBal = r2(partyBalMap[pid] || 0);
        batch.update(pDoc.ref, { bal: newBal });
        ops++;
      });

      await commitBatch();
      prog.close();
      alert('✅ हिसाब, मीटर, स्टॉक, पार्टियां और SBI/PNB बैंक लेजर 100% सिंक हो चुके हैं!');
      location.reload();
    } catch (e) {
      prog.close();
      alert('❌ एरर: ' + e.message);
    } finally {
      if (APP.Rules) APP.Rules.sys = false;
    }
  }

  // =========================================================================
  // BUTTON 2: CLEAR PUMP DATA (RESET EVERYTHING TO ZERO)
  // =========================================================================
  async function clearPumpData() {
    const code = prompt(
      '⚠️ सावधान: क्या आप पंप का सारा डेटा ZERO करना चाहते हैं?\n\n' +
      '• सारे दिनों का हिसाब, लेजर, खर्चे और SBI/PNB बैंक एंट्री जीरो हो जाएंगे।\n' +
      '• निजी (Private) पार्टियाँ हमेशा के लिए हट जाएंगी।\n' +
      '• मुख्य पार्टियाँ सुरक्षित रहेंगी और उनका बैलेंस 0 हो जाएगा।\n\n' +
      'कन्फर्म करने के लिए बड़े अक्षरों में लिखें: RESET'
    );
    if (code !== 'RESET') {
      if (code !== null) alert('रीसेट रद्द कर दिया गया।');
      return;
    }

    const prog = showProgress('⏳ पंप डेटा Zero हो रहा है...', 'पुराना लेजर, हिसाब, बैंक और खर्चे साफ किए जा रहे हैं...');
    const db = getDB();
    const APP = window.APP || {};

    try {
      if (APP.Rules) APP.Rules.sys = true;

      const collectionsToWipe = [
        'days', 'ledger', 'bank_deposits', 'tanker_reports',
        'tanker_invoices', 'day_costs', 'runsheets', 'shifts',
        'salary_payments', 'requests', 'rate_requests', 'rate_history'
      ];

      for (const col of collectionsToWipe) {
        try {
          const snap = await db.collection(col).get();
          let b = db.batch(), count = 0;
          for (const doc of snap.docs) {
            b.delete(doc.ref);
            count++;
            if (count >= 400) { await b.commit(); b = db.batch(); count = 0; }
          }
          if (count > 0) await b.commit();
        } catch (err) {
          console.warn('Skip col:', col);
        }
      }

      const pSnap = await db.collection('parties').get();
      let pb = db.batch(), pCount = 0;
      for (const doc of pSnap.docs) {
        const p = doc.data();
        if (p.priv === true || p.isPrivate === true || doc.id.startsWith('priv_')) {
          pb.delete(doc.ref);
        } else {
          pb.update(doc.ref, { bal: 0, openBal: 0, openingBal: 0 });
        }
        pCount++;
        if (pCount >= 400) { await pb.commit(); pb = db.batch(); pCount = 0; }
      }
      if (pCount > 0) await pb.commit();

      // Banks Reset to 0
      await db.collection('parties').doc('bank_sbi').set({ name: 'State Bank of India', isBank: true, pinned: true, bankCode: 'SBI', bal: 0 }, { merge: true });
      await db.collection('parties').doc('bank_pnb').set({ name: 'Punjab National Bank', isBank: true, pinned: true, bankCode: 'PNB', bal: 0 }, { merge: true });

      prog.close();
      alert('✅ पंप का सारा डेटा Zero हो चुका है!');
      location.reload();
    } catch (e) {
      prog.close();
      alert('❌ एरर: ' + e.message);
    } finally {
      if (APP.Rules) APP.Rules.sys = false;
    }
  }

  // =========================================================================
  // BUTTON 3: REALISTIC DEMO DATA (FULL SBI & PNB LEDGER AUTOMATION)
  // =========================================================================
  async function generateRealisticData() {
    if (!confirm(
      '🚀 क्या आप 1 जून से आज तक का 100% सटीक डेटा भरना चाहते हैं?\n\n' +
      '• Paytm & Swipe -> सीधा SBI बैंक खाते में जमा होगा\n' +
      '• गल्ला से SBI खैरना बैंक जमा -> गल्ले से माइनस + SBI में जमा एंट्री\n' +
      '• पार्टी बैंक ट्रांसफर (NEFT) -> SBI में जमा एंट्री\n' +
      '• DG जनरेटर, चाय-खाना, ड्राइवर इनाम -> PNB बैंक खर्चे में दर्ज होगा\n' +
      '• 2-महीने वाले रेट और 12,000L टैंकर नियम सहित बिना पैसे टूटे!'
    )) return;

    const prog = showProgress('⏳ 1 जून से आज तक का डेटा बन रहा है...', 'रजिस्टर, गल्ला, पार्टी व SBI/PNB बैंक लेजर लिखे जा रहे हैं...');
    const db = getDB();
    const APP = window.APP || {};

    try {
      if (APP.Rules) APP.Rules.sys = true;

      // 1. Purana data saaf karein
      const cols = ['days', 'ledger', 'parties', 'bank_deposits', 'rate_history', 'tanker_reports', 'tanker_invoices'];
      for (const c of cols) {
        const snap = await db.collection(c).get();
        let b = db.batch(), count = 0;
        for (const doc of snap.docs) {
          b.delete(doc.ref);
          count++;
          if (count >= 400) { await b.commit(); b = db.batch(); count = 0; }
        }
        if (count > 0) await b.commit();
      }

      // 2. Asli Parties + Pinned SBI & PNB
      const realParties = [
        { id: 'p_pappu', name: 'पप्पू सिंह अधिकारी', phone: '9412097690', vehicles: ['9769', '6637', '0783'], bal: 0 },
        { id: 'p_paras', name: 'पारस सती', phone: '9758200211', vehicles: ['2002 CB', '2002 CC'], bal: 0 },
        { id: 'p_lakshman', name: 'लक्ष्मण सिंह भरड़ा', phone: '9411133880', vehicles: ['3388', '4488'], bal: 0 },
        { id: 'p_chandan', name: 'चंदन देव', phone: '9917099770', vehicles: ['9977', '9884', '1706', '5200'], bal: 0 },
        { id: 'p_deepak', name: 'दीपक साह', phone: '9837006270', vehicles: ['0627'], bal: 0 },
        { id: 'p_kishor', name: 'किशोर उपाध्याय', phone: '8091762889', vehicles: ['3335'], bal: 0 },
        { id: 'p_madhan', name: 'मदन सिंह अधिकारी', phone: '9412907691', vehicles: ['0769'], bal: 0 },
        { id: 'p_nanda', name: 'माँ नंदा स्टोन क्रेशर', phone: '9412055111', vehicles: ['800 ली', 'TIPPER'], bal: 0 },
        { id: 'p_ghanshyam', name: 'घनश्याम तिवारी', phone: '9760008560', vehicles: ['0856'], bal: 0 }
      ];

      const partyBal = {};
      let bP = db.batch();
      realParties.forEach(p => {
        partyBal[p.id] = 0;
        bP.set(db.collection('parties').doc(p.id), { ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });

      // SBI and PNB initial balance
      let sbiBal = 0;
      let pnbBal = 0;

      bP.set(db.collection('parties').doc('bank_sbi'), { name: 'State Bank of India', isBank: true, pinned: true, bankCode: 'SBI', bal: 0 });
      bP.set(db.collection('parties').doc('bank_pnb'), { name: 'Punjab National Bank', isBank: true, pinned: true, bankCode: 'PNB', bal: 0 });
      await bP.commit();

      // 3. Rate History save
      let bH = db.batch();
      bH.set(db.collection('rate_history').doc('2026-06-01'), { date: '2026-06-01', rateP: 100.27, rateD: 95.70 });
      bH.set(db.collection('rate_history').doc('2026-08-01'), { date: '2026-08-01', rateP: 100.20, rateD: 95.66 });
      bH.set(db.collection('rate_history').doc('2026-10-01'), { date: '2026-10-01', rateP: 100.23, rateD: 96.68 });
      bH.set(db.collection('config').doc('rates'), { petrol: 100.23, diesel: 96.68, date: '2026-10-01' }, { merge: true });
      await bH.commit();

      // 4. Date range: 1 June 2026 se Aaj tak
      const startDate = new Date('2026-06-01T12:00:00');
      const now = new Date();
      const todayISO = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const endDate = new Date(todayISO + 'T12:00:00');

      const allDates = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        allDates.push(`${yy}-${mm}-${dd}`);
      }

      let mP1 = 264100, mP2 = 168200, mP3 = 204500, mP4 = 43800;
      let mD1 = 374500, mD2 = 215200, mD3 = 154800, mD4 = 77900;
      let prevCloseCash = 245800.00;
      let prevStockP = 6800.00;
      let prevStockD = 8900.00;

      let b = db.batch(), ops = 0;
      const commitBatch = async () => { if (ops > 0) { await b.commit(); b = db.batch(); ops = 0; } };

      let seed = 777;
      const rand = (min, max) => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return min + Math.floor((seed / 4294967296) * (max - min + 1));
      };

      for (let i = 0; i < allDates.length; i++) {
        const dateStr = allDates[i];
        const mNum = parseInt(dateStr.slice(5, 7), 10);

        // Rates
        let rateP = 100.23, rateD = 96.68;
        if (mNum === 6 || mNum === 7) {
          rateP = 100.27; rateD = 95.70;
        } else if (mNum === 8 || mNum === 9) {
          rateP = 100.20; rateD = 95.66;
        }

        // Daily Nozzle Sale (Register Averages)
        const netP1 = rand(380, 950);
        const netP2 = rand(280, 560);
        const netP3 = rand(350, 780);
        const netP4 = rand(75, 230);

        const netD1 = rand(650, 1180);
        const netD2 = rand(240, 620);
        const netD3 = rand(260, 610);
        const netD4 = rand(40, 380);

        const litP = r2(netP1 + netP2 + netP3 + netP4);
        const litD = r2(netD1 + netD2 + netD3 + netD4);

        const oP1 = mP1, cP1 = mP1 + netP1 + 5; mP1 = cP1;
        const oP2 = mP2, cP2 = mP2 + netP2 + 5; mP2 = cP2;
        const oP3 = mP3, cP3 = mP3 + netP3 + 5; mP3 = cP3;
        const oP4 = mP4, cP4 = mP4 + netP4 + 5; mP4 = cP4;

        const oD1 = mD1, cD1 = mD1 + netD1 + 5; mD1 = cD1;
        const oD2 = mD2, cD2 = mD2 + netD2 + 5; mD2 = cD2;
        const oD3 = mD3, cD3 = mD3 + netD3 + 5; mD3 = cD3;
        const oD4 = mD4, cD4 = mD4 + netD4 + 5; mD4 = cD4;

        const amtP = r2(litP * rateP);
        const amtD = r2(litD * rateD);
        const totalSale = r2(amtP + amtD);

        // Party Udhar Entries (Exact Rupee Values)
        let dayUdhar = 0;
        const numUdhars = rand(5, 8);
        const wholeRupeeAmounts = [2000, 2600, 3150, 3446, 3810, 4200, 4400, 4500, 4600, 4950, 5300, 5500, 6100, 6891, 7700, 8035, 8500, 9760, 10500];

        for (let u = 0; u < numUdhars; u++) {
          let p = realParties[(i + u * 2) % realParties.length];
          if (p.id === 'p_nanda' && !(i % 12 === 0 && u === 0)) {
            p = realParties[(i + u + 1) % 7];
          }

          const veh = p.vehicles[(i + u) % p.vehicles.length];
          let fuel = 'diesel', fRate = rateD, amt = 0, lQty = 0;

          if (p.id === 'p_nanda') {
            lQty = 800;
            amt = Math.round(lQty * fRate);
            lQty = r2(amt / fRate);
          } else {
            const isPetrol = (u === 4);
            fuel = isPetrol ? 'petrol' : 'diesel';
            fRate = isPetrol ? rateP : rateD;
            amt = wholeRupeeAmounts[(i + u * 3) % wholeRupeeAmounts.length];
            lQty = r2(amt / fRate);
          }

          dayUdhar = r2(dayUdhar + amt);
          partyBal[p.id] = r2(partyBal[p.id] + amt);

          b.set(db.collection('ledger').doc(), {
            partyId: p.id, partyName: p.name, date: dateStr,
            time: `1${u}:20`, kind: 'udhar', vehicle: veh,
            fuel, rate: fRate, litre: lQty, amount: amt,
            createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops++;
        }

        // Party Cash Jama
        let jCash = 0;
        if (i % 2 === 0) {
          const p = realParties[(i * 2) % 7];
          jCash = [25000, 35000, 44700, 50890, 65000, 87500][i % 6];
          partyBal[p.id] = r2(partyBal[p.id] - jCash);
          b.set(db.collection('ledger').doc(), {
            partyId: p.id, partyName: p.name, date: dateStr,
            time: '15:10', kind: 'jama', mode: 'cash', amount: jCash,
            note: 'नकद जमा', createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops++;
        }

        // Party Direct Bank Transfer -> SBI Bank Jama
        let jBank = 0;
        if (i % 4 === 1) {
          const p = realParties[(i + 3) % realParties.length];
          jBank = [50000, 75000, 100000][i % 3];
          partyBal[p.id] = r2(partyBal[p.id] - jBank);
          sbiBal = r2(sbiBal + jBank);

          const payId = `PAY-${dateStr.replace(/-/g, '').slice(2)}`;
          const bRef = db.collection('bank_deposits').doc();
          b.set(bRef, {
            bank: 'SBI', date: dateStr, amount: jBank, mode: 'neft',
            partyId: p.id, partyName: p.name, direct: true, payId,
            note: `${p.name} बैंक खाते में NEFT जमा`, by: 'neeraj@mazda-pump.in'
          });

          // Party Ledger Entry
          b.set(db.collection('ledger').doc(), {
            partyId: p.id, partyName: p.name, date: dateStr,
            time: '16:00', kind: 'jama', mode: 'bank', payMode: 'neft',
            amount: jBank, bankId: bRef.id, payId, directBankJama: true,
            createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });

          // SBI Bank Ledger Entry
          b.set(db.collection('ledger').doc(), {
            partyId: 'bank_sbi', partyName: 'State Bank of India', date: dateStr,
            time: '16:00', kind: 'jama', mode: 'bank', amount: jBank,
            note: `पार्टी जमा: ${p.name} (NEFT)`, autoBankSync: true,
            createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops += 3;
        }

        // Paytm / UPI & Card Swipe
        const paytm = rand(125000, 275000);
        const swipe = (i % 3 === 0) ? 0 : [10700, 14500, 18200, 22955, 30563][i % 5];

        // 1. PAYTM -> SBI LEDGER MEIN JAMA ENTRY
        if (paytm > 0) {
          sbiBal = r2(sbiBal + paytm);
          b.set(db.collection('ledger').doc(), {
            partyId: 'bank_sbi', partyName: 'State Bank of India', date: dateStr,
            time: '21:05', kind: 'jama', mode: 'paytm', amount: paytm,
            note: 'Paytm/UPI दैनिक बिक्री सेटलमेंट जमा', autoBankSync: true,
            createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops++;
        }

        // 2. SWIPE -> SBI LEDGER MEIN JAMA ENTRY
        if (swipe > 0) {
          sbiBal = r2(sbiBal + swipe);
          b.set(db.collection('ledger').doc(), {
            partyId: 'bank_sbi', partyName: 'State Bank of India', date: dateStr,
            time: '21:10', kind: 'jama', mode: 'swipe', amount: swipe,
            note: 'कार्ड स्वाइप (Pine Labs / EDC) जमा', autoBankSync: true,
            createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops++;
        }

        // Daily Kharcha
        const dgLit = (i % 5 === 0) ? 10 : 5;
        const kharchaDG = Math.round(dgLit * rateD);
        const chaiKhana = (i % 2 === 0) ? 170 : 220;
        const driverInaam = (i % 3 === 0) ? 200 : 0;
        const totalKharcha = r2(kharchaDG + chaiKhana + driverInaam);

        // 3. KHARCHE (DG, CHAI-KHANA, INAAM) -> PNB BANK LEDGER ENTRY (UDHAR / EXPENSE)
        if (totalKharcha > 0) {
          pnbBal = r2(pnbBal - totalKharcha);
          b.set(db.collection('ledger').doc(), {
            partyId: 'bank_pnb', partyName: 'Punjab National Bank', date: dateStr,
            time: '20:30', kind: 'udhar', amount: totalKharcha,
            note: `दैनिक पंप खर्चा (DG: ₹${kharchaDG}, चाय-खाना: ₹${chaiKhana}${driverInaam ? ', इनाम: ₹' + driverInaam : ''})`,
            autoBankSync: true, createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops++;
        }

        // Galla & Cash Flow
        const openCash = prevCloseCash;
        const kulGalla = r2(totalSale + openCash + jCash);
        const availableCash = r2(kulGalla - paytm - swipe - dayUdhar - totalKharcha);

        // 4. GALLE SE CASH JAMA -> SBI KHAIRNA (GALLE SE MINUS + SBI MEIN JAMA ENTRY)
        let malikDiya = 0;
        if (availableCash > 450000) {
          malikDiya = Math.floor((availableCash - 130000) / 10000) * 10000;
          sbiBal = r2(sbiBal + malikDiya);

          b.set(db.collection('bank_deposits').doc(`sbi_${dateStr}`), {
            bank: 'SBI', date: dateStr, amount: malikDiya, mode: 'cash',
            payId: `PAY-SBI-${dateStr.slice(2)}`, note: 'बैंक जमा S.B.I खैरना', by: 'neeraj@mazda-pump.in'
          });

          // SBI Bank Ledger Entry
          b.set(db.collection('ledger').doc(), {
            partyId: 'bank_sbi', partyName: 'State Bank of India', date: dateStr,
            time: '14:30', kind: 'jama', mode: 'cash', amount: malikDiya,
            note: 'पंप गल्ले से कैश जमा (S.B.I खैरना शाखा)', autoBankSync: true,
            createdOn: dateStr, by: 'neeraj@mazda-pump.in'
          });
          ops += 2;
        }

        const closeCash = r2(availableCash - malikDiya);
        prevCloseCash = closeCash;

        // Tanker Rule: 12,000L in a single tanker
        let tankerP = 0, tankerD = 0;
        const remP = prevStockP - litP;
        const remD = prevStockD - litD;

        if (remP < 3200 && remD < 5500) {
          tankerP = 4000; tankerD = 8000;
        } else if (remP < 2500) {
          tankerP = 6000; tankerD = 6000;
        } else if (remD < 3800) {
          if (remP < 5500) {
            tankerP = 4000; tankerD = 8000;
          } else {
            tankerP = 0; tankerD = 12000;
          }
        }

        const openStockP = prevStockP;
        const openStockD = prevStockD;
        const expP = r2(openStockP + tankerP - litP);
        const expD = r2(openStockD + tankerD - litD);

        const diffP = -rand(2, 9);
        const diffD = -rand(4, 14);
        const actP = r2(expP + diffP);
        const actD = r2(expD + diffD);

        prevStockP = actP;
        prevStockD = actD;

        // Day Document
        const dayDoc = {
          date: dateStr,
          status: dateStr === todayISO ? 'open' : 'submitted',
          testing: 5, rateP, rateD, openCash,
          paytm, swipe, kharcha: kharchaDG, chaiKhana, driverInaam,
          kharchaItems: [], malikDiya, openStockP, openStockD,
          tankerP, tankerD,
          dipP: r2(Math.max(35, Math.min(185, actP / 82))),
          dipD: r2(Math.max(35, Math.min(185, actD / 98))),
          nz: {
            p1: { o: oP1, c: cP1, t: 5 }, p2: { o: oP2, c: cP2, t: 5 }, p3: { o: oP3, c: cP3, t: 5 }, p4: { o: oP4, c: cP4, t: 5 },
            d1: { o: oD1, c: cD1, t: 5 }, d2: { o: oD2, c: cD2, t: 5 }, d3: { o: oD3, c: cD3, t: 5 }, d4: { o: oD4, c: cD4, t: 5 }
          },
          sum: {
            sale: totalSale, litP, litD, amtP, amtD,
            openCash, close: closeCash,
            actStockP: actP, actStockD: actD, expStockP: expP, expStockD: expD,
            diffP, diffD, udhar: dayUdhar, totalKharcha, jCash, jBank
          },
          by: 'neeraj@mazda-pump.in'
        };

        b.set(db.collection('days').doc(dateStr), dayDoc);
        ops++;

        if (ops >= 300) await commitBatch();
        if (i % 15 === 0 && prog.querySelector('.sheet')) {
          prog.querySelector('.sheet').innerHTML = `<h3 style="color:#f4b41a;">⏳ डेटा भरा जा रहा है: ${i + 1} / ${allDates.length} दिन</h3><p class="mut">तारीख: ${dateStr}</p>`;
        }
      }

      // Party Balances Update
      for (const p of realParties) {
        b.update(db.collection('parties').doc(p.id), { bal: r2(partyBal[p.id]) });
        ops++;
      }

      // SBI and PNB Final Balances Update
      b.update(db.collection('parties').doc('bank_sbi'), { bal: r2(sbiBal) });
      b.update(db.collection('parties').doc('bank_pnb'), { bal: r2(pnbBal) });
      ops += 2;

      await commitBatch();
      prog.close();
      alert(`✅ 1 जून से आज (${todayISO}) तक का 100% सटीक डेटा भर गया है!\n\n• Paytm, Swipe व SBI नकद जमा SBI बैंक खाते में जुड़ चुके हैं।\n• DG व दैनिक खर्चे PNB बैंक खाते में दर्ज हो चुके हैं।`);
      location.reload();
    } catch (e) {
      prog.close();
      alert('❌ एरर: ' + e.message);
    } finally {
      if (APP.Rules) APP.Rules.sys = false;
    }
  }

  // =========================================================================
  // UI PANEL INJECTION
  // =========================================================================
  function getControlCardsHTML() {
    return `
      <div class="card glass-card" id="sa-master-panel" style="background:linear-gradient(135deg,#071329,#0f2547);border:2px solid #f4b41a;color:#fff;padding:16px;border-radius:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <span style="font-size:26px;">👑</span>
          <div>
            <h3 style="color:#f4b41a;margin:0;font-size:17px;">Super Owner Control (Full Bank Sync)</h3>
            <div style="color:#94a3b8;font-size:11px;">माज़दा पंप मास्टर टूल्स (SBI/PNB Auto Sync, Demo & Reset)</div>
          </div>
        </div>

        <!-- 1. AUTO FIX CHAIN BUTTON -->
        <div style="background:rgba(37,99,235,0.18);border:1px solid #3b82f6;border-radius:12px;padding:12px;margin-bottom:12px;">
          <b style="color:#93c5fd;font-size:14px;display:block;margin-bottom:4px;">1. 🔄 पूरा हिसाब व बैंक ऑटो-फिक्स करें (Chain Sync)</b>
          <div style="color:#cbd5e1;font-size:11px;margin-bottom:10px;">शुरू से आज तक के सारे दिन (AD कैश, मीटर, स्टॉक, पार्टी खाता और SBI/PNB बैंक लेजर) 1 क्लिक में सिंक करें।</div>
          <button id="btn-sa-autofix" class="btn full" style="background:#2563eb;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;width:100%;cursor:pointer;">
            🔄 Auto-Fix & Sync All Days Hisab
          </button>
        </div>

        <!-- 2. DEMO DATA GENERATOR BUTTON -->
        <div style="background:rgba(16,185,129,0.15);border:1px solid #10b981;border-radius:12px;padding:12px;margin-bottom:12px;">
          <b style="color:#6ee7b7;font-size:14px;display:block;margin-bottom:4px;">2. 🚀 1 जून से आज तक का Demo Data भरें</b>
          <div style="color:#cbd5e1;font-size:11px;margin-bottom:10px;">Paytm, Swipe, SBI नकद जमा SBI बैंक खाते में और DG, चाय-खाना खर्चे PNB बैंक खाते में ऑटोमेटिक जुड़ेंगे।</div>
          <button id="btn-sa-demo" class="btn full" style="background:#059669;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;width:100%;cursor:pointer;">
            🚀 Auto-Fill Demo Data (1 June - Today)
          </button>
        </div>

        <!-- 3. CLEAR PUMP DATA BUTTON -->
        <div style="background:rgba(220,38,38,0.15);border:1px solid #ef4444;border-radius:12px;padding:12px;">
          <b style="color:#fca5a5;font-size:14px;display:block;margin-bottom:4px;">3. ⚠️ Clear Pump Data (सब कुछ Zero करें)</b>
          <div style="color:#cbd5e1;font-size:11px;margin-bottom:10px;">हिसाब, लेजर, मीटर, SBI और PNB बैंक ₹0 हो जाएंगे और निजी पार्टियाँ हट जाएंगी (मुख्य पार्टियाँ वैसी ही रहेंगी)।</div>
          <button id="btn-sa-clear" class="btn full" style="background:#dc2626;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;width:100%;cursor:pointer;">
            ⚠️ Clear Pump Data (Zero All)
          </button>
        </div>
      </div>
    `;
  }

  function bindControlEvents(root) {
    const bFix = (root || document).querySelector('#btn-sa-autofix');
    const bDemo = (root || document).querySelector('#btn-sa-demo');
    const bClear = (root || document).querySelector('#btn-sa-clear');
    if (bFix) bFix.onclick = autoFixAllDaysChain;
    if (bDemo) bDemo.onclick = generateRealisticData;
    if (bClear) bClear.onclick = clearPumpData;
  }

  window.autoFixAllDaysChain = autoFixAllDaysChain;
  window.clearPumpData = clearPumpData;
  window.generateRealisticData = generateRealisticData;

  const APP = window.APP;
  if (APP) {
    APP.views = APP.views || {};
    APP.recalculateAllDaysChain = autoFixAllDaysChain;

    APP.views.super_admin = async function () {
      const main = document.querySelector('#main');
      if (!main) return;
      main.innerHTML = getControlCardsHTML();
      bindControlEvents(main);
    };

    const origMore = APP.views.more;
    APP.views.more = async function () {
      if (origMore) await origMore.apply(this, arguments);
      if (!isSuperAdmin()) return;
      const main = document.querySelector('#main');
      if (!main || document.querySelector('#sa-master-panel')) return;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = getControlCardsHTML();
      main.insertBefore(wrapper.firstElementChild, main.firstChild);
      bindControlEvents(main);
    };
  }

  setInterval(() => {
    const ownerContent = document.querySelector('#p-content');
    const activeMoreTab = document.querySelector('.p-nav button[data-tab="more"].active');
    if (ownerContent && activeMoreTab && !document.querySelector('#sa-master-panel')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = getControlCardsHTML();
      ownerContent.insertBefore(wrapper.firstElementChild, ownerContent.firstChild);
      bindControlEvents(ownerContent);
    }
  }, 600);

  console.log('[Mazda SuperAdmin v2.1] Full SBI/PNB Bank Sync Engine Loaded ✓');
})();
