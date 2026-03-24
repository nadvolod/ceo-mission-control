import { NextRequest, NextResponse } from 'next/server';
import { loadJSON, saveJSON, loadText, saveText, appendAuditLog } from '@/lib/storage';

interface TemporalSession {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  description: string;
  date: string;
}

interface TemporalData {
  sessions: TemporalSession[];
  dailyTotals: Record<string, number>;
}

async function loadTemporalData(): Promise<TemporalData> {
  return await loadJSON('temporal-tracking.json', {
    sessions: [],
    dailyTotals: {}
  });
}

async function saveTemporalData(data: TemporalData): Promise<void> {
  await saveJSON('temporal-tracking.json', data);
}

async function updateDailyScorecard(date: string, newTotal: number): Promise<void> {
  try {
    let content = await loadText('DAILY_SCORECARD.md', '');

    // Update the "Actual:" line in the temporal hours section
    const actualRegex = /(-[ \t]*Actual:[ \t]*)([\d.]*)/;
    const match = content.match(actualRegex);

    if (match) {
      content = content.replace(actualRegex, `- Actual: ${newTotal}`);
    } else {
      // If no "Actual:" line exists, add it after "Target today:"
      const targetRegex = /(-[ \t]*Target today:[ \t]*[\d.]+)/;
      const targetMatch = content.match(targetRegex);
      if (targetMatch) {
        content = content.replace(targetMatch[0], `${targetMatch[0]}\n- Actual: ${newTotal}`);
      }
    }

    await saveText('DAILY_SCORECARD.md', content);
  } catch (error) {
    console.error('Error updating daily scorecard:', error);
  }
}

export async function GET() {
  try {
    const data = await loadTemporalData();

    return NextResponse.json({
      success: true,
      sessions: data.sessions,
      dailyTotals: data.dailyTotals
    });
  } catch (error) {
    console.error('Error loading temporal data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load temporal data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, hours, description } = body;

    if (action === 'addSession') {
      if (typeof hours !== 'number' || !isFinite(hours) || hours <= 0 || hours > 24) {
        return NextResponse.json(
          { success: false, error: 'Hours must be a number between 0 and 24' },
          { status: 400 }
        );
      }

      const data = await loadTemporalData();
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Create new session
      const session: TemporalSession = {
        id: `temporal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        startTime: new Date(now.getTime() - (hours * 60 * 60 * 1000)).toISOString(),
        endTime: now.toISOString(),
        duration: hours,
        description: description || `${hours}h Temporal block completed`,
        date: today
      };

      // Add session to data
      data.sessions.push(session);

      // Update daily total
      const currentTotal = data.dailyTotals[today] || 0;
      const newTotal = currentTotal + hours;
      data.dailyTotals[today] = newTotal;

      // Save temporal data
      await saveTemporalData(data);

      // Update daily scorecard
      await updateDailyScorecard(today, newTotal);

      // Also log to memory file
      try {
        const timestamp = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/New_York'
        });

        const logEntry = `\n## Temporal Session Completed (${timestamp})\n- **Duration**: ${session.duration} hours\n- **Description**: ${session.description}\n- **Daily total**: ${newTotal} hours\n\n`;

        await appendAuditLog(today, 'temporal', logEntry);
      } catch (error) {
        console.error('Error updating memory file:', error);
      }

      return NextResponse.json({
        success: true,
        session,
        newTotal,
        dailyTotal: newTotal
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing temporal request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}