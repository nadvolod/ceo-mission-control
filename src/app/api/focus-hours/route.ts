import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { FocusTracker } from '@/lib/focus-tracker';
import type { FocusCategory, FocusSession } from '@/lib/types';

const WORKSPACE_PATH = process.env.NODE_ENV === 'development'
  ? '/Users/nikolay/.openclaw/workspace'
  : '/app/workspace';

const VALID_CATEGORIES: FocusCategory[] = [
  'Temporal', 'Finance', 'Revenue', 'Housing',
  'Tax', 'Personal', 'Health', 'Admin', 'Learning', 'Other'
];

function logToMemory(session: FocusSession): void {
  try {
    const memoryPath = join(WORKSPACE_PATH, `memory/${session.date}.md`);
    mkdirSync(dirname(memoryPath), { recursive: true });
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York'
    });

    const logEntry = `\n## Focus Session Logged (${timestamp})\n- **Category**: ${session.category}\n- **Duration**: ${session.hours} hours\n- **Description**: ${session.description}\n- **Source**: ${session.source}\n\n`;

    try {
      const existingContent = readFileSync(memoryPath, 'utf8');
      writeFileSync(memoryPath, existingContent + logEntry);
    } catch {
      const newContent = `# Daily Memory - ${session.date}\n\n## Focus Hours\n${logEntry}`;
      writeFileSync(memoryPath, newContent);
    }
  } catch (error) {
    console.error('Error updating memory file:', error);
  }
}

export async function GET() {
  try {
    const tracker = new FocusTracker();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      todaysMetrics: tracker.getTodaysMetrics(),
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
  try {
    const body = await request.json();
    const { action, ...data } = body;
    const tracker = new FocusTracker();

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

        const session = tracker.addSession(
          category || 'Other',
          hours,
          description || `${hours}h focus block`,
          date,
          'manual'
        );

        logToMemory(session);

        console.log('Focus session added via API:', { category: session.category, hours, date: session.date });

        return NextResponse.json({
          success: true,
          session,
          todaysMetrics: tracker.getTodaysMetrics()
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

        const result = tracker.processConversationalUpdate(message);

        for (const session of result.added) {
          logToMemory(session);
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
