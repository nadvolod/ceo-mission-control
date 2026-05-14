/**
 * @jest-environment node
 */

import { saveJSON, saveText } from './storage';
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
});
