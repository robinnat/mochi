<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import {
  ACCESSOIRES_SITE,
  COLOR_LABEL,
  COULEUR_IDS,
  EMPLACEMENT_LABEL,
  EMPLACEMENTS_IDS,
  FORME_IDS,
  HUMEURS_SITE,
  SHAPE_LABEL,
  hexDe
} from './catalog'
import { couleurDe, hexValide } from '@/bot/skins'
import { COULEURS, type Emplacement, type Selection } from '@/bot/emplacements'
import type { RenduId } from '@/ui/rendu'
import type { MoodId } from '@/bot/humeurs'
import { STYLES_SITE } from './style'
import { extraitCode } from './extrait'

const reduit = useReduit()

const forme = ref('etoile')
/** un id du catalogue (`violet`) ou une couleur libre en hex (`#ff8800`) */
const couleur = ref('violet')
/** texte du champ hex : suit la couleur, mais se laisse taper (valide seulement quand c'est un hex) */
const texteHex = ref(couleurDe('violet'))
const hexCourant = computed(() => couleurDe(couleur.value))
function poserCouleur(c: string) {
  couleur.value = c
  texteHex.value = couleurDe(c)
}
function saisirHex(v: string) {
  texteHex.value = v
  const h = hexValide(v)
  if (h) couleur.value = h
}
const nomCouleur = computed(() => COLOR_LABEL[couleur.value] ?? hexCourant.value.toUpperCase())
const rendu = ref<RenduId>('3d')
const mood = ref<MoodId>('repos')
const ordinateur = ref(true)
const theme = ref<'auto' | 'light' | 'dark'>('auto')
/** Rejouer le salut a l'arrivee. */
const arrivee = ref(0)

const NOMS_COULEURS: Record<string, string> = {
  rouge: 'Red', jaune: 'Yellow', turquoise: 'Teal', marine: 'Navy', rose: 'Pink', creme: 'Cream', noir: 'Black',
  or: 'Gold', vert: 'Green', orange: 'Orange', violet: 'Purple', bleu: 'Blue', paille: 'Straw'
}
const PALETTE = Object.entries(COULEURS).map(([id, hex]) => ({ id, hex, label: NOMS_COULEURS[id] ?? id }))
const choix = reactive<Record<Emplacement, { id: string; c1: string; c2: string }>>({
  tete: { id: 'casquette', c1: COULEURS.rouge, c2: COULEURS.rouge },
  yeux: { id: '', c1: '', c2: '' },
  visage: { id: '', c1: '', c2: '' },
  bas: { id: '', c1: '', c2: '' },
  dos: { id: '', c1: '', c2: '' }
})
const options = (e: Emplacement) => ACCESSOIRES_SITE(e)
function choisir(e: Emplacement, id: string) {
  const a = options(e).find((o) => o.id === id)
  choix[e] = a ? { id, c1: a.c1, c2: a.c2 } : { id: '', c1: '', c2: '' }
}
const aDeuxCouleurs = (e: Emplacement) => {
  const a = options(e).find((o) => o.id === choix[e].id)
  return !!a && a.c1 !== a.c2
}
const accessoires = computed<Selection>(() => {
  const s: Selection = {}
  for (const e of EMPLACEMENTS_IDS) if (choix[e].id) s[e] = { id: choix[e].id, c1: choix[e].c1, c2: choix[e].c2 }
  return s
})
const cle = computed(() => [forme.value, rendu.value, mood.value, arrivee.value, reduit.value].join('|'))

