import { readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { Initiative, DailyScorecard } from './types';
import { WORKSPACE_PATH, ensureWorkspaceReady } from './workspace-path';

export function readInitiatives(): Initiative[] {
  try {
    ensureWorkspaceReady();
    const filePath = join(WORKSPACE_PATH, 'INITIATIVES.md');
    const content = readFileSync(filePath, 'utf8');
    
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

export function readDailyScorecard(): DailyScorecard | null {
  try {
    ensureWorkspaceReady();
    const filePath = join(WORKSPACE_PATH, 'DAILY_SCORECARD.md');
    const content = readFileSync(filePath, 'utf8');
    
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