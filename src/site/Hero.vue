<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'

const reduit = useReduit()

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
          mood="repos"
          follow
          coucou
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
        A tiny animated avatar engine for the web. One soft shape with seven moods that reacts when you
        touch it, in real 3D, in three styles: Soft, Flat and Pixel. Light and dark, with accessories you can mix
        and colour. Drawn in code, no animation library.
      </p>
      <div class="actions">
        <a class="btn primaire" href="#interactions">Say hello</a>
        <a class="btn" href="#playground">Playground</a>
        <a class="btn" href="#install">Install</a>
        <a class="btn" href="app.html">Open the app</a>
      </div>
    </div>
  </header>
</template>
