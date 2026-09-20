# Feature: engram-web — fase 3, alta de memoria, revisión y juicio

Rama: `main` (fases anteriores en `odd/tasks/engram-web.md` y `odd/tasks/engram-web-writes.md`).

## Objetivo

Cerrar las tres operaciones que faltaban para que la interfaz cubra el trabajo diario del CLI:
marcar una observación como revisada, crear memoria nueva desde el navegador y juzgar relaciones de
conflicto.

## Alcance confirmado (usuario)

| Operación | Endpoint | Estado |
| --- | --- | --- |
| Marcar revisada | `POST /review/mark_reviewed` | incluida |
| Crear memoria nueva | `POST /sessions` + `POST /observations` | incluida |
| Juzgar relación de conflicto | `POST /conflicts/judge` | incluida |
| Guardar prompt, borrar prompt o sesión, import, hard delete | — | fuera |

## Hechos verificados del runtime (fuente: engram v2.0.0)

- **`engram save` (CLI) crea la sesión `manual-save-<proyecto>`** con `ownership_mode`
  `project_owned` y el directorio actual, y después publica la observación con ese `session_id`. La
  interfaz debe replicar esa convención para no inventar sesiones nuevas por cada alta.
- `POST /observations` exige `session_id` y `content` no vacíos, y un `title` que no sea solo
  espacios; cuando el `project` del cuerpo no coincide con el de la sesión, responde 404/409 a través
  de la validación de sesión.
- `POST /review/mark_reviewed` acepta `{observation_id}` (o el legado `{id}`), resuelve el proyecto
  con `project`/`all_projects` y devuelve la observación ya recargada.
- `POST /conflicts/judge` recibe `{judgment_id, relation, reason?, evidence?, confidence?}` donde
  **`judgment_id` es el `sync_id` de la relación**; verbos válidos: `related`, `compatible`, `scoped`,
  `conflicts_with`, `supersedes`, `not_conflict`. El servidor fija `marked_by_actor` y
  `marked_by_kind` como `agent`, y la escritura es un `UPDATE ... WHERE sync_id = ?` **sin guarda de
  estado**: volver a juzgar **reemplaza** el veredicto anterior.
- `confidence` debe estar entre 0.0 y 1.0.

## Reglas de seguridad de la fase

1. **Crear memoria exige un proyecto explícito.** Con «todos los proyectos» no se crea nada: sin
   proyecto no hay sesión válida.
2. **El directorio de la sesión es un campo visible y editable**, nunca un valor inventado. El runtime
   guarda la ruta absoluta de lo que reciba y, si recibe vacío, guarda **su propio cwd**, que sería un
   dato falso: el formulario lo pide, lo rellena con la ruta del proyecto cuando el runtime lo tiene
   resuelto, y lo explica.
3. **Nada se publica sin revisar el resumen**: el formulario muestra antes de enviar el proyecto, la
   sesión que se usará, el tipo, el scope, el título y el directorio; y avisa cuando va a crear la
   sesión manual porque aún no existía.
4. **Juzgar avisa de que reemplaza.** La interfaz muestra el veredicto actual y el estado del juicio,
   y advierte de que un veredicto nuevo sustituye al anterior en la base.
5. Marcar revisada se explica como lo que es: reinicia el ciclo local de revisión de esa observación.
6. El check ejecutable sigue **sin usar la red**: toda mutación nueva se verifica interceptando
   `fetch`, con los verbos inválidos rechazados en cliente.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Cliente: `markReviewed`, `createSession`, `createObservation`, `judgeRelation` y sus tipos | hecho |
| 2 | Extender el check sin red con los tres caminos nuevos, incluido el rechazo de verbos inválidos | hecho |
| 3 | Vista Review: botón «Marcar revisada» por observación, con recarga de la cola | hecho |
| 4 | Vista «Nueva memoria»: formulario, resumen previo, sesión manual y publicación | hecho |
| 5 | Conflictos: juicio de relaciones con veredicto actual visible y aviso de reemplazo | hecho |
| 6 | Verificación: build, typecheck, check sin red y verificación independiente con escrituras sobre copia aislada | hecho — escrituras reales sobre copia aislada, runtime real intacto |

## Evidencia

