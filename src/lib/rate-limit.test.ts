/**
 * @jest-environment node
 */
import { rateLimit, _resetRateLimit } from './rate-limit';

beforeEach(() => {
  _resetRateLimit();
});

describe('rateLimit', () => {
  it('allows up to max within the window', () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit('k', { windowMs: 60_000, max: 5 });
      expect(r.ok).toBe(true);
    }
    const sixth = rateLimit('k', { windowMs: 60_000, max: 5 });
    expect(sixth.ok).toBe(false);
    expect(sixth.retryAfterSec).toBeGreaterThan(0);
  });

  it('isolates buckets per key', () => {
    for (let i = 0; i < 5; i++) rateLimit('a', { windowMs: 60_000, max: 5 });
    expect(rateLimit('a', { windowMs: 60_000, max: 5 }).ok).toBe(false);
    expect(rateLimit('b', { windowMs: 60_000, max: 5 }).ok).toBe(true);
  });

  it('resets when window expires', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
    for (let i = 0; i < 5; i++) rateLimit('c', { windowMs: 60_000, max: 5 });
    expect(rateLimit('c', { windowMs: 60_000, max: 5 }).ok).toBe(false);

    jest.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    expect(rateLimit('c', { windowMs: 60_000, max: 5 }).ok).toBe(true);
    jest.useRealTimers();
  });

  it('reports decreasing remaining within the window', () => {
    const r1 = rateLimit('d', { windowMs: 60_000, max: 3 });
    const r2 = rateLimit('d', { windowMs: 60_000, max: 3 });
    const r3 = rateLimit('d', { windowMs: 60_000, max: 3 });
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });
});
