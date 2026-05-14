#!/usr/bin/env tsx
/**
 * Idempotent demo-user data seeder.
 *
 * Wipes the demo user's existing rows in data_store/text_store/audit_log,
 * then writes a deterministic 8-week story to back the dashboard demo:
 *   - 56 daily weekly-tracker entries
 *   - 2 monthly reviews
 *   - 56 days of Garmin-shaped metrics
 *   - 30 days of health notes
 *
 * Run: `npm run seed:demo` (after `npm run db:migrate`).
 */

import { neon } from '@neondatabase/serverless';
import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { saveJSON, appendAuditLog } from '../src/lib/storage';
import type {
  WeeklyTrackerData,
  MonthlyReviewData,
  GarminHealthData,
  HealthNotesData,
} from '../src/lib/types';

const DEMO_EMAIL = 'demo@ceo-mc.local';
const DAYS = 56;

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

const ENERGY_GIVERS = [
  'Closing a deal in the morning sprint',
  'Strategy session with the product team',
  'A clean inbox by 10am',
  'Replay conference vibes',
  'Lifting after a deep-work block',
];
const ENERGY_DRAINERS = [
  'Back-to-back meetings without a break',
  'Open tabs about contract review',
  'Late-night Slack noise',
  'Reactive triage instead of focused build',
];

async function resolveDemoUserId(): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`SELECT id FROM users WHERE email = ${DEMO_EMAIL}`) as Array<{ id: string }>;
  if (!rows[0]) {
    throw new Error(`Demo user (${DEMO_EMAIL}) not found — run db:migrate first.`);
  }
  return rows[0].id;
}

