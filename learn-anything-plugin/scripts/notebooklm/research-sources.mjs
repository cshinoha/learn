#!/usr/bin/env node
/**
 * research-sources.mjs
 *
 * Run NotebookLM's built-in source discovery for an existing notebook and
 * optionally import deliberately selected source indices.
 *
 * Contract: links in, compact grounded evidence out. This script prints compact
 * source metadata only; it does not write raw NotebookLM answers, source text,
 * credentials, dumps, or retrieval caches.
 *
 * Usage:
 *   node research-sources.mjs --notebook-id <id> --query <query> [options]
 *   node research-sources.mjs <notebook-id> <query> [mode] [source]
 *
 * Options:
 *   --mode <fast|deep>        Discovery depth. Default: deep
 *   --source <web|drive>      Discovery source. Default: web
 *   --import <none|all|list>  Import mode. Default: none. Example list: 0,2,4
 *   --cited-only             Import only sources cited by the research report
 *   --max-wait <seconds>     Max wait for status completion. Default: 300
 *   --endpoint <url>         MCP endpoint. Default: NOTEBOOKLM_MCP_ENDPOINT or http://localhost:18000/mcp
 *   --youtube-subs <auto|off> Post-process imported YouTube URLs with subtitle sidecars. Default: auto
 *
 * Output (stdout): compact JSON with task_id, discovered sources, and optional import result.
 */

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isYouTubeUrl } from './notebooklm-client.mjs';

const DEFAULT_ENDPOINT = process.env.NOTEBOOKLM_MCP_ENDPOINT || 'http://localhost:18000/mcp';
const MODES = new Set(['fast', 'deep']);
const SOURCES = new Set(['web', 'drive']);
const IMPORT_MODES = new Set(['none', 'all']);
const YOUTUBE_SUBS_MODES = new Set(['auto', 'off']);

function usageAndExit(message, code = 1) {
  if (message) console.error(`ERROR: ${message}\n`);
  console.error(`Usage:\n` +
    `  node research-sources.mjs --notebook-id <id> --query <query> [options]\n` +
    `  node research-sources.mjs <notebook-id> <query> [mode] [source]\n\n` +
    `Options:\n` +
    `  --mode <fast|deep>        Default: deep\n` +
    `  --source <web|drive>      Default: web\n` +
    `  --import <none|all|list>  Default: none. Example list: 0,2,4\n` +
    `  --cited-only             Import only report-cited sources\n` +
    `  --max-wait <seconds>     Default: 300\n` +
    `  --endpoint <url>         Default: NOTEBOOKLM_MCP_ENDPOINT or ${DEFAULT_ENDPOINT}\n` +
    `  --youtube-subs <auto|off> Default: auto\n`);
  process.exit(code);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) usageAndExit(`${flag} requires a value`);
  return value;
}

