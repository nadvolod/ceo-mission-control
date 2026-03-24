import { NextRequest, NextResponse } from 'next/server';
import { loadJSON, saveJSON } from '@/lib/storage';

interface WaitlistEntry {
  id: string;
  email: string;
  name: string;
  title: string;
  company: string;
  employeeCount: string;
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, title, company, employeeCount } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const entries = await loadJSON<WaitlistEntry[]>('waitlist-entries.json', []);

    if (entries.some(e => e.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ error: 'Already on the waitlist' }, { status: 409 });
    }

    const entry: WaitlistEntry = {
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      title: title?.trim() || '',
      company: company?.trim() || '',
      employeeCount: employeeCount || '',
      createdAt: new Date().toISOString(),
    };

    entries.push(entry);
    await saveJSON('waitlist-entries.json', entries);

    console.log(`[Waitlist] New signup: ${entry.email} (${entry.company || 'no company'})`);

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist',
      position: entries.length,
    });
  } catch (error) {
    console.error('[Waitlist] Error:', error);
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const entries = await loadJSON<WaitlistEntry[]>('waitlist-entries.json', []);
    return NextResponse.json({ count: entries.length });
  } catch (error) {
    console.error('[Waitlist] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 });
  }
}
