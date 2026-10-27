/* Mazda Oil Company - Salesman cash milan card (din ke hisab ke saath) */
(function () {
  'use strict';
  const APP = window.APP; if (!APP || !APP.C) return;
  const S = APP.S, $ = APP.$, esc = APP.esc, num = APP.num, r2 = APP.r2, money = APP.money, toast = APP.toast, db = () => APP.db;
  let busy = false;

  async function card() {
    const main = document.querySelector('#main'), st = S.cur;
    if (busy || !main || !st || !document.querySelector('#f-date') || APP.isViewer() || APP.isSalesman()) return;
    if (document.querySelector('#smc-card') && document.querySelector('#smc-card').dataset.d === st.date) return;
    busy = true;
    try {
      const q = c => db().collection(c).where('date', '==', st.date).get().catch(() => ({ docs: [] }));
      const [sh, cs, rs] = await Promise.all([q('sm_shifts'), q('cash_submissions'), q('runsheets')]);
      const old = document.querySelector('#smc-card'); if (old) old.remove();
      const by = {};
      const get = (id, name) => by[id] = by[id] || { name: name || id, exp: 0, ok: 0, pend: 0, hasShift: false };
      sh.docs.forEach(d => { const x = d.data(); const o = get(x.sid, x.name); o.exp = r2(o.exp + num((x.sum || {}).expected)); o.hasShift = true; });
      const pend = [];
      cs.docs.forEach(d => { const x = d.data(), o = get(x.sid, x.salesmanName); if (x.status === 'approved') o.ok += num(x.total); else { o.pend += num(x.total); pend.push({ id: d.id, who: x.salesmanName, t: num(x.total) }); } });
      const active = rs.docs.filter(d => d.data().status === 'active').length;
      const act = new Set(rs.docs.filter(d => d.data().status === 'active').map(d => d.data().sid));
      const ids = Object.keys(by);
      if (!ids.length && !active) return;
      const box = document.createElement('div'); box.id = 'smc-card'; box.dataset.d = st.date; box.className = 'card';
      box.innerHTML = '<h3>🧑‍💼 Salesman cash</h3>' + (active ? '<div class="warn">⚠️ ' + active + ' शिफ्ट अभी चालू है — बंद करके कैश लें</div>' : '') +
        ids.map(id => { const o = by[id], diff = r2(o.ok + o.pend - o.exp), okd = o.hasShift && Math.abs(diff) < 1;
          return '<div class="kv"><span><b>' + esc(o.name) + '</b><br><small class="mut">होना चाहिए ' + money(o.exp) + ' · मिला ' + money(o.ok) + (o.pend ? ' · बाकी अप्रूवल ' + money(o.pend) : '') + '</small></span>' +
            '<b class="' + (okd ? 'pos' : 'neg') + '">' + (!o.hasShift ? '—' : okd ? '✔ बराबर' : (diff < 0 ? 'कम ' : 'ज़्यादा ') + money(Math.abs(diff))) + '</b></div>'; }).join('') +
        pend.map(p => '<div class="btns" style="margin-top:6px"><button class="btn sm g" data-smc="' + p.id + '">✔ Approve ' + esc(p.who) + ' ' + money(p.t) + '</button></div>').join('');
      const chk = document.querySelector('#chk-card');
      if (chk) chk.after(box); else main.insertBefore(box, main.firstChild);
      box.querySelectorAll('[data-smc]').forEach(b => b.onclick = async () => {
        if (!confirm('कैश गिनकर देख लिया? अप्रूव करने पर रकम सेल्समैन के खाते में जुड़ जाएगी।')) return;
        b.disabled = true;
        try { await db().collection('cash_submissions').doc(b.dataset.smc).update({ status: 'approved', approvedBy: (S.user && S.user.email) || 'Manager', approvedAt: APP.FV.serverTimestamp() }); APP.audit('cash_approve', { id: b.dataset.smc }); toast('कैश अप्रूव ✔'); box.remove(); card(); }
        catch (e) { b.disabled = false; toast('एरर: ' + e.message); }
      });
    } finally { busy = false; }
  }
  window.addEventListener('load', () => setTimeout(() => {
    const m = document.querySelector('#main'); if (m) new MutationObserver(() => setTimeout(card, 400)).observe(m, { childList: true });
  }, 1200));
  console.log('[Mazda shifts.js] loaded ✓');
})();
