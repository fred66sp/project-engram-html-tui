<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getConflictStats, getConflicts, judgeRelation, projectFilter, RELATION_VERBS } from '../api/client'
import type { ConflictList, ConflictStats, ConflictRelation, RelationVerb } from '../api/types'
import { describeError, filters, formatDate } from '../state/app-state'

const PAGE_SIZES = [25, 50, 100]

/** Status values taken from the runtime's own /conflicts/stats counters. */
const STATUSES = ['pending', 'judged', 'orphaned']

/** Only known statuses get a coloured chip; unknown ones fall back to the plain badge. */
const JUDGMENT_CLASS: Record<string, string> = {
  judged: 'badge-judged',
  pending: 'badge-pending',
  orphaned: 'badge-orphaned',
}

const limit = ref(50)
const offset = ref(0)
const status = ref('')

const list = ref<ConflictList | null>(null)
const stats = ref<ConflictStats | null>(null)
const loading = ref(false)
const error = ref('')
const statsError = ref('')

/** `sync_id` of the row whose verdict form is open, and of the row being saved, if any. */
const openId = ref<string | null>(null)
const judgingId = ref<string | null>(null)

// One draft at a time: the form is opened per row and seeded from that relation.
const draftRelation = ref('related')
const draftReason = ref('')
const draftEvidence = ref('')
const draftConfidence = ref('')

const verdictError = ref('')
const notice = ref('')

function isRelationVerb(value: string): value is RelationVerb {
  return (RELATION_VERBS as readonly string[]).includes(value)
}

/** Opens the verdict form for one row, seeding it with the stored verdict. */
function openVerdict(relation: ConflictRelation): void {
  verdictError.value = ''
  notice.value = ''
  if (openId.value === relation.sync_id) {
    openId.value = null
    return
  }
  openId.value = relation.sync_id
  draftRelation.value = isRelationVerb(relation.relation) ? relation.relation : 'related'
  draftReason.value = relation.reason ?? ''
  draftEvidence.value = relation.evidence ?? ''
  draftConfidence.value =
    relation.confidence === null || relation.confidence === undefined ? '' : String(relation.confidence)
}

/** Empty means "no confidence"; anything else must be a number in [0, 1]. */
function parseConfidence(): number | undefined {
  const raw = draftConfidence.value.trim()
  if (!raw) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('La confianza debe ser un número entre 0 y 1 (por ejemplo 0.8).')
  }
  return value
}

/**
 * Stores a verdict. The runtime runs `UPDATE ... WHERE sync_id = ?` with no state guard, so
 * the new verdict replaces the stored one; an invalid verb or confidence never leaves the client.
 */
async function submitVerdict(relation: ConflictRelation): Promise<void> {
  verdictError.value = ''
  notice.value = ''

  const verb = draftRelation.value
  if (!isRelationVerb(verb)) {
    verdictError.value = `Veredicto inválido: elige uno de ${RELATION_VERBS.join(', ')}.`
    return
  }

  let confidence: number | undefined
  try {
    confidence = parseConfidence()
  } catch (cause) {
    verdictError.value = describeError(cause)
    return
  }

  judgingId.value = relation.sync_id
  try {
    await judgeRelation({
      judgmentId: relation.sync_id,
      relation: verb,
      reason: draftReason.value.trim() || undefined,
      evidence: draftEvidence.value.trim() || undefined,
      confidence,
    })
    openId.value = null
    await Promise.all([load(), loadStats()])
    notice.value = `Relación ${relation.sync_id} juzgada como «${verb}». Ese veredicto sustituye al anterior en la base.`
  } catch (cause) {
    verdictError.value = `No se pudo guardar el veredicto: ${describeError(cause)}`
  } finally {
    judgingId.value = null
  }
}

function judgmentClass(value: string): string {
  return JUDGMENT_CLASS[value] ?? ''
}

