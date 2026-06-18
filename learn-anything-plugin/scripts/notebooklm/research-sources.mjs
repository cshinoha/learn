#!/usr/bin/env node
import { helpRequested, mcpCall, parseArgs, printJson } from './notebooklm-client.mjs';

const usage = `Usage: research-sources.mjs --notebook-id <id> --query <text> [--mode fast|deep]\n\nDiscovers source candidates through NotebookLM. Web search remains URL-discovery only.`;
const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
if (!args['notebook-id'] || !args.query) {
  console.error(usage);
  process.exit(2);
}
const result = await mcpCall('research_start', {
  notebook_id: args['notebook-id'],
  query: args.query,
  mode: args.mode || 'deep',
});
printJson(result);
