import fs from 'node:fs';
import path from 'node:path';
import { DEFAULTS } from './config.js';
import { sync } from './sync.js';
import { readJSON, writeJSON, color } from './util.js';

export function init(cfg, { flags }) {
  const root = cfg.root;
  const lang = flags.lang || cfg.lang || 'es';
  const es = lang === 'es';
  const w = (s) => process.stdout.write(s + '\n');

  // 1. config
  const cfgFile = path.join(root, '.porque.json');
  if (!fs.existsSync(cfgFile)) {
    writeJSON(cfgFile, { decisionsDir: DEFAULTS.decisionsDir, contextFiles: DEFAULTS.contextFiles, lang, model: DEFAULTS.model });
    w(`${color.green('+')} .porque.json`);
  }
  cfg = { ...cfg, lang, h: (await0(lang)) };

  // 2. decisions dir
  fs.mkdirSync(cfg.decisionsPath, { recursive: true });
  w(`${color.green('+')} ${cfg.decisionsDir}/`);

  // 3. Claude Code hook (Stop → capture)
  const settingsFile = path.join(root, '.claude', 'settings.json');
  const settings = readJSON(settingsFile, {});
  settings.hooks ||= {};
  settings.hooks.Stop ||= [];
  const cmd = 'npx --yes porque-cli capture --hook --quiet';
  const already = JSON.stringify(settings.hooks.Stop).includes('porque');
  if (!already && !flags['no-hook']) {
    settings.hooks.Stop.push({ hooks: [{ type: 'command', command: cmd, timeout: 180 }] });
    writeJSON(settingsFile, settings);
    w(`${color.green('+')} .claude/settings.json ${color.dim('(Stop hook → porque capture)')}`);
  }

  // 3b. MCP server so the assistant can ask (and record) by itself
  const mcpFile = path.join(root, '.mcp.json');
  const mcp = readJSON(mcpFile, {});
  mcp.mcpServers ||= {};
  if (!mcp.mcpServers.porque) {
    mcp.mcpServers.porque = { command: 'npx', args: ['--yes', 'porque-cli', 'mcp'] };
    writeJSON(mcpFile, mcp);
    w(`${color.green('+')} .mcp.json ${color.dim('(MCP server → tools porque_why, porque_record)')}`);
  }

  // 4. gitignore
  const gi = path.join(root, '.gitignore');
  const giText = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^\.porque\/?$/m.test(giText)) { fs.writeFileSync(gi, giText.replace(/\s*$/, '') + (giText ? '\n' : '') + '.porque/\n'); w(`${color.green('+')} .gitignore ${color.dim('(.porque/ local state)')}`); }

  // 5. context block
  sync(cfg, { quiet: true });
  w(`${color.green('+')} ${cfg.contextFiles.join(', ')} ${color.dim(es ? '(bloque de decisiones)' : '(decisions block)')}`);

  w('');
  w(color.bold(es ? 'Listo. Así funciona:' : 'Done. How it works:'));
  w(es
    ? `  1. Trabajá normalmente con Claude Code. Al final de cada respuesta, el hook lee la sesión\n     y guarda las decisiones nuevas (con su por qué) en ${cfg.decisionsDir}/.\n  2. ${cfg.contextFiles[0]} se actualiza solo: la próxima sesión, tuya o de tu equipo, arranca sabiéndolas.\n  3. Tu asistente tiene la tool ${color.cyan('porque_why')}: la usa antes de tocar código para saber por qué\n     algo es como es, y ${color.cyan('porque_record')} para registrar lo que decide con vos.\n  4. ${color.cyan('porque check')} en el PR avisa qué decisiones toca el cambio.\n\n  Commiteá ${cfg.decisionsDir}/ y ${cfg.contextFiles[0]} como cualquier otro archivo del repo.`
    : `  1. Work normally with Claude Code. After each response, the hook reads the session\n     and stores new decisions (with their why) in ${cfg.decisionsDir}/.\n  2. ${cfg.contextFiles[0]} updates itself: the next session, yours or a teammate's, starts knowing them.\n  3. Your assistant gets the tool ${color.cyan('porque_why')}: it uses it before touching code to learn why\n     something is the way it is, and ${color.cyan('porque_record')} to record what it decides with you.\n  4. ${color.cyan('porque check')} in the PR lists which decisions the change touches.\n\n  Commit ${cfg.decisionsDir}/ and ${cfg.contextFiles[0]} like any other file in the repo.`);
  return 0;
}

function await0(lang) { return lang === 'es'
  ? { decision: 'Decisión', why: 'Por qué', alternatives: 'Alternativas descartadas', consequences: 'Consecuencias', context: 'Decisiones del equipo', index: 'Registro de decisiones' }
  : { decision: 'Decision', why: 'Why', alternatives: 'Rejected alternatives', consequences: 'Consequences', context: 'Team decisions', index: 'Decision log' }; }
