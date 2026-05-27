import { act, renderHook, waitFor } from '@testing-library/react';
import { useMissionStore } from '../useMissionStore';

// Mock the underlying dashboard hook so we only exercise the v2 wrapper.
const mockLoadAllData = jest.fn(async () => {});
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
    handleSaveThreeToThriveAnswer: mockSaveT3T,
  }),
}));

describe('useMissionStore.log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }),
    ) as unknown as typeof fetch;
  });

  it('posts to /api/temporal with addSession for temporal logs', async () => {
    const { result } = renderHook(() => useMissionStore());
    await act(async () => {
      await result.current.log('temporal', 1, '+1h');
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('/api/temporal');
    const body = JSON.parse(calls[0][1].body);
    expect(body.action).toBe('addSession');
    expect(body.hours).toBe(1);
    expect(mockLoadAllData).toHaveBeenCalled();
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
});
