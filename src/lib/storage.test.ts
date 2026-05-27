/**
 * @jest-environment node
 */

import { UNIT_TEST_OWNER_ID } from '@/__tests__/utils/owner-id';
import { appendAuditLog, loadJSON, loadText, saveJSON, saveText } from './storage';
import { getDb } from './db';

jest.mock('./db', () => ({
  getDb: jest.fn(),
}));

describe('storage DB writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saveJSON performs one owner-scoped atomic upsert', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      sqlCalls.push(strings.join(' '));
      queryValues.push(values);
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveJSON(UNIT_TEST_OWNER_ID, 'financial-metrics.json', { hello: 'world' });

    expect(db).toHaveBeenCalledTimes(1);
    expect(sqlCalls[0]).toContain('INSERT INTO data_store (owner_id, key, data, updated_at)');
    expect(sqlCalls[0]).toContain('ON CONFLICT (owner_id, key) DO UPDATE');
    expect(sqlCalls[0]).not.toContain('UPDATE data_store');
    expect(queryValues[0]).toEqual([
      UNIT_TEST_OWNER_ID,
      'financial-metrics.json',
      '{"hello":"world"}',
      '{"hello":"world"}',
    ]);
  });

  it('saveText performs one owner-scoped atomic upsert', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      sqlCalls.push(strings.join(' '));
      queryValues.push(values);
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await saveText(UNIT_TEST_OWNER_ID, 'INITIATIVES.md', '# Updated');

    expect(db).toHaveBeenCalledTimes(1);
    expect(sqlCalls[0]).toContain('INSERT INTO text_store (owner_id, key, content, updated_at)');
    expect(sqlCalls[0]).toContain('ON CONFLICT (owner_id, key) DO UPDATE');
    expect(sqlCalls[0]).not.toContain('UPDATE text_store');
    expect(queryValues[0]).toEqual([
      UNIT_TEST_OWNER_ID,
      'INITIATIVES.md',
      '# Updated',
      '# Updated',
    ]);
  });

  it('loadJSON scopes reads to owner_id and key', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      sqlCalls.push(strings.join(' '));
      queryValues.push(values);
      return [{ data: { ok: true } }];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await expect(loadJSON(UNIT_TEST_OWNER_ID, 'financial-metrics.json', { ok: false })).resolves.toEqual({
      ok: true,
    });

    expect(sqlCalls[0]).toContain('SELECT data FROM data_store WHERE owner_id =');
    expect(queryValues[0]).toEqual([UNIT_TEST_OWNER_ID, 'financial-metrics.json']);
  });

  it('loadText scopes reads to owner_id and key', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      sqlCalls.push(strings.join(' '));
      queryValues.push(values);
      return [{ content: '# Existing' }];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await expect(loadText(UNIT_TEST_OWNER_ID, 'INITIATIVES.md', '')).resolves.toBe('# Existing');

    expect(sqlCalls[0]).toContain('SELECT content FROM text_store WHERE owner_id =');
    expect(queryValues[0]).toEqual([UNIT_TEST_OWNER_ID, 'INITIATIVES.md']);
  });

  it('appendAuditLog writes the explicit owner_id', async () => {
    const sqlCalls: string[] = [];
    const queryValues: unknown[][] = [];
    const db = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      sqlCalls.push(strings.join(' '));
      queryValues.push(values);
      return [];
    });
    (getDb as jest.Mock).mockReturnValue(db);

    await appendAuditLog(UNIT_TEST_OWNER_ID, '2026-01-01', 'integration-test', 'content');

    expect(sqlCalls[0]).toContain('INSERT INTO audit_log (owner_id, date, entry_type, content)');
    expect(queryValues[0]).toEqual([
      UNIT_TEST_OWNER_ID,
      '2026-01-01',
      'integration-test',
      'content',
    ]);
  });

  it('rejects invalid owner IDs before issuing writes', async () => {
    const db = jest.fn();
    (getDb as jest.Mock).mockReturnValue(db);

    await expect(saveJSON('not-a-uuid', 'financial-metrics.json', {})).rejects.toThrow(/ownerId must be a UUID/);
    await expect(saveText('not-a-uuid', 'INITIATIVES.md', '')).rejects.toThrow(/ownerId must be a UUID/);
    await expect(appendAuditLog('not-a-uuid', '2026-01-01', 'test', '')).rejects.toThrow(/ownerId must be a UUID/);
    expect(db).not.toHaveBeenCalled();
  });
});
