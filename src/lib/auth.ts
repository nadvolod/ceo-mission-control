import { NextRequest } from 'next/server';

/**
 * Check if a request is authenticated.
 *
 * Auth passes if ANY of these are true:
 * 1. SYNC_API_KEY is not configured (auth disabled, warning logged)
 * 2. Request provides the correct key via `x-sync-api-key` header or `Authorization: Bearer <key>`
 * 3. Request is from the same origin (browser dashboard making fetch calls)
 */
export function checkAuth(request: NextRequest): boolean {
  const apiKey = process.env.SYNC_API_KEY;
  if (!apiKey) {
    console.warn('SYNC_API_KEY not configured — write auth disabled');
    return true;
  }

  // Check API key in headers (for MCP server, CLI, external callers)
  const provided =
    request.headers.get('x-sync-api-key') ??
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (provided === apiKey) {
    return true;
  }

  // Allow same-origin requests (dashboard browser UI)
  const host = request.headers.get('host');
  if (host) {
    const origin = request.headers.get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost === host) return true;
      } catch { /* invalid URL, skip */ }
    }

    // Allow requests with referer from same host (non-CORS same-origin fetches)
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererHost = new URL(referer).host;
        if (refererHost === host) return true;
      } catch { /* invalid URL, skip */ }
    }
  }

  return false;
}
