import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReflectionDrawer } from '../ReflectionDrawer';
import type { ThreeToThriveApiResponse } from '@/hooks/useDashboardData';

const QUESTIONS = [
  'How can I live with even more courage and determination?',
  'How can I serve even more?',
  'What would I do differently if I could live my day over?',
];

function data(): ThreeToThriveApiResponse {
  return {
    success: true,
    todaysEntry: {
      date: '2026-05-27',
      questions: QUESTIONS,
      answers: [],
    },
    history: [],
    timestamp: '2026-05-27T12:00:00.000Z',
  };
}

// Reproduces the real production data flow: a successful save calls
// setThreeToThriveData with the SERVER-TRIMMED answer (three-to-thrive.ts
// trims on save), which flows back into ReflectionDrawer as a new `data`
// prop while the drawer is still open.
function dataWithAnswer(question: string, answer: string): ThreeToThriveApiResponse {
  return {
    success: true,
    todaysEntry: {
      date: '2026-05-27',
      questions: QUESTIONS,
      answers: [{ id: '1', date: '2026-05-27', question, answer, answeredAt: '2026-05-27T12:00:00.000Z' }],
    },
    history: [],
    timestamp: '2026-05-27T12:00:01.000Z',
  };
}

describe('ReflectionDrawer', () => {
  it('flushes pending debounced answers before closing', async () => {
    const onSave = jest.fn(async () => {});
    const onOpenChange = jest.fn();

    render(
      <ReflectionDrawer
        open
        onOpenChange={onOpenChange}
        data={data()}
        onSave={onSave}
      />,
    );

    const input = screen.getByTestId('reflection-input-0');
    fireEvent.change(input, { target: { value: 'fresh answer' } });
    await waitFor(() => expect(input).toHaveValue('fresh answer'));

    fireEvent.click(screen.getByTestId('reflection-save-close'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        QUESTIONS[0],
        'fresh answer',
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('does not clobber in-progress typing (including spaces) when a save round-trip updates the data prop', async () => {
    const onSave = jest.fn(async () => {});
    const onOpenChange = jest.fn();

    const { rerender } = render(
      <ReflectionDrawer
        open
        onOpenChange={onOpenChange}
        data={data()}
        onSave={onSave}
      />,
    );

    const input = screen.getByTestId('reflection-input-0');
    const paddedValue = '  hello world  ';
    fireEvent.change(input, { target: { value: paddedValue } });
    await waitFor(() => expect(input).toHaveValue(paddedValue));

    // Simulate the autosave completing and the parent's threeToThriveData
    // state updating with the server-trimmed answer (three-to-thrive.ts
    // trims on save) — this is what useDashboardData.handleSaveThreeToThriveAnswer
    // does on every successful save while the drawer is still open.
    rerender(
      <ReflectionDrawer
        open
        onOpenChange={onOpenChange}
        data={dataWithAnswer(QUESTIONS[0], paddedValue.trim())}
        onSave={onSave}
      />,
    );

    // Give the rehydration effect's requestAnimationFrame a real chance to
    // run before asserting — otherwise a passing assertion could just mean
    // the effect hasn't fired yet, not that it's guarded correctly.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // The user's in-progress typing (with its spaces) must survive the
    // parent re-render — it must NOT snap back to the trimmed server value.
    expect(input).toHaveValue(paddedValue);
  });

  it('does not send an overlapping save request while an earlier save for the same question is still in flight', async () => {
    jest.useFakeTimers();
    try {
      let resolveFirstSave: (() => void) | undefined;
      const onSave = jest.fn((_date: string, _question: string, value: string) => {
        if (value === 'first value') {
          return new Promise<void>((resolve) => {
            resolveFirstSave = resolve;
          });
        }
        return Promise.resolve();
      });
      const onOpenChange = jest.fn();

      render(
        <ReflectionDrawer
          open
          onOpenChange={onOpenChange}
          data={data()}
          onSave={onSave}
        />,
      );

      const input = screen.getByTestId('reflection-input-0');

      fireEvent.change(input, { target: { value: 'first value' } });
      jest.advanceTimersByTime(600);
      await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.any(String), QUESTIONS[0], 'first value'));

      // Type a newer value while the first save is still unresolved. The
      // second network write must not fire until the first request has
      // settled — otherwise two overlapping requests can race at the
      // storage layer and the older, slower one can win, silently
      // reverting the user's newer text server-side.
      fireEvent.change(input, { target: { value: 'first value latest' } });
      jest.advanceTimersByTime(600);
      expect(onSave).not.toHaveBeenCalledWith(expect.any(String), QUESTIONS[0], 'first value latest');

      resolveFirstSave?.();
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(expect.any(String), QUESTIONS[0], 'first value latest'),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
