// Shared local-date helpers. Used by the v2 dashboard, the log endpoints,
// and any other place we need a YYYY-MM-DD that matches the *user's* day
// rather than UTC's day.
//
// Why this file exists: `new Date().toISOString().split('T')[0]` looks
// obvious but it returns the UTC date. At 9pm America/New_York that's
// already tomorrow in UTC, so anything logged in the evening landed on
// the wrong day. The fix is to either (a) pass the user's local YYYY-MM-DD
// from the client, or (b) format the date in the user's IANA timezone
// server-side. This module covers both.

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a Date as YYYY-MM-DD in the *local* time zone of the runtime
 * that calls it. On the client that's the user's wall-clock day. Use this
 * everywhere we'd otherwise reach for `.toISOString().split('T')[0]` —
 * that pattern is UTC and is a source of timezone bugs.
 */
export function localDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date as YYYY-MM-DD in a specific IANA timezone. Used on the
 * server when we have a `tz` hint from the client (or a user-preference
 * fallback) but no pre-formatted date string.
 */
export function localDateInTz(d: Date, tz: string): string {
  // Intl.DateTimeFormat with the `en-CA` locale produces ISO-style
  // year-month-day so we can join the parts in known order.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error(`localDateInTz: unable to format ${d.toISOString()} in tz=${tz}`);
  }
  return `${year}-${month}-${day}`;
}

/**
 * Validate a YYYY-MM-DD string. Defensive guard for any code path that
 * accepts a date string from a request body or query param.
 */
export function isLocalDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

/**
 * Return `candidate` if it's a valid YYYY-MM-DD key, otherwise fall back
 * to localDate() in the runtime's local zone. Used by server endpoints
 * that prefer a client-provided date but tolerate its absence.
 */
export function localDateOr(candidate: unknown): string {
  return isLocalDateKey(candidate) ? candidate : localDate();
}
