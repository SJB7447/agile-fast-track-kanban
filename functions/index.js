const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { auth } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');

initializeApp();

const DATABASE_ID = 'ai-studio-e8ec37ff-210b-4a12-b903-a1e7fa79036f';
const db = getFirestore(DATABASE_ID);

/**
 * Send FCM multicast, auto-clean invalid tokens.
 */
async function sendToAllTokens(notification, data, excludeUid) {
  const tokensSnapshot = await db.collection('fcm_tokens').get();
  if (tokensSnapshot.empty) {
    console.log('No FCM tokens registered');
    return;
  }

  const tokens = [];
  const tokenDocs = [];
  tokensSnapshot.forEach((doc) => {
    const tokenData = doc.data();
    if (!excludeUid || tokenData.uid !== excludeUid) {
      tokens.push(tokenData.token);
      tokenDocs.push(doc);
    }
  });

  if (tokens.length === 0) {
    console.log('No eligible tokens after filtering');
    return;
  }

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
        tag: data.tag || 'default',
      },
      fcmOptions: {
        link: '/',
      },
    },
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`Sent ${response.successCount}/${tokens.length} notifications`);

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

// ========== Announcement Created ==========
exports.onAnnouncementCreated = onDocumentCreated(
  { document: 'announcements/{announcementId}', database: DATABASE_ID },
  async (event) => {
    const announcement = event.data?.data();
    if (!announcement) return;

    const typeEmoji = announcement.type === 'urgent' ? '🚨' :
                      announcement.type === 'update' ? '🚀' : '📢';
    const typeLabel = announcement.type === 'urgent' ? '긴급' :
                      announcement.type === 'update' ? '업데이트' : '공지';

    await sendToAllTokens(
      { title: `${typeEmoji} ${typeLabel}`, body: announcement.title },
      { type: 'announcement', tag: 'announcement', url: '/?tab=announcements' },
      null // send to everyone
    );
  }
);

// ========== Task Created ==========
exports.onTaskCreated = onDocumentCreated(
  { document: 'tasks/{taskId}', database: DATABASE_ID },
  async (event) => {
    const task = event.data?.data();
    if (!task) return;

    const assignee = task.assignee || '미배정';
    await sendToAllTokens(
      { title: '➕ 새 작업 생성', body: `"${task.title}" → ${assignee}` },
      { type: 'task-created', tag: 'task-created', url: '/?tab=board' },
      task.createdBy || null
    );
  }
);

// ========== Task Updated ==========
exports.onTaskUpdated = onDocumentUpdated(
  { document: 'tasks/{taskId}', database: DATABASE_ID },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const modifiedBy = after.lastModifiedBy || null;
    let notification = null;

    // Status → Blocked
    if (before.status !== 'Blocked' && after.status === 'Blocked') {
      notification = { title: '🚫 작업 차단됨', body: `"${after.title}" → Blocked` };
    }
    // Status → Done
    else if (before.status !== 'Done' && after.status === 'Done') {
      notification = { title: '✅ 작업 완료', body: `"${after.title}" 완료!` };
    }
    // Feedback status changed
    else if (before.feedbackStatus !== after.feedbackStatus && after.feedbackStatus) {
      const typeLabel = after.feedbackStatus === 'request_review' ? '리뷰 요청' :
                        after.feedbackStatus === 'request_revision' ? '수정 요청' :
                        after.feedbackStatus === 'pending_approval' ? '승인 대기' : '승인됨';
      notification = { title: '👁 피드백 알림', body: `"${after.title}" → ${typeLabel}` };
    }
    // Other field changes
    else if (
      before.title !== after.title ||
      before.description !== after.description ||
      before.assignee !== after.assignee ||
      before.dueDate !== after.dueDate ||
      before.priority !== after.priority ||
      (before.status !== after.status && after.status !== 'Blocked' && after.status !== 'Done')
    ) {
      notification = { title: '📝 작업 업데이트', body: `"${after.title}" 수정됨` };
    }

    if (!notification) return;

    const tag = before.status !== after.status ? `task-${after.status.toLowerCase().replace(' ', '-')}` : 'task-updated';
    await sendToAllTokens(
      notification,
      { type: 'task-updated', tag, url: '/?tab=board' },
      modifiedBy
    );
  }
);

// ========== Comment Created ==========
exports.onCommentCreated = onDocumentCreated(
  { document: 'comments/{commentId}', database: DATABASE_ID },
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;

    await sendToAllTokens(
      { title: '💬 새 코멘트', body: `${comment.authorName}: ${comment.text.substring(0, 100)}` },
      { type: 'comment', tag: 'comment', url: '/?tab=comments' },
      comment.authorId || null
    );
  }
);

// ========== Auth: Auto-save user profile on sign-up ==========
exports.onUserCreated = auth.user().onCreate(async (user) => {
  const now = Date.now();
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email || '알 수 없음',
    photoURL: user.photoURL || null,
    lastLoginAt: now,
    createdAt: now,
  });
});

// ========== Auth: Clean up user data on delete ==========
exports.onUserDeleted = auth.user().onDelete(async (user) => {
  await db.collection('users').doc(user.uid).delete().catch(() => {});
});

// ========== Callable: Sync all Firebase Auth users to Firestore ==========
exports.syncAuthUsers = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new Error('unauthenticated');
  }
  // Verify caller is admin
  const adminDoc = await db.collection('admins').doc(request.auth.uid).get();
  if (!adminDoc.exists) {
    throw new Error('permission-denied');
  }

  const authInstance = getAuth();
  let pageToken;
  let count = 0;

  do {
    const result = await authInstance.listUsers(1000, pageToken);
    const batch = db.batch();
    result.users.forEach((user) => {
      const ref = db.collection('users').doc(user.uid);
      batch.set(ref, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email || '알 수 없음',
        photoURL: user.photoURL || null,
        lastLoginAt: user.metadata.lastSignInTime
          ? new Date(user.metadata.lastSignInTime).getTime()
          : Date.now(),
        createdAt: user.metadata.creationTime
          ? new Date(user.metadata.creationTime).getTime()
          : Date.now(),
      }, { merge: true });
      count++;
    });
    await batch.commit();
    pageToken = result.pageToken;
  } while (pageToken);

  return { synced: count };
});
