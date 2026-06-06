import { render, screen } from '@testing-library/react';
import { ActivityDetailSheet } from '../ActivityDetailSheet';

it('renders morning detail with full sleep info', () => {
  render(
    <ActivityDetailSheet
      open
      onOpenChange={() => {}}
      detail={{
        source: 'morning',
        title: 'Morning Log · Jun 5, 2026',
        note: {
          date: '2026-06-05',
          sleepEnvironment: { temperatureF: 67, fanRunning: true, dogInRoom: false, customFields: {} },
          sleepMetrics: { sleepScore: 87, durationMinutes: 442, bodyBattery: 95, restingHeartRate: 50, hrv: 40 },
          supplements: [{ name: 'Adderall', dosageMg: 20, taken: true }],
          habits: [{ name: 'Red light', done: true }],
          freeformNote: 'slept well',
          loggedAt: '2026-06-05T08:14:00.000Z',
        },
      }}
      onEdit={() => {}}
    />,
  );
  expect(screen.getByText('87')).toBeInTheDocument();
  expect(screen.getByText(/Adderall/)).toBeInTheDocument();
  expect(screen.getByText(/slept well/)).toBeInTheDocument();
});

it('renders reflection detail with questions and answers', () => {
  render(
    <ActivityDetailSheet
      open
      onOpenChange={() => {}}
      detail={{
        source: 'reflection',
        title: 'Reflection · Jun 5, 2026',
        entry: {
          date: '2026-06-05',
          questions: ['What went well?', 'What to improve?'],
          answers: [{ id: '1', date: '2026-06-05', question: 'What went well?', answer: 'shipped feature', answeredAt: '2026-06-05T21:00:00.000Z' }],
        },
      }}
      onEdit={() => {}}
    />,
  );
  expect(screen.getByText('What went well?')).toBeInTheDocument();
  expect(screen.getByText(/shipped feature/)).toBeInTheDocument();
});

it('renders an empty fallback when the record is missing', () => {
  render(
    <ActivityDetailSheet
      open
      onOpenChange={() => {}}
      detail={{ source: 'morning', title: 'Morning Log', note: null }}
      onEdit={() => {}}
    />,
  );
  expect(screen.getByText(/no data/i)).toBeInTheDocument();
});
