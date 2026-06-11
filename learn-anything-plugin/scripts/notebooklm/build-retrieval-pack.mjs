#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { normalizeCitation, validateCitation } from './append-citation.mjs';

const CONFIDENCE = new Set(['high', 'medium', 'low']);
const SKILL_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const PACK_ID = /^rpack_[a-f0-9]{12,64}$/;
const ISO_DATEISH = /^\d{4}-\d{2}-\d{2}T/;
const LOCATION_TYPES = new Set(['timestamp', 'page', 'section', 'slide', 'paragraph', 'quote', 'url', 'other']);
const HTTP_URL = /^https?:\/\//i;
const FORBIDDEN_KEY_RE = /(cookie|cookies|token|secret|api[_-]?key|bearer|authorization|credential|password|oauth|session(_file)?|ssh(_|-)?private|private[_-]?key|raw(_|-)?notebook|raw(_|-)?answer|raw(_|-)?blob|mcp(_|-)?dump|request(_|-)?dump|response(_|-)?dump|download(ed)?(_|-)?file|local(_|-)?retrieval(_|-)?cache|private(_|-)?source(_|-)?text)/i;
const FORBIDDEN_VALUE_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/=-]+|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|cookie=|SID=|HSID=|SSID=|raw notebook|raw answer|full MCP dump|local retrieval cache)/i;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256(text, length = 24) {
  return createHash('sha256').update(text).digest('hex').slice(0, length);
}

function compactText(value, max) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function scanForbidden(errors, value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(errors, item, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`${path}.${key}: forbidden key for retrieval pack`);
      scanForbidden(errors, child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && FORBIDDEN_VALUE_RE.test(value)) errors.push(`${path}: forbidden secret/raw/cache-looking value`);
}

function sourceIndex(manifest) {
  const sources = new Map();
  for (const source of manifest.sources ?? []) {
    if (isPlainObject(source) && typeof source.source_id === 'string') sources.set(source.source_id, source);
  }
  return sources;
}

function defaultNotebookIds(manifest, input) {
  const fromInput = input.notebook_ids ?? input.notebookIds;
  if (Array.isArray(fromInput) && fromInput.length > 0) return [...new Set(fromInput.map(String))];
  return [...new Set((manifest.notebooks ?? []).filter((notebook) => notebook.status !== 'missing' && notebook.status !== 'error').map((notebook) => notebook.notebook_id).filter(Boolean))];
}

function normalizePackCitation(rawCitation, { manifest, skillSlug, queryId, usedFor, now }) {
  const sources = sourceIndex(manifest);
  const source = sources.get(rawCitation.source_id) ?? sources.get(rawCitation.sourceId) ?? null;
  const notebookId = rawCitation.notebook_id ?? rawCitation.notebookId ?? source?.notebook_id ?? manifest.notebooks?.[0]?.notebook_id;
  const sourceId = rawCitation.source_id ?? rawCitation.sourceId ?? source?.source_id;
  const sourceTitle = rawCitation.source_title ?? rawCitation.sourceTitle ?? rawCitation.title ?? source?.title ?? 'Untitled source';
  const sourceUrl = rawCitation.source_url ?? rawCitation.sourceUrl ?? rawCitation.url ?? source?.url;
  const locationType = rawCitation.location_type ?? rawCitation.locationType ?? (rawCitation.timestamp_seconds !== undefined || rawCitation.timestampSeconds !== undefined ? 'timestamp' : 'other');
  const citation = normalizeCitation({
    citation_id: rawCitation.citation_id ?? rawCitation.citationId,
    created_at: rawCitation.created_at ?? now,
    skill_slug: skillSlug,
    query_id: queryId,
    used_for: usedFor,
    notebook_id: notebookId,
    source_id: sourceId,
    source_title: sourceTitle,
    source_url: sourceUrl,
    location_type: locationType,
    location: rawCitation.location ?? rawCitation.quote ?? rawCitation.section_title ?? rawCitation.sectionTitle ?? null,
    timestamp_seconds: rawCitation.timestamp_seconds ?? rawCitation.timestampSeconds ?? null,
    page: rawCitation.page ?? null,
    section_title: rawCitation.section_title ?? rawCitation.sectionTitle ?? null,
    snippet: rawCitation.snippet ?? rawCitation.text ?? '',
    deep_link: rawCitation.deep_link ?? rawCitation.deepLink ?? rawCitation.url ?? sourceUrl ?? null,
    confidence: rawCitation.confidence ?? 'medium',
  }, { now });

  const errors = validateCitation(citation);
  if (errors.length > 0) {
    const error = new Error(`citation could not be normalized: ${errors.join('; ')}`);
    error.validationErrors = errors;
    throw error;
  }

  const { created_at, skill_slug, query_id, used_for, ...packCitation } = citation;
  return packCitation;
}

