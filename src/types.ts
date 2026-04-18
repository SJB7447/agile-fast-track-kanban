export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'To Do' | 'In Progress' | 'Blocked' | 'Done';
export type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Cancelled';

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
  projectId?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  color: string;
  startDate: string;
  endDate: string;
  createdAt: number;
  createdBy: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string;
  agenda: string;
  projectId: string;
  createdAt: number;
  createdBy: string;
  createdByName: string;
}

export interface TeamMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'member' | 'lead';
  joinedAt: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  createdBy: string;
  members: TeamMember[];
  inviteEmails: string[];
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  allDay: boolean;
  createdBy: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  lastLoginAt: number;
  createdAt: number;
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
  replyTo?: { id: string; text: string; authorName: string };
  reactions?: Record<string, string[]>;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'update' | 'notice' | 'urgent';
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  createdAt: number;
  pinned?: boolean;
}
