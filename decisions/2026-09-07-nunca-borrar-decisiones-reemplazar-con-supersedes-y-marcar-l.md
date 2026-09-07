---
id: 2026-09-07-nunca-borrar-decisiones-reemplazar-con-supersedes-y-marcar-l
title: "Nunca borrar decisiones: reemplazar con supersedes y marcar la vieja con superseded_by"
date: 2026-09-07
author: Miguel Ovejero - Mac
status: active
supersedes: null
superseded_by: null
scope:
  - src/decisions.js
  - src/why.js
  - src/mcp.js
tags:
  - historial
  - supersedes
  - formato
confidence: medium
source: manual
---
# Nunca borrar decisiones: reemplazar con supersedes y marcar la vieja con superseded_by

## Decisión

Revertir una decisión es registrar una nueva con supersedes: <id-vieja>. writeDecision marca el archivo viejo en disco con status: superseded y superseded_by: <id-nueva>, sin tocar su cuerpo. porque why y porque_why devuelven las dos y muestran la cadena en ambos sentidos; solo CLAUDE.md y porque check filtran a activas.

## Por qué

Antes el estado superseded se calculaba solo en memoria: el archivo viejo seguía diciendo active en GitHub y nadie sabía por quién había sido reemplazado. La historia de una decisión (se tomó, se documentó, se cambió) tiene que ser consultable desde cualquiera de las dos puntas, y el archivo es la fuente de verdad, así que el estado tiene que estar escrito en él. applySupersedes se mantiene para cadenas editadas a mano.

## Alternativas descartadas

-

## Consecuencias

Alternativas descartadas: borrar o sobreescribir el registro viejo (se pierde el por qué original y la evidencia de que hubo un cambio); escribir un campo superseded_by sin el status (dos fuentes de verdad para lo mismo).
