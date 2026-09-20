// Runnable smoke check for src/api/client.ts against a live Engram runtime.
//
// Usage: npm run smoke            (default runtime: http://127.0.0.1:7437)
//        ENGRAM_URL=http://127.0.0.1:7437 npm run smoke
// Node 24 strips the TypeScript types natively, so this needs no test framework.
import assert from 'node:assert/strict'

// The client reads its base at module load, so this must run before the import.
const base = process.env.ENGRAM_URL ?? 'http://127.0.0.1:7437'
;(globalThis as { __ENGRAM_API_BASE__?: string }).__ENGRAM_API_BASE__ = base

const api = await import('../src/api/client.ts')

async function main() {
  const health = await api.getHealth()
  console.log(`getHealth -> ${health.service} ${health.version} (${health.status})`)
  assert.equal(health.service, 'engram')

  const stats = await api.getStats({ allProjects: true })
  console.log(`getStats(allProjects) -> ${stats.total_observations} observations in ${stats.projects?.length ?? 0} projects`)
  assert.ok(stats.total_observations >= 1, `expected total_observations >= 1, got ${stats.total_observations}`)

  const recent = await api.getRecentObservations({ allProjects: true, limit: 3 })
  console.log(`getRecentObservations(allProjects, limit=3) -> ${recent.length} rows`)
  assert.ok(recent.length > 0, 'expected the recent observation list to be non-empty')
  assert.equal(typeof recent[0]!.id, 'number')
  assert.ok(recent[0]!.title, 'expected the recent observation to carry a title')

  const byId = await api.getObservation(recent[0]!.id)
  console.log(`getObservation(${recent[0]!.id}) -> "${byId.title}"`)
  assert.equal(byId.id, recent[0]!.id)
  assert.equal(byId.title, recent[0]!.title)

  const found = await api.searchObservations({ q: 'engram', allProjects: true, limit: 3 })
  console.log(`searchObservations(q=engram, allProjects, limit=3) -> ${found.length} rows`)
  assert.ok(Array.isArray(found))

  const sessions = await api.getRecentSessions({ allProjects: true, limit: 3 })
  console.log(`getRecentSessions(allProjects, limit=3) -> ${sessions.length} rows`)

  const conflicts = await api.getConflictStats({ allProjects: true })
  console.log(`getConflictStats(allProjects) -> ${Object.keys(conflicts.by_relation).length} relation kinds`)
  assert.ok(conflicts.by_relation, 'expected conflict stats to expose by_relation')

  const doctor = await api.getDoctor()
  console.log(`getDoctor() -> ${doctor.status} (${doctor.summary.total} checks)`)
  assert.ok(doctor.summary.total >= 1, `expected doctor summary.total >= 1, got ${doctor.summary.total}`)

  // Explicit project: proves the invariant on the other path (project without all_projects).
  const scoped = await api.getRecentObservations({ project: 'task-prueba', limit: 3 })
  console.log(`getRecentObservations(project=task-prueba, limit=3) -> ${scoped.length} rows`)
  assert.ok(Array.isArray(scoped))

  console.log('smoke: ok')
}

try {
  await main()
} catch (error) {
  console.error(`smoke: FAILED against ${base} —`, error instanceof Error ? error.message : error)
  process.exit(1)
}
