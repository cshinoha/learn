#!/usr/bin/env node
/** Configure NotebookLM chat settings for an existing notebook. */
import { DEFAULT_CHAT_PROMPT, DEFAULT_ENDPOINT, callFirstTool, callTool } from './notebooklm-client.mjs';

function usageAndExit(message, code = 1) {
  if (message) console.error(`ERROR: ${message}\n`);
  console.error(`Usage: node configure-chat.mjs --notebook-id <id> [--endpoint <url>] [--custom-prompt <text>]`);
  process.exit(code);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) usageAndExit(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv) {
  const options = { endpoint: DEFAULT_ENDPOINT, notebookId: null, prompt: DEFAULT_CHAT_PROMPT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') usageAndExit(null, 0);
    if (arg === '--notebook-id') { options.notebookId = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--endpoint') { options.endpoint = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--custom-prompt') { options.prompt = requireValue(argv, index, arg); index += 1; }
    else if (!arg.startsWith('--') && !options.notebookId) options.notebookId = arg;
    else usageAndExit(arg.startsWith('--') ? `unknown option: ${arg}` : 'too many positional arguments');
  }
  if (!options.notebookId) usageAndExit('notebook id is required');
  return options;
}

export async function configureChat({ endpoint = DEFAULT_ENDPOINT, notebookId, prompt = DEFAULT_CHAT_PROMPT, timeoutMs = 30000 }) {
  const goal = 'custom';
  const responseLength = 'shorter';
  const envTools = (process.env.NOTEBOOKLM_CHAT_CONFIG_TOOL || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (envTools.length === 0 || envTools.includes('chat_configure')) {
    try {
      await callTool(endpoint, 'chat_configure', {
        notebook_id: notebookId,
        goal,
        response_length: responseLength,
        custom_prompt: prompt,
      }, timeoutMs);
      return {
        status: 'success',
        notebook_id: notebookId,
        chat_goal: goal,
        chat_response_length: responseLength,
        configured_by: 'chat_configure',
      };
    } catch (err) {
      if (envTools.includes('chat_configure')) throw err;
    }
  }
  const candidates = [...envTools, 'notebook_chat_settings_update', 'notebook_set_chat_settings', 'chat_settings_update', 'notebook_update_settings'];
  const args = {
    notebook_id: notebookId,
    goal,
    response_length: responseLength,
    custom_prompt: prompt,
  };
  const { toolName } = await callFirstTool(endpoint, [...new Set(candidates)], args, timeoutMs);
  return {
    status: 'success',
    notebook_id: notebookId,
    chat_goal: goal,
    chat_response_length: responseLength,
    configured_by: toolName,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const output = await configureChat({ endpoint: options.endpoint, notebookId: options.notebookId, prompt: options.prompt });
  console.log(JSON.stringify(output, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[error] ${err.message}`);
    process.exit(9);
  });
}
