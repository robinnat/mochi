<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Vivant from './Vivant.vue'
import { MOODS_BOT } from './affiches'
import { useReduit } from './reduced'
import { useVisible } from './motion'
import { HUMEURS_SITE } from './catalog'

/**
 * Les sept humeurs. Elles defilent seules tant que la section est a l'ecran (une barre montre le temps qui
 * reste) ; un clic choisit une humeur et arrete le defilement. Le Mochi n'est pas remonte : `mood` change et
 * le moteur glisse d'une humeur a l'autre.
 */
const DUREE = 4200
const reduit = useReduit()
const zone = ref<HTMLElement | null>(null)
const visible = useVisible(zone)
const actif = ref(0)
const auto = ref(true)
const humeur = computed(() => HUMEURS_SITE[actif.value]!)

let minuteur = 0
watch(
  [visible, auto, actif, reduit],
  ([v, a, , r]) => {
    clearTimeout(minuteur)
    if (v && a && !r) minuteur = window.setTimeout(() => (actif.value = (actif.value + 1) % HUMEURS_SITE.length), DUREE)
  },
  { immediate: true }
)
onBeforeUnmount(() => clearTimeout(minuteur))

function choisir(i: number) {
  auto.value = false
  actif.value = i
}
</script>

<template>
  <section id="moods" ref="zone" class="sec" aria-labelledby="t-moods">
    <div class="wrap moods">
      <div class="moods-texte">
        <p v-reveal class="surtitre">Moods</p>
        <h2 id="t-moods" v-reveal="1" class="titre-sec">Seven moods.<br />One body.</h2>
        <p v-reveal="2" class="chapo">
          A mood changes the face and the way the body moves, and loops until you change it. Set it with
          <code>mood="travaille"</code> or call <code>setMood()</code>.
        </p>
        <ul v-reveal="3" class="moods-liste" role="list">
          <li v-for="(h, i) in HUMEURS_SITE" :key="h.id">
            <button type="button" class="mood" :class="{ on: i === actif }" :aria-pressed="i === actif" @click="choisir(i)">
              <span class="mood-nom">{{ h.label }}</span>
              <code class="mood-id">{{ h.id }}</code>
              <span v-if="i === actif && auto && visible && !reduit" :key="actif" class="mood-barre" :style="{ '--duree': DUREE + 'ms' }" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>
      <div v-reveal="2" class="moods-scene">
        <Vivant
          :key="'m' + reduit"
          :taille="320"
          affiche="moods"
          v-bind="MOODS_BOT"
          :mood="humeur.id"
          :frozen-at="reduit ? 0 : undefined"
          :interactions="false"
          :alt="'A teal Mochi in the mood: ' + humeur.label"
        />
        <p class="moods-legende" aria-live="polite"><strong>{{ humeur.label }}.</strong> {{ humeur.texte }}</p>
      </div>
    </div>
  </section>
</template>
