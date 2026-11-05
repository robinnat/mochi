<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { COULEURS, type Selection } from '@/bot/emplacements'

const reduit = useReduit()

interface Tenue {
  forme: string
  couleur: string
  legende: string
  accessoires: Selection
}

/** Huit tenues toutes faites : formes, couleurs et combinaisons differentes, dont des accessoires a deux couleurs. */
const TENUES: Tenue[] = [
  {
    forme: 'squircle',
    couleur: 'turquoise',
    legende: 'Cap, round glasses, bow tie',
    accessoires: { tete: 'casquette', yeux: 'rondes', bas: 'papillon' }
  },
  {
    forme: 'etoile',
    couleur: 'ambre',
    legende: 'Crown, heart glasses, blush, cape',
    accessoires: { tete: 'couronne', yeux: 'coeur', visage: 'joues', dos: 'cape' }
  },
  {
    forme: 'nuage',
    couleur: 'rose',
    legende: 'Flower, square glasses, pearls, angel wings',
    accessoires: { tete: { id: 'fleur', c1: COULEURS.orange, c2: COULEURS.jaune }, yeux: 'carrees', bas: 'perles', dos: 'ailes' }
  },
  {
    forme: 'goutte',
    couleur: 'bleu',
    legende: 'Top hat, monocle, moustache',
    accessoires: { tete: { id: 'haut-de-forme', c1: COULEURS.noir, c2: COULEURS.rose }, yeux: 'monocle', bas: 'moustache' }
  },
  {
    forme: 'cercle',
    couleur: 'violet',
    legende: 'Headphones, sunglasses, scarf, backpack',
    accessoires: { tete: 'casque', yeux: 'soleil', bas: { id: 'echarpe', c1: COULEURS.jaune, c2: COULEURS.jaune }, dos: { id: 'sac', c1: COULEURS.orange, c2: COULEURS.marine } }
  },
  {
    forme: 'oeuf',
    couleur: 'vert',
    legende: 'Chef hat, cat whiskers, flower necklace, bat wings',
    accessoires: { tete: 'toque', visage: { id: 'chat', c1: COULEURS.noir, c2: COULEURS.rose }, bas: 'fleurs', dos: 'diable' }
  },
  {
    forme: 'hexagone',
    couleur: 'orange',
    legende: 'Straw hat, star glasses, freckles, bow tie',
    accessoires: { tete: 'paille', yeux: 'etoile', visage: 'rousseur', bas: { id: 'papillon', c1: COULEURS.bleu, c2: COULEURS.bleu } }
  },
  {
    forme: 'triangle',
    couleur: 'rose',
    legende: 'Beret, round glasses, beauty mark, cape',
    accessoires: { tete: 'beret', yeux: 'rondes', visage: 'grain', dos: { id: 'cape', c1: COULEURS.turquoise, c2: COULEURS.turquoise } }
  }
]
</script>

<template>
  <section id="accessories" class="bloc wrap" aria-labelledby="t-acc">
    <span class="etiquette">Accessories</span>
    <h2 id="t-acc">Dress it up, one slot at a time</h2>
    <p class="chapo">
      Five slots (head, eyes, face, neck, back), one accessory per slot, and they all stack. Each is a simple shape in
      one colour, two at most, fitted to the 3D body whatever its shape. Here are a few outfits; pick your own pieces
      and colours in <a href="#customise">Make it yours</a>.
    </p>
    <div class="vitrine">
      <figure v-for="t in TENUES" :key="t.legende" class="carte">
        <Lazy garder :largeur="180" :hauteur="180">
          <MochiBot
            :size="170"
            :shape="t.forme"
            :color="t.couleur"
            rendu="3d"
            mood="repos"
            :interactions="false"
            :frozen-at="1"
            :accessoires="t.accessoires"
            :label="t.legende"
          />
        </Lazy>
        <figcaption>{{ t.legende }}</figcaption>
      </figure>
    </div>
    <p v-if="reduit" class="note">Reduced motion is on: still frames.</p>
  </section>
</template>
