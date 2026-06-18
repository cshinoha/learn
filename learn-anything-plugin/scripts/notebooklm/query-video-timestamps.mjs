#!/usr/bin/env node
/** Query NotebookLM for subtitle-backed YouTube timestamp links. */
import { DEFAULT_ENDPOINT, callTool } from './notebooklm-client.mjs';

function usageAndExit(message, code = 1) {
  if (message) console.error(`ERROR: ${message}\n`);
  console.error(`Usage: node query-video-timestamps.mjs --notebook-id <id> --topic <topic> [--source-ids a,b] [--endpoint <url>]`);
  process.exit(code);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) usageAndExit(`${flag} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = { endpoint: DEFAULT_ENDPOINT, notebookId: null, topic: null, sourceIds: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') usageAndExit(null, 0);
    if (arg === '--notebook-id') { options.notebookId = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--topic') { options.topic = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--source-ids') { options.sourceIds = requireValue(argv, index, arg).split(',').map((s) => s.trim()).filter(Boolean); index += 1; }
    else if (arg === '--endpoint') { options.endpoint = requireValue(argv, index, arg); index += 1; }
    else usageAndExit(arg.startsWith('--') ? `unknown option: ${arg}` : 'unexpected positional argument');
  }
  if (!options.notebookId) usageAndExit('notebook id is required');
  if (!options.topic) usageAndExit('topic is required');
  return options;
}

function buildPrompt(topic, sourceIds) {
  const scope = sourceIds.length > 0 ? `Use only these selected source IDs if source scoping is supported: ${sourceIds.join(', ')}` : 'Use all YouTube, subtitle, and chapters sources in this notebook.';
  return `Find where this topic is discussed in YouTube videos: ${topic}

${scope}

Notebook source conventions:
- video sources are named <title> [<video-id>]
- subtitle transcript sources are named <title> [<video-id>].srt.txt
- chapters sources are named <title> [<video-id>].chapters.txt
- prefer subtitle sources for precise timestamp evidence
- use chapters sources for structure and section boundaries
- extract video id from square brackets
- extract timestamps from subtitle cues when available
- convert timestamps to seconds
- build links as https://www.youtube.com/watch?v=<video-id>&t=<seconds>s

Rules:
- Do not invent timestamps.
- Do not return timestamp links without source evidence.
- If timestamped evidence is unavailable, say so in limitations.
- Return valid JSON only, no Markdown fences, matching this shape:
{
  "topic": "${topic.replace(/"/g, '\\"')}",
  "scope": "${sourceIds.length > 0 ? 'selected_sources' : 'all_youtube'}",
  "source_ids": ${JSON.stringify(sourceIds)},
  "matches": [
    {
      "video_title": "...",
      "video_id": "...",
      "timestamp": "00:12:34",
      "seconds": 754,
      "youtube_url": "https://www.youtube.com/watch?v=<video-id>&t=754s",
      "source_title": "...",
      "evidence": "...",
      "relevance": "..."
    }
  ],
  "limitations": []
}`;
}

function parseJsonText(payload) {
  if (payload.matches && payload.topic) return payload;
  const text = payload.answer || payload.text || payload.response || payload.content || '';
  if (!text) return null;
  const cleaned = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const prompt = buildPrompt(options.topic, options.sourceIds);
  const args = { notebook_id: options.notebookId, query: prompt };
  if (options.sourceIds.length > 0) args.source_ids = options.sourceIds;
  const payload = await callTool(options.endpoint, 'notebook_query', args, 120000);
  const parsed = parseJsonText(payload) || {
    topic: options.topic,
    scope: options.sourceIds.length > 0 ? 'selected_sources' : 'all_youtube',
    source_ids: options.sourceIds,
    matches: [],
    limitations: ['NotebookLM returned a non-JSON response. Re-run after checking notebook chat prompt/settings.'],
  };
  parsed.topic ??= options.topic;
  parsed.scope ??= options.sourceIds.length > 0 ? 'selected_sources' : 'all_youtube';
  parsed.source_ids ??= options.sourceIds;
  parsed.matches ??= [];
  parsed.limitations ??= [];
  console.log(JSON.stringify(parsed, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[error] ${err.message}`);
    process.exit(9);
  });
}
