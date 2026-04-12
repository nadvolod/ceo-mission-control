import { NextRequest, NextResponse } from 'next/server';
import { MonthlyReviewTracker } from '@/lib/monthly-review-tracker';
import { checkAuth } from '@/lib/auth';

export async function GET() {
  try {
    const tracker = await MonthlyReviewTracker.create();

    return NextResponse.json({
      success: true,
      currentMonthReview: tracker.getCurrentMonthReview(),
      recentReviews: tracker.getRecentReviews(12),
      ratingsTrend: tracker.getRatingsTrend(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading monthly review data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load monthly review data' },
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
    const tracker = await MonthlyReviewTracker.create();

    switch (action) {
      case 'submitReview': {
        const review = await tracker.submitReview({
          month: data.month,
          date: data.date,
          timeAllocation: data.timeAllocation || '',
          hoursWorked: data.hoursWorked,
          temporalHours: data.temporalHours,
          energyGivers: data.energyGivers || '',
          energyDrainers: data.energyDrainers || '',
          ignoredSignals: data.ignoredSignals || '',
          moneySpent: data.moneySpent || '',
          expenseJoyVsStress: data.expenseJoyVsStress || '',
          alignmentCheck: data.alignmentCheck || '',
          monthLesson: data.monthLesson || '',
          decisionSource: data.decisionSource || 'mixed',
          badHabits: data.badHabits || '',
          goodPatterns: data.goodPatterns || '',
          ratings: data.ratings,
          oneThingToFix: data.oneThingToFix || '',
          disciplinedVersionAction: data.disciplinedVersionAction || '',
        });

        return NextResponse.json({ success: true, review });
      }

      case 'deleteReview': {
        const deleted = await tracker.deleteReview(data.month);
        return NextResponse.json({ success: true, deleted });
      }

      case 'getAllData': {
        return NextResponse.json({ success: true, data: tracker.getAllData() });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing monthly review request:', error);
    const message = (error as Error).message;
    const isValidation = message.includes('must be') || message.includes('must be one of');
    return NextResponse.json(
      { success: false, error: message },
      { status: isValidation ? 400 : 500 }
    );
  }
}
