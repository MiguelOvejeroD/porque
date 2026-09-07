# Porque

**Construir dejando huella.** git blame for the why.

Decisions are never documented; only their conclusions are. Git remembers *what* changed. Nobody remembers *why*. And now that every developer on the team codes with an AI assistant, the *why* lives in a chat window that gets closed at the end of the day.

`Porque` reads your AI coding sessions, extracts the decisions that were made in them (with their reasoning and the alternatives that were rejected), and stores them as plain markdown in your repo. Then it hands them back to the AI: an MCP tool lets any assistant ask *why is this file the way it is* before touching it, and record what it decides with you.

```
Tomi ▸ El frontend manda los montos como decimal (1999.99) y la validación de
       src/api/payments.ts los rechaza. Cambiá el schema para aceptar decimales
       y listo, sin vueltas.

  ⚙ porque_why({ query: "src/api/payments.ts" })

Claude ▸ Hay una decisión activa que esto contradice directamente:
       "Representar amount en centavos como entero", que dice explícitamente que
       amount nunca debe ser decimal/float, para evitar los errores de precisión
       de floats de JS en conciliaciones de pagos.

       Si cambio el schema para aceptar 1999.99 tal cual, estaría revirtiendo esa
       decisión en silencio. Lo que propongo en su lugar: mantener amount como
       entero en centavos y convertir el decimal del frontend en el borde de la
       validación (z.preprocess), rechazando si el resultado no es entero exacto.

       ¿Querés que lo implemente así, o preferís revertir la decisión del equipo?
       En ese caso debería registrarse con porque_record.
```

That is a real, unedited Claude Code session from `npm run demo`. Tomi's assistant had never seen Lu's chat. It asked the repo.

> Este README está en inglés porque el código lo está. La herramienta habla español por defecto (`--lang en` para inglés).

---

## The problem

Tuesday. Lu asks her assistant to add `POST /payments`. It picks `zod` over `yup` for three good reasons, stores amounts as integer cents to avoid float errors, and adds idempotency keys in Redis with a 24h TTL "because that's the window Stripe uses". All of that reasoning is in the chat. The commit says `feat(payments): POST /payments`.

Thursday. Tomi asks *his* assistant to fix a validation bug in the same file. His assistant has never seen Lu's chat. It rewrites the validation with `yup`, accepts `1999.99` as a float, and drops the idempotency check because "it wasn't in the requirements".

Nobody did anything wrong. The team simply has no memory that survives the end of a session, and the AI multiplied the number of decisions per day without adding any memory to hold them.

## What Porque does

```
  you + your AI ──▶ session transcript ──▶ porque capture ──▶ decisions/*.md
                                                                   │
   a teammate's AI ──▶ porque_why (MCP tool) ──▶ asks before editing ◀┤
                   ◀── porque_record (MCP tool) ── records what it decides
                                                                   │
                                     CLAUDE.md (short notice) ◀────┤
                                     porque check (PR)  ◀──────────┘
```

1. **Capture.** A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `Stop` hook runs `porque capture` after every response. It reads only the new part of the transcript, asks a model to extract *decisions* (not tasks), and writes one markdown file per decision: what, why, rejected alternatives, consequences, scope (paths), tags.
2. **Serve it to the AI, not to the human.** `porque mcp` is a tiny MCP server (stdio, no dependencies) with two tools. `porque_why` returns the decisions that govern a path or mention a term, with their reasoning, plus the git history. `porque_record` lets the assistant write down a decision it just made with you. Any MCP client works: Claude Code, Cursor, Codex, Windsurf.
3. **Nudge.** A short block in `CLAUDE.md` tells every session: before modifying a file or choosing a library, call `porque_why`; if you decide something a teammate could undo, call `porque_record`.
4. **Check.** `porque check` in CI lists the decisions a PR touches. `--ask` lets the model judge whether the diff respects or contradicts each one, and comments on the PR.

For humans, `porque why <path>` prints the same thing in the terminal.

The records are plain markdown, committed with the code. No database, no service, no account. Delete the tool and you keep everything.

## Install

Requires Node 18+ and the `claude` CLI logged in (or `ANTHROPIC_API_KEY`).

```bash
cd your-repo
npx --yes porque-cli init          # creates decisions/, .mcp.json, the CLAUDE.md block and the Stop hook
```

Then work with Claude Code as usual. After each response you will see, in `decisions/`, the decisions that were just made. Commit them. Your assistant now has the `porque_why` and `porque_record` tools (Claude Code picks up `.mcp.json` automatically; for Cursor or Codex, point their MCP config at `npx --yes porque-cli mcp`).

## Try it in 60 seconds without an existing project

The repo ships a recorded session (`demo/session.jsonl`) from the story above.

```bash
git clone https://github.com/MiguelOvejeroD/porque && cd porque
npm run demo
```

