import { NextRequest, NextResponse } from 'next/server';
import { readInitiatives, readDailyScorecard } from '@/lib/workspace-reader';

export async function GET() {
  try {
    const initiatives = readInitiatives();
    const scorecard = readDailyScorecard();

    return NextResponse.json({
      initiatives,
      scorecard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading workspace data:', error);
    return NextResponse.json(
      { error: 'Failed to read workspace data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'refresh':
        const initiatives = readInitiatives();
        const scorecard = readDailyScorecard();
        return NextResponse.json({ initiatives, scorecard });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing workspace request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}