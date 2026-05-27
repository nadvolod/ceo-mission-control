import { getDb } from '@/lib/db';
import { getUserByRole, type User } from '@/lib/users';

/**
 * Resolve the test user's UUID. For unit tests (no DB) the caller can pass
 * a literal UUID directly to the function under test; this helper is for
 * integration tests that need a real row in `users` (because owner_id is
 * a foreign key).
 *
 * If DATABASE_URL is unset or the test user hasn't been seeded, throws
 * with a clear message naming the missing env var / seed step.
 */
let cached: string | null = null;
export async function getTestOwnerId(): Promise<string> {
  if (cached) return cached;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required for integration tests. Run `vercel env pull .env.local` then `source .env.local`.',
    );
  }
  let user: User | null = null;
  try {
    user = await getUserByRole('test');
  } catch (err) {
    throw new Error(
      `Failed to resolve test user from DB: ${(err as Error).message}. Run \`npm run db:migrate\` first.`,
    );
  }
  if (!user) {
    throw new Error(
      'Test user not seeded. Run `npm run db:migrate` to seed users (admin/demo/test).',
    );
  }
  cached = user.id;
  return cached;
}

/**
 * Cleans up rows owned by the test user that match a key prefix.
 * Useful in `afterAll` of integration test suites.
 */
export async function cleanupTestRows(ownerId: string, keyPrefix: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db`DELETE FROM data_store WHERE owner_id = ${ownerId} AND key LIKE ${keyPrefix + '%'}`;
  await db`DELETE FROM text_store WHERE owner_id = ${ownerId} AND key LIKE ${keyPrefix + '%'}`;
}

export { UNIT_TEST_OWNER_ID } from './owner-id';