- Los commits de esta fase se autorizan y registran por unidad de trabajo, según
  `CONTRATO_FLUJO_GIT_VERSIONADO.md`.

### Verificación mecánica (tareas 1–5)

Ejecutada sobre el árbol de trabajo de esta unidad, antes de crear sus commits:

- `npm run typecheck` → exit 0 (sin salida de errores).
- `npm run check:writes` → exit 0, 18 casos. Los 8 de la fase 2 siguen intactos y los 10 nuevos
  imprimen:
  - `manualSessionId("task-prueba") -> manual-save-task-prueba, no request` (cero peticiones: la
    convención vive en una sola función).
  - `markReviewed(7, {allProjects}) -> POST /api/review/mark_reviewed?all_projects=true` con cuerpo
    exacto `{"observation_id":7}` y `content-type: application/json`.
  - `markReviewed(7, {project})` → `POST /api/review/mark_reviewed?project=task-prueba`, sin
    `all_projects`.
  - `createSession(input) -> POST /api/sessions` con cuerpo exacto
    `{id, project, directory, ownership_mode:"project_owned"}`.
  - `createObservation(input) -> POST /api/observations` con exactamente
    `session_id, type, title, content, project, scope, topic_key`.
  - `createObservation` con `scope`/`topic_key` vacíos → esas claves se **omiten**, no viajan como
    cadenas vacías.
  - `judgeRelation(valid) -> POST /api/conflicts/judge` con cuerpo mínimo
    `{"judgment_id":"rel-1","relation":"related"}`.
  - `judgeRelation` con `reason`/`evidence`/`confidence` → esas tres claves presentes.
  - `judgeRelation` con el verbo inválido `superseded` → promesa rechazada y **cero** peticiones.
  - `judgeRelation` con `confidence: 1.5` → promesa rechazada y **cero** peticiones.
- `npm run build` → exit 0. Salida emitida: `dist/index.html` 0.39 kB (gzip 0.26 kB),
  `dist/assets/index-DR97r0pv.css` 7.23 kB (gzip 1.96 kB),
  `dist/assets/index-BDVp03yz.js` 219.91 kB (gzip 75.81 kB).
- `npm run smoke` → exit 0 contra el runtime vivo (solo lectura): engram 2.0.0, 675 observaciones
  en 18 proyectos, `getDoctor()` ok con 9 chequeos.

### Formas de respuesta derivadas del código de engram v2.0.0

Fuente: clon upstream en `C:\Users\alfredo\AppData\Local\Temp\engram-src`.

| Endpoint | Handler | Respuesta real |
| --- | --- | --- |
| `POST /sessions` | `internal/server/server.go:502` | 201 `{"id": <string>, "status": "created"}` |
| `POST /observations` | `internal/server/server.go:595` | 201 `{"id": <int64>, "status": "saved"}` |
| `POST /review/mark_reviewed` | `internal/server/server.go:944` | 200 con `reviewObservationPayload` (`internal/server/server.go:994`): `id`, `sync_id`, `title`, `type`, `state`, `project?`, `review_after?` — **no** la observación completa |
| `POST /conflicts/judge` | `internal/server/server.go:1850` | 200 `{"relation": <store.Relation>}` (`internal/store/relations.go:279`), no un verbo |

Otros hechos confirmados en el código, no supuestos:

- `POST /sessions` exige `id` y `project`; sin `ownership_mode` el runtime usa `shared`, así que el
  cliente envía `project_owned` explícito, la misma constante que usa el CLI
  (`internal/store/store.go:136`). La inserción es un `INSERT ... ON CONFLICT(id) DO UPDATE`
  (`internal/store/store.go:7944`), por eso repetir una sesión idéntica no falla; un id ya
  registrado para **otro** proyecto responde 409 `session_project_conflict`.
- El CLI crea la sesión `manual-save-<proyecto>` con el cwd (`cmd/engram/main.go:1435`) y su tipo por
  defecto es `manual` con scope `project` (`cmd/engram/main.go:1325`).
- `POST /observations` valida el título antes de buscar la sesión y exige `session_id` y `content` no
  vacíos; `project` se contrasta contra el de la sesión (`internal/server/server.go:2027`, 400
  `session_project_mismatch`, 404 si la sesión no existe).
