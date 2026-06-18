#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';
import { helpRequested, mcpCall, parseArgs, printJson } from './notebooklm-client.mjs';

const usage = `Usage: add-youtube-with-subs.mjs --notebook-id <id> --url <youtube-url> [--youtube-subs auto|off]\n\nImports a YouTube URL and, by default, attaches subtitle sidecars for timestamp evidence.`;
const args = parseArgs();
if (helpRequested(args)) {
  console.log(usage);
  process.exit(0);
}
if (!args['notebook-id'] || !args.url) {
  console.error(usage);
  process.exit(2);
}
let sidecar = null;
if ((args['youtube-subs'] || 'auto') !== 'off') {
  const script = new URL('../../../download_yt_subs.sh', import.meta.url).pathname;
  const run = spawnSync('bash', [script, args.url], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || 'subtitle download failed');
  sidecar = run.stdout.trim().split('\n').filter(Boolean).at(-1) || null;
}
const result = await mcpCall('source_add', {
  notebook_id: args['notebook-id'],
  source_type: 'url',
  url: args.url,
  title: sidecar ? basename(sidecar).replace(/\.srt\.txt$/, '') : undefined,
  wait: true,
});
printJson({ ...result, sidecar_file: sidecar ? basename(sidecar) : null });
