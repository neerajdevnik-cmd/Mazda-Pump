/* Mazda Oil Company - Hardware & Permissions (Camera, GPS, Notifications) */
(function () {
  'use strict';
  const APP = window.APP;
  if (!APP) return;

  // 1. NOTIFICATIONS SETUP
  APP.initNotifications = async function () {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return console.log('Push not supported');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return console.log('Permission denied');
      
      const registration = await navigator.serviceWorker.ready;
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: window.CFG.vapidKey, serviceWorkerRegistration: registration });
      
      if (token) {
        await APP.db.collection('fcm_tokens').doc(token).set({
          email: APP.S.user ? APP.S.user.email : 'unknown',
          role: APP.S.role || 'guest',
          updatedAt: APP.FV.serverTimestamp()
        }, { merge: true });
        console.log('FCM Token saved:', token);
      }
    } catch (e) { console.error('FCM Error:', e); }
  };

  // 2. GPS LOCATION (For Geofencing)
  APP.getLocation = function () {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => { console.log('Location error:', err); resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  // 3. DISTANCE CALCULATOR (Haversine formula)
  APP.getDistance = function(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180, dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // 4. VIBRATION
  APP.vibrate = function (pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern || 50);
  };

  // 5. CUSTOM CAMERA UI
  APP.openCamera = function (onCapture) {
    const m = APP.modal(`
      <div style="position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;">
        <video id="cam-video" autoplay playsinline style="flex:1;object-fit:cover;width:100%;height:100%;"></video>
        <div style="padding:20px;display:flex;justify-content:space-around;align-items:center;background:rgba(0,0,0,0.7);">
          <button id="cam-close" style="background:none;border:none;color:#fff;font-size:16px;">✖ बंद</button>
          <button id="cam-capture" style="width:70px;height:70px;border-radius:50%;background:#fff;border:4px solid #ddd;"></button>
          <button id="cam-switch" style="background:none;border:none;color:#fff;font-size:24px;">🔄</button>
        </div>
      </div>
    `);

    const video = m.querySelector('#cam-video');
    let stream = null, facingMode = 'environment';

    async function startCamera() {
      if (stream) stream.getTracks().forEach(t => t.stop());
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        video.srcObject = stream;
      } catch (e) { APP.toast('कैमरा नहीं खुला: ' + e.message); }
    }
    startCamera();

    m.querySelector('#cam-switch').onclick = () => {
      facingMode = facingMode === 'environment' ? 'user' : 'environment';
      startCamera();
    };

    m.querySelector('#cam-capture').onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      if (stream) stream.getTracks().forEach(t => t.stop());
      m.close();
      APP.vibrate([50, 30, 50]); // Haptic feedback on click
      onCapture(dataUrl);
    };

    m.querySelector('#cam-close').onclick = () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      m.close();
    };
  };

  // Boot Notifications
  window.addEventListener('load', () => {
    if (APP.S.role === 'owner' || APP.S.role === 'manager' || APP.S.role === 'salesman') {
      APP.initNotifications();
    }
  });
})();
