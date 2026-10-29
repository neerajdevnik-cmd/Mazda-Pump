/* Mazda Oil Company - Professional Invoice Generator with UPI */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;
  const C = APP.C, S = APP.S, $ = APP.$, esc = APP.esc, num = APP.num, dmy = APP.dmy, toast = APP.toast, modal = APP.modal;

  APP.showInvoiceModal = async function (party, entries) {
    const bal = num(party.bal);
    if (bal <= 0) return toast('कोई बकाया नहीं है');

    const upiId = C.pump.upi;
    const upiName = C.pump.upiName;
    // UPI Link with Amount Auto-fill
    const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${bal}&cu=INR&tn=${encodeURIComponent('Payment to ' + upiName)}`;
    // Generate QR Code using a free public API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiLink)}`;

    const invNo = 'INV-' + Date.now().toString().slice(-6);
    const dt = dmy(APP.todayISO());

    const html = `
      <div id="inv-node" style="background:#fff; padding:20px; color:#333; font-family:'Noto Sans Devanagari',sans-serif; max-width:400px; margin:0 auto; border:1px solid #ddd; border-radius:10px;">
        <div style="text-align:center; border-bottom:2px solid #0b3d91; padding-bottom:10px; margin-bottom:10px;">
          <img src="./logo.png" style="width:60px;height:60px;border-radius:50%;">
          <h2 style="margin:5px 0; color:#0b3d91; font-size:18px;">${esc(C.pump.name)}</h2>
          <div style="font-size:11px; color:#666;">${esc(C.pump.address)}</div>
          <div style="font-size:11px; color:#666;">Ph: ${esc(C.pump.phone)}</div>
        </div>
        
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px;">
          <div><b>Bill To:</b><br>${esc(party.name)}<br>${esc(party.phone || '')}</div>
          <div style="text-align:right;"><b>Date:</b> ${dt}<br><b>Inv No:</b> ${invNo}</div>
        </div>
        
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
          <tr style="background:#f4f6fa;">
            <th style="padding:6px; text-align:left; border-bottom:1px solid #ddd;">Description</th>
            <th style="padding:6px; text-align:right; border-bottom:1px solid #ddd;">Amount</th>
          </tr>
          <tr>
            <td style="padding:8px 6px; border-bottom:1px solid #eee;">Outstanding Balance</td>
            <td style="padding:8px 6px; text-align:right; border-bottom:1px solid #eee;">₹${bal.toFixed(2)}</td>
          </tr>
        </table>
        
        <div style="text-align:right; font-size:16px; font-weight:bold; color:#0b3d91; margin-bottom:15px;">
          Total Due: ₹${bal.toFixed(2)}
        </div>
        
        <div style="text-align:center; border-top:1px dashed #ccc; padding-top:10px;">
          <div style="font-size:12px; font-weight:bold; margin-bottom:5px;">Scan to Pay via UPI (Auto-fills amount)</div>
          <img src="${qrUrl}" crossorigin="anonymous" style="width:130px;height:130px;">
          <div style="font-size:10px; color:#666; margin-top:5px;">UPI ID: ${esc(upiId)}</div>
        </div>
      </div>
    `;

    const m = modal(`
      <h3>🧾 Professional Invoice</h3>
      <div style="padding:10px 0; max-height:70vh; overflow-y:auto;">${html}</div>
      <div class="btns" style="margin-top:10px;">
        <button class="btn bpcl full" id="inv-share">📤 WhatsApp भेजें (Image)</button>
        <button class="btn w full" id="inv-print">🖨️ Print / PDF</button>
        <button class="btn w full" id="inv-close">बंद करें</button>
      </div>
    `);

    $('#inv-close', m).onclick = () => m.close();

    $('#inv-share', m).onclick = async () => {
      toast('इमेज बन रही है...');
      try {
        const node = $('#inv-node', m);
        const cv = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
        cv.toBlob(async blob => {
          const file = new File([blob], 'invoice.png', { type: 'image/png' });
          const ph = String(party.phone || '').replace(/\D/g, '');
          const wa = ph ? (ph.length === 10 ? '91' + ph : ph) : '';
          const text = `नमस्ते ${party.name} जी, आपका माज़दा ऑयल कंपनी का बिल संलग्न है। कुल बकाया: ₹${bal.toFixed(2)}`;
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: text });
          } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'invoice.png'; a.click();
            toast('इमेज डाउनलोड हो गई');
          }
        });
      } catch (e) { toast('फोटो नहीं बनी: ' + e.message); }
    };

    $('#inv-print', m).onclick = () => {
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Invoice</title><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script></head><body style="display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f0f0f0;">${html}</body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 500);
    };
  };
})();
