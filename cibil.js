/* Mazda Oil Company - Party CIBIL + Credit Limit + Wasooli Ladder + Recovery Dashboard */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  APP.views = APP.views || {};
  APP.cibil = {};

  /* ============ Score Calculation ============ */
  function calcScore(party, entries, priv) {
    if (!entries.length) return { score: null, grade: null, factors: null, payment: null };

    const todayMs = new Date(today() + 'T12:00:00').getTime();
    const us = entries.filter(r => r.kind === 'udhar').sort((a, b) => a.date.localeCompare(b.date));
    const js = entries.filter(r => r.kind === 'jama').sort((a, b) => a.date.localeCompare(b.date));
    if (!us.length) return { score: null, grade: null, factors: null, payment: null };

    const payGaps = [];
    const payDays = {};
    let lj = 0;
    us.forEach(u => {
      let paidAmt = 0;
      const uAmt = num(u.amount);
      while (lj < js.length && paidAmt < uAmt) {
        const j = js[lj];
        if (j.date >= u.date) {
          paidAmt += num(j.amount);
          const d = Math.round((new Date(j.date + 'T12:00:00') - new Date(u.date + 'T12:00:00')) / 86400000);
          if (d >= 0 && d < 365) {
            payGaps.push(d);
            const wd = new Date(j.date + 'T12:00:00').getDay();
            payDays[wd] = (payDays[wd] || 0) + 1;
          }
        }
        lj++;
      }
    });

    const avgPayDays = payGaps.length ? payGaps.reduce((a, b) => a + b, 0) / payGaps.length : null;

    const balByDate = {};
    let run = 0;
    entries.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
      run += r.kind === 'udhar' ? num(r.amount) : -num(r.amount);
      balByDate[r.date] = run;
    });
    const firstUdhar = us[0].date;
    const allDates = Object.keys(balByDate).sort();
    let lateDays = 0;
    const checkDays = [15, 25, 35, 50, 70];
    checkDays.forEach(days => {
      const checkDate = (() => {
        const d = new Date(today() + 'T12:00:00'); d.setDate(d.getDate() - days);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      })();
      if (checkDate >= firstUdhar) {
        let balAt = 0;
        allDates.forEach(d => { if (d <= checkDate) balAt = balByDate[d]; });
        if (balAt > 0) lateDays++;
      }
    });

    const fullPays = js.filter(j => {
      const prevBal = (() => {
        let b = 0;
        entries.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(r => {
          if (r.date < j.date) b += r.kind === 'udhar' ? num(r.amount) : -num(r.amount);
        });
        return b;
      })();
      return prevBal > 0 && num(j.amount) >= prevBal * 0.95;
    }).length;
    const consistency = js.length ? fullPays / js.length : 0;

    const now = new Date(today() + 'T12:00:00').getTime();
    const recent = us.filter(u => now - new Date(u.date + 'T12:00:00').getTime() < 90 * 86400000).reduce((a, u) => a + num(u.amount), 0);
    const older = us.filter(u => {
      const t = new Date(u.date + 'T12:00:00').getTime();
      return (now - t >= 90 * 86400000) && (now - t < 180 * 86400000);
    }).reduce((a, u) => a + num(u.amount), 0);
    const volTrend = older > 0 ? (recent / older - 1) : (recent > 0 ? 0.5 : 0);

    const ageMonths = Math.round((now - new Date(firstUdhar + 'T12:00:00').getTime()) / (30 * 86400000));

    const monthlyVol = us.reduce((a, u) => a + num(u.amount), 0) / Math.max(1, ageMonths);
    const balance = num(party.bal);
    const balRatio = monthlyVol > 0 ? balance / monthlyVol : (balance > 0 ? 1 : 0);

    const w = priv ? { pay: 25, late: 15, con: 15, vol: 15, age: 20, bal: 10 } : { pay: 30, late: 20, con: 15, vol: 15, age: 10, bal: 10 };

    let payScore = 0;
    if (avgPayDays !== null) {
      if (avgPayDays <= 7) payScore = 100;
      else if (avgPayDays <= 15) payScore = 85;
      else if (avgPayDays <= 25) payScore = 70;
      else if (avgPayDays <= 40) payScore = 50;
      else if (avgPayDays <= 60) payScore = 30;
      else payScore = 10;
    }
    const lateScore = Math.max(0, 100 - lateDays * 20);
    const conScore = consistency * 100;
    const volScore = volTrend >= 0.3 ? 100 : volTrend >= 0 ? 70 : volTrend >= -0.3 ? 50 : 30;
    const ageScore = ageMonths >= 12 ? 100 : ageMonths >= 6 ? 80 : ageMonths >= 3 ? 60 : ageMonths >= 1 ? 40 : 20;
    const balScore = balRatio < 0.5 ? 100 : balRatio < 1 ? 80 : balRatio < 1.5 ? 60 : balRatio < 2 ? 40 : 20;

    const total = Math.round((payScore * w.pay + lateScore * w.late + conScore * w.con + volScore * w.vol + ageScore * w.age + balScore * w.bal) / 100);
    const score = Math.max(300, Math.min(900, Math.round(300 + total * 6)));
    const grade = score >= 800 ? 'A+' : score >= 700 ? 'A' : score >= 550 ? 'B' : 'C';

    const weekdayNames = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
    let favDay = null;
    let favDayCount = 0;
    Object.keys(payDays).forEach(wd => {
      if (payDays[wd] > favDayCount) { favDayCount = payDays[wd]; favDay = weekdayNames[+wd]; }
    });
    const totalPayCount = Object.values(payDays).reduce((a, b) => a + b, 0);

    let nextPayPred = null;
    if (avgPayDays !== null && balance > 0) {
      const lastUdhar = us[us.length - 1];
      const baseDate = lastUdhar.date;
      const predDate = new Date(baseDate + 'T12:00:00');
      predDate.setDate(predDate.getDate() + Math.round(avgPayDays));
      nextPayPred = predDate.getFullYear() + '-' + String(predDate.getMonth() + 1).padStart(2, '0') + '-' + String(predDate.getDate()).padStart(2, '0');
    }

    return {
      score, grade,
      factors: { payScore, lateScore, conScore, volScore, ageScore, balScore },
      payment: { avgPayDays, lateDays, consistency, ageMonths, balance, monthlyVol, favDay, favDayCount, totalPayCount, nextPayPred, totalUdhar: us.length, totalJama: js.length }
    };
  }

  /* ============ Credit Limit ============ */
  function calcCreditLimit(party, cibil, priv) {
    if (!cibil || !cibil.score) return { limit: 5000, multiplier: 1, reason: 'नया', base: 5000 };
    const base = priv ? 5000 : 5000;
    const mult = cibil.score >= 800 ? 3 : cibil.score >= 700 ? 2 : cibil.score >= 550 ? 1 : 0.5;
    const limit = Math.round(base * mult / 500) * 500;
    const reason = mult === 3 ? 'A+ (3x)' : mult === 2 ? 'A (2x)' : mult === 1 ? 'B (1x)' : 'C (0.5x)';
    return { limit, multiplier: mult, reason, base };
  }

  /* ============ Wasooli Stage ============ */
  function calcWasooli(party, entries) {
    const bal = num(party.bal);
    if (bal <= 0.01) return null;
    const us = entries.filter(r => r.kind === 'udhar').sort((a, b) => a.date.localeCompare(b.date));
    if (!us.length) return null;
    const lastU = us[us.length - 1];
    const daysSince = Math.round((new Date(today() + 'T12:00:00') - new Date(lastU.date + 'T12:00:00')) / 86400000);

    if (daysSince >= 70) return { stage: 'last', label: 'अंतिम चरण', days: daysSince, color: 'wasooli-last' };
    if (daysSince >= 50) return { stage: 'owner', label: 'Owner हस्तक्षेप', days: daysSince, color: 'wasooli-owner' };
    if (daysSince >= 35) return { stage: 'hold', label: 'नया उधार रोका', days: daysSince, color: 'wasooli-hold' };
    if (daysSince >= 25) return { stage: 'firm', label: 'सख्त reminder', days: daysSince, color: 'wasooli-firm' };
    if (daysSince >= 15) return { stage: 'gentle', label: 'सौम्य reminder', days: daysSince, color: 'wasooli-gentle' };
    return { stage: 'ok', label: 'सामान्य', days: daysSince, color: '' };
  }

  /* ============ API ============ */
  APP.cibil.badgeHtml = function (party) {
    if (!party._cibil && S._cibilCache && S._cibilCache[party.id]) party._cibil = S._cibilCache[party.id];
    const c = party._cibil;
    if (!c) { setTimeout(() => APP.cibil.loadAndRefresh(party.id), 100); return '<span class="cibil-badge cibil-none">⏳</span>'; }
    if (!c.score) return '<span class="cibil-badge cibil-none">नया</span>';
    const cls = c.grade === 'A+' ? 'cibil-Aplus' : c.grade === 'A' ? 'cibil-A' : c.grade === 'B' ? 'cibil-B' : 'cibil-C';
    return '<span class="cibil-badge ' + cls + '"><span class="cb-num">' + c.score + '</span><span class="cb-grade">' + c.grade + '</span></span>';
  };

  APP.cibil.loadAndRefresh = async function (partyId) {
    try {
      const parties = S.parties && S.parties.pub;
      if (!parties) return;
      const p = parties.find(x => x.id === partyId);
      if (!p) return;
      const snap = await db().collection('ledger').where('partyId', '==', partyId).get();
      const entries = snap.docs.map(d => d.data());
      const c = calcScore(p, entries, false);
      p._cibil = c;
      S._cibilCache = S._cibilCache || {};
      S._cibilCache[partyId] = c;
      const items = document.querySelectorAll('[data-id="' + partyId + '"] .cibil-badge, [data-vpid="' + partyId + '"] .cibil-badge');
      items.forEach(el => {
        if (!c.score) { el.className = 'cibil-badge cibil-none'; el.textContent = 'नया'; return; }
        const cls = c.grade === 'A+' ? 'cibil-Aplus' : c.grade === 'A' ? 'cibil-A' : c.grade === 'B' ? 'cibil-B' : 'cibil-C';
        el.className = 'cibil-badge ' + cls;
        el.innerHTML = '<span class="cb-num">' + c.score + '</span><span class="cb-grade">' + c.grade + '</span>';
      });
    } catch (e) {}
  };

  APP.cibil.checkLimit = async function (party, newAmount, priv) {
    try {
      const pcol = priv ? 'priv_ledger' : 'ledger';
      const snap = await db().collection(pcol).where('partyId', '==', party.id).get();
      const entries = snap.docs.map(d => d.data());
      const c = calcScore(party, entries, priv);
      const lim = calcCreditLimit(party, c, priv);
      const currentBal = num(party.bal);
      const projected = currentBal + newAmount;
      const wasooli = calcWasooli(party, entries);
      const hardLimit = num(party.limit) > 0 ? num(party.limit) : lim.limit;

      if (c.grade === 'C' && !priv) {
        return { allow: false, blocked: true, reason: '❌ ' + party.name + ' का CIBIL C (' + c.score + ') है। नया उधार बंद है।', cibil: c, limit: hardLimit };
      }
      if (wasooli && wasooli.stage === 'hold' && !priv) {
        return { allow: false, blocked: true, reason: '❌ पुराना उधार ' + wasooli.days + ' दिन से बाकी है — पहले payment करवाएँ।', cibil: c, limit: hardLimit, wasooli };
      }
      if (projected > hardLimit) {
        return { allow: false, blocked: false, reason: '⚠️ Limit पार: ₹' + r2(hardLimit) + ' (current ' + r2(currentBal) + ' + new ' + r2(newAmount) + ' = ' + r2(projected) + '). CIBIL ' + (c.score || '?') + ' → limit ₹' + r2(lim.limit), cibil: c, limit: hardLimit };
      }
      return { allow: true, cibil: c, limit: hardLimit };
    } catch (e) { return { allow: true, error: e.message }; }
  };

  APP.cibil.wasooliChip = function (party, entries) {
    const w = calcWasooli(party, entries);
    if (!w || w.stage === 'ok') return '';
    return '<span class="wasooli-chip ' + w.color + '" title="' + esc(w.label) + '">' + w.days + ' दिन</span>';
  };

  APP.cibil.cardHtml = function (party, entries) {
    const c = calcScore(party, entries, false);
    if (!c.score) return '';
    const p = c.payment;
    const gradeCls = c.grade === 'A+' ? 'cibil-Aplus' : c.grade === 'A' ? 'cibil-A' : c.grade === 'B' ? 'cibil-B' : 'cibil-C';
    const wasooli = calcWasooli(party, entries);
    const lim = calcCreditLimit(party, c, false);
    const hardLimit = num(party.limit) > 0 ? num(party.limit) : lim.limit;

    let pred = '';
    if (p.nextPayPred && num(party.bal) > 0) {
      pred = 'अगला payment ~ <b>' + dmy(p.nextPayPred) + '</b>' + (p.favDay ? ' · mostly <b>' + p.favDay + '</b> को (' + p.favDayCount + '/' + p.totalPayCount + ' बार)' : '');
    }

    return '<div class="cibil-card">' +
      '<div class="cb-head"><div class="cb-title">⭐ CIBIL Score</div><span class="cb-grade-big ' + gradeCls + '">' + c.grade + '</span></div>' +
      '<div class="cb-score-wrap"><span class="cb-score">' + c.score + '</span><span class="cb-total">/ 900</span></div>' +
      '<div class="cb-stats">' +
        '<div class="cb-stat"><div class="cb-stat-l">कुल एंट्री</div><div class="cb-stat-v">' + (p.totalUdhar + p.totalJama) + '</div></div>' +
        '<div class="cb-stat"><div class="cb-stat-l">संबंध</div><div class="cb-stat-v">' + (p.ageMonths || 0) + ' महीने</div></div>' +
        '<div class="cb-stat"><div class="cb-stat-l">औसत payment</div><div class="cb-stat-v">' + (p.avgPayDays !== null ? r2(p.avgPayDays) + ' दिन' : '—') + '</div></div>' +
        '<div class="cb-stat"><div class="cb-stat-l">देरी के दिन</div><div class="cb-stat-v">' + (p.lateDays || 0) + '</div></div>' +
        '<div class="cb-stat"><div class="cb-stat-l">Credit Limit</div><div class="cb-stat-v">₹' + r2(hardLimit) + '</div></div>' +
        '<div class="cb-stat"><div class="cb-stat-l">मासिक औसत</div><div class="cb-stat-v">₹' + r2(p.monthlyVol || 0) + '</div></div>' +
      '</div>' +
      (pred ? '<div class="cb-pred">🔮 ' + pred + '</div>' : '') +
      (wasooli && wasooli.stage !== 'ok' ? '<div style="margin-top:8px"><span class="wasooli-chip ' + wasooli.color + '">' + esc(wasooli.label) + ' · ' + wasooli.days + ' दिन</span></div>' : '') +
    '</div>';
  };

  /* ============ Full CIBIL View ============ */
  APP.views.cibil = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">CIBIL लोड हो रहा है…</p>';
    let parties, ledgerSnap;
    try {
      [parties, ledgerSnap] = await Promise.all([APP.getParties(false, true), db().collection('ledger').get()]);
    } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }

    const all = ledgerSnap.docs.map(d => d.data());
    const byParty = {};
    all.forEach(r => { if (!byParty[r.partyId]) byParty[r.partyId] = []; byParty[r.partyId].push(r); });

    const scored = parties.map(p => ({ p, c: calcScore(p, byParty[p.id] || [], false) })).filter(x => x.c.score).sort((a, b) => a.c.score - b.c.score);

    let html = '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">⭐ पार्टी CIBIL</h3><div style="font-size:12px;opacity:.85;margin-top:4px">' + scored.length + ' पार्टियों का हिसाब · सबसे कम score पहले</div></div>';

    const counts = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0 };
    scored.forEach(x => counts[x.c.grade]++);
    html += '<div class="recov-summary">' +
      '<div class="rs-item gentle"><div class="lbl">A+ (800+)</div><div class="val">' + counts['A+'] + '</div></div>' +
      '<div class="rs-item firm"><div class="lbl">A (700-799)</div><div class="val">' + counts['A'] + '</div></div>' +
      '<div class="rs-item hold"><div class="lbl">B (550-699)</div><div class="val">' + counts['B'] + '</div></div>' +
      '<div class="rs-item owner"><div class="lbl">C (<550)</div><div class="val">' + counts['C'] + '</div></div>' +
      '</div>';

    if (!scored.length) {
      html += '<div class="card"><p class="mut">कोई पार्टी का पर्याप्त डेटा नहीं है।</p></div>';
    } else {
      html += '<div class="card">' + scored.map(({ p, c }) => {
        const cls = c.grade === 'A+' ? 'cibil-Aplus' : c.grade === 'A' ? 'cibil-A' : c.grade === 'B' ? 'cibil-B' : 'cibil-C';
        const bal = num(p.bal);
        return '<div class="item" style="cursor:pointer" data-cbil-pid="' + p.id + '">' +
          '<div class="a"><b>' + esc(p.name) + '</b> <span class="cibil-badge ' + cls + '"><span class="cb-num">' + c.score + '</span><span class="cb-grade">' + c.grade + '</span></span>' +
          '<small>' + (c.payment.avgPayDays !== null ? 'औसत ' + r2(c.payment.avgPayDays) + ' दिन · ' : '') + 'देरी: ' + c.payment.lateDays + '</small></div>' +
          '<span class="chip ' + (bal > 0 ? 'r' : 'g') + '">' + money(bal) + '</span></div>';
      }).join('') + '</div>';
    }

    html += '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    main.innerHTML = html;
    $$('[data-cbil-pid]').forEach(el => el.onclick = () => APP.partyView(el.dataset.cbilPid, false));
  };

  /* ============ Recovery Dashboard ============ */
  APP.views.recovery = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">Recovery लोड हो रहा है…</p>';
    let parties, ledgerSnap;
    try {
      [parties, ledgerSnap] = await Promise.all([APP.getParties(false, true), db().collection('ledger').get()]);
    } catch (e) { main.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }

    const all = ledgerSnap.docs.map(d => d.data());
    const byParty = {};
    all.forEach(r => { if (!byParty[r.partyId]) byParty[r.partyId] = []; byParty[r.partyId].push(r); });

    const stages = { gentle: [], firm: [], hold: [], owner: [], last: [] };
    parties.forEach(p => {
      const w = calcWasooli(p, byParty[p.id] || []);
      if (w && w.stage !== 'ok' && stages[w.stage]) stages[w.stage].push({ p, w });
    });

    const stageNames = { gentle: 'सौम्य (15-25 दिन)', firm: 'सख्त (25-35 दिन)', hold: 'Hold (35-50 दिन)', owner: 'Owner (50-70 दिन)', last: 'अंतिम (70+)' };
    const stageColors = { gentle: 'gentle', firm: 'firm', hold: 'hold', owner: 'owner', last: 'last' };
    const stageIcons = { gentle: '🟢', firm: '🟡', hold: '🟠', owner: '🔴', last: '⚫' };

    let html = '<div class="card" style="background:#c62828;color:#fff"><h3 style="color:#fff;margin:0">🚨 वसूली डैशबोर्ड</h3><div style="font-size:12px;opacity:.9;margin-top:4px">किस पार्टी से कब-कब पैसा माँगना है</div></div>';

    const totalAmt = Object.values(stages).reduce((a, arr) => a + arr.reduce((x, y) => x + num(y.p.bal), 0), 0);
    html += '<div class="card"><div class="kv"><span>कुल बकाया</span><b class="neg" style="font-size:18px">' + money(totalAmt) + '</b></div></div>';

    const counts = { gentle: stages.gentle.length, firm: stages.firm.length, hold: stages.hold.length, owner: stages.owner.length, last: stages.last.length };
    html += '<div class="recov-summary">' + Object.keys(stageNames).map(k => '<div class="rs-item ' + stageColors[k] + '"><div class="lbl">' + stageIcons[k] + ' ' + stageNames[k].split(' ')[0] + '</div><div class="val">' + counts[k] + '</div></div>').join('') + '</div>';

    Object.keys(stageNames).forEach(stage => {
      const arr = stages[stage];
      if (!arr.length) return;
      html += '<div class="card"><h3 style="font-size:15px">' + stageIcons[stage] + ' ' + stageNames[stage] + ' (' + arr.length + ')</h3>';
      arr.sort((a, b) => b.w.days - a.w.days).forEach(({ p, w }) => {
        const ph = (p.phone || '').replace(/\D/g, '');
        const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
        const msg = 'नमस्ते ' + p.name + ' जी 🙏\n\nआपका माज़दा ऑयल कंपनी पर बकाया: *₹' + r2(num(p.bal)) + '*\nपिछले ' + w.days + ' दिन से payment बाकी है।\n\nसुविधा अनुसार भुगतान कर दें — धन्यवाद!';
        html += '<div class="item"><div class="a"><b>' + esc(p.name) + '</b><small>' + w.days + ' दिन · ₹' + r2(num(p.bal)) + '</small></div>' +
          '<div style="text-align:right">' +
          (ph ? '<a href="tel:' + esc(p.phone) + '" class="btn sm w" style="font-size:11px;padding:4px 8px">📞</a> ' : '') +
          (wa ? '<a href="https://wa.me/' + wa + '?text=' + encodeURIComponent(msg) + '" target="_blank" class="btn sm g" style="font-size:11px;padding:4px 8px">💬 भेजें</a>' : '') +
          '</div></div>';
      });
      html += '</div>';
    });

    if (Object.values(counts).every(c => c === 0)) html += '<div class="card"><p class="mut" style="text-align:center;padding:20px">कोई बकाया नहीं 🎉</p></div>';
    html += '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    main.innerHTML = html;
  };

  console.log('[Mazda cibil.js] loaded ✓');
})();
