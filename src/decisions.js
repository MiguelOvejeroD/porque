import fs from 'node:fs';
import path from 'node:path';
import * as fm from './frontmatter.js';
import { slugify, today, firstSentence } from './util.js';

export function loadDecisions(cfg) {
  if (!fs.existsSync(cfg.decisionsPath)) return [];
  return fs.readdirSync(cfg.decisionsPath)
    .filter((f) => f.endsWith('.md') && !/^readme\.md$/i.test(f))
    .map((f) => {
      const file = path.join(cfg.decisionsPath, f);
      const { data, body } = fm.parse(fs.readFileSync(file, 'utf8'));
      const sections = splitSections(body);
      return {
        file, rel: path.relative(cfg.root, file),
        id: data.id || f.replace(/\.md$/, ''),
        title: data.title || f,
        date: data.date || '',
        author: data.author || '',
        status: data.status || 'active',
        supersedes: data.supersedes || null,
        supersededBy: data.superseded_by || null,
        scope: toArr(data.scope), tags: toArr(data.tags),
        source: data.source || '', confidence: data.confidence || '',
        body, sections,
        decision: sections[0]?.text || '',
        why: findSection(sections, /por qu|^why/i),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
}

const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function splitSections(body) {
  const out = []; let cur = null;
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) { cur = { title: h[1].trim(), text: '' }; out.push(cur); }
    else if (cur) cur.text += (cur.text ? '\n' : '') + line;
  }
  return out.map((s) => ({ ...s, text: s.text.trim() }));
}

const findSection = (sections, re) => sections.find((s) => re.test(s.title))?.text || '';

// Resolves the supersedes chain in memory. writeDecision already marks the old file on disk;
// this covers records edited by hand (or written before superseded_by existed).
export function applySupersedes(decisions) {
  const byId = new Map(decisions.map((d) => [d.id, d]));
  for (const d of decisions) {
    if (!d.supersedes || !byId.has(d.supersedes)) continue;
    const old = byId.get(d.supersedes);
    old.status = 'superseded';
    if (!old.supersededBy) old.supersededBy = d.id;
  }
  return decisions;
}

// Marks an existing record as replaced by `byId`: status: superseded + superseded_by in its frontmatter.
// The file keeps its body untouched, so the old reasoning stays readable in the repo and on GitHub.
export function markSuperseded(cfg, oldId, byId) {
  const file = path.join(cfg.decisionsPath, oldId + '.md');
  if (!fs.existsSync(file)) return false;
  const { data, body } = fm.parse(fs.readFileSync(file, 'utf8'));
  const next = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'superseded_by') continue;
    next[k] = k === 'status' ? 'superseded' : v;
    if (k === 'supersedes') next.superseded_by = byId; // keep the chain fields together
  }
  if (!next.status) next.status = 'superseded';
  if (!next.superseded_by) next.superseded_by = byId;
  fs.writeFileSync(file, fm.stringify(next, body));
  return true;
}

export function newDecisionId(cfg, title, date = today()) {
  let base = `${date}-${slugify(title)}`; let id = base; let n = 2;
  while (fs.existsSync(path.join(cfg.decisionsPath, id + '.md'))) id = `${base}-${n++}`;
  return id;
}

// d: { title, decision, why, alternatives:[{option, reason}], consequences, scope, tags, supersedes, confidence }
export function writeDecision(cfg, d, meta) {
  fs.mkdirSync(cfg.decisionsPath, { recursive: true });
  const date = meta.date || today();
  const id = newDecisionId(cfg, d.title, date);
  const h = cfg.h;
  const data = {
    id, title: d.title, date, author: meta.author || 'unknown', status: 'active',
    supersedes: d.supersedes || null,
    superseded_by: null,
    scope: d.scope || [], tags: d.tags || [],
    confidence: d.confidence || 'medium',
    source: meta.source || 'manual',
  };
  const alts = (d.alternatives || []).map((a) => `- **${a.option}**: ${a.reason}`).join('\n') || '-';
  const body = [
    `# ${d.title}`, '',
    `## ${h.decision}`, '', d.decision.trim(), '',
    `## ${h.why}`, '', d.why.trim(), '',
    `## ${h.alternatives}`, '', alts, '',
    `## ${h.consequences}`, '', (d.consequences || '-').trim(), '',
  ].join('\n');
  const file = path.join(cfg.decisionsPath, id + '.md');
  fs.writeFileSync(file, fm.stringify(data, body));
  const superseded = d.supersedes && d.supersedes !== id ? markSuperseded(cfg, d.supersedes, id) : false;
  return { id, file, rel: path.relative(cfg.root, file), superseded: superseded ? d.supersedes : null };
}

export function summarize(d) {
  return firstSentence(d.decision);
}
