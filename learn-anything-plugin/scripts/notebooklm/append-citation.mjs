#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const LOCATION_TYPES = new Set(['timestamp', 'page', 'section', 'slide', 'paragraph', 'quote', 'url', 'other']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const SKILL_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const USED_FOR = /^(lesson|question|material|research|assessment):[A-Za-z0-9_.:-]+$/;
const CITATION_ID = /^cit_[a-f0-9]{12,64}$/;
const ISO_DATEISH = /^\d{4}-\d{2}-\d{2}T/;
const HTTP_URL = /^https?:\/\//i;
const LOCAL_PATHISH = /^(file|sftp|ftp):\/\/|(^|\s)(~\/|\.\.?\/|\/tmp\/|\/Users\/|\/home\/|[A-Za-z]:\\)/i;
const FORBIDDEN_KEY_RE = /(cookie|cookies|token|secret|api[_-]?key|bearer|authorization|credential|password|oauth|session(_file)?|ssh(_|-)?private|private[_-]?key|raw(_|-)?notebook|raw(_|-)?answer|raw(_|-)?blob|mcp(_|-)?dump|request(_|-)?dump|response(_|-)?dump|download(ed)?(_|-)?file|local(_|-)?retrieval(_|-)?cache|private(_|-)?source(_|-)?text)/i;
const FORBIDDEN_VALUE_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/=-]+|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|cookie=|SID=|HSID=|SSID=|raw notebook|raw answer|full MCP dump|local retrieval cache)/i;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(text, length = 24) {
  return createHash('sha256').update(text).digest('hex').slice(0, length);
}

function shortText(value, max) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function citationStableKey(citation) {
  return [
    citation.skill_slug,
    citation.source_id,
    citation.location_type,
    citation.location ?? '',
    sha256(citation.snippet ?? '', 32),
  ].join('|');
}

function scanForbidden(errors, value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(errors, item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`${path}.${key}: forbidden key for normalized citation`);
      scanForbidden(errors, child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && FORBIDDEN_VALUE_RE.test(value)) {
    errors.push(`${path}: forbidden secret/raw/cache-looking value`);
  }
}

export function normalizeCitation(input, { now = new Date().toISOString() } = {}) {
  if (!isPlainObject(input)) throw new Error('citation must be an object');

  const normalized = {
    citation_id: input.citation_id,
    created_at: input.created_at ?? now,
    skill_slug: input.skill_slug,
    query_id: input.query_id,
    used_for: input.used_for,
    notebook_id: input.notebook_id,
    source_id: input.source_id,
    source_title: input.source_title,
    source_url: input.source_url,
    location_type: input.location_type ?? 'other',
    location: shortText(input.location, 300),
    timestamp_seconds: input.timestamp_seconds ?? null,
    page: shortText(input.page, 80),
    section_title: shortText(input.section_title, 200),
    snippet: shortText(input.snippet ?? '', 600) ?? '',
    deep_link: input.deep_link ?? null,
    confidence: input.confidence ?? 'medium',
  };

  if (!normalized.citation_id) normalized.citation_id = `cit_${sha256(citationStableKey(normalized), 24)}`;
  return normalized;
}

