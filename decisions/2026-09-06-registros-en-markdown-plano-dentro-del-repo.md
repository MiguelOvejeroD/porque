---
id: 2026-09-06-registros-en-markdown-plano-dentro-del-repo
title: Registros en markdown plano dentro del repo, sin base de datos ni servicio
date: 2026-09-06
author: Miguel Ovejero
status: active
supersedes: null
scope:
  - decisions/**
  - src/decisions.js
  - src/frontmatter.js
tags: [arquitectura, formato, portabilidad]
confidence: high
source: claude-code session 6dd964ad
---
# Registros en markdown plano dentro del repo, sin base de datos ni servicio

## Decisión

Cada decisión es un archivo `decisions/<fecha>-<slug>.md` con frontmatter YAML mínimo (id, título, fecha, autor, estado, scope, tags) y cuatro secciones fijas: Decisión, Por qué, Alternativas descartadas, Consecuencias. Se versiona con el código.

## Por qué

El problema a resolver es que el "por qué" vive fuera del repo (en chats). Meterlo en otro lugar externo (una base, un SaaS) repetiría el problema con otro nombre. El markdown lo lee un humano en GitHub, lo lee cualquier IA como contexto, se revisa en el PR y sobrevive a la herramienta: si porque desaparece, los archivos siguen ahí.

## Alternativas descartadas

- **SQLite local**: mejor para consultas, pero no se ve en el PR ni lo lee un asistente sin tooling.
- **Servicio web con UI**: más "producto", pero agrega cuenta, hosting y una razón más para que nadie lo mantenga.
- **Trailers en el mensaje de commit**: cero infraestructura, pero no hay lugar para alternativas y consecuencias, y con IA nadie escribe commits a mano.

## Consecuencias

El parser de frontmatter es propio y soporta solo lo necesario (escalares, listas). Si se necesita YAML completo habrá que agregar una dependencia, lo que contradice la decisión de cero dependencias.
