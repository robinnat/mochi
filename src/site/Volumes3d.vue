<script setup lang="ts">
import { ref } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { FORMES_3D } from './catalog'

type StyleId = '3d' | 'pixel3d' | 'flat3d'

/** Les trois styles, dans l'ordre voulu : Soft (le classique), Pixel, Flat. Aucun autre reglage ici : le reste se regle dans « Make it yours ». */
const STYLES: { id: StyleId; titre: string; phrase: string }[] = [
  { id: '3d', titre: '3D Soft', phrase: 'Smooth and glossy' },
  { id: 'pixel3d', titre: 'Pixel', phrase: 'Little blocks, like a game' },
  { id: 'flat3d', titre: 'Flat', phrase: 'Bold colour, no gloss' }
]
const actif = ref<StyleId>('3d')
const titreActif = () => STYLES.find((s) => s.id === actif.value)!.titre
</script>

<template>
  <section id="volumes" class="bloc wrap" aria-labelledby="t-3d">
    <span class="etiquette">3D</span>
    <h2 id="t-3d">Real 3D, in three styles</h2>
    <p class="chapo">
      Twelve shapes, all with a real volume you can look at from any side, and eyes that always face you. Pick a style
      and every shape below follows.
    </p>
    <div class="styles3d" role="group" aria-label="Style">
      <button
        v-for="s in STYLES"
        :key="s.id"
        type="button"
        class="style-bouton"
        :aria-pressed="actif === s.id"
        @click="actif = s.id"
      >
        <Lazy garder :largeur="100" :hauteur="100">
          <MochiBot :size="96" shape="cercle" color="#8b5cf6" :rendu="s.id" :frozen-at="1.2" :interactions="false" :label="`${s.titre} example`" />
        </Lazy>
        <span class="style-nom">{{ s.titre }}</span>
        <span class="style-phrase">{{ s.phrase }}</span>
      </button>
    </div>
    <div class="grille grille-formes" role="list" :aria-label="`All the shapes in ${titreActif()}`">
      <figure v-for="f in FORMES_3D" :key="f.id" class="carte" role="listitem">
        <Lazy garder :largeur="96" :hauteur="96">
          <MochiBot :size="92" :shape="f.id" :color="f.couleur" :rendu="actif" :frozen-at="1.2" :label="`${f.label}, ${titreActif()}`" />
        </Lazy>
        <figcaption>{{ f.label }}</figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.styles3d {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 26px;
}
.style-bouton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 6px 12px;
  font: inherit;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  min-width: 0;
}
.style-bouton:hover {
  border-color: var(--accent);
}
.style-bouton:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 2px;
}
.style-bouton[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.style-nom {
  font-weight: 650;
  font-size: 0.98rem;
}
.style-phrase {
  font-size: 0.78rem;
  color: var(--muted);
  text-align: center;
  line-height: 1.25;
}
.style-bouton[aria-pressed='true'] .style-nom {
  color: var(--accent-ink);
}
.grille-formes {
  margin-top: 14px;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
@media (min-width: 560px) {
  .grille-formes {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
.grille-formes .carte {
  padding: 10px 2px 8px;
}
.grille-formes .carte figcaption {
  font-size: 0.78rem;
}
@media (max-width: 420px) {
  .style-phrase {
    display: none;
  }
}
</style>
