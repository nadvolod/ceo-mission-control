import { NextRequest, NextResponse } from 'next/server';
import { GarminTracker } from '@/lib/garmin-tracker';
import { HealthNotesTracker } from '@/lib/health-notes-tracker';
import { checkAuth } from '@/lib/auth';

export async function GET() {
  try {
    const garmin = await GarminTracker.create();
    const notes = await HealthNotesTracker.create();

    return NextResponse.json({
      success: true,
      metrics: garmin.getAllData().metrics,
      latest: garmin.getLatestMetrics(),
      averages: garmin.getAverages(7),
      syncStatus: garmin.getSyncStatus(),
      notes: notes.getAllData().notes,
      templates: notes.getTemplates(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading garmin data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load garmin data' },
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

    switch (action) {
      case 'sync': {
        const { metrics } = data;
        if (!Array.isArray(metrics)) {
          return NextResponse.json(
            { success: false, error: 'metrics must be an array' },
            { status: 400 }
          );
        }

        const garmin = await GarminTracker.create();
        const result = await garmin.syncMetrics(metrics);

        return NextResponse.json({ success: true, synced: result.synced });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing garmin request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}
