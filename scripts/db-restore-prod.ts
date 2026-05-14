#!/usr/bin/env tsx
/**
 * Restore a prod DB from a logical backup created by db-backup-prod.ts.
 *
 * Usage: tsx scripts/db-restore-prod.ts backups/prod-backup-<ts>.json
 *
 * WARNING: this REPLACES every row in data_store, text_store, audit_log,
 * users, and schema_migrations with the contents of the backup. Use only
 * for the multi-user-migration rollback scenario.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

interface Backup {
  meta: { capturedAt: string; counts: Record<string, number> };
  data_store: Array<{ owner_id?: string | null; key: string; data: unknown; updated_at?: string }>;
  text_store: Array<{ owner_id?: string | null; key: string; content: string; updated_at?: string }>;
  audit_log: Array<{ id: number; owner_id?: string | null; date: string; entry_type: string; content: string; created_at?: string }>;
  users: Array<{ id: string; email: string; password_hash: string; role: string; display_name: string | null; created_at: string }>;
  schema_migrations: Array<{ version: string; description?: string; applied_at?: string }>;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: db-restore-prod.ts <backup.json>');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const sql = neon(process.env.DATABASE_URL);
  const backup: Backup = JSON.parse(readFileSync(file, 'utf8'));

  console.log(`Restoring from ${file} captured ${backup.meta.capturedAt}`);
  console.log('Counts to restore:', backup.meta.counts);

  // All-or-nothing: wipe + reseed must be a single transaction. A failure
  // partway through used to leave prod with the existing rows already
  // DELETEd but new rows not yet INSERTed — irrecoverable without another
  // backup. Neon HTTP `sql.transaction([...])` runs the array atomically
  // in a single round-trip.
  const queries = [];

  // Wipe (FKs require child rows go first)
  queries.push(sql`DELETE FROM audit_log`);
  queries.push(sql`DELETE FROM data_store`);
  queries.push(sql`DELETE FROM text_store`);
  queries.push(sql`DELETE FROM schema_migrations`);
  queries.push(sql`DELETE FROM users`);

  // Reseed users first (FK targets)
  for (const u of backup.users) {
    queries.push(sql`INSERT INTO users (id, email, password_hash, role, display_name, created_at)
                     VALUES (${u.id}, ${u.email}, ${u.password_hash}, ${u.role}, ${u.display_name}, ${u.created_at})`);
  }
  for (const m of backup.schema_migrations) {
    queries.push(sql`INSERT INTO schema_migrations (version, description, applied_at)
                     VALUES (${m.version}, ${m.description ?? ''}, ${m.applied_at ?? new Date().toISOString()})`);
  }
  for (const r of backup.data_store) {
    if (r.owner_id) {
      queries.push(sql`INSERT INTO data_store (owner_id, key, data, updated_at)
                       VALUES (${r.owner_id}, ${r.key}, ${JSON.stringify(r.data)}, ${r.updated_at ?? new Date().toISOString()})`);
    } else {
      queries.push(sql`INSERT INTO data_store (key, data, updated_at)
                       VALUES (${r.key}, ${JSON.stringify(r.data)}, ${r.updated_at ?? new Date().toISOString()})`);
    }
  }
  for (const r of backup.text_store) {
    if (r.owner_id) {
      queries.push(sql`INSERT INTO text_store (owner_id, key, content, updated_at)
                       VALUES (${r.owner_id}, ${r.key}, ${r.content}, ${r.updated_at ?? new Date().toISOString()})`);
    } else {
      queries.push(sql`INSERT INTO text_store (key, content, updated_at)
                       VALUES (${r.key}, ${r.content}, ${r.updated_at ?? new Date().toISOString()})`);
    }
  }
  for (const r of backup.audit_log) {
    if (r.owner_id) {
      queries.push(sql`INSERT INTO audit_log (owner_id, date, entry_type, content, created_at)
                       VALUES (${r.owner_id}, ${r.date}, ${r.entry_type}, ${r.content}, ${r.created_at ?? new Date().toISOString()})`);
    } else {
      queries.push(sql`INSERT INTO audit_log (date, entry_type, content, created_at)
                       VALUES (${r.date}, ${r.entry_type}, ${r.content}, ${r.created_at ?? new Date().toISOString()})`);
    }
  }

  console.log(`Executing ${queries.length} statements in a single transaction...`);
  await sql.transaction(queries);
  console.log('Restore complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
