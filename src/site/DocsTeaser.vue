<script setup lang="ts">
import CodeBlock from './CodeBlock.vue'
import { EXEMPLE_RAPIDE } from '@/docs/exemples'
</script>

<template>
  <section id="start" class="sec" aria-labelledby="t-start">
    <div class="wrap demarrer">
      <div>
        <p v-reveal class="surtitre">Get started</p>
        <h2 id="t-start" v-reveal="1" class="titre-sec">A few lines<br />of code.</h2>
        <p v-reveal="2" class="chapo">
          One Vue 3 component, a handful of props. Three.js loads only when a 3D Mochi shows up. The npm package is coming
          soon; today you add it from the repository.
        </p>
        <div v-reveal="3" class="actions gauche">
          <a class="btn primaire" href="/docs">Read the docs <span aria-hidden="true">→</span></a>
          <a class="btn" href="https://github.com/robinnat/mochi">View on GitHub</a>
        </div>
      </div>
      <div v-reveal="2">
        <CodeBlock :code="EXEMPLE_RAPIDE" titre="App.vue" />
      </div>
    </div>
  </section>
</template>
