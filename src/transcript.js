import fs from 'node:fs';

// Reads a Claude Code transcript (JSONL) from a byte offset and returns a compact,
// human-readable conversation. Thinking blocks and noisy tool output are dropped.
export function readTranscript(file, offset = 0, { maxToolResult = 400 } = {}) {
  const size = fs.statSync(file).size;
  if (offset > size) offset = 0; // file was replaced
  const buf = Buffer.alloc(size - offset);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, buf, 0, buf.length, offset); } finally { fs.closeSync(fd); }
  const raw = buf.toString('utf8');
  const lastNl = raw.lastIndexOf('\n');
  const complete = lastNl === -1 ? '' : raw.slice(0, lastNl + 1);
  const newOffset = offset + Buffer.byteLength(complete, 'utf8');

  const out = []; let sessionId = null; let turns = 0; let lastTs = null;
  for (const line of complete.split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    sessionId ||= e.sessionId || e.session_id || null;
    if (e.timestamp) lastTs = e.timestamp;
    if (e.type !== 'user' && e.type !== 'assistant') continue;
    if (e.isMeta || e.isSidechain) continue;
    const parts = renderMessage(e.message, maxToolResult);
    if (!parts.length) continue;
    const who = e.type === 'user' ? 'USER' : 'ASSISTANT';
    if (who === 'USER') turns++;
    out.push(`[${who}]\n${parts.join('\n')}`);
  }
  return { text: out.join('\n\n'), newOffset, sessionId, turns, date: lastTs ? String(lastTs).slice(0, 10) : null };
}

function renderMessage(msg, maxToolResult) {
  if (!msg) return [];
  const content = msg.content;
  if (typeof content === 'string') return content.trim() ? [content.trim()] : [];
  if (!Array.isArray(content)) return [];
  const parts = [];
  for (const p of content) {
    if (!p || typeof p !== 'object') continue;
    if (p.type === 'text' && p.text?.trim()) {
      if (/^<(system-reminder|local-command|command-name)/.test(p.text.trim())) continue;
      parts.push(p.text.trim());
    } else if (p.type === 'tool_use') {
      parts.push(`(tool ${p.name}: ${describeToolInput(p.input)})`);
    } else if (p.type === 'tool_result') {
      const t = typeof p.content === 'string' ? p.content
        : Array.isArray(p.content) ? p.content.map((c) => c.text || '').join(' ') : '';
      const clean = t.replace(/\s+/g, ' ').trim();
      if (clean) parts.push(`(result: ${clean.slice(0, maxToolResult)}${clean.length > maxToolResult ? '…' : ''})`);
    }
  }
  return parts;
}

function describeToolInput(input = {}) {
  if (input.file_path) return input.file_path;
  if (input.command) return String(input.command).slice(0, 160);
  if (input.pattern) return `search ${input.pattern}`;
  if (input.description) return String(input.description).slice(0, 160);
  return JSON.stringify(input).slice(0, 160);
}
