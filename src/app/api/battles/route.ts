import { NextRequest, NextResponse } from 'next/server';
import { BattlesTracker, BattlesValidationError } from '@/lib/battles-tracker';
import { checkAuth } from '@/lib/auth';
import { requireEffectiveUserId } from '@/lib/session';
import { format, subDays } from 'date-fns';
import { isLocalDateKey } from '@/lib/dates';

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireEffectiveUserId(request);
    const tracker = await BattlesTracker.create(ownerId);
    // Client passes its local YYYY-MM-DD so "today" matches the user's wall
    // clock, not UTC. See src/lib/dates.ts for context.
    const dateParam = request.nextUrl.searchParams.get('date');
    const todayKey = isLocalDateKey(dateParam) ? dateParam : undefined;
    const anchor = todayKey ? new Date(`${todayKey}T12:00:00`) : new Date();

    const todaysMetrics = tracker.getTodaysMetrics(todayKey);
    const weeklyTotals = tracker.getWeeklyTotals(todayKey);
    const allTimeTotals = tracker.getAllTimeTotals();
    const recentEntries = tracker.getRecentEntries(10);

    const rangeEnd = format(anchor, 'yyyy-MM-dd');
    const rangeStart = format(subDays(anchor, 29), 'yyyy-MM-dd');
    const dailyBattleTrend = tracker.getDailyMetricsForRange(rangeStart, rangeEnd);

    return NextResponse.json({
      todaysMetrics,
      weeklyTotals,
      allTimeTotals,
      dailyBattleTrend,
      recentEntries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching battles metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch battles metrics' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const ownerId = await requireEffectiveUserId(request);
    const tracker = await BattlesTracker.create(ownerId);
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'addBattle': {
        const { name, value, date } = data;
        try {
          const entry = await tracker.addBattle(name, value, date);
          return NextResponse.json({ entry });
        } catch (err) {
          if (err instanceof BattlesValidationError) {
            return NextResponse.json({ error: err.message }, { status: 400 });
          }
          throw err;
        }
      }

      case 'getTodaysMetrics': {
        const todaysMetrics = tracker.getTodaysMetrics();
        return NextResponse.json({ todaysMetrics });
      }

      case 'getAllTimeTotals': {
        const allTimeTotals = tracker.getAllTimeTotals();
        return NextResponse.json({ allTimeTotals });
      }

      case 'getAllData': {
        const allData = tracker.getAllData();
        return NextResponse.json({ data: allData });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing battles request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
