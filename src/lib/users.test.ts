/**
 * @jest-environment node
 */
import bcrypt from 'bcryptjs';

jest.mock('./db', () => {
  let usersRows: any[] = [];
  const tagged = (strings: TemplateStringsArray, ...values: any[]) => {
    const tpl = strings.join('|');
    if (tpl.includes('SELECT id, email, password_hash, role, display_name, created_at')) {
      if (tpl.includes('email = ')) {
        const email = values[0] as string;
        return Promise.resolve(usersRows.filter((u) => u.email === email));
      }
      if (tpl.includes('id = ')) {
        const id = values[0] as string;
        return Promise.resolve(usersRows.filter((u) => u.id === id));
      }
      if (tpl.includes('role = ')) {
        const role = values[0] as string;
        return Promise.resolve(usersRows.filter((u) => u.role === role));
      }
    }
    if (tpl.includes('UPDATE users SET password_hash')) {
      const [hash, userId] = values as [string, string];
      const u = usersRows.find((u) => u.id === userId);
      if (u) u.password_hash = hash;
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };
  return {
    getDb: () => tagged,
    __seed: (rows: any[]) => { usersRows = rows; },
    __all: () => usersRows,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dbMock = require('./db');

import {
  getUserByEmail,
  getUserById,
  getUserByRole,
  verifyPassword,
  setPassword,
} from './users';

const FAKE_UUID = '11111111-1111-1111-1111-111111111111';
const ADMIN_HASH = bcrypt.hashSync('correct-password', 4);

beforeEach(() => {
  dbMock.__seed([
    {
      id: FAKE_UUID,
      email: 'admin@example.com',
      password_hash: ADMIN_HASH,
      role: 'admin',
      display_name: 'Admin',
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
});

describe('users', () => {
  describe('getUserByEmail', () => {
    it('returns the matching user', async () => {
      const u = await getUserByEmail('admin@example.com');
      expect(u?.id).toBe(FAKE_UUID);
      expect(u?.role).toBe('admin');
    });
    it('returns null for unknown email', async () => {
      expect(await getUserByEmail('nope@example.com')).toBeNull();
    });
  });

  describe('getUserById / getUserByRole', () => {
    it('round-trip by id', async () => {
      const u = await getUserById(FAKE_UUID);
      expect(u?.email).toBe('admin@example.com');
    });
    it('looks up by role', async () => {
      const u = await getUserByRole('admin');
      expect(u?.email).toBe('admin@example.com');
    });
    it('returns null when role is missing', async () => {
      expect(await getUserByRole('demo')).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('returns user on correct password', async () => {
      const u = await verifyPassword('admin@example.com', 'correct-password');
      expect(u?.id).toBe(FAKE_UUID);
    });
    it('returns null on wrong password', async () => {
      expect(await verifyPassword('admin@example.com', 'nope')).toBeNull();
    });
    it('returns null on unknown email (no info leak)', async () => {
      expect(await verifyPassword('nope@example.com', 'whatever')).toBeNull();
    });
    it('rejects empty password', async () => {
      expect(await verifyPassword('admin@example.com', '')).toBeNull();
    });
    it('rejects oversize password (DoS guard)', async () => {
      expect(await verifyPassword('admin@example.com', 'x'.repeat(300))).toBeNull();
    });
  });

  describe('setPassword', () => {
    it('rejects short password', async () => {
      await expect(setPassword(FAKE_UUID, 'short')).rejects.toThrow(/between 8 and 256/);
    });
    it('rejects oversize password', async () => {
      await expect(setPassword(FAKE_UUID, 'x'.repeat(300))).rejects.toThrow(/between 8 and 256/);
    });
    it('updates the row when input is valid', async () => {
      await setPassword(FAKE_UUID, 'new-strong-password');
      const u = dbMock.__all()[0];
      // hash should have changed
      expect(u.password_hash).not.toBe(ADMIN_HASH);
      // and the new hash should validate the new password
      expect(bcrypt.compareSync('new-strong-password', u.password_hash)).toBe(true);
    });
  });
});
