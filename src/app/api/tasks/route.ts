import { NextRequest, NextResponse } from 'next/server';
import { fetchTasks, createTask, computeTaskStats } from '@/lib/task-api';

export async function GET() {
  try {
    const tasks = await fetchTasks();
    const stats = computeTaskStats(tasks);
    return NextResponse.json({ success: true, tasks, stats });
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
