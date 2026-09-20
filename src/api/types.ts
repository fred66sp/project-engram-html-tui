// Response types for the local Engram runtime HTTP API (engram serve, v2.0.0).
// Field names mirror the runtime payloads exactly; do not rename them.

export type Scope = 'project' | 'personal' | 'global'

export interface Observation {
  id: number
  sync_id: string
  session_id: string
  type: string
  title: string
  content: string
  project?: string | null
  scope?: string | null
  topic_key?: string | null
  revision_count: number
  duplicate_count: number
  last_seen_at?: string | null
  created_at: string
  updated_at: string
  pinned?: boolean
}

export interface SearchResult extends Observation {
  rank: number
}

export interface Stats {
  total_sessions: number
  total_observations: number
  total_prompts: number
  projects: string[] | null
}

export interface Health {
  status: string
  service: string
  version: string
  instance_id?: string
}

export interface CurrentProject {
  project: string
  project_path: string
  project_source: string
  cwd: string
  available_projects: string[] | null
}

export interface SessionSummary {
  id: string
  project: string
  started_at: string
  ended_at?: string | null
  observation_count: number
}

export interface Session {
  id: string
  project: string
  ownership_mode?: string | null
  directory: string
  started_at: string
  ended_at?: string | null
  summary?: string | null
}

export interface Prompt {
  id: number
  sync_id: string
  session_id: string
  content: string
  project?: string | null
  created_at: string
}

export interface ReviewList {
  count: number
  observations: Observation[]
}

export interface ConflictRelation {
  id: number
  sync_id: string
  source_id?: string | null
  target_id?: string | null
  relation: string
  judgment_status: string
  reason?: string | null
  evidence?: string | null
  confidence?: number | null
  source_title?: string | null
  target_title?: string | null
  created_at: string
  updated_at: string
}

export interface ConflictList {
  relations: ConflictRelation[]
  total: number
  limit: number
  offset: number
}

export interface ConflictStats {
  by_judgment_status: Record<string, number>
  by_relation: Record<string, number>
  dead: number
  deferred: number
  project: string
}

export interface DoctorCheck {
  check_id: string
  result: string
  severity: string
  reason_code: string
  message: string
  why?: string
  safe_next_step?: string
  requires_confirmation?: boolean
  /** Extra per-check counters emitted by the runtime (e.g. { projects_evaluated: 0 }). */
  evidence?: Record<string, unknown>
}

export interface DoctorReport {
  status: string
  project: string
  summary: { total: number; ok: number; warnings: number; blocked: number; errors: number }
  checks: DoctorCheck[]
}

/**
 * One entry in the timeline slices. Shaped from a real GET /timeline payload
 * (observation_id=1188&project=task-prueba): entries carry `is_focus` and no `sync_id`.
 */
export interface TimelineEntry {
  id: number
  session_id: string
  type: string
  title: string
  content: string
  project?: string | null
  scope?: string | null
  topic_key?: string | null
  revision_count: number
  duplicate_count: number
  last_seen_at?: string | null
  created_at: string
  updated_at: string
  is_focus: boolean
}

/** Real payload keys: focus, before, after, session_info, total_in_range. */
export interface Timeline {
  focus: Observation
  before: TimelineEntry[] | null
  after: TimelineEntry[] | null
  session_info: Session | null
  total_in_range: number
}

/**
 * Project-scoped reads must send either an explicit `project` or `all_projects=true`:
 * the runtime falls back to the project detected from the server process cwd, which is
 * unrelated to the browser session.
 */
export interface ProjectReadOptions {
  project?: string
  allProjects?: boolean
}

// ---- Write payloads (phase 2: controlled writes) ----

/**
 * Accepted fields of `PATCH /observations/{id}`. Every key is optional because the runtime
 * rejects an empty patch (`at least one field is required`); undefined keys are never sent.
 */
export interface ObservationPatch {
  title?: string
  content?: string
  type?: string
  project?: string
  scope?: Scope
  topic_key?: string
}

/** Shape returned by `PUT`/`DELETE /observations/{id}/pin`. */
export interface PinResult {
  id: number
  pinned: boolean
}

/** Shape returned by `DELETE /observations/{id}` (soft delete). */
export interface DeleteResult {
  id: number
  status: string
  /** Present in the runtime's response only; the client cannot request a permanent deletion. */
  hard_delete?: boolean
}

/** Shape returned by `GET /export`. Read-only: this app never imports a payload back. */
export interface ExportData {
  version: string
  exported_at: string
  sessions: unknown[] | null
  observations: Observation[] | null
  prompts: unknown[] | null
}

// ---- Write payloads (phase 3: review, new memory, conflict judgment) ----

/**
 * Verbs accepted by `POST /conflicts/judge`. Same closed set the runtime validates in
 * `store.isValidRelationVerb`; anything else is rejected with 400.
 */
export type RelationVerb =
  | 'related'
  | 'compatible'
  | 'scoped'
  | 'conflicts_with'
  | 'supersedes'
  | 'not_conflict'

/**
 * Body of `POST /sessions`. `ownershipMode` defaults to `project_owned` in the client, which
 * is what the CLI's `engram save` uses to own the `manual-save-<project>` session.
 */
export interface CreateSessionInput {
  id: string
  project: string
  directory: string
  ownershipMode?: string
}

/** Shape returned by `POST /sessions` (`{"id": ..., "status": "created"}`). */
export interface CreateSessionResult {
  id: string
  status: string
}

/** Body of `POST /observations` (store.AddObservationParams). */
export interface CreateObservationInput {
  sessionId: string
  type: string
  title: string
  content: string
  project: string
  scope?: Scope | ''
  topicKey?: string
}

/** Shape returned by `POST /observations` (`{"id": 12, "status": "saved"}`). */
export interface CreateObservationResult {
  id: number
  status: string
}

/**
 * Shape returned by `POST /review/mark_reviewed`: the runtime reloads the observation and
 * answers with `reviewObservationPayload`, not with the full observation.
 */
export interface MarkReviewedResult {
  id: number
  sync_id: string
  title: string
  type: string
  state: string
  project?: string
  review_after?: string
}

/** Body of `POST /conflicts/judge`. `judgmentId` is the relation's `sync_id`. */
export interface JudgeRelationInput {
  judgmentId: string
  relation: RelationVerb
  reason?: string
  evidence?: string
  confidence?: number
}

/**
 * The judged row: `ConflictRelation` plus the fields the judgment itself writes. The runtime
 * answers `{"relation": <store.Relation>}`, so the extra keys arrive on that nested object.
 */
export interface JudgedRelation extends ConflictRelation {
  marked_by_actor?: string | null
  marked_by_kind?: string | null
  marked_by_model?: string | null
  session_id?: string | null
}

/** Shape returned by `POST /conflicts/judge`: `{"relation": {...}}`. */
export interface JudgeRelationResult {
  relation: JudgedRelation
}
