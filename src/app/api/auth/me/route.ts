import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/session';

export async function GET() {
  const s = await getOptionalSession();
  if (!s) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  return NextResponse.json({
    authenticated: true,
    role: s.adminId ? 'admin' : (s.role ?? 'user'),
    canImpersonate: !!s.adminId,
  });
}
