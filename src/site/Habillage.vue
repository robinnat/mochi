<script setup lang="ts">
import BandeAccessoires from './BandeAccessoires.vue'
import { useReduit } from './reduced'
import { BANDES, itemsBande } from './bandes'

const reduit = useReduit()
/** Une bande par emplacement du paquet, avec ses variantes (accessoires, couleurs, formes, humeurs). */
const BANDES_ITEMS = BANDES.map((def) => ({ def, items: itemsBande(def.emplacement) }))
</script>

<template>
  <section id="accessories" class="bloc wrap" aria-labelledby="t-acc">
    <span class="etiquette">Accessories</span>
    <h2 id="t-acc">Dress it up, one slot at a time</h2>
    <p class="chapo">
      Five slots (head, eyes, face, neck, back), one accessory per slot, and they all stack. Each is a simple shape in
      one colour, two at most, fitted to the body whatever its shape. Here is a small part of what you can wear; pick
      your own pieces and colours in <a href="#customise">Make it yours</a>.
    </p>
    <BandeAccessoires v-for="b in BANDES_ITEMS" :key="b.def.emplacement" :def="b.def" :items="b.items" />
    <p class="note" style="margin-top: 12px">
      {{ reduit ? 'Reduced motion is on: the rows stand still, scroll them sideways with your finger or the arrow keys.' : 'Hover a row to pause it.' }}
    </p>
  </section>
</template>
