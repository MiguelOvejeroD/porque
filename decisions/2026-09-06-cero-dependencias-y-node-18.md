---
id: 2026-09-06-cero-dependencias-y-node-18
title: Cero dependencias de runtime, Node 18+, ESM
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - package.json
  - src/**
tags: [tooling, distribucion]
confidence: high
source: claude-code session 6dd964ad
---
# Cero dependencias de runtime, Node 18+, ESM

## Decisión

El paquete no tiene dependencias. Se usan `node:fs`, `node:child_process`, `fetch` nativo y `node --test`. El paquete se publica como `porque-cli` (el nombre `porque` ya estaba tomado en npm) pero el binario se llama `porque`.

## Por qué

`npx --yes porque-cli init` tiene que correr en el repo de cualquier persona en segundos y sin sorpresas. Cada dependencia es una razón más para que un hook falle en la máquina de alguien. La herramienta hace poco (leer JSONL, escribir markdown, llamar a un CLI) y no lo justifica.

## Alternativas descartadas

- **commander / yargs para el CLI**: 40 líneas de parser propio alcanzan para seis comandos.
- **gray-matter / js-yaml para frontmatter**: el formato que escribimos lo controlamos nosotros; un parser mínimo es suficiente.
- **Python**: el público de Claude Code tiene Node garantizado (Claude Code corre sobre Node); Python no.

## Consecuencias

Si el formato de frontmatter crece (anidamiento, multilínea) habrá que revisar esta decisión antes de agregar `js-yaml`.
