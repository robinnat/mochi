<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { urlAffiche } from './affiches'
import { themeEffectif } from './theme'
import { pagePrete, prechaufferStyles, RATIO_MAX, FPS_VIVANT } from './pret'

/**
 * Un Mochi vivant, sans jamais de 2D a l'ecran :
 * 1. l'affiche (image pre-rendue de la vraie 3D, meme cadrage, meme pose) s'affiche tout de suite ;
 * 2. quand l'element est a l'ecran ET que la page est prete, le composant (et Three.js) se charge, invisible ;
 * 3. a sa premiere image 3D (`pret`), il apparait en fondu par-dessus l'affiche.
 * Hors de l'ecran, il est demonte (aucune boucle ne tourne) et l'affiche reprend sa place.
 * Sans affiche (`affiche` nul), la place reste vide jusqu'au fondu.
 */
const MochiBot = defineAsyncComponent(() => import('@/components/MochiBot.vue'))

const props = withDefaults(
  defineProps<{ taille: number; affiche?: string | null; alt?: string; marge?: string; eager?: boolean; yaw?: number; tourner?: boolean }>(),
  {
    affiche: null,
    alt: '',
    marge: '200px',
    eager: false,
    yaw: 0,
    tourner: true
  }
)
defineOptions({ inheritAttrs: false })

const racine = ref<HTMLElement | null>(null)
const visible = ref(false)
const monte = ref(false)
const montre = ref(false)
const bot = ref<{ regarder?: (c: { nx: number; ny: number } | null) => void } | null>(null)
defineExpose({ bot })

let obs: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !racine.value) {
    visible.value = true
    return
  }
  obs = new IntersectionObserver((es) => (visible.value = !!es[es.length - 1]?.isIntersecting), { rootMargin: props.marge })
  obs.observe(racine.value)
})
onBeforeUnmount(() => obs?.disconnect())

/* ------------------------------------------------------------------ tourner au doigt (ou a la souris), avec inertie */
/**
 * Un glisse plutot horizontal sur le Mochi le fait tourner (`yaw`) ; un glisse plutot vertical laisse la page defiler
 * (`touch-action: pan-y`). Au lacher, il continue sur sa lancee et ralentit. S'ajoute au `yaw` donne par la page.
 * Le tap, le double tap et l'appui long restent ceux du composant (un glisse de plus de 10 px n'est plus un tap).
 */
const spin = ref(0)
/** radians par pixel glisse : un glisse de la largeur du Mochi fait a peu pres un tour */
const K = () => (2 * Math.PI) / Math.max(120, props.taille * 1.1)
let glisse: { id: number; x0: number; y0: number; x: number; t: number; actif: boolean } | null = null
let vitesse = 0
let rafInertie = 0
function arreterInertie() {
  cancelAnimationFrame(rafInertie)
  rafInertie = 0
}
function onDown(e: PointerEvent) {
  if (!props.tourner || !monte.value || (e.button !== undefined && e.button > 0)) return
  arreterInertie()
  vitesse = 0
  glisse = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, actif: false }
}
function onMove(e: PointerEvent) {
  const g = glisse
  if (!g || e.pointerId !== g.id) return
  const dx = e.clientX - g.x0
  const dy = e.clientY - g.y0
  if (!g.actif) {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      g.actif = true
      g.x = e.clientX
      try {
        racine.value?.setPointerCapture(e.pointerId)
      } catch {
        // pointeur deja relache
      }
    } else if (Math.abs(dy) > 10) {
      glisse = null
    }
    return
  }
  const d = (e.clientX - g.x) * K()
  const dt = Math.max(1, e.timeStamp - g.t)
  spin.value += d
  // vitesse lissee (radians par ms), pour une lancee reguliere
  vitesse = vitesse * 0.6 + (d / dt) * 0.4
  g.x = e.clientX
  g.t = e.timeStamp
}
function onUp(e: PointerEvent) {
  const g = glisse
  if (!g || e.pointerId !== g.id) return
  glisse = null
  if (!g.actif || e.timeStamp - g.t > 80) return
  let prec = 0
  const pas = (t: number) => {
    const dt = prec ? Math.min(48, t - prec) : 16
    prec = t
    spin.value += vitesse * dt
    vitesse *= Math.exp(-dt / 420)
    rafInertie = Math.abs(vitesse) > 0.00004 ? requestAnimationFrame(pas) : 0
  }
  rafInertie = requestAnimationFrame(pas)
}
onBeforeUnmount(arreterInertie)

function surPret() {
  montre.value = true
  prechaufferStyles()
}

watch(
  [visible, pagePrete],
  ([v, p]) => {
    if (v && p) monte.value = true
    else if (!v) {
      monte.value = false
      montre.value = false
    }
  },
  { immediate: true }
)
</script>

<template>
  <div
    ref="racine"
    class="vivant"
    :class="{ tournable: tourner && monte }"
    :style="{ width: taille + 'px', height: taille + 'px' }"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <img
      v-if="affiche"
      class="vivant-affiche"
      :class="{ cache: montre }"
      :src="urlAffiche(affiche, themeEffectif)"
      :width="taille"
      :height="taille"
      :alt="montre ? '' : alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      draggable="false"
    />
    <div v-if="monte" class="vivant-bot" :class="{ on: montre }">
      <MochiBot ref="bot" v-bind="$attrs" :size="taille" :yaw="yaw + spin" :label="alt" :max-pixel-ratio="RATIO_MAX" :fps="FPS_VIVANT" @pret="surPret" />
    </div>
  </div>
</template>
