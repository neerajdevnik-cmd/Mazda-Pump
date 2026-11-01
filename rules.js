/* Mazda Oil Company — 📜 RULES BOOK. हर Firestore लिखाई (हिसाब, ledger, salesman, scanner, assistant — कोई भी फाइल) इसी से गुज़रती है। सबसे आख़िरी script रखें। */
(function () {
  'use strict';
  function start() {
    const APP = window.APP; if (!APP || !APP.db || APP.Rules) return;
    const db = APP.db, FV = APP.FV, K = APP.K, S = APP.S, num = x => Number(x) || 0;
    const rawCol = db.collection.bind(db), rawBatch = db.batch.bind(db);
    const pad = n => String(n).padStart(2, '0');
    const today = () => APP.todayISO();
    const role = () => S.role, sid = () => (S.salesman && S.salesman.id) || '';
    const RAW = Symbol('raw'), un = r => (r && r[RAW]) || r;
    const PROTECTED = ['rateP', 'rateD', 'openCash', 'openStockP', 'openStockD'];

    /* ===== नियमों की सूची (पढ़ने के लिए; "और" पेज से देख सकते हैं) ===== */
    const BOOK = [
      ['R1', 'सिर्फ़ देखने वाला (Viewer) कुछ नहीं बदल सकता।'],
      ['R2', 'मैनेजर सिर्फ़ आज का हिसाब बदल सकता है; पुराने/लॉक दिन सिर्फ़ देख सकता है। मालिक दिन अनलॉक करे तभी वो बदलेगा।'],
      ['R3', 'लॉक (जमा) दिन की कोई एंट्री, हिसाब या बैंक एंट्री कोई नहीं बदल/हटा सकता — मालिक भी पहले 🔓 अनलॉक करे।'],
      ['R4', 'रेट, पिछला कैश, ओपनिंग मीटर और ओपनिंग स्टॉक अपने-आप कल से जुड़ते हैं — इन्हें मालिक भी हाथ से नहीं बदल सकता।'],
      ['R5', 'पार्टी का ओपनिंग बैलेंस सिर्फ़ एक बार बनेगा, और उसी दिन बदला जा सकेगा।'],
      ['R6', 'ledger में कोई भी उधार/जमा बिना कारण नहीं: आज की हो, या उस दिन का हिसाब बना हो, या बैंक एंट्री से बनी हो।'],
      ['R7', 'आने वाली तारीख की एंट्री नहीं। रकम > 0। उधार में लीटर × रेट = रकम (₹1 तक फर्क)।'],
      ['R8', 'सेल्समैन: सिर्फ़ चालू रनशीट पर, सिर्फ़ आज का उधार; जमा या पुराना हिसाब नहीं।'],
      ['R9', 'हर बैंक जमा का अपना अलग Payment ID (PAY-…) अपने-आप बनता है।'],
      ['R10', 'audit (रिकॉर्ड) कोई नहीं बदल/हटा सकता। हिसाब का दिन कभी delete नहीं होता।'],
      ['R11', 'बचा कैश माइनस हो तो दिन जमा नहीं होगा। डिप 250 cm से ज़्यादा लिखी तो लीटर मानकर cm में बदल दी जाएगी।'],
      ['R12', 'रेट कभी 0 या खाली नहीं हो सकता — न दिन का, न ledger की उधार एंट्री का।'],
      ['R13', 'स्वतः ठीक दिन का रेट कभी नहीं छूता; सिर्फ़ ledger की गलत एंट्री को उस दिन के रेट पर लाता और बैलेंस मिलाता है; कोई दिन या एंट्री न बनाता है, न हटाता है, लॉक दिन नहीं छूता। पूरा data सिर्फ़ ऐप के अपने बैकअप से (मालिक द्वारा अपलोड करने पर) वापस भरेगा।']
    ];

    const fail = [];                       // हर जाँच अपने error यहाँ डालती है
    const E = (id, msg) => fail.push('🚫 [' + id + '] ' + msg);
    const dayDoc = async d => { try { const s = await rawCol('days').doc(d).get(); return s.exists ? s.data() : null; } catch (e) { return null; } };
    const flat = (o, p, out) => { out = out || {}; Object.keys(o || {}).forEach(k => { const v = o[k], key = p ? p + '.' + k : k; if (v && typeof v === 'object' && !Array.isArray(v) && !(v.seconds !== undefined) && !(v._methodName)) flat(v, key, out); else out[key] = v; }); return out; };
    const val = (cur, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), cur);
    const isInc = v => v && typeof v === 'object' && (v._methodName || v.constructor && /Increment|Delete|Server/.test(v.constructor.name));

    /* ===== सिंक वाला हिस्सा: बनते वक़्त अपने-आप जुड़ने वाले फ़ील्ड ===== */
    function inject(op) {
      const d = op.data; if (!d || op.type === 'delete') return;
      if (op.col === 'ledger' && op.type === 'set') { const k = op.cur && op.cur.createdOn; if (k) d.createdOn = k; else if (!op.cur) d.createdOn = d.createdOn || today(); }
      if (op.col === 'days' && op.cur) {
        if (op.cur.status === 'submitted' && d.status === 'open') { d.unlockedAt = Date.now(); d.unlockedBy = (S.user && S.user.email) || ''; }
        if (d.status === 'submitted' && op.cur.unlockedAt) d.unlockedAt = FV.delete();
      }
      if (op.col === 'bank_deposits' && !d.payId && op.type === 'set') d.payId = 'PAY-' + (d.date || today()).replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    }

    /* ===== हर लिखाई की जाँच ===== */
    async function check(ops) {
      fail.length = 0; const r = role(), t = today();
      for (const op of ops) {
        const c = op.col, d = op.data || {}, id = op.id;
        const cur = op.type === 'set' && !op.cur ? null : op.cur; op.cur = cur;
        if (r === 'viewer') { E('R1', 'सिर्फ़ देखने की अनुमति है, कुछ बदला नहीं जा सकता।'); continue; }
        if (c === 'audit' && op.type !== 'set') { E('R10', 'audit रिकॉर्ड बदला/हटाया नहीं जा सकता।'); continue; }
        if (c === 'days') {
          if (op.type === 'delete') { E('R10', 'हिसाब का दिन कभी delete नहीं होता।'); continue; }
          ['rateP', 'rateD'].forEach(f => { if (Object.prototype.hasOwnProperty.call(d, f) && !isInc(d[f]) && !(num(d[f]) > 0)) E('R12', 'रेट 0 या खाली नहीं हो सकता (' + (f === 'rateD' ? 'डीज़ल' : 'पेट्रोल') + ').'); });
          const dd = cur;
          if (dd && dd.status === 'submitted') {
            const unlocking = r === 'owner' && d.status === 'open' && Object.keys(d).every(k => ['status', 'unlockedAt', 'unlockedBy', 'at', 'by'].includes(k));
            if (!unlocking) E('R3', dmy(id) + ' का दिन लॉक है — पहले मालिक 🔓 अनलॉक करे।');
          } else if (r === 'manager' && id !== t && !(dd && dd.unlockedAt)) E('R2', 'मैनेजर सिर्फ़ आज का हिसाब बदल सकता है। ' + dmy(id) + ' के लिए मालिक अनलॉक करे।');
          else if (r === 'salesman') E('R8', 'सेल्समैन हिसाब का दिन नहीं बदल सकता।');
          if (dd && dd.chainPrev !== undefined && dd.opening_locked !== false && !APP.Rules.sys) {
            const f = flat(d), keys = Object.keys(f).filter(k => PROTECTED.includes(k) || /^nz\.[a-z0-9]+\.o$/.test(k));
            if (keys.length) {
              const prevs = (await rawCol('days').where('date', '<', id).orderBy('date', 'desc').limit(1).get()).docs, pv = prevs.length ? prevs[0].data() : null;
              const same = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b) || (a !== '' && b !== '' && a != null && b != null && Math.abs(num(a) - num(b)) < 0.01);
              const expect = k => { if (!pv) return undefined; const sm = pv.sum || {}; if (k === 'rateP') return pv.rateP; if (k === 'rateD') return pv.rateD; if (k === 'openCash') return sm.close; if (k === 'openStockP') return sm.actStockP != null ? sm.actStockP : Math.max(0, num(sm.expStockP)); if (k === 'openStockD') return sm.actStockD != null ? sm.actStockD : Math.max(0, num(sm.expStockD)); const m = k.match(/^nz\.([a-z0-9]+)\.o$/); return m ? ((pv.nz || {})[m[1]] || {}).c : undefined; };
              const bad = keys.filter(k => !isInc(f[k]) && !same(val(dd, k), f[k]) && !(expect(k) !== undefined && same(expect(k), f[k])));
              if (bad.length) E('R4', (bad.some(k => /rate/.test(k)) ? 'रेट लॉक है — "💲 नया रेट" बटन से ही बदलेगा। ' : '') + 'ये अपने-आप कल से जुड़ते हैं, हाथ से नहीं बदल सकते: ' + bad.join(', '));
            }
          }
        }
        if (c === 'ledger') {
          const date = d.date || (cur && cur.date), old = cur && cur.date, opening = d.opening === true || (cur && cur.opening === true);
          for (const dt of [date, old].filter((x, i, a) => x && a.indexOf(x) === i)) {
            const dy = await dayDoc(dt);
            if (dy && dy.status === 'submitted') { E('R3', dmy(dt) + ' का दिन लॉक है — इसकी एंट्री बदली/हटाई नहीं जा सकती। पहले मालिक 🔓 अनलॉक करे।'); }
            else if (r === 'manager' && dt !== t && !(dy && dy.unlockedAt) && !opening) E('R2', 'मैनेजर सिर्फ़ आज की एंट्री बदल सकता है।');
          }
          if (op.type === 'delete') { if (r === 'salesman' && !(cur && cur.sid === sid() && cur.date === t)) E('R8', 'सेल्समैन सिर्फ़ अपनी आज की एंट्री हटा सकता है।'); if (opening && cur && cur.createdOn && cur.createdOn !== t) E('R5', 'ओपनिंग बैलेंस उसी दिन बदला जा सकता है जिस दिन बना था।'); continue; }
          if (!date) { E('R7', 'तारीख ज़रूरी है।'); continue; }
          if (date > t) E('R7', 'आने वाली तारीख की एंट्री नहीं हो सकती।');
          if (!(num(d.amount) > 0) && d.amount !== undefined) E('R7', 'रकम 0 से ज़्यादा होनी चाहिए।');
          if (d.kind === 'udhar' && d.fuel && d.rate !== undefined && num(d.litre) > 0 && !(num(d.rate) > 0)) E('R12', 'उधार एंट्री का रेट 0 या खाली नहीं हो सकता।');
          if (d.kind === 'udhar' && d.fuel && num(d.litre) > 0 && num(d.rate) > 0 && Math.abs(num(d.litre) * num(d.rate) - num(d.amount)) > 1.01) E('R7', 'रकम ≠ लीटर × रेट (₹' + Math.round(num(d.litre) * num(d.rate)) + ' होना चाहिए)।');
          if (opening) {
            if (!cur) {
              const ex = (await rawCol('ledger').where('partyId', '==', d.partyId).get()).docs.filter(x => x.data().opening === true);
              if (ex.length) E('R5', 'इस पार्टी का ओपनिंग बैलेंस पहले से बना है — सिर्फ़ एक बार बनता है।');
            } else if (cur.createdOn && cur.createdOn !== t) E('R5', 'ओपनिंग बैलेंस उसी दिन बदला जा सकता है जिस दिन बना था।');
          } else if (r === 'salesman') {
            if (d.kind !== 'udhar') E('R8', 'सेल्समैन सिर्फ़ उधार लिख सकता है।');
            if (date !== t) E('R8', 'सेल्समैन सिर्फ़ आज का उधार लिख सकता है।');
            const rs = (await rawCol('runsheets').where('date', '==', t).where('sid', '==', sid()).get()).docs.filter(x => x.data().status === 'active');
            if (!rs.length) E('R8', 'चालू रनशीट नहीं है — मैनेजर से रनशीट शुरू करवाएँ।');
          } else if (!d.bankId && !(cur && cur.bankId) && date !== t && d.src !== 'salesman' && !(S.cur && S.cur.date === date)) {
            if (!(await dayDoc(date))) E('R6', dmy(date) + ' का हिसाब बना ही नहीं — बिना हिसाब के ledger में एंट्री नहीं हो सकती।');
          }
        }
        if (c === 'priv_ledger' && r === 'salesman' && op.type === 'set' && d.kind && d.kind !== 'udhar') E('R8', 'सेल्समैन सिर्फ़ उधार लिख सकता है।');
        if (c === 'parties' && op.type === 'delete' && cur && Math.abs(num(cur.bal)) > 0.5) E('R6', 'जिस पार्टी का बैलेंस बाकी है उसे हटाया नहीं जा सकता।');
        if (c === 'bank_deposits' && op.type === 'delete' && !String(id).startsWith('sbi_auto_')) E('R10', 'बैंक एंट्री सीधे हटाई नहीं जाती; "हटाई गई" निशान लगता है।');
        if (r === 'salesman' && !['ledger', 'priv_ledger', 'parties', 'priv_parties', 'sm_shifts', 'cash_submissions', 'audit', 'attendance', 'salary_payments', 'shop', 'runsheets'].includes(c)) E('R8', 'सेल्समैन के लिए ये बदलाव मना है (' + c + ')।');
      }
      return fail.slice();
    }

    function dmy(x) { return String(x || '').split('-').reverse().join('/'); }
    async function gate(ops) {
      for (const op of ops) { try { const sn = await rawCol(op.col).doc(op.id).get(); op.cur = sn.exists ? sn.data() : null; } catch (e) { op.cur = null; } }
      const errs = await check(ops);
      if (errs.length) { try { APP.toast(errs[0]); } catch (e) { } const err = new Error(errs.join('\n')); err.rule = true; throw err; }
      ops.forEach(inject);
      // संपादन/हटाने का रिकॉर्ड (कोई बदल नहीं सकता, मालिक देख सकता है)
      ops.filter(o => o.cur && ['ledger', 'bank_deposits', 'days'].includes(o.col) && (o.type === 'delete' || o.col !== 'days')).forEach(o => {
        try { rawCol('audit').add({ at: FV.serverTimestamp(), by: (S.salesman ? S.salesman.name : (S.user && S.user.email)) || '?', action: 'rules_' + o.type, detail: JSON.stringify({ col: o.col, id: o.id, before: pick(o.cur), after: o.type === 'delete' ? null : pick(o.data) }).slice(0, 2800) }); } catch (e) { }
      });
    }
    const pick = x => { const o = {}; ['date', 'partyName', 'kind', 'amount', 'litre', 'vehicle', 'mode', 'status', 'sale', 'note'].forEach(k => { if (x && x[k] !== undefined && typeof x[k] !== 'object') o[k] = x[k]; }); return o; };

    /* ===== Firestore के ऊपर पहरा: कोई भी फाइल बच नहीं सकती ===== */
    const wrapDoc = ref => {
      if (!ref || ref[RAW]) return ref;
      return new Proxy(ref, { get(t, k) {
        if (k === RAW) return t;
        const col = t.parent && t.parent.id, id = t.id;
        if (k === 'set') return async (d, o) => { await gate([{ type: 'set', col, id, data: d, opts: o }]); return t.set(d, o); };
        if (k === 'update') return async (d) => { await gate([{ type: 'update', col, id, data: d }]); return t.update(d); };
        if (k === 'delete') return async () => { if (col === 'bank_deposits' && !String(id).startsWith('sbi_auto_')) return softRemoveBank(id); await gate([{ type: 'delete', col, id }]); return t.delete(); };
        const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
      } });
    };
    db.collection = name => {
      const c = rawCol(name);
      return new Proxy(c, { get(t, k) {
        if (k === 'doc') return id => wrapDoc(id === undefined ? t.doc() : t.doc(id));
        if (k === 'add') return async d => { const r = t.doc(); await gate([{ type: 'set', col: name, id: r.id, data: d }]); await r.set(d); return wrapDoc(r); };
        const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
      } });
    };
    db.batch = () => {
      const ops = [], mk = (type, r, d, o) => { const u = un(r); ops.push({ type, ref: u, col: u.parent.id, id: u.id, data: d, opts: o }); };
      const pb = {
        set(r, d, o) { mk('set', r, d, o); return pb; },
        update(r, d) { mk('update', r, d); return pb; },
        delete(r) { const u = un(r); if (u.parent.id === 'bank_deposits' && !String(u.id).startsWith('sbi_auto_')) mk('update', r, { removed: true, removedAt: FV.serverTimestamp(), removedBy: (S.user && S.user.email) || '?' }); else mk('delete', r); return pb; },
        async commit() {
          await gate(ops); const b = rawBatch();
          ops.forEach(o => { if (o.type === 'set') b.set(o.ref, o.data, o.opts); else if (o.type === 'update') b.update(o.ref, o.data); else b.delete(o.ref); });
          return b.commit();
        }
      };
      return pb;
    };

    /* ===== दिन जमा करते वक़्त की जाँच (K.validate में जुड़ती है) ===== */
    const ov = K.validate;
    K.validate = function (d, rows, o) {
      const res = (ov ? ov.apply(this, arguments) : null) || { errors: [], warns: [] }; res.errors = res.errors || []; res.warns = res.warns || [];
      try {
        const c = K.compute(d, rows);
        if (num(c.close) < -0.005) res.errors.push('[R11] बचा कैश माइनस है (' + APP.money(c.close) + ') — हिसाब गलत है, जाँचें।');
        [['dipP', 'पेट्रोल'], ['dipD', 'डीज़ल']].forEach(([f, n]) => { if (K.has(d[f]) && num(d[f]) > 250) res.errors.push('[R11] ' + n + ' की डिप ' + d[f] + ' cm है — 250 से ज़्यादा नहीं हो सकती।'); });
      } catch (e) { }
      return res;
    };

    /* ===== डिप ↔ लीटर: 250 से बड़ा नंबर लिखा तो लीटर मानकर cm निकाल देना ===== */
    document.addEventListener('change', e => {
      const el = e.target; if (!el || !/^f-dip[PD]$/.test(el.id) || !window.DipChart) return;
      const v = num(el.value); if (v <= 250) return;
      const type = el.id.endsWith('P') ? 'petrol' : 'diesel'; let best = 0, bd = 1e9;
      for (let cm = 0; cm <= 250; cm += 0.5) { const df = Math.abs(window.DipChart.getLiters(type, cm) - v); if (df < bd) { bd = df; best = cm; } }
      el.value = best; el.dispatchEvent(new Event('input', { bubbles: true })); APP.toast('📏 ' + v + ' लीटर था — डिप ' + best + ' cm में बदल दी');
    }, true);

    /* ===== ओपनिंग हाथ से बदलने वाला बटन अब बंद (R4) ===== */
    const st = document.createElement('style'); st.textContent = '#toggle-open{display:none!important}'; document.head.appendChild(st);

    /* ===== पुरानी गलतियाँ ढूँढना + ठीक करने की योजना (ये सिर्फ़ पढ़ता है, कुछ लिखता नहीं) ===== */
    async function plan() {
      const [ds, ls, ps, rh] = await Promise.all([rawCol('days').get(), rawCol('ledger').get(), rawCol('parties').get(), rawCol('rate_history').get()]);
      const days = {}; ds.docs.forEach(x => { days[x.id] = x.data(); });
      const rows = ls.docs.map(x => ({ id: x.id, ...x.data() }));
      const hist = rh.docs.map(x => x.data()).filter(h => h.date && num(h.rateP) > 0 && num(h.rateD) > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const P = { dayRates: [], ledgerRates: [], bal: [], skipLocked: 0, out: { zero: [], rate: [], bal: [], nodays: [], cash: [] } };
      const eff = {}, last = { rateP: 0, rateD: 0 };

      /* 1) दिन का रेट कभी नहीं बदला जाता। 0/खाली रेट वाले दिन सिर्फ़ सूची में दिखते हैं (सुधार: बैकअप रिस्टोर) */
      Object.keys(days).sort().forEach(k => {
        const d = days[k]; eff[k] = {};
        ['rateP', 'rateD'].forEach(f => {
          const v = num(d[f]);
          if (v > 0) eff[k][f] = v;
          else P.out.zero.push(dmy(k) + ' · ' + (f === 'rateD' ? 'डीज़ल' : 'पेट्रोल') + ' रेट ' + v + ' — दिन का रेट स्वतः ठीक नहीं छूता, बैकअप से रिस्टोर करें');
        });
      });

      /* 2) ledger का रेट = उस दिन का रेट (लॉक दिन छुए नहीं जाते) */
      const upd = {};
      rows.forEach(r => {
        const d = days[r.date];
        if (!(r.kind === 'udhar' && r.fuel && d) || K.isOpening(r)) return;
        const rt = (eff[r.date] || {})[r.fuel === 'diesel' ? 'rateD' : 'rateP'];
        if (!(rt > 0) || !(num(r.litre) > 0) || Math.abs(rt - num(r.rate)) <= 0.005) return;
        const txt = dmy(r.date) + ' · ' + r.partyName + ' · रेट ' + r.rate + ' (हिसाब का रेट ' + rt + ')';
        if (d.status === 'submitted') { P.skipLocked++; P.out.rate.push(txt + ' — दिन लॉक, छोड़ा जाएगा'); return; }
        upd[r.id] = { rate: rt, amount: K.r2(num(r.litre) * rt) };
        P.ledgerRates.push({ id: r.id, rate: rt, amount: upd[r.id].amount }); P.out.rate.push(txt);
      });

      /* 3) पार्टी बैलेंस = एंट्रियों का जोड़ (ledger खाली/गायब हो तो बैलेंस को हाथ नहीं लगता) */
      const adj = rows.map(r => (upd[r.id] ? { ...r, ...upd[r.id] } : r));
      ps.docs.forEach(p => {
        const pd = p.data(), mine = adj.filter(r => r.partyId === p.id);
        if (!mine.length) { if (Math.abs(num(pd.bal)) > 0.5) P.out.bal.push(pd.name + ' · ₹' + Math.round(num(pd.bal)) + ' बैलेंस है पर एंट्री नहीं मिलीं — छुआ नहीं जाएगा'); return; }
        const sum = K.r2(mine.reduce((a, r) => a + K.signed(r), 0));
        if (Math.abs(sum - num(pd.bal)) > 0.5) { P.bal.push({ id: p.id, bal: sum }); P.out.bal.push(pd.name + ' · सेव ₹' + Math.round(num(pd.bal)) + ' ≠ एंट्रियों का जोड़ ₹' + Math.round(sum)); }
      });

      /* 4) सिर्फ़ सूची (इन्हें अपने-आप नहीं बदला जाता) */
      rows.forEach(r => { if (!K.isOpening(r) && !r.bankId && !days[r.date] && r.date !== today()) P.out.nodays.push(dmy(r.date) + ' · ' + r.partyName + ' · ₹' + r.amount); });
      Object.keys(days).forEach(k => { if (num((days[k].sum || {}).close) < -0.005) P.out.cash.push(dmy(k) + ' · बचा कैश ₹' + Math.round(days[k].sum.close)); });
      return P;
    }
    async function audit() { return (await plan()).out; }

    /* ===== स्वतः ठीक करें: सिर्फ़ गलत रेट और गलत बैलेंस। कोई दिन/एंट्री न बनती है, न हटती है। हर लिखाई नियमों (gate) से गुज़रती है ===== */
    async function applyFix() {
      if (role() !== 'owner') throw new Error('स्वतः ठीक सिर्फ़ मालिक कर सकता है');
      const P = await plan();                                  // ताज़ा योजना
      if (!(P.ledgerRates.length + P.bal.length)) return { d: 0, l: 0, b: 0, skip: P.skipLocked };
      await downloadBackup('before-autofix');                  // पहले अभी का data फ़ाइल में सुरक्षित
      const done = { d: 0, l: 0, b: 0, skip: P.skipLocked };
      for (let i = 0; i < P.ledgerRates.length; i += 150) { const b = db.batch(); P.ledgerRates.slice(i, i + 150).forEach(x => b.update(db.collection('ledger').doc(x.id), { rate: x.rate, amount: x.amount })); await b.commit(); done.l += Math.min(150, P.ledgerRates.length - i); }
      for (let i = 0; i < P.bal.length; i += 150) { const b = db.batch(); P.bal.slice(i, i + 150).forEach(x => b.update(db.collection('parties').doc(x.id), { bal: x.bal })); await b.commit(); done.b += Math.min(150, P.bal.length - i); }
      try { await rawCol('audit').add({ at: FV.serverTimestamp(), by: (S.user && S.user.email) || '?', action: 'rules_autofix', detail: JSON.stringify(done) }); } catch (e) { }
      return done;
    }

    /* ===== 💾 बैकअप डाउनलोड / ⬆️ बैकअप अपलोड (पूरा रिस्टोर) ===== */
    const BCOLS = ['days', 'ledger', 'parties', 'bank_deposits', 'rate_history', 'runsheets', 'priv_ledger', 'priv_parties', 'sm_shifts', 'cash_submissions', 'attendance', 'salary_payments', 'shop', 'audit'];
    const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    const isTs = v => v && typeof v === 'object' && typeof v.toDate === 'function' && v.seconds !== undefined;
    const ser = v => {
      if (v === null || v === undefined) return v;
      if (isTs(v)) return { __ts: [v.seconds, v.nanoseconds || 0] };
      if (v instanceof Date) return { __ts: [Math.floor(v.getTime() / 1000), 0] };
      if (Array.isArray(v)) return v.map(ser);
      if (typeof v === 'object') { if (v.firestore && v.path) return String(v.path); const o = {}; Object.keys(v).forEach(k => { o[k] = ser(v[k]); }); return o; }
      return v;
    };
    const de = v => {
      if (v === null || v === undefined) return v;
      if (Array.isArray(v)) return v.map(de);
      if (typeof v === 'object') {
        const ks = Object.keys(v);
        if (ks.length === 1 && Array.isArray(v.__ts)) return new Date(num(v.__ts[0]) * 1000 + Math.floor(num(v.__ts[1]) / 1e6));
        if (ks.length === 2 && v.seconds !== undefined && v.nanoseconds !== undefined) return new Date(num(v.seconds) * 1000 + Math.floor(num(v.nanoseconds) / 1e6));
        if (ks.length === 2 && v._seconds !== undefined && v._nanoseconds !== undefined) return new Date(num(v._seconds) * 1000 + Math.floor(num(v._nanoseconds) / 1e6));
        const o = {}; ks.forEach(k => { o[k] = de(v[k]); }); return o;
      }
      return v;
    };
    async function snapshot() {
      const data = {}, counts = {};
      for (const c of BCOLS) { const s = await rawCol(c).get(); data[c] = s.docs.map(x => ({ id: x.id, d: ser(x.data()) })); counts[c] = s.size; }
      return { app: 'mazda-backup', v: 1, createdAt: new Date().toISOString(), counts, sum: hash(JSON.stringify(data)), data };
    }
    async function downloadBackup(tag) {
      const o = await snapshot(), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' }));
      a.download = 'mazda-backup-' + today() + '-' + (tag || 'manual') + '.json'; document.body.appendChild(a); a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) { } }, 5000);
      return o;
    }
    function parseBackup(j) {
      if (!j || typeof j !== 'object') return { error: '❌ ये बैकअप फ़ाइल नहीं लगती।' };
      let signed = false, src;
      if (j.app === 'mazda-backup') {
        if (!j.data || j.sum !== hash(JSON.stringify(j.data))) return { error: '❌ ये बैकअप ख़राब या बदला हुआ है — रिस्टोर नहीं होगा।' };
        signed = true; src = j.data;
      } else src = (j.data && typeof j.data === 'object') ? j.data : (j.collections && typeof j.collections === 'object') ? j.collections : j;
      const cols = {}, counts = {}, ignored = [];
      Object.keys(src).forEach(c => {
        const v = src[c];
        if (!BCOLS.includes(c)) { if (v && typeof v === 'object') ignored.push(c); return; }
        let list = [];
        if (Array.isArray(v)) list = v.map(x => { if (!x || typeof x !== 'object') return {}; if (signed) return { id: x.id, data: x.d }; const o = Object.assign({}, x), id = o.id; delete o.id; return { id, data: o }; });
        else if (v && typeof v === 'object') list = Object.keys(v).map(id => ({ id, data: v[id] }));
        list = list.filter(x => x.id != null && String(x.id) && !String(x.id).includes('/') && x.data && typeof x.data === 'object').map(x => ({ id: String(x.id), data: de(x.data) }));
        if (list.length) { cols[c] = list; counts[c] = list.length; }
      });
      if (!cols.days && !cols.ledger && !cols.parties) return { error: '❌ इस फ़ाइल में हिसाब/ledger/पार्टी का data नहीं मिला — रिस्टोर नहीं होगा।' };
      const zeroDays = (cols.days || []).filter(x => ['rateP', 'rateD'].some(f => x.data[f] !== undefined && !(num(x.data[f]) > 0))).length;
      return { cols, counts, signed, ignored, zeroDays, createdAt: j.createdAt || '' };
    }
    async function runRestore(P, m) {
      const msg = t => { const el = m.querySelector('#rs-msg'); if (el) el.textContent = t; };
      msg('⏳ पहले अभी का data सुरक्षित (डाउनलोड) हो रहा है…');
      await downloadBackup('before-restore');
      for (const c of Object.keys(P.cols)) {
        const list = P.cols[c]; msg('⏳ ' + c + ': ' + list.length + ' दर्ज हो रहे हैं…');
        for (let i = 0; i < list.length; i += 400) { const b = rawBatch(); list.slice(i, i + 400).forEach(x => b.set(rawCol(c).doc(x.id), x.data)); await b.commit(); }
        if (c !== 'audit') {                                   // बैकअप के बाद की फ़ालतू/बिगड़ी एंट्री हटाओ (audit कभी नहीं हटता)
          const keep = new Set(list.map(x => x.id)), extra = (await rawCol(c).get()).docs.filter(x => !keep.has(x.id));
          for (let i = 0; i < extra.length; i += 400) { const b = rawBatch(); extra.slice(i, i + 400).forEach(x => b.delete(x.ref)); await b.commit(); }
        }
      }
      try { await rawCol('audit').add({ at: FV.serverTimestamp(), by: (S.user && S.user.email) || '?', action: 'rules_restore', detail: JSON.stringify(P.counts).slice(0, 2800) }); } catch (e) { }
    }
    function restoreModal() {
      if (role() !== 'owner') return APP.toast('बैकअप रिस्टोर सिर्फ़ मालिक कर सकता है');
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        let j; try { j = JSON.parse(await f.text()); } catch (e) { return APP.toast('❌ ये सही JSON फ़ाइल नहीं है'); }
        const P = parseBackup(j); if (P.error) return APP.toast(P.error);
        const lines = Object.keys(P.counts).map(c => '<div style="font-size:13px">• ' + APP.esc(c) + ' — ' + P.counts[c] + '</div>').join('');
        const m = APP.modal('<h3>⬆️ बैकअप से पूरा रिस्टोर</h3><div id="rs-body"><p class="mut" style="font-size:12.5px">फ़ाइल: ' + APP.esc(f.name) + (P.createdAt ? ' · बनी: ' + APP.esc(String(P.createdAt).slice(0, 16).replace('T', ' ')) : '') + '</p>' + lines +
          (P.signed ? '<p style="font-size:12.5px;color:#0a7d33">✔ ये ऐप का अपना बैकअप है, जाँच सही निकली।</p>' : '<p style="font-size:12.5px;color:#c0392b">⚠️ ये ऐप के हस्ताक्षर वाला बैकअप नहीं है। सिर्फ़ तभी रिस्टोर करें जब ये आपका अपना लिया हुआ बैकअप हो।</p>') +
          (P.zeroDays ? '<p style="font-size:12.5px;color:#c0392b">⚠️ इस बैकअप के ' + P.zeroDays + ' दिनों में रेट 0 है — रिस्टोर के बाद "🔎 नियम जाँच" से 🪄 स्वतः ठीक करें चलाएँ।</p>' : '') +
          (P.ignored.length ? '<p class="mut" style="font-size:12px">ये हिस्से छोड़े जाएँगे: ' + APP.esc(P.ignored.join(', ')) + '</p>' : '') +
          '<p style="font-size:12.5px">⚠️ इन हिस्सों का अभी का data बैकअप जैसा हो जाएगा (बैकअप के बाद की एंट्री हट जाएँगी)। रिस्टोर से पहले अभी का data अपने-आप फ़ाइल में डाउनलोड होगा।</p></div><p id="rs-msg" class="mut"></p>' +
          '<div class="btns" style="margin-top:10px"><button class="btn g" id="rs-ok">✅ रिस्टोर करें</button><button class="btn w" id="rs-no">रद्द</button></div>');
        m.querySelector('#rs-no').onclick = () => m.close();
        m.querySelector('#rs-ok').onclick = async () => {
          if (P.signed ? !confirm('पूरा data इस बैकअप से भरा जाएगा। पक्का?') : (prompt('बिना हस्ताक्षर का बैकअप है। आगे बढ़ने के लिए RESTORE लिखें') || '').trim() !== 'RESTORE') return;
          const ok = m.querySelector('#rs-ok'), no = m.querySelector('#rs-no'); ok.disabled = true; no.disabled = true;
          try { await runRestore(P, m); APP.toast('✅ बैकअप से पूरा data वापस आ गया — ऐप दोबारा खुल रहा है'); setTimeout(() => location.reload(), 1500); }
          catch (e) { APP.toast('❌ रिस्टोर पूरा नहीं हुआ: ' + e.message); ok.disabled = false; no.disabled = false; }
        };
      };
      inp.click();
    }
    async function backupNow() { try { const o = await downloadBackup('manual'); APP.toast('✅ बैकअप डाउनलोड हो गया (' + Object.values(o.counts).reduce((a, b) => a + b, 0) + ' रिकॉर्ड)'); } catch (e) { APP.toast('❌ बैकअप नहीं बना: ' + e.message); } }

    /* ===== पार्टी का बैंक जमा (सीधे पंप के बैंक में) + नोट से एंट्री ===== */
    const MODES = [['cash', 'नकद (बैंक में जमा)'], ['cheque', 'चेक'], ['rtgs', 'RTGS'], ['neft', 'NEFT'], ['upi', 'UPI'], ['other', 'अन्य']];
    async function saveBankParty(p) {
      const bank = rawCol('bank_deposits');
      const dup = (await bank.where('date', '==', p.date).get()).docs.map(x => x.data()).find(x => x.partyId === p.partyId && Math.abs(num(x.amount) - p.amount) < 0.01 && x.mode === p.mode && !x.removed);
      if (dup && !confirm('⚠️ ऐसी ही बैंक एंट्री पहले से है (' + (dup.payId || '') + '). फिर भी जोड़ें?')) return false;
      const b = db.batch(), br = db.collection('bank_deposits').doc(), lr = db.collection('ledger').doc(), who = (S.user && S.user.email) || '';
      const payId = 'PAY-' + p.date.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), ml = (MODES.find(m => m[0] === p.mode) || [0, p.mode])[1];
      b.set(br, { bank: 'SBI', date: p.date, amount: p.amount, mode: p.mode, partyId: p.partyId, partyName: p.partyName, direct: true, payId, ref: p.ref || '', note: p.note || '', by: who, at: FV.serverTimestamp() });
      b.set(lr, { partyId: p.partyId, partyName: p.partyName, date: p.date, time: pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()), kind: 'jama', mode: 'bank', payMode: p.mode, amount: p.amount, note: 'बैंक जमा — ' + ml + (p.ref ? ' · ' + p.ref : '') + ' · ' + payId, bankId: br.id, payId, by: who, uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), at: FV.serverTimestamp() });
      b.update(db.collection('parties').doc(p.partyId), { bal: FV.increment(-p.amount) });
      await b.commit(); return payId;
    }
    function parseNote(text) {
      const out = []; String(text || '').split(/\n|;/).forEach(l => { const m = l.match(/SBI\s*\+\s*([\d,]+(?:\.\d+)?)\s*[-–]\s*(.+?)\s*\(\s*([A-Za-z]+)\s*\)/i); if (m) out.push({ amount: num(m[1].replace(/,/g, '')), party: m[2].trim(), mode: m[3].toLowerCase().replace('rtgs', 'rtgs') }); });
      return out;
    }
    async function bankNote() {
      const note = (document.getElementById('f-note') || {}).value || '';
      const items = parseNote(note); if (!items.length) return APP.toast('नोट में "SBI + रकम - पार्टी (Cheque)" वाली लाइन नहीं मिली');
      const parties = await APP.getParties(false, true), nk = s => String(s).toLowerCase().replace(/[\s.\-_()]+/g, ''), date = (S.cur && S.cur.date) || today(); let ok = 0; const miss = [];
      for (const it of items) { const p = parties.find(x => nk(x.name) === nk(it.party)) || parties.find(x => nk(x.name).includes(nk(it.party)) || nk(it.party).includes(nk(x.name))); if (!p) { miss.push(it.party); continue; } const mode = MODES.some(m => m[0] === it.mode) ? it.mode : 'other'; if (!confirm('जोड़ें: ' + p.name + ' — ₹' + it.amount + ' (' + mode + ') — ' + dmy(date) + '?')) continue; try { if (await saveBankParty({ partyId: p.id, partyName: p.name, amount: it.amount, mode, date, note: 'नोट से' })) ok++; } catch (e) { APP.toast(e.message); } }
      APP.S.parties = null; APP.toast(ok + ' बैंक एंट्री बनीं' + (miss.length ? ' · पार्टी नहीं मिली: ' + miss.join(', ') : ''));
    }
    async function bankModal() {
      const ps = await APP.getParties(false, true);
      const m = APP.modal('<h3>🏦 पार्टी का बैंक जमा</h3><p class="mut" style="font-size:12px">पार्टी ने सीधे पंप के बैंक खाते में पैसा डाला। ये सिर्फ़ ledger और बैंक में जुड़ेगा, आज के गल्ले/हिसाब में नहीं।</p>' +
        '<label>पार्टी</label><select id="bp-p">' + ps.map(p => '<option value="' + p.id + '">' + APP.esc(p.name) + '</option>').join('') + '</select>' +
        '<div class="row"><div><label>रकम (₹)</label><input id="bp-a" inputmode="decimal"></div><div><label>तारीख</label><input type="date" id="bp-d" value="' + today() + '" max="' + today() + '"></div></div>' +
        '<label>तरीका</label><select id="bp-m">' + MODES.map(x => '<option value="' + x[0] + '">' + x[1] + '</option>').join('') + '</select>' +
        '<label>चेक/UTR नंबर (हो तो)</label><input id="bp-r"><label>नोट</label><input id="bp-n">' +
        '<div class="btns" style="margin-top:12px"><button class="btn g" id="bp-ok">💾 सेव</button><button class="btn w" id="bp-no">रद्द</button></div>');
      m.querySelector('#bp-no').onclick = () => m.close();
      m.querySelector('#bp-ok').onclick = async () => {
        const g = i => m.querySelector('#' + i).value, pid = g('bp-p'), party = ps.find(x => x.id === pid), amount = num(g('bp-a'));
        if (!party || !(amount > 0)) return APP.toast('पार्टी और रकम भरें');
        try { const id = await saveBankParty({ partyId: pid, partyName: party.name, amount, date: g('bp-d'), mode: g('bp-m'), ref: g('bp-r'), note: g('bp-n') }); if (id) { m.close(); APP.S.parties = null; APP.toast('बैंक जमा दर्ज ✔ ' + id); } } catch (e) { /* toast नियम ने दिखा दिया */ }
      };
    }
    /* ===== बैंक एंट्री "हटाओ" दबाने पर: असल में हटती नहीं, "हटाई गई" निशान लगता है (R10), पार्टी वाली हो तो ledger/बैलेंस भी उलट जाते हैं ===== */
    async function softRemoveBank(id) {
      const sn = await rawCol('bank_deposits').doc(id).get(); if (!sn.exists) return;
      const cur = sn.data(); if (cur.removed) return;
      const b = db.batch();
      b.update(db.collection('bank_deposits').doc(id), { removed: true, removedAt: FV.serverTimestamp(), removedBy: (S.user && S.user.email) || '?' });
      if (cur.partyId) {
        const ls = await rawCol('ledger').where('bankId', '==', id).get();
        ls.docs.forEach(x => b.delete(db.collection('ledger').doc(x.id)));
        if (ls.size) b.update(db.collection('parties').doc(cur.partyId), { bal: FV.increment(num(cur.amount)) });
      }
      await b.commit();
      try { if (S.parties) S.parties.pub = null; APP.toast('✔ बैंक एंट्री "हटाई गई" निशान के साथ हट गई'); } catch (e) { }
    }

    /* ===== पूरा बैंक जमा: मैनेजर डेस्क + पार्टी (चेक/RTGS/UPI/नकद) सब एक कुल में ===== */
    async function bankAllModal() {
      const m = APP.modal('<h3>🏦 पूरा बैंक जमा</h3><p class="mut">लोड हो रहा है…</p>');
      try {
        const [bs, ls] = await Promise.all([rawCol('bank_deposits').get(), rawCol('ledger').where('kind', '==', 'jama').get()]);
        const items = [];
        bs.docs.forEach(x => { const d = x.data(); if (d.removed) return; items.push({ date: d.date, amount: num(d.amount), who: d.partyName || 'मैनेजर डेस्क', mode: d.mode || '-', ref: d.ref || '', payId: d.payId || '', src: d.partyId ? 'पार्टी' : 'डेस्क' }); });
        ls.docs.forEach(x => { const d = x.data(); if (d.mode !== 'bank' || d.bankId) return; items.push({ date: d.date, amount: num(d.amount), who: d.partyName || '', mode: d.payMode || 'bank', ref: '', payId: d.payId || '', src: 'सिर्फ़ ledger में' }); });
        items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const sum = a => K.r2(a.reduce((t, x) => t + x.amount, 0)), by = s => items.filter(x => x.src === s);
        const ml = k => (MODES.find(z => z[0] === k) || [0, k])[1];
        let html = '<h3>🏦 पूरा बैंक जमा</h3><div style="font-size:20px;font-weight:800;color:#0a7d33">कुल ₹' + sum(items).toLocaleString('en-IN') + ' <span class="mut" style="font-size:13px">(' + items.length + ' जमा)</span></div>' +
          '<div style="font-size:13px;margin:6px 0">डेस्क: ₹' + sum(by('डेस्क')).toLocaleString('en-IN') + ' (' + by('डेस्क').length + ') · पार्टी: ₹' + sum(by('पार्टी')).toLocaleString('en-IN') + ' (' + by('पार्टी').length + ')' + (by('सिर्फ़ ledger में').length ? ' · सिर्फ़ ledger में: ₹' + sum(by('सिर्फ़ ledger में')).toLocaleString('en-IN') + ' (' + by('सिर्फ़ ledger में').length + ')' : '') + '</div>';
        html += items.slice(0, 80).map(x => '<div style="border-top:1px solid #e3e8f2;padding:6px 0"><b>₹' + x.amount.toLocaleString('en-IN') + '</b> · ' + APP.esc(x.who) + '<div class="mut" style="font-size:12px">' + dmy(x.date) + ' · ' + APP.esc(ml(x.mode)) + ' · ' + APP.esc(x.src) + (x.ref ? ' · चेक/UTR: ' + APP.esc(x.ref) : '') + (x.payId ? ' · ' + APP.esc(x.payId) : '') + '</div></div>').join('') + (items.length > 80 ? '<div class="mut">…और ' + (items.length - 80) + ' पुरानी</div>' : '');
        html += '<div class="btns" style="margin-top:10px"><button class="btn w" id="ba-x">बंद</button></div>';
        m.querySelector('.sheet').innerHTML = html; m.querySelector('#ba-x').onclick = () => m.close();
      } catch (e) { m.querySelector('.sheet').innerHTML = APP.errBox(e); }
    }
    async function auditModal() {
      const m = APP.modal('<h3>🔎 नियम जाँच</h3><p class="mut">जाँच चल रही है…</p>');
      try {
        const P = await plan(), o = P.out, fixN = P.ledgerRates.length + P.bal.length;
        const sec = (t, a) => '<div style="margin-top:8px"><b>' + t + ' (' + a.length + ')</b>' + (a.length ? a.slice(0, 12).map(x => '<div style="font-size:13px;padding:2px 0">• ' + APP.esc(x) + '</div>').join('') + (a.length > 12 ? '<div class="mut">…और ' + (a.length - 12) + '</div>' : '') : '<div style="color:#0a7d33;font-size:13px">✔ सब ठीक</div>') + '</div>';
        let html = '<h3>🔎 नियम जाँच</h3>' + sec('रेट 0/खाली वाले दिन (सिर्फ़ सूची)', o.zero) + sec('ledger का रेट ≠ दिन का रेट', o.rate) + sec('पार्टी का बैलेंस ≠ एंट्रियों का जोड़', o.bal) +
          sec('बिना हिसाब वाले दिन की एंट्री (सिर्फ़ सूची)', o.nodays) + sec('माइनस कैश वाले दिन (सिर्फ़ सूची)', o.cash) +
          '<div class="mut" style="font-size:12px;margin-top:8px">🪄 स्वतः ठीक करें दिन का रेट कभी नहीं बदलता। ये सिर्फ़ ledger की गलत एंट्री को उस दिन के रेट पर लाता है और पार्टी का बैलेंस मिलाता है। कोई दिन या एंट्री बनेगी/हटेगी नहीं, लॉक दिन नहीं छुए जाएँगे, और सुधार से पहले अभी का data फ़ाइल में डाउनलोड हो जाएगा।</div><div class="btns" style="margin-top:10px">';
        if (fixN && role() === 'owner') html += '<button class="btn g" id="au-fix">🪄 स्वतः ठीक करें (' + fixN + ' गलतियाँ)</button>';
        html += '<button class="btn w" id="au-x">बंद</button></div>';
        m.querySelector('.sheet').innerHTML = html;
        m.querySelector('#au-x').onclick = () => m.close();
        const fx = m.querySelector('#au-fix');
        if (fx) fx.onclick = async () => {
          if (!confirm('ये सिर्फ़ ये बदलेगा:\n• ' + P.ledgerRates.length + ' ledger एंट्री का रेट/रकम\n• ' + P.bal.length + ' पार्टी का बैलेंस\n\nकोई दिन/एंट्री नहीं हटेगी, लॉक दिन नहीं छुएँगे। पहले अभी का data डाउनलोड होगा। आगे बढ़ें?')) return;
          fx.disabled = true; fx.textContent = '⏳ सुधार हो रहा है...';
          try {
            const d = await applyFix();
            APP.toast('✅ सुधार पूरा (ledger: ' + d.l + ', बैलेंस: ' + d.b + ')' + (d.skip ? ' | ' + d.skip + ' लॉक एंट्री छोड़ी' : ''));
            m.close(); if (S.parties) S.parties.pub = null; if (APP.go) APP.go('more');
          } catch (e) { APP.toast('❌ सुधार नहीं हो पाया: ' + e.message); fx.disabled = false; fx.textContent = '🪄 स्वतः ठीक करें (' + fixN + ' गलतियाँ)'; }
        };
      } catch (e) { m.querySelector('.sheet').innerHTML = APP.errBox(e); }
    }
    function bookModal() { const m = APP.modal('<h3>📜 नियम पुस्तिका</h3>' + BOOK.map(r => '<div style="padding:5px 0;border-bottom:1px dashed #e3e8f2;font-size:13.5px"><b>' + r[0] + '</b> · ' + APP.esc(r[1]) + '</div>').join('') + '<div class="btns" style="margin-top:10px"><button class="btn w" id="bk-x">बंद</button></div>'); m.querySelector('#bk-x').onclick = () => m.close(); }

    function rateModal() {
      if (role() !== 'owner') return APP.toast('नया रेट सिर्फ़ मालिक लगा सकता है');
      const m = APP.modal('<h3>💲 नया रेट (मालिक)</h3><p class="mut" style="font-size:12px">आज के हिसाब से रेट बदलेगा और आगे के सब नए दिनों में यही चलेगा। पुराने दिन नहीं बदलते।</p><div class="row"><div><label>पेट्रोल ₹/L</label><input id="rt-p" inputmode="decimal"></div><div><label>डीज़ल ₹/L</label><input id="rt-d" inputmode="decimal"></div></div><div class="btns" style="margin-top:12px"><button class="btn g" id="rt-ok">✅ लागू करें</button><button class="btn w" id="rt-no">रद्द</button></div>');
      m.querySelector('#rt-no').onclick = () => m.close();
      m.querySelector('#rt-ok').onclick = async () => {
        const p = num(m.querySelector('#rt-p').value), d = num(m.querySelector('#rt-d').value); if (!(p > 0) || !(d > 0)) return APP.toast('दोनों रेट भरें');
        if (!confirm('रेट ' + p + ' / ' + d + ' लागू करें? ये आज से सब जगह चलेगा।')) return;
        try {
          const dy = await dayDoc(today()); if (dy && dy.status === 'submitted') return APP.toast('आज का दिन लॉक है — पहले अनलॉक करें');
          APP.Rules.sys = true; try { await db.collection('days').doc(today()).set({ date: today(), rateP: p, rateD: d, status: (dy && dy.status) || 'open' }, { merge: true }); } finally { APP.Rules.sys = false; }
          await db.collection('rate_history').add({ date: today(), rateP: p, rateD: d, by: (S.user && S.user.email) || '', at: FV.serverTimestamp() });
          APP.S.rates = { petrol: p, diesel: d }; APP.S.ratesSetAt = today(); m.close(); APP.toast('नया रेट लागू ✔'); if (APP.go) APP.go('day');
        } catch (e) { APP.toast(e.message); }
      };
    }
    APP.Rules = { rateModal, BOOK, check, gate, audit, sys: false, parseNote, saveBankParty, bankModal, bankNote, bankAllModal, backupNow, restoreModal };

    /* "और" पेज और हिसाब पेज के बटन */
    let tm = null;
    const add = (id, txt, fn, host, cls) => { if (document.getElementById(id)) return; const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'btn ' + (cls || 'w'); b.style.cssText = 'margin-top:10px;width:100%'; b.textContent = txt; b.onclick = fn; host.appendChild(b); };
    function buttons() {
      const main = document.getElementById('main'); if (!main || role() === 'salesman') return;
      if (S.tab === 'more' && role() !== 'viewer') { add('rl-bank', '🏦 पार्टी का बैंक जमा जोड़ें', bankModal, main, 'g'); add('rl-bankall', '🏦 पूरा बैंक जमा (पार्टी समेत)', bankAllModal, main, 'g'); if (role() === 'owner') add('rl-rate', '💲 नया रेट लगाएँ (मालिक)', rateModal, main, 'o'); add('rl-audit', '🔎 नियम जाँच (रेट / बैलेंस)', auditModal, main); if (role() === 'owner') { add('rl-bk', '💾 बैकअप डाउनलोड', backupNow, main, 'g'); add('rl-rs', '⬆️ बैकअप अपलोड (पूरा रिस्टोर)', restoreModal, main, 'o'); } add('rl-book', '📜 नियम पुस्तिका', bookModal, main); }
      if (S.tab === 'more' && role() === 'viewer') add('rl-book', '📜 नियम पुस्तिका', bookModal, main);
      if (S.tab === 'day' && role() !== 'viewer' && document.getElementById('f-note') && !document.getElementById('rl-note')) { const n = document.getElementById('f-note'); const b = document.createElement('button'); b.id = 'rl-note'; b.type = 'button'; b.className = 'btn sm o'; b.style.marginTop = '6px'; b.textContent = '🏦 नोट से बैंक एंट्री बनाओ'; b.onclick = bankNote; n.after(b); }
    }
    new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { try { buttons(); } catch (e) { } }, 250); }).observe(document.getElementById('main') || document.body, { childList: true, subtree: !document.getElementById('main') });
    console.log('[Mazda rules.js] नियम पुस्तिका चालू ✓ (' + BOOK.length + ' नियम)');
  }
  function wait() { if (window.APP && window.APP.db && document.getElementById('main')) start(); else setTimeout(wait, 400); }
  if (document.readyState === 'complete') setTimeout(wait, 600); else window.addEventListener('load', () => setTimeout(wait, 900));
})();
