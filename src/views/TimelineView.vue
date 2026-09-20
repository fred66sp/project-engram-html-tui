<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getObservation, getTimeline } from '../api/client'
import type { Timeline, TimelineEntry } from '../api/types'
import MarkdownView from '../components/MarkdownView.vue'
import { describeError, formatDate } from '../state/app-state'

const route = useRoute()

/** The runtime accepts 1–10 neighbours on each side. */
const NEIGHBOUR_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const before = ref(5)
const after = ref(5)
const timeline = ref<Timeline | null>(null)
const loading = ref(false)
const error = ref('')
/** The observation carries no project, so the runtime cannot resolve the timeline scope. */
const missingProject = ref(false)

// The runtime can answer with `null` slices instead of empty arrays.
const beforeEntries = computed<TimelineEntry[]>(() => timeline.value?.before ?? [])
const afterEntries = computed<TimelineEntry[]>(() => timeline.value?.after ?? [])

async function load(): Promise<void> {
  const id = Number(route.params.id)
  loading.value = true
  error.value = ''
  missingProject.value = false
  timeline.value = null

  if (!Number.isInteger(id)) {
    error.value = `Identificador de observación inválido: ${String(route.params.id)}`
    loading.value = false
    return
  }

  try {
    // GET /timeline requires an explicit `project`: without it the runtime resolves the
    // project from the server process cwd and answers 404 for any observation outside that
    // project. The observation itself is the only source of its project, so it is fetched
    // first and the timeline request is scoped with the value it returns.
    const observation = await getObservation(id)
    if (!observation.project) {
      missingProject.value = true
      return
    }
    timeline.value = await getTimeline({
      observationId: id,
      project: observation.project,
      before: before.value,
      after: after.value,
    })
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

// The same route with another id reuses this component, so the param change must refetch.
watch(() => route.params.id, load)
watch([before, after], load)
</script>

<template>
  <div>
    <p><RouterLink to="/recent">← Volver a recientes</RouterLink></p>

    <h1>Timeline</h1>

    <div class="toolbar">
      <div class="field">
        <label for="timeline-before">Anteriores</label>
        <select id="timeline-before" v-model.number="before">
          <option v-for="value in NEIGHBOUR_COUNTS" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>
      <div class="field">
        <label for="timeline-after">Posteriores</label>
        <select id="timeline-after" v-model.number="after">
          <option v-for="value in NEIGHBOUR_COUNTS" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>
      <button type="button" class="btn" :disabled="loading" @click="load()">Refrescar</button>
      <p v-if="timeline" class="muted">{{ timeline.total_in_range }} observaciones en el rango.</p>
    </div>

    <p v-if="loading" class="state">Cargando timeline…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>
    <p v-else-if="missingProject" class="state bad">
      Esta observación no tiene proyecto, y el runtime resuelve <code>/timeline</code> por proyecto
      explícito (si falta, usa el cwd del proceso servidor y responde 404). Sin un proyecto no hay
      timeline disponible y no se reintenta de forma silenciosa.
    </p>

    <template v-else-if="timeline">
      <section class="section">
        <h2>Observación focal</h2>
        <article class="card is-focus">
          <RouterLink class="card-title" :to="`/observations/${timeline.focus.id}`">
            {{ timeline.focus.title }}
          </RouterLink>
          <div class="card-meta">
            <span class="badge badge-rank">is_focus</span>
            <span class="badge">{{ timeline.focus.type }}</span>
            <span class="badge">{{ timeline.focus.project || 'sin proyecto' }}</span>
            <span class="badge">{{ timeline.focus.scope || 'sin scope' }}</span>
            <time :datetime="timeline.focus.created_at">
              {{ formatDate(timeline.focus.created_at) }}
            </time>
          </div>
          <MarkdownView :content="timeline.focus.content" />
        </article>
      </section>

      <section class="section">
        <h2>Antes ({{ beforeEntries.length }})</h2>
        <p v-if="beforeEntries.length === 0" class="state">Sin observaciones anteriores.</p>
        <article v-for="entry in beforeEntries" :key="entry.id" class="card">
          <RouterLink class="card-title" :to="`/observations/${entry.id}`">
            {{ entry.title }}
          </RouterLink>
          <div class="card-meta">
            <span v-if="entry.is_focus" class="badge badge-rank">is_focus</span>
            <span class="badge">{{ entry.type }}</span>
            <span class="badge">{{ entry.scope || 'sin scope' }}</span>
            <time :datetime="entry.created_at">{{ formatDate(entry.created_at) }}</time>
          </div>
        </article>
      </section>

      <section class="section">
        <h2>Después ({{ afterEntries.length }})</h2>
        <p v-if="afterEntries.length === 0" class="state">Sin observaciones posteriores.</p>
        <article v-for="entry in afterEntries" :key="entry.id" class="card">
          <RouterLink class="card-title" :to="`/observations/${entry.id}`">
            {{ entry.title }}
          </RouterLink>
          <div class="card-meta">
            <span v-if="entry.is_focus" class="badge badge-rank">is_focus</span>
            <span class="badge">{{ entry.type }}</span>
            <span class="badge">{{ entry.scope || 'sin scope' }}</span>
            <time :datetime="entry.created_at">{{ formatDate(entry.created_at) }}</time>
          </div>
        </article>
      </section>

      <section class="section">
        <h2>Sesión</h2>
        <div v-if="timeline.session_info" class="session-panel">
          <dl class="detail">
            <dt>id</dt>
            <dd>{{ timeline.session_info.id }}</dd>
            <dt>project</dt>
            <dd>{{ timeline.session_info.project }}</dd>
            <dt>ownership_mode</dt>
            <dd>{{ timeline.session_info.ownership_mode || '—' }}</dd>
            <dt>directory</dt>
            <dd>{{ timeline.session_info.directory }}</dd>
            <dt>started_at</dt>
            <dd>{{ formatDate(timeline.session_info.started_at) }}</dd>
            <dt>ended_at</dt>
            <dd>{{ formatDate(timeline.session_info.ended_at) }}</dd>
            <dt>summary</dt>
            <dd>{{ timeline.session_info.summary || '—' }}</dd>
          </dl>
        </div>
        <p v-else class="state">El runtime no devolvió información de sesión para esta observación.</p>
      </section>
    </template>
  </div>
</template>
