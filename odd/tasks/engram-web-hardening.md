# Feature: engram-web — correcciones verificadas en el navegador

Rama: `feature/hardening-browser-findings` (creada desde `main` en `eb9e07a`; fases anteriores en
`odd/tasks/engram-web.md`, `engram-web-writes.md`, `engram-web-authoring.md` y
`engram-web-projects.md`).

## Objetivo

Cerrar el hueco que las tres fases anteriores dejaron abierto por escrito: "no verificable sin
navegador". Con `chrome-devtools` MCP instalado se recorrió la aplicación real servida en
`http://127.0.0.1:7438/` y se midió lo que el código por sí solo no dice. Esta fase corrige lo que
esa medición demostró, y añade la primera comprobación automática del servidor de producción, que
hasta ahora no tenía ninguna.

## Alcance (decidido por el usuario: "adelante con los ajustes necesarios")

| Capacidad | Decisión |
| --- | --- |
| Foco del diálogo de borrado: trampa de Tab y devolución del foco al disparador | incluida |
| `role="alert"` en los avisos asíncronos que faltaban | incluida |
| Invariante `project` XOR `all_projects` en un único sitio compartido | incluida |
| Un solo `GET /stats` en la carga del Dashboard | incluida |
| Smoke automático de `server/server.mjs` (proxy, fallback SPA, `/local/projects`) | incluida |
| Subir la puntuación SEO/agentic de Lighthouse (meta description, `robots.txt`, `llms.txt`) | **fuera**: herramienta local sin indexación, perseguirlo sería ruido |
| Corregir el CLS 0.201 del Dashboard | **fuera de esta fase**: es real, pero exige medir el desplazamiento por elemento antes de tocar estilos. Queda anotado como pendiente |
| Añadir Vitest o cualquier framework de test | **fuera**: Node 24 ya ejecuta los scripts de comprobación con tipos, y el navegador cubre lo que la lógica de foco necesita |

## Hechos medidos con `chrome-devtools` MCP (runtime engram v2.0.0, servidor de producción 7438)

1. **Consola limpia en todas las rutas.** 0 mensajes con `includePreservedMessages`, recorriendo
   `/`, `/recent`, `/search`, `/sessions`, `/review`, `/conflicts`, `/new`, `/projects`, `/help`,
   `/observations/:id` y `/timeline/:id`. No hay errores de runtime que arreglar.
2. **El invariante del cliente se cumple.** `all_projects=true` viaja siempre en modo "Todos los
   proyectos"; `project=<nombre>` viaja cuando hay selección. `GET /api/observations` sin `project`
   responde `[]` porque el runtime resuelve por cwd: no es un defecto de la interfaz.
3. **Un único duplicado real, medido por ruta con `performance.getEntriesByType('resource')`.**
   `/` emite `GET /api/stats?all_projects=true` **dos veces**: `src/state/app-state.ts` (selector del
   encabezado) y `src/views/DashboardView.vue` (tarjetas), cada uno con estado propio. `/recent`,
   `/sessions` y `/observations/1216` cargan una sola vez. **Corrección a una inferencia previa**: el
   doble `GET /api/observations/1216` que se ve al encadenar detalle → timeline **no** es un
   duplicado; esa segunda llamada es de `TimelineView` (`getObservation` antes de `getTimeline`). La
   carga directa del detalle emite una sola.
4. **El modal de borrado no atrapa ni devuelve el foco (reproducido con teclado real).** El diálogo
   declara `role="dialog"`, `aria-modal="true"` y `aria-labelledby`, enfoca el campo al abrir y se
   cierra con Escape. Pero con el foco en el último elemento interno (`Cancelar`), una pulsación
   **real** de Tab (evento confiable por CDP) deja `document.activeElement === BODY` **con el diálogo
   aún abierto**; hay 20 elementos focusables por detrás y ninguna trampa. Al cerrar con Escape el
   foco queda en `BODY`, no vuelve al botón "Eliminar…". La pérdida de foco ocurre justo en la acción
   destructiva.
5. **`liveRegions: 0` en `/observations/:id`**, la vista con guardar, fijar, marcar revisada y
   borrar. `DashboardView` y `ObservationView` ya usan `role="alert"`; `ReviewView` y `ConflictsView`
   no, así que sus fallos asíncronos no se anuncian.
