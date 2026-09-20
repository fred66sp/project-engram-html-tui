<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ApiError,
  getRecentPrompts,
  getRecentSessions,
  getSession,
  projectFilter,
  searchPrompts,
} from '../api/client'
import type { Prompt, Session, SessionSummary } from '../api/types'
import { describeError, filters, formatDate } from '../state/app-state'

const LIMITS = [25, 50, 100]

const limit = ref(50)

const sessions = ref<SessionSummary[]>([])
const sessionsLoading = ref(false)
const sessionsError = ref('')

const selectedId = ref('')
const detail = ref<Session | null>(null)
const detailLoading = ref(false)
const detailError = ref('')

const prompts = ref<Prompt[]>([])
const promptsLoading = ref(false)
const promptsError = ref('')
const promptQuery = ref('')
/** True when the prompt list comes from /prompts/search instead of /prompts/recent. */
const promptsSearched = ref(false)

async function loadSessions(): Promise<void> {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    sessions.value = await getRecentSessions({
      ...projectFilter(filters.project),
      limit: limit.value,
    })
  } catch (cause) {
    sessions.value = []
    sessionsError.value = describeError(cause)
  } finally {
    sessionsLoading.value = false
  }
}

async function selectSession(id: string): Promise<void> {
  selectedId.value = id
  detailLoading.value = true
  detailError.value = ''
  detail.value = null
  try {
    detail.value = await getSession(id)
  } catch (cause) {
    detailError.value =
      cause instanceof ApiError && cause.status === 404
        ? `No existe la sesión ${id}.`
        : describeError(cause)
  } finally {
    detailLoading.value = false
  }
}

async function loadRecentPrompts(): Promise<void> {
  promptsLoading.value = true
  promptsError.value = ''
  try {
    prompts.value = await getRecentPrompts({
      ...projectFilter(filters.project),
      limit: limit.value,
    })
    promptsSearched.value = false
  } catch (cause) {
    prompts.value = []
    promptsError.value = describeError(cause)
  } finally {
    promptsLoading.value = false
  }
}

async function runPromptSearch(): Promise<void> {
  const query = promptQuery.value.trim()
  // An empty query falls back to the recent list: /prompts/search requires non-empty `q`.
  if (!query) {
    await loadRecentPrompts()
    return
  }

  promptsLoading.value = true
  promptsError.value = ''
  try {
    prompts.value = await searchPrompts({
      q: query,
      limit: limit.value,
      ...projectFilter(filters.project),
    })
    promptsSearched.value = true
  } catch (cause) {
    prompts.value = []
    promptsError.value = describeError(cause)
  } finally {
    promptsLoading.value = false
  }
}

function clearPromptSearch(): void {
  promptQuery.value = ''
  loadRecentPrompts()
}

/**
 * The runtime exposes no endpoint that lists the observations or prompts of a session, so
 * the only usable workaround is filtering the recent view by the session's project.
 */
function applyProjectFilter(project: string): void {
  filters.project = project
}

function reload(): void {
  loadSessions()
  runPromptSearch()
}

onMounted(reload)

watch(limit, reload)
watch(() => filters.project, () => {
  // The selected session may belong to another project: drop it instead of showing stale data.
  selectedId.value = ''
  detail.value = null
  detailError.value = ''
  reload()
})
</script>

