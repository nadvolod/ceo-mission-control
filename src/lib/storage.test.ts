/**
 * @jest-environment node
 */

import { appendAuditLog, saveJSON, saveText } from './storage';
import { getDb, ensureDbReady } from './db';

jest.mock('./db', () => ({
  getDb: jest.fn(),
  ensureDbReady: jest.fn(async () => {}),
}));

describe('storage DB writes', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://example.test/db';
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('saveJSON updates first, then inserts when no rows were updated', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ');
      sqlCalls.push(sql);
      queryValues.push(values);
      if (sql.includes('UPDATE data_store')) return [];
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveJSON('financial-metrics.json', { hello: 'world' });

    expect(ensureDbReady).toHaveBeenCalled();
    expect(sqlCalls.some(sql => sql.includes('UPDATE data_store'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('INSERT INTO data_store'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('ON CONFLICT'))).toBe(false);
    expect(queryValues).toContainEqual([
      '{"hello":"world"}',
      'financial-metrics.json',
    ]);
    expect(queryValues).toContainEqual([
      'financial-metrics.json',
      '{"hello":"world"}',
    ]);
  });

  it('saveJSON does not insert when update already matched rows', async () => {
    const sqlCalls: string[] = [];
    const db = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      sqlCalls.push(sql);
      if (sql.includes('UPDATE data_store')) return [{ key: 'financial-metrics.json' }];
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveJSON('financial-metrics.json', { ok: true });

    expect(sqlCalls.some(sql => sql.includes('UPDATE data_store'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('INSERT INTO data_store'))).toBe(false);
  });

  it('saveJSON retries insert with default owner_id when required by schema', async () => {
    const sqlCalls: string[] = [];
    const db = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      sqlCalls.push(sql);
      if (sql.includes('UPDATE data_store')) return [];
      if (sql.includes('INSERT INTO data_store (key, data, updated_at)')) {
        const error = new Error('null value in column "owner_id" violates not-null constraint') as Error & { code: string };
        error.code = '23502';
        throw error;
      }
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveJSON('financial-metrics.json', { ok: true });

    expect(sqlCalls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('UPDATE data_store'),
        expect.stringContaining('INSERT INTO data_store (key, data, updated_at)'),
        expect.stringContaining('INSERT INTO data_store (key, data, updated_at, owner_id)'),
      ])
    );
  });

  it('saveText updates first, then inserts when no rows were updated', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(' ');
      sqlCalls.push(sql);
      queryValues.push(values);
      if (sql.includes('UPDATE text_store')) return [];
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveText('INITIATIVES.md', '# Updated');

    expect(sqlCalls.some(sql => sql.includes('UPDATE text_store'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('INSERT INTO text_store'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('ON CONFLICT'))).toBe(false);
    expect(queryValues).toContainEqual([
      '# Updated',
      'INITIATIVES.md',
    ]);
    expect(queryValues).toContainEqual([
      'INITIATIVES.md',
      '# Updated',
    ]);
  });

  it('saveText retries insert with default owner_id when required by schema', async () => {
    const sqlCalls: string[] = [];
    const db = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      sqlCalls.push(sql);
      if (sql.includes('UPDATE text_store')) return [];
      if (sql.includes('INSERT INTO text_store (key, content, updated_at)')) {
        const error = new Error('null value in column "owner_id" violates not-null constraint') as Error & { code: string };
        error.code = '23502';
        throw error;
      }
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveText('INITIATIVES.md', '# Updated');

    expect(sqlCalls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('UPDATE text_store'),
        expect.stringContaining('INSERT INTO text_store (key, content, updated_at)'),
        expect.stringContaining('INSERT INTO text_store (key, content, updated_at, owner_id)'),
      ])
    );
  });

  it('appendAuditLog retries insert with default owner_id when required by schema', async () => {
    const sqlCalls: string[] = [];
    const db = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      sqlCalls.push(sql);
      if (sql.includes('INSERT INTO audit_log (date, entry_type, content)')) {
        const error = new Error('null value in column "owner_id" violates not-null constraint') as Error & { code: string };
        error.code = '23502';
        throw error;
      }
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await appendAuditLog('2026-01-01', 'integration-test', 'content');

    expect(sqlCalls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('INSERT INTO audit_log (date, entry_type, content)'),
        expect.stringContaining('INSERT INTO audit_log (date, entry_type, content, owner_id)'),
      ])
    );
  });
});