- `POST /conflicts/judge` valida el verbo en `store.isValidRelationVerb`
  (`internal/store/relations.go:585`) y la confianza entre 0.0 y 1.0; fija `marked_by_actor` y
  `marked_by_kind` como `agent` y escribe con `UPDATE ... WHERE sync_id = ?` sin guarda de estado.

### Ninguna escritura alcanzó el runtime real

El check sin red reemplaza `globalThis.fetch` antes de importar el cliente y exige, en cada caso,
que la URL registrada empiece por `/api/` (relativa, no puede resolver a un origen de red), que no
contenga `7437` y que `globalThis.fetch` siga siendo el grabador. Los cuatro casos peligrosos nuevos
(`createSession`, `createObservation`, `markReviewed` y `judgeRelation`) se ejecutaron **solo** ahí.
En esta unidad no se ejecutó ningún `curl`, `POST`, `PUT`, `PATCH` ni `DELETE` contra
`127.0.0.1:7437`: la única llamada real fue `npm run smoke`, que es de solo lectura (sus funciones
solo emiten `GET`, no hay ningún `method` en `scripts/smoke-api.ts`).

### Cómo comprobarlo en el navegador

No hay navegador en este entorno, así que queda para el humano:

- Review: el botón «Marcar revisada» no navega (está fuera del `RouterLink` de la tarjeta), se
  deshabilita mientras la petición está en vuelo y la cola se recarga tras el 200.
- «Nueva memoria»: al elegir el proyecto activo, el directorio se rellena con `project_path` y al
  cambiarlo a otro proyecto se pide la ruta; el resumen muestra sesión, directorio, tipo, scope y
  título antes de enviar; el enlace final abre `/observations/:id`.
- El 409 real del runtime al chocar con una sesión de otro proyecto y el 400 al intentar publicar sin
  proyecto o con título en blanco.
- Conflictos: el formulario de veredicto muestra el veredicto actual, y tras guardar se recargan
  lista y estadísticas.
- La forma del `<datalist>` de tipos con navegadores que lo renderizan distinto (Safari), donde el
  campo sigue siendo un texto libre válido.

### Verificación independiente (tarea 6)

Ejecutada por `gentle-ai-verify` con escrituras reales sobre una copia aislada de la base en el puerto
7439; el aislamiento se probó antes con un directorio de datos vacío (0 observaciones frente a las
auténticas) y al terminar se comprobó que el runtime real seguía intacto. Comportamiento medido:

- `POST /sessions` con `manual-save-verify` y `ownership_mode: project_owned` → 201
  `{"id":...,"status":"created"}`; repetirlo devuelve 201 con el mismo cuerpo, es decir, **es un upsert
  idempotente y no un error**. El runtime almacena el directorio en minúsculas.
- `POST /observations` → 201 `{"id":1202,"status":"saved"}`, con todos los campos exactos y los
  acentos intactos; un título en blanco → 400 `{"error":"observation title is required"}`.
- `POST /review/mark_reviewed` → 200 con el payload de revisión, y `review_after` se re-ancla a la
  fecha actual más seis meses.
- `POST /conflicts/judge` → 200, y **el reemplazo quedó demostrado**: al juzgar dos veces la misma
  relación, el segundo veredicto sustituye al primero (`related` → `conflicts_with`, con `updated_at`
  nuevo y las estadísticas moviéndose en consecuencia). No hay guarda de estado, exactamente como
  advierte la interfaz.
- Verbo inválido → 400 `JudgeRelation: invalid relation verb "superseded"`; confianza 1.5 → 400
  `confidence must be between 0.0 and 1.0`. Ninguno de los dos escribió nada.
- Sesión ya existente con otro proyecto → 409 `session_project_conflict` con `owner_project`, que es
  el campo que lee el formulario.
- El runtime real quedó intacto: la relación de prueba sigue `pending` con su `updated_at` original,
  y ni `GET /sessions/manual-save-verify` ni `GET /observations/1202` existen en el puerto 7437.

Punto no concluyente: si marcar revisada saca la observación de la cola de `/review` no se pudo
observar, porque la cola de la copia estaba vacía; lo que sí se comprobó es el mecanismo, con
`review_after` re-anclado.

### Ajuste posterior a la verificación: la acción también en el detalle

