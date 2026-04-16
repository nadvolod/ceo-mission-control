import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

const IS_VERCEL = process.env.VERCEL === '1';

export const WORKSPACE_PATH = IS_VERCEL
  ? '/tmp/workspace'
  : (process.env.WORKSPACE_PATH || join(process.cwd(), 'data', 'workspace'));

const SEED_FILES = ['INITIATIVES.md', 'DAILY_SCORECARD.md'];

let seeded = false;

/**
 * On Vercel, seeds /tmp/workspace from bundled default files.
 * Locally, this is a no-op.
 */
export function ensureWorkspaceReady(): void {
  if (!IS_VERCEL) return;
  if (seeded && existsSync(WORKSPACE_PATH)) return;

  if (!existsSync(WORKSPACE_PATH)) {
    mkdirSync(WORKSPACE_PATH, { recursive: true });
  }

  // Seed from bundled defaults
  const defaultsDir = join(process.cwd(), 'data', 'defaults');
  for (const file of SEED_FILES) {
    const src = join(defaultsDir, file);
    const dest = join(WORKSPACE_PATH, file);
    if (existsSync(src) && !existsSync(dest)) {
      try {
        copyFileSync(src, dest);
        console.log(`Seeded workspace file: ${file}`);
      } catch (error) {
        console.error(`Failed to seed ${file}:`, error);
      }
    }
  }

  // Ensure memory directory exists
  const memoryDir = join(WORKSPACE_PATH, 'memory');
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  seeded = true;
}
