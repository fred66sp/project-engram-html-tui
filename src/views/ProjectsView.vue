<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getProjects } from '../api/client'
import {
  PROJECT_COMMANDS,
  isPathNamed,
  isPruneCandidate,
  sortProjects,
  summarizeProjects,
} from '../api/projects'
import type { ProjectInventory } from '../api/types'
import { describeError } from '../state/app-state'

/**
 * Read-only inventory: one request (`getProjects()`) and nothing else. The runtime's HTTP API
 * has no project-listing endpoint and answers 400 `invalid_project` for path-like names, so the
 * data comes from `/local/projects` (fact 2, odd/tasks/engram-web-projects.md). No mutate call,
 * no interval, no refresh-on-render: the screen never executes a command.
 */
const inventory = ref<ProjectInventory | null>(null)
const loading = ref(true)
const error = ref('')

const ordered = computed(() => sortProjects(inventory.value?.projects ?? []))
const totals = computed(() => summarizeProjects(inventory.value?.projects ?? []))
const isEmpty = computed(() => (inventory.value?.projects.length ?? 0) === 0)

/** Display order and labels for the five exact CLI commands (constants are the source of truth). */
const COMMANDS: ReadonlyArray<{ key: keyof typeof PROJECT_COMMANDS; label: string }> = [
  { key: 'list', label: 'Listado en la terminal' },
  { key: 'pruneDryRun', label: 'Poda: simulación (no borra)' },
  { key: 'prune', label: 'Poda: real (borra, interactiva)' },
  { key: 'consolidateDryRun', label: 'Consolidación: simulación' },
  { key: 'consolidate', label: 'Consolidación: real' },
]

const copiedKey = ref<keyof typeof PROJECT_COMMANDS | null>(null)
const copyError = ref('')
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    inventory.value = await getProjects()
  } catch (cause) {
    inventory.value = null
    error.value = describeError(cause)
  } finally {
    loading.value = false
  }
}

/**
 * Copying is the only interaction here. A missing `navigator.clipboard` or a rejected write
 * must surface visibly instead of failing silently.
 */
async function copyCommand(key: keyof typeof PROJECT_COMMANDS): Promise<void> {
  copyError.value = ''
  copiedKey.value = null
  if (!navigator.clipboard?.writeText) {
    copyError.value =
      'El portapapeles no está disponible en este navegador (necesita HTTPS o localhost). Copia el comando a mano.'
    return
  }
  try {
    await navigator.clipboard.writeText(PROJECT_COMMANDS[key])
    copiedKey.value = key
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copiedKey.value = null
    }, 3000)
  } catch (cause) {
    copyError.value = `No se pudo copiar el comando: ${describeError(cause)}`
  }
}

onMounted(load)
</script>

