<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ApiError,
  createObservation,
  createSession,
  getCurrentProject,
  getRecentObservations,
  manualSessionId,
} from '../api/client'
import type { CurrentProject, Scope } from '../api/types'
import { describeError, filters, projects } from '../state/app-state'

const SCOPES: Scope[] = ['project', 'personal', 'global']

/** Same default the CLI's `engram save` uses. */
const DEFAULT_TYPE = 'manual'

const project = ref(filters.project)
const directory = ref('')
const type = ref(DEFAULT_TYPE)
const title = ref('')
const content = ref('')
const scope = ref<Scope>('project')
const topicKey = ref('')

/** Directory value this form filled automatically; a manual edit is never overwritten. */
const directoryPrefill = ref('')
const currentProject = ref<CurrentProject | null>(null)
const typeSuggestions = ref<string[]>([])

const submitting = ref(false)
const formError = ref('')
const created = ref<{ id: number; title: string } | null>(null)

const sessionId = computed(() => (project.value ? manualSessionId(project.value) : ''))

/** The runtime stores the path it receives; an empty value would store its own cwd. */
const directoryMatchesRuntime = computed(
  () =>
    !!currentProject.value &&
    project.value !== '' &&
    project.value === currentProject.value.project &&
    currentProject.value.project_path !== '',
)

async function loadCurrentProject(): Promise<void> {
  try {
    currentProject.value = await getCurrentProject()
  } catch {
    // Without the runtime's resolved project the field simply stays empty and is asked for.
    currentProject.value = null
  }
  syncDirectoryPrefill()
}

/** Observation types the user's memory already uses, offered as suggestions for the free field. */
async function loadTypeSuggestions(): Promise<void> {
  try {
    const recent = await getRecentObservations({ allProjects: true, limit: 100 })
    typeSuggestions.value = [...new Set(recent.map((observation) => observation.type).filter(Boolean))].sort()
  } catch {
    // Suggestions are optional; the type field stays a plain free-text input.
    typeSuggestions.value = []
  }
}

/** Prefills the directory only while the field holds the value this view put there. */
function syncDirectoryPrefill(): void {
  const info = currentProject.value
  const matches =
    !!info && project.value !== '' && project.value === info.project && info.project_path !== ''
  const next = matches ? info.project_path : ''
  if (directory.value === '' || directory.value === directoryPrefill.value) {
    directory.value = next
    directoryPrefill.value = next
  }
}

/**
 * A 409 means the manual session id already belongs to another project. The runtime runs no
 * ownership transfer, so this must be a visible error instead of a silent retry.
 */
function sessionConflictMessage(cause: ApiError, id: string, requested: string): string {
  const body = (cause.body ?? {}) as { owner_project?: unknown }
  const owner = typeof body.owner_project === 'string' && body.owner_project ? body.owner_project : ''
  return owner
    ? `El runtime rechazó la sesión ${id} (409): ya existe y pertenece al proyecto «${owner}», no a «${requested}». Elige el proyecto correcto o revisa esa sesión en la vista de Sesiones.`
    : `El runtime rechazó la sesión ${id} (409): ${cause.message}`
}

async function submit(): Promise<void> {
  formError.value = ''
  created.value = null

  const projectName = project.value.trim()
  if (!projectName) {
    formError.value =
      'Selecciona un proyecto: sin proyecto no hay sesión válida, así que no se crea nada. No se envía «todos los proyectos» en su lugar.'
    return
  }
  const sessionDirectory = directory.value.trim()
  if (!sessionDirectory) {
    formError.value =
      'El directorio es obligatorio: si se envía vacío, el runtime guarda su propio directorio de trabajo como ruta de la sesión, que sería un dato falso.'
    return
  }
  if (!type.value.trim()) {
    formError.value = 'El tipo es obligatorio.'
    return
  }
  if (!title.value.trim()) {
    formError.value =
      'El título no puede estar vacío ni contener solo espacios: el runtime rechaza ese título con 400.'
    return
  }
  if (!content.value.trim()) {
    formError.value = 'El contenido no puede estar vacío: el runtime exige contenido para publicar.'
    return
  }

  const id = manualSessionId(projectName)
  submitting.value = true
  try {
    try {
      // The runtime upserts on the session id, so an already existing identical session is fine.
      await createSession({ id, project: projectName, directory: sessionDirectory })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        formError.value = sessionConflictMessage(cause, id, projectName)
        return
      }
      throw cause
    }

    const result = await createObservation({
      sessionId: id,
      type: type.value.trim(),
      title: title.value.trim(),
      content: content.value,
      project: projectName,
      scope: scope.value,
      topicKey: topicKey.value.trim(),
    })
    created.value = { id: result.id, title: title.value.trim() }
  } catch (cause) {
    formError.value = describeError(cause)
  } finally {
    submitting.value = false
  }
}

