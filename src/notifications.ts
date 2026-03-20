// Notification settings stored in localStorage
export interface NotificationSettings {
  enabled: boolean;
  taskCreated: boolean;
  taskUpdated: boolean;
  taskBlocked: boolean;
  taskCompleted: boolean;
  dueDateReminder: boolean;
  commentAdded: boolean;
  feedbackRequest: boolean;
}

const STORAGE_KEY = 'notification_settings';

export const defaultSettings: NotificationSettings = {
  enabled: true,
  taskCreated: true,
  taskUpdated: true,
  taskBlocked: true,
  taskCompleted: true,
  dueDateReminder: true,
  commentAdded: true,
  feedbackRequest: true,
};

export function loadSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultSettings, ...JSON.parse(saved) };
  } catch {}
  return { ...defaultSettings };
}

export function saveSettings(settings: NotificationSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('SW registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

// Request notification permission
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

// Get current permission status
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Show a local notification (no push server needed)
export async function showNotification(
  title: string,
  body: string,
  options?: { tag?: string; url?: string; icon?: string }
): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Try service worker notification first (works on mobile PWA + background tabs)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: options?.icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: options?.tag || 'default',
        renotify: true,
        vibrate: [200, 100, 200],
        silent: false,
        data: { url: options?.url || '/' },
      } as NotificationOptions);
      return;
    } catch (e) {
      console.warn('SW notification failed, falling back:', e);
    }
  }

  // Fallback to basic Notification API (desktop only)
  try {
    new Notification(title, {
      body,
      icon: options?.icon || '/icons/icon-192.png',
      tag: options?.tag || 'default',
    });
  } catch (e) {
    console.warn('Basic notification failed:', e);
  }
}

// Check if the browser supports PWA install
export function canInstallPWA(): boolean {
  return 'serviceWorker' in navigator;
}

// Translation helper type
type TranslateFn = (key: string) => string;

function tpl(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

// Notification type helpers
export function notifyTaskCreated(title: string, assignee: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.taskCreated) {
    const heading = t ? t('notif.push.taskCreated.title') : '새 작업 생성';
    const body = t ? tpl(t('notif.push.taskCreated.body'), { title, assignee }) : `"${title}" 작업이 ${assignee}에게 배정되었습니다.`;
    showNotification(heading, body, { tag: 'task-created' });
  }
}

export function notifyTaskUpdated(title: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.taskUpdated) {
    const heading = t ? t('notif.push.taskUpdated.title') : '작업 업데이트';
    const body = t ? tpl(t('notif.push.taskUpdated.body'), { title }) : `"${title}" 작업이 수정되었습니다.`;
    showNotification(heading, body, { tag: 'task-updated' });
  }
}

export function notifyTaskBlocked(title: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.taskBlocked) {
    const heading = t ? t('notif.push.taskBlocked.title') : '작업 차단됨';
    const body = t ? tpl(t('notif.push.taskBlocked.body'), { title }) : `"${title}" 작업이 Blocked 상태로 변경되었습니다.`;
    showNotification(heading, body, { tag: 'task-blocked' });
  }
}

export function notifyTaskCompleted(title: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.taskCompleted) {
    const heading = t ? t('notif.push.taskCompleted.title') : '작업 완료';
    const body = t ? tpl(t('notif.push.taskCompleted.body'), { title }) : `"${title}" 작업이 완료되었습니다!`;
    showNotification(heading, body, { tag: 'task-completed' });
  }
}

export function notifyDueDateReminder(title: string, dueDate: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.dueDateReminder) {
    const heading = t ? t('notif.push.dueDate.title') : '마감일 알림';
    const body = t ? tpl(t('notif.push.dueDate.body'), { title, dueDate }) : `"${title}" 작업의 마감일(${dueDate})이 다가옵니다.`;
    showNotification(heading, body, { tag: 'due-reminder' });
  }
}

export function notifyCommentAdded(authorName: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.commentAdded) {
    const heading = t ? t('notif.push.comment.title') : '새 코멘트';
    const body = t ? tpl(t('notif.push.comment.body'), { author: authorName }) : `${authorName}님이 새 코멘트를 남겼습니다.`;
    showNotification(heading, body, { tag: 'comment' });
  }
}

export function notifyFeedbackRequest(title: string, type: string, t?: TranslateFn): void {
  const s = loadSettings();
  if (s.feedbackRequest) {
    let typeLabel: string;
    if (t) {
      typeLabel = type === 'request_review' ? t('notif.push.feedback.requestReview') : type === 'request_revision' ? t('notif.push.feedback.requestRevision') : t('notif.push.feedback.pendingApproval');
    } else {
      typeLabel = type === 'request_review' ? '리뷰 요청' : type === 'request_revision' ? '수정 요청' : '승인 대기';
    }
    const heading = t ? t('notif.push.feedback.title') : '피드백 알림';
    const body = t ? tpl(t('notif.push.feedback.body'), { title, type: typeLabel }) : `"${title}" 작업에 ${typeLabel}이 등록되었습니다.`;
    showNotification(heading, body, { tag: 'feedback' });
  }
}
