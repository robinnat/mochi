<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MochiBot from '@/components/MochiBot.vue'
import Lazy from './Lazy.vue'
import { useReduit } from './reduced'
import { useLargeur, useVisible } from './motion'
import type { RenduId } from '@/ui/rendu'

/**
 * Les trois styles, au defilement : la scene reste collee pendant que les trois etapes passent, et le
 * Mochi change de style quand une etape arrive au milieu de l'ecran. Il tourne doucement sur lui-meme
 * (vraie 3D, `yaw`) tant que la scene est visible. Sur telephone, chaque etape porte sa propre image figee.
 */
const ETAPES: { id: RenduId; nom: string; code: string; texte: string; fond: string }[] = [
  {
    id: '3d',
    nom: 'Soft',
    code: 'rendu="3d"',
    texte: 'Smooth studio shading, rim glows and a soft highlight, lit the same way from every side. The default.',
    fond: 'var(--p-lavande)'
  },
  {
    id: 'pixel3d',
    nom: 'Pixel',
    code: 'rendu="pixel3d"',
    texte: 'The same 3D model rendered at low resolution, with a short palette and a 1 px outline. A game sprite that can turn around.',
    fond: 'var(--p-menthe)'
  },
  {
    id: 'flat3d',
    nom: 'Flat',
    code: 'rendu="flat3d"',
    texte: 'Two or three flat tones and no gloss, for a bold, graphic look. Add an outline with contour.',
    fond: 'var(--p-peche)'
  }
]

const reduit = useReduit()
const largeur = useLargeur()
const large = computed(() => largeur.value >= 900)
const actif = ref(0)
const etapes = ref<HTMLElement[]>([])
const scene = ref<HTMLElement | null>(null)
const visible = useVisible(scene, '100px')

let obs: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  // une etape devient active quand elle traverse la bande du milieu de l'ecran
  obs = new IntersectionObserver(
    (es) => {
      for (const e of es) if (e.isIntersecting) actif.value = Number((e.target as HTMLElement).dataset.i ?? 0)
    },
    { rootMargin: '-45% 0px -45% 0px' }
  )
  for (const el of etapes.value) obs.observe(el)
})

/** Tourne-disque : un aller-retour lent de +-0,55 rad, seulement quand la scene est a l'ecran. */
const yaw = ref(0)
let raf = 0
let t0 = 0
function tourner(ms: number) {
  if (!t0) t0 = ms
  yaw.value = Math.round(Math.sin(((ms - t0) / 1000) * 0.8) * 0.55 * 400) / 400
  raf = requestAnimationFrame(tourner)
}
watch(
  [visible, large, reduit],
  ([v, l, r]) => {
    cancelAnimationFrame(raf)
    raf = 0
    if (v && l && !r) raf = requestAnimationFrame(tourner)
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  obs?.disconnect()
  cancelAnimationFrame(raf)
})
</script>

<template>
  <section id="styles" class="sec styles" aria-labelledby="t-styles">
    <div class="wrap sec-tete">
      <p v-reveal class="surtitre">Three styles</p>
      <h2 id="t-styles" v-reveal="1" class="titre-sec">One model.<br />Three looks.</h2>
      <p v-reveal="2" class="chapo">
        Every Mochi is a real 3D volume, so it can turn and still be itself. Switch the look with a single prop.
      </p>
    </div>

    <div class="wrap styles-piste">
      <div v-if="large" ref="scene" class="styles-scene" :style="{ background: ETAPES[actif]!.fond }">
        <span :key="actif" class="styles-geant" aria-hidden="true">{{ ETAPES[actif]!.nom }}</span>
        <Lazy :largeur="370" :hauteur="370">
          <MochiBot
            :size="360"
            shape="cercle"
            color="#8b5cf6"
            :rendu="ETAPES[actif]!.id"
            :mood="reduit ? undefined : 'repos'"
            :frozen-at="reduit ? 1.2 : undefined"
            :yaw="yaw"
            :interactions="false"
            :label="`A purple Mochi in the ${ETAPES[actif]!.nom} style`"
          />
        </Lazy>
        <div class="styles-points" aria-hidden="true">
          <span v-for="(e, i) in ETAPES" :key="e.id" :class="{ on: i === actif }" />
        </div>
      </div>

      <ol class="styles-etapes">
        <li
          v-for="(e, i) in ETAPES"
          :key="e.id"
          ref="etapes"
          class="etape"
          :class="{ on: i === actif }"
          :data-i="i"
        >
          <div v-if="!large" class="etape-image" :style="{ background: e.fond }">
            <Lazy garder :largeur="190" :hauteur="190">
              <MochiBot :size="180" shape="cercle" color="#8b5cf6" :rendu="e.id" :frozen-at="1.2" :yaw="0.35" :interactions="false" :label="`A purple Mochi in the ${e.nom} style`" />
            </Lazy>
          </div>
          <span class="etape-num">0{{ i + 1 }}</span>
          <h3>{{ e.nom }}</h3>
          <p>{{ e.texte }}</p>
          <code class="puce-code">{{ e.code }}</code>
        </li>
      </ol>
    </div>
  </section>
</template>
