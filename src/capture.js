import fs from 'node:fs';
import path from 'node:path';
import { readTranscript } from './transcript.js';
import { askJSON } from './llm.js';
import { loadDecisions, writeDecision } from './decisions.js';
import { sync } from './sync.js';
import { readJSON, writeJSON, gitAuthor, color } from './util.js';

const SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short imperative title, max 70 chars, e.g. "Use zod for request validation"' },
          decision: { type: 'string', description: 'What was decided, 1-3 sentences, concrete.' },
          why: { type: 'string', description: 'The reasoning that drove it: constraints, evidence, trade-offs. This is the most valuable field.' },
          alternatives: {
            type: 'array',
            items: { type: 'object', properties: { option: { type: 'string' }, reason: { type: 'string', description: 'why it was rejected' } }, required: ['option', 'reason'] },
          },
          consequences: { type: 'string', description: 'What this implies for future work; what would need to change to revisit it.' },
          scope: { type: 'array', items: { type: 'string' }, description: 'Repo paths or globs this decision governs, e.g. ["src/api/**", "package.json"]' },
          tags: { type: 'array', items: { type: 'string' }, description: '1-4 lowercase tags' },
          supersedes: { type: ['string', 'null'], description: 'id of an existing decision this one replaces, or null' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'high = explicitly decided and acted on; medium = decided implicitly by acting; low = discussed, unclear if final' },
        },
        required: ['title', 'decision', 'why', 'alternatives', 'consequences', 'scope', 'tags', 'supersedes', 'confidence'],
      },
    },
  },
  required: ['decisions'],
};

function systemPrompt(lang) {
  return `You are the memory of a software team that codes with AI assistants.
You read the transcript of one coding session and extract the DECISIONS that were made in it, with their reasoning.

A decision is worth recording when a teammate (or their AI) six weeks from now would otherwise undo it, contradict it, or waste time rediscovering it. Examples: choice of library, pattern, data model, API shape, naming convention, trade-off accepted, approach rejected, constraint discovered.

Do NOT record: routine implementation steps, bug fixes with no lasting choice, formatting, things the user merely asked about, or anything already covered by an existing decision (unless the session changed it, in which case set "supersedes").

Rules:
- Be concrete. Name the actual library / path / value.
- "why" must contain the real reasoning found in the transcript, not a generic justification. If the transcript gives no reason, say so explicitly ("no reason was stated; chosen by the assistant by default").
- Include alternatives that were actually considered or that the assistant rejected, with the reason.
- scope: real repo paths visible in the transcript; use globs when a whole area is affected.
- "supersedes" ONLY when the session reversed or replaced an existing decision. A record that merely adds detail to an existing one is not a new decision: skip it, unless the detail itself is a choice a teammate could undo (then record it with supersedes = null).
- Fewer, better records beat many weak ones. Zero decisions is a valid answer.
- Write all text in ${lang === 'es' ? 'Spanish (rioplatense neutral, no "vosotros")' : 'English'}, regardless of the transcript language.`;
}

function userPrompt(transcript, existing) {
  const ex = existing.length
    ? existing.map((d) => `- ${d.id}: ${d.title}`).join('\n')
    : '(none yet)';
  return `EXISTING DECISIONS (do not repeat; reference by id in "supersedes" if replaced):\n${ex}\n\n=== SESSION TRANSCRIPT ===\n${transcript}\n=== END ===\n\nExtract the decisions.`;
}

export async function capture(cfg, { flags }) {
  if (process.env.PORQUE_NESTED) return 0; // never run inside our own model call
  let transcriptPath = flags.transcript;
  let sessionId = flags.session || null;
  const isHook = !!flags.hook;
  const log = (s) => { if (!flags.quiet) process.stderr.write(s + '\n'); if (isHook) appendLog(cfg, s); };

  if (isHook) {
    const input = await readStdin();
    let payload = {}; try { payload = JSON.parse(input || '{}'); } catch {}
    transcriptPath = payload.transcript_path || transcriptPath;
    sessionId = payload.session_id || sessionId;
    if (payload.cwd && path.resolve(payload.cwd) !== path.resolve(cfg.root) && !path.resolve(payload.cwd).startsWith(cfg.root)) return 0;
  }
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    log(`porque: no transcript found (${transcriptPath || 'none given'}). Use --transcript <file.jsonl>.`);
    return isHook ? 0 : 1;
  }

  const state = readJSON(cfg.statePath, { sessions: {} });
  const key = sessionId || path.basename(transcriptPath, '.jsonl');
  const prev = flags.all ? 0 : (state.sessions[key]?.offset || 0);
  const { text, newOffset, turns, date } = readTranscript(transcriptPath, prev);
  const chars = text.length;

  if (chars < (flags.all ? 1 : cfg.minNewChars)) {
    if (!isHook) log(color.dim(`porque: only ${chars} new chars since last capture, nothing to do (use --all to re-scan).`));
    return 0;
  }

  log(color.dim(`porque: reading ${turns} turn(s), ${chars} chars from session ${key.slice(0, 8)}…`));
  const existing = loadDecisions(cfg);
  const result = await askJSON({
    system: systemPrompt(cfg.lang),
    prompt: userPrompt(text, existing),
    schema: SCHEMA, model: flags.model || cfg.model,
  });

  const minConf = flags['include-low'] ? ['high', 'medium', 'low'] : ['high', 'medium'];
  const picked = (result.decisions || []).filter((d) => minConf.includes(d.confidence));
  const skipped = (result.decisions || []).length - picked.length;

  if (flags['dry-run']) {
    process.stdout.write(JSON.stringify(picked, null, 2) + '\n');
    return 0;
  }

  const author = gitAuthor(cfg.root);
  const written = [];
  for (const d of picked) {
    const r = writeDecision(cfg, d, { author, date: date || undefined, source: `claude-code session ${key.slice(0, 8)}` });
    written.push({ ...r, title: d.title });
  }
  state.sessions[key] = { offset: newOffset, transcript: transcriptPath, updated: new Date().toISOString(),
    decisions: [...(state.sessions[key]?.decisions || []), ...written.map((w) => w.id)] };
  writeJSON(cfg.statePath, state);

  if (written.length) {
    log(color.green(`porque: ${written.length} decision(s) captured`) + (skipped ? color.dim(` (${skipped} low-confidence skipped)`) : ''));
    for (const w of written) log(`  ${color.cyan('+')} ${w.title}  ${color.dim(w.rel)}`);
    if (cfg.autoSync) { const s = sync(cfg, { quiet: true }); log(color.dim(`porque: context updated → ${s.files.join(', ')}`)); }
  } else {
    log(color.dim('porque: no new decisions in this segment.'));
  }
  return 0;
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = ''; process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 2000);
  });
}

function appendLog(cfg, line) {
  try { fs.mkdirSync(path.dirname(cfg.logPath), { recursive: true }); fs.appendFileSync(cfg.logPath, `${new Date().toISOString()} ${line.replace(/\x1b\[\d+m/g, '')}\n`); } catch {}
}
