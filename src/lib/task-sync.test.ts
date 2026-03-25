import { normalizeStatus, denormalizeStatus, localTaskToSynced, syncedToLocalTask, mergeTasks } from './task-sync';
import type { LocalTask, SyncedTask } from './types';

function makeLocalTask(overrides: Partial<LocalTask> = {}): LocalTask {
  return {
    id: 'task_test_001',
    title: 'Test Task',
    description: 'A test task',
    status: 'In Progress',
    priority: 'High',
    projectId: 'Temporal',
    tags: ['test'],
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-25T01:00:00Z',
    ...overrides,
  };
}

function makeSyncedTask(overrides: Partial<SyncedTask> = {}): SyncedTask {
  return {
    localId: 'task_test_001',
    title: 'Test Task',
    description: 'A test task',
    status: 'doing',
    priority: 'High',
    category: 'Temporal',
    tags: ['test'],
    dueDate: null,
    monetaryValue: null,
    missionRelevance: null,
    estimatedHours: null,
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-25T01:00:00Z',
    source: 'local',
    extra: {},
    ...overrides,
  };
}

describe('normalizeStatus', () => {
  it('maps "In Progress" to "doing"', () => {
    expect(normalizeStatus('In Progress')).toBe('doing');
  });

  it('maps "Not Started" to "todo"', () => {
    expect(normalizeStatus('Not Started')).toBe('todo');
  });

  it('maps "Done" to "done"', () => {
    expect(normalizeStatus('Done')).toBe('done');
  });

  it('handles case variations', () => {
    expect(normalizeStatus('in progress')).toBe('doing');
    expect(normalizeStatus('NOT STARTED')).toBe('todo');
    expect(normalizeStatus('done')).toBe('done');
    expect(normalizeStatus('DOING')).toBe('doing');
  });

  it('defaults unknown status to "todo"', () => {
    expect(normalizeStatus('unknown')).toBe('todo');
    expect(normalizeStatus('')).toBe('todo');
  });

  it('maps "Completed" to "done"', () => {
    expect(normalizeStatus('Completed')).toBe('done');
  });

  it('maps "Started" to "doing"', () => {
    expect(normalizeStatus('Started')).toBe('doing');
  });
});

describe('denormalizeStatus', () => {
  it('maps "doing" to "In Progress"', () => {
    expect(denormalizeStatus('doing')).toBe('In Progress');
  });

  it('maps "todo" to "Not Started"', () => {
    expect(denormalizeStatus('todo')).toBe('Not Started');
  });

  it('maps "done" to "Done"', () => {
    expect(denormalizeStatus('done')).toBe('Done');
  });

  it('defaults unknown to "Not Started"', () => {
    expect(denormalizeStatus('unknown')).toBe('Not Started');
  });

  it('round-trips all statuses', () => {
    for (const status of ['In Progress', 'Not Started', 'Done']) {
      expect(denormalizeStatus(normalizeStatus(status))).toBe(status);
    }
  });
});

describe('localTaskToSynced', () => {
  it('maps all fields correctly', () => {
    const local = makeLocalTask({
      monthlyRevenueImpact: 10000,
      missionRelevance: 'Mission Critical',
      estimatedHours: 8,
      deadline: '2026-03-30',
    });

    const synced = localTaskToSynced(local);

    expect(synced.localId).toBe('task_test_001');
    expect(synced.title).toBe('Test Task');
    expect(synced.description).toBe('A test task');
    expect(synced.status).toBe('doing');
    expect(synced.priority).toBe('High');
    expect(synced.category).toBe('Temporal');
    expect(synced.tags).toEqual(['test']);
    expect(synced.dueDate).toBe('2026-03-30');
    expect(synced.monetaryValue).toBe(10000);
    expect(synced.missionRelevance).toBe('Mission Critical');
    expect(synced.estimatedHours).toBe(8);
    expect(synced.source).toBe('local');
  });

  it('handles missing optional fields', () => {
    const local: LocalTask = {
      id: 'task_min',
      title: 'Minimal',
      status: 'Not Started',
      priority: 'Low',
    };

    const synced = localTaskToSynced(local);

    expect(synced.description).toBeNull();
    expect(synced.category).toBeNull();
    expect(synced.tags).toEqual([]);
    expect(synced.dueDate).toBeNull();
    expect(synced.monetaryValue).toBeNull();
  });

  it('preserves extra fields like timeLogged and cronJobId', () => {
    const local = makeLocalTask({
      timeLogged: [{ date: '2026-03-25', minutes: 50, note: 'work' }],
      cronJobId: 'cron-123',
      aiLeverageScore: 5,
    });

    const synced = localTaskToSynced(local);

    expect(synced.extra.timeLogged).toEqual([{ date: '2026-03-25', minutes: 50, note: 'work' }]);
    expect(synced.extra.cronJobId).toBe('cron-123');
    expect(synced.extra.aiLeverageScore).toBe(5);
  });
});

