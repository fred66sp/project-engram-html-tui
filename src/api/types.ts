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
