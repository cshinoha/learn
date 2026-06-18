#!/usr/bin/env node
import { appendFile } from 'node:fs/promises';
import { helpRequested, parseArgs, readJson } from './notebooklm-client.mjs';

const usage = `Usage: append-citation.mjs --ledger <citations.jsonl> --citation <citation.json>\n\nAppends one metadata-only citation record.`;
const forbidden = /raw_(source|text|answer)|secret|credential|cookie|bearer|downloaded|cache/i;

export function validateCitation(citation) {
  const required = ['citation_id', 'used_at', 'phase', 'notebook_id', 'source_id', 'source_title', 'url', 'claim_supported', 'locator', 'confidence'];
  for (const key of required) if (!(key in citation)) throw new Error(`missing ${key}`);
  for (const key of ['page', 'section', 'timestamp']) if (!(key in citation.locator)) throw new Error(`missing locator.${key}`);
  if (!['low', 'medium', 'high'].includes(citation.confidence)) throw new Error('bad confidence');
  if (JSON.stringify(citation).match(forbidden)) throw new Error('citation contains forbidden raw/secret/cache fields');
  return true;
}

const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
if (args.ledger || args.citation) {
  if (!args.ledger || !args.citation) {
    console.error(usage);
    process.exit(2);
  }
  const citation = await readJson(args.citation);
  validateCitation(citation);
  await appendFile(args.ledger, `${JSON.stringify(citation)}\n`);
}
