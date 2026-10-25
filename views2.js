  /* ---------- BROWSER DIRECT GEMINI SCAN ---------- */
  APP.scanRegister = function (st) {
    let k = localStorage.getItem('mazda_gemini_key') || '';
    if (!k) {
      k = prompt('API Key paste karein:');
      if (k) localStorage.setItem('mazda_gemini_key', k.trim());
      else return toast('Key zaroori hai');
    }

    const inp = document.createElement('input'); 
    inp.type = 'file'; 
    inp.accept = 'image/*';
    inp.onchange = async () => {
      const file = inp.files[0]; 
      if (!file) return;
      toast('AI register padh raha hai…');

      try {
        const bmp = await createImageBitmap(file);
        const sc = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); 
        c.width = Math.round(bmp.width * sc); 
        c.height = Math.round(bmp.height * sc);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1];

        const promptText = `Extract petrol, diesel readings, and cash from this fuel pump register. Output JSON: {"petrol":{"rate":100.23,"dip":0},"diesel":{"rate":95.68,"dip":0},"cash":{"paytm":0,"swipe":0,"kharcha":0}}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${k}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: 'image/jpeg', data: b64 } }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        const j = await res.json();
        if (j.error) throw new Error(j.error.message || 'API Fail');

        const raw = JSON.parse(j.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim());

        if (raw.cash) {
          if (raw.cash.paytm && $('#f-paytm')) $('#f-paytm').value = raw.cash.paytm;
          if (raw.cash.swipe && $('#f-swipe')) $('#f-swipe').value = raw.cash.swipe;
          if (raw.cash.kharcha && $('#f-kharcha')) $('#f-kharcha').value = raw.cash.kharcha;
        }
        if (raw.petrol && raw.petrol.rate && $('#f-rateP')) $('#f-rateP').value = raw.petrol.rate;
        if (raw.diesel && raw.diesel.rate && $('#f-rateD')) $('#f-rateD').value = raw.diesel.rate;
        
        if (APP.recalc) APP.recalc();
        toast('Register data bhar gaya ✔');
      } catch (e) {
        alert('Scan Error: ' + e.message);
      }
    };
    inp.click();
  };
