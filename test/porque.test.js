import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as fm from '../src/frontmatter.js';
import { pathMatches, slugify, firstSentence } from '../src/util.js';
import { readTranscript } from '../src/transcript.js';
import { renderContextBlock, START, END } from '../src/sync.js';
import { HEADINGS } from '../src/config.js';

test('frontmatter round-trips scalars, lists and nulls', () => {
  const data = { id: 'x', title: 'Use zod: yes', scope: ['src/api/**', 'package.json'], tags: [], supersedes: null };
  const { data: back, body } = fm.parse(fm.stringify(data, '# T\n\nbody'));
  assert.deepEqual(back, data);
  assert.equal(body.trim(), '# T\n\nbody');
});

test('pathMatches handles prefixes, globs and parent queries', () => {
  assert.ok(pathMatches('src/api/**', 'src/api/payments.ts'));
  assert.ok(pathMatches('src/api/**', 'src/api'));
  assert.ok(pathMatches('src/api', 'src/api/payments.ts'));
  assert.ok(pathMatches('src/api/payments.ts', 'src/api'));
  assert.ok(pathMatches('src/lib/*.ts', 'src/lib/idempotency.ts'));
  assert.ok(!pathMatches('src/lib/*.ts', 'src/lib/x/y.ts'));
  assert.ok(pathMatches('**/*.test.ts', 'src/a/b.test.ts'));
  assert.ok(!pathMatches('package.json', 'src/x'));
});

test('slugify strips accents and punctuation', () => {
  assert.equal(slugify('Usar zod para validación de requests'), 'usar-zod-para-validacion-de-requests');
});

test('firstSentence cuts at the first period', () => {
  assert.equal(firstSentence('Uno. Dos tres.'), 'Uno.');
});

test('readTranscript is incremental and skips tool noise', () => {
  const r = readTranscript(path.join(import.meta.dirname, '..', 'demo', 'session.jsonl'), 0);
  assert.equal(r.turns, 9);
  assert.equal(r.sessionId, 'a7f3c2d1-4e5b-4c6d-8e9f-0a1b2c3d4e5f');
  assert.equal(r.date, '2026-09-01');
  assert.match(r.text, /\[ASSISTANT\]/);
  assert.match(r.text, /\(tool Write: src\/api\/payments\.ts\)/);
  const again = readTranscript(path.join(import.meta.dirname, '..', 'demo', 'session.jsonl'), r.newOffset);
  assert.equal(again.text, '');
});

test('renderContextBlock lists active decisions between markers', () => {
  const cfg = { lang: 'en', h: HEADINGS.en, decisionsDir: 'decisions', maxContextDecisions: 40 };
  const block = renderContextBlock(cfg, [
    { title: 'Use zod', date: '2026-09-01', status: 'active', scope: ['src/**'], decision: 'Use zod. More.', why: 'Types. More.', rel: 'decisions/a.md' },
    { title: 'Old', date: '2026-08-01', status: 'superseded', scope: [], decision: 'x', why: 'y', rel: 'decisions/b.md' },
  ]);
  assert.ok(block.startsWith(START) && block.endsWith(END));
  assert.match(block, /\*\*Use zod\*\* \(2026-09-01\) `src\/\*\*`: Use zod\. Why: Types\./);
  assert.ok(!block.includes('**Old**'));
  assert.match(block, /1 active decisions/);
});
