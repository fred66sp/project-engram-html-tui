# Feature: engram-web — fase 2, escrituras controladas

Rama: `feature/engram-web` (continúa la fase 1 de solo lectura, documentada en
`odd/tasks/engram-web.md`).

## Objetivo

Añadir escritura a la interfaz web de Engram sin poner en riesgo la memoria real:
operaciones mínimas, confirmación explícita y ninguna capacidad que el API no pueda
deshacer.

## Decisiones cerradas (usuario)

| Tema | Decisión |
| --- | --- |
| Escrituras incluidas | Pin/unpin y edición de campos (`PATCH`): título, contenido, tipo, scope, `topic_key` y proyecto |
| Borrado | Solo **soft delete**, con confirmación fuerte: hay que escribir el id exacto y aceptar el aviso de irreversibilidad |
| Export | Solo descarga (`GET /export`). Sin import |
| Fuera de esta fase | Marcar revisada, crear memoria nueva, juzgar conflictos, import, hard delete |

## Hechos verificados del runtime (fuente: engram v2.0.0)

- **No existe endpoint de restauración.** El único `deleted_at = NULL` está en un upsert de
  sync/import; no hay ruta de undelete. Un borrado, aunque sea soft, saca la observación de todos
  los listados y **no se puede deshacer desde el API**. Esto es lo que obliga a la confirmación
  fuerte y a excluir el borrado permanente.
- `DELETE /observations/{id}?hard=true` existe: por eso el cliente **no debe exponer** el parámetro
  `hard` en ninguna firma.
- `PATCH /observations/{id}` exige al menos un campo y acepta `title`, `content`, `type`, `project`,
  `scope`, `topic_key`. Cambiar `project` mueve la observación de proyecto.
- `PUT /observations/{id}/pin` y `DELETE /observations/{id}/pin` devuelven `{id, pinned}`.
- `GET /export` devuelve `{version, exported_at, sessions, observations, prompts}`. Con
  `ENGRAM_HTTP_TOKEN` configurado exige Bearer; sin token, acceso abierto.
- `POST /sessions`, `POST /observations`, `POST /import`, `POST /conflicts/judge` y
  `DELETE /sessions/{id}` **no se usan** en esta fase.

## Reglas de seguridad de la fase

1. El cliente de escritura nunca envía `hard`, nunca envía `import` y nunca crea sesiones.
2. Toda mutación es explícita del usuario: nada se guarda al salir de un campo, nada se borra sin
   el diálogo de confirmación.
3. El borrado exige escribir el id de la observación; el botón permanece deshabilitado hasta que
   coincida, y el diálogo dice con todas las letras que no hay vuelta atrás por API.
4. La edición envía solo los campos modificados y muestra antes qué va a cambiar.
5. El pin se etiqueta como local de este dispositivo, porque lo es.
6. El export es una descarga; nunca escribe en el runtime.
7. El check ejecutable de escritura **no usa la red**: intercepta `fetch` y verifica método, ruta y
   cuerpo, para poder probar el camino peligroso sin mutar la memoria real.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Cliente de escritura: pin/unpin, `PATCH` de campos, soft delete sin `hard` y export tipado | hecho |
| 2 | Check ejecutable sin red que verifica método, ruta y cuerpo de cada mutación | hecho |
| 3 | Detalle de observación: pin, formulario de edición con resumen de cambios y guardado | hecho |
| 4 | Borrado suave con diálogo de confirmación fuerte (id exacto) y salida a Recientes | hecho |
| 5 | Export desde el dashboard como descarga de fichero | hecho |
| 6 | Verificación: build, typecheck, check de escritura y verificación independiente | pendiente |

## Evidencia

- Los commits de esta fase se autorizan y registran por unidad de trabajo, según
  `CONTRATO_FLUJO_GIT_VERSIONADO.md`.

### Verificación mecánica (tareas 1–5)

Ejecutada sobre el árbol de trabajo de esta unidad (sin commits, sin staging):

- `npm run typecheck` → exit 0 (sin salida de errores).
- `npm run build` → exit 0. Salida emitida: `dist/index.html` 0.39 kB (gzip 0.26 kB),
  `dist/assets/index-DhAECGeg.css` 7.02 kB (gzip 1.91 kB),
  `dist/assets/index-DtwF5u8A.js` 207.02 kB (gzip 71.85 kB).
