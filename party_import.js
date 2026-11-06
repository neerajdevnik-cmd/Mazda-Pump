/* CSV से पार्टियाँ लोड (सिर्फ़ मालिक). फ़ाइल कॉलम: name, amount, type
   type = udhar (पार्टी ने पंप को देना है, लाल) | jama (पार्टी का advance, हरा)
   पहले से मौजूद नाम (बड़े-छोटे अक्षर का फ़र्क छोड़कर) छोड़ दिए जाते हैं. */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;

  function parseCSV(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const split = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
    const head = split(lines[0]).map(h => h.toLowerCase());
    const iN = head.indexOf('name'), iA = head.indexOf('amount'), iT = head.indexOf('type');
    if (iN < 0 || iA < 0 || iT < 0) throw new Error('CSV में पहली लाइन name,amount,type होनी चाहिए');
    return lines.slice(1).map((l, i) => { const c = split(l); return { line: i + 2, name: c[iN] || '', amount: Number(String(c[iA] || '').replace(/[^\d.\-]/g, '')), type: String(c[iT] || '').toLowerCase() }; });
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
        const OPEN_DATE = '2026-10-31';   // हर पार्टी की ledger में यही तारीख वाली Opening Balance row
        const todo = [], skipped = [];
        const dupInFile = [];
        rows.forEach(r => {
          const key = r.name.toLowerCase();
          if (existing.has(key)) { skipped.push(r.name); return; }
          if (todo.some(t => t.name.toLowerCase() === key)) { dupInFile.push(r.name); return; }
          todo.push(r);
        });
        if (dupInFile.length && !confirm('CSV में ये नाम दो बार हैं, दूसरी वाली एंट्री छोड़ी जाएगी:\n' + dupInFile.join(', ') + '\n\nफिर भी आगे बढ़ें?')) return;
        if (!todo.length) return alert('कोई नई पार्टी नहीं मिली. सब पहले से मौजूद हैं.');
        if (!confirm(todo.length + ' नई पार्टी जुड़ेंगी, हर एक की ' + OPEN_DATE + ' की Opening Balance row के साथ' + (skipped.length ? ' (' + skipped.length + ' पहले से मौजूद, छोड़ी जाएँगी)' : '') + '. आगे बढ़ें?')) return;
        if (APP.Rules) APP.Rules.sys = true;
        try {
          for (let i = 0; i < todo.length; i += 150) {       // एक batch में party + ledger row दोनों
            const b = db.batch();
            todo.slice(i, i + 150).forEach(r => {
              const pref = db.collection('parties').doc();
              const adv = r.type === 'jama';
              const signed = adv ? -r.amount : r.amount;          // bal > 0 = पार्टी ने देना है; bal < 0 = advance
              b.set(pref, { name: r.name, phone: '', vehicles: [], bal: signed, closed: false, importedFrom: 'csv', createdAt: APP.FV.serverTimestamp() });
              b.set(db.collection('ledger').doc(), {
                partyId: pref.id, partyName: r.name, date: OPEN_DATE, time: '00:00', opening: true, hisabVerified: true,
                kind: adv ? 'jama' : 'udhar', ...(adv ? { mode: 'cash' } : {}),
                vehicle: '', fuel: '', rate: 0, litre: 0, amount: r.amount,
                note: 'Opening Balance (31-10-2026)', createdOn: APP.todayISO(), by: (APP.S && APP.S.user && APP.S.user.email) || '', at: APP.FV.serverTimestamp()
              });
            });
            await b.commit();
          }
        } finally { if (APP.Rules) APP.Rules.sys = false; }
        APP.toast && APP.toast(todo.length + ' पार्टी जुड़ गईं ✔');
        if (APP.views && APP.views.customers) APP.views.customers();
      } catch (e) { alert('CSV लोड नहीं हुई: ' + (e.message || e)); }
    };
    inp.click();
  };
})();
