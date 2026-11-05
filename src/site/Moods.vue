<script setup lang="ts">
import { computed, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { HUMEURS_SITE } from './catalog'
import type { MoodId } from '@/bot/humeurs'

const reduit = useReduit()
const choisi = ref<MoodId>('repos')
const humeur = computed(() => HUMEURS_SITE.find((h) => h.id === choisi.value)!)
</script>

<template>
  <section id="moods" class="bloc wrap" aria-labelledby="t-moods">
    <span class="etiquette">Moods</span>
    <h2 id="t-moods">Seven moods, one soft body</h2>
    <p class="chapo">
      A mood changes the face and the way the body moves, and it plays on a loop until you change it. Set one with
      <code>mood="travaille"</code>, or call <code>setMood()</code> from your code. The ids are French (<code>repos</code>, <code>reflechit</code>, <code>travaille</code>, <code>attend</code>, <code>termine</code>, <code>bloque</code>, <code>dort</code>); English names such as <code>working</code> work too. Pick one to watch it.
    </p>
    <div class="duo">
      <div class="scene">
        <Lazy :largeur="250" :hauteur="250">
          <MochiBot
            :key="choisi + reduit"
            :size="240"
            shape="squircle"
            color="turquoise"
            rendu="3d"
            :mood="choisi"
            :frozen-at="reduit ? 1 : undefined"
            :interactions="false"
            :label="'A turquoise Mochi in the mood: ' + humeur.label"
          />
        </Lazy>
      </div>
      <div class="panneau">
        <div>
          <h3>Mood</h3>
          <div class="chips" role="group" aria-label="Choose a mood">
            <button v-for="h in HUMEURS_SITE" :key="h.id" type="button" class="chip" :aria-pressed="choisi === h.id" @click="choisi = h.id">
              {{ h.label }}
            </button>
          </div>
        </div>
        <p class="texte-humeur" aria-live="polite">
          <strong>{{ humeur.label }}.</strong> {{ humeur.texte }}
        </p>
        <p v-if="reduit" class="note">Reduced motion is on: showing the most readable frame of each mood.</p>
      </div>
    </div>
  </section>
</template>