export function normalizeRetrievalPack(input, manifest, { now = new Date().toISOString() } = {}) {
  if (!isPlainObject(input)) throw new Error('input result must be an object');
  if (!isPlainObject(manifest)) throw new Error('manifest must be an object');

  const skillSlug = input.skill_slug ?? manifest.skill_slug;
  const query = compactText(input.query ?? input.prompt ?? input.question, 1200);
  const queryId = input.query_id ?? `query_${sha256(`${skillSlug}|${query}`, 16)}`;
  const usedFor = input.used_for ?? `research:${queryId}`;
  const rawCitations = Array.isArray(input.citations) ? input.citations.slice(0, 12) : [];
  const answerSummary = compactText(input.answer_summary ?? input.summary ?? input.answer ?? input.text, 2500);
  const notebookIds = defaultNotebookIds(manifest, input);
  const limitations = Array.isArray(input.limitations) ? input.limitations.map((item) => compactText(item, 300)).filter(Boolean).slice(0, 12) : [];

  if (rawCitations.length === 0) limitations.push('NotebookLM result did not include selected citations. Treat as low confidence until rerun.');

  const citations = rawCitations.map((citation) => normalizePackCitation(citation, { manifest, skillSlug, queryId, usedFor, now }));
  const confidence = CONFIDENCE.has(input.confidence) ? input.confidence : (citations.length > 0 ? 'medium' : 'low');

  const pack = {
    pack_id: input.pack_id ?? `rpack_${sha256(`${skillSlug}|${query}|${answerSummary}`, 24)}`,
    created_at: input.created_at ?? now,
    skill_slug: skillSlug,
    query,
    retrieval_mode: 'cross_notebook_query',
    notebook_ids: notebookIds,
    answer_summary: answerSummary,
    citations,
    followup_queries: Array.isArray(input.followup_queries) ? input.followup_queries.map((item) => compactText(item, 300)).filter(Boolean).slice(0, 8) : [],
    confidence,
    limitations: [...new Set(limitations)],
  };

  const errors = validateRetrievalPack(pack);
  if (errors.length > 0) {
    const error = new Error(`retrieval pack validation failed (${errors.length} issues)`);
    error.validationErrors = errors;
    throw error;
  }
  return pack;
}

