import { NextRequest, NextResponse } from 'next/server';
import { updateTask, deleteTask } from '@/lib/task-api';
import { checkAuth } from '@/lib/auth';
import { FinancialTracker } from '@/lib/financial-tracker';
import type { AiTask } from '@/lib/types';

function inferFinancialCategory(task: AiTask): 'moved' | 'generated' | 'cut' {
  const cat = (task.category || '').toLowerCase();
  if (cat === 'revenue' || cat === 'temporal') return 'generated';
  if (cat === 'finance' || cat === 'admin') return 'cut';
  return 'moved';
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const taskId = parseInt(id);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid task ID' }, { status: 400 });
    }
    const body = await request.json();
    const task = await updateTask(taskId, body);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
    }

    // Auto-create financial entry when a task with monetaryValue is completed
    // Deduplicate: only create if no entry already exists today for this task
    if (body.status === 'done' && task.monetaryValue && task.monetaryValue > 0) {
      try {
        const tracker = await FinancialTracker.create();
        const marker = `[task:${taskId}]`;
        const todaysEntries = tracker.getTodaysMetrics().entries;
        const alreadyLogged = todaysEntries.some((e) => e.description.includes(marker));
        if (!alreadyLogged) {
          const category = inferFinancialCategory(task);
          await tracker.addEntry(category, task.monetaryValue, `${marker} Task completed: ${task.title}`);
          console.log(`Auto-created financial entry: ${category} $${task.monetaryValue} for "${task.title}"`);
        }
      } catch (err) {
        console.error('Error auto-creating financial entry for completed task:', err);
      }
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const taskId = parseInt(id);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid task ID' }, { status: 400 });
    }
    const success = await deleteTask(taskId);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
