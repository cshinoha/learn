#!/usr/bin/env node
/**
 * create-notebook.mjs
 *
 * Create a NotebookLM notebook following the learn-anything naming convention:
 *   LA - <skill-slug> - <skill-id> - <shard>
 *
 * This is the ONLY way to create a notebook. Do not call notebook_create
 * through MCP directly — names outside the convention are always rejected.
 *
 * Usage:
 *   node create-notebook.mjs <skill-slug> [skill-id] [shard-index]
 *
 *   <skill-slug>   filesystem-safe slug, e.g. java-best-practices
 *   [skill-id]     optional, 4-32 chars alphanumeric+_-. Default: autogen
 *   [shard-index]  optional, 1-based shard number. Default: 001
 *
 * Environment:
 *   NOTEBOOKLM_MCP_ENDPOINT  MCP server URL (default: http://localhost:18000/mcp)
 *
 * Output (stdout): JSON with notebook_id, notebook_name, and chat settings
 * Exit code: 0 on success, non-zero on error
 */

import { configureChat } from './configure-chat.mjs';
import { DEFAULT_ENDPOINT, callTool } from './notebooklm-client.mjs';

const MCP_ENDPOINT = process.env.NOTEBOOKLM_MCP_ENDPOINT || DEFAULT_ENDPOINT;

// ── Validation ────────────────────────────────────────────────────────
const SKILL_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const SKILL_ID_RE = /^[a-zA-Z0-9_-]{4,32}$/;

function usageAndExit(msg) {
  if (msg) console.error(`ERROR: ${msg}\n`);
  console.error(
    `Usage: node create-notebook.mjs <skill-slug> [skill-id] [shard-index]\n\n` +
    `  <skill-slug>   pattern: ${SKILL_SLUG_RE.source}\n` +
    `  [skill-id]     pattern: ${SKILL_ID_RE.source}  (default: autogen 6-char)\n` +
    `  [shard-index]  3-digit 1-based shard (default: 001)\n`
  );
  process.exit(1);
}

// ── Argparse ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') usageAndExit();

const skillSlug = args[0];
if (!SKILL_SLUG_RE.test(skillSlug)) {
  usageAndExit(`skill-slug must match ${SKILL_SLUG_RE.source}, got "${skillSlug}"`);
}

// Auto-generate skill-id if not provided: 6 random hex chars
let skillId = args[1];
if (!skillId) {
  skillId = Math.random().toString(16).slice(2, 8);
  console.error(`[info] auto-generated skill-id: ${skillId}`);
} else if (!SKILL_ID_RE.test(skillId)) {
  usageAndExit(`skill-id must match ${SKILL_ID_RE.source}, got "${skillId}"`);
}

let shardIdx = args[2] || '001';
if (!/^\d{3}$/.test(shardIdx)) {
  usageAndExit(`shard-index must be 3 digits, got "${shardIdx}"`);
}

const notebookName = `LA - ${skillSlug} - ${skillId} - ${shardIdx}`;
console.error(`[info] notebook name: ${notebookName}`);

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const parsed = await callTool(MCP_ENDPOINT, 'notebook_create', { title: notebookName });

  if (parsed.status !== 'success' || !parsed.notebook_id) {
    console.error(`[error] notebook_create status: ${parsed.status} - ${parsed.message || ''}`);
    process.exit(5);
  }

  const chatConfig = await configureChat({ endpoint: MCP_ENDPOINT, notebookId: parsed.notebook_id });

  const output = {
    notebook_id: parsed.notebook_id,
    notebook_name: notebookName,
    skill_slug: skillSlug,
    skill_id: skillId,
    shard_index: parseInt(shardIdx, 10),
    chat_goal: chatConfig.chat_goal,
    chat_response_length: chatConfig.chat_response_length,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(`[error] ${err.message}`);
  process.exit(9);
});
