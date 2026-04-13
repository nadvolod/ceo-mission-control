import type { DailyHealthNote, HealthNotesData } from './types';
import { loadJSON, saveJSON, appendAuditLog } from './storage';

const STORAGE_KEY = 'health-notes.json';

function defaultData(): HealthNotesData {
  return {
    notes: {},
    supplementTemplate: [
      { name: 'Guanfacine', defaultDosageMg: 1 },
      { name: 'Advil PM', defaultDosageMg: 25 },
      { name: 'Adderall', defaultDosageMg: 20 },
    ],
    habitTemplate: [
      { name: 'Red light therapy' },
      { name: 'Phone before bed' },
    ],
    environmentTemplate: { customFieldNames: [] },
    lastUpdated: '',
  };
}

export class HealthNotesTracker {
  private data: HealthNotesData = defaultData();

  private constructor() {}

  static async create(): Promise<HealthNotesTracker> {
    const tracker = new HealthNotesTracker();
    await tracker.loadData();
    return tracker;
  }

  private async loadData(): Promise<void> {
    const stored = await loadJSON(STORAGE_KEY, defaultData());
    this.data = {
      ...defaultData(),
      ...stored,
      environmentTemplate: { ...defaultData().environmentTemplate, ...(stored.environmentTemplate || {}) },
    };
  }

  private async saveData(): Promise<void> {
    this.data.lastUpdated = new Date().toISOString();
    await saveJSON(STORAGE_KEY, this.data);
  }

  async logNote(note: Omit<DailyHealthNote, 'loggedAt'>): Promise<DailyHealthNote> {
    if (!note.date || !/^\d{4}-\d{2}-\d{2}$/.test(note.date)) {
      throw new Error('date must be a valid YYYY-MM-DD string');
    }

    const fullNote: DailyHealthNote = {
      ...note,
      loggedAt: new Date().toISOString(),
    };

    this.data.notes[note.date] = fullNote;
    await this.saveData();

    await appendAuditLog(
      note.date,
      'health-notes',
      `Morning log: ${note.supplements.filter(s => s.taken).map(s => `${s.name} ${s.dosageMg}mg`).join(', ') || 'no supplements'}`
    );

    console.log('Health note logged:', { date: note.date });
    return fullNote;
  }

  getNoteForDate(date: string): DailyHealthNote | null {
    return this.data.notes[date] || null;
  }

  getNotesForRange(startDate: string, endDate: string): DailyHealthNote[] {
    return Object.values(this.data.notes)
      .filter(n => n.date >= startDate && n.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getTemplates() {
    return {
      supplementTemplate: this.data.supplementTemplate,
      habitTemplate: this.data.habitTemplate,
      environmentTemplate: this.data.environmentTemplate,
    };
  }

  async addSupplement(name: string, defaultDosageMg: number): Promise<void> {
    if (this.data.supplementTemplate.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Supplement "${name}" already exists`);
    }
    this.data.supplementTemplate.push({ name, defaultDosageMg });
    await this.saveData();
  }

  async removeSupplement(name: string): Promise<void> {
    this.data.supplementTemplate = this.data.supplementTemplate.filter(s => s.name !== name);
    await this.saveData();
  }

  async addHabit(name: string): Promise<void> {
    if (this.data.habitTemplate.some(h => h.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Habit "${name}" already exists`);
    }
    this.data.habitTemplate.push({ name });
    await this.saveData();
  }

  async removeHabit(name: string): Promise<void> {
    this.data.habitTemplate = this.data.habitTemplate.filter(h => h.name !== name);
    await this.saveData();
  }

  async addEnvironmentField(name: string): Promise<void> {
    if (this.data.environmentTemplate.customFieldNames.some(f => f.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Environment field "${name}" already exists`);
    }
    this.data.environmentTemplate.customFieldNames.push(name);
    await this.saveData();
  }

  async removeEnvironmentField(name: string): Promise<void> {
    this.data.environmentTemplate.customFieldNames = this.data.environmentTemplate.customFieldNames.filter(f => f !== name);
    await this.saveData();
  }

  getAllData(): HealthNotesData {
    return this.data;
  }
}
