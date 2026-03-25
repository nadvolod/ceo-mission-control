import { NextRequest, NextResponse } from 'next/server';
import { getFinancialSnapshot, getCachedSnapshot } from '@/lib/monarch-service';

export async function GET() {
  if (!process.env.MONARCH_TOKEN) {
    return NextResponse.json(
      { error: 'Monarch Money not configured. Set MONARCH_TOKEN environment variable.' },
      { status: 503 }
    );
  }

  try {
    const snapshot = await getFinancialSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Error fetching Monarch data:', error);

    // Try to serve stale cache on error
    const stale = await getCachedSnapshot();
    if (stale) {
      return NextResponse.json({ ...stale, stale: true });
    }

    return NextResponse.json(
      { error: 'Failed to fetch financial data from Monarch Money' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.MONARCH_TOKEN) {
    return NextResponse.json(
      { error: 'Monarch Money not configured. Set MONARCH_TOKEN environment variable.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'refresh': {
        const snapshot = await getFinancialSnapshot(true);
        return NextResponse.json(snapshot);
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing Monarch request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
