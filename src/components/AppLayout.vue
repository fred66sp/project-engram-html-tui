<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { filters, health, loadHealth, projects, runtimeError } from '../state/app-state'
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

    <section class="filter-bar" aria-label="Filtros de lectura">
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
    </section>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>
