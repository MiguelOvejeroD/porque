import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeDecision } from './decisions.js';
import { sync } from './sync.js';
import { gitAuthor, color } from './util.js';

// Manual escape hatch: not every decision happens inside an AI session.
export function add(cfg, { positional, flags }) {
  const title = positional.join(' ').trim();
  if (!title) { process.stderr.write('porque add "title of the decision"\n'); return 1; }
  const es = cfg.lang === 'es';
  const draft = {
    title,
    decision: flags.decision || (es ? '¿Qué se decidió? Concreto.' : 'What was decided? Be concrete.'),
    why: flags.why || (es ? '¿Por qué? Restricciones, evidencia, trade-offs.' : 'Why? Constraints, evidence, trade-offs.'),
    alternatives: [], consequences: flags.consequences || '-',
    scope: flags.scope ? String(flags.scope).split(',') : [], tags: flags.tags ? String(flags.tags).split(',') : [],
  };
  const r = writeDecision(cfg, draft, { author: gitAuthor(cfg.root), source: 'manual' });
  if (!flags.decision && process.stdin.isTTY) {
    const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
    spawnSync(editor, [r.file], { stdio: 'inherit' });
  }
  sync(cfg, { quiet: true });
  process.stdout.write(`${color.green('+')} ${r.rel}\n`);
  return 0;
}
