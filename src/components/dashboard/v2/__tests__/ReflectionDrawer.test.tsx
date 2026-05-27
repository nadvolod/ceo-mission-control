import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
