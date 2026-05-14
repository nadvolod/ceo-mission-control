import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, type SessionOptions } from 'iron-session';
import type { CmcSession } from '@/lib/session';

const COOKIE_NAME = 'cmc_session';

// Routes that are reachable without auth. Default-deny: anything not in
// this list and not a static asset requires a session. Adding a new
// public route must be a deliberate edit visible in the PR diff.
const PUBLIC_PATHS = ['/login', '/'];
const PUBLIC_PREFIXES = [
  '/api/auth/',           // login + logout
  '/api/waitlist',        // public form
  '/_next/',              // framework
  '/favicon',
  '/images/',
  '/static/',
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

function sessionOpts(): SessionOptions {
  return {
    cookieName: COOKIE_NAME,
    password: process.env.IRON_SESSION_PASSWORD || '',
    cookieOptions: { httpOnly: true, sameSite: 'lax', path: '/' },
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Read session via iron-session. We hand it a writable response so the
  // cookie can refresh; this matches Next's recommended pattern.
  const response = NextResponse.next();
  const session = await getIronSession<CmcSession>(request, response, sessionOpts());
  const authenticated = !!(session.adminId || session.userId);

  if (!authenticated) {
    // For API requests, respond 401 — the dashboard's fetch() callers
    // can show a "session expired" toast and redirect themselves.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/dashboard') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Match everything except static assets that Next serves before middleware.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
