// Production server for engram-web: serves the built SPA, answers /local/projects from the
// engram binary and proxies /api/* to the Engram local runtime. Same-origin by design: the
// local API emits no CORS headers and answers 405 to OPTIONS, so the browser can never call
// it cross-origin.
//
// Routes: /local/projects -> project inventory over MCP stdio (server/projects.mjs);
//         /api/*           -> pure rewrite to the runtime; anything else -> SPA files.
//
// Usage: node server/server.mjs   (after `npm run build`)
// Env:   PORT (default 7438), ENGRAM_URL (default http://127.0.0.1:7437),
//        ENGRAM_HTTP_TOKEN (optional Bearer token for protected routes),
//        ENGRAM_BIN (default engram), ENGRAM_MCP_TIMEOUT_MS (default 10000)
import { createServer } from 'node:http'
import { createProjectsHandler } from './projects.mjs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const PORT = Number(process.env.PORT ?? 7438)
const ENGRAM_URL = process.env.ENGRAM_URL ?? 'http://127.0.0.1:7437'
const TOKEN = process.env.ENGRAM_HTTP_TOKEN ?? ''

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

const HOP_BY_HOP = new Set(['host', 'connection', 'content-length', 'accept-encoding', 'transfer-encoding'])

function fail(res, status, message) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: message }))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return chunks.length ? Buffer.concat(chunks) : undefined
}

async function proxy(req, res, url, { engramUrl, token }) {
  const upstream = new URL(engramUrl)
  const target = new URL(url.pathname.replace(/^\/api/, '') + url.search, upstream)

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase()) || value === undefined) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }
  if (token && !headers.authorization) headers.authorization = `Bearer ${token}`

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)

  let response
  try {
    response = await fetch(target, { method: req.method, headers, body, redirect: 'manual' })
  } catch (error) {
    fail(res, 502, `engram runtime unreachable at ${engramUrl}: ${error.message}`)
    return
  }

  const out = { 'cache-control': 'no-store' }
  const contentType = response.headers.get('content-type')
  if (contentType) out['content-type'] = contentType
  res.writeHead(response.status, out)
  res.end(Buffer.from(await response.arrayBuffer()))
}

async function serveStatic(res, pathname, dist) {
  // A malformed percent-escape (`/%zz`) is not a file path, so it takes the SPA fallback below
  // like any other unknown route. Decoding it here keeps the failure from reaching the outer
  // handler, which would answer 500 for a request that is merely an unknown path.
  let decoded = ''
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // Malformed escape: `decoded` keeps its empty value, so the request reads as an unknown
    // path and the SPA fallback below answers instead of the outer handler's 500.
  }
  const relative = normalize(decoded).replace(/^([/\\])+/, '')
  let file = join(dist, relative)
  if (!file.startsWith(dist)) file = join(dist, 'index.html')

  try {
    const info = await stat(file)
    if (info.isDirectory()) file = join(file, 'index.html')
  } catch {
    // SPA fallback: unknown paths are client-side routes.
    file = join(dist, 'index.html')
  }

  try {
    const content = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(content)
  } catch {
    fail(res, 404, `not found: ${pathname}. Run "npm run build" first.`)
  }
}

/**
 * Builds the handler without listening, so a check can start it on an ephemeral port against
 * a fake upstream. Every default is the value the program has always used, so the caller
 * overrides only what it needs.
 *
 * @param {{ dist?: string, engramUrl?: string, token?: string, projectsHandler?: Function }} [options]
 */
export function createEngramWebServer({
  dist = DIST,
  engramUrl = ENGRAM_URL,
  token = TOKEN,
  projectsHandler = createProjectsHandler(),
} = {}) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
    try {
      if (url.pathname === '/local/projects') await projectsHandler(req, res)
      else if (url.pathname === '/api' || url.pathname.startsWith('/api/')) await proxy(req, res, url, { engramUrl, token })
      else await serveStatic(res, url.pathname, dist)
    } catch (error) {
      fail(res, 500, error.message)
    }
  })
}

// Entry point: importing this module must never bind a port.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createEngramWebServer().listen(PORT, '127.0.0.1', () => {
    console.log(`engram-web on http://127.0.0.1:${PORT}  (api -> ${ENGRAM_URL})`)
  })
}
