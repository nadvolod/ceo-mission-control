/**
 * @jest-environment node
 *
 * Integration tests for the owner_id-scoped storage layer.
 * Hits a real Neon DB. Requires DATABASE_URL and a seeded test user.
 *
 * Run: `npm run db:migrate` once to seed users, then `npm test`.
 */

import { loadJSON, saveJSON, loadText, saveText, appendAuditLog } from '@/lib/storage';
import { getDb } from '@/lib/db';
import { getUserByRole } from '@/lib/users';
import { getTestOwnerId, cleanupTestRows, UNIT_TEST_OWNER_ID } from '../utils/test-helpers';

const REQUIRED_ENV = 'DATABASE_URL';

beforeAll(() => {
  if (!process.env[REQUIRED_ENV]) {
    throw new Error(
      `Integration tests require ${REQUIRED_ENV} to be set. ` +
        'Run: vercel env pull .env.local && source .env.local',
    );
  }
});

const TEST_PREFIX = `it${Date.now()}x`;

describe('Storage layer (owner_id-scoped, real DB)', () => {
  let ownerId: string;

  beforeAll(async () => {
    ownerId = await getTestOwnerId();
  });

  afterAll(async () => {
    await cleanupTestRows(ownerId, TEST_PREFIX);
    const db = getDb();
    if (db) {
      await db`DELETE FROM audit_log WHERE owner_id = ${ownerId} AND entry_type = 'integration-test'`;
    }
  });

  it('saveJSON + loadJSON round-trip for the test user', async () => {
    const key = `${TEST_PREFIX}-roundtrip.json`;
    const data = { items: [1, 2, 3], name: 'hello' };

    await saveJSON(ownerId, key, data);
    const loaded = await loadJSON<typeof data>(ownerId, key, { items: [], name: '' });

    expect(loaded.items).toEqual([1, 2, 3]);
    expect(loaded.name).toBe('hello');
  });

  it('loadJSON returns default when no row exists for the owner', async () => {
    const loaded = await loadJSON<{ fallback: boolean }>(
      ownerId,
      `${TEST_PREFIX}-nonexistent.json`,
      { fallback: true },
    );
    expect(loaded.fallback).toBe(true);
  });

  it('saveJSON overwrites existing rows scoped by (owner_id, key)', async () => {
    const key = `${TEST_PREFIX}-overwrite.json`;
    await saveJSON(ownerId, key, { version: 1 });
    await saveJSON(ownerId, key, { version: 2 });
    const loaded = await loadJSON<{ version: number }>(ownerId, key, { version: 0 });
    expect(loaded.version).toBe(2);
  });

  it('saveText + loadText round-trip for the test user', async () => {
    const key = `${TEST_PREFIX}-doc.md`;
    const content = '# Test\n\nbody';
    await saveText(ownerId, key, content);
    const loaded = await loadText(ownerId, key, '');
    expect(loaded).toBe(content);
  });

  it('appendAuditLog writes a row scoped to the owner', async () => {
    await appendAuditLog(ownerId, '2026-01-01', 'integration-test', 'Hello audit');
    const db = getDb();
    if (!db) throw new Error('expected db');
    const rows = await db`SELECT content FROM audit_log
                          WHERE owner_id = ${ownerId}
                            AND entry_type = 'integration-test'
                            AND content = 'Hello audit'`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('isolates rows between users: test user cannot read admin rows under the same key', async () => {
    const key = `${TEST_PREFIX}-isolation.json`;
    const admin = await getUserByRole('admin');
    if (!admin) throw new Error('admin user not seeded — run db:migrate');

    await saveJSON(admin.id, key, { whose: 'admin' });
    await saveJSON(ownerId, key, { whose: 'test' });

    const adminView = await loadJSON<{ whose: string }>(admin.id, key, { whose: '?' });
    const testView = await loadJSON<{ whose: string }>(ownerId, key, { whose: '?' });

    expect(adminView.whose).toBe('admin');
    expect(testView.whose).toBe('test');

    // Cleanup admin row immediately — it does not match TEST_PREFIX in cleanup
    const db = getDb();
    if (db) {
      await db`DELETE FROM data_store WHERE owner_id = ${admin.id} AND key = ${key}`;
    }
  });

  it('rejects calls with a non-UUID ownerId', async () => {
    await expect(saveJSON('not-a-uuid', 'k.json', {})).rejects.toThrow(/ownerId must be a UUID/);
    await expect(loadJSON('also-not', 'k.json', null)).rejects.toThrow(/ownerId must be a UUID/);
  });

  it('rejects calls when ownerId is missing entirely', async () => {
    // @ts-expect-error: deliberately calling with wrong arity to verify runtime guard
    await expect(saveJSON(undefined, 'k.json', {})).rejects.toThrow(/ownerId must be a UUID/);
  });

  it('UNIT_TEST_OWNER_ID is a valid UUID format (used by mocked unit tests)', () => {
    expect(UNIT_TEST_OWNER_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
