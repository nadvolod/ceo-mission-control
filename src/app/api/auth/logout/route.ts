import { NextResponse } from 'next/server';
import { getOptionalSession, destroySession } from '@/lib/session';
import { appendAuditLog } from '@/lib/storage';

export async function POST() {
  const session = await getOptionalSession();
  const userId = session?.adminId ?? session?.userId ?? null;
  await destroySession();

  if (userId) {
    await appendAuditLog(
      userId,
      new Date().toISOString().slice(0, 10),
      'auth-logout',
      'logout',
    );
  }

  return NextResponse.json({ ok: true });
}