watch(project, syncDirectoryPrefill)

onMounted(() => {
  loadCurrentProject()
  loadTypeSuggestions()
})
</script>

<template>
  <div>
    <h1>Nueva memoria</h1>

    <p class="filter-note">
      Se publica igual que <code>engram save</code>: con la sesión manual
      <code>manual-save-&lt;proyecto&gt;</code> (ownership_mode <code>project_owned</code>). Si esa
      sesión no existe todavía, se crea con el directorio que indiques.
    </p>

    <form class="edit-form" @submit.prevent="submit">
      <div class="edit-grid">
        <div class="field">
          <label for="new-project">Proyecto (obligatorio)</label>
          <select id="new-project" v-model="project">
            <option value="">— elegir un proyecto —</option>
            <option v-for="name in projects" :key="name" :value="name">{{ name }}</option>
          </select>
          <p class="muted">
            Solo se puede crear memoria dentro de un proyecto concreto; «todos los proyectos» no es
            un destino válido y nunca se envía como <code>all_projects</code>.
          </p>
        </div>

        <div class="field">
          <label for="new-directory">Directorio de la sesión (obligatorio)</label>
          <input
            id="new-directory"
            v-model="directory"
            type="text"
            placeholder="C:/ruta/real/del/proyecto"
          />
          <p class="muted">
            El runtime guarda la ruta absoluta que recibe en esta sesión manual. Si se envía vacío,
            guardaría su propio directorio de trabajo, así que hay que escribir la ruta real.
          </p>
          <p v-if="directoryMatchesRuntime" class="muted">
            Rellenado con <code>project_path</code> del proyecto que el runtime resuelve ahora mismo;
            puedes corregirlo.
          </p>
          <p v-else class="muted">
            El runtime no resuelve ese proyecto como el actual, así que esta ruta la tienes que
            aportar tú.
          </p>
        </div>

        <div class="field">
          <label for="new-type">Tipo</label>
          <input id="new-type" v-model="type" type="text" list="new-type-options" />
          <datalist id="new-type-options">
            <option v-for="value in typeSuggestions" :key="value" :value="value" />
          </datalist>
        </div>

        <div class="field">
          <label for="new-scope">Scope</label>
          <select id="new-scope" v-model="scope">
            <option v-for="value in SCOPES" :key="value" :value="value">{{ value }}</option>
          </select>
        </div>

        <div class="field">
          <label for="new-topic-key">Topic key (opcional)</label>
          <input id="new-topic-key" v-model="topicKey" type="text" />
        </div>
      </div>

      <div class="field">
        <label for="new-title">Título (obligatorio)</label>
        <input id="new-title" v-model="title" type="text" />
      </div>

      <div class="field">
        <label for="new-content">Contenido (obligatorio)</label>
        <textarea id="new-content" v-model="content" rows="10" />
      </div>

      <div class="change-summary">
        <h3>Resumen antes de publicar</h3>
        <ul>
          <li>Proyecto: {{ project || '— (falta elegirlo)' }}</li>
          <li>Sesión: {{ sessionId || '—' }}</li>
          <li>Directorio: {{ directory || '— (falta indicarlo)' }}</li>
          <li>Tipo: {{ type || '—' }}</li>
          <li>Scope: {{ scope }}</li>
          <li>Topic key: {{ topicKey || '—' }}</li>
          <li>Título: {{ title || '—' }}</li>
        </ul>
        <p>
          Si la sesión <code>{{ sessionId || 'manual-save-&lt;proyecto&gt;' }}</code> no existe aún,
          se crea ahora como <code>project_owned</code>; si ya existe con el mismo proyecto, se
          reutiliza sin cambiarla.
        </p>
      </div>

      <div class="toolbar">
        <button type="submit" class="btn" :disabled="submitting">
          {{ submitting ? 'Publicando…' : 'Publicar memoria' }}
        </button>
        <span class="muted">La observación se publica en el proyecto elegido.</span>
      </div>
    </form>

    <p v-if="formError" class="state bad">{{ formError }}</p>

    <div v-if="created" class="state ok">
      <p>
        Memoria creada: <strong>#{{ created.id }}</strong> «{{ created.title }}».
      </p>
      <RouterLink :to="`/observations/${created.id}`">Ver la observación #{{ created.id }}</RouterLink>
    </div>
  </div>
</template>
