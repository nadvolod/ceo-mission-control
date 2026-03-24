/**
 * @jest-environment node
 */

// Mock the storage module
jest.mock('./storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (key: string, data: any) => { store[key] = data; }),
    loadText: jest.fn(async () => ''),
    saveText: jest.fn(async () => {}),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('./storage');

import { FocusTracker } from './focus-tracker';

const TODAY = new Date().toISOString().split('T')[0];

describe('FocusTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('addSession', () => {
    it('should add a session and update daily metrics', async () => {
      const tracker = await FocusTracker.create();
      const session = await tracker.addSession('Temporal', 2.5, 'Client sprint', TODAY);

      expect(session.category).toBe('Temporal');
      expect(session.hours).toBe(2.5);
      expect(session.description).toBe('Client sprint');
      expect(session.date).toBe(TODAY);
      expect(session.source).toBe('manual');
      expect(session.id).toMatch(/^focus_/);
      expect(storage.saveJSON).toHaveBeenCalled();
    });

    it('should accumulate hours across multiple sessions', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 2, 'Morning block', TODAY);
      await tracker.addSession('Temporal', 1.5, 'Afternoon block', TODAY);

      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(3.5);
      expect(metrics.byCategory['Temporal']).toBe(3.5);
    });

    it('should track multiple categories separately', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 2, 'Client work', TODAY);
      await tracker.addSession('Finance', 1, 'Payment review', TODAY);

      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(3);
      expect(metrics.byCategory['Temporal']).toBe(2);
      expect(metrics.byCategory['Finance']).toBe(1);
    });

    it('should reject invalid hours (negative)', async () => {
      const tracker = await FocusTracker.create();
      await expect(tracker.addSession('Temporal', -1, 'test')).rejects.toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should reject invalid hours (zero)', async () => {
      const tracker = await FocusTracker.create();
      await expect(tracker.addSession('Temporal', 0, 'test')).rejects.toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should reject invalid hours (> 24)', async () => {
      const tracker = await FocusTracker.create();
      await expect(tracker.addSession('Temporal', 25, 'test')).rejects.toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should reject NaN hours', async () => {
      const tracker = await FocusTracker.create();
      await expect(tracker.addSession('Temporal', NaN, 'test')).rejects.toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should default unknown category to Other', async () => {
      const tracker = await FocusTracker.create();
      const session = await tracker.addSession('InvalidCategory' as any, 1, 'test');
      expect(session.category).toBe('Other');
    });

    it('should default to today if no date provided', async () => {
      const tracker = await FocusTracker.create();
      const session = await tracker.addSession('Temporal', 1, 'test');
      expect(session.date).toBe(TODAY);
    });
  });

  describe('processConversationalUpdate', () => {
    it('should detect "logged 2h on Temporal"', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('logged 2h on Temporal');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(2);
      expect(result.added[0].category).toBe('Temporal');
    });

    it('should detect "focused 3 hours on finance tasks"', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('focused 3 hours on finance tasks');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(3);
      expect(result.added[0].category).toBe('Finance');
    });

    it('should detect "spent 1.5h on taxes"', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('spent 1.5h on taxes');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(1.5);
      expect(result.added[0].category).toBe('Tax');
    });

    it('should detect "worked 2 hours on revenue"', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('worked 2 hours on revenue');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(2);
      expect(result.added[0].category).toBe('Revenue');
    });

    it('should detect "deep work 3h: Temporal sprint"', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('deep work 3h: Temporal sprint');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(3);
      expect(result.added[0].category).toBe('Temporal');
    });

    it('should detect "45 min on taxes" and convert to hours', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('45 min on taxes');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(0.75);
      expect(result.added[0].category).toBe('Tax');
    });

    it('should detect "blocked 2h for housing tasks"', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('blocked 2h for housing tasks');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(2);
      expect(result.added[0].category).toBe('Housing');
    });

    it('should handle multiple patterns in one message', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate(
        'logged 2h on Temporal. spent 1h on taxes.'
      );
      expect(result.added.length).toBe(2);
    });

    it('should return empty array when no patterns match', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('Just had a meeting about the project');
      expect(result.added.length).toBe(0);
      expect(result.message).toContain('No focus hour patterns detected');
    });

    it('should default to Other for unknown categories', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('logged 1h on random stuff');
      expect(result.added.length).toBe(1);
      expect(result.added[0].category).toBe('Other');
    });

    it('should mark sessions as conversational source', async () => {
      const tracker = await FocusTracker.create();
      const result = await tracker.processConversationalUpdate('logged 2h on Temporal');
      expect(result.added[0].source).toBe('conversational');
    });
  });

  describe('getWeekOverWeekGrowth', () => {
    it('should calculate positive growth correctly', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 5, 'This week', TODAY);

      const growth = tracker.getWeekOverWeekGrowth();
      expect(growth.currentTotal).toBe(5);
      expect(growth.previousTotal).toBe(0);
    });

    it('should handle zero previous week (avoid division by zero)', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 3, 'test', TODAY);

      const growth = tracker.getWeekOverWeekGrowth();
      expect(growth.percentageChange).toBe(100);
    });

    it('should return 0% when both weeks are empty', async () => {
      const tracker = await FocusTracker.create();
      const growth = tracker.getWeekOverWeekGrowth();
      expect(growth.currentTotal).toBe(0);
      expect(growth.previousTotal).toBe(0);
      expect(growth.percentageChange).toBe(0);
    });
  });

  describe('getDailyTrend', () => {
    it('should return correct number of days', async () => {
      const tracker = await FocusTracker.create();
      const trend = tracker.getDailyTrend(7);
      expect(trend.length).toBe(7);
    });

    it('should fill in zeros for days with no sessions', async () => {
      const tracker = await FocusTracker.create();
      const trend = tracker.getDailyTrend(7);
      trend.forEach(day => {
        expect(day.totalHours).toBe(0);
        expect(day.byCategory).toEqual({});
      });
    });

    it('should include today\'s data', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 2, 'test', TODAY);

      const trend = tracker.getDailyTrend(7);
      const todayEntry = trend.find(d => d.date === TODAY);
      expect(todayEntry?.totalHours).toBe(2);
      expect(todayEntry?.byCategory['Temporal']).toBe(2);
    });
  });

  describe('getRollingAverage', () => {
    it('should compute rolling average', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 7, 'test', TODAY);

      const averages = tracker.getRollingAverage(7);
      const todayAvg = averages.find(a => a.date === TODAY);
      expect(todayAvg?.average).toBe(1);
    });

    it('should handle empty data gracefully', async () => {
      const tracker = await FocusTracker.create();
      const averages = tracker.getRollingAverage(7);
      averages.forEach(a => {
        expect(a.average).toBe(0);
      });
    });
  });

  describe('getCategoryDistribution', () => {
    it('should sum hours by category', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 3, 'test', TODAY);
      await tracker.addSession('Finance', 1, 'test', TODAY);

      const dist = tracker.getCategoryDistribution(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      );
      expect(dist['Temporal']).toBe(3);
      expect(dist['Finance']).toBe(1);
    });
  });

  describe('getRecentSessions', () => {
    it('should return sessions in reverse order', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 1, 'First');
      await tracker.addSession('Finance', 2, 'Second');

      const recent = tracker.getRecentSessions(10);
      expect(recent.length).toBe(2);
      const descriptions = recent.map(s => s.description);
      expect(descriptions).toContain('First');
      expect(descriptions).toContain('Second');
    });

    it('should respect limit', async () => {
      const tracker = await FocusTracker.create();
      await tracker.addSession('Temporal', 1, 'One');
      await tracker.addSession('Finance', 1, 'Two');
      await tracker.addSession('Revenue', 1, 'Three');

      const recent = tracker.getRecentSessions(2);
      expect(recent.length).toBe(2);
    });
  });

  describe('data persistence', () => {
    it('should load existing data', async () => {
      const existingData = {
        dailyMetrics: {
          [TODAY]: {
            date: TODAY,
            sessions: [{
              id: 'existing',
              category: 'Temporal',
              hours: 2,
              description: 'Loaded session',
              date: TODAY,
              timestamp: new Date().toISOString(),
              source: 'manual'
            }],
            totalHours: 2,
            byCategory: { Temporal: 2 }
          }
        },
        lastUpdated: new Date().toISOString()
      };

      storage.loadJSON.mockResolvedValueOnce(existingData);

      const tracker = await FocusTracker.create();
      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(2);
      expect(metrics.sessions.length).toBe(1);
    });
  });
});
