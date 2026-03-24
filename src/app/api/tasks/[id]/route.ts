import { NextRequest, NextResponse } from 'next/server';
import { updateTask, deleteTask } from '@/lib/task-api';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
