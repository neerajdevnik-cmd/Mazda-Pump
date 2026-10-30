/* Mazda Oil Company - Features Utils (Professional Statement Generator) */
(function () {
  'use strict';
  const APP = window.APP || {};
  if (!APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  /* ============ PROFESSIONAL PARTY STATEMENT ============ */
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

    const inr = n => Number(num(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const litF = n => Number(num(n)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sgn = n => (Math.abs(n) < 0.005 ? 0 : (n > 0 ? 1 : -1));
    const balTxt = n => (sgn(n) === 0 ? '₹0.00' : (n > 0 ? '−₹' : '+₹') + inr(Math.abs(n)));
    const balCls = n => (sgn(n) > 0 ? 'v-r' : sgn(n) < 0 ? 'v-g' : '');
    const drcr = n => `<span class="${balCls(n)}">${balTxt(n)}</span>`;
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

    const genHTML = (from, to, mode) => {
      const IMG = mode === 'img';
      const st = K.stmt(allRows, from, to);
      const cnt = st.rows.length;
      const no = stNo(to), gen = nowStr();

      const CAP1 = IMG ? 11 : 13, CAPN = IMG ? 19 : 21, TOT_NEED = 6;
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
          <div class="sb"><div class="s1">Opening Balance</div><div class="s2">पिछला बैलेंस</div><div class="sv ${balCls(st.open)}">${balTxt(st.open)}</div></div>
          <div class="sb"><div class="s1">Total Debit</div><div class="s2">कुल उधार</div><div class="sv red">₹${inr(st.totU)}</div></div>
          <div class="sb"><div class="s1">Total Credit</div><div class="s2">कुल जमा</div><div class="sv grn">₹${inr(st.totJ)}</div></div>
          <div class="sb cl ${sgn(st.close) > 0 ? 'cl-r' : sgn(st.close) < 0 ? 'cl-g' : ''}"><div class="s1">Closing Balance</div><div class="s2">${sgn(st.close) < 0 ? 'अंतिम एडवांस' : 'अंतिम बकाया'}</div><div class="sv big ${balCls(st.close)}">${balTxt(st.close)}</div></div>
        </div>
        <div class="info">
          <span>एंट्री: <b>${cnt}</b></span>
          ${st.totLit > 0 ? `<span>कुल तेल: <b>${litF(st.totLit)} L</b> (पेट्रोल ${litF(st.litP)} · डीज़ल ${litF(st.litD)})</span>` : ''}
          ${st.lastJama ? `<span>आखिरी जमा: <b>${dmy(st.lastJama.date)} · ₹${inr(st.lastJama.amount)}</b></span>` : ''}
          ${st.lastUdhar ? `<span>आखिरी उधार: <b>${dmy(st.lastUdhar.date)}</b></span>` : ''}
        </div>
        <div class="sec"><span>📒 लेन-देन का पूरा विवरण (Transaction Details)</span><span class="lgd"><b class="v-r">− लाल</b> = बकाया &nbsp;·&nbsp; <b class="v-g">+ हरा</b> = एडवांस</span></div>`;

      const contHead = pg => `
        <div class="hd mini">
          <div class="hd-l"><img src="./logo.png" class="lg sm" alt=""><div><div class="co s">${esc(C.pump.nameEn)}</div><div class="ad">${esc(p.name)} · ${dmy(from)} से ${dmy(to)}</div></div></div>
          <div class="hd-r"><div class="ti s">ACCOUNT STATEMENT</div><div class="mt">${no}</div></div>
        </div>`;

      const totals = `
        <div class="tot">
          <div class="tr"><span>कुल उधार / Total Debit</span><b class="red">₹${inr(st.totU)}</b></div>
          <div class="tr"><span>कुल जमा / Total Credit</span><b class="grn">₹${inr(st.totJ)}</b></div>
          <div class="tr fin ${sgn(st.close) > 0 ? 'cl-r' : sgn(st.close) < 0 ? 'cl-g' : ''}"><span>${sgn(st.close) < 0 ? 'अंतिम एडवांस / Closing Advance' : 'अंतिम बकाया / Closing Balance'}</span><b>${balTxt(st.close)}</b></div>
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
      const css = IMG ? STMT_CSS.replace(/794px/g, '810px').replace(/1123px/g, '1080px').replace('.stm-wrap .tb td{height:43px', '.stm-wrap .tb td{height:41px') : STMT_CSS;
      return { html: `<style>${css}</style><div class="stm-wrap">${pages.join('')}</div>`, n: N };
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
      .stm-wrap .sb.cl{background:#f6f8fc;border-color:#d8dfee}
      .stm-wrap .sb.cl.cl-r{background:#fdf1f1;border-color:#f0c9c9}
      .stm-wrap .sb.cl.cl-g{background:#effaf1;border-color:#bfe3c8}
      .stm-wrap .v-r{color:#b3261e}.stm-wrap .v-g{color:#1e7d34}
      .stm-wrap .s1{font-size:11.5px;color:#4a5468}.stm-wrap .s2{font-size:10.5px;color:#7b8498;margin-bottom:5px}
      .stm-wrap .sv{font-size:17px;font-weight:700;color:#1b2333;font-variant-numeric:tabular-nums;white-space:nowrap}
      .stm-wrap .sv.red,.stm-wrap .sv.v-r{color:#b3261e}.stm-wrap .sv.grn,.stm-wrap .sv.v-g{color:#1e7d34}.stm-wrap .sv.big{font-size:18.5px}
      .stm-wrap .info{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:11.5px;color:#3b4457;margin:2px 0 10px}
      .stm-wrap .info b{color:#1b2333}
      .stm-wrap .sec{font-size:14.5px;font-weight:700;color:#1f3a8a;margin:4px 0 7px;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
      .stm-wrap .lgd{font-size:10.5px;font-weight:500;color:#6b7385;white-space:nowrap}.stm-wrap .lgd b{font-weight:700}
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
      .stm-wrap .tot .fin{background:#f3f6fc;color:#1b2333;font-size:14.5px;font-weight:700;border:0;border-top:2px solid #1f3a8a}
      .stm-wrap .tot .fin.cl-r{background:#fdf1f1}.stm-wrap .tot .fin.cl-r b{color:#b3261e}
      .stm-wrap .tot .fin.cl-g{background:#effaf1}.stm-wrap .tot .fin.cl-g b{color:#1e7d34}
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
      if (typeof html2canvas !== 'function') return toast('html2canvas लोड नहीं हुआ — नेट चेक करें');
      m.close();
      toast('स्टेटमेंट की फोटो बन रही है…');
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:-9999px;top:0;';
      wrap.innerHTML = genHTML(from, to, 'img').html;
      document.body.appendChild(wrap);
      try {
        try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (x) {}
        const pages = Array.from(wrap.querySelectorAll('.stm-page'));
        const files = [];
        const safe = String(p.name || 'party').replace(/[^\wऀ-ॿ]+/g, '_');
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
          const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
          files.push(new File([blob], `Statement_${safe}_${from}_${to}_${i + 1}of${pages.length}.png`, { type: 'image/png' }));
        }
        previewStatement(files, `*${C.pump.name}*\nAccount Statement — ${p.name}\n${dmy(from)} से ${dmy(to)}`, p.name);
      } catch (e) { toast('फोटो नहीं बनी: ' + ((e && e.message) || e)); }
      finally { wrap.remove(); }
    };
  };

  function previewStatement(files, text, partyName) {
    const urls = files.map(f => URL.createObjectURL(f));
    const n = files.length;
    const m = modal(
      '<h3>📄 स्टेटमेंट की फोटो (' + n + ' पेज)</h3>' +
      '<div class="mut" style="font-size:12px;margin-bottom:8px">' + esc(partyName || '') + ' — पहले देख लें, ठीक लगे तो भेजें या सेव करें।</div>' +
      '<div style="max-height:60vh;overflow:auto;border:1px solid #e3e8f2;border-radius:10px;background:#eef2fa;padding:8px">' +
        urls.map((u, i) => '<div style="font-size:11px;color:#6b7385;margin:0 0 3px">पेज ' + (i + 1) + ' / ' + n + '</div>' +
          '<img src="' + u + '" style="width:100%;display:block;border-radius:6px;box-shadow:0 2px 8px rgba(10,42,102,.15);margin-bottom:10px;background:#fff">').join('') +
      '</div>' +
      '<div class="btns" style="margin-top:10px">' +
        '<button class="btn g" id="sp-sh">📤 भेजें (WhatsApp आदि)</button>' +
        '<button class="btn w" id="sp-dl">💾 फोन में सेव</button>' +
        '<button class="btn w" id="sp-x">बंद</button>' +
      '</div>');
    const save = () => files.forEach((f, i) => setTimeout(() => {
      const a = document.createElement('a'); a.href = urls[i]; a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
    }, i * 350));
    m.querySelector('#sp-x').onclick = () => { m.close(); setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 500); };
    m.querySelector('#sp-dl').onclick = () => { save(); toast('सेव हो रहा है ✔'); };
    m.querySelector('#sp-sh').onclick = async () => {
      try {
        if (navigator.canShare && navigator.canShare({ files })) await navigator.share({ files, text });
        else { save(); toast('इस फोन में सीधा शेयर नहीं — फोटो सेव हो गई, WhatsApp में लगा दें'); }
      } catch (e) { if (!e || e.name !== 'AbortError') toast('शेयर नहीं हो पाया — "💾 फोन में सेव" दबाएँ'); }
    };
  }

  console.log('[Mazda features_utils.js] loaded ✓');
})();
