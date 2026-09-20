<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ApiError,
  deleteObservation,
  getObservation,
  markReviewed,
  projectFilter,
  setObservationPin,
  updateObservation,
} from '../api/client'
import type { Observation, ObservationPatch, Scope } from '../api/types'
import DeleteObservationDialog from '../components/DeleteObservationDialog.vue'
import MarkdownView from '../components/MarkdownView.vue'
import { describeError, formatDate, projects } from '../state/app-state'

const route = useRoute()
const router = useRouter()

const observation = ref<Observation | null>(null)
const loading = ref(false)
const error = ref('')

// ---- Controlled writes -------------------------------------------------------
// Every mutation below is user-triggered: nothing saves on blur and nothing deletes
// without the confirmation dialog.

/** Editable fields: the full accepted surface of the runtime's PATCH endpoint. */
type EditField = 'title' | 'content' | 'type' | 'scope' | 'topic_key' | 'project'
const EDIT_FIELDS: EditField[] = ['title', 'content', 'type', 'scope', 'topic_key', 'project']
const FIELD_LABELS: Record<EditField, string> = {
  title: 'título',
  content: 'contenido',
  type: 'tipo',
  scope: 'scope',
  topic_key: 'topic_key',
  project: 'proyecto',
}
const SCOPES: Scope[] = ['project', 'personal', 'global']

type Draft = Record<EditField, string>

const editing = ref(false)
const saving = ref(false)
const editError = ref('')
const notice = ref('')
const draft = reactive<Draft>({ title: '', content: '', type: '', scope: '', topic_key: '', project: '' })

const pinBusy = ref(false)
const pinError = ref('')

const reviewBusy = ref(false)
const reviewError = ref('')

const showDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const deletedId = ref<number | null>(null)

function fillDraft(from: Observation): void {
  draft.title = from.title ?? ''
  draft.content = from.content ?? ''
  draft.type = from.type ?? ''
  draft.scope = from.scope ?? ''
  draft.topic_key = from.topic_key ?? ''
  draft.project = from.project ?? ''
}

/** Only the fields that actually differ travel to the runtime. */
const changes = computed(() => {
  const current = observation.value
  if (!current) return [] as { field: EditField; label: string; before: string; after: string }[]
  return EDIT_FIELDS.flatMap((field) => {
    const before = current[field] ?? ''
    const after = draft[field]
    return before === after ? [] : [{ field, label: FIELD_LABELS[field], before, after }]
  })
})

const canSave = computed(() => changes.value.length > 0)

/** Scope options keep an unexpected stored value visible instead of silently rewriting it. */
const scopeOptions = computed(() => {
  const stored = observation.value?.scope
  return stored && !SCOPES.includes(stored as Scope) ? [stored, ...SCOPES] : SCOPES
})

function preview(value: string): string {
  const single = value.replace(/\s+/g, ' ').trim()
  if (!single) return '(vacío)'
  return single.length > 80 ? `${single.slice(0, 80)}…` : single
}

/**
 * The runtime rejects empty patches, so the form blocks the changes it cannot express safely:
 * emptying title, type, scope, project or topic_key. Content is free text and may be emptied.
 */
function validate(): string {
  for (const change of changes.value) {
    if (change.field === 'content') continue
    if (!change.after.trim()) {
      return `El campo ${change.label} no puede guardarse vacío desde esta interfaz: restaura su valor anterior o escribe uno nuevo.`
    }
  }
  return ''
}

function buildPatch(): ObservationPatch {
  const patch: ObservationPatch = {}
  for (const change of changes.value) {
    if (change.field === 'scope') patch.scope = change.after as Scope
    else patch[change.field] = change.after
  }
  return patch
}

function writeFailure(action: string, cause: unknown): string {
  const detail = describeError(cause)
  if (cause instanceof ApiError) return `${action} (HTTP ${cause.status}): ${detail}`
  return `${action}: ${detail}`
}

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
    const loaded = await getObservation(id)
    observation.value = loaded
    // A reload must never overwrite unsaved edits.
    if (!editing.value) fillDraft(loaded)
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 404
        ? `No existe una observación con id ${id}.`
        : describeError(cause)
  } finally {
    loading.value = false
  }
}

