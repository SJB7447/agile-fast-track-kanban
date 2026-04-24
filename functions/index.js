const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { auth } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');
const nodemailer = require('nodemailer');

initializeApp();

const DATABASE_ID = process.env.DATABASE_ID;
const db = getFirestore(DATABASE_ID);

function createMailTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendInviteEmail(toEmail, teamName, invitedByName, appUrl) {
  const transporter = createMailTransporter();
  if (!transporter) {
    console.warn('SMTP_USER/SMTP_PASS not configured — skipping email');
    return;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const loginUrl = appUrl || 'https://ai-studio-e8ec37ff-210b-4a12-b903-a1e7fa79036f.web.app';

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">📩</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">팀 초대</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">안녕하세요,</p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
            <strong>${invitedByName}</strong>님이 <strong style="color:#6366f1;">${teamName}</strong> 팀에 초대했습니다.
          </p>
          <div style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:4px;padding:16px 20px;margin:0 0 28px;">
            <p style="margin:0;color:#64748b;font-size:14px;">아래 버튼을 클릭하여 로그인하면 팀에 자동으로 참가됩니다.</p>
          </div>
          <div style="text-align:center;margin:32px 0;">
            <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;">팀 참가하기</a>
          </div>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:24px 0 0;">
            버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
            <a href="${loginUrl}" style="color:#6366f1;">${loginUrl}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">Fast-Track Agile Kanban · 이 메일은 자동 발송되었습니다.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Fast-Track Agile" <${from}>`,
      to: toEmail,
      subject: `[Fast-Track] ${invitedByName}님이 "${teamName}" 팀에 초대했습니다`,
      html,
    });
    console.log(`Invite email sent to ${toEmail}`);
  } catch (err) {
    console.error(`Failed to send invite email to ${toEmail}:`, err.message);
  }
}

/**
 * Send FCM multicast, auto-clean invalid tokens.
 */
const APP_URL = 'https://arboreal-melody-479205-g8.web.app';

async function sendMulticast(notification, data, tokens, tokenDocs) {
  if (tokens.length === 0) return;

  // build absolute link — required for PWA to open correctly on iOS/Android
  const targetPath = (data && data.url) ? data.url : '/';
  const absoluteLink = APP_URL + targetPath;

  const message = {
    notification,
    data: { ...data },
    tokens,
    webpush: {
      notification: {
        icon: APP_URL + '/icons/icon-192.png',
        // badge/renotify/vibrate are not supported on iOS Safari; omit to avoid silent failures
        tag: (data && data.tag) || 'default',
      },
      fcmOptions: { link: absoluteLink },
    },
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`Sent ${response.successCount}/${tokens.length} notifications`);
    if (response.failureCount > 0) {
      const deletes = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered') {
            deletes.push(tokenDocs[idx].ref.delete());
          }
        }
      });
      if (deletes.length > 0) await Promise.all(deletes);
    }
  } catch (error) {
    console.error('FCM send error:', error);
  }
}

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

  await sendMulticast(notification, data, tokens, tokenDocs);
}

/**
 * Send FCM to all admin users only.
 */
async function sendToAdmins(notification, data) {
  const adminsSnap = await db.collection('admins').get();
  if (adminsSnap.empty) return;
  const adminUids = new Set(adminsSnap.docs.map(d => d.id));

  const tokensSnap = await db.collection('fcm_tokens').get();
  if (tokensSnap.empty) return;

  const tokens = [];
  const tokenDocs = [];
  tokensSnap.forEach(doc => {
    const td = doc.data();
    if (adminUids.has(td.uid)) {
      tokens.push(td.token);
      tokenDocs.push(doc);
    }
  });

  await sendMulticast(notification, data, tokens, tokenDocs);
}

/**
 * Send FCM to a specific user by UID.
 */
async function sendToUserByUid(uid, notification, data) {
  const tokensSnap = await db.collection('fcm_tokens').where('uid', '==', uid).get();
  if (tokensSnap.empty) return;

  const tokens = [];
  const tokenDocs = [];
  tokensSnap.forEach(doc => {
    tokens.push(doc.data().token);
    tokenDocs.push(doc);
  });

  await sendMulticast(notification, data, tokens, tokenDocs);
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

// ========== Comment Created (일반 채널) ==========
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

// ========== Team Chat Message Created (팀 채널) ==========
exports.onTeamMessageCreated = onDocumentCreated(
  { document: 'teamComments/{teamId}/messages/{messageId}', database: DATABASE_ID },
  async (event) => {
    const message = event.data?.data();
    const teamId = event.params?.teamId;
    if (!message || !teamId) return;

    // Get team info to find member UIDs and team name
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) return;
    const team = teamDoc.data();
    const teamName = team.name || '팀';
    const memberUids = new Set((team.members || []).map(m => m.uid));

    // Fetch only tokens belonging to team members (exclude message author)
    const allTokensSnap = await db.collection('fcm_tokens').get();
    const tokens = [];
    const tokenDocs = [];
    allTokensSnap.forEach(doc => {
      const td = doc.data();
      if (memberUids.has(td.uid) && td.uid !== message.authorId) {
        tokens.push(td.token);
        tokenDocs.push(doc);
      }
    });

    if (tokens.length === 0) return;
    await sendMulticast(
      { title: `💬 #${teamName}`, body: `${message.authorName}: ${message.text.substring(0, 100)}` },
      { type: 'team-comment', tag: 'team-comment', url: '/?tab=comments' },
      tokens,
      tokenDocs
    );
  }
);

