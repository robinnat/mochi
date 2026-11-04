<script setup lang="ts">
import Hero from './Hero.vue'
import Volumes3d from './Volumes3d.vue'
import Moods from './Moods.vue'
import Gestes from './Gestes.vue'
import Sauts from './Sauts.vue'
import Metiers from './Metiers.vue'
import Playground from './Playground.vue'
import Install from './Install.vue'
</script>

<template>
  <nav class="nav" aria-label="Sections">
    <div class="wrap">
      <strong>Mochi</strong>
      <div class="nav-liens">
        <a href="#volumes">3D</a>
        <a href="#moods">Moods</a>
        <a href="#gestures">Gestures</a>
        <a href="#jumps">Jumps</a>
        <a href="#jobs">Accessories</a>
        <a href="#playground">Playground</a>
        <a href="#install">Install</a>
      </div>
    </div>
  </nav>
  <main>
    <Hero />
    <Volumes3d />
    <Moods />
    <Gestes />
    <Sauts />
    <Metiers />
    <Playground />
    <Install />
  </main>
  <footer class="pied">
    <div class="wrap">Mochi, an animated avatar engine. MIT licensed. <a href="app.html">Open the app</a> · <a href="https://github.com/robinnat/mochi">GitHub</a></div>
  </footer>
</template>
