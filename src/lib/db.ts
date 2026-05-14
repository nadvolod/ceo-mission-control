import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> | null {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

/**
 * Schema readiness is now managed by versioned migrations.
 * Run `npm run db:migrate` (or `tsx scripts/db-migrate.ts`) before starting the app.
 * This shim remains for compatibility with any caller that still invokes it.
 */
export async function ensureDbReady(): Promise<void> {
  return;
}
