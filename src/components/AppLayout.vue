<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { COMMAND_COUNT, COMMAND_GROUPS, countCommands } from '../api/commands'
import {
  clearCommandFilters,
  commandFilters,
  filters,
  health,
  loadHealth,
  projects,
  runtimeError,
} from '../state/app-state'

const route = useRoute()

/**
 * The shell bar has three states, declared by the route: the default project/scope/type triple,
 * the catalog's own group/search pair (`meta: { filters: 'commands' }`), or nothing at all
 * (`meta: { filters: false }`), so no screen shows a control that would do nothing.
 */
const filterBar = computed<'default' | 'commands' | 'none'>(() => {
  if (route.meta.filters === false) return 'none'
  return route.meta.filters === 'commands' ? 'commands' : 'default'
})

/** Counter of the bar's catalog state; the view filters with the same helper. */
const visibleCommands = computed(() => countCommands(commandFilters))

const isCommandFiltered = computed(
  () => commandFilters.group !== '' || commandFilters.query.trim() !== '',
)
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <strong class="brand">Engram Web</strong>
      <span v-if="health" class="chip chip-ok">engram v{{ health.version }}</span>
      <span v-else class="chip chip-bad">{{ runtimeError || 'conectando…' }}</span>
      <button type="button" class="btn" @click="loadHealth()">Reintentar</button>
    </header>

    <nav class="app-nav" aria-label="Navegación principal">
      <RouterLink to="/" active-class="is-active">Dashboard</RouterLink>
      <RouterLink to="/recent" active-class="is-active">Recientes</RouterLink>
      <RouterLink to="/search" active-class="is-active">Búsqueda</RouterLink>
      <RouterLink to="/sessions" active-class="is-active">Sesiones</RouterLink>
      <RouterLink to="/review" active-class="is-active">Review</RouterLink>
      <RouterLink to="/conflicts" active-class="is-active">Conflictos</RouterLink>
      <RouterLink to="/new" active-class="is-active">Nueva memoria</RouterLink>
      <RouterLink to="/projects" active-class="is-active">Proyectos</RouterLink>
      <RouterLink to="/commands" active-class="is-active">Comandos</RouterLink>
      <RouterLink to="/help" active-class="is-active">Ayuda</RouterLink>
    </nav>

    <section v-if="filterBar !== 'none'" class="filter-bar" aria-label="Filtros de lectura">
      <template v-if="filterBar === 'commands'">
        <div class="field">
          <label for="command-group">Grupo</label>
          <select id="command-group" v-model="commandFilters.group">
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
            v-model="commandFilters.query"
            type="search"
            placeholder="prune, doctor, export…"
          />
        </div>

        <button v-if="isCommandFiltered" type="button" class="btn" @click="clearCommandFilters()">
          Limpiar
        </button>

        <p class="filter-note">
          Filtro local, sin consultar al runtime: busca en el comando, el nombre, la descripción y el
          propósito. {{ visibleCommands }} de {{ COMMAND_COUNT }} comandos visibles.
        </p>
      </template>

      <template v-else>
        <div class="field">
          <label for="filter-project">Proyecto</label>
          <select id="filter-project" v-model="filters.project">
            <option value="">Todos los proyectos</option>
            <option v-for="project in projects" :key="project" :value="project">{{ project }}</option>
          </select>
        </div>

        <div class="field">
          <label for="filter-scope">Scope</label>
          <select id="filter-scope" v-model="filters.scope">
            <option value="">cualquiera</option>
            <option value="project">project</option>
            <option value="personal">personal</option>
            <option value="global">global</option>
          </select>
        </div>

        <div class="field">
          <label for="filter-type">Tipo</label>
          <input id="filter-type" v-model="filters.type" type="text" placeholder="bugfix, decision, …" />
        </div>

        <p class="filter-note">
          Nota: en la lista de recientes el filtro por tipo se aplica en el cliente sobre la página
          cargada, porque los endpoints de recientes/listado del runtime no aceptan el parámetro
          <code>type</code> (solo <code>/search</code> lo soporta).
        </p>
      </template>
    </section>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>