describe('syncedToLocalTask', () => {
  it('maps all fields correctly', () => {
    const synced = makeSyncedTask({
      monetaryValue: 10000,
      missionRelevance: 'Mission Critical',
      estimatedHours: 8,
      dueDate: '2026-03-30',
    });

    const local = syncedToLocalTask(synced);

    expect(local.id).toBe('task_test_001');
    expect(local.title).toBe('Test Task');
    expect(local.status).toBe('In Progress');
    expect(local.priority).toBe('High');
    expect(local.projectId).toBe('Temporal');
    expect(local.monthlyRevenueImpact).toBe(10000);
    expect(local.missionRelevance).toBe('Mission Critical');
  });

  it('restores extra fields', () => {
    const synced = makeSyncedTask({
      extra: {
        timeLogged: [{ date: '2026-03-25', minutes: 50, note: 'work' }],
        cronJobId: 'cron-123',
        aiLeverageScore: 5,
      },
    });

    const local = syncedToLocalTask(synced);

    expect(local.timeLogged).toEqual([{ date: '2026-03-25', minutes: 50, note: 'work' }]);
    expect(local.cronJobId).toBe('cron-123');
    expect(local.aiLeverageScore).toBe(5);
  });

  it('round-trips a full local task', () => {
    const original = makeLocalTask({
      monthlyRevenueImpact: 5000,
      missionRelevance: 'High Impact',
      estimatedHours: 4,
      deadline: '2026-04-01',
      timeLogged: [{ date: '2026-03-25', minutes: 30, note: 'review' }],
      aiLeverageScore: 3,
    });

    const roundTripped = syncedToLocalTask(localTaskToSynced(original));

    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.title).toBe(original.title);
    expect(roundTripped.status).toBe(original.status);
    expect(roundTripped.priority).toBe(original.priority);
    expect(roundTripped.projectId).toBe(original.projectId);
    expect(roundTripped.monthlyRevenueImpact).toBe(original.monthlyRevenueImpact);
    expect(roundTripped.timeLogged).toEqual(original.timeLogged);
    expect(roundTripped.aiLeverageScore).toBe(original.aiLeverageScore);
  });
});

describe('mergeTasks', () => {
  it('adds new tasks to empty store', () => {
    const incoming = [
      makeSyncedTask({ localId: 'a' }),
      makeSyncedTask({ localId: 'b' }),
      makeSyncedTask({ localId: 'c' }),
    ];

    const merged = mergeTasks(incoming, []);

    expect(merged).toHaveLength(3);
  });

  it('uses last-write-wins for conflicts', () => {
    const existing = [makeSyncedTask({ localId: 'a', title: 'Old', updatedAt: '2026-03-25T01:00:00Z' })];
    const incoming = [makeSyncedTask({ localId: 'a', title: 'New', updatedAt: '2026-03-25T02:00:00Z' })];

    const merged = mergeTasks(incoming, existing);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('New');
  });

  it('preserves existing when incoming is older', () => {
    const existing = [makeSyncedTask({ localId: 'a', title: 'Newer', updatedAt: '2026-03-25T02:00:00Z' })];
    const incoming = [makeSyncedTask({ localId: 'a', title: 'Older', updatedAt: '2026-03-25T01:00:00Z' })];

    const merged = mergeTasks(incoming, existing);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('Newer');
  });

  it('combines new and existing tasks', () => {
    const existing = [
      makeSyncedTask({ localId: 'a' }),
      makeSyncedTask({ localId: 'b' }),
      makeSyncedTask({ localId: 'c' }),
    ];
    const incoming = [
      makeSyncedTask({ localId: 'd' }),
      makeSyncedTask({ localId: 'e' }),
    ];

    const merged = mergeTasks(incoming, existing);

    expect(merged).toHaveLength(5);
    const ids = merged.map(t => t.localId).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('preserves existing tasks not in incoming (no deletes)', () => {
    const existing = [
      makeSyncedTask({ localId: 'dashboard-only', title: 'Dashboard Task' }),
    ];
    const incoming = [
      makeSyncedTask({ localId: 'local-only', title: 'Local Task' }),
    ];

    const merged = mergeTasks(incoming, existing);

    expect(merged).toHaveLength(2);
    expect(merged.find(t => t.localId === 'dashboard-only')).toBeTruthy();
    expect(merged.find(t => t.localId === 'local-only')).toBeTruthy();
  });

  it('handles empty incoming (preserves all existing)', () => {
    const existing = [
      makeSyncedTask({ localId: 'a' }),
      makeSyncedTask({ localId: 'b' }),
    ];

    const merged = mergeTasks([], existing);

    expect(merged).toHaveLength(2);
  });
});
