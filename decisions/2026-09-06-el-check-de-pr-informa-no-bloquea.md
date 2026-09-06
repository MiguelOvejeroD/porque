---
id: 2026-09-06-el-check-de-pr-informa-no-bloquea
title: El check de PR informa por defecto y solo bloquea con --strict
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - src/check.js
  - .github/workflows/porque-check.yml
tags: [ci, pr, equipo]
confidence: medium
source: claude-code session 6dd964ad
---
# El check de PR informa por defecto y solo bloquea con --strict

## Decisión

`porque check` lista las decisiones cuyo scope intersecta los archivos del diff y sale con código 0. Con `--ask` el modelo clasifica cada una como respeta / contradice / no relacionada. Solo con `--strict` una contradicción hace fallar el job.

## Por qué

Contradecir una decisión a veces es correcto: el contexto cambió. Lo que no puede pasar es contradecirla sin saberlo. Un comentario en el PR con el por qué original convierte eso en una conversación; un check rojo lo convierte en algo que se apaga. El matching por scope es determinista y barato; el juicio del modelo es opcional porque cuesta y puede errar.

## Alternativas descartadas

- **Bloquear siempre ante contradicción**: castiga la decisión correcta de cambiar de rumbo y genera incentivo a no registrar nada.
- **Solo juicio del modelo, sin matching por scope**: más caro y no funciona sin API key en CI.

## Consecuencias

La calidad del check depende de que los `scope` de las decisiones sean buenos. El prompt de captura pide paths reales y globs; conviene revisarlos al aceptar un registro.
