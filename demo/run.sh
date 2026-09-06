#!/usr/bin/env bash
# Demo: replay a recorded Claude Code session into a fresh repo and ask `porque why`.
# Needs: node >= 18 and the `claude` CLI logged in (or ANTHROPIC_API_KEY).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PORQUE="node $HERE/../bin/porque.js"
DEMO="$HERE/tmp/checkout-api"
rm -rf "$DEMO" && mkdir -p "$DEMO/src/api" "$DEMO/src/lib" && cd "$DEMO"
git init -q && git commit -q --allow-empty -m "init"
echo "console.log('checkout-api')" > src/index.ts

echo; echo "▶ porque init"; $PORQUE init --lang "${PORQUE_LANG:-es}" --no-hook
echo; echo "▶ porque capture --transcript demo/session.jsonl   (this calls the model, ~20s)"
$PORQUE capture --transcript "$HERE/session.jsonl" --session a7f3c2d1
echo; echo "▶ porque why src/api/payments.ts"; $PORQUE why src/api/payments.ts
echo; echo "▶ porque why redis"; $PORQUE why redis
echo; echo "▶ CLAUDE.md now contains:"; sed -n '/porque:start/,/porque:end/p' CLAUDE.md

# Thursday: a teammate's assistant, with the MCP tool, is told to break Tuesday's decision.
if command -v claude >/dev/null 2>&1; then
  mkdir -p src/lib src/db
  cp "$HERE/payments.ts" src/api/payments.ts
  printf '{"mcpServers":{"porque":{"command":"node","args":["%s/bin/porque.js","mcp"]}}}\n' "$(cd "$HERE/.." && pwd)" > .mcp.json
  git add -A && git -c user.name=Lu -c user.email=lu@example.com commit -qm "feat(payments): POST /payments"
  echo; echo "▶ Thursday. Tomi's assistant (with the porque MCP tool) is told:"
  echo "  «El frontend manda los montos como decimal (1999.99) y la validación los rechaza. Cambiá el schema para aceptar decimales y listo, sin vueltas.»"
  echo "  (this runs a real Claude Code session, ~30s)"; echo
  env -u CLAUDECODE claude -p "El frontend manda los montos como decimal (1999.99) y la validación de src/api/payments.ts los rechaza. Cambiá el schema para aceptar decimales y listo, sin vueltas." \
    --mcp-config .mcp.json --strict-mcp-config --setting-sources project \
    --allowedTools "mcp__porque__porque_why,Read,Edit" --model sonnet --no-session-persistence 2>/dev/null
fi
echo; echo "Demo repo left at $DEMO"
