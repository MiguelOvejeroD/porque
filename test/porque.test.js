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

test('renderWhy says so when nothing is recorded', async () => {
  const { renderWhy } = await import('../src/mcp.js');
  const cfg = { lang: 'en', decisionsPath: path.join(os.tmpdir(), 'porque-empty-' + Date.now()), root: os.tmpdir() };
  assert.match(renderWhy(cfg, 'src/nothing'), /No recorded decisions/);
});

test('writeDecision with supersedes marks the old record on disk and why shows the chain', async () => {
  const { writeDecision, loadDecisions, applySupersedes } = await import('../src/decisions.js');
  const { findDecisions } = await import('../src/why.js');
  const { renderWhy } = await import('../src/mcp.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'porque-chain-'));
  const cfg = { lang: 'en', h: HEADINGS.en, root, decisionsDir: 'decisions', decisionsPath: path.join(root, 'decisions') };
  const old = writeDecision(cfg, { title: 'Use yup', decision: 'Use yup.', why: 'Familiar.', scope: ['src/api/**'], tags: ['validation'] }, { author: 'Lu', date: '2026-09-01' });
  const neu = writeDecision(cfg, { title: 'Use zod', decision: 'Use zod.', why: 'Types.', scope: ['src/api/**'], tags: ['validation'], supersedes: old.id }, { author: 'Tomi', date: '2026-09-03' });
  assert.equal(neu.superseded, old.id);

  const oldFile = fs.readFileSync(old.file, 'utf8');
  assert.match(oldFile, /^status: superseded$/m);
  assert.match(oldFile, new RegExp(`^superseded_by: ${neu.id}$`, 'm'));
  assert.match(oldFile, /## Why\n\nFamiliar\./); // body untouched

  const all = applySupersedes(loadDecisions(cfg));
  assert.deepEqual(all.map((d) => [d.id, d.status, d.supersedes, d.supersededBy]), [
    [neu.id, 'active', old.id, null],
    [old.id, 'superseded', null, neu.id],
  ]);
  assert.deepEqual(findDecisions(cfg, '').map((h) => h.d.id), [neu.id]);           // no query: active only
  assert.deepEqual(findDecisions(cfg, 'src/api/x.ts').map((h) => h.d.id), [neu.id, old.id]); // query: full history

  const out = renderWhy(cfg, 'src/api/x.ts');
  assert.match(out, new RegExp(`Supersedes: ${old.id}`));
  assert.match(out, new RegExp(`SUPERSEDED by ${neu.id}`));
});

test('applySupersedes resolves hand-edited chains without superseded_by', async () => {
  const { applySupersedes } = await import('../src/decisions.js');
  const a = { id: 'a', status: 'active', supersedes: null, supersededBy: null };
  const b = { id: 'b', status: 'active', supersedes: 'a', supersededBy: null };
  applySupersedes([a, b]);
  assert.equal(a.status, 'superseded');
  assert.equal(a.supersededBy, 'b');
});
