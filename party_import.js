/* =========================================================================
   CSV से पार्टियाँ + पंप की जानकारी लोड (सिर्फ़ मालिक)
   CSV कॉलम: name, amount, type
     type = udhar → पार्टी ने पंप को देना है  → बैलेंस + → ऐप में लाल  "-₹"
     type = jama  → पार्टी का advance पंप के पास → बैलेंस − → ऐप में हरा "+₹"
   • पहले से मौजूद नाम (बड़े-छोटे अक्षर का फ़र्क छोड़कर) छोड़ दिए जाते हैं
   • हर batch का error अलग से दिखता है (कौन सी लाइन/कितनी जुड़ीं)
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;

  const OPEN_DATE = '2026-10-31';   // हर पार्टी की ledger में यही तारीख वाली Opening Balance row
  const BATCH = 100;                // एक batch में 100 पार्टी (हर एक के लिए 2 लिखाई)

  /* गुरुनानक फिलिंग स्टेशन — बिल और QR की फ़ोटो से */
  const GURUNANAK_PUMP = {
    name: 'गुरुनानक फिलिंग स्टेशन',
    nameEn: 'Gurunanak Filling Station',
    address: 'गाँव झनकट, गुरुनानक राइस मिल के पास (यू.एस. नगर) उत्तराखंड',
    addressEn: 'Vill. Jhankat, Near Gurunanak Rice Mill (U.S. Nagar) UK',
    phone: '9012747777',
    officePhone: '8759517777',
    gstin: '05ABAFG6972E1ZH',
    upi: 'paytm.s13zk6d@pty',
    upiName: 'Gurunanak Filling Station',
    dealer: 'HPCL Dealer',
    brand: 'hpcl'
  };

  function parseCSV(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const split = l => {
      const out = []; let cur = '', q = false;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
      out.push(cur); return out.map(s => s.trim());
    };
    const head = split(lines[0]).map(h => h.toLowerCase());
    const iN = head.indexOf('name'), iA = head.indexOf('amount'), iT = head.indexOf('type');
    if (iN < 0 || iA < 0 || iT < 0) throw new Error('CSV की पहली लाइन name,amount,type होनी चाहिए');
    return lines.slice(1).map((l, i) => {
      const c = split(l);
      return { line: i + 2, name: c[iN] || '', amount: Number(String(c[iA] || '').replace(/[^\d.\-]/g, '')), type: String(c[iT] || '').toLowerCase() };
    });
  }

  const activePump = () => (window.PUMP_SYSTEM && window.PUMP_SYSTEM.activePumpId) || 'mazda';

  /* पंप की जानकारी उसी पंप के दस्तावेज़ में (pumps/{id}) — माज़दा का डेटा कभी नहीं छुएँगे */
  async function savePumpProfile(db) {
    const pid = activePump();
    if (pid === 'mazda') return false;
    const { officePhone, ...fields } = GURUNANAK_PUMP;
    await db.collection('pumps').doc(pid).set({ ...fields, officePhone: officePhone || '' }, { merge: true });
    return true;
  }

  window.PARTY_IMPORT = function () {
    if (!APP.isOwner || !APP.isOwner()) return APP.toast && APP.toast('सिर्फ़ मालिक CSV से पार्टी लोड कर सकता है');
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,text/csv';
    inp.onchange = async () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      try {
        const rows = parseCSV(await file.text());
        const bad = rows.filter(r => !r.name || !(r.amount >= 0) || (r.type !== 'udhar' && r.type !== 'jama'));
        if (bad.length) return alert('ये लाइनें ठीक नहीं हैं (नाम, amount, type=udhar/jama):\n' + bad.slice(0, 10).map(r => 'लाइन ' + r.line).join(', '));

        const db = APP.db;
        const existing = new Set((await db.collection('parties').get()).docs.map(d => String(d.data().name || '').trim().toLowerCase()));
        const todo = [], skipped = [], dupInFile = [];
        rows.forEach(r => {
          const key = r.name.toLowerCase();
          if (existing.has(key)) { skipped.push(r.name); return; }
          if (todo.some(t => t.name.toLowerCase() === key)) { dupInFile.push(r.name); return; }
          todo.push(r);
        });
        if (dupInFile.length && !confirm('CSV में ये नाम दो बार हैं, दूसरी वाली एंट्री छोड़ी जाएगी:\n' + dupInFile.join(', ') + '\n\nफिर भी आगे बढ़ें?')) return;

        const pumpPart = activePump() !== 'mazda'
          ? '\n\nपंप की जानकारी भी भरी जाएगी:\n' + GURUNANAK_PUMP.name + '\nGSTIN: ' + GURUNANAK_PUMP.gstin + '\nमोबाइल: ' + GURUNANAK_PUMP.phone + ' (ऑफ़िस ' + GURUNANAK_PUMP.officePhone + ')\nUPI: ' + GURUNANAK_PUMP.upi
          : '';
        if (!todo.length) {
          if (!pumpPart || !confirm('कोई नई पार्टी नहीं है (सब पहले से मौजूद हैं). सिर्फ़ पंप की जानकारी भरें?' + pumpPart)) return alert('कोई नई पार्टी नहीं मिली. सब पहले से मौजूद हैं.');
        } else if (!confirm(todo.length + ' नई पार्टी जुड़ेंगी (हर एक की ' + OPEN_DATE + ' की Opening Balance row के साथ)' + (skipped.length ? ', ' + skipped.length + ' पहले से मौजूद छोड़ी जाएँगी' : '') + '.' + pumpPart + '\n\nआगे बढ़ें?')) return;

        if (APP.Rules) APP.Rules.sys = true;
        let pumpSaved = false, done = 0;
        try {
          if (pumpPart) pumpSaved = await savePumpProfile(db);

          for (let i = 0; i < todo.length; i += BATCH) {
            const part = todo.slice(i, i + BATCH);
            const b = db.batch();
            part.forEach(r => {
              const pref = db.collection('parties').doc();
              const adv = r.type === 'jama';
              const signed = adv ? -r.amount : r.amount;     // bal > 0 = पार्टी ने देना है; bal < 0 = advance
              b.set(pref, { name: r.name, phone: '', vehicles: [], bal: signed, closed: false, importedFrom: 'csv', createdAt: APP.FV.serverTimestamp() });
              b.set(db.collection('ledger').doc(), {
                partyId: pref.id, partyName: r.name, date: OPEN_DATE, time: '00:00', opening: true, hisabVerified: true,
                kind: adv ? 'jama' : 'udhar', ...(adv ? { mode: 'cash' } : {}),
                vehicle: '', fuel: '', rate: 0, litre: 0, amount: r.amount,
                note: 'Opening Balance (31-10-2026)', createdOn: APP.todayISO(), by: (APP.S && APP.S.user && APP.S.user.email) || '', at: APP.FV.serverTimestamp()
              });
            });
            try { await b.commit(); }
            catch (e) {
              throw new Error('बैच ' + (i / BATCH + 1) + ' पर रुका। अब तक ' + done + ' पार्टी जुड़ीं। कारण: ' + (e.code ? e.code + ' — ' : '') + (e.message || e));
            }
            done += part.length;
            APP.toast && APP.toast(done + ' / ' + todo.length + ' पार्टी जुड़ीं…');
          }
        } finally { if (APP.Rules) APP.Rules.sys = false; }

        // पुराना cache हटाओ, ताकि नई पार्टियाँ तुरंत दिखें
        if (APP.S) APP.S.parties = null;
        const msg = done + ' पार्टी जुड़ीं ✔' + (skipped.length ? ' · ' + skipped.length + ' पहले से थीं' : '') + (pumpSaved ? ' · पंप की जानकारी भरी ✔' : '');
        APP.toast && APP.toast(msg);
        if (APP.views && APP.views.customers) await APP.views.customers();
      } catch (e) {
        alert('CSV लोड नहीं हुई: ' + (e.message || e));
        if (APP.S) APP.S.parties = null;
        if (APP.views && APP.views.customers) APP.views.customers();
      }
    };
    inp.click();
  };
})();
