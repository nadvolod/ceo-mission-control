import { readdirSync, readFileSync, statSync } from 'fs';
import { join, sep } from 'path';

// Defense-in-depth meta-test for the "no fixtures in production code" rule.
//
// The fixtures module itself throws if loaded in NODE_ENV=production. That
// blocks a runtime leak but only AFTER the build already shipped. This test
// shifts the check left: it greps the source tree and fails CI if any non-
// test file imports `__FIXTURE_*` or the `__fixtures__` module. The grep is
// intentionally over the source — not the bundle — so we catch the import
// at PR review time, before it ever reaches a deploy.
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SRC = join(ROOT, 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.vercel') continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

function isTestPath(p: string): boolean {
  // jest test files, __tests__/, __fixtures__, storybook, e2e
  if (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) return true;
  if (p.endsWith('.spec.ts') || p.endsWith('.spec.tsx')) return true;
  if (p.includes(`${sep}__tests__${sep}`)) return true;
  if (p.includes(`${sep}__fixtures__${sep}`)) return true;
  if (p.includes(`${sep}.storybook${sep}`)) return true;
  return false;
}

describe('hard rule: no fixtures in production code', () => {
  const files = walk(SRC).filter((f) => !isTestPath(f));

  it('finds at least some production source files (sanity)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('%s does not import any __FIXTURE_* symbol', (file) => {
    const text = readFileSync(file, 'utf8');
    expect(text).not.toMatch(/\b__FIXTURE_[A-Z_]+\b/);
  });

  it.each(files)('%s does not import the __fixtures__ module', (file) => {
    const text = readFileSync(file, 'utf8');
    // import ... from '...__fixtures__'  /  '...__fixtures__/...'
    expect(text).not.toMatch(/from\s+['"][^'"]*__fixtures__(?:\/[^'"]*)?['"]/);
    // dynamic import
    expect(text).not.toMatch(/import\(\s*['"][^'"]*__fixtures__(?:\/[^'"]*)?['"]\s*\)/);
    // require()
    expect(text).not.toMatch(/require\(\s*['"][^'"]*__fixtures__(?:\/[^'"]*)?['"]\s*\)/);
  });
});
