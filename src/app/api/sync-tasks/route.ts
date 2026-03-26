import { NextRequest, NextResponse } from 'next/server';
import { loadJSON, saveJSON } from '@/lib/storage';
import { checkAuth } from '@/lib/auth';
import { localTaskToSynced, syncedToLocalTask, mergeTasks } from '@/lib/task-sync';
import type { LocalTask, SyncedTask, SyncResult } from '@/lib/types';

const STORE_KEY = 'synced-tasks.json';

/**
 * GET /api/sync-tasks
 * Returns current synced tasks from Neon (for dashboard consumption).
 */
export async function GET() {
  try {
    const data = await loadJSON<{ tasks: SyncedTask[] } | null>(STORE_KEY, null);
    const tasks = data?.tasks ?? [];
    return NextResponse.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('Error reading synced tasks:', error);
    return NextResponse.json({ error: 'Failed to read synced tasks' }, { status: 500 });
  }
}

/**
 * POST /api/sync-tasks
 * Actions:
 *   - push: Merge local tasks into Neon (last-write-wins)
 *   - pull: Return tasks in local format (for writing back to tasks.json)
 */
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'push': {
        const localTasks: LocalTask[] = body.tasks;
        if (!Array.isArray(localTasks)) {
          return NextResponse.json({ error: 'tasks must be an array' }, { status: 400 });
        }

        const incoming = localTasks.map(localTaskToSynced);
        const existing = (await loadJSON<{ tasks: SyncedTask[] } | null>(STORE_KEY, null))?.tasks ?? [];
        const merged = mergeTasks(incoming, existing);

        await saveJSON(STORE_KEY, { tasks: merged, lastSynced: new Date().toISOString() });

        const result: SyncResult = {
          pushed: incoming.length,
          pulled: 0,
          merged: merged.length,
          timestamp: new Date().toISOString(),
        };

        console.log(`Task sync push: ${incoming.length} incoming, ${existing.length} existing → ${merged.length} merged`);
        return NextResponse.json(result);
      }

      case 'pull': {
        const data = await loadJSON<{ tasks: SyncedTask[] } | null>(STORE_KEY, null);
        const tasks = data?.tasks ?? [];
        const localTasks = tasks.map(syncedToLocalTask);

        const result: SyncResult = {
          pushed: 0,
          pulled: localTasks.length,
          merged: 0,
          timestamp: new Date().toISOString(),
        };

        return NextResponse.json({ ...result, tasks: localTasks });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in sync-tasks:', error);
    return NextResponse.json({ error: 'Failed to process sync request' }, { status: 500 });
  }
}
