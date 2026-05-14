import { neon } from '@neondatabase/serverless';
import type { Migration, Sql } from './types';
import { migration as m0001 } from './0001_users';
import { migration as m0002 } from './0002_owner_id_data_store';
import { migration as m0003 } from './0003_owner_id_text_store';
import { migration as m0004 } from './0004_owner_id_audit_log';

const ALL_MIGRATIONS: Migration[] = [m0001, m0002, m0003, m0004];

async function ensureMigrationsTable(sql: Sql): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

async function appliedVersions(sql: Sql): Promise<Set<string>> {
  const rows = await sql`SELECT version FROM schema_migrations`;
  return new Set(rows.map((r) => r.version as string));
}

export async function runMigrations(databaseUrl?: string): Promise<{ applied: string[]; skipped: string[] }> {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set — cannot run migrations');

  const sql = neon(url);
  await ensureMigrationsTable(sql);
  const already = await appliedVersions(sql);

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const m of ALL_MIGRATIONS) {
    if (already.has(m.version)) {
      skipped.push(m.version);
      continue;
    }
    console.log(`[migrate] applying ${m.version} — ${m.description}`);
    try {
      await m.up(sql);
      await sql`INSERT INTO schema_migrations (version, description) VALUES (${m.version}, ${m.description})`;
      applied.push(m.version);
      console.log(`[migrate] ok ${m.version}`);
    } catch (err) {
      console.error(`[migrate] FAILED ${m.version}`, err);
      throw err;
    }
  }

  return { applied, skipped };
}

export { ALL_MIGRATIONS };
