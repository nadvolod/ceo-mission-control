import { NextRequest, NextResponse } from 'next/server';
import { fetchTasks, createTask, computeTaskStats } from '@/lib/task-api';
import { loadJSON } from '@/lib/storage';
import type { SyncedTask, AiTask } from '@/lib/types';

function syncedToAiTask(task: SyncedTask, index: number): AiTask {
  const priorityMap: Record<string, number> = { 'Critical': 90, 'High': 70, 'Medium': 50, 'Low': 30 };
  return {
    id: -(index + 1), // Negative IDs to avoid collisions with external tasks
    title: task.title,
    description: task.description,
    status: task.status,
    priorityScore: priorityMap[task.priority] ?? 50,
    priorityReason: task.missionRelevance,
    monetaryValue: task.monetaryValue,
    revenuePotential: null,
    urgency: null,
    strategicValue: null,
    dueDate: task.dueDate,
    category: task.category,
    assignee: null,
    parentId: null,
    recurrenceRule: null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function GET() {
  try {
    // Try synced tasks from Neon first
    const syncedData = await loadJSON<{ tasks: SyncedTask[] } | null>('synced-tasks.json', null);
    if (syncedData?.tasks && syncedData.tasks.length > 0) {
      const tasks = syncedData.tasks.map(syncedToAiTask);
      const stats = computeTaskStats(tasks);
      return NextResponse.json({ success: true, tasks, stats, source: 'synced' });
    }

    // Fallback to external AI task list
    const tasks = await fetchTasks();
    const stats = computeTaskStats(tasks);
    return NextResponse.json({ success: true, tasks, stats, source: 'external' });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = await createTask(body);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
    }
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
