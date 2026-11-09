<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { ACCESSOIRE_IDS, ACCESSOIRE_LABEL } from './catalog'

const reduit = useReduit()
const COULEURS = ['rouge', 'ciel', 'ambre', 'vert', 'magenta', 'orange', 'bleu', 'citron', 'turquoise']
</script>

<template>
  <section id="jobs" class="bloc wrap" aria-labelledby="t-metiers">
    <span class="etiquette">Tools</span>
    <h2 id="t-metiers">A tool for every trade</h2>
    <p class="chapo">
      Nine small animated objects drawn in code, each with the gesture that goes with it: the mochi looks at
      its notebook, types, claps, loops the chart. The body keeps its exact size; the object adapts to the shape.
    </p>
    <div class="grille" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
      <figure v-for="(id, i) in ACCESSOIRE_IDS" :key="id" class="carte">
        <Lazy :largeur="140" :hauteur="140">
          <MochiBot
            :size="112"
            shape="cercle"
            :color="COULEURS[i]"
            rendu="3d"
            :accessoire="id"
            :frozen-at="reduit ? 2.2 : undefined"
            :playing="!reduit"
            :cycle="[{ state: 'idle', duration: 6 }]"
            :label="ACCESSOIRE_LABEL[id]"
          />
        </Lazy>
        <figcaption>{{ ACCESSOIRE_LABEL[id] }}</figcaption>
      </figure>
    </div>
  </section>
</template>