<template>
  <div>
    <h1>Proyectos</h1>

    <p>
      Inventario de proyectos del almacén con sus conteos y directorios asociados. Esta pantalla
      solo lee: no ejecuta ninguna orden, así que la poda y la consolidación se copian y se
      lanzan en una terminal.
    </p>

    <section class="section">
      <h2>Inventario</h2>

      <p class="filter-note">
        El inventario es global: no depende del selector de proyecto de la barra superior. Ese
        selector se llena desde <code>/stats?all_projects=true</code>, que solo devuelve nombres:
        omite los proyectos sin observaciones, así que nunca lista los podables, y un proyecto con
        nombre de ruta aparece en la lista pero no se puede consultar desde él
        (<code>400 invalid_project</code>).
      </p>

      <p v-if="loading" class="state">Cargando inventario…</p>

      <template v-else-if="error">
        <p class="state bad" role="alert">{{ error }}</p>
        <div class="toolbar">
          <button type="button" class="btn" @click="load()">Reintentar</button>
        </div>
      </template>

      <p v-else-if="isEmpty" class="state">El almacén todavía no tiene proyectos.</p>

      <template v-else>
        <p>
          <strong>{{ totals.projects }}</strong> proyectos ·
          <strong>{{ totals.observations }}</strong> observaciones ·
          <strong>{{ totals.sessions }}</strong> sesiones ·
          <strong>{{ totals.prompts }}</strong> prompts ·
          <strong>{{ totals.pruneCandidates }}</strong> podables
        </p>

        <table class="checks">
          <thead>
            <tr>
              <th scope="col">Proyecto</th>
              <th scope="col">Observaciones</th>
              <th scope="col">Sesiones</th>
              <th scope="col">Prompts</th>
              <th scope="col">Directorios</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in ordered" :key="project.name">
              <td>
                {{ project.name }}
                <span v-if="isPruneCandidate(project)" class="badge badge-prune">
                  sin observaciones · podable
                </span>
                <span v-if="isPathNamed(project.name)" class="badge badge-path">
                  nombre con ruta · no consultable por HTTP
                </span>
              </td>
              <td>{{ project.observation_count }}</td>
              <td>{{ project.session_count }}</td>
              <td>{{ project.prompt_count }}</td>
              <td>
                <span v-if="project.directories.length === 0" class="muted">—</span>
                <details v-else>
                  <summary>
                    {{ project.directories.length }}
                    {{ project.directories.length === 1 ? 'directorio' : 'directorios' }}
                  </summary>
                  <ul class="dir-list">
                    <li v-for="directory in project.directories" :key="directory">
                      <code>{{ directory }}</code>
                    </li>
                  </ul>
                </details>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </section>

    <section class="section">
      <h2>Comandos</h2>

      <p>
        Estos comandos son la vía real para podar y consolidar. La interfaz web no los ejecuta a
        propósito: hay que copiarlos y pegarlos en una terminal.
      </p>

      <p class="danger-note">
        <strong>Aviso:</strong> <code>engram projects prune</code> borra los prompts del proyecto y
        sus sesiones sin observaciones, y <strong>no tiene vuelta atrás</strong>: el runtime no
        expone ninguna restauración. El runtime se niega a podar un proyecto que todavía tenga
        observaciones. La poda real es interactiva (tú eliges los números de la lista) y
        <code>--dry-run</code> solo lista, no borra.
      </p>

      <p v-if="copyError" class="state bad" role="alert">{{ copyError }}</p>

      <div v-for="command in COMMANDS" :key="command.key" class="card">
        <p class="muted">{{ command.label }}</p>
        <pre class="prompt-block">{{ PROJECT_COMMANDS[command.key] }}</pre>
        <div class="toolbar">
          <button type="button" class="btn" @click="copyCommand(command.key)">Copiar</button>
          <span v-if="copiedKey === command.key" class="ok" role="status">Copiado</span>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Consolidación</h2>

      <p>
        <code>engram projects consolidate</code> solo fusiona nombres que canonizan al mismo
        nombre: minúsculas y colapso de <code>--</code> y <code>__</code>. Cualquier otra cosa el
        propio almacén la rechaza con
        <code>source project "…" must normalize to canonical project "…"</code>. Por eso los
        nombres con ruta como <code>c:/docker-curso</code> y <code>docker-curso</code>
        <strong>no se pueden fusionar</strong>: normalizan a nombres distintos.
      </p>

      <p class="filter-note">
        Esta pantalla no propone fusiones ni marca equivalencias: la autoridad es el comando, y
        aquí solo se muestra. Ejecuta
        <code>engram projects consolidate --all --dry-run</code> para ver qué grupos detecta el
        almacén; la interfaz no puede saberlo por ti.
      </p>

      <p>
        Para un duplicado con nombre de ruta, el camino es manual: mueve sus observaciones al
        proyecto correcto desde el detalle de cada observación (el campo <code>project</code> es
        editable) y después poda el nombre que quede con cero observaciones.
      </p>
    </section>
  </div>
</template>
