#!/usr/bin/env tsx
/**
 * Idempotent re-seed of admin/demo/test user passwords from env.
 *
 * Migration 0001 seeded users with a placeholder bcrypt hash whenever the
 * corresponding env var was unset at migration time. On a subsequent run
 * with `ON CONFLICT (email) DO NOTHING`, the placeholder stays — even if
 * the real env vars are now available. This script fixes that by always
 * computing a fresh hash from env and updating the row.
 *
 * Safe to run repeatedly. No-op when the env var is missing.
 */

import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

const BCRYPT_COST = 12;

async function reseedOne(sql: ReturnType<typeof neon>, email: string, envVar: string) {
  const raw = process.env[envVar];
  if (!raw || raw.length < 8) {
    console.log(`[reseed] ${envVar} unset or <8 chars — skipping ${email}`);
    return;
  }
  const hash = await bcrypt.hash(raw, BCRYPT_COST);
  const result = await sql`UPDATE users SET password_hash = ${hash} WHERE email = ${email} RETURNING id`;
  if (result.length === 0) {
    console.warn(`[reseed] ${email} not found — run db:migrate first`);
    return;
  }
  console.log(`[reseed] ok ${email}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const sql = neon(process.env.DATABASE_URL);

  await reseedOne(sql, 'nadvolod@gmail.com', 'ADMIN_INITIAL_PASSWORD');
  await reseedOne(sql, 'demo@ceo-mc.local', 'DEMO_USER_PASSWORD');
  await reseedOne(sql, 'test@ceo-mc.local', 'TEST_USER_PASSWORD');

  console.log('[reseed] done');
}

main().catch((err) => {
  console.error('[reseed] failed', err);
  process.exit(1);
});
