// Firebase Cloud Messaging Service Worker
importScripts('https://www.googleapis.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.googleapis.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config is injected at runtime via message from main app
let firebaseConfig = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Handle background push messages
    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon } = payload.notification || {};
      const data = payload.data || {};

      self.registration.showNotification(title || 'Fast-Track Agile', {
        body: body || '',
        icon: icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'fcm-default',
        renotify: true,
        data: { url: data.url || '/' },
      });
    });
  }
});