// ========== Team Invite Created ==========
exports.onTeamInviteCreated = onDocumentCreated(
  { document: 'team_invites/{email}', database: DATABASE_ID },
  async (event) => {
    const invite = event.data?.data();
    const email = event.params?.email;
    if (!invite || !email) return;

    const invitedBy = invite.invitedByName || invite.invitedBy || '관리자';

    // Send invite email (works even for users who haven't signed up yet)
    await sendInviteEmail(email, invite.teamName, invitedBy, null);

    // Also send FCM push notification if the user already has an account
    const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!usersSnap.empty) {
      const uid = usersSnap.docs[0].id;
      await sendToUserByUid(
        uid,
        { title: '📩 팀 초대', body: `"${invite.teamName}" 팀에 초대되었습니다.` },
        { type: 'team-invite', tag: 'team-invite', url: '/?tab=teams' }
      );
    }

    // Notify all admins about the invite being sent
    await sendToAdmins(
      { title: '📩 팀 초대 발송', body: `${invitedBy} → ${email} (${invite.teamName})` },
      { type: 'team-invite-sent', tag: 'team-invite-sent', url: '/?tab=teams' }
    );
  }
);

// ========== Auth: Auto-save user profile on sign-up ==========
exports.onUserCreated = auth.user().onCreate(async (user) => {
  const now = Date.now();
  const displayName = user.displayName || user.email || '알 수 없음';
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email: user.email || '',
    displayName,
    photoURL: user.photoURL || null,
    lastLoginAt: now,
    createdAt: now,
  });

  // Notify all admins about the new sign-up
  await sendToAdmins(
    { title: '👤 새 가입자', body: `${displayName} (${user.email || ''}) 가입했습니다.` },
    { type: 'new-user', tag: 'new-user', url: '/?tab=members' }
  );
});

// ========== Auth: Clean up user data on delete ==========
exports.onUserDeleted = auth.user().onDelete(async (user) => {
  await db.collection('users').doc(user.uid).delete().catch(() => {});
});

