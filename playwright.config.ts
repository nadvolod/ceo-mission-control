import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';

const target = process.env.PLAYWRIGHT_TARGET || 'local';
const isLocal = target === 'local';

const localBaseURL = 'http://localhost:3000';
const prodBaseURL = process.env.PLAYWRIGHT_PRODUCTION_URL ||
  process.env.DASHBOARD_URL ||
  'https://ceo-mission-control-nine.vercel.app';

const webServer: PlaywrightTestConfig['webServer'] = isLocal
  ? {
      command: process.env.CI ? 'npm run start' : 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        // Pass through the same env Next needs at runtime.
        DATABASE_URL: process.env.DATABASE_URL || '',
        IRON_SESSION_PASSWORD: process.env.IRON_SESSION_PASSWORD || '',
      },
    }
  : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // E2E runs authenticate as one real DB-backed test user. Keep the suite
  // single-worker so specs that mutate that user's rows cannot race each other
  // or invalidate another spec's empty-state precondition.
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: isLocal ? localBaseURL : prodBaseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer,
  projects: [
    // Auth setup project runs first and produces tests/.auth/test-user.json
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: 'tests/.auth/test-user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
