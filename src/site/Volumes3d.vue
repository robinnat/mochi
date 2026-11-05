<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { FORMES_3D } from './catalog'
import Studio3d from './Studio3d.vue'
import { STYLES_SITE, contourSite, ombreSite, refletSite, styleSite } from './style'
</script>

<template>
  <section id="volumes" class="bloc wrap" aria-labelledby="t-3d">
    <span class="etiquette">3D</span>
    <h2 id="t-3d">Real 3D, in three styles</h2>
    <p class="chapo">
      Eleven shapes, all with a real volume you can look at from any side. The eyes always face you. Turn the model with your finger or mouse, and set how it is drawn: style, shadow and outline. Three.js loads only when you scroll here, and every card
      below draws through one shared WebGL context.
    </p>
    <div class="chips" style="margin-top: 18px" role="group" aria-label="3D style">
      <button v-for="s in STYLES_SITE" :key="s.id" type="button" class="chip" :aria-pressed="styleSite === s.id" @click="styleSite = s.id">
        {{ s.label }}
      </button>
      <label class="case" style="margin-left: 14px"><input v-model="ombreSite" type="checkbox" /> Shadow</label>
      <label class="case" :class="{ eteint: styleSite !== 'flat3d' }" style="margin-left: 14px">
        <input v-model="contourSite" type="checkbox" :disabled="styleSite !== 'flat3d'" /> Outline<span v-if="styleSite !== 'flat3d'" class="note"> (Flat)</span>
      </label>
      <label v-if="styleSite === '3d'" class="case" style="margin-left: 14px"><input v-model="refletSite" type="checkbox" /> Soft highlight</label>
    </div>
    <Studio3d />
    <div class="grille">
      <figure v-for="f in FORMES_3D" :key="f.id" class="carte">
        <Lazy garder :largeur="140" :hauteur="140">
          <MochiBot
            :size="136"
            :shape="f.id"
            :color="f.couleur"
            :rendu="styleSite"
            :contour="contourSite"
            :reflet="refletSite"
            :ombre="ombreSite"
            :frozen-at="1.2"
            :label="`${f.label}, 3D`"
          />
        </Lazy>
        <figcaption>{{ f.label }}</figcaption>
      </figure>
    </div>
    <p class="note" style="margin-top: 12px">
      Without WebGL there is nothing to turn: the page keeps a still drawing of the mochi.
    </p>
  </section>
</template>
