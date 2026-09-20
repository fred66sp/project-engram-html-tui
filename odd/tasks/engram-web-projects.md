# Feature: engram-web — inventario de proyectos y comandos guiados

Rama: `feature/projects-inventory` (creada desde `main` en `765aaef`; fases anteriores en
`odd/tasks/engram-web.md`, `engram-web-writes.md` y `engram-web-authoring.md`).

## Objetivo

Dar visibilidad a la higiene de proyectos, que hoy es invisible desde la interfaz. El API HTTP no
expone gestión de proyectos y además **rechaza los nombres con ruta**, que son justo los que la poda
tiene que limpiar. La pantalla muestra el inventario estructurado (conteos y directorios asociados),
marca los proyectos sin observaciones como podables y ofrece el comando exacto listo para copiar.

**La web no ejecuta nada.** La decisión del usuario fue explícita: inventario y comandos guiados, sin
superficie destructiva nueva en el navegador.

## Alcance confirmado (usuario)

| Capacidad | Decisión |
| --- | --- |
| Inventario de proyectos con conteos (observaciones, sesiones, prompts) y directorios | incluida |
| Marca de candidatos a poda (proyectos con 0 observaciones) y de nombres con ruta | incluida |
| Comandos CLI exactos listos para copiar (`prune`, `consolidate`) | incluida |
| Ejecutar `prune` desde la web | **fuera** (descartado a propósito) |
| Ejecutar `consolidate` desde la web o por MCP | **fuera** (descartado a propósito) |
| Marcar equivalencias de nombres en la interfaz | **fuera**: el store decide, la interfaz no inventa |

## Hechos verificados del runtime (fuente: engram v2.0.0 instalado)

1. **El API HTTP no sirve para gestionar proyectos.** Solo existen `GET /project/current`,
   `POST /projects/rescue-ownership` y `POST /projects/migrate`; no hay endpoints de listado, poda ni
   fusión.
2. **El API HTTP rechaza los nombres con ruta y omite los proyectos sin observaciones.**
   `GET /stats?project=c:/docker-curso` → `400 {"code":"invalid_project","error":"... project must
   be a name, not a path"}`; igual en `/observations`, `/sessions/recent` y `/prompts/recent`. En
   cambio, `GET /stats?all_projects=true` devuelve solo la lista de nombres, sin conteos, y **omite
   únicamente los proyectos sin observaciones**, no los que llevan ruta en el nombre: medido, esa
   consulta devuelve 18 de los 27 proyectos, exactamente los que tienen observaciones, y entre ellos
   está `c:/docker-curso` (2 observaciones), que aparece en la lista aunque después no se pueda
   consultar. Es decir: el selector no ve los podables y tampoco puede consultar ningún proyecto con
   ruta.
3. **La vía estructurada es MCP por stdio.** `engram mcp --tools=mem_list_projects` responde a
   `initialize` + `tools/call` con
   `{"projects":[{"name","observation_count","session_count","prompt_count","directories":[]}],"count":N}`,
   respaldado por la misma consulta que el CLI (`ListProjectsWithStats`), así que CLI y MCP no
   divergen. Medido: 27 proyectos, ciclo completo (initialize + llamada + salida) en **87 ms**, con
   `spawn('engram', ...)` resolviendo por PATH sin `shell: true`.
4. **`prune` borra de verdad y no tiene vuelta atrás.** Elimina los prompts del proyecto y las
   sesiones sin observaciones, y **se niega** si al proyecto le quedan observaciones
   (`... still has N observations — cannot prune`). El runtime no expone restauración.
5. **`consolidate` no puede hacer lo que parece.** Solo fusiona nombres equivalentes tras
   `CanonicalizeProjectName` (minúsculas y colapso de `--` / `__`); `MergeProjects` **falla a
   propósito** si el origen no normaliza al canónico: `source project "c:/docker-curso" must normalize
   to canonical project "docker-curso"`. Por eso `engram projects consolidate --all --dry-run` responde
   `No similar project name groups found` sobre este almacén, aunque existan `docker-curso`,
   `c:/docker-curso` y `c:\docker-curso` como proyectos distintos. La única vía para esos casos es
   mover las observaciones una a una (`PATCH /observations/{id}` con `project`, ya soportado por la
   interfaz) y después podar el nombre que queda vacío.
6. **Estado real del almacén medido**: 27 proyectos, 682 observaciones, **9 proyectos con 0
   observaciones** (5 de ellos con nombre de ruta) y ningún grupo de fusión detectable. `prune
   --dry-run` y el inventario nuevo deben coincidir en esos 9.

## Reglas de seguridad de la fase

1. **Solo lectura.** La ruta nueva ejecuta una única cosa, con argumentos fijos:
   `engram mcp --tools=mem_list_projects` + `tools/call mem_list_projects`. Ningún dato del cliente
   llega al proceso, ni como argumento, ni por stdin, ni por variables de entorno.
2. **El binario es configurable y explícito**: `ENGRAM_BIN` (por defecto `engram`). Si no se
   encuentra, la ruta responde un error legible, nunca un inventario vacío.
3. **Fallos explícitos, no silenciosos**: binario ausente, timeout, error de la herramienta o JSON
   inválido se traducen a un error con el motivo. Un inventario vacío solo puede significar almacén
   vacío.
4. **La interfaz no reimplementa la normalización del store.** No propone fusiones: muestra el
   comando y su `--dry-run` como autoridad, y explica la limitación medida en el hecho 5.
