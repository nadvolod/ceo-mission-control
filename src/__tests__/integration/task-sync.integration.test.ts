/**
 * @jest-environment node
 *
 * Task sync integration tests — hit the real Neon DB via the storage layer.
 * Requires DATABASE_URL env var. Will fail with a clear message if not set.
 */

import { NextRequest } from 'next/server';
import { loadJSON, saveJSON } from '@/lib/storage';
import { ensureDbReady, getDb } from '@/lib/db';
import { GET as syncGet, POST as syncPost } from '@/app/api/sync-tasks/route';
import { GET as tasksGet } from '@/app/api/tasks/route';
import type { SyncedTask, LocalTask } from '@/lib/types';

const REQUIRED_ENV = 'DATABASE_URL';

beforeAll(() => {
  if (!process.env[REQUIRED_ENV]) {
    throw new Error(
      `Integration tests require ${REQUIRED_ENV} to be set. ` +
      'Run: vercel env pull .env.local && source .env.local, ' +
      'or set DATABASE_URL in your environment.'
    );
  }
});

const STORE_KEY = 'synced-tasks.json';
let originalData: unknown = null;

beforeAll(async () => {
  await ensureDbReady();
  originalData = await loadJSON(STORE_KEY, null);
});

afterAll(async () => {
  // Restore original data
  if (originalData) {
    await saveJSON(STORE_KEY, originalData);
  } else {
    // Clean up test data
    const db = getDb();
    if (db) {
      await db`DELETE FROM data_store WHERE key = ${STORE_KEY}`;
    }
  }
});

