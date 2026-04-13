import { NextRequest, NextResponse } from 'next/server';
import { WeeklyTracker } from '@/lib/weekly-tracker';
import { checkAuth } from '@/lib/auth';

export async function GET() {
  try {
    const tracker = await WeeklyTracker.create();

    return NextResponse.json({
      success: true,
      todaysEntry: tracker.getTodaysEntry(),
      currentWeekSummary: tracker.getCurrentWeekSummary(),
      previousWeekSummary: tracker.getPreviousWeekSummary(),
      dailyTrend: tracker.getDailyTrend(30),
      recentReviews: tracker.getWeeklyReviews(5),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading weekly tracker data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load weekly tracker data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, ...data } = body;
    const tracker = await WeeklyTracker.create();

    switch (action) {
      case 'logDay': {
        const { deepWorkHours, pipelineActions, trained, date } = data;

        if (typeof deepWorkHours !== 'number' || !isFinite(deepWorkHours) || deepWorkHours < 0 || deepWorkHours > 8) {
          return NextResponse.json(
            { success: false, error: 'deepWorkHours must be a number between 0 and 8' },
            { status: 400 }
          );
        }

        if (typeof pipelineActions !== 'number' || !isFinite(pipelineActions) || pipelineActions < 0 || !Number.isInteger(pipelineActions)) {
          return NextResponse.json(
            { success: false, error: 'pipelineActions must be a non-negative integer' },
            { status: 400 }
          );
        }

        if (typeof trained !== 'boolean') {
          return NextResponse.json(
            { success: false, error: 'trained must be a boolean' },
            { status: 400 }
          );
        }

        if (date !== undefined && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00').getTime()))) {
          return NextResponse.json(
            { success: false, error: 'date must be a valid YYYY-MM-DD string' },
            { status: 400 }
          );
        }

        const entry = await tracker.logDay(deepWorkHours, pipelineActions, trained, date);

        console.log('Weekly tracker day logged via API:', { date: entry.date, deepWorkHours, pipelineActions, trained });

        return NextResponse.json({
          success: true,
          entry,
          currentWeekSummary: tracker.getCurrentWeekSummary(),
        });
      }

      case 'submitReview': {
        const { revenue, slipAnalysis, systemAdjustment, nextWeekTargets, bottleneck, temporalTarget, weekStartDate, weekEndDate } = data;

        if (typeof revenue !== 'number' || !isFinite(revenue) || revenue < 0) {
          return NextResponse.json(
            { success: false, error: 'revenue must be a non-negative number' },
            { status: 400 }
          );
        }

        if (temporalTarget !== undefined && (typeof temporalTarget !== 'number' || !isFinite(temporalTarget) || temporalTarget < 0)) {
          return NextResponse.json(
            { success: false, error: 'temporalTarget must be a non-negative number' },
            { status: 400 }
          );
        }

        const review = await tracker.submitWeeklyReview({
          revenue,
          slipAnalysis: slipAnalysis || '',
          systemAdjustment: systemAdjustment || '',
          nextWeekTargets: nextWeekTargets || '',
          bottleneck: bottleneck || '',
          temporalTarget: temporalTarget ?? 5,
          weekStartDate,
          weekEndDate,
        });

        return NextResponse.json({
          success: true,
          review,
        });
      }

      case 'getAllData': {
        return NextResponse.json({
          success: true,
          data: tracker.getAllData(),
        });
      }

      case 'applyGarminTraining': {
        const { date, activeMinutes, threshold } = data;
        if (!date || typeof activeMinutes !== 'number') {
          return NextResponse.json({ success: false, error: 'date and activeMinutes required' }, { status: 400 });
        }
        const result = await tracker.applyGarminTraining(date, activeMinutes, threshold);
        return NextResponse.json({ success: true, trained: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing weekly tracker request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}
