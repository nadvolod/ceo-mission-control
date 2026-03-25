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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
