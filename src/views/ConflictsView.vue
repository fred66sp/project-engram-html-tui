<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getConflictStats, getConflicts } from '../api/client'
import type { ConflictList, ConflictStats } from '../api/types'
import { describeError, filters, formatDate } from '../state/app-state'

const PAGE_SIZES = [25, 50, 100]

/** Status values taken from the runtime's own /conflicts/stats counters. */
const STATUSES = ['pending', 'judged', 'orphaned']

/** Only known statuses get a coloured chip; unknown ones fall back to the plain badge. */
const JUDGMENT_CLASS: Record<string, string> = {
  judged: 'badge-judged',
  pending: 'badge-pending',
  orphaned: 'badge-orphaned',
}

const limit = ref(50)
const offset = ref(0)
const status = ref('')

const list = ref<ConflictList | null>(null)
const stats = ref<ConflictStats | null>(null)
const loading = ref(false)
const error = ref('')
const statsError = ref('')

function judgmentClass(value: string): string {
  return JUDGMENT_CLASS[value] ?? ''
}

/** Lower bound of the currently shown page, 1-based. */
const rangeLabel = computed(() => {
  const total = list.value?.total ?? 0
  const rows = list.value?.relations.length ?? 0
  if (rows === 0) return `0 de ${total}`
  return `${offset.value + 1}–${offset.value + rows} de ${total}`
})

const canPrev = computed(() => offset.value > 0)
const canNext = computed(() => {
  const current = list.value
  if (!current) return false
  return offset.value + current.relations.length < current.total
})

async function loadStats(): Promise<void> {
  statsError.value = ''
  try {
    stats.value = await getConflictStats(
      filters.project ? { project: filters.project } : { allProjects: true },
    )
  } catch (cause) {
    stats.value = null
    statsError.value = describeError(cause)
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    list.value = await getConflicts({
      // Never send `project` and `all_projects` together: the client enforces the invariant.
      ...(filters.project ? { project: filters.project } : { allProjects: true }),
      limit: limit.value,
      offset: offset.value,
      status: status.value,
    })
  } catch (cause) {
    list.value = null
    error.value = describeError(cause)
  } finally {
    loading.value = false
  }
}

/** Page size and status changes must restart from the first page. */
function resetToFirstPage(): void {
  offset.value = 0
}

function prevPage(): void {
  offset.value = Math.max(0, offset.value - limit.value)
}

function nextPage(): void {
  offset.value += limit.value
}

// Declared first so a project change resets `offset` before the load watcher reads it.
watch(() => filters.project, () => {
  offset.value = 0
  loadStats()
})

watch([offset, limit, status, () => filters.project], load)

onMounted(() => {
  loadStats()
  load()
})
</script>

<template>
  <div>
    <h1>Conflictos</h1>

    <section class="section">
      <h2>Estadísticas</h2>

      <p v-if="statsError" class="state bad">{{ statsError }}</p>

      <template v-else-if="stats">
        <div class="tiles" aria-label="Totales de conflictos">
          <div class="tile">
            <span class="tile-value">{{ stats.dead }}</span>
            <span class="tile-label">dead</span>
          </div>
          <div class="tile">
            <span class="tile-value">{{ stats.deferred }}</span>
            <span class="tile-label">deferred</span>
          </div>
        </div>

        <div class="toolbar">
          <p class="muted">Proyecto: {{ stats.project || (filters.project || 'todos') }}</p>
        </div>

        <table class="checks">
          <caption class="muted">Relaciones por tipo</caption>
          <thead>
            <tr>
              <th scope="col">relation</th>
              <th scope="col">total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(count, relation) in stats.by_relation" :key="relation">
              <td>{{ relation }}</td>
              <td>{{ count }}</td>
            </tr>
          </tbody>
        </table>

        <table class="checks">
          <caption class="muted">Relaciones por estado de juicio</caption>
          <thead>
            <tr>
              <th scope="col">judgment_status</th>
              <th scope="col">total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(count, value) in stats.by_judgment_status" :key="value">
              <td>{{ value }}</td>
              <td>{{ count }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <p v-else class="state">Cargando estadísticas…</p>
    </section>

    <section class="section">
      <h2>Relaciones</h2>

      <div class="toolbar">
        <div class="field">
          <label for="conflicts-limit">Tamaño de página</label>
          <select id="conflicts-limit" v-model.number="limit" @change="resetToFirstPage">
            <option v-for="value in PAGE_SIZES" :key="value" :value="value">{{ value }}</option>
          </select>
        </div>
        <div class="field">
          <label for="conflicts-status">Estado</label>
          <select id="conflicts-status" v-model="status" @change="resetToFirstPage">
            <option value="">todas</option>
            <option v-for="value in STATUSES" :key="value" :value="value">{{ value }}</option>
          </select>
        </div>
      </div>

      <p class="filter-note">
        Las relaciones se muestran como texto y sin enlace: el runtime publica
        <code>source_id</code> / <code>target_id</code> con valores <code>obs-…</code> (sync_id),
        no los ids numéricos que necesita <code>/observations/:id</code>, y ningún endpoint resuelve
        unos a otros. Esta vista es de solo lectura: sin acciones de juzgar ni comparar en v1.
      </p>

      <p v-if="loading" class="state">Cargando relaciones…</p>
      <p v-else-if="error" class="state bad">{{ error }}</p>
      <p v-else-if="!list || list.relations.length === 0" class="state">
        No hay relaciones para estos filtros.
      </p>

      <template v-else>
        <div v-for="relation in list.relations" :key="relation.id" class="relation-row">
          <div class="relation-titles">
            <span>{{ relation.source_title || '(sin título)' }}</span>
            <span aria-hidden="true">→</span>
            <span>{{ relation.target_title || '(sin título)' }}</span>
          </div>
          <div class="card-meta">
            <span class="badge badge-relation">{{ relation.relation }}</span>
            <span class="badge" :class="judgmentClass(relation.judgment_status)">
              {{ relation.judgment_status }}
            </span>
            <time :datetime="relation.created_at">{{ formatDate(relation.created_at) }}</time>
            <span v-if="relation.confidence !== null && relation.confidence !== undefined">
              confianza {{ relation.confidence }}
            </span>
          </div>
          <p v-if="relation.reason" class="card-preview">{{ relation.reason }}</p>
        </div>
      </template>

      <div class="pagination">
        <button type="button" class="btn" :disabled="!canPrev || loading" @click="prevPage">
          ← Anteriores
        </button>
        <span class="range">{{ rangeLabel }}</span>
        <button type="button" class="btn" :disabled="!canNext || loading" @click="nextPage">
          Siguientes →
        </button>
      </div>
    </section>
  </div>
</template>