function toggleEdit(): void {
  notice.value = ''
  editError.value = ''
  if (editing.value) {
    editing.value = false
    if (observation.value) fillDraft(observation.value)
    return
  }
  if (observation.value) fillDraft(observation.value)
  editing.value = true
}

async function togglePin(): Promise<void> {
  const current = observation.value
  if (!current || pinBusy.value) return
  pinBusy.value = true
  pinError.value = ''
  notice.value = ''
  try {
    const result = await setObservationPin(current.id, !current.pinned)
    observation.value = { ...current, pinned: result.pinned }
    // The runtime never returns `pinned` when reading an observation, so this optimistic state is
    // the only reflection of the write: after a reload the button shows "Fijar" again.
    notice.value =
      'Pin actualizado. El runtime no expone ese estado al leer, así que tras recargar el botón volverá a mostrar «Fijar» aunque el pin siga aplicado.'
  } catch (cause) {
    pinError.value = writeFailure('No se pudo cambiar el pin', cause)
  } finally {
    pinBusy.value = false
  }
}

/**
 * Resets this observation's local review cycle. The runtime re-anchors `review_after` six months
 * ahead, so the response carries the new date rather than a full observation.
 */
async function markReviewedNow(): Promise<void> {
  const current = observation.value
  if (!current || reviewBusy.value) return
  reviewBusy.value = true
  reviewError.value = ''
  notice.value = ''
  try {
    const result = await markReviewed(
      current.id,
      projectFilter(current.project ?? ''),
    )
    notice.value = result.review_after
      ? `Marcada como revisada. Su próxima revisión local queda anclada en ${result.review_after}.`
      : 'Marcada como revisada: se reinició su ciclo local de revisión.'
  } catch (cause) {
    reviewError.value = writeFailure('No se pudo marcar como revisada', cause)
  } finally {
    reviewBusy.value = false
  }
}

async function save(): Promise<void> {
  const current = observation.value
  if (!current || saving.value) return
  if (!canSave.value) {
    editError.value = 'No hay cambios que guardar.'
    return
  }
  const invalid = validate()
  if (invalid) {
    editError.value = invalid
    return
  }

  saving.value = true
  editError.value = ''
  notice.value = ''
  try {
    await updateObservation(current.id, buildPatch())
    // Reload so the view shows the runtime's stored state, not the optimistic draft.
    await load()
    editing.value = false
    notice.value = 'Cambios guardados: solo se enviaron los campos modificados.'
  } catch (cause) {
    editError.value = writeFailure('No se pudieron guardar los cambios', cause)
  } finally {
    saving.value = false
  }
}

function openDelete(): void {
  deleteError.value = ''
  showDelete.value = true
}

function closeDelete(): void {
  showDelete.value = false
  deleteError.value = ''
}

async function confirmDelete(): Promise<void> {
  const current = observation.value
  if (!current || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await deleteObservation(current.id)
    // The parent closes the dialog only here, once the runtime confirmed the write.
    showDelete.value = false
    deletedId.value = current.id
    notice.value = ''
  } catch (cause) {
    deleteError.value = writeFailure('No se pudo eliminar la observación', cause)
  } finally {
    deleting.value = false
  }
}

/** A different id reuses this component, so all per-observation state has to reset. */
function onRouteChange(): void {
  deletedId.value = null
  notice.value = ''
  pinError.value = ''
  editError.value = ''
  editing.value = false
  showDelete.value = false
  load()
}

onMounted(() => {
  load()
})

watch(() => route.params.id, onRouteChange)
</script>

