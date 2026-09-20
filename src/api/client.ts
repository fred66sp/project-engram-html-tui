// Typed client for the local Engram runtime HTTP API (engram serve, v2.0.0).
// Reads are read-only in spirit; the write helpers below are limited to the safe subset:
// pin/unpin, field PATCH, soft delete (no `hard`), export download, mark reviewed, create
// memory (session + observation) and conflict judgment. No hard delete and no import.
//
// The SPA always calls `/api/*`; Vite (dev) and server/server.mjs (prod) rewrite it to the
// runtime origin, so the browser stays same-origin (the runtime sends no CORS headers).
// The runnable smoke check overrides the base for direct calls: see scripts/smoke-api.ts.
//
// The project inventory is the one exception: `getProjects()` targets `/local/projects`,
// answered in-process by the dev plugin or the production server, never proxied to the
// runtime (which has no project-listing endpoint and rejects path-like project names).
import type {
  ConflictList,
  ConflictStats,
  CreateObservationInput,
  CreateObservationResult,
  CreateSessionInput,
  CreateSessionResult,
  CurrentProject,
  DeleteResult,
  DoctorReport,
  ExportData,
  Health,
  JudgeRelationInput,
  JudgeRelationResult,
  MarkReviewedResult,
  Observation,
  ObservationPatch,
  PinResult,
  ProjectInventory,
  ProjectReadOptions,
  ProjectStats,
  Prompt,
  RelationVerb,
  ReviewList,
  Scope,
  SearchResult,
  Session,
  SessionSummary,
  Stats,
  Timeline,
} from './types'

const BASE = (globalThis as { __ENGRAM_API_BASE__?: string }).__ENGRAM_API_BASE__ ?? '/api'

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type QueryValue = string | number | boolean | null | undefined
type Params = Record<string, QueryValue>

/** Pulls the runtime error envelope ({ "error": "..." }) into a readable message. */
function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const envelope = (body as { error?: unknown }).error
    if (typeof envelope === 'string' && envelope) return envelope
  }
  if (typeof body === 'string' && body) return body
  return `HTTP ${status}`
}

function toQuery(params?: Params): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    // Empty values are omitted so the runtime applies its own defaults.
    if (value === undefined || value === null || value === '') continue
    search.set(key, typeof value === 'string' ? value : String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * Enforces the project-selection invariant: the runtime resolves the current project from
 * the server process cwd, so `project` and `all_projects=true` must never travel together.
 * An explicit request wins on `allProjects`; the `project` filter is then dropped.
 */
function projectParams(options?: ProjectReadOptions): Params {
  if (!options) return {}
  if (options.allProjects) return { all_projects: true }
  return { project: options.project }
}

/**
 * The single site of the project-selection invariant for the views: the runtime resolves the
 * current project from the server process cwd, so `project` and `all_projects=true` must never
 * travel together. An empty `project` means "all projects"; only one of the two keys is ever
 * set, and `projectParams` above keeps enforcing the same rule for callers that pass options
 * directly.
 */
export function projectFilter(project: string): ProjectReadOptions {
  return project ? { project } : { allProjects: true }
}

async function request<T>(path: string, params?: Params, init?: RequestInit, base = BASE): Promise<T> {
  const url = `${base}${path}${toQuery(params)}`

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    })
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new ApiError(0, `network request to ${url} failed: ${detail}`)
  }

  const text = await response.text()
  let body: unknown
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) throw new ApiError(response.status, errorMessage(body, response.status), body)

  // An empty body is valid for read endpoints (e.g. 204-style responses).
  return body as T
}

export function getHealth(): Promise<Health> {
  return request<Health>('/health')
}

export function getCurrentProject(): Promise<CurrentProject> {
  return request<CurrentProject>('/project/current')
}

export function getStats(options?: ProjectReadOptions): Promise<Stats> {
  return request<Stats>('/stats', projectParams(options))
}

export function getRecentObservations(
  options?: ProjectReadOptions & { scope?: Scope | ''; limit?: number },
): Promise<Observation[]> {
  return request<Observation[]>('/observations/recent', {
    ...projectParams(options),
    scope: options?.scope,
    limit: options?.limit,
  })
}

export function getObservation(id: number): Promise<Observation> {
  return request<Observation>(`/observations/${id}`)
}

export function searchObservations(
  options: { q: string; type?: string; scope?: Scope | ''; limit?: number; matchMode?: 'all' | 'any' } &
    ProjectReadOptions,
): Promise<SearchResult[]> {
  return request<SearchResult[]>('/search', {
    ...projectParams(options),
    q: options.q,
    type: options.type,
    scope: options.scope,
    limit: options.limit,
    match_mode: options.matchMode,
  })
}

