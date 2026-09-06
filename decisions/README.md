# Registro de decisiones

Cada archivo es una decisión con su razonamiento, capturada de sesiones de trabajo con IA por [Porque](https://github.com/MiguelOvejeroD/porque). Editá a mano lo que quieras: el archivo es la fuente de verdad.

| Fecha | Decisión | Estado | Alcance | Tags |
|---|---|---|---|---|
| 2026-09-06 | [Usar `claude -p` como proveedor por defecto, con la API como fallback](./2026-09-06-usar-claude-p-como-proveedor-por-defecto.md) | active | src/llm.js | llm, auth, distribucion |
| 2026-09-06 | [Servir las decisiones a la IA vía tool MCP; el comando `why` queda como vista humana](./2026-09-06-servir-las-decisiones-a-la-ia-via-mcp-no-al-humano.md) | active | src/mcp.js, src/why.js | mcp, interfaz, equipo |
| 2026-09-06 | [Registros en markdown plano dentro del repo, sin base de datos ni servicio](./2026-09-06-registros-en-markdown-plano-dentro-del-repo.md) | active | decisions/**, src/decisions.js | arquitectura, formato, portabilidad |
| 2026-09-06 | [Inyectar las decisiones activas en CLAUDE.md entre marcadores, no en un archivo aparte](./2026-09-06-inyectar-decisiones-activas-en-claude-md.md) | active | src/sync.js | contexto, claude-md, equipo |
| 2026-09-06 | [El check de PR informa por defecto y solo bloquea con --strict](./2026-09-06-el-check-de-pr-informa-no-bloquea.md) | active | src/check.js, .github/workflows/porque-check.yml | ci, pr, equipo |
| 2026-09-06 | [Cero dependencias de runtime, Node 18+, ESM](./2026-09-06-cero-dependencias-y-node-18.md) | active | package.json, src/** | tooling, distribucion |
| 2026-09-06 | [Capturar con el hook Stop de Claude Code, leyendo el transcript de forma incremental](./2026-09-06-capturar-con-hook-stop-de-claude-code-de-forma-incremental.md) | active | src/capture.js, src/transcript.js | captura, hooks, claude-code |