<template>
  <div>
    <p><RouterLink to="/recent">← Volver a recientes</RouterLink></p>

    <p v-if="loading" class="state">Cargando observación…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>

    <section v-else-if="deletedId !== null" class="section">
      <h2>Observación eliminada</h2>
      <p class="state">
        La observación {{ deletedId }} se ha eliminado con un borrado suave: ya no aparece en ningún
        listado y el runtime de Engram no ofrece restauración, así que <strong>no se puede
        recuperar</strong> ni desde esta interfaz ni desde el API.
      </p>
      <p>
        <button type="button" class="btn" @click="router.push('/recent')">Volver a recientes</button>
      </p>
    </section>

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

      <section class="section">
        <h2>Escritura controlada</h2>
        <div class="toolbar">
          <button type="button" class="btn" :disabled="pinBusy" @click="togglePin()">
            {{ observation.pinned ? 'Quitar pin' : 'Fijar' }}
          </button>
          <button type="button" class="btn" :disabled="loading" @click="toggleEdit()">
            {{ editing ? 'Cancelar edición' : 'Editar campos' }}
          </button>
          <button type="button" class="btn" :disabled="reviewBusy" @click="markReviewedNow()">
            {{ reviewBusy ? 'Marcando…' : 'Marcar revisada' }}
          </button>
          <button type="button" class="btn btn-danger" @click="openDelete()">Eliminar…</button>
          <p class="filter-note">
            El pin es local de este dispositivo. Guardar y eliminar son acciones explícitas: nada se
            envía al salir de un campo. El runtime no devuelve `pinned` al leer una observación, de
            modo que el estado del pin no se puede comprobar de vuelta desde aquí. Marcar revisada
            reinicia el ciclo local de esta observación, que pasa a vencer dentro de seis meses.
          </p>
        </div>

        <p v-if="pinError" class="state bad" role="alert">{{ pinError }}</p>
        <p v-if="reviewError" class="state bad" role="alert">{{ reviewError }}</p>
        <p v-if="notice" class="state ok" role="status">{{ notice }}</p>

        <form v-if="editing" class="edit-form" @submit.prevent="save()">
          <div class="field">
            <label for="edit-title">Título</label>
            <input id="edit-title" v-model="draft.title" type="text" />
          </div>

          <div class="field">
            <label for="edit-content">Contenido</label>
            <textarea id="edit-content" v-model="draft.content" rows="10"></textarea>
          </div>

          <div class="edit-grid">
            <div class="field">
              <label for="edit-type">Tipo</label>
              <input id="edit-type" v-model="draft.type" type="text" />
            </div>

            <div class="field">
              <label for="edit-scope">Scope</label>
              <select id="edit-scope" v-model="draft.scope">
                <option value="">sin scope</option>
                <option v-for="scope in scopeOptions" :key="scope" :value="scope">{{ scope }}</option>
              </select>
            </div>

            <div class="field">
              <label for="edit-topic-key">topic_key</label>
              <input id="edit-topic-key" v-model="draft.topic_key" type="text" />
            </div>

            <div class="field">
              <label for="edit-project">Proyecto</label>
              <input id="edit-project" v-model="draft.project" type="text" list="edit-project-options" />
              <datalist id="edit-project-options">
                <option v-for="project in projects" :key="project" :value="project"></option>
              </datalist>
            </div>
          </div>

          <p class="filter-note">
            Cambiar el proyecto <strong>mueve la observación a otro proyecto</strong>: sale de los
            listados del proyecto actual y pasa a los del nuevo.
          </p>

          <div class="change-summary">
            <h3>Cambios a enviar</h3>
            <p v-if="changes.length === 0" class="muted">
              Sin cambios: el guardado está deshabilitado hasta que modifiques algún campo.
            </p>
            <ul v-else>
              <li v-for="change in changes" :key="change.field">
                <strong>{{ change.label }}</strong>: {{ preview(change.before) }} →
                {{ preview(change.after) }}
              </li>
            </ul>
            <p class="muted">
              Solo se enviarán los {{ changes.length }} campo(s) modificado(s) en el PATCH.
            </p>
          </div>

          <p v-if="editError" class="state bad" role="alert">{{ editError }}</p>

          <div class="toolbar">
            <button type="submit" class="btn" :disabled="!canSave || saving">
              {{ saving ? 'Guardando…' : 'Guardar cambios' }}
            </button>
            <button type="button" class="btn" :disabled="saving" @click="toggleEdit()">
              Descartar
            </button>
          </div>
        </form>
      </section>

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

      <DeleteObservationDialog
        v-if="showDelete"
        :id="observation.id"
        :title="observation.title"
        :busy="deleting"
        :error="deleteError"
        @confirm="confirmDelete()"
        @cancel="closeDelete()"
      />
    </template>
  </div>
</template>
