# Engram Web

UI web sobre el runtime local de memoria Engram (`engram serve`, API JSON en
`http://127.0.0.1:7437`). Permite consultar, buscar y leer memorias, y además
operaciones de escritura controladas: fijar o quitar el pin, editar campos,
borrar de forma suave con confirmación por identificador y descargar un export.

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
npm run typecheck     # vue-tsc, sin emitir
npm run smoke         # lectura contra el runtime vivo
npm run check:writes  # mutaciones sin red: método, ruta y cuerpo
npm run build         # typecheck + build de producción
```

`smoke` necesita el runtime escuchando en 7437 y no modifica nada. `check:writes`
intercepta `fetch`, así que verifica el camino de escritura sin tocar la memoria
real.

## Variables de entorno

| Variable             | Por defecto               | Descripción                                                            |
| -------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `PORT`               | `7438`                    | Puerto del servidor de producción.                                     |
| `ENGRAM_URL`         | `http://127.0.0.1:7437`   | URL base del runtime de Engram.                                        |
| `ENGRAM_HTTP_TOKEN`  | vacío                     | Token Bearer que se agrega a las peticiones a rutas protegidas.        |

## Nota sobre CORS

La SPA nunca llama al runtime en otro origen. El API local de Engram no envía
cabeceras CORS y responde 405 a las peticiones `OPTIONS`, por lo que el
navegador no puede invocarlo de forma directa entre orígenes. Todas las
llamadas salen hacia `/api/*` en el mismo origen y las reescribe el servidor
propio (Vite en desarrollo, `server/server.mjs` en producción).
