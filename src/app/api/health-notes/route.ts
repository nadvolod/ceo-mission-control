import { NextRequest, NextResponse } from 'next/server';
import { HealthNotesTracker } from '@/lib/health-notes-tracker';
import { checkAuth } from '@/lib/auth';
import { requireEffectiveUserId } from '@/lib/session';
import type { SleepMetrics } from '@/lib/types';

// Inclusive [min, max] bounds for each manually-entered sleep metric.
// A field may also be null (not recorded). Anything else is a 400.
const SLEEP_METRIC_BOUNDS: Record<keyof SleepMetrics, [number, number]> = {
  sleepScore: [0, 100],
  durationMinutes: [0, 1440], // 0–24h
  bodyBattery: [0, 100],
  restingHeartRate: [0, 300],
  hrv: [0, 1000],
};

/**
 * Validate the optional `sleepMetrics` payload from a 'log' request.
 * Returns the parsed metrics (or undefined when omitted) on success, or an
 * error string describing the first invalid field.
 */
function parseSleepMetrics(
  raw: unknown,
): { ok: true; value: SleepMetrics | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'sleepMetrics must be an object' };
  }
  const out = {} as SleepMetrics;
  for (const key of Object.keys(SLEEP_METRIC_BOUNDS) as Array<keyof SleepMetrics>) {
    const v = (raw as Record<string, unknown>)[key];
    if (v === undefined || v === null) {
      out[key] = null;
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { ok: false, error: `sleepMetrics.${key} must be a number or null` };
    }
    if (!Number.isInteger(v)) {
      return { ok: false, error: `sleepMetrics.${key} must be an integer` };
    }
    const [min, max] = SLEEP_METRIC_BOUNDS[key];
    if (v < min || v > max) {
      return { ok: false, error: `sleepMetrics.${key} must be between ${min} and ${max}` };
    }
    out[key] = v;
  }
  return { ok: true, value: out };
}

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireEffectiveUserId(request);
    const tracker = await HealthNotesTracker.create(ownerId);

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
    const ownerId = await requireEffectiveUserId(request);
    const tracker = await HealthNotesTracker.create(ownerId);

    switch (action) {
      case 'log': {
        const { date, sleepEnvironment, sleepMetrics, supplements, habits, freeformNote } = data;

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

        const parsedMetrics = parseSleepMetrics(sleepMetrics);
        if (!parsedMetrics.ok) {
          return NextResponse.json(
            { success: false, error: parsedMetrics.error },
            { status: 400 }
          );
        }

        const note = await tracker.logNote({
          date,
          sleepEnvironment: sleepEnvironment || { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
          sleepMetrics: parsedMetrics.value,
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

      case 'deleteNote': {
        const { date } = data;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return NextResponse.json(
            { success: false, error: 'date must be a valid YYYY-MM-DD string' },
            { status: 400 }
          );
        }
        const deleted = await tracker.deleteNote(date);
        return NextResponse.json({ success: true, deleted });
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
