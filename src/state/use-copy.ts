// Shared clipboard helper for the copy-button screens (/commands and /projects).
//
// The composable owns the transient "copied" key, the error message and the reset timer. A
// missing navigator.clipboard or a rejected write is reported to the caller's UI instead of
// failing silently, and the timer is cleared when the component scope goes away.
import { onScopeDispose, ref } from 'vue'
import { describeError } from './app-state'

/** How long the "Copiado" confirmation stays visible, in milliseconds. */
const CONFIRM_MS = 3000

export function useCopy() {
  const copiedKey = ref<string | null>(null)
  const copyError = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
  })

  /** Copies `text` and marks `key` as copied. Keys are catalog ids or command keys. */
  async function copy(key: string, text: string): Promise<void> {
    copyError.value = ''
    copiedKey.value = null
    if (!navigator.clipboard?.writeText) {
      copyError.value =
        'El portapapeles no está disponible en este navegador (necesita HTTPS o localhost). Copia el comando a mano.'
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      copiedKey.value = key
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        copiedKey.value = null
      }, CONFIRM_MS)
    } catch (cause) {
      copyError.value = `No se pudo copiar el comando: ${describeError(cause)}`
    }
  }

  return { copiedKey, copyError, copy }
}
