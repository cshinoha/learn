import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildRetrievalPack, normalizeRetrievalPack, validateRetrievalPack } from './build-retrieval-pack.mjs';

const execFileAsync = promisify(execFile);
const MANIFEST = 'learn-anything-plugin/scripts/notebooklm/fixtures/valid-manifest.json';
const RAW_RESULT = 'learn-anything-plugin/scripts/notebooklm/fixtures/notebooklm-result.json';
const SCRIPT = 'learn-anything-plugin/scripts/notebooklm/build-retrieval-pack.mjs';
const NOW = '2026-06-10T12:00:00Z';

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('normalizeRetrievalPack builds compact cross-notebook pack with normalized citations', async () => {
  const input = await readJson(RAW_RESULT);
  const manifest = await readJson(MANIFEST);
  const pack = normalizeRetrievalPack(input, manifest, { now: NOW });

  assert.match(pack.pack_id, /^rpack_[a-f0-9]{24}$/);
  assert.equal(pack.skill_slug, 'python-data');
  assert.equal(pack.retrieval_mode, 'cross_notebook_query');
  assert.deepEqual(pack.notebook_ids, ['nb_python_data_001']);
  assert.equal(pack.citations.length, 1);
  assert.equal(pack.citations[0].source_title, 'Python iterator documentation');
  assert.deepEqual(validateRetrievalPack(pack), []);
});

test('buildRetrievalPack writes output and optional citation objects', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'la-rpack-'));
  const outputPath = join(dir, 'retrieval-pack.json');
  const citationsOutputPath = join(dir, 'citations.json');

  const pack = await buildRetrievalPack({ inputPath: RAW_RESULT, manifestPath: MANIFEST, outputPath, citationsOutputPath, now: NOW });
  const written = await readJson(outputPath);
  const citations = await readJson(citationsOutputPath);

  assert.equal(written.pack_id, pack.pack_id);
  assert.equal(citations.length, 1);
  assert.equal(citations[0].skill_slug, 'python-data');
  assert.equal(citations[0].used_for.startsWith('research:'), true);
});

test('retrieval pack validation rejects raw/secret-looking fields', () => {
  const errors = validateRetrievalPack({
    pack_id: 'rpack_aaaaaaaaaaaa',
    created_at: NOW,
    skill_slug: 'python-data',
    query: 'Question?',
    retrieval_mode: 'cross_notebook_query',
    notebook_ids: ['nb_python_data_001'],
    answer_summary: 'Compact summary',
    citations: [],
    followup_queries: [],
    confidence: 'low',
    limitations: [],
    raw_notebook_blob: 'raw answer blob should never be stored',
  });

  assert.equal(errors.some((issue) => issue.includes('unexpected field')), true);
  assert.equal(errors.some((issue) => issue.includes('forbidden key')), true);
});

test('CLI writes compact pack', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'la-rpack-cli-'));
  const outputPath = join(dir, 'retrieval-pack.json');
  const { stdout } = await execFileAsync(process.execPath, [SCRIPT, '--input', RAW_RESULT, '--manifest', MANIFEST, '--output', outputPath]);
  assert.match(stdout, /Retrieval pack written/);
  const written = await readJson(outputPath);
  assert.equal(written.retrieval_mode, 'cross_notebook_query');
});

test('CLI exits non-zero when result cannot form a compact pack', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'la-rpack-invalid-'));
  const badInput = join(dir, 'bad.json');
  const outputPath = join(dir, 'retrieval-pack.json');
  await writeFile(badInput, JSON.stringify({ answer_summary: 'No query' }));

  await assert.rejects(
    execFileAsync(process.execPath, [SCRIPT, '--input', badInput, '--manifest', MANIFEST, '--output', outputPath]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /retrieval pack validation failed/);
      return true;
    },
  );
});
