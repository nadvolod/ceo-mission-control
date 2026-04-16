/**
 * @jest-environment node
 *
 * Integration tests — hit the real Neon DB via the storage layer.
 * Requires DATABASE_URL env var. Will fail with a clear message if not set.
 */

import { NextRequest } from 'next/server';
import { loadJSON, saveJSON, loadText, saveText, appendAuditLog } from '@/lib/storage';
import { getDb, ensureDbReady } from '@/lib/db';
import { GET as focusGet, POST as focusPost } from '@/app/api/focus-hours/route';
import { GET as temporalGet, POST as temporalPost } from '@/app/api/temporal/route';
import { POST as syncPost } from '@/app/api/sync/route';
import { GET as workspaceGet } from '@/app/api/workspace/route';
import { GET as weeklyTrackerGet, POST as weeklyTrackerPost } from '@/app/api/weekly-tracker/route';

// Do NOT mock storage — these tests use the real DB
const REQUIRED_ENV = 'DATABASE_URL';

beforeAll(() => {
  if (!process.env[REQUIRED_ENV]) {
    throw new Error(
      `Integration tests require ${REQUIRED_ENV} to be set. ` +
      'Run: vercel env pull .env.local && source .env.local, ' +
      'or set DATABASE_URL in your environment.'
    );
  }
});

// Auth headers for requests when SYNC_API_KEY is configured
function authHeaders(): Record<string, string> {
  const key = process.env.SYNC_API_KEY;
  return key ? { 'x-sync-api-key': key } : {};
}

// Use unique test keys to avoid collisions with production data
// No underscores — _ is a SQL LIKE wildcard
const TEST_PREFIX = `test${Date.now()}x`;

// --- Storage layer tests ---

describe('Storage layer (real DB)', () => {
  const testJsonKey = `${TEST_PREFIX}test-data.json`;
  const testTextKey = `${TEST_PREFIX}test-content.md`;

  afterAll(async () => {
    await ensureDbReady();
    const db = getDb();
    if (db) {
      await db`DELETE FROM data_store WHERE key LIKE ${TEST_PREFIX + '%'}`;
      await db`DELETE FROM text_store WHERE key LIKE ${TEST_PREFIX + '%'}`;
      await db`DELETE FROM audit_log WHERE entry_type = 'integration-test' AND date = '2026-01-01'`;
    }
  });

  it('should save and load JSON data', async () => {
    const testData = { items: [1, 2, 3], name: 'test' };
    await saveJSON(testJsonKey, testData);

    const loaded = await loadJSON(testJsonKey, { items: [], name: '' });
    expect(loaded.items).toEqual([1, 2, 3]);
    expect(loaded.name).toBe('test');
  });

  it('should return default for missing JSON key', async () => {
    const loaded = await loadJSON(`${TEST_PREFIX}nonexistent.json`, { fallback: true });
    expect(loaded.fallback).toBe(true);
  });

  it('should overwrite existing JSON data', async () => {
    await saveJSON(testJsonKey, { version: 1 });
    await saveJSON(testJsonKey, { version: 2 });

    const loaded = await loadJSON<{ version: number }>(testJsonKey, { version: 0 });
    expect(loaded.version).toBe(2);
  });

  it('should save and load text content', async () => {
    const content = '# Test Document\n\nThis is a test.';
    await saveText(testTextKey, content);

    const loaded = await loadText(testTextKey, '');
    expect(loaded).toBe(content);
  });

  it('should return default for missing text key', async () => {
    const loaded = await loadText(`${TEST_PREFIX}nonexistent.md`, 'default content');
    expect(loaded).toBe('default content');
  });

  it('should write audit log entries', async () => {
    await appendAuditLog('2026-01-01', 'integration-test', 'Test audit entry');

    const db = getDb()!;
    const rows = await db`SELECT * FROM audit_log WHERE entry_type = 'integration-test' AND date = '2026-01-01'`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].content).toBe('Test audit entry');
  });
});

// --- Focus Hours API tests ---