/** Lower bound of the currently shown page, 1-based. */
const rangeLabel = computed(() => {
  const total = list.value?.total ?? 0
  const rows = list.value?.relations.length ?? 0
  if (rows === 0) return `0 de ${total}`
  return `${offset.value + 1}–${offset.value + rows} de ${total}`
})

const canPrev = computed(() => offset.value > 0)
const canNext = computed(() => {
  const current = list.value
  if (!current) return false
  return offset.value + current.relations.length < current.total
})

async function loadStats(): Promise<void> {
  statsError.value = ''
  try {
    stats.value = await getConflictStats(projectFilter(filters.project))
  } catch (cause) {
    stats.value = null
    statsError.value = describeError(cause)
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    list.value = await getConflicts({
      ...projectFilter(filters.project),
      limit: limit.value,
      offset: offset.value,
      status: status.value,
    })
  } catch (cause) {
    list.value = null
    error.value = describeError(cause)
  } finally {
    loading.value = false
  }
}

/** Page size and status changes must restart from the first page. */
function resetToFirstPage(): void {
  offset.value = 0
}

function prevPage(): void {
  offset.value = Math.max(0, offset.value - limit.value)
}

function nextPage(): void {
  offset.value += limit.value
}

// Declared first so a project change resets `offset` before the load watcher reads it.
watch(() => filters.project, () => {
  offset.value = 0
  loadStats()
})

watch([offset, limit, status, () => filters.project], load)

onMounted(() => {
  loadStats()
  load()
})
</script>

