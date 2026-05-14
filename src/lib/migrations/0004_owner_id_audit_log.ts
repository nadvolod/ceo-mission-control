import type { Migration } from './types';

export const migration: Migration = {
  version: '0004_owner_id_audit_log',
  description: 'Add owner_id to audit_log, backfill to admin, add index',
  async up(sql) {
    await sql`CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const cols = await sql`SELECT column_name FROM information_schema.columns
                           WHERE table_name = 'audit_log' AND column_name = 'owner_id'`;
    if (cols.length === 0) {
      await sql`ALTER TABLE audit_log ADD COLUMN owner_id UUID REFERENCES users(id)`;
    }

    const admin = await sql`SELECT id FROM users WHERE role = ${'admin'} ORDER BY created_at ASC LIMIT 1`;
    if (admin.length === 0) {
      throw new Error('[migration 0004] admin user missing — 0001 must run first');
    }
    const adminId = admin[0].id as string;
    await sql`UPDATE audit_log SET owner_id = ${adminId} WHERE owner_id IS NULL`;

    await sql`ALTER TABLE audit_log ALTER COLUMN owner_id SET NOT NULL`;

    const idxRows = await sql`SELECT indexname FROM pg_indexes
                              WHERE tablename = 'audit_log' AND indexname = 'audit_log_owner_date_idx'`;
    if (idxRows.length === 0) {
      await sql`CREATE INDEX audit_log_owner_date_idx ON audit_log (owner_id, date DESC)`;
    }
  },
};
