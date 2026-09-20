// Shared read-only state for the SPA: active filters, the project list and runtime health.
// No Pinia on purpose: three read views do not justify a store.
import { reactive, ref } from 'vue'
import { ApiError, getHealth, getStats } from '../api/client'
import type { Health, Scope } from '../api/types'

export interface Filters {
  /** Empty string means "all projects" (the runtime default is its own cwd project). */
  project: string
  /** Empty string means "any scope". */
  scope: Scope | ''
  /** Free text; no server-side type filter exists on the recent endpoints. */
  type: string
}

export const filters = reactive<Filters>({ project: '', scope: '', type: '' })

export const projects = ref<string[]>([])
export const health = ref<Health | null>(null)
export const runtimeError = ref('')

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

/**
 * Fills the project selector. `/stats` is the only source: the runtime exposes no
 * dedicated project-list endpoint, and `projects` there is just an array of names.
 */
export async function loadProjects(): Promise<void> {
  try {
    const stats = await getStats({ allProjects: true })
    projects.value = stats.projects ?? []
  } catch (cause) {
    projects.value = []
    runtimeError.value = describeError(cause)
  }
}
