<script setup lang="ts">
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { FORMES_3D } from './catalog'

/** Les trois styles, dans l'ordre voulu : Soft (le classique), Pixel, Flat. Aucun reglage ici : tout se regle plus bas, dans « Make it yours ». */
const STYLES: { id: '3d' | 'pixel3d' | 'flat3d'; titre: string }[] = [
  { id: '3d', titre: '3D Soft' },
  { id: 'pixel3d', titre: 'Pixel' },
  { id: 'flat3d', titre: 'Flat' }
]
</script>

<template>
  <section id="volumes" class="bloc wrap" aria-labelledby="t-3d">
    <span class="etiquette">3D</span>
    <h2 id="t-3d">Real 3D, in three styles</h2>
    <p class="chapo">
      Eleven shapes, all with a real volume you can look at from any side. The eyes always face you. Three.js loads only when you scroll here, and every card
      below draws through one shared WebGL context.
    </p>
    <div v-for="s in STYLES" :key="s.id" class="style3d">
      <h3>{{ s.titre }}</h3>
      <div class="grille grille-formes">
        <figure v-for="f in FORMES_3D" :key="f.id" class="carte">
          <Lazy garder :largeur="80" :hauteur="80">
            <MochiBot :size="76" :shape="f.id" :color="f.couleur" :rendu="s.id" :frozen-at="1.2" :label="`${f.label}, ${s.titre}`" />
          </Lazy>
          <figcaption>{{ f.label }}</figcaption>
        </figure>
      </div>
    </div>
    <p class="note" style="margin-top: 12px">
      Without WebGL the page keeps a still drawing of each mochi.
    </p>
  </section>
</template>

<style scoped>
.style3d {
  margin-top: 26px;
}
.style3d h3 {
  font-size: 1.05rem;
  margin: 0;
}
.grille-formes {
  margin-top: 10px;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
@media (min-width: 560px) {
  .grille-formes {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
@media (min-width: 980px) {
  .grille-formes {
    grid-template-columns: repeat(11, minmax(0, 1fr));
  }
}
.grille-formes .carte {
  padding: 10px 2px 8px;
}
.grille-formes .carte figcaption {
  font-size: 0.74rem;
}
</style>
