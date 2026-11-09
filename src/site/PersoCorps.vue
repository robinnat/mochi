<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import Vivant from './Vivant.vue'
import CodeBlock from './CodeBlock.vue'
import { useReduit } from './reduced'
import { useLargeur } from './motion'
import { ACCESSOIRES_SITE, COLOR_LABEL, EMPLACEMENT_LABEL, EMPLACEMENTS_IDS, FORMES_3D, HUMEURS_SITE, PALETTE_SITE } from './catalog'
import { couleurDe, hexValide, SHAPE_BY_ID } from '@/bot/skins'
import { closedPath, toPoints } from '@/bot/shape'
import { COULEURS, type Emplacement, type Selection } from '@/bot/emplacements'
import type { RenduId } from '@/ui/rendu'
import type { MoodId } from '@/bot/humeurs'
import { STYLES_SITE } from './style'
import { extraitCode } from './extrait'
import { urlPiece } from './affiches'
import { themeEffectif } from './theme'

const reduit = useReduit()
const largeur = useLargeur()
const taille = computed(() => (largeur.value >= 900 ? 320 : 210))

/* ------------------------------------------------------------------ choix */
const forme = ref('etoile')
/** une couleur libre en hex (`#ff8800`) ou un id du catalogue du moteur */
const couleur = ref('#7a3cff')
const texteHex = ref('#7a3cff')
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
const nomCouleur = computed(() => PALETTE_SITE.find((p) => p.hex === couleur.value)?.nom ?? COLOR_LABEL[couleur.value] ?? hexCourant.value.toUpperCase())
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
/** Couleurs des accessoires : la palette du catalogue des accessoires (les pieces naissent dans ces teintes). */
const PALETTE_ACC = Object.entries(COULEURS).map(([id, hex]) => ({ id, hex, label: NOMS_COULEURS[id] ?? id }))