It creates a throwaway repo, replays Lu's Tuesday session, and then runs Tomi's Thursday session for real: a Claude Code call with the MCP tool, told to accept decimal amounts "sin vueltas". Watch it ask `porque_why` first. Then, to see the PR check catch the mistake if someone pushes it anyway:

```bash
cd demo/tmp/checkout-api
# (make a change that swaps zod for yup in src/api/payments.ts, commit on a branch)
porque check --base main --ask
```

```
porque · 3 decisión(es) afectada(s) por este cambio

✖ Usar zod para validación de requests
  contradicts: El diff usa 'yup' en lugar de 'zod' para validar PaymentRequest...
✖ Representar amount en centavos como entero
  contradicts: amount se valida como number().positive() con ejemplo '1999.99', tratándolo como decimal...
✖ Idempotencia de pagos vía header Idempotency-Key + Redis
  contradicts: El handler no exige ni lee el header Idempotency-Key...
```

## Commands

| Command | What it does |
|---|---|
| `porque init [--lang es\|en] [--no-hook]` | Sets up `decisions/`, `.porque.json`, the `CLAUDE.md` block and the Claude Code hook. |
| `porque capture --transcript <file.jsonl>` | Extracts decisions from a Claude Code transcript. Incremental: remembers where it stopped per session. `--all` rescans, `--dry-run` prints JSON, `--include-low` keeps low-confidence ones. |
| `porque why <path or term> [--ask ["question"]]` | Decisions governing a path or mentioning a term, plus git history. `--ask` synthesizes an answer and lists what is not recorded. |
| `porque sync` | Regenerates the block in `CLAUDE.md` and `decisions/README.md`. Runs automatically after capture. |
| `porque check [--base main] [--format md] [--ask] [--strict]` | Which decisions does this branch touch. `--ask` judges respects/contradicts. `--strict` exits 1 on contradiction. |
| `porque add "title"` | Record a decision by hand. Not everything happens inside an AI session. |
| `porque mcp` | MCP server over stdio exposing `porque_why` and `porque_record`. `init` registers it in `.mcp.json`. |

## A decision record

```markdown
---
id: 2026-09-01-usar-zod-para-validacion-de-requests
title: Usar zod para validación de requests
date: 2026-09-01
author: Lu
status: active            # active | superseded
supersedes: null          # id of the decision this one replaced
superseded_by: null       # filled in automatically when a newer decision supersedes this one
scope:
  - src/api/**
  - package.json
tags: [validation, typescript]
confidence: high
source: claude-code session a7f3c2d1
---
# Usar zod para validación de requests

## Decisión
Se adopta zod como librería de validación de body en la API...

## Por qué
Infiere tipos TS desde el schema...

## Alternativas descartadas
- **yup**: inferencia de tipos más débil...
- **JSON Schema de Fastify**: dos fuentes de verdad...

## Consecuencias
Toda validación nueva usa zod. Para revisar esto hay que...
```

Edit it by hand whenever you want. The file is the source of truth; `porque sync` picks up your edits.

**Nothing is ever deleted.** To reverse a decision, record a new one with `supersedes: <old id>` (the capture step and `porque_record` do this for you). The old file stays in the repo with `status: superseded` and `superseded_by: <new id>`, so the whole chain is readable from either end: `porque why <path>` and `porque_why` show both records, the old one flagged as superseded and pointing at its replacement. Only `CLAUDE.md` and `porque check` filter down to active decisions.

## Configuration (`.porque.json`)

```json
{
  "decisionsDir": "decisions",
  "contextFiles": ["CLAUDE.md"],
  "lang": "es",
  "model": "sonnet",
  "maxContextDecisions": 40,
  "autoSync": true
}
```

Add `AGENTS.md`, `.cursor/rules/decisions.mdc` or any other file to `contextFiles` to feed the same decisions to other assistants.

## Other tools than Claude Code

The MCP server works with any client today: add `npx --yes porque-cli mcp` to Cursor's, Codex's or Windsurf's MCP config and their assistants get `porque_why` and `porque_record`. The automatic *capture* step reads Claude Code's transcript format; adding a reader for another assistant's session log is one function in `src/transcript.js`. Until then, `porque_record` is how other assistants write decisions. PRs welcome.

## Why this repo has a `decisions/` folder

Because it was built with Porque. The decisions taken while writing this tool, including a couple of dead ends, are in [`decisions/`](./decisions). Start there if you want to understand the code.

## Status

Proof of concept. It works, it is small (zero dependencies, ~900 lines), and it is opinionated. Things that would come next:

- Readers for Cursor, Codex and Copilot session logs.
- A `PreToolUse` hook that injects the relevant decisions right before an edit, so the assistant does not even have to ask.
- Linking decisions to commits automatically (`Decision:` trailer).
- A conflict warning *before* the assistant acts, not only in the PR.

MIT. Made by [Miguel Ovejero](https://www.linkedin.com/in/miguelovejero/).
