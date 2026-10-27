/* Mazda Oil Company - Features pack 1 (backup, reports, cash alert, party cards, extras) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();
  const isViewer = () => APP.isViewer && APP.isViewer();
  const kv = (a, b, c) => `<div class="kv"><span>${a}</span><b class="${c||''}">${b}</b></div>`;
  APP.views = APP.views || {};

  function dlBlob(txt, name, mime) {
    const b = new Blob([txt], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function initials(name) { return String(name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }
  function monthKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthLabel(ym) { const p = ym.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('hi-IN', { month: 'long', year: 'numeric' }); }
  function waNum(ph) { let p = String(ph || '').replace(/\D/g, ''); if (!p) return ''; p = p.replace(/^0+/, ''); if (!p.startsWith('91')) p = '91' + p; return p; }

  /* ============ AUTO-DRAFT ============ */
  const DRAFT_K = 'mazda_draft_', TS_K = 'mazda_draft_ts_';
  const origCollect = APP.collectDraft;
  APP.collectDraft = function () {
    try { if (origCollect) origCollect(); } catch (e) {}
    try {
      if (S.cur && S.cur.date && S.draft && S.draft[S.cur.date]) {
        localStorage.setItem(DRAFT_K + S.cur.date, JSON.stringify(S.draft[S.cur.date]));
        localStorage.setItem(TS_K + S.cur.date, String(Date.now()));
      }
    } catch (e) {}
  };

  let dTimer = null;
  document.addEventListener('input', e => {
    if (!S.cur || S.cur.locked || !e.target.closest('#main')) return;
    if (e.target.id === 'f-date' ||
        e.target.id === 'f-costP' || e.target.id === 'f-costD' || e.target.id === 'reg-photo-in') return;
    clearTimeout(dTimer);
    dTimer = setTimeout(() => { try { APP.collectDraft(); } catch (x) {} }, 500);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.cur && !S.cur.locked) { try { APP.collectDraft(); } catch (x) {} }
  });
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-do]'); if (!btn) return;
    if (btn.dataset.do !== 'save' && btn.dataset.do !== 'submit') return;
    const date = S.cur && S.cur.date; if (!date) return;
    setTimeout(async () => {
      try {
        const snap = await db().collection('days').doc(date).get();
        if (snap.exists && snap.get('at')) {
          const at = snap.get('at'); const ts = at && at.toDate ? at.toDate().getTime() : 0;
          if (Date.now() - ts < 15000) {
            localStorage.removeItem(DRAFT_K + date);
            localStorage.removeItem(TS_K + date);
            if (S.draft) delete S.draft[date];
          }
        }
      } catch (x) {}
    }, 2500);
  }, true);

  async function restoreDraftsSmart() {
    if (!db()) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(DRAFT_K) === 0) keys.push(k);
    }
    for (const k of keys) {
      const date = k.slice(DRAFT_K.length);
      let draft; try { draft = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
      if (!draft) { localStorage.removeItem(k); continue; }
      const dTs = parseInt(localStorage.getItem(TS_K + date) || '0', 10);
      try {
        const snap = await db().collection('days').doc(date).get();
        if (snap.exists) {
          const at = snap.get('at'); const dbTs = at && at.toDate ? at.toDate().getTime() : 0;
          if (dTs > dbTs + 1000) S.draft[date] = draft;
          else { localStorage.removeItem(k); localStorage.removeItem(TS_K + date); }
        } else S.draft[date] = draft;
      } catch (e) {}
    }
  }

  /* ============ BACKUP ============ */
  APP.downloadBackup = async function (fmt) {
    toast('बैकअप तैयार हो रहा है…');
    try {
      const cols = ['days', 'ledger', 'parties', 'priv_ledger', 'priv_parties', 'gaadi_cash',
                    'bank_deposits', 'audit', 'workers', 'attendance', 'salary_payments',
                    'rate_history', 'day_costs', 'day_photos', 'runsheets', 'sm_shifts', 'cash_submissions', 'shop'];
      const out = {};
      for (const c of cols) {
        try {
          const snap = await db().collection(c).get();
          out[c] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { out[c] = []; }
      }
      out._meta = { exportedAt: new Date().toISOString(), app: 'mazda-pump', version: 3 };
      const stamp = today();
      if (fmt === 'csv') {
        const lines = ['collection,id,data'];
        Object.keys(out).forEach(k => {
          if (!Array.isArray(out[k])) return;
          out[k].forEach(r => {
            lines.push([k, r.id, JSON.stringify(r)].map(s => '"' + String(s).replace(/"/g, '""') + '"').join(','));
          });
        });
        dlBlob('\ufeff' + lines.join('\n'), 'mazda-backup-' + stamp + '.csv', 'text/csv;charset=utf-8');
      } else {
        dlBlob(JSON.stringify(out, null, 2), 'mazda-backup-' + stamp + '.json', 'application/json');
      }
      toast('बैकअप डाउनलोड ✔');
    } catch (e) { alert('बैकअप नहीं बना: ' + e.message); }
  };

  /* ============ PROFESSIONAL PARTY STATEMENT (A4, multi-page, bilingual) ============ */
  APP.sharePartyStatement = async function (partyId, priv) {
    const pcol = priv ? 'priv_parties' : 'parties';
    const lcol = priv ? 'priv_ledger' : 'ledger';

    let ps, es;
    try {
      [ps, es] = await Promise.all([db().collection(pcol).doc(partyId).get(), db().collection(lcol).where('partyId', '==', partyId).get()]);
    } catch (e) { return toast('डेटा नहीं मिला: ' + e.message); }
    if (!ps.exists) return toast('पार्टी नहीं मिली');

    const p = { id: partyId, ...ps.data() };
    const allRows = es.docs.map(x => ({ id: x.id, ...x.data() }));

    const todayD = today();
    const firstDay = todayD.slice(0, 8) + '01';
    const lastDay = (() => { const d = new Date(todayD.slice(0, 4), todayD.slice(5, 7), 0); return todayD.slice(0, 8) + String(d.getDate()).padStart(2, '0'); })();
    const m = modal(`
      <h3>📄 स्टेटमेंट जनरेट करें</h3>
      <p class="mut" style="font-size:12px;margin-bottom:10px;">तारीख चुनें, हम प्रोफेशनल स्टेटमेंट बनाएंगे।</p>
      <div class="row">
        <div><label>कब से (From)</label><input type="date" id="st-from" value="${firstDay}"></div>
        <div><label>कब तक (To)</label><input type="date" id="st-to" value="${lastDay}"></div>
      </div>
      <div class="btns" style="margin-top:14px">
        <button class="btn g" id="st-pdf">🖨️ Print / PDF</button>
        <button class="btn w" id="st-img">📤 WhatsApp Image</button>
        <button class="btn w" id="st-cancel">रद्द</button>
      </div>
    `);
    $('#st-cancel', m).onclick = () => m.close();

    /* ---------- छोटे हेल्पर ---------- */
    const inr = n => Number(num(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const litF = n => Number(num(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const drcr = n => (n < 0 ? inr(Math.abs(n)) + ' <span class="u">Cr</span>' : inr(n) + ' <span class="u">Dr</span>');
    const drcrTxt = n => (n < 0 ? inr(Math.abs(n)) + ' Cr' : inr(n) + ' Dr');
    const FUEL = { petrol: 'पेट्रोल (Petrol)', diesel: 'डीज़ल (Diesel)' };
    const MODE = { cash: 'Cash / नकद', paytm: 'Paytm / UPI', upi: 'Paytm / UPI', swipe: 'Card Swipe', card: 'Card Swipe', bank: 'Bank Transfer', sbi: 'Bank Transfer' };
    const nowStr = () => { const d = new Date(), z = x => String(x).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`; };
    const stNo = to => 'ST' + to.slice(2, 4) + to.slice(5, 7) + to.slice(8, 10) + '-' + String(p.id).replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase();

    const particulars = r => {
      if (r.kind === 'jama') {
        const md = MODE[String(r.mode || '').toLowerCase()] || (r.mode ? esc(r.mode) : 'Cash / नकद');
        return `<div class="pt">जमा — ${md}</div>${r.note ? `<div class="ps">${esc(r.note)}</div>` : ''}`;
      }
      const veh = esc(r.vehicle || '') || '—';
      let sub = '';
      if (num(r.litre) > 0) {
        const f = FUEL[r.fuel] || 'तेल (Fuel)';
        sub = `${f} · ${litF(r.litre)} L${num(r.rate) > 0 ? ` × ₹${inr(r.rate)}/L` : ''}`;
      } else if (r.note) sub = esc(r.note);
      else sub = 'गाड़ी कैश / Cash Advance';
      return `<div class="pt">${veh}</div><div class="ps">${sub}</div>`;
    };

    /* ---------- पेज बनाने वाला ---------- */
    const genHTML = (from, to) => {
      const st = K.stmt(allRows, from, to);
      const cnt = st.rows.length;
      const no = stNo(to), gen = nowStr();

      const CAP1 = 13, CAPN = 21, TOT_NEED = 6;
      const chunks = [];
      let i = 0;
      chunks.push(st.rows.slice(i, i += CAP1));
      while (i < st.rows.length) chunks.push(st.rows.slice(i, i += CAPN));
      const lastCap = chunks.length === 1 ? CAP1 : CAPN;
      if (chunks[chunks.length - 1].length > lastCap - TOT_NEED) chunks.push([]);
      const N = chunks.length;

      let sno = 0;
      const rowHTML = r => {
        sno++;
        const dr = r.kind === 'udhar', cr = r.kind === 'jama';
        return `<tr>
          <td class="c-n">${sno}</td>
          <td class="c-d"><div class="d1">${dmy(r.date)}</div>${r.time ? `<div class="d2">${esc(String(r.time).slice(0, 5))}</div>` : ''}</td>
          <td class="c-p">${particulars(r)}</td>
          <td class="c-dr">${dr ? inr(r.amount) : ''}</td>
          <td class="c-cr">${cr ? inr(r.amount) : ''}</td>
          <td class="c-b">${drcr(r.run)}</td>
        </tr>`;
      };
      const theadHTML = `<thead><tr>
          <th class="c-n">#</th>
          <th class="c-d"><b>तारीख</b><br>Date</th>
          <th class="c-p"><b>विवरण</b> / Particulars</th>
          <th class="c-dr"><b>उधार (Dr)</b><br>₹</th>
          <th class="c-cr"><b>जमा (Cr)</b><br>₹</th>
          <th class="c-b"><b>बैलेंस</b><br>Balance</th>
        </tr></thead>`;
      const bfRow = `<tr class="bf"><td class="c-n"></td><td class="c-d"><div class="d1">${dmy(from)}</div></td>
          <td class="c-p"><div class="pt">आगे लाया गया बैलेंस (Balance b/f)</div></td><td class="c-dr"></td><td class="c-cr"></td><td class="c-b">${drcr(st.open)}</td></tr>`;

      const head = `
        <div class="hd">
          <div class="hd-l">
            <img src="./logo.png" class="lg" alt="">
            <div>
              <div class="co">${esc(C.pump.nameEn)}</div>
              <div class="ad">${esc(C.pump.addressEn)}</div>
              <div class="ad">📞 ${esc(C.pump.phone)}${C.pump.gstin ? ' &nbsp;·&nbsp; GSTIN: ' + esc(C.pump.gstin) : ''}</div>
            </div>
          </div>
          <div class="hd-r">
            <div class="ti">ACCOUNT STATEMENT</div>
            <div class="th">खाता विवरण</div>
            <div class="mt">Statement No: <b>${no}</b></div>
            <div class="mt">Generated: ${gen}</div>
          </div>
        </div>`;

      const partyBox = `
        <div class="pb">
          <div class="box party">
            <div class="lb">PARTY / पार्टी</div>
            <div class="pn">${esc(p.name)}</div>
            ${p.phone ? `<div class="pm">📞 ${esc(p.phone)}</div>` : ''}
            ${(p.vehicles || []).length ? `<div class="pm">🚚 ${esc(p.vehicles.join(', '))}</div>` : ''}
          </div>
          <div class="box period">
            <div class="lb">PERIOD / अवधि</div>
            <div class="pr">${dmy(from)} से ${dmy(to)}</div>
            ${num(p.limit) > 0 ? `<div class="pm">उधार सीमा: ₹${inr(p.limit)}</div>` : ''}
          </div>
        </div>
        <div class="sum">
          <div class="sb"><div class="s1">Opening Balance</div><div class="s2">पिछला बैलेंस</div><div class="sv">₹${drcrTxt(st.open)}</div></div>
          <div class="sb"><div class="s1">Total Debit</div><div class="s2">कुल उधार</div><div class="sv red">₹${inr(st.totU)}</div></div>
          <div class="sb"><div class="s1">Total Credit</div><div class="s2">कुल जमा</div><div class="sv grn">₹${inr(st.totJ)}</div></div>
          <div class="sb cl"><div class="s1">Closing Balance</div><div class="s2">अंतिम बकाया</div><div class="sv red big">₹${drcrTxt(st.close)}</div></div>
        </div>
        <div class="info">
          <span>एंट्री: <b>${cnt}</b></span>
          ${st.totLit > 0 ? `<span>कुल तेल: <b>${litF(st.totLit)} L</b> (पेट्रोल ${litF(st.litP)} · डीज़ल ${litF(st.litD)})</span>` : ''}
          ${st.lastJama ? `<span>आखिरी जमा: <b>${dmy(st.lastJama.date)} · ₹${inr(st.lastJama.amount)}</b></span>` : ''}
          ${st.lastUdhar ? `<span>आखिरी उधार: <b>${dmy(st.lastUdhar.date)}</b></span>` : ''}
        </div>
        <div class="sec">📒 लेन-देन का पूरा विवरण (Transaction Details)</div>`;

      const contHead = pg => `
        <div class="hd mini">
          <div class="hd-l"><img src="./logo.png" class="lg sm" alt=""><div><div class="co s">${esc(C.pump.nameEn)}</div><div class="ad">${esc(p.name)} · ${dmy(from)} से ${dmy(to)}</div></div></div>
          <div class="hd-r"><div class="ti s">ACCOUNT STATEMENT</div><div class="mt">${no}</div></div>
        </div>`;

      const totals = `
        <div class="tot">
          <div class="tr"><span>कुल उधार / Total Debit</span><b class="red">₹${inr(st.totU)}</b></div>
          <div class="tr"><span>कुल जमा / Total Credit</span><b class="grn">₹${inr(st.totJ)}</b></div>
          <div class="tr fin"><span>अंतिम बकाया / Closing Balance</span><b>₹${drcrTxt(st.close)}</b></div>
        </div>
        <div class="sign"><div class="note">यह कंप्यूटर द्वारा बनाया गया स्टेटमेंट है। कोई अंतर दिखे तो 3 दिन के अंदर बताएँ।<br>This is a computer generated statement. | धन्यवाद — Thank you for your business!</div>
        <div class="sg"><div class="sl"></div>Authorised Signatory<br><b>${esc(C.pump.nameEn)}</b></div></div>`;

      const pages = chunks.map((rows, idx) => {
        const first = idx === 0, last = idx === N - 1;
        return `<section class="stm-page">
          ${first ? head + partyBox : contHead(idx + 1)}
          <table class="tb">${theadHTML}<tbody>${first ? bfRow : ''}${rows.map(rowHTML).join('')}</tbody></table>
          ${last ? totals : `<div class="cont">आगे जारी… / Continued on next page</div>`}
          <div class="ft"><span>${esc(C.pump.nameEn)} · ${esc(p.name)} · ${no}</span><span>Page ${idx + 1} / ${N}</span></div>
        </section>`;
      });
      return { html: `<style>${STMT_CSS}</style><div class="stm-wrap">${pages.join('')}</div>`, n: N };
    };

    const STMT_CSS = `
      .stm-wrap{font-family:'Segoe UI','Noto Sans Devanagari','Helvetica Neue',Arial,sans-serif;color:#1b2333;background:#fff;width:794px}
      .stm-wrap *{box-sizing:border-box}
      .stm-page{position:relative;width:794px;height:1123px;padding:34px 38px 62px;background:#fff;overflow:hidden;page-break-after:always;break-after:page}
      .stm-page:last-child{page-break-after:auto;break-after:auto}
      .stm-wrap .hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid #1f3a8a;margin-bottom:14px}
      .stm-wrap .hd.mini{padding-bottom:9px;margin-bottom:12px;align-items:center}
      .stm-wrap .hd-l{display:flex;gap:14px;align-items:center}
      .stm-wrap .lg{width:62px;height:62px;border-radius:50%;object-fit:cover}.stm-wrap .lg.sm{width:38px;height:38px}
      .stm-wrap .co{font-size:25px;font-weight:700;color:#1f3a8a;line-height:1.15;letter-spacing:.2px}.stm-wrap .co.s{font-size:17px}
      .stm-wrap .ad{font-size:12px;color:#5b6577;margin-top:2px}
      .stm-wrap .hd-r{text-align:right}
      .stm-wrap .ti{font-size:19px;font-weight:700;color:#1f3a8a;letter-spacing:.3px}.stm-wrap .ti.s{font-size:14px}
      .stm-wrap .th{font-size:14px;font-weight:700;color:#1b2333;margin-top:1px}
      .stm-wrap .mt{font-size:11.5px;color:#5b6577;margin-top:3px}.stm-wrap .mt b{color:#1b2333}
      .stm-wrap .pb{display:grid;grid-template-columns:1.55fr 1fr;gap:12px;margin-bottom:12px}
      .stm-wrap .box{border:1px solid #d8dfee;border-radius:10px;padding:11px 14px;background:#fff}
      .stm-wrap .box.party{background:linear-gradient(180deg,#f6f8fe,#eef2fc)}
      .stm-wrap .lb{font-size:10.5px;letter-spacing:.6px;color:#6b7385;margin-bottom:4px}
      .stm-wrap .pn{font-size:20px;font-weight:700;line-height:1.25}
      .stm-wrap .pm{font-size:12.5px;color:#3b4457;margin-top:3px}
      .stm-wrap .pr{font-size:15px;font-weight:700;margin:2px 0 6px}
      .stm-wrap .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px}
      .stm-wrap .sb{border:1px solid #d8dfee;border-radius:10px;padding:10px 6px;text-align:center;background:#fff}
      .stm-wrap .sb.cl{background:#fdf1f1;border-color:#f0c9c9}
      .stm-wrap .s1{font-size:11.5px;color:#4a5468}.stm-wrap .s2{font-size:10.5px;color:#7b8498;margin-bottom:5px}
      .stm-wrap .sv{font-size:17px;font-weight:700;color:#1b2333;font-variant-numeric:tabular-nums;white-space:nowrap}
      .stm-wrap .sv.red{color:#b3261e}.stm-wrap .sv.grn{color:#1e7d34}.stm-wrap .sv.big{font-size:18.5px}
      .stm-wrap .info{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:11.5px;color:#3b4457;margin:2px 0 10px}
      .stm-wrap .info b{color:#1b2333}
      .stm-wrap .sec{font-size:14.5px;font-weight:700;color:#1f3a8a;margin:4px 0 7px}
      .stm-wrap table.tb{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
      .stm-wrap .tb th{background:#1f3a8a;color:#fff;padding:8px 8px;font-size:11px;font-weight:500;line-height:1.3;height:42px;text-align:left}
      .stm-wrap .tb th b{font-weight:700}
      .stm-wrap .tb td{height:43px;padding:4px 8px;border-bottom:1px solid #e6eaf3;vertical-align:middle;overflow:hidden}
      .stm-wrap .tb tbody tr:nth-child(even){background:#fafbfe}
      .stm-wrap .tb tr.bf{background:#fdf6dc!important}.stm-wrap .tb tr.bf td{height:34px;border-bottom:1px solid #ecdca0}
      .stm-wrap .c-n{width:30px;color:#6b7385;text-align:left}
      .stm-wrap .c-d{width:84px}.stm-wrap .c-p{width:auto}
      .stm-wrap .c-dr,.stm-wrap .c-cr{width:96px;text-align:right!important}
      .stm-wrap .c-b{width:112px;text-align:right!important}
      .stm-wrap .d1{font-size:12px;color:#2b3447}.stm-wrap .d2{font-size:10px;color:#8a93a6;margin-top:1px}
      .stm-wrap .pt{font-size:12.5px;font-weight:700;color:#1b2333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .stm-wrap .ps{font-size:10.8px;color:#5b6577;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .stm-wrap td.c-dr{color:#b3261e;font-variant-numeric:tabular-nums}
      .stm-wrap td.c-cr{color:#1e7d34;font-variant-numeric:tabular-nums}
      .stm-wrap td.c-b{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
      .stm-wrap td.c-b .u{font-size:9.5px;font-weight:500;color:#6b7385}
      .stm-wrap .cont{text-align:center;font-size:11px;color:#8a93a6;margin-top:10px;font-style:italic}
      .stm-wrap .tot{margin:14px 0 0 auto;width:330px;border:1px solid #d8dfee;border-radius:10px;overflow:hidden}
      .stm-wrap .tot .tr{display:flex;justify-content:space-between;padding:8px 14px;font-size:12.5px;border-bottom:1px solid #e6eaf3}
      .stm-wrap .tot .tr b{font-variant-numeric:tabular-nums}.stm-wrap .tot .red{color:#b3261e}.stm-wrap .tot .grn{color:#1e7d34}
      .stm-wrap .tot .fin{background:#1f3a8a;color:#fff;font-size:14px;font-weight:700;border:0}
      .stm-wrap .sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;gap:20px}
      .stm-wrap .note{font-size:10.5px;color:#6b7385;line-height:1.6;max-width:430px}
      .stm-wrap .sg{text-align:center;font-size:11px;color:#3b4457;min-width:170px}.stm-wrap .sl{border-top:1px solid #8a93a6;margin-bottom:5px}
      .stm-wrap .ft{position:absolute;left:38px;right:38px;bottom:26px;display:flex;justify-content:space-between;font-size:10.5px;color:#7b8498;border-top:1px solid #e1e6f0;padding-top:8px}
      @media print{@page{size:A4;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;

    $('#st-pdf', m).onclick = () => {
      const from = $('#st-from', m).value, to = $('#st-to', m).value;
      if (!from || !to) return toast('तारीख चुनें');
      if (from > to) return toast('"कब से" तारीख "कब तक" से पहले की होनी चाहिए');
      const { html } = genHTML(from, to);
      const win = window.open('', '_blank');
      if (!win) return toast('पॉप-अप ब्लॉक है — अनुमति दें');
      win.document.write(`<html><head><meta charset="utf-8"><meta name="viewport" content="width=794"><title>Statement - ${esc(p.name)}</title><style>body{margin:0;background:#e9edf5}@media print{body{background:#fff}}</style></head><body>${html}</body></html>`);
      win.document.close();
      setTimeout(() => { win.print(); }, 700);
      m.close();
    };

    $('#st-img', m).onclick = async () => {
      const from = $('#st-from', m).value, to = $('#st-to', m).value;
      if (!from || !to) return toast('तारीख चुनें');
      if (from > to) return toast('"कब से" तारीख "कब तक" से पहले की होनी चाहिए');
      m.close();
      toast('इमेज तैयार हो रही है…');

      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;';
      wrap.innerHTML = genHTML(from, to).html;
      document.body.appendChild(wrap);

      try {
        const pages = Array.from(wrap.querySelectorAll('.stm-page'));
        const files = [];
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          files.push(new File([blob], `statement-${p.name}-${i + 1}of${pages.length}.png`, { type: 'image/png' }));
        }
        if (navigator.canShare && navigator.canShare({ files })) {
          await navigator.share({ files, text: `Account Statement — ${p.name} (${dmy(from)} से ${dmy(to)})` });
        } else {
          files.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); });
          toast('डाउनलोड हो गया ✔');
        }
      } catch (e) { if (!e || e.name !== 'AbortError') toast('इमेज नहीं बनी'); }
      document.body.removeChild(wrap);
    };
  };

  /* ============ AUDIT LOG ============ */
  APP.views.audit = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लॉग लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('audit').orderBy('at', 'desc').limit(200).get(); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    main.innerHTML =
      '<div class="card"><h3>🔍 बदलाव का रिकॉर्ड</h3>' +
        (list.length ? list.map(x => '<div class="item"><div class="a"><b>' + esc(x.action || '?') + '</b><small>' +
          esc(x.by || '?') + ' · ' + (x.at && x.at.toDate ? x.at.toDate().toLocaleString('hi-IN') : '') +
          '</small><small class="mut" style="word-break:break-all">' + esc(String(x.detail || '').slice(0, 220)) + '</small></div></div>').join('') : '<p class="mut">कोई लॉग नहीं</p>') +
      '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
  };

  /* ============ CUSTOMERS ============ */
  APP.views.customers = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">ग्राहक लोड हो रहे हैं…</p>';
    let parties;
    try { parties = await APP.getParties(false, true); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const sorted = parties.slice().sort((a, b) => num(b.bal) - num(a.bal));
    main.innerHTML =
      '<div class="btns" style="margin-bottom:10px"><input id="cq" placeholder="नाम या गाड़ी खोजें…" style="flex:1;min-width:0"></div>' +
      '<div id="cgrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px"></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    const draw = t => {
      const list = sorted.filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.vehicles || []).join(' ').toLowerCase().includes(t));
      $('#cgrid').innerHTML = list.map(p => {
        const b = num(p.bal), photo = p.photo || '', ini = initials(p.name);
        const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
        return '<div class="card" style="padding:10px;cursor:pointer" data-pid="' + p.id + '">' +
          '<div style="display:flex;flex-direction:column;align-items:center">' +
          (photo
            ? '<img src="' + esc(photo) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #0b3d91">'
            : '<div style="width:64px;height:64px;border-radius:50%;background:#0b3d91;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700">' + esc(ini) + '</div>') +
          '<b style="margin-top:6px;text-align:center;font-size:13px;line-height:1.2">' + esc(p.name) + '</b>' +
          '<span class="chip ' + (b > 0 ? 'r' : 'g') + '" style="margin-top:4px;font-size:11px">' + money(b) + '</span>' +
          (ph ? '<div style="display:flex;gap:4px;margin-top:6px" onclick="event.stopPropagation()">' +
            '<a href="tel:' + esc(p.phone) + '" class="btn sm w" style="padding:4px 8px;font-size:11px">📞</a>' +
            (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn sm g" style="padding:4px 8px;font-size:11px">💬</a>' : '') +
          '</div>' : '') +
          '</div></div>';
      }).join('') || '<p class="mut">कोई ग्राहक नहीं</p>';
      $$('[data-pid]').forEach(el => el.onclick = () => APP.customerCard(el.dataset.pid));
    };
    $('#cq').oninput = e => draw(e.target.value.trim().toLowerCase());
    draw('');
  };

  APP.customerCard = async function (id) {
    let ps; try { ps = await db().collection('parties').doc(id).get(); } catch (e) { return; }
    if (!ps.exists) return;
    const p = { id, ...ps.data() };
    const ini = initials(p.name);
    const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
    let photoData = p.photo || '';
    const m = modal(
      '<h3>' + esc(p.name) + '</h3>' +
      '<div style="text-align:center;padding:8px 0" id="cc-photo-box">' +
        (photoData ? '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">'
        : '<div style="width:100px;height:100px;border-radius:50%;background:#0b3d91;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:36px;font-weight:700">' + esc(ini) + '</div>') +
      '</div>' +
      (isViewer() ? '' :
        '<div class="btns" style="margin-bottom:8px"><label class="btn sm w" style="cursor:pointer;text-align:center">📷 फोटो<input type="file" accept="image/*" id="cc-photo" style="display:none"></label></div>') +
      '<label>नाम</label><input id="cc-name" value="' + esc(p.name || '') + '"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>फोन</label><input id="cc-phone" value="' + esc(p.phone || '') + '" inputmode="tel"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>गाड़ियाँ</label><input id="cc-veh" value="' + esc((p.vehicles || []).join(', ')) + '"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>उधार सीमा (₹)</label><input id="cc-limit" value="' + esc(p.limit || '') + '" inputmode="decimal"' + (isViewer() ? ' disabled' : '') + '>' +
      '<label>दस्तावेज़ / नोट</label><textarea id="cc-doc" rows="2"' + (isViewer() ? ' disabled' : '') + '>' + esc(p.docs || '') + '</textarea>' +
      '<div class="kv" style="margin-top:8px"><span>वर्तमान बकाया</span><b class="' + (num(p.bal) > 0 ? 'neg' : 'pos') + '">' + money(p.bal) + '</b></div>' +
      '<div class="btns" style="margin-top:12px">' +
        (ph ? '<a href="tel:' + esc(p.phone) + '" class="btn g">📞 कॉल</a>' : '') +
        (w ? '<a href="https://wa.me/' + w + '" target="_blank" class="btn g">💬 WhatsApp</a>' : '') +
      '</div>' +
      '<div class="btns">' +
        '<button class="btn" id="cc-stmt">📤 स्टेटमेंट</button>' +
        (isViewer() ? '' : '<button class="btn g" id="cc-save">💾 सेव</button>') +
        '<button class="btn w" id="cc-close">बंद</button>' +
      '</div>'
    );
    $('#cc-close', m).onclick = () => m.close();
    if (!isViewer()) {
      $('#cc-photo', m).onchange = e => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const img = new Image();
          img.onload = () => {
            const max = 200, sc = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = img.width * sc; cv.height = img.height * sc;
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            photoData = cv.toDataURL('image/jpeg', 0.75);
            $('#cc-photo-box', m).innerHTML = '<img src="' + esc(photoData) + '" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #0b3d91">';
            toast('फोटो तैयार ✔');
          };
          img.src = r.result;
        };
        r.readAsDataURL(f);
      };
      $('#cc-save', m).onclick = async () => {
        const data = {
          name: $('#cc-name', m).value.trim(),
          phone: $('#cc-phone', m).value.trim(),
          vehicles: $('#cc-veh', m).value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean),
          limit: num($('#cc-limit', m).value) || 0,
          docs: $('#cc-doc', m).value.trim(),
          photo: photoData
        };
        if (!data.name) return toast('नाम ज़रूरी');
        try { await db().collection('parties').doc(id).update(data); S.parties.pub = null; m.close(); toast('सेव ✔'); APP.views.customers(); }
        catch (e) { toast('सेव नहीं हुआ: ' + e.message); }
      };
    }
    $('#cc-stmt', m).onclick = () => APP.sharePartyStatement(id, false);
  };

  /* ============ BANK DEPOSITS ============ */
  const isOwnerF = () => APP.isOwner && APP.isOwner();
  const isAutoBank = id => String(id || '').indexOf('sbi_auto_') === 0;   // "मालिक को दिया" से अपने-आप बनी

  function bankModal(x, done) {
    const e = x || null;
    const banks = ['SBI', 'HDFC', 'PNB', 'BOB', 'अन्य'];
    if (e && e.bank && banks.indexOf(e.bank) < 0) banks.unshift(e.bank);
    const modes = [['cash', 'नकद'], ['cheque', 'चेक'], ['upi', 'UPI']];
    const m = modal('<h3>' + (e ? '✏️ बैंक जमा बदलें' : 'बैंक जमा') + '</h3>' +
      (e && isAutoBank(e.id) ? '<div class="warn">ये एंट्री दिन के "मालिक को दिया (SBI जमा)" से अपने-आप बनी थी। बदलने के बाद वो दिन दोबारा सेव करने पर भी ये एंट्री अपने-आप नहीं बदलेगी।</div>' : '') +
      '<label>बैंक</label><select id="bn-b">' + banks.map(b => '<option' + (e && e.bank === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>' +
      '<label>तारीख</label><input type="date" id="bn-d" value="' + esc(e ? e.date : today()) + '">' +
      '<label>रकम (₹)</label><input id="bn-a" inputmode="decimal" value="' + esc(e ? e.amount : '') + '">' +
      '<label>माध्यम</label><select id="bn-m">' + modes.map(o => '<option value="' + o[0] + '"' + (e && e.mode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label>चेक नंबर</label><input id="bn-c" value="' + esc(e ? e.cheque || '' : '') + '">' +
      '<label>नोट</label><input id="bn-n" value="' + esc(e ? e.note || '' : '') + '">' +
      '<div class="btns"><button class="btn g" id="bn-sv">सेव</button>' +
      (e ? '<button class="btn r" id="bn-rm">🗑 हटाएँ</button>' : '') +
      '<button class="btn w" id="bn-cl">रद्द</button></div>');
    $('#bn-cl', m).onclick = () => m.close();
    if (e) $('#bn-rm', m).onclick = () => { m.close(); bankRemove(e, done); };
    $('#bn-sv', m).onclick = async () => {
      const a = num($('#bn-a', m).value); if (!(a > 0)) return toast('रकम भरें');
      if (!$('#bn-d', m).value) return toast('तारीख चुनें');
      const who = S.salesman ? S.salesman.name : (S.user && S.user.email) || '';
      const data = {
        bank: $('#bn-b', m).value, date: $('#bn-d', m).value, amount: a,
        mode: $('#bn-m', m).value, cheque: $('#bn-c', m).value.trim(), note: $('#bn-n', m).value.trim()
      };
      try {
        if (e) {
          Object.assign(data, { edited: true, editedBy: who, editedAt: APP.FV.serverTimestamp() });
          await db().collection('bank_deposits').doc(e.id).update(data);
          if (APP.audit) APP.audit('bank_edit', { id: e.id, was: num(e.amount), now: a, date: data.date });
        } else {
          Object.assign(data, { by: who, at: APP.FV.serverTimestamp() });
          await db().collection('bank_deposits').add(data);
        }
        m.close(); toast('सेव ✔'); done();
      } catch (er) { toast('सेव नहीं हुआ: ' + er.message); }
    };
  }

  async function bankRemove(x, done) {
    const auto = isAutoBank(x.id);
    if (!confirm('इस बैंक जमा को हटाएँ?\n\n' + money(x.amount) + ' · ' + (x.bank || 'SBI') + ' · ' + dmy(x.date) +
      (auto ? '\n\nये एंट्री "मालिक को दिया" से अपने-आप बनी थी — हटाने पर दोबारा अपने-आप नहीं बनेगी।' : ''))) return;
    try {
      const who = (S.user && S.user.email) || '';
      if (auto) await db().collection('bank_deposits').doc(x.id).update({ removed: true, removedBy: who, removedAt: APP.FV.serverTimestamp() });
      else await db().collection('bank_deposits').doc(x.id).delete();
      if (APP.audit) APP.audit('bank_delete', { id: x.id, amount: num(x.amount), date: x.date });
      toast('हट गया ✔'); done();
    } catch (er) { toast('हटा नहीं पाया: ' + er.message); }
  }

  APP.views.bank = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('bank_deposits').orderBy('date', 'desc').limit(50).get(); } catch (e) { snap = { docs: [] }; }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => !x.removed);
    const tot = list.reduce((a, b) => a + num(b.amount), 0);
    const canEdit = isOwnerF();
    main.innerHTML =
      '<div class="card"><h3>🏦 बैंक जमा</h3>' + kv('कुल जमा', money(tot), 'pos') + kv('जमा संख्या', list.length) + '</div>' +
      (isViewer() ? '' : '<div class="btns" style="margin-bottom:12px"><button class="btn o" id="bn-add">+ नई जमा</button></div>') +
      '<div class="card">' +
        (list.length ? list.map((x, i) => '<div class="item"><div class="a"><b>' + money(x.amount) + ' · ' + esc(x.bank || 'SBI') + '</b><small>' +
          dmy(x.date) + ' · ' + esc(x.mode || 'नकद') + (x.cheque ? ' · चेक ' + esc(x.cheque) : '') +
          (x.note ? ' · ' + esc(x.note) : '') + (x.edited ? ' · ✏️ बदली हुई' : '') + '</small></div>' +
          (canEdit ? '<div style="white-space:nowrap"><button class="btn sm w" data-bn-e="' + i + '">✏️</button> <button class="btn sm r" data-bn-d="' + i + '">🗑</button></div>' : '') +
          '</div>').join('') : '<p class="mut">कोई जमा नहीं</p>') +
      '</div><div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    const again = () => APP.views.bank();
    if (!isViewer() && $('#bn-add')) $('#bn-add').onclick = () => bankModal(null, again);
    $$('[data-bn-e]', main).forEach(b => b.onclick = () => bankModal(list[+b.dataset.bnE], again));
    $$('[data-bn-d]', main).forEach(b => b.onclick = () => bankRemove(list[+b.dataset.bnD], again));
  };

  /* ============ PARTY VIEW BUTTONS (call/WA/statement) ============ */
  document.addEventListener('click', e => {
    const item = e.target.closest('#plist .item[data-id]');
    if (item) window.__mazdaLastPartyId = item.dataset.id;
  }, true);

  function injectPartyActions() {
    const back = document.querySelector('#main #back'); if (!back) return;
    if (document.querySelector('#main #stmt-share')) return;
    const pid = window.__mazdaLastPartyId; if (!pid) return;
    db().collection('parties').doc(pid).get().then(snap => {
      if (!snap.exists) return;
      const p = snap.data();
      const ph = (p.phone || '').replace(/\D/g, ''), w = waNum(p.phone);
      const wrap = document.createElement('span');
      wrap.style.display = 'inline-flex'; wrap.style.gap = '6px';
      let html = '';
      if (ph) html += '<a href="tel:' + esc(p.phone) + '" class="btn sm g">📞</a>';
      if (w) html += '<a href="https://wa.me/' + w + '" target="_blank" class="btn sm g">💬</a>';
      html += '<button class="btn sm g" id="stmt-share">📤 स्टेटमेंट</button>';
      wrap.innerHTML = html;
      back.parentNode.appendChild(wrap);
      const sb = document.getElementById('stmt-share');
      if (sb) sb.onclick = () => APP.sharePartyStatement(pid, false);
    }).catch(() => {});
  }

  /* ============ DAYVIEW EXTRAS: cash box, cost fields, register photo, dup check ============ */
  function injectDayExtras() {
    injectCashBox();
    injectPhotoBtn();
    injectPartyActions();
    if (document.querySelector('#sum')) checkDuplicates();
  }
  function injectCashBox() {
    if (document.querySelector('#f-physicalCash')) return;
    const note = document.querySelector('#f-note'); if (!note) return;
    const card = note.closest('.card'); if (!card) return;
    const locked = S.cur && S.cur.locked;
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<label>दराज़ में असली नकद (गिनकर)</label>' +
      '<input id="f-physicalCash" inputmode="decimal" placeholder="गिनकर डालें"' + (locked ? ' disabled' : '') + '>' +
      '<div id="cash-diff"></div>';
    card.appendChild(wrap);
    const inp = document.getElementById('f-physicalCash');
    const update = () => {
      const el = document.getElementById('cash-diff'); if (!el) return;
      const st = S.cur;
      if (!inp.value || !st || !st.o) { el.innerHTML = ''; return; }
      const actual = num(inp.value), exp = st.o.close, diff = K.r2(actual - exp);
      if (Math.abs(diff) < 1) el.innerHTML = '<div class="ok">✔ नकद बिल्कुल सही</div>';
      else if (diff > 0) el.innerHTML = '<div class="warn">➕ ज़्यादा: ₹' + Math.abs(diff).toFixed(2) + '</div>';
      else el.innerHTML = '<div class="err">➖ कम: ₹' + Math.abs(diff).toFixed(2) + '</div>';
    };
    inp.addEventListener('input', () => { update(); if (APP.triggerAutoSave) APP.triggerAutoSave(); });
    const sum = document.querySelector('#sum');
    if (sum) new MutationObserver(update).observe(sum, { childList: true, subtree: true, characterData: true });
    const pc0 = S.cur && S.cur.d ? S.cur.d.physicalCash : '';
    if (pc0 !== undefined && pc0 !== null && pc0 !== '') inp.value = pc0;
    update();
  }
  function injectCostFields() {
    if (document.querySelector('#f-costP')) return;
    const h3s = document.querySelectorAll('#main .card h3');
    let rateCard = null;
    h3s.forEach(h => { if (h.textContent.includes('आज का रेट')) rateCard = h.closest('.card'); });
    if (!rateCard) return;
    const locked = S.cur && S.cur.locked;
    const dis = locked ? ' disabled' : '';
    const row = document.createElement('div');
    row.className = 'row'; row.style.marginTop = '8px';
    row.innerHTML =
      '<div><label>खरीद रेट P (₹/L)</label><input id="f-costP" inputmode="decimal" placeholder="लागत रेट P"' + dis + '></div>' +
      '<div><label>खरीद रेट D (₹/L)</label><input id="f-costD" inputmode="decimal" placeholder="लागत रेट D"' + dis + '></div>';
    rateCard.appendChild(row);
    const date = S.cur && S.cur.date;
    if (!date) return;
    db().collection('day_costs').doc(date).get().then(snap => {
      if (snap.exists) {
        const d = snap.data();
        const pe = document.getElementById('f-costP'), de = document.getElementById('f-costD');
        if (pe && d.costP) pe.value = d.costP;
        if (de && d.costD) de.value = d.costD;
      }
    }).catch(() => {});
    if (!locked) {
      const save = async () => {
        try {
          await db().collection('day_costs').doc(date).set({
            costP: num(document.getElementById('f-costP').value),
            costD: num(document.getElementById('f-costD').value),
            at: APP.FV.serverTimestamp()
          }, { merge: true });
          try {
            const existing = await db().collection('rate_history').where('date', '==', date).limit(1).get();
            const dayDoc = await db().collection('days').doc(date).get();
            const dd = dayDoc.exists ? dayDoc.data() : {};
            const entry = {
              date, costP: num(document.getElementById('f-costP').value),
              costD: num(document.getElementById('f-costD').value),
              rateP: num(dd.rateP), rateD: num(dd.rateD),
              at: APP.FV.serverTimestamp()
            };
            if (existing.empty) await db().collection('rate_history').add(entry);
            else await db().collection('rate_history').doc(existing.docs[0].id).update(entry);
          } catch (x) {}
        } catch (e) {}
      };
      const pe = document.getElementById('f-costP'); if (pe) pe.onchange = save;
      const de = document.getElementById('f-costD'); if (de) de.onchange = save;
    }
  }
  function injectPhotoBtn() {
    if (document.querySelector('#reg-photo-btn')) return;
    if (!document.querySelector('#f-date')) return;
    if (isViewer()) return;
    const btns = document.querySelectorAll('#main .btns');
    if (!btns.length) return;
    const target = btns[btns.length - 1];
    const wrap = document.createElement('div');
    wrap.style.display = 'contents';
    wrap.innerHTML = '<button class="btn w" id="reg-photo-btn">📷 रजिस्टर फोटो</button>' +
                     '<input type="file" accept="image/*" capture="environment" id="reg-photo-in" style="display:none">';
    target.appendChild(wrap);
    document.getElementById('reg-photo-btn').onclick = () => document.getElementById('reg-photo-in').click();
    document.getElementById('reg-photo-in').onchange = async function (e) {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      toast('फोटो सेव हो रही है…');
      try {
        const b64 = await compressImg(f, 900, 0.75);
        const date = S.cur && S.cur.date; if (!date) return;
        await db().collection('day_photos').add({
          date, photo: b64, at: APP.FV.serverTimestamp(),
          by: S.salesman ? S.salesman.name : (S.user && S.user.email) || ''
        });
        toast('फोटो सेव ✔');
      } catch (err) { toast('फोटो सेव नहीं हुई: ' + err.message); }
    };
  }
  function compressImg(file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('फोटो नहीं खुली')); };
      img.src = url;
    });
  }

  /* ============ DUPLICATE CHECK ============ */
  let dupTimer = null;
  function checkDuplicates() {
    if (!db() || !S.date || !S.cur || isViewer()) return;
    clearTimeout(dupTimer);
    dupTimer = setTimeout(async () => {
      try {
        const rows = (S.cur && S.cur.rows) || [];
        const seen = {}, dups = [];
        rows.forEach(r => {
          const key = (r.kind || '') + '|' + (r.partyId || '') + '|' + (r.vehicle || '') + '|' + num(r.amount).toFixed(2) + '|' + (r.time || '');
          if (seen[key]) dups.push(r); else seen[key] = r;
        });
        const main = document.querySelector('#main');
        if (!main) return;
        const old = document.querySelector('#dup-banner');
        if (!dups.length) { if (old) old.remove(); return; }
        const html = '⚠️ ' + dups.length + ' संभावित डुप्लीकेट: ' +
          dups.slice(0, 3).map(r => esc(r.partyName) + ' ' + money(r.amount)).join(' · ');
        if (old) { old.innerHTML = html; return; }
        const b = document.createElement('div');
        b.id = 'dup-banner'; b.className = 'warn'; b.innerHTML = html;
        main.insertBefore(b, main.firstChild);
      } catch (e) {}
    }, 1500);
  }

  /* ============ NOZZLE TREND ============ */
  APP.views.nozzle = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">लोड हो रहा है…</p>';
    let snap;
    try { snap = await db().collection('days').orderBy('date', 'desc').limit(30).get(); }
    catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    const days = snap.docs.map(x => x.data()).reverse();
    const nzKeys = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
    const sums = {}; nzKeys.forEach(k => sums[k] = 0);
    const perDay = days.map(d => {
      const out = { date: d.date };
      nzKeys.forEach(k => {
        const nz = d.nz && d.nz[k]; let net = 0;
        if (nz && nz.o !== undefined && nz.c !== undefined && K.has(nz.o) && K.has(nz.c)) {
          const g = num(nz.c) - num(nz.o);
          net = Math.max(0, g - (K.has(d.testing) ? num(d.testing) : 5));
        }
        out[k] = net; sums[k] += net;
      });
      return out;
    });
    const grandTotal = nzKeys.reduce((a, k) => a + sums[k], 0) || 1;
    main.innerHTML =
      '<div class="card"><h3>⛽ नोज़ल-वार बिक्री (30 दिन)</h3>' +
        nzKeys.map(k =>
          '<div class="kv"><span>' + k.toUpperCase() + '</span><b>' + APP.lit(sums[k]) + ' <small class="mut">(' +
          ((sums[k] / grandTotal) * 100).toFixed(1) + '%)</small></b></div>'
        ).join('') +
      '</div>' +
      '<div class="card"><h3>रोज़ का ट्रेंड</h3>' +
        '<div style="overflow-x:auto"><table style="font-size:11px"><tr><th>तारीख</th>' +
        nzKeys.map(k => '<th class="n">' + k.toUpperCase() + '</th>').join('') + '</tr>' +
        perDay.slice(-10).map(r => '<tr><td>' + dmy(r.date) + '</td>' +
          nzKeys.map(k => '<td class="n">' + (r[k] > 0 ? r[k].toFixed(0) : '-') + '</td>').join('') +
        '</tr>').join('') + '</table></div></div>' +
      '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
  };

  /* ============ MORE VIEW EXTENSION ============ */
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (isViewer()) return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#extra-more-card')) return;
    const extra = document.createElement('div');
    extra.id = 'extra-more-card';
    extra.innerHTML =
      '<div class="card"><h3>🔧 और सुविधाएँ</h3><div class="btns">' +
        '<button class="btn w" data-nav="dashboard">📊 डैशबोर्ड</button>' +
        '<button class="btn w" data-nav="monthreport">📅 मासिक रिपोर्ट</button>' +
        '<button class="btn w" data-nav="reminders">⏰ उधार रिमाइंडर</button>' +
        '<button class="btn w" data-nav="customers">👥 ग्राहक कार्ड</button>' +
        '<button class="btn w" data-nav="bank">🏦 बैंक जमा</button>' +
        '<button class="btn w" data-nav="workers">👷 वर्कर हाज़िरी</button>' +
        '<button class="btn w" data-nav="nozzle">⛽ नोज़ल ट्रेंड</button>' +
        (APP.isOwner && APP.isOwner() ? '<button class="btn w" data-nav="audit">🔍 ऑडिट लॉग</button>' : '') +
      '</div></div>' +
      '<div class="card"><h3>💾 पूरा बैकअप</h3>' +
        '<p class="mut" style="font-size:12px;margin:4px 0">सारा डेटा एक फ़ाइल में।</p>' +
        '<div class="btns"><button class="btn g" id="bk-json">JSON</button><button class="btn w" id="bk-csv">CSV (Excel)</button></div></div>';
    main.appendChild(extra);
    extra.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => APP.go(b.dataset.nav));
    const jb = $('#bk-json'); if (jb) jb.onclick = () => APP.downloadBackup('json');
    const cb = $('#bk-csv'); if (cb) cb.onclick = () => APP.downloadBackup('csv');
  };

  /* ============ BOOT ============ */
  function startObs() {
    const main = document.querySelector('#main');
    if (!main) { setTimeout(startObs, 800); return; }
    new MutationObserver(() => { setTimeout(injectDayExtras, 80); })
      .observe(main, { childList: true, subtree: true });
    setTimeout(injectDayExtras, 300);
  }
  window.addEventListener('load', () => {
    setTimeout(() => { restoreDraftsSmart(); startObs(); }, 800);
  });
  console.log('[Mazda features.js] loaded ✓');
})();
