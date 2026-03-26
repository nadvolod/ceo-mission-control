import { NextRequest, NextResponse } from 'next/server';
import { saveJSON, saveText } from '@/lib/storage';
import { checkAuth } from '@/lib/auth';

/**
 * Sync endpoint - accepts workspace data and persists it to the database.
 * Used to push local workspace changes to Neon DB for the Vercel deployment.
 *
 * POST /api/sync
 * Body: { files: { [filename]: content }, json: { [filename]: data } }
 */
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { files, json } = body;

    const results: string[] = [];

    // Sync text files (INITIATIVES.md, DAILY_SCORECARD.md, etc.)
    if (files && typeof files === 'object') {
      for (const [filename, content] of Object.entries(files)) {
        if (typeof content === 'string') {
          await saveText(filename, content);
          results.push(`text: ${filename}`);
          console.log(`Synced text file: ${filename}`);
        }
      }
    }

    // Sync JSON data (tasks.json, focus-tracking.json, etc.)
    if (json && typeof json === 'object') {
      for (const [filename, data] of Object.entries(json)) {
        await saveJSON(filename, data);
        results.push(`json: ${filename}`);
        console.log(`Synced JSON data: ${filename}`);
      }
    }

    return NextResponse.json({
      success: true,
      synced: results,
      message: `Synced ${results.length} item(s)`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync data' },
      { status: 500 }
    );
  }
}
