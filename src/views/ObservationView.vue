<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getObservation } from '../api/client'
import type { Observation } from '../api/types'
import MarkdownView from '../components/MarkdownView.vue'
import { describeError, formatDate } from '../state/app-state'

const route = useRoute()

const observation = ref<Observation | null>(null)
const loading = ref(false)
const error = ref('')

async function load(): Promise<void> {
  const id = Number(route.params.id)
  loading.value = true
  error.value = ''
  observation.value = null

  if (!Number.isInteger(id)) {
    error.value = `Identificador de observación inválido: ${String(route.params.id)}`
    loading.value = false
    return
  }

  try {
    observation.value = await getObservation(id)
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 404
        ? `No existe una observación con id ${id}.`
        : describeError(cause)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Same route with another id reuses this component, so the param change must refetch.
watch(() => route.params.id, load)
</script>

<template>
  <div>
    <p><RouterLink to="/recent">← Volver a recientes</RouterLink></p>

    <p v-if="loading" class="state">Cargando observación…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>

    <template v-else-if="observation">
      <h1>
        <span v-if="observation.pinned" class="pin" title="Fijada" aria-label="Fijada">★</span>
        {{ observation.title }}
      </h1>

      <div class="toolbar">
        <span class="badge">{{ observation.type }}</span>
        <span class="badge">{{ observation.scope || 'sin scope' }}</span>
        <span class="badge">{{ observation.project || 'sin proyecto' }}</span>
        <RouterLink class="btn" :to="`/timeline/${observation.id}`">Ver timeline</RouterLink>
        <button type="button" class="btn" :disabled="loading" @click="load()">Recargar</button>
      </div>

      <dl class="detail">
        <dt>id</dt>
        <dd>{{ observation.id }}</dd>
        <dt>session_id</dt>
        <dd>{{ observation.session_id || '—' }}</dd>
        <dt>sync_id</dt>
        <dd>{{ observation.sync_id || '—' }}</dd>
        <dt>revision_count</dt>
        <dd>{{ observation.revision_count }}</dd>
        <dt>duplicate_count</dt>
        <dd>{{ observation.duplicate_count }}</dd>
        <dt>created_at</dt>
        <dd>{{ formatDate(observation.created_at) }}</dd>
        <dt>updated_at</dt>
        <dd>{{ formatDate(observation.updated_at) }}</dd>
        <dt>last_seen_at</dt>
        <dd>{{ formatDate(observation.last_seen_at) }}</dd>
      </dl>

      <MarkdownView :content="observation.content" />
    </template>
  </div>
</template>
