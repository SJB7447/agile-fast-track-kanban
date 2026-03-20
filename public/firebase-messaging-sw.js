// Unified Service Worker: PWA Caching + Firebase Cloud Messaging
importScripts('https://www.googleapis.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.googleapis.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ===== Firebase Cloud Messaging =====
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

// ===== PWA Caching =====
const CACHE_NAME = 'fast-track-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigation/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  if (request.url.includes('/api/') || request.url.includes('googleapis.com') || request.url.includes('firestore')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ===== Notification Handlers =====

// Push notification handler (for direct push, non-FCM)
self.addEventListener('push', (event) => {
  let data = { title: 'Fast-Track Agile', body: '', icon: '/icons/icon-192.png' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'default',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Listen for messages from main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
