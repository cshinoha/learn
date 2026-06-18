#!/usr/bin/env node
import { readJson, parseArgs, helpRequested } from './notebooklm-client.mjs';

const usage = `Usage: validate-manifest.mjs <notebooklm-manifest.json>\n\nMinimal metadata-only manifest validator.`;
const forbidden = /raw_(source|text|answer)|secret|credential|cookie|bearer|downloaded|cache/i;

export function validateManifest(manifest) {
  const required = ['version', 'skill_slug', 'skill_id', 'created_at', 'updated_at', 'naming_convention', 'binding_strategy', 'transport', 'notebooks', 'sources', 'artifacts', 'sync'];
  for (const key of required) if (!(key in manifest)) throw new Error(`missing ${key}`);
  if (manifest.naming_convention !== 'LA - <skill-slug> - <short-id> - <shard>') throw new Error('bad naming_convention');
  if (manifest.binding_strategy !== 'names_plus_mirror') throw new Error('bad binding_strategy');
  if (manifest.transport?.endpoint_env !== 'NOTEBOOKLM_MCP_ENDPOINT') throw new Error('bad endpoint_env');
  if (JSON.stringify(manifest).match(forbidden)) throw new Error('manifest contains forbidden raw/secret/cache fields');
  return true;
}

const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
if (args._.length) {
  validateManifest(await readJson(args._[0]));
  console.log('ok');
}
