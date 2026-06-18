#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_SCHEMA_PATH = 'learn-anything-plugin/schemas/notebooklm-manifest.schema.json';

const NOTEBOOK_STATUSES = new Set(['active', 'full', 'stale', 'missing', 'error']);
const SOURCE_STATUSES = new Set(['candidate', 'curated', 'linked', 'indexed', 'failed', 'stale', 'rejected']);
const SOURCE_TYPES = new Set(['url', 'youtube', 'drive', 'doc', 'other_link']);
const ARTIFACT_STATUSES = new Set(['created', 'linked', 'failed', 'stale']);
const ARTIFACT_TYPES = new Set(['audio', 'video', 'report', 'quiz', 'flashcards', 'mind_map', 'slide_deck', 'infographic', 'data_table', 'study_guide', 'other']);
const TRANSPORT_TYPES = new Set(['http_via_ssh_reverse', 'http_local', 'sse_via_ssh_reverse', 'stdio', 'unknown']);
const ENDPOINT_ENV = /^[A-Z][A-Z0-9_]{2,80}$/;
const SKILL_SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;
const SKILL_ID = /^[a-zA-Z0-9_-]{4,32}$/;
const NOTEBOOK_NAME = /^LA - ([a-z0-9][a-z0-9-]{0,80}) - ([A-Za-z0-9_-]{4,32}) - ([0-9]{3})$/;
const ISO_DATEISH = /^\d{4}-\d{2}-\d{2}T/;
const URLISH = /^https?:\/\//i;
const FILE_URLISH = /^(file|sftp|ftp):\/\//i;
const LOCAL_PATHISH = /(^|\s)(~\/|\.\.?\/|\/tmp\/|\/Users\/|\/home\/|[A-Za-z]:\\)/;

const FORBIDDEN_KEY_RE = /(cookie|cookies|token|secret|api[_-]?key|bearer|authorization|credential|password|oauth|session(_file)?|ssh(_|-)?private|private[_-]?key|raw(_|-)?notebook|raw(_|-)?answer|raw(_|-)?blob|mcp(_|-)?dump|request(_|-)?dump|response(_|-)?dump|download(ed)?(_|-)?file|local(_|-)?retrieval(_|-)?cache|source(_|-)?text|private(_|-)?source)/i;
const FORBIDDEN_VALUE_RE = /(-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/=-]+|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|oauth|cookie=|SID=|HSID=|SSID=|raw notebook|raw answer|full MCP dump|local retrieval cache)/i;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pushMissing(errors, path, object, keys) {
  for (const key of keys) {
    if (!hasOwn(object, key)) errors.push(`${path}.${key}: required`);
  }
}

function expectObject(errors, path, value) {
  if (!isPlainObject(value)) {
    errors.push(`${path}: expected object`);
    return false;
  }
  return true;
}

function expectArray(errors, path, value) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected array`);
    return false;
  }
  return true;
}

function expectString(errors, path, value, { allowNull = false, pattern, enumSet } = {}) {
  if (value === null && allowNull) return;
  if (typeof value !== 'string') {
    errors.push(`${path}: expected string`);
    return;
  }
  if (pattern && !pattern.test(value)) errors.push(`${path}: invalid format`);
  if (enumSet && !enumSet.has(value)) errors.push(`${path}: unsupported value ${JSON.stringify(value)}`);
}

function expectDate(errors, path, value, { allowNull = false } = {}) {
  if (value === null && allowNull) return;
  expectString(errors, path, value, { pattern: ISO_DATEISH });
}

function expectInteger(errors, path, value, { min } = {}) {
  if (!Number.isInteger(value)) {
    errors.push(`${path}: expected integer`);
    return;
  }
  if (min !== undefined && value < min) errors.push(`${path}: must be >= ${min}`);
}

function expectNoAdditional(errors, path, object, allowedKeys) {
  if (!isPlainObject(object)) return;
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key}: unexpected field`);
  }
}

