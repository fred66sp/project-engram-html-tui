<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  id: number
  title: string
  /** True while the parent's DELETE request is in flight: the dialog must stay open. */
  busy?: boolean
  /** Parent-rendered failure (404/409/400/network): never a silent failure. */
  error?: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const typed = ref('')
const input = ref<HTMLInputElement | null>(null)

/** The destructive button only unlocks on an exact id match. */
const matches = computed(() => typed.value.trim() === String(props.id))

function cancel(): void {
  // While a delete is in flight, closing would hide the outcome of a real write.
  if (props.busy) return
  emit('cancel')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') cancel()
}

onMounted(() => {
  input.value?.focus()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="dialog-backdrop" @click.self="cancel()">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
      <h2 id="delete-dialog-title" class="dialog-title">Eliminar la observación {{ id }}</h2>
      <p class="dialog-subject">{{ title }}</p>

      <p class="danger-note">
        Esto es un <strong>borrado suave</strong>. La observación desaparece de todos los listados
        (recientes, búsqueda, review y export) y el runtime de Engram <strong>no ofrece
        restauración</strong>: no se puede recuperar ni desde esta interfaz ni desde el API.
      </p>
      <p class="muted">El borrado permanente no se ofrece a propósito: el API no puede deshacerlo.</p>

      <div class="field">
        <label for="delete-dialog-id">Escribe el id {{ id }} para confirmar</label>
        <input
          id="delete-dialog-id"
          ref="input"
          v-model="typed"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :disabled="busy"
        />
      </div>

      <p v-if="error" class="state bad" role="alert">{{ error }}</p>

      <div class="dialog-actions">
        <button type="button" class="btn" :disabled="busy" @click="cancel()">Cancelar</button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="!matches || busy"
          @click="emit('confirm')"
        >
          {{ busy ? 'Eliminando…' : 'Eliminar de todos los listados' }}
        </button>
      </div>

      <p class="muted">El diálogo seguirá abierto hasta que el runtime confirme el borrado.</p>
    </div>
  </div>
</template>
