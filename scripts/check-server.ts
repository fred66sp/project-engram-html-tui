// End-to-end check for server/server.mjs, the only production request path of the app: the
// /api/* rewrite, the SPA fallback and the /local/projects route.
//
// Nothing here touches a real service. Every socket is loopback and ephemeral: the upstream
// runtime is a fake HTTP server on port 0 that records what it receives, /local/projects is
// answered by an injected handler instead of the engram spawn, and the dist root is a
// temporary directory with a minimal index.html. Port 7437 and 7438 are never bound, no
// non-loopback host is reached, and `engram` is never executed.
//
// Usage: npm run check:server
// Node 24 strips the TypeScript types natively, so this needs no test framework.
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders, Server } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectsHandler } from '../server/projects.mjs'
import { createEngramWebServer } from '../server/server.mjs'

const HOST = '127.0.0.1'
/** The live runtime and the live production server. The check refuses to touch either. */
const REAL_PORTS = new Set([7437, 7438])

interface UpstreamRequest {
  method: string
  url: string
  headers: IncomingHttpHeaders
  body: string
}

/** Every request the fake upstream received, in order. Cleared before each case. */
const upstreamRequests: UpstreamRequest[] = []

/** Canned reply of the fake upstream for the case about to run. */
let upstreamReply = { status: 200, body: '{"ok":true}', contentType: 'application/json; charset=utf-8' }

// ---- Fixtures -------------------------------------------------------------------------

const SHELL =
  '<!doctype html>\n<html lang="es">\n<head><title>check-server</title></head>\n' +
  '<body><div id="app"></div><script type="module" src="/assets/check.js"></script></body>\n</html>\n'
const ASSET = 'export const check = true\n'
const ASSET_PATH = '/assets/check.js'
/** Content of a file that exists just outside the dist root, to prove containment. */
const CANARY = 'OUTSIDE-DIST-CANARY'

const root = await mkdtemp(join(tmpdir(), 'engram-web-check-'))
const dist = join(root, 'dist')
await mkdir(join(dist, 'assets'), { recursive: true })
await writeFile(join(dist, 'index.html'), SHELL)
await writeFile(join(dist, 'assets', 'check.js'), ASSET)
await writeFile(join(root, 'outside-canary.txt'), CANARY)

// ---- The fake upstream ----------------------------------------------------------------

const upstream = createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  upstreamRequests.push({
    method: req.method ?? '',
    url: req.url ?? '',
    headers: req.headers,
    body: Buffer.concat(chunks).toString('utf8'),
  })
  res.writeHead(upstreamReply.status, { 'content-type': upstreamReply.contentType })
  res.end(upstreamReply.body)
})

// ---- The injected projects handler ----------------------------------------------------

const realProjectsHandler = createProjectsHandler()
let projectsCalls = 0

/**
 * Replaces the engram spawn: GET answers a canned inventory, any other method is handed to
 * the real handler, whose 405 branch returns before it would spawn the binary.
 */
const projectsHandler = async (req: any, res: any): Promise<void> => {
  projectsCalls += 1
  if (req.method === 'GET') {
    const payload = JSON.stringify({ count: 0, projects: [], binary: 'stub' })
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
    })
    res.end(payload)
    return
  }
  await realProjectsHandler(req, res)
}

// ---- Harness --------------------------------------------------------------------------

function reset(status = 200, body = '{"ok":true}', contentType = 'application/json; charset=utf-8'): void {
  upstreamRequests.length = 0
  upstreamReply = { status, body, contentType }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, HOST, () => resolve())
  })
}

function portOf(server: Server): number {
  const address = server.address() as AddressInfo | null
  assert.ok(address && typeof address === 'object', 'the server reported no ephemeral port')
  return address.port
}

/**
 * Stops a server and drops its sockets. `close()` alone would wait for the keep-alive
 * connections the client left open, and the process would never exit.
 */
function close(server: Server): Promise<void> {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close(() => resolve())
    server.closeAllConnections()
  })
}

/** Binds an ephemeral port and releases it, so a later connection is refused. */
function closedPort(): Promise<number> {
  const probe = createServer()
  return new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, HOST, () => {
      const port = portOf(probe)
      probe.close(() => resolve(port))
    })
  })
}

async function call(port: number, path: string, init?: RequestInit): Promise<Response> {
  assert.ok(!REAL_PORTS.has(port), `refusing to call the real service on port ${port}`)
  return fetch(`http://${HOST}:${port}${path}`, init)
}

/** A raw POST, so the check can send the request framing `fetch` refuses to send. */
function rawPost(port: number, path: string, headers: Record<string, string>, body: string): Promise<number> {
  assert.ok(!REAL_PORTS.has(port), `refusing to call the real service on port ${port}`)
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: HOST, port, path, method: 'POST', headers, agent: false }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode ?? 0))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

let failures = 0

