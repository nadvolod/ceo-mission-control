import type { AiTask } from './types';

const getBaseUrl = () => process.env.AI_TASK_LIST_URL || 'https://tasklistai.vercel.app';
const getApiKey = () => process.env.AI_TASK_LIST_API_KEY || '';

async function taskApi(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function fetchTasks(): Promise<AiTask[]> {
  const res = await taskApi('/api/tasks');
  if (!res.ok) {
    console.error('Failed to fetch tasks:', res.status, await res.text());
    return [];
  }
  return res.json();
}

export async function createTask(data: { title: string; description?: string; category?: string; dueDate?: string; monetaryValue?: number; urgency?: number; strategicValue?: number }): Promise<AiTask | null> {
  const res = await taskApi('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error('Failed to create task:', res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function updateTask(id: number, data: Partial<{ title: string; status: string; description: string; category: string; dueDate: string; monetaryValue: number; urgency: number; strategicValue: number }>): Promise<AiTask | null> {
  const res = await taskApi(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    console.error('Failed to update task:', res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function deleteTask(id: number): Promise<boolean> {
  const res = await taskApi(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    console.error('Failed to delete task:', res.status, await res.text());
    return false;
  }
  return true;
}

export function computeTaskStats(tasks: AiTask[]): { total: number; todo: number; doing: number; doneToday: number; overdue: number } {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  return {
    total: tasks.filter(t => !t.parentId).length,
    todo: tasks.filter(t => t.status === 'todo' && !t.parentId).length,
    doing: tasks.filter(t => t.status === 'doing' && !t.parentId).length,
    doneToday: tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today) && !t.parentId).length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done' && !t.parentId).length,
  };
}
