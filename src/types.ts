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
}
