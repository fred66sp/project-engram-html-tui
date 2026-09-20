<script setup lang="ts">
import { computed } from 'vue'
import { COMMAND_COUNT, filterCommandGroups } from '../api/commands'
import type { CommandGroup } from '../api/commands'
import { commandFilters } from '../state/app-state'
import { useCopy } from '../state/use-copy'

/**
 * Static reference page: the catalog is plain data, so there is no request, no onMounted and no
 * runtime state. The only interaction is copying a command to the clipboard, and nothing here is
 * ever executed by the app (same rule as the /projects screen).
 *
 * The filters live in the shell's bar, next to the project/scope/type triple of the other screens
 * (`meta: { filters: 'commands' }` on the route, `commandFilters` in the shared state): this page
 * only renders whatever they keep visible.
 */
const { copiedKey, copyError, copy } = useCopy()

const filteredGroups = computed<CommandGroup[]>(() => filterCommandGroups(commandFilters))
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
