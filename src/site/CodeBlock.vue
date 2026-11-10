<script setup lang="ts">
import { computed, ref } from 'vue'
import { surligner } from './code'

/** Bloc de code colore, avec un titre (nom de fichier ou langage) et un bouton Copier. */
const props = withDefaults(defineProps<{ code: string; titre?: string }>(), { titre: '' })
const html = computed(() => surligner(props.code))
const copie = ref(false)
let minuteur = 0
async function copier() {
  try {
    await navigator.clipboard.writeText(props.code)
    copie.value = true
    clearTimeout(minuteur)
    minuteur = window.setTimeout(() => (copie.value = false), 1600)
  } catch {
    // presse-papiers refuse : le texte reste selectionnable
  }
}
</script>

<template>
  <div class="cb">
    <div class="cb-tete">
      <span class="cb-titre">{{ titre }}</span>
      <button type="button" class="cb-copier" :class="{ ok: copie }" @click="copier">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path v-if="!copie" d="M5 5V3.5A1.5 1.5 0 0 1 6.5 2h6A1.5 1.5 0 0 1 14 3.5v6a1.5 1.5 0 0 1-1.5 1.5H11M3.5 5h6A1.5 1.5 0 0 1 11 6.5v6A1.5 1.5 0 0 1 9.5 14h-6A1.5 1.5 0 0 1 2 12.5v-6A1.5 1.5 0 0 1 3.5 5Z" fill="none" stroke="currentColor" stroke-width="1.4" />
          <path v-else d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ copie ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>
    <pre class="cb-code"><code v-html="html" /></pre>
  </div>
</template>