function parsePositiveInt(value, flag) {
  if (!/^\d+$/.test(String(value))) usageAndExit(`${flag} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) usageAndExit(`${flag} must be a positive integer`);
  return parsed;
}

function parseImportSelection(value) {
  if (IMPORT_MODES.has(value)) return { importMode: value, sourceIndices: null };
  if (!/^\d+(,\d+)*$/.test(value)) {
    usageAndExit('--import must be none, all, or a comma-separated source index list such as 0,2,4');
  }
  return {
    importMode: 'selected',
    sourceIndices: value.split(',').map((part) => Number(part)),
  };
}

function parseArgs(argv) {
  const options = {
    endpoint: DEFAULT_ENDPOINT,
    notebookId: null,
    query: null,
    mode: 'deep',
    source: 'web',
    importMode: 'none',
    sourceIndices: null,
    citedOnly: false,
    maxWaitSeconds: 300,
    youtubeSubs: 'auto',
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') usageAndExit(null, 0);
    if (arg === '--notebook-id') {
      options.notebookId = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--query') {
      options.query = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--mode') {
      options.mode = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--source') {
      options.source = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--import') {
      const selection = parseImportSelection(requireValue(argv, index, arg));
      options.importMode = selection.importMode;
      options.sourceIndices = selection.sourceIndices;
      index += 1;
    } else if (arg === '--cited-only') {
      options.citedOnly = true;
    } else if (arg === '--max-wait') {
      options.maxWaitSeconds = parsePositiveInt(requireValue(argv, index, arg), arg);
      index += 1;
    } else if (arg === '--endpoint') {
      options.endpoint = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--youtube-subs') {
      options.youtubeSubs = requireValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--')) {
      usageAndExit(`unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length > 0) options.notebookId ??= positionals[0];
  if (positionals.length > 1) options.query ??= positionals[1];
  if (positionals.length > 2) options.mode = positionals[2];
  if (positionals.length > 3) options.source = positionals[3];
  if (positionals.length > 4) usageAndExit('too many positional arguments');

  if (!options.notebookId) usageAndExit('notebook id is required');
  if (!options.query) usageAndExit('query is required');
  if (!MODES.has(options.mode)) usageAndExit(`mode must be one of: ${[...MODES].join(', ')}`);
  if (!SOURCES.has(options.source)) usageAndExit(`source must be one of: ${[...SOURCES].join(', ')}`);
  if (options.source === 'drive' && options.mode === 'deep') usageAndExit('deep mode is web-only; use --mode fast with --source drive');
  if (!YOUTUBE_SUBS_MODES.has(options.youtubeSubs)) usageAndExit('--youtube-subs must be auto or off');

  try {
    const url = new URL(options.endpoint);
    if (!['http:', 'https:'].includes(url.protocol)) usageAndExit('--endpoint must be http(s)');
  } catch {
    usageAndExit(`invalid endpoint URL: ${options.endpoint}`);
  }

  return options;
}

function parseSseOrJson(data) {
  const dataLines = data.split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6).trim())
    .filter(Boolean);
  if (dataLines.length > 0) return JSON.parse(dataLines[dataLines.length - 1]);
  return JSON.parse(data);
}

function mcpCall(endpoint, toolName, args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });

    const url = new URL(endpoint);
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(parseSseOrJson(data));
        } catch (err) {
          reject(new Error(`MCP response parse failed: ${err.message}; prefix=${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`MCP request timeout calling ${toolName}`));
    });
    req.write(body);
    req.end();
  });
}

function parseToolPayload(result, toolName) {
  if (result.error) {
    throw new Error(`MCP error from ${toolName}: ${result.error.message || JSON.stringify(result.error)}`);
  }
  const toolResult = result.result;
  if (!toolResult) throw new Error(`Missing MCP tool result from ${toolName}`);
  if (toolResult.isError) {
    const text = toolResult.content?.[0]?.text || JSON.stringify(toolResult);
    throw new Error(`${toolName} failed: ${text}`);
  }

  let payload = toolResult.structuredContent;
  if (!payload) {
    const text = toolResult.content?.find((item) => item?.type === 'text')?.text;
    if (!text) throw new Error(`${toolName} returned no text payload`);
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${toolName} returned non-JSON payload: ${text.slice(0, 200)}`);
    }
  }

  if (payload.status === 'error') {
    throw new Error(`${toolName}: ${payload.error || payload.message || 'unknown error'}`);
  }
  return payload;
}

async function callTool(endpoint, toolName, args, timeoutMs) {
  const result = await mcpCall(endpoint, toolName, args, timeoutMs);
  return parseToolPayload(result, toolName);
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((source) => source && typeof source === 'object' && Number.isInteger(source.index))
    .map((source) => ({
      index: source.index,
      title: source.title ?? null,
      url: source.url ?? null,
      description: source.description ?? null,
      result_type: source.result_type_name ?? source.result_type ?? null,
      cited: source.cited ?? null,
    }));
}

function validateSelectedIndices(indices, sources) {
  if (!indices) return;
  const known = new Set(sources.map((source) => source.index));
  for (const index of indices) {
    if (!known.has(index)) {
      usageAndExit(`selected source index ${index} was not returned by NotebookLM`);
    }
  }
}

function selectedImportedSources(options, sources) {
  if (options.importMode === 'none' && !options.citedOnly) return [];
  if (options.citedOnly) return sources.filter((source) => source.cited === true);
  if (options.importMode === 'all') return sources;
  if (options.importMode === 'selected') {
    const selected = new Set(options.sourceIndices);
    return sources.filter((source) => selected.has(source.index));
  }
  return [];
}

