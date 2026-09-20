// Network-free check for the write paths of src/api/client.ts.
//
// The write functions (pin, PATCH, soft delete) must never be exercised against the live
// runtime: that runtime holds the user's real memory and a soft delete is irreversible there.
// This check replaces `globalThis.fetch` with a recorder, so every call is captured as
// { method, url, headers, body } and answered with a canned Response. No socket is opened.
//
// Usage: npm run check:writes
// Node 24 strips the TypeScript types natively, so this needs no test framework.
import assert from 'node:assert/strict'
import type { RelationVerb } from '../src/api/types.ts'

interface RecordedCall {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}

/** Every intercepted call, in order. Cleared before each case. */
const calls: RecordedCall[] = []

/** Canned reply for the case about to run. */
let reply: unknown = {}

/** The real fetch is kept only to prove the recorder replaced it. */
const realFetch = globalThis.fetch

function cannedResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
    headers[key.toLowerCase()] = value
  }
  calls.push({
    method: init?.method ?? 'GET',
    url,
    headers,
    body: typeof init?.body === 'string' ? init.body : null,
  })
  return cannedResponse(reply)
}) as typeof fetch

const api = await import('../src/api/client.ts')

function reset(nextReply: unknown): void {
  calls.length = 0
  reply = nextReply
}

/** A relative URL can never open a socket: it is the guarantee that nothing hit the runtime. */
function onlyCall(): RecordedCall {
  assert.notEqual(globalThis.fetch, realFetch, 'the fetch recorder was replaced by something else')
  assert.equal(calls.length, 1, `expected exactly 1 request, got ${calls.length}`)
  const call = calls[0]!
  assert.ok(call.url.startsWith('/api/'), `expected a relative /api URL, got ${call.url}`)
  assert.ok(!call.url.includes('7437'), `no request may target the live runtime: ${call.url}`)
  return call
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

const OBSERVATION = {
  id: 7,
  sync_id: 'obs-7',
  session_id: 'sess-1',
  type: 'decision',
  title: 'x',
  content: 'contenido',
  project: 'task-prueba',
  scope: 'project',
  topic_key: 'tema',
  revision_count: 1,
  duplicate_count: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  pinned: false,
}

await check('setObservationPin(7, true) -> PUT /api/observations/7/pin', async () => {
  reset({ id: 7, pinned: true })
  const result = await api.setObservationPin(7, true)
  const call = onlyCall()
  assert.equal(call.method, 'PUT')
  assert.equal(call.url, '/api/observations/7/pin')
  assert.equal(call.body, null)
  assert.deepEqual(result, { id: 7, pinned: true })
})

await check('setObservationPin(7, false) -> DELETE /api/observations/7/pin', async () => {
  reset({ id: 7, pinned: false })
  const result = await api.setObservationPin(7, false)
  const call = onlyCall()
  assert.equal(call.method, 'DELETE')
  assert.equal(call.url, '/api/observations/7/pin')
  assert.equal(call.body, null)
  assert.deepEqual(result, { id: 7, pinned: false })
})

await check("updateObservation(7, {title}) -> PATCH with exactly that field", async () => {
  reset(OBSERVATION)
  await api.updateObservation(7, { title: 'x' })
  const call = onlyCall()
  assert.equal(call.method, 'PATCH')
  assert.equal(call.url, '/api/observations/7')
  assert.equal(call.body, '{"title":"x"}')
  assert.match(call.headers['content-type'] ?? '', /^application\/json/)
  assert.match(call.headers.accept ?? '', /^application\/json/)
})

await check('updateObservation(7, {title, scope}) -> only the two defined keys', async () => {
  reset(OBSERVATION)
  await api.updateObservation(7, { title: 'x', scope: 'global' })
  const call = onlyCall()
  assert.equal(call.method, 'PATCH')
  assert.equal(call.url, '/api/observations/7')
  assert.ok(call.body, 'expected a request body')
  assert.ok(!call.body!.includes('undefined'), `the body carried undefined: ${call.body}`)
  assert.deepEqual(Object.keys(JSON.parse(call.body!)).sort(), ['scope', 'title'])
  assert.deepEqual(JSON.parse(call.body!), { title: 'x', scope: 'global' })
})

await check('updateObservation(7, {}) -> rejected, no request issued', async () => {
  reset(OBSERVATION)
  await assert.rejects(() => api.updateObservation(7, {}), /at least one field/)
  assert.equal(calls.length, 0, `an empty patch reached the network: ${JSON.stringify(calls)}`)
})

await check('deleteObservation(7) -> DELETE /api/observations/7, no query string', async () => {
  reset({ id: 7, status: 'deleted' })
  const result = await api.deleteObservation(7)
  const call = onlyCall()
  assert.equal(call.method, 'DELETE')
  assert.equal(call.url, '/api/observations/7')
  assert.ok(!call.url.includes('?'), `the delete carried a query string: ${call.url}`)
  assert.ok(!call.url.toLowerCase().includes('hard'), `the delete expressed hard=true: ${call.url}`)
  assert.deepEqual(result, { id: 7, status: 'deleted' })
})

await check('getExport({allProjects}) -> GET /api/export?all_projects=true', async () => {
  reset({ version: '1', exported_at: '2026-01-01T00:00:00Z', sessions: null, observations: [], prompts: null })
  await api.getExport({ allProjects: true })
  const call = onlyCall()
  assert.equal(call.method, 'GET')
  assert.equal(call.url, '/api/export?all_projects=true')
})

await check('getExport({project}) -> GET /api/export?project=task-prueba', async () => {
  reset({ version: '1', exported_at: '2026-01-01T00:00:00Z', sessions: null, observations: [], prompts: null })
  await api.getExport({ project: 'task-prueba' })
  const call = onlyCall()
  assert.equal(call.method, 'GET')
  assert.equal(call.url, '/api/export?project=task-prueba')
  assert.ok(!call.url.includes('all_projects'), 'project and all_projects must not travel together')
})

// ---- Phase 3: mark reviewed, create memory, judge relations ----

await check('manualSessionId("task-prueba") -> manual-save-task-prueba, no request', () => {
  reset({})
  assert.equal(api.manualSessionId('task-prueba'), 'manual-save-task-prueba')
  assert.equal(calls.length, 0, `a pure helper reached the network: ${JSON.stringify(calls)}`)
})

await check('markReviewed(7, {allProjects}) -> POST /api/review/mark_reviewed?all_projects=true', async () => {
  reset({ id: 7, sync_id: 'obs-7', title: 'x', type: 'decision', state: 'active' })
  const result = await api.markReviewed(7, { allProjects: true })
  const call = onlyCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.url, '/api/review/mark_reviewed?all_projects=true')
  assert.equal(call.body, '{"observation_id":7}')
  assert.match(call.headers['content-type'] ?? '', /^application\/json/)
  assert.equal(result.id, 7)
})

