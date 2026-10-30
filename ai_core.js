/* Mazda Oil Company - AI Core
   एक ही जगह से सारा Gemini काम: कई keys (limit खत्म हो तो अगली key),
   model अपने आप ढूँढना, और 🔑 Key manager. */
(function () {
  'use strict';
  const APP = window.APP = window.APP || {};

  const KEYS_LS = 'mazda_gemini_keys';      // JSON array
  const OLD_LS = 'mazda_gemini_key';        // पुराना single key (compat)
  const PTR_LS = 'mazda_gemini_ptr';        // अगली बार कौन सी key से शुरू करना है
  const MODELS_LS = 'mazda_ai_models';      // {t, list}
  const MODELS_TTL = 12 * 3600 * 1000;
  const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/';

  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- KEYS ---------------- */
  function saveKeys(arr) {
    const clean = Array.from(new Set((arr || []).map(k => String(k).trim()).filter(Boolean)));
    lsSet(KEYS_LS, clean.length ? JSON.stringify(clean) : '');
    lsSet(OLD_LS, clean[0] || '');
    return clean;
  }
  function getKeys() {
    let arr = [];
    try { arr = JSON.parse(lsGet(KEYS_LS) || '[]'); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    const old = lsGet(OLD_LS).trim();
    if (old && !arr.includes(old)) { arr.push(old); arr = saveKeys(arr); }
    return arr.filter(Boolean);
  }
  const hasKey = () => getKeys().length > 0;
  const mask = k => k.length > 12 ? k.slice(0, 6) + '••••' + k.slice(-4) : '••••';

  const cool = {}; // key -> कब तक आराम (ms timestamp), सिर्फ memory में

  /* ---------------- MODELS ---------------- */
  async function discover(key) {
    const r = await fetch(BASE + 'models?pageSize=200&key=' + encodeURIComponent(key));
    if (!r.ok) { const e = new Error('HTTP ' + r.status + ' (list models)'); e.status = r.status; throw e; }
    const j = await r.json();
    const all = (j.models || [])
      .filter(x => (x.supportedGenerationMethods || []).includes('generateContent'))
      .map(x => x.name.replace(/^models\//, ''));
    const ver = n => { const m = /^gemini-(\d+(?:\.\d+)?)-flash/.exec(n); return m ? parseFloat(m[1]) : 0; };
    const flash = all.filter(n => ver(n) > 0 && !/image|tts|live|audio|embed|thinking|robotics|computer|exp|8b/.test(n));
    // पहले stable, फिर lite, फिर preview; हर group में नया version पहले
    const rank = n => (/preview/.test(n) ? 0 : /lite/.test(n) ? 1 : 2);
    flash.sort((a, b) => rank(b) - rank(a) || ver(b) - ver(a));
    const out = flash.slice(0, 4);
    if (all.includes('gemini-flash-latest') && !out.includes('gemini-flash-latest')) out.push('gemini-flash-latest');
    return out;
  }
  function cachedModels() {
    try {
      const j = JSON.parse(lsGet(MODELS_LS) || 'null');
      if (j && Array.isArray(j.list) && j.list.length && Date.now() - j.t < MODELS_TTL) return j.list;
    } catch (e) { }
    return null;
  }
  const saveModels = list => lsSet(MODELS_LS, JSON.stringify({ t: Date.now(), list }));
  async function getModels(key) {
    const c = cachedModels();
    if (c) return c;
    try {
      const l = await discover(key);
      if (l.length) { saveModels(l); return l; }
    } catch (e) { /* fallback */ }
    return FALLBACK_MODELS.slice();
  }
  function dropModel(model) {
    const c = cachedModels();
    if (!c) return;
    const l = c.filter(m => m !== model);
    if (l.length) saveModels(l); else lsSet(MODELS_LS, '');
  }
  function promoteModel(model) {
    const c = cachedModels();
    if (!c || c[0] === model || !c.includes(model)) return;
    saveModels([model].concat(c.filter(m => m !== model)));
  }

  /* ---------------- एक call ---------------- */
  async function call(key, model, payload, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(BASE + 'models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: ctl.signal
      });
      let j = {};
      try { j = await r.json(); } catch (x) { }
      if (!r.ok) {
        const e = new Error((j.error && j.error.message) || ('HTTP ' + r.status));
        e.status = r.status; throw e;
      }
      const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const txt = parts.map(p => p.text || '').join('').trim();
      if (!txt) { const e = new Error('AI ने खाली जवाब दिया'); e.status = 204; throw e; }
      return txt;
    } catch (e) {
      if (e.name === 'AbortError') { e.message = 'नेट slow है (Timeout)'; e.status = 408; }
      else if (!e.status) { e.network = true; }
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ---------------- मुख्य: ask ----------------
     payload = Gemini का normal payload. text वापस देता है.
     limit/गड़बड़ पर अपने आप दूसरा model, फिर अगली key. */
  async function ask(payload, opts) {
    opts = opts || {};
    const ms = opts.timeout || 25000;
    const keys = getKeys();
    if (!keys.length) { const e = new Error('पहले 🔑 Gemini key डालें'); e.code = 'NOKEY'; throw e; }

    const now = Date.now();
    const start = (parseInt(lsGet(PTR_LS), 10) || 0) % keys.length;
    let order = keys.map((k, i) => ({ k, i })); 
    order = order.slice(start).concat(order.slice(0, start));
    // आराम कर रही keys सबसे आख़िर में
    order = order.filter(o => !((cool[o.k] || 0) > now)).concat(order.filter(o => (cool[o.k] || 0) > now));

    let models = await getModels(order[0].k);
    let lastErr = null, attempts = 0, hit429 = false;
    const MAX = Math.max(6, Math.min(10, keys.length * 3));

    for (const o of order) {
      let keyLimited = false, keyBad = false, tried = 0;
      for (const model of models.slice(0, 3)) {
        if (attempts >= MAX) break;
        attempts++; tried++;
        try {
          const txt = await call(o.k, model, payload, ms);
          lsSet(PTR_LS, String((o.i + 1) % keys.length));   // अगली बार अगली key (load बँटेगा)
          promoteModel(model);
          return txt;
        } catch (e) {
          lastErr = e;
          const s = e.status, msg = e.message || '';
          if (s === 429) { keyLimited = true; hit429 = true; continue; }          // दूसरा model आज़माओ
          if (s === 401 || s === 403 || (s === 400 && /API key|API_KEY/i.test(msg))) { keyBad = true; break; }
          if (s === 404 || (s === 400 && /model/i.test(msg))) { dropModel(model); continue; }
          if (s === 400) throw e;                           // payload ही गलत है, सब पर वही होगा
          continue;                                         // 5xx / timeout / network
        }
      }
      if (keyBad) cool[o.k] = Date.now() + 3600e3;
      else if (keyLimited && tried) cool[o.k] = Date.now() + (/day|daily/i.test((lastErr && lastErr.message) || '') ? 3600e3 : 60e3);
      if (attempts >= MAX) break;
      if (!cachedModels()) models = await getModels(o.k);  // model हटे तो फिर ढूँढो
    }

    let msg;
    if (hit429) msg = 'सभी keys की free limit अभी खत्म है। थोड़ी देर बाद करें या एक और key जोड़ें (🔑)';
    else if (lastErr && lastErr.status === 408) msg = 'नेट slow है, दोबारा कोशिश करें';
    else if (lastErr && lastErr.network) msg = 'नेट / VPN की दिक्कत — AI तक नहीं पहुँचा';
    else if (lastErr && (lastErr.status === 401 || lastErr.status === 403)) msg = 'Key गलत या बंद है — 🔑 में नई key डालें';
    else msg = (lastErr && lastErr.message) || 'AI connect नहीं हो पाया';
    const err = new Error(msg); err.cause = lastErr; throw err;
  }

  /* JSON जवाब चाहिए तो: सीधा object वापस */
  async function askJSON(payload, opts) {
    const p = Object.assign({}, payload);
    p.generationConfig = Object.assign({ temperature: 0, responseMimeType: 'application/json' }, p.generationConfig || {});
    const txt = await ask(p, opts);
    const t = txt.replace(/```json/gi, '').replace(/```/g, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('AI ने JSON format में जवाब नहीं दिया');
    return JSON.parse(t.slice(a, b + 1));
  }

  /* ---------------- 🔑 Key manager ---------------- */
  async function testKey(k) {
    try {
      const models = await getModels(k);
      await call(k, models[0], { contents: [{ parts: [{ text: 'Reply with: ok' }] }], generationConfig: { temperature: 0 } }, 15000);
      return { ok: true, txt: '✅ चल रही है' };
    } catch (e) {
      if (e.status === 429) return { ok: true, txt: '⏳ चालू, पर अभी limit' };
      if (e.status === 400 || e.status === 401 || e.status === 403) return { ok: false, txt: '❌ गलत / बंद key' };
      return { ok: false, txt: '⚠️ ' + (e.message || 'नहीं चली').slice(0, 40) };
    }
  }

  function manageKeys(onDone) {
    if (!APP.modal) { alert('Key manager अभी तैयार नहीं'); return; }
    const m = APP.modal(`
      <h3>🔑 Gemini Keys</h3>
      <p class="mut" style="margin:2px 0 8px;font-size:12px">एक key की limit खत्म हो तो app अपने आप अगली key चलाएगा। अलग-अलग Google account की keys डालें (aistudio.google.com/app/apikey)।</p>
      <div id="ak-list"></div>
      <label style="margin-top:8px">नई key paste करें (कई हों तो हर line में एक)</label>
      <textarea id="ak-new" rows="3" style="width:100%;font-size:13px" placeholder="AIza..."></textarea>
      <div class="btns" style="margin-top:10px">
        <button class="btn g" id="ak-add">➕ जोड़ें</button>
        <button class="btn w" id="ak-test">🧪 सब जाँचें</button>
        <button class="btn w" id="ak-close">बंद</button>
      </div>`);
    const q = s => m.querySelector(s);
    const status = {};
    function render() {
      const keys = getKeys();
      q('#ak-list').innerHTML = keys.length ? keys.map((k, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e3e7f0">
          <div style="flex:1;font-size:13px"><b>Key ${i + 1}</b> <span class="mut" style="font-family:monospace">${esc(mask(k))}</span>
            <div style="font-size:12px">${esc(status[k] || '')}</div></div>
          <button class="btn sm w" data-del="${i}">🗑</button>
        </div>`).join('') : '<div class="mut" style="padding:8px 0">अभी कोई key नहीं है</div>';
      m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        const arr = getKeys(); arr.splice(+b.dataset.del, 1); saveKeys(arr); render();
      });
    }
    render();
    q('#ak-add').onclick = () => {
      const incoming = q('#ak-new').value.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
      if (!incoming.length) return APP.toast && APP.toast('key paste करें');
      const bad = incoming.filter(k => !/^AIza[\w-]{30,}$/.test(k));
      const arr = getKeys();
      let added = 0;
      incoming.forEach(k => { if (!arr.includes(k)) { arr.push(k); added++; } });
      saveKeys(arr);
      lsSet(MODELS_LS, '');   // नई key से model list फिर बने
      q('#ak-new').value = '';
      render();
      APP.toast && APP.toast(added + ' key जुड़ी' + (bad.length ? ' (⚠️ ' + bad.length + ' का format अजीब है)' : ''));
    };
    q('#ak-test').onclick = async () => {
      const btn = q('#ak-test'); btn.disabled = true; btn.textContent = '⏳ जाँच रहा…';
      const keys = getKeys();
      keys.forEach(k => status[k] = '⏳ …'); render();
      await Promise.all(keys.map(async k => { status[k] = (await testKey(k)).txt; render(); }));
      btn.disabled = false; btn.textContent = '🧪 सब जाँचें';
    };
    q('#ak-close').onclick = () => { m.close(); if (onDone) onDone(hasKey()); };
    return m;
  }

  /* key नहीं हो तो manager खोलो; true = key है */
  function ensureKey(onDone) {
    if (hasKey()) return true;
    manageKeys(onDone);
    return false;
  }

  APP.AI = { ask, askJSON, getKeys, saveKeys, hasKey, manageKeys, ensureKey };
  console.log('[Mazda ai_core.js] ready ✓ keys:', getKeys().length);
})();