<template>
  <div>
    <h1>Sesiones y prompts</h1>

    <div class="toolbar">
      <div class="field">
        <label for="sessions-limit">Límite</label>
        <select id="sessions-limit" v-model.number="limit">
          <option v-for="value in LIMITS" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>
      <button type="button" class="btn" :disabled="sessionsLoading || promptsLoading" @click="reload()">
        Refrescar
      </button>
      <p class="muted">
        {{ filters.project || 'todos los proyectos' }} · límite compartido por sesiones y prompts
      </p>
    </div>

    <section class="section">
      <h2>Sesiones recientes</h2>

      <p v-if="sessionsLoading" class="state">Cargando sesiones…</p>
      <p v-else-if="sessionsError" class="state bad">{{ sessionsError }}</p>
      <p v-else-if="sessions.length === 0" class="state">No hay sesiones para estos filtros.</p>

      <template v-else>
        <ul class="list-plain">
          <li v-for="session in sessions" :key="session.id">
            <button
              type="button"
              class="project-row"
              :class="{ 'is-selected': selectedId === session.id }"
              @click="selectSession(session.id)"
            >
              {{ formatDate(session.started_at) }}
              <span class="badge">{{ session.observation_count }} obs.</span>
              <span class="badge">{{ session.project }}</span>
            </button>
          </li>
        </ul>

        <p class="filter-note">
          El runtime no expone por HTTP ningún listado de observaciones ni de prompts por sesión:
          <code>/observations</code> y <code>/prompts/recent</code> ignoran <code>session_id</code>.
          Por eso este panel muestra solo los metadatos de la sesión. Como rodeo se puede abrir
          recientes filtrado por el proyecto de la sesión.
        </p>

        <p v-if="detailLoading" class="state">Cargando sesión…</p>
        <p v-else-if="detailError" class="state bad">{{ detailError }}</p>

        <div v-else-if="detail" class="session-panel">
          <h3>Sesión {{ detail.id }}</h3>
          <dl class="detail">
            <dt>id</dt>
            <dd>{{ detail.id }}</dd>
            <dt>project</dt>
            <dd>{{ detail.project }}</dd>
            <dt>ownership_mode</dt>
            <dd>{{ detail.ownership_mode || '—' }}</dd>
            <dt>directory</dt>
            <dd>{{ detail.directory }}</dd>
            <dt>started_at</dt>
            <dd>{{ formatDate(detail.started_at) }}</dd>
            <dt>ended_at</dt>
            <dd>{{ formatDate(detail.ended_at) }}</dd>
            <dt>summary</dt>
            <dd>{{ detail.summary || '—' }}</dd>
          </dl>
          <RouterLink class="btn" to="/recent" @click="applyProjectFilter(detail.project)">
            Ver recientes del proyecto {{ detail.project }}
          </RouterLink>
        </div>
      </template>
    </section>

    <section class="section">
      <h2>Prompts</h2>

      <form class="toolbar" @submit.prevent="runPromptSearch()">
        <div class="field">
          <label for="prompts-q">Buscar prompts</label>
          <input
            id="prompts-q"
            v-model="promptQuery"
            type="search"
            placeholder="texto a buscar…"
            autocomplete="off"
          />
        </div>
        <button type="submit" class="btn" :disabled="promptsLoading">Buscar</button>
        <button type="button" class="btn" :disabled="promptsLoading" @click="clearPromptSearch()">
          Limpiar
        </button>
      </form>

      <p class="muted">
        {{ promptsSearched ? `Resultados de «${promptQuery.trim()}»` : 'Prompts más recientes' }}.
        {{ prompts.length }} filas.
      </p>

      <p v-if="promptsLoading" class="state">Cargando prompts…</p>
      <p v-else-if="promptsError" class="state bad">{{ promptsError }}</p>
      <p v-else-if="prompts.length === 0" class="state">
        {{ promptsSearched ? 'La búsqueda no devolvió prompts.' : 'No hay prompts para estos filtros.' }}
      </p>

      <template v-else>
        <article v-for="prompt in prompts" :key="prompt.id" class="card">
          <div class="card-meta">
            <span class="badge">{{ prompt.project || 'sin proyecto' }}</span>
            <time :datetime="prompt.created_at">{{ formatDate(prompt.created_at) }}</time>
          </div>
          <pre class="prompt-block">{{ prompt.content }}</pre>
          <p class="card-meta">sesión {{ prompt.session_id || '—' }}</p>
        </article>
      </template>
    </section>
  </div>
</template>
