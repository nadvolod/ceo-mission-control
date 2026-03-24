import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sql: NeonQueryFunction<false, false> | null = null;
let initialized = false;

export function getDb(): NeonQueryFunction<false, false> | null {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

export async function ensureDbReady(): Promise<void> {
  const db = getDb();
  if (!db || initialized) return;

  try {
    await db`CREATE TABLE IF NOT EXISTS data_store (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS text_store (
      key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    initialized = true;
    console.log('Neon DB tables initialized');
  } catch (error) {
    console.error('Failed to initialize Neon DB tables:', error);
  }
}
