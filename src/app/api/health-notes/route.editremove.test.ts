/**
 * @jest-environment node
 *
 * Tracker-level tests for habit/environment-field rename.
 *
 * Storage setup: mirrors route.test.ts. This repo has no test database, so the
 * storage layer (`@/lib/storage`) is stubbed — `loadJSON` returns a fresh
 * default template per call (giving each `create()` clean, isolated state) and
 * `saveJSON` is a no-op. The tracker's own rename logic runs for real; only the
 * Neon-Postgres persistence is stubbed (it requires DATABASE_URL, which is not
 * available in unit-test CI). Each `it` creates a fresh tracker, so OWNER state
 * never leaks across tests.
 */
import { HealthNotesTracker } from '@/lib/health-notes-tracker';
import * as storage from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  loadJSON: jest.fn(),
  saveJSON: jest.fn(),
  appendAuditLog: jest.fn(),
}));

const mockLoadJSON = storage.loadJSON as jest.MockedFunction<typeof storage.loadJSON>;

// A valid UUID owner (storage.assertOwnerId requires UUIDs in the real layer;
// kept valid here so the test does not depend on the stub bypassing validation).
const OWNER = '00000000-0000-0000-0000-0000000000ee';

function freshNotesData() {
  return {
    notes: {},
    supplementTemplate: [{ name: 'Guanfacine', defaultDosageMg: 1 }],
    habitTemplate: [{ name: 'Red light therapy' }],
    environmentTemplate: { customFieldNames: [] },
    lastUpdated: '',
  };
}

describe('HealthNotesTracker habit/env rename', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Return a fresh copy each call so trackers never share mutated state.
    mockLoadJSON.mockImplementation(async () => freshNotesData());
    (storage.saveJSON as jest.Mock).mockResolvedValue(undefined);
  });

  it('renames a habit, dropping the old name', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await t.addHabit('Cold plunge');
    await t.editHabit('Cold plunge', 'Sauna');
    const tpl = t.getTemplates();
    expect(tpl.habitTemplate.map(h => h.name)).toContain('Sauna');
    expect(tpl.habitTemplate.map(h => h.name)).not.toContain('Cold plunge');
  });

  it('throws when renaming a missing habit', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await expect(t.editHabit('Nope', 'X')).rejects.toThrow(/not found/i);
  });

  it('throws when renaming a habit to an existing name', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await t.addHabit('Sauna');
    await t.addHabit('Cold plunge');
    await expect(t.editHabit('Cold plunge', 'Sauna')).rejects.toThrow(/already exists/i);
  });

  it('renames an environment field', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await t.addEnvironmentField('Blackout curtains');
    await t.editEnvironmentField('Blackout curtains', 'Eye mask');
    expect(t.getTemplates().environmentTemplate.customFieldNames).toContain('Eye mask');
    expect(t.getTemplates().environmentTemplate.customFieldNames).not.toContain('Blackout curtains');
  });

  it('throws when renaming a missing environment field', async () => {
    const t = await HealthNotesTracker.create(OWNER);
    await expect(t.editEnvironmentField('Nope', 'X')).rejects.toThrow(/not found/i);
  });
});
