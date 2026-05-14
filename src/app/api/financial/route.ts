import { NextRequest, NextResponse } from 'next/server';
import { FinancialTracker, FinancialValidationError } from '@/lib/financial-tracker';
import { checkAuth } from '@/lib/auth';
import { getAdminUserId } from '@/lib/users';
import { startOfWeek, format, subDays } from 'date-fns';

export async function GET() {
  try {
    const ownerId = await getAdminUserId();
    const financialTracker = await FinancialTracker.create(ownerId);
    const todaysMetrics = financialTracker.getTodaysMetrics();
    const weeklyTotals = financialTracker.getWeeklyTotals();
    const monthlyTotals = financialTracker.getMonthlyTotals();
    const previousWeekTotals = financialTracker.getPreviousWeekTotals();
    const recentEntries = financialTracker.getRecentEntries(10);

    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekFinancialByDay = financialTracker.getDailyMetricsForWeek(weekStart);

    const rangeEnd = format(now, 'yyyy-MM-dd');
    const rangeStart = format(subDays(now, 29), 'yyyy-MM-dd');
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
    const ownerId = await getAdminUserId();
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