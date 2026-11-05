<script setup lang="ts">
import { ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { INTERACTIONS_SITE } from './catalog'

const reduit = useReduit()
/** Changer la cle remonte le Mochi : il arrive de nouveau, et dit coucou. */
const arrivee = ref(0)
</script>

<template>
  <section id="interactions" class="bloc wrap" aria-labelledby="t-inter">
    <span class="etiquette">Interactions</span>
    <h2 id="t-inter">It reacts to you</h2>
    <p class="chapo">
      The Mochi below is live. Move the pointer over it, tap it, double tap it, press and hold, or spin it
      fast. Each gesture has its own reaction, and it goes back to its mood afterwards.
    </p>
    <div class="duo">
      <div class="scene large">
        <Lazy :largeur="270" :hauteur="270">
          <MochiBot
            :key="arrivee + '-' + reduit"
            :size="260"
            shape="etoile"
            color="ambre"
            rendu="3d"
            mood="repos"
            :coucou="!reduit"
            :frozen-at="reduit ? 1 : undefined"
            label="A yellow star Mochi that reacts to the pointer"
          />
        </Lazy>
        <button type="button" class="btn" @click="arrivee++">Say hello again</button>
      </div>
      <div class="panneau">
        <ul class="liste-inter">
          <li v-for="i in INTERACTIONS_SITE" :key="i.geste">
            <strong>{{ i.geste }}</strong>
            <span>{{ i.nom }}. {{ i.texte }}</span>
          </li>
        </ul>
        <p class="note">
          On by default (<code>interactions</code>); switch them off with <code>:interactions="false"</code>, and cap the
          frame rate with <code>fps</code>.
          <template v-if="reduit"> Reduced motion is on: the reactions are off here.</template>
        </p>
      </div>
    </div>
  </section>
</template>
