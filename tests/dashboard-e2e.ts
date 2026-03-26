/**
 * E2E Dashboard Rendering Tests
 *
 * These tests hit the REAL production dashboard — no mocking.
 * Validates that all API endpoints return valid data and pages render correctly.
 *
 * Requires DASHBOARD_URL environment variable (defaults to production URL).
 *
 * Run with tsx (NOT Jest):
 *   npx tsx tests/dashboard-e2e.ts
 *
 * Or via npm script:
 *   npm run test:e2e
 */

import assert from 'node:assert/strict';

// --- Configuration ---

const DASHBOARD_URL = process.env.DASHBOARD_URL;

if (!DASHBOARD_URL) {
  console.error(
    'ERROR: DASHBOARD_URL environment variable is required.\n' +
    'Set it to the production dashboard URL, e.g.:\n' +
    '  export DASHBOARD_URL=https://ceo-mission-control-nine.vercel.app\n' +
    '\nTests must hit the real deployed dashboard, not a local dev server.'
  );
  process.exit(1);
}

// Strip trailing slash for consistent URL building
const BASE_URL = DASHBOARD_URL.replace(/\/+$/, '');

// --- Helpers ---

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    failures.push(`  ✕ ${name}: ${err.message}`);
    console.error(`  ✕ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function fetchJSON(path: string): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

async function fetchHTML(path: string): Promise<{ status: number; html: string }> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'text/html' },
  });
  const html = await response.text();
  return { status: response.status, html };
}

// --- Tests ---

async function run() {
  console.log(`\nE2E Dashboard Rendering Tests`);
  console.log(`Target: ${BASE_URL}\n`);

  // ============================================================
  // API Endpoint Tests
  // ============================================================

  console.log('API Endpoints\n');

  await test('GET /api/tasks returns tasks array and stats object', async () => {
    const data = await fetchJSON('/api/tasks');
    assert.ok(data.tasks !== undefined, 'response should have "tasks" property');
    assert.ok(Array.isArray(data.tasks), '"tasks" should be an array');
    assert.ok(data.stats !== undefined, 'response should have "stats" property');
    assert.equal(typeof data.stats, 'object', '"stats" should be an object');
  });

  await test('GET /api/workspace returns initiatives and scorecard', async () => {
    const data = await fetchJSON('/api/workspace');
    assert.ok(data.initiatives !== undefined, 'response should have "initiatives" property');
    assert.ok(data.scorecard !== undefined, 'response should have "scorecard" property');
  });

  await test('GET /api/financial returns todaysMetrics', async () => {
    const data = await fetchJSON('/api/financial');
    assert.ok(data.todaysMetrics !== undefined, 'response should have "todaysMetrics" property');
  });

  await test('GET /api/focus-hours returns success: true', async () => {
    const data = await fetchJSON('/api/focus-hours');
    assert.equal(data.success, true, 'response should have "success: true"');
  });

  await test('GET /api/monarch returns accounts and cashPosition', async () => {
    const url = `${BASE_URL}/api/monarch`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();

    if (!response.ok) {
      // Monarch may fail if token is expired — that's acceptable, but we want a clear message
      assert.ok(
        data.error || data.message,
        'non-OK response should contain an error message explaining the failure'
      );
      console.log(`    (Monarch returned ${response.status}: ${data.error || data.message})`);
      return;
    }

    assert.ok(data.accounts !== undefined, 'response should have "accounts" property');
    assert.ok(data.cashPosition !== undefined, 'response should have "cashPosition" property');
  });

  // ============================================================
  // Page Rendering Tests
  // ============================================================

  console.log('\nPage Rendering\n');

  await test('GET /dashboard returns 200', async () => {
    const { status } = await fetchHTML('/dashboard');
    assert.equal(status, 200, `expected 200 but got ${status}`);
  });

  await test('GET /dashboard contains "CEO Mission Control"', async () => {
    const { html } = await fetchHTML('/dashboard');
    assert.ok(
      html.includes('CEO Mission Control'),
      'dashboard HTML should contain "CEO Mission Control"'
    );
  });

  await test('GET /dashboard contains loading state text', async () => {
    const { html } = await fetchHTML('/dashboard');
    assert.ok(
      html.includes('Loading Mission Control...'),
      'dashboard HTML should contain "Loading Mission Control..." loading state'
    );
  });

  await test('GET /dashboard does not contain error text in visible HTML', async () => {
    const { html } = await fetchHTML('/dashboard');
    // Check visible HTML body only (exclude RSC payload which contains 404 templates)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)(?=<script)/);
    const visibleHtml = bodyMatch ? bodyMatch[1] : html;
    assert.ok(
      !visibleHtml.includes('Application error'),
      'visible dashboard HTML should NOT contain "Application error"'
    );
    assert.ok(
      !visibleHtml.includes('Internal Server Error'),
      'visible dashboard HTML should NOT contain "Internal Server Error"'
    );
    assert.ok(
      !visibleHtml.includes('Dashboard Error'),
      'visible dashboard HTML should NOT contain "Dashboard Error" (error boundary)'
    );
  });

  await test('GET / returns 200', async () => {
    const { status } = await fetchHTML('/');
    assert.equal(status, 200, `expected 200 but got ${status}`);
  });

  await test('GET / contains "CEO Mission Control"', async () => {
    const { html } = await fetchHTML('/');
    assert.ok(
      html.includes('CEO Mission Control'),
      'landing page HTML should contain "CEO Mission Control"'
    );
  });

  // --- Summary ---
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(f));
    console.log('');
  }
  process.exit(failed > 0 ? 1 : 0);
}

run();
