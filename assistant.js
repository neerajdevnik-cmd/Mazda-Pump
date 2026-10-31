/* Mazda Oil Company - Ultimate Cognitive AI Assistant (v9.5 - Voice & Hindi Word Fix Edition)
   Fixes from Live Screenshots:
   1. Hindi Number Words in Dates ("चार तारीख की सेल", "पाँच तारीख की सेल", "दस दिन पुराना")
   2. Voice Typos ("उधर" -> "उधार", "ush din" -> "us din", "miter" -> "meter")
   3. Specific Nozzle Query on Sticky Date ("Ush din p1 miter kitna tha" -> Shows P1 opening/closing/sale)
   4. Daily Fuel Rate Query on Sticky Date ("Us din ka rate kya tha" -> Shows Petrol & Diesel Rate of that date)
   5. Partial Button Name Matching ("पार्टी के पोर्टल कोड" -> Matches "🔑 पोर्टल कोड / भेजें")
   6. Visible "v9.5 Live" Header Badge to instantly confirm update!
*/
(function () {
  'use strict';

  const APP = (window.APP = window.APP || {});
  const S = APP.S || {};
  const esc = APP.esc || (s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const n = APP.num || (v => Number(v) || 0);
  const r0 = v => Math.round(n(v));
  const M = APP.money || (v => '₹' + Math.round(n(v)).toLocaleString('en-IN'));
  const L = APP.lit || (v => Number(n(v).toFixed(2)).toLocaleString('en-IN') + ' L');
  const toast = APP.toast || (msg => console.log('[Mazda AI]:', msg));
  const dbx = () => (APP.db ? (typeof APP.db === 'function' ? APP.db() : APP.db) : null);

  const pad = v => String(v).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => (APP.todayISO ? APP.todayISO() : iso(new Date()));
  const shift = (s, days) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + days); return iso(d); };
  const monthStart = s => s.slice(0, 8) + '01';
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const wdOf = s => new Date(s + 'T12:00:00').getDay();
  const dmy = s => { if (!s || s.length < 10) return s || ''; const [y, m, d] = s.split('-'); return `${Number(d)} ${MON[Number(m) - 1]} ${y}`; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const WD = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const MON = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
  const PERSON = { owner: 'शशांक बंसल', maker: 'नीरज देव' };

  function safeRecalc() {
    try {
      if (typeof APP.recalc === 'function' && document.getElementById('nzwarn')) APP.recalc();
    } catch (e) {}
  }

  /* ================= 1. APP KNOWLEDGE BASE (APP.KB - 31 Screens & Buttons) ================= */
  (function initKB() {
    const TABS = {
      owner: 'हिसाब, खाते, गाड़ी कैश, स्टॉक, मैनेजर डेस्क, निजी, और',
      manager: 'हिसाब, खाते, गाड़ी कैश, स्टॉक, मैनेजर डेस्क, निजी, और',
      salesman: 'मेरा हिसाब, उधार एंट्री, बाहर',
      viewer: 'होम, पार्टी, पैसा, वर्कर, बाहर'
    };
    const SCR = [
      ['day', '🧾 हिसाब (रोज़ का हिसाब)', 'नीचे पहला tab "हिसाब"',
        'एक तारीख का पूरा हिसाब: रेट, पेट्रोल और डीज़ल मीटर रीडिंग (P1-P4, D1-D4 की ओपनिंग और क्लोजिंग), टेस्टिंग, स्टॉक और डिप, पार्टी उधार या जमा, पेटीएम और स्वाइप, खर्चे और कैश क्लोजिंग।',
        [['💾 सेव', 'अभी तक भरा हिसाब सेव करता है (ऐप खुद भी ऑटो-सेव करता है)'],
         ['✅ जमा करें (लॉक)', 'दिन का हिसाब सबमिट करके लॉक कर देता है; लॉक के बाद मैनेजर बदलाव नहीं कर सकता'],
         ['🔓 अनलॉक', 'लॉक किया हुआ दिन दोबारा खोलता है (सिर्फ़ मालिक)'],
         ['📤 कॉम्पैक्ट रिपोर्ट', 'दिन की छोटी समरी रिपोर्ट बनाकर WhatsApp पर भेजने या कॉपी करने के लिए'],
         ['📥 शिफ्ट से भरें', 'सेल्समैन की शिफ्ट या रनशीट से मीटर और हिसाब इस दिन में अपने-आप भर देता है'],
         ['📷 AI रजिस्टर स्कैन', 'कागज़ के रजिस्टर की फोटो से AI पढ़कर एंट्री भरता है'],
         ['🔗 कल से दोबारा जोड़ें', 'आज की ओपनिंग को कल की क्लोजिंग से फिर से जोड़ता है (सिर्फ़ मालिक)'],
         ['+ उधार / + जमा', 'आज की पार्टी एंट्री जोड़ता है (तेल उधार दिया या पैसा जमा आया)'],
         ['+ और खर्चा जोड़ें', 'खर्चे की नई लाइन जोड़ता है; बाँटें बटन से एक रकम को हिस्सों में बाँट सकते हैं'],
         ['✔ मिलान', 'सेल्समैन की डाली उधार एंट्री को वेरीफाई करता है (सिर्फ़ मालिक)']],
        'hisab hisaab din daily roz meter reading lock submit save jama karna compact report relink scan milan मिलान कॉम्पैक्ट'],
      ['ledger', '📒 खाते', 'नीचे दूसरा tab "खाते"',
        'सभी पार्टियों की लिस्ट और हर एक का वर्तमान बकाया। किसी भी पार्टी पर दबाकर उसका पूरा खाता और लेन-देन खुलता है।',
        [['+ उधार', 'पार्टी को तेल उधार दिया — गाड़ी नंबर, तेल, लीटर और रेट से एंट्री; बोलकर भरें और थर्मल पर्ची भी यहीं है'],
         ['+ जमा', 'पार्टी से पैसा आया (कैश या ऑनलाइन) — इससे बकाया घटता है'],
         ['+ नई पार्टी', 'नया खाता खोलता है (नाम, मोबाइल, गाड़ियाँ और उधार सीमा)'],
         ['📥 लिस्ट से जोड़ें', 'कई पार्टियाँ एक साथ जोड़ने के लिए लिस्ट पेस्ट करने का बटन'],
         ['⚖ पिछला बैलेंस', 'ऐप शुरू करने से पहले का पुराना बकाया या एडवांस दर्ज करता है'],
         ['✅ Paid / वसूली', 'पूरा हिसाब चुकता मानकर वसूली दर्ज करता है'],
         ['✅ खाता बंद', 'पार्टी का खाता बंद करता है'],
         ['🔑 पोर्टल कोड / भेजें', 'हर पार्टी को 6 अंकों का पोर्टल कोड देता है जिससे ग्राहक अपने फोन पर अपना उधार खाता देख सकता है और ऑर्डर दे सकता है'],
         ['📄 प्रोफेशनल स्टेटमेंट', 'तारीख चुनकर पीडीएफ या प्रिंट स्टेटमेंट बनाता है और WhatsApp पर भेजता है'],
         ['🧾 Professional Invoice (UPI QR)', 'UPI QR कोड वाला पक्का बिल बनाता है'],
         ['✏ पार्टी बदलें', 'पार्टी का नाम, मोबाइल, गाड़ी या उधार सीमा बदलता है'],
         ['🔧 ठीक करें', 'खाते के बैलेंस की गड़बड़ी को शुरू से दोबारा जोड़कर ठीक करता है']],
        'khata khate party ledger udhar jama baki baaki bakaya naya khata statement invoice portal code पोर्टल कोड स्टेटमेंट'],
      ['gaadicash', '🚚 गाड़ी कैश', 'नीचे तीसरा tab "गाड़ी कैश"',
        'ड्राइवर को गाड़ी के नाम पर दिया गया नकद पैसा। यह पार्टी के खाते में उधार जुड़ता है और बाद में वापस मिलने पर Paid मार्क होता है।',
        [['+ नया गाड़ी कैश दें', 'पार्टी, गाड़ी नंबर और रकम डालकर ड्राइवर कैश दर्ज करता है'],
         ['✔ Paid', 'यह पैसा वापस मिल गया — इसे चुकता मार्क करता है']],
        'gaadi cash driver cash gadicash chalak nakad diya गाड़ी कैश'],
      ['stock', '🛢 स्टॉक', 'नीचे चौथा tab "स्टॉक"',
        'पेट्रोल और डीज़ल का स्टॉक हिसाब, नोज़ल-वाइज़ बिक्री और महीने का दिन-वार स्टॉक रजिस्टर।',
        [['महीना चुनें', 'किस महीने का स्टॉक रजिस्टर देखना है वह चुनता है']],
        'stock tanki dip register nozzle wise स्टॉक रजिस्टर'],
      ['manager_desk', '💼 मैनेजर डेस्क', 'नीचे पाँचवाँ tab "मैनेजर डेस्क"',
        'मैनेजर का ऑल-इन-वन काउंटर: गल्ले का मिलान, मीटर रीडिंग अपडेट और नकद आना-जाना।',
        [['💵 गल्ला गिनें / अपडेट करें', 'दराज़ में रखे असली नोट गिनकर सिस्टम के कैश से मिलाता है'],
         ['💾 सेल अपडेट करें', 'मौजूदा मीटर रीडिंग से तुरंत सेल कैलकुलेट करता है'],
         ['+ बैंक जमा', 'बैंक में जमा किया गया कैश दर्ज करता है']],
        'manager desk galla gulla counter meter cash out cash in मैनेजर डेस्क गल्ला'],
      ['priv', '🔒 निजी', 'नीचे छठा tab "निजी"',
        'मालिक के निजी उधार और निजी पार्टियाँ, जो पंप के आम खातों से अलग रहते हैं।',
        [['+ नया निजी उधार', 'निजी उधार दर्ज करता है']],
        'niji private priv निजी'],
      ['more', '⚙ और (मेनू)', 'नीचे आख़िरी tab "और"',
        'बाकी सारी एडवांस स्क्रीन यहाँ हैं: विश्लेषण, वित्त, पार्टी/वर्कर, संचालन, सहायता, सेटिंग और पूरा डेटा बैकअप।',
        [['💾 JSON / CSV', 'पूरे पंप का डेटा एक फ़ाइल में डाउनलोड और बैकअप करता है'],
         ['🌙 डार्क मोड', 'ऐप की थीम को रात के हिसाब से डार्क करता है']],
        'aur more menu backup dark mode बैकअप डार्क मोड'],
      ['cibil', '⭐ पार्टी CIBIL', 'और → पार्टी/वर्कर',
        'हर पार्टी का पेमेंट स्कोर: कौन समय पर पैसा देता है, कौन लेट करता है और किसकी उधार सीमा कितनी होनी चाहिए।',
        [], 'cibil score credit rating limit सिबिल'],
      ['invoices', '📄 खरीद बिल / मार्जिन', 'और → वित्त',
        'डिपो से आए टैंकर के खरीद बिल और उनसे पंप का असली मुनाफा (मार्जिन) निकालता है।',
        [['+ नया बिल', 'नया टैंकर खरीद बिल जोड़ता है']],
        'invoice bill kharid margin munafa purchase मार्जिन मुनाफा खरीद बिल'],
      ['runsheet', '📋 रनशीट', 'और → संचालन',
        'सेल्समैन की शिफ्ट शीट: ओपनिंग और क्लोजिंग रीडिंग से शिफ्ट का हिसाब।',
        [['✔ अप्रूव करें', 'सेल्समैन का हिसाब मंजूर करता है']],
        'runsheet shift salesman sheet रनशीट शिफ्ट'],
      ['tanker_report', '🚛 टैंकर रिपोर्ट', 'और → संचालन',
        'टैंकर खाली करने की पूरी रिपोर्ट, डिप और शॉर्टेज का हिसाब।',
        [['+ नई रिपोर्ट', 'नया टैंकर अनलोड रिकॉर्ड करता है']],
        'tanker report khali unload driver टैंकर रिपोर्ट'],
      ['workers', '👷 वर्कर हाज़िरी', 'और → पार्टी/वर्कर',
        'स्टाफ की रोज़ की हाज़िरी (P = आया, A = छुट्टी, H = आधा दिन) और सैलरी का हिसाब।',
        [['P / A / H', 'हाज़िरी मार्क करता है']],
        'worker hajri haziri attendance salesman chutti staff हाज़िरी वर्कर']
    ];
    APP.KB = {
      TABS,
      SCREENS: SCR.map(x => ({ go: x[0], name: x[1], where: x[2], what: x[3], buttons: x[4], kw: x[5] }))
    };
  })();

  /* ================= 2. FIRESTORE DATA LAYER WITH TTL CACHE ================= */
  const D = {
    _c: {},
    clear() { this._c = {}; },
    async memo(k, ttl, fn) {
      const c = this._c[k];
      if (c && Date.now() - c.t < ttl) return c.v;
      const v = await fn();
      this._c[k] = { t: Date.now(), v };
      return v;
    },
    async parties(force) {
      try {
        if (!force && S.parties && S.parties.pub && S.parties.pub.length) return S.parties.pub;
        return (await APP.getParties(false, !!force)) || [];
      } catch (e) { return []; }
    },
    day(date) {
      return this.memo('d_' + date, 15000, async () => {
        if (!dbx()) return null;
        const s = await dbx().collection('days').doc(date).get();
        return s.exists ? Object.assign({ date }, s.data()) : null;
      });
    },
    days(from, to) {
      return this.memo('ds_' + from + '_' + (to || ''), 45000, async () => {
        if (!dbx()) return [];
        let q = dbx().collection('days').where('date', '>=', from);
        if (to) q = q.where('date', '<=', to);
        const s = await q.get();
        return s.docs.map(d => Object.assign({ date: d.id }, d.data())).filter(d => d && d.sum).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      });
    },
    led(from, to) {
      return this.memo('ld_' + from + '_' + (to || ''), 60000, async () => {
        if (!dbx()) return [];
        let q = dbx().collection('ledger').where('date', '>=', from);
        if (to) q = q.where('date', '<=', to);
        const s = await q.get();
        return s.docs.map(d => Object.assign({ id: d.id }, d.data()));
      });
    },
    ledParty(pid) {
      return this.memo('lp_' + pid, 45000, async () => {
        if (!dbx()) return [];
        const s = await dbx().collection('ledger').where('partyId', '==', pid).get();
        return s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (String(a.date) + String(a.time || '')).localeCompare(String(b.date) + String(b.time || '')));
      });
    },
    workers() {
      return this.memo('wk', 120000, async () => {
        if (!dbx()) return [];
        const s = await dbx().collection('workers').get();
        return s.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(w => w.active !== false);
      });
    },
    att(date) {
      return this.memo('at_' + date, 20000, async () => {
        if (!dbx()) return [];
        const s = await dbx().collection('attendance').where('date', '==', date).get();
        return s.docs.map(d => d.data());
      });
    },
    tankers() {
      return this.memo('tk', 90000, async () => {
        if (!dbx()) return [];
        const s = await dbx().collection('tanker_invoices').get();
        return s.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      });
    }
  };

  /* ================= 3. MEMORY, STICKY CONTEXT & FOCUS LOCK ================= */
  const BK = 'mazda_asst_brain_v95';
  function loadBrain() {
    let b = { fallbackIdx: 0, mem: { tts: true } };
    try {
      const x = JSON.parse(localStorage.getItem(BK) || 'null');
      if (x) b = Object.assign(b, x);
    } catch (e) {}
    return b;
  }
  function saveBrain() {
    try { localStorage.setItem(BK, JSON.stringify(ctx.brain)); } catch (e) {}
  }

  const ctx = {
    party: null,
    vehicle: null,
    date: null,
    range: null,
    fuel: null,
    pending: null,
    focusMode: null,
    brain: loadBrain()
  };

  /* ================= 4. FLUENT NATURAL HINDI VOICE ENGINE ================= */
  const HI_NUMS = ('शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सतासी अठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे').split(' ');

  function hiWords(numVal) {
    let v = Math.round(Math.abs(Number(numVal) || 0));
    if (v === 0) return 'शून्य';
    if (v < 100) return HI_NUMS[v] || String(v);
    const out = [];
    const cr = Math.floor(v / 1e7); v %= 1e7;
    const lk = Math.floor(v / 1e5); v %= 1e5;
    const th = Math.floor(v / 1e3); v %= 1e3;
    const h = Math.floor(v / 100); v %= 100;
    if (cr) out.push(hiWords(cr) + ' करोड़');
    if (lk) out.push((HI_NUMS[lk] || hiWords(lk)) + ' लाख');
    if (th) out.push((HI_NUMS[th] || hiWords(th)) + ' हज़ार');
    if (h) out.push((HI_NUMS[h] || String(h)) + ' सौ');
    if (v) out.push(HI_NUMS[v] || String(v));
    return out.join(' ');
  }

  function cleanForNaturalSpeech(rawText) {
    let t = String(rawText || '');
    t = t.replace(/<br\s*\/?>|<\/(div|p|li|h\d)>/gi, '। ').replace(/<[^>]*>/g, ' ');
    t = t.replace(/(-?)\s*₹\s*(-?)\s*([\d,]+(?:\.\d+)?)/g, (m, n1, n2, digits) => {
      const isNeg = (n1 === '-' || n2 === '-');
      const val = parseFloat(digits.replace(/,/g, ''));
      return ' ' + (isNeg ? 'माइनस ' : '') + hiWords(val) + ' रुपये ';
    });
    t = t.replace(/([\d,]+(?:\.\d+)?)\s*(?:L|ltr|Ltr|lit\.?|लीटर)\b/g, (m, digits) => {
      const val = parseFloat(digits.replace(/,/g, ''));
      return ' ' + hiWords(val) + ' लीटर ';
    });
    t = t.replace(/(\d+(?:\.\d+)?)\s*%/g, (m, digits) => ' ' + hiWords(Math.round(parseFloat(digits))) + ' प्रतिशत ');
    t = t.replace(/\b(\d+)\.(\d+)\b/g, (m, a, b) => {
      if (Number(b) === 0) return hiWords(a);
      return hiWords(a) + ' दशमलव ' + hiWords(b.slice(0, 2));
    });
    t = t.replace(/\b(\d[\d,]*)\b/g, (m, digits) => hiWords(parseFloat(digits.replace(/,/g, ''))));

    t = t.replace(/\bpaytm\b/gi, 'पेटीएम')
         .replace(/\bswipe\b/gi, 'स्वाइप')
         .replace(/\bupi\b/gi, 'यूपीआई')
         .replace(/\bdiesel\b/gi, 'डीज़ल')
         .replace(/\bpetrol\b/gi, 'पेट्रोल')
         .replace(/\bowner\b/gi, 'ओनर')
         .replace(/\bmanager\b/gi, 'मैनेजर')
         .replace(/\bcibil\b/gi, 'सिबिल')
         .replace(/\bwhatsapp\b/gi, 'व्हाट्सऐप')
         .replace(/\bai\b/gi, 'ए आई')
         .replace(/\bp([1-4])\b/gi, 'पी $1')
         .replace(/\bd([1-4])\b/gi, 'डी $1');

    t = t.replace(/[^a-zA-Z\u0900-\u097F।\s]/g, ' ');
    t = t.replace(/।+/g, '।').replace(/\s+/g, ' ').trim();
    return t;
  }

  const Voice = (() => {
    let bestVoice = null;
    let utterQueue = [];

    function pickBestVoice() {
      if (!window.speechSynthesis) return;
      const all = speechSynthesis.getVoices() || [];
      if (!all.length) return;
      const hi = all.filter(v => /^hi/i.test(v.lang) || /hindi|हिन्दी/i.test(v.name));
      bestVoice =
        hi.find(v => /natural|online|swara|lekha|google हिन्दी/i.test(v.name)) ||
        hi.find(v => /female/i.test(v.name)) ||
        hi[0] ||
        all.find(v => /^en[-_]in/i.test(v.lang)) ||
        all[0];
    }

    if (window.speechSynthesis) {
      pickBestVoice();
      speechSynthesis.onvoiceschanged = pickBestVoice;
    }

    function speakNext() {
      if (!utterQueue.length || !window.speechSynthesis) return;
      const sentence = utterQueue.shift();
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = (bestVoice && bestVoice.lang) || 'hi-IN';
      if (bestVoice) u.voice = bestVoice;
      u.rate = 1.0;
      u.pitch = 1.02;
      u.onend = () => { if (utterQueue.length) speakNext(); };
      u.onerror = () => { if (utterQueue.length) speakNext(); };
      try { speechSynthesis.speak(u); } catch (e) {}
    }

    return {
      say(rawText) {
        if (!ctx.brain.mem.tts || !window.speechSynthesis) return;
        this.stop();
        pickBestVoice();
        const cleaned = cleanForNaturalSpeech(rawText);
        if (!cleaned) return;
        if (cleaned.length <= 190) {
          utterQueue = [cleaned.replace(/।/g, ' ')];
        } else {
          utterQueue = cleaned.split('।').map(s => s.trim()).filter(Boolean);
        }
        speakNext();
      },
      stop() {
        utterQueue = [];
        try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
      }
    };
  })();

  /* ================= 5. HELPERS & STOCK FORECASTING ================= */
  const lbl = isoDate => {
    const t = today();
    if (!isoDate || isoDate === t) return 'आज';
    if (isoDate === shift(t, -1)) return 'कल';
    if (isoDate === shift(t, -2)) return 'परसों';
    return dmy(isoDate) + ' (' + WD[wdOf(isoDate)] + ')';
  };
  const sayDate = isoDate => lbl(isoDate).replace(/\s*\(.*\)/, '');
  const R = (html, o) => Object.assign({ html }, o || {});
  const chip = (label, q) => ({ label, q });
  const cs = (label, skill, params) => ({ label, skill, params: params || {} });
  const fuelName = f => (f === 'petrol' ? 'पेट्रोल' : f === 'diesel' ? 'डीज़ल' : 'पेट्रोल और डीज़ल');
  const dayHasData = d => d && d.sum && (n(d.sum.sale) > 0 || n(d.sum.litP) > 0 || n(d.sum.litD) > 0);
  const sumBy = (arr, fn) => arr.reduce((a, x) => a + n(fn(x)), 0);
  const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : 0);
  const closeStock = (d, f) => {
    if (!d || !d.sum) return 0;
    const act = n(f === 'petrol' ? d.sum.actStockP : d.sum.actStockD);
    const exp = n(f === 'petrol' ? d.sum.expStockP : d.sum.expStockD);
    return act > 0 ? act : exp;
  };
  const owing = ps => (ps || []).filter(x => n(x.bal) > 0).sort((a, b) => n(b.bal) - n(a.bal));

  let closeUI = () => {};
  const openLed = id => { try { closeUI(); setTimeout(() => APP.partyView && APP.partyView(id, false), 250); } catch (e) {} };
  const goTo = key => { try { closeUI(); setTimeout(() => APP.go && APP.go(key), 250); } catch (e) {} };

  function waRemind(x) {
    const ph = String((x && x.phone) || '').replace(/\D/g, '');
    const msg = `नमस्ते ${x.name} जी,\n\nमाज़दा ऑयल कंपनी पर आपका वर्तमान बकाया ${M(x.bal)} है। कृपया जल्द भुगतान करने का कष्ट करें।\n\nधन्यवाद 🙏`;
    window.open('https://wa.me/' + (ph.length === 10 ? '91' + ph : ph) + '?text=' + encodeURIComponent(msg), '_blank');
  }

  async function burnRate(f) {
    const ds = (await D.days(shift(today(), -10), today())).filter(d => d.date !== today() || d.status === 'submitted');
    const arr = ds.slice(-7).map(d => n(f === 'petrol' ? d.sum.litP : d.sum.litD)).filter(v => v > 0);
    if (!arr.length) return 0;
    let ws = 0, wt = 0;
    arr.forEach((v, i) => { const w = i + 1; ws += v * w; wt += w; });
    return ws / wt;
  }

  async function stockNow() {
    const ds = await D.days(shift(today(), -10), today());
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i], P = closeStock(d, 'petrol'), Dz = closeStock(d, 'diesel');
      if (P > 0 || Dz > 0) return { P, D: Dz, date: d.date, d };
    }
    return null;
  }

  const homeChips = () => [
    chip('📊 आज की सेल', 'आज की सेल'),
    chip('⛽ नोज़ल ट्रेंड', 'नोज़ल ट्रेंड बताओ'),
    chip('🛢 स्टॉक', 'स्टॉक कितना है'),
    chip('📒 कुल उधार', 'कुल उधार')
  ];

  /* ================= 6. ALL PRO SKILLS (SK) ================= */
  const SK = {};

  SK.greet = async () => {
    const h = new Date().getHours();
    const g = h < 12 ? 'सुप्रभात' : h < 17 ? 'नमस्कार' : 'शुभ संध्या';
    return R(`${g}! 🙏 मैं <b>माज़दा असिस्टेंट</b> हूँ। बताइए, आज किसका हिसाब देखें या कौन सी एंट्री लिखें?`, {
      say: `${g}! मैं माज़दा असिस्टेंट हूँ। बताइए, आज किसका हिसाब देखें या कौन सी एंट्री लिखें?`,
      chips: homeChips()
    });
  };

  SK.thanks = async () => {
    const msg = pick([
      '😊 जी, कभी भी! पंप का हिसाब एकदम तैयार है, और कुछ पूछना हो तो बताइए।',
      '🙏 आपका स्वागत है! आगे बताइए, क्या चेक करें?',
      '😊 बस आप हुक्म कीजिए, मैं सारा हिसाब मुँहज़बानी रखती हूँ!'
    ]);
    return R(msg, { say: msg, chips: homeChips() });
  };

  SK.help = async () => R(
    `🤖 <b>मैं आपके पंप के ये सारे काम चुटकियों में कर सकती हूँ:</b><br><br>` +
    `1️⃣ <b>बिक्री और रेट:</b> आज, कल, परसों, किसी भी तारीख (जैसे <i>4 तारीख की सेल</i> या <i>उस दिन का रेट</i>) या पूरे महीने की सेल।<br>` +
    `2️⃣ <b>नोज़ल और मीटर:</b> <i>"उस दिन P1 मीटर कितना था?"</i> या <i>"P1 4500"</i> बोलकर क्लोजिंग रीडिंग सेव करना।<br>` +
    `3️⃣ <b>पार्टी और उधार:</b> कुल उधार, किसी पार्टी का बकाया, गाड़ी आखिरी बार कब आई, और <i>"9769 में 5000 उधार"</i> दर्ज करना।<br>` +
    `4️⃣ <b>स्टॉक और डिप:</b> <i>"45 डिप में कितना डीज़ल"</i>, स्टॉक कितने दिन चलेगा, और आखिरी टैंकर।<br>` +
    `5️⃣ <b>पूरे ऐप की जानकारी:</b> किसी भी बटन का काम पूछें—जैसे <i>"पार्टी के पोर्टल कोड"</i> या <i>"कॉम्पैक्ट रिपोर्ट"</i>!`,
    {
      say: 'मैं पंप की सेल, रेट, स्टॉक, डिप, पार्टी उधार और गाड़ियों का पूरा हिसाब बता सकती हूँ। आप बोलकर रीडिंग, पेटीएम और उधार की एंट्री करवा सकते हैं, और ऐप के किसी भी बटन का काम पूछ सकते हैं।',
      chips: [chip('📖 ऐप का टूर', 'ऐप में क्या क्या है'), chip('📊 आज की सेल', 'आज की सेल'), chip('📒 कुल उधार', 'कुल उधार')]
    }
  );

  SK.about = async (p) => {
    const t = p.what;
    if (t === 'owner') {
      return R(`🏢 इस <b>माज़दा ऑयल कंपनी (पेट्रोल पंप)</b> के मालिक <b>${PERSON.owner} (Shashank Bansal)</b> हैं।`, {
        say: `इस माज़दा ऑयल कंपनी पेट्रोल पंप के मालिक ${PERSON.owner} हैं।`
      });
    }
    if (t === 'maker_how') {
      return R(`🧠 मुझे <b>${PERSON.maker} (Neeraj Dev)</b> ने जावास्क्रिप्ट कोडिंग और पंप के असली गणित से रात-दिन मेहनत करके बनाया है! उन्होंने मेरे दिमाग में पंप के हर नोज़ल, डिप चार्ट, उधार खाते और हर बटन की समझ बारीकी से डाली है ताकि मैं बिना इंटरनेट रुके सुपरफ़ास्ट काम कर सकूँ।`, {
        say: `मुझे ${PERSON.maker} ने कोडिंग और पंप के असली लॉजिक से बड़ी मेहनत से बनाया है। उन्होंने मेरे दिमाग में पंप के हर नोज़ल, डिप चार्ट और खातों की समझ डाली है।`
      });
    }
    if (t === 'maker_voice') {
      return R(`😄 अरे नहीं! मुझे बनाया तो <b>${PERSON.maker}</b> ने है, लेकिन मैं आवाज़ सबकी सुनती हूँ—चाहे मालिक <b>${PERSON.owner}</b> जी हों, मैनेजर हों या पंप का स्टाफ! बस प्यार से माइक दबाकर बोलिए, मैं तुरंत काम करूँगी।`, {
        say: `अरे नहीं, मुझे बनाया तो ${PERSON.maker} ने है, लेकिन मैं आवाज़ सबकी सुनती हूँ, चाहे मालिक हों या मैनेजर। बस माइक दबाकर बोलिए।`
      });
    }
    if (t === 'maker') {
      return R(`👨‍💻 मैं एक AI असिस्टेंट हूँ, मेरा कोई मालिक नहीं है। मुझे <b>${PERSON.maker} (Neeraj Dev)</b> ने खास तौर पर माज़दा ऑयल कंपनी के काम को स्मार्ट और आसान बनाने के लिए डिज़ाइन किया है!`, {
        say: `मैं एक ए आई असिस्टेंट हूँ, मेरा कोई ओनर नहीं है। मुझे ${PERSON.maker} ने माज़दा ऑयल कंपनी के लिए बनाया है।`
      });
    }
    if (t === 'me') {
      const role = S.role === 'owner' ? 'मालिक' : S.role === 'manager' ? 'मैनेजर' : S.role === 'salesman' ? 'सेल्समैन' : 'यूज़र';
      const nm = S.user ? S.user.email.split('@')[0] : (S.salesman ? S.salesman.name : 'User');
      return R(`👤 आपका नाम <b>${esc(nm)}</b> है, और आप इस ऐप में <b>${role}</b> के रूप में लॉगिन हैं।`, {
        say: `आपका नाम ${nm} है, और आप इस ऐप में ${role} के रूप में लॉगिन हैं।`
      });
    }
    return R(`🤖 मैं <b>माज़दा असिस्टेंट</b> हूँ—आपके पेट्रोल पंप की डिजिटल मैनेजर! मुझे <b>${PERSON.maker}</b> ने बनाया है और इस पंप के मालिक <b>${PERSON.owner}</b> हैं। सेल, स्टॉक, डिप, उधार और ऐप के हर बटन की जानकारी मेरी उंगलियों पर है!`, {
      say: `मैं माज़दा असिस्टेंट हूँ, आपके पेट्रोल पंप की डिजिटल मैनेजर। मुझे ${PERSON.maker} ने बनाया है और इस पंप के मालिक ${PERSON.owner} हैं।`,
      chips: [chip('🧭 तुम क्या कर सकती हो?', 'तुम क्या क्या काम कर सकती हो'), chip('📖 ऐप का टूर', 'ऐप में क्या क्या है')]
    });
  };

  /* ---------- SALE & RATE SKILLS ---------- */
  async function saleRange(p) {
    const r = p.range;
    const ds = (await D.days(r.from, r.to)).filter(dayHasData);
    if (!ds.length) return R(`📅 <b>${r.label}</b> का कोई हिसाब रिकॉर्ड में नहीं मिला।`, { say: `${r.label} का कोई हिसाब रिकॉर्ड में नहीं मिला।` });
    const tot = sumBy(ds, d => d.sum.sale), lp = sumBy(ds, d => d.sum.litP), ld = sumBy(ds, d => d.sum.litD);
    const best = ds.slice().sort((a, b) => n(b.sum.sale) - n(a.sum.sale))[0];
    const low = ds.slice().sort((a, b) => n(a.sum.sale) - n(b.sum.sale))[0];
    ctx.range = r;
    return R(
      `📊 <b>${r.label} का हिसाब</b> (${ds.length} दिन)<br>` +
      `💰 कुल सेल: <b>${M(tot)}</b><br>` +
      `⛽ पेट्रोल: <b>${L(lp)}</b> · 🛢 डीज़ल: <b>${L(ld)}</b><br>` +
      `📈 रोज़ का औसत: <b>${M(tot / ds.length)}</b><br>` +
      `🏆 सबसे अच्छा दिन: <b>${lbl(best.date)}</b> (${M(best.sum.sale)})<br>` +
      `📉 सबसे कम सेल: <b>${lbl(low.date)}</b> (${M(low.sum.sale)})`,
      {
        say: `${r.label} में कुल सेल ${M(tot)} रही। इसमें पेट्रोल ${r0(lp)} लीटर और डीज़ल ${r0(ld)} लीटर बिका। रोज़ का औसत ${M(tot / ds.length)} रहा।`,
        chips: [cs('🏆 बेस्ट सेल डे', 'sale.best', { range: r }), cs('📉 कम डीज़ल वाले दिन', 'sale.low', { range: r })]
      }
    );
  }

  SK['sale.day'] = async (p) => {
    if (p.range) return saleRange(p);
    const date = p.date || ctx.date || today();
    ctx.date = date; // Lock sticky date for "us din" follow-up!
    const d = await D.day(date);
    if (!d || !d.sum) {
      return R(`📅 <b>${lbl(date)}</b> का हिसाब अभी दर्ज नहीं हुआ है।`, {
        say: `${sayDate(date)} का हिसाब अभी दर्ज नहीं हुआ है।`,
        chips: [chip('📈 कल की सेल', 'कल की सेल'), chip('📅 इस महीने की सेल', 'इस महीने की सेल')]
      });
    }
    const s = d.sum, sale = n(s.sale), lp = n(s.litP), ld = n(s.litD);
    const [prev, hist, led] = await Promise.all([
      D.day(shift(date, -1)),
      D.days(shift(date, -15), shift(date, -1)),
      D.led(date, date)
    ]);
    const ud = sumBy(led.filter(x => x.kind === 'udhar'), x => x.amount);
    const jm = sumBy(led.filter(x => x.kind === 'jama'), x => x.amount);
    const cashless = n(d.paytm) + n(d.swipe);
    let cmp = '', cmpSay = '';
    const hs = hist.filter(dayHasData);
    if (hs.length >= 3 && sale > 0) {
      const avg = sumBy(hs, x => x.sum.sale) / hs.length, pc = pct(sale, avg);
      cmp = `<br>📊 पिछले औसत (${M(avg)}) से <b class="${pc >= 0 ? 'pos' : 'neg'}">${Math.abs(pc)}% ${pc >= 0 ? 'ज़्यादा 🟢' : 'कम 🔴'}</b>`;
      cmpSay = ` यह औसत से ${Math.abs(pc)} प्रतिशत ${pc >= 0 ? 'ज़्यादा' : 'कम'} है।`;
    } else if (prev && prev.sum && n(prev.sum.sale) > 0 && sale > 0) {
      const pc = pct(sale, n(prev.sum.sale));
      cmp = `<br>📈 पिछले दिन से <b>${Math.abs(pc)}% ${pc >= 0 ? 'ज़्यादा' : 'कम'}</b>`;
    }
    const rateInfo = (n(d.rateP) || n(d.rateD)) ? `<br>🏷️ रेट — पेट्रोल: ₹${n(d.rateP) || '-'} · डीज़ल: ₹${n(d.rateD) || '-'}` : '';
    return R(
      `📊 <b>${lbl(date)} की कुल सेल: ${M(sale)}</b><br>` +
      `⛽ पेट्रोल: <b>${L(lp)}</b> · 🛢 डीज़ल: <b>${L(ld)}</b>${cmp}${rateInfo}<br>` +
      `💳 Paytm/स्वाइप: ${M(cashless)} · 📒 उधार: ${M(ud)} · 💵 जमा: ${M(jm)}`,
      {
        say: `${sayDate(date)} की कुल सेल ${M(sale)} है। पेट्रोल ${r0(lp)} लीटर और डीज़ल ${r0(ld)} लीटर बिका।${cmpSay}`,
        chips: [
          cs('⛽ उस दिन के नोज़ल', 'nozzle.day', { date }),
          cs('🏷️ उस दिन का रेट', 'rate.day', { date }),
          cs('🛢 उस दिन का स्टॉक', 'stock', { date }),
          cs('📈 क्यों कम/ज़्यादा?', 'why.sale', { date })
        ]
      }
    );
  };

  // NEW SKILL: Rate Lookup for Any Date ("Us din ka rate kya tha", "Aaj petrol ka rate kya hai")
  SK['rate.day'] = async (p) => {
    const date = p.date || ctx.date || today();
    ctx.date = date;
    const d = await D.day(date);
    if (!d || (!n(d.rateP) && !n(d.rateD))) {
      return R(`🏷️ <b>${lbl(date)}</b> का पेट्रोल/डीज़ल रेट रिकॉर्ड में दर्ज नहीं मिला।`, {
        say: `${sayDate(date)} का रेट रिकॉर्ड में दर्ज नहीं मिला।`
      });
    }
    const rp = n(d.rateP), rd = n(d.rateD);
    return R(
      `🏷️ <b>${lbl(date)} का रेट:</b><br>` +
      `⛽ पेट्रोल: <b>₹${rp.toFixed(2)} प्रति लीटर</b><br>` +
      `🛢 डीज़ल: <b>₹${rd.toFixed(2)} प्रति लीटर</b>`,
      {
        say: `${sayDate(date)} को पेट्रोल का रेट ${rp} रुपये और डीज़ल का रेट ${rd} रुपये प्रति लीटर था।`,
        chips: [cs('📊 उस दिन की सेल', 'sale.day', { date }), cs('⛽ उस दिन के नोज़ल', 'nozzle.day', { date })]
      }
    );
  };

  // Upgraded: Supports both ALL nozzles AND single nozzle query ("Ush din p1 miter kitna tha")
  SK['nozzle.day'] = async (p) => {
    const date = p.date || ctx.date || today();
    ctx.date = date;
    const d = await D.day(date);
    if (!d || !d.nz) {
      return R(`⛽ <b>${lbl(date)}</b> की नोज़ल मीटर रीडिंग अभी दर्ज नहीं है।`, {
        say: `${sayDate(date)} की नोज़ल मीटर रीडिंग दर्ज नहीं है।`
      });
    }
    const nz = d.nz;
    // If user asked about a specific nozzle like P1 ("Ush din p1 miter kitna tha")
    if (p.nozzleKey) {
      const k = p.nozzleKey.toLowerCase();
      const item = nz[k];
      if (!item || (n(item.o) === 0 && n(item.c) === 0)) {
        return R(`⛽ <b>${lbl(date)}</b> को नोज़ल <b>${k.toUpperCase()}</b> की कोई रीडिंग दर्ज नहीं है।`, {
          say: `${sayDate(date)} को नोज़ल ${k.toUpperCase()} की रीडिंग दर्ज नहीं है।`
        });
      }
      const o = n(item.o), c = n(item.c), test = n(item.t);
      const sold = c > o ? Math.max(0, c - o - test) : 0;
      return R(
        `⛽ <b>${lbl(date)} — नोज़ल ${k.toUpperCase()} का मीटर:</b><br>` +
        `• ओपनिंग रीडिंग: <b>${o}</b><br>` +
        `• क्लोज़िंग रीडिंग: <b>${c || 'भरी नहीं गई'}</b><br>` +
        (test > 0 ? `• टेस्टिंग: <b>${L(test)}</b><br>` : '') +
        `• कुल बिक्री: <b>${L(sold)}</b>`,
        {
          say: `${sayDate(date)} को नोज़ल ${k.toUpperCase()} की ओपनिंग ${r0(o)} और क्लोज़िंग ${r0(c)} थी। इससे कुल ${r0(sold)} लीटर तेल बिका।`,
          chips: [cs('⛽ सभी नोज़ल देखें', 'nozzle.day', { date }), cs('📊 उस दिन की सेल', 'sale.day', { date })]
        }
      );
    }

    const keys = ['p1', 'p2', 'p3', 'p4', 'd1', 'd2', 'd3', 'd4'];
    let lines = [], bestK = null, maxL = 0;
    keys.forEach(k => {
      if (nz[k] && (n(nz[k].o) > 0 || n(nz[k].c) > 0)) {
        const o = n(nz[k].o), c = n(nz[k].c);
        const sold = c > o ? c - o : 0;
        if (sold > maxL) { maxL = sold; bestK = k.toUpperCase(); }
        lines.push(`• <b>${k.toUpperCase()}</b>: <b>${L(sold)}</b> <small>(ओपनिंग ${o} → क्लोज़िंग ${c || 'बाकी'})</small>`);
      }
    });
    if (!lines.length) {
      return R(`⛽ <b>${lbl(date)}</b> में किसी भी नोज़ल की रीडिंग अभी नहीं भरी गई है।`, {
        say: `${sayDate(date)} में किसी भी नोज़ल की रीडिंग नहीं भरी गई है।`
      });
    }
    const winTxt = bestK ? `<br><br>🏆 सबसे ज़्यादा तेल नोज़ल <b>${bestK} (${L(maxL)})</b> से निकला है।` : '<br><br>💡 अभी क्लोज़िंग रीडिंग भरना बाकी है।';
    return R(`⛽ <b>${lbl(date)} का नोज़ल मीटर ट्रेंड:</b><br>${lines.join('<br>')}${winTxt}`, {
      say: bestK ? `${sayDate(date)} को सबसे ज़्यादा बिक्री नोज़ल ${bestK} से ${r0(maxL)} लीटर हुई है।` : `${sayDate(date)} के नोज़ल की क्लोज़िंग रीडिंग अभी बाकी है।`,
      chips: [cs('📊 उस दिन की सेल', 'sale.day', { date }), cs('🛢 उस दिन का स्टॉक', 'stock', { date })]
    });
  };

  SK['sale.low'] = async (p) => {
    const f = p.fuel || ctx.fuel || 'diesel';
    const lim = p.limit || 2000;
    const r = p.range || ctx.range || { from: monthStart(today()), to: today(), label: 'इस महीने' };
    const ds = (await D.days(r.from, r.to)).filter(dayHasData).filter(d => d.date !== today() || d.status === 'submitted');
    if (!ds.length) return R(`${r.label} का हिसाब नहीं मिला।`);
    const low = ds.filter(d => n(f === 'petrol' ? d.sum.litP : d.sum.litD) < lim);
    if (!low.length) {
      return R(`✅ ${r.label} कोई भी दिन ऐसा नहीं रहा जब ${fuelName(f)} <b>${lim} लीटर</b> से कम बिका हो।`, {
        say: `${r.label} कोई भी दिन ऐसा नहीं रहा जब ${fuelName(f)} ${lim} लीटर से कम बिका हो।`
      });
    }
    const worst = low.slice().sort((a, b) => n(f === 'petrol' ? a.sum.litP : a.sum.litD) - n(f === 'petrol' ? b.sum.litP : b.sum.litD))[0];
    ctx.date = worst.date;
    return R(
      `📉 <b>${r.label} में ${low.length} दिन</b> ${fuelName(f)} ${lim} L से कम बिका:<br>` +
      low.slice(0, 8).map(d => `• ${lbl(d.date)}: <b>${L(f === 'petrol' ? d.sum.litP : d.sum.litD)}</b>`).join('<br>'),
      {
        say: `${r.label} में ${low.length} दिन ${fuelName(f)} ${lim} लीटर से कम बिका। सबसे कम ${sayDate(worst.date)} को रहा।`,
        chips: [cs('📈 उस दिन कम क्यों बिका?', 'why.sale', { date: worst.date })]
      }
    );
  };

  SK['sale.best'] = async (p) => {
    let r = p.range || ctx.range || { from: monthStart(today()), to: today(), label: 'इस महीने' };
    let ds = (await D.days(r.from, r.to)).filter(dayHasData);
    if (ds.length < 3 && !p.range) {
      r = { from: shift(today(), -30), to: today(), label: 'पिछले 30 दिन' };
      ds = (await D.days(r.from, r.to)).filter(dayHasData);
    }
    if (!ds.length) return R('अभी पर्याप्त हिसाब दर्ज नहीं है।');
    const top = ds.slice().sort((a, b) => n(b.sum.sale) - n(a.sum.sale)).slice(0, 3);
    ctx.date = top[0].date;
    return R(
      `🏆 <b>${r.label} के टॉप सेल वाले दिन:</b><br>` +
      top.map((d, i) => `${i + 1}. <b>${lbl(d.date)}</b>: ${M(d.sum.sale)}`).join('<br>'),
      {
        say: `${r.label} में सबसे ज़्यादा सेल ${sayDate(top[0].date)} को ${M(top[0].sum.sale)} रही।`,
        chips: [cs('📊 उस दिन का पूरा हिसाब', 'sale.day', { date: top[0].date })]
      }
    );
  };

  SK['why.sale'] = async (p) => {
    const date = p.date || ctx.date || today();
    ctx.date = date;
    const d = await D.day(date);
    if (!d || !d.sum) return R(`📅 <b>${lbl(date)}</b> का हिसाब दर्ज नहीं है।`);
    const s = d.sum, sale = n(s.sale);
    if (sale === 0 && n(s.litP) === 0 && n(s.litD) === 0) {
      return R(`💡 <b>${lbl(date)}</b> की नोज़ल क्लोज़िंग रीडिंग अभी भरी नहीं गई है, इसलिए बिक्री शून्य दिख रही है! रीडिंग भरते ही असली सेल आ जाएगी।`, {
        say: `${sayDate(date)} की नोज़ल क्लोज़िंग रीडिंग अभी भरी नहीं गई है, इसलिए बिक्री शून्य दिख रही है।`
      });
    }
    const [hist, led] = await Promise.all([D.days(shift(date, -15), shift(date, -1)), D.led(date, date)]);
    const hs = hist.filter(dayHasData), lines = [], say = [];
    const avgS = hs.length ? sumBy(hs, x => x.sum.sale) / hs.length : 0;
    if (avgS > 0) {
      const pc = pct(sale, avgS);
      lines.push(`• कुल सेल ${M(sale)} है, जो औसत (${M(avgS)}) से <b>${Math.abs(pc)}% ${pc >= 0 ? 'ज़्यादा' : 'कम'}</b> है`);
      say.push(`कुल सेल औसत से ${Math.abs(pc)} प्रतिशत ${pc >= 0 ? 'ज़्यादा' : 'कम'} है`);
    }
    const udh = led.filter(x => x.kind === 'udhar');
    const udAmt = sumBy(udh, x => x.amount);
    if (sale > 0 && udAmt > 0) {
      lines.push(`• इस दिन की सेल में <b>${M(udAmt)} (${Math.round((udAmt / sale) * 100)}%)</b> उधार खातों में गया है`);
      say.push(`इसमें ${M(udAmt)} उधार में गया है`);
    }
    if (wdOf(date) === 0) lines.push('• रविवार होने के कारण कमर्शियल गाड़ियों की आवाजाही अलग रहती है');
    if (!lines.length) lines.push('• बिक्री सामान्य रेंज में चल रही है');
    return R(`📈 <b>${lbl(date)} की सेल का विश्लेषण:</b><br>${lines.join('<br>')}`, {
      say: `${sayDate(date)} का विश्लेषण। ${say.join('। ')}।`,
      chips: [cs('📊 उस दिन की सेल', 'sale.day', { date }), cs('💳 कैश-UPI बँटवारा', 'cash.split', { date })]
    });
  };

  SK.peak = async () => {
    const ds = (await D.days('2020-01-01', today())).filter(dayHasData);
    if (!ds.length) return R('अभी पीक सीज़न निकालने के लिए पर्याप्त डेटा नहीं है।');
    const byM = {};
    ds.forEach(d => { const ym = d.date.slice(0, 7); byM[ym] = (byM[ym] || 0) + n(d.sum.sale); });
    const sorted = Object.entries(byM).sort((a, b) => b[1] - a[1]);
    const [bestYM, bestVal] = sorted[0];
    const [yr, mo] = bestYM.split('-');
    const mName = MON[Number(mo) - 1] + ' ' + yr;
    return R(`🏔 आपके डेटा के अनुसार सबसे ज़्यादा बिक्री <b>${mName}</b> में देखी गई है (<b>${M(bestVal)}</b>)। यही आपका पीक सीज़न रहा है!`, {
      say: `आपके डेटा के अनुसार सबसे ज़्यादा बिक्री ${mName} में ${M(bestVal)} रही है। यही आपका पीक सीज़न है।`
    });
  };

  SK['cash.split'] = async (p) => {
    const date = p.date || ctx.date || today();
    ctx.date = date;
    const d = await D.day(date);
    if (!d || !d.sum) return R(`📅 <b>${lbl(date)}</b> का हिसाब नहीं मिला।`);
    const led = await D.led(date, date), s = d.sum, sale = n(s.sale);
    const ud = sumBy(led.filter(x => x.kind === 'udhar'), x => x.amount);
    const jm = sumBy(led.filter(x => x.kind === 'jama'), x => x.amount);
    const on = n(d.paytm) + n(d.swipe);
    const cash = Math.max(0, sale - on - ud);
    return R(
      `💳 <b>${lbl(date)} — गल्ला और पेमेंट बँटवारा:</b><br>` +
      `💰 कुल सेल: <b>${M(sale)}</b><br>` +
      `• Paytm / UPI: <b>${M(d.paytm)}</b><br>` +
      `• कार्ड स्वाइप: <b>${M(d.swipe)}</b><br>` +
      `• उधार में गया: <b>${M(ud)}</b><br>` +
      `• नकद (कैश सेल): <b>${M(cash)}</b><br>` +
      `• पुरानी उधारी जमा आई: <b>${M(jm)}</b>`,
      {
        say: `${sayDate(date)} की कुल सेल ${M(sale)} रही। इसमें पेटीएम और स्वाइप ${M(on)}, उधार ${M(ud)}, और नकद ${M(cash)} रहा।`
      }
    );
  };

  /* ---------- STOCK & DIP SKILLS ---------- */
  SK.dip = async (p) => {
    const v = p.dipVal;
    if (!window.DipChart || typeof window.DipChart.getLiters !== 'function') {
      return R('डिप चार्ट लोड नहीं हो पाया।');
    }
    const f = p.fuel;
    let htmlOut = `📏 <b>${v} सेमी डिप पर स्टॉक:</b><br>`;
    let sayParts = [`${hiWords(v)} सेंटीमीटर डिप पर`];
    if (f !== 'petrol') {
      const dl = window.DipChart.getLiters('diesel', v);
      htmlOut += `🛢 डीज़ल: <b>${L(dl)}</b><br>`;
      sayParts.push(`डीज़ल ${r0(dl)} लीटर है`);
    }
    if (f !== 'diesel') {
      const pl = window.DipChart.getLiters('petrol', v);
      htmlOut += `⛽ पेट्रोल: <b>${L(pl)}</b>`;
      sayParts.push(`पेट्रोल ${r0(pl)} लीटर है`);
    }
    return R(htmlOut, { say: sayParts.join(' और ') });
  };

  SK.stock = async (p) => {
    const f = p.fuel || ctx.fuel;
    const targetDate = p.date || (p.useStickyDate ? ctx.date : null);
    if (targetDate && targetDate !== today()) {
      ctx.date = targetDate;
      const d = await D.day(targetDate);
      if (!d || !d.sum) return R(`📅 <b>${lbl(targetDate)}</b> का स्टॉक रिकॉर्ड नहीं मिला।`);
      const s = d.sum, P = closeStock(d, 'petrol'), Dz = closeStock(d, 'diesel');
      return R(
        `🛢 <b>${lbl(targetDate)} का क्लोज़िंग स्टॉक:</b><br>` +
        `• डीज़ल: <b>${L(Dz)}</b> <small>(बिका: ${L(s.litD)})</small><br>` +
        `• पेट्रोल: <b>${L(P)}</b> <small>(बिका: ${L(s.litP)})</small>`,
        {
          say: `${sayDate(targetDate)} को डीज़ल का स्टॉक ${r0(Dz)} लीटर और पेट्रोल का स्टॉक ${r0(P)} लीटर था।`,
          chips: [cs('📊 उस दिन की सेल', 'sale.day', { date: targetDate }), cs('🛢 आज का लाइव स्टॉक', 'stock', { date: null })]
        }
      );
    }
    const sn = await stockNow();
    if (!sn) return R('अभी स्टॉक का डेटा उपलब्ध नहीं है।');
    const [bp, bd] = await Promise.all([burnRate('petrol'), burnRate('diesel')]);
    const dp = bp > 0 ? (sn.P / bp).toFixed(1) : null;
    const dd = bd > 0 ? (sn.D / bd).toFixed(1) : null;
    return R(
      `🛢 <b>वर्तमान टैंक स्टॉक (${lbl(sn.date)}):</b><br>` +
      `• डीज़ल: <b>${L(sn.D)}</b> ${dd ? `<small>(लगभग ${dd} दिन चलेगा)</small>` : ''}<br>` +
      `• पेट्रोल: <b>${L(sn.P)}</b> ${dp ? `<small>(लगभग ${dp} दिन चलेगा)</small>` : ''}`,
      {
        say: `अभी टैंक में डीज़ल ${r0(sn.D)} लीटर और पेट्रोल ${r0(sn.P)} लीटर मौजूद है।`,
        chips: [cs('🚛 आखिरी टैंकर कब आया', 'tanker.last'), chip('📊 आज की सेल', 'आज की सेल')]
      }
    );
  };

  SK['tanker.last'] = async () => {
    const t = (await D.tankers()).slice(0, 3);
    if (!t.length) return R('अभी कोई टैंकर बिल दर्ज नहीं है।');
    const l = t[0], ago = daysBetween(l.date, today());
    return R(
      `🚛 <b>आखिरी टैंकर:</b> ${dmy(l.date)} (${ago === 0 ? 'आज' : ago + ' दिन पहले'})<br>` +
      `मात्रा: <b>${L(l.litres)}</b> (${l.fuelType === 'petrol' ? 'पेट्रोल' : 'डीज़ल'})${l.tankerNo ? ' · गाड़ी: ' + esc(l.tankerNo) : ''}`,
      {
        say: `आखिरी टैंकर ${ago === 0 ? 'आज' : ago + ' दिन पहले'} आया था, जिसमें ${r0(l.litres)} लीटर ${l.fuelType === 'petrol' ? 'पेट्रोल' : 'डीज़ल'} आया।`
      }
    );
  };

  /* ---------- UDHAR & PARTY SKILLS ---------- */
  SK['udhar.total'] = async () => {
    const ps = await D.parties(), due = owing(ps), tot = sumBy(due, x => x.bal);
    if (!ps.length) return R('पार्टी खातों का डेटा लोड नहीं हो सका।');
    const adv = ps.filter(x => n(x.bal) < 0);
    return R(
      `📒 <b>मार्केट में कुल बकाया: ${M(tot)}</b> (${due.length} खाते)<br><br>` +
      `<b>टॉप बकायादार:</b><br>` +
      due.slice(0, 3).map((x, i) => `${i + 1}. <b>${esc(x.name)}</b>: ${M(x.bal)}`).join('<br>') +
      (adv.length ? `<br><small>🟢 ${adv.length} पार्टियों का एडवांस जमा है (${M(-sumBy(adv, x => x.bal))})</small>` : ''),
      {
        say: `मार्केट में कुल बकाया ${M(tot)} है। सबसे ज़्यादा बकाया ${due[0] ? due[0].name : ''} पर ${due[0] ? M(due[0].bal) : ''} है।`,
        chips: [cs('🏆 टॉप 10 बकायादार', 'udhar.top'), cs('🚨 क्रेडिट लिमिट पार', 'udhar.over'), cs('💬 टॉप 3 को WhatsApp तगादा', 'wa.top')]
      }
    );
  };

  SK['udhar.top'] = async () => {
    const due = owing(await D.parties()).slice(0, 10);
    if (!due.length) return R('🎉 मार्केट में कोई उधार बाकी नहीं है!');
    ctx.party = due[0];
    return R(
      `🏆 <b>टॉप 10 बकायादार पार्टियाँ:</b><br>` +
      due.map((x, i) => `${i + 1}. <b>${esc(x.name)}</b>: ${M(x.bal)}`).join('<br>'),
      {
        say: `टॉप बकायादारों में पहले नंबर पर ${due[0].name} हैं, जिनका बकाया ${M(due[0].bal)} है।`,
        chips: [cs('💬 टॉप 3 को तगादा भेजें', 'wa.top'), cs('📒 खाता खोलें', 'party.ledger', { party: due[0] })]
      }
    );
  };

  SK['udhar.over'] = async () => {
    const ps = (await D.parties()).filter(x => n(x.limit) > 0 && n(x.bal) > n(x.limit));
    if (!ps.length) return R('✅ कोई भी पार्टी अपनी तय उधार सीमा (Credit Limit) से ऊपर नहीं है।', { say: 'कोई भी पार्टी अपनी तय उधार सीमा से ऊपर नहीं है।' });
    return R(
      `🚨 <b>${ps.length} पार्टियाँ उधार सीमा पार कर चुकी हैं:</b><br>` +
      ps.slice(0, 8).map(x => `• <b>${esc(x.name)}</b>: ${M(x.bal)} <small>(सीमा: ${M(x.limit)})</small>`).join('<br>'),
      { say: `${ps.length} पार्टियाँ अपनी तय उधार सीमा पार कर चुकी हैं।` }
    );
  };

  SK['wa.top'] = async () => {
    const due = owing(await D.parties()).slice(0, 3);
    if (!due.length) return R('कोई बकाया पार्टी नहीं मिली।');
    return R(`💬 <b>नीचे बटन दबाकर सीधे WhatsApp तगादा भेजें:</b>`, {
      say: 'नीचे नाम पर दबाइए, सीधा व्हाट्सऐप तगादा खुल जाएगा।',
      chips: due.map(x => ({ label: `📲 ${x.name} (${M(x.bal)})`, fn: () => waRemind(x) }))
    });
  };

  SK['party.info'] = async (p) => {
    const x = p.party || ctx.party;
    if (!x) return R('किस पार्टी का खाता देखना है? कृपया नाम या गाड़ी नंबर बताइए।');
    ctx.party = x;
    const b = n(x.bal);
    const statusLabel = b > 0 ? `बकाया (लेना है): <b class="neg">${M(b)}</b>` : b < 0 ? `एडवांस जमा: <b class="pos">${M(Math.abs(b))}</b>` : `बकाया: <b>₹0 (हिसाब बराबर)</b>`;
    return R(
      `👤 <b>${esc(x.name)}</b><br>${statusLabel}<br>` +
      `🚗 गाड़ियाँ: <small>${esc((x.vehicles || []).join(', ') || 'कोई नहीं')}</small>`,
      {
        say: `${x.name} का ${b >= 0 ? 'बकाया' : 'एडवांस जमा'} ${M(Math.abs(b))} है। बताइए, इनके खाते में क्या करना है?`,
        chips: [
          cs('📒 खाता खोलें', 'party.ledger', { party: x }),
          cs('📅 गाड़ी कब आई थी?', 'party.visit', { party: x }),
          { label: '➕ उधार जोड़ें', q: `${x.name} में उधार` },
          { label: '📲 WhatsApp तगादा', fn: () => waRemind(x) }
        ]
      }
    );
  };

  SK['party.ledger'] = async (p) => {
    const x = p.party || ctx.party;
    if (!x) return R('किस पार्टी का खाता खोलूँ?');
    openLed(x.id);
    return R(`⏳ <b>${esc(x.name)}</b> का खाता खोल रही हूँ...`, { say: `${x.name} का खाता खोल रही हूँ।` });
  };

