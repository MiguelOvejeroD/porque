import { spawnSync } from 'node:child_process';

// Asks a model for structured JSON. Uses the `claude` CLI when available (no API key needed
// for Claude Code users), otherwise falls back to the Anthropic API with ANTHROPIC_API_KEY.
export async function askJSON({ system, prompt, schema, model = 'sonnet', timeoutMs = 180000 }) {
  const provider = process.env.PORQUE_PROVIDER || (hasClaudeCli() ? 'claude' : 'api');
  if (provider === 'claude') return viaClaudeCli({ system, prompt, schema, model, timeoutMs });
  return viaApi({ system, prompt, schema, model, timeoutMs });
}

export function hasClaudeCli() {
  const r = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  return !r.error && r.status === 0;
}

function viaClaudeCli({ system, prompt, schema, model, timeoutMs }) {
  // --setting-sources '' skips project settings, so a nested call never re-triggers the porque Stop hook.
  // (--bare would also do it, but it disables keychain auth.)
  const args = ['-p', '--setting-sources', '', '--output-format', 'json', '--no-session-persistence', '--model', model,
    '--json-schema', JSON.stringify(schema), '--tools', '', '--system-prompt', system];
  const env = { ...process.env, PORQUE_NESTED: '1' };
  delete env.CLAUDECODE; // allow running from inside a Claude Code hook
  const r = spawnSync('claude', args, { input: prompt, encoding: 'utf8', timeout: timeoutMs, env, maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw new Error(`claude CLI failed: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`claude CLI exited ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  let out; try { out = JSON.parse(r.stdout); } catch { throw new Error('claude CLI returned non-JSON output'); }
  if (out.structured_output) return out.structured_output;
  return extractJSON(out.result || '');
}

async function viaApi({ system, prompt, schema, model, timeoutMs }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No `claude` CLI found and ANTHROPIC_API_KEY is not set.');
  const modelId = { haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-5', opus: 'claude-opus-5' }[model] || model;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: modelId, max_tokens: 4096, system,
        tools: [{ name: 'emit', description: 'Emit the structured result.', input_schema: schema }],
        tool_choice: { type: 'tool', name: 'emit' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const tool = data.content?.find((c) => c.type === 'tool_use');
    if (!tool) throw new Error('API returned no structured output');
    return tool.input;
  } finally { clearTimeout(t); }
}

function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON found in model output');
  return JSON.parse(m[0]);
}
