#!/usr/bin/env npx tsx
/**
 * MCP Server for two-way task sync between local OpenClaw and the production dashboard.
 *
 * Tools:
 *   - push_tasks: Read local tasks.json → push to production Neon DB
 *   - pull_tasks: Pull from production Neon DB → write to local tasks.json
 *   - list_tasks: Show current synced task summary
 *
 * Env vars:
 *   DASHBOARD_URL  — Production dashboard URL (e.g., https://ceo-mission-control.vercel.app)
 *   SYNC_API_KEY   — API key for authenticating sync requests
 *   WORKSPACE_PATH — Local OpenClaw workspace (defaults to ~/.openclaw/workspace)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DASHBOARD_URL = process.env.DASHBOARD_URL || '';
const SYNC_API_KEY = process.env.SYNC_API_KEY || '';
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || join(homedir(), '.openclaw', 'workspace');
const TASKS_FILE = join(WORKSPACE_PATH, 'tasks.json');
const SCORECARD_FILE = join(WORKSPACE_PATH, 'DAILY_SCORECARD.md');

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SYNC_API_KEY) headers['x-sync-api-key'] = SYNC_API_KEY;
  return headers;
}

function readLocalTasks(): { tasks: unknown[] } {
  try {
    if (!existsSync(TASKS_FILE)) {
      return { tasks: [] };
    }
    const content = readFileSync(TASKS_FILE, 'utf8');
    const data = JSON.parse(content);
    return { tasks: data.tasks || [] };
  } catch (err) {
    console.error(`Failed to read ${TASKS_FILE}:`, err);
    return { tasks: [] };
  }
}

function writeLocalTasks(tasks: unknown[]): void {
  try {
    const data = JSON.parse(existsSync(TASKS_FILE) ? readFileSync(TASKS_FILE, 'utf8') : '{}');
    data.tasks = tasks;
    writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to write ${TASKS_FILE}:`, err);
    throw err;
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const server = new McpServer({
  name: 'task-sync',
  version: '1.0.0',
});

server.tool(
  'push_tasks',
  'Push local tasks.json to the production dashboard (Neon DB). Merges with existing tasks using last-write-wins.',
  {},
  async () => {
    if (!DASHBOARD_URL) {
      return { content: [{ type: 'text' as const, text: 'Error: DASHBOARD_URL not configured' }] };
    }

    const local = readLocalTasks();
    if (local.tasks.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No local tasks found in ' + TASKS_FILE }] };
    }

    try {
      const response = await fetch(`${DASHBOARD_URL}/api/sync-tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'push', tasks: local.tasks }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `Push failed (${response.status}): ${err}` }] };
      }

      const result = await response.json();
      return {
        content: [{
          type: 'text' as const,
          text: `Pushed ${result.pushed} tasks → ${result.merged} total in production. Synced at ${result.timestamp}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Push failed (network): ${errorText(err)}` }] };
    }
  }
);

server.tool(
  'pull_tasks',
  'Pull tasks from the production dashboard (Neon DB) and write to local tasks.json. Preserves local-only fields.',
  {},
  async () => {
    if (!DASHBOARD_URL) {
      return { content: [{ type: 'text' as const, text: 'Error: DASHBOARD_URL not configured' }] };
    }

    try {
      const response = await fetch(`${DASHBOARD_URL}/api/sync-tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'pull' }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `Pull failed (${response.status}): ${err}` }] };
      }

      const result = await response.json();
      const tasks = result.tasks || [];
      writeLocalTasks(tasks);

      return {
        content: [{
          type: 'text' as const,
          text: `Pulled ${tasks.length} tasks → written to ${TASKS_FILE}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Pull failed: ${errorText(err)}` }] };
    }
  }
);

server.tool(
  'list_tasks',
  'Show current synced tasks from the production dashboard without modifying anything.',
  {
    status: z.enum(['all', 'todo', 'doing', 'done']).optional().describe('Filter by status'),
  },
  async ({ status }) => {
    if (!DASHBOARD_URL) {
      return { content: [{ type: 'text' as const, text: 'Error: DASHBOARD_URL not configured' }] };
    }

    try {
      const response = await fetch(`${DASHBOARD_URL}/api/sync-tasks`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `List failed (${response.status}): ${err}` }] };
      }

      const data = await response.json();
      let tasks = data.tasks || [];

      if (status && status !== 'all') {
        tasks = tasks.filter((t: { status: string }) => t.status === status);
      }

      if (tasks.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No synced tasks found.' }] };
      }

      const summary = tasks.map((t: { title: string; status: string; priority: string; category: string | null }) =>
        `- [${t.status}] ${t.title} (${t.priority}${t.category ? ', ' + t.category : ''})`
      ).join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: `${tasks.length} synced tasks:\n\n${summary}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `List failed: ${errorText(err)}` }] };
    }
  }
);

server.tool(
  'push_scorecard',
  'Push local DAILY_SCORECARD.md to the production dashboard. Syncs priorities, focus blocks, moves, and blockers.',
  {},
  async () => {
    if (!DASHBOARD_URL) {
      return { content: [{ type: 'text' as const, text: 'Error: DASHBOARD_URL not configured' }] };
    }

    try {
      if (!existsSync(SCORECARD_FILE)) {
        return { content: [{ type: 'text' as const, text: `No scorecard found at ${SCORECARD_FILE}` }] };
      }

      const content = readFileSync(SCORECARD_FILE, 'utf8');
      const response = await fetch(`${DASHBOARD_URL}/api/sync`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ files: { 'DAILY_SCORECARD.md': content } }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `Push failed (${response.status}): ${err}` }] };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Pushed DAILY_SCORECARD.md → production dashboard synced.`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Push failed: ${errorText(err)}` }] };
    }
  }
);

server.tool(
  'pull_scorecard',
  'Pull the daily scorecard from the production dashboard and write to local DAILY_SCORECARD.md.',
  {},
  async () => {
    if (!DASHBOARD_URL) {
      return { content: [{ type: 'text' as const, text: 'Error: DASHBOARD_URL not configured' }] };
    }

    try {
      const response = await fetch(`${DASHBOARD_URL}/api/workspace`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `Pull failed (${response.status}): ${err}` }] };
      }

      const data = await response.json();
      const scorecard = data.scorecard;
      if (!scorecard) {
        return { content: [{ type: 'text' as const, text: 'No scorecard data returned from dashboard.' }] };
      }

      // Format scorecard back to markdown
      const md = formatScorecardMarkdown(scorecard);
      writeFileSync(SCORECARD_FILE, md);

      return {
        content: [{
          type: 'text' as const,
          text: `Pulled scorecard (${scorecard.date}) → written to ${SCORECARD_FILE}\nPriorities: ${scorecard.priorities?.length || 0}, Focus blocks: ${scorecard.focusBlocks?.length || 0}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Pull failed: ${errorText(err)}` }] };
    }
  }
);

server.tool(
  'update_scorecard',
  'Update a single field on the production dashboard scorecard. Fields: priorities, focusBlocks, majorMoneyMove, strategicMove, taxesMove, biggestBlocker, ignoreList.',
  {
    field: z.string().describe('Scorecard field to update'),
    value: z.union([z.string(), z.array(z.string())]).describe('New value (string for scalar fields, array for list fields)'),
  },
  async ({ field, value }) => {
    if (!DASHBOARD_URL) {
      return { content: [{ type: 'text' as const, text: 'Error: DASHBOARD_URL not configured' }] };
    }

    try {
      const response = await fetch(`${DASHBOARD_URL}/api/workspace`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'updateScorecard', field, value }),
      });

      if (!response.ok) {
        const err = await response.text();
        return { content: [{ type: 'text' as const, text: `Update failed (${response.status}): ${err}` }] };
      }

      const result = await response.json();
      return {
        content: [{
          type: 'text' as const,
          text: `Updated scorecard "${field}" → ${JSON.stringify(value).slice(0, 100)}`,
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Update failed: ${errorText(err)}` }] };
    }
  }
);

function formatScorecardMarkdown(scorecard: any): string {
  const lines: string[] = [
    '# DAILY_SCORECARD.md',
    '',
    '## Date',
    `- ${scorecard.date || new Date().toISOString().split('T')[0]}`,
    '',
    '## Top 3 priorities',
  ];
  (scorecard.priorities || []).forEach((p: string, i: number) => lines.push(`${i + 1}. ${p}`));
  lines.push('', '## Temporal focused hours target');
  lines.push(`- **Target today:** ${scorecard.temporalTarget || 0}`);
  lines.push(`- **Actual:** ${scorecard.temporalActual || ''}`);
  lines.push('', '## Focus blocks');
  (scorecard.focusBlocks || []).forEach((b: string) => lines.push(`- ${b}`));
  lines.push('', '## Major money move today');
  if (scorecard.majorMoneyMove) lines.push(`- ${scorecard.majorMoneyMove}`);
  lines.push('', '## Strategic project move today');
  if (scorecard.strategicMove) lines.push(`- ${scorecard.strategicMove}`);
  lines.push('', '## Taxes / risk reduction move today');
  if (scorecard.taxesMove) lines.push(`- ${scorecard.taxesMove}`);
  lines.push('', '## What to ignore today');
  (scorecard.ignoreList || []).forEach((i: string) => lines.push(`- ${i}`));
  lines.push('', '## Biggest blocker');
  if (scorecard.biggestBlocker) lines.push(`- ${scorecard.biggestBlocker}`);
  lines.push('', '## End-of-day review');
  lines.push('- Wins:');
  lines.push('- Misses:');
  lines.push('- Open loops:');
  lines.push('- Money advanced:');
  return lines.join('\n') + '\n';
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