/**
 * The runtime requires `project` in practice: without it the timeline is resolved against
 * the server process cwd project and the runtime answers 404 "observation not found".
 */
export function getTimeline(options: {
  observationId: number
  project: string
  before?: number
  after?: number
}): Promise<Timeline> {
  return request<Timeline>('/timeline', {
    observation_id: options.observationId,
    project: options.project,
    before: options.before,
    after: options.after,
  })
}

export function getRecentSessions(
  options?: ProjectReadOptions & { limit?: number },
): Promise<SessionSummary[]> {
  return request<SessionSummary[]>('/sessions/recent', {
    ...projectParams(options),
    limit: options?.limit,
  })
}

export function getSession(id: string): Promise<Session> {
  return request<Session>(`/sessions/${encodeURIComponent(id)}`)
}

export function getRecentPrompts(options?: ProjectReadOptions & { limit?: number }): Promise<Prompt[]> {
  return request<Prompt[]>('/prompts/recent', {
    ...projectParams(options),
    limit: options?.limit,
  })
}

export function searchPrompts(options: { q: string; limit?: number } & ProjectReadOptions): Promise<Prompt[]> {
  return request<Prompt[]>('/prompts/search', {
    ...projectParams(options),
    q: options.q,
    limit: options.limit,
  })
}

export function getReviewQueue(options?: ProjectReadOptions & { limit?: number }): Promise<ReviewList> {
  return request<ReviewList>('/review', {
    ...projectParams(options),
    limit: options?.limit,
  })
}

export function getConflicts(
  options?: ProjectReadOptions & { limit?: number; offset?: number; status?: string },
): Promise<ConflictList> {
  return request<ConflictList>('/conflicts', {
    ...projectParams(options),
    limit: options?.limit,
    offset: options?.offset,
    status: options?.status,
  })
}

export function getConflictStats(options?: ProjectReadOptions): Promise<ConflictStats> {
  return request<ConflictStats>('/conflicts/stats', projectParams(options))
}

export function getDoctor(project?: string): Promise<DoctorReport> {
  return request<DoctorReport>('/doctor', { project })
}

/**
 * Reads the projects inventory from the local server (`/local/projects`). The runtime has no
 * project-listing endpoint and rejects path-like project names, so this is served in-process
 * over the engram binary and is deliberately not part of the `/api` proxy.
 *
 * This function is the validating trust boundary for that route, because the two ways the
 * payload can be wrong both crash the view instead of showing its error state:
 *
 * - A server process started before this route existed falls through to the SPA fallback and
 *   answers `index.html` with 200 + text/html. `request()` keeps that raw string as the body
 *   and returns it as `T`, so the shape check below is what rejects it.
 * - The Go store builds `ProjectStats` and only appends to `Directories` for sessions with a
 *   directory, so a nil `[]string` marshals as JSON `null`; the view reads
 *   `project.directories.length`, so a non-array must be normalized to `[]`.
 */
export async function getProjects(): Promise<ProjectInventory> {
  const body = await request<unknown>('/local/projects', undefined, undefined, '')

  if (!body || typeof body !== 'object' || !Array.isArray((body as { projects?: unknown }).projects)) {
    throw new ApiError(
      0,
      'La ruta /local/projects no devolvió un inventario JSON (probablemente index.html). ' +
        'Suele ocurrir cuando el servidor en ejecución se inició antes de que existiera esta ruta. ' +
        'Reinícialo con `npm start` o recarga la página tras `npm run dev`.',
    )
  }

  const payload = body as { projects: unknown[]; count?: unknown; binary?: unknown }
  const projects = payload.projects.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new ApiError(
        0,
        'La ruta /local/projects devolvió una entrada de proyecto que no es un objeto. ' +
          'Comprueba que el servidor en ejecución sea el actual (`npm start`).',
      )
    }
    const project = entry as Record<string, unknown>
    return {
      // `name` and the three counts travel exactly as the runtime sends them.
      name: project.name as string,
      observation_count: project.observation_count as number,
      session_count: project.session_count as number,
      prompt_count: project.prompt_count as number,
      // A nil Go slice marshals as JSON `null`; normalize it so `.length` is always safe.
      directories: Array.isArray(project.directories) ? (project.directories as string[]) : [],
    } satisfies ProjectStats
  })

  const inventory: ProjectInventory = {
    projects,
    count: typeof payload.count === 'number' ? payload.count : projects.length,
  }
  if (typeof payload.binary === 'string') inventory.binary = payload.binary
  return inventory
}

// ---- Controlled writes (phase 2) ----

