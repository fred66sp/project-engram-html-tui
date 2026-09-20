// Typed client for the local Engram runtime HTTP API (engram serve, v2.0.0).
// Reads are read-only in spirit; the write helpers below are limited to the safe subset:
// pin/unpin, field PATCH, soft delete (no `hard`) and export download.
//
// The SPA always calls `/api/*`; Vite (dev) and server/server.mjs (prod) rewrite it to the
// runtime origin, so the browser stays same-origin (the runtime sends no CORS headers).
// The runnable smoke check overrides the base for direct calls: see scripts/smoke-api.ts.
import type {
  ConflictList,
  ConflictStats,
  CurrentProject,
  DeleteResult,
  DoctorReport,
  ExportData,
  Health,
  Observation,
  ObservationPatch,
  PinResult,
  ProjectReadOptions,
  Prompt,
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

async function request<T>(path: string, params?: Params, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}${toQuery(params)}`

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
