/* Mazda Oil Company - Data Analysis (not prediction), Rate History, Weekday Pattern, Retention */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;
  const C = APP.C, K = APP.K, S = APP.S, $ = APP.$, $$ = APP.$$, esc = APP.esc, num = APP.num, r2 = APP.r2;
  const money = APP.money, lit = APP.lit, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;
  const db = () => APP.db;
  const today = () => APP.todayISO();

  APP.views = APP.views || {};

  /* ============ Helpers ============ */
  const weekdayHindi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const weekdayShort = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

  function getWeekday(iso) { return new Date(iso + 'T12:00:00').getDay(); }

  function shiftDate(iso, n) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function isSunday(iso) { return getWeekday(iso) === 0; }

  async function getHolidays() {
    try {
      const snap = await db().collection('depot_holidays').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
  }

  function isHoliday(iso, holidays) {
    return holidays.some(h => h.date === iso);
  }

  /* ============ Data Fetching ============ */
  async function getDays(daysBack) {
    const from = shiftDate(today(), -daysBack);
    try {
      const snap = await db().collection('days').where('date', '>=', from).get();
      return snap.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) { return []; }
  }

  async function getLedger(daysBack) {
    const from = shiftDate(today(), -daysBack);
    try {
      const snap = await db().collection('ledger').where('date', '>=', from).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
  }

  async function getRateHistory(daysBack) {
    const from = shiftDate(today(), -daysBack);
    try {
      const snap = await db().collection('rate_history').where('date', '>=', from).get();
      return snap.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) { return []; }
  }

  /* ============ Analysis Functions ============ */

  function analyzeWeekdays(days) {
    const byWeekday = {};
    days.forEach(d => {
      if (!d.sum) return;
      const wd = getWeekday(d.date);
      if (!byWeekday[wd]) byWeekday[wd] = [];
      byWeekday[wd].push({
        date: d.date,
        litP: num(d.sum.litP),
        litD: num(d.sum.litD),
        sale: num(d.sum.sale)
      });
    });

    const validDays = days.filter(d => d.sum);
    const overall = validDays.length > 0
      ? validDays.reduce((a, d) => a + num(d.sum.sale), 0) / validDays.length
      : 0;

    const stats = {};
    for (let i = 0; i < 7; i++) {
      const arr = byWeekday[i] || [];
      if (!arr.length) { stats[i] = null; continue; }
      const avgSale = arr.reduce((a, x) => a + x.sale, 0) / arr.length;
      const avgLitP = arr.reduce((a, x) => a + x.litP, 0) / arr.length;
      const avgLitD = arr.reduce((a, x) => a + x.litD, 0) / arr.length;

      let trend = '↔';
      if (arr.length >= 4) {
        const mid = Math.floor(arr.length / 2);
        const firstAvg = arr.slice(0, mid).reduce((a, x) => a + x.sale, 0) / mid;
        const secondAvg = arr.slice(mid).reduce((a, x) => a + x.sale, 0) / (arr.length - mid);
        if (secondAvg > firstAvg * 1.05) trend = '↑';
        else if (secondAvg < firstAvg * 0.95) trend = '↓';
      }

      stats[i] = {
        samples: arr.length,
        avgSale, avgLitP, avgLitD,
        pctVsOverall: overall > 0 ? (avgSale / overall - 1) * 100 : 0,
        trend
      };
    }

    // Best/worst
    let best = null, worst = null;
    Object.keys(stats).forEach(k => {
      const s = stats[k];
      if (!s) return;
      if (!best || s.avgSale > best.avgSale) best = { wd: +k, ...s };
      if (!worst || s.avgSale < worst.avgSale) worst = { wd: +k, ...s };
    });

    return { stats, overall, daysCount: validDays.length, best, worst };
  }

  function analyzePartyForWeekday(ledger, weekday) {
    const matches = ledger.filter(r => r.kind === 'udhar' && getWeekday(r.date) === weekday);
    const all = ledger.filter(r => r.kind === 'udhar');

    const byParty = {};
    matches.forEach(r => {
      if (!byParty[r.partyId]) byParty[r.partyId] = { name: r.partyName, visits: 0, amount: 0 };
      byParty[r.partyId].visits++;
      byParty[r.partyId].amount += num(r.amount);
    });
    const allByParty = {};
    all.forEach(r => {
      if (!allByParty[r.partyId]) allByParty[r.partyId] = { name: r.partyName, visits: 0, amount: 0 };
      allByParty[r.partyId].visits++;
      allByParty[r.partyId].amount += num(r.amount);
    });

    const missing = [];
    Object.keys(allByParty).forEach(pid => {
      const totalVisits = allByParty[pid].visits;
      if (totalVisits < 3) return;
      const thisDayVisits = byParty[pid] ? byParty[pid].visits : 0;
      const expectedRatio = 1 / 7;
      const actualRatio = thisDayVisits / totalVisits;
      if (actualRatio < expectedRatio * 0.4) {
        missing.push({
          name: allByParty[pid].name,
          totalVisits, thisDayVisits,
          avgAmount: allByParty[pid].amount / totalVisits
        });
      }
    });
    missing.sort((a, b) => b.totalVisits - a.totalVisits);

    return {
      topParties: Object.values(byParty).sort((a, b) => b.amount - a.amount).slice(0, 3),
      missing: missing.slice(0, 5)
    };
  }

  function predictStock(days, currentDay, holidays) {
    const recent = days.filter(d => d.sum && d.sum.litP != null).slice(-7);
    if (!recent.length || !currentDay) return null;

    const avgP = recent.reduce((a, d) => a + num(d.sum.litP), 0) / recent.length;
    const avgD = recent.reduce((a, d) => a + num(d.sum.litD), 0) / recent.length;

    const s = currentDay.sum || {};
    const stockP = s.actStockP != null ? num(s.actStockP) : num(s.expStockP);
    const stockD = s.actStockD != null ? num(s.actStockD) : num(s.expStockD);

    const daysP = avgP > 0 ? stockP / avgP : 999;
    const daysD = avgD > 0 ? stockD / avgD : 999;

    const todayDate = currentDay.date || today();
    const depleteP = shiftDate(todayDate, Math.max(0, Math.floor(daysP)));
    const depleteD = shiftDate(todayDate, Math.max(0, Math.floor(daysD)));
    const orderByP = shiftDate(depleteP, -2);
    const orderByD = shiftDate(depleteD, -2);

    function adjustForHoliday(iso) {
      let d = iso;
      for (let i = 0; i < 7; i++) {
        if (!isSunday(d) && !isHoliday(d, holidays)) return { date: d, shifted: i > 0 };
        d = shiftDate(d, -1);
      }
      return { date: iso, shifted: false };
    }

    const adjP = adjustForHoliday(orderByP);
    const adjD = adjustForHoliday(orderByD);

    return {
      petrol: { avg: avgP, stock: stockP, daysLeft: daysP, depleteDate: depleteP, orderBy: adjP.date, orderShifted: adjP.shifted },
      diesel: { avg: avgD, stock: stockD, daysLeft: daysD, depleteDate: depleteD, orderBy: adjD.date, orderShifted: adjD.shifted },
      recentDaysCount: recent.length
    };
  }

  function analyzeRetention(parties, ledger) {
    const todayDate = today();
    const lastVisit = {};
    const intervals = {};
    const byParty = {};

    ledger.forEach(r => {
      if (r.kind !== 'udhar' || !r.partyId) return;
      if (!byParty[r.partyId]) byParty[r.partyId] = [];
      byParty[r.partyId].push(r);
    });

    Object.keys(byParty).forEach(pid => {
      const entries = byParty[pid].sort((a, b) => a.date.localeCompare(b.date));
      if (entries.length) {
        lastVisit[pid] = entries[entries.length - 1].date;
        const gaps = [];
        for (let i = 1; i < entries.length; i++) {
          const gap = Math.round((new Date(entries[i].date + 'T12:00:00') - new Date(entries[i-1].date + 'T12:00:00')) / 86400000);
          if (gap > 0) gaps.push(gap);
        }
        intervals[pid] = gaps;
      }
    });

    const out = [];
    parties.forEach(p => {
      if (!lastVisit[p.id]) return;
      const last = lastVisit[p.id];
      const daysSince = Math.round((new Date(todayDate + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000);
      const gaps = intervals[p.id] || [];
      const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

      let status = 'ok';
      if (avgGap && daysSince > avgGap * 2) status = 'long';
      else if (avgGap && daysSince > avgGap * 1.5) status = 'mild';
      else if (daysSince > 30) status = 'long';

      if (status !== 'ok') {
        out.push({
          id: p.id, name: p.name, phone: p.phone,
          bal: num(p.bal),
          lastVisit: last, daysSince,
          avgGap: avgGap ? r2(avgGap) : null,
          status,
          totalVisits: (byParty[p.id] || []).length
        });
      }
    });

    return out.sort((a, b) => b.daysSince - a.daysSince);
  }

  function analyzeMonth(days) {
    const now = new Date();
    const thisYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const lastYM = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();
    const dayOfMonth = now.getDate();

    const thisMonth = days.filter(d => d.date.startsWith(thisYM) && parseInt(d.date.slice(8)) <= dayOfMonth);
    const lastMonth = days.filter(d => d.date.startsWith(lastYM) && parseInt(d.date.slice(8)) <= dayOfMonth);

    const sum = arr => arr.reduce((acc, d) => {
      const s = d.sum || {};
      acc.sale += num(s.sale);
      acc.litP += num(s.litP);
      acc.litD += num(s.litD);
      return acc;
    }, { sale: 0, litP: 0, litD: 0 });

    const s1 = sum(thisMonth);
    const s2 = sum(lastMonth);
    const diff = s1.sale - s2.sale;
    const pct = s2.sale > 0 ? (diff / s2.sale * 100) : 0;

    return {
      thisMonth: { ...s1, days: thisMonth.length },
      lastMonth: { ...s2, days: lastMonth.length },
      diff, pct
    };
  }

  function analyzeNozzles(days) {
    const totals = {};
    const daily = {};

    days.forEach(d => {
      if (!d.nz) return;
      K.NZ.forEach(k => {
        const n = d.nz[k];
        if (!n || !K.has(n.o) || !K.has(n.c)) return;
        const gross = num(n.c) - num(n.o);
        const testing = K.has(n.t) ? num(n.t) : (K.has(d.testing) ? num(d.testing) : 5);
        const net = Math.max(0, gross - testing);
        totals[k] = (totals[k] || 0) + net;
        if (!daily[k]) daily[k] = [];
        daily[k].push(net);
      });
    });

    const pTotal = ['p1','p2','p3','p4'].reduce((a, k) => a + (totals[k] || 0), 0);
    const dTotal = ['d1','d2','d3','d4'].reduce((a, k) => a + (totals[k] || 0), 0);
    const allTotal = pTotal + dTotal;

    const result = {};
    K.NZ.forEach(k => {
      if (!totals[k]) return;
      const group = k.startsWith('p') ? pTotal : dTotal;
      const share = group > 0 ? (totals[k] / group * 100) : 0;
      const peers = K.NZ.filter(p => p.startsWith(k[0]) && p !== k && totals[p]);
      const peerAvg = peers.length ? peers.reduce((a, p) => a + totals[p], 0) / peers.length : 0;
      const vsPeers = peerAvg > 0 ? (totals[k] / peerAvg - 1) * 100 : 0;

      let status = 'ok';
      if (vsPeers < -30) status = 'low';
      else if (vsPeers < -15) status = 'mild';
      else if (vsPeers > 30) status = 'high';

      result[k] = { total: totals[k], share, peerAvg, vsPeers, status, samples: (daily[k]||[]).length };
    });

    return { byNozzle: result, pTotal, dTotal, allTotal };
  }

  function detectAnomalies(days, todayDay) {
    if (!todayDay || !todayDay.sum) return [];
    const anomalies = [];

    const wd = getWeekday(todayDay.date);
    const sameWeekday = days.filter(d => d.date !== todayDay.date && getWeekday(d.date) === wd && d.sum);
    if (sameWeekday.length >= 2) {
      const avg = sameWeekday.reduce((a, d) => a + num(d.sum.sale), 0) / sameWeekday.length;
      const todaySale = num(todayDay.sum.sale);
      if (avg > 0 && todaySale < avg * 0.7 && todaySale > 0) {
        anomalies.push({
          severity: 'warn',
          text: `आज की बिक्री पिछले ${weekdayShort[wd]} के औसत (${money(avg)}) से ${Math.round((1 - todaySale/avg) * 100)}% कम है`
        });
      }
    }

    const s = todayDay.sum;
    if (s.actStockP != null && num(s.actStockP) < 1200) {
      anomalies.push({ severity: 'warn', text: `पेट्रोल स्टॉक कम: ${lit(s.actStockP)}` });
    }
    if (s.actStockD != null && num(s.actStockD) < 1000) {
      anomalies.push({ severity: 'warn', text: `डीज़ल स्टॉक कम: ${lit(s.actStockD)}` });
    }
    if (s.diffP != null && Math.abs(num(s.diffP)) > (num(C.stockTolerance) || 25)) {
      anomalies.push({ severity: 'err', text: `पेट्रोल डिप फर्क ${r2(s.diffP)} L — जाँचें` });
    }
    if (s.diffD != null && Math.abs(num(s.diffD)) > (num(C.stockTolerance) || 25)) {
      anomalies.push({ severity: 'err', text: `डीज़ल डिप फर्क ${r2(s.diffD)} L — जाँचें` });
    }

    return anomalies;
  }

  /* ============ Main Analytics View ============ */
  APP.views.analytics = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">विश्लेषण लोड हो रहा है…</p>';

    const [days, ledger, parties, holidays] = await Promise.all([
      getDays(60),
      getLedger(90),
      APP.getParties(false, true).catch(() => []),
      getHolidays()
    ]);

    if (!days.length) {
      main.innerHTML = '<div class="card"><p class="mut">अभी कोई डेटा नहीं है। पहले कुछ दिन का हिसाब भरें।</p></div>' +
        '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
      return;
    }

    const weekdayData = analyzeWeekdays(days);
    const lastDay = days[days.length - 1];
    const stockData = predictStock(days, lastDay, holidays);
    const retention = analyzeRetention(parties, ledger);
    const monthData = analyzeMonth(days);
    const nozzleData = analyzeNozzles(days);

    let html = '<div class="card" style="background:linear-gradient(135deg,#0a2f6b,#0b3d91);color:#fff">' +
      '<h3 style="color:#fff;margin:0 0 6px">📊 आंकड़ों का विश्लेषण</h3>' +
      '<div style="font-size:12px;opacity:.85">पिछले ' + days.length + ' दिन के डेटा पर आधारित · कोई अनुमान नहीं, सिर्फ डेटा</div>' +
      '</div>';

    /* Stock section */
    if (stockData) {
      html += '<div class="card"><h3>⛽ स्टॉक कब खत्म होगा</h3>';
      const p = stockData.petrol, d = stockData.diesel;
      const pUrgent = p.daysLeft <= 3, pSoon = p.daysLeft <= 5;
      const dUrgent = d.daysLeft <= 3, dSoon = d.daysLeft <= 5;

      html += '<div style="border:2px solid ' + (pUrgent ? '#dc2626' : pSoon ? '#d97706' : '#16a34a') + ';border-radius:10px;padding:10px;margin-bottom:8px;background:' + (pUrgent ? '#fef2f2' : pSoon ? '#fef9e7' : '#f0fdf4') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:16px">⛽ पेट्रोल</b>' +
        '<span class="chip ' + (pUrgent ? 'r' : pSoon ? 'o' : 'g') + '" style="font-size:13px">' + r2(p.daysLeft) + ' दिन</span></div>' +
        '<div style="font-size:13px;color:#555">स्टॉक: <b>' + lit(p.stock) + '</b> · औसत: <b>' + lit(p.avg) + '/दिन</b></div>' +
        '<div style="font-size:13px;color:#555;margin-top:2px">खत्म: <b>' + dmy(p.depleteDate) + '</b></div>' +
        '<div style="font-size:12px;color:#b45309;margin-top:4px">' + (p.orderShifted ? '⚠️ डिपो बंद है — ' : '📅 ') + '<b>' + dmy(p.orderBy) + '</b> से पहले ऑर्डर करें</div>' +
        '</div>';

      html += '<div style="border:2px solid ' + (dUrgent ? '#dc2626' : dSoon ? '#d97706' : '#16a34a') + ';border-radius:10px;padding:10px;background:' + (dUrgent ? '#fef2f2' : dSoon ? '#fef9e7' : '#f0fdf4') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:16px">🛢️ डीज़ल</b>' +
        '<span class="chip ' + (dUrgent ? 'r' : dSoon ? 'o' : 'g') + '" style="font-size:13px">' + r2(d.daysLeft) + ' दिन</span></div>' +
        '<div style="font-size:13px;color:#555">स्टॉक: <b>' + lit(d.stock) + '</b> · औसत: <b>' + lit(d.avg) + '/दिन</b></div>' +
        '<div style="font-size:13px;color:#555;margin-top:2px">खत्म: <b>' + dmy(d.depleteDate) + '</b></div>' +
        '<div style="font-size:12px;color:#b45309;margin-top:4px">' + (d.orderShifted ? '⚠️ डिपो बंद है — ' : '📅 ') + '<b>' + dmy(d.orderBy) + '</b> से पहले ऑर्डर करें</div>' +
        '</div>';

      html += '<div class="mut" style="font-size:11px;margin-top:6px">पिछले ' + stockData.recentDaysCount + ' दिन की औसत बिक्री से · रविवार + custom holidays ka dhyan</div>';
      html += '</div>';
    }

    /* Weekday pattern */
    if (weekdayData && weekdayData.daysCount > 0) {
      html += '<div class="card"><h3>📅 दिन-वार बिक्री पैटर्न</h3>';
      if (weekdayData.best && weekdayData.worst) {
        html += '<div style="display:flex;gap:8px;margin-bottom:10px">' +
          '<div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px"><div class="mut" style="font-size:11px">सबसे अच्छा दिन</div><b style="color:#166534">' + weekdayHindi[weekdayData.best.wd] + '</b><div class="mut" style="font-size:11px">' + money(weekdayData.best.avgSale) + '</div></div>' +
          '<div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px"><div class="mut" style="font-size:11px">सबसे कम दिन</div><b style="color:#991b1b">' + weekdayHindi[weekdayData.worst.wd] + '</b><div class="mut" style="font-size:11px">' + money(weekdayData.worst.avgSale) + '</div></div>' +
          '</div>';
      }
      html += '<div style="overflow-x:auto"><table style="font-size:12px;min-width:380px">' +
        '<tr><th>दिन</th><th class="n">औसत बिक्री</th><th class="n">% अंतर</th><th class="n">Trend</th></tr>';
      [1, 2, 3, 4, 5, 6, 0].forEach(wd => {
        const s = weekdayData.stats[wd];
        if (!s) return;
        const pctCls = s.pctVsOverall > 5 ? 'pos' : s.pctVsOverall < -5 ? 'neg' : '';
        html += '<tr>' +
          '<td><b>' + weekdayShort[wd] + '</b> <span class="mut" style="font-size:10px">(' + s.samples + ' दिन)</span></td>' +
          '<td class="n">' + money(s.avgSale) + '</td>' +
          '<td class="n ' + pctCls + '">' + (s.pctVsOverall > 0 ? '+' : '') + r2(s.pctVsOverall) + '%</td>' +
          '<td class="n" style="font-size:16px">' + s.trend + '</td>' +
          '</tr>';
      });
      html += '</table></div>';
      html += '<div class="mut" style="font-size:11px;margin-top:6px">↑ बढ़ रहा · ↓ घट रहा · ↔ स्थिर (पिछले आधे vs पहले आधे से तुलना)</div>';
      html += '<p class="mut" style="font-size:12px;margin-top:10px">किसी भी दिन पर टैप करें — कौन सी पार्टी उस दिन कम आती है:</p>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      [1, 2, 3, 4, 5, 6, 0].forEach(wd => {
        if (!weekdayData.stats[wd]) return;
        html += '<button class="btn sm w" data-wd="' + wd + '">' + weekdayShort[wd] + '</button>';
      });
      html += '</div></div>';
    }

    /* Month comparison */
    if (monthData && (monthData.thisMonth.days > 0 || monthData.lastMonth.days > 0)) {
      html += '<div class="card"><h3>📈 इस महीने vs पिछले महीने</h3>';
      const tm = monthData.thisMonth, lm = monthData.lastMonth;
      const pctCls = monthData.pct > 0 ? 'pos' : monthData.pct < 0 ? 'neg' : '';
      html += '<div class="row" style="gap:8px">' +
        '<div style="flex:1;background:#f8f9fc;padding:10px;border-radius:8px;text-align:center">' +
        '<div class="mut" style="font-size:11px">इस महीने</div>' +
        '<div style="font-size:18px;font-weight:700;color:#0b3d91">' + money(tm.sale) + '</div>' +
        '<div class="mut" style="font-size:11px">' + tm.days + ' दिन का डेटा</div>' +
        '</div>' +
        '<div style="flex:1;background:#f8f9fc;padding:10px;border-radius:8px;text-align:center">' +
        '<div class="mut" style="font-size:11px">पिछले महीने</div>' +
        '<div style="font-size:18px;font-weight:700;color:#666">' + money(lm.sale) + '</div>' +
        '<div class="mut" style="font-size:11px">' + lm.days + ' दिन का डेटा</div>' +
        '</div>' +
        '</div>';
      html += '<div class="kv" style="margin-top:8px"><span>कुल अंतर (समान दिनों तक)</span><b class="' + pctCls + '">' + money(monthData.diff) + ' (' + (monthData.pct > 0 ? '+' : '') + r2(monthData.pct) + '%)</b></div>';
      html += '</div>';
    }

    /* Nozzle efficiency */
    if (nozzleData && nozzleData.allTotal > 0) {
      html += '<div class="card"><h3>⛽ नोज़ल दक्षता</h3>';
      const groups = [
        { name: '⛽ पेट्रोल', prefix: 'p', total: nozzleData.pTotal },
        { name: '🛢️ डीज़ल', prefix: 'd', total: nozzleData.dTotal }
      ];
      groups.forEach(g => {
        if (g.total <= 0) return;
        html += '<div style="margin-top:8px"><b style="color:#0b3d91">' + g.name + ' — कुल ' + lit(g.total) + '</b></div>';
        ['1', '2', '3', '4'].forEach(n => {
          const k = g.prefix + n;
          const nz = nozzleData.byNozzle[k];
          if (!nz) return;
          const statusCls = nz.status === 'low' ? 'neg' : nz.status === 'high' ? 'pos' : '';
          const icon = nz.status === 'low' ? '⚠️' : nz.status === 'high' ? '⭐' : '';
          html += '<div class="kv" style="padding:4px 0"><span>' + k.toUpperCase() + ' ' + icon + ' <span class="mut" style="font-size:11px">(' + nz.share.toFixed(1) + '% share)</span></span>';
          html += '<b class="' + statusCls + '">' + lit(nz.total) + ' <small class="mut">' + (nz.vsPeers > 0 ? '+' : '') + nz.vsPeers.toFixed(0) + '%</small></b></div>';
        });
      });
      html += '<div class="mut" style="font-size:11px;margin-top:6px">% = group ke doosre nozlon se tulna · ⚠️ = 30%+ kam · ⭐ = 30%+ zyada</div>';
      html += '</div>';
    }

    /* Party retention */
    if (retention && retention.length) {
      html += '<div class="card"><h3>👥 पार्टी वापसी विश्लेषण</h3>';
      html += '<p class="mut" style="font-size:12px;margin-bottom:8px">जो पार्टियां अपने सामान्य gap से ज्यादा दिन बाद नहीं आईं</p>';
      retention.slice(0, 10).forEach(r => {
        const chip = r.status === 'long' ? '<span class="chip r" style="font-size:11px">' + r.daysSince + ' दिन</span>'
                  : '<span class="chip o" style="font-size:11px">' + r.daysSince + ' दिन</span>';
        html += '<div class="item" style="padding:8px 0"><div class="a"><b>' + esc(r.name) + '</b>' +
          '<small>आखिरी: ' + dmy(r.lastVisit) + (r.avgGap ? ' · औसत gap: ' + r.avgGap + ' दिन' : '') + ' · कुल ' + r.totalVisits + ' बार</small></div>' +
          '<div style="text-align:right">' + chip;
        if (r.phone) {
          const w = '91' + String(r.phone).replace(/\D/g, '').slice(-10);
          html += '<div style="margin-top:4px"><a href="https://wa.me/' + w + '?text=' + encodeURIComponent('नमस्ते ' + r.name + ' जी, आप ' + r.daysSince + ' दिन से नहीं आए। सब कुशल? - माज़दा ऑयल कंपनी') + '" target="_blank" class="btn sm g" style="font-size:11px;padding:4px 8px">💬 याद दिलाएं</a></div>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    }

    html += '<div class="btns" style="margin-top:12px"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';

    main.innerHTML = html;

    $$('[data-wd]').forEach(b => b.onclick = () => showWeekdayDetails(parseInt(b.dataset.wd), ledger));
  };

  function showWeekdayDetails(weekday, ledger) {
    const info = analyzePartyForWeekday(ledger, weekday);
    let html = '<h3>' + weekdayHindi[weekday] + ' का विश्लेषण</h3>' +
      '<p class="mut" style="font-size:12px;margin-bottom:10px">इस दिन कौन आता है, कौन नहीं — पिछले 90 दिन के डेटा से</p>';

    if (info.topParties.length) {
      html += '<div style="font-weight:700;color:#0b3d91;margin:8px 0 4px">⭐ इस दिन सबसे ज्यादा:</div>';
      info.topParties.forEach(p => {
        html += '<div class="kv" style="padding:4px 0"><span>' + esc(p.name) + ' <small class="mut">(' + p.visits + ' बार)</small></span><b>' + money(p.amount) + '</b></div>';
      });
    }

    if (info.missing.length) {
      html += '<div style="font-weight:700;color:#b45309;margin:12px 0 4px">⚠️ इस दिन कम आते हैं (बाकी दिन regular):</div>';
      info.missing.forEach(p => {
        html += '<div class="kv" style="padding:4px 0"><span>' + esc(p.name) + '<br><small class="mut">कुल ' + p.totalVisits + ' में से ' + p.thisDayVisits + ' बार</small></span><b>' + money(p.avgAmount) + '/बार</b></div>';
      });
    } else {
      html += '<p class="mut" style="margin-top:10px">इस दिन कम आने वाली कोई विशेष पार्टी नहीं मिली — बिक्री का अंतर यही बताता है कि कुछ और कारण हो सकता है</p>';
    }

    const m = modal(html + '<div class="btns" style="margin-top:12px"><button class="btn w" id="wd-close">बंद</button></div>');
    $('#wd-close', m).onclick = () => m.close();
  }

  /* ============ Rate History View ============ */
  APP.views.rate_history = async function () {
    const main = $('#main'); if (!main) return;
    main.innerHTML = '<p class="mut">रेट इतिहास लोड हो रहा है…</p>';

    const hist = await getRateHistory(60);
    if (!hist.length) {
      main.innerHTML = '<div class="card"><p class="mut">अभी कोई रेट इतिहास नहीं है। जब किसी दिन का खरीद रेट भरेंगे तो यहाँ दिखेगा।</p></div>' +
        '<div class="btns"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
      return;
    }

    const latest = hist[hist.length - 1];
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;

    const change = (cur, pv) => {
      if (!pv || !cur) return '';
      const diff = cur - pv;
      if (Math.abs(diff) < 0.01) return '<span class="mut" style="font-size:11px">=</span>';
      return diff > 0 ? '<span class="pos" style="font-size:11px">↑ ₹' + r2(diff) + '</span>' : '<span class="neg" style="font-size:11px">↓ ₹' + r2(-diff) + '</span>';
    };

    let html = '<div class="card" style="background:#0b3d91;color:#fff"><h3 style="color:#fff;margin:0">📈 रेट इतिहास</h3>' +
      '<div style="font-size:12px;opacity:.85;margin-top:4px">पिछले ' + hist.length + ' दिन</div></div>';

    html += '<div class="card"><h3>आज के रेट (सबसे नया: ' + dmy(latest.date) + ')</h3>' +
      '<div class="row">' +
      '<div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px;text-align:center"><div class="mut" style="font-size:11px">पेट्रोल बिक्री</div><div style="font-size:18px;font-weight:700">₹' + r2(latest.rateP) + '</div>' + change(latest.rateP, prev && prev.rateP) + '</div>' +
      '<div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px;text-align:center"><div class="mut" style="font-size:11px">डीज़ल बिक्री</div><div style="font-size:18px;font-weight:700">₹' + r2(latest.rateD) + '</div>' + change(latest.rateD, prev && prev.rateD) + '</div>' +
      '</div>';

    if (latest.costP || latest.costD) {
      html += '<div class="row" style="margin-top:8px">' +
        '<div style="flex:1;background:#f8f9fc;border:1px solid #e0e5ef;border-radius:8px;padding:8px;text-align:center"><div class="mut" style="font-size:11px">पेट्रोल खरीद</div><div style="font-size:15px;font-weight:700">₹' + r2(latest.costP) + '</div>' + change(latest.costP, prev && prev.costP) + '</div>' +
        '<div style="flex:1;background:#f8f9fc;border:1px solid #e0e5ef;border-radius:8px;padding:8px;text-align:center"><div class="mut" style="font-size:11px">डीज़ल खरीद</div><div style="font-size:15px;font-weight:700">₹' + r2(latest.costD) + '</div>' + change(latest.costD, prev && prev.costD) + '</div>' +
        '</div>';
      const marginP = latest.rateP - latest.costP;
      const marginD = latest.rateD - latest.costD;
      if (marginP > 0 || marginD > 0) {
        html += '<div class="kv" style="margin-top:8px"><span>प्रति लीटर मार्जिन</span><b class="pos">P: ₹' + r2(marginP) + ' · D: ₹' + r2(marginD) + '</b></div>';
      }
    }
    html += '</div>';

    html += '<div class="card" style="overflow-x:auto"><h3>दिन-वार रेट</h3>' +
      '<table style="font-size:11px;min-width:400px">' +
      '<tr><th>तारीख</th><th class="n">बिक्री P</th><th class="n">बिक्री D</th><th class="n">खरीद P</th><th class="n">खरीद D</th></tr>';
    hist.slice().reverse().slice(0, 30).forEach(h => {
      html += '<tr>' +
        '<td>' + dmy(h.date) + '</td>' +
        '<td class="n">₹' + r2(h.rateP) + '</td>' +
        '<td class="n">₹' + r2(h.rateD) + '</td>' +
        '<td class="n">' + (h.costP ? '₹' + r2(h.costP) : '-') + '</td>' +
        '<td class="n">' + (h.costD ? '₹' + r2(h.costD) : '-') + '</td>' +
        '</tr>';
    });
    html += '</table></div>';

    html += '<div class="btns" style="margin-top:12px"><button class="btn w" onclick="APP.go(\'more\')">← वापस</button></div>';
    main.innerHTML = html;
  };

  /* ============ Day view analytics card injection ============ */
  let cachedAnalysis = null;
  let cacheTime = 0;

  async function injectDayAnalytics() {
    const dateInput = document.querySelector('#f-date');
    if (!dateInput) return;

    const existing = document.querySelector('#day-analytics-card');
    if (existing) existing.remove();

    if (S.role === 'salesman' || S.role === 'viewer') return;
    if (dateInput.value !== today()) return;

    if (cachedAnalysis && Date.now() - cacheTime < 5 * 60 * 1000) {
      renderAnalyticsCard(cachedAnalysis);
      return;
    }

    try {
      const [days, holidays] = await Promise.all([getDays(30), getHolidays()]);
      const todayDay = days.find(d => d.date === today());
      const weekdayData = analyzeWeekdays(days);
      const stockData = todayDay ? predictStock(days, todayDay, holidays) : null;
      const monthData = analyzeMonth(days);
      const anomalies = todayDay ? detectAnomalies(days, todayDay) : [];
      const tomorrowWd = (getWeekday(today()) + 1) % 7;
      const tomorrowStat = weekdayData && weekdayData.stats[tomorrowWd];

      cachedAnalysis = { weekdayData, stockData, monthData, anomalies, tomorrowStat, tomorrowWd };
      cacheTime = Date.now();

      renderAnalyticsCard(cachedAnalysis);
    } catch (e) { console.error('Analytics injection error', e); }
  }

  function renderAnalyticsCard(analysis) {
    if (document.querySelector('#day-analytics-card')) return;
    const dateInput = document.querySelector('#f-date');
    if (!dateInput) return;
    const dateCard = dateInput.closest('.card');
    if (!dateCard) return;

    let html = '<div id="day-analytics-card" class="card" style="border-left:4px solid #0b3d91;background:linear-gradient(180deg,#f8f9fc,#fff)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<h3 style="margin:0;color:#0b3d91;font-size:15px">📊 आंकड़ों का विश्लेषण</h3>' +
      '<span class="mut" style="font-size:11px">पिछले 30 दिन से</span>' +
      '</div>';

    if (analysis.anomalies && analysis.anomalies.length) {
      analysis.anomalies.forEach(a => {
        const cls = a.severity === 'err' ? 'err' : 'warn';
        html += '<div class="' + cls + '" style="margin:4px 0;font-size:13px">' + esc(a.text) + '</div>';
      });
    }

    if (analysis.stockData) {
      const p = analysis.stockData.petrol;
      const d = analysis.stockData.diesel;
      const pChip = p.daysLeft <= 3 ? 'r' : p.daysLeft <= 5 ? 'o' : 'g';
      const dChip = d.daysLeft <= 3 ? 'r' : d.daysLeft <= 5 ? 'o' : 'g';

      html += '<div style="display:flex;gap:8px;margin:8px 0">' +
        '<div style="flex:1;background:#fff;border:1px solid #e0e5ef;border-radius:8px;padding:8px">' +
        '<div style="font-size:11px;color:#666">⛽ पेट्रोल</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">' +
        '<b style="font-size:14px">' + lit(p.stock) + '</b>' +
        '<span class="chip ' + pChip + '" style="font-size:11px">' + r2(p.daysLeft) + ' दिन</span>' +
        '</div>' +
        (p.daysLeft <= 5 ? '<div style="font-size:10px;color:#b45309;margin-top:2px">📅 ' + dmy(p.orderBy) + ' तक ऑर्डर</div>' : '') +
        '</div>' +
        '<div style="flex:1;background:#fff;border:1px solid #e0e5ef;border-radius:8px;padding:8px">' +
        '<div style="font-size:11px;color:#666">🛢️ डीज़ल</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">' +
        '<b style="font-size:14px">' + lit(d.stock) + '</b>' +
        '<span class="chip ' + dChip + '" style="font-size:11px">' + r2(d.daysLeft) + ' दिन</span>' +
        '</div>' +
        (d.daysLeft <= 5 ? '<div style="font-size:10px;color:#b45309;margin-top:2px">📅 ' + dmy(d.orderBy) + ' तक ऑर्डर</div>' : '') +
        '</div>' +
        '</div>';
    }

    if (analysis.tomorrowStat) {
      html += '<div class="kv" style="padding:6px 0;font-size:13px"><span>📅 कल (' + weekdayShort[analysis.tomorrowWd] + ') का अनुमान</span><b>' + money(analysis.tomorrowStat.avgSale) + '</b></div>';
    }

    if (analysis.monthData && analysis.monthData.lastMonth.days > 0) {
      const pct = analysis.monthData.pct;
      const cls = pct > 0 ? 'pos' : pct < 0 ? 'neg' : '';
      html += '<div class="kv" style="padding:6px 0;font-size:13px"><span>📈 इस महीने vs पिछला</span><b class="' + cls + '">' + (pct > 0 ? '+' : '') + r2(pct) + '%</b></div>';
    }

    html += '<div class="btns" style="margin-top:8px"><button class="btn sm" onclick="APP.go(\'analytics\')" style="width:100%">पूरा विश्लेषण देखें →</button></div>';
    html += '</div>';

    const frag = document.createRange().createContextualFragment(html);
    dateCard.parentNode.insertBefore(frag, dateCard.nextSibling);
  }

  window.addEventListener('load', () => {
    const main = document.querySelector('#main');
    if (!main) return;
    new MutationObserver(() => { setTimeout(injectDayAnalytics, 300); })
      .observe(main, { childList: true });
  });

  /* ============ More menu buttons ============ */
  const origMore = APP.views.more;
  APP.views.more = async function (arg) {
    if (origMore) await origMore.apply(this, arguments);
    if (APP.isViewer() || S.role === 'salesman') return;
    const main = $('#main'); if (!main) return;
    if (document.querySelector('#analytics-more-btn')) return;

    const card = main.querySelector('#extra-more-card') || main.querySelector('.card');
    if (!card) return;
    const btns = card.querySelector('.btns');
    if (btns) {
      const btnA = document.createElement('button');
      btnA.id = 'analytics-more-btn';
      btnA.className = 'btn w';
      btnA.innerHTML = '📊 आंकड़ों का विश्लेषण';
      btnA.onclick = () => APP.go('analytics');
      btns.insertBefore(btnA, btns.firstChild);

      const btnR = document.createElement('button');
      btnR.id = 'rate-more-btn';
      btnR.className = 'btn w';
      btnR.innerHTML = '📈 रेट इतिहास';
      btnR.onclick = () => APP.go('rate_history');
      btns.insertBefore(btnR, btnA.nextSibling);
    }
  };

  console.log('[Mazda analytics.js] loaded ✓');
})();
