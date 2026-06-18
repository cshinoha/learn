#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readJson } from './notebooklm-client.mjs';
import { validateCitation } from './append-citation.mjs';

const citation = await readJson(new URL('./fixtures/citation.json', import.meta.url).pathname);
assert.equal(validateCitation(citation), true);
assert.throws(() => validateCitation({ ...citation, confidence: 'certain' }), /confidence/);
assert.throws(() => validateCitation({ ...citation, raw_answer: 'nope' }), /forbidden/);
console.log('append-citation.test ok');
