<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { ACCESSOIRE_IDS, ACCESSOIRE_LABEL, PORTE_IDS_SITE, PORTE_LABEL } from './catalog'

const reduit = useReduit()
const COULEURS = ['violet', 'rose', 'turquoise', 'ambre', 'bleu', 'vert', 'orange', 'violet', 'rose']
</script>

<template>
  <section id="jobs" class="bloc wrap" aria-labelledby="t-metiers">
    <span class="etiquette">Accessories</span>
    <h2 id="t-metiers">A tool for every trade, and something to wear</h2>
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
            rendu="argile"
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
    <h3 class="sous">And worn on the body</h3>
    <p class="chapo" style="margin-top: 8px">
      Glasses, hats, a bow, a crown and headphones are placed on the mochi again at every frame, so they follow
      its body, its eyes and its mood in every style, in real 3D too. Lenses are never opaque: a wink still reads
      through sunglasses.
    </p>
    <div class="grille" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); margin-top: 18px">
      <figure v-for="(id, i) in PORTE_IDS_SITE" :key="id" class="carte">
        <Lazy :largeur="140" :hauteur="140">
          <MochiBot
            :size="112"
            shape="cercle"
            :color="COULEURS[(i + 3) % 9]"
            rendu="argile"
            :porte="id"
            :frozen-at="reduit ? 1 : undefined"
            :playing="!reduit"
            :cycle="[{ state: 'idle', duration: 3 }, { state: 'wink', duration: 1.6 }, { state: 'wide', duration: 1.8 }]"
            :label="PORTE_LABEL[id]"
          />
        </Lazy>
        <figcaption>{{ PORTE_LABEL[id] }}</figcaption>
      </figure>
    </div>
  </section>
</template>