const extrait = computed(() =>
  extraitCode({
    forme: forme.value,
    couleur: couleur.value,
    rendu: rendu.value,
    mood: mood.value,
    accessoires: accessoires.value,
    theme: theme.value,
    ordinateur: ordinateur.value
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
  <section id="customise" class="bloc wrap" aria-labelledby="t-play">
    <span class="etiquette">Make it yours</span>
    <h2 id="t-play">Everything in one place, with the code</h2>
    <p class="chapo">
      Shape, colour (a swatch or any colour you pick), style, mood, accessories with their colours, light or dark, and the laptop for
      the working mood. The preview is the real component, and the code below follows your choices. Copy it into a Vue 3 app.
    </p>
    <div class="duo">
      <div>
        <div class="scene large" :class="{ sombre: theme === 'dark' }">
          <Lazy :largeur="270" :hauteur="270">
            <MochiBot
              :key="cle"
              :size="260"
              :shape="forme"
              :color="couleur"
              :rendu="rendu"
              :contour="false"
              :mood="mood"
              :ordinateur="ordinateur"
              :accessoires="accessoires"
              :theme="theme === 'auto' ? undefined : theme"
              :coucou="arrivee > 0 && !reduit"
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
          <h3>Style</h3>
          <div class="chips" role="group" aria-label="Render style">
            <button v-for="r in STYLES_SITE" :key="r.id" type="button" class="chip" :aria-pressed="rendu === r.id" @click="rendu = r.id">{{ r.label }}</button>
          </div>
        </div>

        <div>
          <h3>Shape</h3>
          <div class="chips" role="group" aria-label="Shape">
            <button v-for="id in FORME_IDS" :key="id" type="button" class="chip" :aria-pressed="forme === id" @click="forme = id">{{ SHAPE_LABEL[id] }}</button>
          </div>
        </div>

        <div>
          <h3>Colour: {{ nomCouleur }}</h3>
          <div class="pastilles" role="group" aria-label="Colour">
            <button v-for="id in COULEUR_IDS" :key="id" type="button" class="pastille" :style="{ background: hexDe(id) }" :aria-label="COLOR_LABEL[id]" :aria-pressed="couleur === id" @click="poserCouleur(id)" />
          </div>
          <div class="libre">
            <label class="libre-choix">
              <input type="color" :value="hexCourant" aria-label="Pick any colour" @input="poserCouleur(($event.target as HTMLInputElement).value)" />
              <span>Pick any colour</span>
            </label>
            <label class="libre-hex">
              <span class="visuel-cache">Hex code</span>
              <input
                type="text"
                :value="texteHex"
                maxlength="7"
                spellcheck="false"
                autocomplete="off"
                inputmode="text"
                aria-label="Hex colour code"
                :aria-invalid="hexValide(texteHex) ? 'false' : 'true'"
                @input="saisirHex(($event.target as HTMLInputElement).value)"
                @blur="texteHex = hexCourant"
              />
            </label>
          </div>
        </div>

        <div>
          <h3>Mood</h3>
          <div class="chips" role="group" aria-label="Mood">
            <button v-for="h in HUMEURS_SITE" :key="h.id" type="button" class="chip" :aria-pressed="mood === h.id" @click="mood = h.id">{{ h.label }}</button>
          </div>
          <label v-if="mood === 'travaille'" class="case" style="margin-top: 10px"><input v-model="ordinateur" type="checkbox" /> Laptop</label>
        </div>

        <div>
          <h3>Theme</h3>
          <div class="chips" role="group" aria-label="Theme of this Mochi">
            <button v-for="t in ['auto', 'light', 'dark'] as const" :key="t" type="button" class="chip" :aria-pressed="theme === t" @click="theme = t">
              {{ t === 'auto' ? 'Follow the page' : t === 'light' ? 'Light' : 'Dark' }}
            </button>
          </div>
        </div>

        <div v-for="e in EMPLACEMENTS_IDS" :key="e" class="slot">
          <h3>{{ EMPLACEMENT_LABEL[e] }}</h3>
          <select :value="choix[e].id" :aria-label="EMPLACEMENT_LABEL[e] + ' accessory'" @change="choisir(e, ($event.target as HTMLSelectElement).value)">
            <option value="">None</option>
            <option v-for="o in options(e)" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
          <div v-if="choix[e].id" class="couleurs">
            <div class="pastilles" role="group" :aria-label="EMPLACEMENT_LABEL[e] + ' colour'">
              <button
                v-for="c in PALETTE"
                :key="c.id"
                type="button"
                class="pastille petite"
                :style="{ background: c.hex }"
                :aria-label="c.label"
                :aria-pressed="choix[e].c1 === c.hex"
                @click="choix[e].c1 = c.hex; if (!aDeuxCouleurs(e)) choix[e].c2 = c.hex"
              />
            </div>
            <div v-if="aDeuxCouleurs(e)" class="pastilles" role="group" :aria-label="EMPLACEMENT_LABEL[e] + ' second colour'">
              <button
                v-for="c in PALETTE"
                :key="c.id"
                type="button"
                class="pastille petite"
                :style="{ background: c.hex }"
                :aria-label="c.label + ' (second colour)'"
                :aria-pressed="choix[e].c2 === c.hex"
                @click="choix[e].c2 = c.hex"
              />
            </div>
          </div>
        </div>
        <p v-if="reduit" class="note">Reduced motion is on: the preview shows a still frame.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.libre {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.libre-choix {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}
.libre-choix input[type='color'] {
  width: 38px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
}
.libre-hex input {
  width: 6.4em;
  height: 30px;
  padding: 0 10px;
  font: inherit;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  text-transform: lowercase;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.libre-hex input[aria-invalid='true'] {
  border-color: #e0524f;
}
.visuel-cache {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.scene.sombre {
  background: #1e1d27;
  border-color: #2f2d3b;
}
</style>
