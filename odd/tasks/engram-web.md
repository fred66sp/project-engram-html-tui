# Feature: engram-web — interfaz web de gestión de memoria Engram

Rama: `feature/engram-web`, integrada en `main` (el repositorio no tenía ningún commit previo).

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
| 1 | Scaffold Vite + Vue 3 + TS, proxy de desarrollo y `server/server.mjs` (estático + proxy `/api`) | hecho — commit fb8f44f |
| 2 | Cliente API tipado (`src/api/`) con tipos y manejo de errores | hecho — commit 97a5e3b |
| 3 | Shell de UI: layout, navegación, selector de proyecto/scope/tipo y estado global de filtros | hecho — commit 78b6ce9 |
| 4 | Dashboard: stats, proyectos y resumen de `doctor` | hecho — commit 78b6ce9 |
| 5 | Búsqueda: `q`, tipo, scope, proyecto y `match_mode`, con `rank` visible | hecho — commit 176c4f6 |
| 6 | Recientes + detalle de observación: markdown saneado, metadatos y enlace a timeline | hecho — commit 78b6ce9 |
| 7 | Timeline con `project` explícito de la observación focal | hecho — commit 176c4f6 |
| 8 | Sesiones y prompts: listado de sesiones, metadatos de sesión y prompts recientes | hecho — commit 176c4f6 |
| 9 | Review y conflictos: cola de revisión, relaciones y estadísticas | hecho — commit 176c4f6 |
| 10 | Verificación: build, typecheck, smoke test contra API viva y revisión de contrato | hecho — verificación independiente, pendiente la comprobación visual en navegador |

## Evidencia

- Las tareas se cierran con un commit de unidad de trabajo en `feature/engram-web` (autorización de
  commits según `CONTRATO_FLUJO_GIT_VERSIONADO.md`).
- Commits por unidad de trabajo:
  - `fb8f44f` scaffold y proxy local.
  - `97a5e3b` cliente API tipado y check ejecutable contra el runtime vivo.
  - `78b6ce9` shell, dashboard, recientes y detalle de observación.
  - `176c4f6` búsqueda, timeline, sesiones, review y conflictos.

### Verificación independiente (tarea 10)

Ejecutada por `gentle-ai-verify` (lectura y ejecución, sin ediciones) sobre `176c4f6`:

- Mecánica A1–A5: PASS. `npm run typecheck`, `npm run build` y `npm run smoke` en 0; las 8 rutas
  cliente devuelven 200 a través del proxy y las 8 llamadas al API devuelven JSON válido.
- Contrato B1–B9: PASS, cero fallos. Comprobado: `fetch` solo en `src/api/client.ts:79`; el
  invariante `project` / `all_projects` con un único punto de aplicación (`projectParams()`);
  `getTimeline` nunca se llama sin proyecto y el caso sin proyecto muestra un mensaje; ninguna ruta
  o enlace muerto; el orden de `MarkdownView` es parsear → sanear → inyectar y es el único `v-html`;
  las formas declaradas coinciden con las respuestas reales; las carencias del API se declaran en
  la UI en lugar de simularse; ningún verbo de escritura en `src/`.
- No verificable sin navegador (queda para el humano): renderizado y layout, orden de foco,
  estados de carga/vacío/error, refetch al cambiar filtros, tablas y bloques de código del markdown,
  paginación de conflictos y el panel de sesión.

### Hallazgos residuales de la verificación

1. `getContext` está exportado en `src/api/client.ts` y no tiene ningún consumidor en v1.
2. `ConflictsView` depende del orden de dos `watch` (reinicio de `offset` antes de la carga);
   reordenarlos provocaría una petición duplicada.
3. La rama `session_info: null` del timeline no se observó en peticiones reales: está cubierta por
   tipos y por la vista, pero no por evidencia empírica.

### Verificación mecánica (2026-09-20)

- `npm run typecheck` → exit 0.
- `npm run build` → exit 0. Salida emitida: `dist/index.html` 0.39 kB,
  `dist/assets/index-8sGq3gWY.css` 4.54 kB (gzip 1.43 kB), `dist/assets/index-E4QxSJbv.js`
  174.31 kB (gzip 62.99 kB).
- `npm run smoke` → exit 0 contra el runtime vivo: engram 2.0.0, 666 observaciones en 18
  proyectos, `getDoctor()` ok con 9 chequeos.
- Smoke de producción a través del proxy (`npm start`, puerto 7438): `GET /` → 200,
  `GET /observations/1188` → 200 (fallback SPA), `GET /api/stats?all_projects=true` → JSON con
  `total_observations` (666) y `projects` (18). Servidor detenido después.
