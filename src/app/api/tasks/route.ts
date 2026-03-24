import { NextRequest, NextResponse } from 'next/server';
import { TaskManager } from '@/lib/task-manager';
import { readInitiatives } from '@/lib/workspace-reader';

export async function GET() {
  try {
    const taskManager = await TaskManager.create();
    const tasks = taskManager.getTasks();
    const taskStats = taskManager.getTasksWithStatus(true);
    const upcomingDeadlines = taskManager.getUpcomingDeadlines();

    return NextResponse.json({
      tasks,
      stats: taskStats,
      upcomingDeadlines,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const taskManager = await TaskManager.create();
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create':
        const task = await taskManager.createTask(data);
        return NextResponse.json({ task });

      case 'update':
        const { taskId, updates } = data;
        const updatedTask = await taskManager.updateTask(taskId, updates);
        if (!updatedTask) {
          return NextResponse.json(
            { error: 'Task not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ task: updatedTask });

      case 'updateStatus':
        const { taskId: statusTaskId, status, note } = data;
        const statusUpdatedTask = await taskManager.updateTaskStatus(statusTaskId, status, note);
        if (!statusUpdatedTask) {
          return NextResponse.json(
            { error: 'Task not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ task: statusUpdatedTask });

      case 'processConversation':
        const { message } = data;
        const extraction = taskManager.extractFromConversation(message);
        const result = await taskManager.processNaturalLanguageUpdate(message);

        return NextResponse.json({
          extraction,
          created: result.created,
          updated: result.updated
        });

      case 'seedFromInitiatives':
        const initiatives = await readInitiatives();
        await taskManager.seedFromInitiatives(initiatives);
        const seededTasks = taskManager.getTasks();
        return NextResponse.json({ tasks: seededTasks });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing task request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}