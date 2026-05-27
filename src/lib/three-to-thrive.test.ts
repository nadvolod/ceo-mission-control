/**
 * @jest-environment node
 */

jest.mock('./storage', () => {
  let store: Record<string, any> = {};
  return {
    loadJSON: jest.fn(async (_ownerId: string, key: string, defaultValue: any) => store[key] ?? defaultValue),
    saveJSON: jest.fn(async (_ownerId: string, key: string, data: any) => { store[key] = data; }),
    appendAuditLog: jest.fn(async () => {}),
    _reset: () => { store = {}; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require('./storage');

import {
  ThreeToThriveTracker,
  pickRandomQuestion,
  getQuestionsForDate,
  MANDATORY_QUESTIONS,
  RANDOM_QUESTION_POOL,
} from './three-to-thrive';
import { UNIT_TEST_OWNER_ID } from '@/__tests__/utils/owner-id';

describe('pickRandomQuestion', () => {
  it('returns a question from the pool', () => {
    const q = pickRandomQuestion('2026-05-15');
    expect(RANDOM_QUESTION_POOL).toContain(q);
  });

  it('is deterministic for the same date', () => {
    expect(pickRandomQuestion('2026-05-15')).toBe(pickRandomQuestion('2026-05-15'));
  });

  it('can return different questions for different dates', () => {
    const results = new Set(
      ['2026-01-01','2026-02-01','2026-03-01','2026-04-01','2026-05-01','2026-06-01'].map(pickRandomQuestion)
    );
    // At least 2 different questions across 6 different dates
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('getQuestionsForDate', () => {
  it('returns exactly 3 questions', () => {
    const qs = getQuestionsForDate('2026-05-15');
    expect(qs).toHaveLength(3);
  });

  it('starts with the two mandatory questions', () => {
    const qs = getQuestionsForDate('2026-05-15');
    expect(qs[0]).toBe(MANDATORY_QUESTIONS[0]);
    expect(qs[1]).toBe(MANDATORY_QUESTIONS[1]);
  });

  it('third question is from the random pool', () => {
    const qs = getQuestionsForDate('2026-05-15');
    expect(RANDOM_QUESTION_POOL).toContain(qs[2]);
  });
});

describe('ThreeToThriveTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage._reset();
  });

  describe('getTodaysEntry', () => {
    it('creates an entry for the given date with 3 questions', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      const entry = tracker.getTodaysEntry('2026-05-15');

      expect(entry.date).toBe('2026-05-15');
      expect(entry.questions).toHaveLength(3);
      expect(entry.answers).toHaveLength(0);
    });

    it('returns equivalent entries on repeated calls', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      const a = tracker.getTodaysEntry('2026-05-15');
      const b = tracker.getTodaysEntry('2026-05-15');
      expect(a.date).toBe(b.date);
      expect(a.questions).toEqual(b.questions);
      expect(a.answers).toEqual(b.answers);
    });

    it('does not persist a new entry until an answer is saved', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      tracker.getTodaysEntry('2026-05-15');
      expect(storage.saveJSON).not.toHaveBeenCalled();
      expect(tracker.getHistory()).toHaveLength(0);
    });
  });

  describe('saveAnswer', () => {
    it('saves an answer and returns a record', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      const question = MANDATORY_QUESTIONS[0];
      const answer = await tracker.saveAnswer('2026-05-15', question, 'My answer');

      expect(answer.date).toBe('2026-05-15');
      expect(answer.question).toBe(question);
      expect(answer.answer).toBe('My answer');
      expect(answer.id).toBeTruthy();
      expect(answer.answeredAt).toBeTruthy();
      expect(storage.saveJSON).toHaveBeenCalled();
    });

    it('upserts an existing answer for the same question', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      const question = MANDATORY_QUESTIONS[0];
      const first = await tracker.saveAnswer('2026-05-15', question, 'First answer');
      const second = await tracker.saveAnswer('2026-05-15', question, 'Updated answer');

      expect(second.id).toBe(first.id);
      expect(second.answer).toBe('Updated answer');

      const entry = tracker.getTodaysEntry('2026-05-15');
      const answers = entry.answers.filter(a => a.question === question);
      expect(answers).toHaveLength(1);
      expect(answers[0].answer).toBe('Updated answer');
    });

    it('trims whitespace from answers', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      const answer = await tracker.saveAnswer('2026-05-15', MANDATORY_QUESTIONS[0], '  hello  ');
      expect(answer.answer).toBe('hello');
    });

    it('throws on invalid date format', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.saveAnswer('not-a-date', MANDATORY_QUESTIONS[0], 'x'))
        .rejects.toThrow('date must be a valid YYYY-MM-DD string');
    });

    it('throws on empty question', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.saveAnswer('2026-05-15', '  ', 'x'))
        .rejects.toThrow('question must be a non-empty string');
    });

    it('throws when answer is not a string', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      await expect(tracker.saveAnswer('2026-05-15', MANDATORY_QUESTIONS[0], null as any))
        .rejects.toThrow('answer must be a string');
    });
  });

  describe('getHistory', () => {
    it('returns entries sorted most-recent first', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      await tracker.saveAnswer('2026-05-13', MANDATORY_QUESTIONS[0], 'a');
      await tracker.saveAnswer('2026-05-15', MANDATORY_QUESTIONS[0], 'b');
      await tracker.saveAnswer('2026-05-14', MANDATORY_QUESTIONS[0], 'c');

      const history = tracker.getHistory();
      expect(history[0].date).toBe('2026-05-15');
      expect(history[1].date).toBe('2026-05-14');
      expect(history[2].date).toBe('2026-05-13');
    });

    it('limits results when limit is provided', async () => {
      const tracker = await ThreeToThriveTracker.create(UNIT_TEST_OWNER_ID);
      for (let i = 1; i <= 5; i++) {
        await tracker.saveAnswer(`2026-05-${String(i).padStart(2, '0')}`, MANDATORY_QUESTIONS[0], `ans${i}`);
      }
      const history = tracker.getHistory(3);
      expect(history).toHaveLength(3);
    });
  });
});
