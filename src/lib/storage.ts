import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getDb, ensureDbReady } from './db';
import { WORKSPACE_PATH, ensureWorkspaceReady } from './workspace-path';

/**
 * Storage abstraction layer.
 * - With DATABASE_URL: uses Neon Postgres
 * - Without DATABASE_URL: uses filesystem (local dev)
 */

function hasDb(): boolean {
  return !!process.env.DATABASE_URL;
}

// --- JSON data (tasks.json, focus-tracking.json, etc.) ---

export async function loadJSON<T>(filename: string, defaultValue: T): Promise<T> {
  if (hasDb()) {
    await ensureDbReady();
    const db = getDb()!;
    try {
      const rows = await db`SELECT data FROM data_store WHERE key = ${filename}`;
      if (rows.length > 0) {
        return rows[0].data as T;
      }
    } catch (error) {
      console.error(`DB loadJSON error for ${filename}:`, error);
    }
    return defaultValue;
  }

  // Filesystem fallback
  ensureWorkspaceReady();
  try {
    const filePath = join(WORKSPACE_PATH, filename);
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error(`File loadJSON error for ${filename}:`, error);
  }
  return defaultValue;
}

export async function saveJSON(filename: string, data: unknown): Promise<void> {
  if (hasDb()) {
    await ensureDbReady();
    const db = getDb()!;
    await db`INSERT INTO data_store (key, data, updated_at)
             VALUES (${filename}, ${JSON.stringify(data)}, NOW())
             ON CONFLICT (key) DO UPDATE SET data = ${JSON.stringify(data)}, updated_at = NOW()`;
    return;
  }

  // Filesystem fallback
  ensureWorkspaceReady();
  const filePath = join(WORKSPACE_PATH, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Text content (INITIATIVES.md, DAILY_SCORECARD.md, etc.) ---

export async function loadText(filename: string, defaultContent: string = ''): Promise<string> {
  if (hasDb()) {
    await ensureDbReady();
    const db = getDb()!;
    try {
      const rows = await db`SELECT content FROM text_store WHERE key = ${filename}`;
      if (rows.length > 0) {
        return rows[0].content as string;
      }
    } catch (error) {
      console.error(`DB loadText error for ${filename}:`, error);
    }
    return defaultContent;
  }

  // Filesystem fallback
  ensureWorkspaceReady();
  try {
    return readFileSync(join(WORKSPACE_PATH, filename), 'utf8');
  } catch (error) {
    console.error(`File loadText error for ${filename}:`, error);
  }
  return defaultContent;
}

export async function saveText(filename: string, content: string): Promise<void> {
  if (hasDb()) {
    await ensureDbReady();
    const db = getDb()!;
    await db`INSERT INTO text_store (key, content, updated_at)
             VALUES (${filename}, ${content}, NOW())
             ON CONFLICT (key) DO UPDATE SET content = ${content}, updated_at = NOW()`;
    return;
  }

  // Filesystem fallback
  ensureWorkspaceReady();
  const filePath = join(WORKSPACE_PATH, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

// --- Audit log (replaces memory/{date}.md) ---
// Note: appendAuditLog intentionally catches errors so audit failures
// don't break data operations (saveJSON/saveText propagate errors).

export async function appendAuditLog(date: string, entryType: string, content: string): Promise<void> {
  if (hasDb()) {
    await ensureDbReady();
    const db = getDb()!;
    try {
      await db`INSERT INTO audit_log (date, entry_type, content) VALUES (${date}, ${entryType}, ${content})`;
    } catch (error) {
      console.error('DB audit log error:', error);
    }
    return;
  }

  // Filesystem fallback - append to memory/{date}.md
  ensureWorkspaceReady();
  try {
    const memoryPath = join(WORKSPACE_PATH, `memory/${date}.md`);
    mkdirSync(dirname(memoryPath), { recursive: true });
    try {
      const existing = readFileSync(memoryPath, 'utf8');
      writeFileSync(memoryPath, existing + content);
    } catch {
      writeFileSync(memoryPath, `# Daily Memory - ${date}\n\n${content}`);
    }
  } catch (error) {
    console.error('File audit log error:', error);
  }
}
