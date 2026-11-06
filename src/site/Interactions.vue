<script setup lang="ts">
import { ref } from 'vue'
import Vivant from './Vivant.vue'
import { INTER_BOT } from './affiches'
import { useReduit } from './reduced'
import { INTERACTIONS_SITE } from './catalog'

const reduit = useReduit()
/** Changer la cle remonte le Mochi : il arrive de nouveau, et dit coucou (sans affiche : il pousse du sol). */
const arrivee = ref(0)
</script>

<template>
  <section id="interactions" class="sec" aria-labelledby="t-inter">
    <div class="wrap inter">
      <div v-reveal class="inter-scene">
        <span class="inter-invite" aria-hidden="true">Poke me</span>
        <Vivant
          :key="arrivee + '-' + reduit"
          :taille="290"
          :affiche="arrivee === 0 || reduit ? 'inter' : null"
          v-bind="INTER_BOT"
          :coucou="arrivee > 0 && !reduit"
          :frozen-at="reduit ? 0 : undefined"
          alt="A yellow star Mochi that reacts to the pointer: hover, tap, double tap, press and hold, or shake it"
        />
        <button type="button" class="btn petit" @click="arrivee++">Say hello again</button>
      </div>
      <div class="inter-texte">
        <p v-reveal class="surtitre">Interactions</p>
        <h2 id="t-inter" v-reveal="1" class="titre-sec">It reacts<br />to you.</h2>
        <p v-reveal="2" class="chapo">
          The star is live. Each gesture has its own reaction, then it goes back to its mood. On by default; turn them off
          with <code>:interactions="false"</code>.
        </p>
        <ul class="inter-liste">
          <li v-for="(i, k) in INTERACTIONS_SITE" :key="i.geste" v-reveal="k">
            <span class="inter-geste">{{ i.geste }}</span>
            <span class="inter-nom">{{ i.nom }}</span>
            <span class="inter-detail">{{ i.texte }}</span>
          </li>
        </ul>
        <p v-if="reduit" class="note">Reduced motion is on: the reactions are off here.</p>
      </div>
    </div>
  </section>
</template>