/** `PUT` pins, `DELETE` unpins; both return the resulting `{id, pinned}`. */
export function setObservationPin(id: number, pinned: boolean): Promise<PinResult> {
  return request<PinResult>(`/observations/${id}/pin`, undefined, {
    method: pinned ? 'PUT' : 'DELETE',
  })
}

/**
 * Patches only the fields present in the patch: the runtime rejects an empty body with
 * "at least one field is required", so undefined keys are omitted instead of nulled.
 */
export async function updateObservation(id: number, patch: ObservationPatch): Promise<Observation> {
  const body: Record<string, string> = {}
  for (const [key, value] of Object.entries(patch as Record<string, string | undefined>)) {
    if (value !== undefined) body[key] = value
  }
  if (Object.keys(body).length === 0) {
    throw new Error('updateObservation: the patch must define at least one field')
  }

  return request<Observation>(`/observations/${id}`, undefined, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Soft delete, with no query parameters at all. The runtime also accepts `?hard=true`, but it
 * exposes no undelete endpoint: a permanent deletion could never be undone, so this client
 * deliberately has no way to express one (the function takes no options).
 */
export function deleteObservation(id: number): Promise<DeleteResult> {
  return request<DeleteResult>(`/observations/${id}`, undefined, { method: 'DELETE' })
}

/** Reads only: downloads the runtime export. Nothing in this app imports a payload back. */
export function getExport(options?: ProjectReadOptions): Promise<ExportData> {
  return request<ExportData>('/export', projectParams(options))
}

// ---- Controlled writes (phase 3: mark reviewed, new memory, conflict judgment) ----

/** The closed set of verbs `POST /conflicts/judge` accepts (store.isValidRelationVerb). */
export const RELATION_VERBS: readonly RelationVerb[] = [
  'related',
  'compatible',
  'scoped',
  'conflicts_with',
  'supersedes',
  'not_conflict',
]

/**
 * Single source of the session id convention the CLI's `engram save` uses. Reusing the same
 * session is deliberate: one manual session per project instead of a new one per save.
 */
export function manualSessionId(project: string): string {
  return `manual-save-${project}`
}

/**
 * Registers the manual session. The runtime upserts on `id`, so re-creating an identical
 * session is harmless; a session already owned by another project answers 409
 * `session_project_conflict`, which the caller must surface instead of ignoring.
 */
export function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  return request<CreateSessionResult>('/sessions', undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: input.id,
      project: input.project,
      directory: input.directory,
      ownership_mode: input.ownershipMode ?? 'project_owned',
    }),
  })
}

/**
 * Publishes one observation. The runtime requires a non-empty `session_id` and `content` and a
 * `title` that is not whitespace-only; `scope`/`topic_key` are omitted when empty so the
 * runtime applies its own defaults instead of storing empty strings.
 */
export function createObservation(input: CreateObservationInput): Promise<CreateObservationResult> {
  const body: Record<string, string> = {
    session_id: input.sessionId,
    type: input.type,
    title: input.title,
    content: input.content,
    project: input.project,
  }
  if (input.scope) body.scope = input.scope
  if (input.topicKey) body.topic_key = input.topicKey

  return request<CreateObservationResult>('/observations', undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Resets the local review cycle of one observation. `allProjects` is required when the SPA is
 * filtered to "todos los proyectos": without a project the runtime falls back to the project
 * detected from its own cwd.
 */
export function markReviewed(id: number, options?: ProjectReadOptions): Promise<MarkReviewedResult> {
  return request<MarkReviewedResult>('/review/mark_reviewed', projectParams(options), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observation_id: id }),
  })
}

/**
 * Stores a verdict for one relation. The runtime runs `UPDATE memory_relations ... WHERE
 * sync_id = ?` with no state guard, so a second call replaces the previous verdict.
 * Invalid verbs and out-of-range confidence are rejected here, before any request is sent.
 */
export async function judgeRelation(input: JudgeRelationInput): Promise<JudgeRelationResult> {
  if (!RELATION_VERBS.includes(input.relation)) {
    throw new Error(
      `judgeRelation: invalid relation verb ${JSON.stringify(input.relation)} — must be one of: ${RELATION_VERBS.join(', ')}`,
    )
  }
  if (
    input.confidence !== undefined &&
    (typeof input.confidence !== 'number' ||
      Number.isNaN(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 1)
  ) {
    throw new Error('judgeRelation: confidence must be a number between 0.0 and 1.0')
  }

  const body: Record<string, string | number> = {
    judgment_id: input.judgmentId,
    relation: input.relation,
  }
  if (input.reason) body.reason = input.reason
  if (input.evidence) body.evidence = input.evidence
  if (input.confidence !== undefined) body.confidence = input.confidence

  return request<JudgeRelationResult>('/conflicts/judge', undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
