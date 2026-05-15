import { NextRequest, NextResponse } from 'next/server';
import { ThreeToThriveTracker } from '@/lib/three-to-thrive';
import { checkAuth } from '@/lib/auth';
import { requireEffectiveUserId } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireEffectiveUserId(request);
    const tracker = await ThreeToThriveTracker.create(ownerId);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    return NextResponse.json({
      success: true,
      todaysEntry: tracker.getTodaysEntry(date),
      history: tracker.getHistory(30),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading Three to Thrive data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load Three to Thrive data' },
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
    const { date, question, answer } = body;
    const ownerId = await requireEffectiveUserId(request);

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'date must be a valid YYYY-MM-DD string' },
        { status: 400 }
      );
    }

    if (typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'question must be a non-empty string' },
        { status: 400 }
      );
    }

    if (typeof answer !== 'string') {
      return NextResponse.json(
        { success: false, error: 'answer must be a string' },
        { status: 400 }
      );
    }

    const tracker = await ThreeToThriveTracker.create(ownerId);
    const saved = await tracker.saveAnswer(date, question, answer);

    console.log('Three to Thrive answer saved:', { date, question: question.slice(0, 40) });

    return NextResponse.json({
      success: true,
      answer: saved,
      todaysEntry: tracker.getTodaysEntry(date),
    });
  } catch (error) {
    console.error('Error saving Three to Thrive answer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save answer' },
      { status: 500 }
    );
  }
}