export function validateCitation(citation) {
  const errors = [];
  if (!isPlainObject(citation)) return ['$: expected object'];

  const allowed = new Set([
    'citation_id', 'created_at', 'skill_slug', 'query_id', 'used_for', 'notebook_id', 'source_id',
    'source_title', 'source_url', 'location_type', 'location', 'timestamp_seconds', 'page',
    'section_title', 'snippet', 'deep_link', 'confidence',
  ]);
  for (const key of Object.keys(citation)) {
    if (!allowed.has(key)) errors.push(`$.${key}: unexpected field`);
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(citation, key)) errors.push(`$.${key}: required`);
  }

  const stringFields = ['citation_id', 'created_at', 'skill_slug', 'query_id', 'used_for', 'notebook_id', 'source_id', 'source_title', 'source_url', 'location_type', 'snippet', 'confidence'];
  for (const key of stringFields) {
    if (Object.prototype.hasOwnProperty.call(citation, key) && typeof citation[key] !== 'string') errors.push(`$.${key}: expected string`);
  }

  if (typeof citation.citation_id === 'string' && !CITATION_ID.test(citation.citation_id)) errors.push('$.citation_id: invalid format');
  if (typeof citation.created_at === 'string' && !ISO_DATEISH.test(citation.created_at)) errors.push('$.created_at: invalid date-time');
  if (typeof citation.skill_slug === 'string' && !SKILL_SLUG.test(citation.skill_slug)) errors.push('$.skill_slug: invalid format');
  if (typeof citation.used_for === 'string' && !USED_FOR.test(citation.used_for)) errors.push('$.used_for: invalid format');
  if (typeof citation.location_type === 'string' && !LOCATION_TYPES.has(citation.location_type)) errors.push('$.location_type: unsupported value');
  if (typeof citation.confidence === 'string' && !CONFIDENCE.has(citation.confidence)) errors.push('$.confidence: unsupported value');

  for (const key of ['source_url', 'deep_link']) {
    const value = citation[key];
    if (value === null && key === 'deep_link') continue;
    if (typeof value === 'string') {
      if (!HTTP_URL.test(value)) errors.push(`$.${key}: must be http(s) link`);
      if (LOCAL_PATHISH.test(value)) errors.push(`$.${key}: must not be local/downloaded file path`);
    } else if (key === 'deep_link') {
      errors.push('$.deep_link: expected string or null');
    }
  }

  for (const key of ['location', 'page', 'section_title']) {
    if (citation[key] !== null && typeof citation[key] !== 'string') errors.push(`$.${key}: expected string or null`);
  }
  if (citation.timestamp_seconds !== null && (typeof citation.timestamp_seconds !== 'number' || citation.timestamp_seconds < 0)) errors.push('$.timestamp_seconds: expected non-negative number or null');
  if (typeof citation.snippet === 'string' && citation.snippet.length > 600) errors.push('$.snippet: must be <= 600 chars');

  scanForbidden(errors, citation);
  return [...new Set(errors)].sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readLedger(path) {
  try {
    const text = await readFile(path, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1}: invalid JSONL (${error.message})`);
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function appendCitation({ ledgerPath, citationPath, citationObject, now = new Date().toISOString() }) {
  if (!ledgerPath) throw new Error('ledgerPath is required');
  const input = citationObject ?? await readJson(citationPath);
  const preflightErrors = [];
  scanForbidden(preflightErrors, input);
  if (preflightErrors.length > 0) {
    const error = new Error(`citation validation failed (${preflightErrors.length} issues)`);
    error.validationErrors = [...new Set(preflightErrors)].sort();
    throw error;
  }

  const citation = normalizeCitation(input, { now });
  const errors = validateCitation(citation);
  if (errors.length > 0) {
    const error = new Error(`citation validation failed (${errors.length} issues)`);
    error.validationErrors = errors;
    throw error;
  }

  const existing = await readLedger(ledgerPath);
  const key = citationStableKey(citation);
  const duplicate = existing.find((row) => isPlainObject(row) && citationStableKey(normalizeCitation(row, { now: row.created_at ?? now })) === key);
  if (duplicate) {
    return { citation: duplicate, appended: false, ledgerPath };
  }

  await mkdir(dirname(ledgerPath), { recursive: true });
  const prefix = existing.length > 0 ? '\n' : '';
  await writeFile(ledgerPath, `${existing.length > 0 ? '' : ''}`, { flag: 'a' });
  await writeFile(ledgerPath, `${prefix}${JSON.stringify(citation)}\n`, { flag: 'a' });
  return { citation, appended: true, ledgerPath };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ledger') args.ledgerPath = argv[++index];
    else if (arg === '--citation') args.citationPath = argv[++index];
    else if (arg === '--print-id') args.printId = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  if (args.help || !args.ledgerPath || !args.citationPath) {
    console.error('Usage: node learn-anything-plugin/scripts/notebooklm/append-citation.mjs --ledger <citations.jsonl> --citation <citation.json> [--print-id]');
    process.exitCode = args.help ? 0 : 2;
    return;
  }

  try {
    const result = await appendCitation(args);
    if (args.printId) console.log(result.citation.citation_id);
    else console.log(`Citation ${result.appended ? 'appended' : 'deduped'}: ${result.citation.citation_id}`);
  } catch (error) {
    console.error(error.message);
    if (error.validationErrors) {
      for (const issue of error.validationErrors) console.error(`- ${issue}`);
      process.exitCode = 1;
    } else {
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