function findImportedSourceId(importResult, url) {
  const stack = [importResult];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      stack.push(...value);
      continue;
    }
    if ((value.url === url || value.source_url === url) && (value.source_id || value.id)) return value.source_id || value.id;
    for (const child of Object.values(value)) stack.push(child);
  }
  return null;
}

function runYoutubePostprocess({ endpoint, notebookId, url, existingSourceId }) {
  return new Promise((resolve, reject) => {
    const script = join(dirname(fileURLToPath(import.meta.url)), 'add-youtube-with-subs.mjs');
    const args = [script, '--notebook-id', notebookId, '--url', url, '--endpoint', endpoint];
    if (existingSourceId) args.push('--existing-source-id', existingSourceId);
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`add-youtube-with-subs failed for ${url} with exit ${code}: ${stderr.trim()}`));
        return;
      }
      try { resolve(JSON.parse(stdout)); }
      catch (err) { reject(new Error(`cannot parse add-youtube-with-subs output: ${err.message}; stderr=${stderr.trim()}`)); }
    });
  });
}

async function postprocessImportedYouTube(options, sources, importResult) {
  if (options.youtubeSubs === 'off' || !importResult) return [];
  const candidates = selectedImportedSources(options, sources).filter((source) => source.url && isYouTubeUrl(source.url));
  const results = [];
  for (const source of candidates) {
    console.error(`[info] post-processing YouTube subtitles: ${source.url}`);
    const existingSourceId = findImportedSourceId(importResult, source.url);
    results.push(await runYoutubePostprocess({
      endpoint: options.endpoint,
      notebookId: options.notebookId,
      url: source.url,
      existingSourceId,
    }));
  }
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const timeoutMs = Math.max(30000, (options.maxWaitSeconds + 30) * 1000);

  console.error(`[info] starting NotebookLM source discovery: mode=${options.mode} source=${options.source}`);
  const start = await callTool(options.endpoint, 'research_start', {
    query: options.query,
    notebook_id: options.notebookId,
    source: options.source,
    mode: options.mode,
  }, timeoutMs);

  if (start.status !== 'success' || !start.task_id) {
    throw new Error(`research did not start cleanly: ${JSON.stringify(start)}`);
  }

  console.error(`[info] research task started: ${start.task_id}`);
  const status = await callTool(options.endpoint, 'research_status', {
    notebook_id: options.notebookId,
    compact: false,
    max_wait: options.maxWaitSeconds,
  }, timeoutMs);

  if (status.status !== 'completed') {
    const output = {
      status: status.status,
      notebook_id: options.notebookId,
      task_id: start.task_id,
      query: options.query,
      source: options.source,
      mode: options.mode,
      message: status.message || 'Research not completed yet. Re-run status/import later.',
      sources_found: status.sources_found ?? null,
      sources: normalizeSources(status.sources),
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(2);
  }

  const sources = normalizeSources(status.sources);
  validateSelectedIndices(options.sourceIndices, sources);

  let importResult = null;
  if (options.importMode !== 'none' || options.citedOnly) {
    const importArgs = {
      notebook_id: options.notebookId,
      task_id: start.task_id,
      timeout: options.maxWaitSeconds,
    };
    if (options.citedOnly) importArgs.cited_only = true;
    else if (options.importMode === 'selected') importArgs.source_indices = options.sourceIndices;

    console.error(`[info] importing sources: ${options.citedOnly ? 'cited-only' : options.importMode}`);
    importResult = await callTool(options.endpoint, 'research_import', importArgs, timeoutMs);
  }

  const youtubePostprocess = await postprocessImportedYouTube(options, sources, importResult);

  const output = {
    status: 'completed',
    notebook_id: options.notebookId,
    task_id: start.task_id,
    query: options.query,
    source: options.source,
    mode: options.mode,
    sources_found: status.sources_found ?? sources.length,
    sources,
    import_mode: options.citedOnly ? 'cited-only' : options.importMode,
    imported: importResult,
    youtube_subs: options.youtubeSubs,
    youtube_postprocess: youtubePostprocess,
    next_step: importResult ? 'Query the notebook for grounded evidence and append normalized used citations.' : 'Review sources[].index/title/description, then rerun with --import 0,2,4 or --import all.',
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(`[error] ${err.message}`);
  process.exit(9);
});
