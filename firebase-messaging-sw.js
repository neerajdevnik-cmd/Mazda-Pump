importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyA48iKeSn1lEAw6WBdKI2tuViGY9H8DWcs",
  authDomain: "mazda---pump.firebaseapp.com",
  projectId: "mazda---pump",
  storageBucket: "mazda---pump.firebasestorage.app",
  messagingSenderId: "966160602555",
  appId: "1:966160602555:web:545bf1f95e2e94d292e09e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification.title;
  const options = {
    body: payload.notification.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data
  };
  self.registration.showNotification(title, options);
});
