# Porque

**git blame for the why.**

Git remembers *what* changed. Nobody remembers *why*. And now that every developer on the team codes with an AI assistant, the *why* lives in a chat window that gets closed at the end of the day.

`Porque` reads your AI coding sessions, extracts the decisions that were made in them (with their reasoning and the alternatives that were rejected), and stores them as plain markdown in your repo, right where the next session, yours or a teammate's, will read them.

```
$ porque why src/api/payments.ts

● Usar zod para validación de requests                     2026-09-01 · Lu
  Se adopta zod como librería de validación de body en la API...
  Por qué: infiere tipos TS desde el schema evitando duplicar tipo y schema; el equipo
  lo va a necesitar igual para validar config de entorno y respuestas de Stripe...
  Descartado: yup (inferencia de tipos más débil) | JSON Schema de Fastify (dos fuentes de verdad)

● Representar amount en centavos como entero               2026-09-01 · Lu
  Por qué: los floats de JavaScript no representan exactamente los decimales...
  Descartado: Decimal (decimal.js / numeric): dependencia extra y serialización como string
```

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
        next session (yours or a teammate's) ◀── CLAUDE.md ◀───────┤
                                                                   │
                        porque why <path>  ◀───────────────────────┤
                        porque check (PR)  ◀───────────────────────┘
```

1. **Capture.** A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) `Stop` hook runs `porque capture` after every response. It reads only the new part of the transcript, asks a model to extract *decisions* (not tasks), and writes one markdown file per decision: what, why, rejected alternatives, consequences, scope (paths), tags.
2. **Sync.** The active decisions are rendered into a block inside `CLAUDE.md` (or any file you configure). Every AI session in the repo starts already knowing them and is told to speak up before contradicting one.
3. **Ask.** `porque why src/auth` finds the decisions that govern a path (or mention a term) plus the git history, and prints them. `--ask` synthesizes an answer and tells you what is *not* recorded.
4. **Check.** `porque check` in CI lists the decisions a PR touches. `--ask` lets the model judge whether the diff respects or contradicts each one, and comments on the PR.

The records are plain markdown, committed with the code. No database, no service, no account. Delete the tool and you keep everything.

## Install

Requires Node 18+ and the `claude` CLI logged in (or `ANTHROPIC_API_KEY`).

```bash
cd your-repo
npx --yes porque-cli init          # creates decisions/, the CLAUDE.md block and the Stop hook
```

Then work with Claude Code as usual. After each response you will see, in `decisions/`, the decisions that were just made. Commit them.

## Try it in 60 seconds without an existing project

The repo ships a recorded session (`demo/session.jsonl`) from the story above.

```bash
git clone https://github.com/MiguelOvejeroD/porque && cd porque
npm run demo
```

It creates a throwaway repo, replays the session, and asks `porque why`. Then, to see the PR check catch Thursday's mistake:

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

## A decision record

```markdown
---
id: 2026-09-01-usar-zod-para-validacion-de-requests
title: Usar zod para validación de requests
date: 2026-09-01
author: Lu
status: active            # active | superseded
supersedes: null
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

Edit it by hand whenever you want. The file is the source of truth; `porque sync` picks up your edits. To reverse a decision, record a new one with `supersedes: <old id>`.

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

The capture step reads Claude Code's transcript format today. Everything else (the records, `why`, `sync`, `check`, the `CLAUDE.md` block) is tool-agnostic. Adding a reader for another assistant's session log is one function in `src/transcript.js`. PRs welcome.

## Why this repo has a `decisions/` folder

Because it was built with Porque. The decisions taken while writing this tool, including a couple of dead ends, are in [`decisions/`](./decisions). Start there if you want to understand the code.

## Status

Proof of concept. It works, it is small (zero dependencies, ~700 lines), and it is opinionated. Things that would come next:

- Readers for Cursor, Codex and Copilot session logs.
- `porque why` as an MCP tool, so the assistant can ask instead of the human.
- Linking decisions to commits automatically (`Decision:` trailer).
- A conflict warning *before* the assistant acts, not only in the PR.

MIT. Made by [Miguel Ovejero](https://www.linkedin.com/in/miguelovejero/).
