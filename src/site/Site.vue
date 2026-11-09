<script setup lang="ts">
import Nav from './Nav.vue'
import Hero from './Hero.vue'
import HeroA from './HeroA.vue'
import HeroB from './HeroB.vue'
import HeroC from './HeroC.vue'
import { heroChoisi } from './heros'
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
/** Directions de hero a l'essai (`?hero=a|b|c`) ; le hero actuel reste celui par defaut. */
const heros = { a: HeroA, b: HeroB, c: HeroC }
const id = heroChoisi()
const hero = id ? heros[id] : Hero
</script>

<template>
  <Nav />
  <main>
    <component :is="hero" />
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
