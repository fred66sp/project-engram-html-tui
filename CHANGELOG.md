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
- Comprobaciones ejecutables: `npm run smoke`, que lee del runtime vivo, y `npm run check:writes`,
  que verifica método, ruta y cuerpo de cada mutación sin usar la red.

### Notas

- El borrado es únicamente suave y el runtime no ofrece restauración: la interfaz lo advierte y exige
  escribir el id exacto. El borrado permanente se deja fuera a propósito, porque no tendría vuelta
  atrás.
- El runtime no devuelve el estado del pin al leer una observación, así que la interfaz avisa de que
  no puede comprobarlo de vuelta tras recargar.
- Carencias conocidas del API: no hay detalle de sesión por HTTP, no hay paginación por offset en
  observaciones ni prompts, el filtro por tipo solo existe en la búsqueda, las relaciones de
  conflicto se identifican con `sync_id` en lugar de los identificadores numéricos que necesita la
  vista de detalle, `/stats` no expone contadores por proyecto, y la gestión de proyectos, la
  configuración de agentes y la sincronización con la nube siguen fuera de la interfaz.
