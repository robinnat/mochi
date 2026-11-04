<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Ne monte son contenu que lorsque l'element est a l'ecran (IntersectionObserver).
 * `garder` : une fois monte, il reste (vignettes figees, dont le rendu n'a pas de boucle).
 * Sinon il est DEmonte en sortant de l'ecran : une demo animee ne tourne que si on la voit.
 * Sans IntersectionObserver (navigateur ancien), le contenu est monte d'emblee.
 */
const props = withDefaults(defineProps<{ garder?: boolean; largeur?: number; hauteur?: number }>(), {
  garder: false,
  largeur: 0,
  hauteur: 0
})
const racine = ref<HTMLElement | null>(null)
const visible = ref(typeof IntersectionObserver === 'undefined')
let obs: IntersectionObserver | null = null

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !racine.value) return
  obs = new IntersectionObserver(
    (entrees) => {
      const e = entrees[entrees.length - 1]
      if (!e) return
      visible.value = e.isIntersecting
      if (e.isIntersecting && props.garder) obs?.disconnect()
    },
    { rootMargin: '160px' }
  )
  obs.observe(racine.value)
})
onBeforeUnmount(() => obs?.disconnect())
</script>

<template>
  <div
    ref="racine"
    class="lazy"
    :style="{ width: largeur ? largeur + 'px' : undefined, height: hauteur ? hauteur + 'px' : undefined }"
  >
    <slot v-if="visible" />
  </div>
</template>

<style scoped>
.lazy {
  display: grid;
  place-items: center;
  max-width: 100%;
}
</style>
