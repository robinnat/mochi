<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import type { Block } from '@/bot/cycles'

const reduit = useReduit()

// un repos, un clin d'oeil, des yeux ecarquilles, une reflexion : le Mochi du haut de page
const cycle: Block[] = [
  { state: 'idle', duration: 3.2 },
  { state: 'wink', duration: 1.6 },
  { state: 'idle', duration: 2.6 },
  { state: 'wide', duration: 1.8 },
  { state: 'idle', duration: 2.6 },
  { state: 'thinking', duration: 2.6 }
]
</script>

<template>
  <header class="hero wrap">
    <div class="hero-scene">
      <Lazy :largeur="290" :hauteur="290">
        <MochiBot
          v-if="reduit"
          :size="280"
          shape="cercle"
          color="violet"
          rendu="3d"
          :frozen-at="1"
          label="A Mochi, a round purple animated avatar"
        />
        <MochiBot
          v-else
          :size="280"
          shape="cercle"
          color="violet"
          rendu="3d"
          :cycle="cycle"
          :playing="true"
          follow
          label="A Mochi, a round purple animated avatar"
        />
      </Lazy>
      <div class="satellites" aria-hidden="true">
        <Lazy garder :largeur="76" :hauteur="76"><MochiBot :size="72" shape="etoile" color="ambre" rendu="3d" :frozen-at="1" label="" /></Lazy>
        <Lazy garder :largeur="76" :hauteur="76"><MochiBot :size="72" shape="nuage" color="rose" rendu="3d" :frozen-at="1" label="" /></Lazy>
        <Lazy garder :largeur="76" :hauteur="76"><MochiBot :size="72" shape="fleur" color="turquoise" rendu="3d" :frozen-at="1" label="" /></Lazy>
        <Lazy garder :largeur="76" :hauteur="76"><MochiBot :size="72" shape="goutte" color="bleu" rendu="3d" :frozen-at="1" label="" /></Lazy>
      </div>
    </div>
    <div>
      <h1>Mochi</h1>
      <p class="chapo">
        A tiny animated avatar engine for the web. One soft shape that morphs through five face moods,
        in real 3D, in three styles: Soft, Flat and Pixel. Drawn in code, no animation library.
      </p>
      <div class="actions">
        <a class="btn primaire" href="#playground">Try the playground</a>
        <a class="btn" href="#install">Install</a>
        <a class="btn" href="app.html">Open the app</a>
      </div>
    </div>
  </header>
</template>