await check("markReviewed(7, {project}) -> the project query parameter, no all_projects", async () => {
  reset({ id: 7, sync_id: 'obs-7', title: 'x', type: 'decision', state: 'active' })
  await api.markReviewed(7, { project: 'task-prueba' })
  const call = onlyCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.url, '/api/review/mark_reviewed?project=task-prueba')
  assert.ok(!call.url.includes('all_projects'), 'project and all_projects must not travel together')
  assert.equal(call.body, '{"observation_id":7}')
})

await check('createSession(input) -> POST /api/sessions with ownership_mode project_owned', async () => {
  reset({ id: 'manual-save-task-prueba', status: 'created' })
  const result = await api.createSession({
    id: 'manual-save-task-prueba',
    project: 'task-prueba',
    directory: 'C:/tmp/task-prueba',
  })
  const call = onlyCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.url, '/api/sessions')
  assert.match(call.headers['content-type'] ?? '', /^application\/json/)
  assert.deepEqual(JSON.parse(call.body!), {
    id: 'manual-save-task-prueba',
    project: 'task-prueba',
    directory: 'C:/tmp/task-prueba',
    ownership_mode: 'project_owned',
  })
  assert.deepEqual(result, { id: 'manual-save-task-prueba', status: 'created' })
})

await check('createObservation(input) -> POST /api/observations with exactly those keys', async () => {
  reset({ id: 12, status: 'saved' })
  const result = await api.createObservation({
    sessionId: 'manual-save-task-prueba',
    type: 'decision',
    title: 'x',
    content: 'contenido',
    project: 'task-prueba',
    scope: 'project',
    topicKey: 'tema',
  })
  const call = onlyCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.url, '/api/observations')
  assert.match(call.headers['content-type'] ?? '', /^application\/json/)
  assert.deepEqual(JSON.parse(call.body!), {
    session_id: 'manual-save-task-prueba',
    type: 'decision',
    title: 'x',
    content: 'contenido',
    project: 'task-prueba',
    scope: 'project',
    topic_key: 'tema',
  })
  assert.deepEqual(result, { id: 12, status: 'saved' })
})

