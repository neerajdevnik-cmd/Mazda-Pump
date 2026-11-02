/* ============================================================================
   MAZDA OIL COMPANY — MULTI-SIZE HD POSTER & STATUS STUDIO (Pro v7.0)
   1. Daily Petrol/Diesel Rate + Random/Custom Hindi Quote + Weather/Route Alert
   2. Monthly Customer Loyalty & Appreciation VIP Card (Vehicle Breakdown + On-Time Badge)
   3. Festival Special Wishes Studio (Broadcast Mode + Personalized Customer Name Mode + Text)
   Sizes Supported: 9:16 (Status/Reels), 1:1 (Square Post), 4:5 (VIP Card), 16:9 (Banner)
   ============================================================================ */
(function() {
  'use strict';

  const STUDIO_SIZES = {
    '9:16': { w: 1080, h: 1920, label: '9:16 WhatsApp Status / Story' },
    '1:1':  { w: 1080, h: 1080, label: '1:1 Square Chat / Insta Post' },
    '4:5':  { w: 1080, h: 1350, label: '4:5 VIP Portrait Card' },
    '16:9': { w: 1920, h: 1080, label: '16:9 Landscape Banner' }
  };

  const HINDI_QUOTES = [
    "सफर चाहे कितना भी कठिन हो, सही ईंधन और नेक इरादे हर मंज़िल आसान बना देते हैं। शुभ प्रभात!",
    "पहाड़ की हर चढ़ाई पर आपका सच्चा हमसफर — शुद्ध ईंधन, ईमानदार माप और अपनों का विश्वास।",
    "मेहनत की रफ़्तार कभी रुकनी नहीं चाहिए, और आपकी गाड़ी का साथ निभाने के लिए माज़दा ऑयल हमेशा तैयार है।",
    "रिश्ते और इंजन दोनों में जब भरोसे का तेल पड़ता है, तो सफर सालों-साल बिना रुके चलता है।",
    "कुमाऊँ की वादियों में हर सुबह नई ऊर्जा लेकर आती है — आपका आज का सफर सुरक्षित और मंगलमय हो!",
    "भरोसा कमाने में बरसों लगते हैं, और हम हर एक बूंद की शुद्धता से आपका भरोसा निभाते हैं।",
    "मंज़िलें उन्हीं को मिलती हैं जिनके हौसलों में जान और सफर में सही रफ़्तार होती है। सुप्रभात!"
  ];

  const FESTIVALS = [
    { id: 'diwali', name: 'दीपावली (Diwali)', title: 'शुभ दीपावली की हार्दिक शुभकामनाएँ', msg: 'दीपों का यह पावन पर्व आपके जीवन, व्यापार और परिवार में सुख, समृद्धि और खुशहाली लेकर आए।', accent: '#f59e0b' },
    { id: 'holi', name: 'होली (Holi)', title: 'रंगों के पर्व होली की हार्दिक बधाई', msg: 'खुशियों और प्रेम के रंग आपके परिवार और हर सफर को हमेशा रंगीन बनाए रखें।', accent: '#ec4899' },
    { id: 'newyear', name: 'नववर्ष (New Year)', title: 'नववर्ष की मंगलमय शुभकामनाएँ', msg: 'नया साल आपकी हर मंज़िल को आसान करे और आपके व्यापार को नई ऊँचाइयों पर ले जाए।', accent: '#06b6d4' },
    { id: 'egas', name: 'इगास / बग्वाल (Pahadi Lok Parv)', title: 'उत्तराखंड के लोकपर्व इगास-बग्वाल की बधाई', msg: 'अपनी संस्कृति, अपनी मिट्टी और अपने पहाड़ के इस पावन पर्व की आपको सपरिवार हार्दिक शुभकामनाएँ।', accent: '#f97316' },
    { id: 'uttarayani', name: 'मकर संक्रांति / घुघुतिया (Uttarayani)', title: 'उत्तरायणी एवं मकर संक्रांति की शुभकामनाएँ', msg: 'काले कौआ काले, घुघुती माला खा ले! उत्तरायणी पर्व आपके जीवन में नई मिठास और खुशहाली लाए।', accent: '#10b981' },
    { id: 'eid', name: 'ईद मुबारक (Eid)', title: 'ईद मुबारक एवं दिली शुभकामनाएँ', msg: 'अमन, भाईचारे और खुशियों का यह पर्व आपके पूरे परिवार के लिए बरकत लेकर आए।', accent: '#14b8a6' }
  ];

  // Fetch parties/customers from app state or fallback sample list
  const getPartiesList = () => {
    const S = window.S || window.state || {};
    if (Array.isArray(S.parties) && S.parties.length) return S.parties;
    if (Array.isArray(S.customers) && S.customers.length) return S.customers;
    return [
      { id: 'p1', name: 'जीवन देव ट्रांसपोर्ट (Bajeena / Ranikhet)', vehicles: ['UK-01-TA-1122 (Mazda): 420 L', 'UK-04-CA-8890 (Maxx): 265 L'], totalLitres: 685, totalAmt: 60450, onTime: true },
      { id: 'p2', name: 'कुमाऊँ हिल्स टैक्सी यूनियन (Ranikhet)', vehicles: ['UK-01-TA-4501 (Bolero): 310 L', 'UK-01-TA-3319 (Alto): 140 L'], totalLitres: 450, totalAmt: 40120, onTime: true },
      { id: 'p3', name: 'देव सिंह एग्रीकल्चर & कॉन्ट्रैक्टर्स (Bamsyun)', vehicles: ['UK-01-GA-7711 (Pickup): 380 L', 'JCB-3DX: 520 L'], totalLitres: 900, totalAmt: 78768, onTime: true },
      { id: 'p4', name: 'गजेंद्र सिंह फ्लीट सर्विसेज़', vehicles: ['UK-01-TA-9090 (Tipper): 610 L'], totalLitres: 610, totalAmt: 53387, onTime: true }
    ];
  };

  // Round Rect Helper
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Word Wrap Helper
  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), x, curY);
      curY += lineHeight;
    }
    return curY;
  }

  // Core Canvas Renderer
  function renderPosterCanvas(canvas, cfg) {
    const size = STUDIO_SIZES[cfg.aspect] || STUDIO_SIZES['9:16'];
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    const W = size.w;
    const H = size.h;
    const scale = Math.min(W, H) / 1080;

    // 1. Rich Background Gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    if (cfg.mode === 'festival') {
      grad.addColorStop(0, '#1e0b36');
      grad.addColorStop(0.5, '#091e4a');
      grad.addColorStop(1, '#040d21');
    } else if (cfg.mode === 'loyalty') {
      grad.addColorStop(0, '#04122c');
      grad.addColorStop(0.55, '#0a295e');
      grad.addColorStop(1, '#061533');
    } else {
      grad.addColorStop(0, '#040d24');
      grad.addColorStop(0.5, '#0a2a66');
      grad.addColorStop(1, '#07193d');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative Ambient Glow Circles
    const glow1 = ctx.createRadialGradient(W * 0.85, H * 0.12, 10, W * 0.85, H * 0.12, W * 0.55);
    glow1.addColorStop(0, 'rgba(244, 180, 26, 0.25)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, W, H);

    const glow2 = ctx.createRadialGradient(W * 0.15, H * 0.85, 10, W * 0.15, H * 0.85, W * 0.5);
    glow2.addColorStop(0, 'rgba(0, 229, 255, 0.16)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // Outer Luxury Gold Border
    const pad = Math.round(36 * scale);
    ctx.strokeStyle = 'rgba(244, 180, 26, 0.65)';
    ctx.lineWidth = Math.max(3, Math.round(4 * scale));
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, Math.round(36 * scale));
    ctx.stroke();

    // Top Header Branding
    let curY = pad + Math.round(75 * scale);
    ctx.textAlign = 'center';

    // BPCL / Mazda Badge Pill
    const pillW = Math.min(W - pad * 4, Math.round(680 * scale));
    const pillH = Math.round(54 * scale);
    ctx.fillStyle = 'rgba(244, 180, 26, 0.18)';
    roundRect(ctx, (W - pillW) / 2, curY - Math.round(38 * scale), pillW, pillH, Math.round(27 * scale));
    ctx.fill();
    ctx.strokeStyle = '#f4b41a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffd35c';
    ctx.font = `800 ${Math.round(24 * scale)}px "Plus Jakarta Sans", "Noto Sans Devanagari", sans-serif`;
    ctx.fillText('⛽ भारत पेट्रोलियम (BPCL) • शुद्धता और विश्वास का प्रतीक', W / 2, curY - Math.round(3 * scale));

    curY += Math.round(68 * scale);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(56 * scale)}px "Orbitron", "Plus Jakarta Sans", sans-serif`;
    ctx.fillText('MAZDA OIL COMPANY', W / 2, curY);

    curY += Math.round(42 * scale);
    ctx.fillStyle = '#93c5fd';
    ctx.font = `700 ${Math.round(26 * scale)}px "Noto Sans Devanagari", sans-serif`;
    ctx.fillText('रानीखेत रोड, बमस्यून (अल्मोड़ा) • पिन: 263645', W / 2, curY);

    // Date & Route Pill
    curY += Math.round(48 * scale);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `600 ${Math.round(23 * scale)}px "Noto Sans Devanagari", sans-serif`;
    ctx.fillText(`📅 दिनांक: ${cfg.dateStr}   |   🏔️ ${cfg.routeAlert || 'रानीखेत-अल्मोड़ा मार्ग सुचारू है'}`, W / 2, curY);

    // MODE 1: DAILY RATE & QUOTE STATUS
    if (cfg.mode === 'daily') {
      curY += Math.round(60 * scale);
      const boxW = W - pad * 3.2;
      const boxX = (W - boxW) / 2;
      const cardH = Math.round((H > W ? 230 : 170) * scale);

      // Petrol Card
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, boxX, curY, boxW, cardH, Math.round(28 * scale));
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 180, 26, 0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd35c';
      ctx.font = `800 ${Math.round(34 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('⛽ पेट्रोल (PETROL - MS)', boxX + Math.round(40 * scale), curY + Math.round(65 * scale));
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `600 ${Math.round(22 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('100% शुद्ध एवं प्रमाणित माप', boxX + Math.round(40 * scale), curY + Math.round(110 * scale));

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(74 * scale)}px "Orbitron", sans-serif`;
      ctx.fillText(`₹${cfg.msRate}`, boxX + boxW - Math.round(40 * scale), curY + Math.round(115 * scale));
      ctx.fillStyle = '#ffd35c';
      ctx.font = `700 ${Math.round(22 * scale)}px sans-serif`;
      ctx.fillText('प्रति लीटर (Per Litre)', boxX + boxW - Math.round(40 * scale), curY + Math.round(155 * scale));

      // Diesel Card
      curY += cardH + Math.round(32 * scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, boxX, curY, boxW, cardH, Math.round(28 * scale));
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#38bdf8';
      ctx.font = `800 ${Math.round(34 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('🚛 डीज़ल (DIESEL - HSD)', boxX + Math.round(40 * scale), curY + Math.round(65 * scale));
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `600 ${Math.round(22 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('पहाड़ी चढ़ाई के लिए दमदार माइलेज', boxX + Math.round(40 * scale), curY + Math.round(110 * scale));

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(74 * scale)}px "Orbitron", sans-serif`;
      ctx.fillText(`₹${cfg.hsdRate}`, boxX + boxW - Math.round(40 * scale), curY + Math.round(115 * scale));
      ctx.fillStyle = '#38bdf8';
      ctx.font = `700 ${Math.round(22 * scale)}px sans-serif`;
      ctx.fillText('प्रति लीटर (Per Litre)', boxX + boxW - Math.round(40 * scale), curY + Math.round(155 * scale));

      // Quote / Suvichar Card
      curY += cardH + Math.round(44 * scale);
      const qBoxH = Math.max(Math.round(220 * scale), H - curY - pad - Math.round(150 * scale));
      ctx.fillStyle = 'rgba(244, 180, 26, 0.12)';
      roundRect(ctx, boxX, curY, boxW, qBoxH, Math.round(28 * scale));
      ctx.fill();
      ctx.strokeStyle = 'rgba(244, 180, 26, 0.45)';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd35c';
      ctx.font = `800 ${Math.round(26 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('✨ आज का सुविचार / संदेश ✨', W / 2, curY + Math.round(52 * scale));

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(33 * scale)}px "Noto Sans Devanagari", sans-serif`;
      drawWrappedText(
        ctx,
        `"${cfg.quoteText}"`,
        W / 2,
        curY + Math.round(112 * scale),
        boxW - Math.round(80 * scale),
        Math.round(48 * scale)
      );
    }

    // MODE 2: CUSTOMER MONTHLY LOYALTY & APPRECIATION CARD
    else if (cfg.mode === 'loyalty') {
      curY += Math.round(55 * scale);
      const boxW = W - pad * 3;
      const boxX = (W - boxW) / 2;

      // Golden Crown Banner
      ctx.fillStyle = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      ctx.fillStyle = 'rgba(244, 180, 26, 0.2)';
      roundRect(ctx, boxX, curY, boxW, Math.round(145 * scale), Math.round(24 * scale));
      ctx.fill();
      ctx.strokeStyle = '#f4b41a';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd35c';
      ctx.font = `800 ${Math.round(25 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('🌟 सम्मानित ग्राहक आभार एवं मासिक विवरण कार्ड 🌟', W / 2, curY + Math.round(48 * scale));

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(40 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText(cfg.customerName || 'सम्मानित पार्टनर', W / 2, curY + Math.round(108 * scale));

      curY += Math.round(175 * scale);

      // Summary Stats Box
      const statH = Math.round(165 * scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, boxX, curY, boxW, statH, Math.round(24 * scale));
      ctx.fill();

      ctx.fillStyle = '#93c5fd';
      ctx.font = `700 ${Math.round(24 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText(`माह (${cfg.monthLabel}) में कुल ईंधन खपत`, W / 2, curY + Math.round(45 * scale));

      ctx.fillStyle = '#4ade80';
      ctx.font = `900 ${Math.round(54 * scale)}px "Orbitron", sans-serif`;
      ctx.fillText(`${cfg.totalLitres} Litres  (₹${Number(cfg.totalAmt || 0).toLocaleString('en-IN')})`, W / 2, curY + Math.round(115 * scale));

      curY += statH + Math.round(28 * scale);

      // Vehicle-wise Breakdown Box
      const vehLines = (cfg.vehicleBreakdown || '').split('\n').filter(Boolean);
      const vehBoxH = Math.round((85 + vehLines.length * 46) * scale);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      roundRect(ctx, boxX, curY, boxW, vehBoxH, Math.round(22 * scale));
      ctx.fill();
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
      ctx.stroke();

      ctx.fillStyle = '#ffd35c';
      ctx.font = `800 ${Math.round(26 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('🚜 गाड़ी-वार ईंधन विवरण (Vehicle-Wise Summary):', W / 2, curY + Math.round(46 * scale));

      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(25 * scale)}px "Noto Sans Devanagari", sans-serif`;
      vehLines.slice(0, 5).forEach((vLine, idx) => {
        ctx.fillText(`• ${vLine}`, W / 2, curY + Math.round((95 + idx * 44) * scale));
      });

      curY += vehBoxH + Math.round(28 * scale);

      // On-Time Payment Trust Badge & Thank You Message
      const thkH = Math.max(Math.round(190 * scale), H - curY - pad - Math.round(140 * scale));
      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      roundRect(ctx, boxX, curY, boxW, thkH, Math.round(24 * scale));
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = `800 ${Math.round(27 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText(cfg.onTimeBadge || '✅ 100% समय पर भुगतान (On-Time Payment Partner)', W / 2, curY + Math.round(50 * scale));

      ctx.fillStyle = '#ffffff';
      ctx.font = `600 ${Math.round(26 * scale)}px "Noto Sans Devanagari", sans-serif`;
      drawWrappedText(
        ctx,
        cfg.thankYouNote || 'आपका समय पर भुगतान और अटूट विश्वास ही हमारी सबसे बड़ी पूँजी है। माज़दा ऑयल कंपनी (बमस्यून) परिवार से जुड़े रहने के लिए आपका हार्दिक धन्यवाद!',
        W / 2,
        curY + Math.round(100 * scale),
        boxW - Math.round(70 * scale),
        Math.round(40 * scale)
      );
    }

    // MODE 3: FESTIVAL SPECIAL WISHES (GENERAL OR PERSONALIZED BY CUSTOMER NAME)
    else if (cfg.mode === 'festival') {
      const fest = FESTIVALS.find(f => f.id === cfg.festivalId) || FESTIVALS[0];
      curY += Math.round(65 * scale);
      const boxW = W - pad * 3;
      const boxX = (W - boxW) / 2;

      // Festival Decorative Header Box
      ctx.fillStyle = 'rgba(244, 180, 26, 0.18)';
      roundRect(ctx, boxX, curY, boxW, Math.round(170 * scale), Math.round(28 * scale));
      ctx.fill();
      ctx.strokeStyle = '#f4b41a';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd35c';
      ctx.font = `900 ${Math.round(46 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText(`🪔 ${fest.title} 🪔`, W / 2, curY + Math.round(75 * scale));

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(28 * scale)}px "Noto Sans Devanagari", sans-serif`;
      const targetGreeting = cfg.festTargetMode === 'personal'
        ? `विशेष शुभकामनाएँ: श्री ${cfg.customerName || 'सम्मानित ग्राहक'} जी एवं समस्त परिवार`
        : 'समस्त क्षेत्रवासियों, वाहन स्वामियों एवं सम्मानित ग्राहकों को हार्दिक बधाई';
      ctx.fillText(targetGreeting, W / 2, curY + Math.round(135 * scale));

      curY += Math.round(215 * scale);

      // Main Festival Message Box
      const msgBoxH = Math.max(Math.round(290 * scale), H - curY - pad - Math.round(160 * scale));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, boxX, curY, boxW, msgBoxH, Math.round(28 * scale));
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.round(35 * scale)}px "Noto Sans Devanagari", sans-serif`;
      const endY = drawWrappedText(
        ctx,
        cfg.festivalCustomMsg || fest.msg,
        W / 2,
        curY + Math.round(85 * scale),
        boxW - Math.round(90 * scale),
        Math.round(52 * scale)
      );

      ctx.fillStyle = '#ffd35c';
      ctx.font = `800 ${Math.round(27 * scale)}px "Noto Sans Devanagari", sans-serif`;
      ctx.fillText('🙏 माज़दा ऑयल कंपनी से जुड़े रहिए — आपका हर सफर शुभ और सुरक्षित हो! 🙏', W / 2, Math.min(endY + Math.round(45 * scale), curY + msgBoxH - Math.round(35 * scale)));
    }

    // Bottom Signature Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd35c';
    ctx.font = `800 ${Math.round(24 * scale)}px "Noto Sans Devanagari", sans-serif`;
    ctx.fillText('📍 माज़दा ऑयल कंपनी (BPCL) • रानीखेत रोड, बमस्यून, अल्मोड़ा | 24x7 भरोसेमंद सेवा', W / 2, H - pad - Math.round(42 * scale));
  }

  // Build WhatsApp Caption Text
  function buildShareCaption(cfg) {
    if (cfg.mode === 'daily') {
      return `⛽ *MAZDA OIL COMPANY (BPCL)*\n📍 रानीखेत रोड, बमस्यून (अल्मोड़ा)\n📅 *आज का ईंधन भाव (${cfg.dateStr}):*\n• पेट्रोल (MS): *₹${cfg.msRate}/L*\n• डीज़ल (HSD): *₹${cfg.hsdRate}/L*\n\n✨ *आज का संदेश:* "${cfg.quoteText}"\n🏔️ *रूट अपडेट:* ${cfg.routeAlert}\n\n_शुद्ध ईंधन और सही माप के लिए पधारें!_ 🙏`;
    }
    if (cfg.mode === 'loyalty') {
      return `🙏 *हार्दिक धन्यवाद एवं आभार — ${cfg.customerName} जी!*\n\nमाह *${cfg.monthLabel}* में आपके वाहनों द्वारा *माज़दा ऑयल कंपनी (बमस्यून)* से कुल *${cfg.totalLitres} Litres (₹${Number(cfg.totalAmt || 0).toLocaleString('en-IN')})* ईंधन लिया गया।\n\n🚜 *गाड़ी-वार विवरण:*\n${cfg.vehicleBreakdown}\n\n✅ *${cfg.onTimeBadge}*\nआपका समय पर भुगतान और विश्वास हमारे लिए अनमोल है। माज़दा ऑयल कंपनी से जुड़े रहिए! 🙏⛽`;
    }
    const fest = FESTIVALS.find(f => f.id === cfg.festivalId) || FESTIVALS[0];
    const greetName = cfg.festTargetMode === 'personal' ? `*आदरणीय ${cfg.customerName} जी एवं आपके समस्त परिवार को*` : `*आप सभी सम्मानित ग्राहकों एवं क्षेत्रवासियों को*`;
    return `🪔 *${fest.title}!* 🪔\n\n${greetName} *माज़दा ऑयल कंपनी (BPCL - रानीखेत रोड, बमस्यून, अल्मोड़ा)* की ओर से हार्दिक शुभकामनाएँ।\n\n✨ ${cfg.festivalCustomMsg || fest.msg}\n\nमाज़दा ऑयल कंपनी से जुड़े रहिए, आपका हर सफर मंगलमय हो! 🙏🚗`;
  }

  // Open Modal Studio
  window.openMazdaPosterStudio = function(initialMode = 'daily') {
    const existing = document.getElementById('mazda-poster-modal');
    if (existing) existing.remove();

    const state = window.S || window.state || {};
    const defaultMs = (state.rates && (state.rates.petrol || state.rates.ms)) || localStorage.getItem('mazda_ms_rate') || '94.65';
    const defaultHsd = (state.rates && (state.rates.diesel || state.rates.hsd)) || localStorage.getItem('mazda_hsd_rate') || '87.52';
    const parties = getPartiesList();
    const todayStr = new Date().toLocaleDateString('hi-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const modal = document.createElement('div');
    modal.id = 'mazda-poster-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="sheet" style="max-width:740px;max-height:94vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="margin:0;">🎨 माज़दा HD पोस्टर & स्टेटस स्टूडियो</h3>
          <button class="btn sm r" onclick="document.getElementById('mazda-poster-modal').remove()">✕ बंद करें</button>
        </div>

        <!-- Mode Selector -->
        <div class="seg" id="ps-mode-tabs">
          <button data-mode="daily" class="${initialMode === 'daily' ? 'on' : ''}">⛽ Daily Status</button>
          <button data-mode="loyalty" class="${initialMode === 'loyalty' ? 'on' : ''}">🏆 Customer आभार</button>
          <button data-mode="festival" class="${initialMode === 'festival' ? 'on' : ''}">🪔 Festival Wishes</button>
        </div>

        <!-- Size Selector -->
        <label>📐 पोस्टर साइज़ चुनें (Multi-Size Selector)</label>
        <div class="seg" id="ps-size-tabs">
          <button data-size="9:16" class="on">9:16 Status</button>
          <button data-size="1:1">1:1 Square</button>
          <button data-size="4:5">4:5 VIP Card</button>
          <button data-size="16:9">16:9 Banner</button>
        </div>

        <!-- Mode 1: Daily Status Controls -->
        <div id="ps-panel-daily" style="${initialMode === 'daily' ? '' : 'display:none'}">
          <div class="row">
            <div>
              <label>⛽ पेट्रोल रेट (₹/L)</label>
              <input type="number" step="0.01" id="ps-ms-rate" value="${defaultMs}">
            </div>
            <div>
              <label>🚛 डीज़ल रेट (₹/L)</label>
              <input type="number" step="0.01" id="ps-hsd-rate" value="${defaultHsd}">
            </div>
          </div>
          <label>🏔️ रूट / मौसम अपडेट (Ranikhet Road Info)</label>
          <input type="text" id="ps-route-alert" value="रानीखेत-अल्मोड़ा हाईवे सुचारू है • शुभ यात्रा!">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
            <label style="margin:0;">✨ स्टेटस कोट / सुविचार (Custom या Random)</label>
            <button type="button" class="btn sm o" id="ps-random-quote-btn">🎲 नया Random सुविचार</button>
          </div>
          <textarea id="ps-quote-text" rows="2" style="margin-top:6px;">${HINDI_QUOTES[0]}</textarea>
        </div>

        <!-- Mode 2: Customer Loyalty Controls -->
        <div id="ps-panel-loyalty" style="${initialMode === 'loyalty' ? '' : 'display:none'}">
          <label>👤 खाता ग्राहक चुनें (Select Party / Transporter)</label>
          <select id="ps-party-select">
            ${parties.map((p, i) => `<option value="${i}">${p.name || p.partyName || ('ग्राहक #' + (i + 1))}</option>`).join('')}
          </select>
          <div class="row">
            <div>
              <label>📅 महीना (Month)</label>
              <input type="text" id="ps-month-label" value="अक्टूबर-नवंबर 2026">
            </div>
            <div>
              <label>⛽ कुल लीटर (Total Litres)</label>
              <input type="number" id="ps-total-litres" value="${parties[0]?.totalLitres || 685}">
            </div>
            <div>
              <label>💰 कुल राशि (₹)</label>
              <input type="number" id="ps-total-amt" value="${parties[0]?.totalAmt || 60450}">
            </div>
          </div>
          <label>🚜 किस गाड़ी ने कितना तेल लिया (Vehicle-wise Breakdown)</label>
          <textarea id="ps-veh-breakdown" rows="3">${(parties[0]?.vehicles || ['UK-01-TA-1122: 420 L', 'UK-04-CA-8890: 265 L']).join('\n')}</textarea>
          <label>🏅 ऑन-टाइम पेमेंट बैज</label>
          <input type="text" id="ps-ontime-badge" value="✅ 100% समय पर भुगतान (Gold Trust Partner)">
        </div>

        <!-- Mode 3: Festival Controls -->
        <div id="ps-panel-festival" style="${initialMode === 'festival' ? '' : 'display:none'}">
          <div class="row">
            <div>
              <label>🪔 त्यौहार चुनें</label>
              <select id="ps-fest-select">
                ${FESTIVALS.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>🎯 किसके लिए बनाना है?</label>
              <select id="ps-fest-target">
                <option value="all">1. सभी के लिए एक साथ (Broadcast)</option>
                <option value="personal">2. ग्राहक के नाम के साथ (Personalized)</option>
              </select>
            </div>
          </div>
          <div id="ps-fest-party-wrap" style="display:none;">
            <label>👤 ग्राहक का नाम चुनें या लिखें</label>
            <input type="text" id="ps-fest-cust-name" list="ps-party-datalist" value="${parties[0]?.name || ''}" placeholder="ग्राहक का नाम लिखें...">
            <datalist id="ps-party-datalist">
              ${parties.map(p => `<option value="${p.name || p.partyName || ''}">`).join('')}
            </datalist>
          </div>
          <label>✉️ त्यौहार का बधाई संदेश (Image + WhatsApp Text)</label>
          <textarea id="ps-fest-msg" rows="2">${FESTIVALS[0].msg}</textarea>
        </div>

        <!-- Live Canvas Preview -->
        <div style="margin-top:14px;text-align:center;background:#07132c;padding:12px;border-radius:18px;border:1px solid rgba(244,180,26,0.35);">
          <canvas id="mazda-studio-canvas" style="max-width:100%;max-height:420px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);"></canvas>
        </div>

        <!-- Action Buttons -->
        <div class="btns" style="margin-top:14px;">
          <button class="btn g" id="ps-share-wa-btn">📲 Image + Text WhatsApp शेयर करें</button>
          <button class="btn o" id="ps-download-btn">⬇️ HD पोस्टर डाउनलोड करें</button>
          <button class="btn bpcl" id="ps-bulk-fest-btn" style="display:none;">⚡ सभी ग्राहकों के नाम से एक-एक करके डाउनलोड/शेयर</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    let currentMode = initialMode;
    let currentSize = '9:16';
    const canvas = document.getElementById('mazda-studio-canvas');

    const getCfg = () => {
      const partyIdx = parseInt(document.getElementById('ps-party-select').value, 10) || 0;
      const partyObj = parties[partyIdx] || parties[0] || {};
      const custName = currentMode === 'festival'
        ? document.getElementById('ps-fest-cust-name').value
        : (partyObj.name || partyObj.partyName || 'सम्मानित ग्राहक');

      return {
        mode: currentMode,
        aspect: currentSize,
        dateStr: todayStr,
        msRate: document.getElementById('ps-ms-rate').value || defaultMs,
        hsdRate: document.getElementById('ps-hsd-rate').value || defaultHsd,
        routeAlert: document.getElementById('ps-route-alert').value,
        quoteText: document.getElementById('ps-quote-text').value,
        customerName: custName,
        monthLabel: document.getElementById('ps-month-label').value,
        totalLitres: document.getElementById('ps-total-litres').value,
        totalAmt: document.getElementById('ps-total-amt').value,
        vehicleBreakdown: document.getElementById('ps-veh-breakdown').value,
        onTimeBadge: document.getElementById('ps-ontime-badge').value,
        festivalId: document.getElementById('ps-fest-select').value,
        festTargetMode: document.getElementById('ps-fest-target').value,
        festivalCustomMsg: document.getElementById('ps-fest-msg').value
      };
    };

    const refreshCanvas = () => {
      const cfg = getCfg();
      localStorage.setItem('mazda_ms_rate', cfg.msRate);
      localStorage.setItem('mazda_hsd_rate', cfg.hsdRate);
      renderPosterCanvas(canvas, cfg);
      document.getElementById('ps-bulk-fest-btn').style.display =
        (currentMode === 'festival' && cfg.festTargetMode === 'personal') ? 'inline-flex' : 'none';
    };

    // Event bindings
    document.querySelectorAll('#ps-mode-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ps-mode-tabs button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        currentMode = btn.dataset.mode;
        document.getElementById('ps-panel-daily').style.display = currentMode === 'daily' ? '' : 'none';
        document.getElementById('ps-panel-loyalty').style.display = currentMode === 'loyalty' ? '' : 'none';
        document.getElementById('ps-panel-festival').style.display = currentMode === 'festival' ? '' : 'none';
        refreshCanvas();
      });
    });

    document.querySelectorAll('#ps-size-tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#ps-size-tabs button').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        currentSize = btn.dataset.size;
        refreshCanvas();
      });
    });

    document.getElementById('ps-random-quote-btn').addEventListener('click', () => {
      const q = HINDI_QUOTES[Math.floor(Math.random() * HINDI_QUOTES.length)];
      document.getElementById('ps-quote-text').value = q;
      refreshCanvas();
    });

    document.getElementById('ps-party-select').addEventListener('change', (e) => {
      const p = parties[parseInt(e.target.value, 10)] || {};
      document.getElementById('ps-total-litres').value = p.totalLitres || 520;
      document.getElementById('ps-total-amt').value = p.totalAmt || 45500;
      document.getElementById('ps-veh-breakdown').value = (p.vehicles || ['UK-01-TA-1122: 320 L', 'UK-01-CA-4455: 200 L']).join('\n');
      refreshCanvas();
    });

    document.getElementById('ps-fest-select').addEventListener('change', (e) => {
      const f = FESTIVALS.find(x => x.id === e.target.value) || FESTIVALS[0];
      document.getElementById('ps-fest-msg').value = f.msg;
      refreshCanvas();
    });

    document.getElementById('ps-fest-target').addEventListener('change', (e) => {
      document.getElementById('ps-fest-party-wrap').style.display = e.target.value === 'personal' ? '' : 'none';
      refreshCanvas();
    });

    modal.querySelectorAll('input, textarea').forEach(inp => {
      inp.addEventListener('input', refreshCanvas);
    });

    // Download HD PNG
    document.getElementById('ps-download-btn').addEventListener('click', () => {
      const cfg = getCfg();
      const link = document.createElement('a');
      link.download = `Mazda_${cfg.mode}_${cfg.aspect.replace(':', 'x')}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    });

    // Share Image + Caption on WhatsApp
    document.getElementById('ps-share-wa-btn').addEventListener('click', async () => {
      const cfg = getCfg();
      const caption = buildShareCaption(cfg);
      try {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
        const file = new File([blob], `Mazda_${cfg.mode}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Mazda Oil Company',
            text: caption,
            files: [file]
          });
          return;
        }
      } catch (err) {}
      // Fallback: Download image + open WhatsApp with caption
      const link = document.createElement('a');
      link.download = `Mazda_${cfg.mode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank');
    });

    // Bulk Personalized Festival Generator
    document.getElementById('ps-bulk-fest-btn').addEventListener('click', () => {
      parties.slice(0, 6).forEach((p, idx) => {
        setTimeout(() => {
          document.getElementById('ps-fest-cust-name').value = p.name || p.partyName || `ग्राहक ${idx + 1}`;
          refreshCanvas();
          const link = document.createElement('a');
          link.download = `Mazda_Festival_${(p.name || idx).replace(/\s+/g, '_')}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }, idx * 450);
      });
    });

    refreshCanvas();
  };
})();