function makeRequest(method: string, body?: unknown, headers?: Record<string, string>): NextRequest {
  const url = 'http://localhost:3000/api/sync-tasks';
  const authHeaders: Record<string, string> = {};
  if (process.env.SYNC_API_KEY) {
    authHeaders['x-sync-api-key'] = process.env.SYNC_API_KEY;
  }
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeLocalTask(id: string, overrides: Partial<LocalTask> = {}): LocalTask {
  return {
    id,
    title: `Test Task ${id}`,
    description: `Description for ${id}`,
    status: 'In Progress',
    priority: 'High',
    projectId: 'Temporal',
    tags: ['test', 'integration'],
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-25T01:00:00Z',
    ...overrides,
  };
}

describe('Task sync API (real DB)', () => {
  beforeEach(async () => {
    // Clear synced tasks before each test
    await saveJSON(STORE_KEY, { tasks: [], lastSynced: new Date().toISOString() });
  });

  it('pushes local tasks and stores them in Neon', async () => {
    const tasks = [
      makeLocalTask('push-1'),
      makeLocalTask('push-2', { status: 'Not Started', priority: 'Critical' }),
      makeLocalTask('push-3', { status: 'Done' }),
      makeLocalTask('push-4', { monthlyRevenueImpact: 5000, missionRelevance: 'Mission Critical' }),
      makeLocalTask('push-5', { tags: ['finance'], projectId: 'Revenue' }),
    ];

    const response = await syncPost(makeRequest('POST', { action: 'push', tasks }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.pushed).toBe(5);
    expect(result.merged).toBe(5);

    // Verify in DB
    const stored = await loadJSON<{ tasks: SyncedTask[] }>(STORE_KEY, { tasks: [] });
    expect(stored.tasks).toHaveLength(5);
  });

  it('does not create duplicates on re-push', async () => {
    const tasks = [makeLocalTask('dup-1'), makeLocalTask('dup-2')];

    await syncPost(makeRequest('POST', { action: 'push', tasks }));
    await syncPost(makeRequest('POST', { action: 'push', tasks }));

    const stored = await loadJSON<{ tasks: SyncedTask[] }>(STORE_KEY, { tasks: [] });
    expect(stored.tasks).toHaveLength(2);
  });

  it('merges with last-write-wins on conflict', async () => {
    const task1 = makeLocalTask('merge-1', { title: 'Version 1', updatedAt: '2026-03-25T01:00:00Z' });
    await syncPost(makeRequest('POST', { action: 'push', tasks: [task1] }));

    const task2 = makeLocalTask('merge-1', { title: 'Version 2', updatedAt: '2026-03-25T02:00:00Z' });
    await syncPost(makeRequest('POST', { action: 'push', tasks: [task2] }));

    const stored = await loadJSON<{ tasks: SyncedTask[] }>(STORE_KEY, { tasks: [] });
    expect(stored.tasks).toHaveLength(1);
    expect(stored.tasks[0].title).toBe('Version 2');
  });

  it('pulls tasks in local format', async () => {
    const tasks = [
      makeLocalTask('pull-1', { status: 'In Progress', monthlyRevenueImpact: 10000 }),
      makeLocalTask('pull-2', { status: 'Done', tags: ['revenue'] }),
    ];
    await syncPost(makeRequest('POST', { action: 'push', tasks }));

    const response = await syncPost(makeRequest('POST', { action: 'pull' }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.pulled).toBe(2);
    expect(result.tasks).toHaveLength(2);

    // Verify local format
    const pulled = result.tasks.find((t: LocalTask) => t.id === 'pull-1');
    expect(pulled).toBeTruthy();
    expect(pulled.status).toBe('In Progress');
    expect(pulled.monthlyRevenueImpact).toBe(10000);
  });

  it('returns empty array when no synced tasks exist', async () => {
    await saveJSON(STORE_KEY, { tasks: [], lastSynced: new Date().toISOString() });

    const response = await syncPost(makeRequest('POST', { action: 'pull' }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.tasks).toEqual([]);
    expect(result.pulled).toBe(0);
  });

  it('GET returns synced tasks for dashboard', async () => {
    const tasks = [makeLocalTask('get-1'), makeLocalTask('get-2')];
    await syncPost(makeRequest('POST', { action: 'push', tasks }));

    const response = await syncGet();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.tasks).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it('maps "In Progress" status to "doing" for dashboard consumption', async () => {
    const tasks = [makeLocalTask('status-1', { status: 'In Progress' })];
    await syncPost(makeRequest('POST', { action: 'push', tasks }));

    const stored = await loadJSON<{ tasks: SyncedTask[] }>(STORE_KEY, { tasks: [] });
    expect(stored.tasks[0].status).toBe('doing');
  });

  it('rejects unauthorized push when SYNC_API_KEY is set', async () => {
    const originalKey = process.env.SYNC_API_KEY;
    process.env.SYNC_API_KEY = 'test-secret-key';

    try {
      // Send a wrong key to simulate unauthorized access
      const response = await syncPost(
        makeRequest('POST', { action: 'push', tasks: [makeLocalTask('auth-1')] }, { 'x-sync-api-key': 'wrong-key' })
      );
      expect(response.status).toBe(401);

      // Verify no data was written
      const stored = await loadJSON<{ tasks: SyncedTask[] }>(STORE_KEY, { tasks: [] });
      expect(stored.tasks).toHaveLength(0);
    } finally {
      if (originalKey) {
        process.env.SYNC_API_KEY = originalKey;
      } else {
        delete process.env.SYNC_API_KEY;
      }
    }
  });

  it('returns 400 for unknown action', async () => {
    const response = await syncPost(makeRequest('POST', { action: 'unknown' }));
    expect(response.status).toBe(400);
  });
});

describe('Dashboard /api/tasks reads from synced data', () => {
  beforeEach(async () => {
    await saveJSON(STORE_KEY, { tasks: [], lastSynced: new Date().toISOString() });
  });

  it('returns synced tasks when available', async () => {
    const tasks = [
      makeLocalTask('dash-1', { status: 'In Progress' }),
      makeLocalTask('dash-2', { status: 'Not Started' }),
    ];
    await syncPost(makeRequest('POST', { action: 'push', tasks }));

    const response = await tasksGet();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.source).toBe('synced');
    expect(result.tasks).toHaveLength(2);
    // Verify AiTask format
    expect(result.tasks[0]).toHaveProperty('status');
    expect(result.tasks[0]).toHaveProperty('priorityScore');
    expect(['todo', 'doing', 'done']).toContain(result.tasks[0].status);
  });
});
