---
id: 2026-09-06-usar-claude-p-como-proveedor-por-defecto
title: Usar `claude -p` como proveedor por defecto, con la API como fallback
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - src/llm.js
tags: [llm, auth, distribucion]
confidence: high
source: claude-code session 6dd964ad
---
# Usar `claude -p` como proveedor por defecto, con la API como fallback

## Decisión

Las llamadas al modelo salen por el CLI `claude -p --output-format json --json-schema ...` cuando está instalado. Si no está, se usa la API de Anthropic con `ANTHROPIC_API_KEY` forzando un tool call para obtener JSON estructurado.

## Por qué

El público objetivo ya tiene Claude Code instalado y logueado; pedirle una API key aparte es la fricción que mata una PoC. `--json-schema` devuelve `structured_output` ya parseado, así que no hay que limpiar texto. El fallback por API existe para CI (el workflow de PR) donde no hay CLI logueado.

## Alternativas descartadas

- **Solo API**: obliga a gestionar una key en cada máquina del equipo.
- **SDK de Anthropic como dependencia**: rompe cero dependencias por algo que `fetch` resuelve en 30 líneas.

## Consecuencias

La llamada anidada corre con `--setting-sources ''` para que el `claude` hijo no cargue el `.claude/settings.json` del proyecto y vuelva a disparar el hook Stop (recursión). Se probó `--bare` con el mismo fin y se descartó: desactiva la autenticación por keychain y falla con "Not logged in". Además se setea `PORQUE_NESTED=1` y `capture` sale inmediatamente si lo ve, como segunda barrera.
