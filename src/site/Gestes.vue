<script setup lang="ts">
import { computed, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { ACTIVITES_SITE, GESTES, type Animation } from './catalog'

const reduit = useReduit()
const TOUTES: Animation[] = [...GESTES, ...ACTIVITES_SITE]
const choisi = ref('hoche')
const anim = computed(() => TOUTES.find((a) => a.id === choisi.value) ?? TOUTES[0]!)
</script>

<template>
  <section id="gestures" class="bloc wrap" aria-labelledby="t-gestes">
    <span class="etiquette">Gestures</span>
    <h2 id="t-gestes">Little gestures, so a crowd never moves in lockstep</h2>
    <p class="chapo">
      An optional layer adds small deterministic movements on top of the measured poses: idle gestures
      every few seconds (picked by a seed), a bounce when touched, sleeping and dejected postures, and seven
      ways of looking busy. Without it, the image is byte for byte the original.
    </p>
    <div class="duo">
      <div class="scene">
        <Lazy :largeur="250" :hauteur="250">
          <MochiBot
            :key="choisi + reduit"
            :size="240"
            shape="cercle"
            color="rose"
            rendu="argile"
            :expression="anim.expression"
            :cycle="anim.cycle"
            :geste="anim.geste"
            :playing="!reduit"
            :frozen-at="reduit ? 1.3 : undefined"
            :label="anim.label"
          />
        </Lazy>
      </div>
      <div class="panneau">
        <div>
          <h3>Idle gestures</h3>
          <div class="chips" role="group" aria-label="Idle gestures">
            <button v-for="a in GESTES" :key="a.id" type="button" class="chip" :aria-pressed="choisi === a.id" @click="choisi = a.id">
              {{ a.label }}
            </button>
          </div>
        </div>
        <div>
          <h3>Activities</h3>
          <div class="chips" role="group" aria-label="Activities">
            <button v-for="a in ACTIVITES_SITE" :key="a.id" type="button" class="chip" :aria-pressed="choisi === a.id" @click="choisi = a.id">
              {{ a.label.replace('Working: ', '') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
