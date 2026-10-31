/* Mazda Assistant — स्मार्ट दिमाग: इरादा (intent) समझना, तारीख/follow-up याद रखना, हर बार अलग जवाब, ख़ुद से सीखना, और Gemini से आम सवाल */
(function () {
  'use strict';
  const APP = window.APP; if (!APP) return;
  const LAST_LIMIT = 150;

  /* ---------- छोटे हेल्पर ---------- */
  const lc = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s/.-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const toks = s => Array.from(new Set(lc(s).split(' ').filter(w => w.length > 1)));
  const has = (q, arr) => arr.some(w => q.includes(w));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));

  /* ---------- इरादे और उनके शब्द (हिंदी + Roman + आम ग़लत spelling) ---------- */
  const KW = {
    sale: ['sale', 'sel ', 'सेल', 'बिक्री', 'bikri', 'becha', 'बेचा', 'बिका', 'bika', 'collection', 'कलेक्शन', 'कमाई', 'kamai', 'आमदनी', 'turnover'],
    stock: ['stock', 'स्टॉक', 'stok', 'tel kitna', 'तेल कितना', 'bacha', 'बचा', 'tank', 'टैंक', 'dip', 'डिप', 'petrol kitna', 'diesel kitna', 'डीज़ल कितना', 'पेट्रोल कितना'],
    days: ['kitne din', 'कितने दिन', 'chalega', 'चलेगा', 'kab tak', 'कब तक', 'tanker kab', 'टैंकर कब', 'mangwana', 'मँगवाना'],
    udhar: ['udhar', 'उधार', 'baki', 'बाकी', 'bakaya', 'बकाया', 'lena hai', 'लेना है', 'outstanding', 'dues'],
    nozzle: ['nozzle', 'nozel', 'nozzel', 'नोज़ल', 'नोजल', 'trend', 'ट्रेंड', 'meter', 'मीटर'],
    pay: ['paytm', 'पेटीएम', 'upi', 'swipe', 'स्वाइप', 'card', 'कार्ड', 'digital'],
    cash: ['cash', 'कैश', 'galla', 'गल्ला', 'नकद', 'nakad'],
    kharcha: ['kharcha', 'kharch', 'खर्चा', 'खर्च', 'expense'],
    help: ['kya kya', 'क्या क्या', 'kya kar sakti', 'क्या कर सकती', 'help', 'मदद', 'madad', 'features', 'kaam kar'],
    owner: ['malik', 'मालिक', 'owner', 'kisne banaya', 'किसने बनाया']
  };
  const ENTRY = /(daalo|dalo|डालो|डाल दो|likho|लिखो|jodo|जोड़ो|entry|एंट्री|add|enter|save|set)/i;

  function relDate(q, now) {
    const t = new Date(now + 'T12:00:00'), back = n => { const d = new Date(t); d.setDate(d.getDate() - n); return iso(d); };
    const m = q.match(/(\d{1,2})\s*(?:tarik|tareekh|tarikh|date|तारीख|तारिख|तारीक)/i) || q.match(/(?:तारीख|date)\s*(\d{1,2})/i);
    if (m) { const day = +m[1]; if (day >= 1 && day <= 31) { const d = new Date(t); d.setDate(1); if (day > t.getDate()) d.setMonth(d.getMonth() - 1); d.setDate(day); return iso(d); } }
    if (/\b(parso|parson)\b|परसों|परसो/.test(q)) return back(2);
    if (/\b(narso|narson)\b|नरसों/.test(q)) return back(3);
    if (/\bkal\b|कल|yesterday/.test(q)) return back(1);
    if (/\baaj\b|\baj\b|आज|today/.test(q)) return now;
    return null;
  }
  const lbl = (d, now) => { const diff = Math.round((new Date(now + 'T12:00:00') - new Date(d + 'T12:00:00')) / 86400000); return diff === 0 ? 'आज' : diff === 1 ? 'कल' : diff === 2 ? 'परसों' : d.split('-').reverse().join('/'); };

  /* ---------- हर बार अलग जवाब (लगातार वही नहीं) ---------- */
  function pick(K, key, arr) {
    const b = K.ctx.brain; b.lastPick = b.lastPick || {};
    let i = Math.floor(Math.random() * arr.length);
    if (arr.length > 1 && i === b.lastPick[key]) i = (i + 1) % arr.length;
    b.lastPick[key] = i; return arr[i];
  }
  const LEAD = {
    sale: ['ये रहा आपका हिसाब 👇', 'देखिए, सेल का हाल 👇', 'जी, अभी बताती हूँ 👇', 'ये लीजिए सेल की जानकारी 👇'],
    stock: ['टैंक का हाल ये है 👇', 'स्टॉक की ताज़ा जानकारी 👇', 'जी, ये रहा स्टॉक 👇'],
    udhar: ['उधार का पूरा हाल 👇', 'ये रहा बकाया 👇', 'जी, बाकी रकम ये है 👇'],
    ask: ['क्या आप ये पूछ रहे थे?', 'शायद आपका मतलब ये है:', 'मुझे लगता है आप इनमें से कुछ जानना चाहते हैं:', 'थोड़ा और साफ़ बताएँगे? इनमें से कोई चुनें:']
  };

  function entryBtn(date, now) {
    const R = APP.AsstCore.R;
    return R('📝 <b>' + lbl(date, now) + '</b> (' + date.split('-').reverse().join('/') + ') की एंट्री मैं यहाँ से नहीं भर सकती — चैट से सिर्फ़ <b>आज</b> की एंट्री होती है, ताकि पुराना हिसाब न बिगड़े।<br><br><button class="btn sm g" style="margin-top:4px" onclick="document.getElementById(\'a-close\').click();APP.go(\'day\',\'' + date + '\')">📅 ' + lbl(date, now) + ' का हिसाब खोलें</button>', { say: 'पुरानी तारीख की एंट्री चैट से नहीं होती। मैंने उस दिन का हिसाब खोलने का बटन दे दिया है।' });
  }

  function boot() {
    const K = APP.AsstCore; if (!K) return setTimeout(boot, 600);
    const { SK, R, ctx, M, n } = K;
    const db = () => (typeof APP.db === 'function' ? APP.db() : APP.db);
    ctx.brain.alias = ctx.brain.alias || {}; ctx.brain.use = ctx.brain.use || {};
    const save = () => K.saveBrain();

    /* आख़िरी 7 दिन — नोज़ल ट्रेंड और स्नैपशॉट के लिए */
    async function recent(days) {
      const from = K.shift(K.today(), -(days - 1));
      const s = await db().collection('days').where('date', '>=', from).get();
      return s.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date));
    }
    async function snapshot() {
      try {
        const ds = await recent(3), t = K.today(), td = ds.find(x => x.date === t), L = ds[ds.length - 1] || {}, sm = (L.sum || {});
        return 'आज की सेल: ' + (td && td.sum ? M(td.sum.sale) : 'अभी हिसाब नहीं बना') + '; आख़िरी हिसाब ' + (L.date || '-') + ' की सेल ' + M(sm.sale) + ', बचा कैश ' + M(sm.close) + ', पेट्रोल स्टॉक ' + (sm.actStockP != null ? sm.actStockP : sm.expStockP) + ' L, डीज़ल स्टॉक ' + (sm.actStockD != null ? sm.actStockD : sm.expStockD) + ' L.';
      } catch (e) { return ''; }
    }

    /* इरादा पहचानना: सबसे ज़्यादा शब्द मिलने वाला; सीखे हुए phrase सबसे पहले */
    function classify(q) {
      const tk = toks(q), key = tk.sort().join(' ');
      const al = ctx.brain.alias;
      if (al[key]) return { intent: al[key].intent, conf: 3, learned: true, key };
      let bestA = null, bestJ = 0;
      Object.keys(al).forEach(k => { const a = new Set(k.split(' ')), inter = tk.filter(x => a.has(x)).length, j = inter / (new Set([...a, ...tk]).size || 1); if (j > bestJ) { bestJ = j; bestA = k; } });
      if (bestA && bestJ >= 0.75) return { intent: al[bestA].intent, conf: 3, learned: true, key };
      const sc = {}; Object.keys(KW).forEach(i => { const c = KW[i].filter(w => q.includes(w)).length; if (c) sc[i] = c; });
      if (sc.days) { sc.days += 2; }                       // "कितने दिन चलेगा" > "स्टॉक"
      const top = Object.keys(sc).sort((a, b) => sc[b] - sc[a]);
      return { intent: top[0] || null, conf: top.length ? sc[top[0]] : 0, ranked: top, key };
    }

    async function answer(intent, q, date, raw) {
      const t = K.today(), dtInfo = K.extractDateOrRange ? K.extractDateOrRange(raw) : null;
      const lead = a => (APP.AsstBrain.noLead ? '' : '<div style="margin-bottom:6px;color:#0b3d91;font-weight:600">' + pick(K, 'lead.' + a, LEAD[a] || LEAD.sale) + '</div>');
      const wrap = (r, a) => { if (r && r.html) r.html = lead(a) + r.html; return r; };
      if (intent === 'sale') {
        if (dtInfo && dtInfo.kind === 'range') return wrap(await SK['sale.day']({ range: dtInfo.range }), 'sale');
        return wrap(await SK['sale.day']({ date: date || t }), 'sale');
      }
      if (intent === 'stock') return wrap(await SK.stock({ date: date || t }), 'stock');
      if (intent === 'days') { const h = APP.extras && APP.extras.stockCard ? await APP.extras.stockCard() : ''; return h ? R(h, { say: 'टैंकर कब मँगवाना है, ये कार्ड में दिखा दिया है।' }) : null; }
      if (intent === 'udhar') return wrap(await SK['udhar.total']({}), 'udhar');
      if (intent === 'nozzle') {
        const ds = await recent(7), tot = {};
        ds.forEach(d => Object.keys(d.nz || {}).forEach(k => { const x = d.nz[k] || {}; const g = n(x.c) - n(x.o); if (x.c !== '' && g > 0) tot[k] = (tot[k] || 0) + Math.max(0, g - (x.t !== undefined && x.t !== '' ? n(x.t) : n(d.testing || 5))); }));
        const rows = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
        if (!rows.length) return R('📊 पिछले 7 दिन में नोज़ल का डेटा नहीं मिला।');
        const mx = tot[rows[0]];
        return R('<b>⛽ पिछले 7 दिन — नोज़ल की बिक्री</b><br>' + rows.map(k => '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><b style="width:26px">' + k.toUpperCase() + '</b><div style="flex:1;background:#e8eefb;border-radius:6px"><div style="width:' + Math.round(tot[k] / mx * 100) + '%;background:#0b3d91;color:#fff;font-size:11px;padding:2px 6px;border-radius:6px;white-space:nowrap">' + Math.round(tot[k]).toLocaleString('en-IN') + ' L</div></div></div>').join('') + '<div class="mut" style="font-size:12px;margin-top:6px">सबसे ज़्यादा: <b>' + rows[0].toUpperCase() + '</b> · सबसे कम: <b>' + rows[rows.length - 1].toUpperCase() + '</b></div>', { say: 'सबसे ज़्यादा बिक्री ' + rows[0] + ' की रही।' });
      }
      if (intent === 'pay' || intent === 'cash' || intent === 'kharcha') {
        const d = await K.D.day(date || t), s = d && d.sum;
        if (!d) return R('📅 <b>' + lbl(date || t, t) + '</b> का हिसाब अभी दर्ज नहीं हुआ है।');
        const row = (a, b) => '<div style="display:flex;justify-content:space-between;padding:3px 0"><span>' + a + '</span><b>' + b + '</b></div>';
        return R('<b>💰 ' + lbl(date || t, t) + ' का पैसा</b>' + row('Paytm/UPI', M(d.paytm)) + row('स्वाइप', M(d.swipe)) + row('खर्चा (DG+चाय+इनाम)', M(n(d.kharcha) + n(d.chaiKhana) + n(d.driverInaam))) + row('बचा कैश', M(s ? s.close : 0)));
      }
      if (intent === 'help') return await SK.help({});
      return null;
    }

    function learn(key, intent) {
      const b = ctx.brain, p = b.pendingLearn;
      b.use[intent] = (b.use[intent] || 0) + 1;
      if (p && Date.now() - p.ts < 180000 && p.key !== key && intent) {
        b.alias[p.key] = { intent, at: Date.now() };
        const ks = Object.keys(b.alias); if (ks.length > LAST_LIMIT) delete b.alias[ks.sort((a, c) => b.alias[a].at - b.alias[c].at)[0]];
      }
      b.pendingLearn = null; save();
    }

    function userChips() {
      const top = Object.keys(ctx.brain.use).sort((a, b) => ctx.brain.use[b] - ctx.brain.use[a]).slice(0, 3);
      const map = { sale: ['📊 आज की सेल', 'आज की सेल'], stock: ['🛢️ स्टॉक', 'स्टॉक कितना है'], days: ['⏳ तेल कितने दिन चलेगा', 'तेल कितने दिन चलेगा'], udhar: ['📒 कुल उधार', 'कुल उधार'], nozzle: ['⛽ नोज़ल ट्रेंड', 'नोज़ल ट्रेंड बताओ'], pay: ['💳 Paytm/स्वाइप', 'आज का paytm'], cash: ['💵 कैश', 'आज का कैश'] };
      const list = top.concat(['sale', 'stock', 'days', 'udhar']).filter((v, i, a) => map[v] && a.indexOf(v) === i).slice(0, 4);
      return list.map(i => ({ label: map[i][0], q: map[i][1] }));
    }

    APP.AsstBrain = {
      noLead: false,
      async route(raw, q0) {
        const q = lc(raw), now = K.today(), date = relDate(q, now), hasDate = !!date;
        const last = ctx.brain.last || null;
        const hasAmount = /\d{3,}/.test(q.replace(/\d{1,2}\s*(tarik|tareekh|तारीख|date)/gi, ''));
        // 1) एंट्री जैसी बात पर पुरानी तारीख: चुपचाप आज की न बने
        if (ENTRY.test(raw) || (KW.pay.concat(KW.kharcha).some(w => q.includes(w)) && hasAmount)) {
          if (hasDate && date !== now) {
            ctx.brain.last = { intent: 'entry', date }; save();
            return entryBtn(date, now);
          }
          if (false) {
            return R('📝 <b>' + lbl(date, now) + '</b> (' + date.split('-').reverse().join('/') + ') की एंट्री मैं यहाँ से नहीं भर सकती — चैट से सिर्फ़ <b>आज</b> की एंट्री होती है, ताकि पुराना हिसाब न बिगड़े।<br><br><button class="btn sm g" style="margin-top:4px" onclick="document.getElementById(\'a-close\').click();APP.go(\'day\',\'' + date + '\')">📅 ' + lbl(date, now) + ' का हिसाब खोलें</button>', { say: 'पुरानी तारीख की एंट्री चैट से नहीं होती। मैंने उस दिन का हिसाब खोलने का बटन दे दिया है।' });
          }
          return null;                                   // आज की एंट्री → पुराना इंजन संभालेगा
        }
        // 2) सुधार/follow-up: "आज नहीं कल की", "30 तारीख के"
        const corr = /\b(nahi|nhi|nahin|no)\b|नहीं|नही/.test(q);
        const c = classify(q);
        if (!c.intent && last && last.intent === 'entry' && hasDate) { ctx.brain.last = { intent: 'entry', date }; save(); return entryBtn(date, now); }
        if (!c.intent && last && last.intent !== 'entry' && (hasDate || corr) && last.date !== undefined) {
          const r = await answer(last.intent, q, date || last.date, raw);
          if (r) { ctx.brain.last = { intent: last.intent, date: date || last.date }; save(); return r; }
        }
        if (!c.intent || (c.conf < 1)) return null;
        // पार्टी/गाड़ी का नाम हो तो पुराना इंजन बेहतर जानता है
        if (c.intent === 'udhar' && (await K.D.parties()).some(p => p.name && q.includes(lc(p.name).split(' ')[0]) && lc(p.name).split(' ')[0].length > 2)) return null;
        if (c.intent === 'owner') return null;
        const r = await answer(c.intent, q, date, raw);
        if (r) { ctx.brain.last = { intent: c.intent, date: date || null }; if (c.learned || c.conf >= 1) learn(c.key, c.intent); r.chips = r.chips || userChips(); }
        return r;
      },
      async fallback(raw) {
        const q = lc(raw), c = classify(q), key = c.key;
        ctx.brain.pendingLearn = { key, ts: Date.now() }; save();
        // 1) Gemini है तो असली जवाब (पंप के live आँकड़ों के साथ)
        if (APP.AI && APP.AI.hasKey && APP.AI.hasKey() && navigator.onLine !== false) {
          try {
            const snap = await snapshot();
            const prompt = 'तुम "माज़दा असिस्टेंट" हो — माज़दा ऑयल कंपनी (BPCL पेट्रोल पंप, रानीखेत रोड, अल्मोड़ा) की स्मार्ट मैनेजर। सीधी-सादी हिंदी में 2-3 छोटी लाइन में जवाब दो। सिर्फ़ नीचे दिए आँकड़े इस्तेमाल करो, कोई आँकड़ा अपने मन से मत बनाओ। जवाब पता न हो तो साफ़ कहो और बताओ कि ऐप में कहाँ देखें।\nपंप के ताज़ा आँकड़े: ' + snap + '\nयूज़र का सवाल: ' + raw;
            const txt = await APP.AI.ask({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 300 } }, { timeout: 12000 });
            if (txt && txt.trim()) return R('🤖 ' + esc(txt.trim()).replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'), { say: txt.replace(/[*_#]/g, ''), chips: userChips() });
          } catch (e) { /* key न हो / नेट कमज़ोर — नीचे वाला तरीका */ }
        }
        // 2) नहीं तो अंदाज़ा लगाकर पूछना (हर बार अलग शब्दों में)
        const ranked = (c.ranked || []).slice(0, 2), ch = userChips();
        const pool = ranked.length ? LEAD.ask : ['मैं ठीक से समझ नहीं पाई 🙏 इनमें से कुछ चुनें, या सवाल थोड़ा अलग तरह से लिखें:', 'ये बात मुझे साफ़ नहीं हुई। आप ये पूछ सकते हैं:', 'अभी इसका जवाब मेरे पास नहीं है 😅 पर इनमें मैं पक्का मदद कर सकती हूँ:'];
        const line = pick(K, 'ask', pool);
        return R('🤔 ' + line + '<div class="mut" style="font-size:12px;margin-top:6px">आप जो बताएँगे, मैं उससे सीख लूँगी — अगली बार यही सवाल सीधा समझ जाऊँगी।</div>', { say: line, chips: ch });
      }
    };
    console.log('[Mazda assistant_brain.js] smart brain ready ✓');
  }
  window.addEventListener('load', () => setTimeout(boot, 800));
})();
