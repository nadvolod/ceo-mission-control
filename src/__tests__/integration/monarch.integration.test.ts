/**
 * Monarch Money Integration Tests
 *
 * These tests hit the REAL Monarch Money API and REAL Neon DB — no mocking.
 * Requires MONARCH_TOKEN and DATABASE_URL environment variables.
 *
 * Run with tsx (NOT Jest) since monarch-money-api is ESM-only:
 *   npx tsx src/__tests__/integration/monarch.integration.test.ts
 *
 * Or via npm script:
 *   npm run test:monarch
 */

import assert from 'node:assert/strict';
import { fetchAccounts, fetchCashflowSummary } from '../../lib/monarch-client';
import { getFinancialSnapshot, getCachedSnapshot, buildSnapshot } from '../../lib/monarch-service';
import { saveJSON } from '../../lib/storage';

const CACHE_KEY = 'monarch-financial-data.json';

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

// --- Env checks ---

if (!process.env.MONARCH_TOKEN) {
  console.error(
    'ERROR: MONARCH_TOKEN environment variable is required.\n' +
    'Run `npx tsx scripts/monarch-login.ts` to obtain a token.'
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    'ERROR: DATABASE_URL environment variable is required.\n' +
    'Integration tests must hit the real Neon DB, not filesystem fallback.'
  );
  process.exit(1);
}

// --- Tests ---

async function run() {
  console.log('\nMonarchClient\n');

  await test('fetches accounts with expected fields', async () => {
    const accounts = await fetchAccounts();
    assert.ok(Array.isArray(accounts), 'accounts should be an array');
    assert.ok(accounts.length > 0, 'should have at least one account');

    const account = accounts[0];
    assert.ok(account.id, 'account should have id');
    assert.ok(account.displayName, 'account should have displayName');
    assert.ok('currentBalance' in account, 'account should have currentBalance');
    assert.ok('isAsset' in account, 'account should have isAsset');
    assert.ok(account.type?.name, 'account should have type.name');
  });

  await test('fetches cashflow summary with income and expenses', async () => {
    const summary = await fetchCashflowSummary();
    assert.ok('sumIncome' in summary, 'should have sumIncome');
    assert.ok('sumExpense' in summary, 'should have sumExpense');
    assert.ok('savings' in summary, 'should have savings');
    assert.ok('savingsRate' in summary, 'should have savingsRate');
    assert.equal(typeof summary.sumIncome, 'number');
    assert.equal(typeof summary.sumExpense, 'number');
  });

  console.log('\nMonarchService\n');

  await test('returns a complete financial snapshot', async () => {
    const snapshot = await getFinancialSnapshot(true);

    assert.ok(Array.isArray(snapshot.accounts), 'accounts should be array');
    assert.equal(typeof snapshot.cashPosition, 'number');
    assert.equal(typeof snapshot.totalAssets, 'number');
    assert.equal(typeof snapshot.totalLiabilities, 'number');
    assert.equal(typeof snapshot.netWorth, 'number');
    assert.equal(typeof snapshot.monthlyIncome, 'number');
    assert.equal(typeof snapshot.monthlyExpenses, 'number');
    assert.equal(typeof snapshot.burnRate, 'number');
    assert.equal(typeof snapshot.runwayMonths, 'number');
    assert.ok(snapshot.lastSynced, 'should have lastSynced');

    // Net worth = assets - liabilities
    const expectedNetWorth = snapshot.totalAssets - snapshot.totalLiabilities;
    assert.ok(
      Math.abs(snapshot.netWorth - expectedNetWorth) < 1,
      `netWorth ${snapshot.netWorth} should equal assets - liabilities ${expectedNetWorth}`
    );
  });

  await test('caches data and serves from cache on second call', async () => {
    const first = await getFinancialSnapshot(true);
    assert.ok(first.lastSynced);

    const second = await getFinancialSnapshot(false);
    assert.equal(second.lastSynced, first.lastSynced, 'should serve cached data');
  });

  await test('force-refresh bypasses cache', async () => {
    const initial = await getFinancialSnapshot(true);
    await new Promise((r) => setTimeout(r, 1100));

    const refreshed = await getFinancialSnapshot(true);
    assert.ok(
      new Date(refreshed.lastSynced).getTime() > new Date(initial.lastSynced).getTime(),
      'refreshed lastSynced should be newer'
    );
  });

  await test('getCachedSnapshot returns cached data', async () => {
    await getFinancialSnapshot(true);
    const cached = await getCachedSnapshot();
    assert.ok(cached !== null, 'cached snapshot should not be null');
    assert.ok(cached!.accounts, 'should have accounts');
    assert.equal(typeof cached!.cashPosition, 'number');
  });

  await test('snapshot has correct derived calculations', async () => {
    const snapshot = await getFinancialSnapshot(false);

    // Burn rate = monthly expenses
    assert.equal(snapshot.burnRate, snapshot.monthlyExpenses);

    // Runway = cash / burn
    if (snapshot.burnRate > 0) {
      const expectedRunway = snapshot.cashPosition / snapshot.burnRate;
      assert.ok(
        Math.abs(snapshot.runwayMonths - expectedRunway) < 0.01,
        `runway ${snapshot.runwayMonths} should equal cash/burn ${expectedRunway}`
      );
    }

    // All visible accounts should not be hidden/disabled/deactivated
    for (const account of snapshot.accounts) {
      assert.equal(account.isHidden, false, `${account.displayName} should not be hidden`);
      assert.equal(account.syncDisabled, false, `${account.displayName} should not be sync-disabled`);
      assert.equal(account.deactivatedAt, null, `${account.displayName} should not be deactivated`);
    }
  });

  await test('buildSnapshot correctly classifies cash accounts', async () => {
    const accounts = await fetchAccounts();
    const cashflow = await fetchCashflowSummary();
    const snapshot = buildSnapshot(accounts, cashflow);

    // Cash position should only include depository/checking/savings
    const visibleAccounts = accounts.filter(a => !a.isHidden && !a.syncDisabled && !a.deactivatedAt);
    const cashAccounts = visibleAccounts.filter(a => {
      const t = a.type?.name?.toLowerCase() ?? '';
      const s = a.subtype?.name?.toLowerCase() ?? '';
      return t === 'depository' || s === 'checking' || s === 'savings' || s === 'money_market';
    });
    const expectedCash = cashAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

    assert.ok(
      Math.abs(snapshot.cashPosition - expectedCash) < 0.01,
      `cashPosition ${snapshot.cashPosition} should match sum of cash accounts ${expectedCash}`
    );
  });

  // --- Cleanup ---
  try {
    await saveJSON(CACHE_KEY, null);
  } catch {
    // Ignore
  }

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
