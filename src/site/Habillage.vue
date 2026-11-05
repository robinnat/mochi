<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { ACCESSOIRES_SITE, EMPLACEMENT_LABEL, EMPLACEMENTS_IDS, FORME_IDS, SHAPE_LABEL } from './catalog'
import { COULEURS, type Emplacement, type Selection } from '@/bot/emplacements'

const reduit = useReduit()
const forme = ref('squircle')
const NOMS_COULEURS: Record<string, string> = {
  rouge: 'Red', jaune: 'Yellow', turquoise: 'Teal', marine: 'Navy', rose: 'Pink', creme: 'Cream', noir: 'Black',
  or: 'Gold', vert: 'Green', orange: 'Orange', violet: 'Purple', bleu: 'Blue', paille: 'Straw'
}
const PALETTE = Object.entries(COULEURS).map(([id, hex]) => ({ id, hex, label: NOMS_COULEURS[id] ?? id }))

/** Un choix par emplacement : l'id et ses couleurs (vide = rien). */
const choix = reactive<Record<Emplacement, { id: string; c1: string; c2: string }>>({
  tete: { id: 'casquette', c1: COULEURS.rouge, c2: COULEURS.rouge },
  yeux: { id: 'rondes', c1: COULEURS.noir, c2: COULEURS.noir },
  visage: { id: '', c1: '', c2: '' },
  bas: { id: 'papillon', c1: COULEURS.noir, c2: COULEURS.noir },
  dos: { id: '', c1: '', c2: '' }
})

const options = (e: Emplacement) => ACCESSOIRES_SITE(e)
/** Un accessoire seul, pour sa vignette. */
const vignette = (e: Emplacement, o: { id: string; c1: string; c2: string }): Selection => ({ [e]: { id: o.id, c1: o.c1, c2: o.c2 } })
function choisir(e: Emplacement, id: string) {
  const a = options(e).find((o) => o.id === id)
  choix[e] = a ? { id, c1: a.c1, c2: a.c2 } : { id: '', c1: '', c2: '' }
}
const aDeuxCouleurs = (e: Emplacement) => {
  const a = options(e).find((o) => o.id === choix[e].id)
  return !!a && a.c1 !== a.c2
}
const selection = computed<Selection>(() => {
  const s: Selection = {}
  for (const e of EMPLACEMENTS_IDS) if (choix[e].id) s[e] = { id: choix[e].id, c1: choix[e].c1, c2: choix[e].c2 }
  return s
})
const cle = computed(() => forme.value + '|' + reduit.value)
function vider() {
  for (const e of EMPLACEMENTS_IDS) choisir(e, '')
}
</script>

<template>
  <section id="accessories" class="bloc wrap" aria-labelledby="t-acc">
    <span class="etiquette">Accessories</span>
    <h2 id="t-acc">Dress it up, one slot at a time</h2>
    <p class="chapo">
      Five slots (head, eyes, face, neck, back), one accessory per slot, and they all stack. Each is a simple shape in
      one colour, two at most, and you pick the colours. They are fitted to the 3D body, whatever its shape.
    </p>
    <div class="duo">
      <div>
        <div class="scene large">
          <Lazy :largeur="270" :hauteur="270">
            <MochiBot
              :key="cle"
              :size="260"
              :shape="forme"
              color="turquoise"
              rendu="3d"
              mood="repos"
              :accessoires="selection"
              :frozen-at="reduit ? 1 : undefined"
              :interactions="!reduit"
              label="Your dressed-up Mochi"
            />
          </Lazy>
        </div>
        <div class="chips" style="margin-top: 12px" role="group" aria-label="Body shape">
          <button v-for="id in FORME_IDS" :key="id" type="button" class="chip" :aria-pressed="forme === id" @click="forme = id">{{ SHAPE_LABEL[id] }}</button>
        </div>
      </div>

      <div class="panneau">
        <div v-for="e in EMPLACEMENTS_IDS" :key="e" class="slot">
          <h3>{{ EMPLACEMENT_LABEL[e] }}</h3>
          <div class="galerie" role="group" :aria-label="EMPLACEMENT_LABEL[e] + ' accessories'">
            <button type="button" class="tuile" :aria-pressed="!choix[e].id" @click="choisir(e, '')">
              <span class="aucun">None</span>
            </button>
            <button v-for="o in options(e)" :key="o.id" type="button" class="tuile" :aria-pressed="choix[e].id === o.id" :aria-label="o.label" @click="choisir(e, o.id)">
              <Lazy garder :largeur="60" :hauteur="60">
                <MochiBot :size="56" shape="squircle" color="turquoise" rendu="3d" :ombre="false" :interactions="false" :frozen-at="1" :accessoires="vignette(e, o)" :label="o.label" />
              </Lazy>
              <span class="nom">{{ o.label }}</span>
            </button>
          </div>
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
        <div><button type="button" class="btn" @click="vider">Take everything off</button></div>
      </div>
    </div>
  </section>
</template>
