/**
 * Integration tests for /api/monthly-review.
 *
 * Requires either DATABASE_URL (Neon) or WORKSPACE_PATH for filesystem storage.
 * Never mocks the storage layer.
 */

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000';
const AUTH_TOKEN = process.env.SYNC_API_KEY;

if (!AUTH_TOKEN) {
  throw new Error(
    'Missing SYNC_API_KEY env var. Set it to the dashboard sync API key to run integration tests.\n' +
    'Example: SYNC_API_KEY=your-key npx jest src/__tests__/integration/monthly-review-api.integration.test.ts'
  );
}

const headers = {
  'Content-Type': 'application/json',
  'x-sync-api-key': AUTH_TOKEN,
};

const TEST_MONTH = '2099-01';

async function cleanupTestMonth() {
  await fetch(`${API_BASE}/api/monthly-review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'deleteReview', month: TEST_MONTH }),
  });
}

beforeAll(cleanupTestMonth);
afterAll(cleanupTestMonth);

describe('/api/monthly-review', () => {
  test('GET returns empty reviews initially', async () => {
    const res = await fetch(`${API_BASE}/api/monthly-review`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.recentReviews)).toBe(true);
  });

  test('POST submitReview creates a review', async () => {
    const res = await fetch(`${API_BASE}/api/monthly-review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'submitReview',
        month: TEST_MONTH,
        date: '2099-01-31',
        timeAllocation: 'Testing',
        hoursWorked: 80,
        temporalHours: 20,
        energyGivers: 'Tests passing',
        energyDrainers: 'Flaky tests',
        ignoredSignals: 'None',
        moneySpent: '$0',
        expenseJoyVsStress: 'N/A',
        alignmentCheck: 'Aligned',
        monthLesson: 'Integration tests matter',
        decisionSource: 'discipline',
        badHabits: 'None',
        goodPatterns: 'TDD',
        ratings: { discipline: 8, focus: 7, executive: 6, math: 5, nutrition: 7, fitness: 6, sleep: 7 },
        oneThingToFix: 'Sleep',
        disciplinedVersionAction: 'More tests',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.review.month).toBe(TEST_MONTH);
    expect(data.review.hoursWorked).toBe(80);
  });

  test('POST submitReview validates ratings', async () => {
    const res = await fetch(`${API_BASE}/api/monthly-review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'submitReview',
        month: TEST_MONTH,
        date: '2099-01-31',
        timeAllocation: 'Test',
        hoursWorked: 80,
        temporalHours: 20,
        energyGivers: '',
        energyDrainers: '',
        ignoredSignals: '',
        moneySpent: '',
        expenseJoyVsStress: '',
        alignmentCheck: '',
        monthLesson: '',
        decisionSource: 'discipline',
        badHabits: '',
        goodPatterns: '',
        ratings: { discipline: 11, focus: 7, executive: 6, math: 5, nutrition: 7, fitness: 6, sleep: 7 },
        oneThingToFix: '',
        disciplinedVersionAction: '',
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('discipline');
  });

  test('POST without auth returns 401', async () => {
    const res = await fetch(`${API_BASE}/api/monthly-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submitReview' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET returns the submitted review', async () => {
    const res = await fetch(`${API_BASE}/api/monthly-review`);
    const data = await res.json();
    const testReview = data.recentReviews.find((r: any) => r.month === TEST_MONTH);
    expect(testReview).toBeDefined();
    expect(testReview.hoursWorked).toBe(80);
  });

  test('POST deleteReview removes it', async () => {
    const res = await fetch(`${API_BASE}/api/monthly-review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'deleteReview', month: TEST_MONTH }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
