# Feature: engram-web — interfaz web de gestión de memoria Engram

Rama: `feature/engram-web` (base: `master`, repositorio sin commits previos).

## Objetivo

Aplicación web que gestiona la memoria persistente de Engram con paridad funcional
sobre la TUI (`engram tui`), consumiendo el **runtime local HTTP** de Engram
(`engram serve`) en lugar de leer SQLite directamente.

## Decisiones cerradas (usuario)

| Tema | Decisión |
| --- | --- |
| Arquitectura | Servidor local Node sin dependencias: sirve la UI y hace proxy `/api/*` → `127.0.0.1:7437` (mismo origen, evita CORS) |
| Frontend | Vite + Vue 3 + TypeScript |
| Alcance v1 | Lectura primero; escrituras (pin, editar, borrar, guardar) en fase posterior |
| Alcance de datos | Todos los proyectos (`all_projects=true`) con selector por proyecto, scope y tipo |

## Hallazgos de la exploración (hechos verificados)

- Engram instalado: **v2.0.0**, `%LOCALAPPDATA%\engram\bin\engram.exe`; base `~/.engram/engram.db`
  (SQLite + FTS5 trigram). Contenido actual: 664 observaciones, 182 sesiones, 1392 prompts, 17 proyectos.
- Superficies disponibles: CLI, MCP (stdio) y **HTTP local** en `127.0.0.1:7437`.
- Rutas confirmadas en `internal/server/server.go` de `Gentleman-Programming/engram@v2.0.0`.
- Auth: opcional por `ENGRAM_HTTP_TOKEN` (Bearer). Sin token, acceso abierto. El proxy debe reenviar
  `Authorization` cuando la variable exista.
- **El API local no emite CORS ni responde `OPTIONS`** (devuelve 405). Motivo por el que el proxy propio
  es obligatorio: las mutaciones `PUT`/`PATCH`/`DELETE` disparan preflight.
- El proyecto se resuelve por `project` explícito → `ENGRAM_PROJECT` → cwd del proceso servidor. La
  instancia en marcha tiene cwd en el directorio de Obsidian, así que **toda lectura debe enviar
  `all_projects=true` o un `project` explícito**.

## Contrato del API local usado en v1 (formas reales verificadas)

| Endpoint | Parámetros | Respuesta |
| --- | --- | --- |
| `GET /health` | — | `{status, service, version, instance_id}` |
| `GET /stats` | `all_projects=true` | `{total_sessions, total_observations, total_prompts, projects[]}` |
| `GET /project/current` | — | `{project, project_path, project_source, cwd, available_projects}` |
| `GET /observations/recent` | `all_projects`, `project`, `scope`, `limit` | `Observation[]` |
| `GET /observations` | igual + `sort=created_at:desc` | `Observation[]` (alias de recent) |
| `GET /observations/{id}` | — | `Observation` |
| `GET /search` | `q` (req), `type`, `scope`, `project`, `all_projects`, `limit`, `match_mode=all\|any` | `SearchResult[]` (incluye `rank`) |
| `GET /timeline` | `observation_id` (req), **`project` requerido en la práctica**, `before`, `after` | `{focus, ...}` |
| `GET /sessions/recent` | `all_projects`, `project`, `limit` | `{id, project, started_at, observation_count}[]` |
| `GET /sessions/{id}` | — | `{id, project, ownership_mode, directory, started_at, ended_at?, summary?}` |
| `GET /prompts/recent` | `all_projects`, `project`, `limit` | `{id, sync_id, session_id, content, project, created_at}[]` |
| `GET /prompts/search` | `q` (req), `project`, `all_projects`, `limit` | `Prompt[]` |
| `GET /review` | `all_projects`, `project`, `limit` | `{count, observations[]}` |
| `GET /conflicts` | `all_projects`, `project`, `limit`, `offset`, `status` | `{relations[], total, limit, offset}` |
| `GET /conflicts/stats` | `all_projects`, `project` | `{by_judgment_status{}, by_relation{}, dead, deferred, project}` |
| `GET /doctor` | `project` | `{status, project, summary{}, checks[]}` |
| `GET /context` | `all_projects`, `project`, `limit` | `{context}` |
| `GET /context/compaction` | `session_id` (req) | `{context}` |

`Observation` = `{id, sync_id, session_id, type, title, content, project, scope, revision_count,
duplicate_count, last_seen_at, created_at, updated_at, pinned?}`.

## Carencias conocidas del API (documentadas, no sorteadas)

1. **Detalle de sesión sin cobertura HTTP**: `/observations` y `/prompts/recent` ignoran `session_id`;
   `RecentObservations(project, scope, limit)` no filtra por sesión. v1 muestra metadatos de sesión
   (`GET /sessions/{id}`) y lo declara explícitamente en la UI. Follow-up: soporte upstream o lector
   SQLite en solo-lectura.
2. **Sin paginación por offset** en observaciones/prompts (solo `limit`).
3. **Sin filtro por tipo** en recientes (solo en `/search`); el filtro por tipo en la vista de recientes
   se aplica en cliente sobre la página cargada, etiquetado como tal.
4. **Sin gestión de proyectos** (prune/consolidate) ni setup/cloud en el API: fuera de alcance, sigue en CLI/TUI.

## No objetivos de v1

- Escrituras: pin/unpin, editar, borrar (soft/hard), guardar memoria, marcar revisada, juzgar conflictos,
  import/export. Fase 2.
- Pantallas `Setup` y `Cloud` de la TUI (el dashboard cloud ya existe upstream para el runtime cloud).
- Operaciones destructivas: hard delete, cascade de proyecto, prune. Solo por CLI.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Scaffold Vite + Vue 3 + TS, proxy de desarrollo y `server/server.mjs` (estático + proxy `/api`) | pendiente |
| 2 | Cliente API tipado (`src/api/`) con tipos y manejo de errores | pendiente |
| 3 | Shell de UI: layout, navegación, selector de proyecto/scope/tipo y estado global de filtros | pendiente |
| 4 | Dashboard: stats, proyectos y resumen de `doctor` | pendiente |
| 5 | Búsqueda: `q`, tipo, scope, proyecto y `match_mode`, con `rank` visible | pendiente |
| 6 | Recientes + detalle de observación: markdown saneado, metadatos y enlace a timeline | pendiente |
| 7 | Timeline con `project` explícito de la observación focal | pendiente |
| 8 | Sesiones y prompts: listado de sesiones, metadatos de sesión y prompts recientes | pendiente |
| 9 | Review y conflictos: cola de revisión, relaciones y estadísticas | pendiente |
| 10 | Verificación: build, typecheck, smoke test contra API viva y revisión de contrato | pendiente |

## Evidencia

- Las tareas se cierran con un commit de unidad de trabajo en `feature/engram-web` (autorización de
  commits según `CONTRATO_FLUJO_GIT_VERSIONADO.md`).
- (pendiente) Commits por tarea.
