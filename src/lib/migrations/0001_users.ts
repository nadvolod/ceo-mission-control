import bcrypt from 'bcryptjs';
import type { Migration } from './types';

const BCRYPT_COST = 12;
const PLACEHOLDER_PASSWORD_HASH = bcrypt.hashSync('CHANGE_ME_IMMEDIATELY_' + Math.random().toString(36), BCRYPT_COST);

function readPasswordEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 8) {
    return ''; // signal to use placeholder
  }
  return v;
}

async function hashPassword(envVar: string): Promise<string> {
  const raw = readPasswordEnv(envVar);
  if (!raw) {
    console.warn(`[migration 0001] ${envVar} is unset or <8 chars — seeding placeholder hash; set it and re-seed via 0005.`);
    return PLACEHOLDER_PASSWORD_HASH;
  }
  return bcrypt.hash(raw, BCRYPT_COST);
}

export const migration: Migration = {
  version: '0001_users',
  description: 'Create users table and seed admin/demo/test users',
  async up(sql) {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','demo','test','user')),
      display_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    const adminHash = await hashPassword('ADMIN_INITIAL_PASSWORD');
    const demoHash = await hashPassword('DEMO_USER_PASSWORD');
    const testHash = await hashPassword('TEST_USER_PASSWORD');

    await sql`INSERT INTO users (email, password_hash, role, display_name)
              VALUES (${'nadvolod@gmail.com'}, ${adminHash}, ${'admin'}, ${'Nikolay (admin)'})
              ON CONFLICT (email) DO NOTHING`;
    await sql`INSERT INTO users (email, password_hash, role, display_name)
              VALUES (${'demo@ceo-mc.local'}, ${demoHash}, ${'demo'}, ${'Demo User'})
              ON CONFLICT (email) DO NOTHING`;
    await sql`INSERT INTO users (email, password_hash, role, display_name)
              VALUES (${'test@ceo-mc.local'}, ${testHash}, ${'test'}, ${'Test User'})
              ON CONFLICT (email) DO NOTHING`;
  },
};
