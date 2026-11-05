<script setup lang="ts">
import Hero from './Hero.vue'
import Volumes3d from './Volumes3d.vue'
import Moods from './Moods.vue'
import Interactions from './Interactions.vue'
import Habillage from './Habillage.vue'
import Sauts from './Sauts.vue'
import Personnalisation from './Personnalisation.vue'
import ClairSombre from './ClairSombre.vue'
import Install from './Install.vue'
import { CHOIX_THEMES, choisirTheme, choixTheme, initTheme } from './theme'

initTheme()
</script>

<template>
  <nav class="nav" aria-label="Sections">
    <div class="wrap">
      <strong>Mochi</strong>
      <div class="nav-liens">
        <a href="#volumes">3D</a>
        <a href="#moods">Moods</a>
        <a href="#interactions">Interactions</a>
        <a href="#accessories">Accessories</a>
        <a href="#theme">Light and dark</a>
        <a href="#jumps">Jumps</a>
        <a href="#customise">Make it yours</a>
        <a href="#install">Install</a>
      </div>
      <div class="theme" role="group" aria-label="Colour theme">
        <button
          v-for="c in CHOIX_THEMES"
          :key="c.id"
          type="button"
          class="theme-bouton"
          :aria-pressed="choixTheme === c.id"
          @click="choisirTheme(c.id)"
        >
          {{ c.label }}
        </button>
      </div>
    </div>
  </nav>
  <main>
    <Hero />
    <Volumes3d />
    <Moods />
    <Interactions />
    <Habillage />
    <ClairSombre />
    <Sauts />
    <Personnalisation />
    <Install />
  </main>
  <footer class="pied">
    <div class="wrap">Mochi, an animated avatar engine. MIT licensed. <a href="app.html">Open the app</a> · <a href="https://github.com/robinnat/mochi">GitHub</a></div>
  </footer>
</template>
