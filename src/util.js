import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const color = {
  bold: c(1), dim: c(2), italic: c(3), underline: c(4),
  red: c(31), green: c(32), yellow: c(33), blue: c(34), magenta: c(35), cyan: c(36), gray: c(90),
};

export function repoRoot(cwd = process.cwd()) {
  try {
    return execSync('git rev-parse --show-toplevel', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return cwd;
  }
}

export function git(args, cwd) {
  try {
    return execSync(`git ${args}`, { cwd, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }).toString();
  } catch {
    return '';
  }
}

export function gitAuthor(cwd) {
  const name = git('config user.name', cwd).trim();
  return name || process.env.USER || 'unknown';
}

export function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'decision';
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function parseArgs(argv) {
  const flags = {}; const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}

// Minimal glob matcher: supports ** and * and directory prefixes ("src/auth" matches "src/auth/x.ts").
export function pathMatches(pattern, file) {
  if (!pattern || !file) return false;
  const p = pattern.replace(/^\.\//, '').replace(/\/$/, '');
  const f = file.replace(/^\.\//, '');
  if (f === p || f.startsWith(p + '/')) return true;
  if (!/[*?]/.test(p)) return p.startsWith(f + '/'); // querying a parent dir of the scope
  const dir = p.replace(/\/\*\*.*$/, ''); // "src/api/**" also matches a query for "src/api" itself
  if (dir && (f === dir || dir.startsWith(f + '/'))) return true;
  const re = new RegExp('^' + p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\/\*\*$/, '\u0001')
    .replace(/\*\*\//g, '\u0002')
    .replace(/\*\*/g, '\u0003')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0001/g, '(?:/.*)?')
    .replace(/\u0002/g, '(?:.*/)?')
    .replace(/\u0003/g, '.*') + '$');
  return re.test(f);
}

export function firstSentence(s = '') {
  const t = String(s).replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : t).slice(0, 220);
}
