/**
 * In-memory token-bucket rate limiter, keyed by a string (typically IP).
 * Suitable for a single-instance app like this one. For multi-instance
 * deployments, swap with a Redis-backed implementation.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
// Opportunistic cleanup so a stream of unique keys (e.g. ever-changing
// client IPs) can't grow the map unboundedly across the process lifetime.
const MAX_BUCKETS = 10_000;

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

function pruneExpired(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, retryAfterSec: 0 };
  }
  if (existing.count >= opts.max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.max - existing.count, retryAfterSec: 0 };
}

/** Test/QA-only — never use in production code paths. */
export function _resetRateLimit(): void {
  buckets.clear();
}
