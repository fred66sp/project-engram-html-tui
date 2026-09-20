<script setup lang="ts">
import { computed, ref } from 'vue'
import { COMMAND_COUNT, COMMAND_GROUPS } from '../api/commands'
import type { CommandEntry, CommandGroup } from '../api/commands'
import { useCopy } from '../state/use-copy'

/**
 * Static reference page: the catalog is plain data, so there is no request, no onMounted and no
 * runtime state. The only interactions are the two local filters below and copying a command to
 * the clipboard; nothing here is ever executed by the app (same rule as the /projects screen).
 *
 * The shell's project/scope/type bar is deliberately absent here (the route opts out with
 * `meta: { filters: false }`): those filters cannot touch a static list.
 */
const { copiedKey, copyError, copy } = useCopy()

/** Empty string means "every group", the same convention as the shell's project filter. */
const groupFilter = ref('')
const query = ref('')

/** Accent- and case-insensitive fold: "busqueda" must find "Búsqueda". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** The query searches every text an entry shows, so the description is searchable too. */
function matches(entry: CommandEntry, needle: string): boolean {
  if (!needle) return true
  const haystack = [entry.command, entry.label, entry.description, entry.purpose].join(' ')
  return fold(haystack).includes(needle)
}

/** Only the groups that still have a match survive, so an empty group never renders. */
const filteredGroups = computed<CommandGroup[]>(() => {
  const needle = fold(query.value.trim())
  return COMMAND_GROUPS.filter((group) => groupFilter.value === '' || group.id === groupFilter.value)
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => matches(entry, needle)) }))
    .filter((group) => group.entries.length > 0)
})

const shownCount = computed(() =>
  filteredGroups.value.reduce((total, group) => total + group.entries.length, 0),
)

const isFiltered = computed(() => groupFilter.value !== '' || query.value.trim() !== '')

function clearFilters(): void {
  groupFilter.value = ''
  query.value = ''
}
</script>

<template>
  <div class="help">
    <h1>Comandos</h1>

    <p>
      Los {{ COMMAND_COUNT }} comandos de consola que acompañan a esta interfaz: los scripts npm de
      este proyecto y el CLI de Engram v2.0.0 completo. Cada entrada trae el comando exacto con su
      botón de copiar, qué hace y para qué sirve.
    </p>

    <p class="help-note">
      Esta página <strong>no ejecuta nada</strong>: no hay ningún proceso ni endpoint detrás, solo
      texto que se copia al portapapeles. Los comandos destructivos lo indican, y en el runtime no
      existe ninguna restauración.
    </p>

    <div class="toolbar">
      <div class="field">
        <label for="command-group">Grupo</label>
        <select id="command-group" v-model="groupFilter">
          <option value="">Todos los grupos</option>
          <option v-for="group in COMMAND_GROUPS" :key="group.id" :value="group.id">
            {{ group.title }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="command-query">Buscar</label>
        <input
          id="command-query"
          v-model="query"
          type="search"
          placeholder="prune, doctor, export…"
        />
      </div>

      <button v-if="isFiltered" type="button" class="btn" @click="clearFilters()">
        Limpiar
      </button>

      <p class="filter-note">
        Filtro local, sin consultar al runtime: busca en el comando, el nombre, la descripción y el
        propósito. {{ shownCount }} de {{ COMMAND_COUNT }} comandos visibles.
      </p>
    </div>

    <p v-if="copyError" class="state bad" role="alert">{{ copyError }}</p>

    <nav v-if="filteredGroups.length > 0" class="help-toc" aria-label="Grupos de comandos">
      <strong>Grupos</strong>
      <ul>
        <li v-for="group in filteredGroups" :key="group.id">
          <a :href="`#${group.id}`">{{ group.title }}</a>
          <span class="muted"> ({{ group.entries.length }})</span>
        </li>
      </ul>
    </nav>

    <p v-if="filteredGroups.length === 0" class="state">
      Ningún comando coincide con el filtro.
    </p>

    <section v-for="group in filteredGroups" :id="group.id" :key="group.id" class="help-section">
      <h2>{{ group.title }}</h2>
      <p class="muted">{{ group.intro }}</p>

      <article v-for="entry in group.entries" :key="entry.id" class="card">
        <p class="muted">{{ entry.label }}</p>
        <pre class="prompt-block">{{ entry.command }}</pre>
        <p>{{ entry.description }}</p>
        <p class="muted">Para qué sirve: {{ entry.purpose }}</p>
        <p v-if="entry.warning" class="danger-note" role="note">
          <strong>Aviso:</strong> {{ entry.warning }}
        </p>
        <div class="toolbar">
          <button type="button" class="btn" @click="copy(entry.id, entry.command)">Copiar</button>
          <span v-if="copiedKey === entry.id" class="ok" role="status">Copiado</span>
        </div>
      </article>
    </section>
  </div>
</template>
