import { enrichScorecard } from './derive-focus';
import type { AiTask, Initiative, DailyScorecard } from './types';

function makeTask(overrides: Partial<AiTask> = {}): AiTask {
  return {
    id: 1,
    title: 'Test Task',
    description: null,
    status: 'todo',
    priorityScore: 50,
    priorityReason: null,
    monetaryValue: null,
    revenuePotential: null,
    urgency: null,
    strategicValue: null,
    dueDate: null,
    category: null,
    assignee: null,
    parentId: null,
    recurrenceRule: null,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: 'init-1',
    rank: 1,
    name: 'Test Initiative',
    type: '',
    goal: '',
    money: 5,
    strategic: 5,
    urgency: 5,
    leverage: 5,
    time: 5,
    risk: 5,
    total: 30,
    bottleneck: '',
    nextMove: 'Do the next thing',
    payoff: '',
    confidence: '',
    deprioritize: '',
    status: 'In Progress',
    tasks: [],
    ...overrides,
  };
}

function emptyScorecard(): DailyScorecard {
  return {
    date: '2026-04-02',
    priorities: [],
    temporalTarget: 0,
    focusBlocks: [],
    majorMoneyMove: '',
    strategicMove: '',
    taxesMove: '',
    ignoreList: [],
    biggestBlocker: '',
    wins: [],
    misses: [],
    openLoops: [],
    moneyAdvanced: '',
  };
}

describe('enrichScorecard', () => {
  it('derives top 3 priorities from highest priority tasks', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Low task', priorityScore: 10 }),
      makeTask({ id: 2, title: 'High task', priorityScore: 90, category: 'Revenue' }),
      makeTask({ id: 3, title: 'Medium task', priorityScore: 50 }),
      makeTask({ id: 4, title: 'Critical task', priorityScore: 95 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.priorities).toHaveLength(3);
    expect(result.priorities[0]).toContain('Critical task');
    expect(result.priorities[1]).toContain('High task');
    expect(result.priorities[2]).toContain('Medium task');
  });

  it('preserves manual priorities when present', () => {
    const scorecard = { ...emptyScorecard(), priorities: ['Manual P1', 'Manual P2'] };
    const tasks = [makeTask({ title: 'Auto task', priorityScore: 99 })];

    const result = enrichScorecard(scorecard, tasks, []);

    expect(result.priorities).toEqual(['Manual P1', 'Manual P2']);
  });

  it('derives major money move from highest monetaryValue task', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Small deal', monetaryValue: 1000 }),
      makeTask({ id: 2, title: 'Big deal', monetaryValue: 15000 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.majorMoneyMove).toContain('Big deal');
    expect(result.majorMoneyMove).toContain('$15,000');
  });

  it('falls back to Revenue category task for money move', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Revenue task', category: 'Revenue', priorityScore: 80 }),
      makeTask({ id: 2, title: 'Other task', category: 'Admin', priorityScore: 90 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.majorMoneyMove).toBe('Revenue task');
  });

  it('falls back to initiative for money move', () => {
    const initiatives = [
      makeInitiative({ name: 'WHO Contract', money: 9, nextMove: 'Send proposal' }),
    ];

    const result = enrichScorecard(emptyScorecard(), [], initiatives);

    expect(result.majorMoneyMove).toBe('WHO Contract — Send proposal');
  });

  it('derives strategic move from highest strategicValue task', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Strategic A', strategicValue: 8 }),
      makeTask({ id: 2, title: 'Strategic B', strategicValue: 3 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.strategicMove).toBe('Strategic A');
  });

  it('derives risk move from Tax category task', () => {
    const tasks = [
      makeTask({ id: 1, title: 'File taxes', category: 'Tax', priorityScore: 70 }),
      makeTask({ id: 2, title: 'Other task', priorityScore: 90 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.taxesMove).toBe('File taxes');
  });

  it('falls back to most overdue task for risk move', () => {
    const tasks = [
      makeTask({
        id: 1,
        title: 'Overdue task',
        dueDate: '2026-03-01',
      }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.taxesMove).toContain('Overdue task');
    expect(result.taxesMove).toContain('overdue by');
  });

  it('generates focus blocks from top priorities', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Task A', priorityScore: 90 }),
      makeTask({ id: 2, title: 'Task B', priorityScore: 80 }),
      makeTask({ id: 3, title: 'Task C', priorityScore: 70 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.focusBlocks).toHaveLength(3);
    expect(result.focusBlocks[0]).toMatch(/^9:00–10:30/);
    expect(result.focusBlocks[1]).toMatch(/^11:00–12:30/);
    expect(result.focusBlocks[2]).toMatch(/^13:30–15:00/);
  });

  it('excludes done tasks and child tasks', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Done task', status: 'done', priorityScore: 99 }),
      makeTask({ id: 2, title: 'Child task', parentId: 1, priorityScore: 98 }),
      makeTask({ id: 3, title: 'Active task', priorityScore: 50 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.priorities).toHaveLength(1);
    expect(result.priorities[0]).toContain('Active task');
  });

  it('preserves all manual overrides', () => {
    const scorecard: DailyScorecard = {
      ...emptyScorecard(),
      priorities: ['Manual P1'],
      majorMoneyMove: 'Manual money move',
      strategicMove: 'Manual strategic',
      taxesMove: 'Manual risk',
      focusBlocks: ['9:00-10:00 Manual block'],
    };

    const tasks = [makeTask({ title: 'Auto', priorityScore: 99, monetaryValue: 99999 })];

    const result = enrichScorecard(scorecard, tasks, []);

    expect(result.priorities).toEqual(['Manual P1']);
    expect(result.majorMoneyMove).toBe('Manual money move');
    expect(result.strategicMove).toBe('Manual strategic');
    expect(result.taxesMove).toBe('Manual risk');
    expect(result.focusBlocks).toEqual(['9:00-10:00 Manual block']);
  });

  it('handles empty tasks and initiatives gracefully', () => {
    const result = enrichScorecard(emptyScorecard(), [], []);

    expect(result.priorities).toEqual([]);
    expect(result.majorMoneyMove).toBe('');
    expect(result.strategicMove).toBe('');
    expect(result.taxesMove).toBe('');
    expect(result.focusBlocks).toEqual([]);
  });

  it('includes category and monetary value in task labels', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Close deal', category: 'Revenue', monetaryValue: 5000, priorityScore: 90 }),
    ];

    const result = enrichScorecard(emptyScorecard(), tasks, []);

    expect(result.priorities[0]).toBe('[Revenue] Close deal ($5,000)');
  });
});
