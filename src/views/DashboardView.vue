<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentProject, getDoctor, getStats } from '../api/client'
import type { CurrentProject, DoctorReport, Stats } from '../api/types'
import { describeError, filters } from '../state/app-state'

const router = useRouter()

const stats = ref<Stats | null>(null)
const loading = ref(true)
const error = ref('')

const doctor = ref<DoctorReport | null>(null)
const doctorError = ref('')
const doctorLoading = ref(false)
const currentProject = ref<CurrentProject | null>(null)

const projectCount = computed(() => stats.value?.projects?.length ?? 0)

async function loadStats(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    stats.value = await getStats({ allProjects: true })
  } catch (cause) {
    stats.value = null
    error.value = describeError(cause)
  } finally {
    loading.value = false
  }
}

/**
 * `/doctor` is resolved against the server process cwd when no project is given, so it is
 * only called with an explicit selection: diagnosing the wrong project silently is worse
 * than showing nothing.
 */
async function loadDoctor(): Promise<void> {
  if (!filters.project) {
    doctor.value = null
    doctorError.value = ''
    return
  }
  doctorLoading.value = true
  doctorError.value = ''
  try {
    doctor.value = await getDoctor(filters.project)
  } catch (cause) {
    doctor.value = null
    doctorError.value = describeError(cause)
  } finally {
    doctorLoading.value = false
  }
}

async function showCurrentProject(): Promise<void> {
  doctorError.value = ''
  try {
    currentProject.value = await getCurrentProject()
  } catch (cause) {
    currentProject.value = null
    doctorError.value = describeError(cause)
  }
}

function openProject(project: string): void {
  filters.project = project
  router.push('/recent')
}

onMounted(() => {
  loadStats()
  loadDoctor()
})

watch(() => filters.project, loadDoctor)
</script>

<template>
  <div>
    <h1>Dashboard</h1>

    <p v-if="loading" class="state">Cargando estadísticas…</p>
    <p v-else-if="error" class="state bad">{{ error }}</p>

    <template v-else-if="stats">
      <section class="tiles" aria-label="Totales globales">
        <div class="tile">
          <span class="tile-value">{{ stats.total_sessions }}</span>
          <span class="tile-label">sesiones</span>
        </div>
        <div class="tile">
          <span class="tile-value">{{ stats.total_observations }}</span>
          <span class="tile-label">observaciones</span>
        </div>
        <div class="tile">
          <span class="tile-value">{{ stats.total_prompts }}</span>
          <span class="tile-label">prompts</span>
        </div>
        <div class="tile">
          <span class="tile-value">{{ projectCount }}</span>
          <span class="tile-label">proyectos</span>
        </div>
      </section>

      <section class="section">
        <h2>Proyectos</h2>
        <p class="muted">
          El runtime no expone contadores por proyecto, así que aquí solo se listan nombres.
          Selecciona uno para filtrar la vista de recientes.
        </p>
        <ul class="list-plain">
          <li v-for="project in stats.projects ?? []" :key="project">
            <button type="button" class="project-row" @click="openProject(project)">
              {{ project }}
              <span v-if="filters.project === project" class="badge">seleccionado</span>
            </button>
          </li>
        </ul>
      </section>
    </template>

    <section class="section">
      <h2>Doctor</h2>

      <template v-if="!filters.project">
        <p class="state">
          El runtime resuelve <code>/doctor</code> desde el cwd del proceso servidor, por lo que
          hay que elegir un proyecto antes de diagnosticar. No se ejecuta ningún diagnóstico
          implícito para evitar informar sobre el proyecto equivocado.
        </p>
        <p>
          <button type="button" class="btn" @click="showCurrentProject()">
            Ver proyecto que resuelve el runtime
          </button>
        </p>
        <p v-if="currentProject" class="ok">
          Proyecto resuelto: <strong>{{ currentProject.project }}</strong>
          (origen: {{ currentProject.project_source }}, cwd: {{ currentProject.cwd }})
        </p>
      </template>

      <template v-else>
        <p class="muted">Proyecto diagnosticado: <strong>{{ filters.project }}</strong></p>
        <p v-if="doctorLoading" class="state">Ejecutando chequeos…</p>
        <p v-else-if="doctorError" class="state bad">{{ doctorError }}</p>
        <template v-else-if="doctor">
          <p>
            Estado:
            <span :class="doctor.status === 'ok' ? 'ok' : 'bad'"><strong>{{ doctor.status }}</strong></span>
            — {{ doctor.summary.total }} chequeos ({{ doctor.summary.ok }} ok,
            {{ doctor.summary.warnings }} avisos, {{ doctor.summary.blocked }} bloqueados,
            {{ doctor.summary.errors }} errores)
          </p>
          <table class="checks">
            <thead>
              <tr>
                <th scope="col">Chequeo</th>
                <th scope="col">Resultado</th>
                <th scope="col">Severidad</th>
                <th scope="col">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="check in doctor.checks" :key="check.check_id">
                <td>{{ check.check_id }}</td>
                <td>{{ check.result }}</td>
                <td>{{ check.severity }}</td>
                <td>{{ check.message }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </template>

      <p v-if="doctorError && !filters.project" class="state bad">{{ doctorError }}</p>
    </section>

    <section class="section">
      <h2>Límites conocidos del API local</h2>
      <ul class="muted">
        <li>
          Sin detalle de sesión por HTTP: <code>/observations</code> y <code>/prompts/recent</code>
          ignoran <code>session_id</code>.
        </li>
        <li>Sin paginación por offset en observaciones ni prompts: solo <code>limit</code>.</li>
        <li>
          Sin filtro por tipo en recientes: solo <code>/search</code> acepta <code>type</code>, así
          que el filtro por tipo de esta app se aplica en el cliente sobre la página cargada.
        </li>
        <li>Sin contadores por proyecto en <code>/stats</code>: solo totales y nombres.</li>
        <li>
          Sin gestión de proyectos (prune/consolidate) ni setup/cloud por HTTP: eso sigue en CLI/TUI.
        </li>
      </ul>
    </section>
  </div>
</template>
