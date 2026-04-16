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

        if (supplements !== undefined && !Array.isArray(supplements)) {
          return NextResponse.json(
            { success: false, error: 'supplements must be an array' },
            { status: 400 }
          );
        }

        if (habits !== undefined && !Array.isArray(habits)) {
          return NextResponse.json(
            { success: false, error: 'habits must be an array' },
            { status: 400 }
          );
        }

        if (sleepEnvironment !== undefined && (sleepEnvironment === null || typeof sleepEnvironment !== 'object' || Array.isArray(sleepEnvironment))) {
          return NextResponse.json(
            { success: false, error: 'sleepEnvironment must be an object' },
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

        if (typeof name !== 'string' || name.trim().length === 0) {
          return NextResponse.json({ success: false, error: 'name must be a non-empty string' }, { status: 400 });
        }

        switch (operation) {
          case 'addSupplement':
            if (typeof defaultDosageMg !== 'number' || !Number.isFinite(defaultDosageMg) || defaultDosageMg <= 0) {
              return NextResponse.json(
                { success: false, error: 'defaultDosageMg must be a positive finite number' },
                { status: 400 }
              );
            }
            await tracker.addSupplement(name, defaultDosageMg);
            break;
          case 'removeSupplement':
            await tracker.removeSupplement(name);
            break;
          case 'editSupplement': {
            const { newName, newDosageMg } = data;
            if (typeof newName !== 'string' || newName.trim().length === 0) {
              return NextResponse.json(
                { success: false, error: 'newName must be a non-empty string' },
                { status: 400 }
              );
            }
            if (typeof newDosageMg !== 'number' || !Number.isFinite(newDosageMg) || newDosageMg <= 0) {
              return NextResponse.json(
                { success: false, error: 'newDosageMg must be a positive finite number' },
                { status: 400 }
              );
            }
            try {
              await tracker.editSupplement(name, newName.trim(), newDosageMg);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to edit supplement';
              return NextResponse.json({ success: false, error: message }, { status: 400 });
            }
            break;
          }
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
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
