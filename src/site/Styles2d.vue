<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { COULEUR_IDS, FORME_IDS, SHAPE_LABEL } from './catalog'
import type { RenduId } from '@/ui/rendu'

const STYLES: { id: RenduId; nom: string; note: string; couleur: string }[] = [
  { id: 'original', nom: 'Flat', note: 'A solid shape and two eyes cut out of it', couleur: 'violet' },
  { id: 'pixel', nom: 'Pixel art', note: 'The same image on a coarse grid, three sizes', couleur: 'turquoise' },
  { id: 'argile', nom: 'Clay', note: 'Soft, matte, pastel volume in plain SVG', couleur: 'rose' },
  { id: 'bulle', nom: 'Bubble', note: 'Glossy and bright, still plain SVG', couleur: 'bleu' }
]
// une couleur differente par forme, parmi les teintes vives du catalogue (ni l'encre, ni le gris)
const TEINTES = COULEUR_IDS.filter((c) => !['encre', 'gris', 'creme', 'brun'].includes(c))
const couleurDe = (i: number) => TEINTES[i % TEINTES.length]!
</script>

<template>
  <section id="styles" class="bloc wrap" aria-labelledby="t-styles">
    <span class="etiquette">2D</span>
    <h2 id="t-styles">Four ways to draw the same mochi</h2>
    <p class="chapo">
      The engine returns one image per instant. Only the drawing changes: every style reads the same
      motion, so a mochi keeps its personality whichever one you pick.
    </p>
    <div class="grille">
      <figure v-for="s in STYLES" :key="s.id" class="carte">
        <Lazy garder :largeur="140" :hauteur="140">
          <MochiBot :size="136" shape="cercle" :color="s.couleur" :rendu="s.id" :frozen-at="1.2" :label="`${s.nom} style`" />
        </Lazy>
        <figcaption><strong>{{ s.nom }}</strong><br />{{ s.note }}</figcaption>
      </figure>
    </div>

    <h2 style="margin-top: 44px; font-size: 1.25rem">Eleven shapes, twelve colours</h2>
    <p class="chapo">Every silhouette shares one outline sampling, so any shape morphs into any other.</p>
    <div class="grille" style="grid-template-columns: repeat(auto-fill, minmax(104px, 1fr))">
      <figure v-for="(id, i) in FORME_IDS" :key="id" class="carte">
        <Lazy garder :largeur="84" :hauteur="84">
          <MochiBot :size="80" :shape="id" :color="couleurDe(i)" rendu="argile" :frozen-at="1.2" :label="SHAPE_LABEL[id] ?? id" />
        </Lazy>
        <figcaption>{{ SHAPE_LABEL[id] }}</figcaption>
      </figure>
    </div>
  </section>
</template>
