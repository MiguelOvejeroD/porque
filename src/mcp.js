// Minimal MCP server over stdio (newline-delimited JSON-RPC 2.0). No dependencies.
// Exposes the team's recorded decisions to any MCP client: Claude Code, Cursor, Codex, ...
import { findDecisions, gitHistory } from './why.js';
import { writeDecision } from './decisions.js';
import { sync } from './sync.js';
import { gitAuthor } from './util.js';

const TOOLS = (cfg) => {
  const es = cfg.lang === 'es';
  return [
    {
      name: 'porque_why',
      description: es
        ? 'Consultá las decisiones registradas por el equipo antes de modificar código. Devuelve las decisiones (con su por qué y las alternativas descartadas) que gobiernan un path o mencionan un término, más el historial git del path. Usala SIEMPRE antes de editar un archivo o elegir una librería, patrón o formato: si existe una decisión previa, respetala o explicá por qué la contradecís.'
        : 'Look up the decisions the team has recorded before changing code. Returns the decisions (with their why and rejected alternatives) that govern a path or mention a term, plus the git history of the path. ALWAYS use it before editing a file or choosing a library, pattern or format: if a prior decision exists, respect it or explain why you contradict it.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: es ? 'Path del repo (src/api/payments.ts, src/lib) o término (redis, validación). Vacío lista todas las activas.' : 'Repo path (src/api/payments.ts, src/lib) or term (redis, validation). Empty lists all active decisions.' } },
      },
    },
    {
      name: 'porque_record',
      description: es
        ? 'Registrá una decisión que acabás de tomar con el usuario y que un compañero podría deshacer sin saberlo: elección de librería, patrón, formato de datos, trade-off aceptado. Incluí el razonamiento real y las alternativas que se descartaron. No registres tareas ni fixes sin una elección duradera.'
        : 'Record a decision you just made with the user that a teammate could undo without knowing: library choice, pattern, data format, accepted trade-off. Include the real reasoning and the alternatives that were rejected. Do not record tasks or fixes without a lasting choice.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' }, decision: { type: 'string' }, why: { type: 'string' },
          alternatives: { type: 'array', items: { type: 'object', properties: { option: { type: 'string' }, reason: { type: 'string' } }, required: ['option', 'reason'] } },
          consequences: { type: 'string' },
          scope: { type: 'array', items: { type: 'string' }, description: 'paths or globs this decision governs' },
          tags: { type: 'array', items: { type: 'string' } },
          supersedes: { type: 'string', description: 'id of a decision this one replaces, if any' },
        },
        required: ['title', 'decision', 'why', 'scope'],
      },
    },
  ];
};

export function renderWhy(cfg, query) {
  const es = cfg.lang === 'es';
  const hits = findDecisions(cfg, query);
  const history = gitHistory(cfg, query);
  const lines = [];
  if (!hits.length) {
    lines.push(es ? `No hay decisiones registradas sobre "${query}". Nadie dejó escrito por qué esto es así: si tomás una decisión relevante acá, registrala con porque_record.`
                  : `No recorded decisions about "${query}". Nobody wrote down why this is the way it is: if you make a relevant decision here, record it with porque_record.`);
  } else {
    lines.push(es ? `${hits.length} decisión(es) registradas para "${query || 'todo el repo'}". Respetalas o explicá explícitamente por qué las contradecís.` : `${hits.length} recorded decision(s) for "${query || 'the whole repo'}". Respect them or explicitly explain why you contradict them.`, '');
    for (const { d } of hits.slice(0, 10)) {
      lines.push(`## ${d.title}`);
      lines.push(`${d.date} · ${d.author} · ${d.status}${d.scope.length ? ` · scope: ${d.scope.join(', ')}` : ''} · ${d.rel}`);
      lines.push(d.body.replace(/^#\s.*\n/, '').trim(), '');
    }
  }
  if (history.length) {
    lines.push(es ? `Historial git de ${query}:` : `Git history for ${query}:`);
    for (const h of history) lines.push(`  ${h.hash} ${h.date} ${h.author}: ${h.subject}`);
  }
  return lines.join('\n');
}

export function serve(cfg) {
  let buf = '';
  const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  const handle = (req) => {
    const { id, method, params = {} } = req;
    if (id === undefined) return; // notification
    switch (method) {
      case 'initialize':
        return reply(id, { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'porque', version: '0.1.0' } });
      case 'ping': return reply(id, {});
      case 'tools/list': return reply(id, { tools: TOOLS(cfg) });
      case 'tools/call': {
        const { name, arguments: args = {} } = params;
        try {
          if (name === 'porque_why') return reply(id, { content: [{ type: 'text', text: renderWhy(cfg, String(args.query || '').trim()) }] });
          if (name === 'porque_record') {
            const r = writeDecision(cfg, { ...args, alternatives: args.alternatives || [], consequences: args.consequences || '-', tags: args.tags || [], confidence: 'high' }, { author: gitAuthor(cfg.root), source: 'mcp porque_record' });
            sync(cfg, { quiet: true });
            return reply(id, { content: [{ type: 'text', text: (cfg.lang === 'es' ? 'Decisión registrada en ' : 'Decision recorded at ') + r.rel + (cfg.lang === 'es' ? '. CLAUDE.md actualizado.' : '. CLAUDE.md updated.') }] });
          }
          return reply(id, { content: [{ type: 'text', text: `Unknown tool ${name}` }], isError: true });
        } catch (e) {
          return reply(id, { content: [{ type: 'text', text: `porque error: ${e.message}` }], isError: true });
        }
      }
      default: return fail(id, -32601, `Method not found: ${method}`);
    }
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buf += chunk; let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let req; try { req = JSON.parse(line); } catch { continue; }
      handle(req);
    }
  });
  process.stdin.on('end', () => process.exit(0));
  return new Promise(() => {}); // stay alive
}
