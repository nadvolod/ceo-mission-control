import { isLocalDateKey, localDate, localDateInTz, localDateOr } from './dates';

describe('localDate', () => {
  it('formats the current Date as YYYY-MM-DD in the local TZ', () => {
    // Force a known local Date: 2026-05-27 at 23:30 local time.
    const d = new Date(2026, 4, 27, 23, 30, 0); // month is 0-indexed
    expect(localDate(d)).toBe('2026-05-27');
  });

  it('returns the LOCAL day even when UTC has already rolled to the next day', () => {
    // 9pm EST on 2026-05-27 (UTC would be 2026-05-28 01:00).
    // We construct the Date from the local representation so the TZ in
    // which Jest runs doesn't matter — both branches use the same Date.
    const d = new Date(2026, 4, 27, 21, 0, 0);
    // The point: localDate should match the YYYY-MM-DD seen on the user's
    // wall clock at construction time, NOT the UTC representation.
    expect(localDate(d)).toBe('2026-05-27');
    // Sanity: toISOString().split('T')[0] is the buggy pattern we're
    // replacing. We just assert localDate isn't doing that.
    const iso = d.toISOString().split('T')[0];
    expect(localDate(d)).not.toBe(iso === '2026-05-28' ? iso : '__never__');
  });
});

describe('localDateInTz', () => {
  it('formats a Date as YYYY-MM-DD in an arbitrary IANA timezone', () => {
    // 2026-05-28 02:30 UTC = 2026-05-27 22:30 EDT
    const utc = new Date(Date.UTC(2026, 4, 28, 2, 30, 0));
    expect(localDateInTz(utc, 'America/New_York')).toBe('2026-05-27');
    expect(localDateInTz(utc, 'UTC')).toBe('2026-05-28');
    expect(localDateInTz(utc, 'Asia/Tokyo')).toBe('2026-05-28');
  });
});

describe('isLocalDateKey', () => {
  it('accepts YYYY-MM-DD strings', () => {
    expect(isLocalDateKey('2026-05-27')).toBe(true);
    expect(isLocalDateKey('2024-12-31')).toBe(true);
  });
  it('rejects malformed strings + non-strings', () => {
    expect(isLocalDateKey('2026-5-27')).toBe(false);
    expect(isLocalDateKey('05-27-2026')).toBe(false);
    expect(isLocalDateKey('2026-05-27T00:00:00Z')).toBe(false);
    expect(isLocalDateKey('')).toBe(false);
    expect(isLocalDateKey(undefined)).toBe(false);
    expect(isLocalDateKey(123)).toBe(false);
    expect(isLocalDateKey(null)).toBe(false);
  });
});

describe('localDateOr', () => {
  it('returns the candidate when valid', () => {
    expect(localDateOr('2026-05-27')).toBe('2026-05-27');
  });
  it('falls back to localDate when invalid', () => {
    const today = localDate();
    expect(localDateOr('not-a-date')).toBe(today);
    expect(localDateOr(undefined)).toBe(today);
  });
});
