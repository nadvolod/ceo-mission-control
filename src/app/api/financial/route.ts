import { NextRequest, NextResponse } from 'next/server';
import { FinancialTracker } from '@/lib/financial-tracker';
import { checkAuth } from '@/lib/auth';

export async function GET() {
  try {
    const financialTracker = await FinancialTracker.create();
    const todaysMetrics = financialTracker.getTodaysMetrics();
    const weeklyTotals = financialTracker.getWeeklyTotals();
    const monthlyTotals = financialTracker.getMonthlyTotals();
    const recentEntries = financialTracker.getRecentEntries(10);

    return NextResponse.json({
      todaysMetrics,
      weeklyTotals,
      monthlyTotals,
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
    const financialTracker = await FinancialTracker.create();
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'addEntry': {
        const { category, amount, description, date } = data;
        const entry = await financialTracker.addEntry(category, amount, description, date);
        return NextResponse.json({ entry });
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