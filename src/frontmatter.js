// Tiny YAML-ish frontmatter: scalars, inline lists [a, b], block lists (- item).
export function parse(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data = {}; let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const li = raw.match(/^\s+-\s+(.*)$/);
    if (li && key) { (data[key] ||= []).push(unquote(li[1])); continue; }
    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1]; const v = kv[2].trim();
    if (v === '') data[key] = [];
    else if (v.startsWith('[') && v.endsWith(']')) data[key] = v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    else data[key] = unquote(v);
  }
  return { data, body: m[2] };
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s === 'null' || s === '~') return null;
  return s;
}

function quote(v) {
  if (v === null || v === undefined) return 'null';
  const s = String(v);
  return /[:#\[\]{}",']|^\s|\s$|^$/.test(s) ? JSON.stringify(s) : s;
}

export function stringify(data, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) {
      if (!v.length) lines.push(`${k}: []`);
      else { lines.push(`${k}:`); for (const it of v) lines.push(`  - ${quote(it)}`); }
    } else lines.push(`${k}: ${quote(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n') + body.replace(/^\n+/, '');
}
