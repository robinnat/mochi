<script setup lang="ts">
import { computed, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { ETATS, STATE_LABEL, cycleDe } from './catalog'
import { POSES, type StateId } from '@/bot/states'

const reduit = useReduit()
const choisi = ref<StateId>('wink')
const cycle = computed(() => cycleDe(choisi.value))
</script>

<template>
  <section id="moods" class="bloc wrap" aria-labelledby="t-moods">
    <span class="etiquette">Animation</span>
    <h2 id="t-moods">Five measured face moods</h2>
    <p class="chapo">
      Every mood lives on the face: eyes, lids and expression. They were measured frame by frame off a
      reference animation. Pick one to watch it play; moods that do not loop go back to rest and replay.
    </p>
    <div class="duo">
      <div class="scene">
        <Lazy :largeur="250" :hauteur="250">
          <MochiBot
            v-if="reduit"
            :key="'f' + choisi"
            :size="240"
            shape="cercle"
            color="violet"
            rendu="argile"
            :state="choisi"
            :frozen-at="POSES[choisi]"
            :label="STATE_LABEL[choisi]"
          />
          <MochiBot
            v-else
            :key="choisi"
            :size="240"
            shape="cercle"
            color="violet"
            rendu="argile"
            :cycle="cycle"
            :playing="true"
            :label="STATE_LABEL[choisi]"
          />
        </Lazy>
      </div>
      <div class="panneau">
        <div>
          <h3>State</h3>
          <div class="chips" role="group" aria-label="Choose a state">
            <button
              v-for="id in ETATS"
              :key="id"
              type="button"
              class="chip"
              :aria-pressed="choisi === id"
              @click="choisi = id"
            >
              {{ STATE_LABEL[id] }}
            </button>
          </div>
        </div>
        <p v-if="reduit" class="note">Reduced motion is on: showing the most readable frame of each state.</p>
      </div>
    </div>
  </section>
</template>
