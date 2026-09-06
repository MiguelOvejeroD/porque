---
id: 2026-09-06-servir-las-decisiones-a-la-ia-via-mcp-no-al-humano
title: Servir las decisiones a la IA vía tool MCP; el comando `why` queda como vista humana
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - src/mcp.js
  - src/why.js
  - src/sync.js
  - .mcp.json
tags: [mcp, interfaz, equipo]
confidence: high
source: claude-code session 6dd964ad
---
# Servir las decisiones a la IA vía tool MCP; el comando `why` queda como vista humana

## Decisión

`porque mcp` es un servidor MCP por stdio (JSON-RPC línea por línea, sin dependencias) con dos tools: `porque_why(query)` devuelve las decisiones que gobiernan un path o mencionan un término más el git log; `porque_record(...)` permite al asistente registrar una decisión que acaba de tomar con el usuario. `porque init` lo registra en `.mcp.json`. El bloque de CLAUDE.md pasa a instruir "antes de tocar un archivo, llamá `porque_why`". El comando `porque why` se mantiene solo como vista para humanos y demos.

## Por qué

Observación del usuario: en un equipo que programa con IA, quien necesita saber por qué un archivo es así es la IA del compañero en el momento de editarlo, no una persona en una terminal. Un comando CLI es la interfaz equivocada para el consumidor real. Probado en una sesión real: con la tool disponible y la instrucción "cambiá el schema para aceptar decimales, sin vueltas", el asistente llamó `porque_why` por su cuenta, encontró la decisión previa y propuso una alternativa compatible en vez de revertirla en silencio. Además MCP es agnóstico de cliente, lo que resuelve la portabilidad a Cursor y Codex sin escribir lectores de transcript.

## Alternativas descartadas

- **Solo el bloque en CLAUDE.md con todas las decisiones**: llega a la IA pero es estático y global; con 200 decisiones no escala y con 6 desperdicia contexto en cada turno.
- **Hook PreToolUse sobre Edit/Write que inyecte las decisiones del path**: complementario y probablemente el paso siguiente; se pospuso para mantener la PoC chica y porque la tool ya demostró el comportamiento buscado.
- **SDK oficial de MCP como dependencia**: el protocolo mínimo (initialize, tools/list, tools/call) son 100 líneas y no justifica romper cero dependencias.

## Consecuencias

`porque_record` habilita que otros asistentes escriban decisiones aunque la captura automática solo lea transcripts de Claude Code. Si el protocolo MCP cambia de forma incompatible habrá que revisar `src/mcp.js` a mano, sin SDK que lo absorba.
