#!/usr/bin/env node
import { helpRequested, mcpCall, parseArgs, printJson } from './notebooklm-client.mjs';

const usage = `Usage: query-video-timestamps.mjs --notebook-id <id> --query <text> [--source-id <id>]\n\nReturns subtitle-backed YouTube timestamp evidence from NotebookLM-indexed sources.`;
const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
const query = args.query || args.topic;
if (!args['notebook-id'] || !query) {
  console.error(usage);
  process.exit(2);
}
const result = await mcpCall('notebook_query', {
  notebook_id: args['notebook-id'],
  source_ids: args['source-id'] ? [args['source-id']] : undefined,
  query: `${query}\n\nReturn only subtitle-backed YouTube timestamp evidence. Do not invent timestamps.`,
});
printJson(result);