function validateLastError(errors, path, value) {
  if (value === null) return;
  if (!expectObject(errors, path, value)) return;
  const allowed = new Set(['code', 'message', 'occurred_at', 'retryable', 'phase']);
  expectNoAdditional(errors, path, value, allowed);
  pushMissing(errors, path, value, ['code', 'message', 'occurred_at']);
  if (hasOwn(value, 'code')) expectString(errors, `${path}.code`, value.code, { pattern: /^[A-Z0-9_:-]{2,80}$/ });
  if (hasOwn(value, 'message')) expectString(errors, `${path}.message`, value.message);
  if (hasOwn(value, 'occurred_at')) expectDate(errors, `${path}.occurred_at`, value.occurred_at);
  if (hasOwn(value, 'retryable') && typeof value.retryable !== 'boolean') errors.push(`${path}.retryable: expected boolean`);
  if (hasOwn(value, 'phase')) expectString(errors, `${path}.phase`, value.phase, { enumSet: new Set(['auth', 'transport', 'notebook_lookup', 'notebook_create', 'source_add', 'query', 'artifact_create', 'sync', 'cleanup', 'unknown']) });
}

function scanForbidden(errors, value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(errors, item, `${path}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`${path}.${key}: forbidden key for metadata-only manifest`);
      scanForbidden(errors, child, `${path}.${key}`);
    }
    return;
  }

  if (typeof value === 'string') {
    if (FORBIDDEN_VALUE_RE.test(value)) errors.push(`${path}: forbidden secret/raw/cache-looking value`);
  }
}

function validateShape(manifest) {
  const errors = [];
  if (!expectObject(errors, '$', manifest)) return errors;

  const topAllowed = new Set(['version', 'skill_slug', 'skill_id', 'created_at', 'updated_at', 'naming_convention', 'binding_strategy', 'transport', 'notebooks', 'sources', 'artifacts', 'sync']);
  expectNoAdditional(errors, '$', manifest, topAllowed);
  pushMissing(errors, '$', manifest, [...topAllowed]);

  if (hasOwn(manifest, 'version') && manifest.version !== '1.0') errors.push('$.version: must be 1.0');
  if (hasOwn(manifest, 'skill_slug')) expectString(errors, '$.skill_slug', manifest.skill_slug, { pattern: SKILL_SLUG });
  if (hasOwn(manifest, 'skill_id')) expectString(errors, '$.skill_id', manifest.skill_id, { pattern: SKILL_ID });
  if (hasOwn(manifest, 'created_at')) expectDate(errors, '$.created_at', manifest.created_at);
  if (hasOwn(manifest, 'updated_at')) expectDate(errors, '$.updated_at', manifest.updated_at);
  if (hasOwn(manifest, 'naming_convention') && manifest.naming_convention !== 'LA - <skill-slug> - <short-id> - <shard>') errors.push('$.naming_convention: unsupported convention');
  if (hasOwn(manifest, 'binding_strategy') && manifest.binding_strategy !== 'names_plus_mirror') errors.push('$.binding_strategy: unsupported strategy');

  if (hasOwn(manifest, 'transport') && expectObject(errors, '$.transport', manifest.transport)) {
    const allowed = new Set(['type', 'endpoint_env', 'mcp_server', 'last_checked_at']);
    expectNoAdditional(errors, '$.transport', manifest.transport, allowed);
    pushMissing(errors, '$.transport', manifest.transport, ['type', 'endpoint_env']);
    if (hasOwn(manifest.transport, 'type')) expectString(errors, '$.transport.type', manifest.transport.type, { enumSet: TRANSPORT_TYPES });
    if (hasOwn(manifest.transport, 'endpoint_env')) expectString(errors, '$.transport.endpoint_env', manifest.transport.endpoint_env, { pattern: ENDPOINT_ENV });
    if (hasOwn(manifest.transport, 'mcp_server')) expectString(errors, '$.transport.mcp_server', manifest.transport.mcp_server);
    if (hasOwn(manifest.transport, 'last_checked_at')) expectDate(errors, '$.transport.last_checked_at', manifest.transport.last_checked_at);
  }

  if (hasOwn(manifest, 'notebooks') && expectArray(errors, '$.notebooks', manifest.notebooks)) {
    manifest.notebooks.forEach((notebook, index) => {
      const path = `$.notebooks[${index}]`;
      if (!expectObject(errors, path, notebook)) return;
      const allowed = new Set(['shard_index', 'notebook_id', 'notebook_name', 'status', 'created_at', 'last_seen_at', 'last_query_at', 'last_error']);
      expectNoAdditional(errors, path, notebook, allowed);
      pushMissing(errors, path, notebook, ['shard_index', 'notebook_id', 'notebook_name', 'status', 'created_at', 'last_seen_at', 'last_error']);
      if (hasOwn(notebook, 'shard_index')) expectInteger(errors, `${path}.shard_index`, notebook.shard_index, { min: 1 });
      if (hasOwn(notebook, 'notebook_id')) expectString(errors, `${path}.notebook_id`, notebook.notebook_id);
      if (hasOwn(notebook, 'notebook_name')) expectString(errors, `${path}.notebook_name`, notebook.notebook_name, { pattern: NOTEBOOK_NAME });
      if (hasOwn(notebook, 'status')) expectString(errors, `${path}.status`, notebook.status, { enumSet: NOTEBOOK_STATUSES });
      if (hasOwn(notebook, 'created_at')) expectDate(errors, `${path}.created_at`, notebook.created_at);
      if (hasOwn(notebook, 'last_seen_at')) expectDate(errors, `${path}.last_seen_at`, notebook.last_seen_at);
      if (hasOwn(notebook, 'last_query_at')) expectDate(errors, `${path}.last_query_at`, notebook.last_query_at, { allowNull: true });
      if (hasOwn(notebook, 'last_error')) validateLastError(errors, `${path}.last_error`, notebook.last_error);
    });
  }

  if (hasOwn(manifest, 'sources') && expectArray(errors, '$.sources', manifest.sources)) {
    manifest.sources.forEach((source, index) => {
      const path = `$.sources[${index}]`;
      if (!expectObject(errors, path, source)) return;
      const allowed = new Set(['resource_id', 'source_id', 'notebook_id', 'shard_index', 'title', 'url', 'source_type', 'curation_status', 'learning_role', 'linked_at', 'last_verified_at', 'last_error']);
      expectNoAdditional(errors, path, source, allowed);
      pushMissing(errors, path, source, ['resource_id', 'source_id', 'notebook_id', 'shard_index', 'title', 'url', 'source_type', 'curation_status', 'learning_role', 'linked_at', 'last_verified_at', 'last_error']);
      if (hasOwn(source, 'resource_id')) expectString(errors, `${path}.resource_id`, source.resource_id);
      if (hasOwn(source, 'source_id')) expectString(errors, `${path}.source_id`, source.source_id);
      if (hasOwn(source, 'notebook_id')) expectString(errors, `${path}.notebook_id`, source.notebook_id);
      if (hasOwn(source, 'shard_index')) expectInteger(errors, `${path}.shard_index`, source.shard_index, { min: 1 });
      if (hasOwn(source, 'title')) expectString(errors, `${path}.title`, source.title);
      if (hasOwn(source, 'url')) {
        expectString(errors, `${path}.url`, source.url, { pattern: URLISH });
        if (typeof source.url === 'string' && (FILE_URLISH.test(source.url) || LOCAL_PATHISH.test(source.url))) errors.push(`${path}.url: must be link-only http(s), not a local/downloaded file`);
      }
      if (hasOwn(source, 'source_type')) expectString(errors, `${path}.source_type`, source.source_type, { enumSet: SOURCE_TYPES });
      if (hasOwn(source, 'curation_status')) expectString(errors, `${path}.curation_status`, source.curation_status, { enumSet: SOURCE_STATUSES });
      if (hasOwn(source, 'learning_role')) expectString(errors, `${path}.learning_role`, source.learning_role, { enumSet: new Set(['explanation', 'visualization', 'demonstration', 'practice', 'reference', 'motivation', 'source_evidence', 'assessment', 'community', 'other']) });
      if (hasOwn(source, 'linked_at')) expectDate(errors, `${path}.linked_at`, source.linked_at, { allowNull: true });
      if (hasOwn(source, 'last_verified_at')) expectDate(errors, `${path}.last_verified_at`, source.last_verified_at, { allowNull: true });
      if (hasOwn(source, 'last_error')) validateLastError(errors, `${path}.last_error`, source.last_error);
    });
  }

  if (hasOwn(manifest, 'artifacts') && expectArray(errors, '$.artifacts', manifest.artifacts)) {
    manifest.artifacts.forEach((artifact, index) => {
      const path = `$.artifacts[${index}]`;
      if (!expectObject(errors, path, artifact)) return;
      const allowed = new Set(['artifact_id', 'notebook_id', 'artifact_type', 'title', 'url', 'metadata', 'created_for', 'created_at', 'status', 'last_error']);
      expectNoAdditional(errors, path, artifact, allowed);
      pushMissing(errors, path, artifact, ['artifact_id', 'notebook_id', 'artifact_type', 'title', 'url', 'metadata', 'created_for', 'created_at', 'status', 'last_error']);
      if (hasOwn(artifact, 'artifact_id')) expectString(errors, `${path}.artifact_id`, artifact.artifact_id);
      if (hasOwn(artifact, 'notebook_id')) expectString(errors, `${path}.notebook_id`, artifact.notebook_id);
      if (hasOwn(artifact, 'artifact_type')) expectString(errors, `${path}.artifact_type`, artifact.artifact_type, { enumSet: ARTIFACT_TYPES });
      if (hasOwn(artifact, 'title')) expectString(errors, `${path}.title`, artifact.title);
      if (hasOwn(artifact, 'url')) expectString(errors, `${path}.url`, artifact.url, { allowNull: true, pattern: URLISH });
      if (hasOwn(artifact, 'metadata') && expectObject(errors, `${path}.metadata`, artifact.metadata)) {
        for (const [key, value] of Object.entries(artifact.metadata)) {
          if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) errors.push(`${path}.metadata.${key}: expected scalar metadata`);
        }
      }
      if (hasOwn(artifact, 'created_for')) expectString(errors, `${path}.created_for`, artifact.created_for, { pattern: /^(lesson|material|source|assessment|research):[A-Za-z0-9_.:-]+$/ });
      if (hasOwn(artifact, 'created_at')) expectDate(errors, `${path}.created_at`, artifact.created_at, { allowNull: true });
      if (hasOwn(artifact, 'status')) expectString(errors, `${path}.status`, artifact.status, { enumSet: ARTIFACT_STATUSES });
      if (hasOwn(artifact, 'last_error')) validateLastError(errors, `${path}.last_error`, artifact.last_error);
    });
  }

  if (hasOwn(manifest, 'sync') && expectObject(errors, '$.sync', manifest.sync)) {
    const allowed = new Set(['mode', 'last_sync_at', 'last_sidecar_seen_at', 'last_error']);
    expectNoAdditional(errors, '$.sync', manifest.sync, allowed);
    pushMissing(errors, '$.sync', manifest.sync, ['mode', 'last_sync_at', 'last_sidecar_seen_at', 'last_error']);
    if (hasOwn(manifest.sync, 'mode') && manifest.sync.mode !== 'write_through_remote_writes_mirror') errors.push('$.sync.mode: unsupported mode');
    if (hasOwn(manifest.sync, 'last_sync_at')) expectDate(errors, '$.sync.last_sync_at', manifest.sync.last_sync_at, { allowNull: true });
    if (hasOwn(manifest.sync, 'last_sidecar_seen_at')) expectDate(errors, '$.sync.last_sidecar_seen_at', manifest.sync.last_sidecar_seen_at, { allowNull: true });
    if (hasOwn(manifest.sync, 'last_error')) validateLastError(errors, '$.sync.last_error', manifest.sync.last_error);
  }

  return errors;
}

function validateCrossFields(manifest) {
  const errors = [];
  if (!isPlainObject(manifest)) return errors;

  const notebooks = Array.isArray(manifest.notebooks) ? manifest.notebooks : [];
  const sources = Array.isArray(manifest.sources) ? manifest.sources : [];
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const skillSlug = manifest.skill_slug;
  const skillId = manifest.skill_id;

  const shardIndexes = new Map();
  const notebookIds = new Map();

  notebooks.forEach((notebook, index) => {
    const path = `$.notebooks[${index}]`;
    if (!isPlainObject(notebook)) return;

    if (Number.isInteger(notebook.shard_index)) {
      const previous = shardIndexes.get(notebook.shard_index);
      if (previous !== undefined) errors.push(`${path}.shard_index: duplicate with $.notebooks[${previous}]`);
      else shardIndexes.set(notebook.shard_index, index);
    }

    if (typeof notebook.notebook_id === 'string') {
      const previous = notebookIds.get(notebook.notebook_id);
      if (previous !== undefined) errors.push(`${path}.notebook_id: duplicate with $.notebooks[${previous}]`);
      else notebookIds.set(notebook.notebook_id, index);
    }

    if (typeof notebook.notebook_name === 'string') {
      const match = notebook.notebook_name.match(NOTEBOOK_NAME);
      if (match && typeof skillSlug === 'string' && typeof skillId === 'string') {
        const [, nameSlug, nameId, shardText] = match;
        if (nameSlug !== skillSlug) errors.push(`${path}.notebook_name: slug does not match $.skill_slug`);
        if (nameId !== skillId) errors.push(`${path}.notebook_name: short id does not match $.skill_id`);
        if (Number.isInteger(notebook.shard_index) && Number(shardText) !== notebook.shard_index) errors.push(`${path}.notebook_name: shard suffix does not match shard_index`);
      }
    }

    if (notebook.status === 'error' && notebook.last_error === null) errors.push(`${path}.last_error: required when notebook status is error`);
  });

  sources.forEach((source, index) => {
    const path = `$.sources[${index}]`;
    if (!isPlainObject(source)) return;
    if (typeof source.notebook_id === 'string' && !notebookIds.has(source.notebook_id)) errors.push(`${path}.notebook_id: unknown notebook_id`);
    if (Number.isInteger(source.shard_index) && !shardIndexes.has(source.shard_index)) errors.push(`${path}.shard_index: unknown shard_index`);
    if (typeof source.source_id === 'string') {
      const duplicate = sources.findIndex((candidate, candidateIndex) => candidateIndex !== index && isPlainObject(candidate) && candidate.source_id === source.source_id);
      if (duplicate !== -1) errors.push(`${path}.source_id: duplicate with $.sources[${duplicate}]`);
    }
    if (source.curation_status === 'failed' && source.last_error === null) errors.push(`${path}.last_error: required when source curation_status is failed`);
  });

  artifacts.forEach((artifact, index) => {
    const path = `$.artifacts[${index}]`;
    if (!isPlainObject(artifact)) return;
    if (typeof artifact.notebook_id === 'string' && !notebookIds.has(artifact.notebook_id)) errors.push(`${path}.notebook_id: unknown notebook_id`);
    if (artifact.status === 'failed' && artifact.last_error === null) errors.push(`${path}.last_error: required when artifact status is failed`);
  });

  return errors;
}

export function validateManifest(manifest) {
  const errors = [];
  errors.push(...validateShape(manifest));
  errors.push(...validateCrossFields(manifest));
  scanForbidden(errors, manifest);
  return [...new Set(errors)].sort();
}

export async function readJsonFile(path) {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text);
}

export async function validateManifestFile(path) {
  let manifest;
  try {
    manifest = await readJsonFile(path);
  } catch (error) {
    return [`${path}: cannot read or parse JSON (${error.message})`];
  }
  return validateManifest(manifest);
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath || process.argv.includes('--help')) {
    console.error('Usage: node learn-anything-plugin/scripts/notebooklm/validate-manifest.mjs <manifest.json>');
    console.error(`Schema reference: ${DEFAULT_SCHEMA_PATH}`);
    process.exitCode = 2;
    return;
  }

  const errors = await validateManifestFile(manifestPath);
  if (errors.length > 0) {
    console.error(`NotebookLM manifest validation failed (${errors.length} issues):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
      return;
  }

  console.log(`NotebookLM manifest validation passed: ${manifestPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
