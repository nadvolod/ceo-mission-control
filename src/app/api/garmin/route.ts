import { NextRequest, NextResponse } from 'next/server';
import { GarminTracker } from '@/lib/garmin-tracker';
import { HealthNotesTracker } from '@/lib/health-notes-tracker';
import { WeeklyTracker } from '@/lib/weekly-tracker';
import { checkAuth } from '@/lib/auth';
import { loadJSON } from '@/lib/storage';
import { fetchGarminMetrics, initiateGarminLogin, completeMFALogin } from '@/lib/garmin-client';
import { requireEffectiveUserId, isRealAdminRequest } from '@/lib/session';

// Garmin uses single global GARMIN_EMAIL/PASSWORD credentials. Any
// authenticated user could otherwise trigger a login or fetch and cache
// the admin's Garmin data under their own owner_id. Gate the credential-
// touching actions to the real admin (not impersonated) until per-user
// Garmin support exists.
const ADMIN_ONLY_ACTIONS = new Set(['garmin-login', 'garmin-mfa', 'fetch-garmin']);

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireEffectiveUserId(request);
    const garmin = await GarminTracker.create(ownerId);
    const notes = await HealthNotesTracker.create(ownerId);

    return NextResponse.json({
      success: true,
      metrics: garmin.getAllData().metrics,
      latest: garmin.getLatestMetrics(),
      averages: garmin.getAverages(7),
      syncStatus: garmin.getSyncStatus(),
      garminConfigured: !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD),
      garminConnected: await (async () => {
        const tokens = await loadJSON<{ oauth1?: unknown; oauth2?: unknown } | null>(ownerId, 'garmin-tokens.json', null);
        return !!(tokens?.oauth1 && tokens?.oauth2);
      })(),
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
    if (ADMIN_ONLY_ACTIONS.has(action) && !(await isRealAdminRequest(request))) {
      return NextResponse.json(
        { error: `Action "${action}" is admin-only until per-user Garmin credentials are supported.` },
        { status: 403 },
      );
    }
    const ownerId = await requireEffectiveUserId(request);

    switch (action) {
      case 'sync': {
        const { metrics, trainingThreshold } = data;
        if (!Array.isArray(metrics)) {
          return NextResponse.json(
            { success: false, error: 'metrics must be an array' },
            { status: 400 }
          );
        }

        const garmin = await GarminTracker.create(ownerId);
        const result = await garmin.syncMetrics(metrics);

        // Auto-apply training for days with sufficient active minutes
        const threshold = typeof trainingThreshold === 'number' && trainingThreshold > 0
          ? trainingThreshold
          : 30;
        let trained = 0;
        const weeklyTracker = await WeeklyTracker.create(ownerId);
        for (const m of metrics) {
          if (m.date && typeof m.activeMinutes === 'number' && m.activeMinutes >= threshold) {
            const applied = await weeklyTracker.applyGarminTraining(m.date, m.activeMinutes, threshold);
            if (applied) trained++;
          }
        }

        return NextResponse.json({ success: true, synced: result.synced, trained });
      }

      case 'garmin-login': {
        const result = await initiateGarminLogin(ownerId);
        if (result.success) {
          return NextResponse.json({ success: true, connected: true });
        }
        if (result.mfaRequired) {
          return NextResponse.json({ success: false, mfaRequired: true, sessionId: result.sessionId });
        }
        return NextResponse.json({ success: false, error: result.error }, { status: 502 });
      }

      case 'garmin-mfa': {
        const { sessionId, code } = data;
        if (!sessionId || !code) {
          return NextResponse.json({ success: false, error: 'sessionId and code are required' }, { status: 400 });
        }
        const result = await completeMFALogin(ownerId, sessionId, code);
        if (result.success) {
          return NextResponse.json({ success: true, connected: true });
        }
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      case 'fetch-garmin': {
        const days = typeof data.days === 'number' && data.days > 0 && data.days <= 30
          ? data.days
          : 7;

        const { metrics: fetchedMetrics, error } = await fetchGarminMetrics(ownerId, days);
        if (error) {
          const status = error.includes('environment variables') ? 503 : 502;
          return NextResponse.json({ success: false, error }, { status });
        }

        const garmin = await GarminTracker.create(ownerId);
        const result = await garmin.syncMetrics(fetchedMetrics);

        // Auto-apply training (same logic as 'sync' action)
        const threshold = typeof data.trainingThreshold === 'number' && data.trainingThreshold > 0
          ? data.trainingThreshold
          : 30;
        let trained = 0;
        const weeklyTracker = await WeeklyTracker.create(ownerId);
        for (const m of fetchedMetrics) {
          if (m.date && typeof m.activeMinutes === 'number' && m.activeMinutes >= threshold) {
            const applied = await weeklyTracker.applyGarminTraining(m.date, m.activeMinutes, threshold);
            if (applied) trained++;
          }
        }

        return NextResponse.json({ success: true, synced: result.synced, trained });
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
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
