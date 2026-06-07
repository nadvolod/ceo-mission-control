import { act, renderHook, waitFor } from '@testing-library/react';
import { useMissionStore } from '../useMissionStore';

// Mock the underlying dashboard hook so we only exercise the v2 wrapper.
const mockLoadAllData = jest.fn(async () => {});
const mockLoadWeeklyTracker = jest.fn(async () => {});
const mockSaveT3T = jest.fn(async () => {});

jest.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    monarchData: null,
    focusData: null,
    financialData: null,
    weeklyTrackerData: null,
    threeToThriveData: null,
    isLoading: false,
    loadAllData: mockLoadAllData,
    loadWeeklyTracker: mockLoadWeeklyTracker,
    handleSaveThreeToThriveAnswer: mockSaveT3T,
  }),
}));

describe('useMissionStore.log', () => {
  beforeEach(() => {
    // clearAllMocks resets call history but NOT implementations — a prior
    // test's `.mockImplementation(...)` would leak into the next case.
    // Reset both explicitly so each test starts from the immediate-
    // resolve default.
    jest.clearAllMocks();
    mockLoadAllData.mockReset();
    mockLoadAllData.mockImplementation(async () => {});
    mockLoadWeeklyTracker.mockReset();
    mockLoadWeeklyTracker.mockImplementation(async () => {});
    mockSaveT3T.mockReset();
    mockSaveT3T.mockImplementation(async () => {});
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }),
    ) as unknown as typeof fetch;
  });

  it('posts to /api/focus-hours with category=Temporal for temporal logs', async () => {
    const { result } = renderHook(() => useMissionStore());
    await act(async () => {
      await result.current.log('temporal', 1, '+1h');
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('/api/focus-hours');
    const body = JSON.parse(calls[0][1].body);
    expect(body.action).toBe('addSession');
    expect(body.category).toBe('Temporal');
    expect(body.hours).toBe(1);
    expect(mockLoadAllData).toHaveBeenCalled();
  });

  // Every log POST must carry the client's local YYYY-MM-DD so the server
  // doesn't fall back to UTC and put the row on the wrong day. If any of
  // the four log paths regresses this guarantee, the matching assertion
  // below will fail.
  describe('every log path includes the client-local date', () => {
    const cases = [
      ['temporal',   '/api/focus-hours',  1,    '+1h']        as const,
      ['deepWork',   '/api/focus-hours',  0.5,  '+0.5h']      as const,
      ['moneyMoved', '/api/financial',    500,  '+ Moved']    as const,
      ['trained',    '/api/weekly-tracker', 1,  '+ Session']  as const,
    ];
    it.each(cases)('%s → %s POST body has date YYYY-MM-DD', async (metricId, endpoint, delta, label) => {
      const { result } = renderHook(() => useMissionStore());
      await act(async () => {
        await result.current.log(metricId, delta, label);
      });
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === endpoint);
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body);
      expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // Hard rule: with all data sources empty (no Monarch, no focus, no
  // financial), no metric value should be non-zero. This is the regression
  // test for the fake-data leak that put $35.3K cash on every screen.
  it('initial metric snapshots are zero/empty when no data has loaded', () => {
    const { result } = renderHook(() => useMissionStore());
    for (const m of Object.values(result.current.metrics)) {
      expect(m.today).toBe(0);
      expect(m.week).toBeUndefined();
      expect(m.spark).toBeUndefined();
    }
    expect(result.current.activity).toEqual([]);
    // Default temporal goal is 5h (the legacy fallback when no review yet).
    expect(result.current.metrics.temporal.goal).toBe(5);
    // Display label is "Temporal Focus", not the bare "Temporal".
    expect(result.current.metrics.temporal.label).toBe('Temporal Focus');
  });

  // Verify the optimistic ActivityEntry now carries `tsMs` so
  // deriveActivity can sort across day boundaries. This is the unit
  // counterpart to the cross-day regression suite in derive.test.ts.
  it('optimistic activity entries carry an epoch-ms timestamp (tsMs)', async () => {
    let releaseRefresh!: () => void;
    mockLoadAllData.mockImplementationOnce(
      () => new Promise<void>((res) => { releaseRefresh = () => res(); }),
    );
    const { result } = renderHook(() => useMissionStore());
    const before = Date.now();
    let p!: Promise<void>;
    act(() => {
      p = result.current.log('moneyMoved', 100, '+ Moved');
    });
    await waitFor(() => {
      expect(result.current.activity).toHaveLength(1);
    });
    const after = Date.now();
    const row = result.current.activity[0];
    expect(typeof row.tsMs).toBe('number');
    expect(row.tsMs).toBeGreaterThanOrEqual(before);
    expect(row.tsMs).toBeLessThanOrEqual(after);

    await act(async () => {
      releaseRefresh();
      await p;
    });
  });

  it('posts to /api/financial with the right category from the label', async () => {
    const { result } = renderHook(() => useMissionStore());
    await act(async () => {
      await result.current.log('moneyMoved', 2000, '+ Generated');
    });
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.category).toBe('generated');
    expect(body.amount).toBe(2000);
  });

  it('posts to /api/focus-hours with category=Other for deepWork', async () => {
    const { result } = renderHook(() => useMissionStore());
    await act(async () => {
      await result.current.log('deepWork', 0.5, '+0.5h');
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('/api/focus-hours');
    const body = JSON.parse(calls[0][1].body);
    expect(body.category).toBe('Other');
  });

  it('sets trained additively without overwriting weekly-tracker totals', async () => {
    const { result } = renderHook(() => useMissionStore());
    await act(async () => {
      await result.current.log('trained', 1, '+ Session');
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('/api/weekly-tracker');
    const body = JSON.parse(calls[0][1].body);
    expect(body).toMatchObject({
      action: 'addToDay',
      deepWorkDelta: 0,
      pipelineDelta: 0,
      setTrained: true,
    });
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rolls back the optimistic activity entry and surfaces a toast on failure', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) }),
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useMissionStore());
    await act(async () => {
      await result.current.log('temporal', 1, '+1h');
    });
    await waitFor(() => {
      expect(result.current.toast?.text).toBe('boom');
    });
    expect(result.current.activity).toHaveLength(0);
  });

  it('prepends an optimistic activity row on success before refresh resolves', async () => {
    let resolveRefresh: (() => void) | null = null;
    mockLoadAllData.mockImplementationOnce(
      () => new Promise<void>((res) => { resolveRefresh = () => res(); }),
    );

    const { result } = renderHook(() => useMissionStore());

    let logPromise!: Promise<void>;
    act(() => {
      logPromise = result.current.log('temporal', 1, '+1h');
    });

    // Optimistic row visible immediately.
    await waitFor(() => {
      expect(result.current.activity).toHaveLength(1);
    });
    expect(result.current.activity[0].delta).toBe('+1h');

    // Let the refresh resolve so the act() warning closes out cleanly.
    await act(async () => {
      resolveRefresh?.();
      await logPromise;
    });
  });

  it('clears the accepted optimistic entry even when refresh fails', async () => {
    mockLoadAllData.mockRejectedValueOnce(new Error('refresh down'));

    const { result } = renderHook(() => useMissionStore());

    await act(async () => {
      await result.current.log('temporal', 1, '+1h');
    });

    expect(result.current.activity).toHaveLength(0);
    expect(result.current.metrics.temporal.today).toBe(0);
    expect(result.current.toast?.text).toBe('refresh down');
  });

  it('commits only the completed optimistic entry while another log is in flight', async () => {
    const refreshResolvers: Array<() => void> = [];
    mockLoadAllData.mockImplementation(
      () => new Promise<void>((res) => { refreshResolvers.push(res); }),
    );

    const { result } = renderHook(() => useMissionStore());

    let temporalPromise!: Promise<void>;
    let deepWorkPromise!: Promise<void>;
    act(() => {
      temporalPromise = result.current.log('temporal', 1, '+1h');
      deepWorkPromise = result.current.log('deepWork', 0.5, '+0.5h');
    });

    await waitFor(() => {
      expect(result.current.activity).toHaveLength(2);
    });

    await act(async () => {
      refreshResolvers[0]();
      await temporalPromise;
    });

    expect(result.current.activity).toHaveLength(1);
    expect(result.current.activity[0].kind).toBe('deepWork');
    expect(result.current.metrics.deepWork.today).toBe(0.5);

    await act(async () => {
      refreshResolvers[1]();
      await deepWorkPromise;
    });

    expect(result.current.activity).toHaveLength(0);
  });

  // Money entries: the optimistic row should show $amount and the
  // user's note so the user sees their entry land immediately, with
  // the same shape the server-side row will have once the refresh
  // resolves. The earlier shape ("+ Moved Money moved | Quick log")
  // was confusing — users thought the log didn't take.
  describe('moneyMoved optimistic entry', () => {
    it('shows the dollar amount as the label (not "Money moved")', async () => {
      // Hold refresh open so the optimistic row is observable, then
      // release it cleanly at the end so the dangling promise doesn't
      // leak into the next test.
      let releaseRefresh!: () => void;
      mockLoadAllData.mockImplementationOnce(
        () => new Promise<void>((res) => { releaseRefresh = () => res(); }),
      );
      const { result } = renderHook(() => useMissionStore());
      let p!: Promise<void>;
      act(() => {
        p = result.current.log('moneyMoved', 1234.5, '+ Moved');
      });
      await waitFor(() => {
        expect(result.current.activity).toHaveLength(1);
      });
      const row = result.current.activity[0];
      expect(row.kind).toBe('moneyMoved');
      expect(row.delta).toBe('+ Moved');
      // Formatted with locale separators so the user sees "$1,234.5".
      expect(row.label).toBe('$1,234.5');
      // Default meta when no note supplied — matches what the server
      // entry will have after refresh.
      expect(row.meta).toBe('+ Moved via Mission Control');

      await act(async () => {
        releaseRefresh();
        await p;
      });
    });

    it('uses the user-supplied note as the meta when one is passed', async () => {
      let releaseRefresh!: () => void;
      mockLoadAllData.mockImplementationOnce(
        () => new Promise<void>((res) => { releaseRefresh = () => res(); }),
      );
      const { result } = renderHook(() => useMissionStore());
      let p!: Promise<void>;
      act(() => {
        p = result.current.log('moneyMoved', 500, '+ Generated', { description: 'Benepass' });
      });
      await waitFor(() => {
        expect(result.current.activity).toHaveLength(1);
      });
      expect(result.current.activity[0].meta).toBe('Benepass');

      await act(async () => {
        releaseRefresh();
        await p;
      });
    });

    it('forwards options.description to the /api/financial POST body', async () => {
      const { result } = renderHook(() => useMissionStore());
      await act(async () => {
        await result.current.log('moneyMoved', 250, '+ Cut', { description: 'office supplies' });
      });
      const call = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/financial');
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body);
      expect(body.category).toBe('cut');
      expect(body.amount).toBe(250);
      expect(body.description).toBe('office supplies');
    });

    it('falls back to the auto-generated description when no note is provided', async () => {
      const { result } = renderHook(() => useMissionStore());
      await act(async () => {
        await result.current.log('moneyMoved', 100, '+ Moved');
      });
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      // Server requires non-empty description; the auto string keeps the
      // POST valid even when the user skipped the note input.
      expect(body.description).toBe('+ Moved via Mission Control');
    });
  });

  // refresh / refreshWeeklyTracker — the second is a targeted variant for
  // mutations that only touch the weekly-tracker slice (the inline Temporal
  // goal edit). It must NOT trigger the full loadAllData fetch.
  describe('refresh variants', () => {
    it('refresh() invokes loadAllData (full dashboard reload)', async () => {
      const { result } = renderHook(() => useMissionStore());
      await act(async () => {
        await result.current.refresh();
      });
      expect(mockLoadAllData).toHaveBeenCalledTimes(1);
      expect(mockLoadWeeklyTracker).not.toHaveBeenCalled();
    });

    it('refreshWeeklyTracker() invokes only loadWeeklyTracker', async () => {
      const { result } = renderHook(() => useMissionStore());
      await act(async () => {
        await result.current.refreshWeeklyTracker();
      });
      expect(mockLoadWeeklyTracker).toHaveBeenCalledTimes(1);
      expect(mockLoadAllData).not.toHaveBeenCalled();
    });
  });
});
