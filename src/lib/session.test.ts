/**
 * @jest-environment node
 */

// We mock iron-session at the boundary: getIronSession returns whatever the
// test seeded. This lets us exercise every branch of getEffectiveUserId /
// requireEffectiveUserId / requireAdmin without spinning up Next's cookie
// store.

const sessionState: { current: any } = { current: {} };

jest.mock('iron-session', () => ({
  getIronSession: jest.fn(async () => sessionState.current),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({})),
}));

// IRON_SESSION_PASSWORD must be present at import time
process.env.IRON_SESSION_PASSWORD = '0'.repeat(48);

import {
  getEffectiveUserId,
  requireEffectiveUserId,
  getOptionalSession,
} from './session';

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const DEMO_ID = '33333333-3333-3333-3333-333333333333';

function setSession(state: Record<string, unknown>): void {
  sessionState.current = state;
}

beforeEach(() => {
  setSession({});
});

describe('session helpers', () => {
  describe('getOptionalSession', () => {
    it('returns null when no admin or user id is set', async () => {
      expect(await getOptionalSession()).toBeNull();
    });
    it('returns a snapshot for admin session', async () => {
      setSession({ adminId: ADMIN_ID });
      const s = await getOptionalSession();
      expect(s?.adminId).toBe(ADMIN_ID);
      expect(s?.userId).toBeUndefined();
    });
    it('returns a snapshot for plain user session', async () => {
      setSession({ userId: USER_ID, role: 'user' });
      const s = await getOptionalSession();
      expect(s?.userId).toBe(USER_ID);
      expect(s?.role).toBe('user');
    });
  });

  describe('getEffectiveUserId', () => {
    it('returns null when no session', async () => {
      expect(await getEffectiveUserId()).toBeNull();
    });
    it('returns adminId for an admin session with no impersonation', async () => {
      setSession({ adminId: ADMIN_ID });
      expect(await getEffectiveUserId()).toBe(ADMIN_ID);
    });
    it('returns adminId even when impersonating slots are populated (PR 3 honors URL)', async () => {
      setSession({ adminId: ADMIN_ID, impersonating: { demo: DEMO_ID } });
      // In PR 2 there is no URL-prefix awareness — admin sees admin data.
      // PR 3 will extend this to return DEMO_ID when the URL contains /as/demo.
      expect(await getEffectiveUserId()).toBe(ADMIN_ID);
    });
    it('returns userId for a plain user session', async () => {
      setSession({ userId: USER_ID, role: 'user' });
      expect(await getEffectiveUserId()).toBe(USER_ID);
    });
    it('prefers adminId over userId when both are set (defensive — should not happen)', async () => {
      setSession({ adminId: ADMIN_ID, userId: USER_ID });
      expect(await getEffectiveUserId()).toBe(ADMIN_ID);
    });
  });

  describe('requireEffectiveUserId', () => {
    it('returns a string when a session exists', async () => {
      setSession({ adminId: ADMIN_ID });
      const id = await requireEffectiveUserId();
      expect(id).toBe(ADMIN_ID);
    });
    it('throws when no session — middleware should have already 401d', async () => {
      await expect(requireEffectiveUserId()).rejects.toThrow(/middleware allowlist/);
    });
  });
});

describe('IRON_SESSION_PASSWORD validation', () => {
  it('rejects an unset password at session construction time', async () => {
    const original = process.env.IRON_SESSION_PASSWORD;
    delete process.env.IRON_SESSION_PASSWORD;
    jest.resetModules();
    // Re-require so the password is re-read on the new module instance
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sessionModule = require('./session');
    setSession({});
    await expect(sessionModule.getSession()).rejects.toThrow(/IRON_SESSION_PASSWORD is not set/);
    process.env.IRON_SESSION_PASSWORD = original;
  });
  it('rejects a too-short password (less than 32 chars)', async () => {
    const original = process.env.IRON_SESSION_PASSWORD;
    process.env.IRON_SESSION_PASSWORD = 'tiny';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sessionModule = require('./session');
    setSession({});
    await expect(sessionModule.getSession()).rejects.toThrow(/at least 32 bytes/);
    process.env.IRON_SESSION_PASSWORD = original;
  });
});
