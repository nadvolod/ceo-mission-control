/**
 * @jest-environment node
 */
import { HealthNotesTracker } from './health-notes-tracker';
import * as storage from './storage';
import type { DailyHealthNote, HealthNotesData } from './types';

jest.mock('./storage', () => ({
  loadJSON: jest.fn(),
  saveJSON: jest.fn(),
  appendAuditLog: jest.fn(),
}));

const mockLoadJSON = storage.loadJSON as jest.MockedFunction<typeof storage.loadJSON>;
const mockSaveJSON = storage.saveJSON as jest.MockedFunction<typeof storage.saveJSON>;

function defaultHealthNotesData(): HealthNotesData {
  return {
    notes: {},
    supplementTemplate: [
      { name: 'Guanfacine', defaultDosageMg: 1 },
      { name: 'Advil PM', defaultDosageMg: 25 },
      { name: 'Adderall', defaultDosageMg: 20 },
    ],
    habitTemplate: [
      { name: 'Red light therapy' },
      { name: 'Phone before bed' },
    ],
    environmentTemplate: { customFieldNames: [] },
    lastUpdated: '',
  };
}

describe('HealthNotesTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadJSON.mockResolvedValue(defaultHealthNotesData());
    mockSaveJSON.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('loads data from storage', async () => {
      await HealthNotesTracker.create();
      expect(mockLoadJSON).toHaveBeenCalledWith('health-notes.json', expect.any(Object));
    });
  });

  describe('logNote', () => {
    it('saves a daily health note', async () => {
      const tracker = await HealthNotesTracker.create();
      const note: Omit<DailyHealthNote, 'loggedAt'> = {
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [{ name: 'Guanfacine', dosageMg: 1, taken: true }],
        habits: [{ name: 'Red light therapy', done: true }],
        freeformNote: 'Slept great',
      };

      const result = await tracker.logNote(note);

      expect(result.date).toBe('2026-04-13');
      expect(result.loggedAt).toBeTruthy();
      expect(mockSaveJSON).toHaveBeenCalledWith(
        'health-notes.json',
        expect.objectContaining({
          notes: expect.objectContaining({ '2026-04-13': expect.any(Object) }),
        })
      );
    });

    it('overwrites existing note for same date', async () => {
      const data = defaultHealthNotesData();
      data.notes['2026-04-13'] = {
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 70, fanRunning: false, dogInRoom: true, customFields: {} },
        supplements: [],
        habits: [],
        freeformNote: 'old note',
        loggedAt: '2026-04-13T06:00:00Z',
      };
      mockLoadJSON.mockResolvedValue(data);

      const tracker = await HealthNotesTracker.create();
      await tracker.logNote({
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [],
        habits: [],
        freeformNote: 'new note',
      });

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.notes['2026-04-13'].freeformNote).toBe('new note');
    });

    it('rejects invalid date format', async () => {
      const tracker = await HealthNotesTracker.create();
      await expect(tracker.logNote({
        date: 'bad-date',
        sleepEnvironment: { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
        supplements: [],
        habits: [],
        freeformNote: '',
      })).rejects.toThrow('date must be a valid YYYY-MM-DD');
    });
  });

  describe('getNoteForDate', () => {
    it('returns note for existing date', async () => {
      const data = defaultHealthNotesData();
      data.notes['2026-04-13'] = {
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [],
        habits: [],
        freeformNote: '',
        loggedAt: '2026-04-13T07:00:00Z',
      };
      mockLoadJSON.mockResolvedValue(data);

      const tracker = await HealthNotesTracker.create();
      const note = tracker.getNoteForDate('2026-04-13');

      expect(note).not.toBeNull();
      expect(note!.sleepEnvironment.temperatureF).toBe(68);
    });

    it('returns null for date with no note', async () => {
      const tracker = await HealthNotesTracker.create();
      expect(tracker.getNoteForDate('2026-01-01')).toBeNull();
    });
  });

  describe('template management', () => {
    it('addSupplement adds to template', async () => {
      const tracker = await HealthNotesTracker.create();
      await tracker.addSupplement('Melatonin', 3);

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.supplementTemplate).toContainEqual({ name: 'Melatonin', defaultDosageMg: 3 });
    });

    it('addSupplement rejects duplicate name', async () => {
      const tracker = await HealthNotesTracker.create();
      await expect(tracker.addSupplement('Guanfacine', 2)).rejects.toThrow('already exists');
    });

    it('removeSupplement removes from template', async () => {
      const tracker = await HealthNotesTracker.create();
      await tracker.removeSupplement('Advil PM');

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.supplementTemplate.find(s => s.name === 'Advil PM')).toBeUndefined();
    });

    it('addHabit adds to template', async () => {
      const tracker = await HealthNotesTracker.create();
      await tracker.addHabit('Meditation');

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.habitTemplate).toContainEqual({ name: 'Meditation' });
    });

    it('addHabit rejects duplicate name', async () => {
      const tracker = await HealthNotesTracker.create();
      await expect(tracker.addHabit('Red light therapy')).rejects.toThrow('already exists');
    });

    it('removeHabit removes from template', async () => {
      const tracker = await HealthNotesTracker.create();
      await tracker.removeHabit('Phone before bed');

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.habitTemplate.find(h => h.name === 'Phone before bed')).toBeUndefined();
    });

    it('addEnvironmentField adds custom field name', async () => {
      const tracker = await HealthNotesTracker.create();
      await tracker.addEnvironmentField('Window open');

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.environmentTemplate.customFieldNames).toContain('Window open');
    });

    it('removeEnvironmentField removes custom field name', async () => {
      const data = defaultHealthNotesData();
      data.environmentTemplate.customFieldNames = ['Window open'];
      mockLoadJSON.mockResolvedValue(data);

      const tracker = await HealthNotesTracker.create();
      await tracker.removeEnvironmentField('Window open');

      const saved = (mockSaveJSON.mock.calls[0][1] as HealthNotesData);
      expect(saved.environmentTemplate.customFieldNames).not.toContain('Window open');
    });
  });

  describe('getTemplates', () => {
    it('returns all templates', async () => {
      const tracker = await HealthNotesTracker.create();
      const templates = tracker.getTemplates();

      expect(templates.supplementTemplate).toHaveLength(3);
      expect(templates.habitTemplate).toHaveLength(2);
      expect(templates.environmentTemplate.customFieldNames).toEqual([]);
    });
  });

  describe('getNotesForRange', () => {
    it('returns notes within date range', async () => {
      const data = defaultHealthNotesData();
      data.notes['2026-04-11'] = { date: '2026-04-11', sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} }, supplements: [], habits: [], freeformNote: '', loggedAt: '' };
      data.notes['2026-04-12'] = { date: '2026-04-12', sleepEnvironment: { temperatureF: 70, fanRunning: false, dogInRoom: true, customFields: {} }, supplements: [], habits: [], freeformNote: '', loggedAt: '' };
      data.notes['2026-04-13'] = { date: '2026-04-13', sleepEnvironment: { temperatureF: 66, fanRunning: true, dogInRoom: false, customFields: {} }, supplements: [], habits: [], freeformNote: '', loggedAt: '' };
      mockLoadJSON.mockResolvedValue(data);

      const tracker = await HealthNotesTracker.create();
      const result = tracker.getNotesForRange('2026-04-11', '2026-04-12');

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-04-11');
    });
  });

  describe('getAllData defensive copy', () => {
    it('returns a copy — mutating returned data does not change internal state', async () => {
      const data = defaultHealthNotesData();
      data.notes['2026-04-13'] = {
        date: '2026-04-13',
        sleepEnvironment: { temperatureF: 68, fanRunning: true, dogInRoom: false, customFields: {} },
        supplements: [{ name: 'Guanfacine', dosageMg: 1, taken: true }],
        habits: [{ name: 'Red light therapy', done: true }],
        freeformNote: 'Original note',
        loggedAt: '2026-04-13T07:00:00Z',
      };
      mockLoadJSON.mockResolvedValue(data);

      const tracker = await HealthNotesTracker.create();

      // Get first copy and mutate it
      const firstCopy = tracker.getAllData();
      firstCopy.notes['2026-04-13'].freeformNote = 'MUTATED';
      delete firstCopy.notes['2026-04-13'];
      firstCopy.supplementTemplate.push({ name: 'Fake', defaultDosageMg: 999 });

      // Get second copy and verify it is unaffected
      const secondCopy = tracker.getAllData();
      expect(secondCopy.notes['2026-04-13']).toBeDefined();
      expect(secondCopy.notes['2026-04-13'].freeformNote).toBe('Original note');
      expect(secondCopy.supplementTemplate).toHaveLength(3);
      expect(secondCopy.supplementTemplate.find(s => s.name === 'Fake')).toBeUndefined();
    });
  });

  describe('getTemplates defensive copy', () => {
    it('returns a copy — mutating returned templates does not change internal state', async () => {
      const tracker = await HealthNotesTracker.create();

      // Get first copy and mutate it
      const firstCopy = tracker.getTemplates();
      firstCopy.supplementTemplate.push({ name: 'Fake Supplement', defaultDosageMg: 999 });
      firstCopy.habitTemplate.push({ name: 'Fake Habit' });
      firstCopy.environmentTemplate.customFieldNames.push('Fake Field');

      // Get second copy and verify it is unaffected
      const secondCopy = tracker.getTemplates();
      expect(secondCopy.supplementTemplate).toHaveLength(3);
      expect(secondCopy.supplementTemplate.find(s => s.name === 'Fake Supplement')).toBeUndefined();
      expect(secondCopy.habitTemplate).toHaveLength(2);
      expect(secondCopy.habitTemplate.find(h => h.name === 'Fake Habit')).toBeUndefined();
      expect(secondCopy.environmentTemplate.customFieldNames).not.toContain('Fake Field');
    });
  });
});