<template>
  <div>
    <h1>Conflictos</h1>

    <section class="section">
      <h2>Estadísticas</h2>

      <p v-if="statsError" class="state bad" role="alert">{{ statsError }}</p>

      <template v-else-if="stats">
        <div class="tiles" aria-label="Totales de conflictos">
          <div class="tile">
            <span class="tile-value">{{ stats.dead }}</span>
            <span class="tile-label">dead</span>
          </div>
          <div class="tile">
            <span class="tile-value">{{ stats.deferred }}</span>
            <span class="tile-label">deferred</span>
          </div>
        </div>

        <div class="toolbar">
          <p class="muted">Proyecto: {{ stats.project || (filters.project || 'todos') }}</p>
        </div>

        <table class="checks">
          <caption class="muted">Relaciones por tipo</caption>
          <thead>
            <tr>
              <th scope="col">relation</th>
              <th scope="col">total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(count, relation) in stats.by_relation" :key="relation">
              <td>{{ relation }}</td>
              <td>{{ count }}</td>
            </tr>
          </tbody>
        </table>

        <table class="checks">
          <caption class="muted">Relaciones por estado de juicio</caption>
          <thead>
            <tr>
              <th scope="col">judgment_status</th>
              <th scope="col">total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(count, value) in stats.by_judgment_status" :key="value">
              <td>{{ value }}</td>
              <td>{{ count }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <p v-else class="state">Cargando estadísticas…</p>
    </section>

    <section class="section">
      <h2>Relaciones</h2>

      <div class="toolbar">
        <div class="field">
          <label for="conflicts-limit">Tamaño de página</label>
          <select id="conflicts-limit" v-model.number="limit" @change="resetToFirstPage">
            <option v-for="value in PAGE_SIZES" :key="value" :value="value">{{ value }}</option>
          </select>
        </div>
        <div class="field">
          <label for="conflicts-status">Estado</label>
          <select id="conflicts-status" v-model="status" @change="resetToFirstPage">
            <option value="">todas</option>
            <option v-for="value in STATUSES" :key="value" :value="value">{{ value }}</option>
          </select>
        </div>
      </div>

      <p class="filter-note">
        Las relaciones se muestran como texto y sin enlace: el runtime publica
        <code>source_id</code> / <code>target_id</code> con valores <code>obs-…</code> (sync_id),
        no los ids numéricos que necesita <code>/observations/:id</code>, y ningún endpoint resuelve
        unos a otros. Juzgar sí está disponible; comparar memorias no.
      </p>

      <p class="filter-note">
        Aviso: un veredicto nuevo <strong>reemplaza</strong> el veredicto guardado en la base. El
        runtime ejecuta <code>UPDATE memory_relations ... WHERE sync_id = ?</code> sin ninguna
        guarda de estado, así que no se conserva el anterior.
      </p>

      <p v-if="verdictError" class="state bad" role="alert">{{ verdictError }}</p>
      <p v-else-if="notice" class="state ok" role="status">{{ notice }}</p>

      <p v-if="loading" class="state">Cargando relaciones…</p>
      <p v-else-if="error" class="state bad" role="alert">{{ error }}</p>
      <p v-else-if="!list || list.relations.length === 0" class="state">
        No hay relaciones para estos filtros.
      </p>

      <template v-else>
        <div v-for="relation in list.relations" :key="relation.id" class="relation-row">
          <div class="relation-titles">
            <span>{{ relation.source_title || '(sin título)' }}</span>
            <span aria-hidden="true">→</span>
            <span>{{ relation.target_title || '(sin título)' }}</span>
          </div>
          <div class="card-meta">
            <span class="badge badge-relation">{{ relation.relation }}</span>
            <span class="badge" :class="judgmentClass(relation.judgment_status)">
              {{ relation.judgment_status }}
            </span>
            <time :datetime="relation.created_at">{{ formatDate(relation.created_at) }}</time>
            <span v-if="relation.confidence !== null && relation.confidence !== undefined">
              confianza {{ relation.confidence }}
            </span>
          </div>
          <p v-if="relation.reason" class="card-preview">{{ relation.reason }}</p>

          <div class="toolbar">
            <button type="button" class="btn" @click="openVerdict(relation)">
              {{ openId === relation.sync_id ? 'Cerrar veredicto' : 'Juzgar' }}
            </button>
          </div>

          <form
            v-if="openId === relation.sync_id"
            class="edit-form"
            @submit.prevent="submitVerdict(relation)"
          >
            <p class="danger-note">
              Un veredicto nuevo reemplaza al guardado ({{ relation.relation }},
              {{ relation.judgment_status }}); el runtime hace un <code>UPDATE</code> sin guarda
              de estado.
            </p>

            <div class="edit-grid">
              <div class="field">
                <label :for="`verdict-relation-${relation.id}`">Veredicto</label>
                <select :id="`verdict-relation-${relation.id}`" v-model="draftRelation">
                  <option v-for="verb in RELATION_VERBS" :key="verb" :value="verb">{{ verb }}</option>
                </select>
              </div>

              <div class="field">
                <label :for="`verdict-confidence-${relation.id}`">Confianza (opcional, 0–1)</label>
                <input
                  :id="`verdict-confidence-${relation.id}`"
                  v-model="draftConfidence"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  placeholder="0.8"
                />
              </div>
            </div>

            <div class="field">
              <label :for="`verdict-reason-${relation.id}`">Motivo (opcional)</label>
              <input :id="`verdict-reason-${relation.id}`" v-model="draftReason" type="text" />
            </div>

            <div class="field">
              <label :for="`verdict-evidence-${relation.id}`">Evidencia (opcional)</label>
              <textarea :id="`verdict-evidence-${relation.id}`" v-model="draftEvidence" rows="3" />
            </div>

            <div class="toolbar">
              <button type="submit" class="btn" :disabled="judgingId === relation.sync_id">
                {{ judgingId === relation.sync_id ? 'Guardando…' : 'Guardar veredicto' }}
              </button>
              <button
                type="button"
                class="btn"
                :disabled="judgingId === relation.sync_id"
                @click="openVerdict(relation)"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </template>

      <div class="pagination">
        <button type="button" class="btn" :disabled="!canPrev || loading" @click="prevPage">
          ← Anteriores
        </button>
        <span class="range">{{ rangeLabel }}</span>
        <button type="button" class="btn" :disabled="!canNext || loading" @click="nextPage">
          Siguientes →
        </button>
      </div>
    </section>
  </div>
</template>
