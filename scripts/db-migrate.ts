#!/usr/bin/env tsx
import { runMigrations } from '../src/lib/migrations';

async function main() {
  console.log('[db-migrate] starting');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(2);
  }
  const { applied, skipped } = await runMigrations();
  console.log(`[db-migrate] applied=${applied.length} skipped=${skipped.length}`);
  if (applied.length > 0) console.log('  applied:', applied.join(', '));
  if (skipped.length > 0) console.log('  skipped:', skipped.join(', '));
  console.log('[db-migrate] done');
}

main().catch((err) => {
  console.error('[db-migrate] FAILED', err);
  process.exit(1);
});