SK['party.visit'] = async (p) => {
    const x = p.party || ctx.party;
    if (!x) return R('किस पार्टी या गाड़ी की पिछली एंट्री देखनी है? कृपया पहले नाम या गाड़ी नंबर बताइए।');
    ctx.party = x;
    const entries = (await D.ledParty(x.id)).filter(e => e.kind === 'udhar');
    if (!entries.length) {
      return R(`📅 <b>${esc(x.name)}</b> के खाते में अभी तक कोई उधार एंट्री दर्ज नहीं है।`, {
        say: `${x.name} के खाते में अभी कोई उधार एंट्री नहीं है।`
      });
    }
    const uniqueDates = [...new Set(entries.map(e => e.date).filter(Boolean))].sort().reverse();
    const lastEntry = entries[entries.length - 1];
    const ago = daysBetween(uniqueDates[0], today());

    if (uniqueDates.length >= 2) {
      const gap = daysBetween(uniqueDates[1], uniqueDates[0]);
      return R(
        `📅 <b>${esc(x.name)}</b> की गाड़ी आख़िरी बार <b>${lbl(uniqueDates[0])}</b> को आई थी, और उससे पहले <b>${dmy(uniqueDates[1])}</b> को आई थी।<br><br>` +
        `वर्तमान बकाया: <b>${M(x.bal)}</b>`,
        {
          say: `${x.name} की गाड़ी पिछली बार से ${gap} दिन बाद आई है। इनका वर्तमान बकाया ${M(x.bal)} है।`,
          chips: [cs('📒 खाता खोलें', 'party.ledger', { party: x })]
        }
      );
    }
    return R(`📅 <b>${esc(x.name)}</b> की गाड़ी <b>${lbl(lastEntry.date)}</b> (${ago === 0 ? 'आज ही' : ago + ' दिन पहले'}) आई थी।`, {
      say: `${x.name} की गाड़ी ${ago === 0 ? 'आज ही' : ago + ' दिन पहले'} आई थी।`
    });
  };

  /* ---------- STAFF & APP GUIDE SKILLS ---------- */
  SK['staff.day'] = async (p) => {
    const date = p.date || ctx.date || today();
    const [w, a] = await Promise.all([D.workers(), D.att(date)]);
    if (!w.length) return R('वर्कर लिस्ट अभी खाली है।');
    const st = {}; a.forEach(x => { st[x.workerId] = x.status; });
    const absent = w.filter(x => st[x.id] === 'absent');
    const present = w.filter(x => st[x.id] === 'present');
    return R(
      `👷 <b>${lbl(date)} की स्टाफ हाज़िरी:</b><br>` +
      `✔ ड्यूटी पर: <b>${present.map(x => esc(x.name)).join(', ') || 'कोई मार्क नहीं'}</b><br>` +
      `❌ छुट्टी पर: <b>${absent.map(x => esc(x.name)).join(', ') || 'कोई नहीं'}</b>`,
      {
        say: `${sayDate(date)} को ${absent.length ? absent.map(x => x.name).join(' और ') + ' छुट्टी पर हैं।' : 'कोई भी वर्कर छुट्टी पर नहीं है।'}`
      }
    );
  };

  SK['app.tour'] = async () => {
    const KB = APP.KB;
    const role = S.role || 'owner';
    return R(
      `📖 <b>माज़दा ऐप का पूरा नक्शा (${role === 'owner' ? 'मालिक' : 'मैनेजर'} व्यू):</b><br>` +
      `• <b>नीचे के मुख्य टैब:</b> ${esc(KB.TABS[role] || KB.TABS.owner)}<br><br>` +
      `• <b>हिसाब टैब:</b> रोज़ का मीटर (P1-P4, D1-D4), रेट, पेटीएम, स्वाइप, खर्चा और लॉक बटन।<br>` +
      `• <b>खाते टैब:</b> सभी पार्टियों का बकाया, उधार/जमा पर्ची, स्टेटमेंट और <b>पोर्टल कोड</b>।<br>` +
      `• <b>और (⚙) मेनू:</b> इसके अंदर CIBIL स्कोर, खरीद बिल/मार्जिन, टैंकर रिपोर्ट, रनशीट, वर्कर हाज़िरी और पूरा बैकअप है!`,
      {
        say: 'नीचे के मुख्य टैब हैं हिसाब, खाते, गाड़ी कैश, स्टॉक, मैनेजर डेस्क, निजी और मेनू। आप किसी भी बटन का नाम पूछिए, मैं उसका काम और जगह तुरंत बता दूँगी।',
        chips: [chip('🔑 पोर्टल कोड क्या है?', 'पार्टी के पोर्टल कोड'), chip('📤 कॉम्पैक्ट रिपोर्ट', 'कॉम्पैक्ट रिपोर्ट क्या है')]
      }
    );
  };

  SK['app.guide'] = async (p) => {
    if (p.btn) {
      const { sc, b } = p.btn;
      return R(
        `🔘 बटन: <b>${esc(b[0])}</b><br>` +
        `🛠 <b>क्या काम करता है:</b> ${esc(b[1])}।<br>` +
        `📍 <b>कहाँ मिलेगा:</b> ${esc(sc.name)} (${esc(sc.where)})`,
        {
          say: `${b[0]} बटन का काम है, ${b[1]}। यह आपको ${sc.name} में मिलेगा।`,
          chips: [{ label: `➡ ${sc.name} खोलें`, fn: () => goTo(sc.go) }]
        }
      );
    }
    if (p.sc) {
      const sc = p.sc;
      const btnList = (sc.buttons || []).map(b => `• <b>${esc(b[0])}</b>: ${esc(b[1])}`).join('<br>');
      return R(
        `📱 <b>${esc(sc.name)}</b><br>` +
        `📍 <b>कहाँ है:</b> ${esc(sc.where)}<br>` +
        `ℹ️ <b>काम:</b> ${esc(sc.what)}` +
        (btnList ? `<br><br><b>इस स्क्रीन के मुख्य बटन:</b><br>${btnList}` : ''),
        {
          say: `${sc.name}। यह ${sc.where} में है। ${sc.what}`,
          chips: [{ label: `➡ अभी खोलें`, fn: () => goTo(sc.go) }]
        }
      );
    }
    return SK['app.tour']();
  };

  /* ================= 7. SMART PARSER (Hindi Word Numbers & Voice Typos Fix) ================= */
  // Converts Hindi spoken number words ("एक".."इकतीस") & common voice typos into standard form
  const HINDI_WORD_TO_NUM = {
    'एक':'1','दो':'2','तीन':'3','चार':'4','पाँच':'5','पांच':'5','छह':'6','सात':'7','आठ':'8','नौ':'9','दस':'10',
    'ग्यारह':'11','बारह':'12','तेरह':'13','चौदह':'14','पंद्रह':'15','सोलह':'16','सत्रह':'17','अठारह':'18','उन्नीस':'19','बीस':'20',
    'इक्कीस':'21','बाईस':'22','तेईस':'23','चौबीस':'24','पच्चीस':'25','छब्बीस':'26','सत्ताईस':'27','अट्ठाईस':'28','उनतीस':'29','तीस':'30','इकतीस':'31',
    'ek':'1','do':'2','teen':'3','char':'4','chaar':'4','panch':'5','paanch':'5','chhah':'6','saat':'7','aath':'8','nau':'9','das':'10'
  };

  function preNormalizeVoiceInput(str) {
    let s = String(str || '');
    // Fix common Hindi/Hinglish voice recognition typos from screenshots!
    s = s.replace(/\bउधर\b/g, 'उधार')
         .replace(/\budhr\b/gi, 'udhar')
         .replace(/\bush\b/gi, 'us')
         .replace(/\bmiter\b/gi, 'meter')
         .replace(/\bnozele|nozzele|nozel\b/gi, 'nozzle')
         .replace(/\bतारीक|तारिख\b/g, 'तारीख');

    // Convert Hindi number words ("चार", "पाँच", etc.) when followed by तारीख / दिन
    Object.entries(HINDI_WORD_TO_NUM).forEach(([word, digit]) => {
      const rx = new RegExp(`(^|\\s)${word}(?=\\s*(?:तारीख|तारीक|tarik|tareekh|tarikh|दिन|din|डिप|dip))`, 'gi');
      s = s.replace(rx, `$1${digit}`);
    });
    return s;
  }

  function norm(s) {
    return preNormalizeVoiceInput(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const EN_TO_HI_NAMES = {
    'pappu': 'पप्पू', 'singh': 'सिंह', 'adhikari': 'अधिकारी',
    'deepak': 'दीपक', 'dipak': 'दीपक', 'shah': 'शाह',
    'chandan': 'चंदन', 'dev': 'देव',
    'kishor': 'किशोर', 'kishore': 'किशोर', 'upadhyay': 'उपाध्याय',
    'ghanshyam': 'घनश्याम', 'tiwari': 'तिवारी',
    'diwan': 'दीवान', 'bisht': 'बिष्ट',
    'paras': 'पारस', 'sati': 'सती',
    'madhan': 'मधन', 'madan': 'मधन',
    'maa': 'माँ', 'nand': 'नंद', 'stone': 'स्टोन', 'crusher': 'क्रेसर', 'kresar': 'क्रेसर',
    'mohit': 'मोहित', 'negi': 'नेगी',
    'laxman': 'लक्ष्मण', 'lakshman': 'लक्ष्मण', 'bharda': 'भरड़ा'
  };

  const BLOCKED_PARTY_WORDS = new Set([
    'local','lokal','bina','party','gaadi','gadi','cash','लोकल','बिना','पार्टी','गाड़ी','कैश',
    'aaj','kal','parso','din','tarik','tareekh','date','purana','hisab','sale','bikri','bika',
    'petrol','diesel','nozzele','nozzle','trend','btao','batao','dikhao','kitna','kitne','kab','kyu','kyun',
    'pump','baje','khulta','band','malik','owner','mood','kaisa','baarish','mausam','dip','stock',
    'udhar','jama','khata','ledger','kholo','paytm','swipe','kharcha','chai','dg','inki','unka','inka',
    'aayi','aaya','gayi','baad','pehle','naam','mera','aapka','kon','kaun','hai','tha','hoga','sirf','only',
    'neeraj','shashank','bansal','button','screen','tab','report','compact','milan','lock','unlock',
    'portal','code','पोर्टल','कोड','कुल','उधर','रेट','rate','meter','miter'
  ]);

  function detectVehicle(raw, parties) {
    if (!parties || !parties.length) return { vKey: null, party: null };
    const up = String(raw || '').toUpperCase();
    const plate = up.match(/[A-Z]{2}\s*\d{1,2}\s*[A-Z]{0,3}\s*\d{4}/);
    if (plate) {
      const cl = plate[0].replace(/\s+/g, '');
      const p = parties.find(pt => (pt.vehicles || []).some(v => String(v).toUpperCase().replace(/\s+/g, '').includes(cl)));
      if (p) return { vKey: cl, party: p };
    }
    const four = up.match(/\b\d{4}\b/g) || [];
    for (const d of four) {
      if (new RegExp(`(PAYTM|SWIPE|P[1-4]|D[1-4]|DIP|TARIK|TAREEKH|202\\d)\\s*${d}`, 'i').test(up) && four.length === 1) continue;
      const p = parties.find(pt => (pt.vehicles || []).some(v => String(v).replace(/\D/g, '').endsWith(d)));
      if (p) return { vKey: d, party: p };
    }
    return { vKey: null, party: null };
  }

  async function findExplicitParty(raw, parties) {
    if (!parties || !parties.length) return null;
    const vCheck = detectVehicle(raw, parties);
    if (vCheck.party) {
      ctx.vehicle = vCheck.vKey;
      return vCheck.party;
    }
    const tokens = norm(raw).split(' ').filter(w => w.length >= 3 && !BLOCKED_PARTY_WORDS.has(w) && !/^\d+$/.test(w));
    if (!tokens.length) return null;

    const searchSet = new Set();
    tokens.forEach(t => {
      searchSet.add(t);
      if (EN_TO_HI_NAMES[t]) searchSet.add(EN_TO_HI_NAMES[t]);
    });

    let bestP = null, bestScore = 0;
    for (const p of parties) {
      if (/लोकल|बिना पार्टी/i.test(p.name) && !/गाड़ी कैश खाता|gadi cash khata/i.test(raw)) continue;
      const pWords = norm(p.name).split(' ').filter(w => w.length >= 2);
      let score = 0;
      searchSet.forEach(tok => {
        if (pWords.includes(tok)) score += 50;
        else if (tok.length >= 4 && pWords.some(pw => pw.startsWith(tok) || tok.startsWith(pw))) score += 25;
      });
      if (score > bestScore && score >= 45) {
        bestScore = score;
        bestP = p;
      }
    }
    return bestP;
  }

  function extractDateOrRange(raw) {
    const cleanStr = preNormalizeVoiceInput(raw);
    const q = norm(cleanStr);
    const t = today();

    // 1. Explicit DD/MM/YYYY or DD-MM-YYYY
    let m = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/.exec(cleanStr);
    if (m) {
      let d = Number(m[1]), mo = Number(m[2]), yr = m[3] ? Number(m[3]) : Number(t.slice(0, 4));
      if (yr < 100) yr += 2000;
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return { kind: 'day', date: `${yr}-${pad(mo)}-${pad(d)}`, explicit: true };
      }
    }

    // 2. "10 din purana" / "चार दिन पहले"
    m = /(\d{1,3})\s*(?:din|day|days|दिन)\s*(?:pehle|pahle|purana|purani|purane|पहले|पुराना)/i.exec(cleanStr);
    if (m) {
      return { kind: 'day', date: shift(t, -Number(m[1])), explicit: true };
    }

    // 3. "4 tarik" / "चार तारीख" / "पाँच तारीख"
    m = /(\d{1,2})\s*(?:tarik|tareekh|tarikh|तारीख|तारीक|तारिख)/i.exec(cleanStr);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
      let yr = Number(t.slice(0, 4)), mo = Number(t.slice(5, 7)), dayNum = Number(m[1]);
      if (dayNum > Number(t.slice(8, 10))) { mo -= 1; if (mo < 1) { mo = 12; yr -= 1; } }
      return { kind: 'day', date: `${yr}-${pad(mo)}-${pad(dayNum)}`, explicit: true };
    }

    // 4. Relative Days: Parso, Kal, Aaj
    if (/\b(parso|parson|परसों)\b/i.test(q)) return { kind: 'day', date: shift(t, -2), explicit: true };
    if (/\b(kal|yesterday|कल)\b/i.test(q)) return { kind: 'day', date: shift(t, -1), explicit: true };
    if (/\b(aaj|aj|today|abhi|आज|अभी)\b/i.test(q)) return { kind: 'day', date: t, explicit: true };

    // 5. Sticky Reference ("us din", "ush din", "usi tarikh", "उस दिन")
    if (/\b(us din|uss din|ush din|usi din|us tarikh|us tareekh|usi tarikh|उस दिन|उसी दिन|उस तारीख)\b/i.test(q) && ctx.date) {
      return { kind: 'day', date: ctx.date, explicit: true };
    }

    // 6. Month / Week Ranges
    if (/\b(pichle mahine|pichhle mahine|last month|पिछले महीने)\b/i.test(q)) {
      const end = shift(monthStart(t), -1);
      return { kind: 'range', range: { from: monthStart(end), to: end, label: 'पिछले महीने' } };
    }
    if (/\b(is mahine|iss mahine|mahine|this month|इस महीने|महीने)\b/i.test(q)) {
      return { kind: 'range', range: { from: monthStart(t), to: t, label: 'इस महीने' } };
    }
    if (/\b(is hafte|hafte|week|इस हफ्ते|हफ्ते)\b/i.test(q)) {
      return { kind: 'range', range: { from: shift(t, -6), to: t, label: 'पिछले 7 दिन' } };
    }

    return null;
  }

  async function extractAmounts(raw, parties, excludeVehicle) {
    let str = preNormalizeVoiceInput(raw).toLowerCase();
    str = str.replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, ' ');
    str = str.replace(/\b\d{1,2}\s*(?:tarik|tareekh|tarikh|तारीख|तारीक|दिन)\b/gi, ' ');
    str = str.replace(/[a-z]{2}\s*\d{1,2}\s*[a-z]{0,3}\s*\d{4}/gi, ' ');
    str = str.replace(/\b(p[1-4]|d[1-4])\b/gi, ' ');
    if (excludeVehicle) str = str.replace(new RegExp(`\\b${excludeVehicle}\\b`, 'gi'), ' ');

    const knownVehs = new Set();
    (parties || []).forEach(p => (p.vehicles || []).forEach(v => {
      const d = String(v).replace(/\D/g, '').slice(-4);
      if (d.length === 4) knownVehs.add(d);
    }));

    const words = str.split(/\s+/);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      let w = words[i].replace(/[,₹]/g, '');
      if (/^\d{4}$/.test(w) && knownVehs.has(w)) {
        if (!/paytm|swipe|udhar|jama|chai|dg|kharcha|rupaye|rs|का|रुपये|उधार|जमा/i.test(str)) continue;
      }
      let m = w.match(/^(\d+(?:\.\d+)?)(k|l|lakh|lac)?$/i);
      if (m) {
        let val = parseFloat(m[1]);
        const suf = (m[2] || '').toLowerCase();
        if (suf === 'k') val *= 1000;
        if (suf === 'l' || suf === 'lakh' || suf === 'lac') val *= 100000;
        if (words[i + 1] && /^(hazar|hajar|हज़ार|हजार)$/i.test(words[i + 1])) val *= 1000;
        if (words[i + 1] && /^(lakh|lac|लाख)$/i.test(words[i + 1])) val *= 100000;
        out.push(val);
      }
    }
    return out;
  }

  // Smarter App Guide Matcher (Splits button labels on '/' so "पोर्टल कोड" matches "🔑 पोर्टल कोड / भेजें")
  function matchAppGuide(raw) {
    const q = norm(raw);
    const screens = (APP.KB && APP.KB.SCREENS) || [];
    for (const sc of screens) {
      for (const b of (sc.buttons || [])) {
        // Split button name by '/' or '(' to match partial names like "पोर्टल कोड" or "Paid" or "जमा करें"
        const parts = b[0].split(/[\/()]/).map(s => norm(s)).filter(s => s.length >= 3);
        if (parts.some(part => q.includes(part))) {
          return { btn: { sc, b } };
        }
      }
    }
    if (/button|tab|screen|portal|code|compact|milan|kya karta|kya hai|kahan|कहाँ|क्या करता|बटन|स्क्रीन|टैब|पोर्टल|कोड|कॉम्पैक्ट|मिलान/i.test(q)) {
      for (const sc of screens) {
        const kwList = (sc.kw + ' ' + norm(sc.name)).split(/\s+/).filter(w => w.length >= 3);
        if (kwList.some(k => q.includes(k))) return { sc };
      }
    }
    return null;
  }

  /* ================= 8. MAIN ROUTER & ENTRY HANDLERS ================= */
  async function handleQuery(rawText, ui) {
    const raw = preNormalizeVoiceInput(rawText).trim();
    const q = norm(raw);
    const parties = await D.parties();

    // ------------------------------------------------------------------
    // 0. PENDING CONFIRMATION (Haan / Radd)
    // ------------------------------------------------------------------
    if (ctx.pending) {
      if (/^(haan|yes|ha|ok|theek|sahi|kar do|save|हाँ|हां|जी|सही|कर दो)$/i.test(q)) {
        return await commitPending(ui);
      }
      if (/^(nahi|no|cancel|radd|mat|stop|नहीं|ना|रद्द|मत)$/i.test(q)) {
        ctx.pending = null;
        return R('ठीक है, मैंने वह एंट्री रद्द कर दी है। आगे बताइए?', { say: 'ठीक है, मैंने वह एंट्री रद्द कर दी है। आगे बताइए?' });
      }
      ctx.pending = null;
    }

    // ------------------------------------------------------------------
    // 1. FOCUS LOCK MODE ("Abhi sirf hisab likhna" / "Only udhar")
    // ------------------------------------------------------------------
    if (/\b(focus hatao|sab baat karo|normal mode|lock hatao|फोकस हटाओ|नॉर्मल मोड)\b/i.test(q)) {
      ctx.focusMode = null;
      if (ui && ui.updateFocusBadge) ui.updateFocusBadge();
      return R('🔓 <b>फ़ोकस मोड हटा दिया गया है।</b> अब आप पंप से जुड़ा कोई भी सवाल या विश्लेषण पूछ सकते हैं!', {
        say: 'फ़ोकस मोड हटा दिया गया है। अब आप कोई भी सवाल पूछ सकते हैं।'
      });
    }

    if (/\b(sirf|only|kewal|सिर्फ|सिर्फ़|केवल)\b/i.test(q) && /\b(hisab|entry|udhar|reading|likhna|likho|kaam|हिसाब|एंट्री|उधार|लिखना|लिखो)\b/i.test(q)) {
      ctx.focusMode = 'ENTRY';
      if (ui && ui.updateFocusBadge) ui.updateFocusBadge();
      return R('🎯 <b>फ़ोकस मोड चालू (सिर्फ़ हिसाब और एंट्री):</b><br>अब मैं बाहर की किसी भी बात पर ध्यान नहीं दूँगी। आप सीधे बोलिए: <b>"P1 4500"</b>, <b>"Paytm 1200"</b>, <b>"Chai 70"</b> या <b>"9769 में 5000 उधार"</b>।<br><small>(बाहर निकलने के लिए कहें: "फ़ोकस हटाओ")</small>', {
        say: 'जी बिल्कुल! मैंने फ़ोकस मोड चालू कर लिया है। अब मैं सिर्फ़ हिसाब और एंट्री लिखूँगी। आप सीधे रीडिंग, पेटीएम या उधार बोलिए।'
      });
    }

    // ------------------------------------------------------------------
    // 2. STRICT DELETE BLOCKER
    // ------------------------------------------------------------------
    if (/\b(remove|delete|hatao|mita|डिलीट|हटाओ|मिटाओ)\b/i.test(q)) {
      return R('⚠️ माफ़ कीजिए, मैं कोई भी एंट्री delete नहीं कर सकती। यह अधिकार सिर्फ owner (शशांक बंसल जी) के पास है।', {
        say: 'माफ़ कीजिए, मैं कोई भी एंट्री डिलीट नहीं कर सकती। यह अधिकार सिर्फ ओनर के पास है।'
      });
    }

    // स्मार्ट दिमाग (assistant_brain.js): इरादा समझकर जवाब; न मिले तो पुराना इंजन आगे चलता है
    if (APP.AsstBrain) { try { const br = await APP.AsstBrain.route(raw, q, ui); if (br) return br; } catch (e) { console.warn('brain', e); } }

    // ------------------------------------------------------------------
    // 3. DATE & STICKY CONTEXT DETECTION FIRST
    // ------------------------------------------------------------------
    const dtInfo = extractDateOrRange(raw);
    const hasStickyDayRef = /\b(us din|uss din|ush din|usi din|us tarikh|उस दिन|उसी दिन|उस तारीख|तब)\b/i.test(q);
    const targetDate = (dtInfo && dtInfo.date) || (hasStickyDayRef ? ctx.date : null);

    // ------------------------------------------------------------------
    // 4. SPECIFIC NOZZLE QUERY vs METER ENTRY ("Ush din p1 miter kitna tha" vs "P1 4500")
    // ------------------------------------------------------------------
    const nzMatch = q.match(/\b(p[1-4]|d[1-4])\b/i);
    if (nzMatch) {
      const nzKey = nzMatch[0].toLowerCase();
      const amounts = await extractAmounts(raw, parties, null);
      const isAskingQuestion = /\b(kitna|kya|tha|thi|batao|dikhao|कितना|क्या|था|बताओ|दिखाओ)\b/i.test(q) || hasStickyDayRef;
      if (amounts[0] && !isAskingQuestion) {
        return await prepMeterEntry(nzKey, amounts[0]);
      }
      // User is asking for the meter reading of P1/D1 on that date!
      return await SK['nozzle.day']({ date: targetDate || today(), nozzleKey: nzKey });
    }

    // ------------------------------------------------------------------
    // 5. DAILY ENTRIES (Paytm/Swipe/Kharcha)
    // ------------------------------------------------------------------
    if (/\b(paytm|swipe|kharcha|chai|dg|पेटीएम|स्वाइप|खर्चा|चाय)\b/i.test(q)) {
      const amounts = await extractAmounts(raw, parties, null);
      if (amounts[0]) return await prepDailyEntry(q, amounts[0]);
    }

    // ------------------------------------------------------------------
    // 6. TOTAL MARKET UDHAR SUMMARY (Fixes "पार्टी के कुल उधर" -> Now checked BEFORE single party entry!)
    // ------------------------------------------------------------------
    if (/(kul|total|market|sabse jyada|top|sari party|पार्टी के कुल|कुल|मार्केट|सबसे ज्यादा).*(udhar|baaki|उधार|बाकी)/i.test(q) || /^(udhar|kul udhar|कुल उधार|पार्टी के कुल उधार)$/i.test(q)) {
      return await SK['udhar.total']();
    }

    // ------------------------------------------------------------------
    // 7. APP KNOWLEDGE BASE (Fixes "पार्टी के पोर्टल कोड" -> Checked before Udhar Entry!)
    // ------------------------------------------------------------------
    if (/(app me kya|app ka tour|sari screen|सारी स्क्रीन|ऐप में क्या|ऐप का टूर)/i.test(q)) {
      return await SK['app.tour']();
    }
    const guideMatch = matchAppGuide(raw);
    if (guideMatch) {
      return await SK['app.guide'](guideMatch);
    }

    // ------------------------------------------------------------------
    // 8. UDHAR / JAMA ENTRY
    // ------------------------------------------------------------------
    if (/\b(udhar|jama|likho|likhna|chadao|dalna|उधार|जमा|लिखो|चढ़ाओ)\b/i.test(q)) {
      if (!/\b(kul|total|kitna|batao|dikhao|top|sabse|कुल|कितना|बताओ|दिखाओ)\b/i.test(q)) {
        return await prepLedgerEntry(raw, parties);
      }
    }

    // Focus Mode Guard
    if (ctx.focusMode === 'ENTRY') {
      const vCheck = detectVehicle(raw, parties);
      const pFound = vCheck.party || (await findExplicitParty(raw, parties));
      const amounts = await extractAmounts(raw, parties, vCheck.vKey);
      if (pFound && amounts[0]) {
        ctx.party = pFound;
        if (vCheck.vKey) ctx.vehicle = vCheck.vKey;
        return await prepLedgerEntry(raw, parties);
      }
      if (pFound) {
        ctx.party = pFound;
        if (vCheck.vKey) ctx.vehicle = vCheck.vKey;
        return R(`🎯 <b>${esc(pFound.name)}</b> चुना गया। अब सीधे रकम बोलिए (जैसे <b>"5000 उधार"</b> या <b>"10000 जमा"</b>)।`, {
          say: `${pFound.name} का खाता चुना गया। कितने रुपये उधार या जमा लिखने हैं?`
        });
      }
      return R('🎯 अभी <b>"सिर्फ़ हिसाब लिखना" (फ़ोकस मोड)</b> चालू है। कृपया सीधे एंट्री बोलें—जैसे <b>"P1 4500"</b>, <b>"Paytm 500"</b>, या <b>"9769 में 2000 उधार"</b>।', {
        say: 'अभी फ़ोकस मोड चालू है। कृपया सीधे रीडिंग, पेटीएम या उधार की रकम बोलिए।',
        chips: [{ label: '🔓 फ़ोकस मोड हटाएँ', q: 'फ़ोकस हटाओ' }]
      });
    }

    // ------------------------------------------------------------------
    // 9. IDENTITY, CREATOR (NEERAJ DEV) & OWNER (SHASHANK BANSAL) LORE
    // ------------------------------------------------------------------
    if (/neeraj|नीरज/i.test(q)) {
      if (/aawaj|voice|sunti|सुनती|आवाज़/i.test(q)) return SK.about({ what: 'maker_voice' });
      if (/kaise banaya|kaise janti|kaun hai|kon hai|कैसे बनाया|कैसे जानती|कौन है/i.test(q)) return SK.about({ what: 'maker_how' });
      return SK.about({ what: 'maker' });
    }
    if (/(tumhara|aapka|tera|tujhe).*(owner|malik|किसने|मालिक)|kisne banaya|who made you|किसने बनाया/i.test(q)) {
      return SK.about({ what: 'maker' });
    }
    if (/malik|owner|shashank|बॉस|मालिक/i.test(q) && /mood|khush|gussa|kaisa|मूड|खुश|गुस्सा/i.test(q)) {
      const d = await D.day(today());
      const sv = d && d.sum ? n(d.sum.sale) : 0;
      return R(`😄 मालिक <b>${PERSON.owner}</b> जी का मूड तो पंप के मीटर और साफ हिसाब से बनता है! आज अब तक <b>${M(sv)}</b> की सेल हो चुकी है। हिसाब टनाटन रखिए, मालिक हमेशा खुश रहेंगे!`, {
        say: `मालिक ${PERSON.owner} जी का मूड तो पंप के साफ हिसाब से बनता है। आज अब तक ${M(sv)} की सेल हो चुकी है।`
      });
    }
    if (/(pump|mazda|company).*(owner|malik|kiska|shashank|मालिक|किसका)/i.test(q)) {
      return SK.about({ what: 'owner' });
    }
    if (/(mera naam|main kaun|who am i|मेरा नाम|मैं कौन)/i.test(q)) {
      return SK.about({ what: 'me' });
    }
    if (/(kya kya kar sakti|kya kaam kar sakti|tumhara kaam|help|मदद|क्या क्या कर सकती|क्या काम)/i.test(q)) {
      return SK.help();
    }
    if (/(tum|aap).*(kaun|kya|kahan)|who are you|तुम कौन/i.test(q)) {
      return SK.about({ what: 'self' });
    }

    // ------------------------------------------------------------------
    // 10. STANDALONE VEHICLE QUICK LOOKUP (e.g. "9769")
    // ------------------------------------------------------------------
    if (/^\d{4}$/.test(q) || /^[a-z]{2}\s*\d{1,2}\s*[a-z]{0,3}\s*\d{4}$/i.test(q)) {
      const vCheck = detectVehicle(raw, parties);
      if (vCheck.party) {
        ctx.party = vCheck.party;
        ctx.vehicle = vCheck.vKey;
        return R(
          `🚗 गाड़ी <b>${esc(vCheck.vKey)}</b> पार्टी <b>${esc(vCheck.party.name)}</b> की है।<br>` +
          `वर्तमान बकाया: <b class="neg">${M(vCheck.party.bal)}</b><br><br>` +
          `बताइए, इसमें कितने का उधार लिखना है या इनका खाता खोलूँ?`,
          {
            say: `गाड़ी ${vCheck.vKey} पार्टी ${vCheck.party.name} की है। इनका बकाया ${M(vCheck.party.bal)} है। बताइए, इसमें क्या एंट्री करनी है?`,
            chips: [
              cs('📒 खाता खोलें', 'party.ledger', { party: vCheck.party }),
              cs('📅 गाड़ी कब आई थी?', 'party.visit', { party: vCheck.party }),
              chip('➕ ₹2000 उधार', `${vCheck.vKey} में 2000 का उधार`)
            ]
          }
        );
      }
      return R(`गाड़ी नंबर <b>${esc(raw.toUpperCase())}</b> किसी भी पार्टी के खाते में रजिस्टर्ड नहीं मिली।`, {
        say: 'यह गाड़ी नंबर किसी भी पार्टी के खाते में नहीं मिला।'
      });
    }

    // ------------------------------------------------------------------
    // 11. DIP CHART LOOKUP ("45 dip mai diesel")
    // ------------------------------------------------------------------
    if (/\b(dip|डिप)\b/i.test(q)) {
      const dm = q.match(/\b(\d+(?:\.\d+)?)\b/);
      if (dm) {
        const fuel = /diesel|hsd|डीजल|डीज़ल/i.test(q) ? 'diesel' : (/petrol|ms|पेट्रोल/i.test(q) ? 'petrol' : null);
        return SK.dip({ dipVal: parseFloat(dm[1]), fuel });
      }
    }

    // ------------------------------------------------------------------
    // 12. RATE, NOZZLE, STOCK & SALE QUERIES (Supports Sticky Date!)
    // ------------------------------------------------------------------
    // Fuel Rate Query ("Us din ka rate kya tha", "petrol ka rate")
    if (/\b(rate|bhav|daam|kimat|रेट|भाव|दाम)\b/i.test(q)) {
      return await SK['rate.day']({ date: targetDate || today() });
    }

    // Nozzle / Meter Trend ("Nozzle trend", "Us din meter kitna tha")
    if (/\b(nozzle|meter|reading|नोजल|नोज़ल|मीटर|रीडिंग)\b/i.test(q)) {
      return await SK['nozzle.day']({ date: targetDate || today() });
    }

    // Peak Season / Best Day / Low Diesel Days
    if (/\b(peak season|पीक सीजन|पीक सीज़न)\b/i.test(q)) return await SK.peak();
    if (/\b(best sale|sabse jyada sale|top sale|बेस्ट सेल|सबसे ज्यादा बिक्री)\b/i.test(q)) {
      return await SK['sale.best']({ range: dtInfo && dtInfo.range });
    }
    if (/\b(kam diesel|low diesel|कम डीजल|कम डीज़ल)\b/i.test(q)) {
      return await SK['sale.low']({ fuel: 'diesel', range: dtInfo && dtInfo.range });
    }

    // Why Sale Low / High
    if (/\b(sale|bikri|bika|petrol|diesel|सेल|बिक्री|बिका|पेट्रोल|डीज़ल)\b/i.test(q) && /\b(kyu|kyun|kyo|क्यों|क्युं)\b/i.test(q)) {
      return await SK['why.sale']({ date: targetDate || today() });
    }

    // Stock / Tanker Queries
    if (/\b(tanker|टैंकर)\b/i.test(q)) return await SK['tanker.last']();
    if (/\b(stock|tank|tanki|स्टॉक|टैंक|टंकी|कितना तेल बचा)\b/i.test(q)) {
      const f = /diesel|डीजल|डीज़ल/i.test(q) ? 'diesel' : (/petrol|पेट्रोल/i.test(q) ? 'petrol' : null);
      if (f) ctx.fuel = f;
      return await SK.stock({ fuel: f, date: targetDate, useStickyDate: hasStickyDayRef });
    }

    // Cash / Galla Split
    if (/\b(galla|cash split|bantwara|गल्ला|नकद कितना)\b/i.test(q)) {
      return await SK['cash.split']({ date: targetDate || today() });
    }

    // Sale Queries ("चार तारीख की सेल", "पाँच तारीख की सेल", "आज की सेल", "उस दिन की सेल")
    if (/\b(sale|bikri|bika|dhandha|hisab|सेल|बिक्री|बिका|धंधा|हिसाब)\b/i.test(q) || (dtInfo && dtInfo.explicit)) {
      if (dtInfo && dtInfo.kind === 'range') return await SK['sale.day']({ range: dtInfo.range });
      return await SK['sale.day']({ date: targetDate || today() });
    }

    // ------------------------------------------------------------------
    // 13. STAFF ATTENDANCE
    // ------------------------------------------------------------------
    if (/\b(staff|worker|hajiri|haziri|attendance|chutti|वर्कर|स्टाफ|हाज़िरी|छुट्टी)\b/i.test(q)) {
      return await SK['staff.day']({ date: targetDate || today() });
    }

    // ------------------------------------------------------------------
    // 14. PARTY VISIT HISTORY & PRONOUN FOLLOW-UPS
    // ------------------------------------------------------------------
    if (/\b(kitne din baad|kab aayi|kab aaye|pichli baar|aakhiri baar|कितने दिन बाद|कब आई|पिछली बार|आखिरी बार)\b/i.test(q)) {
      const p = (await findExplicitParty(raw, parties)) || ctx.party;
      return await SK['party.visit']({ party: p });
    }

    if (/\b(inka|uska|iski|uski|unko|unka|inki|इनका|उसका|उनका|इनकी)\b/i.test(q) || /\b(khata kholo|ledger kholo|खाता खोलो)\b/i.test(q)) {
      if (ctx.party) {
        if (/khata|ledger|खाता/i.test(q)) return await SK['party.ledger']({ party: ctx.party });
        return await SK['party.info']({ party: ctx.party });
      }
      if (ctx.date) {
        return await SK['sale.day']({ date: ctx.date });
      }
      return R('आप किस पार्टी या तारीख की बात कर रहे हैं? कृपया एक बार नाम या तारीख बताइए।', {
        say: 'आप किस पार्टी या तारीख की बात कर रहे हैं? कृपया एक बार नाम या तारीख बताइए।'
      });
    }

    const explicitParty = await findExplicitParty(raw, parties);
    if (explicitParty) {
      ctx.party = explicitParty;
      const amounts = await extractAmounts(raw, parties, ctx.vehicle);
      if (amounts[0] && /\b(में|mein|me|ka|का)\b/i.test(q)) {
        return await prepLedgerEntry(raw, parties);
      }
      return await SK['party.info']({ party: explicitParty });
    }

    // ------------------------------------------------------------------
    // 15. SMART PIVOTS & GREETINGS
    // ------------------------------------------------------------------
    if (/kitne baje|timing|khulta|band hota|कितने बजे|खुलता|बंद होता/i.test(q)) {
      return R('⛽ माज़दा ऑयल कंपनी पंप पर सुबह से रात तक लगातार सेवा चलती है। आप जब चाहें रीडिंग या उधार यहाँ दर्ज कर सकते हैं।', {
        say: 'माज़दा ऑयल कंपनी पंप पर सुबह से रात तक सेवा चलती है। आप जब चाहें हिसाब दर्ज कर सकते हैं।'
      });
    }

    if (/baarish|mausam|weather|rain|thand|garmi|dhoop|बारिश|मौसम|धूप|ठंड|गर्मी/i.test(q)) {
      const d = await D.day(today());
      const sv = d && d.sum ? M(d.sum.sale) : '₹0';
      return R(`🌤️ मौसम का तो बादल जानें, पर अपने पंप पर आज <b>${sv}</b> की सेल हो चुकी है! क्या आज का स्टॉक या नोज़ल ट्रेंड देखें?`, {
        say: `मौसम का तो पता नहीं, पर आज अपने पंप पर ${sv} की सेल हो चुकी है।`
      });
    }

    if (/match|cricket|ipl|score|मैच|क्रिकेट/i.test(q)) {
      const d = await D.day(today());
      const sv = d && d.sum ? M(d.sum.sale) : '₹0';
      return R(`🏏 मैच का स्कोर तो टीवी बताएगा, लेकिन आज अपने पंप का स्कोर <b>${sv}</b> पहुँच चुका है!`, {
        say: `मैच का स्कोर तो टीवी बताएगा, पर आज अपने पंप की सेल ${sv} हो चुकी है।`
      });
    }

    if (/thank|shukriya|dhanyawad|धन्यवाद|शुक्रिया|थैंक/i.test(q)) return await SK.thanks();
    if (/^(hi|hello|namaste|namaskar|hey|नमस्ते|नमस्कार|हेलो)$/i.test(q)) return await SK.greet();

    // ------------------------------------------------------------------
    // 16. CONFIDENT ROTATING FALLBACK LOOP
    // ------------------------------------------------------------------
    const fbList = [
      {
        html: `🤔 यह सवाल पंप के हिसाब से थोड़ा अलग है! मैं आपको <b>आज की सेल</b>, <b>चार तारीख की सेल</b>, <b>पार्टी का उधार</b>, <b>डिप स्टॉक</b> या <b>ऐप के किसी भी बटन का काम</b> तुरंत बता सकती हूँ। क्या दिखाऊँ?`,
        say: 'मैं आपको आज की सेल, किसी तारीख का हिसाब, पार्टी का उधार या ऐप के किसी भी बटन का काम तुरंत बता सकती हूँ। बताइए क्या दिखाऊँ?'
      },
      {
        html: `😊 मैं माज़दा पंप की डिजिटल मैनेजर हूँ! आप चाहें तो कोई गाड़ी नंबर (जैसे <b>9769</b>) बोलें, <b>"P1 4500"</b> से रीडिंग चढ़ाएँ, या <b>"अभी सिर्फ़ हिसाब लिखना"</b> बोलकर फ़ोकस मोड चालू कर लें!`,
        say: 'मैं माज़दा पंप की डिजिटल मैनेजर हूँ। आप कोई गाड़ी नंबर बोलें, या पी एक चार हज़ार पाँच सौ बोलकर सीधे रीडिंग चढ़ा लें।'
      }
    ];
    if (APP.AsstBrain) { try { const fb = await APP.AsstBrain.fallback(raw); if (fb) return fb; } catch (e) { console.warn('brain fb', e); } }
    const pickFb = fbList[ctx.brain.fallbackIdx % fbList.length];
    ctx.brain.fallbackIdx = (ctx.brain.fallbackIdx + 1) % fbList.length;
    saveBrain();
    return R(pickFb.html, { say: pickFb.say, chips: homeChips() });
  }

  /* ================= 9. ENTRY PREPARATION & DATABASE COMMIT ================= */
  async function prepMeterEntry(nozzleKey, closingVal) {
    const t = today();
    const d = await D.day(t);
    const openVal = (d && d.nz && d.nz[nozzleKey]) ? n(d.nz[nozzleKey].o) : 0;

    if (closingVal < openVal) {
      return R(`⚠️ <b>गलती!</b> नोज़ल <b>${nozzleKey.toUpperCase()}</b> की ओपनिंग रीडिंग <b>${openVal}</b> है, क्लोज़िंग रीडिंग ओपनिंग से कम नहीं हो सकती!`, {
        say: `गलती। नोज़ल ${nozzleKey.toUpperCase()} की ओपनिंग ${openVal} है, क्लोज़िंग कम नहीं हो सकती।`
      });
    }

    const sold = openVal > 0 ? closingVal - openVal : 0;
    ctx.pending = { type: 'METER', key: nozzleKey, value: closingVal, date: t };
    return R(
      `⛽ नोज़ल <b>${nozzleKey.toUpperCase()}</b> की क्लोज़िंग रीडिंग <b>${closingVal}</b> ${sold > 0 ? `(बिक्री: <b>${L(sold)}</b>)` : ''} दर्ज करनी है?<br>क्या इसे सेव कर दूँ?`,
      {
        say: `नोज़ल ${nozzleKey.toUpperCase()} की क्लोज़िंग रीडिंग ${closingVal} सेव करनी है, क्या यह सही है?`,
        chips: [
          { label: '✅ हाँ, सेव करें', fn: ui => commitPending(ui) },
          { label: '❌ रद्द करें', fn: ui => { ctx.pending = null; ui.bot(R('ठीक है, रद्द कर दिया।', { say: 'ठीक है, रद्द कर दिया।' })); } }
        ]
      }
    );
  }

  async function prepDailyEntry(q, val) {
    const t = today();
    if (/paytm|पेटीएम/i.test(q)) {
      ctx.pending = { type: 'DAILY_FIELD', field: 'paytm', value: val, date: t };
      return R(`💳 आज का <b>Paytm</b> कलेक्शन <b>${M(val)}</b> सेट करना है?`, {
        say: `क्या आज का पेटीएम कलेक्शन ${M(val)} सेट करना है?`,
        chips: [
          { label: '✅ हाँ, सेव करें', fn: ui => commitPending(ui) },
          { label: '❌ रद्द करें', fn: ui => { ctx.pending = null; ui.bot(R('रद्द कर दिया।', { say: 'रद्द कर दिया।' })); } }
        ]
      });
    }
    if (/swipe|स्वाइप/i.test(q)) {
      ctx.pending = { type: 'DAILY_FIELD', field: 'swipe', value: val, date: t };
      return R(`💳 आज का <b>Swipe</b> कलेक्शन <b>${M(val)}</b> सेट करना है?`, {
        say: `क्या आज का स्वाइप कलेक्शन ${M(val)} सेट करना है?`,
        chips: [
          { label: '✅ हाँ, सेव करें', fn: ui => commitPending(ui) },
          { label: '❌ रद्द करें', fn: ui => { ctx.pending = null; ui.bot(R('रद्द कर दिया।', { say: 'रद्द कर दिया।' })); } }
        ]
      });
    }
    let desc = 'अन्य खर्चा';
    if (/chai|चाय/i.test(q)) desc = 'चाय-नाश्ता';
    else if (/dg|generator|जनरेटर/i.test(q)) desc = 'DG जनरेटर';
    ctx.pending = { type: 'KHARCHA', desc, value: val, date: t };
    return R(`💸 खर्चा <b>${desc}</b> में <b>${M(val)}</b> दर्ज करना है?`, {
      say: `क्या खर्चा ${desc} में ${M(val)} दर्ज करना है?`,
      chips: [
        { label: '✅ हाँ, सेव करें', fn: ui => commitPending(ui) },
        { label: '❌ रद्द करें', fn: ui => { ctx.pending = null; ui.bot(R('रद्द कर दिया।', { say: 'रद्द कर दिया।' })); } }
      ]
    });
  }

  async function prepLedgerEntry(raw, parties) {
    const q = norm(raw);
    const isJama = /\b(jama|paid|wapas|जमा|वापस)\b/i.test(q) && !/\b(udhar|उधार)\b/i.test(q);
    const vCheck = detectVehicle(raw, parties);
    let p = vCheck.party || (await findExplicitParty(raw, parties)) || ctx.party;
    if (vCheck.vKey) ctx.vehicle = vCheck.vKey;

    if (!p) {
      return R(`किस पार्टी का ${isJama ? 'जमा' : 'उधार'} लिखना है? कृपया पार्टी का नाम या गाड़ी नंबर बताइए।`, {
        say: `किस पार्टी का ${isJama ? 'जमा' : 'उधार'} लिखना है? कृपया नाम या गाड़ी नंबर बताइए।`
      });
    }
    ctx.party = p;
    const amounts = await extractAmounts(raw, parties, vCheck.vKey || ctx.vehicle);
    const val = amounts[0];
    if (!val) {
      return R(`👤 <b>${esc(p.name)}</b> के खाते में कितने रुपये ${isJama ? 'जमा' : 'उधार'} लिखने हैं?`, {
        say: `${p.name} के खाते में कितने रुपये ${isJama ? 'जमा' : 'उधार'} लिखने हैं?`
      });
    }

    ctx.pending = {
      type: isJama ? 'JAMA' : 'UDHAR',
      party: p,
      amount: val,
      vehicle: vCheck.vKey || ctx.vehicle || '',
      date: today()
    };

    const kindTitle = isJama ? '🟢 जमा (भुगतान) एंट्री' : '🔴 उधार एंट्री';
    return R(
      `<b>${kindTitle}</b><br>` +
      `पार्टी: <b>${esc(p.name)}</b><br>` +
      (ctx.pending.vehicle ? `गाड़ी: <b>${esc(ctx.pending.vehicle)}</b><br>` : '') +
      `रकम: <b>${M(val)}</b><br><br>क्या मैं इसे सेव कर दूँ?`,
      {
        say: `${p.name} के खाते में ${M(val)} ${isJama ? 'जमा' : 'उधार'} दर्ज करना है। क्या मैं इसे सेव कर दूँ?`,
        chips: [
          { label: '✅ हाँ, सेव करें', fn: ui => commitPending(ui) },
          { label: '❌ रद्द करें', fn: ui => { ctx.pending = null; ui.bot(R('ठीक है, एंट्री रद्द कर दी।', { say: 'ठीक है, एंट्री रद्द कर दी।' })); } }
        ]
      }
    );
  }

  async function commitPending(ui) {
    const act = ctx.pending;
    if (!act) return;
    ctx.pending = null;
    if (!dbx()) return ui.bot(R('❌ डेटाबेस उपलब्ध नहीं है।'));

    try {
      if (act.type === 'METER') {
        await dbx().collection('days').doc(act.date).set({ [`nz.${act.key}.c`]: act.value }, { merge: true });
        D.clear();
        safeRecalc();
        return ui.bot(R(`✅ नोज़ल <b>${act.key.toUpperCase()}</b> की क्लोज़िंग रीडिंग <b>${act.value}</b> सेव हो गई! आगे बताइए?`, {
          say: `नोज़ल ${act.key.toUpperCase()} की क्लोज़िंग ${act.value} सेव हो गई। आगे बताइए?`
        }));
      }
      if (act.type === 'DAILY_FIELD') {
        await dbx().collection('days').doc(act.date).set({ [act.field]: act.value }, { merge: true });
        D.clear();
        safeRecalc();
        return ui.bot(R(`✅ आज का <b>${act.field.toUpperCase()}</b> कलेक्शन <b>${M(act.value)}</b> सफलतापूर्वक सेव हो गया!`, {
          say: `आज का ${act.field} कलेक्शन ${M(act.value)} सेव हो गया।`
        }));
      }
      if (act.type === 'KHARCHA') {
        const dRef = dbx().collection('days').doc(act.date);
        const dSnap = await dRef.get();
        let items = (dSnap.exists && Array.isArray(dSnap.data().kharchaItems)) ? dSnap.data().kharchaItems.slice() : [];
        items.push({ label: act.desc, amount: act.value });
        await dRef.set({ kharchaItems: items }, { merge: true });
        D.clear();
        safeRecalc();
        return ui.bot(R(`✅ खर्चा <b>${esc(act.desc)}</b> में <b>${M(act.value)}</b> सेव हो गया!`, {
          say: `खर्चा ${act.desc} में ${M(act.value)} सेव हो गया।`
        }));
      }
      if (act.type === 'UDHAR' || act.type === 'JAMA') {
        const isJama = act.type === 'JAMA';
        const delta = isJama ? -Math.abs(act.amount) : Math.abs(act.amount);
        const batch = dbx().batch();
        const lRef = dbx().collection('ledger').doc();
        const serverTS = (APP.FV && APP.FV.serverTimestamp) ? APP.FV.serverTimestamp() : new Date();
        const incFn = (APP.FV && APP.FV.increment) ? APP.FV.increment(delta) : delta;

        batch.set(lRef, {
          partyId: act.party.id,
          partyName: act.party.name,
          date: act.date,
          time: (typeof APP.nowTime === 'function') ? APP.nowTime() : '12:00',
          kind: isJama ? 'jama' : 'udhar',
          amount: Math.abs(act.amount),
          vehicle: act.vehicle || '',
          fuel: '',
          rate: 0,
          litre: 0,
          note: 'Assistant entry',
          by: S.user ? S.user.email : 'assistant',
          at: serverTS
        });
        batch.update(dbx().collection('parties').doc(act.party.id), { bal: incFn });
        await batch.commit();
        if (S.parties) S.parties.pub = null;
        D.clear();
        safeRecalc();

        return ui.bot(R(`✅ <b>${esc(act.party.name)}</b> के खाते में <b>${M(act.amount)}</b> ${isJama ? 'जमा' : 'उधार'} दर्ज हो गया!`, {
          say: `${act.party.name} के खाते में ${M(act.amount)} ${isJama ? 'जमा' : 'उधार'} दर्ज हो गया।`,
          chips: [cs('📒 खाता खोलें', 'party.ledger', { party: act.party })]
        }));
      }
    } catch (e) {
      return ui.bot(R(`❌ सेव नहीं हो पाया: ${esc(e.message)}`, { say: 'माफ़ कीजिए, डेटा सेव नहीं हो पाया।' }));
    }
  }

  /* ================= 10. AUTOMATED OWNER / MANAGER PROACTIVE BRIEFING ================= */
  async function generateSmartBriefing() {
    const h = new Date().getHours();
    const wish = h < 12 ? 'सुप्रभात' : h < 17 ? 'नमस्कार' : 'शुभ संध्या';
    const roleTitle = S.role === 'owner' ? `मालिक (${PERSON.owner} जी)` : (S.role === 'manager' ? 'मैनेजर' : '');

    try {
      const [dToday, dYest, ps, sn] = await Promise.all([
        D.day(today()),
        D.day(shift(today(), -1)),
        D.parties(),
        stockNow()
      ]);

      const alerts = [];
      const sayAlerts = [];

      const tSale = dToday && dToday.sum ? n(dToday.sum.sale) : 0;
      const ySale = dYest && dYest.sum ? n(dYest.sum.sale) : 0;
      if (tSale > 0) {
        alerts.push(`📊 <b>आज की लाइव सेल:</b> ${M(tSale)}`);
        sayAlerts.push(`आज अब तक ${M(tSale)} की सेल हो चुकी है`);
      } else if (ySale > 0) {
        alerts.push(`📈 <b>कल की कुल सेल:</b> ${M(ySale)} <small>(आज की क्लोज़िंग बाकी है)</small>`);
        sayAlerts.push(`कल की कुल सेल ${M(ySale)} रही थी`);
      }

      if (sn) {
        if (sn.D > 0 && sn.D < 2500) {
          alerts.push(`⚠️ <b class="neg">कम डीज़ल अलर्ट:</b> टैंक में सिर्फ़ ${L(sn.D)} डीज़ल बचा है!`);
          sayAlerts.push(`ध्यान दीजिए, डीज़ल स्टॉक कम है, सिर्फ़ ${r0(sn.D)} लीटर बचा है`);
        } else if (sn.P > 0 && sn.P < 1800) {
          alerts.push(`⚠️ <b class="neg">कम पेट्रोल अलर्ट:</b> टैंक में सिर्फ़ ${L(sn.P)} पेट्रोल बचा है!`);
          sayAlerts.push(`पेट्रोल स्टॉक सिर्फ़ ${r0(sn.P)} लीटर बचा है`);
        }
      }

      const overLim = (ps || []).filter(x => n(x.limit) > 0 && n(x.bal) > n(x.limit));
      const due = owing(ps);
      const totDue = sumBy(due, x => x.bal);
      if (overLim.length > 0) {
        alerts.push(`🚨 <b>उधार अलर्ट:</b> ${overLim.length} पार्टियाँ क्रेडिट लिमिट पार हैं (कुल बकाया: ${M(totDue)})`);
      } else if (totDue > 0) {
        alerts.push(`📒 <b>कुल मार्केट उधार:</b> ${M(totDue)} <small>(टॉप: ${due[0] ? esc(due[0].name) : ''})</small>`);
      }

      const bodyHtml = alerts.length
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d5dfef;font-size:13px;">${alerts.join('<br>')}</div>`
        : `<br><small>आप बोलकर रीडिंग (<b>P1 4500</b>), <b>Paytm 500</b>, या किसी भी पार्टी का उधार लिखवा सकते हैं।</small>`;

      const spoken = `${wish}! मैं माज़दा असिस्टेंट हूँ। ${sayAlerts.join('। ')}। बताइए, अभी क्या देखना है?`;
      return R(`🤖 <b>${wish}${roleTitle ? ' ' + roleTitle : ''}!</b> मैं माज़दा असिस्टेंट हूँ।${bodyHtml}`, {
        say: spoken,
        chips: homeChips()
      });
    } catch (e) {
      return SK.greet();
    }
  }

  /* ================= 11. UI MODAL & GLOWING 🤖 ROBOT FAB ================= */
  function injectRobotFAB() {
    let existing = document.getElementById('ai-assist-fab');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.textContent = `
      @keyframes mazdaBotPulse {
        0% { box-shadow: 0 0 0 0 rgba(244, 180, 26, 0.7), 0 6px 20px rgba(11, 61, 145, 0.5); transform: translateY(0px); }
        50% { box-shadow: 0 0 0 10px rgba(244, 180, 26, 0), 0 10px 24px rgba(11, 61, 145, 0.65); transform: translateY(-3px); }
        100% { box-shadow: 0 0 0 0 rgba(244, 180, 26, 0), 0 6px 20px rgba(11, 61, 145, 0.5); transform: translateY(0px); }
      }
      #ai-assist-fab {
        position: fixed; bottom: 78px; right: 16px; width: 62px; height: 62px;
        border-radius: 50%; background: linear-gradient(135deg, #07255c 0%, #0b3d91 55%, #1a66e0 100%);
        color: #fff; font-size: 30px; border: 2.5px solid #f4b41a;
        z-index: 9999; cursor: pointer; display: flex; align-items: center; justify-content: center;
        animation: mazdaBotPulse 3s infinite ease-in-out; user-select: none;
      }
      #ai-assist-fab::after {
        content: 'AI'; position: absolute; bottom: -4px; right: -2px;
        background: #f4b41a; color: #07255c; font-size: 10px; font-weight: 800;
        padding: 1px 5px; border-radius: 8px; border: 1.5px solid #fff;
      }
    `;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'ai-assist-fab';
    fab.innerHTML = '🤖';
    fab.title = 'माज़दा AI असिस्टेंट';
    fab.onclick = () => openAssistant();
    document.body.appendChild(fab);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(injectRobotFAB, 700);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(injectRobotFAB, 700));
  }

  function openAssistant() {
    if (document.getElementById('assist-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'assist-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(7,22,56,0.82);backdrop-filter:blur(5px);z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:24px 24px 0 0;padding:15px 16px 18px;max-height:89vh;display:flex;flex-direction:column;box-shadow:0 -8px 30px rgba(0,0,0,0.35);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0b3d91,#1a5fd0);display:flex;align-items:center;justify-content:center;font-size:20px;border:1.5px solid #f4b41a;">🤖</div>
            <div>
              <h3 style="margin:0;color:#0b3d91;font-size:16.5px;font-weight:800;display:flex;align-items:center;gap:6px;">
                माज़दा असिस्टेंट
                <span style="background:#e8f5e9;color:#1b8a3d;font-size:10px;padding:2px 6px;border-radius:8px;border:1px solid #a5d6a7;">v9.5 Live</span>
                <span id="a-focus-badge" style="display:none;background:#ffebee;color:#c62828;font-size:10.5px;padding:2px 7px;border-radius:10px;border:1px solid #ef9a9a;">🎯 सिर्फ़ हिसाब</span>
              </h3>
              <div style="font-size:11px;color:#5f6c85;">Smart Pump Manager · Always Ready</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="a-tts" title="आवाज़ चालू/बंद" style="background:#f4f6fa;border:1px solid #d0d7e5;border-radius:50%;width:36px;height:36px;font-size:17px;cursor:pointer;">🔊</button>
            <button id="a-close" title="बंद करें" style="background:#f4f6fa;border:1px solid #d0d7e5;border-radius:50%;width:36px;height:36px;font-size:16px;cursor:pointer;">✖</button>
          </div>
        </div>
        <div id="a-chat" style="flex:1;overflow-y:auto;background:#f4f6fa;border-radius:14px;padding:12px;margin-bottom:10px;min-height:175px;max-height:48vh;font-size:14px;display:flex;flex-direction:column;gap:10px;"></div>
        <div id="a-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;min-height:34px;"></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="a-input" placeholder="यहाँ लिखें या 🎤 दबाकर बोलें..." style="flex:1;border:1.5px solid #c9d3e6;border-radius:12px;padding:12px 14px;font-size:14px;outline:none;">
          <button id="a-mic" title="बोलकर पूछें" style="width:48px;height:48px;border-radius:50%;background:#f4b41a;border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(244,180,26,0.4);">🎤</button>
          <button id="a-send" title="भेजें" style="width:48px;height:48px;border-radius:50%;background:#0b3d91;color:#fff;border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(11,61,145,0.4);">➤</button>
        </div>
      </div>
      <style>
        .a-chip { background:#fff; border:1px solid #0b3d91; border-radius:20px; padding:7px 13px; font-size:12.5px; color:#0b3d91; cursor:pointer; font-weight:600; transition:all 0.15s; white-space:nowrap; }
        .a-chip:active { background:#0b3d91; color:#fff; }
        .neg { color: #d32f2f; }
        .pos { color: #1b8a3d; }
        .mut { color: #6c788e; }
      </style>
    `;
    document.body.appendChild(modal);

    const $ = s => modal.querySelector(s);
    const chat = $('#a-chat');
    const input = $('#a-input');
    const chipBox = $('#a-chips');
    const mic = $('#a-mic');
    const send = $('#a-send');
    const ttsBtn = $('#a-tts');
    const closeBtn = $('#a-close');
    const focusBadge = $('#a-focus-badge');

    let rec = null;
    let busy = false;

    const addBubble = (html, isUser) => {
      const d = document.createElement('div');
      d.style.cssText = `padding:10px 14px;border-radius:14px;max-width:88%;line-height:1.52;word-break:break-word;${isUser ? 'background:#0b3d91;color:#fff;align-self:flex-end;border-bottom-right-radius:3px;' : 'background:#fff;border:1px solid #e1e7f2;align-self:flex-start;color:#1e2430;border-bottom-left-radius:3px;box-shadow:0 2px 6px rgba(0,0,0,0.04);'}`;
      d.innerHTML = html;
      chat.appendChild(d);
      chat.scrollTop = chat.scrollHeight;
      return d;
    };

    const ui = {
      close: () => {
        Voice.stop();
        try { if (rec) rec.abort(); } catch (e) {}
        modal.remove();
      },
      updateFocusBadge: () => {
        focusBadge.style.display = ctx.focusMode ? 'inline-block' : 'none';
      },
      bot: r => {
        if (!r) return;
        ui.updateFocusBadge();
        addBubble(r.html, false);
        chipBox.innerHTML = '';
        const list = (r.chips && r.chips.length) ? r.chips : homeChips();
        list.forEach(c => {
          const b = document.createElement('button');
          b.className = 'a-chip';
          b.textContent = c.label;
          b.onclick = async () => {
            if (c.fn) return c.fn(ui);
            if (c.onClick) return c.onClick(ui);
            if (c.skill && SK[c.skill]) {
              Voice.stop();
              addBubble(esc(c.label), true);
              const res = await SK[c.skill](c.params || {});
              return ui.bot(res);
            }
            if (c.q) return runText(c.q);
          };
          chipBox.appendChild(b);
        });
        Voice.say(r.say || r.html);
      }
    };

    closeUI = ui.close;
    closeBtn.onclick = ui.close;
    ttsBtn.onclick = () => {
      ctx.brain.mem.tts = !ctx.brain.mem.tts;
      saveBrain();
      ttsBtn.textContent = ctx.brain.mem.tts ? '🔊' : '🔇';
      if (!ctx.brain.mem.tts) Voice.stop();
    };
    ttsBtn.textContent = ctx.brain.mem.tts ? '🔊' : '🔇';
    ui.updateFocusBadge();

    async function runText(text) {
      if (!text || !text.trim() || busy) return;
      busy = true;
      chipBox.innerHTML = '';
      Voice.stop();
      addBubble(esc(text), true);
      input.value = '';

      const loader = addBubble('<span style="color:#666;font-size:12px;">⚡ देख रही हूँ...</span>', false);
      try {
        const res = await handleQuery(text, ui);
        loader.remove();
        if (res) ui.bot(res);
      } catch (err) {
        loader.remove();
        ui.bot(R(`❌ गड़बड़ हो गई: ${esc(err.message)}`, { say: 'माफ़ कीजिए, कोई तकनीकी गड़बड़ हो गई।' }));
      } finally {
        busy = false;
      }
    }

    send.onclick = () => runText(input.value);
    input.onkeypress = e => { if (e.key === 'Enter') runText(input.value); };

    function startListening() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast('इस ब्राउज़र में वॉइस सपोर्ट नहीं है');
      if (busy) return;
      try { if (rec) rec.abort(); } catch (e) {}
      rec = new SR();
      rec.lang = 'hi-IN';
      rec.interimResults = true;

      mic.style.background = '#c62828';
      mic.style.color = '#fff';
      input.placeholder = 'सुन रही हूँ... बोलिए';
      let finalStr = '';

      rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalStr = e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        input.value = finalStr || interim;
      };
      rec.onerror = () => {
        mic.style.background = '#f4b41a';
        input.placeholder = 'यहाँ लिखें या 🎤 दबाकर बोलें...';
      };
      rec.onend = () => {
        mic.style.background = '#f4b41a';
        input.placeholder = 'यहाँ लिखें या 🎤 दबाकर बोलें...';
        if (finalStr) runText(finalStr);
      };
      try { rec.start(); } catch (e) {}
    }

    mic.onclick = () => { Voice.stop(); startListening(); };

    generateSmartBriefing().then(r => ui.bot(r));
  }

  APP.AsstCore = { SK, D, R, ctx, M, n, norm, today, shift, extractDateOrRange, saveBrain, homeChips, chip };
  console.log('[Mazda assistant.js v9.5] Ultimate Cognitive Pro Engine Ready ✓');
})();
