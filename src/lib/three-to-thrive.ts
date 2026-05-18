import { format } from 'date-fns';
import type { ThreeToThriveData, ThreeToThriveEntry, ThreeToThriveAnswer } from './types';
import { loadJSON, saveJSON } from './storage';
import { randomUUID } from 'crypto';

const STORAGE_KEY = 'three-to-thrive.json';

export const MANDATORY_QUESTIONS: readonly string[] = [
  'How can I live with even more courage and determination?',
  'How can I serve even more?',
];

export const RANDOM_QUESTION_POOL: readonly string[] = [
  'Am I having fun?',
  'Did I live with level 10 energy? Who must I become to live with level 10 energy 6/7 days?',
  'Was I my best yesterday (1-10)?',
  'How can I love even more (3 human needs)?',
  'How can I grow even more?',
  'Who should I spend more time with and why?',
  'What would I do differently if I could live my day over?',
  'What kind of man do I want to be?',
  'If I could do only 3 things, what are the most important things for today? Why?',
  'How does a Principal Developer Advocate behave?',
  'How does an abundant person behave?',
  'What would I fill my time with if I wasn\'t spending all of it at work?',
];

/**
 * Deterministically pick a random question for a given date string (YYYY-MM-DD).
 * The same question will be returned for the same date every time.
 */
export function pickRandomQuestion(date: string): string {
  // Simple hash: sum of char codes of the date string
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  }
  const index = hash % RANDOM_QUESTION_POOL.length;
  return RANDOM_QUESTION_POOL[index];
}

/**
 * Returns the three questions for a given date.
 */
export function getQuestionsForDate(date: string): string[] {
  return [...MANDATORY_QUESTIONS, pickRandomQuestion(date)];
}

function defaultData(): ThreeToThriveData {
  return { entries: {}, lastUpdated: new Date().toISOString() };
}

export class ThreeToThriveTracker {
  private data: ThreeToThriveData = defaultData();
  private readonly ownerId: string;

  private constructor(ownerId: string) {
    this.ownerId = ownerId;
  }

  static async create(ownerId: string): Promise<ThreeToThriveTracker> {
    const tracker = new ThreeToThriveTracker(ownerId);
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    this.data = await loadJSON(this.ownerId, STORAGE_KEY, defaultData());
    if (!this.data.entries) {
      this.data.entries = {};
    }
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(this.ownerId, STORAGE_KEY, this.data);
  }

  /**
   * Returns the entry for the given date (or today if omitted). If no entry has
   * been persisted yet, returns a freshly-computed one without mutating internal
   * state — the entry is only persisted once an answer is saved against it.
   */
  getTodaysEntry(date?: string): ThreeToThriveEntry {
    const today = date || format(new Date(), 'yyyy-MM-dd');
    return (
      this.data.entries[today] ?? {
        date: today,
        questions: getQuestionsForDate(today),
        answers: [],
      }
    );
  }

  /**
   * Save an answer for a specific question on a given date.
   * If an answer for that question already exists, it is replaced.
   */
  async saveAnswer(date: string, question: string, answer: string): Promise<ThreeToThriveAnswer> {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('date must be a valid YYYY-MM-DD string');
    }
    if (typeof question !== 'string' || question.trim().length === 0) {
      throw new Error('question must be a non-empty string');
    }
    if (typeof answer !== 'string') {
      throw new Error('answer must be a string');
    }

    // Materialize the entry in storage so subsequent reads see this answer.
    if (!this.data.entries[date]) {
      this.data.entries[date] = {
        date,
        questions: getQuestionsForDate(date),
        answers: [],
      };
    }
    const entry = this.data.entries[date];

    // Upsert: replace existing answer for this question if present
    const existing = entry.answers.findIndex(a => a.question === question);
    const record: ThreeToThriveAnswer = {
      id: existing >= 0 ? entry.answers[existing].id : randomUUID(),
      date,
      question,
      answer: answer.trim(),
      answeredAt: new Date().toISOString(),
    };

    if (existing >= 0) {
      entry.answers[existing] = record;
    } else {
      entry.answers.push(record);
    }

    await this.saveData();
    return record;
  }

  /**
   * Returns all historical entries, sorted most-recent first.
   */
  getHistory(limit?: number): ThreeToThriveEntry[] {
    const all = Object.values(this.data.entries).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    return limit ? all.slice(0, limit) : all;
  }

  getAllData(): ThreeToThriveData {
    return this.data;
  }
}
