/* =========================================================================
   MAZDA PUMP - 3 mahine ka rules-wala demo (sirf Mazda ke liye)
   Start: 1 August 2026 | End: aaj tak | Meter: image wali closing readings se
   Engine: demo_core.js | Naye pump ka demo: pump_create.js
   ========================================================================= */
(function () {
  'use strict';
  const MAZDA_START = '2026-08-01';
  const MAZDA_METERS = { p1: 296707, p2: 192760, p3: 233295, p4: 54502, d1: 359741, d2: 242351, d3: 186378, d4: 103119 };
  const MAZDA_PARTIES = [
    { id: 'p_pappu', name: 'पप्पू सिंह अधिकारी', phone: '9412097690', vehicles: ['9769', '6637', '0783'] },
    { id: 'p_paras', name: 'पारस सती', phone: '9758200211', vehicles: ['2002 CB', '2002 CC'] },
    { id: 'p_lakshman', name: 'लक्ष्मण सिंह भरड़ा', phone: '9411133880', vehicles: ['3388', '4488'] },
    { id: 'p_chandan', name: 'चंदन देव', phone: '9917099770', vehicles: ['9977', '9884', '1706', '5200'] },
    { id: 'p_deepak', name: 'दीपक शाह', phone: '9837006270', vehicles: ['0627', 'UK01CA0627'] },
    { id: 'p_kishor', name: 'किशोर उपाध्याय', phone: '8091762889', vehicles: ['3335', '3336'] },
    { id: 'p_madhan', name: 'मदन सिंह अधिकारी', phone: '9412907691', vehicles: ['0769'] },
    { id: 'p_nanda', name: 'माँ नंदा स्टोन क्रेशर', phone: '9412055111', vehicles: ['800 ली'], fixedLitre: 800 },
    { id: 'p_ghanshyam', name: 'घनश्याम तिवारी', phone: '9760008560', vehicles: ['0856'] }
  ];

  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const isAuthorized = () => {
    const A = window.APP || {};
    const email = ((A.S && A.S.user && A.S.user.email) || '').toLowerCase();
    return email.includes('neeraj') || (A.isTrueOwner && A.isTrueOwner()) || localStorage.getItem('mazda_owner') === 'yes';
  };
  const activePump = () => (window.PUMP_SYSTEM && window.PUMP_SYSTEM.activePumpId) || 'mazda';

  async function runMazdaDemo() {
    const end = todayStr();
    if (!confirm(`🧪 मज़दा पंप: ${MAZDA_START} से ${end} तक demo data\n\n• मीटर रीडिंग image वाली जगह से शुरू\n• मौजूदा days, ledger, parties, tanker हट जाएँगे\n\nजारी रखें?`)) return;
    const progress = window.APP && APP.modal ? APP.modal('<h3>⏳ Demo data भरा जा रहा है...</h3>') : null;
    try {
      const ds = await window.DEMO_CORE.writeDemo({ startDate: MAZDA_START, endDate: end, meters: MAZDA_METERS, parties: MAZDA_PARTIES });
      if (progress) progress.close();
      alert(`✅ ${ds.days.length} दिन (${MAZDA_START} से ${end}) का demo data भर गया।`);
      location.reload();
    } catch (e) { if (progress) progress.close(); alert('❌ एरर: ' + e.message); }
  }

  setInterval(() => {
    if (!isAuthorized() || activePump() !== 'mazda') return;
    const panel = document.querySelector('#super-admin-panel');
    if (!panel || document.querySelector('#btn-demo-mazda-3m')) return;
    const grid = panel.querySelector('div[style*="grid"]');
    if (!grid) return;
    const btn = document.createElement('button');
    btn.id = 'btn-demo-mazda-3m';
    btn.className = 'btn';
    btn.textContent = '🧪 मज़दा: 1 Aug से आज तक (नियम वाला Demo)';
    btn.style.cssText = 'grid-column:span 2;background:#7c3aed;color:#fff;border:none;padding:12px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;';
    btn.onclick = runMazdaDemo;
    grid.appendChild(btn);
  }, 1000);
})();
