<script setup lang="ts">
import Nav from './Nav.vue'
import Hero from './Hero.vue'
import Styles from './Styles.vue'
import Formes from './Formes.vue'
import Moods from './Moods.vue'
import Interactions from './Interactions.vue'
import Bento from './Bento.vue'
import Personnalisation from './Personnalisation.vue'
import DocsTeaser from './DocsTeaser.vue'
import Pied from './Pied.vue'
import { initTheme } from './theme'

initTheme()
</script>

<template>
  <Nav />
  <main>
    <Hero />
    <Styles />
    <Formes />
    <Moods />
    <Interactions />
    <Bento />
    <Personnalisation />
    <DocsTeaser />
  </main>
  <Pied />
</template>
