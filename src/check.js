import { loadDecisions, applySupersedes, summarize } from './decisions.js';
import { askJSON } from './llm.js';
import { git, pathMatches, color, firstSentence } from './util.js';

export async function check(cfg, { flags }) {
  const es = cfg.lang === 'es';
  const base = flags.base || detectBase(cfg);
  let files = git(`diff --name-only ${base}...HEAD`, cfg.root).trim().split('\n').filter(Boolean);
  if (!files.length) files = git('diff --name-only HEAD~1', cfg.root).trim().split('\n').filter(Boolean);
  const decisions = applySupersedes(loadDecisions(cfg)).filter((d) => d.status === 'active');
  const touched = [];
  for (const d of decisions) {
    const m = files.filter((f) => d.scope.some((s) => pathMatches(s, f)));
    if (m.length) touched.push({ d, files: m });
  }

  let verdicts = null;
  if (flags.ask && touched.length) {
    const diff = git(`diff ${base}...HEAD -- ${touched.flatMap((t) => t.files).map((f) => `"${f}"`).join(' ')}`, cfg.root).slice(0, 60000);
    const res = await askJSON({
      model: flags.model || cfg.model,
      system: `You review a code diff against a team's recorded decisions. For each decision, judge whether the diff RESPECTS it, CONTRADICTS it, or is UNRELATED. Be strict about contradictions and explain them in one sentence. Answer in ${es ? 'Spanish' : 'English'}.`,
      prompt: `DECISIONS:\n${touched.map(({ d }) => `### [${d.id}] ${d.title}\n${d.body}`).join('\n\n')}\n\nDIFF:\n${diff}`,
      schema: { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['respects', 'contradicts', 'unrelated'] }, note: { type: 'string' } }, required: ['id', 'verdict', 'note'] } } }, required: ['verdicts'] },
    });
    verdicts = new Map(res.verdicts.map((v) => [v.id, v]));
  }

  const md = flags.format === 'md';
  const out = [];
  if (!touched.length) {
    out.push(md ? `**porque** · ${es ? 'Este cambio no toca ninguna decisión registrada.' : 'This change touches no recorded decision.'}`
                : color.dim(es ? 'porque: este cambio no toca ninguna decisión registrada.' : 'porque: this change touches no recorded decision.'));
  } else {
    out.push(md ? `### porque · ${touched.length} ${es ? 'decisión(es) afectada(s) por este cambio' : 'decision(s) affected by this change'}\n`
                : color.bold(`porque · ${touched.length} ${es ? 'decisión(es) afectada(s) por este cambio' : 'decision(s) affected by this change'}\n`));
    for (const { d, files: fl } of touched) {
      const v = verdicts?.get(d.id);
      const icon = !v ? (md ? '📎' : color.cyan('▸')) : v.verdict === 'contradicts' ? (md ? '⚠️' : color.red('✖')) : v.verdict === 'respects' ? (md ? '✅' : color.green('✔')) : (md ? '➖' : color.gray('–'));
      if (md) {
        out.push(`${icon} **${d.title}** (${d.date}) — ${summarize(d)}  `);
        out.push(`&nbsp;&nbsp;&nbsp;${es ? 'Por qué' : 'Why'}: ${firstSentence(d.why)}  `);
        if (v) out.push(`&nbsp;&nbsp;&nbsp;**${v.verdict}**: ${v.note}  `);
        out.push(`&nbsp;&nbsp;&nbsp;${es ? 'Archivos' : 'Files'}: ${fl.map((f) => `\`${f}\``).join(', ')} · [${d.rel}](${d.rel})\n`);
      } else {
        out.push(`${icon} ${color.bold(d.title)} ${color.dim(`(${d.date})`)}`);
        out.push(`  ${summarize(d)}`);
        out.push(`  ${color.cyan(es ? 'Por qué:' : 'Why:')} ${firstSentence(d.why)}`);
        if (v) out.push(`  ${v.verdict === 'contradicts' ? color.red(v.verdict) : color.green(v.verdict)}: ${v.note}`);
        out.push(color.dim(`  ${fl.join(', ')}  ·  ${d.rel}`), '');
      }
    }
    if (!verdicts) out.push(md ? `\n_${es ? 'Antes de mergear, confirmá que el cambio respeta estas decisiones o registrá una nueva que las reemplace.' : 'Before merging, confirm the change respects these decisions or record a new one that supersedes them.'}_`
                              : color.dim(es ? 'Antes de mergear, confirmá que el cambio respeta estas decisiones o registrá una nueva que las reemplace. (--ask para que el modelo lo evalúe)' : 'Before merging, confirm the change respects these decisions or record one that supersedes them. (--ask lets the model judge)'));
  }
  process.stdout.write(out.join('\n') + '\n');
  const contradictions = verdicts ? [...verdicts.values()].filter((v) => v.verdict === 'contradicts').length : 0;
  return flags.strict && contradictions ? 1 : 0;
}

function detectBase(cfg) {
  for (const b of ['origin/main', 'origin/master', 'main', 'master']) if (git(`rev-parse --verify ${b}`, cfg.root).trim()) return b;
  return 'HEAD~1';
}
