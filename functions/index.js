const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const DATABASE_ID = 'ai-studio-e8ec37ff-210b-4a12-b903-a1e7fa79036f';
const db = getFirestore(DATABASE_ID);

/**
 * Triggered when a new announcement is created.
 * Sends FCM push notification to all registered devices.
 */
exports.onAnnouncementCreated = onDocumentCreated(
  { document: 'announcements/{announcementId}', database: DATABASE_ID },
  async (event) => {
    const announcement = event.data?.data();
    if (!announcement) return;

    // Build notification
    const typeEmoji = announcement.type === 'urgent' ? '🚨' :
                      announcement.type === 'update' ? '🚀' : '📢';
    const typeLabel = announcement.type === 'urgent' ? '긴급' :
                      announcement.type === 'update' ? '업데이트' : '공지';

    const notification = {
      title: `${typeEmoji} ${typeLabel}`,
      body: announcement.title,
    };

    const data = {
      type: 'announcement',
      announcementId: event.params.announcementId,
      tag: 'announcement',
      url: '/',
    };

    // Get all FCM tokens
    const tokensSnapshot = await db.collection('fcm_tokens').get();

    if (tokensSnapshot.empty) {
      console.log('No FCM tokens registered');
      return;
    }

    // Collect all tokens (send to all devices including author's other devices)
    const tokens = [];
    const tokenDocs = [];
    tokensSnapshot.forEach((doc) => {
      const tokenData = doc.data();
      tokens.push(tokenData.token);
      tokenDocs.push(doc);
    });

    // Send to all tokens
    const message = {
      notification,
      data,
      tokens,
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
          renotify: true,
          tag: 'announcement',
        },
        fcmOptions: {
          link: '/',
        },
      },
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      console.log(`Sent ${response.successCount}/${tokens.length} notifications`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const tokensToDelete = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              tokensToDelete.push(tokenDocs[idx].ref.delete());
            }
          }
        });
        if (tokensToDelete.length > 0) {
          await Promise.all(tokensToDelete);
          console.log(`Cleaned up ${tokensToDelete.length} invalid tokens`);
        }
      }
    } catch (error) {
      console.error('FCM send error:', error);
    }
  }
);