- `npm run check:writes` → exit 0, 8 casos:
  `pin true → PUT /api/observations/7/pin`; `pin false → DELETE /api/observations/7/pin`;
  `updateObservation(7, {title}) → PATCH /api/observations/7` con cuerpo exacto `{"title":"x"}` y
  `content-type: application/json`; `updateObservation(7, {title, scope})` → cuerpo con esas dos
  claves y ninguna `undefined`; `updateObservation(7, {})` → promesa rechazada y **cero** peticiones;
  `deleteObservation(7) → DELETE /api/observations/7` sin `?` y sin `hard`;
  `getExport({allProjects:true}) → GET /api/export?all_projects=true`;
  `getExport({project:'task-prueba'}) → GET /api/export?project=task-prueba` (sin `all_projects`).
- `npm run smoke` → exit 0 contra el runtime vivo (solo lectura): engram 2.0.0, 669 observaciones
  en 18 proyectos, `getDoctor()` ok con 9 chequeos.

### Ninguna escritura alcanzó el runtime real

El check de escritura reemplaza `globalThis.fetch` antes de importar el cliente; el grabador nunca
abre un socket y cada caso lo comprueba: la URL registrada debe empezar por `/api/` (es relativa, por
lo que no puede resolver a un origen de red), no puede contener `7437` y `globalThis.fetch` debe
seguir siendo el grabador. El caso más peligroso, `deleteObservation(7)`, solo se ejecuta ahí: contra
el runtime vivo no se llamó a `PUT`, `PATCH`, `DELETE` ni `POST` en ningún momento. La subida de
contador de observaciones (666 → 669) entre la evidencia de la fase 1 y esta corresponde a la
actividad normal del usuario en Engram, no a esta unidad.

### Pendiente de comprobación en navegador

No hay navegador disponible en este entorno, así que queda para el humano comprobar:

- El botón de pin cambia de `Fijar` a `Quitar pin` y el estado local sigue la respuesta del runtime.
- El resumen de cambios lista solo los campos modificados y el guardado está deshabilitado sin
  cambios; el orden de foco del formulario y del diálogo (el campo de id recibe el foco al abrir).
- Esc y el clic en el fondo cierran el diálogo; el botón de borrado sigue deshabilitado hasta que el
  id escrito coincide exactamente.
- La descarga del export produce `engram-export-<YYYY-MM-DD>.json` con el proyecto activo o todos.
- Los estados de error 400/404/409 reales del runtime al guardar y al borrar.

### Nota de alcance en el borrado

El aviso de borrado no se muestra en la vista de Recientes: `src/views/RecentView.vue` y
`src/state/app-state.ts` están fuera de las superficies autorizadas de esta unidad y no existe hoy
ningún canal de mensajes entre vistas. En lugar de un parámetro de URL que nadie renderiza, el
diálogo se cierra solo cuando el runtime confirma el borrado y el detalle muestra el aviso de
irreversibilidad con el botón «Volver a recientes».

### Hallazgos de la verificación independiente (fase 2)

La verificación del camino destructivo se hizo sobre una **copia aislada**, no sobre la memoria real:
primero se probó el aislamiento con un directorio de datos vacío (el runtime aislado reportó 0
observaciones mientras el real tenía 669) y solo después se tomó una instantánea consistente con
`sqlite3.Connection.backup` y se arrancó un runtime en el puerto 7439 sobre la copia.

Comportamiento real observado en la copia:

- `PUT` / `DELETE /observations/{id}/pin` → 200 `{pinned:true}` y `{pinned:false}`.
- `PATCH` con un título marcador → 200 y el cambio se confirma con `GET`.
- `PATCH {}` → 400 `{"error":"at least one field is required"}` (el cliente lo evita antes de enviar).
- `DELETE /observations/{id}` → 200 `{"hard_delete":false,"id":1195,"status":"deleted"}`; después
  `GET /observations/{id}` → 404 y el id desaparece de recientes, con el total en descenso.
- **No hay reversión**: `PATCH` sobre el id borrado → 404, `PUT .../pin` → 404, y `/restore` y
  `/undelete` no existen. Queda confirmado que el borrado suave es irreversible por API.
- El runtime real quedó intacto: la respuesta de `GET /observations/1195` en el puerto 7437 fue
  idéntica byte a byte antes y después (`sha256 4380f158…5a61`).

Carencia del runtime encontrada, con corrección en la UI:

- **`pinned` no se devuelve al leer**: ni `GET /observations/{id}` ni los listados incluyen el campo.
  El pin se escribe correctamente, pero no se puede comprobar de vuelta, así que la vista de detalle
  ahora lo advierte en lugar de fingir que recuerda el estado tras recargar.
- Ajustes aplicados después de la verificación (no re-verificados): el aviso del pin en el detalle y
  `hard_delete?` añadido a `DeleteResult` para reflejar la respuesta real del runtime.
