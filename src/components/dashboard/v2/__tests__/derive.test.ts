import { consecutiveStreak, deriveActivity, deriveChips } from '../derive';

describe('consecutiveStreak', () => {
  it('returns 0 when there are no entries', () => {
    expect(consecutiveStreak(undefined)).toBe(0);
    expect(consecutiveStreak(null)).toBe(0);
    expect(consecutiveStreak({ currentWeekSummary: { dailyEntries: [] } })).toBe(0);
  });

  it('counts consecutive days back from the newest entry', () => {
    const weekly = {
      currentWeekSummary: {
        dailyEntries: [
          { date: '2026-05-21', deepWorkHours: 2, pipelineActions: 1, trained: false },
          { date: '2026-05-22', deepWorkHours: 0, pipelineActions: 0, trained: false }, // streak break
          { date: '2026-05-23', deepWorkHours: 3, pipelineActions: 2, trained: true },
          { date: '2026-05-24', deepWorkHours: 1, pipelineActions: 0, trained: false },
        ],
      },
    };
    expect(consecutiveStreak(weekly)).toBe(2);
  });

  it('breaks the streak on a fully empty day', () => {
    const weekly = {
      currentWeekSummary: {
        dailyEntries: [
          { date: '2026-05-22', deepWorkHours: 2, pipelineActions: 0, trained: false },
          { date: '2026-05-23', deepWorkHours: 0, pipelineActions: 0, trained: false },
          { date: '2026-05-24', deepWorkHours: 0, pipelineActions: 0, trained: false },
        ],
      },
    };
    expect(consecutiveStreak(weekly)).toBe(0);
  });
});

describe('deriveActivity', () => {
  it('returns optimistic entries first', () => {
    const result = deriveActivity({
      optimistic: [{ id: 'local-1', t: '09:00', kind: 'temporal', delta: '+1h', label: 'Temporal', meta: 'Quick log' }],
      focus: [],
      financial: [],
    });
    expect(result[0].id).toBe('local-1');
  });

  it('maps focus sessions to activity entries with HH:mm and meta', () => {
    const result = deriveActivity({
      focus: [
        {
          id: 'f1',
          category: 'Temporal',
          hours: 1.5,
          description: 'Brief read · investor deck',
          timestamp: '2026-05-27T09:12:00',
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].delta).toBe('+1.5h');
    expect(result[0].t).toBe('09:12');
    expect(result[0].meta).toBe('Brief read · investor deck');
  });

  it('maps financial entries with the right verb per category', () => {
    const result = deriveActivity({
      financial: [
        { id: 'fin-gen', category: 'generated', amount: 2000, description: 'Annual contract · Vega', timestamp: '2026-05-27T09:15:00' },
        { id: 'fin-cut', category: 'cut',       amount: 100,  description: 'cancelled SaaS',          timestamp: '2026-05-27T09:18:00' },
        { id: 'fin-mv',  category: 'moved',     amount: 500,  description: 'wire to brokerage',       timestamp: '2026-05-27T09:20:00' },
      ],
    });
    expect(result.map((e) => e.delta)).toEqual(['+ Generated', '+ Cut', '+ Moved']);
    expect(result[0].label).toBe('$2,000');
  });

  it('deduplicates entries by id', () => {
    const result = deriveActivity({
      optimistic: [{ id: 'dup', t: '09:00', kind: 'temporal', delta: '+1h', label: 'Temporal', meta: 'optimistic' }],
      focus: [{ id: 'dup', category: 'Temporal', hours: 1, description: 'server', timestamp: '2026-05-27T09:00:00' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].meta).toBe('optimistic'); // optimistic wins
  });

  it('respects the limit', () => {
    const focus = Array.from({ length: 30 }, (_, i) => ({
      id: `f${i}`,
      category: 'Temporal',
      hours: 1,
      description: 'd',
      timestamp: '2026-05-27T09:00:00',
    }));
    expect(deriveActivity({ focus, limit: 5 })).toHaveLength(5);
  });
});

describe('deriveChips', () => {
  it('adds a streak chip when streakDays >= 3', () => {
    const chips = deriveChips({ streakDays: 6 });
    const streak = chips.find((c) => c.id === 'streak');
    expect(streak).toBeDefined();
    expect(streak?.body).toContain('6-day');
  });

  it('omits the streak chip when streakDays < 3', () => {
    const chips = deriveChips({ streakDays: 2 });
    expect(chips.find((c) => c.id === 'streak')).toBeUndefined();
  });

  it('adds a Cash MoM chip when the absolute pct is >5', () => {
    const chips = deriveChips({ streakDays: 0, cashMoMPct: 228 });
    const mom = chips.find((c) => c.id === 'cashmom');
    expect(mom).toBeDefined();
    if (mom?.kind === 'positive') {
      expect(mom.emphasis).toBe('+228%');
    } else {
      throw new Error('Expected cashmom chip to be positive');
    }
  });

  it('adds a sync chip with human-readable time', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const chips = deriveChips({ streakDays: 0, monarchSyncedAt: oneHourAgo });
    const sync = chips.find((c) => c.id === 'sync');
    expect(sync).toBeDefined();
    expect(sync?.body).toMatch(/1h ago/);
  });
});
