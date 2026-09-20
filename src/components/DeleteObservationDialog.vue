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
const dialog = ref<HTMLElement | null>(null)

/** Element focused before the dialog opened; focus returns here on unmount. */
let trigger: HTMLElement | null = null

const FOCUSABLE = 'button, input, select, textarea, a[href]'

/** The destructive button only unlocks on an exact id match. */
const matches = computed(() => typed.value.trim() === String(props.id))

function cancel(): void {
  // While a delete is in flight, closing would hide the outcome of a real write.
  if (props.busy) return
  emit('cancel')
}

/** Enabled, visible focusable descendants of the dialog, in DOM order. */
function focusable(): HTMLElement[] {
  const root = dialog.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
  )
}

/** Keep Tab inside the modal instead of letting it reach the page behind it. */
function trapTab(event: KeyboardEvent): void {
  const items = focusable()
  // While busy both controls are disabled: hold focus instead of leaking it to BODY.
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  const inside = active !== null && dialog.value?.contains(active) === true
  if (event.shiftKey) {
    if (!inside || active === first) {
      event.preventDefault()
      last.focus()
    }
  } else if (!inside || active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    cancel()
    return
  }
  if (event.key === 'Tab') trapTab(event)
}

onMounted(() => {
  trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  input.value?.focus()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  // Give focus back to the trigger only when it is still reachable; otherwise leave it alone.
  if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') trigger.focus()
  trigger = null
})
</script>

<template>
  <div class="dialog-backdrop" @click.self="cancel()">
    <div
      ref="dialog"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
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
