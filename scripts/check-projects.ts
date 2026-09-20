// Network-free check for the project inventory: server/projects.mjs, src/api/projects.ts and
// the getProjects() client function.
//
// This check opens no socket and spawns no process. The MCP cycle is exercised through the
// pure parse helpers against a captured stdout fixture, and `globalThis.fetch` is replaced by
// a recorder, so every client call is captured as { method, url, body } and answered with a
// canned Response. Nothing here touches the user's real memory store.
//
// Usage: npm run check:projects
// Node 24 strips the TypeScript types natively, so this needs no test framework.
import assert from 'node:assert/strict'
import { InventoryError, createProjectsHandler, extractProjects, parseStdout, selectResult } from '../server/projects.mjs'
import type { ProjectStats } from '../src/api/types.ts'

interface RecordedCall {
  method: string
  url: string
  body: string | null
}

/** Every intercepted call, in order. Cleared before each case. */
const calls: RecordedCall[] = []

/**
 * Canned reply for the case about to run. `raw` sends the text as-is (the stale server's
 * `index.html` fallback); otherwise the body is JSON-encoded.
 */
let reply: { body: unknown; status: number; raw?: string } = { body: {}, status: 200 }

/** The real fetch is kept only to prove the recorder replaced it. */
const realFetch = globalThis.fetch

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  calls.push({
    method: init?.method ?? 'GET',
    url,
    body: typeof init?.body === 'string' ? init.body : null,
  })
  const raw = reply.raw !== undefined
  return new Response(raw ? reply.raw : JSON.stringify(reply.body), {
    status: reply.status,
    headers: { 'Content-Type': raw ? 'text/html; charset=utf-8' : 'application/json' },
  })
}) as typeof fetch

const api = await import('../src/api/client.ts')
const projects = await import('../src/api/projects.ts')

function reset(next: { body: unknown; status: number; raw?: string } = { body: {}, status: 200 }): void {
  calls.length = 0
  reply = next
}

// ---- Fixtures -------------------------------------------------------------------------

/**
 * Captured `engram mcp --tools=mem_list_projects` stdout (engram v2.0.0), trimmed to three
 * projects. The inner text payload is the tool's own JSON: { count, projects: [...] }.
 * `c:\docker-curso` carries a backslash exactly as the real store reports it.
 */
const TOOL_PAYLOAD = {
  count: 3,
  projects: [
    {
      name: 'project-httpd-reports',
      observation_count: 331,
      session_count: 60,
      prompt_count: 823,
      directories: ['C:\\PROJECT-HTTPD-REPORTS', 'c:\\project-httpd-reports'],
    },
    { name: 'docker-curso', observation_count: 12, session_count: 4, prompt_count: 9, directories: [] },
    { name: 'c:/docker-curso', observation_count: 0, session_count: 3, prompt_count: 3, directories: [] },
  ],
}

const STDOUT = `${[
  JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: 'engram', version: '0.1.0' },
    },
  }),
  JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    result: { content: [{ type: 'text', text: JSON.stringify(TOOL_PAYLOAD) }] },
  }),
].join('\n')}\n`

