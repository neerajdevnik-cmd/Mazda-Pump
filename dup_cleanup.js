/* =========================================================================
   डुप्लीकेट पार्टी साफ़ करना (सिर्फ़ मालिक)
   • एक ही नाम की पार्टियों में सबसे पुरानी रखी जाती है, बाकी हटती हैं
   • सिर्फ़ वही डुप्लीकेट हटती हैं जिनकी ledger में सिर्फ़ Opening Balance की entry है
     (कोई और लेन-देन हो तो वो पार्टी छोड़ दी जाती है)
   • इसी काम के लिए R5/R6 locks सिर्फ़ इस कार्रवाई के दौरान हटते हैं
   ========================================================================= */
(function () {
  'use strict';
  const APP = window.APP, PS = window.PUMP_SYSTEM;
  if (!APP || !PS) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const millis = p => (p.createdAt && p.createdAt.toMillis) ? p.createdAt.toMillis() : 0;

  async function plan() {
    const db = APP.db;
    const parties = await APP.getParties(false, true);
    const groups = {};
    parties.forEach(p => { const k = String(p.name || '').trim().toLowerCase(); (groups[k] = groups[k] || []).push(p); });
    const toDelete = [], skipped = [];
    for (const k of Object.keys(groups)) {
      const g = groups[k]; if (g.length < 2) continue;
      g.sort((a, b) => millis(a) - millis(b) || String(a.id).localeCompare(String(b.id)));
      for (const dup of g.slice(1)) {
        const led = (await db.collection('ledger').where('partyId', '==', dup.id).get()).docs;
        if (led.every(d => d.data().opening === true)) toDelete.push({ party: dup, ledgerIds: led.map(d => d.id) });
        else skipped.push(dup.name);
      }
    }
    return { toDelete, skipped };
  }

  async function run() {
    const db = APP.db;
    let res;
    try { res = await plan(); } catch (e) { return alert('जाँच नहीं हो पाई: ' + (e.message || e)); }
    const { toDelete, skipped } = res;
    if (!toDelete.length) return alert('कोई हटाने लायक डुप्लीकेट नहीं मिला.' + (skipped.length ? '\nछोड़ी गईं (दूसरे लेन-देन हैं): ' + skipped.join(', ') : ''));
    const names = toDelete.slice(0, 12).map(x => x.party.name).join(', ');
    const ledgerCount = toDelete.reduce((s, x) => s + x.ledgerIds.length, 0);
    if (!confirm(toDelete.length + ' डुप्लीकेट पार्टी और ' + ledgerCount + ' Opening Balance entries हटेंगी.\nउदाहरण: ' + names + (toDelete.length > 12 ? ' …' : '') +
      (skipped.length ? '\n\nछोड़ी जाएँगी (दूसरे लेन-देन हैं): ' + skipped.join(', ') : '') + '\n\nसबसे पुरानी एंट्री रखी जाएगी. आगे बढ़ें?')) return;

    APP.Rules.dupCleanup = true;
    let done = 0;
    try {
      const ops = [];
      toDelete.forEach(x => { x.ledgerIds.forEach(id => ops.push(['ledger', id])); ops.push(['parties', x.party.id]); });
      for (let i = 0; i < ops.length; i += 200) {
        const b = db.batch();
        ops.slice(i, i + 200).forEach(([col, id]) => b.delete(db.collection(col).doc(id)));
        await b.commit();
        done += Math.min(200, ops.length - i);
        APP.toast && APP.toast(done + ' / ' + ops.length + ' हटाए…');
      }
      alert(toDelete.length + ' डुप्लीकेट पार्टी हट गईं ✔' + (skipped.length ? '\nछोड़ी गईं: ' + skipped.join(', ') : ''));
    } catch (e) {
      alert('हटाने में रुकावट (अब तक ' + done + ' ऑपरेशन हुए): ' + (e.code ? e.code + ' — ' : '') + (e.message || e));
    } finally {
      APP.Rules.dupCleanup = false;
      if (APP.S) APP.S.parties = null;
      if (APP.views && APP.views.customers) APP.views.customers();
    }
  }

  function card() {
    if (!PS.isCustomPump() || !(APP.isOwner && APP.isOwner()) || document.getElementById('dup-card')) return;
    const main = document.querySelector('#main'); if (!main) return;
    const c = document.createElement('div');
    c.id = 'dup-card'; c.className = 'card'; c.style.marginBottom = '12px';
    c.innerHTML = '<b>🧹 डुप्लीकेट पार्टी साफ़ करें</b><p class="mut" style="font-size:12px;margin:4px 0 8px">एक ही नाम की दोहरी पार्टियाँ हटाएँगे (सिर्फ़ Opening Balance वाली)।</p><button id="dup-go" class="btn full">जाँच करें और हटाएँ</button>';
    main.prepend(c);
    document.getElementById('dup-go').onclick = run;
  }

  setTimeout(() => {
    const A = window.APP; if (!A || !A.views || typeof A.views.more !== 'function') return;
    const o = A.views.more;
    A.views.more = async function () { const r = await o.apply(this, arguments); try { card(); } catch (e) { } return r; };
  }, 2800);
})();
