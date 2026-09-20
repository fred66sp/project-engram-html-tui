<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getRecentObservations, projectFilter } from '../api/client'
import type { Observation } from '../api/types'
import ObservationCard from '../components/ObservationCard.vue'
import { describeError, filters } from '../state/app-state'

const LIMITS = [25, 50, 100, 200]

const limit = ref(50)
const observations = ref<Observation[]>([])
const loading = ref(false)
const error = ref('')

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    observations.value = await getRecentObservations({
      ...projectFilter(filters.project),
      scope: filters.scope,
      limit: limit.value,
    })
  } catch (cause) {
    observations.value = []
    error.value = describeError(cause)
  } finally {
    loading.value = false
  }
}

/** `type` has no server-side filter on the recent endpoints, so it is applied here. */
const typeFilter = computed(() => filters.type.trim().toLowerCase())

const visible = computed(() =>
  typeFilter.value
    ? observations.value.filter((row) => row.type.toLowerCase().includes(typeFilter.value))
    : observations.value,
)

onMounted(load)

watch(() => [filters.project, filters.scope, limit.value], load)
</script>

<template>
  <div>
    <h1>Recientes</h1>

    <div class="toolbar">
      <div class="field">
        <label for="recent-limit">Límite</label>
        <select id="recent-limit" v-model.number="limit">
          <option v-for="value in LIMITS" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>
      <button type="button" class="btn" :disabled="loading" @click="load()">Refrescar</button>
      <p class="muted">
        {{ filters.project || 'todos los proyectos' }} · {{ filters.scope || 'cualquier scope' }}
      </p>
    </div>

    <p v-if="typeFilter" class="filter-note">
      Filtro por tipo «{{ filters.type }}» aplicado en el cliente sobre las
      {{ observations.length }} filas cargadas: el runtime no acepta <code>type</code> en
      <code>/observations/recent</code>.
    </p>

    <p v-if="loading" class="state">Cargando observaciones…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>
    <p v-else-if="visible.length === 0" class="state">
      No hay observaciones para estos filtros.
    </p>

    <template v-else>
      <ObservationCard
        v-for="observation in visible"
        :key="observation.id"
        :observation="observation"
      />
    </template>
  </div>
</template>
