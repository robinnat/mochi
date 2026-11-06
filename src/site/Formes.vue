<script setup lang="ts">
import { computed, ref } from 'vue'
import Affiche from './Affiche.vue'
import { FORMES_3D } from './catalog'
import { STYLES_SITE } from './style'
import type { RenduId } from '@/ui/rendu'
import { useLargeur } from './motion'

/** Les douze formes, images figees (un rendu chacune, aucune boucle), qui apparaissent en cascade. */
const style = ref<RenduId>('3d')
const largeur = useLargeur()
const taille = computed(() => (largeur.value >= 1100 ? 128 : largeur.value >= 760 ? 104 : 88))
</script>

<template>
  <section id="shapes" class="sec" aria-labelledby="t-formes">
    <div class="wrap sec-tete sec-tete-ligne">
      <div>
        <p v-reveal class="surtitre">Shapes</p>
        <h2 id="t-formes" v-reveal="1" class="titre-sec">Twelve shapes.<br />Same soul.</h2>
      </div>
      <div v-reveal="2" class="segment" role="group" aria-label="Style of the shapes">
        <button v-for="s in STYLES_SITE" :key="s.id" type="button" :aria-pressed="style === s.id" @click="style = s.id">{{ s.label }}</button>
      </div>
    </div>
    <div class="wrap">
      <ul class="formes" aria-label="The twelve shapes">
        <li v-for="(f, i) in FORMES_3D" :key="f.id" v-reveal="i % 6">
          <div class="forme">
            <div class="forme-image">
              <Affiche :nom="`forme-${f.id}-${style}`" :taille="taille" :alt="`${f.label} Mochi`" />
            </div>
            <span class="forme-nom">{{ f.label }}</span>
            <code class="forme-id">{{ f.id }}</code>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>
