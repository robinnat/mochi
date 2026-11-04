<script setup lang="ts">
import { ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { FORMES_3D } from './catalog'
import Studio3d from './Studio3d.vue'

const contour = ref(false)
const reflet = ref(true)
</script>

<template>
  <section id="volumes" class="bloc wrap" aria-labelledby="t-3d">
    <span class="etiquette">3D</span>
    <h2 id="t-3d">Real 3D, with a soft material</h2>
    <p class="chapo">
      Sphere, rounded cube, pyramid, bevelled star, flower and hexagon, built from the same outline as
      the 2D shapes. The eyes always face you. Turn the model with your finger or mouse, and give it a mood or a gesture. Three.js loads only when you scroll here, and every card
      below draws through one shared WebGL context.
    </p>
    <Studio3d />
    <div class="chips" style="margin-top: 26px">
      <label class="case"><input v-model="contour" type="checkbox" /> Cartoon outline</label>
      <label class="case" style="margin-left: 14px"><input v-model="reflet" type="checkbox" /> Soft highlight</label>
    </div>
    <div class="grille">
      <figure v-for="f in FORMES_3D" :key="f.id" class="carte">
        <Lazy garder :largeur="140" :hauteur="140">
          <MochiBot
            :size="136"
            :shape="f.id"
            :color="f.couleur"
            rendu="3d"
            :contour="contour"
            :reflet="reflet"
            :frozen-at="1.2"
            :label="`${f.label}, 3D`"
          />
        </Lazy>
        <figcaption>{{ f.label }}</figcaption>
      </figure>
    </div>
    <p class="note" style="margin-top: 12px">
      Without WebGL, the 3D style falls back to the clay SVG, which is already on screen.
    </p>
  </section>
</template>
