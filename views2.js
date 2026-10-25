  /* ======================= MULTI-DATE SMART PASTE SCANNER ======================= */
  APP.scanRegister = async function (st) {
    let text = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch (e) {}

    if (!text || !text.includes('{')) {
      text = prompt('Gemini se copy kiya hua code yahan paste karein:');
    }
    if (!text || !text.trim()) return;

    try {
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const raw = JSON.parse(cleanJson);

      // Target date nikalna (code se ya screen par open tareekh se)
      let targetDate = raw.date || (st && st.date ? st.date : ($('#f-date') ? $('#f-date').value : APP.todayISO()));

      // Agar user purani kisi alag tareekh ka code paste kar raha hai
      if (raw.date && st && st.date && raw.date !== st.date) {
        const confirmSwitch = confirm(`Yeh code ${raw.date} tareekh ka hai. Kya aap is din ka hisaab update karna chahte hain?`);
        if (!confirmSwitch) return;
        if (APP.loadDay) {
          await APP.loadDay(raw.date);
        }
      }

      let filledCount = 0;

      // 1. DIPS AUR RATES (Petrol & Diesel)
      if (raw.petrol) {
        if (raw.petrol.rate && $('#f-rateP')) { $('#f-rateP').value = raw.petrol.rate; filledCount++; }
        if (raw.petrol.dip && $('#f-dipP')) { $('#f-dipP').value = raw.petrol.dip; filledCount++; }
      }
      if (raw.diesel) {
        if (raw.diesel.rate && $('#f-rateD')) { $('#f-rateD').value = raw.diesel.rate; filledCount++; }
        if (raw.diesel.dip && $('#f-dipD')) { $('#f-dipD').value = raw.diesel.dip; filledCount++; }
      }

      // 2. NOZZLE METER READINGS (Closing / Testing)
      if (Array.isArray(raw.nozzles)) {
        raw.nozzles.forEach((noz, idx) => {
          const closeInp = $(`#f-close-${idx}`) || $(`[name="noz_close_${idx}"]`);
          const testInp = $(`#f-test-${idx}`) || $(`[name="noz_test_${idx}"]`);
          if (closeInp && noz.closing) { closeInp.value = noz.closing; filledCount++; }
          if (testInp && noz.testing !== undefined) { testInp.value = noz.testing; filledCount++; }
        });
      }

      // 3. CASH, PAYTM, SWIPE, KHARCHA & BANK
      if (raw.cash) {
        if (raw.cash.paytm !== undefined && $('#f-paytm')) { $('#f-paytm').value = raw.cash.paytm; filledCount++; }
        if (raw.cash.swipe !== undefined && $('#f-swipe')) { $('#f-swipe').value = raw.cash.swipe; filledCount++; }
        if (raw.cash.kharcha !== undefined && $('#f-kharcha')) { $('#f-kharcha').value = raw.cash.kharcha; filledCount++; }
        if (raw.cash.bank !== undefined && $('#f-bank')) { $('#f-bank').value = raw.cash.bank; filledCount++; }
        if (raw.cash.cash2000 !== undefined && $('#f-cash')) { $('#f-cash').value = raw.cash.cash2000; filledCount++; }
      }

      // 4. UDHAR / LEDGER PARTIES (Khaata Diary us tareekh ke sath)
      if (Array.isArray(raw.ledger) && raw.ledger.length > 0) {
        for (const item of raw.ledger) {
          if (item.party && item.amount > 0 && db()) {
            try {
              await db().collection('entries').add({
                partyName: item.party.trim(),
                vehicle: (item.vehicle || '').toUpperCase().trim(),
                amount: num(item.amount),
                fuel: item.fuel || 'diesel',
                date: targetDate,
                time: APP.nowTime(),
                type: 'credit',
                createdAt: APP.FV.serverTimestamp()
              });
              filledCount++;
            } catch (err) {}
          }
        }
        toast(`${raw.ledger.length} पार्टी उधार (${targetDate}) में दर्ज हुए`);
      }

      // Auto Recalculate
      if (APP.recalc) APP.recalc();
      toast(`तारीख ${targetDate} का हिसाब ऑटो-अपडेट हो गया (${filledCount} एंट्रीज) ✔`);
    } catch (e) {
      alert('Data match nahi hua! Kripya Gemini ka pura code sahi se copy karein.');
    }
  };