const choix = reactive<Record<Emplacement, { id: string; c1: string; c2: string }>>({
  tete: { id: 'casquette', c1: COULEURS.rouge, c2: COULEURS.rouge },
  yeux: { id: '', c1: '', c2: '' },
  visage: { id: '', c1: '', c2: '' },
  bas: { id: '', c1: '', c2: '' },
  dos: { id: '', c1: '', c2: '' }
})
const slot = ref<Emplacement>('tete')
const options = (e: Emplacement) => ACCESSOIRES_SITE(e)
function choisir(e: Emplacement, id: string) {
  const a = options(e).find((o) => o.id === id)
  choix[e] = a ? { id, c1: a.c1, c2: a.c2 } : { id: '', c1: '', c2: '' }
}
const aDeuxCouleurs = (e: Emplacement) => {
  const a = options(e).find((o) => o.id === choix[e].id)
  return !!a && a.c1 !== a.c2
}
function poserC1(e: Emplacement, hex: string) {
  choix[e].c1 = hex
  if (!aDeuxCouleurs(e)) choix[e].c2 = hex
}
const accessoires = computed<Selection>(() => {
  const s: Selection = {}
  for (const e of EMPLACEMENTS_IDS) if (choix[e].id) s[e] = { id: choix[e].id, c1: choix[e].c1, c2: choix[e].c2 }
  return s
})
const nbPortes = computed(() => EMPLACEMENTS_IDS.filter((e) => choix[e].id).length)
/** Onglets : fleches gauche et droite, Debut et Fin (contrat clavier du role `tablist`), le focus suit. */
function clavierOnglets(ev: KeyboardEvent) {
  const i = EMPLACEMENTS_IDS.indexOf(slot.value)
  const n = EMPLACEMENTS_IDS.length
  const j = ev.key === 'ArrowRight' ? (i + 1) % n : ev.key === 'ArrowLeft' ? (i - 1 + n) % n : ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : -1
  if (j < 0) return
  ev.preventDefault()
  slot.value = EMPLACEMENTS_IDS[j]!
  const liste = (ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
  liste[j]?.focus()
}
function toutRetirer() {
  for (const e of EMPLACEMENTS_IDS) choisir(e, '')
}

/** Rejouer le salut remonte le Mochi ; forme, style, couleur et humeur changent sans le remonter (pas de trou a l'ecran). */
const cle = computed(() => [arrivee.value, reduit.value].join('|'))

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

/* ------------------------------------------------------------------ icones des formes : la vraie silhouette du moteur, en SVG */
const silhouette = (id: string) => {
  const radii = SHAPE_BY_ID.get(id)?.radii
  return radii ? closedPath(toPoints({ radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, 10)) : ''
}
const FORMES = FORMES_3D.map((f) => ({ ...f, d: silhouette(f.id) }))

/* ------------------------------------------------------------------ icones des accessoires : images pre-rendues (public/rendus) */
const icone = (e: Emplacement, id: string) => urlPiece(e, id, themeEffectif.value)

/**
 * Reponse immediate (v12) : un clic change d'abord le bouton (peint a l'image suivante), et le Mochi recoit le
 * changement juste APRES cette image. Sans cela, le bouton restait fige le temps que la 3D se refasse. Plusieurs
 * changements rapides (glisser dans le selecteur de couleur) se regroupent en un seul rendu.
 */
const etatBot = () => ({
  forme: forme.value,
  couleur: couleur.value,
  rendu: rendu.value,
  mood: mood.value,
  ordinateur: ordinateur.value,
  theme: theme.value,
  accessoires: accessoires.value
})
const bot = shallowRef(etatBot())
let enAttente = false
watch(
  [forme, couleur, rendu, mood, ordinateur, theme, accessoires],
  () => {
    if (enAttente) return
    enAttente = true
    requestAnimationFrame(() =>
      setTimeout(() => {
        enAttente = false
        bot.value = etatBot()
      }, 0)
    )
  },
  { deep: true }
)

/** L'affiche (image pre-rendue) ne vaut que pour le Mochi de depart : au premier changement, plus d'affiche. */
const touche = ref(false)
watch([forme, couleur, rendu, mood, ordinateur, theme, accessoires], () => (touche.value = true), { deep: true })
</script>

<template>
  <div class="perso-corps">
    <div class="wrap perso-grille">
      <div class="perso-gauche">
        <div class="perso-scene" :class="{ sombre: theme === 'dark', clair: theme === 'light' }">
          <Vivant
            :key="cle"
            :taille="taille"
            eager
            :affiche="touche || arrivee > 0 || reduit ? null : 'perso'"
            :shape="bot.forme"
            :color="bot.couleur"
            :rendu="bot.rendu"
            :contour="false"
            :mood="bot.mood"
            :ordinateur="bot.ordinateur"
            :accessoires="bot.accessoires"
            :theme="bot.theme === 'auto' ? undefined : bot.theme"
            :coucou="arrivee > 0 && !reduit"
            :frozen-at="reduit ? 0 : undefined"
            alt="Your Mochi"
          />
          <div class="perso-outils">
            <div class="segment petit" role="group" aria-label="Theme of this Mochi">
              <button v-for="t in ['auto', 'light', 'dark'] as const" :key="t" type="button" :aria-pressed="theme === t" @click="theme = t">
                {{ t === 'auto' ? 'Page' : t === 'light' ? 'Light' : 'Dark' }}
              </button>
            </div>
            <button type="button" class="btn petit" @click="arrivee++">Replay hello</button>
          </div>
        </div>
      </div>

      <div class="perso-panneau">
        <div v-reveal="0" class="groupe">
          <h3>Style</h3>
          <div class="segment" role="group" aria-label="Render style">
            <button v-for="r in STYLES_SITE" :key="r.id" type="button" :aria-pressed="rendu === r.id" @click="rendu = r.id">{{ r.label }}</button>
          </div>
        </div>

        <div v-reveal="1" class="groupe">
          <h3>Shape</h3>
          <div class="formes-choix" role="group" aria-label="Shape">
            <button v-for="f in FORMES" :key="f.id" type="button" class="forme-choix" :aria-pressed="forme === f.id" :title="f.label" @click="forme = f.id">
              <svg viewBox="-13 -13 26 26" width="30" height="30" aria-hidden="true"><path :d="f.d" :fill="hexCourant" /></svg>
              <span>{{ f.label }}</span>
            </button>
          </div>
        </div>

        <div v-reveal="2" class="groupe">
          <h3>Colour <span class="valeur">{{ nomCouleur }}</span></h3>
          <div class="pastilles" role="group" aria-label="Colour">
            <button v-for="p in PALETTE_SITE" :key="p.hex" type="button" class="pastille" :style="{ background: p.hex }" :aria-label="p.nom" :aria-pressed="couleur === p.hex" @click="poserCouleur(p.hex)" />
          </div>
          <div class="libre">
            <label class="libre-choix">
              <input type="color" :value="hexCourant" aria-label="Pick any colour" @input="poserCouleur(($event.target as HTMLInputElement).value)" />
              <span>Any colour</span>
            </label>
            <label class="libre-hex">
              <span class="sr-only">Hex code</span>
              <input
                type="text"
                :value="texteHex"
                maxlength="7"
                spellcheck="false"
                autocomplete="off"
                aria-label="Hex colour code"
                :aria-invalid="hexValide(texteHex) ? 'false' : 'true'"
                @input="saisirHex(($event.target as HTMLInputElement).value)"
                @blur="texteHex = hexCourant"
              />
            </label>
          </div>
        </div>

        <div v-reveal="3" class="groupe">
          <h3>Mood</h3>
          <div class="chips" role="group" aria-label="Mood">
            <button v-for="h in HUMEURS_SITE" :key="h.id" type="button" class="chip" :aria-pressed="mood === h.id" @click="mood = h.id">{{ h.label }}</button>
          </div>
          <label v-if="mood === 'travaille'" class="case"><input v-model="ordinateur" type="checkbox" /> Show the laptop</label>
        </div>

        <div v-reveal="4" class="groupe">
          <h3>
            Accessories <span class="valeur">{{ nbPortes }} worn</span>
            <button v-if="nbPortes" type="button" class="lien-btn" @click="toutRetirer">Remove all</button>
          </h3>
          <div class="onglets" role="tablist" aria-label="Accessory slot" @keydown="clavierOnglets">
            <button
              v-for="e in EMPLACEMENTS_IDS"
              :key="e"
              type="button"
              role="tab"
              class="onglet"
              :aria-selected="slot === e"
              :tabindex="slot === e ? 0 : -1"
              @click="slot = e"
            >
              {{ EMPLACEMENT_LABEL[e] }}<span v-if="choix[e].id" class="onglet-point" aria-hidden="true" />
            </button>
          </div>
          <div class="pieces" role="tabpanel" :aria-label="EMPLACEMENT_LABEL[slot] + ' accessories'">
            <button type="button" class="piece" :aria-pressed="!choix[slot].id" @click="choisir(slot, '')">
              <span class="piece-image aucun" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M6.5 17.5 17.5 6.5" stroke="currentColor" stroke-width="1.6" /></svg>
              </span>
              <span class="piece-nom">None</span>
            </button>
            <button v-for="o in options(slot)" :key="o.id" type="button" class="piece" :aria-pressed="choix[slot].id === o.id" @click="choisir(slot, o.id)">
              <span class="piece-image" aria-hidden="true">
                <img :src="icone(slot, o.id)" alt="" width="60" height="60" loading="lazy" decoding="async" />
              </span>
              <span class="piece-nom">{{ o.label }}</span>
            </button>
          </div>
          <div v-if="choix[slot].id" class="couleurs-piece">
            <div class="pastilles" role="group" :aria-label="EMPLACEMENT_LABEL[slot] + ' colour'">
              <button
                v-for="c in PALETTE_ACC"
                :key="c.id"
                type="button"
                class="pastille petite"
                :style="{ background: c.hex }"
                :aria-label="c.label"
                :aria-pressed="choix[slot].c1 === c.hex"
                @click="poserC1(slot, c.hex)"
              />
            </div>
            <div v-if="aDeuxCouleurs(slot)" class="pastilles" role="group" :aria-label="EMPLACEMENT_LABEL[slot] + ' second colour'">
              <span class="pastilles-titre">Second colour</span>
              <button
                v-for="c in PALETTE_ACC"
                :key="c.id"
                type="button"
                class="pastille petite"
                :style="{ background: c.hex }"
                :aria-label="c.label + ' (second colour)'"
                :aria-pressed="choix[slot].c2 === c.hex"
                @click="choix[slot].c2 = c.hex"
              />
            </div>
          </div>
        </div>
        <p v-if="reduit" class="note">Reduced motion is on: the preview shows a still frame.</p>
      </div>
    </div>

    <div v-reveal class="wrap perso-code">
      <CodeBlock :code="extrait" titre="YourMochi.vue" />
      <p class="note">Ids are the engine's own (in French for now: <code>etoile</code> is the star). See the <a href="/docs">docs</a> for every option.</p>
    </div>
  </div>
</template>
