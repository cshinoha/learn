#!/usr/bin/env node
import { helpRequested, mcpCall, parseArgs, printJson } from './notebooklm-client.mjs';

const usage = `Usage: configure-chat.mjs --notebook-id <id> [--style custom] [--length shorter]\n\nConfigures NotebookLM chat defaults for source-grounded, concise responses.`;
const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
if (!args['notebook-id']) {
  console.error(usage);
  process.exit(2);
}
const result = await mcpCall('chat_configure', {
  notebook_id: args['notebook-id'],
  goal: args.style || 'custom',
  custom_prompt: args.prompt || 'Answer concisely using only NotebookLM-indexed sources. Include citations when available. If sources are insufficient, say so.',
  response_length: args.length || 'shorter',
});
printJson(result);
