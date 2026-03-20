export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'To Do' | 'In Progress' | 'Blocked' | 'Done';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  createdAt: number;
  createdBy: string;
  feedbackStatus?: 'request_review' | 'request_revision' | 'pending_approval' | 'approved';
  completedAt?: number;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
}

export interface AiResult {
  type: 'meeting' | 'action';
  summary?: string[];
  actions?: string[];
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  createdAt: number;
}
