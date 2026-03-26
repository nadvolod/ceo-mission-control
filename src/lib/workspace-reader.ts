import matter from 'gray-matter';
import type { Initiative, DailyScorecard } from './types';
import { loadText, saveText } from './storage';

export async function readInitiatives(): Promise<Initiative[]> {
  try {
    const content = await loadText('INITIATIVES.md', '');
    if (!content) return [];

    // Parse markdown table
    const lines = content.split('\n');
    const initiatives: Initiative[] = [];

    let inTable = false;
    for (const line of lines) {
      if (line.startsWith('| Rank |')) {
        inTable = true;
        continue;
      }
      if (inTable && line.startsWith('|---')) continue;
      if (inTable && line.startsWith('|') && line.includes('|')) {
        const cols = line.split('|').map(col => col.trim()).filter(col => col);
        if (cols.length >= 8) {
          const name = cols[1] || '';
          initiatives.push({
            id: `initiative-${initiatives.length + 1}`,
            rank: parseInt(cols[0]) || 0,
            name,
            money: parseInt(cols[2]) || 0,
            strategic: parseInt(cols[3]) || 0,
            urgency: parseInt(cols[4]) || 0,
            leverage: parseInt(cols[5]) || 0,
            time: parseInt(cols[6]) || 0,
            risk: parseInt(cols[7]) || 0,
            total: parseInt(cols[8]) || 0,
            type: '',
            goal: '',
            bottleneck: '',
            nextMove: '',
            payoff: '',
            confidence: '',
            deprioritize: '',
            status: 'Not Started',
            tasks: []
          });
        }
      }
      if (inTable && !line.startsWith('|')) {
        inTable = false;
      }
    }

    // Parse detailed sections
    for (const initiative of initiatives) {
      const sectionRegex = new RegExp(`## \\d+\\)\\s*${initiative.name}([\\s\\S]*?)(?=## \\d+\\)|$)`, 'i');
      const match = content.match(sectionRegex);
      if (match) {
        const section = match[1];
        initiative.type = extractValue(section, 'Type:') || '';
        initiative.goal = extractValue(section, 'Goal:') || '';
        initiative.bottleneck = extractValue(section, 'Current bottleneck:') || '';
        initiative.nextMove = extractValue(section, 'Highest-leverage next move:') || '';
        initiative.payoff = extractValue(section, 'Expected payoff:') || '';
        initiative.confidence = extractValue(section, 'Confidence:') || '';
        initiative.deprioritize = extractValue(section, 'What to deprioritize because of it:') || '';
      }
    }

    return initiatives;
  } catch (error) {
    console.error('Error reading initiatives:', error);
    return [];
  }
}

export async function readDailyScorecard(): Promise<DailyScorecard | null> {
  try {
    const content = await loadText('DAILY_SCORECARD.md', '');
    if (!content) return null;

    return {
      date: extractValue(content, 'Date') || new Date().toISOString().split('T')[0],
      priorities: extractListItems(content, 'Top 3 priorities'),
      temporalTarget: parseFloat(extractValue(content, 'Target today:') || '0'),
      temporalActual: parseFloat(extractValue(content, 'Actual:') || '0') || undefined,
      focusBlocks: extractListItems(content, 'Focus blocks'),
      majorMoneyMove: extractValue(content, 'Major money move today') || '',
      strategicMove: extractValue(content, 'Strategic project move today') || '',
      taxesMove: extractValue(content, 'Taxes / risk reduction move today') || '',
      ignoreList: extractListItems(content, 'What to ignore today'),
      biggestBlocker: extractValue(content, 'Biggest blocker') || '',
      wins: extractListItems(content, 'Wins:'),
      misses: extractListItems(content, 'Misses:'),
      openLoops: extractListItems(content, 'Open loops:'),
      moneyAdvanced: extractValue(content, 'Money advanced:') || ''
    };
  } catch (error) {
    console.error('Error reading daily scorecard:', error);
    return null;
  }
}

// Scorecard field-to-section mapping for write operations
const SCORECARD_FIELD_MAP: Record<string, { section: string; isList: boolean }> = {
  priorities: { section: 'Top 2 priorities', isList: true },
  focusBlocks: { section: 'Focus blocks', isList: true },
  majorMoneyMove: { section: 'Major money move today', isList: false },
  strategicMove: { section: 'Strategic project move today', isList: false },
  taxesMove: { section: 'Taxes / risk reduction move today', isList: false },
  biggestBlocker: { section: 'Biggest blocker', isList: false },
  ignoreList: { section: 'What to ignore today', isList: true },
  temporalTarget: { section: 'Target today:', isList: false },
  temporalActual: { section: 'Actual:', isList: false },
};

/**
 * Update a single field in DAILY_SCORECARD.md.
 * For list fields, value should be string[]. For scalar fields, value should be string.
 */
export async function updateScorecardField(
  field: string,
  value: string | string[]
): Promise<DailyScorecard | null> {
  const mapping = SCORECARD_FIELD_MAP[field];
  if (!mapping) {
    throw new Error(`Unknown scorecard field: ${field}. Valid fields: ${Object.keys(SCORECARD_FIELD_MAP).join(', ')}`);
  }

  let content = await loadText('DAILY_SCORECARD.md', '');
  if (!content) {
    throw new Error('DAILY_SCORECARD.md not found');
  }

  if (mapping.isList) {
    const items = Array.isArray(value) ? value : [value];
    content = replaceScorecardList(content, mapping.section, items);
  } else {
    const scalar = Array.isArray(value) ? value[0] : value;
    content = replaceScorecardValue(content, mapping.section, scalar);
  }

  await saveText('DAILY_SCORECARD.md', content);
  return readDailyScorecard();
}

function replaceScorecardList(content: string, section: string, items: string[]): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inSection = false;
  let replaced = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes(section)) {
      result.push(line);
      inSection = true;
      // Insert new items
      items.forEach((item, idx) => {
        result.push(`- ${item}`);
      });
      replaced = true;
      continue;
    }

    if (inSection) {
      // Skip old list items
      if (line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().match(/^\d+\./)) {
        continue;
      }
      // Blank line or new section — stop skipping
      inSection = false;
    }

    result.push(line);
  }

  if (!replaced) {
    // Section not found — append it
    result.push(`\n## ${section}`);
    items.forEach(item => result.push(`- ${item}`));
  }

  return result.join('\n');
}

function replaceScorecardValue(content: string, label: string, value: string): string {
  // Try to find and replace existing "- **Label**: value" or "- Label: value"
  const boldRegex = new RegExp(`([-\\*]*\\s*\\*\\*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*[:\\s]*)(.+)`, 'i');
  const plainRegex = new RegExp(`([-\\*]*\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*)(.+)`, 'i');

  if (boldRegex.test(content)) {
    return content.replace(boldRegex, `$1${value}`);
  }
  if (plainRegex.test(content)) {
    return content.replace(plainRegex, `$1${value}`);
  }

  // Not found — append under a reasonable section
  return content + `\n- **${label}** ${value}`;
}

function extractValue(text: string, label: string): string | null {
  const regex = new RegExp(`[-\\*]*\\s*\\*\\*${label}\\*\\*[:\\s]*(.+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractListItems(text: string, section: string): string[] {
  const lines = text.split('\n');
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.includes(section)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        items.push(line.trim().substring(1).trim());
      } else if (line.trim().match(/^\d+\./)) {
        items.push(line.trim().replace(/^\d+\.\s*/, ''));
      } else if (line.trim() === '' || line.startsWith('#')) {
        break;
      }
    }
  }

  return items;
}