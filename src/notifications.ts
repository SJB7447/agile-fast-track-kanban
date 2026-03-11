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
  enabled: false,
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
    const registration = await navigator.serviceWorker.register('/sw.js');
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
  const settings = loadSettings();
  if (!settings.enabled) return;

  if (Notification.permission !== 'granted') return;

  // Try service worker notification first (works even when tab is inactive)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: options?.icon || '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: options?.tag || 'default',
        data: { url: options?.url || '/' },
      } as NotificationOptions);
      return;
    } catch {}
  }

  // Fallback to basic Notification API
  new Notification(title, {
    body,
    icon: options?.icon || '/icons/icon-192.png',
    tag: options?.tag || 'default',
  });
}

// Check if the browser supports PWA install
export function canInstallPWA(): boolean {
  return 'serviceWorker' in navigator;
}

// Notification type helpers
export function notifyTaskCreated(title: string, assignee: string): void {
  const s = loadSettings();
  if (s.taskCreated) {
    showNotification('새 작업 생성', `"${title}" 작업이 ${assignee}에게 배정되었습니다.`, { tag: 'task-created' });
  }
}

export function notifyTaskUpdated(title: string): void {
  const s = loadSettings();
  if (s.taskUpdated) {
    showNotification('작업 업데이트', `"${title}" 작업이 수정되었습니다.`, { tag: 'task-updated' });
  }
}

export function notifyTaskBlocked(title: string): void {
  const s = loadSettings();
  if (s.taskBlocked) {
    showNotification('작업 차단됨', `"${title}" 작업이 Blocked 상태로 변경되었습니다.`, { tag: 'task-blocked' });
  }
}

export function notifyTaskCompleted(title: string): void {
  const s = loadSettings();
  if (s.taskCompleted) {
    showNotification('작업 완료', `"${title}" 작업이 완료되었습니다!`, { tag: 'task-completed' });
  }
}

export function notifyDueDateReminder(title: string, dueDate: string): void {
  const s = loadSettings();
  if (s.dueDateReminder) {
    showNotification('마감일 알림', `"${title}" 작업의 마감일(${dueDate})이 다가옵니다.`, { tag: 'due-reminder' });
  }
}

export function notifyCommentAdded(authorName: string): void {
  const s = loadSettings();
  if (s.commentAdded) {
    showNotification('새 코멘트', `${authorName}님이 새 코멘트를 남겼습니다.`, { tag: 'comment' });
  }
}

export function notifyFeedbackRequest(title: string, type: string): void {
  const s = loadSettings();
  if (s.feedbackRequest) {
    const typeLabel = type === 'request_review' ? '리뷰 요청' : type === 'request_revision' ? '수정 요청' : '승인 대기';
    showNotification('피드백 알림', `"${title}" 작업에 ${typeLabel}이 등록되었습니다.`, { tag: 'feedback' });
  }
}
