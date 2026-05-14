#!/usr/bin/env tsx
/**
 * Pre/post-migration integrity check.
 *
 * Usage:
 *   tsx scripts/db-hash-rows.ts pre  > pre-migration.tsv
 *   # ... run migrations ...
 *   tsx scripts/db-hash-rows.ts post-admin > post-migration.tsv
 *   diff pre-migration.tsv post-migration.tsv
 *
 * Modes:
 *   pre         — dump every (key, md5(data::text)) pair before owner_id exists
 *   post-admin  — dump scoped to the admin user (owner_id = admin's id)
 *
 * Same diff means the migration was lossless for admin's data.
 */

import { neon } from '@neondatabase/serverless';

async function main() {
  const mode = process.argv[2];
  if (mode !== 'pre' && mode !== 'post-admin') {
    console.error('Usage: db-hash-rows.ts (pre|post-admin)');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const sql = neon(process.env.DATABASE_URL);

  if (mode === 'pre') {
    const dataRows = await sql`SELECT key, md5(data::text) AS hash FROM data_store ORDER BY key`;
    for (const r of dataRows) console.log(`data\t${r.key}\t${r.hash}`);
    const textRows = await sql`SELECT key, md5(content) AS hash FROM text_store ORDER BY key`;
    for (const r of textRows) console.log(`text\t${r.key}\t${r.hash}`);
    return;
  }

  // post-admin
  const admin = await sql`SELECT id FROM users WHERE email = ${'nadvolod@gmail.com'}`;
  if (admin.length === 0) {
    console.error('admin user missing — run db:migrate first');
    process.exit(2);
  }
  const adminId = admin[0].id as string;
  const dataRows = await sql`SELECT key, md5(data::text) AS hash FROM data_store
                              WHERE owner_id = ${adminId} ORDER BY key`;
  for (const r of dataRows) console.log(`data\t${r.key}\t${r.hash}`);
  const textRows = await sql`SELECT key, md5(content) AS hash FROM text_store
                              WHERE owner_id = ${adminId} ORDER BY key`;
  for (const r of textRows) console.log(`text\t${r.key}\t${r.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