«Marcar revisada» se añadió también a la vista de detalle de la observación, junto a las demás
acciones explícitas. El motivo es el encontrado al probar la interfaz: la cola de review puede estar
legítimamente vacía —en la base del usuario no había ninguna observación con `review_after` vencido y
la más próxima vencía meses después— y en ese caso la acción queda inalcanzable desde cualquier
pantalla. La llamada es la misma: `markReviewed` con el proyecto de la observación, o `all_projects`
cuando no tiene proyecto, y el aviso muestra la fecha real devuelta por el runtime.

## Añadido posterior: sección de ayuda en la aplicación (`/help`)

Se agregó una página de ayuda estática (sin datos, sin interactividad) accesible desde la barra
lateral y desde la ruta `/help`, con índice por anclas. Cubre: qué es la aplicación, cómo se conecta
al runtime y por qué el proxy propio es obligatorio, cómo arrancarla con sus variables y sus
comprobaciones, una entrada por pantalla, el vocabulario de proyecto/scope/tipo/`match_mode`/`rank`,
qué hace realmente cada acción de escritura, las limitaciones del API local en una tabla y los
avisos de lectura.

Motivo: varias conductas del conjunto no son evidentes desde la interfaz y se explican igual en cada
vista, o directamente no se explican en ninguna. Las tres que justifican la página son:

1. El pin se escribe pero **no se lee de vuelta**, así que el botón vuelve a «Fijar» tras recargar.
2. La cola de Review puede estar **legítimamente vacía**, porque solo lista lo que tiene la revisión
   vencida; por eso «Marcar revisada» también vive en el detalle.
3. El borrado es suave pero **no tiene deshacer**: el runtime no expone restauración.

Archivos: `src/views/HelpView.vue` (página), `src/router.ts` (ruta), `src/components/AppLayout.vue`
(entrada «Ayuda»), `src/styles.css` (ancho de lectura, índice, tablas y notas) y `README.md`
(puntero a `/help`).

### Ampliación: qué es Engram y cómo se mantiene

Se añadió una segunda sección a la ayuda, «Qué es Engram» (`id="engram"`), entre «Qué es esta
Aplicación» y «Cómo se conecta», con su entrada correspondiente en el índice. Cubre tres cosas:

- **Qué es**: proyecto de código abierto bajo licencia MIT, agnóstico del agente, un binario de Go
  sin dependencias; los agentes guardan observaciones estructuradas de forma deliberada y escriben un
  resumen al cerrar la sesión, sin recolección masiva.
- **Cómo funciona**: SQLite con FTS5 en `~/.engram/engram.db`; sesiones, observaciones, prompts y
  relaciones (conflictos con veredicto, cola de revisión por vencimiento); las cuatro superficies
  (MCP stdio, API HTTP en 7437, CLI y TUI) y la nube opcional solo para proyectos inscritos.
- **Cómo se mantiene**: el repositorio upstream y sus documentos (`DOCS.md`,
  `docs/ARCHITECTURE.md`, `docs/INSTALLATION.md`, `docs/RELEASE-POLICY.md`), los tres canales de
  publicación, el procedimiento deliberado de actualización con copia de seguridad y sin vuelta
  atrás automática, y `engram --version` / `engram doctor` para comprobar la instalación local.

Motivo: quien use la interfaz debe entender **de dónde sale la memoria** que está viendo y **qué
implica actualizar Engram**, porque la política de publicación no promete soporte de seguridad en
todos los canales ni un camino de vuelta automático. La sección separa explícitamente lo que mantiene
el proyecto upstream de lo que mantiene esta interfaz local, para que nadie confunda la propiedad de
cada parte.

Todos los datos de la sección se verificaron contra el clon local del upstream en su versión v2.0.0
(la instalada en esta máquina), sin afirmaciones no documentadas ni cifras volátiles como estrellas,
incidencias o fechas.

La página deja de ser totalmente estática: dentro de esa sección hay una línea de estado que llama a
`getHealth()` (una sola lectura, sin escrituras) y muestra `Runtime detectado: engram v<versión>`
cuando el runtime responde, o un aviso de que el resto de la sección describe la instalación
prevista y no un estado en vivo cuando no responde. El componente usa refs locales y no el estado
compartido de `app-state.ts`, y no añade dependencias. Archivos: `src/views/HelpView.vue`,
`CHANGELOG.md` y esta nota.
