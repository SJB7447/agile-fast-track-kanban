const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

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
      { type: 'announcement', tag: 'announcement', url: '/' },
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
      { type: 'task-created', tag: 'task-created', url: '/' },
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
      { type: 'task-updated', tag, url: '/' },
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
      { type: 'comment', tag: 'comment', url: '/' },
      comment.authorId || null
    );
  }
);
