// Unified Service Worker: PWA Caching + Firebase Cloud Messaging

// ===== Safe notification helper (iOS-compatible) =====
function showSafeNotification(title, body, data) {
  const options = {
    body: body || '',
    icon: '/icons/icon-192.png',
    tag: (data && data.tag) || 'fcm-default',
    data: { url: (data && data.url) || '/' },
  };
  // badge / vibrate / renotify are not supported on iOS Safari — omit to prevent SW failure
  const ua = (self.navigator && self.navigator.userAgent) || '';
  const isIOS = /iP(hone|ad|od)/.test(ua);
  if (!isIOS) {
    options.badge = '/icons/icon-192.png';
    options.renotify = true;
    options.vibrate = [200, 100, 200];
  }
  return self.registration.showNotification(title || 'Fast-Track Agile', options);
}

// ===== Firebase Cloud Messaging =====
// gstatic.com is more reliable than googleapis.com (fewer corporate firewall blocks)
let firebaseMessagingReady = false;
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

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
  firebaseMessagingReady = true;

  // Handle background FCM messages (app closed / backgrounded)
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};
    return showSafeNotification(title, body, data);
  });
} catch (e) {
  // Firebase failed to load (e.g. iOS Safari CDN restriction) — fallback push handler below
  console.warn('[SW] Firebase messaging unavailable, using native push fallback:', e);
}

// ===== Fallback: Native Web Push handler =====
// Runs when Firebase messaging is not active (iOS Safari, offline CDN, etc.)
self.addEventListener('push', (event) => {
  if (firebaseMessagingReady) return; // Firebase handles it when active

  let title = 'Fast-Track Agile';
  let body = '';
  let data = {};
  if (event.data) {
    try {
      const json = event.data.json();
      // FCM payload structure
      title = (json.notification && json.notification.title) || json.title || title;
      body = (json.notification && json.notification.body) || json.body || '';
      data = json.data || {};
    } catch {
      body = event.data.text();
    }
  }

  event.waitUntil(showSafeNotification(title, body, data));
});

// ===== PWA Caching =====
const CACHE_NAME = 'fast-track-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

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

  if (
    request.url.includes('/api/') ||
    request.url.includes('googleapis.com') ||
    request.url.includes('firestore') ||
    request.url.includes('fcm')
  ) {
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

// ===== Notification click handler =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  const absoluteUrl = targetUrl.startsWith('http')
    ? targetUrl
    : self.location.origin + targetUrl;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          // navigate() updates the URL so the app reads correct tab params on (re)mount;
          // postMessage is a secondary mechanism for when navigate() is unsupported (e.g. iOS)
          client.postMessage({ type: 'NAVIGATE_TAB', url: targetUrl });
          if ('navigate' in client) {
            return client.navigate(absoluteUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(absoluteUrl);
    })
  );
});

// ===== Message handler =====
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