await check('createObservation without scope/topic_key -> those keys are omitted, not empty', async () => {
  reset({ id: 13, status: 'saved' })
  await api.createObservation({
    sessionId: 'manual-save-task-prueba',
    type: 'manual',
    title: 'x',
    content: 'contenido',
    project: 'task-prueba',
    scope: '',
    topicKey: '',
  })
  const call = onlyCall()
  const body = JSON.parse(call.body!) as Record<string, unknown>
  assert.deepEqual(Object.keys(body).sort(), ['content', 'project', 'session_id', 'title', 'type'])
  assert.ok(!('scope' in body), `scope travelled as an empty value: ${call.body}`)
  assert.ok(!('topic_key' in body), `topic_key travelled as an empty value: ${call.body}`)
})

await check('judgeRelation(valid) -> POST /api/conflicts/judge with the minimal body', async () => {
  reset({ relation: { id: 1, sync_id: 'rel-1', relation: 'related', judgment_status: 'judged' } })
  const result = await api.judgeRelation({ judgmentId: 'rel-1', relation: 'related' })
  const call = onlyCall()
  assert.equal(call.method, 'POST')
  assert.equal(call.url, '/api/conflicts/judge')
  assert.match(call.headers['content-type'] ?? '', /^application\/json/)
  assert.deepEqual(JSON.parse(call.body!), { judgment_id: 'rel-1', relation: 'related' })
  assert.equal(result.relation.sync_id, 'rel-1')
})

await check('judgeRelation with reason/evidence/confidence -> optional fields included', async () => {
  reset({ relation: { id: 1, sync_id: 'rel-1', relation: 'conflicts_with', judgment_status: 'judged' } })
  await api.judgeRelation({
    judgmentId: 'rel-1',
    relation: 'conflicts_with',
    reason: 'motivo',
    evidence: 'evidencia',
    confidence: 0.4,
  })
  const call = onlyCall()
  assert.deepEqual(JSON.parse(call.body!), {
    judgment_id: 'rel-1',
    relation: 'conflicts_with',
    reason: 'motivo',
    evidence: 'evidencia',
    confidence: 0.4,
  })
})

await check('judgeRelation(invalid verb) -> rejected before sending, zero requests', async () => {
  reset({})
  await assert.rejects(
    () => api.judgeRelation({ judgmentId: 'rel-1', relation: 'superseded' as RelationVerb }),
    /invalid relation verb/,
  )
  assert.equal(calls.length, 0, `an invalid verb reached the network: ${JSON.stringify(calls)}`)
})

await check('judgeRelation(confidence 1.5) -> rejected before sending, zero requests', async () => {
  reset({})
  await assert.rejects(
    () => api.judgeRelation({ judgmentId: 'rel-1', relation: 'related', confidence: 1.5 }),
    /confidence must be a number between 0\.0 and 1\.0/,
  )
  assert.equal(calls.length, 0, `an out-of-range confidence reached the network: ${JSON.stringify(calls)}`)
})

// ---- Phase 5 (hardening): the shared project/all_projects invariant ----

await check('projectFilter("task-prueba") -> {project} only, no allProjects', () => {
  reset({})
  assert.deepEqual(api.projectFilter('task-prueba'), { project: 'task-prueba' })
  assert.equal(calls.length, 0, `a pure helper reached the network: ${JSON.stringify(calls)}`)
})

await check('projectFilter("") -> {allProjects: true} only, no project', () => {
  reset({})
  assert.deepEqual(api.projectFilter(''), { allProjects: true })
  assert.equal(calls.length, 0, `a pure helper reached the network: ${JSON.stringify(calls)}`)
})

await check('projectFilter never sets project and allProjects together', () => {
  reset({})
  for (const project of ['task-prueba', '', 'otro-proyecto']) {
    const options = api.projectFilter(project)
    assert.ok(
      !('project' in options && 'allProjects' in options),
      `both keys travelled for ${JSON.stringify(project)}: ${JSON.stringify(options)}`,
    )
  }
})

if (failures > 0) {
  console.error(`check:writes: FAILED (${failures} case(s))`)
  process.exit(1)
}
console.log('check:writes: ok')
