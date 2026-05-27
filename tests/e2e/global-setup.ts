import type { FullConfig } from '@playwright/test';
import { neon } from '@neondatabase/serverless';
import { mkdirSync } from 'fs';

/**
 * Before any spec runs:
 *  1. Verify DATABASE_URL + TEST_USER_PASSWORD are set; fail loudly otherwise.
 *  2. Verify the test user is seeded (db:migrate must have run already).
 *  3. Wipe the test user's rows so each run starts clean. We never touch
 *     admin/demo rows — owner_id scoping is our safety net.
 *  4. Ensure tests/.auth/ exists for storage-state files.
 */
async function ensureTestUserAndWipe(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[playwright global-setup] DATABASE_URL is required. ' +
        'Run `vercel env pull .env.local` then `set -a && source .env.local && set +a`.',
    );
  }
  if (!process.env.TEST_USER_PASSWORD) {
    throw new Error(
      '[playwright global-setup] TEST_USER_PASSWORD is required so auth.setup.ts can log in.',
    );
  }
  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`SELECT id FROM users WHERE email = ${'test@ceo-mc.local'}`;
  if (rows.length === 0) {
    throw new Error(
      '[playwright global-setup] Test user not seeded. Run `npm run db:migrate` first.',
    );
  }
  const testUserId = rows[0].id as string;

  console.log(`[playwright global-setup] Wiping test user rows (owner_id=${testUserId})`);
  await sql`DELETE FROM data_store WHERE owner_id = ${testUserId}`;
  await sql`DELETE FROM text_store WHERE owner_id = ${testUserId}`;
  await sql`DELETE FROM audit_log WHERE owner_id = ${testUserId}`;
}

async function globalSetup(_config: FullConfig) {
  mkdirSync('tests/.auth', { recursive: true });
  await ensureTestUserAndWipe();
}

export default globalSetup;
