import { test, expect } from '@playwright/test';

// Authenticated as the test user via the setup project's storageState.
// global-setup wipes the test user's rows before this run.

test.describe('Curation (delete affordances)', () => {
  // Serial: each test mutates the same test user's rows and expects a
  // specific starting state. Running in parallel would race writes.
  test.describe.configure({ mode: 'serial' });

  test('test user can create a daily entry then delete it through the API', async ({ request }) => {
    // Use a fixed date in the recent past so this test isn't flaky around
    // midnight boundaries (where logDay-without-date could land on day N
    // and the readback could fall on day N+1).
    const date = '2025-01-15';
    const create = await request.post('/api/weekly-tracker', {
      data: { action: 'logDay', deepWorkHours: 3, pipelineActions: 2, trained: true, date },
    });
    expect(create.status()).toBe(200);
    const created = await create.json();
    expect(created.entry.date).toBe(date);

    const del = await request.post('/api/weekly-tracker', {
      data: { action: 'deleteDay', date },
    });
    expect(del.status()).toBe(200);
    const delBody = await del.json();
    expect(delBody.success).toBe(true);
    expect(delBody.deleted).toBe(true);

    // Confirm the row is gone via getAllData (date may be outside the
    // current-week summary, so todaysEntry is the wrong assertion).
    const after = await (await request.post('/api/weekly-tracker', {
      data: { action: 'getAllData' },
    })).json();
    expect(after.data.dailyEntries[date]).toBeUndefined();
  });

  test('deleteDay returns deleted:false for a date that does not exist', async ({ request }) => {
    const res = await request.post('/api/weekly-tracker', {
      data: { action: 'deleteDay', date: '2099-12-31' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(false);
  });

  test('deleteDay rejects malformed date', async ({ request }) => {
    const res = await request.post('/api/weekly-tracker', {
      data: { action: 'deleteDay', date: 'not-a-date' },
    });
    expect(res.status()).toBe(400);
  });

  test('deleteReview round-trips: submit then delete via id', async ({ request }) => {
    const submit = await request.post('/api/weekly-tracker', {
      data: { action: 'submitReview', revenue: 1234, slipAnalysis: 'curation-test' },
    });
    expect(submit.status()).toBe(200);
    const submitted = await submit.json();
    const reviewId = submitted.review.id;

    const del = await request.post('/api/weekly-tracker', {
      data: { action: 'deleteReview', id: reviewId },
    });
    expect(del.status()).toBe(200);
    const delBody = await del.json();
    expect(delBody.deleted).toBe(true);

    const after = await (await request.get('/api/weekly-tracker')).json();
    expect(after.recentReviews.find((r: { id: string }) => r.id === reviewId)).toBeUndefined();
  });

  test('deleteNote on health-notes round-trips', async ({ request }) => {
    const date = '2025-01-15';
    await request.post('/api/health-notes', {
      data: {
        action: 'log',
        date,
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [],
        habits: [],
        freeformNote: 'curation-test',
      },
    });
    const del = await request.post('/api/health-notes', {
      data: { action: 'deleteNote', date },
    });
    expect(del.status()).toBe(200);
    const body = await del.json();
    expect(body.deleted).toBe(true);

    const verify = await (await request.get('/api/health-notes')).json();
    expect(verify.notes[date]).toBeUndefined();
  });
});

test.describe('Admin-only gates on shared-credential routes', () => {
  // Test user authenticated; trying to hit admin-only actions should 403.
  test('test user cannot call POST /api/monarch refresh', async ({ request }) => {
    const res = await request.post('/api/monarch', { data: { action: 'refresh' } });
    // 503 (no MONARCH_TOKEN) is also acceptable since the route gates env first.
    // We require it to not be 200 or 204 — the user must not get cached admin data.
    expect([403, 503]).toContain(res.status());
  });

  test('test user cannot call garmin-login', async ({ request }) => {
    const res = await request.post('/api/garmin', {
      data: { action: 'garmin-login' },
      headers: { 'x-sync-api-key': process.env.SYNC_API_KEY || '' },
    });
    // Either rejected as non-admin (403) or the API key check fails first (401).
    expect([401, 403]).toContain(res.status());
  });
});
