<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppLayout from './components/AppLayout.vue'
import { loadHealth, loadProjects } from './state/app-state'

// One-time shell bootstrap: health for the status chip, projects for the selector.
onMounted(() => {
  loadHealth()
  loadProjects()
})
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>
</template>
