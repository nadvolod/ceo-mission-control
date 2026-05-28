import { NextRequest, NextResponse } from 'next/server';
import { FinancialTracker, FinancialValidationError } from '@/lib/financial-tracker';
import { checkAuth } from '@/lib/auth';
import { requireEffectiveUserId } from '@/lib/session';
import { startOfWeek, format, subDays } from 'date-fns';
import { isLocalDateKey } from '@/lib/dates';

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireEffectiveUserId(request);
    const financialTracker = await FinancialTracker.create(ownerId);
    // Client passes its local YYYY-MM-DD so "today" matches the user's wall
    // clock, not UTC. See src/lib/dates.ts for context.
    const dateParam = request.nextUrl.searchParams.get('date');
    const todayKey = isLocalDateKey(dateParam) ? dateParam : undefined;
    const anchor = todayKey ? new Date(`${todayKey}T12:00:00`) : new Date();
    const todaysMetrics = financialTracker.getTodaysMetrics(todayKey);
    const weeklyTotals = financialTracker.getWeeklyTotals(todayKey);
    const monthlyTotals = financialTracker.getMonthlyTotals(todayKey);
    const previousWeekTotals = financialTracker.getPreviousWeekTotals(todayKey);
    const recentEntries = financialTracker.getRecentEntries(10);

    const weekStart = format(startOfWeek(anchor, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const weekFinancialByDay = financialTracker.getDailyMetricsForWeek(weekStart);

    const rangeEnd = format(anchor, 'yyyy-MM-dd');
    const rangeStart = format(subDays(anchor, 29), 'yyyy-MM-dd');
    const dailyFinancialTrend = financialTracker.getDailyMetricsForRange(rangeStart, rangeEnd);

    return NextResponse.json({
      todaysMetrics,
      weeklyTotals,
      monthlyTotals,
      previousWeekTotals,
      weekFinancialByDay,
      dailyFinancialTrend,
      recentEntries,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching financial metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const ownerId = await requireEffectiveUserId(request);
    const financialTracker = await FinancialTracker.create(ownerId);
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'addEntry': {
        const { category, amount, description, date } = data;
        try {
          const entry = await financialTracker.addEntry(category, amount, description, date);
          return NextResponse.json({ entry });
        } catch (err) {
          if (err instanceof FinancialValidationError) {
            return NextResponse.json({ error: err.message }, { status: 400 });
          }
          throw err;
        }
      }

      case 'processMessage': {
        const { message } = data;
        const result = await financialTracker.processConversationalUpdate(message);
        return NextResponse.json(result);
      }

      case 'getTodaysMetrics': {
        const todaysMetrics = financialTracker.getTodaysMetrics();
        return NextResponse.json({ todaysMetrics });
      }

      case 'getWeeklyTotals': {
        const weeklyTotals = financialTracker.getWeeklyTotals();
        return NextResponse.json({ weeklyTotals });
      }

      case 'getMonthlyTotals': {
        const monthlyTotals = financialTracker.getMonthlyTotals();
        return NextResponse.json({ monthlyTotals });
      }

      case 'getAllData': {
        const allData = financialTracker.getAllData();
        return NextResponse.json({ data: allData });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing financial request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
