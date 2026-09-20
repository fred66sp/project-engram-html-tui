// Pure helpers over the project inventory: no I/O, no proposal engine.
//
// Shared by the /projects view and scripts/check-projects.ts. Deliberately absent: any
// name-similarity heuristic. `engram projects consolidate` only merges names that
// canonicalize to the same project (`MergeProjects` fails otherwise with "source project
// ... must normalize to canonical project ..."), so the interface shows the CLI command as
// the authority and never invents an equivalence (fact 5, odd/tasks/engram-web-projects.md).
import type { ProjectStats } from './types'

/** Exact CLI commands the view offers as copy buttons: single source of truth. */
export const PROJECT_COMMANDS = {
  list: 'engram projects list',
  pruneDryRun: 'engram projects prune --dry-run',
  prune: 'engram projects prune',
  consolidateDryRun: 'engram projects consolidate --all --dry-run',
  consolidate: 'engram projects consolidate --all',
} as const

/** Totals shown next to the inventory table. */
export interface ProjectSummary {
  projects: number
  observations: number
  sessions: number
  prompts: number
  pruneCandidates: number
}

/**
 * The store's own rule: `PruneProject` refuses a project while observations remain, so only
 * a project with zero observations can be pruned.
 */
export function isPruneCandidate(project: ProjectStats): boolean {
  return project.observation_count === 0
}

/**
 * Path-like names cannot be queried over HTTP: every endpoint that takes a project
 * (`/stats?project=…`, `/observations`, `/sessions/recent`, `/prompts/recent`) answers 400
 * `invalid_project` ("project must be a name, not a path"). They can still appear in the name
 * list from `/stats?all_projects=true`, which only omits projects without observations.
 */
export function isPathNamed(name: string): boolean {
  return name.includes('\\') || name.includes(':') || name.includes('/')
}

/**
 * Most observations first, then the name ascending. The CLI has no stable tie-break for equal
 * observation counts (non-deterministic within equal-count groups), so this name tie-break is
 * this helper's own rule, not a match for `engram projects list`.
 */
export function sortProjects(projects: ProjectStats[]): ProjectStats[] {
  return [...projects].sort(
    (a, b) => b.observation_count - a.observation_count || a.name.localeCompare(b.name),
  )
}

export function summarizeProjects(projects: ProjectStats[]): ProjectSummary {
  const summary: ProjectSummary = {
    projects: projects.length,
    observations: 0,
    sessions: 0,
    prompts: 0,
    pruneCandidates: 0,
  }
  for (const project of projects) {
    summary.observations += project.observation_count
    summary.sessions += project.session_count
    summary.prompts += project.prompt_count
    if (isPruneCandidate(project)) summary.pruneCandidates += 1
  }
  return summary
}
