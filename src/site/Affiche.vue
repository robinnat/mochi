<script setup lang="ts">
import { computed } from 'vue'
import { urlAffiche } from './affiches'
import { themeEffectif } from './theme'

/** Un Mochi fige, en image pre-rendue de la vraie 3D (`public/rendus/`), dans le theme de la page. */
const props = withDefaults(defineProps<{ nom: string; taille: number; alt?: string; eager?: boolean }>(), { alt: '', eager: false })
const src = computed(() => urlAffiche(props.nom, themeEffectif.value))
</script>

<template>
  <img class="affiche" :src="src" :width="taille" :height="taille" :alt="alt" :loading="eager ? 'eager' : 'lazy'" decoding="async" draggable="false" />
</template>
