<script setup lang="ts">
import { onMounted, ref } from 'vue'

type Health = { status: string; service: string; version: string }

const health = ref<Health | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    const response = await fetch('/api/health')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    health.value = (await response.json()) as Health
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
})
</script>

<template>
  <main class="boot">
    <h1>Engram Web</h1>
    <p v-if="health" class="ok">
      Conectado: {{ health.service }} v{{ health.version }} ({{ health.status }})
    </p>
    <p v-else-if="error" class="bad">Sin conexión: {{ error }}</p>
    <p v-else>Cargando…</p>
  </main>
</template>