async function check(name: string, run: () => Promise<void> | void): Promise<void> {
  try {
    await run()
    console.log(`ok   ${name}`)
  } catch (cause) {
    failures += 1
    console.error(`FAIL ${name} — ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

// ---- Cases ----------------------------------------------------------------------------

try {
  await listen(upstream)
  const upstreamPort = portOf(upstream)
  const engramUrl = `http://${HOST}:${upstreamPort}`

  const app = createEngramWebServer({ dist, engramUrl, projectsHandler })
  await listen(app)
  const appPort = portOf(app)

  const deadPort = await closedPort()
  const offline = createEngramWebServer({ dist, engramUrl: `http://${HOST}:${deadPort}`, projectsHandler })
  await listen(offline)
  const offlinePort = portOf(offline)

  try {
    await check('every socket is loopback and ephemeral, never 7437 or 7438', () => {
      for (const [name, port] of [
        ['fake upstream', upstreamPort],
        ['app server', appPort],
        ['offline upstream', deadPort],
        ['offline app server', offlinePort],
      ] as const) {
        assert.ok(port > 0, `${name}: not a real port (${port})`)
        assert.ok(!REAL_PORTS.has(port), `${name} bound the real service port ${port}`)
      }
      assert.ok(engramUrl.startsWith(`http://${HOST}:`), `the fake upstream is not loopback: ${engramUrl}`)
    })

    await check('/api/health -> upstream status, body and content-type come back unchanged', async () => {
      reset(200, '{"status":"ok"}', 'application/json; charset=utf-8')
      const response = await call(appPort, '/api/health')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
      assert.equal(await response.text(), '{"status":"ok"}')
      assert.equal(upstreamRequests.length, 1, `expected 1 upstream request, got ${upstreamRequests.length}`)
      assert.equal(upstreamRequests[0]!.method, 'GET')
      assert.equal(upstreamRequests[0]!.url, '/health')
    })

    await check('/api/observations?project=x&limit=2 -> /observations?project=x&limit=2 upstream', async () => {
      reset()
      const response = await call(appPort, '/api/observations?project=x&limit=2')
      assert.equal(response.status, 200)
      assert.equal(upstreamRequests.length, 1)
      assert.equal(upstreamRequests[0]!.url, '/observations?project=x&limit=2', 'the rewrite added or dropped part of the query string')
    })

    await check('/api exactly (no trailing path) is proxied, not served as a file', async () => {
      reset()
      const response = await call(appPort, '/api')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
      assert.equal(await response.text(), '{"ok":true}', 'the SPA shell was served instead of proxying')
      assert.equal(upstreamRequests.length, 1)
      assert.equal(upstreamRequests[0]!.url, '/')
    })

    await check('POST via fetch forwards method and body, and not the client hop-by-hop values', async () => {
      reset()
      const body = '{"title":"check"}'
      const response = await call(appPort, '/api/observations?project=x&limit=2', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          connection: 'close',
          'accept-encoding': 'identity-check',
          'x-check': 'forwarded',
        },
        body,
      })
      assert.equal(response.status, 200)
      const received = upstreamRequests[0]!
      assert.equal(received.method, 'POST')
      assert.equal(received.url, '/observations?project=x&limit=2')
      assert.equal(received.body, body, 'the request body was not forwarded')
      assert.equal(received.headers['content-type'], 'application/json')
      assert.equal(received.headers['x-check'], 'forwarded', 'an ordinary header was dropped')
      assert.notEqual(
        received.headers['accept-encoding'],
        'identity-check',
        'the client accept-encoding was forwarded instead of the proxy one',
      )
      assert.notEqual(received.headers['connection'], 'close', 'the client connection header was forwarded')
      // host and content-length cannot be observed as "dropped": the proxy's own HTTP client
      // always writes them for the outgoing request, so what is checked is their value.
      assert.equal(received.headers['host'], `${HOST}:${upstreamPort}`)
      assert.equal(received.headers['content-length'], String(Buffer.byteLength(body)))
    })

    await check('a chunked POST is re-framed: transfer-encoding never reaches the upstream', async () => {
      reset()
      const body = '{"title":"check"}'
      const status = await rawPost(
        appPort,
        '/api/observations?project=x',
        {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          host: 'evil.example',
          connection: 'close',
          'accept-encoding': 'identity-check',
          'x-check': 'forwarded',
        },
        body,
      )
      assert.equal(status, 200)
      const received = upstreamRequests[0]!
      assert.equal(received.method, 'POST')
      assert.equal(received.url, '/observations?project=x')
      assert.equal(received.body, body, 'the chunked body was not forwarded')
      assert.equal(received.headers['x-check'], 'forwarded')
      assert.equal(received.headers['transfer-encoding'], undefined, 'the client transfer-encoding was forwarded')
      assert.equal(received.headers['content-length'], String(Buffer.byteLength(body)), 'the proxy did not re-frame the body')
      assert.notEqual(received.headers['accept-encoding'], 'identity-check')
      assert.notEqual(received.headers['connection'], 'close')
      assert.equal(received.headers['host'], `${HOST}:${upstreamPort}`)
    })

    await check('an upstream that is not listening -> 502 naming the upstream URL, never 200', async () => {
      const response = await call(offlinePort, '/api/health')
      assert.equal(response.status, 502)
      assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
      const payload = (await response.json()) as { error?: string }
      assert.ok(typeof payload.error === 'string', 'the 502 body carries no readable message')
      assert.match(payload.error, /unreachable/)
      assert.ok(payload.error.includes(`http://${HOST}:${deadPort}`), `the message does not name the upstream: ${payload.error}`)
    })

    await check('an upstream 404 or 500 passes through with the same status and body', async () => {
      reset(404, '{"error":"observation not found"}', 'application/json; charset=utf-8')
      const notFound = await call(appPort, '/api/observations/999999')
      assert.equal(notFound.status, 404)
      assert.equal(await notFound.text(), '{"error":"observation not found"}')

      reset(500, 'boom', 'text/plain; charset=utf-8')
      const serverError = await call(appPort, '/api/stats')
      assert.equal(serverError.status, 500)
      assert.equal(serverError.headers.get('content-type'), 'text/plain; charset=utf-8')
      assert.equal(await serverError.text(), 'boom')
      assert.equal(upstreamRequests[0]!.url, '/stats')
    })

    await check('/local/projects -> the injected handler answers and the runtime records zero requests', async () => {
      reset()
      projectsCalls = 0
      const response = await call(appPort, '/local/projects')
      assert.equal(response.status, 200)
      assert.equal(projectsCalls, 1, 'the injected projects handler was not called')
      assert.deepEqual(await response.json(), { count: 0, projects: [], binary: 'stub' })
      assert.equal(upstreamRequests.length, 0, 'the inventory was proxied to the runtime')
    })

    await check('non-GET /local/projects -> 405 from the real handler branch, no spawn, no upstream request', async () => {
      reset()
      projectsCalls = 0
      const response = await call(appPort, '/local/projects', { method: 'POST' })
      assert.equal(response.status, 405)
      assert.match(await response.text(), /not allowed on \/local\/projects/)
      assert.equal(projectsCalls, 1, 'the route did not reach the projects handler')
      assert.equal(upstreamRequests.length, 0, 'the route was proxied to the runtime')
    })

    await check('SPA fallback -> the shell for an unknown path, the asset keeps its own MIME', async () => {
      reset()
      const shell = await call(appPort, '/observations/1216')
      assert.equal(shell.status, 200)
      assert.equal(shell.headers.get('content-type'), 'text/html; charset=utf-8')
      assert.equal(await shell.text(), SHELL)

      const asset = await call(appPort, ASSET_PATH)
      assert.equal(asset.status, 200)
      assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8')
      assert.equal(await asset.text(), ASSET)
      assert.equal(upstreamRequests.length, 0, 'a static file reached the runtime')
    })

    await check('encoded traversal never returns anything outside the dist root', async () => {
      reset()
      // The same traversal attempt in three shapes, plus the normalized one below.
      // path.normalize clamps `..` at the root of an absolute path, so the percent-encoded
      // variants resolve back inside the dist root and fall through to the SPA fallback; the
      // encoded backslashes are a UNC-looking root and do escape the join, which is the case
      // the containment check has to stop. The target is a real file one level above the dist
      // root, so a leak is visible in the body.
      const attempts = [
        '/%2e%2e/%2e%2e/outside-canary.txt',
        '/%2e%2e/%2e%2e/%2e%2e/%2e%2e/package.json',
        '/%5c..%5coutside-canary.txt',
      ]
      for (const path of attempts) {
        const response = await call(appPort, path)
        assert.equal(response.status, 200)
        const body = await response.text()
        assert.ok(!body.includes(CANARY), `${path} returned a file outside the dist root`)
        assert.ok(!body.includes('"engram-web"'), `${path} returned the repository package.json`)
        assert.equal(body, SHELL, `${path} did not fall back to the SPA shell`)
      }

      // fetch (and every URL parser) resolves a plain `..` before it leaves the client, so
      // this variant arrives as `/package.json`: the unknown-path fallback, not the guard.
      const normalized = await call(appPort, '/observations/../package.json')
      assert.equal(normalized.status, 200)
      const body = await normalized.text()
      assert.ok(!body.includes('"engram-web"'), 'the normalized variant returned the repository package.json')
      assert.equal(body, SHELL)
      assert.equal(upstreamRequests.length, 0)
    })
  } finally {
    await close(app)
    await close(offline)
  }
} finally {
  await close(upstream)
  await rm(root, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`check:server: FAILED (${failures} case(s))`)
  process.exit(1)
}
console.log('check:server: ok')
