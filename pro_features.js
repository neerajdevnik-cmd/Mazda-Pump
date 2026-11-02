/* =========================================================================
   PRO_FEATURES.JS - VIP Locked Previews & Curiosity Drivers
   - ASTM 53B Accurate Density & Temperature Calculator (with preview)
   - Transporter Fleet & Gaadi Control PRO (Load/Empty Average, Tyres, Docs)
   - AI Meter OCR Scanner & Voice Entry Lock Teaser
   - All Features ready to be unlocked in pure JS!
   ========================================================================= */
(function () {
  'use strict';

  const APP = window.APP || {};

  // Standard VIP Locked Pop-up Dialog
  function showVipLockModal(featureName, benefitText) {
    const ownerPhone = (window.CFG?.pump?.phone) || "8077083874";
    const m = (APP.modal || window.showModal || function(h){
      const d = document.createElement('div');
      d.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="background:#0a1830;border:2px solid #f4b41a;border-radius:20px;padding:24px;color:#fff;max-width:380px;text-align:center;">${h}</div>
      </div>`;
      document.body.appendChild(d);
      return { close: () => d.remove() };
    })(`
      <div style="font-size:42px;margin-bottom:8px;">👑</div>
      <h3 style="color:#f4b41a;margin:0 0 6px 0;font-size:20px;">VIP PRO FEATURE</h3>
      <b style="font-size:16px;display:block;margin-bottom:12px;color:#fff;">${featureName}</b>
      <div style="font-size:13px;line-height:1.5;color:#94a3b8;background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:16px;text-align:left;">
        ${benefitText}
      </div>
      <div style="font-size:12px;color:#f4b41a;margin-bottom:14px;font-weight:600;">
        ⚡ यह फीचर एक्टिवेट करवाने के लिए सिस्टम एडमिन (Neeraj) से संपर्क करें:
      </div>
      <div style="display:flex;gap:8px;">
        <a href="https://wa.me/91${ownerPhone}?text=${encodeURIComponent('नमस्ते नीरज भाई, मुझे अपने पंप के लिए ' + featureName + ' VIP फीचर चालू करवाना है।')}" target="_blank" style="flex:1;background:#25D366;color:#fff;padding:12px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">💬 WhatsApp संपर्क</a>
        <button id="vip-close-btn" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">बाद में</button>
      </div>
    `);

    setTimeout(() => {
      const b = document.getElementById('vip-close-btn');
      if (b) b.onclick = () => m.close();
    }, 100);
  }

  window.showVipLockModal = showVipLockModal;

  // 1. ASTM 53B Density & Temperature Calculator Modal Preview
  window.openDensityProModal = function () {
    const m = (APP.modal || window.showModal)(`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;color:#f4b41a;">🌡️ ASTM 53B डेंसिटी कैलकुलेटर</h3>
        <span class="chip" style="background:#f4b41a;color:#000;font-weight:800;font-size:10px;">👑 PRO PREVIEW</span>
      </div>
      <div class="mut" style="font-size:12px;margin-bottom:12px;">तापमान (°C) और हाइड्रोमीटर से 15°C की सटीक डेंसिटी व टैंकर चोरी पकड़ें:</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label>तेल का प्रकार</label><select id="pro-fuel"><option>डीज़ल (HSD)</option><option>पेट्रोल (MS)</option></select></div>
        <div><label>चालान डेंसिटी (Invoice)</label><input id="pro-inv" placeholder="826.4" value="825.0"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div><label>हाइड्रोमीटर रीडिंग</label><input id="pro-obs" placeholder="820.0" value="821.5"></div>
        <div><label>तापमान (°C)</label><input id="pro-temp" placeholder="28.5" value="28.0"></div>
      </div>

      <!-- Live Interactive Preview Box -->
      <div style="background:rgba(244,180,26,0.08);border:1px dashed #f4b41a;border-radius:12px;padding:12px;margin:12px 0;">
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span>15°C पर असली डेंसिटी:</span>
          <b style="color:#7ee0a0;font-size:16px;">830.4 kg/m³</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;">
          <span>चालान से फर्क:</span>
          <b style="color:#ff8888;font-size:15px;">+5.4 (जाँच आवश्यक)</b>
        </div>
      </div>

      <div class="btns">
        <button class="btn g" id="btn-pro-density-calc" style="background:linear-gradient(135deg, #f4b41a, #d99700);color:#000;font-weight:800;">🔒 ऑटो-कैलकुलेट व रिपोर्ट सेव करें</button>
        <button class="btn w" id="btn-pro-density-close">बंद करें</button>
      </div>
    `);

    document.getElementById('btn-pro-density-close').onclick = () => m.close();
    document.getElementById('btn-pro-density-calc').onclick = () => {
      m.close();
      showVipLockModal(
        "ASTM 53B डेंसिटी व टैंकर लॉस कैलकुलेटर",
        "• पेट्रोलियम इंडस्ट्री स्टैंडर्ड टेबल 53B के अनुसार 15°C पर ऑटोमैटिक डेंसिटी गणना।<br>• टैंकर अनलोडिंग के समय तापमान में अंतर से होने वाली 100-300 लीटर तक की चोरी तुरंत पकड़ें।<br>• सीधे दैनिक रिपोर्ट में डेंसिटी रजिस्टर ऑटो-सेव।"
      );
    };
  };

  // 2. Transporter Fleet & Gaadi Control PRO (Party Portal - party.html)
  window.renderFleetProPreview = function (containerEl) {
    if (!containerEl) return;

    containerEl.innerHTML = `
      <div class="glass-card" style="background:linear-gradient(135deg, rgba(244,180,26,0.15), rgba(4,11,25,0.8));border:1px solid #f4b41a;margin-top:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h3 style="color:#f4b41a;margin:0;font-size:17px;">🚀 स्मार्ट फ्लीट & गाड़ी कंट्रोल</h3>
            <div class="text-mut" style="font-size:11px;">सटीक माइलेज (Average), लोड, टायर व मेंटेनेंस ट्रैकर</div>
          </div>
          <span class="chip" style="background:#f4b41a;color:#000;font-weight:800;font-size:10px;">👑 PRO</span>
        </div>
      </div>

      <!-- Sample Vehicle Card with Rich Visuals -->
      <div class="glass-card" style="margin-top:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">
          <div>
            <b style="font-size:17px;letter-spacing:1px;">🚛 UK01CA-1122</b>
            <div class="text-mut" style="font-size:11px;">टाटा 1618 (10 व्हीलर) · आखिरी एंट्री: आज</div>
          </div>
          <button class="btn sm" style="background:rgba(244,180,26,0.2);color:#f4b41a;border:1px solid #f4b41a;font-size:11px;" onclick="window.triggerFleetLock('UK01CA-1122')">🔒 रिपोर्ट खोलें</button>
        </div>

        <!-- Mileage Stats Comparison -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
          <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;text-align:center;">
            <div class="text-mut" style="font-size:10px;">📦 भरी गाड़ी (LOAD 16 TON)</div>
            <div style="font-size:20px;font-weight:800;color:#7ee0a0;margin-top:2px;">3.45 <small style="font-size:11px;">KM/L</small></div>
            <div class="text-mut" style="font-size:9px;">पहाड़ रूट (चकराता - अल्मोड़ा)</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);padding:10px;border-radius:10px;text-align:center;">
            <div class="text-mut" style="font-size:10px;">💨 खाली गाड़ी (EMPTY)</div>
            <div style="font-size:20px;font-weight:800;color:#f4b41a;margin-top:2px;">4.90 <small style="font-size:11px;">KM/L</small></div>
            <div class="text-mut" style="font-size:9px;">प्लेन रूट (हल्द्वानी वापसी)</div>
          </div>
        </div>

        <!-- Maintenance & Document Vault Progress Bars -->
        <div style="margin-top:14px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span>🛞 अगला टायर रोटेशन (38,200 KM)</span>
            <b style="color:#f4b41a;">80% लाइफ</b>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;margin-bottom:10px;">
            <div style="width:80%;height:100%;background:#f4b41a;"></div>
          </div>

          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span>📄 इंश्योरेंस एक्सपायरी (National Ins.)</span>
            <b style="color:#ff8888;">14 दिन शेष ⚠️</b>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;margin-bottom:10px;">
            <div style="width:92%;height:100%;background:#ff8888;"></div>
          </div>
        </div>

        <button class="btn full" style="margin-top:12px;background:linear-gradient(135deg,#f4b41a,#d99700);color:#000;font-weight:bold;font-size:13px;" onclick="window.triggerFleetLock('All')">
          🔓 अपने ट्रांसपोर्ट के लिए यह PRO फीचर चालू करें
        </button>
      </div>
    `;
  };

  window.triggerFleetLock = function (vno) {
    showVipLockModal(
      "स्मार्ट फ्लीट & गाड़ी कंट्रोल PRO",
      "• <b>खाली vs भरी गाड़ी का सटीक माइलेज:</b> ड्राइवर द्वारा डीज़ल चोरी तुरंत पकड़ें।<br>• <b>टायर & इंजन ऑयल लाइफ ट्रैकर:</b> हर किलोमीटर का हिसाब और सर्विस अलर्ट।<br>• <b>कागजात एक्सपायरी रिमाइंडर:</b> फिटनेस, परमिट, इंश्योरेंस व टैक्स खत्म होने से पहले अलर्ट।<br>• <b>डिजिटल डीज़ल कूपन:</b> ड्राइवर के लिए वन-टाइम पासवर्ड (OTP) ऑथेंटिकेशन।"
    );
  };

  console.log('[ProFeatures Engine] Loaded previews successfully');
})();
