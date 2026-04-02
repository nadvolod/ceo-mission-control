import type { AiTask, Initiative, DailyScorecard } from './types';

/**
 * Enrich a DailyScorecard with auto-derived values from tasks and initiatives.
 * Only fills in empty/missing fields — manual entries always take priority.
 */
export function enrichScorecard(
  scorecard: DailyScorecard,
  tasks: AiTask[],
  initiatives: Initiative[]
): DailyScorecard {
  const activeTasks = getActiveTasks(tasks);

  const derivedPriorities = deriveTopPriorities(activeTasks);
  const derivedMoneyMove = deriveMoneyMove(activeTasks, initiatives);
  const derivedStrategicMove = deriveStrategicMove(activeTasks, initiatives);
  const derivedRiskMove = deriveRiskMove(activeTasks);

  // Use the final priorities (manual or derived) for focus blocks
  const finalPriorities =
    scorecard.priorities.length > 0 ? scorecard.priorities : derivedPriorities;
  const derivedFocusBlocks = deriveFocusBlocks(finalPriorities);

  return {
    ...scorecard,
    priorities:
      scorecard.priorities.length > 0 ? scorecard.priorities : derivedPriorities,
    majorMoneyMove: scorecard.majorMoneyMove || derivedMoneyMove,
    strategicMove: scorecard.strategicMove || derivedStrategicMove,
    taxesMove: scorecard.taxesMove || derivedRiskMove,
    focusBlocks:
      scorecard.focusBlocks.length > 0 ? scorecard.focusBlocks : derivedFocusBlocks,
  };
}

/** Filter to active (todo/doing), non-child tasks */
function getActiveTasks(tasks: AiTask[]): AiTask[] {
  return tasks.filter(
    (t) => (t.status === 'todo' || t.status === 'doing') && t.parentId == null
  );
}

/** Top 3 tasks by priorityScore */
function deriveTopPriorities(tasks: AiTask[]): string[] {
  return [...tasks]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3)
    .map(formatTaskLabel);
}

/** Highest monetaryValue task, fallback to Revenue category, fallback to initiative */
function deriveMoneyMove(tasks: AiTask[], initiatives: Initiative[]): string {
  // Try highest monetaryValue task
  const moneyTasks = tasks
    .filter((t) => t.monetaryValue != null && t.monetaryValue > 0)
    .sort((a, b) => (b.monetaryValue ?? 0) - (a.monetaryValue ?? 0));

  if (moneyTasks.length > 0) {
    const t = moneyTasks[0];
    return `${t.title} ($${(t.monetaryValue ?? 0).toLocaleString()})`;
  }

  // Fallback: highest priority Revenue-category task
  const revenueTasks = tasks
    .filter((t) => t.category?.toLowerCase() === 'revenue')
    .sort((a, b) => b.priorityScore - a.priorityScore);

  if (revenueTasks.length > 0) {
    return revenueTasks[0].title;
  }

  // Fallback: top initiative by money score
  const topInit = [...initiatives]
    .sort((a, b) => b.money - a.money)
    .find((i) => i.nextMove);

  if (topInit) {
    return `${topInit.name} — ${topInit.nextMove}`;
  }

  return '';
}

/** Highest strategicValue task, fallback to initiative */
function deriveStrategicMove(tasks: AiTask[], initiatives: Initiative[]): string {
  const strategicTasks = tasks
    .filter((t) => t.strategicValue != null && t.strategicValue > 0)
    .sort((a, b) => (b.strategicValue ?? 0) - (a.strategicValue ?? 0));

  if (strategicTasks.length > 0) {
    return strategicTasks[0].title;
  }

  // Fallback: top initiative by strategic score
  const topInit = [...initiatives]
    .sort((a, b) => b.strategic - a.strategic)
    .find((i) => i.nextMove);

  if (topInit) {
    return `${topInit.name} — ${topInit.nextMove}`;
  }

  return '';
}

/** Tax/Risk category task, fallback to most overdue task */
function deriveRiskMove(tasks: AiTask[]): string {
  const riskTasks = tasks
    .filter((t) => {
      const cat = (t.category || '').toLowerCase();
      return cat.includes('tax') || cat.includes('risk');
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  if (riskTasks.length > 0) {
    return riskTasks[0].title;
  }

  // Fallback: most overdue task
  const now = new Date();
  const overdueTasks = tasks
    .filter((t) => t.dueDate && new Date(t.dueDate) < now)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  if (overdueTasks.length > 0) {
    const t = overdueTasks[0];
    const daysOverdue = Math.ceil(
      (now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
    );
    return `${t.title} (overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''})`;
  }

  return '';
}

/** Generate 90-minute time blocks from priorities */
function deriveFocusBlocks(priorities: string[]): string[] {
  const timeSlots = [
    { start: '9:00', end: '10:30' },
    { start: '11:00', end: '12:30' },
    { start: '13:30', end: '15:00' },
  ];

  return priorities.slice(0, 3).map((priority, i) => {
    const slot = timeSlots[i];
    return `${slot.start}–${slot.end} — ${priority}`;
  });
}

/** Format a task as a readable label */
function formatTaskLabel(task: AiTask): string {
  const parts: string[] = [];
  if (task.category) {
    parts.push(`[${task.category}]`);
  }
  parts.push(task.title);
  if (task.monetaryValue && task.monetaryValue > 0) {
    parts.push(`($${task.monetaryValue.toLocaleString()})`);
  }
  return parts.join(' ');
}
