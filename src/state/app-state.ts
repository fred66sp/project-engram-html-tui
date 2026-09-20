// Shared read-only state for the SPA: active filters, the project list and runtime health.
// No Pinia on purpose: three read views do not justify a store.
import { reactive, ref } from 'vue'
import { ApiError, getHealth, getStats } from '../api/client'
import type { CommandFilter } from '../api/commands'
import type { Health, Scope, Stats } from '../api/types'

export interface Filters {
  /** Empty string means "all projects" (the runtime default is its own cwd project). */
  project: string
  /** Empty string means "any scope". */
  scope: Scope | ''
  /** Free text; no server-side type filter exists on the recent endpoints. */
  type: string
}

export const filters = reactive<Filters>({ project: '', scope: '', type: '' })

/**
 * Filters of the /commands catalog. They live here, next to `filters`, because the shell bar owns
 * both sets: the project/scope/type triple, and this pair, which is the only kind a static list can
 * use. Empty group plus empty query means "nothing filtered".
 */
export const commandFilters = reactive<CommandFilter>({ group: '', query: '' })

/** Back to the full catalog, from the bar's Limpiar button. */
export function clearCommandFilters(): void {
  commandFilters.group = ''
  commandFilters.query = ''
}

export const projects = ref<string[]>([])
export const health = ref<Health | null>(null)
export const runtimeError = ref('')

/**
 * Single owner of the `GET /stats` result: the header selector and the dashboard cards both
 * need it, and they mount in the same tick, so they must share one request and one result.
 */
export const stats = ref<Stats | null>(null)
/**
 * Kept apart from `runtimeError` on purpose: `loadHealth()` clears `runtimeError` on success,
 * which would erase a `/stats` failure the dashboard still has to show.
 */
export const statsError = ref('')

/** Single place that turns a thrown client error into readable copy for the UI. */
export function describeError(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}

/** Display helper shared by the cards and the detail view. */
export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es')
}

/** Records the failure in `runtimeError` instead of throwing: the shell must stay usable. */
export async function loadHealth(): Promise<void> {
  try {
    health.value = await getHealth()
    runtimeError.value = ''
  } catch (cause) {
    health.value = null
    runtimeError.value = describeError(cause)
  }
}

/** In-flight `/stats` request; held only while one is open. */
let statsRequest: Promise<void> | null = null

/**
 * Single owner of `/stats`. Also fills the project selector (`/stats` is the only source of
 * project names: the runtime exposes no dedicated project-list endpoint). The in-flight request
 * is cached, so a second caller arriving before it settles awaits the same promise and no
 * second socket is opened.
 */
export function loadStats(): Promise<void> {
  if (statsRequest) return statsRequest
  statsError.value = ''
  statsRequest = (async () => {
    try {
      const result = await getStats({ allProjects: true })
      stats.value = result
      projects.value = result.projects ?? []
    } catch (cause) {
      const message = describeError(cause)
      stats.value = null
      projects.value = []
      statsError.value = message
      runtimeError.value = message
    } finally {
      statsRequest = null
    }
  })()
  return statsRequest
}

/** Kept for the shell's mount: the selector is filled by the same single `/stats` call. */
export function loadProjects(): Promise<void> {
  return loadStats()
}
