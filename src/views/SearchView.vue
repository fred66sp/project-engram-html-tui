<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { searchObservations } from '../api/client'
import type { Scope, SearchResult } from '../api/types'
import ObservationCard from '../components/ObservationCard.vue'
import { describeError, filters } from '../state/app-state'

const LIMITS = [25, 50, 100]

const q = ref('')
// Scope and type are local to the form; the project always comes from the global filter.
const scope = ref<Scope | ''>(filters.scope)
const type = ref(filters.type)
const matchMode = ref<'all' | 'any'>('all')
const limit = ref(25)

const results = ref<SearchResult[]>([])
const loading = ref(false)
const error = ref('')
/** Distinguishes "no search run yet" from "search ran with no matches". */
const hasSearched = ref(false)

async function runSearch(): Promise<void> {
  const query = q.value.trim()
  if (!query) {
    // The runtime rejects an empty `q`, so no request is fired and the idle state returns.
    results.value = []
    error.value = ''
    hasSearched.value = false
    return
  }

  loading.value = true
  error.value = ''
  try {
    results.value = await searchObservations({
      q: query,
      type: type.value.trim() || undefined,
      scope: scope.value,
      limit: limit.value,
      matchMode: matchMode.value,
      // The client forbids sending `project` and `all_projects` together.
      ...(filters.project ? { project: filters.project } : { allProjects: true }),
    })
  } catch (cause) {
    results.value = []
    error.value = describeError(cause)
  } finally {
    hasSearched.value = true
    loading.value = false
  }
}

onMounted(runSearch)

// The project filter lives in the shell: re-running keeps the results consistent with it.
watch(() => filters.project, () => {
  if (hasSearched.value) runSearch()
})
</script>

<template>
  <div>
    <h1>Búsqueda</h1>

    <form class="toolbar" @submit.prevent="runSearch()">
      <div class="field">
        <label for="search-q">Consulta</label>
        <input
          id="search-q"
          v-model="q"
          type="search"
          placeholder="texto a buscar…"
          autocomplete="off"
        />
      </div>

      <div class="field">
        <label for="search-scope">Scope</label>
        <select id="search-scope" v-model="scope">
          <option value="">cualquiera</option>
          <option value="project">project</option>
          <option value="personal">personal</option>
          <option value="global">global</option>
        </select>
      </div>

      <div class="field">
        <label for="search-type">Tipo</label>
        <input id="search-type" v-model="type" type="text" placeholder="bugfix, decision, …" />
      </div>

      <div class="field">
        <label for="search-match">Modo de coincidencia</label>
        <select id="search-match" v-model="matchMode">
          <option value="all">all</option>
          <option value="any">any</option>
        </select>
      </div>

      <div class="field">
        <label for="search-limit">Límite</label>
        <select id="search-limit" v-model.number="limit">
          <option v-for="value in LIMITS" :key="value" :value="value">{{ value }}</option>
        </select>
      </div>

      <button type="submit" class="btn" :disabled="loading">Buscar</button>
      <button type="button" class="btn" :disabled="loading || !hasSearched" @click="runSearch()">
        Refrescar
      </button>

      <p class="filter-note">
        A diferencia de recientes, <code>/search</code> sí acepta <code>type</code> y
        <code>match_mode</code> en el servidor. El proyecto se toma del filtro global:
        {{ filters.project || 'todos los proyectos' }}.
      </p>
    </form>

    <p v-if="loading" class="state">Buscando…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>
    <p v-else-if="!hasSearched" class="state">
      Escribe una consulta y pulsa «Buscar». El runtime exige <code>q</code> no vacío, así que no
      se lanza ninguna petición sin texto.
    </p>
    <p v-else-if="results.length === 0" class="state">La búsqueda no devolvió resultados.</p>

    <template v-else>
      <p class="muted">{{ results.length }} resultados (ordenados por relevancia).</p>
      <ObservationCard
        v-for="result in results"
        :key="result.id"
        :observation="result"
        :rank="result.rank"
      />
    </template>
  </div>
</template>
