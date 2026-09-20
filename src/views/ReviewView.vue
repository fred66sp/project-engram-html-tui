<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ApiError, getReviewQueue, markReviewed as markReviewedRequest } from '../api/client'
import type { Observation, ReviewList } from '../api/types'
import ObservationCard from '../components/ObservationCard.vue'
import { describeError, filters } from '../state/app-state'

const LIMITS = [25, 50, 100]

const limit = ref(50)
const queue = ref<ReviewList | null>(null)
const loading = ref(false)
const error = ref('')

/** Id of the observation whose mark-reviewed request is in flight, if any. */
const markingId = ref<number | null>(null)
const notice = ref('')
const actionError = ref('')

/** Same invariant as the queue read: never send `project` and `all_projects` together. */
function queueFilter(): { project: string } | { allProjects: true } {
  return filters.project ? { project: filters.project } : { allProjects: true }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  // Stale action feedback must not survive a filter change or a refresh.
  notice.value = ''
  actionError.value = ''
  try {
    queue.value = await getReviewQueue({ ...queueFilter(), limit: limit.value })
  } catch (cause) {
    queue.value = null
    error.value = describeError(cause)
  } finally {
    loading.value = false
  }
}

/**
 * Resets the local review cycle of one observation and reloads the queue. On a project-scoped
 * queue the runtime resolves the project, so a mismatch answers 404 instead of touching a row
 * from another project.
 */
async function markReviewed(observation: Observation): Promise<void> {
  markingId.value = observation.id
  notice.value = ''
  actionError.value = ''
  try {
    await markReviewedRequest(observation.id, queueFilter())
    await load()
    notice.value = `Observación #${observation.id} «${observation.title}» marcada como revisada. Esto reinicia el ciclo local de revisión de esa observación.`
  } catch (cause) {
    actionError.value =
      cause instanceof ApiError
        ? `No se pudo marcar la observación #${observation.id} como revisada: ${cause.message}`
        : describeError(cause)
  } finally {
    markingId.value = null
  }
}

onMounted(load)

watch(() => [filters.project, limit.value], load)
</script>

<template>
  <div>
    <h1>Review</h1>

    <div class="toolbar">
      <div class="field">
        <label for="review-limit">Límite</label>
        <select id="review-limit" v-model.number="limit">
          <option v-for="value in LIMITS" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>
      <button type="button" class="btn" :disabled="loading" @click="load()">Refrescar</button>
      <p v-if="queue" class="muted">
        {{ queue.count }} observaciones pendientes ·
        {{ filters.project || 'todos los proyectos' }}
      </p>
    </div>

    <p class="filter-note">
      La cola se lee en solo lectura; la única escritura de esta vista es marcar una observación
      como revisada, que reinicia su ciclo local de revisión. El botón está fuera del enlace de la
      tarjeta para que al pulsarlo no se navegue al detalle.
    </p>

    <p v-if="actionError" class="state bad" role="alert">{{ actionError }}</p>
    <p v-else-if="notice" class="state ok" role="status">{{ notice }}</p>

    <p v-if="loading" class="state">Cargando cola de revisión…</p>
    <p v-else-if="error" class="state bad" role="alert">{{ error }}</p>
    <p v-else-if="!queue || queue.observations.length === 0" class="state">
      No hay observaciones pendientes de revisión.
    </p>

    <template v-else>
      <div v-for="observation in queue.observations" :key="observation.id" class="card-row">
        <ObservationCard :observation="observation" />
        <div class="card-actions">
          <button
            type="button"
            class="btn"
            :disabled="markingId === observation.id"
            @click="markReviewed(observation)"
          >
            {{ markingId === observation.id ? 'Marcando…' : 'Marcar revisada' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
