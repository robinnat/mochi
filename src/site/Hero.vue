<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Affiche from './Affiche.vue'
import Vivant from './Vivant.vue'
import { HERO, SATELLITES as SAT } from './affiches'
import { useReduit } from './reduced'
import { useDefilement, useLargeur, usePointeur } from './motion'
import { CHIFFRES } from './catalog'

const reduit = useReduit()
const racine = ref<HTMLElement | null>(null)
const scene = ref<HTMLElement | null>(null)
const vivant = ref<InstanceType<typeof Vivant> | null>(null)
const regarder = (c: { nx: number; ny: number } | null) => vivant.value?.bot?.regarder?.(c)
const largeur = useLargeur()
/** Le grand Mochi : 400 px sur grand ecran, 240 sur telephone (taille en pixels, le rendu 3D suit). */
const taille = computed(() => (largeur.value >= 1100 ? 400 : largeur.value >= 700 ? 330 : 240))

useDefilement(racine)

/** Le corps se tourne un peu vers le pointeur (vraie 3D, `yaw`), lisse ; les yeux le regardent (`regarder`). */
const yaw = ref(0)
usePointeur(racine, (x) => {
  const v = Math.round(x * 0.38 * 200) / 200
  if (v !== yaw.value) yaw.value = v
})

function onMove(e: PointerEvent) {
  if (e.pointerType === 'touch' || !scene.value) return
  const r = scene.value.getBoundingClientRect()
  if (r.bottom < 0) return
  const nx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.32)
  const ny = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.4)
  regarder({ nx: Math.max(-1, Math.min(1, nx)), ny: Math.max(-1, Math.min(1, ny)) })
}
const onLeave = () => regarder(null)
onMounted(() => {
  if (reduit.value) return
  window.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  document.removeEventListener('pointerleave', onLeave)
})

/** Petits Mochi autour du grand : images figees (un seul rendu chacun), qui flottent en CSS. */
const PLACES = [
  { x: '4%', y: '6%', p: 1.4, d: 0 },
  { x: '80%', y: '2%', p: 2.2, d: 1.1 },
  { x: '84%', y: '70%', p: 1.1, d: 0.5 },
  { x: '0%', y: '74%', p: 1.8, d: 1.6 }
]
const SATELLITES = SAT.map((s, i) => ({ ...s, ...PLACES[i]! }))
</script>

<template>
  <header id="top" ref="racine" class="hero">
    <div class="hero-fond" aria-hidden="true" />
    <div class="hero-in">
      <div class="hero-texte">
        <p class="hero-badge rv-load" style="--d: 0">
          <span class="point" aria-hidden="true" /> Open source, MIT. Vue 3 and Three.js.
        </p>
        <h1 class="hero-titre" aria-label="Avatars that feel alive.">
          <span class="ligne l1" aria-hidden="true"><span class="mot" style="--d: 1">Avatars</span></span>
          <span class="ligne l2" aria-hidden="true"><span class="mot" style="--d: 2">that&nbsp;feel</span></span>
          <span class="ligne l3" aria-hidden="true"><span class="mot accent" style="--d: 3">alive.</span></span>
        </h1>
      </div>

      <div ref="scene" class="hero-scene" :style="{ '--t': taille + 'px' }">
        <div class="hero-halo" aria-hidden="true" />
        <div
          v-for="(s, i) in SATELLITES"
          :key="s.forme"
          class="satellite"
          aria-hidden="true"
          :style="{ left: s.x, top: s.y, '--p': s.p, '--fd': s.d + 's', '--k': i }"
        >
          <div class="flotte">
            <Affiche :nom="`sat-${s.forme}`" :taille="s.taille" eager />
          </div>
        </div>
        <div class="hero-bot">
          <Vivant
            ref="vivant"
            :taille="taille"
            affiche="hero"
            eager
            marge="0px"
            v-bind="HERO"
            :yaw="yaw"
            :frozen-at="reduit ? 0 : undefined"
            alt="Mochi, a round purple 3D avatar. It looks at your pointer; tap it, double tap it or press and hold."
          />
        </div>
      </div>

      <div class="hero-bas">
        <p class="hero-chapo rv-load" style="--d: 4">
          Mochi is a tiny avatar engine for the web. One soft 3D shape that breathes, blinks, looks at your pointer and
          reacts when you touch it. Drop it in your app in a few lines.
        </p>
        <div class="actions rv-load" style="--d: 5">
          <a class="btn primaire" href="/docs">Read the docs <span aria-hidden="true">→</span></a>
          <a class="btn" href="#customise">Make it yours</a>
        </div>
      </div>
    </div>

    <ul class="chiffres wrap" aria-label="Mochi in numbers">
      <li v-for="(c, i) in CHIFFRES" :key="c.label" v-reveal="i">
        <strong>{{ c.valeur }}</strong><span>{{ c.label }}</span>
      </li>
    </ul>
  </header>
</template>
