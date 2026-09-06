---
id: 2026-09-06-capturar-con-hook-stop-de-claude-code-de-forma-incremental
title: Capturar con el hook Stop de Claude Code, leyendo el transcript de forma incremental
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - src/capture.js
  - src/transcript.js
  - src/init.js
tags: [captura, hooks, claude-code]
confidence: high
source: claude-code session 6dd964ad
---
# Capturar con el hook Stop de Claude Code, leyendo el transcript de forma incremental

## Decisión

`porque init` registra un hook `Stop` en `.claude/settings.json` que ejecuta `porque capture --hook`. El hook recibe `transcript_path` y `session_id` por stdin, lee el JSONL desde el último offset procesado (guardado en `.porque/state.json`, ignorado por git) y solo manda al modelo el fragmento nuevo. Si hay menos de 600 caracteres nuevos, no hace nada.

## Por qué

La decisión nace en la sesión con la IA; capturarla ahí es lo único que no depende de la disciplina de nadie. `Stop` se dispara al final de cada respuesta, así que el registro aparece mientras la persona todavía tiene el contexto fresco para corregirlo. Leer incremental evita re-procesar (y re-pagar) toda la sesión cada vez y evita duplicados.

## Alternativas descartadas

- **Hook SessionEnd**: semánticamente más limpio, pero solo se dispara al cerrar la sesión, que muchas veces queda abierta días. Se pierde la inmediatez.
- **Pedirle al agente que registre decisiones vía instrucción en CLAUDE.md**: depende de que el modelo se acuerde y compite con la tarea principal. Un hook determinista es más confiable.
- **Analizar solo los commits**: el mensaje de commit ya perdió el razonamiento; el transcript es la única fuente que lo tiene.

## Consecuencias

El hook nunca debe romper la sesión del usuario: siempre sale con código 0 y loguea en `.porque/log`. Un hook `Stop` puede tardar 10 a 30 segundos por la llamada al modelo; se ejecuta en paralelo y no bloquea, pero hay que documentarlo.
