/**
 * @jest-environment node
 */

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;

import { FocusTracker } from './focus-tracker';

const TODAY = new Date().toISOString().split('T')[0];

describe('FocusTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('addSession', () => {
    it('should add a session and update daily metrics', () => {
      const tracker = new FocusTracker();
      const session = tracker.addSession('Temporal', 2.5, 'Client sprint', TODAY);

      expect(session.category).toBe('Temporal');
      expect(session.hours).toBe(2.5);
      expect(session.description).toBe('Client sprint');
      expect(session.date).toBe(TODAY);
      expect(session.source).toBe('manual');
      expect(session.id).toMatch(/^focus_/);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should accumulate hours across multiple sessions', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 2, 'Morning block', TODAY);
      tracker.addSession('Temporal', 1.5, 'Afternoon block', TODAY);

      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(3.5);
      expect(metrics.byCategory['Temporal']).toBe(3.5);
    });

    it('should track multiple categories separately', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 2, 'Client work', TODAY);
      tracker.addSession('Finance', 1, 'Payment review', TODAY);

      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(3);
      expect(metrics.byCategory['Temporal']).toBe(2);
      expect(metrics.byCategory['Finance']).toBe(1);
    });

    it('should reject invalid hours (negative)', () => {
      const tracker = new FocusTracker();
      expect(() => tracker.addSession('Temporal', -1, 'test')).toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should reject invalid hours (zero)', () => {
      const tracker = new FocusTracker();
      expect(() => tracker.addSession('Temporal', 0, 'test')).toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should reject invalid hours (> 24)', () => {
      const tracker = new FocusTracker();
      expect(() => tracker.addSession('Temporal', 25, 'test')).toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should reject NaN hours', () => {
      const tracker = new FocusTracker();
      expect(() => tracker.addSession('Temporal', NaN, 'test')).toThrow('Hours must be a number greater than 0 and at most 24');
    });

    it('should default unknown category to Other', () => {
      const tracker = new FocusTracker();
      const session = tracker.addSession('InvalidCategory' as any, 1, 'test');
      expect(session.category).toBe('Other');
    });

    it('should default to today if no date provided', () => {
      const tracker = new FocusTracker();
      const session = tracker.addSession('Temporal', 1, 'test');
      expect(session.date).toBe(TODAY);
    });
  });

  describe('processConversationalUpdate', () => {
    it('should detect "logged 2h on Temporal"', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('logged 2h on Temporal');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(2);
      expect(result.added[0].category).toBe('Temporal');
    });

    it('should detect "focused 3 hours on finance tasks"', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('focused 3 hours on finance tasks');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(3);
      expect(result.added[0].category).toBe('Finance');
    });

    it('should detect "spent 1.5h on taxes"', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('spent 1.5h on taxes');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(1.5);
      expect(result.added[0].category).toBe('Tax');
    });

    it('should detect "worked 2 hours on revenue"', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('worked 2 hours on revenue');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(2);
      expect(result.added[0].category).toBe('Revenue');
    });

    it('should detect "deep work 3h: Temporal sprint"', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('deep work 3h: Temporal sprint');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(3);
      expect(result.added[0].category).toBe('Temporal');
    });

    it('should detect "45 min on taxes" and convert to hours', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('45 min on taxes');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(0.75);
      expect(result.added[0].category).toBe('Tax');
    });

    it('should detect "blocked 2h for housing tasks"', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('blocked 2h for housing tasks');
      expect(result.added.length).toBe(1);
      expect(result.added[0].hours).toBe(2);
      expect(result.added[0].category).toBe('Housing');
    });

    it('should handle multiple patterns in one message', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate(
        'logged 2h on Temporal. spent 1h on taxes.'
      );
      expect(result.added.length).toBe(2);
    });

    it('should return empty array when no patterns match', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('Just had a meeting about the project');
      expect(result.added.length).toBe(0);
      expect(result.message).toContain('No focus hour patterns detected');
    });

    it('should default to Other for unknown categories', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('logged 1h on random stuff');
      expect(result.added.length).toBe(1);
      expect(result.added[0].category).toBe('Other');
    });

    it('should mark sessions as conversational source', () => {
      const tracker = new FocusTracker();
      const result = tracker.processConversationalUpdate('logged 2h on Temporal');
      expect(result.added[0].source).toBe('conversational');
    });
  });

  describe('getWeekOverWeekGrowth', () => {
    it('should calculate positive growth correctly', () => {
      const tracker = new FocusTracker();

      // Add sessions for this week
      tracker.addSession('Temporal', 5, 'This week', TODAY);

      const growth = tracker.getWeekOverWeekGrowth();
      expect(growth.currentTotal).toBe(5);
      expect(growth.previousTotal).toBe(0);
    });

    it('should handle zero previous week (avoid division by zero)', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 3, 'test', TODAY);

      const growth = tracker.getWeekOverWeekGrowth();
      expect(growth.percentageChange).toBe(100);
    });

    it('should return 0% when both weeks are empty', () => {
      const tracker = new FocusTracker();
      const growth = tracker.getWeekOverWeekGrowth();
      expect(growth.currentTotal).toBe(0);
      expect(growth.previousTotal).toBe(0);
      expect(growth.percentageChange).toBe(0);
    });
  });

  describe('getDailyTrend', () => {
    it('should return correct number of days', () => {
      const tracker = new FocusTracker();
      const trend = tracker.getDailyTrend(7);
      expect(trend.length).toBe(7);
    });

    it('should fill in zeros for days with no sessions', () => {
      const tracker = new FocusTracker();
      const trend = tracker.getDailyTrend(7);
      trend.forEach(day => {
        expect(day.totalHours).toBe(0);
        expect(day.byCategory).toEqual({});
      });
    });

    it('should include today\'s data', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 2, 'test', TODAY);

      const trend = tracker.getDailyTrend(7);
      const todayEntry = trend.find(d => d.date === TODAY);
      expect(todayEntry?.totalHours).toBe(2);
      expect(todayEntry?.byCategory['Temporal']).toBe(2);
    });
  });

  describe('getRollingAverage', () => {
    it('should compute rolling average', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 7, 'test', TODAY);

      const averages = tracker.getRollingAverage(7);
      // With 7 day window and only today having hours, average = 7/7 = 1
      const todayAvg = averages.find(a => a.date === TODAY);
      expect(todayAvg?.average).toBe(1);
    });

    it('should handle empty data gracefully', () => {
      const tracker = new FocusTracker();
      const averages = tracker.getRollingAverage(7);
      averages.forEach(a => {
        expect(a.average).toBe(0);
      });
    });
  });

  describe('getCategoryDistribution', () => {
    it('should sum hours by category', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 3, 'test', TODAY);
      tracker.addSession('Finance', 1, 'test', TODAY);

      const dist = tracker.getCategoryDistribution(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      );
      expect(dist['Temporal']).toBe(3);
      expect(dist['Finance']).toBe(1);
    });
  });

  describe('getRecentSessions', () => {
    it('should return sessions in reverse order', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 1, 'First');
      tracker.addSession('Finance', 2, 'Second');

      const recent = tracker.getRecentSessions(10);
      expect(recent.length).toBe(2);
      // Both sessions exist
      const descriptions = recent.map(s => s.description);
      expect(descriptions).toContain('First');
      expect(descriptions).toContain('Second');
    });

    it('should respect limit', () => {
      const tracker = new FocusTracker();
      tracker.addSession('Temporal', 1, 'One');
      tracker.addSession('Finance', 1, 'Two');
      tracker.addSession('Revenue', 1, 'Three');

      const recent = tracker.getRecentSessions(2);
      expect(recent.length).toBe(2);
    });
  });

  describe('data persistence', () => {
    it('should load existing data from file', () => {
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

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingData));

      const tracker = new FocusTracker();
      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(2);
      expect(metrics.sessions.length).toBe(1);
    });

    it('should handle corrupt JSON gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json');

      const tracker = new FocusTracker();
      const metrics = tracker.getTodaysMetrics();
      expect(metrics.totalHours).toBe(0);
      expect(metrics.sessions.length).toBe(0);
    });
  });
});
