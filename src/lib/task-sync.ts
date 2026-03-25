import type { LocalTask, SyncedTask } from './types';

const STATUS_TO_NORMALIZED: Record<string, 'todo' | 'doing' | 'done'> = {
  'not started': 'todo',
  'todo': 'todo',
  'in progress': 'doing',
  'doing': 'doing',
  'started': 'doing',
  'done': 'done',
  'completed': 'done',
};

const NORMALIZED_TO_LOCAL: Record<string, string> = {
  'todo': 'Not Started',
  'doing': 'In Progress',
  'done': 'Done',
};

/**
 * Map a local task status string to the normalized 'todo' | 'doing' | 'done' format.
 */
export function normalizeStatus(localStatus: string): 'todo' | 'doing' | 'done' {
  const mapped = STATUS_TO_NORMALIZED[localStatus.toLowerCase().trim()];
  return mapped ?? 'todo';
}

/**
 * Map a normalized status back to the local format.
 */
export function denormalizeStatus(status: string): string {
  return NORMALIZED_TO_LOCAL[status] ?? 'Not Started';
}

/**
 * Convert a local task to the unified synced format.
 */
export function localTaskToSynced(task: LocalTask): SyncedTask {
  // Preserve fields that don't map directly into `extra`
  const extra: Record<string, unknown> = {};
  if (task.aiLeverageScore != null) extra.aiLeverageScore = task.aiLeverageScore;
  if (task.timeLogged != null) extra.timeLogged = task.timeLogged;
  if (task.cronJobId != null) extra.cronJobId = task.cronJobId;
  if (task.schedule != null) extra.schedule = task.schedule;

  return {
    localId: task.id,
    title: task.title,
    description: task.description ?? null,
    status: normalizeStatus(task.status),
    priority: task.priority ?? 'Medium',
    category: task.projectId ?? null,
    tags: task.tags ?? [],
    dueDate: task.deadline ?? task.dueDate ?? null,
    monetaryValue: task.monthlyRevenueImpact ?? null,
    missionRelevance: task.missionRelevance ?? null,
    estimatedHours: task.estimatedHours ?? null,
    createdAt: task.createdAt ?? new Date().toISOString(),
    updatedAt: task.updatedAt ?? task.createdAt ?? new Date().toISOString(),
    source: 'local',
    extra,
  };
}

/**
 * Convert a synced task back to local format.
 */
export function syncedToLocalTask(task: SyncedTask): LocalTask {
  const local: LocalTask = {
    id: task.localId,
    title: task.title,
    description: task.description ?? undefined,
    status: denormalizeStatus(task.status),
    priority: task.priority,
    projectId: task.category ?? undefined,
    tags: task.tags.length > 0 ? task.tags : undefined,
    dueDate: task.dueDate ?? undefined,
    missionRelevance: task.missionRelevance ?? undefined,
    monthlyRevenueImpact: task.monetaryValue ?? undefined,
    estimatedHours: task.estimatedHours ?? undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };

  // Restore extra fields
  if (task.extra) {
    if (task.extra.aiLeverageScore != null) local.aiLeverageScore = task.extra.aiLeverageScore as number;
    if (task.extra.timeLogged != null) local.timeLogged = task.extra.timeLogged as LocalTask['timeLogged'];
    if (task.extra.cronJobId != null) local.cronJobId = task.extra.cronJobId as string;
    if (task.extra.schedule != null) local.schedule = task.extra.schedule as string;
  }

  return local;
}

/**
 * Merge incoming tasks with existing tasks.
 * - Matches by localId
 * - Last-write-wins by updatedAt
 * - Tasks in existing that are not in incoming are preserved (no deletes)
 * - New tasks in incoming are added
 */
export function mergeTasks(incoming: SyncedTask[], existing: SyncedTask[]): SyncedTask[] {
  const merged = new Map<string, SyncedTask>();

  // Start with all existing tasks
  for (const task of existing) {
    merged.set(task.localId, task);
  }

  // Merge incoming — last-write-wins
  for (const task of incoming) {
    const current = merged.get(task.localId);
    if (!current) {
      // New task
      merged.set(task.localId, task);
    } else {
      // Conflict — compare updatedAt
      const incomingTime = new Date(task.updatedAt).getTime();
      const currentTime = new Date(current.updatedAt).getTime();
      if (incomingTime >= currentTime) {
        merged.set(task.localId, task);
      }
      // else: existing is newer, keep it
    }
  }

  return Array.from(merged.values());
}
