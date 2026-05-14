import bcrypt from 'bcryptjs';
import { getDb } from './db';

const BCRYPT_COST = 12;
const MAX_PASSWORD_LEN = 256;

export type UserRole = 'admin' | 'demo' | 'test' | 'user';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  createdAt: string;
}

interface PublicUserRow {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

interface UserWithHashRow extends PublicUserRow {
  password_hash: string;
}

function toUser(row: PublicUserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error('DATABASE_URL not configured — users API unavailable');
  return db;
}

// Non-auth lookups intentionally skip password_hash so callers cannot
// accidentally log or expose it. Only verifyPassword fetches it.

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = requireDb();
  const rows = (await db`SELECT id, email, role, display_name, created_at
                         FROM users WHERE email = ${email}`) as PublicUserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = requireDb();
  const rows = (await db`SELECT id, email, role, display_name, created_at
                         FROM users WHERE id = ${id}`) as PublicUserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserByRole(role: UserRole): Promise<User | null> {
  const db = requireDb();
  const rows = (await db`SELECT id, email, role, display_name, created_at
                         FROM users WHERE role = ${role} ORDER BY created_at ASC LIMIT 1`) as PublicUserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LEN) {
    return null;
  }
  const db = requireDb();
  const rows = (await db`SELECT id, email, password_hash, role, display_name, created_at
                         FROM users WHERE email = ${email}`) as UserWithHashRow[];
  if (rows.length === 0) return null;
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  return ok ? toUser(rows[0]) : null;
}

export async function setPassword(userId: string, password: string): Promise<void> {
  if (typeof password !== 'string' || password.length < 8 || password.length > MAX_PASSWORD_LEN) {
    throw new Error('Password must be between 8 and 256 chars');
  }
  const db = requireDb();
  const hash = await bcrypt.hash(password, BCRYPT_COST);
  // RETURNING + length check — silently succeeding for an unknown id would
  // let a password-reset flow report success while leaving the account
  // unchanged.
  const rows = (await db`UPDATE users SET password_hash = ${hash} WHERE id = ${userId} RETURNING id`) as Array<{ id: string }>;
  if (rows.length === 0) {
    throw new Error(`setPassword: no user with id ${userId}`);
  }
}

/**
 * Resolve the admin user's id. Used by PR 1 route handlers as a temporary
 * stand-in for a real session. Removed in PR 2.
 */
let cachedAdminId: string | null = null;
export async function getAdminUserId(): Promise<string> {
  if (cachedAdminId) return cachedAdminId;
  const admin = await getUserByRole('admin');
  if (!admin) throw new Error('No admin user seeded — run db:migrate first');
  cachedAdminId = admin.id;
  return cachedAdminId;
}
