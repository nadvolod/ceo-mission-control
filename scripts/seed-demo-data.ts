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
import { saveJSON, saveText, appendAuditLog } from '../src/lib/storage';
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

function buildDailyScorecard(): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  return `# DAILY_SCORECARD.md

## Date
- ${today}

## priorities
- Close two pipeline deals this week
- Ship the onboarding revision by Friday
- One 1:1 with each direct report

## Temporal focused hours target
- Target today: 5.0
- Actual: 3.5

## Focus blocks
- 09:00–11:00 Pipeline outreach
- 13:00–14:30 Product strategy
- 16:00–17:00 Admin / inbox

## Major money move today
- Sign WHO renewal contract amendment

## Strategic project move today
- Lock the v2 dashboard roadmap with product

## Taxes / risk reduction move today
- Forward Q1 estimates to accountant

## What to ignore today
- Slack non-mentions before 11am
- Recruiter cold emails

## Biggest blocker
- Waiting on legal review for the WHO amendment

## Wins:
- Closed Artis pilot conversation
- Two new pipeline contacts from Replay

## Misses:
- Skipped lifting block (third time this week)

## Open loops:
- Tax prep documents from accountant
- Comp letter for new hire

## Money advanced:
- $12k transferred to high-yield savings
`;
}

function buildInitiatives(): string {
  return `# INITIATIVES.md

## Current ranking (${format(new Date(), 'yyyy-MM-dd')})

| Rank | Initiative | Money | Strategic | Urgency | Leverage | Time | Risk | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Temporal client delivery | 5 | 5 | 5 | 5 | 4 | 3 | 27 |
| 2 | Onboarding revision | 4 | 5 | 4 | 5 | 3 | 2 | 23 |
| 3 | WHO renewal close | 5 | 3 | 5 | 4 | 3 | 4 | 24 |
| 4 | Hiring for product role | 3 | 5 | 3 | 5 | 4 | 3 | 23 |

## 1) Temporal client delivery
- **Type:** Revenue
- **Goal:** Hit $25k MRR by end of quarter
- **Current bottleneck:** Pipeline conversion rate stuck at 12%
- **Highest-leverage next move:** Run two strategy sessions with stalled prospects
- **Expected payoff:** +$8k MRR within 30 days
- **Confidence:** Medium-high
- **What to deprioritize because of it:** Cold outbound, generic content

## 2) Onboarding revision
- **Type:** Product
- **Goal:** Cut time-to-first-value from 3 days to 1
- **Current bottleneck:** Manual setup steps in the welcome flow
- **Highest-leverage next move:** Wire up automated workspace seeding
- **Expected payoff:** 20% improvement in week-1 retention
- **Confidence:** High
- **What to deprioritize because of it:** New feature work this sprint

## 3) WHO renewal close
- **Type:** Revenue
- **Goal:** Sign 12-month renewal at +15%
- **Current bottleneck:** Legal review on the amendment
- **Highest-leverage next move:** Direct call to procurement on Tuesday
- **Expected payoff:** $35k contract locked
- **Confidence:** High
- **What to deprioritize because of it:** New mid-market outbound
`;
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

  console.log('[seed-demo] writing workspace markdown');
  await saveText(ownerId, 'DAILY_SCORECARD.md', buildDailyScorecard());
  await saveText(ownerId, 'INITIATIVES.md', buildInitiatives());

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
