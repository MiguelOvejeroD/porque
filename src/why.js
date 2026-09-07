import { loadDecisions, applySupersedes, summarize } from './decisions.js';
import { askJSON } from './llm.js';
import { git, pathMatches, color, firstSentence } from './util.js';

export function findDecisions(cfg, query) {
  const decisions = applySupersedes(loadDecisions(cfg));
  if (!query) return decisions.filter((d) => d.status === 'active').map((d) => ({ d, score: 1, reasons: [] }));
  const q = query.toLowerCase();
  const terms = q.split(/[\s,]+/).filter(Boolean);
  const hits = [];
  for (const d of decisions) {
    let score = 0; const reasons = [];
    for (const s of d.scope) if (pathMatches(s, query) || pathMatches(query, s)) { score += 5; reasons.push(`scope ${s}`); break; }
    for (const t of terms) {
      if (d.tags.some((x) => x.toLowerCase().includes(t))) { score += 3; reasons.push(`tag`); }
      if (d.title.toLowerCase().includes(t)) { score += 3; reasons.push('title'); }
      if (d.body.toLowerCase().includes(t)) { score += 1; }
    }
    if (score) hits.push({ d, score, reasons: [...new Set(reasons)] });
  }
  return hits.sort((a, b) => b.score - a.score || (a.d.date < b.d.date ? 1 : -1));
}

export function gitHistory(cfg, target, n = 6) {
  if (!target || /[*?]/.test(target)) return [];
  const out = git(`log -n ${n} --date=short --format=%h%x09%ad%x09%an%x09%s -- "${target}"`, cfg.root);
  return out.trim().split('\n').filter(Boolean).map((l) => { const [hash, date, author, subject] = l.split('\t'); return { hash, date, author, subject }; });
}

export async function why(cfg, { positional, flags }) {
  const query = positional.join(' ').trim();
  const hits = findDecisions(cfg, query);
  const es = cfg.lang === 'es';
  const history = gitHistory(cfg, query);

  if (flags.json) { process.stdout.write(JSON.stringify({ query, decisions: hits.map((h) => ({ ...h.d, body: undefined, sections: undefined, score: h.score })), history }, null, 2) + '\n'); return 0; }

  const w = (s = '') => process.stdout.write(s + '\n');
  w('');
  w(color.bold(query ? `porque ${query}` : (es ? 'porque · decisiones activas' : 'porque · active decisions')));
  w('');
  if (!hits.length) {
    w(color.yellow(es ? `No hay decisiones registradas sobre "${query}".` : `No recorded decisions about "${query}".`));
    w(color.dim(es ? 'Eso también es información: nadie dejó escrito por qué esto es así.' : 'That is information too: nobody wrote down why this is the way it is.'));
  }
  for (const { d, reasons } of hits.slice(0, flags.all ? 999 : 8)) {
    const status = d.status === 'active' ? color.green('●') : color.gray('○');
    w(`${status} ${color.bold(d.title)}  ${color.dim(`${d.date} · ${d.author}${d.status !== 'active' ? ` · ${d.status}` : ''}`)}`);
    w(`  ${summarize(d)}`);
    if (d.why) w(`  ${color.cyan(es ? 'Por qué:' : 'Why:')} ${wrap(firstSentence(d.why) === d.why.trim() ? d.why : d.why, 2)}`);
    const alts = d.sections.find((s) => /alternativ/i.test(s.title))?.text;
    if (alts && alts !== '-') w(`  ${color.magenta(es ? 'Descartado:' : 'Rejected:')} ${alts.split('\n').map((l) => l.replace(/^-\s*/, '').replace(/\*\*/g, '')).join(color.dim(' | '))}`);
    if (d.supersedes) w(`  ${color.dim(es ? 'Reemplaza a:' : 'Supersedes:')} ${d.supersedes}`);
    if (d.supersededBy) w(`  ${color.yellow(es ? 'Reemplazada por:' : 'Superseded by:')} ${d.supersededBy}`);
    w(`  ${color.dim(d.rel + (d.scope.length ? `  ·  ${d.scope.join(', ')}` : '') + (reasons.length ? `  ·  match: ${reasons.join(', ')}` : ''))}`);
    w('');
  }
  if (history.length) {
    w(color.dim(es ? `Historial git de ${query}:` : `Git history for ${query}:`));
    for (const h of history) w(color.dim(`  ${h.hash} ${h.date} ${h.author.padEnd(14).slice(0, 14)} ${h.subject}`));
    w('');
  }

  if (flags.ask) {
    const question = flags.ask === true ? (es ? `¿Por qué ${query} es así?` : `Why is ${query} the way it is?`) : String(flags.ask);
    w(color.dim(es ? 'Pensando…' : 'Thinking…'));
    const ctx = hits.slice(0, 12).map(({ d }) => `### ${d.title} (${d.date}, ${d.status})\n${d.body}`).join('\n\n');
    const res = await askJSON({
      model: flags.model || cfg.model,
      system: `You answer questions about a codebase using ONLY the team's recorded decisions and git history provided. If the records do not answer the question, say exactly what is missing instead of guessing. Answer in ${es ? 'Spanish' : 'English'}, tight, max 8 sentences, cite decision titles.`,
      prompt: `QUESTION: ${question}\n\nRECORDED DECISIONS:\n${ctx || '(none)'}\n\nGIT HISTORY:\n${history.map((h) => `${h.hash} ${h.date} ${h.author}: ${h.subject}`).join('\n') || '(none)'}`,
      schema: { type: 'object', properties: { answer: { type: 'string' }, gaps: { type: 'array', items: { type: 'string' }, description: 'what is not recorded but would be needed' } }, required: ['answer', 'gaps'] },
    });
    w(''); w(wrap(res.answer, 0)); w('');
    if (res.gaps?.length) { w(color.yellow(es ? 'No está registrado:' : 'Not recorded:')); for (const g of res.gaps) w(color.yellow(`  - ${g}`)); w(''); }
  }
  return 0;
}

function wrap(text, indent = 0, width = 96) {
  const pad = ' '.repeat(indent); const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const wd of words) { if ((cur + ' ' + wd).trim().length > width - indent) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); }
  if (cur) lines.push(cur);
  return lines.join('\n' + pad);
}