describe('/api/focus-hours (real DB)', () => {
  let savedFocusData: unknown = null;

  beforeAll(async () => {
    // Snapshot existing data before tests mutate it
    savedFocusData = await loadJSON('focus-tracking.json', null);
  });

  afterAll(async () => {
    await ensureDbReady();
    const db = getDb();
    // Restore original data (or delete if none existed)
    if (savedFocusData) {
      await saveJSON('focus-tracking.json', savedFocusData);
    } else if (db) {
      await db`DELETE FROM data_store WHERE key = 'focus-tracking.json'`;
    }
    // Only delete audit entries created during this test run
    if (db) {
      await db`DELETE FROM audit_log WHERE entry_type = 'focus' AND content LIKE ${'%Integration test%'}`;
    }
  });

  it('GET should return dashboard data structure', async () => {
    const response = await focusGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('todaysMetrics');
    expect(data).toHaveProperty('weeklyTotals');
    expect(data).toHaveProperty('weekOverWeek');
    expect(data).toHaveProperty('dailyTrend');
    expect(data).toHaveProperty('rollingAverage');
    expect(data).toHaveProperty('categoryDistribution');
    expect(data).toHaveProperty('recentSessions');
  });

  it('POST addSession should persist and be retrievable', async () => {
    const request = new NextRequest('http://localhost/api/focus-hours', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        action: 'addSession',
        category: 'Temporal',
        hours: 1.5,
        description: 'Integration test session'
      }),
    });

    const response = await focusPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.session.category).toBe('Temporal');
    expect(data.session.hours).toBe(1.5);

    // Verify it persists — GET should return it
    const getResponse = await focusGet();
    const getData = await getResponse.json();
    expect(getData.todaysMetrics.totalHours).toBeGreaterThanOrEqual(1.5);
    const found = getData.recentSessions.some((s: { description: string }) => s.description === 'Integration test session');
    expect(found).toBe(true);
  });

  it('POST addSession should reject invalid hours', async () => {
    const request = new NextRequest('http://localhost/api/focus-hours', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({ action: 'addSession', category: 'Temporal', hours: -1 }),
    });

    const response = await focusPost(request);
    expect(response.status).toBe(400);
  });

  it('POST addSession should reject invalid category', async () => {
    const request = new NextRequest('http://localhost/api/focus-hours', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({ action: 'addSession', category: 'NotACategory', hours: 1 }),
    });

    const response = await focusPost(request);
    expect(response.status).toBe(400);
  });

  it('POST processMessage should detect focus patterns', async () => {
    const request = new NextRequest('http://localhost/api/focus-hours', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({ action: 'processMessage', message: 'logged 2h on revenue calls' }),
    });

    const response = await focusPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.added.length).toBe(1);
    expect(data.added[0].category).toBe('Revenue');
    expect(data.added[0].hours).toBe(2);
  });

  it('POST processMessage with no patterns returns empty', async () => {
    const request = new NextRequest('http://localhost/api/focus-hours', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({ action: 'processMessage', message: 'Had a great meeting today' }),
    });

    const response = await focusPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.added.length).toBe(0);
  });
});

// --- Temporal API tests ---

describe('/api/temporal (real DB)', () => {
  let savedTemporalData: unknown = null;

  beforeAll(async () => {
    savedTemporalData = await loadJSON('temporal-tracking.json', null);
  });

  afterAll(async () => {
    await ensureDbReady();
    const db = getDb();
    if (savedTemporalData) {
      await saveJSON('temporal-tracking.json', savedTemporalData);
    } else if (db) {
      await db`DELETE FROM data_store WHERE key = 'temporal-tracking.json'`;
    }
    if (db) {
      await db`DELETE FROM audit_log WHERE entry_type = 'temporal' AND content LIKE ${'%Integration test%'}`;
    }
  });

  it('GET should return sessions and daily totals', async () => {
    const response = await temporalGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('dailyTotals');
  });

  it('POST addSession should persist a temporal session', async () => {
    const request = new NextRequest('http://localhost/api/temporal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        action: 'addSession',
        hours: 2,
        description: 'Integration test temporal session'
      })
    });

    const response = await temporalPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.session.duration).toBe(2);
    expect(data.newTotal).toBeGreaterThanOrEqual(2);

    // Verify persistence
    const getResponse = await temporalGet();
    const getData = await getResponse.json();
    const found = getData.sessions.some((s: { description: string }) => s.description === 'Integration test temporal session');
    expect(found).toBe(true);
  });

  it('POST should reject invalid hours', async () => {
    const request = new NextRequest('http://localhost/api/temporal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'addSession', hours: 0 })
    });

    const response = await temporalPost(request);
    expect(response.status).toBe(400);
  });

  it('POST should reject invalid action', async () => {
    const request = new NextRequest('http://localhost/api/temporal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action: 'badAction' })
    });

    const response = await temporalPost(request);
    expect(response.status).toBe(400);
  });
});

// --- Sync API tests ---

describe('/api/sync (real DB)', () => {
  afterAll(async () => {
    await ensureDbReady();
    const db = getDb();
    if (db) {
      await db`DELETE FROM text_store WHERE key LIKE ${TEST_PREFIX + '%'}`;
      await db`DELETE FROM data_store WHERE key LIKE ${TEST_PREFIX + '%'}`;
    }
  });

  it('should sync text files to DB', async () => {
    const request = new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        files: { [`${TEST_PREFIX}INITIATIVES.md`]: '# Test Initiatives\n\nContent here' }
      }),
    });

    const response = await syncPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.synced).toContain(`text: ${TEST_PREFIX}INITIATIVES.md`);

    // Verify it's readable
    const content = await loadText(`${TEST_PREFIX}INITIATIVES.md`, '');
    expect(content).toContain('# Test Initiatives');
  });

  it('should sync JSON data to DB', async () => {
    const request = new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        json: { [`${TEST_PREFIX}data.json`]: { tasks: [{ id: 'test-1', title: 'Test task' }] } }
      }),
    });

    const response = await syncPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.synced).toContain(`json: ${TEST_PREFIX}data.json`);

    // Verify it's readable
    const loaded = await loadJSON<{ tasks: { title: string }[] }>(`${TEST_PREFIX}data.json`, { tasks: [] });
    expect(loaded.tasks[0].title).toBe('Test task');
  });

  it('should sync both files and JSON in one request', async () => {
    const request = new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        files: { [`${TEST_PREFIX}mixed.md`]: 'Text content' },
        json: { [`${TEST_PREFIX}mixed.json`]: { value: 42 } }
      }),
    });

    const response = await syncPost(request);
    const data = await response.json();

    expect(data.synced.length).toBe(2);
  });
});

