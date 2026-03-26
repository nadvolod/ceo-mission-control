import { NextRequest, NextResponse } from 'next/server';
import { readInitiatives, readDailyScorecard, updateScorecardField } from '@/lib/workspace-reader';
import { checkAuth } from '@/lib/auth';

export async function GET() {
  try {
    const initiatives = await readInitiatives();
    const scorecard = await readDailyScorecard();

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
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { action, ...data } = await request.json();

    switch (action) {
      case 'refresh': {
        const initiatives = await readInitiatives();
        const scorecard = await readDailyScorecard();
        return NextResponse.json({ initiatives, scorecard });
      }

      case 'updateScorecard': {
        const { field, value } = data;
        if (!field) {
          return NextResponse.json({ error: 'field is required' }, { status: 400 });
        }
        if (value === undefined || value === null) {
          return NextResponse.json({ error: 'value is required' }, { status: 400 });
        }
        console.log(`Updating scorecard field "${field}"`);

        const updatedScorecard = await updateScorecardField(field, value);
        return NextResponse.json({ success: true, scorecard: updatedScorecard });
      }

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