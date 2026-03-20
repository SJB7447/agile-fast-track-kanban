import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

/**
 * Initialize FCM and register token in Firestore.
 * Returns the FCM token or null if unsupported/denied.
 */
export async function initFCM(
  app: FirebaseApp,
  db: Firestore,
  uid: string,
  vapidKey: string,
  firebaseConfig: Record<string, string>
): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('FCM not supported in this browser');
      return null;
    }

    messagingInstance = getMessaging(app);

    // Send firebase config to the FCM service worker
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      // Wait for the SW to be ready
      await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig,
      });
    }

    // Get FCM token
    const token = await getToken(messagingInstance, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') || undefined,
    });

    if (token) {
      // Store token in Firestore
      await setDoc(doc(db, 'fcm_tokens', token), {
        uid,
        token,
        createdAt: Date.now(),
        userAgent: navigator.userAgent,
        platform: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      });
      console.log('FCM token registered:', token.substring(0, 20) + '...');
    }

    return token;
  } catch (e) {
    console.error('FCM init error:', e);
    return null;
  }
}

/**
 * Listen for foreground messages and show notification.
 */
export function onForegroundMessage(
  app: FirebaseApp,
  callback: (title: string, body: string, data?: Record<string, string>) => void
): (() => void) | null {
  try {
    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'Fast-Track Agile';
      const body = payload.notification?.body || '';
      const data = payload.data as Record<string, string> | undefined;
      callback(title, body, data);
    });
    return unsubscribe;
  } catch {
    return null;
  }
}

/**
 * Remove FCM token from Firestore on logout.
 */
export async function removeFCMToken(db: Firestore, token: string | null): Promise<void> {
  if (!token) return;
  try {
    await deleteDoc(doc(db, 'fcm_tokens', token));
  } catch (e) {
    console.error('Failed to remove FCM token:', e);
  }
}