- Post-proceso de enlaces de `MarkdownView` verificado sobre la salida real de `marked`:
  `https://` y `http://` reciben `target="_blank"` + `rel="noopener noreferrer"`; los enlaces
  relativos y `mailto:` quedan intactos. La primera versión del regex corrompía el `href`; corregido
  y re-verificado.

### Alcance cerrado en la tarea 6

La tarea 6 se cierra por lo entregado en esta unidad: listado de recientes y detalle de
observación con markdown saneado y metadatos. El **enlace a timeline** quedó diferido a la tarea 7
porque la ruta `/timeline` no existía todavía y este proyecto prohíbe registrar enlaces muertos;
la tarea 7 ya registró la ruta y añadió el enlace «Ver timeline» en el detalle.

### Verificación mecánica (2026-09-20) — vistas restantes (tareas 5, 7, 8, 9)

- `npm run typecheck` → exit 0.
- `npm run build` → exit 0. Salida emitida: `dist/index.html` 0.39 kB,
  `dist/assets/index-BMURrQc6.css` 5.67 kB (gzip 1.64 kB), `dist/assets/index-C4UzkrV9.js`
  196.69 kB (gzip 68.54 kB).
- `npm run smoke` → exit 0 contra el runtime vivo: engram 2.0.0, 666 observaciones en 18
  proyectos, `getDoctor()` ok con 9 chequeos.
- Smoke de producción a través del proxy (`npm start`, puerto 7438), HTTP 200 en todas las rutas
  cliente: `/`, `/search`, `/timeline/1188`, `/sessions`, `/review`, `/conflicts` (fallback SPA) y
  JSON real de `curl -s 'http://127.0.0.1:7438/api/conflicts?all_projects=true&limit=2'`
  (`total` 541). Servidor detenido después (puerto 7438 verificado cerrado).
- Formas reales confirmadas por HTTP antes de implementar: `/conflicts/stats` con
  `by_relation` (5 claves) y `by_judgment_status` (`judged` 273, `orphaned` 256, `pending` 12);
  `/timeline` sin `project` → 404 y con `project` → `{focus, before, after, session_info,
  total_in_range}`; las entradas de `before`/`after` no traen `sync_id`; `/review` → `{count,
  observations}`.

### Carencias del API que exponen las vistas nuevas

1. **Detalle de sesión sin cobertura HTTP** (ya listada arriba): no hay endpoint que liste las
   observaciones ni los prompts de una sesión, por lo que `SessionsView` muestra solo metadatos de
   sesión (`GET /sessions/{id}`) y ofrece el rodeo de filtrar `/recent` por el proyecto de la sesión.
2. **Sin resolución de identidad de conflicto**: `GET /conflicts` publica `source_id`/`target_id`
   con valores `obs-…` (sync_id), no los ids numéricos que exige `/observations/:id`, y ningún
   endpoint traduce unos a otros. `ConflictsView` renderiza los títulos como texto plano sin enlace
   y lo declara en la UI; enlazar filas produciría rutas muertas.

### Verificación visual pendiente del humano

No hubo navegador disponible, por lo que falta comprobar en uno:

- Layout en rejilla (header, sidebar, barra de filtros, contenido) y foco visible al tabular.
- Chip de estado con `engram v2.0.0` y comportamiento del botón «Reintentar» con el runtime caído.
- Filtros: que cambiar proyecto/scope dispare recarga y que el filtro por tipo de recientes filtre
  en cliente sobre la página cargada.
- Markdown: tablas, bloques de código y que un enlace externo abra en pestaña nueva.
- Estados de carga, vacío y error en recientes y detalle.
- Búsqueda: que el estado inicial invite a escribir, que una consulta vacía no dispare petición,
  que el chip `#rank` se lea junto a cada resultado y que cambiar el proyecto global re-ejecute la
  búsqueda activa.
- Timeline: que la observación focal se vea resaltada, que los vecinos enlacen a su detalle, que los
  selectores 1–10 recarguen, y los estados de observación sin proyecto y de error 404.
- Sesiones: que seleccionar una sesión cargue el panel inline y que el botón de rodeo lleve a
  `/recent` con el proyecto ya seleccionado; que la búsqueda de prompts con `q` vacío vuelva a
  recientes.
- Conflictos: paginación anterior/siguiente, rango `offset+1–offset+n de total`, selectores de
  página y estado, y que ninguna fila sea un enlace.
- Review: mensaje de vacío «no hay observaciones pendientes de revisión» y la nota de solo lectura.
- Legibilidad de los chips nuevos (relación/estado) y del bloque de prompt con `white-space:
  pre-wrap`.
