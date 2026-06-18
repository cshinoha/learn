#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readJson } from './notebooklm-client.mjs';
import { validateManifest } from './validate-manifest.mjs';

const valid = await readJson(new URL('./fixtures/valid-manifest.json', import.meta.url).pathname);
assert.equal(validateManifest(valid), true);
assert.throws(() => validateManifest({ ...valid, raw_source_text: 'nope' }), /forbidden/);
console.log('validate-manifest.test ok');
