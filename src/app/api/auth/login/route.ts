import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/users';
import { setAdminSession, setUserSession } from '@/lib/session';
import { rateLimit } from '@/lib/rate-limit';
import { appendAuditLog } from '@/lib/storage';

const MAX_PASSWORD_LEN = 256;
const LOGIN_RATE_LIMIT = { windowMs: 60_000, max: 5 };

function clientKey(request: NextRequest): string {
  // Prefer the platform-supplied IP header; fall back to a constant so the
  // limiter still works in dev/test where headers are absent. Never trust
  // X-Forwarded-For unless behind a proxy we control — Vercel sets these.
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`login:${clientKey(request)}`, LOGIN_RATE_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || email.length > 320 || !password || password.length > MAX_PASSWORD_LEN) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  const user = await verifyPassword(email, password);
  if (!user) {
    // Log the failure under no specific owner (we don't know who they
    // wanted to be). Keep the email out of the log to avoid PII leaks.
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  if (user.role === 'admin') {
    await setAdminSession(user.id);
  } else {
    await setUserSession(user.id, user.role);
  }

  await appendAuditLog(
    user.id,
    new Date().toISOString().slice(0, 10),
    'auth-login',
    `${user.role} login successful`,
  );

  return NextResponse.json({ ok: true, role: user.role });
}
