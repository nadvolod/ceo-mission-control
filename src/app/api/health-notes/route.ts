import { NextRequest, NextResponse } from 'next/server';
import { HealthNotesTracker } from '@/lib/health-notes-tracker';
import { checkAuth } from '@/lib/auth';

export async function GET() {
  try {
    const tracker = await HealthNotesTracker.create();

    return NextResponse.json({
      success: true,
      notes: tracker.getAllData().notes,
      templates: tracker.getTemplates(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading health notes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load health notes' },
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
    const tracker = await HealthNotesTracker.create();

    switch (action) {
      case 'log': {
        const { date, sleepEnvironment, supplements, habits, freeformNote } = data;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return NextResponse.json(
            { success: false, error: 'date must be a valid YYYY-MM-DD string' },
            { status: 400 }
          );
        }

        const note = await tracker.logNote({
          date,
          sleepEnvironment: sleepEnvironment || { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
          supplements: supplements || [],
          habits: habits || [],
          freeformNote: freeformNote || '',
        });

        return NextResponse.json({ success: true, note });
      }

      case 'update-templates': {
        const { operation, name, defaultDosageMg } = data;

        switch (operation) {
          case 'addSupplement':
            await tracker.addSupplement(name, defaultDosageMg || 0);
            break;
          case 'removeSupplement':
            await tracker.removeSupplement(name);
            break;
          case 'addHabit':
            await tracker.addHabit(name);
            break;
          case 'removeHabit':
            await tracker.removeHabit(name);
            break;
          case 'addEnvironmentField':
            await tracker.addEnvironmentField(name);
            break;
          case 'removeEnvironmentField':
            await tracker.removeEnvironmentField(name);
            break;
          default:
            return NextResponse.json(
              { success: false, error: `Unknown operation: ${operation}` },
              { status: 400 }
            );
        }

        return NextResponse.json({
          success: true,
          templates: tracker.getTemplates(),
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing health notes request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}
