// Firebase Cloud Messaging Service Worker
importScripts('https://www.googleapis.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.googleapis.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase config hardcoded so background push works even when app is closed
const firebaseConfig = {
  apiKey: 'AIzaSyBbNjH84SOMYxxyd65VpV1ZWhDwudywC70',
  authDomain: 'arboreal-melody-479205-g8.firebaseapp.com',
  projectId: 'arboreal-melody-479205-g8',
  storageBucket: 'arboreal-melody-479205-g8.firebasestorage.app',
  messagingSenderId: '485530846598',
  appId: '1:485530846598:web:cae4891a36e6fde1469807',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background push messages (when app is closed or in background)
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

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
