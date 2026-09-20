<script setup lang="ts">
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed } from 'vue'

const props = defineProps<{ content: string }>()

// Sanitizing is mandatory, not defensive: observation content is written by agents and
// imported from other tools, so it is untrusted input. Feeding it to v-html without
// DOMPurify would turn any stored note into a stored-XSS vector against this SPA.
const html = computed(() =>
  DOMPurify.sanitize(marked.parse(props.content, { async: false })).replace(
    // Post-processing beats a custom renderer here: DOMPurify drops `target`, so the
    // attributes are added after sanitizing. The lookahead keeps the existing href value
    // untouched; only absolute http(s) links are external.
    /<a href="(?=https?:\/\/)/g,
    '<a target="_blank" rel="noopener noreferrer" href="',
  ),
)
</script>

<template>
  <div class="markdown" v-html="html"></div>
</template>
