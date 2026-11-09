<script setup lang="ts">
import { computed, ref } from 'vue'
import Affiche from './Affiche.vue'
import HeroChiffres from './HeroChiffres.vue'
import { DEFILE } from './affiches'
import { ACCESSOIRES_SITE } from './catalog'
import type { Choix, Emplacement } from '@/bot/emplacements'

/**
 * Direction B : « la foule ». Aucune 3D au premier ecran : une petite foule de Mochi tous differents (formes, couleurs,
 * accessoires), en images pre-rendues qui flottent en CSS. Un tap sur l'un d'eux le fait sauter et dit ce qu'il porte ;
 * « Shuffle » en appelle d'autres de la meme liste soignee que la carte des accessoires. Tres leger sur iPhone.
 */
const DE_FACE = DEFILE.filter((d) => !d.variante.dos)
const NB = 12
const labelDe = (i: number) =>
  (Object.entries(DE_FACE[i]!.variante.acc) as [Emplacement, Choix][])
    .map(([e, ch]) => ACCESSOIRES_SITE(e).find((a) => a.id === (typeof ch === 'string' ? ch : ch.id))?.label)
    .filter(Boolean)
    .join(', ')

const ordre = ref<number[]>(Array.from({ length: NB }, (_, i) => i))
const foule = computed(() => ordre.value.map((i) => ({ i, nom: DE_FACE[i]!.nom })))
const actif = ref<number | null>(null)
const saut = ref(0)

function toucher(i: number) {
  actif.value = i
  saut.value++
}
function melanger() {
  const tout = DE_FACE.map((_, i) => i)
  for (let k = tout.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1))
    ;[tout[k], tout[j]] = [tout[j]!, tout[k]!]
  }
  ordre.value = tout.slice(0, NB)
  actif.value = null
}
const legende = computed(() => (actif.value === null ? 'Tap a Mochi to see what it wears.' : `Wearing: ${labelDe(actif.value)}.`))
</script>

<template>
  <header id="top" class="hx hx-b">
    <div class="hero-fond" aria-hidden="true" />
    <div class="hx-in hx-centre">
      <p class="hero-badge rv-load" style="--d: 0"><span class="point" aria-hidden="true" /> Open source, MIT</p>
      <h1 class="hx-titre rv-load" style="--d: 1">A crowd of <span class="accent">tiny faces</span> for your app.</h1>
      <p class="hx-chapo rv-load" style="--d: 2">
        Mochi is a 3D avatar for the web: pick a shape, a colour and a few accessories. Each one breathes, blinks and reacts to touch.
      </p>
      <div class="actions hx-actions rv-load" style="--d: 3">
        <a class="btn primaire" href="/app">Try the app <span aria-hidden="true">→</span></a>
        <a class="btn" href="/docs">Read the docs</a>
      </div>

      <ul class="hx-foule" aria-label="Some Mochi">
        <li v-for="(m, k) in foule" :key="m.i + '-' + k" :style="{ '--k': k }">
          <button
            type="button"
            class="hx-mochi"
            :class="{ saute: actif === m.i }"
            :aria-label="DE_FACE[m.i]!.variante.forme + ' Mochi wearing ' + labelDe(m.i)"
            @click="toucher(m.i)"
          >
            <span :key="actif === m.i ? saut : 0" class="hx-mochi-i"><Affiche :nom="m.nom" :taille="166" :eager="k < 4" /></span>
          </button>
        </li>
      </ul>
      <div class="hx-pied">
        <p class="hx-legende" aria-live="polite">{{ legende }}</p>
        <button type="button" class="btn petit" @click="melanger">Shuffle</button>
      </div>
    </div>
    <HeroChiffres />
  </header>
</template>
