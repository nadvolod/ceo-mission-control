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

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

function toUser(row: UserRow): User {
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

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = requireDb();
  const rows = (await db`SELECT id, email, password_hash, role, display_name, created_at
                         FROM users WHERE email = ${email}`) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = requireDb();
  const rows = (await db`SELECT id, email, password_hash, role, display_name, created_at
                         FROM users WHERE id = ${id}`) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserByRole(role: UserRole): Promise<User | null> {
  const db = requireDb();
  const rows = (await db`SELECT id, email, password_hash, role, display_name, created_at
                         FROM users WHERE role = ${role} ORDER BY created_at ASC LIMIT 1`) as UserRow[];
  return rows[0] ? toUser(rows[0]) : null;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LEN) {
    return null;
  }
  const db = requireDb();
  const rows = (await db`SELECT id, email, password_hash, role, display_name, created_at
                         FROM users WHERE email = ${email}`) as UserRow[];
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
  await db`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
}