5. **La pantalla advierte antes de cualquier copia**: la poda borra sesiones y prompts sin deshacer;
   el texto lo dice junto al comando, no en una nota al pie.
6. La ruta nueva no se confunde con el proxy: vive en `/local/*`, distinto de `/api/*`, que sigue
   siendo un reenvío puro al runtime.

## Tareas

| # | Tarea | Estado |
| --- | --- | --- |
| 1 | Servidor: `server/projects.mjs` (ciclo MCP por stdio con timeout y errores) y `GET /local/projects` | hecho |
| 2 | Wiring de desarrollo: mismo handler en `vite.config.ts` (el servidor de producción no corre en `npm run dev`) | hecho |
| 3 | Cliente tipado: tipos del inventario y `getProjects()` en `src/api/client.ts` / `types.ts` | hecho |
| 4 | Check ejecutable sin red: parseo del ciclo MCP con fixture, regla de candidatos y comandos; `getProjects()` con `fetch` interceptado | hecho — 20/20 casos |
| 5 | Vista `/projects`: tabla con conteos y directorios, marca de podables y de nombres con ruta no consultables por HTTP, comandos con botón de copia | hecho |
| 6 | Documentación: entrada de menú, sección en `/help`, `README.md` y `CHANGELOG.md` | hecho |
| 7 | Verificación: typecheck, build, check sin red y verificación independiente contra el runtime real sin mutar el almacén | hecho — PASS en A–I, con un hallazgo corregido |

## Evidencia

- Los commits de esta fase se autorizan y registran por unidad de trabajo, según
  `CONTRATO_FLUJO_GIT_VERSIONADO.md`.

### Verificación independiente (tarea 7)

Ejecutada con `gentle-ai-verify` sobre el árbol de trabajo, de forma adversarial y sin escribir nada. Resultado:

- **A (wiring y ruta) PASS**: `/local/projects` se responde antes de la rama `/api` en producción (probado con una instancia temporal en el puerto 7451, ya detenida) y por el plugin de Vite en desarrollo (hook llamado a mano); 405 en `POST`; `cache-control: no-store`; un solo `createProjectsHandler`, reutilizado.
- **B (solo lectura) PASS**: el único `spawn` es `engram mcp --tools=mem_list_projects`; ningún dato de la petición llega al proceso; el hijo se mata en `finally` incluso en timeout y en salida temprana.
- **C (fallos) PASS**: binario ausente → `502` con el mensaje accionable; timeout → `504`; ninguno responde `200` ni un inventario vacío.
- **D, E y F PASS**: el endpoint devuelve los 27 proyectos y sus conteos, coincidentes con `engram projects list` (0 discrepancias), y 9 podables, coincidentes con `prune --dry-run`; incluye los nombres con ruta que el API HTTP no puede consultar. `sha256` de `/stats?all_projects=true` idéntico antes y después, `prune --dry-run` sigue en 9 y no quedó ningún `engram.exe` huérfano.
- **G (regresión) PASS**: `typecheck`, `build`, `check:projects`, `check:writes` y `smoke` en verde.
- **H e I**: un hallazgo corregido, más dos imprecisiones de redacción (ver abajo).

### Hallazgo de la verificación, y defecto encontrado por el usuario

1. **Afirmación falsa sobre el selector (corregida).** La ayuda, la vista y el `CHANGELOG` decían que `/stats?all_projects=true` omite los proyectos con nombre de ruta. Medido: omite **exactamente los proyectos sin observaciones** (18 de 27), y un nombre con ruta sí aparece si tiene observaciones (`c:/docker-curso`, 2), aunque después no se pueda consultar (`400 invalid_project`). Corregido en `HelpView.vue`, `ProjectsView.vue`, `src/api/projects.ts`, `CHANGELOG.md`, `README.md`, `server/projects.mjs` y este documento. También se corrigió el comentario que afirmaba que `sortProjects` reproduce el orden del CLI: el CLI no tiene desempate estable.
2. **Pantalla rota en el navegador (reportada por el usuario, corregida).** En `http://127.0.0.1:7438/projects` aparecía `TypeError: Cannot read properties of undefined (reading 'length')`. Causa raíz en tres capas: el proceso del servidor era anterior a la ruta, así que `/local/projects` caía en el fallback de SPA y devolvía `index.html` con `200 text/html`; `request()` conservaba ese texto como cuerpo válido; y la vista leía `inventory.value?.projects.length`, que sí explota si `projects` no existe. Arreglado en `getProjects()`, que ahora valida la forma y normaliza cada entrada (`directories: null` → `[]`, porque Go serializa una rebanada nula como `null`), y el error visible dice qué ruta falló y qué hacer. La vista no se tocó: la frontera es el cliente. Cuatro casos nuevos en `check-projects.ts`, con evidencia de fallo previo a la corrección (4 casos en rojo antes, 20/20 después).
3. **Servidor reiniciado.** El proceso de 7438 (PID 5892, `node server/server.mjs`) se detuvo y se relanzó con el mismo comando y los mismos valores por defecto, para que sirviera la ruta nueva. Verificado: `GET /local/projects` en 7438 devuelve `count: 27` y 9 podables, y el bundle servido es el del arreglo.

### Pendiente de comprobación visual del humano

- La tabla en `/projects` (marcas, plegado de directorios, ajuste del panel de comandos) y el flujo del botón de copia (`navigator.clipboard`), que no se pueden comprobar sin navegador en este entorno.
