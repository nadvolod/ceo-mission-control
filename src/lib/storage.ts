import { getDb } from './db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertOwnerId(ownerId: string, op: string, key: string): void {
  if (typeof ownerId !== 'string' || !UUID_RE.test(ownerId)) {
    throw new Error(
      `storage.${op}(${key}): ownerId must be a UUID, got ${JSON.stringify(ownerId)}`,
    );
  }
}

function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error(
      'DATABASE_URL is not configured. The filesystem storage fallback has been removed; set DATABASE_URL to a Neon Postgres connection string.',
    );
  }
  return db;
}

// --- JSON data (per-user) ---

export async function loadJSON<T>(ownerId: string, key: string, defaultValue: T): Promise<T> {
  assertOwnerId(ownerId, 'loadJSON', key);
  const db = requireDb();
  try {
    const rows = await db`SELECT data FROM data_store WHERE owner_id = ${ownerId} AND key = ${key}`;
    if (rows.length > 0) {
      return rows[0].data as T;
    }
  } catch (error) {
    console.error(`storage.loadJSON error for owner=${ownerId} key=${key}:`, error);
  }
  return defaultValue;
}

export async function saveJSON(ownerId: string, key: string, data: unknown): Promise<void> {
  assertOwnerId(ownerId, 'saveJSON', key);
  const db = requireDb();
  const payload = JSON.stringify(data);
  await db`INSERT INTO data_store (owner_id, key, data, updated_at)
           VALUES (${ownerId}, ${key}, ${payload}, NOW())
           ON CONFLICT (owner_id, key) DO UPDATE SET data = ${payload}, updated_at = NOW()`;
  console.log(`[storage] saveJSON owner=${ownerId} key=${key}`);
}

// --- Text content (per-user) ---

export async function loadText(ownerId: string, key: string, defaultContent: string = ''): Promise<string> {
  assertOwnerId(ownerId, 'loadText', key);
  const db = requireDb();
  try {
    const rows = await db`SELECT content FROM text_store WHERE owner_id = ${ownerId} AND key = ${key}`;
    if (rows.length > 0) {
      return rows[0].content as string;
    }
  } catch (error) {
    console.error(`storage.loadText error for owner=${ownerId} key=${key}:`, error);
  }
  return defaultContent;
}

export async function saveText(ownerId: string, key: string, content: string): Promise<void> {
  assertOwnerId(ownerId, 'saveText', key);
  const db = requireDb();
  await db`INSERT INTO text_store (owner_id, key, content, updated_at)
           VALUES (${ownerId}, ${key}, ${content}, NOW())
           ON CONFLICT (owner_id, key) DO UPDATE SET content = ${content}, updated_at = NOW()`;
  console.log(`[storage] saveText owner=${ownerId} key=${key}`);
}

// --- Audit log (per-user) ---

export async function appendAuditLog(
  ownerId: string,
  date: string,
  entryType: string,
  content: string,
): Promise<void> {
  assertOwnerId(ownerId, 'appendAuditLog', `${date}/${entryType}`);
  const db = requireDb();
  try {
    await db`INSERT INTO audit_log (owner_id, date, entry_type, content)
             VALUES (${ownerId}, ${date}, ${entryType}, ${content})`;
  } catch (error) {
    console.error('storage.appendAuditLog error:', error);
  }
}
