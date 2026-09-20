# Feature: engram-web — catálogo de comandos de consola

Rama: `feature/commands-reference` (creada desde `main` en `4a17806`; fases anteriores en
`odd/tasks/engram-web.md`, `engram-web-writes.md`, `engram-web-authoring.md`,
`engram-web-projects.md` y `engram-web-hardening.md`).

## Objetivo

Reunir en una sola pantalla (`/commands`) todos los comandos que el usuario puede ejecutar en una
consola: los scripts npm de esta aplicación y la referencia completa del CLI de Engram v2.0.0. Cada
entrada muestra el comando exacto con botón **Copiar**, qué hace (descripción) y para qué sirve
(propósito). **La web no ejecuta nada**: solo copia texto.

## Alcance confirmado (usuario)

| Capacidad | Decisión |
| --- | --- |
| Referencia completa del CLI de Engram (todos los comandos y subcomandos de `engram --help`) | incluida |
| Scripts npm de esta aplicación | incluidos |
| Comando exacto + botón Copiar + descripción + propósito por entrada | incluido |
| Ejecutar comandos desde la web | **fuera** (descartado a propósito, igual que en Proyectos) |
| Fuente única de comandos | **incluida**: Ayuda enlaza a `/commands` y `PROJECT_COMMANDS` se deriva del mismo catálogo |
| Filtro de texto o búsqueda en la página | **fuera** por ahora: los anclajes por grupo cubren la navegación |

## Hechos verificados (fuente: engram v2.0.0 instalado, `node v24.18.0`)

1. **`engram --help` es la autoridad del catálogo.** Enumera 22 herramientas MCP, y como comandos de
   consola: `serve`, `mcp`, `tui`, `test`, `search`, `save`, `delete` (observación, sesión, prompt,
   proyecto), `timeline`, `conflicts` (`list`, `show`, `stats`, `scan`, `deferred`), `doctor`,
   `context`, `stats`, `export`, `import`, `init`, `projects` (`list`, `consolidate`, `prune`),
   `setup`, `sync` (`--import`, `--status`, `--all`, `--cloud`), `cloud` (`status`, `enroll`,
   `config`, `serve`), `obsidian-export`, `version` y `help`. El catálogo se copió de esa salida
   textual.
2. **Los scripts npm son la única vía de arranque de esta interfaz** (`package.json`): `dev`,
   `build`, `typecheck`, `preview`, `start`, `smoke`, `check:writes`, `check:projects`,
   `check:server`. Se añade `check:commands` con esta fase.
3. **`projects prune` borra sin vuelta atrás** y se niega si al proyecto le quedan observaciones
   (`odd/tasks/engram-web-projects.md`, hechos 4 y 6). Esa advertencia se mantiene visible en la
   entrada del catálogo, no solo en `/projects`.
4. **Ayuda ya duplicaba comandos**: su tabla de arranque y su lista de comprobaciones repetían lo
   que ahora vive en `/commands`. Con tres copias (Ayuda, Proyectos, `/commands`) la
   desincronización era cuestión de tiempo.

## Decisiones de diseño

- **Un solo módulo de datos, sin lógica**: `src/api/commands.ts` exporta grupos e entradas. Es el
  mismo patrón que `src/api/projects.ts`, que ya era la fuente única de sus cinco comandos.
- **Cada comando aparece una sola vez.** `scripts/check-commands.ts` falla si dos entradas comparten
  id o si el mismo texto de comando se repite en dos grupos, así que la duplicación no puede volver
  por descuido.
- **`PROJECT_COMMANDS` se deriva del catálogo** (`commandText(id)`), no se reescribe. Si un id no
  existe, la función lanza: un error de dedo falla ruidosamente en vez de mostrar un comando vacío.
- **La importación usa extensión `.ts` explícita** en `src/api/projects.ts`: los scripts de
  comprobación ejecutan los módulos directamente bajo el type stripping de Node, que exige la
  extensión, y `allowImportingTsExtensions` en `tsconfig.json` (posible porque `noEmit` ya está
  activo) mantiene a `vue-tsc` conforme. Así `PROJECT_COMMANDS` y el catálogo no pueden divergir.
- **El portapapeles se comparte** mediante `src/state/use-copy.ts`, extraído del código que
  Proyectos ya tenía incrustado. Un fallo de `navigator.clipboard` se muestra en pantalla; nunca
  falla en silencio.
- **Sin ejecución, sin red y sin estado**: la vista es estática, no llama al runtime y no tiene
  `onMounted`. Las únicas interacciones son copiar y los filtros del catálogo.
- **La barra sigue lo que cada ruta declara** en su `meta.filters`: `['project']` en Panel,
  Sesiones, Review y Conflictos (solo leen ese filtro), `['project', 'scope', 'type']` en Recientes
  y Búsqueda, y `'commands'` en Comandos para el par grupo/búsqueda del catálogo. Una ruta sin
  declaración no muestra barra (Proyectos, Ayuda, el detalle de observación, el timeline y el
  formulario de nueva memoria, donde el control es su propio selector de proyecto).

## Tareas

- [x] T1. Documento de la fase y rama.
- [x] T2. `src/api/commands.ts`: catálogo completo (6 grupos, 56 entradas) con descripción, propósito
      y aviso cuando el comando es destructivo.
- [x] T3. `src/state/use-copy.ts`, `src/views/CommandsView.vue`, ruta `/commands` y entrada en la
      navegación.
- [x] T4. `PROJECT_COMMANDS` derivado del catálogo; Ayuda apunta a `/commands` en vez de repetir
      tablas.
- [x] T5. `scripts/check-commands.ts` + script npm; comprobaciones ejecutadas.
- [x] T6. README, CHANGELOG y commits por unidad de trabajo.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | ok, sin diagnósticos |
| `npm run check:commands` | ok (5 casos) |
| `npm run check:projects` | ok |
| `npm run check:writes` | ok |
| `npm run check:server` | ok |
| `npm run build` | ok (vue-tsc + vite build) |
| Navegador real, `http://localhost:5173/commands` | 56 tarjetas y 56 botones, 6 grupos con anclas, chip de navegación presente, 8 avisos de comando destructivo; al pulsar Copiar aparece «Copiado» sin error |
| Navegador real, `/projects` y `/help` | Proyectos sigue mostrando sus 5 botones con el composable compartido; Ayuda enlaza dos veces a `/commands` |
| `npm run smoke` | no ejecutado: necesita el runtime vivo en 7437 |
| Navegador real, campos de la barra | pendiente de observar tras este cambio: Panel/Sesiones/Review/Conflictos solo Proyecto, Recientes/Búsqueda los tres, Comandos grupo y búsqueda, y el resto sin barra |

## Evidencia de commits (rama `feature/commands-reference`)

| Unidad de trabajo | Commit |
| --- | --- |
| Catálogo, vista, composable, ruta, navegación y comprobación offline | `5d0d100` feat: add a console command catalog screen |
| Derivación de `PROJECT_COMMANDS`, composable compartido y extensión `.ts` | `a4f532b` refactor: derive the project commands from the shared catalog |
| Ayuda y README apuntando al catálogo | `c70fb97` docs: point the in-app help at the command catalog |

Este documento y el CHANGELOG se cierran en un commit de documentación posterior. El push, el pull
request y el merge quedan como decisión del usuario.
