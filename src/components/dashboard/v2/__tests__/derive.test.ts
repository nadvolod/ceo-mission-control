import { consecutiveStreak, deriveActivity, deriveChips, morningToActivity, reflectionToActivity } from '../derive';

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
  it('returns optimistic entries when present', () => {
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
    expect(result.map((e) => e.delta)).toEqual(['+ Moved', '+ Cut', '+ Generated']);
    expect(result[2].label).toBe('$2,000');
  });

  it('sorts newest-first while preserving insertion order for unparseable times', () => {
    const result = deriveActivity({
      optimistic: [
        { id: 'local-old', t: '09:00', kind: 'temporal', delta: '+1h', label: 'Temporal', meta: 'old' },
        { id: 'local-unknown', t: '--:--', kind: 'deepWork', delta: '+1h', label: 'Deep work', meta: 'unknown' },
      ],
      focus: [
        { id: 'new', category: 'Temporal', hours: 1, description: 'new', timestamp: '2026-05-27T13:30:00' },
      ],
    });

    expect(result.map((e) => e.id)).toEqual(['new', 'local-old', 'local-unknown']);
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

  // Defense-in-depth filter for stale e2e residue. The proper fix is to
  // clean up the test user's data, but until then this filter keeps test-
  // authored rows out of the user-facing activity feed.
  describe('e2e-residue filter', () => {
    it('drops financial entries whose description matches /^e2e-/i', () => {
      const result = deriveActivity({
        financial: [
          { id: 'real',  category: 'moved', amount: 200, description: 'wire to brokerage', timestamp: '2026-05-27T09:00:00' },
          { id: 'leak1', category: 'cut',   amount: 150, description: 'e2e-storage-1778723003152', timestamp: '2026-05-27T09:01:00' },
          { id: 'leak2', category: 'cut',   amount: 150, description: 'E2E-cleanup-test',          timestamp: '2026-05-27T09:02:00' },
        ],
      });
      expect(result.map((e) => e.id)).toEqual(['real']);
    });

    it('drops focus sessions whose description matches /^\\[test\\]/i or /^playwright[-_]/i', () => {
      const result = deriveActivity({
        focus: [
          { id: 'real',  category: 'Temporal', hours: 1,   description: 'investor deck',             timestamp: '2026-05-27T09:00:00' },
          { id: 'leak1', category: 'Temporal', hours: 0.5, description: '[TEST] flake debug',         timestamp: '2026-05-27T09:01:00' },
          { id: 'leak2', category: 'Other',    hours: 2,   description: 'playwright-fixture-foo',     timestamp: '2026-05-27T09:02:00' },
          { id: 'leak3', category: 'Other',    hours: 1,   description: 'playwright_e2e_setup',       timestamp: '2026-05-27T09:03:00' },
        ],
      });
      expect(result.map((e) => e.id)).toEqual(['real']);
    });

    it('does NOT drop entries whose description merely mentions "e2e" mid-string', () => {
      const result = deriveActivity({
        financial: [
          { id: 'real', category: 'generated', amount: 500, description: 'gen for e2e dashboard review', timestamp: '2026-05-27T09:00:00' },
        ],
      });
      // "e2e" appears mid-string, not as a prefix — keep it.
      expect(result.map((e) => e.id)).toEqual(['real']);
    });
  });

  // Diagnostic / regression suite for the cross-day sort bug. The user
  // reported "Money Moved entries not appearing in Activity" — root cause
  // was deriveActivity sorting by HH:MM only (parseActivityTime ignores
  // date), so yesterday-evening entries outrank today-morning entries and
  // can push today's logs off the 25-entry slice limit.
  //
  // These positive / negative / boundary cases pin the correct semantics:
  // sort by the FULL timestamp (epoch ms), not by HH:MM-of-day.
  describe('cross-day sort (regression for Money Moved missing from Activity)', () => {
    // --- POSITIVE: same-day entries sort newest-first by full timestamp ---
    it('positive: same-day financial + focus entries sort newest-first', () => {
      const result = deriveActivity({
        focus: [
          { id: 'f-morning',   category: 'Temporal', hours: 1, description: 'morning', timestamp: '2026-05-27T09:00:00' },
          { id: 'f-afternoon', category: 'Temporal', hours: 1, description: 'pm',      timestamp: '2026-05-27T15:00:00' },
        ],
        financial: [
          { id: 'fin-noon', category: 'moved', amount: 100, description: 'lunch transfer', timestamp: '2026-05-27T12:00:00' },
        ],
      });
      // newest first: 15:00 > 12:00 > 09:00
      expect(result.map((e) => e.id)).toEqual(['f-afternoon', 'fin-noon', 'f-morning']);
    });

    // --- POSITIVE: a single money entry shows up regardless of clutter ---
    it('positive: a single Money Moved entry appears in the feed', () => {
      const result = deriveActivity({
        financial: [
          { id: 'm1', category: 'moved', amount: 500, description: 'Benepass', timestamp: '2026-05-27T11:00:00' },
        ],
      });
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('moneyMoved');
      expect(result[0].meta).toContain('Benepass');
    });

    // --- REGRESSION: yesterday-evening + today-morning → TODAY first ---
    // This is the failing-before-fix assertion that proves the bug. With the
    // old HH:MM sort: yesterday 22:00 (1320 min) > today 09:30 (570 min), so
    // yesterday's entry sorted on top. The user's freshly-logged morning
    // money entry showed BELOW yesterday's clutter. After the fix (sort by
    // full timestamp ms), today is correctly first.
    it('regression: today 09:30 sorts ABOVE yesterday 22:00', () => {
      const result = deriveActivity({
        financial: [
          { id: 'yesterday-late', category: 'cut',       amount: 50,  description: 'late wire',  timestamp: '2026-05-26T22:00:00' },
          { id: 'today-morning',  category: 'generated', amount: 500, description: 'Benepass',   timestamp: '2026-05-27T09:30:00' },
        ],
      });
      expect(result.map((e) => e.id)).toEqual(['today-morning', 'yesterday-late']);
    });

    // --- REGRESSION: 25 yesterday-late + 1 today-morning → today survives ---
    // The user's actual symptom: with the test user accumulated lots of
    // older entries (many at HH:MM > today's morning), a new money entry
    // got pushed off the slice. After the fix, today's newest entry stays.
    it('regression: 25 yesterday-evening entries + 1 today-morning → today appears in feed', () => {
      const yesterdayLate = Array.from({ length: 25 }, (_, i) => ({
        id: `yesterday-${i}`,
        category: 'cut' as const,
        amount: 1,
        description: `prior ${i}`,
        // All at 22:00-22:24 yesterday — would outrank today by HH:MM.
        timestamp: `2026-05-26T22:${String(i).padStart(2, '0')}:00`,
      }));
      const todayMorning = {
        id: 'today-morning',
        category: 'generated' as const,
        amount: 500,
        description: 'Benepass',
        timestamp: '2026-05-27T09:30:00',
      };
      const result = deriveActivity({
        financial: [...yesterdayLate, todayMorning],
        limit: 25,
      });
      expect(result.find((e) => e.id === 'today-morning')).toBeDefined();
      // And it should be first (most recent).
      expect(result[0].id).toBe('today-morning');
    });

    // --- BOUNDARY: limit exact → all shown ---
    it('boundary: exactly limit entries → all included', () => {
      const focus = Array.from({ length: 25 }, (_, i) => ({
        id: `f${i}`,
        category: 'Temporal',
        hours: 1,
        description: `d${i}`,
        timestamp: `2026-05-27T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00`,
      }));
      const result = deriveActivity({ focus, limit: 25 });
      expect(result).toHaveLength(25);
    });

    // --- BOUNDARY: limit + 1 → OLDEST dropped (by full timestamp) ---
    it('boundary: limit+1 entries → oldest by full timestamp dropped', () => {
      const focus = Array.from({ length: 26 }, (_, i) => ({
        id: `f${i}`,
        category: 'Temporal',
        hours: 1,
        description: `d${i}`,
        // i=0 → earliest, i=25 → latest. f0 should drop off.
        timestamp: new Date(2026, 4, 27, 9, i).toISOString(),
      }));
      const result = deriveActivity({ focus, limit: 25 });
      expect(result).toHaveLength(25);
      expect(result.map((e) => e.id)).not.toContain('f0');
      // newest at top
      expect(result[0].id).toBe('f25');
    });

    // --- BOUNDARY: identical timestamps → stable insertion order ---
    it('boundary: entries with identical timestamps fall back to insertion order', () => {
      const ts = '2026-05-27T10:00:00';
      const result = deriveActivity({
        focus: [
          { id: 'a', category: 'Temporal', hours: 1, description: 'a', timestamp: ts },
          { id: 'b', category: 'Temporal', hours: 1, description: 'b', timestamp: ts },
          { id: 'c', category: 'Temporal', hours: 1, description: 'c', timestamp: ts },
        ],
      });
      expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });

    // --- NEGATIVE: missing/malformed timestamps don't crash, fall to bottom ---
    it('negative: entries with missing/malformed timestamps fall to bottom (no crash)', () => {
      const result = deriveActivity({
        focus: [
          { id: 'broken', category: 'Temporal', hours: 1, description: 'no ts' /* no timestamp */ },
          { id: 'real',   category: 'Temporal', hours: 1, description: 'real',  timestamp: '2026-05-27T10:00:00' },
          { id: 'garbage', category: 'Temporal', hours: 1, description: 'bad ts', timestamp: 'not-a-date' },
        ],
      });
      expect(result.map((e) => e.id)[0]).toBe('real');
      // broken + garbage end up at the bottom (their relative order is
      // insertion-stable since both have tsMs=0).
      expect(result).toHaveLength(3);
    });

    // --- NEGATIVE: empty inputs → empty output ---
    it('negative: all-empty inputs return empty array (no crash)', () => {
      expect(deriveActivity({})).toEqual([]);
      expect(deriveActivity({ focus: [], financial: [], optimistic: [] })).toEqual([]);
    });

    // --- POSITIVE: optimistic money entry appears before older server entries ---
    // The user's experience: tap "+ Generated $500" and the row should show
    // at the TOP immediately, not lost below yesterday's clutter.
    it('positive: an optimistic money entry sorts above yesterday-evening server entries', () => {
      const justNowMs = new Date('2026-05-27T09:30:00').getTime();
      const result = deriveActivity({
        optimistic: [
          {
            id: 'local-fresh',
            t: '09:30',
            tsMs: justNowMs,
            kind: 'moneyMoved',
            delta: '+ Generated',
            label: '$500',
            meta: 'Benepass',
          },
        ],
        financial: [
          { id: 'yesterday', category: 'cut', amount: 1, description: 'old', timestamp: '2026-05-26T22:00:00' },
        ],
      });
      expect(result[0].id).toBe('local-fresh');
    });
  });
});