// ========== Callable: Delete own account ==========
exports.deleteOwnAccount = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new Error('unauthenticated');
  const uid = request.auth.uid;
  // Firestore cleanup
  await db.collection('users').doc(uid).delete().catch(() => {});
  await db.collection('userTeams').doc(uid).delete().catch(() => {});
  await db.collection('admins').doc(uid).delete().catch(() => {});
  // Remove from any team members array
  const teamsSnap = await db.collection('teams').get();
  const batch = db.batch();
  teamsSnap.docs.forEach(teamDoc => {
    const team = teamDoc.data();
    if (team.members?.some(m => m.uid === uid)) {
      batch.update(teamDoc.ref, { members: team.members.filter(m => m.uid !== uid) });
    }
  });
  await batch.commit();
  // Remove FCM tokens
  const tokensSnap = await db.collection('fcm_tokens').get();
  const tokenDeletes = [];
  tokensSnap.forEach(doc => { if (doc.data().uid === uid) tokenDeletes.push(doc.ref.delete()); });
  await Promise.all(tokenDeletes);
  // Delete Firebase Auth account
  await getAuth().deleteUser(uid);
  return { success: true };
});

// ========== Callable: Admin force-delete user ==========
exports.adminDeleteUser = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new Error('unauthenticated');
  const adminDoc = await db.collection('admins').doc(request.auth.uid).get();
  if (!adminDoc.exists) throw new Error('permission-denied');
  const { targetUid } = request.data;
  if (!targetUid) throw new Error('invalid-argument');
  // Same cleanup as deleteOwnAccount
  await db.collection('users').doc(targetUid).delete().catch(() => {});
  await db.collection('userTeams').doc(targetUid).delete().catch(() => {});
  await db.collection('admins').doc(targetUid).delete().catch(() => {});
  const teamsSnap = await db.collection('teams').get();
  const batch = db.batch();
  teamsSnap.docs.forEach(teamDoc => {
    const team = teamDoc.data();
    if (team.members?.some(m => m.uid === targetUid)) {
      batch.update(teamDoc.ref, { members: team.members.filter(m => m.uid !== targetUid) });
    }
  });
  await batch.commit();
  const tokensSnap = await db.collection('fcm_tokens').get();
  const tokenDeletes = [];
  tokensSnap.forEach(doc => { if (doc.data().uid === targetUid) tokenDeletes.push(doc.ref.delete()); });
  await Promise.all(tokenDeletes);
  await getAuth().deleteUser(targetUid);
  return { success: true };
});

// ========== Callable: Set team folder config (Admin SDK bypasses rules) ==========
const INITIAL_ADMIN_EMAIL = 'sjb76337447@gmail.com';

async function verifyAdminCaller(request) {
  if (!request.auth) throw new Error('unauthenticated');
  const email = request.auth.token.email || '';
  if (email === INITIAL_ADMIN_EMAIL) return;
  const adminDoc = await db.collection('admins').doc(request.auth.uid).get();
  if (!adminDoc.exists) throw new Error('permission-denied');
}

exports.setTeamFolderConfig = onCall({ region: 'us-central1' }, async (request) => {
  await verifyAdminCaller(request);
  const { folderId, folderName, folderUrl, teamId } = request.data;
  if (!folderId) throw new Error('folderId is required');

  if (teamId) {
    // Per-team folder: update teams/{teamId}
    await db.collection('teams').doc(teamId).update({ driveFolderId: folderId, driveFolderUrl: folderUrl || '' });
  } else {
    // Global shared folder: config/teamDriveFolder
    await db.collection('config').doc('teamDriveFolder').set({
      folderId,
      folderName: folderName || '팀 공유 폴더',
      folderUrl: folderUrl || '',
      setBy: request.auth.token.email || 'admin',
      setAt: Date.now(),
    });
  }
  return { success: true };
});

exports.deleteTeamFolderConfig = onCall({ region: 'us-central1' }, async (request) => {
  await verifyAdminCaller(request);
  const { teamId } = request.data || {};
  if (teamId) {
    await db.collection('teams').doc(teamId).update({ driveFolderId: '', driveFolderUrl: '' });
  } else {
    await db.collection('config').doc('teamDriveFolder').delete();
  }
  return { success: true };
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
