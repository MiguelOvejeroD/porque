import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, readJSON } from './util.js';

export const DEFAULTS = {
  decisionsDir: 'decisions',
  contextFiles: ['CLAUDE.md'],
  lang: 'es',
  model: 'sonnet',
  maxContextDecisions: 40,
  autoSync: true,
  minNewChars: 600,
};

export const HEADINGS = {
  es: { decision: 'Decisión', why: 'Por qué', alternatives: 'Alternativas descartadas', consequences: 'Consecuencias', context: 'Decisiones del equipo', index: 'Registro de decisiones' },
  en: { decision: 'Decision', why: 'Why', alternatives: 'Rejected alternatives', consequences: 'Consequences', context: 'Team decisions', index: 'Decision log' },
};

export function loadConfig(cwd = process.cwd()) {
  const root = repoRoot(cwd);
  const file = path.join(root, '.porque.json');
  const user = readJSON(file, {});
  const cfg = { ...DEFAULTS, ...user, root };
  cfg.decisionsPath = path.join(root, cfg.decisionsDir);
  cfg.statePath = path.join(root, '.porque', 'state.json');
  cfg.logPath = path.join(root, '.porque', 'log');
  cfg.h = HEADINGS[cfg.lang] || HEADINGS.en;
  cfg.exists = fs.existsSync(file);
  return cfg;
}
