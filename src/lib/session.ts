import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, type SessionOptions } from 'iron-session';
import type { UserRole } from './users';

/**
 * Session shape:
 *  - admin sessions carry `adminId` and optionally an `impersonating` map
 *    populated by PR 3's handoff endpoint when the admin opens demo/test
 *    in a new tab. Plain users (role=user) carry `userId` + `role` instead.
 *  - Both shapes coexist so we never have to "log out" the admin to view as
 *    demo — URL prefix routing (PR 3) chooses which slot to read.
 */
export interface CmcSession {
  adminId?: string;
  impersonating?: {
    demo?: string;
    test?: string;
  };
  userId?: string;
  role?: UserRole;
}

const COOKIE_NAME = 'cmc_session';

function readPasswordEnv(): string {
  const v = process.env.IRON_SESSION_PASSWORD;
  if (!v) {
    throw new Error(
      'IRON_SESSION_PASSWORD is not set. Generate one with `openssl rand -base64 48` and add to .env.local + GitHub secrets.',
    );
  }
  if (v.length < 32) {
    throw new Error(`IRON_SESSION_PASSWORD is too short (${v.length} chars). Iron-session requires at least 32 bytes of entropy.`);
  }
  return v;
}

function sessionOptions(): SessionOptions {
  return {
    cookieName: COOKIE_NAME,
    password: readPasswordEnv(),
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // 14-day rolling session
      maxAge: 60 * 60 * 24 * 14,
    },
  };
}

/**
 * Reads the session from the current request cookie store. Use in Server
 * Components and route handlers. Returns the session object directly —
 * iron-session proxies mutations and you must call `.save()` to persist.
 */
export async function getSession() {
  const store = await cookies();
  return getIronSession<CmcSession>(store, sessionOptions());
}

/** Returns the session if the visitor is signed in, otherwise null. */
export async function getOptionalSession(): Promise<CmcSession | null> {
  const s = await getSession();
  if (!s.adminId && !s.userId) return null;
  return { adminId: s.adminId, impersonating: s.impersonating, userId: s.userId, role: s.role };
}

/**
 * For route handlers: returns a 401 NextResponse if the visitor is not
 * authenticated, otherwise returns the session. Used inside Route Handlers.
 */
export async function requireSession(): Promise<CmcSession | NextResponse> {
  const s = await getOptionalSession();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return s;
}

export async function requireAdmin(): Promise<CmcSession | NextResponse> {
  const s = await getOptionalSession();
  if (!s?.adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return s;
}

/**
 * Detects whether this request originated from an `/as/<role>/...` page.
 * Browsers preserve `Referer` on same-origin requests by default, so an
 * `/api/weekly-tracker` call fired from `/as/demo/dashboard` carries the
 * page path in `Referer`. That's what lets the existing API routes serve
 * demo data without the client adding any custom header.
 *
 * Reads both the request URL itself (covers SSR fetches inside `/as/...`
 * Server Components) and the Referer header (covers client-side fetches
 * to /api/*).
 */
function detectImpersonationRole(request?: NextRequest | Request): 'demo' | 'test' | null {
  if (!request) return null;
  const candidates: string[] = [];
  try {
    candidates.push(new URL((request as Request).url).pathname);
  } catch {
    // Some Request implementations don't expose an absolute URL; fall
    // back to Referer only.
  }
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      candidates.push(new URL(referer).pathname);
    } catch {
      // ignore malformed Referer
    }
  }
  for (const path of candidates) {
    const m = path.match(/^\/as\/(demo|test)(?:\/|$)/);
    if (m) return m[1] as 'demo' | 'test';
  }
  return null;
}

/**
 * Resolves which user's data this request should read/write.
 *
 * - Plain user session: their own id.
 * - Admin session, request from /as/<role>/...: the impersonated user id,
 *   but only if the session actually carries that slot. Without that
 *   check, anyone could craft a Referer to peek at someone else's data.
 *   Middleware also enforces this at the URL level.
 * - Otherwise: admin's id.
 *
 * Returns null when the request has no session — callers should treat
 * that as 401.
 */
export async function getEffectiveUserId(request?: NextRequest | Request): Promise<string | null> {
  const s = await getOptionalSession();
  if (!s) return null;

  if (s.adminId) {
    const role = detectImpersonationRole(request);
    if (role && s.impersonating?.[role]) {
      return s.impersonating[role]!;
    }
    return s.adminId;
  }
  if (s.userId) return s.userId;
  return null;
}

/**
 * Same as getEffectiveUserId but throws if no session. Use inside route
 * handlers that the middleware has already guarded — the middleware
 * guarantees a session reaches here, so reaching the throw means a bug.
 * Route handlers' existing try/catch surfaces it as a 500, which is the
 * right status: an authenticated-only route has no business returning
 * 401 unless its allowlist was misconfigured.
 */
export async function requireEffectiveUserId(request?: NextRequest | Request): Promise<string> {
  const id = await getEffectiveUserId(request);
  if (!id) {
    throw new Error(
      'No session reached an authenticated route — check middleware allowlist (src/middleware.ts)',
    );
  }
  return id;
}

/** Internal helper used by login/logout routes. */
export async function setAdminSession(adminId: string): Promise<void> {
  const s = await getSession();
  s.adminId = adminId;
  s.userId = undefined;
  s.role = undefined;
  s.impersonating = undefined;
  await s.save();
}

export async function setUserSession(userId: string, role: UserRole): Promise<void> {
  const s = await getSession();
  s.userId = userId;
  s.role = role;
  s.adminId = undefined;
  s.impersonating = undefined;
  await s.save();
}

export async function destroySession(): Promise<void> {
  const s = await getSession();
  s.destroy();
}

export { COOKIE_NAME };