/** Same envelope, but the tool reported a failure with its own text. */
function errorResult(message: string): unknown {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

function textResult(text: string): unknown {
  return { content: [{ type: 'text', text }] }
}

const ZERO_OBS: ProjectStats = {
  name: 'c:/docker-curso',
  observation_count: 0,
  session_count: 3,
  prompt_count: 3,
  directories: [],
}

const NON_ZERO: ProjectStats = {
  name: 'docker-curso',
  observation_count: 12,
  session_count: 4,
  prompt_count: 9,
  directories: [],
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

/** Asserts the throw is the handler's own error type, with the HTTP status it would answer. */
function inventoryFailure(run: () => unknown, pattern: RegExp, status = 502): void {
  let thrown: unknown
  try {
    run()
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown instanceof InventoryError, `expected an InventoryError, got ${String(thrown)}`)
  assert.equal(thrown.status, status, `expected status ${status}, got ${thrown.status}`)
  assert.match(thrown.message, pattern)
}

// ---- MCP stdout parsing ----------------------------------------------------------------

await check('captured stdout -> projects and count parsed', () => {
  const messages = parseStdout(STDOUT)
  assert.equal(messages.length, 2, 'expected the initialize and tools/call responses')
  const inventory = extractProjects(selectResult(messages, 2))
  assert.equal(inventory.count, 3)
  assert.equal(inventory.projects.length, 3)
  assert.deepEqual(inventory.projects[0], TOOL_PAYLOAD.projects[0])
})

await check('stdout without the tools/call response -> throws', () => {
  const onlyInitialize = STDOUT.split('\n')[0]!
  inventoryFailure(() => selectResult(parseStdout(onlyInitialize), 2), /did not answer/)
})

await check('empty output -> throws', () => {
  inventoryFailure(() => parseStdout(''), /no output/)
})

await check('result.isError -> InventoryError carrying the tool message', () => {
  inventoryFailure(
    () => extractProjects(errorResult('mem_list_projects: database is locked')),
    /mem_list_projects failed: mem_list_projects: database is locked/,
  )
})

await check('tool text that is not JSON -> throws', () => {
  inventoryFailure(() => extractProjects(textResult('permission denied')), /not JSON: permission denied/)
})

await check('payload without a projects array -> throws', () => {
  inventoryFailure(() => extractProjects(textResult('{"count":27}')), /without a "projects" array/)
})

await check('non-numeric count -> throws', () => {
  inventoryFailure(() => extractProjects(textResult('{"projects":[],"count":"many"}')), /non-numeric count/)
})

// ---- getProjects() --------------------------------------------------------------------

await check('getProjects() -> GET /local/projects, no body, outside /api', async () => {
  reset({ body: TOOL_PAYLOAD, status: 200 })
  const inventory = await api.getProjects()
  assert.notEqual(globalThis.fetch, realFetch, 'the fetch recorder was replaced by something else')
  assert.equal(calls.length, 1, `expected exactly 1 request, got ${calls.length}`)
  const call = calls[0]!
  assert.equal(call.method, 'GET')
  assert.equal(call.url, '/local/projects')
  assert.equal(call.body, null)
  assert.ok(!call.url.startsWith('/api'), `the inventory must not travel through the runtime proxy: ${call.url}`)
  assert.ok(!call.url.includes('7437'), `no request may target the live runtime: ${call.url}`)
  assert.equal(inventory.count, 3)
  assert.equal(inventory.projects.length, 3)
})

await check('getProjects() on 502 -> ApiError with the server message', async () => {
  const message = 'engram binary not found ("engram"). Install Engram or point ENGRAM_BIN at it.'
  reset({ body: { error: message }, status: 502 })
  await assert.rejects(
    () => api.getProjects(),
    (error: unknown) => {
      assert.ok(error instanceof api.ApiError, `expected an ApiError, got ${String(error)}`)
      assert.equal(error.status, 502)
      assert.equal(error.message, message)
      return true
    },
  )
})

/**
 * The reported crash: the server process predates `/local/projects`, so the unknown path falls
 * through to the SPA fallback and answers `index.html` with 200 + text/html. Before the fix
 * `request()` returned that HTML string as the inventory and the view threw a TypeError on
 * `inventory.value?.projects.length`.
 */
await check('getProjects() on a 200 HTML body (stale SPA fallback) -> ApiError, never a TypeError', async () => {
  reset({ body: '', status: 200, raw: '<!doctype html><html><body><div id="app"></div></body></html>' })
  await assert.rejects(
    () => api.getProjects(),
    (error: unknown) => {
      assert.ok(error instanceof api.ApiError, `expected an ApiError, got ${String(error)}`)
      assert.ok(!(error instanceof TypeError), 'the view TypeError must not reach the caller')
      assert.match(error.message, /\/local\/projects/, 'the message must name the route')
      assert.match(error.message, /npm start/, 'the message must name the restart action')
      assert.match(error.message, /npm run dev/, 'the message must name the dev reload path')
      return true
    },
  )
})

await check('getProjects() on a 200 body without a projects array -> ApiError', async () => {
  reset({ body: { count: 27 }, status: 200 })
  await assert.rejects(
    () => api.getProjects(),
    (error: unknown) => {
      assert.ok(error instanceof api.ApiError, `expected an ApiError, got ${String(error)}`)
      assert.match(error.message, /\/local\/projects/)
      return true
    },
  )
})

await check('getProjects() -> null or missing directories normalized to []', async () => {
  reset({
    body: {
      count: 2,
      projects: [
        { name: 'solo-observaciones', observation_count: 4, session_count: 0, prompt_count: 0, directories: null },
        { name: 'sin-directorios', observation_count: 1, session_count: 1, prompt_count: 2 },
      ],
    },
    status: 200,
  })
  const inventory = await api.getProjects()
  assert.deepEqual(
    inventory.projects.map((project) => project.directories),
    [[], []],
    'a nil Go slice marshals as null and must arrive as an array',
  )
})

await check('getProjects() -> non-numeric count falls back to projects.length', async () => {
  reset({
    body: {
      count: 'muchos',
      projects: [
        { name: 'a', observation_count: 1, session_count: 0, prompt_count: 0, directories: [] },
        { name: 'b', observation_count: 2, session_count: 0, prompt_count: 0, directories: [] },
      ],
    },
    status: 200,
  })
  const inventory = await api.getProjects()
  assert.equal(inventory.count, 2)
})

await check('getProjects() -> a string binary is passed through', async () => {
  reset({ body: { count: 0, projects: [], binary: 'engram' }, status: 200 })
  const inventory = await api.getProjects()
  assert.equal(inventory.binary, 'engram')
})

// ---- Pure inventory helpers -----------------------------------------------------------

await check('isPruneCandidate -> zero observations yes, non-zero no', () => {
  assert.equal(projects.isPruneCandidate(ZERO_OBS), true)
  assert.equal(projects.isPruneCandidate(NON_ZERO), false)
})

await check('isPathNamed -> both path spellings yes, a plain name no', () => {
  assert.equal(projects.isPathNamed('c:/docker-curso'), true)
  assert.equal(projects.isPathNamed('c:\\docker-curso'), true)
  assert.equal(projects.isPathNamed('docker-curso'), false)
})

await check('sortProjects -> observations desc, then name asc, input untouched', () => {
  const input: ProjectStats[] = [
    { ...NON_ZERO, name: 'b-proyecto', observation_count: 5 },
    { ...ZERO_OBS, name: 'a-proyecto', observation_count: 0 },
    { ...NON_ZERO, name: 'a-proyecto', observation_count: 5 },
    { ...NON_ZERO, name: 'grande', observation_count: 331 },
  ]
  const ordered = projects.sortProjects(input)
  assert.deepEqual(
    ordered.map((project) => project.name),
    ['grande', 'a-proyecto', 'b-proyecto', 'a-proyecto'],
  )
  assert.equal(input[0]!.name, 'b-proyecto', 'sortProjects mutated its input')
})

await check('summarizeProjects -> totals plus prune candidates', () => {
  const summary = projects.summarizeProjects(TOOL_PAYLOAD.projects as ProjectStats[])
  assert.deepEqual(summary, {
    projects: 3,
    observations: 343,
    sessions: 67,
    prompts: 835,
    pruneCandidates: 1,
  })
})

await check('PROJECT_COMMANDS -> the five exact CLI commands', () => {
  assert.deepEqual(Object.values(projects.PROJECT_COMMANDS), [
    'engram projects list',
    'engram projects prune --dry-run',
    'engram projects prune',
    'engram projects consolidate --all --dry-run',
    'engram projects consolidate --all',
  ])
})

// ---- Handler contract that spawns nothing ---------------------------------------------

await check('createProjectsHandler -> non-GET answers 405 without spawning', async () => {
  const handler = createProjectsHandler()
  let status = 0
  let body = ''
  const res = {
    writeHead(next: number) {
      status = next
    },
    end(chunk: string) {
      body = chunk
    },
  }
  await handler({ method: 'POST' }, res as unknown as never)
  assert.equal(status, 405)
  assert.match(body, /not allowed on \/local\/projects/)
})

if (failures > 0) {
  console.error(`check:projects: FAILED (${failures} case(s))`)
  process.exit(1)
}
console.log('check:projects: ok')
