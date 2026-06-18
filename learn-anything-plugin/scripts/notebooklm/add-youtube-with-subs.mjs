#!/usr/bin/env node
/** Add a YouTube source plus subtitle/chapter sidecars to NotebookLM. */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  DEFAULT_ENDPOINT,
  callFirstTool,
  canonicalYouTubeUrl,
  extractYouTubeVideoId,
  pickId,
  pickTitle,
} from './notebooklm-client.mjs';

function usageAndExit(message, code = 1) {
  if (message) console.error(`ERROR: ${message}\n`);
  console.error(`Usage: node add-youtube-with-subs.mjs --notebook-id <id> --url <youtube-url> [--endpoint <url>] [--existing-source-id <id>]`);
  process.exit(code);
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) usageAndExit(`${flag} requires a value`);
  return value;
}

function parseArgs(argv) {
  const options = { endpoint: DEFAULT_ENDPOINT, notebookId: null, url: null, existingSourceId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') usageAndExit(null, 0);
    if (arg === '--notebook-id') { options.notebookId = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--url') { options.url = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--endpoint') { options.endpoint = requireValue(argv, index, arg); index += 1; }
    else if (arg === '--existing-source-id') { options.existingSourceId = requireValue(argv, index, arg); index += 1; }
    else usageAndExit(arg.startsWith('--') ? `unknown option: ${arg}` : 'unexpected positional argument');
  }
  if (!options.notebookId) usageAndExit('notebook id is required');
  if (!options.url) usageAndExit('YouTube URL is required');
  return options;
}

function runDownload(url) {
  return new Promise((resolvePromise, reject) => {
    const script = resolve('download_yt_subs.sh');
    if (!existsSync(script)) reject(new Error(`download_yt_subs.sh not found at ${script}`));
    const child = spawn(script, [url, 'quiet'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`download_yt_subs.sh failed with exit ${code}: ${stderr.trim()}`));
    });
  });
}

function newestMatchingFile(videoId, suffix) {
  const dir = 'subs';
  if (!existsSync(dir)) return null;
  const matches = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.includes(`[${videoId}]`) && entry.name.endsWith(suffix))
    .map((entry) => join(dir, entry.name))
    .sort();
  return matches.at(-1) || null;
}

function titleFromSidecar(path, videoId, suffix) {
  const name = basename(path);
  return name.replace(new RegExp(`\\s*\\[${videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]${suffix.replace('.', '\\.')}$`), '').trim();
}

async function addUrlSource(endpoint, notebookId, url) {
  const candidates = envCandidates('NOTEBOOKLM_SOURCE_ADD_TOOL', ['source_add']);
  const { payload } = await callFirstTool(endpoint, candidates, { notebook_id: notebookId, source_type: 'url', url, wait: true }, 120000);
  return payload;
}

async function addFileSource(endpoint, notebookId, filePath, title) {
  const candidates = envCandidates('NOTEBOOKLM_FILE_SOURCE_ADD_TOOL', ['source_add', 'source_upload', 'file_upload']);
  const abs = resolve(filePath);
  try {
    const { payload } = await callFirstTool(endpoint, candidates, { notebook_id: notebookId, source_type: 'file', file_path: abs, wait: true }, 120000);
    return payload;
  } catch (fileErr) {
    // With SSH reverse tunnels the MCP sidecar may run on the local machine and
    // cannot see a remote file path. As the approved YouTube sidecar exception,
    // stream the file content directly into NotebookLM without writing raw text
    // into durable state.
    const text = readFileSync(abs, 'utf8');
    const { payload } = await callFirstTool(endpoint, ['source_add'], {
      notebook_id: notebookId,
      source_type: 'text',
      text,
      title: title || basename(filePath),
      wait: true,
    }, 120000);
    payload._file_upload_fallback = 'text';
    payload._file_upload_error = fileErr.message;
    return payload;
  }
}

function envCandidates(envName, defaults) {
  return [...new Set([...(process.env[envName] || '').split(',').map((item) => item.trim()).filter(Boolean), ...defaults])];
}

async function renameSource(endpoint, notebookId, sourceId, title) {
  if (!sourceId) return null;
  const envTools = envCandidates('NOTEBOOKLM_SOURCE_RENAME_TOOL', []);
  if (envTools.length === 0 || envTools.includes('source_rename')) {
    try {
      const { payload } = await callFirstTool(endpoint, ['source_rename'], { notebook_id: notebookId, source_id: sourceId, new_title: title }, 30000);
      return { toolName: 'source_rename', payload };
    } catch (err) {
      if (envTools.includes('source_rename')) throw err;
    }
  }
  const candidates = [...envTools, 'source_update', 'notebook_source_update'];
  const args = { notebook_id: notebookId, source_id: sourceId, title, name: title, new_title: title };
  const { toolName, payload } = await callFirstTool(endpoint, candidates, args, 30000);
  return { toolName, payload };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const videoId = extractYouTubeVideoId(options.url);
  if (!videoId) usageAndExit(`cannot extract YouTube video id from: ${options.url}`);
  const url = canonicalYouTubeUrl(videoId);

  let videoPayload = {};
  let videoSourceId = options.existingSourceId;
  if (!videoSourceId) {
    console.error(`[info] adding YouTube source: ${url}`);
    videoPayload = await addUrlSource(options.endpoint, options.notebookId, url);
    videoSourceId = pickId(videoPayload);
  }

  console.error('[info] downloading subtitle/chapter sidecars');
  await runDownload(url);
  const subtitlePath = newestMatchingFile(videoId, '.srt.txt');
  if (!subtitlePath) throw new Error(`subtitle sidecar not found for video id ${videoId}`);
  const chaptersPath = newestMatchingFile(videoId, '.chapters.txt');
  const originalTitle = pickTitle(videoPayload) || titleFromSidecar(subtitlePath, videoId, '.srt.txt') || `YouTube video`;
  const videoTitle = `${originalTitle} [${videoId}]`;

  if (videoSourceId) await renameSource(options.endpoint, options.notebookId, videoSourceId, videoTitle);

  console.error(`[info] uploading subtitle sidecar: ${subtitlePath}`);
  const subTitle = `${videoTitle}.srt.txt`;
  const subPayload = await addFileSource(options.endpoint, options.notebookId, subtitlePath, subTitle);
  const subSourceId = pickId(subPayload);
  if (subSourceId) await renameSource(options.endpoint, options.notebookId, subSourceId, subTitle);

  let chapters = null;
  if (chaptersPath) {
    console.error(`[info] uploading chapters sidecar: ${chaptersPath}`);
    const chaptersTitle = `${videoTitle}.chapters.txt`;
    const chaptersPayload = await addFileSource(options.endpoint, options.notebookId, chaptersPath, chaptersTitle);
    const chaptersSourceId = pickId(chaptersPayload);
    if (chaptersSourceId) await renameSource(options.endpoint, options.notebookId, chaptersSourceId, chaptersTitle);
    chapters = { source_id: chaptersSourceId, title: chaptersTitle, local_path: chaptersPath };
  }

  console.log(JSON.stringify({
    status: 'success',
    notebook_id: options.notebookId,
    video: { video_id: videoId, source_id: videoSourceId, title: videoTitle, url },
    subtitles: { source_id: subSourceId, title: subTitle, local_path: subtitlePath },
    chapters,
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`[error] ${err.message}`);
    process.exit(9);
  });
}
