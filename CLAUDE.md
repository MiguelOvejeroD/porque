# porque

CLI en Node (ESM, cero dependencias) que captura decisiones de sesiones de Claude Code y las guarda en `decisions/`.

- Código en `src/`, entrada en `bin/porque.js`. Tests con `node --test test/`.
- Demo reproducible: `npm run demo` (usa `demo/session.jsonl`).
- Antes de tocar `src/llm.js`, leé la decisión sobre `claude -p` y `--setting-sources`.

<!-- porque:start -->
## Decisiones del equipo

Estas decisiones ya fueron tomadas por el equipo. Respetalas. Si una tarea te obliga a contradecir alguna, decilo explícitamente antes de hacerlo y explicá por qué. El detalle completo está en `decisions/`. Consultá con `porque why <path>`.

- **Usar `claude -p` como proveedor por defecto, con la API como fallback** (2026-09-06) `src/llm.js`: Las llamadas al modelo salen por el CLI `claude -p --output-format json --json-schema ...` cuando está instalado. Por qué: El público objetivo ya tiene Claude Code instalado y logueado; pedirle una API key aparte es la fricción que mata una PoC. → `decisions/2026-09-06-usar-claude-p-como-proveedor-por-defecto.md`
- **Registros en markdown plano dentro del repo, sin base de datos ni servicio** (2026-09-06) `decisions/**`, `src/decisions.js`, `src/frontmatter.js`: Cada decisión es un archivo `decisions/<fecha>-<slug>.md` con frontmatter YAML mínimo (id, título, fecha, autor, estado, scope, tags) y cuatro secciones fijas: Decisión, Por qué, Alternativas descartadas, Consecuencias. Por qué: El problema a resolver es que el "por qué" vive fuera del repo (en chats). → `decisions/2026-09-06-registros-en-markdown-plano-dentro-del-repo.md`
- **Inyectar las decisiones activas en CLAUDE.md entre marcadores, no en un archivo aparte** (2026-09-06) `src/sync.js`: `porque sync` regenera un bloque delimitado por `<!‑‑ porque:start ‑‑>` y `<!‑‑ porque:end ‑‑>` dentro de `CLAUDE.md` (configurable a más archivos: AGENTS.md, reglas de Cursor). Por qué: Un archivo separado que la IA "podría" leer no se lee. → `decisions/2026-09-06-inyectar-decisiones-activas-en-claude-md.md`
- **El check de PR informa por defecto y solo bloquea con --strict** (2026-09-06) `src/check.js`, `.github/workflows/porque-check.yml`: `porque check` lista las decisiones cuyo scope intersecta los archivos del diff y sale con código 0. Por qué: Contradecir una decisión a veces es correcto: el contexto cambió. → `decisions/2026-09-06-el-check-de-pr-informa-no-bloquea.md`
- **Cero dependencias de runtime, Node 18+, ESM** (2026-09-06) `package.json`, `src/**`: El paquete no tiene dependencias. Por qué: `npx --yes porque-cli init` tiene que correr en el repo de cualquier persona en segundos y sin sorpresas. → `decisions/2026-09-06-cero-dependencias-y-node-18.md`
- **Capturar con el hook Stop de Claude Code, leyendo el transcript de forma incremental** (2026-09-06) `src/capture.js`, `src/transcript.js`, `src/init.js`: `porque init` registra un hook `Stop` en `.claude/settings.json` que ejecuta `porque capture --hook`. Por qué: La decisión nace en la sesión con la IA; capturarla ahí es lo único que no depende de la disciplina de nadie. → `decisions/2026-09-06-capturar-con-hook-stop-de-claude-code-de-forma-incremental.md`

_Generado por Porque · 6 decisiones activas_
<!-- porque:end -->