export function validateRetrievalPack(pack) {
  const errors = [];
  if (!isPlainObject(pack)) return ['$: expected object'];
  const allowed = new Set(['pack_id', 'created_at', 'skill_slug', 'query', 'retrieval_mode', 'notebook_ids', 'answer_summary', 'citations', 'followup_queries', 'confidence', 'limitations']);
  for (const key of Object.keys(pack)) if (!allowed.has(key)) errors.push(`$.${key}: unexpected field`);
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(pack, key)) errors.push(`$.${key}: required`);

  if (typeof pack.pack_id !== 'string' || !PACK_ID.test(pack.pack_id)) errors.push('$.pack_id: invalid format');
  if (typeof pack.created_at !== 'string' || !ISO_DATEISH.test(pack.created_at)) errors.push('$.created_at: invalid date-time');
  if (typeof pack.skill_slug !== 'string' || !SKILL_SLUG.test(pack.skill_slug)) errors.push('$.skill_slug: invalid format');
  if (typeof pack.query !== 'string' || pack.query.length < 1 || pack.query.length > 1200) errors.push('$.query: expected 1..1200 chars');
  if (pack.retrieval_mode !== 'cross_notebook_query') errors.push('$.retrieval_mode: must be cross_notebook_query');
  if (!Array.isArray(pack.notebook_ids)) errors.push('$.notebook_ids: expected array');
  else {
    const seen = new Set();
    pack.notebook_ids.forEach((id, index) => {
      if (typeof id !== 'string' || id.length < 1) errors.push(`$.notebook_ids[${index}]: expected non-empty string`);
      if (seen.has(id)) errors.push(`$.notebook_ids[${index}]: duplicate`);
      seen.add(id);
    });
  }
  if (typeof pack.answer_summary !== 'string' || pack.answer_summary.length < 1 || pack.answer_summary.length > 2500) errors.push('$.answer_summary: expected compact 1..2500 chars');
  if (!Array.isArray(pack.citations)) errors.push('$.citations: expected array');
  else if (pack.citations.length > 12) errors.push('$.citations: max 12');
  else {
    pack.citations.forEach((citation, index) => {
      const required = ['citation_id', 'notebook_id', 'source_id', 'source_title', 'source_url', 'location_type', 'location', 'timestamp_seconds', 'page', 'section_title', 'snippet', 'deep_link', 'confidence'];
      if (!isPlainObject(citation)) {
        errors.push(`$.citations[${index}]: expected object`);
        return;
      }
      for (const key of Object.keys(citation)) if (!required.includes(key)) errors.push(`$.citations[${index}].${key}: unexpected field`);
      for (const key of required) if (!Object.prototype.hasOwnProperty.call(citation, key)) errors.push(`$.citations[${index}].${key}: required`);
      if (typeof citation.citation_id !== 'string' || !/^cit_[a-f0-9]{12,64}$/.test(citation.citation_id)) errors.push(`$.citations[${index}].citation_id: invalid format`);
      if (typeof citation.source_url !== 'string' || !HTTP_URL.test(citation.source_url)) errors.push(`$.citations[${index}].source_url: must be http(s) link`);
      if (citation.deep_link !== null && (typeof citation.deep_link !== 'string' || !HTTP_URL.test(citation.deep_link))) errors.push(`$.citations[${index}].deep_link: must be http(s) link or null`);
      if (typeof citation.location_type !== 'string' || !LOCATION_TYPES.has(citation.location_type)) errors.push(`$.citations[${index}].location_type: unsupported value`);
      if (typeof citation.confidence !== 'string' || !CONFIDENCE.has(citation.confidence)) errors.push(`$.citations[${index}].confidence: unsupported value`);
      if (citation.timestamp_seconds !== null && (typeof citation.timestamp_seconds !== 'number' || citation.timestamp_seconds < 0)) errors.push(`$.citations[${index}].timestamp_seconds: expected non-negative number or null`);
      if (typeof citation.snippet !== 'string' || citation.snippet.length > 600) errors.push(`$.citations[${index}].snippet: expected <= 600 chars`);
    });
  }
  if (!Array.isArray(pack.followup_queries)) errors.push('$.followup_queries: expected array');
  if (!CONFIDENCE.has(pack.confidence)) errors.push('$.confidence: unsupported value');
  if (!Array.isArray(pack.limitations)) errors.push('$.limitations: expected array');

  scanForbidden(errors, pack);
  return [...new Set(errors)].sort();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function buildRetrievalPack({ inputPath, manifestPath, outputPath, citationsOutputPath, now = new Date().toISOString() }) {
  const input = await readJson(inputPath);
  const manifest = await readJson(manifestPath);
  const pack = normalizeRetrievalPack(input, manifest, { now });
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  }
  if (citationsOutputPath) {
    const citations = pack.citations.map((citation) => ({
      ...citation,
      created_at: pack.created_at,
      skill_slug: pack.skill_slug,
      query_id: input.query_id ?? `query_${sha256(`${pack.skill_slug}|${pack.query}`, 16)}`,
      used_for: input.used_for ?? `research:query_${sha256(`${pack.skill_slug}|${pack.query}`, 16)}`,
    }));
    await mkdir(dirname(citationsOutputPath), { recursive: true });
    await writeFile(citationsOutputPath, `${JSON.stringify(citations, null, 2)}\n`, 'utf8');
  }
  return pack;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') args.inputPath = argv[++index];
    else if (arg === '--manifest') args.manifestPath = argv[++index];
    else if (arg === '--output') args.outputPath = argv[++index];
    else if (arg === '--citations-output') args.citationsOutputPath = argv[++index];
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
  if (args.help || !args.inputPath || !args.manifestPath || !args.outputPath) {
    console.error('Usage: node learn-anything-plugin/scripts/notebooklm/build-retrieval-pack.mjs --input <notebooklm-result.json> --manifest <notebooklm-manifest.json> --output <retrieval-pack.json> [--citations-output <citations.json>]');
    process.exitCode = args.help ? 0 : 2;
    return;
  }

  try {
    const pack = await buildRetrievalPack(args);
    console.log(`Retrieval pack written: ${args.outputPath} (${pack.citations.length} citations, ${pack.confidence} confidence)`);
  } catch (error) {
    console.error(error.message);
    if (error.validationErrors) for (const issue of error.validationErrors) console.error(`- ${issue}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
