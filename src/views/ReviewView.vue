<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { getReviewQueue } from '../api/client'
import type { ReviewList } from '../api/types'
import ObservationCard from '../components/ObservationCard.vue'
import { describeError, filters } from '../state/app-state'

const LIMITS = [25, 50, 100]

const limit = ref(50)
const queue = ref<ReviewList | null>(null)
const loading = ref(false)
const error = ref('')

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    queue.value = await getReviewQueue({
      // Never send `project` and `all_projects` together: the client enforces the invariant.
      ...(filters.project ? { project: filters.project } : { allProjects: true }),
      limit: limit.value,
    })
  } catch (cause) {
    queue.value = null
    error.value = describeError(cause)
  } finally {
    loading.value = false
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
      Vista de solo lectura: en v1 no hay acción para marcar una observación como revisada, porque el
      API local de v1 se consume sin escrituras.
    </p>

    <p v-if="loading" class="state">Cargando cola de revisión…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>
    <p v-else-if="!queue || queue.observations.length === 0" class="state">
      No hay observaciones pendientes de revisión.
    </p>

    <template v-else>
      <ObservationCard
        v-for="observation in queue.observations"
        :key="observation.id"
        :observation="observation"
      />
    </template>
  </div>
</template>
