import { loadConfig } from './config.js';
import { parseArgs, color } from './util.js';

const HELP = `
${color.bold('Porque')} · git blame for the why

  ${color.cyan('porque init')} [--lang es|en] [--no-hook]   set up decisions/, CLAUDE.md block and the Claude Code hook
  ${color.cyan('porque capture')} --transcript <file.jsonl>  extract decisions from a Claude Code session
                 [--all] [--dry-run] [--include-low] [--model sonnet|haiku|opus]
  ${color.cyan('porque why')} <path|term> [--ask ["question"]] why is this the way it is?
  ${color.cyan('porque sync')}                                regenerate the decisions block in CLAUDE.md
  ${color.cyan('porque check')} [--base main] [--format md] [--ask] [--strict]
                                              which recorded decisions does this change touch?
  ${color.cyan('porque add')} "title"                         record a decision by hand (opens an editor)

  Records live in decisions/*.md. Plain markdown, yours, versioned with the code.
  Docs: https://github.com/MiguelOvejeroD/porque
`;

export async function run(argv) {
  const { flags, positional } = parseArgs(argv);
  const [cmd, ...rest] = positional;
  if (!cmd || flags.help || cmd === 'help') { process.stdout.write(HELP); return 0; }
  const cfg = loadConfig();
  const args = { flags, positional: rest };
  switch (cmd) {
    case 'init': return (await import('./init.js')).init(cfg, args);
    case 'capture': return (await import('./capture.js')).capture(cfg, args);
    case 'why': return (await import('./why.js')).why(cfg, args);
    case 'sync': return (await import('./sync.js')).sync(cfg, {}) && 0;
    case 'check': return (await import('./check.js')).check(cfg, args);
    case 'add': return (await import('./add.js')).add(cfg, args);
    default:
      process.stderr.write(`porque: unknown command "${cmd}"\n${HELP}`);
      return 1;
  }
}
