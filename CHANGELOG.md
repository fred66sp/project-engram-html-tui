# Changelog

## [Sin publicar]

### Añadido

- Interfaz web `engram-web` para gestionar la memoria de Engram desde el navegador, sobre el runtime
  local (`engram serve`, puerto 7437).
- Servidor local sin dependencias que sirve la aplicación y hace proxy de `/api/*` hacia el runtime,
  necesario porque el API local no emite cabeceras CORS y responde 405 a las peticiones de
  comprobación previas.
- Cliente tipado del API local: salud, estadísticas, observaciones, búsqueda, timeline, sesiones,
  prompts, cola de revisión, conflictos, diagnóstico y export.
- Vistas: panel con totales y proyectos, recientes con filtros de proyecto, scope y tipo, detalle de
  observación con markdown saneado, búsqueda con relevancia visible, timeline, sesiones con prompts,
  cola de revisión y conflictos con estadísticas y paginación.
- Escrituras controladas: fijar y quitar el pin, edición de campos enviando solo lo modificado,
  borrado suave con confirmación por id y descarga del export desde el panel.
- Alta y revisión: crear memoria desde el navegador con la sesión manual `manual-save-<proyecto>`,
  marcar una observación como revisada y juzgar relaciones de conflicto.
- Ayuda integrada en la aplicación (`/help`): qué es Engram y cómo se mantiene (licencia, canales de
  publicación y qué implica actualizar), qué hace cada pantalla, el vocabulario del runtime, qué hace
  exactamente cada acción de escritura y las limitaciones conocidas. La sección de Engram incluye una
  línea de estado con la versión del runtime que está escuchando.
- Pantalla de Proyectos (`/projects`) con el inventario del almacén: tabla de proyectos con sus
  conteos (observaciones, sesiones y prompts) y directorios asociados, marca de los proyectos
  podables y de los nombres con ruta, y los comandos de poda y consolidación con botón de copia. Los
  datos salen de la ruta local `/local/projects`, que responde el servidor propio con un ciclo
  `engram mcp --tools=mem_list_projects` sobre el binario de Engram (configurable con `ENGRAM_BIN`,
  con `ENGRAM_MCP_TIMEOUT_MS` como límite de tiempo), nunca del API HTTP.
- Comprobaciones ejecutables: `npm run smoke`, que lee del runtime vivo, `npm run check:writes`,
  que verifica método, ruta y cuerpo de cada mutación sin usar la red, y `npm run check:projects`,
  que ejercita el inventario sin red y sin lanzar ningún proceso.
- `npm run check:server` ejercita el servidor de producción sin red externa: levanta
  `server/server.mjs` en un puerto efímero contra un runtime de mentira y un directorio de
  artefactos temporal, y verifica el proxy `/api/*`, el fallback de la SPA y la ruta
  `/local/projects`. Nunca abre el 7437 ni el 7438 y nunca lanza el binario `engram`. Para poder
  levantarlo, `server/server.mjs` exporta la fábrica `createEngramWebServer(options)` y solo
  escucha cuando se ejecuta como programa principal.
- Pantalla de Comandos (`/commands`) con el catálogo único de los comandos de consola: los scripts
  npm de este proyecto y el CLI completo de Engram v2.0.0, cada entrada con el comando exacto,
  botón de copiar, descripción, propósito y aviso en los destructivos. Los filtros del catálogo
  —grupo y búsqueda por texto libre, buscando en el comando, el nombre, la descripción y el
  propósito— viven en la barra superior, en la misma franja y con el mismo aspecto que los filtros
  de las demás pantallas, no dentro de la página. `PROJECT_COMMANDS` de la pantalla de Proyectos se
  deriva de ese catálogo y la Ayuda ahora enlaza a él en vez de repetir las tablas de arranque y
  comprobaciones; la página no ejecuta nada.
- `npm run check:commands`, que comprueba el catálogo sin red ni procesos: ids únicos, entradas
  completas y ningún texto de comando repetido.
- La barra de filtros del armazón ahora muestra solo los filtros que cada pantalla lee de verdad:
  Panel, Sesiones, Review y Conflictos filtran solo por proyecto, mientras que Recientes y Búsqueda
  muestran también scope y tipo. Cada ruta lo declara en su `meta` (`filters: ['project']`,
  `['project', 'scope', 'type']` o `'commands'` para el catálogo), y una ruta sin declaración no
  muestra barra, así que no aparece un control que no filtre nada.

### Notas

- El borrado es únicamente suave y el runtime no ofrece restauración: la interfaz lo advierte y exige
  escribir el id exacto. El borrado permanente se deja fuera a propósito, porque no tendría vuelta
  atrás.
- El runtime no devuelve el estado del pin al leer una observación, así que la interfaz avisa de que
  no puede comprobarlo de vuelta tras recargar.
- Juzgar una relación de conflicto escribe el veredicto en la base y **reemplaza** el anterior: el
  runtime no comprueba el estado previo, y la interfaz lo advierte antes de enviar.
- La cola de revisión solo muestra las observaciones cuya fecha de revisión ya venció, de modo que
  puede estar vacía durante meses; marcar una como revisada la pospone seis meses.
- Carencias conocidas del API: no hay detalle de sesión por HTTP, no hay paginación por offset en
  observaciones ni prompts, el filtro por tipo solo existe en la búsqueda, las relaciones de
  conflicto se identifican con `sync_id` en lugar de los identificadores numéricos que necesita la
  vista de detalle, `/stats?all_projects=true` no expone contadores por proyecto y omite los
  proyectos sin observaciones, `/stats?project=<ruta>` (y `/observations`, `/sessions/recent` y
  `/prompts/recent`) responde `400 invalid_project`, y no existe ningún endpoint de gestión de
  proyectos, ni de configuración de agentes, ni de sincronización con la nube.
- La pantalla de Proyectos solo muestra y copia: la interfaz web no ejecuta la poda ni la
  consolidación, a propósito, para no añadir superficie destructiva en el navegador.
- La poda de proyectos (`engram projects prune`) borra los prompts del proyecto y sus sesiones sin
  observaciones, y el runtime no expone ninguna restauración: no hay vuelta atrás.
- La consolidación (`engram projects consolidate`) solo puede fusionar nombres que normalizan al
  mismo nombre (minúsculas y colapso de `--` y `__`); el propio almacén rechaza lo demás con
  `source project "…" must normalize to canonical project "…"`, así que los nombres con ruta no se
  pueden fusionar por esa vía. Para esos casos hay que mover las observaciones al proyecto correcto
  una a una y podar después el nombre que quede vacío.
