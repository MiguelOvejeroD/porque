---
id: 2026-09-06-inyectar-decisiones-activas-en-claude-md
title: Inyectar las decisiones activas en CLAUDE.md entre marcadores, no en un archivo aparte
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - src/sync.js
tags: [contexto, claude-md, equipo]
confidence: high
source: claude-code session 6dd964ad
---
# Inyectar las decisiones activas en CLAUDE.md entre marcadores, no en un archivo aparte

## Decisión

`porque sync` regenera un bloque delimitado por `<!-- porque:start -->` y `<!-- porque:end -->` dentro de `CLAUDE.md` (configurable a más archivos: AGENTS.md, reglas de Cursor). El bloque lista cada decisión activa en una línea (título, fecha, scope, decisión, primera oración del por qué, link al archivo) y abre con una instrucción explícita: respetarlas y avisar antes de contradecir una.

## Por qué

Un archivo separado que la IA "podría" leer no se lee. `CLAUDE.md` se carga siempre, así que es el único lugar donde la decisión de Lu llega de verdad a la sesión de Tomi. Los marcadores permiten que el resto del archivo siga siendo del equipo y se edite a mano.

## Alternativas descartadas

- **`decisions/README.md` como único índice**: útil para humanos, invisible para el asistente.
- **Poner el contenido completo de cada decisión en CLAUDE.md**: consume contexto en cada turno; con 40 decisiones son miles de tokens. Una línea por decisión y el link alcanzan; `porque why` trae el detalle.

## Consecuencias

Hay un tope (`maxContextDecisions`, 40) y solo entran las activas. Cuando el equipo supere eso hará falta priorizar por scope del cambio actual, que hoy no existe.
