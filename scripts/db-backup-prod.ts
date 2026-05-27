#!/usr/bin/env tsx
/**
 * Logical backup of the prod DB before the multi-user migration.
 * Dumps every row of data_store, text_store, audit_log (and users +
 * schema_migrations if they exist) to a single JSON file.
 *
 * To restore: run scripts/db-restore-prod.ts <file>.
 */

import { neon } from '@neondatabase/serverless';
import { writeFileSync } from 'fs';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const sql = neon(process.env.DATABASE_URL);

  const dump: Record<string, unknown[]> = {};

  // Always present
  dump.data_store = await sql`SELECT * FROM data_store`;
  dump.text_store = await sql`SELECT * FROM text_store`;
  dump.audit_log  = await sql`SELECT * FROM audit_log`;

  // Optional — may not exist yet on a pre-migration prod
  try {
    dump.users = await sql`SELECT * FROM users`;
  } catch {
    dump.users = [];
  }
  try {
    dump.schema_migrations = await sql`SELECT * FROM schema_migrations`;
  } catch {
    dump.schema_migrations = [];
  }

  const meta = {
    capturedAt: new Date().toISOString(),
    counts: {
      data_store: dump.data_store.length,
      text_store: dump.text_store.length,
      audit_log: dump.audit_log.length,
      users: dump.users.length,
      schema_migrations: dump.schema_migrations.length,
    },
  };

  const filename = `backups/prod-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const payload = { meta, ...dump };
  writeFileSync(filename, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${filename}`);
  console.log('Counts:', meta.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
