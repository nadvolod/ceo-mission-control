import { checkAuth } from './auth';

// Mock NextRequest since it requires the full Next.js server runtime
function makeRequest(headers: Record<string, string> = {}): any {
  const headerMap = new Map(Object.entries(headers));
  return {
    headers: {
      get: (name: string) => headerMap.get(name) ?? null,
    },
  };
}

describe('checkAuth', () => {
  const originalEnv = process.env.SYNC_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SYNC_API_KEY = originalEnv;
    } else {
      delete process.env.SYNC_API_KEY;
    }
  });

  it('returns true when SYNC_API_KEY is not configured', () => {
    delete process.env.SYNC_API_KEY;
    expect(checkAuth(makeRequest())).toBe(true);
  });

  it('returns true when correct key via x-sync-api-key', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({ 'x-sync-api-key': 'test-secret' }))).toBe(true);
  });

  it('returns true when correct key via Authorization Bearer', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({ 'authorization': 'Bearer test-secret' }))).toBe(true);
  });

  it('returns false when wrong key provided', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({ 'x-sync-api-key': 'wrong-key' }))).toBe(false);
  });

  it('returns false when no key and SYNC_API_KEY is set', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest())).toBe(false);
  });

  it('allows same-origin (origin matches host)', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({
      'origin': 'http://localhost:3000',
      'host': 'localhost:3000',
    }))).toBe(true);
  });

  it('allows same-origin (referer matches host)', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({
      'referer': 'http://localhost:3000/dashboard',
      'host': 'localhost:3000',
    }))).toBe(true);
  });

  it('rejects cross-origin without key', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({
      'origin': 'http://evil.com',
      'host': 'localhost:3000',
    }))).toBe(false);
  });

  it('rejects substring bypass attack on origin', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    // Attacker crafts origin containing the host as substring
    expect(checkAuth(makeRequest({
      'origin': 'http://evil-localhost:3000.attacker.com',
      'host': 'localhost:3000',
    }))).toBe(false);
  });

  it('rejects substring bypass attack on referer', () => {
    process.env.SYNC_API_KEY = 'test-secret';
    expect(checkAuth(makeRequest({
      'referer': 'http://evil.com/fake?redirect=http://localhost:3000',
      'host': 'localhost:3000',
    }))).toBe(false);
  });
});
