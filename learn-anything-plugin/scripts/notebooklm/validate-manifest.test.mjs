import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateManifestFile } from './validate-manifest.mjs';

const execFileAsync = promisify(execFile);
const VALID = 'learn-anything-plugin/scripts/notebooklm/fixtures/valid-manifest.json';
const INVALID = 'learn-anything-plugin/scripts/notebooklm/fixtures/invalid-manifest.json';
const VALIDATOR = 'learn-anything-plugin/scripts/notebooklm/validate-manifest.mjs';

function includesAny(errors, needle) {
  return errors.some((error) => error.includes(needle));
}

test('valid manifest fixture passes all contract checks', async () => {
  const errors = await validateManifestFile(VALID);
  assert.deepEqual(errors, []);
});

test('invalid manifest fixture exposes cross-field and safety diagnostics', async () => {
  const errors = await validateManifestFile(INVALID);

  for (const expected of [
    '$.transport.endpoint_env: invalid format',
    '$.transport.authorization_header: unexpected field',
    '$.notebooks[1].shard_index: duplicate',
    '$.notebooks[1].notebook_id: duplicate',
    '$.notebooks[0].notebook_name: slug does not match $.skill_slug',
    '$.notebooks[0].notebook_name: shard suffix does not match shard_index',
    '$.notebooks[1].last_error: required when notebook status is error',
    '$.sources[0].notebook_id: unknown notebook_id',
    '$.sources[0].shard_index: unknown shard_index',
    '$.sources[0].url: invalid format',
    '$.sources[0].url: must be link-only http(s)',
    '$.sources[0].source_type: unsupported value',
    '$.sources[0].last_error: required when source curation_status is failed',
    '$.sources[1].source_id: duplicate',
    '$.artifacts[0].notebook_id: unknown notebook_id',
    '$.artifacts[0].last_error: required when artifact status is failed',
    'forbidden key for metadata-only manifest',
    'forbidden secret/raw/cache-looking value',
  ]) {
    assert.equal(includesAny(errors, expected), true, `missing diagnostic containing: ${expected}\nActual:\n${errors.join('\n')}`);
  }
});

test('CLI exits 0 for valid manifest and prints compact success', async () => {
  const { stdout } = await execFileAsync(process.execPath, [VALIDATOR, VALID]);
  assert.match(stdout, /NotebookLM manifest validation passed/);
});

test('CLI exits non-zero for invalid manifest and prints compact failures', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [VALIDATOR, INVALID]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /NotebookLM manifest validation failed/);
      assert.match(error.stderr, /unknown notebook_id/);
      assert.match(error.stderr, /forbidden key for metadata-only manifest/);
      return true;
    },
  );
});