6. **Lighthouse (navegación, desktop)**: Accessibility **100**, Best Practices **100**, CLS **0.201**.
   Un defecto de foco dinámico no lo detecta ninguna auditoría estática: por eso hay que reproducirlo
   con teclado.
7. **Estados reales de la API del runtime** (sonda directa): `200` en `/health`, `/project/current`,
   `/stats`, `/observations`, `/observations/recent`, `/search`, `/sessions/recent`, `/prompts/recent`,
   `/prompts/search`, `/review`, `/conflicts`, `/conflicts/stats`, `/export`, `/local/projects`;
   `405` en `/sessions`; `404` en `/projects` y `/reports/conflicts`. **La SPA no llama a ninguno de
   esos tres**, así que no hay trabajo que hacer ahí.
8. **`server/server.mjs` no tenía ninguna comprobación.** Los tres scripts existentes cubren
   `src/api/client.ts`, `src/api/projects.ts` y `server/projects.mjs`. El proxy `/api/*`, el fallback
   de SPA y el enrutado de `/local/projects` son la única ruta de producción y no estaban cubiertos.

## Diseño acordado

- **Foco del modal**: guardar el elemento activo al abrir, restaurarlo al cerrar y ciclar Tab/Shift+Tab
  dentro del diálogo, que solo tiene dos focusables (campo y `Cancelar`). Sin dependencias nuevas.
- **Invariante compartido**: `projectFilter(project)` vive en `src/api/client.ts`, junto al
  `projectParams` que ya resuelve la exclusión, y las vistas lo consumen. Es una función pura, así que
  `check:writes` puede comprobarla en Node sin DOM.
- **Un solo `/stats`**: `src/state/app-state.ts` pasa a ser el único dueño del resultado de `/stats`
  (`stats` + `loadStats()`), y `DashboardView` consume ese estado en vez de pedirlo otra vez.
- **Smoke del servidor**: `server/server.mjs` debe exportar una fábrica
  (`createEngramWebServer(options)`) y escuchar solo cuando se ejecuta como programa principal. Así
  `scripts/check-server.ts` puede levantarlo en el puerto `0` (efímero), con un runtime de mentira
  local y un handler de proyectos inyectado, sin tocar el 7438 ni el 7437 reales ni lanzar el binario
  `engram`.

## Reglas de esta fase

1. **Ninguna comprobación toca los puertos reales.** El smoke usa puerto efímero (`0`), upstream
   simulado y `createProjectsHandler` inyectado. Nunca abre un socket contra 7437 ni 7438, y nunca
   ejecuta `engram`.
2. **Ninguna comprobación escribe en el almacén.** Se mantiene la regla de las fases anteriores: solo
   GET contra el runtime, y `globalThis.fetch` interceptado donde haga falta.
3. **Sin dependencias nuevas.** Node 24 ejecuta TypeScript directamente y la manipulación de foco se
   hace con la API del DOM.
4. **Superficie destructiva intacta.** El diálogo de borrado mantiene su confirmación por
   identificador; esta fase solo cambia el foco, no la lógica de borrado.
5. **Los cambios de accesibilidad se verifican en el navegador**, no solo por lectura de código: la
   trampa de foco exige eventos de teclado confiables.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Accesibilidad: trampa de foco y devolución del foco en `DeleteObservationDialog.vue`; `role="alert"` en los avisos asíncronos de `ReviewView.vue` y `ConflictsView.vue` | hecho — `f990846`, reproducido antes/después en navegador |
| 2 | Contrato: `projectFilter()` compartido en `src/api/client.ts`, aplicado en las 9 vistas que repetían el ternario; `stats` único en `src/state/app-state.ts` consumido por `DashboardView.vue`; casos nuevos en `check:writes` | hecho — `1391bc6`, una sola petición `/stats` medida en navegador |
| 3 | Servidor: fábrica exportada en `server/server.mjs`, `scripts/check-server.ts` con proxy, fallback SPA y `/local/projects` sin red externa, script `check:server` en `package.json` | hecho — `3f1404c`, 12/12 casos |
| 4 | Verificación: typecheck, `check:writes`, `check:projects`, `check:server`, `smoke`, verificación independiente adversarial y re-verificación en navegador del foco del modal | hecho — ver evidencia |

## Evidencia

- Los commits de esta fase se autorizan y registran por unidad de trabajo, según
  `CONTRATO_FLUJO_GIT_VERSIONADO.md`. Los cuatro commits fueron autorizados por el usuario para
  esta tarea.

