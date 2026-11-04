<script setup lang="ts">
import { computed, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import {
  ACCESSOIRE_IDS,
  ACCESSOIRE_LABEL,
  PORTE_IDS_SITE,
  PORTE_LABEL,
  ACTIVITES_SITE,
  COULEUR_IDS,
  COLOR_LABEL,
  ETATS,
  FORME_IDS,
  GESTES,
  SHAPE_LABEL,
  STATE_LABEL,
  cycleDe,
  hexDe,
  type Animation
} from './catalog'
import { POSES, type StateId } from '@/bot/states'
import { TAILLES_PIXEL, type RenduId, type TaillePixelId } from '@/ui/rendu'
import type { AccessoireId } from '@/bot/accessoires'
import { STYLES_SITE } from './style'
import { extraitCode } from './extrait'
import type { PorteId } from '@/bot/portes'
import en from '@/i18n/locales/en'

const reduit = useReduit()

const forme = ref('etoile')
const couleur = ref('violet')
const rendu = ref<RenduId>('3d')
const pixel = ref<TaillePixelId>('moyen')
const contour = ref(false)
const reflet = ref(true)
const expression = ref('neutre')
const mouvement = ref('state:idle')
const accessoire = ref<AccessoireId | ''>('')
const porte = ref<PorteId | ''>('')

const RENDUS = STYLES_SITE
const EXPRESSIONS = Object.entries(en.expressions as Record<string, string>)

// un mouvement = un etat du moteur, ou un geste, ou une activite
const gesteChoisi = computed<Animation | null>(() => {
  const [genre, id] = mouvement.value.split(':') as [string, string]
  if (genre === 'geste') return GESTES.find((a) => a.id === id) ?? null
  if (genre === 'travail') return ACTIVITES_SITE.find((a) => a.id === id) ?? null
  return null
})
const etat = computed<StateId>(() => (mouvement.value.startsWith('state:') ? (mouvement.value.slice(6) as StateId) : 'idle'))
const cycle = computed(() => gesteChoisi.value?.cycle ?? cycleDe(etat.value))
const geste = computed(() => gesteChoisi.value?.geste ?? null)
const exprEff = computed(() => gesteChoisi.value?.expression ?? expression.value)
const cle = computed(() => [forme.value, rendu.value, mouvement.value, accessoire.value, porte.value].join('|'))

const trois = computed(() => true)

const extrait = computed(() =>
  extraitCode({
    forme: forme.value,
    couleur: couleur.value,
    rendu: rendu.value,
    pixel: pixel.value,
    contour: contour.value,
    reflet: reflet.value,
    expression: expression.value,
    accessoire: accessoire.value,
    porte: porte.value,
    etat: mouvement.value.startsWith('state:') ? etat.value : 'idle'
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
              :key="cle + reduit"
              :size="260"
              :shape="forme"
              :color="couleur"
              :rendu="rendu"
              :pixel="pixel"
              :contour="contour"
              :reflet="reflet"
              :expression="exprEff"
              :accessoire="accessoire || null"
              :porte="trois ? porte || null : null"
              :geste="geste"
              :state="reduit ? etat : undefined"
              :cycle="cycle"
              :playing="!reduit"
              :frozen-at="reduit ? (accessoire ? 2.2 : POSES[etat]) : undefined"
              label="Your Mochi"
            />
          </Lazy>
        </div>
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
          <div v-if="trois" style="margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap">
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
          <h3>Animation</h3>
          <select v-model="mouvement" aria-label="Animation">
            <optgroup label="Moods">
              <option v-for="id in ETATS" :key="id" :value="'state:' + id">{{ STATE_LABEL[id] }}</option>
            </optgroup>
            <optgroup label="Gestures">
              <option v-for="a in GESTES" :key="a.id" :value="'geste:' + a.id">{{ a.label }}</option>
            </optgroup>
            <optgroup label="At work">
              <option v-for="a in ACTIVITES_SITE" :key="a.id" :value="'travail:' + a.id">{{ a.label }}</option>
            </optgroup>
          </select>
        </div>

        <div style="display: flex; gap: 16px; flex-wrap: wrap">
          <div>
            <h3>Expression</h3>
            <select v-model="expression" aria-label="Resting expression">
              <option v-for="[id, nom] in EXPRESSIONS" :key="id" :value="id">{{ nom }}</option>
            </select>
          </div>
          <div v-if="trois">
            <h3>Worn (3D)</h3>
            <select v-model="porte" aria-label="Worn accessory">
              <option value="">None</option>
              <option v-for="id in PORTE_IDS_SITE" :key="id" :value="id">{{ PORTE_LABEL[id] }}</option>
            </select>
          </div>
          <div>
            <h3>Tool</h3>
            <select v-model="accessoire" aria-label="Accessory">
              <option value="">None</option>
              <option v-for="id in ACCESSOIRE_IDS" :key="id" :value="id">{{ ACCESSOIRE_LABEL[id] }}</option>
            </select>
          </div>
        </div>
        <p v-if="reduit" class="note">Reduced motion is on: the preview shows a still frame.</p>
      </div>
    </div>
  </section>
</template>
