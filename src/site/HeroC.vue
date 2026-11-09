<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Vivant from './Vivant.vue'
import HeroChiffres from './HeroChiffres.vue'
import { MOODS_BOT } from './affiches'
import { HUMEURS_SITE } from './catalog'
import { useReduit } from './reduced'
import { useLargeur } from './motion'
import { useSuiviPointeur } from './heroSuivi'

/**
 * Direction C : « un visage pour chaque etat ». Le message : Mochi montre ce que fait ton app (il reflechit, travaille,
 * a fini...) par un regard et une attitude, pas par un spinner. Un seul Mochi vivant ; les humeurs defilent seules,
 * un tap sur une puce en choisit une et arrete le defilement. Les humeurs sont les vraies humeurs du moteur.
 */
const reduit = useReduit()
const largeur = useLargeur()
const taille = computed(() => (largeur.value >= 1100 ? 380 : largeur.value >= 700 ? 320 : 250))
const scene = ref<HTMLElement | null>(null)
const vivant = ref<InstanceType<typeof Vivant> | null>(null)
const { yaw } = useSuiviPointeur(scene, (c) => vivant.value?.bot?.regarder?.(c), reduit)

const ETATS = ['reflechit', 'travaille', 'termine', 'attend', 'dort'].map((id) => HUMEURS_SITE.find((h) => h.id === id)!)
const PAROLES: Record<string, string> = { reflechit: 'Thinking…', travaille: 'Working…', termine: 'Done!', attend: 'Waiting for you', dort: 'Asleep' }
const rang = ref(1)
const etat = computed(() => ETATS[rang.value % ETATS.length]!)
let minuteur = 0
function arreter() {
  if (minuteur) clearInterval(minuteur)
  minuteur = 0
}
function choisir(i: number) {
  arreter()
  rang.value = i
}
onMounted(() => {
  if (reduit.value) return
  minuteur = window.setInterval(() => (rang.value = (rang.value + 1) % ETATS.length), 3800)
})
onBeforeUnmount(arreter)
</script>

<template>
  <header id="top" class="hx hx-c">
    <div class="hero-fond" aria-hidden="true" />
    <div class="hx-in hx-duo">
      <div class="hx-texte">
        <p class="hero-badge rv-load" style="--d: 0"><span class="point" aria-hidden="true" /> Open source, MIT</p>
        <h1 class="hx-titre rv-load" style="--d: 1">A face for <span class="accent">every state</span> of your app.</h1>
        <p class="hx-chapo rv-load" style="--d: 2">
          Thinking, working, done: Mochi shows it with a look and a posture instead of a spinner. A 3D avatar you drop into
          your web app.
        </p>
        <div class="actions hx-actions rv-load" style="--d: 3">
          <a class="btn primaire" href="/app">Try the app <span aria-hidden="true">→</span></a>
          <a class="btn" href="/docs">Read the docs</a>
        </div>
      </div>

      <div ref="scene" class="hx-scene hx-scene-c" :style="{ '--t': taille + 'px' }">
        <div class="hx-scene-card" aria-hidden="true" />
        <p class="hx-parole" aria-live="polite"><span class="point" aria-hidden="true" /> {{ PAROLES[etat.id] }}</p>
        <Vivant
          ref="vivant"
          :key="'c' + reduit"
          :taille="taille"
          affiche="moods"
          eager
          marge="0px"
          v-bind="MOODS_BOT"
          :mood="etat.id"
          :yaw="yaw"
          :frozen-at="reduit ? 0 : undefined"
          :alt="'A teal Mochi in the mood: ' + etat.label"
        />
        <div class="hx-puces hx-etats" role="group" aria-label="Pick a mood">
          <button
            v-for="(h, i) in ETATS"
            :key="h.id"
            type="button"
            class="hx-puce"
            :class="{ on: etat.id === h.id }"
            :aria-pressed="etat.id === h.id"
            @click="choisir(i)"
          >
            {{ h.label }}
          </button>
        </div>
      </div>
    </div>
    <HeroChiffres />
  </header>
</template>
