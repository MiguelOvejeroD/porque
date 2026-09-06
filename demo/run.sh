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
echo; echo "Demo repo left at $DEMO"