describe('morningToActivity', () => {
  it('summarizes a morning log into one entry', () => {
    const e = morningToActivity({
      date: '2026-06-05',
      sleepEnvironment: { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
      sleepMetrics: { sleepScore: 87, durationMinutes: 442, bodyBattery: 95, restingHeartRate: 50, hrv: 40 },
      supplements: [{ name: 'A', dosageMg: 1, taken: true }, { name: 'B', dosageMg: 2, taken: false }],
      habits: [{ name: 'H1', done: true }, { name: 'H2', done: true }],
      freeformNote: '',
      loggedAt: '2026-06-05T08:14:00.000Z',
    });
    expect(e.source).toBe('morning');
    expect(e.refKey).toBe('2026-06-05');
    expect(e.label).toBe('Morning Log');
    expect(e.meta).toContain('87');
    expect(e.meta).toContain('7h22m');
    expect(e.meta).toContain('1 supplement'); // only "taken" counted
    expect(e.meta).toContain('2 habits');
  });

  it('omits the sleep score when not recorded', () => {
    const e = morningToActivity({
      date: '2026-06-05',
      sleepEnvironment: { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
      sleepMetrics: { sleepScore: null, durationMinutes: null, bodyBattery: null, restingHeartRate: null, hrv: null },
      supplements: [],
      habits: [],
      freeformNote: '',
      loggedAt: '2026-06-05T08:14:00.000Z',
    });
    expect(e.meta).not.toContain('Sleep ');
    expect(e.meta).toContain('0 supplements');
    expect(e.meta).toContain('0 habits');
  });
});

describe('reflectionToActivity', () => {
  it('summarizes a reflection into one entry', () => {
    const e = reflectionToActivity({
      date: '2026-06-05',
      questions: ['q1', 'q2', 'q3'],
      answers: [
        { id: '1', date: '2026-06-05', question: 'q1', answer: 'a', answeredAt: '2026-06-05T21:30:00.000Z' },
        { id: '2', date: '2026-06-05', question: 'q2', answer: '', answeredAt: '2026-06-05T21:30:00.000Z' },
      ],
    });
    expect(e.source).toBe('reflection');
    expect(e.refKey).toBe('2026-06-05');
    expect(e.label).toBe('Reflection');
    expect(e.meta).toBe('1 of 3 answered');
  });
});

describe('deriveActivity with morning + reflection', () => {
  it('includes morning and reflection entries in the merged feed', () => {
    const out = deriveActivity({
      morning: [{
        date: '2026-06-05',
        sleepEnvironment: { temperatureF: null, fanRunning: false, dogInRoom: false, customFields: {} },
        sleepMetrics: { sleepScore: 80, durationMinutes: 420, bodyBattery: null, restingHeartRate: null, hrv: null },
        supplements: [], habits: [], freeformNote: '', loggedAt: '2026-06-05T08:00:00.000Z',
      }],
      reflection: [{
        date: '2026-06-05', questions: ['q1'], answers: [{ id: '1', date: '2026-06-05', question: 'q1', answer: 'x', answeredAt: '2026-06-05T21:00:00.000Z' }],
      }],
    });
    expect(out.some(e => e.source === 'morning')).toBe(true);
    expect(out.some(e => e.source === 'reflection')).toBe(true);
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

  it('adds a positive Cash MoM chip when pct is >5', () => {
    const chips = deriveChips({ streakDays: 0, cashMoMPct: 228 });
    const mom = chips.find((c) => c.id === 'cashmom');
    expect(mom).toBeDefined();
    if (mom?.kind === 'positive') {
      expect(mom.emphasis).toBe('+228%');
    } else {
      throw new Error('Expected cashmom chip to be positive');
    }
  });

  it('uses a warning chip for negative Cash MoM', () => {
    const chips = deriveChips({ streakDays: 0, cashMoMPct: -12 });
    expect(chips.find((c) => c.id === 'cashmom')).toBeUndefined();
    const mom = chips.find((c) => c.id === 'cashmom-down');
    expect(mom).toMatchObject({
      kind: 'warning',
      body: 'Cash MoM -12%',
    });
  });

  it('adds a sync chip with human-readable time', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const chips = deriveChips({ streakDays: 0, monarchSyncedAt: oneHourAgo });
    const sync = chips.find((c) => c.id === 'sync');
    expect(sync).toBeDefined();
    expect(sync?.body).toMatch(/1h ago/);
  });

  it('omits the sync chip for invalid timestamps', () => {
    const chips = deriveChips({ streakDays: 0, monarchSyncedAt: 'not-a-date' });
    expect(chips.find((c) => c.id === 'sync')).toBeUndefined();
  });
});
