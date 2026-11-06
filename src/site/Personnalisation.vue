<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * « Make it yours ». Le titre est dans la page tout de suite (l'ancre #customise marche toujours) ; le
 * personnalisateur lui-meme (son code, ses images) n'est charge qu'a l'approche de la section.
 */
const PersoCorps = defineAsyncComponent(() => import('./PersoCorps.vue'))
const zone = ref<HTMLElement | null>(null)
const charger = ref(typeof IntersectionObserver === 'undefined')
let obs: IntersectionObserver | null = null
onMounted(() => {
  if (charger.value || !zone.value) return
  obs = new IntersectionObserver(
    (es) => {
      if (es[es.length - 1]?.isIntersecting) {
        charger.value = true
        obs?.disconnect()
      }
    },
    { rootMargin: '900px 0px' }
  )
  obs.observe(zone.value)
})
onBeforeUnmount(() => obs?.disconnect())
</script>

<template>
  <section id="customise" ref="zone" class="sec perso" aria-labelledby="t-perso">
    <div class="wrap sec-tete">
      <p v-reveal class="surtitre">Customise</p>
      <h2 id="t-perso" v-reveal="1" class="titre-sec">Make it yours.</h2>
      <p v-reveal="2" class="chapo">Pick a style, a shape, any colour, a mood and a few accessories. The preview is the real component, and the code below follows every choice.</p>
    </div>
    <PersoCorps v-if="charger" />
    <div v-else class="perso-attente" aria-hidden="true" />
  </section>
</template>