async function wipeDemo(ownerId: string): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM data_store WHERE owner_id = ${ownerId}`;
  await sql`DELETE FROM text_store WHERE owner_id = ${ownerId}`;
  await sql`DELETE FROM audit_log WHERE owner_id = ${ownerId}`;
  console.log(`[seed-demo] wiped existing rows for demo (owner_id=${ownerId})`);
}

function buildWeeklyTracker(): WeeklyTrackerData {
  const data: WeeklyTrackerData = {
    dailyEntries: {},
    weeklyReviews: [],
    lastUpdated: new Date().toISOString(),
  };
  const today = new Date();
  const start = subDays(today, DAYS - 1);

  for (let i = 0; i < DAYS; i++) {
    const d = addDays(start, i);
    const date = format(d, 'yyyy-MM-dd');
    // Weave a believable story: weekdays heavier, weekends lighter, a slow
    // ramp upward over the 8 weeks. Deterministic — no randomness so the
    // seeder is reproducible.
    const dayOfWeek = d.getDay();
    const weekIndex = Math.floor(i / 7);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseDw = isWeekend ? 1.5 : 4 + (weekIndex * 0.25);
    const deepWorkHours = Math.min(7, Math.round(baseDw * 4) / 4);
    const pipelineActions = isWeekend ? 0 : 2 + (i % 3);
    const trained = !isWeekend && (i % 3 !== 0);
    data.dailyEntries[date] = {
      date,
      deepWorkHours,
      pipelineActions,
      trained,
      timestamp: new Date(d.getTime()).toISOString(),
    };
  }

  // 8 weekly reviews
  for (let w = 0; w < 8; w++) {
    const monday = startOfWeek(subDays(today, (7 - w) * 7), { weekStartsOn: 1 });
    data.weeklyReviews.push({
      id: `demo-review-${w}`,
      weekStartDate: format(monday, 'yyyy-MM-dd'),
      weekEndDate: format(addDays(monday, 6), 'yyyy-MM-dd'),
      revenue: 4_500 + w * 750,
      slipAnalysis: pick(['Lost Tuesday to triage', 'Skipped Friday review block', 'Wednesday meeting cascade'], w),
      systemAdjustment: pick(['Move admin block to Friday', 'Pre-write reviews on Sunday', 'Block 9–11 for deep work'], w),
      nextWeekTargets: pick(['Close two pipeline deals', 'Ship onboarding rev', 'Two strategy 1:1s'], w),
      bottleneck: pick(['Context switching', 'Inbox load', 'Late-night work'], w),
      temporalTarget: 5,
      createdAt: new Date(monday.getTime()).toISOString(),
    });
  }
  return data;
}

function buildMonthlyReviews(): MonthlyReviewData {
  const today = new Date();
  const data: MonthlyReviewData = {
    reviews: [],
    lastUpdated: new Date().toISOString(),
  };
  for (let m = 1; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m - 1, 15);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    data.reviews.push({
      id: `demo-month-${month}`,
      month,
      date: format(d, 'yyyy-MM-dd'),
      timeAllocation: '1. Product strategy\n2. Pipeline\n3. Hiring',
      hoursWorked: 175 + m * 5,
      temporalHours: 22,
      energyGivers: ENERGY_GIVERS.slice(0, 3).join('\n'),
      energyDrainers: ENERGY_DRAINERS.slice(0, 2).join('\n'),
      ignoredSignals: 'Skipped lifting two weeks running',
      moneySpent: 'Travel, software, coaching',
      expenseJoyVsStress: 'Coaching is joy. Travel is mixed.',
      alignmentCheck: 'Mostly disciplined. Slipped on Friday admin block twice.',
      monthLesson: 'Lock pipeline block before strategy time.',
      decisionSource: 'discipline',
      badHabits: 'Doomscroll after 9pm.',
      goodPatterns: 'Morning gym → strategy block.',
      ratings: { discipline: 8 - m, focus: 7, nutrition: 7, fitness: 6 + m, sleep: 7 },
      oneThingToFix: 'No Slack after 8pm.',
      disciplinedVersionAction: 'Phone in another room from 9pm.',
      createdAt: new Date(d.getTime()).toISOString(),
      updatedAt: new Date(d.getTime()).toISOString(),
    });
  }
  return data;
}

function buildGarmin(): GarminHealthData {
  const today = new Date();
  const data: GarminHealthData = {
    metrics: {},
    lastSyncedAt: new Date().toISOString(),
    syncStatus: 'idle',
    syncError: null,
  };
  for (let i = 0; i < DAYS; i++) {
    const d = subDays(today, i);
    const date = format(d, 'yyyy-MM-dd');
    const offset = Math.sin(i / 3) * 4;
    data.metrics[date] = {
      date,
      sleepScore: Math.round(78 + offset),
      sleepDurationMinutes: Math.round(425 + offset * 5),
      sleepStartTime: '22:45',
      sleepEndTime: '06:35',
      deepSleepMinutes: Math.round(85 + offset * 2),
      lightSleepMinutes: 220,
      remSleepMinutes: 95,
      awakeDuringMinutes: 25,
      restingHeartRate: Math.round(54 + offset / 2),
      hrvStatus: Math.round(48 + offset),
      averageStressLevel: Math.round(28 - offset / 2),
      bodyBatteryHigh: Math.round(78 + offset),
      bodyBatteryLow: Math.round(22 + offset / 2),
      steps: Math.round(8500 + i * 30),
      activeMinutes: i % 3 === 0 ? 0 : 45 + (i % 5) * 5,
      weight: 184,
      syncedAt: new Date(d.getTime()).toISOString(),
    };
  }
  return data;
}

function buildHealthNotes(): HealthNotesData {
  const today = new Date();
  const data: HealthNotesData = {
    notes: {},
    supplementTemplate: [
      { name: 'Guanfacine', defaultDosageMg: 1 },
      { name: 'Magnesium', defaultDosageMg: 400 },
    ],
    habitTemplate: [{ name: 'Red light therapy' }, { name: 'Phone before bed' }],
    environmentTemplate: { customFieldNames: [] },
    lastUpdated: new Date().toISOString(),
  };
  for (let i = 0; i < 30; i++) {
    const d = subDays(today, i);
    const date = format(d, 'yyyy-MM-dd');
    data.notes[date] = {
      date,
      sleepEnvironment: {
        temperatureF: 68,
        fanRunning: true,
        dogInRoom: false,
        customFields: {},
      },
      supplements: [
        { name: 'Guanfacine', dosageMg: 1, taken: true },
        { name: 'Magnesium', dosageMg: 400, taken: i % 2 === 0 },
      ],
      habits: [
        { name: 'Red light therapy', done: i % 3 !== 0 },
        { name: 'Phone before bed', done: i % 4 === 0 },
      ],
      freeformNote: i % 7 === 0 ? 'Slept well — woke up before alarm.' : '',
      loggedAt: new Date(d.getTime()).toISOString(),
    };
  }
  return data;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  console.log('[seed-demo] resolving demo user');
  const ownerId = await resolveDemoUserId();

  await wipeDemo(ownerId);

  console.log('[seed-demo] writing weekly tracker');
  await saveJSON(ownerId, 'weekly-tracker.json', buildWeeklyTracker());

  console.log('[seed-demo] writing monthly reviews');
  await saveJSON(ownerId, 'monthly-review.json', buildMonthlyReviews());

  console.log('[seed-demo] writing garmin metrics');
  await saveJSON(ownerId, 'garmin-health.json', buildGarmin());

  console.log('[seed-demo] writing health notes');
  await saveJSON(ownerId, 'health-notes.json', buildHealthNotes());

  await appendAuditLog(
    ownerId,
    new Date().toISOString().slice(0, 10),
    'demo-seed',
    `Seeded ${DAYS} days of demo data`,
  );

  console.log('[seed-demo] done');
}

main().catch((err) => {
  console.error('[seed-demo] FAILED', err);
  process.exit(1);
});
