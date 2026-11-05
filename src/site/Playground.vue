<script setup lang="ts">
import { computed, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { COULEUR_IDS, COLOR_LABEL, FORME_IDS, HUMEURS_SITE, SHAPE_LABEL, hexDe } from './catalog'
import { TAILLES_PIXEL, type RenduId, type TaillePixelId } from '@/ui/rendu'
import { STYLES_SITE } from './style'
import { extraitCode } from './extrait'
import type { MoodId } from '@/bot/humeurs'

const reduit = useReduit()

const forme = ref('etoile')
const couleur = ref('violet')
const rendu = ref<RenduId>('3d')
const pixel = ref<TaillePixelId>('moyen')
const contour = ref(false)
const reflet = ref(true)
const mood = ref<MoodId>('repos')
/** Changer la cle remonte le Mochi : il arrive de nouveau et dit coucou. */
const arrivee = ref(0)
const salut = ref(true)

const RENDUS = STYLES_SITE
const cle = computed(() => [forme.value, rendu.value, mood.value, arrivee.value, reduit.value].join('|'))

const extrait = computed(() =>
  extraitCode({
    forme: forme.value,
    couleur: couleur.value,
    rendu: rendu.value,
    pixel: pixel.value,
    contour: contour.value,
    reflet: reflet.value,
    mood: mood.value,
    coucou: salut.value
  })
)

const copie = ref(false)
async function copier() {
  try {
    await navigator.clipboard.writeText(extrait.value)
    copie.value = true
    setTimeout(() => (copie.value = false), 1600)
  } catch {
    // presse-papiers refuse : le texte reste selectionnable
  }
}
</script>

<template>
  <section id="playground" class="bloc wrap" aria-labelledby="t-play">
    <span class="etiquette">Playground</span>
    <h2 id="t-play">Build your own</h2>
    <p class="chapo">Change anything. The preview is the real component, and the snippet below follows your choices.</p>
    <div class="duo">
      <div>
        <div class="scene large">
          <Lazy :largeur="270" :hauteur="270">
            <MochiBot
              :key="cle"
              :size="260"
              :shape="forme"
              :color="couleur"
              :rendu="rendu"
              :pixel="pixel"
              :contour="contour"
              :reflet="reflet"
              :mood="mood"
              :coucou="salut && arrivee > 0 && !reduit"
              :frozen-at="reduit ? 1 : undefined"
              label="Your Mochi"
            />
          </Lazy>
        </div>
        <div style="margin-top: 10px"><button type="button" class="btn" @click="arrivee++">Replay the hello</button></div>
        <div class="code" style="margin-top: 12px"><button type="button" class="copier" @click="copier">{{ copie ? 'Copied' : 'Copy' }}</button>{{ extrait }}</div>
      </div>

      <div class="panneau">
        <div>
          <h3>Render</h3>
          <div class="chips" role="group" aria-label="Render style">
            <button v-for="r in RENDUS" :key="r.id" type="button" class="chip" :aria-pressed="rendu === r.id" @click="rendu = r.id">{{ r.label }}</button>
          </div>
          <div v-if="rendu === 'pixel3d'" class="chips" style="margin-top: 8px" role="group" aria-label="Pixel size">
            <button v-for="p in TAILLES_PIXEL" :key="p.id" type="button" class="chip" :aria-pressed="pixel === p.id" @click="pixel = p.id">
              {{ p.id === 'gros' ? 'Large' : p.id === 'moyen' ? 'Medium' : 'Fine' }} pixels
            </button>
          </div>
          <div style="margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap">
            <label v-if="rendu === 'flat3d'" class="case"><input v-model="contour" type="checkbox" /> Outline</label>
            <label v-if="rendu === '3d'" class="case"><input v-model="reflet" type="checkbox" /> Soft highlight</label>
          </div>
        </div>

        <div>
          <h3>Shape</h3>
          <div class="chips" role="group" aria-label="Shape">
            <button v-for="id in FORME_IDS" :key="id" type="button" class="chip" :aria-pressed="forme === id" @click="forme = id">{{ SHAPE_LABEL[id] }}</button>
          </div>
        </div>

        <div>
          <h3>Colour: {{ COLOR_LABEL[couleur] }}</h3>
          <div class="pastilles" role="group" aria-label="Colour">
            <button
              v-for="id in COULEUR_IDS"
              :key="id"
              type="button"
              class="pastille"
              :style="{ background: hexDe(id) }"
              :aria-label="COLOR_LABEL[id]"
              :aria-pressed="couleur === id"
              @click="couleur = id"
            />
          </div>
        </div>

        <div>
          <h3>Mood</h3>
          <div class="chips" role="group" aria-label="Mood">
            <button v-for="h in HUMEURS_SITE" :key="h.id" type="button" class="chip" :aria-pressed="mood === h.id" @click="mood = h.id">{{ h.label }}</button>
          </div>
        </div>
        <p v-if="reduit" class="note">Reduced motion is on: the preview shows a still frame.</p>
      </div>
    </div>
  </section>
</template>
