import type { Migration } from './types';

export const migration: Migration = {
  version: '0002_owner_id_data_store',
  description: 'Add owner_id to data_store, backfill to admin, swap PK to (owner_id, key)',
  async up(sql) {
    await sql`CREATE TABLE IF NOT EXISTS data_store (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const cols = await sql`SELECT column_name FROM information_schema.columns
                           WHERE table_name = 'data_store' AND column_name = 'owner_id'`;
    if (cols.length === 0) {
      await sql`ALTER TABLE data_store ADD COLUMN owner_id UUID REFERENCES users(id)`;
    }

    const admin = await sql`SELECT id FROM users WHERE email = ${'nadvolod@gmail.com'}`;
    if (admin.length === 0) {
      throw new Error('[migration 0002] admin user missing — 0001 must run first');
    }
    const adminId = admin[0].id as string;
    await sql`UPDATE data_store SET owner_id = ${adminId} WHERE owner_id IS NULL`;

    await sql`ALTER TABLE data_store ALTER COLUMN owner_id SET NOT NULL`;

    const pkRows = await sql`SELECT conname FROM pg_constraint
                             WHERE conrelid = 'data_store'::regclass AND contype = 'p'`;
    const pkName = pkRows[0]?.conname as string | undefined;
    if (pkName) {
      await sql.query(`ALTER TABLE data_store DROP CONSTRAINT "${pkName}"`);
    }
    const newPk = await sql`SELECT conname FROM pg_constraint
                            WHERE conrelid = 'data_store'::regclass AND contype = 'p'`;
    if (newPk.length === 0) {
      await sql`ALTER TABLE data_store ADD PRIMARY KEY (owner_id, key)`;
    }
  },
};
