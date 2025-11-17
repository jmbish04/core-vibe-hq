#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '..', 'taskmaster_cli.py');

async function runCli(args) {
  const env = { ...process.env };
  const { stdout } = await execFileAsync('python3', [CLI_PATH, ...args], {
    cwd: process.cwd(),
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

const server = new McpServer({ name: 'taskmaster-mcp', version: '0.1.0' });

server.tool('tasks_next', 'Get next available task (respects dependencies).', {
  inputSchema: {
    type: 'object',
    properties: {
      tag: { type: 'string', description: 'Tag to operate on (default: master if present).' },
      file: { type: 'string', description: 'Path to tasks.json (default: .taskmaster/tasks/tasks.json).' },
    },
  },
  handler: async ({ tag, file }) => {
    const args = [];
    if (file) args.push('--file', file);
    if (tag) args.push('--tag', tag);
    args.push('next');
    const out = await runCli(args);
    return { content: [{ type: 'text', text: out }] };
  },
});

server.tool('tasks_list_available', 'List available tasks (pending with satisfied dependencies).', {
  inputSchema: {
    type: 'object',
    properties: {
      tag: { type: 'string' },
      file: { type: 'string' },
    },
  },
  handler: async ({ tag, file }) => {
    const args = [];
    if (file) args.push('--file', file);
    if (tag) args.push('--tag', tag);
    args.push('list', '--available');
    const out = await runCli(args);
    return { content: [{ type: 'text', text: out }] };
  },
});

server.tool('tasks_set_status', 'Update a task or subtask status.', {
  inputSchema: {
    type: 'object',
    required: ['id', 'status'],
    properties: {
      id: { type: 'string', description: 'Task id (e.g., 5 or 5.2).' },
      status: {
        type: 'string',
        enum: ['pending', 'in-progress', 'done', 'deferred', 'cancelled', 'blocked', 'review'],
      },
      tag: { type: 'string' },
      file: { type: 'string' },
    },
  },
  handler: async ({ id, status, tag, file }) => {
    const args = [];
    if (file) args.push('--file', file);
    if (tag) args.push('--tag', tag);
    args.push('set-status', '--id', String(id), '--status', String(status));
    const out = await runCli(args);
    return { content: [{ type: 'text', text: out }] };
  },
});

const transport = new StdioServerTransport();
await server.connect(transport);


