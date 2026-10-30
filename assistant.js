/* Mazda Oil Company - Ultimate Maha-Assistant (Claude + Gemini + Custom Logic) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP || !APP.C) return;

  const S = APP.S || {};
  const esc = APP.esc || (s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const num = APP.num || (v => Number(v) || 0);
  const money = APP.money || (v => '₹' + Math.round(num(v)).toLocaleString('en-IN'));
  const lit = APP.lit || (v => Math.round(num(v)).toLocaleString('en-IN') + ' L');
  const dmy = APP.dmy || (d => String(d).split('-').reverse().join('-'));
  const toast = APP.toast || (() => {});
  const db = () => APP.db;
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const T = () => (APP.todayISO ? APP.todayISO() : iso(new Date()));
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const daysDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

  // ======================================================================
  // 1. YAADDASHT (Memory & Self-Learning)
  // ======================================================================
  const SK = 'mazda_assistant_v3';
  const defMem = () => ({ alias: {}, tok: {}, facts: [], unknown: [], freq: {}, voice: '', tts: true });
  let MEM = defMem();
  function loadMem() {
    try { const j = JSON.parse(localStorage.getItem(SK) || 'null'); if (j) MEM = Object.assign(defMem(), j); } catch (e) {}
    try {
      const old = JSON.parse(localStorage.getItem('mazda_learned_words') || '{}');
      Object.keys(old).forEach(k => { if (!MEM.alias[k]) MEM.alias[k] = old[k]; });
    } catch (e) {}
  }
  function saveMem() { try { localStorage.setItem(SK, JSON.stringify(MEM)); } catch (e) {} }
  loadMem();

  // ======================================================================
  // 2. ZUBAAN: Devanagari -> Roman, Phonetic, Fuzzy
  // ======================================================================
  const CONS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h' };
  const MATRA = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o' };
  const VOW = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o' };
  function dev2lat(s) {
    s = s.normalize('NFD').replace(/़/g, '').replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x966));
    let out = '', pend = false;
    for (const ch of s) {
      if (CONS[ch] !== undefined) { out += CONS[ch] + 'a'; pend = true; continue; }
      if (MATRA[ch] !== undefined) { if (pend) out = out.slice(0, -1); out += MATRA[ch]; pend = false; continue; }
      if (ch === '्') { if (pend) out = out.slice(0, -1); pend = false; continue; }
      if (VOW[ch] !== undefined) { out += VOW[ch]; pend = false; continue; }
      if (ch === 'ं' || ch === 'ँ') { out += 'n'; pend = false; continue; }
      if (ch === 'ः') { out += 'h'; pend = false; continue; }
      if (pend && /[^a-z0-9]/i.test(ch)) out = out.slice(0, -1);
      pend = false; out += ch;
    }
    if (pend) out = out.slice(0, -1);
    return out;
  }
  function norm(s) { return dev2lat(String(s || '').toLowerCase()).replace(/[^a-z0-9.,%+\-*\/@\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function tokens(q) { return q.split(' ').map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')).filter(Boolean); }
  function phon(w) {
    w = w.replace(/ph/g, 'f').replace(/kh|q/g, 'k').replace(/gh/g, 'g').replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/jh/g, 'j')
      .replace(/chh|ch/g, 'c').replace(/sh|ss/g, 's').replace(/[zx]/g, 'j').replace(/w/g, 'v').replace(/y/g, 'i');
    w = (w[0] || '') + w.slice(1).replace(/[aeiou]/g, '');
    return w.replace(/(.)\1+/g, '$1');
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function tokSim(a, b) {
    if (a === b) return 1;
    if (a.length < 3 || b.length < 3) return 0;
    const pa = phon(a), pb = phon(b);
    if (pa === pb && pa.length >= 2) return 0.92;
    return 1 - lev(a, b) / Math.max(a.length, b.length);
  }
  const has = (toks, ...words) => toks.some(t => words.some(w => tokSim(t, w) >= 0.85));

  // ======================================================================
  // 3. AAWAZ: Hindi Numbers & TTS
  // ======================================================================
  const W = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सतासी अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे').split(' ');
  function hiNum(n) {
    n = Math.floor(Math.abs(n)); if (n < 100) return W[n]; const p = [];
    const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3; const h = Math.floor(n / 100); n %= 100;
    if (cr) p.push(hiNum(cr) + ' करोड़'); if (lk) p.push(W[lk] + ' लाख'); if (th) p.push(W[th] + ' हज़ार');
    if (h) p.push(W[h] + ' सौ'); if (n) p.push(W[n]); return p.join(' ');
  }
  function numSpeak(str) {
    str = String(str).replace(/,/g, ''); const [i, f] = str.split('.');
    let r = hiNum(parseInt(i || '0', 10)); if (f && /[1-9]/.test(f)) r += ' दशमलव ' + f.split('').map(d => W[+d]).join(' '); return r;
  }
  const MONTH_HI = ['', 'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
  function speechify(html) {
    let t = String(html || '');
    t = t.replace(/<br\s*\/?>|<\/(div|p|li)>/gi, ' । ').replace(/<[^>]*>/g, ' ');
    t = t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, ' और ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&quot;/g, '');
    t = t.replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}️‍]/gu, ' ');
    t = t.replace(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})\b/g, (m, d, mo, y) => MONTH_HI[+mo] ? `${numSpeak(d)} ${MONTH_HI[+mo]} ${numSpeak(y)}` : m);
    t = t.replace(/₹\s*(-?)\s*([\d,]+(?:\.\d+)?)/g, (m, neg, n) => (neg ? 'माइनस ' : '') + numSpeak(n) + ' रुपये');
    t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s*%/g, (m, n) => numSpeak(n) + ' प्रतिशत');
    t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:L|ltr|Ltr|lit\.?|लीटर)\b/g, (m, n) => numSpeak(n) + ' लीटर');
    t = t.replace(/\d[\d,]*(?:\.\d+)?/g, n => numSpeak(n));
    t = t.replace(/₹/g, ' रुपये ').replace(/&/g, ' और ').replace(/[|•·*_#~>]/g, ' ').replace(/\s[-–—]\s/g, ', ');
    t = t.replace(/\s*[।]\s*(?:[।.]\s*)+/g, ' । ').replace(/\s+/g, ' ').trim();
    return t;
  }

  const Voice = (() => {
    let voices = [], chosen = null, queue = [], busy = false, onIdle = null;
    const FEM = /(female|lekha|kalpana|swara|neerja|heera|veena|aditi|priya|raveena|isha|kajal|sangeeta|google\s*(हिन्दी|hindi)|hindi india|\bhi[-_]in[-_]x[-_]hi[ac]\b)/i;
    const MALE = /(^|[^a-z])male\b|hemant|ravi\b|prabhat|rishi|kabir|aarav|madhur|\bhi[-_]in[-_]x[-_]hi[de]\b/i;
    function score(v) {
      let s = 0; const nm = (v.name || '') + ' ' + (v.voiceURI || '');
      if (/^hi/i.test(v.lang)) s += 6; else if (/^en[-_]in/i.test(v.lang)) s += 2; else return -99;
      if (FEM.test(nm)) s += 4; if (MALE.test(nm) && !/female/i.test(nm)) s -= 8; if (v.localService) s += 1; return s;
    }
    function load() {
      if (!window.speechSynthesis) return;
      voices = (speechSynthesis.getVoices() || []).filter(v => score(v) > -50).sort((a, b) => score(b) - score(a));
      chosen = voices.find(v => v.voiceURI === MEM.voice || v.name === MEM.voice) || voices[0] || null;
    }
    if (window.speechSynthesis) { load(); try { speechSynthesis.addEventListener('voiceschanged', load); } catch (e) { speechSynthesis.onvoiceschanged = load; } }
    function chunks(text) {
      const sents = (text.match(/[^।.?!]+[।.?!]*/g) || [text]).map(s => s.trim()).filter(Boolean);
      const out = [];
      sents.forEach(s => {
        if (s.length <= 150) return out.push(s);
        let cur = '';
        s.split(/(?<=,|;|:)\s*/).forEach(p => { if ((cur + ' ' + p).length > 150 && cur) { out.push(cur.trim()); cur = p; } else cur += ' ' + p; });
        if (cur.trim()) out.push(cur.trim());
      });
      return out;
    }
    function next() {
      if (!queue.length) { busy = false; if (onIdle) { const f = onIdle; onIdle = null; f(); } return; }
      busy = true;
      const u = new SpeechSynthesisUtterance(queue.shift());
      u.lang = (chosen && chosen.lang) || 'hi-IN';
      if (chosen) u.voice = chosen;
      u.rate = 0.92; u.pitch = 1.1; u.volume = 1;
      u.onend = next; u.onerror = next;
      speechSynthesis.speak(u);
    }
    return {
      list: () => voices, current: () => chosen,
      say(html, cb) {
        if (!MEM.tts || !window.speechSynthesis) { if (cb) cb(); return; }
        this.stop(true); load();
        queue = chunks(speechify(html)); onIdle = cb || null; next();
      },
      stop(silent) { queue = []; if (!silent) onIdle = null; try { speechSynthesis.cancel(); } catch (e) {} busy = false; },
      nextVoice() {
        load(); if (!voices.length) return null;
        const i = Math.max(0, voices.indexOf(chosen));
        chosen = voices[(i + 1) % voices.length]; MEM.voice = chosen.voiceURI || chosen.name; saveMem(); return chosen;
      },
      isBusy: () => busy
    };
  })();

  // ======================================================================
  // 4. INTENT ENGINE (Claude + Custom Entries)
  // ======================================================================
  const INTENTS = {
    SALE: [['sale', 3], ['bikri', 3], ['business', 2], ['kamai', 2], ['collection', 2], ['bika', 2.5], ['turnover', 2], ['sel', 3]],
    STOCK: [['stock', 3], ['tanki', 2.5], ['bacha', 2], ['inventory', 2], ['tank', 1.5], ['kitna tel', 2], ['dip', 1.5]],
    UDHAR: [['udhar', 3], ['baki', 3], ['baaki', 3], ['bakaya', 3], ['outstanding', 2.5], ['pending', 2], ['lena', 2], ['dues', 2], ['balance', 2], ['credit', 1.5]],
    LEDGER: [['ledger', 3.5], ['khata', 3.5], ['hisab', 2.5], ['statement', 2.5], ['account', 1.5]],
    COMPARE: [['compare', 3], ['tulna', 3], ['comparison', 3], ['vs', 2.5], ['versus', 2.5], ['mukabla', 2.5]],
    PEAK: [['peak', 3], ['season', 3], ['sijan', 3], ['sizan', 3], ['seasonal', 3]],
    WA: [['whatsapp', 3], ['watsapp', 3], ['msg', 2], ['message', 2.5], ['bhejo', 2], ['reminder', 3], ['yaad dilao', 3]],
    VEHICLES: [['gaadi', 2.5], ['gadi', 2.5], ['gaadiyan', 2.5], ['vehicle', 2.5], ['vehicles', 2.5], ['truck', 1.5]],
    AVG: [['average', 3], ['avg', 3], ['ausat', 3], ['daily', 1.5]],
    HELP: [['help', 3], ['madad', 3], ['features', 3], ['kya kar', 2], ['kaam', 1]]
  };
  const STOP = new Set('ka ki ke ko se me mein par pe hai h hain ho hua hui hue tha thi the kya kitna kitni kitne kaun kab kis konsa konsi batao bata bataiye dikhao dikha dijiye do de dena kholo khol dekho show open aur and tatha ya or ek is us un wo vo ye yeh mera meri mere hamara hamari tumhara aapka aap tum main mai please plz zara jara ji bhai sahab sir madam na nahi nahin bas sirf abhi aaj aj kal parso pichle pichla last this din dinon hafte hafta mahine mahina month week total sab sabhi sare sari sabse zyada jyada kam wali wala wale party partyon'.split(' '));
  const VOCAB = new Set(); Object.values(INTENTS).forEach(l => l.forEach(([p]) => p.split(' ').forEach(w => VOCAB.add(w))));
  ['petrol', 'diesel', 'jama', 'kharcha', 'kharch', 'cash', 'online', 'upi', 'rupaye', 'rupay', 'rs', 'litre', 'liter', 'ltr', 'entry', 'likho', 'dalo', 'daal', 'darj', 'record', 'add', 'hazar', 'hajar', 'lakh', 'nakad', 'cheque', 'bank', 'galat', 'sahi', 'haan', 'han', 'ha', 'theek', 'thik', 'confirm', 'cancel', 'yaad', 'rakho'].forEach(w => VOCAB.add(w));

  function scoreIntents(toks) {
    const sc = {};
    for (const [name, list] of Object.entries(INTENTS)) {
      let s = 0;
      for (const [phrase, w] of list) {
        const pt = phrase.split(' '); let m = 0;
        for (const p of pt) { let best = 0; for (const t of toks) { const v = tokSim(t, p); if (v > best) best = v; } if (best >= 0.8) m++; }
        if (m === pt.length) s += w; else if (m > 0 && pt.length > 1) s += w * 0.3 * m / pt.length;
      }
      sc[name] = s;
    }
    toks.forEach(t => { const l = MEM.tok[t]; if (l) for (const k in l) sc[k] = (sc[k] || 0) + Math.min(l[k], 4) * 0.8; });
    return sc;
  }
  function learnIntent(toks, intent, w) {
    toks.filter(t => !STOP.has(t) && t.length > 2 && !/^\d/.test(t)).slice(0, 4).forEach(t => {
      MEM.tok[t] = MEM.tok[t] || {}; MEM.tok[t][intent] = (MEM.tok[t][intent] || 0) + (w || 2);
    });
    saveMem();
  }

  // ---------- Tareekh / Avadhi ----------
  const MONTH_RE = /(\d{1,2})\s*(?:th|st|nd|rd)?\s*(jan\w*|far\w*|feb\w*|mar\w*|apr\w*|ap\w*l|mai|may|jun\w*|jul\w*|aga\w*|aug\w*|sit\w*|sep\w*|akt\w*|oct\w*|nav\w*|nov\w*|dis\w*|dec\w*)/;
  const MON = { jan: 1, far: 2, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aga: 8, aug: 8, sit: 9, sep: 9, akt: 10, oct: 10, nav: 11, nov: 11, dis: 12, dec: 12 };
  function parseRange(q, toks) {
    const t = T(); let m;
    const one = (d, label) => ({ from: d, to: d, label, explicit: true, single: true });
    if ((m = q.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/)) && +m[2] <= 12 && +m[1] <= 31) {
      let y = m[3] ? +m[3] : +t.slice(0, 4); if (y < 100) y += 2000;
      let d = `${y}-${pad(+m[2])}-${pad(+m[1])}`; if (!m[3] && d > t) d = `${y - 1}-${pad(+m[2])}-${pad(+m[1])}`;
      return one(d, dmy(d));
    }
    if ((m = q.match(MONTH_RE)) && MON[m[2].slice(0, 3)]) {
      const mo = MON[m[2].slice(0, 3)]; let y = +t.slice(0, 4); let d = `${y}-${pad(mo)}-${pad(+m[1])}`; if (d > t) d = `${y - 1}-${pad(mo)}-${pad(+m[1])}`;
      return one(d, dmy(d));
    }
    const prev = /\b(pich\w*|last|past|guzr\w*|beet\w*)\b/.test(q);
    if ((m = q.match(/(\d{1,3})\s*(?:din|days?|dino)/)) && +m[1] > 0) return { from: addDays(t, -(+m[1]) + 1), to: t, label: `पिछले ${m[1]} दिनों`, explicit: true };
    if (has(toks, 'parso')) return one(addDays(t, -2), 'परसों');
    if (has(toks, 'kal', 'yesterday')) return one(addDays(t, -1), 'कल');
    if (has(toks, 'hafte', 'hafta', 'week', 'saptah')) {
      const dow = (new Date(t + 'T12:00:00').getDay() + 6) % 7, st = addDays(t, -dow);
      return prev ? { from: addDays(st, -7), to: addDays(st, -1), label: 'पिछले हफ़्ते', explicit: true } : { from: st, to: t, label: 'इस हफ़्ते', explicit: true };
    }
    if (has(toks, 'mahine', 'mahina', 'month', 'maas')) {
      const st = t.slice(0, 7) + '-01';
      if (prev) { const e = addDays(st, -1); return { from: e.slice(0, 7) + '-01', to: e, label: 'पिछले महीने', explicit: true }; }
      return { from: st, to: t, label: 'इस महीने', explicit: true };
    }
    if (has(toks, 'aaj', 'aj', 'today')) return one(t, 'आज');
    return { from: t, to: t, label: 'आज', explicit: false, single: true };
  }

  // ---------- Rakam ----------
  const NW = { ek: 1, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, che: 6, chah: 6, saat: 7, aath: 8, nau: 9, das: 10, dus: 10, bees: 20, tees: 30, chalis: 40, pachas: 50, pachaas: 50, dedh: 1.5, dhai: 2.5, do: 2 };
  const UN = { k: 1e3, hajar: 1e3, hazar: 1e3, hazaar: 1e3, hajaar: 1e3, thousand: 1e3, lakh: 1e5, lac: 1e5, lakhs: 1e5, crore: 1e7, karod: 1e7, sau: 100 };
  function parseAmount(q) {
    const t = tokens(q.replace(/[a-z]{2}\s?\d{2}\s?[a-z]{1,3}\s?\d{4}/g, ' '));
    for (let i = 0; i < t.length; i++) {
      const raw = t[i].replace(/,/g, '');
      let m = raw.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/);
      if (m) {
        let v = parseFloat(m[1]); const nx = t[i + 1] || '';
        if (/^(litre|liter|ltr|lit|l|liters|litres)$/.test(nx) || m[2] === 'l' && false) continue;
        if (m[2]) v *= (m[2] === 'k' ? 1e3 : 1e5); else if (UN[nx]) v *= UN[nx];
        if (v > 0) return v;
      } else if (NW[raw] && UN[t[i + 1]]) return NW[raw] * UN[t[i + 1]];
    }
    return 0;
  }
  const fmtAmt = v => money(v);

  // ======================================================================
  // 5. DATA HELPERS
  // ======================================================================
  async function getParties() { try { return (S.parties && S.parties.pub) ? S.parties.pub : await APP.getParties(false, true); } catch (e) { return []; } }
  async function daysBetween(a, b) {
    const snap = await db().collection('days').where('date', '>=', a).where('date', '<=', b).get();
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  }
  function aggregate(rows) {
    const g = { sale: 0, litP: 0, litD: 0, n: 0, best: null, worst: null };
    rows.forEach(r => {
      const s = r.sum || {}; const sale = num(s.sale); if (!sale && !num(s.litP) && !num(s.litD)) return;
      g.sale += sale; g.litP += num(s.litP); g.litD += num(s.litD); g.n++;
      if (!g.best || sale > g.best.sale) g.best = { date: r.date || r.id, sale };
      if (!g.worst || sale < g.worst.sale) g.worst = { date: r.date || r.id, sale };
    });
    return g;
  }
  const pctTxt = (cur, prev, vs) => {
    if (!(prev > 0)) return '';
    const p = Math.round((cur - prev) / prev * 100);
    return p >= 0 ? `📈 ${vs} के मुकाबले <b>${p}% ज़्यादा</b> है।` : `📉 ${vs} के मुकाबले <b>${Math.abs(p)}% कम</b> है।`;
  };

  // ======================================================================
  // 6. PARTY KHOJ (Search Engine)
  // ======================================================================
  function contentToks(toks) { return toks.filter(t => t.length >= 2 && !STOP.has(t) && !VOCAB.has(t) && !/^[\d.,]+$/.test(t) && !MON[t.slice(0, 3)]); }
  function findParties(q, toks, parties) {
    const compact = q.replace(/\s+/g, '');
    const plate = compact.match(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/);
    const four = !/\b(jama|kharch|rupa|rs|hazar|hajar|lakh|litre|ltr)/.test(q) && (q.match(/\b\d{4}\b/) || [])[0];
    const key = plate ? plate[0].toUpperCase() : four;
    if (key) {
      const hit = parties.filter(p => (p.vehicles || []).some(v => String(v).toUpperCase().replace(/\s+/g, '').includes(key)));
      if (hit.length) return { list: hit, byVehicle: key, sure: hit.length === 1 };
    }
    for (const t of toks) { if (MEM.alias[t]) { const p = parties.find(x => x.name === MEM.alias[t]); if (p) return { list: [p], sure: true }; } }
    const ct = contentToks(toks); if (!ct.length) return { list: [] };
    const scored = [];
    parties.forEach(p => {
      const nt = tokens(norm(p.name)); let s = 0, hit = 0, ex = 0;
      ct.forEach(qt => {
        let best = 0; nt.forEach(pt => { best = Math.max(best, tokSim(qt, pt)); });
        if (best >= 0.8) { s += best * Math.min(qt.length, 6); hit++; if (best === 1) ex++; }
      });
      if (hit) scored.push({ p, s, hit, ex });
    });
    if (!scored.length) return { list: [] };
    scored.sort((a, b) => b.s - a.s);
    const a = scored[0], b = scored[1];
    const sure = !b || (a.ex > 0 && b.ex === 0) || a.s >= b.s * 1.4;
    return { list: scored.slice(0, 4).map(x => x.p), sure, tokens: ct };
  }

  // ======================================================================
  // 7. KNOWLEDGE BASE & PIVOT (Smart Answers)
  // ======================================================================
  const KB = [
    { k: ['octane', 'ron'], a: 'ऑक्टेन रेटिंग बताती है कि पेट्रोल इंजन में बिना खटखट के कितना दबाव झेल सकता है। भारत में सामान्य पेट्रोल का RON आमतौर पर करीब 91 और प्रीमियम पेट्रोल का 95 या उससे ऊपर होता है।' },
    { k: ['cetane'], a: 'सीटेन नंबर डीज़ल के जलने की गुणवत्ता बताता है। BS-VI डीज़ल में यह कम से कम 51 होना चाहिए।' },
    { k: ['density', 'ghanatv'], a: 'घनत्व 15 डिग्री सेल्सियस पर नापा जाता है। पेट्रोल का घनत्व लगभग 720 से 775 और डीज़ल का लगभग 820 से 860 किलो प्रति घन मीटर के बीच होना चाहिए।' },
    { k: ['suraksha', 'safety', 'aag', 'fire'], a: 'पंप पर धूम्रपान बंद रखें, गाड़ी का इंजन बंद कराएँ, अग्निशामक यंत्र और रेत की बाल्टियाँ तैयार रखें।' }
  ];
  function kbLookup(toks) {
    let best = null, bs = 0;
    KB.forEach(e => { let s = 0; e.k.forEach(k => { if (toks.some(t => tokSim(t, k) >= 0.85)) s++; }); if (s > bs) { bs = s; best = e; } });
    return best;
  }
  const TOPICS = [
    ['weather', ['mausam', 'barish', 'baarish', 'garmi', 'sardi', 'thand', 'dhup', 'kohra', 'weather', 'rain', 'toofan']],
    ['sports', ['cricket', 'match', 'ipl', 'kohli', 'football', 'khel', 'score']],
    ['politics', ['chunav', 'sarkar', 'neta', 'modi', 'election', 'vote', 'mantri']],
    ['news', ['khabar', 'news', 'samachar']],
    ['market', ['sona', 'gold', 'share', 'sensex', 'nifty', 'bitcoin', 'dollar', 'chandi']],
    ['food', ['khana', 'recipe', 'chai', 'nashta', 'biryani']],
    ['health', ['bukhar', 'dard', 'dawai', 'doctor', 'tabiyat', 'sehat']],
    ['travel', ['ghumne', 'trip', 'yatra', 'hotel', 'flight', 'train', 'ticket']],
    ['fun', ['film', 'movie', 'gana', 'song', 'serial', 'joke', 'chutkula', 'shayari']],
    ['festival', ['diwali', 'holi', 'dussehra', 'eid', 'shaadi', 'shadi', 'tyohar', 'mela', 'navratri']],
    ['study', ['padhai', 'exam', 'result', 'school', 'college']]
  ];
  function topicOf(toks) { for (const [n, ws] of TOPICS) if (toks.some(t => ws.some(w => tokSim(t, w) >= 0.85))) return n; return null; }

  // ======================================================================
  // 8. CONTEXT & REPLY HELPERS
  // ======================================================================
  const ctx = { lastParty: null, lastIntent: null, lastQ: '', lastToks: [], pending: null, teaching: null };
  const R = (html, o) => Object.assign({ html }, o || {});
  const yesW = ['haan', 'han', 'ha', 'hanji', 'yes', 'ok', 'okay', 'theek', 'thik', 'sahi', 'confirm', 'kardo', 'kar', 'dijiye', 'darj', 'pakka', 'bilkul'];
  const noW = ['nahi', 'nahin', 'no', 'cancel', 'ruko', 'rehne', 'mat', 'radd', 'band', 'chhodo', 'chodo'];

  // ======================================================================
  // 9. HANDLERS (Data Fetching & Formatting)
  // ======================================================================
  async function hSale(a, ui) {
    const r = a.range; const rows = await daysBetween(r.from, r.to); const g = aggregate(rows);
    if (!g.n) return R(`${r.label} का हिसाब अभी दर्ज नहीं हुआ है।`);
    const len = daysDiff(r.from, r.to) + 1; const pg = aggregate(await daysBetween(addDays(r.from, -len), addDays(r.from, -1)));
    const vs = r.single ? (r.label === 'कल' ? 'उससे पिछले दिन' : 'पिछले दिन') : 'पिछली अवधि';
    const fuel = a.fuel;
    let lines = `<b>${r.label} की कुल बिक्री: ${money(g.sale)}</b>`;
    if (!fuel || fuel === 'petrol') lines += `<br>⛽ पेट्रोल: ${lit(g.litP)}`;
    if (!fuel || fuel === 'diesel') lines += `<br>🛢️ डीज़ल: ${lit(g.litD)}`;
    if (!r.single) lines += `<br>📆 औसत रोज़ की बिक्री: ${money(g.sale / g.n)} (${g.n} दिन)`;
    const ins = pctTxt(g.sale, pg.sale, vs); if (ins) lines += '<br>' + ins;
    const chips = [];
    if (r.single && rows[0]) chips.push({ label: '🖨️ रिपोर्ट', onClick: () => { ui.close(); APP.shareCompactDayReport({ date: r.from, d: rows[0], rows: [] }); } });
    if (r.label === 'आज') chips.push({ label: '📊 कल की सेल', onClick: () => ui.ask('kal ki sale') });
    chips.push({ label: '📆 इस महीने', onClick: () => ui.ask('is mahine ki sale') });
    return R(lines, { chips });
  }

  async function hStock(a) {
    const snap = await db().collection('days').orderBy('date', 'desc').limit(1).get();
    if (snap.empty) return R('अभी स्टॉक का डेटा नहीं मिला।');
    const s = snap.docs[0].data().sum || {}, dt = snap.docs[0].data().date;
    const rec = await daysBetween(addDays(T(), -7), T()); const g = aggregate(rec);
    const one = (isP) => {
      const v = isP ? (s.actStockP !== undefined ? s.actStockP : s.expStockP) : (s.actStockD !== undefined ? s.actStockD : s.expStockD);
      const stock = num(v), avg = g.n ? (isP ? g.litP : g.litD) / g.n : 0;
      let t = `<b>${isP ? 'पेट्रोल' : 'डीज़ल'} का स्टॉक: ${lit(stock)}</b>`;
      if (avg > 0) { const d = stock / avg; t += `<br>रोज़ करीब ${lit(avg)} बिकता है, यानी ${d < 1 ? '<b>एक दिन से भी कम</b>' : 'लगभग <b>' + Math.floor(d) + ' दिन</b>'} चलेगा।`; if (d < 3) t += `<br>⚠️ स्टॉक जल्दी खत्म होगा, टैंकर मंगवा लीजिए।`; else t += '<br>✅ अभी चिंता की बात नहीं है।'; }
      else if (stock < 1500) t += '<br>⚠️ स्टॉक कम है, टैंकर मंगवा लीजिए।';
      return t;
    };
    const parts = a.fuel ? [one(a.fuel === 'petrol')] : [one(true), one(false)];
    return R(parts.join('<br><br>') + `<br><br>(${dmy(dt)} के हिसाब से)`);
  }

  async function hUdhar(a, ui) {
    const ps = await getParties(); const due = ps.filter(p => num(p.bal) > 0).sort((x, y) => num(y.bal) - num(x.bal));
    if (!due.length) return R('🎉 किसी पार्टी पर कोई उधार बाकी नहीं है!');
    const tot = due.reduce((s, p) => s + num(p.bal), 0);
    return R(`<b>कुल बाज़ार उधार: ${money(tot)}</b><br>${due.length} पार्टियों पर बकाया है।<br>सबसे ज़्यादा: ${esc(due[0].name)} (${money(due[0].bal)})`,
      { chips: [{ label: '🏆 टॉप 5 पार्टियाँ', onClick: () => ui.ask('sabse zyada udhar kiska') }] });
  }

  async function hTopDebt(a, ui) {
    const ps = await getParties(); const due = ps.filter(p => num(p.bal) > 0).sort((x, y) => num(y.bal) - num(x.bal)).slice(0, 5);
    if (!due.length) return R('🎉 किसी पार्टी पर बकाया नहीं है!');
    const html = '<b>सबसे ज़्यादा बकाया वाली पार्टियाँ:</b><br>' + due.map((p, i) => `${i + 1}. ${esc(p.name)} — ${money(p.bal)}`).join('<br>');
    const say = 'सबसे ज़्यादा बकाया वाली पार्टियाँ ये हैं। ' + due.slice(0, 3).map((p, i) => `${['पहली', 'दूसरी', 'तीसरी'][i]} ${p.name}, ${money(p.bal)}`).join('। ');
    return R(html, { say, chips: due.slice(0, 3).map(p => ({ label: p.name, onClick: () => { ctx.lastParty = p; ui.partyMenu(p); } })) });
  }

  async function hBestWorst(a, worst) {
    const r = a.range.explicit ? a.range : { from: addDays(T(), -90), to: T(), label: 'पिछले 90 दिनों' };
    const g = aggregate(await daysBetween(r.from, r.to)); if (!g.n) return R('इस अवधि का डेटा नहीं मिला।');
    const x = worst ? g.worst : g.best;
    return R(`<b>${r.label} में ${worst ? 'सबसे कम' : 'सबसे ज़्यादा'} बिक्री ${dmy(x.date)} को हुई: ${money(x.sale)}</b>`);
  }

  async function hAvg(a) {
    const r = a.range.explicit ? a.range : { from: addDays(T(), -29), to: T(), label: 'पिछले 30 दिनों' };
    const g = aggregate(await daysBetween(r.from, r.to)); if (!g.n) return R('इस अवधि का डेटा नहीं मिला।');
    return R(`<b>${r.label} में रोज़ की औसत बिक्री: ${money(g.sale / g.n)}</b><br>पेट्रोल औसत ${lit(g.litP / g.n)} और डीज़ल औसत ${lit(g.litD / g.n)} रोज़।`);
  }

  async function hCompare(a, toks) {
    const t = T(); let A, B, la, lb;
    if (has(toks, 'mahine', 'mahina', 'month')) { A = { from: t.slice(0, 7) + '-01', to: t }; const e = addDays(A.from, -1); B = { from: e.slice(0, 7) + '-01', to: e }; la = 'इस महीने'; lb = 'पिछले महीने'; }
    else if (has(toks, 'hafte', 'hafta', 'week')) { const dow = (new Date(t + 'T12:00:00').getDay() + 6) % 7, st = addDays(t, -dow); A = { from: st, to: t }; B = { from: addDays(st, -7), to: addDays(st, -1) }; la = 'इस हफ़्ते'; lb = 'पिछले हफ़्ते'; }
    else { A = { from: t, to: t }; B = { from: addDays(t, -1), to: addDays(t, -1) }; la = 'आज'; lb = 'कल'; }
    const ga = aggregate(await daysBetween(A.from, A.to)), gb = aggregate(await daysBetween(B.from, B.to));
    if (!ga.n && !gb.n) return R('तुलना के लिए डेटा नहीं मिला।');
    return R(`<b>${la}:</b> ${money(ga.sale)}<br><b>${lb}:</b> ${money(gb.sale)}<br>${pctTxt(ga.sale, gb.sale, lb) || 'तुलना के लिए पिछला डेटा नहीं है।'}`);
  }

  async function hPeak() {
    const snap = await db().collection('days').get(); const months = {};
    snap.docs.forEach(d => { const x = d.data(); if (x.sum && x.sum.sale && x.date) { const m = x.date.slice(0, 7); months[m] = (months[m] || 0) + num(x.sum.sale); } });
    const k = Object.keys(months).sort((a, b) => months[b] - months[a]); if (!k.length) return R('अभी इतना डेटा नहीं है।');
    const nm = m => new Date(m + '-01T12:00:00').toLocaleString('hi-IN', { month: 'long', year: 'numeric' });
    return R(`<b>आपका पीक सीज़न: ${nm(k[0])}</b> — बिक्री ${money(months[k[0]])}।` + (k[1] ? `<br>उसके बाद ${nm(k[1])} (${money(months[k[1]])})` : '') + (k[2] ? ` और ${nm(k[2])} (${money(months[k[2]])}) रहे।` : ''));
  }

  async function hVehicles(p, plateInfo) {
    if (plateInfo && plateInfo.byVehicle) return R(`गाड़ी <b>${esc(plateInfo.byVehicle)}</b> पार्टी <b>${esc(p.name)}</b> की है।`);
    const v = p.vehicles && p.vehicles.length ? p.vehicles.map(esc).join(', ') : 'कोई गाड़ी दर्ज नहीं है';
    return R(`<b>${esc(p.name)}</b> की गाड़ियाँ: ${v}`);
  }

  function partyMenuReply(p, ui) {
    const veh = p.vehicles && p.vehicles.length ? p.vehicles.map(esc).join(', ') : 'कोई गाड़ी नहीं';
    return R(`पार्टी: <b>${esc(p.name)}</b><br>गाड़ियाँ: ${veh}<br>बकाया: <b>${money(p.bal)}</b><br>आप क्या करना चाहेंगे?`, {
      say: `पार्टी ${p.name}। बकाया ${money(p.bal)} है। आप क्या करना चाहेंगे?`,
      chips: [
        { label: '📒 खाता खोलें', onClick: () => { ui.close(); APP.partyView(p.id, false); } },
        { label: '💬 WhatsApp याद दिलाएँ', onClick: () => ui.ask('whatsapp reminder ' + p.name) },
        { label: '💵 जमा दर्ज करें', onClick: () => ui.ask('jama ' + p.name) }
      ]
    });
  }

  function waReply(p) {
    const ph = String(p.phone || '').replace(/\D/g, ''); const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
    if (!wa) return R(`${esc(p.name)} का फ़ोन नंबर दर्ज नहीं है, इसलिए संदेश नहीं भेज सकती।`);
    const msg = `नमस्ते ${p.name} जी, माज़दा ऑयल कंपनी पर आपका ₹${p.bal} बकाया है। कृपया भुगतान कर दें। धन्यवाद!`;
    ctx.pending = { kind: 'WA', url: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, name: p.name };
    return R(`${esc(p.name)} को बकाया <b>${money(p.bal)}</b> का WhatsApp संदेश खोलना है।<br>क्या खोल दूँ?`, {
      say: `${p.name} को बकाया ${money(p.bal)} का WhatsApp संदेश खोलना है। क्या खोल दूँ?`,
      chips: [{ label: '✅ हाँ, खोलो', onClick: (ui) => ui.ask('haan') }, { label: '❌ रहने दो', onClick: (ui) => ui.ask('nahi') }]
    });
  }

  // ---------- ENTRY (jama / kharcha) ----------
  const MODE = [[['online', 'upi', 'gpay', 'phonepe', 'paytm', 'bank', 'neft', 'rtgs'], 'ऑनलाइन / बैंक'], [['cheque', 'check'], 'चेक'], [['cash', 'nakad', 'nagad', 'cash'], 'नकद']];
  function entryText(e) {
    const dt = dmy(e.date);
    return e.type === 'JAMA'
      ? { html: `<b>जमा एंट्री</b><br>पार्टी: <b>${esc(e.party.name)}</b><br>रकम: <b>${fmtAmt(e.amount)}</b><br>तरीका: ${e.mode}<br>तारीख़: ${dt}${e.note ? '<br>नोट: ' + esc(e.note) : ''}`, say: `मैं ${e.party.name} के खाते में ${fmtAmt(e.amount)} ${e.mode} जमा दर्ज करने जा रही हूँ। क्या मैं दर्ज कर दूँ?` }
      : { html: `<b>खर्चा एंट्री</b><br>रकम: <b>${fmtAmt(e.amount)}</b><br>विवरण: ${esc(e.note || 'सामान्य खर्चा')}<br>तरीका: ${e.mode}<br>तारीख़: ${dt}`, say: `मैं ${fmtAmt(e.amount)} का खर्चा, ${e.note || 'सामान्य खर्चा'}, दर्ज करने जा रही हूँ। क्या मैं दर्ज कर दूँ?` };
  }
  function askConfirm(e) {
    ctx.pending = { kind: 'ENTRY', e, await: 'confirm' };
    const t = entryText(e);
    return R(t.html + '<br><br>क्या दर्ज कर दूँ?', {
      say: t.say, chips: [{ label: '✅ हाँ, दर्ज करो', onClick: (ui) => ui.ask('haan') }, { label: '✏️ रकम बदलो', onClick: (ui) => { ctx.pending.await = 'amount'; ui.bot(R('नई रकम बताइए।')); } }, { label: '❌ रद्द', onClick: (ui) => ui.ask('cancel') }]
    });
  }
  async function startEntry(type, q, toks, parties, ui) {
    const e = { type, amount: parseAmount(q), mode: 'नकद', date: T(), party: null, note: '' };
    MODE.forEach(([ws, nm]) => { if (toks.some(t => ws.includes(t))) e.mode = nm; });
    if (type === 'JAMA') {
      const f = findParties(q.replace(/\b\d{4}\b/g, ' '), toks, parties);
      if (f.list.length === 1 || f.sure) e.party = f.list[0];
      else if (f.list.length > 1) { ctx.pending = { kind: 'ENTRY', e, await: 'party' }; return R('किस पार्टी की जमा दर्ज करनी है?', { chips: f.list.map(p => ({ label: p.name, onClick: (u) => { e.party = p; ctx.lastParty = p; u.bot(continueEntry(e, u)); } })) }); }
      else if (ctx.lastParty && /\b(uski|unki|isi|usi|wahi)\b/.test(q)) e.party = ctx.lastParty;
    } else {
      e.note = contentToks(toks).filter(t => !MODE.some(([ws]) => ws.includes(t))).join(' ');
    }
    return continueEntry(e, ui);
  }
  function continueEntry(e, ui) {
    if (e.type === 'JAMA' && !e.party) { ctx.pending = { kind: 'ENTRY', e, await: 'party' }; return R('किस पार्टी की जमा दर्ज करनी है? नाम या गाड़ी नंबर बताइए।'); }
    if (!e.amount) { ctx.pending = { kind: 'ENTRY', e, await: 'amount' }; return R(e.type === 'JAMA' ? `<b>${esc(e.party.name)}</b> की कितनी रकम जमा हुई?` : 'खर्चा कितने रुपये का है?'); }
    return askConfirm(e);
  }

  // 🔥 NAYA: UDHAR (LEDGER) ENTRY aur METER ENTRY
  async function startSpecialEntry(type, q, toks, parties, ui) {
    const e = { type, amount: parseAmount(q), date: T(), party: null, vehicle: '', fuel: '', litre: 0, nozzle: '', reading: '' };
    const f = findParties(q, toks, parties);
    if (f.list.length === 1 || f.sure) e.party = f.list[0];
    
    // Fuel detect
    if (has(toks, 'diesel', 'hsd')) e.fuel = 'diesel';
    if (has(toks, 'petrol', 'ms')) e.fuel = 'petrol';
    
    // Vehicle detect
    const vMatch = q.match(/[a-z]{2}\d{2}[a-z]{1,3}\d{4}/i);
    if (vMatch) e.vehicle = vMatch[0].toUpperCase();
    else if (f.byVehicle) e.vehicle = f.byVehicle;

    // Nozzle detect
    const nMatch = q.match(/\b(p[1-4]|d[1-4]|नोजल\s*\d|nozzle\s*\d)\b/i);
    if (nMatch) e.nozzle = nMatch[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Reading detect
    if (type === 'METER') {
      const numMatch = q.match(/\b\d+(\.\d+)?\b/);
      if (numMatch) e.reading = numMatch[0];
    }

    ctx.pending = { kind: 'SPECIAL_ENTRY', e, await: 'confirm' };
    
    let html = `<b>${type === 'UDHAR' ? 'उधार एंट्री' : 'मीटर रीडिंग'}</b><br>`;
    let say = '';
    if (type === 'UDHAR') {
      if (!e.party) { ctx.pending.await = 'party'; return R('किस पार्टी का उधार दर्ज करना है? नाम या गाड़ी बताइए।'); }
      html += `पार्टी: <b>${esc(e.party.name)}</b><br>गाड़ी: ${esc(e.vehicle || '-')}<br>ईंधन: ${esc(e.fuel || '-')}<br>रकम: <b>${money(e.amount)}</b><br>`;
      say = `${e.party.name} की गाड़ी ${e.vehicle || ''} में ${money(e.amount)} का ${e.fuel} उधार दर्ज कर रही हूँ। क्या यह सही है?`;
    } else {
      html += `नोज़ल: <b>${esc(e.nozzle.toUpperCase() || '?')}</b><br>नई रीडिंग: <b>${esc(e.reading || '?')}</b><br>`;
      say = `नोज़ल ${e.nozzle} की नई रीडिंग ${e.reading} दर्ज कर रही हूँ। सही है?`;
    }
    html += '<br>क्या दर्ज कर दूँ?';
    
    return R(html, {
      say, chips: [{ label: '✅ हाँ', onClick: (ui) => ui.ask('haan') }, { label: '❌ रद्द', onClick: (ui) => ui.ask('cancel') }]
    });
  }

  async function commitSpecialEntry(e) {
    if (e.type === 'UDHAR') {
      if (!e.party) throw new Error('पार्टी नहीं चुनी गई');
      const ref = db().collection('ledger').doc();
      const b = db().batch();
      b.set(ref, {
        partyId: e.party.id, partyName: e.party.name, date: e.date, time: APP.nowTime ? APP.nowTime() : new Date().toTimeString().slice(0, 5),
        kind: 'udhar', amount: e.amount, vehicle: e.vehicle, fuel: e.fuel, rate: 0, litre: 0, note: 'Assistant entry',
        by: S.user ? S.user.email : 'assistant', at: APP.FV.serverTimestamp()
      });
      b.update(db().collection('parties').doc(e.party.id), { bal: APP.FV.increment(e.amount) });
      await b.commit();
      S.parties.pub = null;
      return R(`✅ <b>${esc(e.party.name)}</b> का ₹${e.amount} उधार दर्ज हो गया।`, { say: 'उधार दर्ज हो गया।' });
    }
    if (e.type === 'METER') {
      if (!e.nozzle || !e.reading) throw new Error('नोज़ल या रीडिंग गायब है');
      const dayRef = db().collection('days').doc(e.date);
      await dayRef.set({ [`nz.${e.nozzle}.c`]: Number(e.reading) }, { merge: true });
      return R(`✅ नोज़ल <b>${e.nozzle.toUpperCase()}</b> की रीडिंग <b>${e.reading}</b> सेव हो गई।`, { say: 'मीटर रीडिंग सेव हो गई।' });
    }
  }

  async function commitEntry(e) {
    const key = [e.type, e.party && e.party.id, e.amount, e.mode, e.date].join('|');
    if (ctx.lastCommit && ctx.lastCommit.key === key && Date.now() - ctx.lastCommit.t < 90000) return { dup: true };
    const ad = (window.MAZDA_ASSISTANT_ADAPTERS || {})[e.type];
    let mode = 'pending';
    if (typeof ad === 'function') { await ad(e, APP); mode = 'live'; }
    else {
      const FV = window.firebase && firebase.firestore && firebase.firestore.FieldValue;
      await db().collection('assistant_entries').add({
        type: e.type, amount: e.amount, mode: e.mode, note: e.note || '', date: e.date,
        partyId: e.party ? e.party.id : null, partyName: e.party ? e.party.name : null,
        status: 'pending', by: (S.user && S.user.email) || '', createdAt: FV ? FV.serverTimestamp() : new Date().toISOString(), via: 'assistant'
      });
    }
    ctx.lastCommit = { key, t: Date.now() };
    return { mode };
  }

  async function continuePending(raw, q, toks, ui) {
    const p = ctx.pending; if (!p) return null;
    const isNo = has(toks, ...noW) && toks.length <= 5, isYes = has(toks, ...yesW) && toks.length <= 5 && !isNo;
    if (isNo) { ctx.pending = null; return R('ठीक है, रद्द कर दिया। कुछ और चाहिए तो बताइए।'); }
    
    if (p.kind === 'WA') {
      if (isYes) { window.open(p.url, '_blank'); ctx.pending = null; return R(`✅ ${esc(p.name)} के लिए WhatsApp खोल दिया है।`); }
      ctx.pending = null; return null;
    }

    if (p.kind === 'SPECIAL_ENTRY') {
      const e = p.e;
      if (p.await === 'party') {
        const f = findParties(q, toks, await getParties());
        if (f.list.length && (f.sure || f.list.length === 1)) { e.party = f.list[0]; ctx.lastParty = e.party; return startSpecialEntry(e.type, raw + ' ' + e.party.name, toks, await getParties(), ui); }
        if (f.list.length) return R('इनमें से कौन सी पार्टी?', { chips: f.list.map(x => ({ label: x.name, onClick: (u) => { e.party = x; ctx.lastParty = x; u.bot(continueEntry(e, u)); } })) });
        return R('यह पार्टी नहीं मिली। कृपया पूरा नाम बताइए, या "रद्द" कहिए।');
      }
      if (p.await === 'confirm') {
        if (isYes) {
          try {
            ctx.pending = null;
            return await commitSpecialEntry(e);
          } catch (err) { ctx.pending = null; return R('❌ एंट्री सेव नहीं हो पाई: ' + esc(err.message)); }
        }
      }
    }

    if (p.kind === 'ENTRY') {
      const e = p.e;
      if (p.await === 'party') {
        const f = findParties(q, toks, await getParties());
        if (f.list.length && (f.sure || f.list.length === 1)) { e.party = f.list[0]; ctx.lastParty = e.party; return continueEntry(e, ui); }
        if (f.list.length) return R('इनमें से कौन सी पार्टी?', { chips: f.list.map(x => ({ label: x.name, onClick: (u) => { e.party = x; ctx.lastParty = x; u.bot(continueEntry(e, u)); } })) });
        return R('यह पार्टी नहीं मिली। कृपया पूरा नाम या गाड़ी नंबर बताइए, या "रद्द" कहिए।');
      }
      if (p.await === 'amount') {
        const amt = parseAmount(q); if (amt) { e.amount = amt; return askConfirm(e); }
        return R('रकम समझ नहीं आई। कृपया अंकों में बताइए, जैसे 5000 या 5 हज़ार।');
      }
      if (p.await === 'confirm') {
        const amt0 = parseAmount(q); if (amt0 && amt0 !== e.amount) { e.amount = amt0; return askConfirm(e); }
        if (isYes) {
          try {
            const r = await commitEntry(e); ctx.pending = null;
            if (r.dup) return R('यही एंट्री अभी-अभी हो चुकी है, इसलिए दोबारा नहीं की।');
            const what = e.type === 'JAMA' ? `${esc(e.party.name)} की ${fmtAmt(e.amount)} जमा` : `${fmtAmt(e.amount)} का खर्चा`;
            return r.mode === 'live' ? R(`✅ ${what} दर्ज हो गई।`) : R(`✅ ${what} मैंने <b>असिस्टेंट एंट्री</b> में सुरक्षित कर ली है।<br>ध्यान रहे: यह अभी मुख्य हिसाब में नहीं जुड़ी है, मालिक या मैनेजर इसे जाँचकर जोड़ेंगे।`);
          } catch (err) { ctx.pending = null; return R('❌ एंट्री सेव नहीं हो पाई: ' + esc(err.message)); }
        }
        const amt = parseAmount(q); if (amt) { e.amount = amt; return askConfirm(e); }
        return R('कृपया "हाँ" कहकर पक्का कीजिए, या "रद्द" कहिए।');
      }
    }
    ctx.pending = null; return null;
  }

  // ---------- Small Talk ----------
  function smallTalk(q, toks, raw) {
    const hr = new Date().getHours(); const wish = hr < 4 ? 'नमस्कार' : hr < 12 ? 'सुप्रभात' : hr < 17 ? 'नमस्कार' : 'शुभ संध्या';
    if (/^(hi|hello|hey|namaste|namaskar|ram ram|salam|good (morning|evening|afternoon)|suprabhat)\b/.test(q) || (toks.length <= 2 && has(toks, 'namaste', 'hello', 'namaskar', 'pranam')))
      return R(`${wish}! मैं माज़दा असिस्टेंट हूँ। पंप का कोई भी हिसाब पूछिए, जैसे आज की बिक्री, स्टॉक, किसी पार्टी का बकाया, या मीटर रीडिंग/गाड़ी एंट्री करनी हो।`);
    if (/(kaise ho|kese ho|how are you|kaisi ho|kya haal)/.test(q)) return R('मैं बिल्कुल ठीक हूँ, धन्यवाद! बताइए, आज पंप का कौन सा हिसाब देखना है?');
    if (/(tum|aap|tu)\s+kaun|tumhara naam|aapka naam|who are you/.test(q)) return R('मैं माज़दा ऑयल कंपनी की असिस्टेंट हूँ। मैं आपके पंप का डेटा देखकर बिक्री, स्टॉक, उधार और खाते के जवाब देती हूँ, और पूछकर एंट्री भी दर्ज करती हूँ।');
    if (/(thank|shukriya|dhanyawad|dhanyavad|thanks)/.test(q)) return R('आपका स्वागत है! और कुछ चाहिए तो बेझिझक पूछिए।');
    if (/^(bye|alvida|phir milte|good night|shubh ratri)/.test(q)) return R('ठीक है, फिर मिलते हैं। अपना ख़याल रखिए!');
    if (/(time kya|kitne baje|samay kya|abhi kya time|what.?s the time)/.test(q)) return R(`अभी समय है <b>${new Date().toLocaleTimeString('hi-IN', { hour: 'numeric', minute: '2-digit' })}</b>।`);
    if (/(aaj.*(tarikh|date|din kaun|konsa din|kaunsa din|weekday)|kaun sa din|today.?s date|tarikh kya)/.test(q)) return R(`आज <b>${new Date().toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b> है।`);
    return null;
  }
  function calcReply(rawLow) {
    let s = rawLow.replace(/,/g, '').replace(/₹/g, '');
    let m = s.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter|ltr|l)\b.*?(?:rate|bhav|bhaav|@|x|\*|ka)\s*(?:rs\.?)?\s*(\d+(?:\.\d+)?)/);
    if (m) { const v = +m[1] * +m[2]; return R(`<b>${m[1]} लीटर × ₹${m[2]} = ${money(v)}</b>`); }
    m = s.match(/(\d+(?:\.\d+)?)\s*(?:ka|ke|ki|of)\s*(\d+(?:\.\d+)?)\s*(?:%|percent|persent|pratishat|pratisat)/);
    if (m) { const v = +m[1] * +m[2] / 100; return R(`<b>${m[1]} का ${m[2]}% = ${+v.toFixed(2)}</b>`); }
    m = s.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|persent|pratishat)\s*(?:of|ka|ke)\s*(\d+(?:\.\d+)?)/);
    if (m) { const v = +m[1] * +m[2] / 100; return R(`<b>${m[2]} का ${m[1]}% = ${+v.toFixed(2)}</b>`); }
    s = dev2lat(s).replace(/\b(plus|jod|jodo|joda|add)\b/g, '+').replace(/\b(minus|ghata|ghatao|ghatana)\b/g, '-').replace(/\b(guna|gunaa|into|multiply|times)\b/g, '*').replace(/\b(bhag|divide|divided by)\b/g, '/').replace(/(\d)\s*x\s*(\d)/g, '$1*$2');
    const ex = s.replace(/[^0-9+\-*\/().\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/\d/.test(ex) && /\d\s*[+\-*\/]\s*\(?\d/.test(ex) && /^[0-9+\-*\/().\s]+$/.test(ex) && ex.length < 80) {
      try { const v = Function('"use strict";return(' + ex + ')')(); if (isFinite(v)) return R(`<b>${esc(ex)} = ${+v.toFixed(4)}</b>`); } catch (e) {}
    }
    return null;
  }

  // ======================================================================
  // 10. MUKHYA DIMAAG
  // ======================================================================
  async function respond(raw, ui) {
    const rawLow = String(raw).toLowerCase(); const q = norm(raw); const toks = tokens(q);
    if (!toks.length) return R('कृपया कुछ लिखिए या बोलिए।');
    const parties = await getParties();

    if (ctx.pending) { const r = await continuePending(raw, q, toks, ui); if (r) return r; }

    if (ctx.teaching) {
      const t = ctx.teaching; ctx.teaching = null;
      const sc = scoreIntents(toks), top = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2.5) { learnIntent(t.toks, top[0], 3); const r = await respond(t.raw, ui); r.html = '🙏 समझ गई, अब ऐसे सवाल का यही मतलब मानूँगी।<br><br>' + r.html; return r; }
      MEM.facts.push({ q: t.toks.join(' '), a: raw.trim(), t: Date.now() }); MEM.facts = MEM.facts.slice(-200); saveMem();
      return R('धन्यवाद, मैंने यह सीख लिया।');
    }
    if (/\b(galat|wrong|sahi nahi|ye nahi|yeh nahi|nahi ye)\b/.test(q) && ctx.lastQ && toks.length <= 5) {
      ctx.teaching = { raw: ctx.lastQ, toks: ctx.lastToks };
      return R('माफ़ कीजिए! सही जवाब या सही मतलब बताइए, मैं सीख लूँगी।');
    }

    let m = q.match(/^(?:yaad rakho|yad rakho|sikho|seekho|remember)\s*(?:ki|that|:)?\s+(.+)$/);
    if (m) {
      MEM.facts.push({ q: m[1], a: raw.replace(/^[^]*?(?:rakho|sikho|seekho|remember)\s*(?:ki|that|:|,)?\s*/i, '').trim() || m[1], t: Date.now() }); MEM.facts = MEM.facts.slice(-200); saveMem();
      return R('ठीक है, यह बात मैंने याद कर ली।');
    }

    if (toks.length <= 2 && has(toks, ...yesW, ...noW) && !ctx.pending) return R('जी, फ़िलहाल मेरे पास कोई काम बाकी नहीं है। बताइए, आगे क्या देखना है?');
    
    const st = smallTalk(q, toks, raw); if (st) return st;
    if (/\d/.test(rawLow) && !/(jama|kharch|udhar|stock|ledger)/.test(q)) { const c = calcReply(rawLow); if (c) return c; }

    const parts = raw.split(/\s+(?:aur|and|tatha|और|तथा|\+)\s+/i).filter(x => x.trim());
    if (parts.length > 1 && parts.length <= 4 && !ctx.pending) {
      const subs = [];
      for (const p of parts) { const ptoks = tokens(norm(p)); const sc = scoreIntents(ptoks); if (Math.max(...Object.values(sc)) >= 2.5 || findParties(norm(p), ptoks, parties).list.length) subs.push(p); else { subs.length = 0; break; } }
      if (subs.length > 1) {
        let html = '', say = '', chips = [];
        for (let i = 0; i < subs.length; i++) { const r = await single(subs[i], ui, true); if (r) { html += `<b>${i + 1}.</b> ${r.html}<br><br>`; say += r.html + ' । '; if (r.chips) chips = r.chips; } }
        return R(html, { say, chips });
      }
    }
    return await single(raw, ui, false);
  }

  async function single(raw, ui, inMulti) {
    const q = norm(raw), toks = tokens(q); const parties = await getParties();
    ctx.lastQ = raw; ctx.lastToks = toks;
    const sc = scoreIntents(toks);
    let ranked = Object.entries(sc).sort((a, b) => b[1] - a[1]); let intent = ranked[0][1] >= 2 ? ranked[0][0] : null;
    const range = parseRange(q, toks);
    const fuel = has(toks, 'petrol', 'patrol', 'ms') ? 'petrol' : has(toks, 'diesel', 'dijal', 'dizal', 'hsd', 'dijel', 'deezal') ? 'diesel' : null;

    // 🔥 ENTRY DETECTION (Jama, Kharcha, Udhari, Meter)
    const kJama = has(toks, 'jama', 'received', 'mila', 'payment', 'mile'), kKh = has(toks, 'kharcha', 'kharch', 'expense', 'kharche');
    const kUdhari = has(toks, 'udhar', 'udhari') && !has(toks, 'baaki', 'kul', 'total');
    const kMeter = has(toks, 'meter', 'nozzle', 'reading', 'riding') || (toks.some(t => /^(p[1-4]|d[1-4])$/.test(t)));
    
    const amt = parseAmount(q), verb = has(toks, 'likho', 'dalo', 'daal', 'entry', 'darj', 'record', 'add', 'karo', 'kardo', 'dijiye') || /kar do/.test(q), qw = has(toks, 'kitna', 'kitni', 'kab', 'kaun', 'kya', 'batao', 'bataiye');
    
    if (kJama && (verb || (amt && !qw))) return await startEntry('JAMA', q, toks, parties, ui);
    if (kKh && (verb || (amt && !qw))) return await startEntry('KHARCHA', q, toks, parties, ui);
    if (kUdhari && (verb || (amt && !qw))) return await startSpecialEntry('UDHAR', q, toks, parties, ui);
    if (kMeter && (verb || amt > 0)) return await startSpecialEntry('METER', q, toks, parties, ui);

    // Party / Gaadi
    const f = findParties(q, toks, parties);
    let party = null;
    if (f.list.length && (f.sure || f.list.length === 1)) party = f.list[0];
    else if (f.list.length > 1 && !(intent && ['SALE', 'STOCK', 'PEAK', 'AVG', 'COMPARE', 'HELP'].includes(intent))) {
      ui.bot(R(f.byVehicle ? `नंबर <b>${esc(f.byVehicle)}</b> पर कई पार्टियाँ मिलीं। कौन सी?` : 'किस पार्टी की बात है?'));
      ui.chips(f.list.slice(0, 4).map(p => ({ label: `${p.name}${p.vehicles && p.vehicles[0] ? ' (' + p.vehicles[0] + ')' : ''}`, onClick: () => { MEM.alias[f.tokens && f.tokens[0] || toks[0]] = p.name; saveMem(); ctx.lastParty = p; ui.ask(raw + ' ' + p.name); } })));
      return null;
    }
    const pronoun = /\b(uska|uski|unka|unki|iska|iski|usko|isko|wahi|vahi|same)\b/.test(q);
    if (!party && pronoun && ctx.lastParty) party = ctx.lastParty;

    if (!intent && !party && range.explicit && ctx.lastIntent && ['SALE', 'STOCK', 'AVG'].includes(ctx.lastIntent)) intent = ctx.lastIntent;
    if (sc.COMPARE >= 2.5) intent = 'COMPARE'; else if (sc.AVG >= 2.5 && !party) intent = 'AVG';
    if (intent === 'SALE' && sup && !range.single) intent = 'BESTDAY'; else if (intent === 'SALE' && sup && has(toks, 'din', 'day')) intent = 'BESTDAY';
    if (intent === 'SALE' && low && has(toks, 'din', 'day')) intent = 'WORSTDAY';
    if (intent === 'SALE' && sup && has(toks, 'mahina', 'mahine', 'month')) intent = 'PEAK';
    if ((intent === 'UDHAR' || (!intent && sc.UDHAR > 0)) && sup && !party) intent = 'TOPDEBT';
    if (intent === 'UDHAR' && party) intent = 'PARTYBAL';
    if (intent === 'LEDGER' && !party) intent = null;
    if (intent === 'WA' && !party) intent = null;
    if (intent === 'VEHICLES' && !party) intent = null;

    if (party) {
      ctx.lastParty = party;
      if (intent === 'LEDGER') { setTimeout(() => { ui.close(); APP.partyView(party.id, false); }, 1300); return R(`⏳ <b>${esc(party.name)}</b> का खाता खोल रही हूँ...`, { say: `${party.name} का खाता खोल रही हूँ।` }); }
      if (intent === 'WA') return waReply(party);
      if (intent === 'VEHICLES') return await hVehicles(party, f);
      if (f.byVehicle && !intent) return await hVehicles(party, f);
      if (intent === 'PARTYBAL') return R(`<b>${esc(party.name)}</b> का बकाया: <b>${money(party.bal)}</b>`, { chips: partyMenuReply(party, ui).chips });
      return partyMenuReply(party, ui);
    }

    if (intent) {
      ctx.lastIntent = intent; MEM.freq[intent] = (MEM.freq[intent] || 0) + 1; saveMem();
      const a = { range, fuel };
      switch (intent) {
        case 'SALE': return await hSale(a, ui);
        case 'STOCK': return await hStock(a);
        case 'UDHAR': return await hUdhar(a, ui);
        case 'TOPDEBT': return await hTopDebt(a, ui);
        case 'BESTDAY': return await hBestWorst(a, false);
        case 'WORSTDAY': return await hBestWorst(a, true);
        case 'AVG': return await hAvg(a);
        case 'COMPARE': return await hCompare(a, toks);
        case 'PEAK': return await hPeak();
        case 'HELP': return helpReply(ui);
      }
    }

    const kb = kbLookup(toks); if (kb) return R(kb.a);
    const ct = contentToks(toks);
    let bestF = null, bfs = 0;
    MEM.facts.forEach(x => {
      if (!ct.length) return; const ft = tokens(norm(x.q + ' ' + x.a)).filter(w => w.length > 2);
      const hit = ct.filter(w => ft.some(f => tokSim(w, f) >= 0.85)).length; const s = hit / ct.length;
      if (hit >= Math.min(2, ct.length) && s > bfs) { bfs = s; bestF = x; }
    });
    if (bestF && bfs >= 0.6) return R(`आपने मुझे बताया था: ${esc(bestF.a)}`);

    const topic = topicOf(toks);
    if (inMulti) return null;
    return await pivot(topic, raw, toks, ranked, ui);
  }

  function helpReply(ui) {
    return R('मैं ये सब कर सकती हूँ:<br>• आज/कल/हफ़्ते/महीने की बिक्री, औसत, सबसे अच्छा दिन, तुलना<br>• पेट्रोल-डीज़ल का स्टॉक और कितने दिन चलेगा<br>• कुल उधार, सबसे ज़्यादा बकाया वाली पार्टियाँ, किसी पार्टी या गाड़ी नंबर का हिसाब<br>• पार्टी का खाता खोलना, WhatsApp याद दिलाना<br>• जमा, खर्चा, मीटर रीडिंग और गाड़ी उधार की एंट्री (पहले पूछकर)<br>• जोड़-घटाव, प्रतिशत, लीटर × रेट का बिल<br>• पंप से जुड़ी आम जानकारी, और जो आप सिखाएँ वो भी याद रखना',
      { say: 'मैं बिक्री, स्टॉक, उधार और पार्टी का हिसाब बता सकती हूँ, खाता खोल सकती हूँ, WhatsApp याद दिला सकती हूँ, और पूछकर जमा, खर्चा, मीटर और उधार की एंट्री भी दर्ज कर सकती हूँ। जोड़-घटाव और प्रतिशत भी निकाल देती हूँ।', chips: suggestChips(ui) });
  }
  function suggestChips(ui) {
    const base = { SALE: ['📊 आज की सेल', 'aaj ki sale'], STOCK: ['⛽ स्टॉक', 'stock kitna hai'], UDHAR: ['💰 कुल उधार', 'kul udhar'], TOPDEBT: ['🏆 टॉप बकाया', 'sabse zyada udhar kiska'], PEAK: ['📅 पीक सीज़न', 'peak season'], AVG: ['📈 औसत सेल', 'average sale'] };
    const used = Object.keys(MEM.freq).filter(k => base[k]).sort((a, b) => MEM.freq[b] - MEM.freq[a]);
    const order = used.concat(Object.keys(base).filter(k => !used.includes(k))).slice(0, 4);
    return order.map(k => ({ label: base[k][0], onClick: () => ui.ask(base[k][1]) }));
  }
  async function pivot(topic, raw, toks, ranked, ui) {
    MEM.unknown.push({ q: raw, t: Date.now() }); MEM.unknown = MEM.unknown.slice(-60); saveMem();
    let today = 0, yest = 0;
    try { const ag = aggregate(await daysBetween(addDays(T(), -1), T())); const rows = await daysBetween(T(), T()); today = aggregate(rows).sale; yest = ag.sale - today; } catch (e) {}
    const base = 'यह मेरे पंप के डेटा से बाहर का सवाल है, इसलिए मैं इसका पक्का जवाब नहीं दे सकती और अंदाज़े से कुछ नहीं कहूँगी।';
    const bridge = {
      weather: `मौसम का असर पंप की बिक्री पर पड़ता है, ख़ासकर बारिश या कोहरे में। ${today ? `आज अब तक की बिक्री <b>${money(today)}</b> है${yest > 0 ? `, कल <b>${money(yest)}</b> थी` : ''}।` : ''} चाहें तो पिछले हफ़्ते से तुलना दिखा दूँ?`,
      sports: `बड़े मैच वाले दिन ग्राहक कम-ज़्यादा हो सकते हैं। ${today ? `आज की बिक्री अभी <b>${money(today)}</b> है।` : ''} चाहें तो आज और कल की तुलना देख लें?`,
      politics: `चुनाव और बंद के दिनों का असर बिक्री पर पड़ता है। इसे आपके पंप के असली आँकड़ों से देखना हो तो मैं पिछले महीनों की तुलना दिखा सकती हूँ।`,
      news: 'ताज़ा ख़बरों तक मेरी पहुँच नहीं है। हाँ, पंप की आज की ख़बर मैं बता सकती हूँ: बिक्री, स्टॉक और उधार।',
      market: 'बाज़ार के भाव मेरे पास लाइव नहीं हैं। पंप का अपना हिसाब मैं देख सकती हूँ, जैसे कुल उधार और बकाया पार्टियाँ।',
      festival: 'त्योहार और शादी के मौसम में बिक्री बदलती है। मैं आपके डेटा से बता सकती हूँ कि आपका पीक सीज़न कौन सा रहा है।',
      food: 'खाने-पीने की सलाह मेरे दायरे में नहीं है, पर पंप के हिसाब में जो चाहिए वह मैं झट से निकाल दूँगी।',
      health: 'सेहत के बारे में मैं सलाह नहीं दे सकती। कृपया डॉक्टर से मिलें। पंप के हिसाब में मदद चाहिए तो बताइए।',
      travel: 'सफ़र की जानकारी मेरे पास नहीं है। अगर आप पार्टी की गाड़ियों के बारे में पूछ रही हैं तो गाड़ी नंबर बताइए।',
      fun: 'मनोरंजन में मैं ज़्यादा काम की नहीं हूँ, पर आज की बिक्री का अच्छा समाचार ज़रूर सुना सकती हूँ।',
      study: 'पढ़ाई के सवाल मेरे दायरे से बाहर हैं। पंप का हिसाब पूछना हो तो मैं तैयार हूँ।'
    };
    const guess = ranked.filter(([, s]) => s >= 0.8).slice(0, 3);
    const LBL = { SALE: '📊 बिक्री', STOCK: '⛽ स्टॉक', UDHAR: '💰 उधार', LEDGER: '📒 खाता', COMPARE: '⚖️ तुलना', PEAK: '📅 पीक सीज़न', WA: '💬 WhatsApp', VEHICLES: '🚗 गाड़ियाँ', AVG: '📈 औसत', HELP: '❓ मदद' };
    const QRY = { SALE: 'aaj ki sale', STOCK: 'stock', UDHAR: 'kul udhar', LEDGER: 'ledger', COMPARE: 'compare', PEAK: 'peak season', WA: 'reminder', VEHICLES: 'gaadi', AVG: 'average sale', HELP: 'help' };
    let chips = guess.filter(([k]) => LBL[k]).map(([k]) => ({ label: LBL[k] + '?', onClick: () => { learnIntent(toks, k); ui.ask(QRY[k]); } }));
    if (!chips.length) chips = suggestChips(ui);
    const body = topic ? bridge[topic] : `${base}<br>${guess.length ? 'क्या आपका मतलब इनमें से कुछ है?' : 'आप चाहें तो ये देख लीजिए:'}<br><small>सही जवाब सिखाने के लिए "yaad rakho ..." लिखिए।</small>`;
    return R(topic ? `${base}<br>${body}` : body, { say: (topic ? base + ' ' + body : `${base} आप चाहें तो नीचे दिए विकल्पों में से चुन सकती हैं।`), chips });
  }

  // ======================================================================
  // 11. UI & FAB
  // ======================================================================
  function injectFAB() {
    if (document.getElementById('ai-assist-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-assist-fab'; fab.innerHTML = '🎤'; fab.setAttribute('aria-label', 'माज़दा असिस्टेंट');
    fab.style.cssText = 'position:fixed;bottom:80px;right:16px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0b3d91,#1a5fd0);color:#fff;font-size:26px;border:2px solid #f4b41a;box-shadow:0 4px 15px rgba(11,61,145,0.4);z-index:9999;cursor:pointer;display:flex;align-items:center;justify-content:center;';
    fab.onclick = () => openAssistant();
    document.body.appendChild(fab);
  }
  window.addEventListener('load', () => setTimeout(injectFAB, 1500));

  function openAssistant() {
    if (document.getElementById('assist-modal')) return;
    const m = document.createElement('div'); m.id = 'assist-modal'; m.busy = false;
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.85);backdrop-filter:blur(4px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    m.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:16px 16px 20px;max-height:88vh;display:flex;flex-direction:column;animation:aSlide .3s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:6px;">
          <h3 style="margin:0;color:#0b3d91;font-size:17px;">🤖 माज़दा असिस्टेंट</h3>
          <div style="display:flex;gap:4px;align-items:center;">
            <button id="a-tts" title="आवाज़ चालू/बंद" style="background:none;border:none;font-size:19px;cursor:pointer;">🔊</button>
            <button id="a-voice" title="दूसरी आवाज़" style="background:none;border:none;font-size:19px;cursor:pointer;">🗣️</button>
            <button id="a-close" style="background:none;border:none;font-size:20px;cursor:pointer;">❌</button>
          </div>
        </div>
        <div id="a-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:12px;padding:12px;margin-bottom:10px;min-height:150px;max-height:44vh;font-size:14px;display:flex;flex-direction:column;gap:8px;"></div>
        <div id="a-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:34px;"></div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="a-input" placeholder="यहाँ टाइप करें या 🎤 दबाकर बोलें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px;min-width:0;">
          <button id="a-mic" style="width:50px;height:50px;border-radius:50%;background:#f4b41a;border:none;font-size:22px;cursor:pointer;">🎤</button>
          <button id="a-send" style="width:50px;height:50px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:20px;cursor:pointer;">➤</button>
        </div>
      </div>
      <style>@keyframes aSlide{from{transform:translateY(100%)}to{transform:translateY(0)}}
      .a-chip{background:#fff;border:1px solid #0b3d91;border-radius:20px;padding:8px 14px;font-size:13px;color:#0b3d91;cursor:pointer;font-family:inherit;font-weight:600;box-shadow:0 2px 5px rgba(0,0,0,.1)}
      .a-chip:active{background:#e8eefc}</style>`;
    document.body.appendChild(m);
    const $ = s => m.querySelector(s);
    const chat = $('#a-chat'), input = $('#a-input'), chipBox = $('#a-chips'), mic = $('#a-mic');
    let rec = null;

    const bubble = (html, user) => {
      const d = document.createElement('div');
      d.style.cssText = 'padding:10px 14px;border-radius:12px;max-width:88%;line-height:1.5;word-break:break-word;' + (user ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:4px;' : 'background:#fff;border:1px solid #e6ebf5;align-self:flex-start;color:#333;border-bottom-left-radius:4px;');
      d.innerHTML = html; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
    };
    const setChips = list => {
      chipBox.innerHTML = '';
      (list || []).forEach(c => { const b = document.createElement('button'); b.className = 'a-chip'; b.textContent = c.label; b.onclick = () => c.onClick(ui); chipBox.appendChild(b); });
    };
    const afterSpeak = () => { if (MEM.hands && document.getElementById('assist-modal')) setTimeout(listen, 350); };
    
    const ui = {
      close: () => { Voice.stop(); try { rec && rec.abort(); } catch (e) {} m.remove(); },
      ask: t => processInput(t),
      chips: setChips,
      partyMenu: p => ui.bot(partyMenuReply(p, ui)),
      bot: r => {
        if (!r) return; if (typeof r.then === 'function') return r.then(ui.bot);
        bubble(r.html); setChips(r.chips); Voice.say(r.say || r.html, afterSpeak);
      }
    };

    const refreshBtns = () => { $('#a-tts').textContent = MEM.tts ? '🔊' : '🔇'; };
    $('#a-close').onclick = ui.close;
    $('#a-tts').onclick = () => { MEM.tts = !MEM.tts; saveMem(); if (!MEM.tts) Voice.stop(); refreshBtns(); };
    $('#a-voice').onclick = () => {
      const v = Voice.nextVoice();
      if (!v) return toast('इस फ़ोन में कोई हिंदी आवाज़ नहीं मिली।');
      Voice.say('नमस्ते, मैं माज़दा असिस्टेंट हूँ। अब मैं इस आवाज़ में बोलूँगी।'); toast('आवाज़: ' + v.name);
    };
    refreshBtns();

    async function processInput(text) {
      if (!text || !text.trim() || m.busy) return; m.busy = true; setChips([]); Voice.stop();
      bubble(esc(text), true); input.value = '';
      const load = bubble('<span style="color:#666;font-size:12px">⚡ सोच रही हूँ...</span>');
      try { const r = await respond(text, ui); load.remove(); if (r) ui.bot(r); }
      catch (e) { load.remove(); ui.bot(R('❌ माफ़ कीजिए, कुछ गड़बड़ हो गई: ' + esc(e.message))); }
      finally { m.busy = false; }
    }
    $('#a-send').onclick = () => processInput(input.value);
    input.onkeypress = e => { if (e.key === 'Enter') processInput(input.value); };

    function listen() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में आवाज़ सपोर्ट नहीं है');
      if (m.busy || Voice.isBusy()) return;
      try { rec && rec.abort(); } catch (e) {}
      rec = new SR(); rec.lang = 'hi-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
      const off = () => { mic.style.background = '#f4b41a'; input.placeholder = 'यहाँ टाइप करें या 🎤 दबाकर बोलें...'; };
      mic.style.background = '#c62828'; input.placeholder = 'सुन रही हूँ...';
      let finalText = '';
      rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t; } input.value = t; };
      rec.onerror = off;
      rec.onend = () => { off(); if (finalText) processInput(finalText); };
      try { rec.start(); } catch (e) { off(); }
    }
    mic.onclick = () => { Voice.stop(); listen(); };

    const hr = new Date().getHours(); const wish = hr < 4 ? 'नमस्कार' : hr < 12 ? 'सुप्रभात' : hr < 17 ? 'नमस्कार' : 'शुभ संध्या';
    ui.bot(R(`${wish}! मैं माज़दा असिस्टेंट हूँ। पंप का कुछ भी पूछिए: बिक्री, स्टॉक, उधार, मीटर रीडिंग, या कोई एंट्री दर्ज करवानी हो तो बताइए।`, { chips: suggestChips(ui) }));
  }

  // ======================================================================
  // 12. EXPORT
  // ======================================================================
  window.MazdaAssistant = {
    open: openAssistant,
    exportLearning: () => JSON.stringify({ alias: MEM.alias, facts: MEM.facts, unknown: MEM.unknown, freq: MEM.freq }, null, 2),
    resetLearning: () => { const k = { voice: MEM.voice, tts: MEM.tts }; MEM = Object.assign(defMem(), k); saveMem(); },
    _t: { respond, norm, tokens, phon, tokSim, hiNum, speechify, parseRange, parseAmount, scoreIntents, calcReply, findParties, dev2lat }
  };
  console.log('[Mazda assistant.js v3] Ultimate Maha-Code Loaded ✓');
})();
