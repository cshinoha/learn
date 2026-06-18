#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

export function endpoint() {
  return process.env.NOTEBOOKLM_MCP_ENDPOINT || '';
}

export function requireEndpoint() {
  const value = endpoint();
  if (!value) {
    throw new Error('NOTEBOOKLM_MCP_ENDPOINT is not set');
  }
  return value;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split('=', 2);
    if (inline !== undefined) {
      args[key] = inline;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[++i];
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function helpRequested(args) {
  return args.help || args.h;
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function slugify(value) {
  return String(value || 'skill')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'skill';
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function mcpRequest(method, params = {}) {
  const url = requireEndpoint();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`NotebookLM MCP HTTP ${response.status}`);
  const text = await response.text();
  const data = parseMcpResponse(text, response.headers.get('content-type') || '');
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result ?? data;
}

export async function mcpCall(name, arguments_ = {}) {
  const result = await mcpRequest('tools/call', { name, arguments: arguments_ });
  if (result.isError) throw new Error(result.content?.map((item) => item.text).filter(Boolean).join('\n') || `${name} failed`);
  const text = result.content?.find((item) => item.type === 'text')?.text;
  if (!text) return result;
  try {
    const value = JSON.parse(text);
    if (value.status === 'error') throw new Error(value.error || value.message || `${name} failed`);
    return value;
  } catch (error) {
    if (error instanceof SyntaxError) return { text };
    throw error;
  }
}

function parseMcpResponse(text, contentType) {
  if (contentType.includes('text/event-stream')) {
    const dataLine = text.split('\n').find((line) => line.startsWith('data: '));
    if (!dataLine) throw new Error('NotebookLM MCP SSE response missing data line');
    return JSON.parse(dataLine.slice(6));
  }
  return JSON.parse(text);
}
