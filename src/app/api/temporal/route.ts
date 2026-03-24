import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const WORKSPACE_PATH = process.env.NODE_ENV === 'development' 
  ? '/Users/nikolay/.openclaw/workspace'
  : '/app/workspace';

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

function loadTemporalData(): TemporalData {
  try {
    const filePath = join(WORKSPACE_PATH, 'temporal-tracking.json');
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    // Initialize with empty data if file doesn't exist
    return {
      sessions: [],
      dailyTotals: {}
    };
  }
}

function saveTemporalData(data: TemporalData): void {
  const filePath = join(WORKSPACE_PATH, 'temporal-tracking.json');
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function updateDailyScorecard(date: string, newTotal: number): void {
  try {
    const scorecardPath = join(WORKSPACE_PATH, 'DAILY_SCORECARD.md');
    let content = readFileSync(scorecardPath, 'utf8');
    
    // Update the "Actual:" line in the temporal hours section
    const actualRegex = /(-\s*Actual:\s*)([\d\.]*)/;
    const match = content.match(actualRegex);
    
    if (match) {
      const updatedLine = `${match[1]}${newTotal}`;
      content = content.replace(actualRegex, updatedLine);
    } else {
      // If no "Actual:" line exists, add it after "Target today:"
      const targetRegex = /(-\s*Target today:\s*[\d\.]+)/;
      const targetMatch = content.match(targetRegex);
      if (targetMatch) {
        const insertAfter = targetMatch[0];
        content = content.replace(insertAfter, `${insertAfter}\n- Actual: ${newTotal}`);
      }
    }
    
    writeFileSync(scorecardPath, content);
  } catch (error) {
    console.error('Error updating daily scorecard:', error);
  }
}

export async function GET() {
  try {
    const data = loadTemporalData();
    
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

      const data = loadTemporalData();
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
      saveTemporalData(data);
      
      // Update daily scorecard
      updateDailyScorecard(today, newTotal);
      
      // Also log to memory file
      try {
        const memoryPath = join(WORKSPACE_PATH, `memory/${today}.md`);
        mkdirSync(dirname(memoryPath), { recursive: true });
        const timestamp = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/New_York'
        });

        const logEntry = `\n## Temporal Session Completed (${timestamp})\n- **Duration**: ${session.duration} hours\n- **Description**: ${session.description}\n- **Daily total**: ${newTotal} hours\n\n`;

        try {
          const existingContent = readFileSync(memoryPath, 'utf8');
          writeFileSync(memoryPath, existingContent + logEntry);
        } catch {
          // Create new memory file if it doesn't exist
          const newContent = `# Daily Memory - ${today}\n\n## Temporal Execution\n${logEntry}`;
          writeFileSync(memoryPath, newContent);
        }
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