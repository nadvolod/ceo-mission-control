import type { FullConfig } from '@playwright/test';
import { neon } from '@neondatabase/serverless';
import { mkdirSync } from 'fs';

function buildTestScorecard(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# DAILY_SCORECARD.md

## Date
- ${today}

## priorities
- Keep E2E workspace deterministic
- Verify owner-scoped dashboard rendering

## Temporal focused hours target
- Target today: 5.0
- Actual: 0

## Focus blocks
- 09:00-10:00 Test fixture review

## Major money move today
- Validate additive money move flow

## Strategic project move today
- Keep the dashboard mounted for browser tests

## Taxes / risk reduction move today
- Confirm test user isolation

## What to ignore today
- Shared production workspace data

## Biggest blocker
- Missing owner-scoped workspace rows
`;
}

function buildTestInitiatives(): string {
  return `# INITIATIVES.md

## Current ranking

| Rank | Initiative | Money | Strategic | Urgency | Leverage | Time | Risk | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | E2E owner isolation | 1 | 5 | 5 | 5 | 1 | 1 | 18 |

## 1) E2E owner isolation
- **Type:** Quality
- **Goal:** Render the dashboard from test-user scoped data
- **Current bottleneck:** Empty workspace fixture after global setup wipe
- **Highest-leverage next move:** Seed minimal deterministic workspace markdown
- **Expected payoff:** Browser tests exercise the real dashboard without admin data
- **Confidence:** High
- **What to deprioritize because of it:** Visibility-only checks
`;
}

/**
 * Before any spec runs:
 *  1. Verify DATABASE_URL + TEST_USER_PASSWORD are set; fail loudly otherwise.
 *  2. Verify the test user is seeded (db:migrate must have run already).
 *  3. Wipe mutable test-user rows, then seed only the minimal workspace
 *     markdown needed for /dashboard to mount. We never touch admin/demo
 *     rows; owner_id scoping is our safety net.
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

  console.log(`[playwright global-setup] Seeding test workspace rows (owner_id=${testUserId})`);
  await sql`INSERT INTO text_store (owner_id, key, content, updated_at)
            VALUES (${testUserId}, ${'DAILY_SCORECARD.md'}, ${buildTestScorecard()}, NOW())
            ON CONFLICT (owner_id, key) DO UPDATE
            SET content = EXCLUDED.content, updated_at = NOW()`;
  await sql`INSERT INTO text_store (owner_id, key, content, updated_at)
            VALUES (${testUserId}, ${'INITIATIVES.md'}, ${buildTestInitiatives()}, NOW())
            ON CONFLICT (owner_id, key) DO UPDATE
            SET content = EXCLUDED.content, updated_at = NOW()`;
}

async function globalSetup(_config: FullConfig) {
  mkdirSync('tests/.auth', { recursive: true });
  await ensureTestUserAndWipe();
}

export default globalSetup;
