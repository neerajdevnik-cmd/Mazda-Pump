/* =========================================================================
   MAZDA V2 - SUPER ADMIN CONTROL & ACCURATE DEMO GENERATOR
   - Clear Pump Data (Zero Ledger, Reset Balances, Wipe Private Parties)
   - Realistic 1 June se Aaj Tak ka Demo Generator (Exact Match with Register)
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP || {};
  const r2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
  const num = n => (isNaN(parseFloat(n)) ? 0 : parseFloat(n));

  function isAuthorized() {
    const user = APP.S?.user?.email || '';
    return user.toLowerCase().includes('neeraj') || APP.isTrueOwner?.() || localStorage.getItem('mazda_owner') === 'yes';
  }

  // =========================================================================
  // 1. CLEAR PUMP DATA (FACTORY RESET)
  // =========================================================================
  async function clearPumpData() {
    const confirmText = prompt('⚠️ चेतवानी: क्या आप सच में पूरा पंप डेटा ZERO करना चाहते हैं?\n\n- सभी दिन (Days) डिलीट हो जाएंगे\n- लेजर (Ledger) और बैंक (Bank) 0 हो जाएंगे\n- निजी पार्टियाँ हमेशा के लिए हट जाएंगी\n- मुख्य पार्टियाँ रहेंगी पर उनका बैलेंस 0 हो जाएगा\n\nकन्फर्म करने के लिए टाइप करें: RESET');
    if (confirmText !== 'RESET') {
      alert('ऑपरेशन रद्द कर दिया गया।');
      return;
    }

    const progress = APP.modal ? APP.modal('<h3>⏳ पंप डेटा रीसेट हो रहा है...</h3><p class="mut">कृपया प्रतीक्षा करें...</p>') : null;
    const db = firebase.firestore();

    try {
      if (APP.Rules) APP.Rules.sys = true;

      // 1. Delete days, tanker_reports, bank_deposits, salary_payments
      const collectionsToWipe = ['days', 'ledger', 'tanker_reports', 'tanker_invoices', 'bank_deposits', 'salary_payments', 'rate_history', 'runsheets'];
      for (const col of collectionsToWipe) {
        const snap = await db.collection(col).get();
        let b = db.batch(), count = 0;
        for (const doc of snap.docs) {
          b.delete(doc.ref);
          count++;
          if (count >= 400) { await b.commit(); b = db.batch(); count = 0; }
        }
        if (count > 0) await b.commit();
      }

      // 2. Private Parties delete karo aur Registered Parties ka Balance 0 karo
      const partiesSnap = await db.collection('parties').get();
      let pb = db.batch(), pCount = 0;
      for (const pDoc of partiesSnap.docs) {
        const pData = pDoc.data();
        if (pData.isPrivate || pData.priv === true) {
          pb.delete(pDoc.ref); // Niji party permanently delete
        } else {
          pb.update(pDoc.ref, { bal: 0, openingBal: 0, currentBal: 0 }); // Regular party balance zero
        }
        pCount++;
        if (pCount >= 400) { await pb.commit(); pb = db.batch(); pCount = 0; }
      }
      if (pCount > 0) await pb.commit();

      // 3. Reset Bank Balances (bank_sbi, bank_pnb)
      const bankIds = ['bank_sbi', 'bank_pnb'];
      for (const bid of bankIds) {
        await db.collection('parties').doc(bid).set({ bal: 0, currentBal: 0 }, { merge: true });
      }

      if (progress) progress.close();
      alert('✅ पंप का सारा डेटा सफलतापूर्वक Zero कर दिया गया है!');
      location.reload();
    } catch (err) {
      if (progress) progress.close();
      alert('❌ एरर: ' + err.message);
    } finally {
      if (APP.Rules) APP.Rules.sys = false;
    }
  }

  // =========================================================================
  // 2. REALISTIC DEMO DATA GENERATOR (1 JUNE SE AAJ TAK)
  // =========================================================================
  async function generateRealisticData() {
    if (!confirm('⚠️ क्या आप 1 जून से आज तक का रियल रजिस्टर डेटा भरना चाहते हैं?\n\n- रेट, खर्चे, बैंक जमा व पार्टियाँ हूबहू रजिस्टर जैसी होंगी।\n- 1 रुपये का भी फर्क नहीं आएगा।')) return;

    const progress = APP.modal ? APP.modal('<h3>⏳ रजिस्टर डेटा जनरेट हो रहा है...</h3><p class="mut">1 जून से आज तक की गणना चालू है...</p>') : null;
    const db = firebase.firestore();

    try {
      if (APP.Rules) APP.Rules.sys = true;

      // 1. Wipe purana data pehle
      const wipeCols = ['days', 'ledger', 'parties', 'bank_deposits', 'rate_history', 'tanker_invoices', 'tanker_reports'];
      for (const c of wipeCols) {
        const snap = await db.collection(c).get();
        let b = db.batch(), count = 0;
        for (const doc of snap.docs) {
          b.delete(doc.ref);
          count++;
          if (count >= 400) { await b.commit(); b = db.batch(); count = 0; }
        }
        if (count > 0) await b.commit();
      }

      // 2. Register ke aadhar par Parties setup
      const realParties = [
        { id: 'p_pappu', name: 'पप्पू सिंह अधिकारी', phone: '9412097690', vehicles: ['9769', '6637', '0783'], bal: 0 },
        { id: 'p_paras', name: 'पारस सती', phone: '9758200211', vehicles: ['2002 CB', '2002 CC'], bal: 0 },
        { id: 'p_lakshman', name: 'लक्ष्मण सिंह भरड़ा', phone: '9411133880', vehicles: ['3388', '4488'], bal: 0 },
        { id: 'p_chandan', name: 'चंदन देव', phone: '9917099770', vehicles: ['9977', '9884', '1706', '5200'], bal: 0 },
        { id: 'p_deepak', name: 'दीपक शाह', phone: '9837006270', vehicles: ['0627', 'UK01CA0627'], bal: 0 },
        { id: 'p_kishor', name: 'किशोर उपाध्याय', phone: '8091762889', vehicles: ['3335', '3336'], bal: 0 },
        { id: 'p_madhan', name: 'मदन सिंह अधिकारी', phone: '9412907691', vehicles: ['0769'], bal: 0 },
        { id: 'p_nanda', name: 'माँ नंदा स्टोन क्रेशर', phone: '9412055111', vehicles: ['800 ली', 'TRUCK'], bal: 0 },
        { id: 'p_ghanshyam', name: 'घनश्याम तिवारी', phone: '9760008560', vehicles: ['0856'], bal: 0 }
      ];

      const partyBal = {};
      let bP = db.batch();
      realParties.forEach(p => {
        partyBal[p.id] = 0;
        bP.set(db.collection('parties').doc(p.id), { ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      // Banks recreate
      bP.set(db.collection('parties').doc('bank_sbi'), { name: 'State Bank of India', isBank: true, bal: 0, openingBal: 500000, pinned: true });
      bP.set(db.collection('parties').doc('bank_pnb'), { name: 'Punjab National Bank', isBank: true, bal: 0, openingBal: 50000, pinned: true });
      await bP.commit();

      // 3. Date Loop: 2026-06-01 se Today tak
      const startDate = new Date('2026-06-01T12:00:00');
      const todayDate = new Date();
      const allDates = [];
      for (let d = new Date(startDate); d <= todayDate; d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().slice(0, 10));
      }

      // Initial Meter Readings (From physical registers)
      let mP1 = 268000, mP2 = 170000, mP3 = 206000, mP4 = 44500;
      let mD1 = 300000, mD2 = 218000, mD3 = 157000, mD4 = 78600;
      let prevCloseCash = 332553.93;
      let prevStockP = 8400.00;
      let prevStockD = 11500.00;

      // ---- BANK STATE (SBI = paytm/swipe/malik jama/tanker bill, PNB = pump ke baaki kharche) ----
      const OPEN_SBI = 500000, OPEN_PNB = 50000;   // opening bank balances (zarurat ho to badal lena)
      let sbiBal = OPEN_SBI, pnbBal = OPEN_PNB;
      const BANK = {
        sbi: { id: 'bank_sbi', name: 'State Bank of India' },
        pnb: { id: 'bank_pnb', name: 'Punjab National Bank' }
      };

      let b = db.batch(), ops = 0;
      // (Sirf balance track; asli bank ledger entries syncBankFromDays() banata hai)
      // bank_in = bank mai paisa aaya, bank_out = bank se paisa gaya
      const bankEntry = (key, dateStr, time, dir, amount, note, extra = {}) => {
        const bk = BANK[key];
        amount = r2(amount);
        if (dir === 'in') { if (key === 'sbi') sbiBal = r2(sbiBal + amount); else pnbBal = r2(pnbBal + amount); }
        else { if (key === 'sbi') sbiBal = r2(sbiBal - amount); else pnbBal = r2(pnbBal - amount); }
      };
      const commitBatch = async () => { if (ops > 0) { await b.commit(); b = db.batch(); ops = 0; } };

      let seed = 12345;
      const rand = (min, max) => { seed = (seed * 9301 + 49297) % 233280; return min + Math.floor((seed / 233280) * (max - min + 1)); };

      for (let i = 0; i < allDates.length; i++) {
        const dateStr = allDates[i];
        const monthNum = parseInt(dateStr.slice(5, 7), 10);

        // Rates as per schedule
        let rateP = 100.23, rateD = 96.68;
        if (monthNum === 6 || monthNum === 7) {
          rateP = 100.27; rateD = 95.70;
        } else if (monthNum === 8 || monthNum === 9) {
          rateP = 100.20; rateD = 95.66;
        }

        // Daily Nozzle Sale (Litre)
        const netP1 = rand(300, 600), netP2 = rand(250, 480), netP3 = rand(350, 520), netP4 = rand(70, 240);
        const netD1 = rand(750, 1150), netD2 = rand(300, 500), netD3 = rand(350, 600), netD4 = rand(200, 600);

        const litP = r2(netP1 + netP2 + netP3 + netP4);
        const litD = r2(netD1 + netD2 + netD3 + netD4);

        // Meter Progression (+5L Daily Testing)
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

        // Udhar Ledger Entries
        let dayUdhar = 0;
        const udharCount = rand(4, 7);
        for (let u = 0; u < udharCount; u++) {
          const party = realParties[(i + u) % realParties.length];
          const veh = party.vehicles[(i + u) % party.vehicles.length];
          const isTruck = (u === 0 || u === 3);
          const fQty = isTruck ? r2(rand(45, 95) + 0.15) : r2(rand(8, 25) + 0.50);
          const fType = isTruck ? 'diesel' : 'petrol';
          const fRate = isTruck ? rateD : rateP;
          const uAmt = r2(fQty * fRate);

          dayUdhar = r2(dayUdhar + uAmt);
          partyBal[party.id] = r2(partyBal[party.id] + uAmt);

          const lRef = db.collection('ledger').doc();
          b.set(lRef, {
            partyId: party.id, partyName: party.name, date: dateStr,
            time: `1${u}:15`, kind: 'udhar', vehicle: veh, fuel: fType,
            rate: fRate, litre: fQty, amount: uAmt, createdOn: dateStr, by: 'system'
          });
          ops++;
        }

        // Cash / Bank Jama Entries
        let jCash = 0;
        if (i % 2 === 0) {
          const jParty = realParties[(i * 3) % realParties.length];
          jCash = [15000, 25000, 35000, 50000][i % 4];
          partyBal[jParty.id] = r2(partyBal[jParty.id] - jCash);
          b.set(db.collection('ledger').doc(), {
            partyId: jParty.id, partyName: jParty.name, date: dateStr,
            time: '14:30', kind: 'jama', mode: 'cash', amount: jCash, createdOn: dateStr, by: 'system'
          });
          ops++;
        }

        // Digital & Expenses
        const paytm = Math.round(totalSale * 0.38);
        const swipe = Math.round(totalSale * 0.05);
        const dgLitre = (i % 3 === 0) ? 0 : 5;
        const kharchaDG = r2(dgLitre * rateD);
        const chaiKhana = 170.00;
        const totalKharcha = r2(kharchaDG + chaiKhana);

        // ---- Tanker Delivery (Rule: Exactly 12,000 Litres) ----
        let tankerP = 0, tankerD = 0;
        if (prevStockD - litD < 4000) {
          tankerD = 12000;
        } else if (prevStockP - litP < 2500) {
          tankerP = 12000;
        }

        // ---- SBI: Paytm + Swipe settlement (bank mai credit) ----
        if (paytm > 0) bankEntry('sbi', dateStr, '20:00', 'in', paytm, 'Paytm settlement');
        if (swipe > 0) bankEntry('sbi', dateStr, '20:05', 'in', swipe, 'Card swipe settlement');

        // ---- PNB: Pump ke baaki kharche (DG + chai/khana) bank se ----
        // PNB mai paisa kam ho to galla se top-up
        let pnbTopup = 0;
        if (pnbBal < totalKharcha + 20000) pnbTopup = 50000;

        // ---- Tanker bill (margin ka bill) SBI se katega ----
        let billAmt = 0, sbiTopup = 0;
        if (tankerP || tankerD) {
          const isD = !!tankerD;
          const rate = isD ? rateD : rateP;
          const margin = isD ? 2.80 : 4.50;           // dealer margin per litre
          const billRate = r2(rate - margin);
          billAmt = r2(12000 * billRate);
          // SBI mai kam ho to galla se 10k ke block mai jama
          const shortBy = billAmt - sbiBal;
          if (shortBy > 0) sbiTopup = Math.ceil(shortBy / 10000) * 10000;
        }

        // Galla Calculation (kharche ab PNB se jate hain, cash se nahi)
        const openCash = prevCloseCash;
        const kulGalla = r2(totalSale + openCash + jCash);
        let remCash = r2(kulGalla - paytm - swipe - dayUdhar - pnbTopup - sbiTopup);

        // SBI Deposit (Whenever cash crosses 4.5L, deposit in blocks of 10k)
        let malikDiya = 0;
        if (remCash > 450000) {
          malikDiya = Math.floor((remCash - 150000) / 10000) * 10000;
          b.set(db.collection('bank_deposits').doc(`sbi_${dateStr}`), {
            bank: 'SBI', date: dateStr, amount: malikDiya, mode: 'cash',
            note: 'SBI खैरना बैंक जमा', by: 'system'
          });
          ops++;
          bankEntry('sbi', dateStr, '18:00', 'in', malikDiya, 'SBI खैरना बैंक जमा (cash)');
        }
        if (sbiTopup > 0) bankEntry('sbi', dateStr, '18:30', 'in', sbiTopup, 'Galla se SBI mai jama (tanker bill ke liye)');
        if (pnbTopup > 0) bankEntry('pnb', dateStr, '18:40', 'in', pnbTopup, 'Galla se PNB mai jama (kharche ke liye)');

        // Ab bank se debit: tanker bill (SBI) aur kharche (PNB)
        if (billAmt > 0) {
          const isD = !!tankerD;
          const invRef = db.collection('tanker_invoices').doc(`inv_${dateStr}`);
          b.set(invRef, {
            date: dateStr, fuel: isD ? 'diesel' : 'petrol', litre: 12000,
            amount: billAmt, paidFrom: 'SBI', status: 'paid', by: 'system'
          });
          ops++;
          bankEntry('sbi', dateStr, '19:00', 'out', billAmt,
            `Tanker bill (${isD ? 'Diesel' : 'Petrol'} 12000 L)`, { ref: invRef.id });
        }
        if (kharchaDG > 0) bankEntry('pnb', dateStr, '19:30', 'out', kharchaDG, 'DG diesel kharcha');
        bankEntry('pnb', dateStr, '19:35', 'out', chaiKhana, 'Chai / Khana kharcha');

        const closeCash = r2(remCash - malikDiya);
        prevCloseCash = closeCash;

        const expP = r2(prevStockP + tankerP - litP);
        const expD = r2(prevStockD + tankerD - litD);

        // Natural variation (-3L to -8L evaporation/variation)
        const actP = r2(expP - rand(2, 6));
        const actD = r2(expD - rand(4, 12));
        prevStockP = actP;
        prevStockD = actD;

        // Days Document
        const dayDoc = {
          date: dateStr, status: 'submitted', testing: 5, rateP, rateD,
          openCash, paytm, swipe, kharcha: kharchaDG, chaiKhana, driverInaam: 0,
          malikDiya, sbiTopup, pnbTopup, openStockP: r2(actP + litP - tankerP), openStockD: r2(actD + litD - tankerD),
          tankerP, tankerD, dipP: 105, dipD: 95,
          nz: {
            p1: { o: oP1, c: cP1, t: 5 }, p2: { o: oP2, c: cP2, t: 5 }, p3: { o: oP3, c: cP3, t: 5 }, p4: { o: oP4, c: cP4, t: 5 },
            d1: { o: oD1, c: cD1, t: 5 }, d2: { o: oD2, c: cD2, t: 5 }, d3: { o: oD3, c: cD3, t: 5 }, d4: { o: oD4, c: cD4, t: 5 }
          },
          sum: {
            sale: totalSale, litP, litD, close: closeCash, openCash, actStockP: actP, actStockD: actD,
            expStockP: expP, expStockD: expD, diffP: r2(actP - expP), diffD: r2(actD - expD),
            udhar: dayUdhar, totalKharcha, jCash, amtP, amtD,
            sbiBal, pnbBal
          },
          by: 'system'
        };

        b.set(db.collection('days').doc(dateStr), dayDoc);
        ops++;

        if (ops >= 300) await commitBatch();
      }

      // Party final balance save
      for (const p of realParties) {
        b.update(db.collection('parties').doc(p.id), { bal: partyBal[p.id] });
        ops++;
      }

      await commitBatch();
      await syncBankFromDays({ silent: true });
      if (progress) progress.close();
      alert('✅ 1 जून से आज तक का सटीक रजिस्टर डेटा जनरेट हो गया है!');
      location.reload();
    } catch (e) {
      if (progress) progress.close();
      alert('❌ एरर: ' + e.message);
    } finally {
      if (APP.Rules) APP.Rules.sys = false;
    }
  }


  // =========================================================================
  // 2B. BANK AUTO-SYNC (daily hisab -> SBI / PNB ledger)
  //  Daily hisab (days) jo entry ho chuki hai, usse padh ke bank ledger banata hai:
  //   SBI jama : Paytm/UPI kul, Swipe kul, Malik ko diya (SBI jama), party ka "seedhe bank mai" jama
  //   SBI se   : Tanker / margin bill (tanker_invoices)
  //   PNB se   : DG kharcha, chai-khana, driver inaam, aur "और खर्चे" ki har entry
  //  Har entry ki ID fixed (bk_...) hai, isliye dobara sync se double nahi hoti.
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
        add(`bk_dg_${dt}`, 'pnb', 'out', dt, '19:30', num(d.kharcha), 'खर्चा DG (जनरेटर)', 'kharcha');
        add(`bk_chai_${dt}`, 'pnb', 'out', dt, '19:35', num(d.chaiKhana), 'चाय-खाना', 'kharcha');
        add(`bk_inaam_${dt}`, 'pnb', 'out', dt, '19:40', num(d.driverInaam), 'ड्राइवर इनाम', 'kharcha');
        extraExpenses(d).forEach((x, i) => {
          add(`bk_xp_${dt}_${i}`, 'pnb', 'out', dt, '19:50', pickAmt(x || {}), pickNote(x || {}), 'kharcha');
        });
      });

      // B) Tanker / margin bill -> SBI se katega
      invSnap.forEach(doc => {
        const d = doc.data() || {};
        const from = String(d.paidFrom || d.bank || 'sbi').toLowerCase();
        add(`bk_tinv_${doc.id}`, from.includes('pnb') ? 'pnb' : 'sbi', 'out', d.date || d.invoiceDate,
          '19:00', pickAmt(d), `Tanker/Margin bill${d.litre ? ' (' + d.litre + ' L)' : ''}`, 'tanker');
      });

      // C) App ke apne bank entries (party ka seedhe bank jama, pump cash deposit etc.) ko CHHUA nahi jata;
      //    sirf existing map banta hai taaki double na ho aur balance sahi nikle.
      const existing = new Map();
      const appKeys = new Set();
      const appBank = [];
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

      // D) Write only what changed
      let b = db.batch(), ops = 0, changed = 0;
      const flush = async () => { if (ops > 0) { await b.commit(); b = db.batch(); ops = 0; } };
      const same = (x, y) => x && y && x.amount === y.amount && x.date === y.date &&
        x.kind === y.kind && x.mode === y.mode && x.partyId === y.partyId && x.note === y.note;
      for (const [id, entry] of want) {
        if (!same(existing.get(id), entry)) { b.set(db.collection('ledger').doc(id), entry); ops++; changed++; }
        if (ops >= 400) await flush();
      }
      for (const [id] of existing) {
        if (!want.has(id)) { b.delete(db.collection('ledger').doc(id)); ops++; changed++; }  // ab hisab mai nahi raha
        if (ops >= 400) await flush();
      }

      // E) Bank balance = opening + jama(+) - udhar(-)  (app ke entries bhi gine jate hain)
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

      console.log(`[Mazda V2] Bank sync done: ${changed} badlav | SBI ₹${r2(bal.sbi)} | PNB ₹${r2(bal.pnb)}`);
      if (!opts.silent && !opts.auto) {
        alert(`✅ बैंक सिंक पूरा!\n\nबदलाव: ${changed} एंट्री\nSBI बैलेंस: ₹${r2(bal.sbi).toLocaleString('en-IN')}\nPNB बैलेंस: ₹${r2(bal.pnb).toLocaleString('en-IN')}`);
      }
    } catch (e) {
      console.error('[Mazda V2] Bank sync error', e);
      if (!opts.auto) alert('❌ बैंक सिंक एरर: ' + e.message);
    } finally {
      bankSyncing = false;
      if (APP.Rules) APP.Rules.sys = false;
    }
  }
  window.syncBankFromDays = syncBankFromDays;

  // Hisab mai koi bhi entry/badlav aate hi apne aap sync (ledger/tanker/days teeno par nazar)
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
  // 3. UI BUTTON INJECTION (SUPER OWNER VIEW)
  // =========================================================================
  function injectOwnerButtons() {
    const main = document.querySelector('#main') || document.querySelector('#p-content');
    if (!main || document.querySelector('#super-admin-v2-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'super-admin-v2-panel';
    panel.className = 'glass-card';
    panel.style.cssText = 'background:linear-gradient(135deg, #071329, #0a1f3d);border:2px solid #f4b41a;border-radius:16px;padding:16px;margin:16px;color:#fff;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="font-size:24px;">👑</span>
        <div>
          <b style="color:#f4b41a;font-size:16px;">Super Owner System Controls</b>
          <div style="font-size:11px;color:#94a3b8;">पंप डेटा रीसेट व रजिस्टर ऑटो-फिल इंजन</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button id="btn-auto-demo" class="btn" style="background:#0a7d33;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
          🚀 Demo Data भरें (1 June - Today)
        </button>
        <button id="btn-clear-pump" class="btn" style="background:#b91c1c;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
          ⚠️ Clear Pump Data (Zero All)
        </button>
        <button id="btn-bank-sync" class="btn" style="grid-column:span 2;background:#1d4ed8;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;">
          🏦 Bank Sync (हिसाब से SBI / PNB एंट्री)
        </button>
      </div>
    `;

    main.insertBefore(panel, main.firstChild);

    document.querySelector('#btn-auto-demo').onclick = generateRealisticData;
    document.querySelector('#btn-clear-pump').onclick = clearPumpData;
    document.querySelector('#btn-bank-sync').onclick = () => syncBankFromDays();
  }

  // Hook into App More/Owner Views
  setInterval(() => {
    if (isAuthorized()) { injectOwnerButtons(); startBankAutoSync(); }
  }, 1000);

  console.log('[Mazda V2] Super Admin Data Engine & Reset Engine Loaded ✓');
})();