| Commit | Unidad |
| --- | --- |
| `f990846` | Accesibilidad: foco del modal y regiones vivas |
| `1391bc6` | Contrato: `projectFilter()` y un solo `/stats` |
| `3f1404c` | Servidor: fábrica exportada y `check:server` |
| el commit de documentación de esta fase | Documento y `CHANGELOG` |

### Comprobaciones ejecutadas

- `npm run build` (`vue-tsc --noEmit && vite build`) — en verde antes y después de cada unidad.
- `npm run check:writes` — 21/21 casos, incluidos los 3 nuevos de `projectFilter`.
- `npm run check:projects` — en verde.
- `npm run check:server` — 12/12 casos, cuatro sockets, todos en `127.0.0.1:0`; verificado con un
  sondeo previo que envuelve `net.Server.prototype.listen` y los `child_process`: no se tocó 7437 ni
  7438, y `engram` nunca se ejecutó.
- `npm run smoke` — no se ejecutó: habla con el runtime vivo y esta fase no lo necesita.

### Re-verificación en navegador (build nuevo, medido con `performance.getEntriesByType`)

| Comprobación | Antes | Después |
| --- | --- | --- |
| Tab desde `Cancelar` con el diálogo abierto | `activeElement` → BODY | vuelve al campo, dentro del diálogo |
| Shift+Tab desde el campo | — | envuelve al último control |
| Escape | foco perdido en BODY | vuelve al botón «Eliminar…» |
| `GET /stats?all_projects=true` al cargar `/` | 2 | 1 |
| Duplicados en `/`, `/recent`, `/sessions`, `/observations/:id` | 1 ruta | ninguno |
| Consola | limpia | limpia |

El servidor de 7438 se reinició con autorización del usuario para servir el build nuevo, y las
cifras del Dashboard (210 sesiones, 694 observaciones, 1436 prompts, 18 proyectos) siguen
renderizando tras quitarle el `fetch` propio.

### Correcciones posteriores, en la misma rama

Los tres defectos que quedaban abiertos se corrigieron con la causa medida, no supuesta. Todo esto
entra en el mismo commit que este documento.

1. **Escape de porcentaje mal formado (`/%zz`).** Era `500 {"error":"URI malformed"}`; ahora responde
   `200 text/html` con el shell, que es a donde va cualquier ruta que no es un fichero. La
   decodificación se hace dentro de su propio `try`, así que un escape roto deja de llegar al `catch`
   exterior. Caso nuevo en `check-server.ts` con tres formas (`/%zz`, `/%`, `/observations/%zz`),
   afirmando contra el cuerpo del shell y no solo contra el código de estado.
2. **CLS del Dashboard (0.1737 medido, 0.201 en Lighthouse).** Causa medida: la plantilla pintaba tres
   veces porque `statsLoading` arrancaba en `false`, así que el primer pintado no mostraba ni los
   tiles ni la lista de proyectos (~698 px) y las tres secciones de abajo se desplazaban dos veces.
   Ahora el cuerpo espera a que la única petición `/stats` se resuelva, derivando «resuelto» de
   `stats` y `statsError` en vez de un flag que arranca al revés. Un solo `<template v-if>` envuelve
   Export, Doctor y Límites. Medido: **0.1737 → 0** a 1596×770.
3. **CLS a pantalla estrecha (0.3093), que apareció al medir el anterior.** No era del Dashboard:
   `#filter-project` medía 193 px antes de tener opciones y 283 px después, la fila de campos hacía
   wrap al llegar los nombres (los `top` de los campos pasaban de `[68,68,64]` a `[64,64,129]`), la
   barra crecía 145 → 209 px y `.app-main` bajaba 65 px. Ahora ese `select` tiene ancho propio, fijado
   en los 283 px que el propio runtime resuelve, con truncado por si un nombre futuro es más largo.
   El alcance se ciñó a ese control a propósito: es el único `select` cuyo ancho depende de los datos.
   Medido: **0.3093 → 0.0001** a 846×769.

De paso se eliminó `statsLoading` de `src/state/app-state.ts`: quedó sin ningún lector al reescribir
el Dashboard, y un ref que solo se escribe es deuda que engaña.

### Pendiente de decisión del humano

Nada de esta fase queda abierto.