// --- Weekly Tracker API tests ---

describe('/api/weekly-tracker (real DB)', () => {
  let savedTrackerData: unknown = null;

  beforeAll(async () => {
    savedTrackerData = await loadJSON('weekly-tracker.json', null);
  });

  afterAll(async () => {
    await ensureDbReady();
    const db = getDb();
    if (savedTrackerData) {
      await saveJSON('weekly-tracker.json', savedTrackerData);
    } else if (db) {
      await db`DELETE FROM data_store WHERE key = 'weekly-tracker.json'`;
    }
    if (db) {
      await db`DELETE FROM audit_log WHERE entry_type = 'weekly-tracker' AND content LIKE ${'%Integration test%'}`;
    }
  });

  it('GET should return dashboard data structure', async () => {
    const response = await weeklyTrackerGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('todaysEntry');
    expect(data).toHaveProperty('currentWeekSummary');
    expect(data).toHaveProperty('previousWeekSummary');
    expect(data).toHaveProperty('dailyTrend');
    expect(data).toHaveProperty('recentReviews');
  });

  it('POST logDay should persist and be retrievable', async () => {
    const request = new NextRequest('http://localhost/api/weekly-tracker', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        action: 'logDay',
        deepWorkHours: 3.5,
        pipelineActions: 2,
        trained: true,
      }),
    });

    const response = await weeklyTrackerPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.entry.deepWorkHours).toBe(3.5);
    expect(data.entry.pipelineActions).toBe(2);
    expect(data.entry.trained).toBe(true);
    expect(data.currentWeekSummary).toBeDefined();

    // Verify persistence via GET
    const getResponse = await weeklyTrackerGet();
    const getData = await getResponse.json();
    expect(getData.todaysEntry).not.toBeNull();
    expect(getData.todaysEntry.deepWorkHours).toBe(3.5);
  });

  it('POST logDay should reject invalid input', async () => {
    const request = new NextRequest('http://localhost/api/weekly-tracker', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        action: 'logDay',
        deepWorkHours: 10,
        pipelineActions: 2,
        trained: true,
      }),
    });

    const response = await weeklyTrackerPost(request);
    expect(response.status).toBe(400);
  });

  it('POST submitReview should persist review', async () => {
    const request = new NextRequest('http://localhost/api/weekly-tracker', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        action: 'submitReview',
        revenue: 5000,
        slipAnalysis: 'Integration test slip',
        systemAdjustment: 'Integration test adjustment',
        nextWeekTargets: 'Integration test targets',
        bottleneck: 'Integration test bottleneck',
      }),
    });

    const response = await weeklyTrackerPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.review.revenue).toBe(5000);

    // Verify persistence via GET
    const getResponse = await weeklyTrackerGet();
    const getData = await getResponse.json();
    expect(getData.recentReviews.length).toBeGreaterThanOrEqual(1);
    expect(getData.recentReviews.some((r: { revenue: number }) => r.revenue === 5000)).toBe(true);
  });

  it('POST submitReview should reject negative revenue', async () => {
    const request = new NextRequest('http://localhost/api/weekly-tracker', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: JSON.stringify({
        action: 'submitReview',
        revenue: -100,
      }),
    });

    const response = await weeklyTrackerPost(request);
    expect(response.status).toBe(400);
  });
});

// --- Workspace API tests ---

describe('/api/workspace (real DB)', () => {
  it('should return initiatives and scorecard', async () => {
    // Seed test data first
    await saveText('INITIATIVES.md', `# INITIATIVES.md

## Current ranking (2026-03-22)

| Rank | Initiative | Money | Strategic | Urgency | Leverage | Time | Risk | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Temporal | 5 | 5 | 5 | 5 | 4 | 3 | 27 |
`);
    await saveText('DAILY_SCORECARD.md', `# DAILY_SCORECARD.md

## Date
- 2026-03-24

## Temporal focused hours target
- Target today: 5.0
- Actual: 2.5
`);

    const response = await workspaceGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.initiatives.length).toBeGreaterThanOrEqual(1);
    expect(data.initiatives[0].name).toBe('Temporal');
    expect(data.scorecard).not.toBeNull();
    expect(data.scorecard.date).toBeDefined();
  });
});
