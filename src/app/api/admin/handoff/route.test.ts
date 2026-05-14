/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const sessionState: { current: any } = { current: {} };

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(async () => sessionState.current),
}));

jest.mock('@/lib/users', () => ({
  getUserByRole: jest.fn(async (role: string) => {
    if (role === 'demo') return { id: 'demo-id', email: 'demo@x', role: 'demo' };
    if (role === 'test') return { id: 'test-id', email: 'test@x', role: 'test' };
    return null;
  }),
}));

jest.mock('@/lib/storage', () => ({
  appendAuditLog: jest.fn(async () => {}),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('@/lib/storage');

import { POST } from './route';

function setSession(state: Record<string, unknown>): void {
  sessionState.current = { ...state, save: jest.fn(async () => {}) };
}

function req(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const merged = { 'Content-Type': 'application/json', host: 'localhost', origin: 'http://localhost', ...headers };
  return new NextRequest('http://localhost/api/admin/handoff', {
    method: 'POST',
    headers: merged,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  setSession({});
  jest.clearAllMocks();
});

describe('POST /api/admin/handoff', () => {
  it('rejects cross-origin POSTs (CSRF guard)', async () => {
    setSession({ adminId: 'admin-id' });
    const res = await POST(req({ as: 'demo' }, { origin: 'http://attacker.example' }));
    expect(res.status).toBe(403);
  });

  it('rejects when no Origin or Referer is present', async () => {
    setSession({ adminId: 'admin-id' });
    const r = new NextRequest('http://localhost/api/admin/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', host: 'localhost' },
      body: JSON.stringify({ as: 'demo' }),
    });
    const res = await POST(r);
    expect(res.status).toBe(403);
  });

  it('rejects when the session is not admin', async () => {
    setSession({ userId: 'plain-user' });
    const res = await POST(req({ as: 'demo' }));
    expect(res.status).toBe(403);
  });

  it('rejects when as is missing or invalid', async () => {
    setSession({ adminId: 'admin-id' });
    expect((await POST(req({ as: 'admin' }))).status).toBe(400);
    expect((await POST(req({}))).status).toBe(400);
  });

  it('opens demo: writes impersonating.demo, audits, returns the URL', async () => {
    const save = jest.fn(async () => {});
    setSession({ adminId: 'admin-id' });
    sessionState.current.save = save;
    const res = await POST(req({ as: 'demo' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.url).toBe('/as/demo/dashboard');
    expect(sessionState.current.impersonating).toEqual({ demo: 'demo-id' });
    expect(save).toHaveBeenCalled();
    expect(storage.appendAuditLog).toHaveBeenCalled();
  });

  it('opens test: writes impersonating.test', async () => {
    setSession({ adminId: 'admin-id' });
    const res = await POST(req({ as: 'test' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('/as/test/dashboard');
    expect(sessionState.current.impersonating).toEqual({ test: 'test-id' });
  });

  it('preserves an existing impersonating slot when opening another', async () => {
    setSession({ adminId: 'admin-id', impersonating: { demo: 'demo-id' } });
    const res = await POST(req({ as: 'test' }));
    expect(res.status).toBe(200);
    expect(sessionState.current.impersonating).toEqual({ demo: 'demo-id', test: 'test-id' });
  });

  it('503s when the target role has not been seeded', async () => {
    setSession({ adminId: 'admin-id' });
    const users = jest.requireMock('@/lib/users');
    users.getUserByRole.mockResolvedValueOnce(null);
    const res = await POST(req({ as: 'demo' }));
    expect(res.status).toBe(503);
  });
});
