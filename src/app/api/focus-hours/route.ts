import { NextRequest, NextResponse } from 'next/server';
import { FocusTracker } from '@/lib/focus-tracker';
import { checkAuth } from '@/lib/auth';
import type { FocusCategory, FocusSession } from '@/lib/types';
import { appendAuditLog } from '@/lib/storage';
import { requireEffectiveUserId } from '@/lib/session';
import { isLocalDateKey } from '@/lib/dates';

const VALID_CATEGORIES: FocusCategory[] = [
  'Temporal', 'Finance', 'Revenue', 'Housing',
  'Tax', 'Personal', 'Health', 'Admin', 'Learning', 'Other'
];

async function logToMemory(ownerId: string, session: FocusSession): Promise<void> {
  try {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });

    const logEntry = `\n## Focus Session Logged (${timestamp})\n- **Category**: ${session.category}\n- **Duration**: ${session.hours} hours\n- **Description**: ${session.description}\n- **Source**: ${session.source}\n\n`;

    await appendAuditLog(ownerId, session.date, 'focus', logEntry);
  } catch (error) {
    console.error('Error updating memory file:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const ownerId = await requireEffectiveUserId(request);
    const tracker = await FocusTracker.create(ownerId);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Client passes its local YYYY-MM-DD so "today" matches the user's wall
    // clock, not UTC. Anonymous calls (no `?date=…`) fall back to server-local.
    const dateParam = request.nextUrl.searchParams.get('date');
    const todayKey = isLocalDateKey(dateParam) ? dateParam : undefined;

    return NextResponse.json({
      success: true,
      todaysMetrics: tracker.getTodaysMetrics(todayKey),
      weeklyTotals: tracker.getWeeklyTotals(),
      previousWeekTotals: tracker.getPreviousWeekTotals(),
      weekOverWeek: tracker.getWeekOverWeekGrowth(),
      dailyTrend: tracker.getDailyTrend(30),
      rollingAverage: tracker.getRollingAverage(30),
      categoryDistribution: tracker.getCategoryDistribution(weekAgo, now),
      recentSessions: tracker.getRecentSessions(15),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error loading focus data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load focus data' },
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
    const tracker = await FocusTracker.create(ownerId);

    switch (action) {
      case 'addSession': {
        const { category, hours, description, date } = data;

        if (typeof hours !== 'number' || !isFinite(hours) || hours <= 0 || hours > 24) {
          return NextResponse.json(
            { success: false, error: 'Hours must be a number greater than 0 and at most 24' },
            { status: 400 }
          );
        }

        if (category && !VALID_CATEGORIES.includes(category)) {
          return NextResponse.json(
            { success: false, error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
            { status: 400 }
          );
        }

        const session = await tracker.addSession(
          category || 'Other',
          hours,
          description || `${hours}h focus block`,
          date,
          'manual'
        );

        await logToMemory(ownerId, session);

        console.log('Focus session added via API:', { category: session.category, hours, date: session.date });

        return NextResponse.json({
          success: true,
          session,
          // The POST body's date doubles as the "today" hint for the
          // returned snapshot so the client sees a consistent total.
          todaysMetrics: tracker.getTodaysMetrics(isLocalDateKey(date) ? date : undefined)
        });
      }

      case 'processMessage': {
        const { message } = data;
        if (!message) {
          return NextResponse.json(
            { success: false, error: 'Message is required' },
            { status: 400 }
          );
        }

        const result = await tracker.processConversationalUpdate(message);

        for (const session of result.added) {
          await logToMemory(ownerId, session);
        }

        return NextResponse.json({
          success: true,
          added: result.added,
          message: result.message
        });
      }

      case 'getAllData': {
        return NextResponse.json({
          success: true,
          data: tracker.getAllData()
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing focus hours request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request', details: (error as Error).message },
      { status: 500 }
    );
  }
}