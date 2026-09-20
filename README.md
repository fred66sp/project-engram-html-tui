# Engram Web

UI web sobre el runtime local de memoria Engram (`engram serve`, API JSON en
`http://127.0.0.1:7437`). Permite consultar, buscar y leer memorias, y además
operaciones de escritura controladas: fijar o quitar el pin, editar campos,
borrar de forma suave con confirmación por identificador y descargar un export.
Incluye además la pantalla de Proyectos (`/projects`): el inventario del almacén con
sus conteos y directorios, la marca de los proyectos podables y de los nombres con
ruta, y los comandos de poda y consolidación listos para copiar. Esa pantalla solo
lee: no ejecuta ninguna orden.

## Requisitos

- Node.js 20 o superior.
- El runtime local de Engram en ejecución y escuchando en el puerto 7437
  (`engram serve`). Se puede verificar con `curl http://127.0.0.1:7437/health`.

## Desarrollo

```bash
npm install
npm run dev
```

Vite sirve la SPA en `http://127.0.0.1:5173` y reescribe `/api/*` hacia el
runtime local.

## Producción

```bash
npm run build
npm start
```

`npm run build` genera `dist/` y `npm start` levanta el servidor de producción
en `http://127.0.0.1:7438`. Ese servidor sirve los archivos estáticos con
fallback de SPA y actúa como proxy de `/api/*` hacia el runtime.

## Comprobaciones

```bash
npm run typecheck      # vue-tsc, sin emitir
npm run smoke          # lectura contra el runtime vivo
npm run check:writes   # mutaciones sin red: método, ruta y cuerpo
npm run check:projects # inventario de proyectos sin red ni procesos
npm run check:server   # servidor de producción sin red externa ni procesos
npm run build          # typecheck + build de producción
```

`smoke` necesita el runtime escuchando en 7437 y no modifica nada. `check:writes`
intercepta `fetch`, así que verifica el camino de escritura sin tocar la memoria
real. `check:projects` no necesita el runtime y no lanza ningún proceso: parsea un
ciclo MCP capturado e intercepta `fetch` para revisar la llamada del cliente.
`check:server` levanta el servidor de producción en un puerto efímero con un
runtime de mentira local y un directorio de artefactos temporal, así que comprueba
el proxy `/api/*`, el fallback de la SPA y `/local/projects` sin abrir el 7437 ni
el 7438 y sin lanzar nunca el binario `engram`.

## Variables de entorno

| Variable               | Por defecto               | Descripción                                                            |
| ---------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `PORT`                 | `7438`                    | Puerto del servidor de producción.                                     |
| `ENGRAM_URL`           | `http://127.0.0.1:7437`   | URL base del runtime de Engram.                                        |
| `ENGRAM_HTTP_TOKEN`    | vacío                     | Token Bearer que se agrega a las peticiones a rutas protegidas.        |
| `ENGRAM_BIN`           | `engram`                  | Binario de Engram que usa `/local/projects`; se resuelve por `PATH`.   |
| `ENGRAM_MCP_TIMEOUT_MS` | `10000`                   | Tiempo máximo del ciclo MCP de `/local/projects`.                      |

## Nota sobre CORS

La SPA nunca llama al runtime en otro origen. El API local de Engram no envía
cabeceras CORS y responde 405 a las peticiones `OPTIONS`, por lo que el
navegador no puede invocarlo de forma directa entre orígenes. Todas las
llamadas salen hacia `/api/*` en el mismo origen y las reescribe el servidor
propio (Vite en desarrollo, `server/server.mjs` en producción).

La excepción es `/local/projects`, el inventario de la pantalla de Proyectos: no es
una reescritura sino una ruta que responde el propio servidor en su mismo proceso
(`server/projects.mjs`, también montado en Vite durante el desarrollo), con un único
ciclo `engram mcp --tools=mem_list_projects` por stdio. El runtime no tiene ningún
endpoint de listado de proyectos, `/stats?all_projects=true` solo devuelve nombres sin
conteos y omite los proyectos sin observaciones, y toda consulta que tome un proyecto
con ruta en el nombre responde `400 invalid_project`. Esos datos, por tanto, no se
pueden pedir al API HTTP.

## Ayuda dentro de la aplicación

La ruta `/help` abre la página de ayuda: qué es la aplicación, cómo se conecta
al runtime, cómo arrancarla y qué comprueba cada script, qué hace cada pantalla
(incluida la de Proyectos y de dónde salen sus datos), el vocabulario de proyectos,
scopes y filtros, qué hace exactamente cada acción de escritura, las limitaciones
conocidas del API local y los avisos de lectura.
