<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Observation } from '../api/types'
import { formatDate } from '../state/app-state'

const props = defineProps<{ observation: Observation; rank?: number }>()

// Tiny Markdown stripper for the preview: a regex is enough here, so marked is not
// pulled into the list path (the full renderer only runs in the detail view).
const MARKDOWN_PUNCTUATION = /[#*_`>\[\]()!~|-]+/g

const preview = computed(() => {
  const plain = props.observation.content
    .replace(MARKDOWN_PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 200 ? `${plain.slice(0, 200).trimEnd()}…` : plain
})
</script>

<template>
  <article class="card">
    <RouterLink class="card-title" :to="`/observations/${observation.id}`">
      <span v-if="observation.pinned" class="pin" title="Fijada" aria-label="Fijada">★</span>
      {{ observation.title }}
    </RouterLink>

    <div class="card-meta">
      <span v-if="rank !== undefined" class="badge badge-rank">#{{ rank }}</span>
      <span class="badge">{{ observation.type }}</span>
      <span class="badge">{{ observation.project || 'sin proyecto' }}</span>
      <span class="badge">{{ observation.scope || 'sin scope' }}</span>
      <time :datetime="observation.created_at">{{ formatDate(observation.created_at) }}</time>
    </div>

    <p class="card-preview">{{ preview }}</p>

    <div v-if="observation.revision_count > 1 || observation.duplicate_count > 1" class="card-meta">
      <span v-if="observation.revision_count > 1" class="badge">
        {{ observation.revision_count }} revisiones
      </span>
      <span v-if="observation.duplicate_count > 1" class="badge">
        {{ observation.duplicate_count }} duplicados
      </span>
    </div>
  </article>
</template>
