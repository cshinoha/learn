import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendCitation, normalizeCitation, validateCitation } from './append-citation.mjs';

const execFileAsync = promisify(execFile);
const CITATION = 'learn-anything-plugin/scripts/notebooklm/fixtures/citation.json';
const SCRIPT = 'learn-anything-plugin/scripts/notebooklm/append-citation.mjs';
const NOW = '2026-06-10T12:00:00Z';

async function tempLedger() {
  const dir = await mkdtemp(join(tmpdir(), 'la-citations-'));
  return join(dir, 'citations.jsonl');
}

test('normalizes generated citation IDs and validates compact citation shape', () => {
  const citation = normalizeCitation({
    skill_slug: 'python-data',
    query_id: 'query_iterators_intro',
    used_for: 'lesson:iterators-intro',
    notebook_id: 'nb_python_data_001',
    source_id: 'src_python_docs_iterators',
    source_title: 'Python iterator documentation',
    source_url: 'https://docs.python.org/3/howto/functional.html#iterators',
    location_type: 'section',
    location: 'Iterators',
    snippet: 'Iterators represent streams of data.',
    deep_link: 'https://docs.python.org/3/howto/functional.html#iterators',
    confidence: 'high',
  }, { now: NOW });

  assert.match(citation.citation_id, /^cit_[a-f0-9]{24}$/);
  assert.deepEqual(validateCitation(citation), []);
});

test('appendCitation appends once and dedupes by stable source/location/snippet key', async () => {
  const ledgerPath = await tempLedger();

  const first = await appendCitation({ ledgerPath, citationPath: CITATION, now: NOW });
  const second = await appendCitation({ ledgerPath, citationPath: CITATION, now: NOW });

  assert.equal(first.appended, true);
  assert.equal(second.appended, false);
  assert.equal(first.citation.citation_id, second.citation.citation_id);

  const lines = (await readFile(ledgerPath, 'utf8')).trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
});

test('appendCitation rejects forbidden raw/secret-looking fields', async () => {
  const ledgerPath = await tempLedger();
  await assert.rejects(
    appendCitation({
      ledgerPath,
      citationObject: {
        skill_slug: 'python-data',
        query_id: 'query_iterators_intro',
        used_for: 'lesson:iterators-intro',
        notebook_id: 'nb_python_data_001',
        source_id: 'src_python_docs_iterators',
        source_title: 'Python iterator documentation',
        source_url: 'https://docs.python.org/3/howto/functional.html#iterators',
        location_type: 'section',
        location: 'Iterators',
        timestamp_seconds: null,
        page: null,
        section_title: 'Iterators',
        snippet: 'short snippet',
        deep_link: 'https://docs.python.org/3/howto/functional.html#iterators',
        confidence: 'high',
        raw_answer_blob: 'raw answer blob should never be persisted',
      },
      now: NOW,
    }),
    (error) => {
      assert.match(error.message, /citation validation failed/);
      assert.equal(error.validationErrors.some((issue) => issue.includes('forbidden key')), true);
      return true;
    },
  );
});

test('CLI appends and prints a citation id when requested', async () => {
  const ledgerPath = await tempLedger();
  const { stdout } = await execFileAsync(process.execPath, [SCRIPT, '--ledger', ledgerPath, '--citation', CITATION, '--print-id']);
  assert.match(stdout.trim(), /^cit_[a-f0-9]{24}$/);
});

test('CLI exits non-zero for invalid citation JSON', async () => {
  const ledgerPath = await tempLedger();
  const invalidPath = join(await mkdtemp(join(tmpdir(), 'la-citation-invalid-')), 'invalid.json');
  await writeFile(invalidPath, JSON.stringify({ skill_slug: 'bad slug' }));

  await assert.rejects(
    execFileAsync(process.execPath, [SCRIPT, '--ledger', ledgerPath, '--citation', invalidPath]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /citation validation failed/);
      return true;
    },
  );
});
